import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AuthProvider } from '@/core/auth/AuthContext';
import { ProtectedRoute } from '@/core/auth/ProtectedRoute';
import { AppLayout } from '@/app/layouts/AppLayout';
import { ProfilePage } from '@/pages/ProfilePage';
import { NotificationsPage } from '@/pages/NotificationsPage';
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
            <Route path="profile" element={<ProfilePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="courses/:courseId" element={<div data-testid="course-page">تفاصيل المقرر</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Increment 7: Profile & Notification Center Verification', () => {
  it('renders read-only user profile with personal details, role, and learning statistics', async () => {
    renderWithShell('/profile');

    await waitFor(() => {
      expect(screen.getByTestId('profile-page')).toBeInTheDocument();
    });

    // Check Name, Email, Job Title, Department
    expect(screen.getAllByText(new RegExp(traineeUser.name, 'i')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(traineeUser.email)).toBeInTheDocument();
    expect(screen.getAllByText(/فني صيانة قطارات/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/قطاع صيانة الوحدات المتحركة/i)).toBeInTheDocument();

    // Check Learning stats
    expect(screen.getByText('إحصائيات التدريب والنشاط التعليمي')).toBeInTheDocument();
    expect(screen.getByText('ساعات التدريب الإجمالية')).toBeInTheDocument();

    // Check security / read-only privacy note
    expect(screen.getByText(/هذا الملف التعريفي للقراءة فقط/i)).toBeInTheDocument();

    // Check Navbar user chip has link to /profile
    const userChip = screen.getByTestId('navbar-user-chip');
    expect(userChip).toHaveAttribute('href', '/profile');
  });

  it('renders notifications center, displays unread badge, and supports filtering', async () => {
    renderWithShell('/notifications');

    await waitFor(() => {
      expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
    });

    // Unread count badge should appear in the navbar
    const unreadBadge = screen.getByTestId('navbar-unread-badge');
    expect(unreadBadge).toBeInTheDocument();

    // Filter tabs
    const allTab = screen.getByTestId('tab-all-notifications');
    const unreadTab = screen.getByTestId('tab-unread-notifications');
    expect(allTab).toBeInTheDocument();
    expect(unreadTab).toBeInTheDocument();

    // Switch to unread filter
    fireEvent.click(unreadTab);
    expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
  });

  it('marks all notifications as read and updates navbar badge immediately', async () => {
    renderWithShell('/notifications');

    await waitFor(() => {
      expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
    });

    const markAllBtn = screen.getByTestId('mark-all-read-btn');
    expect(markAllBtn).toBeInTheDocument();

    fireEvent.click(markAllBtn);

    // After clicking mark all read, the navbar unread badge disappears
    await waitFor(() => {
      expect(screen.queryByTestId('navbar-unread-badge')).not.toBeInTheDocument();
    });
  });

  it('navigates to relevant course when clicking a notification with courseId', async () => {
    renderWithShell('/notifications');

    await waitFor(() => {
      expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
    });

    // Click on NOT002 which has courseId: CRS004
    const notifItem = screen.getByTestId('notification-item-NOT002');
    fireEvent.click(notifItem);

    await waitFor(() => {
      expect(screen.getByTestId('course-page')).toBeInTheDocument();
    }, { timeout: 4000 });
  });
});
