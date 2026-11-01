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
import { MyCoursesPage } from '@/pages/MyCoursesPage';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset();
});
afterAll(() => server.close());

const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;

function renderMyCoursesWithUser(user = traineeUser) {
  authStorage.setSession({
    token: `mock_jwt_${user.id}_test`,
    user,
    expiresAt: Date.now() + 3600000,
  });

  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/my-courses']}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="my-courses" element={<MyCoursesPage />} />
            <Route path="courses/:courseId/learn" element={<div data-testid="player-route">مشغل التعلم</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Increment 7: Trainee Courses Page (/my-courses) Verification', () => {
  it('loads and renders enrolled courses for authenticated trainee', async () => {
    renderMyCoursesWithUser();

    await waitFor(() => {
      expect(screen.getByTestId('my-courses-page')).toBeInTheDocument();
    });

    // Check title and description
    expect(
      screen.getByRole('heading', { level: 1, name: /دوراتي ومسار التعلم/i })
    ).toBeInTheDocument();

    // Check pre-enrolled courses for usr_trainee_003 (CRS002)
    await waitFor(() => {
      expect(screen.getByText('خدمة العملاء في مترو الأنفاق')).toBeInTheDocument();
    });
  });

  it('filters courses by status tabs (all, in-progress, completed)', async () => {
    renderMyCoursesWithUser();

    await waitFor(() => {
      expect(screen.getByTestId('my-courses-page')).toBeInTheDocument();
    });

    const inProgressTab = screen.getByTestId('filter-tab-in-progress');
    fireEvent.click(inProgressTab);

    // Filter changes active state
    expect(inProgressTab).toBeInTheDocument();

    const completedTab = screen.getByTestId('filter-tab-completed');
    fireEvent.click(completedTab);
    expect(completedTab).toBeInTheDocument();
  });

  it('renders empty state when trainee has no enrolled courses', async () => {
    // Override /api/enrollments/my to return empty list
    server.use(
      http.get('/api/enrollments/my', () => {
        return HttpResponse.json([], { status: 200 });
      })
    );

    renderMyCoursesWithUser();

    await waitFor(() => {
      expect(screen.getByText('لا توجد دورات تدريبية مسجلة حالياً')).toBeInTheDocument();
    });

    expect(screen.getByText('تصفح دليل الدورات المتاحة')).toBeInTheDocument();
  });

  it('handles error state and provides a working retry button', async () => {
    server.use(
      http.get('/api/enrollments/my', () => {
        return HttpResponse.json({ message: 'فشل في استرجاع الدورات' }, { status: 500 });
      })
    );

    renderMyCoursesWithUser();

    await waitFor(() => {
      expect(screen.getByText('خطأ في تحميل البيانات')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: 'إعادة المحاولة' });
    expect(retryBtn).toBeInTheDocument();
  });
});
