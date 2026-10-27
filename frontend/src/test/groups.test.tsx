import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AuthProvider } from '@/core/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { ProtectedRoute } from '@/core/auth/ProtectedRoute';
import { AppLayout } from '@/app/layouts/AppLayout';
import { TraineeGroupsPage } from '@/pages/TraineeGroupsPage';
import { GroupDetailPage } from '@/pages/GroupDetailPage';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset();
});
afterAll(() => server.close());

const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;

function renderWithShell(initialRoute: string, user = traineeUser) {
  authStorage.setSession({
    token: `mock_jwt_${user.id}_test`,
    user,
    expiresAt: Date.now() + 3600000,
  });

  return render(
    <AuthProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="my-groups" element={<TraineeGroupsPage />} />
              <Route path="my-groups/:groupId" element={<GroupDetailPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

describe('Increment 7: Trainee Groups & Authorization Verification', () => {
  it('renders trainee assigned groups on /my-groups', async () => {
    renderWithShell('/my-groups');

    await waitFor(() => {
      expect(screen.getByTestId('trainee-groups-page')).toBeInTheDocument();
    });

    expect(screen.getByText('مجموعاتي والبرامج التدريبية')).toBeInTheDocument();
    // Trainee is a member of GRP-101
    expect(
      screen.getByText('برنامج تشغيل وتأمين الخط الثاني والتحكم الميداني — الدفعة 42')
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/عرض تفاصيل المجموعة والمحتوى/i).length
    ).toBeGreaterThan(0);
  });

  it('renders group details page /my-groups/:groupId with multi-course matrix and demo resources', async () => {
    renderWithShell('/my-groups/GRP-101');

    await waitFor(() => {
      expect(screen.getByTestId('group-detail-page')).toBeInTheDocument();
    });

    expect(
      screen.getByText('برنامج تشغيل وتأمين الخط الثاني والتحكم الميداني — الدفعة 42')
    ).toBeInTheDocument();
    expect(screen.getByText(/المقررات التدريبية المخصصة/i)).toBeInTheDocument();
    expect(screen.getByText('المواد المرفقة واللقاءات التفاعلية')).toBeInTheDocument();
    expect(screen.getByText('لقاء تفاعلي Teams')).toBeInTheDocument();
    expect(screen.getAllByText('بيانات استرشادية للعرض التجريبي').length).toBeGreaterThan(0);
  });

  it('strictly blocks unauthorized group access (403 Forbidden) when trainee is not a member', async () => {
    // GRP-102 belongs to other trainees (e.g. usr_trainee_004, not usr_trainee_003)
    renderWithShell('/my-groups/GRP-102');

    await waitFor(() => {
      expect(screen.getByTestId('group-forbidden')).toBeInTheDocument();
    });

    expect(
      screen.getByText('غير مصرح لك بالوصول إلى هذه المجموعة')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/المجموعة التدريبية المطلوبة مخصصة لدفعات أخرى/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'الرجوع إلى مجموعاتي المخصصة' })
    ).toBeInTheDocument();
  });

  it('triggers info toast instead of window.alert when clicking demo Teams session link', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderWithShell('/my-groups/GRP-101');

    await waitFor(() => {
      expect(screen.getByTestId('group-detail-page')).toBeInTheDocument();
    });

    const teamsButton = screen.getByRole('button', { name: /الانضمام للقاء التجريبي/i });
    fireEvent.click(teamsButton);

    expect(alertSpy).not.toHaveBeenCalled();
    expect(
      screen.getByText('هذا رابط تجريبي تمثيلي لجلسة التدريب الميدانية عبر Microsoft Teams.')
    ).toBeInTheDocument();
    expect(screen.getByText('رابط تدريب تجريبي')).toBeInTheDocument();
  });
});
