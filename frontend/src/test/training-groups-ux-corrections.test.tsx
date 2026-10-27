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

    it('provides attachments and meetings management tabs in GroupEditorPage', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=attachments', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-attachments-tab')).toBeInTheDocument();
      });

      expect(screen.getByText('المواد المرفقة والوثائق التدريبية')).toBeInTheDocument();
      expect(screen.getByTestId('open-add-attachment-btn')).toBeInTheDocument();

      // Switch to meetings tab
      fireEvent.click(screen.getByTestId('tab-meetings'));

      await waitFor(() => {
        expect(screen.getByTestId('group-meetings-tab')).toBeInTheDocument();
      });

      expect(screen.getByText('اللقاءات التفاعلية (Microsoft Teams)')).toBeInTheDocument();
      expect(screen.getByTestId('open-add-meeting-btn')).toBeInTheDocument();
    });
  });

  // ── 3. Unified Group-Creation & Editing Experience ────────────────────────

  describe('3. Unified Group-Creation and Editing Experience', () => {
    it('shows all 6 tabs simultaneously in new group creation mode (/admin/groups/new)', async () => {
      renderWithApp('/admin/groups/new', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-editor-page')).toBeInTheDocument();
      });

      // All 6 tabs visible
      expect(screen.getByTestId('tab-general-settings')).toBeInTheDocument();
      expect(screen.getByTestId('tab-courses')).toBeInTheDocument();
      expect(screen.getByTestId('tab-members')).toBeInTheDocument();
      expect(screen.getByTestId('tab-materials')).toBeInTheDocument();
      expect(screen.getByTestId('tab-attachments')).toBeInTheDocument();
      expect(screen.getByTestId('tab-meetings')).toBeInTheDocument();
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
      fireEvent.click(screen.getByTestId('tab-materials'));

      await waitFor(() => {
        expect(screen.getByTestId('group-materials-tab')).toBeInTheDocument();
        expect(screen.queryByTestId('tab-dependency-notice')).not.toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });
});
