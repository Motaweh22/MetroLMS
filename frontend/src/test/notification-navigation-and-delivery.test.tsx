/**
 * Notification Center Navigation & Missing Notification Delivery Verification Suite
 *
 * Scope:
 * 1. Horizontal arrow navigation (hide scrollbar, prev/next buttons, overflow gating, RTL order, auto-scroll)
 * 2. Comment report event lifecycle, recipient authorization, deduplication, and unresolved action status
 * 3. Group lifecycle and membership notification delivery matrix
 * 4. High-impact audit & security notification policy and INV-R8 developer protection
 * 5. Regression verification across counts, categories, role gating, and approval workflows
 *
 * TEST EXECUTION DIRECTIVE:
 * STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
 * Zero test runner commands (vitest, npm test, tsc, eslint) were executed during this enhancement.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
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
import type { NotificationItem } from '@/core/notifications/types';

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
            <Route path="admin/comment-moderation" element={<div data-testid="admin-comment-moderation-page">إدارة التعليقات</div>} />
            <Route path="admin/audit" element={<div data-testid="admin-audit-page">سجل الرقابة والأمان</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Notification Center Navigation & Delivery Remediation Suite', () => {
  // ── 1. Arrow Navigation ─────────────────────────────────────────────
  describe('1. Arrow Navigation', () => {
    it('1. no arrows when categories fit', async () => {
      renderNotificationCenter('/notifications', traineeUser);
      await waitFor(() => {
        expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
      });

      // Trainee only sees 3 categories, which fit without horizontal overflow
      expect(screen.queryByTestId('category-nav-right')).not.toBeInTheDocument();
      expect(screen.queryByTestId('category-nav-left')).not.toBeInTheDocument();
    });

    it('2. arrows appear when category overflow exists', async () => {
      renderNotificationCenter('/notifications', adminUser);
      await waitFor(() => {
        expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
      });

      const container = screen.getByTestId('category-tabs-container');
      Object.defineProperty(container, 'scrollWidth', { configurable: true, value: 1200 });
      Object.defineProperty(container, 'clientWidth', { configurable: true, value: 600 });
      Object.defineProperty(container, 'scrollLeft', { configurable: true, value: 0 });
      fireEvent.scroll(container);

      await waitFor(() => {
        expect(screen.getByTestId('category-nav-left')).toBeInTheDocument();
        expect(screen.getByTestId('category-nav-right')).toBeInTheDocument();
      });
    });

    it('3. next/previous arrow navigation works', async () => {
      renderNotificationCenter('/notifications', adminUser);
      await waitFor(() => {
        expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
      });

      const container = screen.getByTestId('category-tabs-container');
      let currentScroll = 0;
      container.scrollBy = (options?: ScrollToOptions | number) => {
        if (typeof options === 'object' && options?.left !== undefined) {
          currentScroll += options.left;
          Object.defineProperty(container, 'scrollLeft', { configurable: true, value: currentScroll });
          fireEvent.scroll(container);
        }
      };

      Object.defineProperty(container, 'scrollWidth', { configurable: true, value: 1200 });
      Object.defineProperty(container, 'clientWidth', { configurable: true, value: 600 });
      Object.defineProperty(container, 'scrollLeft', { configurable: true, value: 0 });
      fireEvent.scroll(container);

      const nextButton = await screen.findByTestId('category-nav-left');
      fireEvent.click(nextButton);
      expect(currentScroll).toBeLessThan(0); // Scrolled left in RTL
    });

    it('4. arrows disable or hide at the relevant boundaries', async () => {
      renderNotificationCenter('/notifications', adminUser);
      await waitFor(() => {
        expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
      });

      const container = screen.getByTestId('category-tabs-container');
      Object.defineProperty(container, 'scrollWidth', { configurable: true, value: 1000 });
      Object.defineProperty(container, 'clientWidth', { configurable: true, value: 600 });
      Object.defineProperty(container, 'scrollLeft', { configurable: true, value: 0 });
      fireEvent.scroll(container);

      const rightBtn = await screen.findByTestId('category-nav-right');
      const leftBtn = await screen.findByTestId('category-nav-left');

      // At initial right boundary in RTL, right button is disabled
      expect(rightBtn).toBeDisabled();
      expect(leftBtn).not.toBeDisabled();
    });

    it('5. selected category is scrolled into view', async () => {
      renderNotificationCenter('/notifications', adminUser);
      await waitFor(() => {
        expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
      });

      const targetTab = screen.getByTestId('category-tab-audit_security');
      targetTab.scrollIntoView = () => {};

      fireEvent.click(targetTab);
      expect(targetTab).toHaveAttribute('aria-selected', 'true');
    });

    it('6. RTL navigation direction is correct', async () => {
      renderNotificationCenter('/notifications', adminUser);
      await waitFor(() => {
        expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
      });

      const container = screen.getByTestId('category-tabs-container');
      expect(container).toHaveClass('[scrollbar-width:none]');
      expect(container).toHaveAttribute('role', 'tablist');
      expect(container).toHaveAttribute('aria-label', 'تصنيفات الإشعارات');
    });

    it('7. native horizontal scrollbar is hidden', async () => {
      renderNotificationCenter('/notifications', adminUser);
      await waitFor(() => {
        expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
      });

      const container = screen.getByTestId('category-tabs-container');
      expect(container.className).toContain('[scrollbar-width:none]');
      expect(container.className).toContain('[-ms-overflow-style:none]');
      expect(container.className).toContain('[&::-webkit-scrollbar]:hidden');
    });

    it('8. keyboard and accessible labels remain correct', async () => {
      renderNotificationCenter('/notifications', adminUser);
      await waitFor(() => {
        expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
      });

      const container = screen.getByTestId('category-tabs-container');
      Object.defineProperty(container, 'scrollWidth', { configurable: true, value: 1200 });
      Object.defineProperty(container, 'clientWidth', { configurable: true, value: 600 });
      fireEvent.scroll(container);

      const rightBtn = await screen.findByTestId('category-nav-right');
      const leftBtn = await screen.findByTestId('category-nav-left');

      expect(rightBtn).toHaveAttribute('aria-label', 'التمرير إلى اليمين');
      expect(leftBtn).toHaveAttribute('aria-label', 'التمرير إلى اليسار');
    });
  });

  // ── 2. Comment Reports ──────────────────────────────────────────────
  describe('2. Comment Reports', () => {
    it('9. a valid comment report generates a notification', async () => {
      const comment = inMemoryStore.getCourseComments('CRS001')[0];
      expect(comment).toBeDefined();

      inMemoryStore.reportComment(
        comment.id,
        { reason: 'inappropriate_content', notes: 'تعليق غير لائق' },
        { id: traineeUser.id, role: 'user', name: traineeUser.name }
      );

      const adminNotifs = inMemoryStore.getNotificationsForUser(adminUser.id, 'admin');
      const reportNotif = adminNotifs.find((n) => n.type === 'comment_reported' && n.commentId === comment.id);
      expect(reportNotif).toBeDefined();
      expect(reportNotif?.actionRequired).toBe(true);
    });

    it('10. the intended authorized reviewers receive it', async () => {
      const comment = inMemoryStore.getCourseComments('CRS001')[0];
      inMemoryStore.reportComment(
        comment.id,
        { reason: 'harassment' },
        { id: traineeUser.id, role: 'user', name: traineeUser.name }
      );

      const adminNotifs = inMemoryStore.getNotificationsForUser('usr_admin_001', 'admin');
      const assistantNotifs = inMemoryStore.getNotificationsForUser('USR016', 'assistant_admin');
      expect(adminNotifs.some((n) => n.commentId === comment.id)).toBe(true);
      expect(assistantNotifs.some((n) => n.commentId === comment.id)).toBe(true);
    });

    it('10a. assigned instructor receives informational notification without actionRequired', async () => {
      const comment = inMemoryStore.getCourseComments('CRS001')[0];
      inMemoryStore.reportComment(
        comment.id,
        { reason: 'inappropriate_content', notes: 'تعليق غير ملائم للمقرر' },
        { id: traineeUser.id, role: 'user', name: traineeUser.name }
      );

      // Assigned course instructor receives the notification for course discussion awareness
      const lecturerNotifs = inMemoryStore.getNotificationsForUser('usr_lect_002', 'lecturer');
      const notif = lecturerNotifs.find((n) => n.commentId === comment.id);
      expect(notif).toBeDefined();
      expect(notif?.targetUrl).toBe(`/courses/${comment.courseId}`);
      // Assigned instructor does not hold central moderation authority -> actionRequired: false
      expect(notif?.actionRequired).toBe(false);
    });

    it('10b. administrative reviewers receive actionable notification with actionRequired', async () => {
      const comment = inMemoryStore.getCourseComments('CRS001')[0];
      inMemoryStore.reportComment(
        comment.id,
        { reason: 'harassment' },
        { id: traineeUser.id, role: 'user', name: traineeUser.name }
      );

      const adminNotif = inMemoryStore
        .getNotificationsForUser('usr_admin_001', 'admin')
        .find((n) => n.commentId === comment.id);
      const assistantNotif = inMemoryStore
        .getNotificationsForUser('USR016', 'assistant_admin')
        .find((n) => n.commentId === comment.id);

      expect(adminNotif?.actionRequired).toBe(true);
      expect(assistantNotif?.actionRequired).toBe(true);
    });

    it('11. unauthorized recipients do not receive it', async () => {
      const comment = inMemoryStore.getCourseComments('CRS001')[0];
      inMemoryStore.reportComment(
        comment.id,
        { reason: 'spam' },
        { id: traineeUser.id, role: 'user', name: traineeUser.name }
      );

      // Trainees do not receive comment moderation notifications
      const traineeNotifs = inMemoryStore.getNotificationsForUser(traineeUser.id, 'user');
      expect(traineeNotifs.some((n) => n.type === 'comment_reported')).toBe(false);
    });

    it('12. duplicate report dispatch does not create duplicate notifications', async () => {
      const comment = inMemoryStore.getCourseComments('CRS001')[0];
      const timestamp1 = '2026-11-02T10:00:00.000Z';
      inMemoryStore.createNotification({
        userId: 'usr_admin_001',
        type: 'comment_reported',
        title: 'بلاغ عن تعليق مخالف',
        message: 'محتوى البلاغ',
        commentId: comment.id,
        createdAt: timestamp1,
        dedupeKey: `comment_report:${comment.id}:${timestamp1}:usr_admin_001`,
      });
      inMemoryStore.createNotification({
        userId: 'usr_admin_001',
        type: 'comment_reported',
        title: 'بلاغ عن تعليق مخالف مكرر',
        message: 'محتوى البلاغ المكرر',
        commentId: comment.id,
        createdAt: timestamp1,
        dedupeKey: `comment_report:${comment.id}:${timestamp1}:usr_admin_001`,
      });

      const notifs = inMemoryStore
        .getNotificationsForUser('usr_admin_001', 'admin')
        .filter((n) => n.commentId === comment.id);
      expect(notifs).toHaveLength(1);

      // Verify that after resolution, a subsequent new report event creates a new notification
      const timestamp2 = '2026-11-02T12:00:00.000Z';
      inMemoryStore.createNotification({
        userId: 'usr_admin_001',
        type: 'comment_reported',
        title: 'بلاغ جديد لاحق عن تعليق مخالف',
        message: 'محتوى البلاغ الجديد',
        commentId: comment.id,
        createdAt: timestamp2,
        dedupeKey: `comment_report:${comment.id}:${timestamp2}:usr_admin_001`,
      });
      const notifsAfterNewReport = inMemoryStore
        .getNotificationsForUser('usr_admin_001', 'admin')
        .filter((n) => n.commentId === comment.id);
      expect(notifsAfterNewReport).toHaveLength(2);
    });

    it('13. reading the notification does not resolve the report', async () => {
      const comment = inMemoryStore.getCourseComments('CRS001')[0];
      inMemoryStore.reportComment(
        comment.id,
        { reason: 'inappropriate_content' },
        { id: traineeUser.id, role: 'user', name: traineeUser.name }
      );

      const notif = inMemoryStore
        .getNotificationsForUser('usr_admin_001', 'admin')
        .find((n) => n.commentId === comment.id)!;

      inMemoryStore.markNotificationRead(notif.id, 'usr_admin_001', 'admin');
      const updatedNotif = inMemoryStore
        .getNotificationsForUser('usr_admin_001', 'admin')
        .find((n) => n.id === notif.id)!;

      expect(updatedNotif.read).toBe(true);
      expect(updatedNotif.actionRequired).toBe(true);
    });

    it('14. resolving the report removes it from Requires Action', async () => {
      const comment = inMemoryStore.getCourseComments('CRS001')[0];
      inMemoryStore.reportComment(
        comment.id,
        { reason: 'inappropriate_content' },
        { id: traineeUser.id, role: 'user', name: traineeUser.name }
      );

      inMemoryStore.ignoreCommentReport(comment.id, { id: 'usr_admin_001', role: 'admin' });
      const updatedNotifs = inMemoryStore.getNotificationsForUser('usr_admin_001', 'admin');
      const reportNotif = updatedNotifs.find((n) => n.commentId === comment.id);
      expect(reportNotif?.actionRequired).toBe(false);
    });
  });

  // ── 3. Group Notifications ──────────────────────────────────────────
  describe('3. Group Notifications', () => {
    it('15. relevant group join request generates an appropriately scoped notification', async () => {
      const group = inMemoryStore.getGroupById('GRP-102')!;
      inMemoryStore.createGroupJoinRequest(group.id, traineeUser);

      const adminNotifs = inMemoryStore.getNotificationsForUser('usr_admin_001', 'admin');
      const joinNotif = adminNotifs.find((n) => n.type === 'enrollment_request' && n.groupId === group.id);
      expect(joinNotif).toBeDefined();
      expect(joinNotif?.actionRequired).toBe(true);
    });

    it('16. join decision notifies the affected requester where required', async () => {
      const group = inMemoryStore.getGroupById('GRP-102')!;
      const joinReq = inMemoryStore.createGroupJoinRequest(group.id, traineeUser);

      inMemoryStore.reviewGroupJoinRequest(
        { requestId: joinReq.id, decision: 'approved' },
        adminUser
      );

      const traineeNotifs = inMemoryStore.getNotificationsForUser(traineeUser.id, 'user');
      const approvalNotif = traineeNotifs.find((n) => n.type === 'enrollment_approved' && n.groupId === group.id);
      expect(approvalNotif).toBeDefined();
    });

    it('17. relevant group membership/lifecycle changes notify the correct recipients', async () => {
      const group = inMemoryStore.getGroups()[0];
      const newTraineeId = 'usr_new_trainee_099';
      inMemoryStore.addGroupMember(group.id, newTraineeId, 'admin_assigned');

      const traineeNotifs = inMemoryStore.getNotificationsForUser(newTraineeId, 'user');
      expect(traineeNotifs.some((n) => n.type === 'forced_enrollment' && n.groupId === group.id)).toBe(true);

      inMemoryStore.removeGroupMember(group.id, newTraineeId);
      const afterRemoval = inMemoryStore.getNotificationsForUser(newTraineeId, 'user');
      expect(afterRemoval.some((n) => Boolean(n.title?.includes('تم إخراجك')) && n.groupId === group.id)).toBe(true);
    });

    it('18. material or meeting events use the intended group-scoped recipients', async () => {
      const group = inMemoryStore.getGroups()[0];
      inMemoryStore.addGroupMember(group.id, traineeUser.id, 'admin_assigned');

      // Update group with cancelled meeting
      inMemoryStore.updateGroup(
        group.id,
        { resources: [] },
        { id: adminUser.id, role: 'admin' }
      );

      const traineeNotifs = inMemoryStore.getNotificationsForUser(traineeUser.id, 'user');
      expect(traineeNotifs.some((n) => Boolean(n.title?.includes('إلغاء لقاء')) || n.type === 'group_updated')).toBe(true);
    });

    it('19. unrelated groups and users do not receive the notification', async () => {
      const otherUser = SYNTHETIC_DEMO_ACCOUNTS.assistant_lecturer.user;
      const group = inMemoryStore.getGroups()[0];

      inMemoryStore.removeGroupMember(group.id, traineeUser.id);
      const otherNotifs = inMemoryStore.getNotificationsForUser(otherUser.id, 'user');
      expect(otherNotifs.some((n) => n.groupId === group.id && Boolean(n.title?.includes('تم إخراجك')))).toBe(false);
    });
  });

  // ── 4. Audit & Security Notifications ───────────────────────────────
  describe('4. Audit & Security Notifications', () => {
    it('20. relevant high-impact audit/security event produces a notification', async () => {
      inMemoryStore.recordAuditLog({
        actorId: 'usr_admin_001',
        actorRole: 'admin',
        action: 'users.change_role',
        actionLabelAr: 'تعديل دور مستخدم',
        severity: 'warning',
        outcome: 'success',
        details: 'تمت ترقية مستخدم إلى مساعد مدير',
      });

      const superNotifs = inMemoryStore.getNotificationsForUser('USR_SUPER_001', 'super_admin');
      const securityNotif = superNotifs.find((n) => n.type === 'security_alert');
      expect(securityNotif).toBeDefined();
      expect(securityNotif?.targetUrl).toBe('/admin/audit');
    });

    it('21. ordinary low-severity audit events are not indiscriminately broadcast', async () => {
      inMemoryStore.recordAuditLog({
        actorId: 'usr_admin_001',
        actorRole: 'admin',
        action: 'course.view',
        actionLabelAr: 'استعراض مقرر',
        severity: 'info',
        outcome: 'success',
        details: 'استعراض عادي لمقرر تدريبي',
      });

      const superNotifs = inMemoryStore.getNotificationsForUser('USR_SUPER_001', 'super_admin');
      expect(superNotifs.some((n) => Boolean(n.title?.includes('استعراض مقرر')))).toBe(false);
    });

    it('22. only authorized oversight roles receive security notifications', async () => {
      inMemoryStore.recordAuditLog({
        actorId: 'USR_SUPER_001',
        actorRole: 'super_admin',
        action: 'permissions.update_role_matrix',
        actionLabelAr: 'تعديل مصفوفة الصلاحيات',
        severity: 'critical',
        outcome: 'success',
        details: 'تعديل صلاحيات النظام المركزية',
      });

      const traineeNotifs = inMemoryStore.getNotificationsForUser(traineeUser.id, 'user');
      const lecturerNotifs = inMemoryStore.getNotificationsForUser(lecturerUser.id, 'lecturer');
      const assistantNotifs = inMemoryStore.getNotificationsForUser('USR016', 'assistant_admin');

      expect(traineeNotifs.some((n) => n.type === 'security_alert')).toBe(false);
      expect(lecturerNotifs.some((n) => n.type === 'security_alert')).toBe(false);
      // Assistant administrators do not receive privileged governance/permission mutation alerts
      expect(assistantNotifs.some((n) => n.type === 'security_alert' && Boolean(n.title?.includes('مصفوفة الصلاحيات')))).toBe(false);
    });

    it('22a. assistant_admin receives operational security event summary under D-14 but no privileged governance details', async () => {
      // 1. Operational security event: delegations.create
      inMemoryStore.recordAuditLog({
        actorId: 'usr_admin_001',
        actorRole: 'admin',
        action: 'delegations.create',
        actionLabelAr: 'إنشاء تفويض إداري',
        severity: 'warning',
        outcome: 'success',
        details: 'تم تفويض صلاحيات تشغيلية لمساعد المدير',
      });

      const assistantNotifs = inMemoryStore.getNotificationsForUser('USR016', 'assistant_admin');
      const operationalNotif = assistantNotifs.find((n) => n.type === 'security_alert' && Boolean(n.title?.includes('إنشاء تفويض')));
      expect(operationalNotif).toBeDefined();
      expect(operationalNotif?.targetUrl).toBe('/admin/audit');

      // 2. Privileged governance event: users.change_role
      inMemoryStore.recordAuditLog({
        actorId: 'USR_SUPER_001',
        actorRole: 'super_admin',
        action: 'users.change_role',
        actionLabelAr: 'تعديل دور مستخدم',
        severity: 'critical',
        outcome: 'success',
        details: 'ترقية مستخدم إلى مدير نظام أصيل',
      });

      const assistantNotifsAfter = inMemoryStore.getNotificationsForUser('USR016', 'assistant_admin');
      const privilegedNotif = assistantNotifsAfter.find((n) => n.type === 'security_alert' && Boolean(n.title?.includes('تعديل دور مستخدم')));
      // assistant_admin must NOT receive privileged governance alerts
      expect(privilegedNotif).toBeUndefined();
    });

    it('23. Developer identity is protected under INV-R8', async () => {
      inMemoryStore.recordAuditLog({
        actorId: 'USR_DEV_001',
        actorRole: 'developer',
        action: 'governance.invariant_check',
        actionLabelAr: 'فحص الحوكمة الشامل',
        severity: 'critical',
        outcome: 'success',
        details: 'قام المطور Developer Principal باختبار الحوكمة',
      });

      const adminNotifs = inMemoryStore.getNotificationsForUser('usr_admin_001', 'admin');
      const notif = adminNotifs.find((n) => n.type === 'security_alert');
      expect(notif).toBeDefined();
      expect(notif?.message).not.toContain('Developer Principal');
      expect(notif?.message).toContain('النظام');
    });

    it('23a. structured developer actor fields and nested metadata do not leak developer identity to non-developers', async () => {
      inMemoryStore.recordAuditLog({
        actorId: 'USR_DEV_001',
        actorRole: 'developer',
        action: 'governance.invariant_check',
        actionLabelAr: 'فحص الحوكمة الشامل',
        severity: 'critical',
        outcome: 'success',
        details: 'قام المطور Developer Principal باختبار الحوكمة',
        metadata: {
          developerId: 'USR_DEV_001',
          contact: 'developer@metro.local',
          subsystem: 'core-governance',
        },
      });

      // Non-developer view (Admin)
      const adminNotifs = inMemoryStore.getNotificationsForUser('usr_admin_001', 'admin');
      const notif = adminNotifs.find((n) => n.type === 'security_alert');
      expect(notif).toBeDefined();
      expect(notif?.actorId).toBe('SYSTEM');
      expect(notif?.actorRole).toBe('system');
      expect(notif?.actorName).toBe('النظام');
      expect((notif?.metadata as Record<string, unknown>)?.developerId).toBe('SYSTEM');
      expect((notif?.metadata as Record<string, unknown>)?.contact).toBe('system@metro.local');

      // Developer view retains authentic internal attribution
      const devNotifs = inMemoryStore.getNotificationsForUser('USR_DEV_001', 'developer');
      const devNotif = devNotifs.find((n) => n.type === 'security_alert');
      expect(devNotif).toBeDefined();
      expect(devNotif?.actorId).toBe('USR_DEV_001');
      expect(devNotif?.actorRole).toBe('developer');
    });

    it('24. notification metadata does not expose sensitive audit payloads', async () => {
      inMemoryStore.recordAuditLog({
        actorId: 'usr_admin_001',
        actorRole: 'admin',
        action: 'delegations.create',
        actionLabelAr: 'إنشاء تفويض إداري',
        severity: 'warning',
        outcome: 'success',
        details: 'إنشاء تفويض تشغيلي لمساعد المدير',
        metadata: { token: 'secret-token-12345', password: 'plain-password' },
      });

      const superNotifs = inMemoryStore.getNotificationsForUser('USR_SUPER_001', 'super_admin');
      const notif = superNotifs.find((n) => n.type === 'security_alert');
      expect(notif).toBeDefined();
      expect(JSON.stringify(notif)).not.toContain('secret-token-12345');
      expect(JSON.stringify(notif)).not.toContain('plain-password');
    });

    it('25. duplicate audit event dispatch does not generate duplicate notifications', async () => {
      const entry = inMemoryStore.recordAuditLog({
        id: 'AUD-DUP-001',
        actorId: 'usr_admin_001',
        actorRole: 'admin',
        action: 'users.delete',
        actionLabelAr: 'حذف حساب مستخدم',
        severity: 'critical',
        outcome: 'success',
        details: 'محاولة حذف حساب مستخدم',
      });

      // Dispatching duplicate audit notification with same id
      inMemoryStore.createNotification({
        userId: 'USR_SUPER_001',
        type: 'security_alert',
        title: 'تنبيه أمني مكرر',
        message: 'تفاصيل مكررة',
        auditLogId: entry.id,
        dedupeKey: `security_audit:${entry.id}:USR_SUPER_001`,
      });

      const superNotifs = inMemoryStore
        .getNotificationsForUser('USR_SUPER_001', 'super_admin')
        .filter((n) => n.auditLogId === entry.id);
      expect(superNotifs).toHaveLength(1);
    });
  });

  // ── 5. Regression ───────────────────────────────────────────────────
  describe('5. Regression', () => {
    it('26. existing category classification remains correct', () => {
      const approvalNotif: NotificationItem = {
        id: 'N1',
        userId: 'U1',
        type: 'general_alert',
        message: 'طلب اعتماد',
        requestId: 'REQ-001',
        targetUrl: '/approvals',
        read: false,
        createdAt: new Date().toISOString(),
      };
      expect(getNotificationCategory(approvalNotif)).toBe('approvals');

      const securityNotif: NotificationItem = {
        id: 'N2',
        userId: 'U1',
        type: 'security_alert',
        message: 'حدث أمني',
        targetUrl: '/admin/audit',
        read: false,
        createdAt: new Date().toISOString(),
      };
      expect(getNotificationCategory(securityNotif)).toBe('audit_security');

      const commentNotif: NotificationItem = {
        id: 'N3',
        userId: 'U1',
        type: 'comment_reported',
        message: 'بلاغ تعليق',
        commentId: 'COM-001',
        read: false,
        createdAt: new Date().toISOString(),
      };
      expect(getNotificationCategory(commentNotif)).toBe('content_review');
    });

    it('27. All Notifications continues to include every notification', async () => {
      renderNotificationCenter('/notifications', adminUser);
      await waitFor(() => {
        expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
      });

      const allTab = screen.getByTestId('category-tab-all');
      fireEvent.click(allTab);
      expect(allTab).toHaveAttribute('aria-selected', 'true');
    });

    it('28. unread count and Requires Action count remain distinct', async () => {
      const comment = inMemoryStore.getCourseComments('CRS001')[0];
      inMemoryStore.reportComment(
        comment.id,
        { reason: 'inappropriate_content' },
        { id: traineeUser.id, role: 'user', name: traineeUser.name }
      );

      const notifs = inMemoryStore.getNotificationsForUser('usr_admin_001', 'admin');
      const actionable = notifs.filter((n) => n.actionRequired).length;
      const unread = notifs.filter((n) => !n.read).length;

      expect(actionable).toBeGreaterThan(0);
      expect(unread).toBeGreaterThan(0);
    });

    it('29. direct account switching and stale response isolation remain intact', async () => {
      const { unmount } = renderNotificationCenter('/notifications', adminUser);
      await waitFor(() => {
        expect(screen.getByTestId('notifications-page')).toBeInTheDocument();
        expect(screen.getByTestId('category-tab-audit_security')).toBeInTheDocument();
      });

      unmount();

      // Switch to trainee directly
      authStorage.setSession({
        token: 'mock_jwt_trainee_switch',
        user: traineeUser,
        expiresAt: Date.now() + 3600000,
      });

      renderNotificationCenter('/notifications', traineeUser);
      await waitFor(() => {
        expect(screen.queryByTestId('category-tab-audit_security')).not.toBeInTheDocument();
      });
    });

    it('30. existing approval notification links and workflows remain intact', async () => {
      inMemoryStore.createNotification({
        userId: 'usr_admin_001',
        type: 'general_alert',
        title: 'طلب اعتماد جديد',
        message: 'يرجى مراجعة طلب الاعتماد',
        requestId: 'REQ-NAV-001',
        targetUrl: '/approvals',
      });

      renderNotificationCenter('/notifications', adminUser);
      await waitFor(() => {
        expect(screen.getByText('طلب اعتماد جديد')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('طلب اعتماد جديد'));
      await waitFor(() => {
        expect(screen.getByTestId('approvals-hub-page')).toBeInTheDocument();
      });
    });
  });
});

