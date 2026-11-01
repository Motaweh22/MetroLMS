import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AppRouter } from '@/app/router';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type { User } from '@/core/auth/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset({ seedReviewDemo: false });
});
afterAll(() => server.close());

const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
const supervisorUser = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;
const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;

function renderWithApp(initialRoute: string, user: User = adminUser) {
  authStorage.setSession({
    token: `mock_jwt_${user.id}_test`,
    user,
    expiresAt: Date.now() + 3600000,
  });

  return render(<AppRouter initialEntries={[initialRoute]} />);
}

describe('Increment 10 — Phase 4: Training Groups Management UI', () => {
  // ── 1. Groups Overview (/admin/groups) Loading & Metrics ─────────────

  describe('1. Groups Overview Loading, Metrics & Empty States', () => {
    it('loads and displays group summaries, table columns, and aggregate metrics for administrator', async () => {
      renderWithApp('/admin/groups', adminUser);

      // Wait for table to render
      await waitFor(() => {
        expect(screen.getByTestId('admin-groups-page')).toBeInTheDocument();
      });

      expect(screen.getByText('إدارة المجموعات التدريبية')).toBeInTheDocument();
      expect(screen.getByTestId('create-group-btn')).toBeInTheDocument();

      // Verify groups table contains seeded cohorts
      await waitFor(() => {
        expect(screen.getByTestId('group-row-GRP-101')).toBeInTheDocument();
        expect(screen.getByTestId('group-row-GRP-102')).toBeInTheDocument();
        expect(screen.getByTestId('group-row-GRP-103')).toBeInTheDocument();
      });

      expect(screen.getByText(/الخط الثاني/i)).toBeInTheDocument();
      expect(screen.getAllByText(/الدورة 1/i).length).toBeGreaterThanOrEqual(1);

      // Verify aggregate metrics cards
      expect(screen.getByText('إجمالي المجموعات')).toBeInTheDocument();
      expect(screen.getByText('دفعات نشطة')).toBeInTheDocument();
      expect(screen.getByText('إجمالي المتدربين')).toBeInTheDocument();
      expect(screen.getByText('تنبيهات المتابعة')).toBeInTheDocument();
    });

    it('renders empty state when no search matches are found', async () => {
      renderWithApp('/admin/groups', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('admin-groups-table')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('admin-groups-search');
      fireEvent.change(searchInput, { target: { value: 'اسم لا وجود له إطلاقاً' } });

      await waitFor(() => {
        expect(screen.getByTestId('admin-groups-empty')).toBeInTheDocument();
        expect(screen.getByText(/لم يتم العثور على مجموعات تدريبية/i)).toBeInTheDocument();
      });
    });

    it('blocks trainees from accessing administrator overview with 403 alert screen', async () => {
      renderWithApp('/admin/groups', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('admin-groups-unauthorized')).toBeInTheDocument();
        expect(screen.getByText('غير مصرح بالوصول')).toBeInTheDocument();
      });
    });

    it('allows supervisors to view their assigned groups without create/archive actions', async () => {
      renderWithApp('/admin/groups', supervisorUser);

      await waitFor(() => {
        expect(screen.getByTestId('admin-groups-page')).toBeInTheDocument();
      });

      // Supervisor sees their assigned group
      expect(screen.getByTestId('group-row-GRP-101')).toBeInTheDocument();

      // Supervisor cannot create or archive groups
      expect(screen.queryByTestId('create-group-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('archive-group-btn-GRP-101')).not.toBeInTheDocument();
    });
  });

  // ── 2. Search and Lifecycle Filtering ────────────────────────────────

  describe('2. Search & Lifecycle Filtering Controls', () => {
    it('filters groups table by search keyword', async () => {
      renderWithApp('/admin/groups', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-row-GRP-101')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('admin-groups-search');
      fireEvent.change(searchInput, { target: { value: 'SCADA' } });

      await waitFor(() => {
        // GRP-102 mentions SCADA
        expect(screen.getByTestId('group-row-GRP-102')).toBeInTheDocument();
        expect(screen.queryByTestId('group-row-GRP-101')).not.toBeInTheDocument();
      });
    });

    it('filters groups by lifecycle status pills', async () => {
      renderWithApp('/admin/groups', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-row-GRP-101')).toBeInTheDocument();
        expect(screen.getByTestId('group-row-GRP-103')).toBeInTheDocument();
      });

      // Filter by 'expired' (منتهية) — GRP-103 has deadline in mid-October 2026
      const expiredFilter = screen.getByTestId('status-filter-expired');
      fireEvent.click(expiredFilter);

      await waitFor(() => {
        expect(screen.getByTestId('group-row-GRP-103')).toBeInTheDocument();
        expect(screen.queryByTestId('group-row-GRP-101')).not.toBeInTheDocument();
        expect(screen.queryByTestId('group-row-GRP-102')).not.toBeInTheDocument();
      });

      // Filter by 'all' returns all
      const allFilter = screen.getByTestId('status-filter-all');
      fireEvent.click(allFilter);

      await waitFor(() => {
        expect(screen.getByTestId('group-row-GRP-101')).toBeInTheDocument();
        expect(screen.getByTestId('group-row-GRP-102')).toBeInTheDocument();
        expect(screen.getByTestId('group-row-GRP-103')).toBeInTheDocument();
      });
    });
  });

  // ── 3. Safe Archival Workflow & ConfirmDialog ─────────────────────────

  describe('3. Group Safe Archival Flow with Confirmation', () => {
    it('cancels archival confirmation without mutating data', async () => {
      renderWithApp('/admin/groups', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('archive-group-btn-GRP-101')).toBeInTheDocument();
      });

      // Click archive on GRP-101
      fireEvent.click(screen.getByTestId('archive-group-btn-GRP-101'));

      // Confirm dialog opens
      await waitFor(() => {
        expect(screen.getByTestId('archive-confirm-dialog')).toBeInTheDocument();
        expect(screen.getByText('تأكيد أرشفة المجموعة التدريبية')).toBeInTheDocument();
      });

      // Cancel button
      fireEvent.click(screen.getByTestId('cancel-archive-btn'));

      // Dialog closes
      await waitFor(() => {
        expect(screen.queryByTestId('archive-confirm-dialog')).not.toBeInTheDocument();
      });

      // Group GRP-101 remains in table and active
      expect(screen.getByTestId('group-row-GRP-101')).toBeInTheDocument();
      const groupInStore = inMemoryStore.getGroupById('GRP-101');
      expect(groupInStore?.adminStatus).toBe('active');
    });

    it('executes safe archival on confirm preserving historical data and updating UI', async () => {
      renderWithApp('/admin/groups', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('archive-group-btn-GRP-101')).toBeInTheDocument();
      });

      // Click archive
      fireEvent.click(screen.getByTestId('archive-group-btn-GRP-101'));

      await waitFor(() => {
        expect(screen.getByTestId('confirm-archive-btn')).toBeInTheDocument();
      });

      // Confirm archive
      fireEvent.click(screen.getByTestId('confirm-archive-btn'));

      // Modal closes and status changes
      await waitFor(() => {
        expect(screen.queryByTestId('archive-confirm-dialog')).not.toBeInTheDocument();
      });

      // Verify store safely archived group
      const groupInStore = inMemoryStore.getGroupById('GRP-101');
      expect(groupInStore?.adminStatus).toBe('archived');
      expect(groupInStore?.isEnrollmentOpen).toBe(false);

      // Verify archive button is removed for archived group
      await waitFor(() => {
        expect(screen.queryByTestId('archive-group-btn-GRP-101')).not.toBeInTheDocument();
      });
    });
  });

  // ── 4. Create Group Form (/admin/groups/new) ──────────────────────────

  describe('4. Create Group Form Validation & Submission', () => {
    it('renders create group workspace with all configuration sections', async () => {
      renderWithApp('/admin/groups/new', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-editor-page')).toBeInTheDocument();
      });

      expect(screen.getByText('إنشاء مجموعة تدريبية جديدة')).toBeInTheDocument();
      expect(screen.getByTestId('group-name-input')).toBeInTheDocument();
      expect(screen.getByTestId('group-desc-input')).toBeInTheDocument();
      expect(screen.getByTestId('save-group-btn')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-group-btn')).toBeInTheDocument();

      // Navigate to schedule tab to verify timings and renewal configuration
      fireEvent.click(screen.getByTestId('tab-schedule'));

      await waitFor(() => {
        expect(screen.getByTestId('group-start-input')).toBeInTheDocument();
        expect(screen.getByTestId('group-deadline-input')).toBeInTheDocument();
      });
    });

    it('validates mandatory fields and displays Arabic error messages', async () => {
      renderWithApp('/admin/groups/new', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('save-group-btn')).toBeInTheDocument();
      });

      // Clear name and description
      const nameInput = screen.getByTestId('group-name-input');
      const descInput = screen.getByTestId('group-desc-input');
      fireEvent.change(nameInput, { target: { value: '' } });
      fireEvent.change(descInput, { target: { value: '' } });

      // Click save
      fireEvent.click(screen.getByTestId('save-group-btn'));

      // Validation errors appear
      await waitFor(() => {
        expect(screen.getByText('اسم المجموعة التدريبية مطلوب')).toBeInTheDocument();
        expect(screen.getByText('وصف المجموعة التدريبية مطلوب')).toBeInTheDocument();
      });
    });

    it('validates invalid date ranges where deadline precedes start date', async () => {
      renderWithApp('/admin/groups/new', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('save-group-btn')).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('group-name-input');
      const descInput = screen.getByTestId('group-desc-input');

      fireEvent.change(nameInput, { target: { value: 'مجموعة تواريخ مقلوبة' } });
      fireEvent.change(descInput, { target: { value: 'وصف المجموعة التدريبية للاختبار' } });

      // Navigate to schedule tab to configure start and deadline dates
      fireEvent.click(screen.getByTestId('tab-schedule'));

      await waitFor(() => {
        expect(screen.getByTestId('group-start-input')).toBeInTheDocument();
      });

      const startInput = screen.getByTestId('group-start-input');
      const deadlineInput = screen.getByTestId('group-deadline-input');

      fireEvent.change(startInput, { target: { value: '2026-12-01T08:00' } });
      fireEvent.change(deadlineInput, { target: { value: '2026-11-01T08:00' } }); // deadline before start!

      fireEvent.click(screen.getByTestId('save-group-btn'));

      await waitFor(() => {
        expect(
          screen.getByText('الموعد النهائي يجب أن يكون لاحقاً لتاريخ البداية')
        ).toBeInTheDocument();
      });
    });

    it('submits valid group creation, uses returned ID, and navigates to edit page', async () => {
      renderWithApp('/admin/groups/new', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('save-group-btn')).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('group-name-input');
      const descInput = screen.getByTestId('group-desc-input');

      fireEvent.change(nameInput, {
        target: { value: 'برنامج دبلوم التحكم المركزي بالخط الثالث' },
      });
      fireEvent.change(descInput, {
        target: { value: 'برنامج تدريبي متخصص لمهندسي وفنيي محطات الخط الثالث' },
      });

      // Navigate to schedule tab to set custom dates
      fireEvent.click(screen.getByTestId('tab-schedule'));

      await waitFor(() => {
        expect(screen.getByTestId('group-start-input')).toBeInTheDocument();
      });

      const startInput = screen.getByTestId('group-start-input');
      const deadlineInput = screen.getByTestId('group-deadline-input');

      fireEvent.change(startInput, { target: { value: '2026-11-10T08:00' } });
      fireEvent.change(deadlineInput, { target: { value: '2026-12-25T18:00' } });

      fireEvent.click(screen.getByTestId('save-group-btn'));

      // Successfully navigates to newly created group's edit page
      await waitFor(() => {
        expect(
          screen.getByText(/تعديل: برنامج دبلوم التحكم المركزي بالخط الثالث/i)
        ).toBeInTheDocument();
      });

      // Verify group exists in store
      const allGroups = inMemoryStore.getGroups();
      const created = allGroups.find(
        (g) => g.name === 'برنامج دبلوم التحكم المركزي بالخط الثالث'
      );
      expect(created).toBeDefined();
      expect(created?.adminStatus).toBe('active');
    });
  });

  // ── 5. Edit Group Form (/admin/groups/:groupId/edit) ─────────────────

  describe('5. Edit Group Form & Configuration Updates', () => {
    it('loads existing group configuration and displays workspace tabs', async () => {
      renderWithApp('/admin/groups/GRP-101/edit', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-editor-page')).toBeInTheDocument();
      });

      expect(screen.getByText(/تعديل:/i)).toBeInTheDocument();
      expect(screen.getByText('GRP-101')).toBeInTheDocument();

      // Verify tabs exist
      expect(screen.getByTestId('tab-general-settings')).toBeInTheDocument();
      expect(screen.getByText('المقررات التدريبية')).toBeInTheDocument();
      expect(screen.getByText('المتدربون ورمز QR')).toBeInTheDocument();

      // Verify fields are populated from store
      const nameInput = screen.getByTestId('group-name-input') as HTMLInputElement;
      expect(nameInput.value).toContain('الخط الثاني');
    });

    it('updates group metadata and capacity, and reflects server state', async () => {
      renderWithApp('/admin/groups/GRP-101/edit', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('save-group-btn')).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('group-name-input');

      fireEvent.change(nameInput, {
        target: { value: 'اسم المجموعة المحدث للاختبار' },
      });

      // Save name changes on general tab
      fireEvent.click(screen.getByTestId('save-group-btn'));

      // Wait for save completion
      await waitFor(() => {
        expect(screen.getByText(/تعديل: اسم المجموعة المحدث للاختبار/i)).toBeInTheDocument();
      });

      // Navigate to members & QR tab to update capacity via QR modal
      fireEvent.click(screen.getByTestId('tab-members'));

      await waitFor(() => {
        expect(screen.getByTestId('open-qr-modal-btn')).toBeInTheDocument();
      });

      // Open QR & enrollment settings modal
      fireEvent.click(screen.getByTestId('open-qr-modal-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('group-capacity-input')).toBeInTheDocument();
      });

      const capacityInput = screen.getByTestId('group-capacity-input');
      fireEvent.change(capacityInput, { target: { value: '45' } });

      // Save capacity settings in modal
      fireEvent.click(screen.getByTestId('save-qr-settings-btn'));

      // Verify store updated with both name and capacity
      await waitFor(() => {
        const grp = inMemoryStore.getGroupById('GRP-101');
        expect(grp?.maxTrainees).toBe(45);
      });

      const grp = inMemoryStore.getGroupById('GRP-101');
      expect(grp?.name).toBe('اسم المجموعة المحدث للاختبار');
    });

    it('renders 404 alert state when group ID is unknown and provides back button', async () => {
      renderWithApp('/admin/groups/NON-EXISTENT-GRP/edit', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-not-found')).toBeInTheDocument();
        expect(screen.getByText('المجموعة التدريبية غير موجودة')).toBeInTheDocument();
        expect(screen.getByTestId('back-to-groups-btn')).toBeInTheDocument();
      });

      // Click back to groups button
      fireEvent.click(screen.getByTestId('back-to-groups-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('admin-groups-page')).toBeInTheDocument();
      });
    });
  });

  // ── 6. Role-Adaptive Redirects & Aliases ─────────────────────────────

  describe('6. Canonical Redirects & Role-Adaptive Routing', () => {
    it('redirects administrator visiting /groups to /admin/groups', async () => {
      renderWithApp('/groups', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('admin-groups-page')).toBeInTheDocument();
      });
    });

    it('redirects /admin/create-group alias to /admin/groups/new', async () => {
      renderWithApp('/admin/create-group', adminUser);

      await waitFor(() => {
        expect(screen.getByText('إنشاء مجموعة تدريبية جديدة')).toBeInTheDocument();
      });
    });
  });
});
