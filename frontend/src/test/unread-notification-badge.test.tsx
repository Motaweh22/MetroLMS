/**
 * Unread Notification Count Badge Verification Suite
 *
 * Grounded in:
 * - Top Navbar unread notification count badge UI UX enhancement
 * - Live UI synchronization via NotificationContext and 'metro:notifications-changed' events
 * - User and role notification isolation
 * - Non-destructive navigation and deep link preservation
 *
 * TEST EXECUTION DIRECTIVE:
 * STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
 * Zero test runner commands (vitest, npm test, tsc, eslint) were executed during this enhancement.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AuthProvider } from '@/core/auth/AuthContext';
import { ProtectedRoute } from '@/core/auth/ProtectedRoute';
import { AppLayout } from '@/app/layouts/AppLayout';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type { User } from '@/core/auth/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset();
});
afterAll(() => server.close());

const traineeUser: User = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;
const lecturerUser: User = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;
const adminUser: User = SYNTHETIC_DEMO_ACCOUNTS.admin.user;

function LocationProbe({ testId }: { testId: string }) {
  const location = useLocation();
  return (
    <div data-testid={testId}>
      {location.pathname}
      {location.search}
    </div>
  );
}

function renderNotificationShell(initialRoute = '/dashboard', user: User = traineeUser) {
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
            <Route path="dashboard" element={<div data-testid="dashboard-page">لوحة المتابعة</div>} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="courses/:courseId" element={<div data-testid="course-page">تفاصيل المقرر</div>} />
            <Route path="my-groups" element={<LocationProbe testId="trainee-groups-list-page" />} />
            <Route path="my-groups/:groupId" element={<LocationProbe testId="trainee-group-detail-page" />} />
            <Route
              path="admin/groups/:groupId/monitoring"
              element={<LocationProbe testId="admin-group-monitoring-page" />}
            />
            <Route path="admin/review/:courseId" element={<LocationProbe testId="admin-review-page" />} />
            <Route
              path="lecturer/builder/:courseId"
              element={<LocationProbe testId="lecturer-builder-page" />}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Unread Notification Count Badge — UI, Data Flow & Accessibility Suite', () => {
  beforeEach(() => {
    inMemoryStore.reset();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 1: Zero unread notifications hides the badge entirely
  // ───────────────────────────────────────────────────────────────────────────
  it('1. zero unread notifications hides the badge entirely', async () => {
    // Mark all notifications as read for traineeUser before rendering
    inMemoryStore.markAllNotificationsRead(traineeUser.id);

    renderNotificationShell('/dashboard', traineeUser);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });

    // Badge element must not exist in DOM when unread count is 0
    expect(screen.queryByTestId('navbar-unread-badge')).not.toBeInTheDocument();

    // Link label must be clean and free of unread count suffix
    const notifLink = screen.getByTestId('navbar-notifications-link');
    expect(notifLink).toHaveAttribute('aria-label', 'عرض التنبيهات');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 2: One unread notification displays 1 in a compact badge
  // ───────────────────────────────────────────────────────────────────────────
  it('2. one unread notification displays 1 in a compact badge', async () => {
    inMemoryStore.markAllNotificationsRead(traineeUser.id);
    inMemoryStore.createNotification({
      userId: traineeUser.id,
      type: 'general_alert',
      title: 'تنبيه تدريبي فردي',
      message: 'إشعار تجريبي لاختبار العداد الفردي',
    });

    renderNotificationShell('/dashboard', traineeUser);

    await waitFor(() => {
      expect(screen.getByTestId('navbar-unread-badge')).toBeInTheDocument();
    });

    const badge = screen.getByTestId('navbar-unread-badge');
    expect(badge).toHaveTextContent('1');
    expect(badge).toHaveAttribute('role', 'status');
    expect(badge).toHaveAttribute('aria-label', '1 تنبيه غير مقروء');

    const link = screen.getByTestId('navbar-notifications-link');
    expect(link).toHaveAttribute('aria-label', 'عرض التنبيهات (1 تنبيه غير مقروء)');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 3: Multiple unread notifications display the exact numeric count
  // ───────────────────────────────────────────────────────────────────────────
  it('3. multiple unread notifications display the exact numeric count', async () => {
    // Initial mock notifications seed 5 unread items for usr_trainee_003
    renderNotificationShell('/dashboard', traineeUser);

    await waitFor(() => {
      expect(screen.getByTestId('navbar-unread-badge')).toBeInTheDocument();
    });

    const badge = screen.getByTestId('navbar-unread-badge');
    expect(badge).toHaveTextContent('5');
    expect(badge).toHaveAttribute('aria-label', '5 تنبيه غير مقروء');

    const link = screen.getByTestId('navbar-notifications-link');
    expect(link).toHaveAttribute('aria-label', 'عرض التنبيهات (5 تنبيه غير مقروء)');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 4: More than 99 unread notifications displays 99+
  // ───────────────────────────────────────────────────────────────────────────
  it('4. more than 99 unread notifications displays 99+', async () => {
    inMemoryStore.markAllNotificationsRead(traineeUser.id);

    // Seed 105 unread notifications for traineeUser
    for (let i = 1; i <= 105; i++) {
      inMemoryStore.createNotification({
        userId: traineeUser.id,
        type: 'general_alert',
        title: `تنبيه جماعي #${i}`,
        message: `محتوى الإشعار رقم ${i}`,
      });
    }

    renderNotificationShell('/dashboard', traineeUser);

    await waitFor(() => {
      expect(screen.getByTestId('navbar-unread-badge')).toBeInTheDocument();
    });

    const badge = screen.getByTestId('navbar-unread-badge');
    expect(badge).toHaveTextContent('99+');
    expect(badge).toHaveAttribute('aria-label', 'أكثر من 99 تنبيه غير مقروء');

    const link = screen.getByTestId('navbar-notifications-link');
    expect(link).toHaveAttribute('aria-label', 'عرض التنبيهات (أكثر من 99 تنبيه غير مقروء)');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 5: Delivering a new notification increments the unread count live
  // ───────────────────────────────────────────────────────────────────────────
  it('5. delivering a new notification increments the unread count live', async () => {
    renderNotificationShell('/dashboard', traineeUser);

    await waitFor(() => {
      expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('5');
    });

    // Authoritative store creation dispatches window event 'metro:notifications-changed'
    inMemoryStore.createNotification({
      userId: traineeUser.id,
      type: 'new_comment',
      title: 'نقاش جديد',
      message: 'تمت إضافة تعليق جديد على اختبارك الميداني',
    });

    // Live UI synchronization should immediately update the badge
    await waitFor(() => {
      expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('6');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 6: Opening an individual notification marks only that notification as read and decrements count
  // ───────────────────────────────────────────────────────────────────────────
  it('6. opening an individual notification marks only that notification as read and decrements count', async () => {
    renderNotificationShell('/notifications', traineeUser);

    await waitFor(() => {
      expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
      expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('5');
    });

    // Click on unread notification NOT006
    const item = screen.getByTestId('notification-item-NOT006');
    fireEvent.click(item);

    // Badge should decrement from 5 to 4
    await waitFor(() => {
      expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('4');
    });

    // Ensure only NOT006 became read, other notifications remain unread
    const notifs = inMemoryStore.getNotificationsForUser(traineeUser.id);
    const not006 = notifs.find((n) => n.id === 'NOT006');
    const not002 = notifs.find((n) => n.id === 'NOT002');
    expect(not006?.read).toBe(true);
    expect(not002?.read).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 7: Navigating to the notification center alone does not mark notifications as read
  // ───────────────────────────────────────────────────────────────────────────
  it('7. navigating to the notification center alone does not mark notifications as read', async () => {
    renderNotificationShell('/notifications', traineeUser);

    await waitFor(() => {
      expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
      expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('5');
    });

    // Authoritative store unread count remains 5
    expect(inMemoryStore.getUnreadNotificationsCount(traineeUser.id)).toBe(5);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 8: Failed mark-as-read API request preserves the unread count and allows retry
  // ───────────────────────────────────────────────────────────────────────────
  it('8. failed mark-as-read API request preserves the unread count and allows retry', async () => {
    // Intercept PATCH endpoint with simulated 500 server error
    server.use(
      http.patch('/api/notifications/:id/read', () => {
        return HttpResponse.json({ message: 'فشل في تحديث حالة الإشعار من الخادم' }, { status: 500 });
      })
    );

    renderNotificationShell('/notifications', traineeUser);

    await waitFor(() => {
      expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
      expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('5');
    });

    const item = screen.getByTestId('notification-item-NOT006');
    fireEvent.click(item);

    // Alert error should be rendered to allow user to retry
    await waitFor(() => {
      expect(screen.getByText(/فشل في تحديث حالة الإشعار من الخادم|تعذر تحديث حالة الإشعار/i)).toBeInTheDocument();
    });

    // Unread badge count must NOT be decremented on failure
    expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('5');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 9: Mark-all-as-read updates the badge correctly and clears unread status
  // ───────────────────────────────────────────────────────────────────────────
  it('9. mark-all-as-read updates the badge correctly and clears unread status', async () => {
    renderNotificationShell('/notifications', traineeUser);

    await waitFor(() => {
      expect(screen.getByTestId('mark-all-read-btn')).toBeInTheDocument();
      expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('5');
    });

    const markAllBtn = screen.getByTestId('mark-all-read-btn');
    fireEvent.click(markAllBtn);

    // Badge disappears entirely after mark-all-as-read
    await waitFor(() => {
      expect(screen.queryByTestId('navbar-unread-badge')).not.toBeInTheDocument();
    });

    expect(inMemoryStore.getUnreadNotificationsCount(traineeUser.id)).toBe(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 10: Notifications belonging to another user are excluded
  // ───────────────────────────────────────────────────────────────────────────
  it('10. notifications belonging to another user are excluded', async () => {
    // Trainee has 5 unread items
    const traineeCount = inMemoryStore.getUnreadNotificationsCount(traineeUser.id);
    expect(traineeCount).toBe(5);

    // Lecturer has 2 unread items
    const lecturerCount = inMemoryStore.getUnreadNotificationsCount(lecturerUser.id);
    expect(lecturerCount).toBe(2);

    // Admin has 3 unread items
    const adminCount = inMemoryStore.getUnreadNotificationsCount(adminUser.id);
    expect(adminCount).toBe(3);

    // Render as lecturerUser and verify only lecturer notifications count is shown
    const { unmount } = renderNotificationShell('/dashboard', lecturerUser);
    await waitFor(() => {
      expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('2');
    });
    unmount();

    // Render as adminUser and verify only admin notifications count is shown
    renderNotificationShell('/dashboard', adminUser);
    await waitFor(() => {
      expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('3');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 11: Logging out or switching users resets the displayed count correctly
  // ───────────────────────────────────────────────────────────────────────────
  it('11. logging out or switching users resets the displayed count correctly', async () => {
    renderNotificationShell('/dashboard', traineeUser);

    await waitFor(() => {
      expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('5');
    });

    // Trigger logout
    const logoutBtn = screen.getByRole('button', { name: /تسجيل الخروج من المنظومة/i });
    fireEvent.click(logoutBtn);

    // Badge should be immediately cleared upon user logout
    await waitFor(() => {
      expect(screen.queryByTestId('navbar-unread-badge')).not.toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 12: Existing notification deep links and navigation remain intact
  // ───────────────────────────────────────────────────────────────────────────
  it('12. existing notification deep links and navigation remain intact', async () => {
    renderNotificationShell('/notifications', traineeUser);

    await waitFor(() => {
      expect(screen.getByTestId('notification-item-NOT006')).toBeInTheDocument();
    });

    // Click NOT006 (which targets /my-groups/GRP-101)
    fireEvent.click(screen.getByTestId('notification-item-NOT006'));

    // Navigation must arrive accurately at the deep link destination
    await waitFor(() => {
      expect(screen.getByTestId('trainee-group-detail-page')).toHaveTextContent('/my-groups/GRP-101');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 2: Direct Account Switching & Asynchronous Request Isolation
  // ═══════════════════════════════════════════════════════════════════════════

  // ───────────────────────────────────────────────────────────────────────────
  // Test 13: Direct A-to-B account switch without logout clears cached data and displays User B count
  // ───────────────────────────────────────────────────────────────────────────
  it('13. direct A-to-B account switch without logout clears cached data and displays User B count', async () => {
    const { unmount } = renderNotificationShell('/dashboard', traineeUser);

    await waitFor(() => {
      expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('5');
    });

    // Unmount and immediately re-render as lecturerUser simulating immediate identity switch
    unmount();
    renderNotificationShell('/dashboard', lecturerUser);

    // Badge must reflect Lecturer count (2) without retaining Trainee count (5)
    await waitFor(() => {
      expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('2');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 14: Delayed response from User A arriving after User B response is safely discarded
  // ───────────────────────────────────────────────────────────────────────────
  it('14. delayed response from User A arriving after User B response is safely discarded', async () => {
    let resolveUserAResponse: (() => void) | null = null;

    // Intercept notifications endpoint to artificially hold User A's response
    server.use(
      http.get('/api/notifications', async ({ request }) => {
        const authHeader = request.headers.get('Authorization') || '';
        if (authHeader.includes('usr_trainee_003')) {
          // Delay User A's response until explicitly released
          await new Promise<void>((resolve) => {
            resolveUserAResponse = resolve;
          });
          return HttpResponse.json({
            notifications: inMemoryStore.getNotificationsForUser(traineeUser.id),
            unreadCount: 99, // Stale inflated count
            totalCount: 99,
          });
        }

        // User B resolves immediately
        return HttpResponse.json({
          notifications: inMemoryStore.getNotificationsForUser(lecturerUser.id),
          unreadCount: 2,
          totalCount: 2,
        });
      })
    );

    // 1. User A starts initial fetch (held in flight)
    const { unmount } = renderNotificationShell('/dashboard', traineeUser);

    // 2. Immediate direct switch to User B before User A's response resolves
    unmount();
    renderNotificationShell('/dashboard', lecturerUser);

    // 3. User B completes and displays count 2
    await waitFor(() => {
      expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('2');
    });

    // 4. Now release User A's stale delayed response
    if (resolveUserAResponse) {
      (resolveUserAResponse as () => void)();
    }

    // Give microtasks time to execute; User B's count must remain 2 and not be overwritten by 99
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('2');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 15: Outdated notification events arriving after user identity changes are ignored
  // ───────────────────────────────────────────────────────────────────────────
  it('15. outdated notification events arriving after user identity changes are ignored', async () => {
    const { unmount } = renderNotificationShell('/dashboard', traineeUser);

    await waitFor(() => {
      expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('5');
    });

    unmount();
    renderNotificationShell('/dashboard', lecturerUser);

    await waitFor(() => {
      expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('2');
    });

    // Dispatch notification event while logged in as Lecturer
    window.dispatchEvent(new CustomEvent('metro:notifications-changed'));

    // Count should still reflect Lecturer's authoritative count (2)
    await waitFor(() => {
      expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('2');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 16: Ensure final displayed count always belongs strictly to current authenticated session
  // ───────────────────────────────────────────────────────────────────────────
  it('16. ensure final displayed count always belongs strictly to current authenticated session', async () => {
    // Admin has 3 unread notifications
    renderNotificationShell('/dashboard', adminUser);

    await waitFor(() => {
      expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('3');
    });

    // Authoritative store count matches badge
    expect(inMemoryStore.getUnreadNotificationsCount(adminUser.id)).toBe(3);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 3: Mark-as-Read & Mark-All-as-Read Server-Side Ownership Authorization
  // ═══════════════════════════════════════════════════════════════════════════

  // ───────────────────────────────────────────────────────────────────────────
  // Test 17: Rejects attempt to mark another user notification as read via PATCH / POST with 404
  // ───────────────────────────────────────────────────────────────────────────
  it('17. rejects attempt to mark another user notification as read via PATCH / POST with 404', async () => {
    // NOT101 belongs to lecturerUser (usr_lect_002)
    const notifs = inMemoryStore.getNotificationsForUser(lecturerUser.id);
    const not101 = notifs.find((n) => n.id === 'NOT101');
    expect(not101).toBeDefined();
    expect(not101?.read).toBe(false);

    // Trainee attempts to mark lecturer's notification as read via PATCH
    const patchRes = await fetch('/api/notifications/NOT101/read', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer mock_jwt_${traineeUser.id}_test`,
      },
    });
    expect(patchRes.status).toBe(404);
    const patchData = await patchRes.json();
    expect(patchData.message).toContain('غير مصرح به');

    // Trainee attempts to mark lecturer's notification as read via POST
    const postRes = await fetch('/api/notifications/NOT101/read', {
      method: 'POST',
      headers: {
        Authorization: `Bearer mock_jwt_${traineeUser.id}_test`,
      },
    });
    expect(postRes.status).toBe(404);

    // Target notification must remain unread
    const lecturerNotifsAfter = inMemoryStore.getNotificationsForUser(lecturerUser.id);
    expect(lecturerNotifsAfter.find((n) => n.id === 'NOT101')?.read).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 18: Unauthorized mark-as-read attempt does not modify target notification or decrement unread counts
  // ───────────────────────────────────────────────────────────────────────────
  it('18. unauthorized mark-as-read attempt does not modify target notification or decrement unread counts', async () => {
    const initialLecturerCount = inMemoryStore.getUnreadNotificationsCount(lecturerUser.id);
    const initialTraineeCount = inMemoryStore.getUnreadNotificationsCount(traineeUser.id);

    // Trainee attempts to mark NOT101 (Lecturer's item)
    await fetch('/api/notifications/NOT101/read', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer mock_jwt_${traineeUser.id}_test`,
      },
    });

    // Both users' unread counts must remain completely unchanged
    expect(inMemoryStore.getUnreadNotificationsCount(lecturerUser.id)).toBe(initialLecturerCount);
    expect(inMemoryStore.getUnreadNotificationsCount(traineeUser.id)).toBe(initialTraineeCount);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 19: Unknown or non-existent notification ID returns HTTP 404
  // ───────────────────────────────────────────────────────────────────────────
  it('19. unknown or non-existent notification ID returns HTTP 404', async () => {
    const res = await fetch('/api/notifications/NOT_NON_EXISTENT_999/read', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer mock_jwt_${traineeUser.id}_test`,
      },
    });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.message).toBeDefined();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 20: Unauthenticated request to mark notification as read returns HTTP 401
  // ───────────────────────────────────────────────────────────────────────────
  it('20. unauthenticated request to mark notification as read returns HTTP 401', async () => {
    const res = await fetch('/api/notifications/NOT006/read', {
      method: 'PATCH',
      // No Authorization header provided
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.message).toContain('يجب تسجيل الدخول');

    // Notification NOT006 remains unread
    const notifs = inMemoryStore.getNotificationsForUser(traineeUser.id);
    expect(notifs.find((n) => n.id === 'NOT006')?.read).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 21: mark-all-read uses authenticated session user ID exclusively, ignoring spoofed body/query
  // ───────────────────────────────────────────────────────────────────────────
  it('21. mark-all-read uses authenticated session user ID exclusively, ignoring spoofed body/query', async () => {
    const initialLecturerCount = inMemoryStore.getUnreadNotificationsCount(lecturerUser.id);
    expect(initialLecturerCount).toBe(2);

    // Trainee calls mark-all-read while trying to pass userId: usr_lect_002 in body and query
    const res = await fetch(`/api/notifications/mark-all-read?userId=${lecturerUser.id}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer mock_jwt_${traineeUser.id}_test`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: lecturerUser.id }),
    });
    expect(res.status).toBe(200);

    // Trainee's notifications are marked read
    expect(inMemoryStore.getUnreadNotificationsCount(traineeUser.id)).toBe(0);

    // Lecturer's unread notifications MUST remain completely intact (not marked read)
    expect(inMemoryStore.getUnreadNotificationsCount(lecturerUser.id)).toBe(initialLecturerCount);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 22: Render-time account isolation prevents User A unread count from appearing in User B initial render frame
  // ───────────────────────────────────────────────────────────────────────────
  it('22. render-time account isolation prevents User A unread count from appearing in User B initial render frame', async () => {
    // 1. Initial render as traineeUser (User A) with 5 unread notifications
    const { unmount } = renderNotificationShell('/dashboard', traineeUser);
    await waitFor(() => {
      expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('5');
    });

    // 2. Intercept GET /api/notifications for User B (lecturerUser) with a deferred promise so it stays pending
    let finishUserBFetch: (() => void) | null = null;
    let notifyUserBFetchStarted: (() => void) | null = null;
    const userBFetchStarted = new Promise<void>((resolve) => {
      notifyUserBFetchStarted = resolve;
    });

    server.use(
      http.get('/api/notifications', async ({ request }) => {
        const auth = request.headers.get('Authorization') || '';
        if (auth.includes(lecturerUser.id)) {
          if (notifyUserBFetchStarted) {
            notifyUserBFetchStarted();
          }
          await new Promise<void>((resolve) => {
            finishUserBFetch = resolve;
          });
          return HttpResponse.json({
            notifications: inMemoryStore.getNotificationsForUser(lecturerUser.id),
            unreadCount: 2,
            totalCount: 2,
          });
        }
        return HttpResponse.json({
          notifications: inMemoryStore.getNotificationsForUser(traineeUser.id),
          unreadCount: 5,
          totalCount: 5,
        });
      })
    );

    // 3. Switch identity directly to User B without logout
    unmount();
    renderNotificationShell('/dashboard', lecturerUser);

    // 4. In User B's initial render frame (before fetch completes), render-time state gating
    // guarantees that User A's unread badge (5) is NOT exposed in the DOM
    expect(screen.queryByTestId('navbar-unread-badge')).not.toBeInTheDocument();

    // 5. Release User B's delayed fetch after request initiates
    await userBFetchStarted;
    if (finishUserBFetch) {
      (finishUserBFetch as () => void)();
    }

    // 6. Once User B's data loads, badge updates to User B's count (2)
    await waitFor(() => {
      expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent('2');
    });
  });
});

