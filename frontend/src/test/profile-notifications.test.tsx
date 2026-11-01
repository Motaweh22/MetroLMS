import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
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
const lecturerUser = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;
const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;

function LocationProbe({ testId }: { testId: string }) {
  const location = useLocation();
  return (
    <div data-testid={testId}>
      {location.pathname}
      {location.search}
    </div>
  );
}

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

describe('Increment 7: Profile & Notification Center Verification', () => {
  it('renders read-only user profile with personal details, role, and learning statistics', async () => {
    renderWithShell('/profile');

    await waitFor(() => {
      expect(screen.getByTestId('profile-page')).toBeInTheDocument();
      expect(screen.getByText(traineeUser.email)).toBeInTheDocument();
    });
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
      expect(screen.getByTestId('navbar-unread-badge')).toBeInTheDocument();
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
      expect(screen.getByTestId('mark-all-read-btn')).toBeInTheDocument();
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
      expect(screen.getByTestId('notification-item-NOT002')).toBeInTheDocument();
    });

    // Click on NOT002 which has courseId: CRS004
    const notifItem = screen.getByTestId('notification-item-NOT002');
    fireEvent.click(notifItem);

    await waitFor(() => {
      expect(screen.getByTestId('course-page')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('displays localized Arabic notification type badges instead of raw English enum keys and decrements unread badge when marking one item as read', async () => {
    renderWithShell('/notifications', traineeUser);

    await waitFor(() => {
      expect(screen.getAllByText('تعيين مسار تدريبي').length).toBeGreaterThanOrEqual(1);
    });

    // Arabic type labels should be shown
    expect(screen.getAllByText('تذكير بالموعد النهائي').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('forced_enrollment')).not.toBeInTheDocument();
    expect(screen.queryByText('deadline_reminder')).not.toBeInTheDocument();

    const initialBadge = screen.getByTestId('navbar-unread-badge');
    const initialCount = Number(initialBadge.textContent);
    expect(initialCount).toBe(5);

    // Click unread notification NOT006 (trainee group notification for GRP-101)
    const groupNotif = screen.getByTestId('notification-item-NOT006');
    fireEvent.click(groupNotif);

    await waitFor(() => {
      expect(screen.getByTestId('trainee-group-detail-page')).toHaveTextContent('/my-groups/GRP-101');
    });

    await waitFor(() => {
      expect(Number(screen.getByTestId('navbar-unread-badge').textContent)).toBe(initialCount - 1);
    });
  });

  it('navigates admin enrollment_request and content_pending_review notifications to their exact target destinations', async () => {
    const { unmount } = renderWithShell('/notifications', adminUser);

    await waitFor(() => {
      expect(screen.getByTestId('notification-item-NOT203')).toBeInTheDocument();
    });

    // Click NOT203 (enrollment_request for GRP-103)
    fireEvent.click(screen.getByTestId('notification-item-NOT203'));

    await waitFor(() => {
      expect(screen.getByTestId('admin-group-monitoring-page')).toHaveTextContent(
        '/admin/groups/GRP-103/monitoring?tab=requests'
      );
    });

    unmount();

    // Re-render and click NOT202 (content_pending_review for CRS004)
    renderWithShell('/notifications', adminUser);
    await waitFor(() => {
      expect(screen.getByTestId('notification-item-NOT202')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('notification-item-NOT202'));

    await waitFor(() => {
      expect(screen.getByTestId('admin-review-page')).toHaveTextContent('/admin/review/CRS004');
    });
  });

  it('triggers role-accurate notifications for group join request submission, approval, and rejection without leaking to unrelated users', () => {
    // Configure GRP-103 with primaryInstructorId usr_lect_002 and assistant USR017
    inMemoryStore.updateGroup('GRP-103', {
      primaryInstructorId: 'usr_lect_002',
      assistantLecturerIds: ['USR017'],
    });

    const req = inMemoryStore.submitGroupJoinRequest({
      groupId: 'GRP-103',
      userId: 'USR008', // Trainee
      note: 'أرغب بالانضمام للمجموعة',
    });

    // Primary instructor (usr_lect_002), assistant lecturer (USR017), and all active admins (usr_admin_001 & USR001) receive the enrollment_request notification
    const adminNotifs = inMemoryStore.getNotificationsForUser('usr_admin_001');
    const primaryNotifs = inMemoryStore.getNotificationsForUser('usr_lect_002');
    const assistantNotifs = inMemoryStore.getNotificationsForUser('USR017');
    const unrelatedLecturerNotifs = inMemoryStore.getNotificationsForUser('USR002');
    const secondActiveAdminNotifs = inMemoryStore.getNotificationsForUser('USR001');

    expect(adminNotifs.some((n) => n.requestId === req.id && n.type === 'enrollment_request')).toBe(true);
    expect(secondActiveAdminNotifs.some((n) => n.requestId === req.id && n.type === 'enrollment_request')).toBe(true);
    expect(primaryNotifs.some((n) => n.requestId === req.id && n.type === 'enrollment_request')).toBe(true);
    expect(assistantNotifs.some((n) => n.requestId === req.id && n.type === 'enrollment_request')).toBe(true);
    expect(unrelatedLecturerNotifs.some((n) => n.requestId === req.id)).toBe(false);

    // Approve the join request as admin -> applicant and group staff (primary & assistant) are notified, but acting admin is not self-notified
    inMemoryStore.reviewGroupJoinRequest(
      { requestId: req.id, decision: 'approved', reviewNote: 'تم القبول' },
      adminUser
    );

    const applicantNotifs = inMemoryStore.getNotificationsForUser('USR008');
    const approvalNotif = applicantNotifs.find(
      (n) => n.requestId === req.id && n.type === 'enrollment_approved'
    );
    expect(approvalNotif).toBeDefined();
    expect(approvalNotif?.targetUrl).toBe('/my-groups/GRP-103');
    expect(
      inMemoryStore
        .getNotificationsForUser('usr_lect_002')
        .some((n) => n.requestId === req.id && n.type === 'enrollment_approved')
    ).toBe(true);
    expect(
      inMemoryStore
        .getNotificationsForUser('USR017')
        .some((n) => n.requestId === req.id && n.type === 'enrollment_approved')
    ).toBe(true);

    // Submit a second join request and reject it as primary lecturer (usr_lect_002)
    const req2 = inMemoryStore.submitGroupJoinRequest({
      groupId: 'GRP-103',
      userId: 'USR009',
      note: 'طلب ثانٍ',
    });
    inMemoryStore.reviewGroupJoinRequest(
      { requestId: req2.id, decision: 'rejected', reviewNote: 'غير مطابق لشروط التخصص' },
      lecturerUser
    );

    const rejectedUserNotifs = inMemoryStore.getNotificationsForUser('USR009');
    const rejectionNotif = rejectedUserNotifs.find(
      (n) => n.requestId === req2.id && n.type === 'enrollment_rejected'
    );
    expect(rejectionNotif).toBeDefined();
    expect(rejectionNotif?.message).toContain('غير مطابق لشروط التخصص');
    expect(rejectionNotif?.targetUrl).toBe('/my-groups');

    // Co-supervisor (USR017) receives staff rejection notification, while acting reviewer (usr_lect_002) does not self-notify
    expect(
      inMemoryStore
        .getNotificationsForUser('USR017')
        .some((n) => n.requestId === req2.id && n.type === 'enrollment_rejected')
    ).toBe(true);
    expect(
      inMemoryStore
        .getNotificationsForUser('usr_lect_002')
        .some((n) => n.requestId === req2.id && n.type === 'enrollment_rejected')
    ).toBe(false);
  });

  it('notifies newly assigned group primary instructor, assistant lecturers, and admin when staff assignments change', () => {
    // Primary lecturer (usr_lect_002) updates assistant lecturers on GRP-101 (adding USR017 and USR002)
    inMemoryStore.updateGroupAssistants('GRP-101', ['USR017', 'USR002'], {
      id: lecturerUser.id,
      role: 'lecturer',
    });

    const newAssistantNotifs = inMemoryStore.getNotificationsForUser('USR002');
    expect(
      newAssistantNotifs.some(
        (n) =>
          n.type === 'instructor_assigned' &&
          n.groupId === 'GRP-101' &&
          n.targetUrl === '/admin/groups/GRP-101/monitoring'
      )
    ).toBe(true);

    // Admin should also be notified when the primary instructor updates group assistants
    const adminNotifs = inMemoryStore.getNotificationsForUser('usr_admin_001');
    expect(
      adminNotifs.some((n) => n.type === 'instructor_assigned' && n.groupId === 'GRP-101')
    ).toBe(true);
  });

  it('notifies admin when a lecturer submits a course for review and notifies primary + co-lecturers on review decisions', () => {
    const courseId = 'CRS-REV-NEW-01';

    // Assign USR017 as co-lecturer
    inMemoryStore.assignCourseInstructors(
      courseId,
      { lecturerId: lecturerUser.id, coLecturers: ['USR017'] },
      { id: adminUser.id, role: 'admin' }
    );

    expect(
      inMemoryStore
        .getNotificationsForUser('USR017')
        .some((n) => n.type === 'instructor_assigned' && n.courseId === courseId)
    ).toBe(true);

    // Reject the course -> both primary lecturer and co-lecturer receive content_rejected with builder targetUrl
    inMemoryStore.executeReviewDecision(
      courseId,
      { outcome: 'rejected', summaryMessage: 'يرجى إضافة مرفق توضيحي' },
      adminUser
    );

    expect(
      inMemoryStore
        .getNotificationsForUser(lecturerUser.id)
        .some(
          (n) =>
            n.type === 'content_rejected' &&
            n.courseId === courseId &&
            n.targetUrl === `/lecturer/builder/${courseId}`
        )
    ).toBe(true);
    expect(
      inMemoryStore
        .getNotificationsForUser('USR017')
        .some(
          (n) =>
            n.type === 'content_rejected' &&
            n.courseId === courseId &&
            n.targetUrl === `/lecturer/builder/${courseId}`
        )
    ).toBe(true);

    // Resubmit course for review -> admin receives content_pending_review with review targetUrl
    inMemoryStore.submitCourseForReview(courseId, lecturerUser);

    const adminNotifs = inMemoryStore.getNotificationsForUser('usr_admin_001');
    expect(
      adminNotifs.some(
        (n) =>
          n.type === 'content_pending_review' &&
          n.courseId === courseId &&
          n.targetUrl === `/admin/review/${courseId}`
      )
    ).toBe(true);
  });

  it('sends deduplicated group_renewed notifications on automatic successor group creation and deduplicated deadline_reminder notifications', () => {
    inMemoryStore.updateGroup('GRP-101', {
      renewalSchedule: {
        recurrenceType: 'custom',
        intervalDays: 30,
        renewalIntervalDays: 30,
        autoRenewalEnabled: true,
      },
    });

    // Advance clock past GRP-101's scheduled renewal date (deadline 2026-10-28 + 30 days = late Nov 2026)
    const futureDate = new Date('2026-12-10T12:00:00.000Z');
    const result = inMemoryStore.checkAndProcessAutoRenewal('GRP-101', futureDate);
    expect(result.renewed).toBe(true);
    expect(result.successorGroup).toBeDefined();

    const successorId = result.successorGroup!.id;

    // Trainee usr_trainee_003 (enrolled in GRP-101) receives group_renewed linking to /my-groups/:successorId
    const traineeNotifs = inMemoryStore.getNotificationsForUser('usr_trainee_003');
    const traineeRenewNotifs = traineeNotifs.filter(
      (n) => n.type === 'group_renewed' && n.groupId === successorId
    );
    expect(traineeRenewNotifs.length).toBe(1);
    expect(traineeRenewNotifs[0].targetUrl).toBe(`/my-groups/${successorId}`);

    // Primary lecturer usr_lect_002 and admin usr_admin_001 receive staff group_renewed linking to monitoring page
    const lecturerRenewNotifs = inMemoryStore
      .getNotificationsForUser('usr_lect_002')
      .filter((n) => n.type === 'group_renewed' && n.groupId === successorId);
    expect(lecturerRenewNotifs.length).toBe(1);
    expect(lecturerRenewNotifs[0].targetUrl).toBe(`/admin/groups/${successorId}/monitoring`);

    // Calling checkAndProcessAllDueRenewals near a group's deadline sends deadline_reminder once and deduplicates on repeat ticks
    const successor = inMemoryStore.getGroupById(successorId)!;
    const deadlineMs = new Date(successor.deadlineDateTime!).getTime();
    const twoDaysBeforeDeadline = new Date(deadlineMs - 2 * 24 * 60 * 60 * 1000);

    inMemoryStore.checkAndProcessAllDueRenewals(twoDaysBeforeDeadline);
    inMemoryStore.checkAndProcessAllDueRenewals(twoDaysBeforeDeadline);

    const remindersForSuccessor = inMemoryStore
      .getNotificationsForUser('usr_trainee_003')
      .filter((n) => n.type === 'deadline_reminder' && n.groupId === successorId);
    expect(remindersForSuccessor.length).toBe(1);
  });

  it('triggers notifications for direct group membership, capacity alerts, group updates, material uploads, archival, course completion, and comments', () => {
    // 1. Direct trainee addition + capacity alert
    inMemoryStore.updateGroup('GRP-102', {
      maxTrainees: 3,
      primaryInstructorId: 'usr_lect_002',
    });
    inMemoryStore.addGroupMember('GRP-102', 'USR008', 'admin_assigned');

    expect(
      inMemoryStore
        .getNotificationsForUser('USR008')
        .some(
          (n) =>
            n.type === 'forced_enrollment' &&
            n.groupId === 'GRP-102' &&
            n.targetUrl === '/my-groups/GRP-102'
        )
    ).toBe(true);

    // Capacity (3) reached -> primary instructor & admin notified
    expect(
      inMemoryStore
        .getNotificationsForUser('usr_lect_002')
        .some((n) => n.type === 'general_alert' && n.groupId === 'GRP-102')
    ).toBe(true);
    expect(
      inMemoryStore
        .getNotificationsForUser('usr_admin_001')
        .some((n) => n.type === 'general_alert' && n.groupId === 'GRP-102')
    ).toBe(true);

    // 2. Group schedule/resources update & material upload on active group
    inMemoryStore.updateGroup('GRP-101', {
      deadlineDateTime: '2026-12-01T18:00:00',
    });
    expect(
      inMemoryStore
        .getNotificationsForUser('usr_trainee_003')
        .some((n) => n.type === 'group_updated' && n.groupId === 'GRP-101')
    ).toBe(true);

    inMemoryStore.addMaterialFile(
      'GRP-101',
      'FLD-GRP-101-01',
      {
        title: 'ملف إرشادات جديد',
        fileName: 'guide.pdf',
        sizeBytes: 102400,
        mimeType: 'application/pdf',
        isVisible: true,
      },
      lecturerUser
    );
    expect(
      inMemoryStore
        .getNotificationsForUser('usr_trainee_003')
        .some((n) => n.type === 'group_updated' && n.message.includes('ملف إرشادات جديد'))
    ).toBe(true);

    // 3. Group archival notifies staff and trainees
    inMemoryStore.archiveGroup('GRP-102');
    expect(
      inMemoryStore
        .getNotificationsForUser('USR008')
        .some((n) => n.type === 'group_archived' && n.groupId === 'GRP-102')
    ).toBe(true);
    expect(
      inMemoryStore
        .getNotificationsForUser('usr_lect_002')
        .some((n) => n.type === 'group_archived' && n.groupId === 'GRP-102')
    ).toBe(true);

    // 4. Trainee comment & comment report notify course lecturer and admin
    const comment = inMemoryStore.createComment(
      { courseId: 'CRS001', text: 'استفسار فني حول الدرس الأول' },
      { id: 'usr_trainee_003', role: 'user', name: traineeUser.name }
    );
    expect(
      inMemoryStore
        .getNotificationsForUser('usr_lect_002')
        .some((n) => n.type === 'new_comment' && n.courseId === 'CRS001')
    ).toBe(true);

    inMemoryStore.reportComment(
      comment.id,
      { reason: 'inappropriate_content' },
      { id: 'USR004', role: 'user', name: 'متدرب زميل' }
    );
    expect(
      inMemoryStore
        .getNotificationsForUser('usr_admin_001')
        .some(
          (n) =>
            n.type === 'general_alert' &&
            n.courseId === 'CRS001' &&
            n.targetUrl === '/admin/comment-moderation'
        )
    ).toBe(true);

    // 5. Course completion triggers deduplicated course_completed notification
    const items = inMemoryStore.getCourseItems('CRS001');
    for (const item of items) {
      inMemoryStore.markLessonComplete({
        userId: 'usr_trainee_003',
        courseId: 'CRS001',
        itemId: item.id,
        userRole: 'user',
      });
    }
    const completionNotifs = inMemoryStore
      .getNotificationsForUser('usr_trainee_003')
      .filter((n) => n.type === 'course_completed' && n.courseId === 'CRS001');
    expect(completionNotifs.length).toBe(1);
  });

  it('suppresses notifications for suspended users, prevents false schedule notifications on equivalent timestamps, and emits accurate meeting vs. attachment update notifications', () => {
    // 1. Suspend USR001 (second admin) and USR004 (enrolled trainee in GRP-101)
    // Using super_admin persona to mutate admin per INV-R3
    inMemoryStore.updateUserStatus('USR001', 'suspended', 'إيقاف مؤقت للاختبار', {
      id: 'USR_SUPER_001',
      role: 'super_admin',
    });
    inMemoryStore.updateUserStatus('USR004', 'suspended', 'إيقاف مؤقت للمتدرب', {
      id: adminUser.id,
      role: 'admin',
    });

    const suspendedAdminBefore = inMemoryStore.getNotificationsForUser('USR001').length;
    const suspendedTraineeBefore = inMemoryStore.getNotificationsForUser('USR004').length;
    const activeTraineeBefore = inMemoryStore
      .getNotificationsForUser('usr_trainee_003')
      .filter((n) => n.type === 'group_updated' && n.groupId === 'GRP-101').length;

    // 2. Equivalent ISO timestamp formatting does NOT emit a false group_updated notification
    const grp101 = inMemoryStore.getGroupById('GRP-101')!;
    const equivalentStartIso = new Date(grp101.startDateTime!).toISOString();
    const equivalentDeadlineIso = new Date(grp101.deadlineDateTime!).toISOString();
    inMemoryStore.updateGroup('GRP-101', {
      name: grp101.name,
      startDateTime: equivalentStartIso,
      deadlineDateTime: equivalentDeadlineIso,
    });

    const activeTraineeAfterNoOpSchedule = inMemoryStore
      .getNotificationsForUser('usr_trainee_003')
      .filter((n) => n.type === 'group_updated' && n.groupId === 'GRP-101').length;
    expect(activeTraineeAfterNoOpSchedule).toBe(activeTraineeBefore);

    // 3. Adding an interactive meeting emits a meeting-specific group_updated notification to active trainee only (not suspended USR004)
    inMemoryStore.updateGroup('GRP-101', {
      resources: [
        ...(grp101.resources || []),
        {
          id: 'RES-MEETING-NEW',
          title: 'لقاء مراجعة الإشارات الضوئية',
          url: 'https://teams.microsoft.com/l/meetup-join/signals-review',
          description: 'لقاء تفاعلي مباشر',
          order: 3,
          type: 'teams',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const activeTraineeNotifs = inMemoryStore.getNotificationsForUser('usr_trainee_003');
    expect(
      activeTraineeNotifs.some(
        (n) =>
          n.type === 'group_updated' &&
          n.groupId === 'GRP-101' &&
          n.title === 'تحديث في اللقاءات التفاعلية للمجموعة'
      )
    ).toBe(true);
    expect(inMemoryStore.getNotificationsForUser('USR004').length).toBe(suspendedTraineeBefore);

    // 4. Adding an attached document emits an attachment-specific group_updated notification
    const currentGrp = inMemoryStore.getGroupById('GRP-101')!;
    inMemoryStore.updateGroup('GRP-101', {
      resources: [
        ...(currentGrp.resources || []),
        {
          id: 'RES-ATTACH-NEW',
          title: 'كتيب التشغيل المحدث.pdf',
          url: '/dev-media/test-document.pdf',
          description: 'ملف PDF مرفق',
          order: 4,
          type: 'pdf',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    expect(
      inMemoryStore
        .getNotificationsForUser('usr_trainee_003')
        .some(
          (n) =>
            n.type === 'group_updated' &&
            n.groupId === 'GRP-101' &&
            n.title === 'تحديث في المواد المرفقة للمجموعة'
        )
    ).toBe(true);

    // 5. Failed business operation (unauthorized lecturer trying to update group assistants) does NOT create notifications
    const activeAdminCountBeforeFail = inMemoryStore.getNotificationsForUser('usr_admin_001').length;
    expect(() =>
      inMemoryStore.updateGroupAssistants('GRP-101', ['USR017'], {
        id: 'USR002', // Unrelated lecturer
        role: 'lecturer',
      })
    ).toThrow();
    expect(inMemoryStore.getNotificationsForUser('usr_admin_001').length).toBe(
      activeAdminCountBeforeFail
    );
    expect(inMemoryStore.getNotificationsForUser('USR001').length).toBe(suspendedAdminBefore);

    // 6. Governance approval request notifies active admins (excluding suspended USR001) and decision notifies requester
    const approvalReq = inMemoryStore.createApprovalRequest({
      actionType: 'users.change_status',
      requestedBy: 'USR015',
      requesterName: 'مساعد مدير النظام',
      targetId: 'USR008',
      targetResourceName: 'متدرب تجريبي',
      titleAr: 'طلب تغيير حالة حساب متدرب',
      justification: 'مراجعة دورية',
      payload: { userId: 'USR008', status: 'active', reason: 'مراجعة دورية' },
    });

    expect(
      inMemoryStore
        .getNotificationsForUser('usr_admin_001')
        .some((n) => n.requestId === approvalReq.id && n.targetUrl === '/admin/users')
    ).toBe(true);
    expect(inMemoryStore.getNotificationsForUser('USR001').length).toBe(suspendedAdminBefore);

    inMemoryStore.rejectApprovalRequest(approvalReq.id, 'usr_admin_001', 'يرجى استكمال المستندات');
    expect(
      inMemoryStore
        .getNotificationsForUser('USR015')
        .some(
          (n) =>
            n.requestId === approvalReq.id &&
            n.message.includes('يرجى استكمال المستندات')
        )
    ).toBe(true);
  });

  it('enforces role-safe navigation boundaries in NotificationsPage when a notification has a cross-role targetUrl', async () => {
    // Inject a notification for trainee with an accidental /admin/... targetUrl
    const injected = inMemoryStore.createNotification({
      userId: traineeUser.id,
      type: 'group_updated',
      title: 'إشعار اختبار التوجيه الآمن',
      message: 'رسالة اختبار توجيه المتدرب إلى صفحة المجموعة بدلاً من لوحة الإدارة',
      groupId: 'GRP-101',
      targetUrl: '/admin/groups/GRP-101/monitoring',
    });
    expect(injected).not.toBeNull();

    renderWithShell('/notifications', traineeUser);

    await waitFor(() => {
      expect(screen.getByTestId(`notification-item-${injected!.id}`)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId(`notification-item-${injected!.id}`));

    // Trainee is safely routed to /my-groups/GRP-101 instead of /admin/groups/GRP-101/monitoring
    await waitFor(() => {
      expect(screen.getByTestId('trainee-group-detail-page')).toHaveTextContent('/my-groups/GRP-101');
    });
  });
});
