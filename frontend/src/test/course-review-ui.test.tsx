import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AuthProvider } from '@/core/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { createTestRouter } from '@/app/router';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type { Course } from '@/core/courses/types';
import type { User } from '@/core/auth/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset();
});
afterAll(() => server.close());

const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
const lecturerUser = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;
const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;

function renderAppWithRoute(initialRoute: string, user = adminUser) {
  authStorage.setSession({
    token: `mock_jwt_${user.id}_test`,
    user,
    expiresAt: Date.now() + 3600000,
  });

  const router = createTestRouter([initialRoute]);

  return render(
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AuthProvider>
  );
}

function createEligibleCourse(
  title: string,
  user = lecturerUser,
  status: Course['status'] = 'draft'
): Course {
  const course = inMemoryStore.createCourse(
    {
      title,
      description: 'وصف تمهيدي للمقرر المعتمد',
      level: 'مبتدئ',
    },
    user
  );
  course.estimatedHours = 8;
  course.status = status;
  course.chapters[0].items.push({
    id: `item_${Date.now()}`,
    type: 'video',
    title: 'الدرس الافتتاحي',
    duration: '10:00',
  });
  inMemoryStore.saveCourseDraft(course.id, course, user);
  return course;
}

describe('Increment 9 — Approvals Dashboard & Routing Verification (Phase 4)', () => {
  beforeEach(() => {
    inMemoryStore.reset({ seedReviewDemo: false });
  });

  describe('Administrator Experience', () => {
    it('renders admin review queue table with FIFO ordering, stats, and badges', async () => {
      // Setup courses in review queue:
      // Course 1: Case A new draft submission
      const course1 = createEligibleCourse('مقرر نظم التحكم الآلي في القطارات', lecturerUser);
      inMemoryStore.submitCourseForReview(course1.id, lecturerUser);

      // Course 2: Case B published update
      const course2 = createEligibleCourse('مقرر هندسة السكك الحديدية المتقدمة', lecturerUser, 'published');
      inMemoryStore.submitCourseForReview(course2.id, lecturerUser);

      // Staged edits for course 2
      inMemoryStore.saveStagedAdminEdits(
        course2.id,
        {
          baselineId: course2.id,
          baselineSubmittedAt: course2.submittedAt || new Date().toISOString(),
          clientRevision: 1,
          patch: { title: 'مقرر هندسة السكك الحديدية المتقدمة - مراجع' },
        },
        adminUser
      );

      // Course 3: Course with missing submittedAt date to verify fallback
      const course3 = createEligibleCourse('مقرر تشغيل المحطات التبادلية', lecturerUser);
      course3.status = 'pending_admin';
      course3.submittedAt = undefined;
      inMemoryStore.saveCourseDraft(course3.id, course3, lecturerUser);

      renderAppWithRoute('/approvals', adminUser);

      // Verify page and table
      await waitFor(() => {
        expect(screen.getByTestId('admin-approvals-view')).toBeInTheDocument();
        expect(screen.getByTestId('admin-queue-table')).toBeInTheDocument();
      });

      // Verify stats
      expect(screen.getByTestId('admin-stat-total')).toHaveTextContent('3');
      expect(screen.getByTestId('admin-stat-new')).toHaveTextContent('2');
      expect(screen.getByTestId('admin-stat-update')).toHaveTextContent('1');

      // Verify type badges
      expect(screen.getByTestId(`badge-type-${course1.id}`)).toHaveTextContent('جديد');
      expect(screen.getByTestId(`badge-type-${course2.id}`)).toHaveTextContent('تحديث لمقرر منشور');

      // Verify staged edits badge
      expect(screen.getByTestId(`badge-staged-${course2.id}`)).toHaveTextContent('مسودة تعديلات الإدارة');

      // Verify neutral label "غير متوفر" for course with missing date
      const dateCell = screen.getByTestId(`date-${course3.id}`);
      expect(dateCell).toHaveTextContent('غير متوفر');

      // Verify action button navigation
      const reviewBtn = screen.getByTestId(`review-btn-${course1.id}`);
      expect(reviewBtn).toBeInTheDocument();
      fireEvent.click(reviewBtn);

      await waitFor(() => {
        expect(screen.getByTestId('course-review-page')).toBeInTheDocument();
      });
    });

    it('filters admin queue by submission type and search keyword', async () => {
      const courseNew = createEligibleCourse('مقرر إشارات مترو القاهرة', lecturerUser);
      inMemoryStore.submitCourseForReview(courseNew.id, lecturerUser);

      const courseUpdate = createEligibleCourse('مقرر صيانة عربات المترو', lecturerUser, 'published');
      inMemoryStore.submitCourseForReview(courseUpdate.id, lecturerUser);

      renderAppWithRoute('/approvals', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId(`queue-row-${courseNew.id}`)).toBeInTheDocument();
        expect(screen.getByTestId(`queue-row-${courseUpdate.id}`)).toBeInTheDocument();
      });

      // Filter to "مقررات جديدة"
      fireEvent.click(screen.getByTestId('admin-filter-new'));
      expect(screen.getByTestId(`queue-row-${courseNew.id}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`queue-row-${courseUpdate.id}`)).not.toBeInTheDocument();

      // Filter to "تحديثات"
      fireEvent.click(screen.getByTestId('admin-filter-update'));
      expect(screen.queryByTestId(`queue-row-${courseNew.id}`)).not.toBeInTheDocument();
      expect(screen.getByTestId(`queue-row-${courseUpdate.id}`)).toBeInTheDocument();

      // Search keyword
      fireEvent.click(screen.getByTestId('admin-filter-all'));
      const searchInput = screen.getByTestId('admin-search-input');
      fireEvent.change(searchInput, { target: { value: 'إشارات' } });

      expect(screen.getByTestId(`queue-row-${courseNew.id}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`queue-row-${courseUpdate.id}`)).not.toBeInTheDocument();
    });

    it('displays empty state when queue has no pending submissions', async () => {
      renderAppWithRoute('/approvals', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('admin-empty-state')).toBeInTheDocument();
      });

      expect(screen.getByText('لا توجد مقررات بانتظار المراجعة والاعتماد حالياً')).toBeInTheDocument();
    });
  });

  describe('Lecturer Experience', () => {
    it('renders lecturer submissions with metric cards, status pills, and feedback', async () => {
      // Setup course 1: Pending review
      const c1 = createEligibleCourse('مقرر مبادئ القيادة الآمنة', lecturerUser);
      inMemoryStore.submitCourseForReview(c1.id, lecturerUser);

      // Setup course 2: Returned with feedback
      const c2 = createEligibleCourse('مقرر بروتوكولات السلامة في المحطات', lecturerUser);
      inMemoryStore.submitCourseForReview(c2.id, lecturerUser);
      inMemoryStore.saveStagedAdminEdits(
        c2.id,
        {
          baselineId: c2.id,
          baselineSubmittedAt: c2.submittedAt || new Date().toISOString(),
          clientRevision: 1,
          patch: { title: 'مقرر بروتوكولات السلامة - تعديل الإدارة' },
        },
        adminUser
      );
      inMemoryStore.executeReviewDecision(
        c2.id,
        {
          outcome: 'returned_with_admin_edits',
          summaryMessage: 'يرجى مراجعة تفاصيل ساعات التدريب',
        },
        adminUser
      );

      // Setup course 3: Approved
      const c3 = createEligibleCourse('مقرر إدارة الحشود والركاب', lecturerUser);
      inMemoryStore.submitCourseForReview(c3.id, lecturerUser);
      inMemoryStore.executeReviewDecision(
        c3.id,
        {
          outcome: 'approved',
          publishOption: 'submitted_baseline',
        },
        adminUser
      );

      renderAppWithRoute('/approvals', lecturerUser);

      await waitFor(() => {
        expect(screen.getByTestId('lecturer-approvals-view')).toBeInTheDocument();
        expect(screen.getByTestId('lecturer-submissions-table')).toBeInTheDocument();
      });

      // Verify metrics
      expect(screen.getByTestId('lecturer-stat-pending')).toHaveTextContent('1');
      expect(screen.getByTestId('lecturer-stat-needs-revision')).toHaveTextContent('1');
      expect(screen.getByTestId('lecturer-stat-approved')).not.toHaveTextContent('0');

      // Verify status pills
      expect(screen.getByTestId(`status-badge-${c1.id}`)).toHaveTextContent('قيد المراجعة');
      expect(screen.getByTestId(`status-badge-${c2.id}`)).toHaveTextContent('تتطلب تعديلات');
      expect(screen.getByTestId(`status-badge-${c3.id}`)).toHaveTextContent('معتمد ومنشور');

      // Verify feedback summary
      const feedbackElem = screen.getByTestId(`feedback-summary-${c2.id}`);
      expect(feedbackElem).toHaveTextContent('يرجى مراجعة تفاصيل ساعات التدريب');

      // Verify action button navigation to Course Builder
      const builderBtn = screen.getByTestId(`builder-btn-${c1.id}`);
      expect(builderBtn).toBeInTheDocument();
      fireEvent.click(builderBtn);

      await waitFor(() => {
        expect(screen.getByTestId('course-builder-page')).toBeInTheDocument();
      });
    });

    it('filters lecturer submissions using status tabs', async () => {
      const c1 = createEligibleCourse('مقرر قيد التدقيق', lecturerUser);
      inMemoryStore.submitCourseForReview(c1.id, lecturerUser);

      const c2 = createEligibleCourse('مقرر تم اعتماده', lecturerUser);
      inMemoryStore.submitCourseForReview(c2.id, lecturerUser);
      inMemoryStore.executeReviewDecision(
        c2.id,
        {
          outcome: 'approved',
          publishOption: 'submitted_baseline',
        },
        adminUser
      );

      renderAppWithRoute('/approvals', lecturerUser);

      await waitFor(() => {
        expect(screen.getByTestId(`submission-row-${c1.id}`)).toBeInTheDocument();
        expect(screen.getByTestId(`submission-row-${c2.id}`)).toBeInTheDocument();
      });

      // Click "معتمدة" tab
      fireEvent.click(screen.getByTestId('lecturer-filter-approved'));
      expect(screen.queryByTestId(`submission-row-${c1.id}`)).not.toBeInTheDocument();
      expect(screen.getByTestId(`submission-row-${c2.id}`)).toBeInTheDocument();

      // Click "قيد المراجعة" tab
      fireEvent.click(screen.getByTestId('lecturer-filter-pending'));
      expect(screen.getByTestId(`submission-row-${c1.id}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`submission-row-${c2.id}`)).not.toBeInTheDocument();
    });

    it('displays lecturer empty state when no courses exist', async () => {
      const freshLecturer: User = {
        id: 'usr_lect_999',
        name: 'أ. د. سمير عبد الفتاح',
        email: 'samir.lecturer@metro.gov.eg',
        role: 'lecturer',
        jobTitle: 'محاضر تدريب',
        department: 'قسم هندسة النظم',
        initials: 'س ع',
      };
      renderAppWithRoute('/approvals', freshLecturer);

      await waitFor(() => {
        expect(screen.getByTestId('lecturer-empty-state')).toBeInTheDocument();
      });

      expect(screen.getByText('لم تقم بتقديم أي مقررات للاعتماد بعد')).toBeInTheDocument();
    });
  });

  describe('Authorization & Redirect Aliases', () => {
    it('blocks unauthorized trainee access to /approvals with warning notice', async () => {
      renderAppWithRoute('/approvals', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('approvals-unauthorized')).toBeInTheDocument();
      });

      expect(screen.getByText('غير مصرح بالوصول')).toBeInTheDocument();
    });

    it('redirects canonical alias /audit to /approvals', async () => {
      renderAppWithRoute('/audit', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('admin-approvals-view')).toBeInTheDocument();
      });
    });

    it('redirects canonical alias /admin/approvals to /approvals', async () => {
      renderAppWithRoute('/admin/approvals', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('admin-approvals-view')).toBeInTheDocument();
      });
    });

    it('redirects canonical alias /admin/approvals/:courseId to /admin/review/:courseId', async () => {
      renderAppWithRoute('/admin/approvals/course-metro-999', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('course-review-page')).toBeInTheDocument();
      });

      expect(screen.getByText(/course-metro-999/)).toBeInTheDocument();
    });

    it('handles server errors gracefully and allows retry', async () => {
      server.use(
        http.get('/api/approvals/queue', () => {
          return HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 });
        })
      );

      renderAppWithRoute('/approvals', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('approvals-error')).toBeInTheDocument();
      });

      expect(screen.getByText('إعادة المحاولة')).toBeInTheDocument();

      // Reset handlers and retry
      server.resetHandlers();
      fireEvent.click(screen.getByText('إعادة المحاولة'));

      await waitFor(() => {
        expect(screen.getByTestId('admin-approvals-view')).toBeInTheDocument();
      });
    });
  });
});
