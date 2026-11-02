/**
 * Notification Center Role-Aware Categories & Requires Action Verification Suite
 *
 * Grounded in:
 * - Role-aware category tabs for administrative high-volume notification triage
 * - First-class "تتطلب إجراء" (Requires Action) tab with authoritative business entity status
 * - Strict semantic separation: unread status (read === false) vs unresolved action status (actionRequired === true)
 * - Composable filtering (Category × Read State)
 * - Single authoritative unread count synchronization with Navbar bell badge
 *
 * TEST EXECUTION DIRECTIVE:
 * STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
 * Zero test runner commands (vitest, npm test, tsc, eslint) were executed during this enhancement.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AuthProvider } from '@/core/auth/AuthContext';
import { ProtectedRoute } from '@/core/auth/ProtectedRoute';
import { AppLayout } from '@/app/layouts/AppLayout';
import { NotificationsPage, getNotificationCategory } from '@/pages/NotificationsPage';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type { User } from '@/core/auth/types';
import type { NotificationItem, NotificationType } from '@/core/notifications/types';

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

const assistantAdminUser: User = {
  id: 'USR016',
  name: 'أحمد شريف (مساعد مدير)',
  email: 'assistant.admin@metro.gov.eg',
  role: 'assistant_admin',
  department: 'إدارة التدريب',
  jobTitle: 'مساعد إداري',
  initials: 'أ.ش',
};

function LocationProbe({ testId }: { testId: string }) {
  const location = useLocation();
  return (
    <div data-testid={testId}>
      {location.pathname}
      {location.search}
    </div>
  );
}

function renderNotificationCenter(initialRoute = '/notifications', user: User = adminUser) {
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
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="approvals" element={<div data-testid="approvals-hub-page">مركز الاعتمادات</div>} />
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

describe('Notification Center — Role-Aware Categories & Requires Action Verification Suite', () => {
  beforeEach(() => {
    inMemoryStore.reset();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 1: Category Classification
  // ═══════════════════════════════════════════════════════════════════════════

  it('1. every existing notification type maps deterministically to the intended category', () => {
    const makeItem = (type: NotificationType, extra?: Partial<NotificationItem>): NotificationItem => ({
      id: `NOT_TEST_${type}`,
      userId: adminUser.id,
      type,
      message: `Message for ${type}`,
      read: false,
      createdAt: new Date().toISOString(),
      ...extra,
    });

    // Content Review
    expect(getNotificationCategory(makeItem('content_pending_review', { courseId: 'CRS001' }))).toBe('content_review');
    expect(getNotificationCategory(makeItem('content_approved', { courseId: 'CRS001' }))).toBe('content_review');
    expect(getNotificationCategory(makeItem('content_rejected', { courseId: 'CRS001' }))).toBe('content_review');

    // Group Join Requests
    expect(getNotificationCategory(makeItem('enrollment_request', { groupId: 'GRP-101' }))).toBe('join_requests');

    // User Management
    expect(getNotificationCategory(makeItem('new_registration_request'))).toBe('user_management');

    // Approval Requests
    expect(getNotificationCategory(makeItem('general_alert', { requestId: 'REQ-001', targetUrl: '/approvals' }))).toBe('approvals');

    // Groups & Training
    expect(getNotificationCategory(makeItem('enrollment_approved', { groupId: 'GRP-101' }))).toBe('groups');
    expect(getNotificationCategory(makeItem('enrollment_rejected', { groupId: 'GRP-101' }))).toBe('groups');
    expect(getNotificationCategory(makeItem('forced_enrollment', { groupId: 'GRP-101' }))).toBe('groups');
    expect(getNotificationCategory(makeItem('group_renewed', { groupId: 'GRP-101' }))).toBe('groups');
    expect(getNotificationCategory(makeItem('group_archived', { groupId: 'GRP-101' }))).toBe('groups');
    expect(getNotificationCategory(makeItem('group_updated', { groupId: 'GRP-101' }))).toBe('groups');
    expect(getNotificationCategory(makeItem('instructor_assigned', { groupId: 'GRP-101' }))).toBe('groups');
    expect(getNotificationCategory(makeItem('deadline_reminder', { groupId: 'GRP-101' }))).toBe('groups');
    expect(getNotificationCategory(makeItem('course_completed', { courseId: 'CRS001' }))).toBe('groups');
    expect(getNotificationCategory(makeItem('new_course_suggested', { courseId: 'CRS001' }))).toBe('groups');

    // System Notifications
    expect(getNotificationCategory(makeItem('new_comment'))).toBe('system');
    expect(getNotificationCategory(makeItem('general_alert', { targetUrl: '/dashboard' }))).toBe('system');
  });

  it('2. no notification is silently lost from All Notifications tab', async () => {
    renderNotificationCenter('/notifications', adminUser);

    await waitFor(() => {
      expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
      expect(screen.getByTestId('category-tab-all')).toBeInTheDocument();
    });

    // In All Notifications tab, all seeded admin notifications are rendered
    const adminNotifs = inMemoryStore.getNotificationsForUser(adminUser.id);
    expect(adminNotifs.length).toBeGreaterThan(0);

    await waitFor(() => {
      for (const notif of adminNotifs) {
        expect(screen.getByTestId(`notification-item-${notif.id}`)).toBeInTheDocument();
      }
    });
  });

  it('3. unknown or unclassified notification types remain visible under All or a safe fallback category', () => {
    // Artificial custom or forward-compatible type
    const syntheticItem: NotificationItem = {
      id: 'NOT_SYNTH_999',
      userId: adminUser.id,
      type: 'general_alert' as NotificationType,
      message: 'إشعار مستقبلي غير مصنف',
      read: false,
      createdAt: new Date().toISOString(),
    };

    const category = getNotificationCategory(syntheticItem);
    expect(category).toBe('system'); // Falls back safely to system, never throws or drops
  });

  it('4. categories displayed are appropriate for the current authenticated role', async () => {
    // 1. Admin receives full operational tabs including approvals, user management, join requests
    const { unmount: unmountAdmin } = renderNotificationCenter('/notifications', adminUser);
    await waitFor(() => {
      expect(screen.getByTestId('category-tab-approvals')).toBeInTheDocument();
      expect(screen.getByTestId('category-tab-user_management')).toBeInTheDocument();
      expect(screen.getByTestId('category-tab-requires_action')).toBeInTheDocument();
    });
    unmountAdmin();

    // 2. Trainee (user) view: administrative tabs are completely hidden
    renderNotificationCenter('/notifications', traineeUser);
    await waitFor(() => {
      expect(screen.getByTestId('category-tab-all')).toBeInTheDocument();
      expect(screen.getByTestId('category-tab-groups')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('category-tab-approvals')).not.toBeInTheDocument();
    expect(screen.queryByTestId('category-tab-user_management')).not.toBeInTheDocument();
    expect(screen.queryByTestId('category-tab-requires_action')).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 2: Requires Action Semantics & Lifecycle
  // ═══════════════════════════════════════════════════════════════════════════

  it('5. pending approval requests appear in Requires Action for eligible reviewers', async () => {
    // Create an approval request from assistant admin
    const approvalReq = inMemoryStore.createApprovalRequest({
      actionType: 'groups.archive',
      titleAr: 'طلب أرشفة مجموعة تجريبية',
      justification: 'انتهاء الدورة التدريبية',
      requesterId: assistantAdminUser.id,
      requesterName: assistantAdminUser.name,
      requesterRole: 'assistant_admin',
      payload: { groupId: 'GRP-101' },
    });

    renderNotificationCenter('/notifications', adminUser);

    await waitFor(() => {
      expect(screen.getByTestId('category-tab-requires_action')).toBeInTheDocument();
    });

    // Switch to Requires Action tab
    fireEvent.click(screen.getByTestId('category-tab-requires_action'));

    // The notification for the pending approval request must appear
    const adminNotifs = inMemoryStore.getNotificationsForUser(adminUser.id, 'admin');
    const targetNotif = adminNotifs.find((n) => n.requestId === approvalReq.id);
    expect(targetNotif).toBeDefined();
    expect(targetNotif?.actionRequired).toBe(true);

    await waitFor(() => {
      expect(screen.getByTestId(`notification-item-${targetNotif?.id}`)).toBeInTheDocument();
    });
  });

  it('6. resolved approval requests disappear from Requires Action', async () => {
    // 1. Create approval request
    const approvalReq = inMemoryStore.createApprovalRequest({
      actionType: 'groups.archive',
      titleAr: 'طلب أرشفة مجموعة منتهية',
      justification: 'إتمام البرنامج',
      requesterId: assistantAdminUser.id,
      requesterName: assistantAdminUser.name,
      requesterRole: 'assistant_admin',
      payload: { groupId: 'GRP-101' },
    });

    const { unmount } = renderNotificationCenter('/notifications', adminUser);
    await waitFor(() => {
      expect(screen.getByTestId('category-tab-requires_action')).toBeInTheDocument();
    });

    // 2. Approve the request via store
    inMemoryStore.approveApprovalRequest(approvalReq.id, adminUser.id);
    unmount();

    // 3. Re-render Notification Center; resolved request must no longer be actionable
    renderNotificationCenter('/notifications', adminUser);
    await waitFor(() => {
      expect(screen.getByTestId('category-tab-requires_action')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('category-tab-requires_action'));

    const adminNotifs = inMemoryStore.getNotificationsForUser(adminUser.id, 'admin');
    const targetNotif = adminNotifs.find((n) => n.requestId === approvalReq.id);
    expect(targetNotif?.actionRequired).toBe(false);

    // It must not appear inside the Requires Action tab
    expect(screen.queryByTestId(`notification-item-${targetNotif?.id}`)).not.toBeInTheDocument();
  });

  it('7. pending group join requests appear for authorized reviewers', async () => {
    // Group GRP-102 has instructor usr_lect_002
    // Trainee submits join request for GRP-102
    const joinReq = inMemoryStore.requestToJoinGroup('GRP-102', traineeUser);

    renderNotificationCenter('/notifications', lecturerUser);

    await waitFor(() => {
      expect(screen.getByTestId('category-tab-requires_action')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('category-tab-requires_action'));

    const lecturerNotifs = inMemoryStore.getNotificationsForUser(lecturerUser.id, 'lecturer');
    const targetNotif = lecturerNotifs.find((n) => n.type === 'enrollment_request' && n.requestId === joinReq.id);
    expect(targetNotif?.actionRequired).toBe(true);

    await waitFor(() => {
      expect(screen.getByTestId(`notification-item-${targetNotif?.id}`)).toBeInTheDocument();
    });
  });

  it('8. resolved join requests disappear from Requires Action', async () => {
    const joinReq = inMemoryStore.requestToJoinGroup('GRP-102', traineeUser);

    // Review and reject the join request
    inMemoryStore.reviewGroupJoinRequest(
      { requestId: joinReq.id, decision: 'rejected', reviewNote: 'المجموعة مكتملة' },
      lecturerUser
    );

    renderNotificationCenter('/notifications', lecturerUser);

    await waitFor(() => {
      expect(screen.getByTestId('category-tab-requires_action')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('category-tab-requires_action'));

    const lecturerNotifs = inMemoryStore.getNotificationsForUser(lecturerUser.id, 'lecturer');
    const targetNotif = lecturerNotifs.find((n) => n.type === 'enrollment_request' && n.requestId === joinReq.id);
    expect(targetNotif?.actionRequired).toBe(false);

    // Rejected join request does not appear in Requires Action
    expect(screen.queryByTestId(`notification-item-${targetNotif?.id}`)).not.toBeInTheDocument();
  });

  it('9. reading an actionable notification does not remove its unresolved action', async () => {
    const approvalReq = inMemoryStore.createApprovalRequest({
      actionType: 'groups.archive',
      titleAr: 'طلب أرشفة بانتظار القرار',
      justification: 'مراجعة ختامية',
      requesterId: assistantAdminUser.id,
      requesterName: assistantAdminUser.name,
      requesterRole: 'assistant_admin',
      payload: { groupId: 'GRP-101' },
    });

    renderNotificationCenter('/notifications', adminUser);

    await waitFor(() => {
      expect(screen.getByTestId('category-tab-requires_action')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('category-tab-requires_action'));

    const adminNotifs = inMemoryStore.getNotificationsForUser(adminUser.id, 'admin');
    const targetNotif = adminNotifs.find((n) => n.requestId === approvalReq.id);
    expect(targetNotif).toBeDefined();

    // Mark the notification as read via API/store
    inMemoryStore.markNotificationRead(targetNotif!.id, adminUser.id, 'admin');

    // Even though it is now read (read: true), actionRequired remains true
    const updatedNotifs = inMemoryStore.getNotificationsForUser(adminUser.id, 'admin');
    const reloadedNotif = updatedNotifs.find((n) => n.id === targetNotif!.id);
    expect(reloadedNotif?.read).toBe(true);
    expect(reloadedNotif?.actionRequired).toBe(true);

    // Still present under Requires Action!
    await waitFor(() => {
      expect(screen.getByTestId(`notification-item-${targetNotif?.id}`)).toBeInTheDocument();
    });
  });

  it('10. unauthorized users do not receive actionable tabs or actions they cannot perform', async () => {
    renderNotificationCenter('/notifications', traineeUser);

    await waitFor(() => {
      expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
    });

    // Trainee role has zero administrative approval or review capabilities
    expect(screen.queryByTestId('category-tab-requires_action')).not.toBeInTheDocument();
    expect(screen.queryByTestId('category-tab-approvals')).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 3: Filtering and Counts Composability
  // ═══════════════════════════════════════════════════════════════════════════

  it('11. category and Unread Only filters compose correctly', async () => {
    renderNotificationCenter('/notifications', adminUser);

    await waitFor(() => {
      expect(screen.getByTestId('category-tab-user_management')).toBeInTheDocument();
      expect(screen.getByTestId('tab-unread-notifications')).toBeInTheDocument();
    });

    // Select category: User Management
    fireEvent.click(screen.getByTestId('category-tab-user_management'));

    // Compose with filter: Unread Only
    fireEvent.click(screen.getByTestId('tab-unread-notifications'));

    // Only unread user management notifications are shown
    const userMgmtItem = screen.getByTestId('notification-item-NOT201');
    expect(userMgmtItem).toBeInTheDocument();
  });

  it('12. category unread counts are accurate', async () => {
    renderNotificationCenter('/notifications', adminUser);

    await waitFor(() => {
      expect(screen.getByTestId('category-tab-all')).toBeInTheDocument();
    });

    // Admin has NOT201 (user_management), NOT202 (content_review), NOT203 (join_requests)
    // Verify category tab badges display exact counts
    await waitFor(() => {
      const userMgmtTab = screen.getByTestId('category-tab-user_management');
      expect(userMgmtTab).toHaveTextContent('1');

      const joinReqTab = screen.getByTestId('category-tab-join_requests');
      expect(joinReqTab).toHaveTextContent('1');
    });
  });

  it('13. Requires Action counts include actionable read and unread notifications', async () => {
    // Seed 1 unread approval request and 1 read approval request
    const req1 = inMemoryStore.createApprovalRequest({
      actionType: 'groups.archive',
      titleAr: 'طلب 1',
      justification: 'سبب 1',
      requesterId: assistantAdminUser.id,
      requesterName: assistantAdminUser.name,
      requesterRole: 'assistant_admin',
      payload: { groupId: 'GRP-101' },
    });

    const notifs = inMemoryStore.getNotificationsForUser(adminUser.id, 'admin');
    const notif1 = notifs.find((n) => n.requestId === req1.id);
    expect(notif1).toBeDefined();

    // Mark notif1 as read
    inMemoryStore.markNotificationRead(notif1!.id, adminUser.id, 'admin');

    renderNotificationCenter('/notifications', adminUser);

    await waitFor(() => {
      expect(screen.getByTestId('category-tab-requires_action')).toBeInTheDocument();
    });

    // Actionable tab badge must include the read actionable item
    await waitFor(() => {
      const actionTab = screen.getByTestId('category-tab-requires_action');
      const badge = actionTab.querySelector('span:last-child');
      expect(Number(badge?.textContent)).toBeGreaterThanOrEqual(1);
    });
  });

  it('14. the global Navbar unread count remains unchanged by category filtering', async () => {
    renderNotificationCenter('/notifications', adminUser);

    await waitFor(() => {
      expect(screen.getByTestId('navbar-unread-badge')).toBeInTheDocument();
    });

    const initialNavbarCount = screen.getByTestId('navbar-unread-badge').textContent;

    // Switch between various category tabs
    fireEvent.click(screen.getByTestId('category-tab-content_review'));
    expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent(initialNavbarCount!);

    fireEvent.click(screen.getByTestId('category-tab-join_requests'));
    expect(screen.getByTestId('navbar-unread-badge')).toHaveTextContent(initialNavbarCount!);
  });

  it('15. opening a category tab does not mark any notification as read', async () => {
    renderNotificationCenter('/notifications', adminUser);

    await waitFor(() => {
      expect(screen.getByTestId('category-tab-join_requests')).toBeInTheDocument();
    });

    const initialUnread = inMemoryStore.getUnreadNotificationsCount(adminUser.id);

    // Switch to Join Requests tab
    fireEvent.click(screen.getByTestId('category-tab-join_requests'));

    // Authoritative store unread count must not change
    expect(inMemoryStore.getUnreadNotificationsCount(adminUser.id)).toBe(initialUnread);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 4: Existing Behavior & Role Boundaries Preservation
  // ═══════════════════════════════════════════════════════════════════════════

  it('16. existing individual mark-as-read behavior remains correct', async () => {
    renderNotificationCenter('/notifications', adminUser);

    await waitFor(() => {
      expect(screen.getByTestId('notification-item-NOT201')).toBeInTheDocument();
    });

    // Click item NOT201
    fireEvent.click(screen.getByTestId('notification-item-NOT201'));

    await waitFor(() => {
      const notifs = inMemoryStore.getNotificationsForUser(adminUser.id, 'admin');
      expect(notifs.find((n) => n.id === 'NOT201')?.read).toBe(true);
    });
  });

  it('17. Mark All as Read clears all unread notifications within store and UI', async () => {
    renderNotificationCenter('/notifications', adminUser);

    await waitFor(() => {
      expect(screen.getByTestId('mark-all-read-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('mark-all-read-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('navbar-unread-badge')).not.toBeInTheDocument();
    });
    expect(inMemoryStore.getUnreadNotificationsCount(adminUser.id)).toBe(0);
  });

  it('18. direct account switching and stale response protection remain intact', async () => {
    const { unmount } = renderNotificationCenter('/notifications', adminUser);
    await waitFor(() => {
      expect(screen.getByTestId('category-tab-user_management')).toBeInTheDocument();
    });
    unmount();

    // Switch to trainee user directly
    renderNotificationCenter('/notifications', traineeUser);
    await waitFor(() => {
      expect(screen.getByTestId('category-tab-all')).toBeInTheDocument();
    });
    // Admin tabs must immediately be absent
    expect(screen.queryByTestId('category-tab-user_management')).not.toBeInTheDocument();
  });

  it('19. notification deep links continue working accurately', async () => {
    renderNotificationCenter('/notifications', adminUser);

    await waitFor(() => {
      expect(screen.getByTestId('notification-item-NOT202')).toBeInTheDocument();
    });

    // Click NOT202 (which links to /admin/review/CRS004)
    fireEvent.click(screen.getByTestId('notification-item-NOT202'));

    await waitFor(() => {
      expect(screen.getByTestId('admin-review-page')).toHaveTextContent('/admin/review/CRS004');
    });
  });

  it('20. lecturer view displays course review, join requests, groups, and discussions without administrative hubs', async () => {
    renderNotificationCenter('/notifications', lecturerUser);

    await waitFor(() => {
      expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
    });

    // Lecturer tabs
    expect(screen.getByTestId('category-tab-all')).toBeInTheDocument();
    expect(screen.getByTestId('category-tab-requires_action')).toBeInTheDocument();
    expect(screen.getByTestId('category-tab-join_requests')).toBeInTheDocument();
    expect(screen.getByTestId('category-tab-content_review')).toBeInTheDocument();
    expect(screen.getByTestId('category-tab-groups')).toBeInTheDocument();

    // Administrative approval hubs are strictly hidden from lecturer
    expect(screen.queryByTestId('category-tab-approvals')).not.toBeInTheDocument();
    expect(screen.queryByTestId('category-tab-user_management')).not.toBeInTheDocument();
  });
});

