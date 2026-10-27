import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AuthProvider } from '@/core/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { ProtectedRoute } from '@/core/auth/ProtectedRoute';
import { AppLayout } from '@/app/layouts/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
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

function renderDashboardWithUser(user = traineeUser) {
  authStorage.setSession({
    token: `mock_jwt_${user.id}_test`,
    user,
    expiresAt: Date.now() + 3600000,
  });

  return render(
    <AuthProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<DashboardPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

describe('Increment 7: Role-Adaptive Dashboard Verification', () => {
  it('renders Trainee Dashboard with welcome banner, metrics, continue learning, and all-clear attention', async () => {
    renderDashboardWithUser(traineeUser);

    // Verify loading skeleton first, then content loads
    await waitFor(() => {
      expect(screen.getByTestId('trainee-dashboard')).toBeInTheDocument();
    });

    // Check Trainee welcome banner
    expect(screen.getAllByText(new RegExp(traineeUser.name, 'i')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/فني صيانة قطارات أول/i)).toBeInTheDocument();

    // Check metrics grid (enrolled courses, completed courses, total hours)
    expect(screen.getByText('الكورسات المسجلة')).toBeInTheDocument();
    expect(screen.getByText('الكورسات المكتملة')).toBeInTheDocument();
    expect(screen.getByText('ساعات التدريب')).toBeInTheDocument();
    expect(screen.getByText('المجموعات التدريبية')).toBeInTheDocument();

    // Check Continue Learning section
    expect(screen.getByText('متابعة التعلم')).toBeInTheDocument();

    // Check Attention widget
    expect(screen.getByText('حالة المهل التدريبية')).toBeInTheDocument();
    // Default fixtures flag expired/unstarted courses for supervisor and trainee attention
    expect(
      screen.getAllByText(/انتهى الموعد النهائي المحدد للكورس|لم يبدأ بعد/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it('renders all-clear attention state when trainee has no pending attention alerts', async () => {
    server.use(
      http.get('/api/dashboard', () => {
        const authenticData = inMemoryStore.getDashboardData(traineeUser);
        return HttpResponse.json({
          ...authenticData,
          attention: {
            hasEvaluated: true,
            items: [],
            allClear: true,
            allClearMessage: 'جميع مساراتك التدريبية تسير وفق الجدول الزمني المحدد',
          },
        });
      })
    );

    renderDashboardWithUser(traineeUser);

    await waitFor(() => {
      expect(screen.getByTestId('trainee-dashboard')).toBeInTheDocument();
    });

    expect(
      screen.getByText('جميع مساراتك التدريبية تسير وفق الجدول الزمني المحدد')
    ).toBeInTheDocument();
  });

  it('renders Lecturer Dashboard with assigned courses, ratings, and supervised groups', async () => {
    renderDashboardWithUser(lecturerUser);

    await waitFor(() => {
      expect(screen.getByTestId('lecturer-dashboard')).toBeInTheDocument();
    });

    // Check Lecturer welcome banner
    expect(screen.getAllByText(new RegExp(lecturerUser.name, 'i')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/لوحة المحاضر والمدرب المعتمد/i)).toBeInTheDocument();

    // Check Lecturer metrics
    expect(screen.getByText('الدورات المكلف بها')).toBeInTheDocument();
    expect(screen.getByText('إجمالي المتدربين المسجلين')).toBeInTheDocument();
    expect(screen.getByText('متوسط التقييم العام')).toBeInTheDocument();
    expect(screen.getByText('المجموعات الخاضعة لإشرافك')).toBeInTheDocument();

    // Check assigned courses section
    expect(screen.getByText('المقررات والدورات المكلف بتدريسها')).toBeInTheDocument();
  });

  it('renders Administrator Dashboard with LMS metrics, top courses, and group overview', async () => {
    renderDashboardWithUser(adminUser);

    await waitFor(() => {
      expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
    });

    // Check Admin welcome banner
    expect(screen.getAllByText(new RegExp(adminUser.name, 'i')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/لوحة القيادة والمتابعة المركزية/i)).toBeInTheDocument();

    // Check Admin LMS metrics
    expect(screen.getByText('إجمالي الكورسات بالمنظومة')).toBeInTheDocument();
    expect(screen.getByText('إجمالي التسجيلات التدريبية')).toBeInTheDocument();
    expect(screen.getByText('المجموعات التدريبية الميدانية')).toBeInTheDocument();
    expect(screen.getByText('تنبيهات المهل الحرجة')).toBeInTheDocument();

    // Check Top courses and Active groups carousel
    expect(screen.getByText('المقررات الأكثر تسجيلاً بالمنظومة')).toBeInTheDocument();
    expect(screen.getByText('حالة المجموعات والدفعات الميدانية')).toBeInTheDocument();
    expect(screen.getByTestId('active-groups-carousel')).toBeInTheDocument();
    expect(screen.getByTestId('carousel-prev-btn')).toBeInTheDocument();
    expect(screen.getByTestId('carousel-next-btn')).toBeInTheDocument();

    // Check that top course cards link to /courses/:courseId
    const topCourseLink = screen.getByTestId('top-course-card-link-CRS001');
    expect(topCourseLink).toHaveAttribute('href', '/courses/CRS001');

    // Check that group cards link to /my-groups/:groupId
    const groupCardLink = screen.getByTestId('carousel-card-link-GRP-101');
    expect(groupCardLink).toHaveAttribute('href', '/my-groups/GRP-101');
  });

  it('handles API error state gracefully and allows retry', async () => {
    // Intercept /api/dashboard with an error
    server.use(
      http.get('/api/dashboard', () => {
        return HttpResponse.json({ message: 'فشل في استرجاع بيانات لوحة المتابعة' }, { status: 500 });
      })
    );

    renderDashboardWithUser(traineeUser);

    await waitFor(() => {
      expect(screen.getByText('خطأ في تحميل لوحة المتابعة')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'إعادة المحاولة' })).toBeInTheDocument();
  });

  it('triggers info toast instead of window.alert when clicking upcoming virtual session link', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderDashboardWithUser(traineeUser);

    await waitFor(() => {
      expect(screen.getByTestId('trainee-dashboard')).toBeInTheDocument();
    });

    const joinBtn = screen.getByRole('button', { name: 'انضمام' });
    fireEvent.click(joinBtn);

    expect(alertSpy).not.toHaveBeenCalled();
    expect(
      screen.getByText('هذا رابط تجريبي تمثيلي لجلسة التدريب الميدانية عبر Microsoft Teams.')
    ).toBeInTheDocument();
    expect(screen.getByText('جلسة تدريب افتراضية')).toBeInTheDocument();
  });
});
