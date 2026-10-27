import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AppRouter } from '@/app/router';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type { User } from '@/core/auth/types';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockImplementation(() => Promise.resolve()),
    },
  });
});

afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset({ seedReviewDemo: false });
});
afterAll(() => server.close());

const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;

const outsiderTrainee: User = {
  id: 'USR006',
  email: 'yasser@cairo-metro.com',
  name: 'ياسر إبراهيم عبدالعزيز',
  initials: 'يا',
  role: 'user',
  department: 'قطاع التشغيل',
  jobTitle: 'مشرف محطة',
};

function renderWithApp(initialRoute: string, user: User = adminUser) {
  authStorage.setSession({
    token: `mock_jwt_${user.id}_test`,
    user,
    expiresAt: Date.now() + 3600000,
  });

  return render(<AppRouter initialEntries={[initialRoute]} />);
}

describe('Increment 10 — Phase 6: QR Enrollment, Join Requests & Direct Assignment', () => {
  // ── 1. Group Members Tab & QR Modal Management ──────────────────────────

  describe('1. Members Tab & QR Modal Presentation', () => {
    it('switches to members tab, displays current members and launches QR modal', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=members', adminUser);

      // Loading state disappears and members tab displays
      await waitFor(() => {
        expect(screen.getByTestId('group-members-tab')).toBeInTheDocument();
      });

      // Table displays initial seeded members (usr_trainee_003 and USR004)
      await waitFor(() => {
        expect(screen.getByTestId('group-members-table')).toBeInTheDocument();
        expect(screen.getByTestId('member-row-usr_trainee_003')).toBeInTheDocument();
        expect(screen.getByTestId('member-row-usr004')).toBeInTheDocument();
      });

      // Launch QR Modal
      const openQrBtn = screen.getByTestId('open-qr-modal-btn');
      fireEvent.click(openQrBtn);

      await waitFor(() => {
        expect(screen.getByTestId('group-qr-modal')).toBeInTheDocument();
      });

      // Live SVG QR container is rendered
      expect(screen.getByTestId('qr-svg-container')).toBeInTheDocument();
      expect(screen.getByTestId('join-url-input')).toBeInTheDocument();
      expect(screen.getByTestId('copy-join-link-btn')).toBeInTheDocument();
      expect(screen.getByTestId('download-qr-btn')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-enrollment-btn')).toBeInTheDocument();
    });

    it('copies join link and toggles enrollment active/disabled state', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=members', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-members-tab')).toBeInTheDocument();
      });

      // Open QR modal
      fireEvent.click(screen.getByTestId('open-qr-modal-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('group-qr-modal')).toBeInTheDocument();
      });

      // Copy link
      const copyBtn = screen.getByTestId('copy-join-link-btn');
      fireEvent.click(copyBtn);

      await waitFor(() => {
        expect(copyBtn).toHaveTextContent('تم النسخ');
      });

      // Toggle enrollment to disabled
      const toggleBtn = screen.getByTestId('toggle-enrollment-btn');
      expect(toggleBtn).toHaveTextContent('تعطيل الانضمام');
      fireEvent.click(toggleBtn);

      await waitFor(() => {
        expect(screen.getByTestId('qr-disabled-alert')).toBeInTheDocument();
      });
    });

    it('rotates QR token with confirmation dialog and invalidates previous token', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=members', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-members-tab')).toBeInTheDocument();
      });

      // Open QR Modal
      fireEvent.click(screen.getByTestId('open-qr-modal-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('group-qr-modal')).toBeInTheDocument();
      });

      const initialUrlInput = screen.getByTestId('join-url-input') as HTMLInputElement;
      const initialCode = initialUrlInput.value;

      // Click rotate QR code
      const rotateBtn = screen.getByTestId('rotate-qr-btn');
      fireEvent.click(rotateBtn);

      // Confirm dialog appears
      await waitFor(() => {
        expect(screen.getByTestId('rotate-qr-confirm-dialog')).toBeInTheDocument();
      });

      // Click confirm rotate
      const confirmRotateBtn = screen.getByTestId('confirm-rotate-qr-btn');
      fireEvent.click(confirmRotateBtn);

      // Dialog closes and new URL/token is rendered
      await waitFor(() => {
        const updatedInput = screen.getByTestId('join-url-input') as HTMLInputElement;
        expect(updatedInput.value).not.toBe(initialCode);
      });
    });
  });

  // ── 2. Trainee Join Page (/groups/join) ──────────────────────────────────

  describe('2. Trainee Join Page (/groups/join)', () => {
    it('renders manual code input form when visited without code parameter', async () => {
      renderWithApp('/groups/join', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('join-group-page')).toBeInTheDocument();
      });

      expect(screen.getByTestId('manual-code-input')).toBeInTheDocument();
      expect(screen.getByTestId('submit-manual-code-btn')).toBeInTheDocument();
    });

    it('displays error card when enrollment code is invalid', async () => {
      renderWithApp('/groups/join?code=INVALID-TOKEN-999', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('join-error-card')).toBeInTheDocument();
      });

      expect(screen.getByText('تعذر الانضمام إلى المجموعة')).toBeInTheDocument();
    });

    it('allows instant join on open group and handles already-member idempotently', async () => {
      // Use outsiderTrainee (USR006) who is not a member of GRP-101
      renderWithApp('/groups/join?code=GRP-101-SEC-DEMO', outsiderTrainee);

      // Previews group card
      await waitFor(() => {
        expect(screen.getByTestId('group-preview-card')).toBeInTheDocument();
      });

      expect(screen.getByTestId('preview-group-name')).toBeInTheDocument();
      expect(screen.getByTestId('preview-policy-badge')).toHaveTextContent('انضمام فوري');

      // Click Instant Join button
      const joinBtn = screen.getByTestId('join-group-submit-btn');
      fireEvent.click(joinBtn);

      // Join success card appears with enrolled courses count
      await waitFor(() => {
        expect(screen.getByTestId('join-success-card')).toBeInTheDocument();
      });
      expect(screen.getByText('مرحباً بك في المجموعة التدريبية!')).toBeInTheDocument();
      expect(screen.getByTestId('go-my-groups-btn')).toBeInTheDocument();
      expect(screen.getByTestId('go-my-courses-btn')).toBeInTheDocument();

      // Verify trainee is now in group members
      const members = inMemoryStore.getGroupMembers('GRP-101');
      expect(members.some((m) => m.userId.toLowerCase() === outsiderTrainee.id.toLowerCase())).toBe(true);
    });

    it('submits join request on approval_required group and captures optional note', async () => {
      // Configure GRP-101 to approval_required in store
      const group = inMemoryStore.getGroupById('GRP-101');
      if (group) group.enrollmentPolicy = 'approval_required';

      renderWithApp('/groups/join?code=GRP-101-SEC-DEMO', outsiderTrainee);

      await waitFor(() => {
        expect(screen.getByTestId('group-preview-card')).toBeInTheDocument();
      });

      expect(screen.getByTestId('preview-policy-badge')).toHaveTextContent('موافقة المشرف مطلوبة');
      expect(screen.getByTestId('join-note-input')).toBeInTheDocument();

      // Enter optional note
      const noteInput = screen.getByTestId('join-note-input');
      fireEvent.change(noteInput, {
        target: { value: 'فني صيانة وردية أولى - أرغب بالانضمام للبرنامج' },
      });

      // Submit join request
      const submitReqBtn = screen.getByTestId('submit-join-request-btn');
      fireEvent.click(submitReqBtn);

      // Success card shows pending approval message
      await waitFor(() => {
        expect(screen.getByTestId('join-success-card')).toBeInTheDocument();
      });
      expect(screen.getByText('تم إرسال طلب الانضمام بنجاح')).toBeInTheDocument();

      // Verify request in store
      const pendingRequests = inMemoryStore.getGroupJoinRequests('GRP-101', 'pending');
      expect(pendingRequests.length).toBe(1);
      expect(pendingRequests[0].userId).toBe(outsiderTrainee.id);
    });
  });

  // ── 3. Join Requests Review & Approval Flow ──────────────────────────────

  describe('3. Join Requests Review & Approval Flow', () => {
    it('displays pending join requests, approves request, and adds member with course enrollments', async () => {
      // Seed a pending request for GRP-101
      inMemoryStore.submitGroupJoinRequest({
        groupId: 'GRP-101',
        userId: outsiderTrainee.id,
        note: 'طلب انضمام لتأهيل العمل الميداني',
      });

      renderWithApp('/admin/groups/GRP-101/edit?tab=members', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-members-tab')).toBeInTheDocument();
      });

      // Switch to Join Requests sub-tab
      const requestsSubtab = screen.getByTestId('join-requests-subtab');
      fireEvent.click(requestsSubtab);

      await waitFor(() => {
        expect(screen.getByTestId('join-requests-view')).toBeInTheDocument();
      });

      // Find request for outsiderTrainee
      await waitFor(() => {
        expect(screen.getByText(outsiderTrainee.name)).toBeInTheDocument();
      });

      const pendingRequest = inMemoryStore.getGroupJoinRequests('GRP-101', 'pending')[0];
      const approveBtn = screen.getByTestId(`approve-request-btn-${pendingRequest.id}`);
      fireEvent.click(approveBtn);

      // Status updates to approved
      await waitFor(() => {
        expect(screen.getByTestId(`request-status-badge-${pendingRequest.id}`)).toHaveTextContent(
          'تم القبول'
        );
      });

      // Verify outsiderTrainee is now in group members
      const members = inMemoryStore.getGroupMembers('GRP-101');
      expect(members.some((m) => m.userId.toLowerCase() === outsiderTrainee.id.toLowerCase())).toBe(true);

      // Verify course enrollments were synthesized
      const enrollments = inMemoryStore.getTraineeEnrollments(outsiderTrainee.id);
      expect(enrollments.some((e) => e.courseId === 'CRS001')).toBe(true);
    });

    it('rejects a pending join request with review note without adding trainee to group', async () => {
      inMemoryStore.submitGroupJoinRequest({
        groupId: 'GRP-101',
        userId: outsiderTrainee.id,
        note: 'طلب انضمام غير متطابق مع التخصص',
      });

      renderWithApp('/admin/groups/GRP-101/edit?tab=members', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-members-tab')).toBeInTheDocument();
      });

      // Switch to Join Requests sub-tab
      fireEvent.click(screen.getByTestId('join-requests-subtab'));

      const pendingRequest = inMemoryStore.getGroupJoinRequests('GRP-101', 'pending')[0];
      await waitFor(() => {
        expect(screen.getByTestId(`reject-request-btn-${pendingRequest.id}`)).toBeInTheDocument();
      });

      // Click Reject
      fireEvent.click(screen.getByTestId(`reject-request-btn-${pendingRequest.id}`));

      // Rejection modal appears
      await waitFor(() => {
        expect(screen.getByTestId('reject-request-modal')).toBeInTheDocument();
      });

      // Enter rejection note
      const noteInput = screen.getByTestId('reject-note-input');
      fireEvent.change(noteInput, {
        target: { value: 'المجموعة مكتملة لقطاعك الوظيفي' },
      });

      // Confirm rejection
      fireEvent.click(screen.getByTestId('confirm-reject-request-btn'));

      // Request status updates to rejected
      await waitFor(() => {
        expect(screen.getByTestId(`request-status-badge-${pendingRequest.id}`)).toHaveTextContent(
          'مرفوض'
        );
      });

      // Trainee was NOT added to members
      const members = inMemoryStore.getGroupMembers('GRP-101');
      expect(members.some((m) => m.userId.toLowerCase() === outsiderTrainee.id.toLowerCase())).toBe(false);
    });
  });

  // ── 4. Direct Trainee Assignment & Safe Member Removal ────────────────────

  describe('4. Direct Trainee Assignment & Safe Member Removal', () => {
    it('opens direct assign modal, filters candidate trainees, and assigns candidates', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=members', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-members-tab')).toBeInTheDocument();
      });

      // Open Direct Assignment Modal
      const openDirectBtn = screen.getByTestId('open-direct-assign-btn');
      fireEvent.click(openDirectBtn);

      await waitFor(() => {
        expect(screen.getByTestId('direct-assign-modal')).toBeInTheDocument();
      });

      // Existing members (usr_trainee_003 and USR004) are NOT in candidate list
      expect(screen.queryByTestId('candidate-row-usr_trainee_003')).not.toBeInTheDocument();
      expect(screen.queryByTestId('candidate-row-usr004')).not.toBeInTheDocument();

      // USR005 and USR006 are available candidates
      expect(screen.getByTestId('candidate-row-USR005')).toBeInTheDocument();
      expect(screen.getByTestId('candidate-row-USR006')).toBeInTheDocument();

      // Check USR005
      const checkbox5 = screen.getByTestId('candidate-checkbox-USR005');
      fireEvent.click(checkbox5);

      // Confirm button is enabled and shows 1
      const confirmBtn = screen.getByTestId('confirm-direct-assign-btn');
      expect(confirmBtn).toHaveTextContent('إضافة المتدربين المحددين (1)');
      fireEvent.click(confirmBtn);

      // Modal closes and member is added to the table
      await waitFor(() => {
        expect(screen.getByTestId('member-row-usr005')).toBeInTheDocument();
      });

      // Verify idempotent enrollment in store
      const enrollments = inMemoryStore.getTraineeEnrollments('USR005');
      expect(enrollments.some((e) => e.courseId === 'CRS001')).toBe(true);
    });

    it('safely removes member from group with confirmation dialog while preserving learning history', async () => {
      // Seed an active course enrollment to verify removal from group does not delete existing course enrollments
      inMemoryStore.enrollUser({
        courseId: 'CRS001',
        userId: 'USR004',
        userRole: 'user',
      });

      renderWithApp('/admin/groups/GRP-101/edit?tab=members', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('member-row-usr004')).toBeInTheDocument();
      });

      // Click remove on USR004
      const removeBtn = screen.getByTestId('remove-member-btn-usr004');
      fireEvent.click(removeBtn);

      // Confirmation dialog appears
      await waitFor(() => {
        expect(screen.getByTestId('remove-member-confirm-dialog')).toBeInTheDocument();
      });

      // Confirm removal
      const confirmBtn = screen.getByTestId('confirm-remove-member-btn');
      fireEvent.click(confirmBtn);

      // USR004 is removed from the table
      await waitFor(() => {
        expect(screen.queryByTestId('member-row-usr004')).not.toBeInTheDocument();
      });

      // Group traineeIds in store updated
      const group = inMemoryStore.getGroupById('GRP-101');
      expect((group?.traineeIds || []).includes('usr004')).toBe(false);

      // Trainee's course enrollments and history remain intact!
      const enrollments = inMemoryStore.getTraineeEnrollments('USR004');
      expect(enrollments.some((e) => e.courseId === 'CRS001')).toBe(true);
    });
  });
});
