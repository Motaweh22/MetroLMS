import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AppRouter } from '@/app/router';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type { User } from '@/core/auth/types';
import { clearMaterialBlobs } from '@/features/groups/utils/materialUtils';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  clearMaterialBlobs();
  inMemoryStore.reset({ seedReviewDemo: false });
});

afterAll(() => server.close());

const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;

function renderWithApp(initialRoute: string, user: User = adminUser) {
  authStorage.setSession({
    token: `mock_jwt_${user.id}_test`,
    user,
    expiresAt: Date.now() + 3600000,
  });

  return render(<AppRouter initialEntries={[initialRoute]} />);
}

describe('Focused UI/UX Corrections After Increment 10', () => {
  // ── 1. Group Materials Library — Explorer-Style Folder Browser ────────────

  describe('1. Explorer-Style Folder Browser & Sorting', () => {
    it('displays root-level folders with metadata, folders before files by default, and clickable sort headers', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=materials', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-materials-tab')).toBeInTheDocument();
      });

      // Explorer container & root folders view are rendered
      expect(screen.getByTestId('explorer-browser-container')).toBeInTheDocument();
      expect(screen.getByTestId('materials-folders-view')).toBeInTheDocument();

      // Seeded folders are present in root view
      expect(screen.getByTestId('folder-card-FLD-GRP-101-01')).toBeInTheDocument();
      expect(screen.getByTestId('folder-card-FLD-GRP-101-02')).toBeInTheDocument();

      // Clickable sorting headers are present
      expect(screen.getByTestId('sort-header-name')).toBeInTheDocument();
      expect(screen.getByTestId('sort-header-date')).toBeInTheDocument();
      expect(screen.getByTestId('sort-header-type')).toBeInTheDocument();
      expect(screen.getByTestId('sort-header-size')).toBeInTheDocument();

      // Initial active sort indicator on Name (asc)
      expect(screen.getByTestId('sort-indicator-name')).toHaveTextContent('▲');

      // Click Name sort header to toggle to descending (desc)
      fireEvent.click(screen.getByTestId('sort-header-name'));
      expect(screen.getByTestId('sort-indicator-name')).toHaveTextContent('▼');

      // Click Date sort header to switch to date sorting
      fireEvent.click(screen.getByTestId('sort-header-date'));
      expect(screen.getByTestId('sort-indicator-date')).toHaveTextContent('▲');
    });

    it('navigates into folder, shows subfolders/files, and navigates back via breadcrumbs & back button', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=materials', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('folder-card-FLD-GRP-101-01')).toBeInTheDocument();
      });

      // Open Folder 1
      fireEvent.click(screen.getByTestId('open-folder-btn-FLD-GRP-101-01'));

      // Displays inside files view with breadcrumbs
      await waitFor(() => {
        expect(screen.getByTestId('materials-files-view')).toBeInTheDocument();
        expect(screen.getByTestId('breadcrumb-folder')).toHaveTextContent('دليل التدريب واللوائح المعتمدة');
      });

      // Files inside Folder 1 are listed
      expect(screen.getByTestId('file-card-FIL-GRP-101-001')).toBeInTheDocument();
      expect(screen.getByTestId('file-card-FIL-GRP-101-002')).toBeInTheDocument();

      // Sort files inside folder
      fireEvent.click(screen.getByTestId('sort-header-size'));
      expect(screen.getByTestId('sort-indicator-size')).toHaveTextContent('▲');

      // Back button navigates back to root
      expect(screen.getByTestId('back-to-folders-btn')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('back-to-folders-btn'));

      // Root view restored
      await waitFor(() => {
        expect(screen.getByTestId('materials-folders-view')).toBeInTheDocument();
      });
    });

    it('creates nested folder with active folder as parentId destination', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=materials', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('folder-card-FLD-GRP-101-01')).toBeInTheDocument();
      });

      // Open Folder 1
      fireEvent.click(screen.getByTestId('open-folder-btn-FLD-GRP-101-01'));

      await waitFor(() => {
        expect(screen.getByTestId('materials-files-view')).toBeInTheDocument();
      });

      // Click create subfolder button inside folder
      fireEvent.click(screen.getByTestId('open-create-folder-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('group-folder-modal')).toBeInTheDocument();
      });

      // Enter subfolder name
      fireEvent.change(screen.getByTestId('folder-name-input'), {
        target: { value: 'تعليمات السلامة الكهربائية للقطار' },
      });
      fireEvent.click(screen.getByTestId('submit-folder-btn'));

      // Verify subfolder was created in store with parentId matching folder 1
      await waitFor(() => {
        const materials = inMemoryStore.getGroupMaterials('GRP-101');
        const created = materials.folders.find((f) => f.name === 'تعليمات السلامة الكهربائية للقطار');
        expect(created).toBeDefined();
        expect(created?.parentId).toBe('FLD-GRP-101-01');
      });
    });

    it('enforces trainee read-only restrictions without create/upload/delete controls', async () => {
      renderWithApp('/my-groups/GRP-101', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('trainee-group-materials-section')).toBeInTheDocument();
      });

      // Read-only trainee materials browser is rendered
      await waitFor(() => {
        expect(screen.getByTestId('explorer-browser-container')).toBeInTheDocument();
      });

      // Trainee cannot see admin buttons
      expect(screen.queryByTestId('open-create-folder-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('open-upload-files-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('edit-folder-btn-FLD-GRP-101-01')).not.toBeInTheDocument();
      expect(screen.queryByTestId('delete-folder-btn-FLD-GRP-101-01')).not.toBeInTheDocument();
    });
  });

  // ── 2. Group Attachments & Interactive Meetings Visibility ────────────────

  describe('2. Group Attachments and Interactive Meetings Visibility', () => {
    it('renders distinct visible sections for Attachments and Meetings in GroupDetailPage', async () => {
      renderWithApp('/my-groups/GRP-101', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-detail-page')).toBeInTheDocument();
      });

      // Both distinct sections are rendered
      expect(screen.getByTestId('group-attachments-section')).toBeInTheDocument();
      expect(screen.getByTestId('group-meetings-section')).toBeInTheDocument();

      // Heading category is visible
      expect(screen.getByText('المواد المرفقة واللقاءات التفاعلية')).toBeInTheDocument();

      // Distinct section titles are visible
      expect(screen.getByText('المواد المرفقة')).toBeInTheDocument();
      expect(screen.getByText('اللقاءات التفاعلية')).toBeInTheDocument();

      // Seeded items rendered with appropriate buttons (RES-101-2 is PDF, RES-101-1 is Teams)
      expect(screen.getByTestId('attachment-card-RES-101-2')).toBeInTheDocument();
      expect(screen.getByTestId('meeting-card-RES-101-1')).toBeInTheDocument();
      expect(screen.getByTestId('join-meeting-btn-RES-101-1')).toBeInTheDocument();
    });

    it('renders empty states gracefully without hiding either section when resources are empty', async () => {
      // Clear resources on GRP-101
      const group = inMemoryStore.getGroupById('GRP-101');
      if (group) group.resources = [];

      renderWithApp('/my-groups/GRP-101', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-detail-page')).toBeInTheDocument();
      });

      // Both sections still exist with clear empty state cards
      expect(screen.getByTestId('group-attachments-section')).toBeInTheDocument();
      expect(screen.getByTestId('attachments-empty-state')).toHaveTextContent(
        'لا توجد مواد تدريبية أو ملفات مرفقة بهذه المجموعة حالياً.'
      );

      expect(screen.getByTestId('group-meetings-section')).toBeInTheDocument();
      expect(screen.getByTestId('meetings-empty-state')).toHaveTextContent(
        'لا توجد لقاءات تفاعلية مجدولة لهذه المجموعة حالياً.'
      );
    });

    it('provides unified interactive meetings and attachments tab in GroupEditorPage with meetings first', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=meetings', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-meetings-and-attachments-tab')).toBeInTheDocument();
      });

      // Unified tab title is displayed
      expect(screen.getByTestId('tab-meetings')).toHaveTextContent(
        'اللقاءات التفاعلية والمواد المرفقة'
      );

      // Both sections are rendered inside the unified tab
      const meetingsSection = screen.getByTestId('group-meetings-tab');
      const attachmentsSection = screen.getByTestId('group-attachments-tab');
      expect(meetingsSection).toBeInTheDocument();
      expect(attachmentsSection).toBeInTheDocument();

      // Section 1 (Interactive Meetings) appears before Section 2 (Attached Materials) in DOM order
      expect(
        meetingsSection.compareDocumentPosition(attachmentsSection) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();

      expect(screen.getByText('اللقاءات التفاعلية (Microsoft Teams)')).toBeInTheDocument();
      expect(screen.getByTestId('open-add-meeting-btn')).toBeInTheDocument();

      expect(screen.getByText('المواد المرفقة والوثائق التدريبية')).toBeInTheDocument();
      expect(screen.getByTestId('open-add-attachment-btn')).toBeInTheDocument();
    });
  });

  // ── 3. Unified Group-Creation & Editing Experience ────────────────────────

  describe('3. Unified Group-Creation and Editing Experience', () => {
    it('shows all 6 tabs simultaneously in new group creation mode (/admin/groups/new)', async () => {
      renderWithApp('/admin/groups/new', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-editor-page')).toBeInTheDocument();
      });

      // All 6 tabs visible (including unified meetings & attachments tab)
      expect(screen.getByTestId('tab-general-settings')).toBeInTheDocument();
      expect(screen.getByTestId('tab-schedule')).toBeInTheDocument();
      expect(screen.getByTestId('tab-courses')).toBeInTheDocument();
      expect(screen.getByTestId('tab-members')).toBeInTheDocument();
      expect(screen.getByTestId('tab-materials')).toBeInTheDocument();
      expect(screen.getByTestId('tab-meetings')).toHaveTextContent(
        'اللقاءات التفاعلية والمواد المرفقة'
      );
      expect(screen.queryByTestId('tab-attachments')).not.toBeInTheDocument();
    });

    it('preserves entered form state when switching tabs before creation and shows dependency notice', async () => {
      renderWithApp('/admin/groups/new', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-editor-page')).toBeInTheDocument();
      });

      // Enter basic information in general tab
      const nameInput = screen.getByTestId('group-name-input');
      fireEvent.change(nameInput, { target: { value: 'مجموعة المترو الموحدة الجديدة' } });

      // Switch to courses tab before saving
      fireEvent.click(screen.getByTestId('tab-courses'));

      // Dependency notice card is displayed
      await waitFor(() => {
        expect(screen.getByTestId('tab-dependency-notice')).toBeInTheDocument();
      });
      expect(screen.getByText('تتطلب هذه الخاصية حفظ المجموعة أولاً')).toBeInTheDocument();

      // Switch back to general settings tab
      fireEvent.click(screen.getByTestId('return-to-general-tab-btn'));

      // Entered value is preserved without loss!
      expect(screen.getByTestId('group-name-input')).toHaveValue(
        'مجموعة المترو الموحدة الجديدة'
      );
    });

    it('saves new group and stays in the same unified workspace experience', async () => {
      renderWithApp('/admin/groups/new', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-editor-page')).toBeInTheDocument();
      });

      // Fill valid required fields
      fireEvent.change(screen.getByTestId('group-name-input'), {
        target: { value: 'مجموعة الصيانة الوقائية — الدفعة 45' },
      });
      fireEvent.change(screen.getByTestId('group-desc-input'), {
        target: { value: 'برنامج صيانة المسارات والشبكات الكهربائية للمترو' },
      });

      // Save group
      fireEvent.click(screen.getByTestId('save-group-btn'));

      // Group is created and stays in the same editor experience
      await waitFor(() => {
        expect(screen.getByText(/تعديل: مجموعة الصيانة الوقائية — الدفعة 45/)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Other tabs now available without dependency cards
      await waitFor(() => {
        expect(screen.getByTestId('tab-materials')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('tab-materials'));

      await waitFor(() => {
        expect(screen.getByTestId('group-materials-tab')).toBeInTheDocument();
        expect(screen.queryByTestId('tab-dependency-notice')).not.toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('keeps main save button on general and schedule tabs only, navigates to the tab owning validation errors, and isolates QR modal staged changes from unsaved main-form edits', async () => {
      renderWithApp('/admin/groups/GRP-101/edit', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-editor-page')).toBeInTheDocument();
        expect(screen.getByTestId('save-group-btn')).toBeInTheDocument();
      });

      const originalName = inMemoryStore.getGroupById('GRP-101')!.name;
      const originalMaxTrainees = inMemoryStore.getGroupById('GRP-101')!.maxTrainees ?? null;

      // 1. Edit group name on General tab WITHOUT clicking save-group-btn
      fireEvent.change(screen.getByTestId('group-name-input'), {
        target: { value: 'اسم معدل غير محفوظ بعد' },
      });

      // 2. Switch to Schedule tab -> save-group-btn remains visible
      fireEvent.click(screen.getByTestId('tab-schedule'));
      await waitFor(() => {
        expect(screen.getByTestId('group-start-input')).toBeInTheDocument();
        expect(screen.getByTestId('save-group-btn')).toBeInTheDocument();
      });

      // 3. Switch to Members & QR tab -> main form save-group-btn is hidden on self-persisting tabs
      fireEvent.click(screen.getByTestId('tab-members'));
      await waitFor(() => {
        expect(screen.getByTestId('open-qr-modal-btn')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('save-group-btn')).not.toBeInTheDocument();

      // 4. Open QR Modal, stage changes (toggle enrollment & change capacity), then Cancel -> discarded!
      fireEvent.click(screen.getByTestId('open-qr-modal-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('group-qr-modal')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('group-capacity-input'), {
        target: { value: '99' },
      });
      fireEvent.click(screen.getByTestId('enrollment-open-toggle'));

      // Store is NOT mutated while staged in modal
      expect(inMemoryStore.getGroupById('GRP-101')!.maxTrainees ?? null).toBe(originalMaxTrainees);
      expect(inMemoryStore.getGroupById('GRP-101')!.isEnrollmentOpen).toBe(true);

      // Cancel / close modal
      fireEvent.click(screen.getByTestId('close-qr-modal-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('group-qr-modal')).not.toBeInTheDocument();
      });

      // Reopen modal -> reflects last saved server state, not discarded staged values
      fireEvent.click(screen.getByTestId('open-qr-modal-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('group-capacity-input')).toHaveValue(
          originalMaxTrainees ? String(originalMaxTrainees) : null
        );
      });

      // Now stage capacity = 60 and explicitly Save QR settings
      fireEvent.change(screen.getByTestId('group-capacity-input'), {
        target: { value: '60' },
      });
      fireEvent.click(screen.getByTestId('save-qr-settings-btn'));

      await waitFor(() => {
        expect(inMemoryStore.getGroupById('GRP-101')!.maxTrainees).toBe(60);
      });

      // Critical invariant: saving QR settings must NOT persist the unsaved main-form group name!
      expect(inMemoryStore.getGroupById('GRP-101')!.name).toBe(originalName);

      // And switching back to General tab preserves the user's unsaved main-form draft input!
      fireEvent.click(screen.getByTestId('tab-general-settings'));
      await waitFor(() => {
        expect(screen.getByTestId('group-name-input')).toHaveValue('اسم معدل غير محفوظ بعد');
      });

      // 5. Trigger a Schedule validation error while on General tab -> automatically navigates to Schedule tab
      fireEvent.click(screen.getByTestId('tab-schedule'));
      await waitFor(() => {
        expect(screen.getByTestId('auto-renewal-toggle')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('auto-renewal-toggle'));
      fireEvent.change(screen.getByTestId('renewal-interval-days-input'), {
        target: { value: '' },
      });

      // Switch back to General tab and click Save
      fireEvent.click(screen.getByTestId('tab-general-settings'));
      fireEvent.click(screen.getByTestId('save-group-btn'));

      // Editor switches to Schedule tab where the renewal interval error is displayed
      await waitFor(() => {
        expect(screen.getByTestId('renewal-interval-error')).toBeInTheDocument();
      });
    });
  });

  // ── 4. Group Instructor Assignment & Trainee WhatsApp Modal ───────────────

  describe('4. Group Instructor Assignment, Permissions & Trainee WhatsApp Modal', () => {
    it('enforces primary and assistant lecturer permissions and renders the trainee مشرفين المجموعة modal with safe WhatsApp links', async () => {
      // Set USR017 phone to empty to test missing/invalid phone handling alongside usr_lect_002 (valid phone)
      const usr017 = inMemoryStore.getManagedUserById('USR017');
      if (usr017) usr017.phone = '';

      inMemoryStore.updateGroup('GRP-101', {
        primaryInstructorId: 'usr_lect_002',
        assistantLecturerIds: ['USR017'],
      });

      // Assistant lecturer (USR017) can view GRP-101 but cannot modify assistant lecturers
      expect(inMemoryStore.getGroupById('GRP-101', 'USR017', 'lecturer')).not.toBeNull();
      expect(() =>
        inMemoryStore.updateGroupAssistants('GRP-101', ['USR002'], {
          id: 'USR017',
          role: 'lecturer',
        })
      ).toThrowError(/تقتصر هذه الصلاحية على مدير النظام أو المحاضر الأساسي/);

      // Unassigned lecturer (USR002) cannot view GRP-101 (rejected with 403)
      expect(() => inMemoryStore.getGroupById('GRP-101', 'USR002', 'lecturer')).toThrowError(
        /غير مصرح لك باستعراض بيانات هذه المجموعة/
      );

      // Render GroupDetailPage as enrolled trainee (usr_trainee_003)
      renderWithApp('/my-groups/GRP-101', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-detail-page')).toBeInTheDocument();
      });

      // Verify side-by-side grid has Interactive Meetings first and Attached Materials second
      const meetingsSec = screen.getByTestId('group-meetings-section');
      const attachmentsSec = screen.getByTestId('group-attachments-section');
      expect(
        meetingsSec.compareDocumentPosition(attachmentsSec) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();

      // Click "مشرفين المجموعة" button in the group header
      const instructorsBtn = screen.getByTestId('open-group-instructors-modal-btn');
      expect(instructorsBtn).toHaveTextContent('مشرفين المجموعة');
      fireEvent.click(instructorsBtn);

      await waitFor(() => {
        expect(screen.getByTestId('group-instructors-modal')).toBeInTheDocument();
      });

      // Primary instructor (usr_lect_002) has valid WhatsApp button
      const primaryWaBtn = screen.getByTestId('contact-instructor-whatsapp-usr_lect_002');
      expect(primaryWaBtn).toHaveAttribute('href', expect.stringContaining('https://wa.me/201010000002'));

      // Assistant lecturer (USR017) with missing phone shows safe fallback notice instead of broken link
      expect(screen.getByTestId('instructor-phone-unavailable-USR017')).toHaveTextContent(
        'رقم واتساب غير متوفر حالياً'
      );
      expect(screen.queryByTestId('contact-instructor-whatsapp-USR017')).not.toBeInTheDocument();
    });
  });
});
