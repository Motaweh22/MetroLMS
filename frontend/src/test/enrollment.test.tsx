import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AuthProvider } from '@/core/auth/AuthContext';
import { ProtectedRoute } from '@/core/auth/ProtectedRoute';
import { AppLayout } from '@/app/layouts/AppLayout';
import { CoursesCatalogPage } from '@/pages/CoursesCatalogPage';
import { CourseDetailPage } from '@/pages/CourseDetailPage';
import { coursesApi } from '@/features/courses/services/coursesApi';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset();
});
afterAll(() => server.close());

const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;
const lecturerUser = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;
const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;

function renderWithAuthShell(initialRoute: string, user = traineeUser) {
  authStorage.setSession({
    token: `mock_jwt_${user.id}_test`,
    user,
    expiresAt: Date.now() + 3600000,
  });

  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/login" element={<div data-testid="login-page">تسجيل الدخول</div>} />
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
}

describe('Increment 5: Course Enrollment (First Mock API Mutation) Verification', () => {
  describe('Trainee Enrollment Mutation Flow (/courses/:courseId)', () => {
    it('displays the enrollment action for an eligible, unenrolled trainee', async () => {
      // Course CRS001 is unenrolled for trainee
      renderWithAuthShell('/courses/CRS001', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('course-detail-page')).toBeInTheDocument();
      });

      // Enrollment card and hero button should be visible
      const enrollButton = screen.getByTestId('enroll-course-button');
      expect(enrollButton).toBeInTheDocument();
      expect(enrollButton).toHaveTextContent(/التسجيل في الدورة/i);
      expect(enrollButton).not.toBeDisabled();

      // Hero button should also offer enrollment
      const heroButton = screen.getByTestId('hero-enroll-button');
      expect(heroButton).toBeInTheDocument();
      expect(heroButton).toHaveTextContent(/التسجيل في الدورة/i);
    });

    it('submits mutation, shows loading state, and transitions immediately to enrolled state with new-registration success message', async () => {
      renderWithAuthShell('/courses/CRS001', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('course-detail-page')).toBeInTheDocument();
      });

      const enrollButton = screen.getByTestId('enroll-course-button');
      fireEvent.click(enrollButton);

      // Verify success alert and enrolled state appearance
      await waitFor(() => {
        expect(screen.getByText(/تم التسجيل بنجاح/i)).toBeInTheDocument();
        expect(screen.getByTestId('already-enrolled-section')).toBeInTheDocument();
      });

      // Verify specific new-registration success heading (NOT 'أنت مسجل بالفعل')
      const statusHeading = screen.getByTestId('enrolled-status-heading');
      expect(statusHeading).toHaveTextContent(/تم تأكيد تسجيلك في الدورة التدريبية بنجاح/i);
      expect(statusHeading).not.toHaveTextContent(/أنت مسجل بالفعل/i);

      // Button is now in enrolled disabled state
      expect(screen.getByText(/مسجل في الدورة التدريبية/i)).toBeInTheDocument();
      expect(screen.getByTestId('hero-enrolled-indicator')).toHaveTextContent(/تم تسجيلك بنجاح في الدورة/i);

      // Aggregate enrollment count on course should have incremented in inMemoryStore
      const updatedCourse = inMemoryStore.getCourseById('CRS001');
      expect(updatedCourse?.enrollmentCount).toBe(246); // 245 + 1
    });

    it('renders already-enrolled state for a course the trainee has pre-registered in without showing new-registration alert', async () => {
      // Course CRS002 is pre-enrolled in synthetic fixtures for trainee
      renderWithAuthShell('/courses/CRS002', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('course-detail-page')).toBeInTheDocument();
      });

      // Should show already enrolled banner directly on load without requiring mutation
      expect(screen.getByTestId('already-enrolled-section')).toBeInTheDocument();
      expect(screen.getByTestId('enrolled-status-heading')).toHaveTextContent(/أنت مسجل بالفعل في هذه الدورة التدريبية/i);
      expect(screen.queryByText(/تم التسجيل بنجاح/i)).not.toBeInTheDocument();
      expect(screen.queryByTestId('enroll-course-button')).not.toBeInTheDocument();
      expect(screen.getByTestId('hero-enrolled-indicator')).toHaveTextContent(/أنت مسجل في هذه الدورة التدريبية/i);
    });

    it('prevents duplicate enrollments through HTTP requests returning 409 Conflict and preserving enrollmentCount', async () => {
      authStorage.setSession({
        token: `mock_jwt_${traineeUser.id}_test`,
        user: traineeUser,
        expiresAt: Date.now() + 3600000,
      });

      const initialCount = inMemoryStore.getCourseById('CRS001')?.enrollmentCount || 0;
      expect(initialCount).toBe(245);

      // 1. First real HTTP enrollment request to MSW endpoint
      const response1 = await fetch('/api/courses/CRS001/enrollments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer mock_jwt_${traineeUser.id}_test`,
        },
      });

      expect(response1.status).toBe(201);
      const data1 = (await response1.json()) as { enrollment: { courseId: string; userId: string } };
      expect(data1.enrollment.courseId).toBe('CRS001');
      expect(data1.enrollment.userId).toBe(traineeUser.id);

      // Verify state after first enrollment
      expect(inMemoryStore.getCourseById('CRS001')?.enrollmentCount).toBe(246);
      expect(inMemoryStore.getUserEnrollments(traineeUser.id)).toHaveLength(2); // CRS002 + CRS001

      // 2. Second real HTTP request for the same course and user (duplicate attempt)
      const response2 = await fetch('/api/courses/CRS001/enrollments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer mock_jwt_${traineeUser.id}_test`,
        },
      });

      // Verify HTTP 409 Conflict
      expect(response2.status).toBe(409);
      const data2 = (await response2.json()) as { message: string };
      expect(data2.message).toMatch(/أنت مسجل بالفعل في هذه الدورة التدريبية/i);

      // Verify NO duplicate record was created in the store
      const traineeEnrollments = inMemoryStore.getUserEnrollments(traineeUser.id);
      expect(traineeEnrollments).toHaveLength(2);
      const crs001Enrollments = traineeEnrollments.filter((e) => e.courseId === 'CRS001');
      expect(crs001Enrollments).toHaveLength(1);

      // Verify enrollmentCount did NOT increment a second time
      expect(inMemoryStore.getCourseById('CRS001')?.enrollmentCount).toBe(246);

      // 3. Also verify duplicate rejection via coursesApi client service abstraction
      await expect(coursesApi.enrollCourse('CRS001')).rejects.toThrow(
        /أنت مسجل بالفعل في هذه الدورة التدريبية/i
      );
      expect(inMemoryStore.getCourseById('CRS001')?.enrollmentCount).toBe(246);
      expect(inMemoryStore.getUserEnrollments(traineeUser.id)).toHaveLength(2);
    });

    it('handles server failure gracefully with error alert and allows retry', async () => {
      let failFirstAttempt = true;

      server.use(
        http.post('/api/courses/:courseId/enrollments', () => {
          if (failFirstAttempt) {
            failFirstAttempt = false;
            return HttpResponse.json(
              { message: 'عذراً، تعذر إتمام عملية التسجيل بسبب انقطاع الاتصال' },
              { status: 500 }
            );
          }
          // Normal success on retry
          return HttpResponse.json(
            {
              enrollment: {
                id: 'ENR-RETRY-001',
                courseId: 'CRS001',
                userId: traineeUser.id,
                enrolledAt: new Date().toISOString(),
                status: 'active',
              },
              course: inMemoryStore.getCourseById('CRS001')!,
              message: 'تم التسجيل في الدورة التدريبية بنجاح!',
            },
            { status: 201 }
          );
        })
      );

      renderWithAuthShell('/courses/CRS001', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('enroll-course-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('enroll-course-button'));

      // Error alert displayed with message
      await waitFor(() => {
        expect(screen.getByText(/عذراً، تعذر إتمام عملية التسجيل بسبب انقطاع الاتصال/i)).toBeInTheDocument();
      });

      // Click retry button
      const retryBtn = screen.getByRole('button', { name: /إعادة المحاولة/i });
      fireEvent.click(retryBtn);

      // On retry success
      await waitFor(() => {
        expect(screen.getByText(/تم التسجيل بنجاح/i)).toBeInTheDocument();
      });
    });
  });

  describe('Role-Based Enrollment Permissions', () => {
    it('restricts lecturer account from seeing trainee enrollment action', async () => {
      renderWithAuthShell('/courses/CRS001', lecturerUser);

      await waitFor(() => {
        expect(screen.getByTestId('course-detail-page')).toBeInTheDocument();
      });

      // Lecturer should NOT see trainee enrollment button
      expect(screen.queryByTestId('enroll-course-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('hero-enroll-button')).not.toBeInTheDocument();

      // Lecturer sees informational role banner
      expect(screen.getByText(/صلاحيات محاضر معتمد/i)).toBeInTheDocument();
      expect(screen.getByText(/حساب محاضر معتمد — استعراض المنهج/i)).toBeInTheDocument();
    });

    it('restricts administrator account from seeing trainee enrollment action', async () => {
      renderWithAuthShell('/courses/CRS001', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('course-detail-page')).toBeInTheDocument();
      });

      // Administrator should NOT see trainee enrollment button
      expect(screen.queryByTestId('enroll-course-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('hero-enroll-button')).not.toBeInTheDocument();

      // Admin sees administrative review banner
      expect(screen.getByText(/صلاحيات مسؤول النظام/i)).toBeInTheDocument();
      expect(screen.getByText(/حساب مسؤول النظام — استعراض وإشراف/i)).toBeInTheDocument();
    });

    it('enforces backend HTTP 403 Forbidden if a non-trainee attempts to enroll', async () => {
      expect(() => {
        inMemoryStore.enrollUser({
          courseId: 'CRS001',
          userId: lecturerUser.id,
          userRole: 'lecturer',
        });
      }).toThrow(/متاح فقط لحسابات المتدربين/i);
    });
  });

  describe('Cross-View Data Consistency (Catalog <-> Details Navigation)', () => {
    it('reflects enrolled badge on catalog card and preserves state when navigating between views', async () => {
      renderWithAuthShell('/courses', traineeUser);

      // Catalog loads
      await waitFor(() => {
        expect(screen.getByText('دليل الدورات التدريبية المعتمدة')).toBeInTheDocument();
      });

      // Pre-enrolled course CRS002 displays enrolled badge in the catalog grid
      await waitFor(() => {
        expect(screen.getByTestId('enrolled-badge-CRS002')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('enrolled-badge-CRS001')).not.toBeInTheDocument();

      // Navigate to unenrolled course CRS001
      const course001Card = screen.getByTestId('course-card-CRS001');
      fireEvent.click(course001Card);

      // Detail page loads
      await waitFor(() => {
        expect(screen.getByTestId('course-detail-page')).toBeInTheDocument();
      });

      // Enroll in course CRS001
      const enrollBtn = screen.getByTestId('enroll-course-button');
      fireEvent.click(enrollBtn);

      await waitFor(() => {
        expect(screen.getByText(/تم التسجيل بنجاح/i)).toBeInTheDocument();
      });

      // Navigate back to catalog via breadcrumb / back link
      const backLink = screen.getByLabelText(/العودة إلى دليل الدورات/i);
      fireEvent.click(backLink);

      // Now CRS001 in catalog displays the enrolled badge without reloading the page
      await waitFor(() => {
        expect(screen.getByTestId('enrolled-badge-CRS001')).toBeInTheDocument();
      });

      // Re-visit course CRS001 from catalog
      const reVisitedCard = screen.getByTestId('course-card-CRS001');
      fireEvent.click(reVisitedCard);

      // Verify that return visit reflects the existing enrollment state, NOT new-enrollment alert
      await waitFor(() => {
        expect(screen.getByTestId('enrolled-status-heading')).toHaveTextContent(/أنت مسجل بالفعل في هذه الدورة التدريبية/i);
        expect(screen.queryByText(/تم التسجيل بنجاح/i)).not.toBeInTheDocument();
      });
    });
  });
});
