import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { authStorage } from '@/core/auth/authStorage';
import { AuthProvider } from '@/core/auth/AuthContext';
import { ProtectedRoute } from '@/core/auth/ProtectedRoute';
import { AppLayout } from '@/app/layouts/AppLayout';
import { CoursesCatalogPage } from '@/pages/CoursesCatalogPage';
import { CourseDetailPage } from '@/pages/CourseDetailPage';
import { CourseCard } from '@/features/courses/components/CourseCard';
import { CourseGrid } from '@/features/courses/components/CourseGrid';
import { CourseCurriculum } from '@/features/courses/components/CourseCurriculum';
import { MOCK_COURSES } from '@/mocks/fixtures/mockCourses';
import type { Course } from '@/core/courses/types';

// Establish MSW mock server for tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
});
afterAll(() => server.close());

const mockUser = {
  id: 'usr-1',
  name: 'م. أحمد ممدوح',
  email: 'ahmed.mamdouh@cairometro.gov.eg',
  role: 'admin' as const,
  department: 'الإدارة المركزية للتشغيل',
  jobTitle: 'مدير عام التشغيل والتدريب',
  initials: 'أم',
};

describe('Increment 4: Course Catalog & Course Details (Read-Only) Verification', () => {
  describe('Course Catalog Page (/courses)', () => {
    it('loads and displays courses from the mock API', async () => {
      render(
        <MemoryRouter>
          <CoursesCatalogPage />
        </MemoryRouter>
      );

      // Initial loading state
      expect(screen.getByTestId('courses-loading-grid')).toBeInTheDocument();

      // Wait for courses to load from MSW
      await waitFor(() => {
        expect(screen.getByText('سلامة العمل والسلوك المهني')).toBeInTheDocument();
      });

      // Verify course count and key course cards
      expect(screen.getByText('خدمة العملاء في مترو الأنفاق')).toBeInTheDocument();
      expect(screen.getByText('تشغيل وصيانة القطارات')).toBeInTheDocument();
    });

    it('filters courses by search keyword', async () => {
      render(
        <MemoryRouter>
          <CoursesCatalogPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('سلامة العمل والسلوك المهني')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText(/البحث في الدورات التدريبية/i);
      fireEvent.change(searchInput, { target: { value: 'إسعافات' } });

      await waitFor(() => {
        expect(screen.getByText('الإسعافات الأولية الطارئة')).toBeInTheDocument();
        expect(screen.queryByText('سلامة العمل والسلوك المهني')).not.toBeInTheDocument();
      });
    });

    it('filters courses by level pills', async () => {
      render(
        <MemoryRouter>
          <CoursesCatalogPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('سلامة العمل والسلوك المهني')).toBeInTheDocument();
      });

      // Click intermediate level pill ("متوسط")
      const intermediatePill = screen.getByRole('tab', { name: 'متوسط' });
      fireEvent.click(intermediatePill);

      await waitFor(() => {
        // Course CRS004 is intermediate: الإسعافات الأولية الطارئة
        expect(screen.getByText('الإسعافات الأولية الطارئة')).toBeInTheDocument();
        // Beginner courses should not be visible
        expect(screen.queryByText('سلامة العمل والسلوك المهني')).not.toBeInTheDocument();
      });
    });

    it('sorts courses using the accessible sort dropdown with semantic design-system icons', async () => {
      render(
        <MemoryRouter>
          <CoursesCatalogPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('سلامة العمل والسلوك المهني')).toBeInTheDocument();
      });

      // Find the sort combobox button
      const sortButton = screen.getByRole('combobox', { name: /ترتيب حسب/i });
      expect(sortButton).toBeInTheDocument();
      expect(sortButton).toHaveAttribute('aria-expanded', 'false');

      // Click to open dropdown
      fireEvent.click(sortButton);
      expect(sortButton).toHaveAttribute('aria-expanded', 'true');

      // Check all 3 options are rendered in listbox with their labels
      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /الأحدث/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /الأعلى تقييمًا/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /الأكثر تسجيلاً/i })).toBeInTheDocument();

      // Click "الأعلى تقييمًا" option
      const highestRatedOption = screen.getByRole('option', { name: /الأعلى تقييمًا/i });
      fireEvent.click(highestRatedOption);

      // Dropdown closes and updates current label
      expect(sortButton).toHaveAttribute('aria-expanded', 'false');
      expect(sortButton).toHaveTextContent('الأعلى تقييمًا');
    });

    it('handles empty search results with helpful message and filter reset action', async () => {
      render(
        <MemoryRouter>
          <CoursesCatalogPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('سلامة العمل والسلوك المهني')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText(/البحث في الدورات التدريبية/i);
      fireEvent.change(searchInput, { target: { value: 'مصطلح غير موجود نهائيا 999' } });

      await waitFor(() => {
        expect(screen.getByTestId('courses-empty-state')).toBeInTheDocument();
        expect(screen.getByText(/لا توجد نتائج مطابقة لبحثك/i)).toBeInTheDocument();
      });

      // Click reset button
      const resetBtn = screen.getByRole('button', { name: /إعادة ضبط معايير البحث/i });
      fireEvent.click(resetBtn);

      await waitFor(() => {
        expect(screen.getByText('سلامة العمل والسلوك المهني')).toBeInTheDocument();
      });
    });

    it('renders API error state and recovers on retry', async () => {
      // Mock API error
      server.use(
        http.get('/api/courses', () => {
          return HttpResponse.json({ message: 'فشل في جلب البيانات' }, { status: 500 });
        })
      );

      render(
        <MemoryRouter>
          <CoursesCatalogPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('courses-error-state')).toBeInTheDocument();
        expect(screen.getByText(/تعذر تحميل الدورات التدريبية/i)).toBeInTheDocument();
      });

      // Reset handler to normal and retry
      server.resetHandlers();

      const retryBtn = screen.getByRole('button', { name: /إعادة المحاولة/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByText('سلامة العمل والسلوك المهني')).toBeInTheDocument();
      });
    });

    it('gracefully handles HTML response on /api/courses without exposing raw SyntaxError or HTML tokens', async () => {
      // Simulate Vite dev server SPA fallback returning HTML (the exact bug scenario)
      server.use(
        http.get('/api/courses', () => {
          return new HttpResponse(
            '<!doctype html><html><head><title>Vite App</title></head><body><div id="root"></div></body></html>',
            {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        })
      );

      render(
        <MemoryRouter>
          <CoursesCatalogPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('courses-error-state')).toBeInTheDocument();
        expect(screen.getByText(/تعذر تحميل الدورات التدريبية/i)).toBeInTheDocument();
      });

      // Verify no technical parser exceptions, tokens, or raw HTML are rendered
      expect(screen.queryByText(/Unexpected token/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/<!doctype/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/is not valid JSON/i)).not.toBeInTheDocument();

      // Verify retry button remains functional and recovers when normal response returns
      server.resetHandlers();
      const retryBtn = screen.getByRole('button', { name: /إعادة المحاولة/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByText('سلامة العمل والسلوك المهني')).toBeInTheDocument();
      });
    });

    it('CourseGrid sanitizes any technical error prop passed to it', () => {
      render(
        <CourseGrid
          courses={[]}
          error="SyntaxError: Unexpected token '<', '<!doctype ...' is not valid JSON"
          onRetry={() => {}}
        />
      );

      expect(screen.getByTestId('courses-error-state')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'تعذر تحميل الدورات التدريبية' })).toBeInTheDocument();
      expect(screen.getByText('تعذر تحميل الدورات التدريبية حاليًا. يرجى المحاولة مرة أخرى.')).toBeInTheDocument();
      expect(screen.queryByText(/Unexpected token/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/SyntaxError/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /إعادة المحاولة/i })).toBeInTheDocument();
    });

    it('renders CourseCard without crashing when optional fields are missing', () => {
      const minimalCourse: Course = {
        id: 'CRS-TEST-MINIMAL',
        title: 'دورة تجريبية مبسطة',
        description: 'وصف تجريبي لدورة بدون صورة أو مهن مستهدفة',
        level: 'مبتدئ',
        estimatedHours: 5,
        rating: 4.5,
        ratingCount: 10,
        enrollmentCount: 50,
        lecturerId: 'USR-TEST',
        lecturerName: 'محاضر تجريبي',
        status: 'published',
        chapters: [],
      };

      render(
        <MemoryRouter>
          <CourseCard course={minimalCourse} />
        </MemoryRouter>
      );

      expect(screen.getByText('دورة تجريبية مبسطة')).toBeInTheDocument();
      expect(screen.getByText('محاضر تجريبي')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('ساعة')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /عرض تفاصيل دورة/i })).toHaveAttribute(
        'href',
        '/courses/CRS-TEST-MINIMAL'
      );
    });
  });

  describe('Course Details Page (/courses/:courseId)', () => {
    it('renders complete course information for a valid course ID', async () => {
      render(
        <MemoryRouter initialEntries={['/courses/CRS001']}>
          <Routes>
            <Route path="/courses/:courseId" element={<CourseDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      // Loading state initially
      expect(screen.getByTestId('course-detail-loading')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('course-detail-page')).toBeInTheDocument();
      });

      // Verify title, lecturer, level badge, estimated hours
      expect(screen.getByRole('heading', { level: 1, name: 'سلامة العمل والسلوك المهني' })).toBeInTheDocument();
      expect(screen.getAllByText('م. خالد إبراهيم').length).toBeGreaterThan(0);
      expect(screen.getAllByText('مبتدئ').length).toBeGreaterThan(0);
      expect(screen.getByText(/8.*ساعة تدريبية/)).toBeInTheDocument();

      // Verify read-only banner
      expect(screen.getByText(/حالة البرنامج في المنظومة/i)).toBeInTheDocument();
      expect(screen.getByText(/هذا البرنامج متاح للاستعراض والقراءة الكاملة/i)).toBeInTheDocument();

      // Verify curriculum chapters
      expect(screen.getByText('مقدمة في السلامة المهنية')).toBeInTheDocument();
      expect(screen.getByText('إجراءات السلامة في الأنفاق')).toBeInTheDocument();
    });

    it('expands and collapses curriculum accordion items and displays lesson details', async () => {
      const course = MOCK_COURSES[0];
      render(<CourseCurriculum chapters={course.chapters} />);

      // First chapter header
      const firstChapterButton = screen.getByText('مقدمة في السلامة المهنية');
      expect(firstChapterButton).toBeInTheDocument();

      // First chapter is open by default: its lessons should be visible
      expect(screen.getByText('مفاهيم السلامة الأساسية')).toBeInTheDocument();
      expect(screen.getByText('18:30')).toBeInTheDocument();

      // Toggle accordion to close
      fireEvent.click(firstChapterButton);
      expect(screen.queryByText('مفاهيم السلامة الأساسية')).not.toBeInTheDocument();

      // Toggle accordion to open again
      fireEvent.click(firstChapterButton);
      expect(screen.getByText('مفاهيم السلامة الأساسية')).toBeInTheDocument();
    });

    it('displays 404 not-found state when course ID does not exist', async () => {
      render(
        <MemoryRouter initialEntries={['/courses/CRS-NON-EXISTENT']}>
          <Routes>
            <Route path="/courses/:courseId" element={<CourseDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('course-not-found')).toBeInTheDocument();
      });

      expect(screen.getByText(/الدورة التدريبية غير موجودة/i)).toBeInTheDocument();
      expect(screen.getByText(/CRS-NON-EXISTENT/i)).toBeInTheDocument();

      // Link to return to catalog
      const returnLink = screen.getByRole('link', { name: /العودة إلى دليل الدورات التدريبية/i });
      expect(returnLink).toHaveAttribute('href', '/courses');
    });

    it('handles server error on course details page with retry button', async () => {
      server.use(
        http.get('/api/courses/:courseId', () => {
          return HttpResponse.json({ message: 'فشل في الاتصال' }, { status: 500 });
        })
      );

      render(
        <MemoryRouter initialEntries={['/courses/CRS001']}>
          <Routes>
            <Route path="/courses/:courseId" element={<CourseDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('course-detail-error')).toBeInTheDocument();
        expect(screen.getByText(/تعذر تحميل بيانات الدورة/i)).toBeInTheDocument();
      });

      // Reset and retry
      server.resetHandlers();
      const retryBtn = screen.getByRole('button', { name: /إعادة المحاولة/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByTestId('course-detail-page')).toBeInTheDocument();
      });
    });
  });

  describe('Integration & Authentication Guarding', () => {
    it('redirects unauthenticated users trying to access /courses to /login', async () => {
      authStorage.clearSession();

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/courses']}>
            <Routes>
              <Route path="/login" element={<div data-testid="login-page">صفحة تسجيل الدخول</div>} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="courses" element={<CoursesCatalogPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });
    });

    it('redirects unauthenticated users trying to access /courses/:courseId to /login', async () => {
      authStorage.clearSession();

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/courses/CRS001']}>
            <Routes>
              <Route path="/login" element={<div data-testid="login-page">صفحة تسجيل الدخول</div>} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="courses/:courseId" element={<CourseDetailPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });
    });

    it('allows authenticated users to view /courses within AppLayout and marks navigation active', async () => {
      authStorage.setSession({
        token: 'valid-test-token',
        user: mockUser,
        expiresAt: Date.now() + 3600000,
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/courses']}>
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="courses" element={<CoursesCatalogPage />} />
                <Route path="courses/:courseId" element={<CourseDetailPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      // Verify AppLayout rendered navbar with user initials
      expect(screen.getByText('أم')).toBeInTheDocument();

      // Wait for courses catalog content
      await waitFor(() => {
        expect(screen.getByText('دليل الدورات التدريبية المعتمدة')).toBeInTheDocument();
      });

      // Verify active navigation link
      const coursesNavLink = screen.getByRole('link', { name: /دليل الدورات التدريبية/i });
      expect(coursesNavLink).toHaveAttribute('href', '/courses');
      // Active link has bg-primary-dark
      expect(coursesNavLink.className).toContain('bg-primary-dark');
    });

    it('marks course navigation link active when viewing course details /courses/:courseId', async () => {
      authStorage.setSession({
        token: 'valid-test-token',
        user: mockUser,
        expiresAt: Date.now() + 3600000,
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/courses/CRS001']}>
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="courses" element={<CoursesCatalogPage />} />
                <Route path="courses/:courseId" element={<CourseDetailPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('course-detail-page')).toBeInTheDocument();
      });

      // The sidebar NavLink for /courses matches /courses/CRS001 as active
      const coursesNavLinks = screen.getAllByRole('link', { name: /دليل الدورات التدريبية/i });
      expect(coursesNavLinks[0].className).toContain('bg-primary-dark');
    });
  });
});
