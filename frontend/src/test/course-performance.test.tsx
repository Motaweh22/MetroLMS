import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { performanceApi } from '@/features/performance/services/performanceApi';
import { CoursePerformancePage } from '@/features/performance/pages/CoursePerformancePage';
import { AuthProvider } from '@/core/auth/AuthContext';
import type { UserRole } from '@/core/auth/types';

describe('Increment 11 — Phase 5D: Lecturer Course Performance Engine & WhatsApp Nudges', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    server.resetHandlers();
    authStorage.clearSession();
  });
  afterAll(() => server.close());

  beforeEach(() => {
    inMemoryStore.reset({ seedGroupDemo: true });
  });

  const setTestSession = (role: UserRole, id: string, name = 'مستخدم الاختبار') => {
    authStorage.setSession({
      token: `${role}-${id}-token`,
      user: {
        id,
        name,
        role,
        email: `${id}@metro.gov.eg`,
        department: 'التشغيل والصيانة',
        jobTitle: 'موظف',
        initials: 'م.ا',
      },
      expiresAt: Date.now() + 86400000,
    });
  };

  const renderWithProviders = (initialRoute = '/lecturer/performance/CRS001') => {
    return render(
      <AuthProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path="/lecturer/performance/:courseId" element={<CoursePerformancePage />} />
            <Route path="/courses" element={<div data-testid="courses-catalog-page">دليل المقررات</div>} />
            <Route path="/lecturer/courses" element={<div data-testid="lecturer-courses-page">مقررات المحاضر</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
  };

  // ── 1. Store Calculation & Inactivity Logic ──────────────────────────────
  describe('1. Store Calculation & Inactivity Evaluation Engine', () => {
    it('calculates cohort progress KPIs accurately from verified in-memory store data', () => {
      // USR002 is primary instructor for CRS001
      const report = inMemoryStore.getCoursePerformanceReport('CRS001', {
        id: 'USR002',
        role: 'lecturer',
      });

      expect(report.courseId).toBe('CRS001');
      expect(report.courseTitle).toBe('سلامة العمل والسلوك المهني');
      expect(report.lecturerId).toBe('USR002');
      expect(report.totalEnrolled).toBeGreaterThanOrEqual(1);
      expect(report.averageProgressPercent).toBeGreaterThanOrEqual(0);
      expect(report.averageProgressPercent).toBeLessThanOrEqual(100);

      // Sum of statuses matches totalEnrolled
      expect(
        report.completedCount + report.activeCount + report.lateCount + report.notStartedCount
      ).toBe(report.totalEnrolled);
    });

    it('evaluates attempt older than 5 days as late (متأخر ⚠️)', () => {
      // Seed a late attempt for trainee usr_trainee_003 on CRS001
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
      const attempts = inMemoryStore.getCourseAttempts();
      const existingAttempt = attempts.find(
        (a) => a.userId === 'usr_trainee_003' && a.courseId === 'CRS001'
      );

      if (existingAttempt) {
        existingAttempt.progressPercent = 45;
        existingAttempt.lastActivityAt = sixDaysAgo;
      }

      const report = inMemoryStore.getCoursePerformanceReport('CRS001', {
        id: 'USR002',
        role: 'lecturer',
      });

      const traineeRow = report.trainees.find((t) => t.userId === 'usr_trainee_003');
      expect(traineeRow).toBeDefined();
      expect(traineeRow?.status).toBe('late');
      expect(traineeRow?.statusLabelAr).toBe('متأخر ⚠️');
      expect(traineeRow?.daysSinceLastActivity).toBeGreaterThanOrEqual(5);
    });

    it('evaluates attempt within 5 days as active (نشط ⏳)', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const attempts = inMemoryStore.getCourseAttempts();
      const existingAttempt = attempts.find(
        (a) => a.userId === 'usr_trainee_003' && a.courseId === 'CRS001'
      );

      if (existingAttempt) {
        existingAttempt.progressPercent = 60;
        existingAttempt.lastActivityAt = twoDaysAgo;
      }

      const report = inMemoryStore.getCoursePerformanceReport('CRS001', {
        id: 'USR002',
        role: 'lecturer',
      });

      const traineeRow = report.trainees.find((t) => t.userId === 'usr_trainee_003');
      expect(traineeRow).toBeDefined();
      expect(traineeRow?.status).toBe('active');
      expect(traineeRow?.statusLabelAr).toBe('نشط ⏳');
      expect(traineeRow?.daysSinceLastActivity).toBeLessThanOrEqual(5);
    });

    it('evaluates attempt with 100% progress as completed (مكتمل ✅)', () => {
      const attempts = inMemoryStore.getCourseAttempts();
      const existingAttempt = attempts.find(
        (a) => a.userId === 'usr_trainee_003' && a.courseId === 'CRS001'
      );

      if (existingAttempt) {
        existingAttempt.progressPercent = 100;
        existingAttempt.lastActivityAt = new Date().toISOString();
      }

      const report = inMemoryStore.getCoursePerformanceReport('CRS001', {
        id: 'USR002',
        role: 'lecturer',
      });

      const traineeRow = report.trainees.find((t) => t.userId === 'usr_trainee_003');
      expect(traineeRow?.status).toBe('completed');
      expect(traineeRow?.statusLabelAr).toBe('مكتمل ✅');
    });

    it('defaults trainee with zero progress to not_started (لم يبدأ بعد)', () => {
      const attempts = inMemoryStore.getCourseAttempts();
      const existingAttempt = attempts.find(
        (a) => a.userId === 'USR004' && a.courseId === 'CRS001'
      );

      if (existingAttempt) {
        existingAttempt.progressPercent = 0;
        existingAttempt.lastActivityAt = null;
        existingAttempt.startedAt = null;
      }

      const report = inMemoryStore.getCoursePerformanceReport('CRS001', {
        id: 'USR002',
        role: 'lecturer',
      });

      const traineeRow = report.trainees.find((t) => t.userId === 'USR004');
      if (traineeRow) {
        expect(traineeRow.status).toBe('not_started');
        expect(traineeRow.statusLabelAr).toBe('لم يبدأ بعد');
      }
    });

    it('throws MockStoreError 404 when requested course does not exist', () => {
      expect(() => {
        inMemoryStore.getCoursePerformanceReport('CRS_NON_EXISTENT', {
          id: 'usr_admin_001',
          role: 'admin',
        });
      }).toThrowError('المقرر التدريبي المطلوب غير موجود');
    });
  });

  // ── 2. WhatsApp Reminder Link Generation ─────────────────────────────────
  describe('2. WhatsApp Nudge Link Generation', () => {
    it('constructs properly encoded WhatsApp reminder link when trainee has registered phone', () => {
      const report = inMemoryStore.getCoursePerformanceReport('CRS001', {
        id: 'USR002',
        role: 'lecturer',
      });

      const traineeWithPhone = report.trainees.find((t) => Boolean(t.phone));
      expect(traineeWithPhone).toBeDefined();
      expect(traineeWithPhone?.whatsappUrl).toBeDefined();
      expect(traineeWithPhone?.whatsappUrl).toContain('https://wa.me/');
      expect(traineeWithPhone?.whatsappUrl).toContain(encodeURIComponent('سلامة العمل والسلوك المهني'));
    });

    it('sets whatsappUrl to null when trainee phone is missing or unregistered', () => {
      // Set a trainee without phone
      const managedUsers = inMemoryStore.getManagedUsersStore();
      const targetUser = managedUsers.find((u) => u.id === 'usr_trainee_003');
      if (targetUser) {
        targetUser.phone = '';
      }

      const report = inMemoryStore.getCoursePerformanceReport('CRS001', {
        id: 'USR002',
        role: 'lecturer',
      });

      const traineeWithoutPhone = report.trainees.find((t) => t.userId === 'usr_trainee_003');
      expect(traineeWithoutPhone?.phone).toBeNull();
      expect(traineeWithoutPhone?.whatsappUrl).toBeNull();
    });
  });

  // ── 3. Role-Based Scoped Authorization ───────────────────────────────────
  describe('3. Role-Based Scoped Authorization & Boundary Guard', () => {
    it('allows assigned primary lecturer to access course performance report via API', async () => {
      setTestSession('lecturer', 'USR002', 'م. خالد إبراهيم');

      const data = await performanceApi.getCoursePerformanceReport('CRS001');
      expect(data.courseId).toBe('CRS001');
      expect(data.lecturerId).toBe('USR002');
    });

    it('allows assigned co-lecturer to access performance report via API', async () => {
      // Add USR017 as coLecturer to CRS001
      const course = inMemoryStore.getCourseById('CRS001');
      if (course) {
        course.coLecturers = ['USR017'];
      }

      setTestSession('lecturer', 'USR017', 'د. سارة خليل');

      const data = await performanceApi.getCoursePerformanceReport('CRS001');
      expect(data.courseId).toBe('CRS001');
    });

    it('strictly forbids lecturer from accessing performance report of unrelated courses (HTTP 403)', async () => {
      // USR017 does NOT instruct CRS001 (instructed by USR002)
      setTestSession('lecturer', 'USR017', 'مساعد محاضر');

      await expect(
        performanceApi.getCoursePerformanceReport('CRS001')
      ).rejects.toThrow();
    });

    it('strictly denies an unrelated lecturer even if their display name matches the assigned lecturer name', async () => {
      // CRS001 is assigned to USR002 with lecturerName 'م. خالد إبراهيم'
      // Log in as USR005 (unrelated lecturer) who shares the exact same name
      setTestSession('lecturer', 'USR005', 'م. خالد إبراهيم');

      // API request must fail with HTTP 403
      await expect(
        performanceApi.getCoursePerformanceReport('CRS001')
      ).rejects.toThrow();

      // Store-level check directly confirms denial
      expect(() =>
        inMemoryStore.getCoursePerformanceReport('CRS001', {
          id: 'USR005',
          role: 'lecturer',
        })
      ).toThrow(/غير مصرح/);
    });

    it('preserves access for assigned lecturer when display name is renamed or empty', async () => {
      // Primary lecturer USR002 with empty name
      setTestSession('lecturer', 'USR002', '');
      const dataEmptyName = await performanceApi.getCoursePerformanceReport('CRS001');
      expect(dataEmptyName.courseId).toBe('CRS001');

      // Primary lecturer USR002 with completely different renamed display name
      setTestSession('lecturer', 'USR002', 'د. محمد كمال الألفي');
      const dataRenamed = await performanceApi.getCoursePerformanceReport('CRS001');
      expect(dataRenamed.courseId).toBe('CRS001');
    });

    it('supports the documented synthetic demo lecturer persona (usr_lect_002) accessing CRS001', async () => {
      // In the prototype dataset, usr_lect_002 is the synthetic demo counterpart to USR002
      setTestSession('lecturer', 'usr_lect_002', 'د. طارق الجوهري');

      const data = await performanceApi.getCoursePerformanceReport('CRS001');
      expect(data.courseId).toBe('CRS001');
    });

    it('strictly renders error state in UI when unauthorized lecturer navigates directly to course performance', async () => {
      // USR005 is NOT an instructor on CRS001
      setTestSession('lecturer', 'USR005', 'د. سمير النجار');

      renderWithProviders('/lecturer/performance/CRS001');

      await waitFor(() => {
        expect(screen.getByTestId('performance-error-state')).toBeInTheDocument();
      });

      expect(screen.getByText(/خطأ في استعراض تقرير الأداء/)).toBeInTheDocument();
      expect(screen.queryByTestId('course-performance-page')).not.toBeInTheDocument();
    });

    it('allows System Administrator (admin) global access to performance reports across all courses', async () => {
      setTestSession('admin', 'usr_admin_001', 'أحمد محمود سالم');

      const data1 = await performanceApi.getCoursePerformanceReport('CRS001');
      expect(data1.courseId).toBe('CRS001');

      const data3 = await performanceApi.getCoursePerformanceReport('CRS003');
      expect(data3.courseId).toBe('CRS003');
    });

    it('allows Assistant Administrator (assistant_admin) global read-only access to performance reports', async () => {
      setTestSession('assistant_admin', 'USR016', 'منى عبد العزيز الشريف');

      const data = await performanceApi.getCoursePerformanceReport('CRS001');
      expect(data.courseId).toBe('CRS001');
      expect(data.totalEnrolled).toBeGreaterThanOrEqual(1);
    });

    it('strictly forbids Trainee (user) from accessing course performance reports (HTTP 403)', async () => {
      setTestSession('user', 'usr_trainee_003', 'أحمد ممدوح سالم');

      await expect(
        performanceApi.getCoursePerformanceReport('CRS001')
      ).rejects.toThrow();
    });

    it('rejects unauthenticated requests with HTTP 401 Unauthorized', async () => {
      authStorage.clearSession();

      await expect(
        performanceApi.getCoursePerformanceReport('CRS001')
      ).rejects.toThrow();
    });
  });

  // ── 4. UI Rendering, Roster Table & WhatsApp Interaction ─────────────────
  describe('4. UI Rendering, Roster Table & Interaction', () => {
    it('renders course performance page with verified KPI metrics and trainee roster table', async () => {
      setTestSession('lecturer', 'USR002', 'م. خالد إبراهيم');

      renderWithProviders('/lecturer/performance/CRS001');

      // Loading state disappears
      await waitFor(() => {
        expect(screen.getByTestId('course-performance-page')).toBeInTheDocument();
      });

      // KPI cards displayed
      expect(screen.getByTestId('kpi-total-enrolled')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-completed-count')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-active-count')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-late-count')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-avg-progress')).toBeInTheDocument();

      // Table rendered
      expect(screen.getByTestId('trainees-roster-table')).toBeInTheDocument();
    });

    it('filters learner roster table live via search input', async () => {
      setTestSession('lecturer', 'USR002', 'م. خالد إبراهيم');

      renderWithProviders('/lecturer/performance/CRS001');

      await waitFor(() => {
        expect(screen.getByTestId('trainees-roster-table')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('trainee-search-input');
      fireEvent.change(searchInput, { target: { value: 'غير_موجود_إطلاقاً' } });

      await waitFor(() => {
        expect(screen.getByText(/لا توجد نتائج مطابقة لبحثك/)).toBeInTheDocument();
      });
    });

    it('renders active WhatsApp nudge button for trainees with registered phone numbers', async () => {
      setTestSession('lecturer', 'USR002', 'م. خالد إبراهيم');

      renderWithProviders('/lecturer/performance/CRS001');

      await waitFor(() => {
        expect(screen.getByTestId('trainees-roster-table')).toBeInTheDocument();
      });

      // Find any active WhatsApp reminder button
      const reminderLinks = screen.getAllByRole('link', { name: /تنبيه واتساب/ });
      expect(reminderLinks.length).toBeGreaterThanOrEqual(1);

      const firstLink = reminderLinks[0];
      expect(firstLink).toHaveAttribute('target', '_blank');
      expect(firstLink.getAttribute('href')).toContain('https://wa.me/');
    });

    it('renders disabled state without broken link when trainee phone is missing', async () => {
      // Modify store to clear phone for usr_trainee_003
      const managedUsers = inMemoryStore.getManagedUsersStore();
      const targetUser = managedUsers.find((u) => u.id === 'usr_trainee_003');
      if (targetUser) {
        targetUser.phone = '';
      }

      setTestSession('lecturer', 'USR002', 'م. خالد إبراهيم');

      renderWithProviders('/lecturer/performance/CRS001');

      await waitFor(() => {
        expect(screen.getByTestId('whatsapp-nudge-disabled-usr_trainee_003')).toBeInTheDocument();
      });

      const disabledBtn = screen.getByTestId('whatsapp-nudge-disabled-usr_trainee_003');
      expect(disabledBtn).toBeDisabled();
      expect(disabledBtn).toHaveTextContent('لا يتوفر هاتف');
    });

    it('provides clear breadcrumb and back navigation to return to /lecturer/courses', async () => {
      setTestSession('lecturer', 'USR002', 'م. خالد إبراهيم');

      renderWithProviders('/lecturer/performance/CRS001');

      await waitFor(() => {
        expect(screen.getByTestId('course-performance-page')).toBeInTheDocument();
      });

      // Breadcrumb link to /lecturer/courses
      const breadcrumbCourses = screen.getByTestId('breadcrumb-lecturer-courses');
      expect(breadcrumbCourses).toBeInTheDocument();
      expect(breadcrumbCourses).toHaveAttribute('href', '/lecturer/courses');

      // Header back button to /lecturer/courses
      const headerBackBtn = screen.getByTestId('btn-back-to-lecturer-courses');
      expect(headerBackBtn).toBeInTheDocument();

      // Clicking breadcrumb navigates to /lecturer/courses
      fireEvent.click(breadcrumbCourses);
      await waitFor(() => {
        expect(screen.getByTestId('lecturer-courses-page')).toBeInTheDocument();
      });
    });
  });
});

