import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AppRouter } from '@/app/router';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type { User } from '@/core/auth/types';
import { clearMaterialBlobs, registerMaterialBlob } from '@/features/groups/utils/materialUtils';

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

describe('Increment 10 — Phase 7: Group Materials Library & File Management', () => {
  // ── 1. Materials Tab & Folder Management (Admin) ─────────────────────────

  describe('1. Materials Tab & Folder Lifecycle', () => {
    it('switches to materials tab, loads seeded folders and metadata', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=materials', adminUser);

      // Loading state disappears and materials tab displays
      await waitFor(() => {
        expect(screen.getByTestId('group-materials-tab')).toBeInTheDocument();
      });

      // Seeded folders are displayed in the grid
      await waitFor(() => {
        expect(screen.getByTestId('folder-card-FLD-GRP-101-01')).toBeInTheDocument();
        expect(screen.getByTestId('folder-card-FLD-GRP-101-02')).toBeInTheDocument();
      });

      expect(screen.getByText('دليل التدريب واللوائح المعتمدة')).toBeInTheDocument();
      expect(screen.getByText('نماذج الفحص الدوري والميداني')).toBeInTheDocument();
      expect(screen.getByTestId('open-create-folder-btn')).toBeInTheDocument();
    });

    it('creates a new material folder with custom Arabic name', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=materials', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-materials-tab')).toBeInTheDocument();
      });

      // Click create folder button
      fireEvent.click(screen.getByTestId('open-create-folder-btn'));

      // Folder modal opens
      await waitFor(() => {
        expect(screen.getByTestId('group-folder-modal')).toBeInTheDocument();
      });

      // Enter valid folder name
      const nameInput = screen.getByTestId('folder-name-input');
      fireEvent.change(nameInput, { target: { value: 'جداول تشغيل القطارات والورديات' } });

      // Submit
      fireEvent.click(screen.getByTestId('submit-folder-btn'));

      // Modal closes and new folder appears in the grid
      await waitFor(() => {
        expect(screen.getByText('جداول تشغيل القطارات والورديات')).toBeInTheDocument();
      });

      // Verify in store
      const materials = inMemoryStore.getGroupMaterials('GRP-101');
      expect(materials.folders.some((f) => f.name === 'جداول تشغيل القطارات والورديات')).toBe(true);
    });

    it('validates duplicate folder names in the same group', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=materials', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-materials-tab')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('open-create-folder-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('group-folder-modal')).toBeInTheDocument();
      });

      // Enter duplicate name of seeded folder 1
      const nameInput = screen.getByTestId('folder-name-input');
      fireEvent.change(nameInput, { target: { value: 'دليل التدريب واللوائح المعتمدة' } });

      fireEvent.click(screen.getByTestId('submit-folder-btn'));

      // Error alert appears
      await waitFor(() => {
        expect(screen.getByTestId('folder-error-alert')).toBeInTheDocument();
      });
      expect(screen.getByText(/يوجد مجلد آخر بنفس الاسم/)).toBeInTheDocument();
    });

    it('renames an existing folder and updates visibility', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=materials', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('folder-card-FLD-GRP-101-02')).toBeInTheDocument();
      });

      // Click edit folder button
      fireEvent.click(screen.getByTestId('edit-folder-btn-FLD-GRP-101-02'));

      await waitFor(() => {
        expect(screen.getByTestId('group-folder-modal')).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('folder-name-input');
      fireEvent.change(nameInput, { target: { value: 'نماذج الفحص الدوري والاختبارات الفنية' } });

      // Uncheck visibility
      const visibilityCheckbox = screen.getByTestId('folder-visibility-checkbox');
      fireEvent.click(visibilityCheckbox);

      fireEvent.click(screen.getByTestId('submit-folder-btn'));

      await waitFor(() => {
        expect(screen.getByText('نماذج الفحص الدوري والاختبارات الفنية')).toBeInTheDocument();
      });

      // Verify visibility changed in store
      const materials = inMemoryStore.getGroupMaterials('GRP-101');
      const updated = materials.folders.find((f) => f.id === 'FLD-GRP-101-02');
      expect(updated?.isVisibleToTrainees).toBe(false);
    });

    it('safely deletes folder with confirmation dialog', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=materials', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('folder-card-FLD-GRP-101-02')).toBeInTheDocument();
      });

      // Click delete on folder 2
      fireEvent.click(screen.getByTestId('delete-folder-btn-FLD-GRP-101-02'));

      // Confirmation dialog appears
      await waitFor(() => {
        expect(screen.getByTestId('delete-folder-confirm-dialog')).toBeInTheDocument();
      });

      // Confirm deletion
      const confirmBtn = screen.getByRole('button', { name: 'حذف المجلد نهائياً' });
      fireEvent.click(confirmBtn);

      // Folder 2 is removed from the view
      await waitFor(() => {
        expect(screen.queryByTestId('folder-card-FLD-GRP-101-02')).not.toBeInTheDocument();
      });
    });
  });

  // ── 2. Folder Navigation, Files List & Breadcrumbs ────────────────────────

  describe('2. Folder Navigation & Files List', () => {
    it('opens folder, displays files with metadata, and navigates via breadcrumbs', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=materials', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('folder-card-FLD-GRP-101-01')).toBeInTheDocument();
      });

      // Open folder 1
      fireEvent.click(screen.getByTestId('open-folder-btn-FLD-GRP-101-01'));

      // Switched to inside folder files view
      await waitFor(() => {
        expect(screen.getByTestId('materials-files-view')).toBeInTheDocument();
        expect(screen.getByTestId('breadcrumb-folder')).toHaveTextContent('دليل التدريب واللوائح المعتمدة');
      });

      // Seeded files (PDF and image) are visible
      expect(screen.getByTestId('file-card-FIL-GRP-101-001')).toBeInTheDocument();
      expect(screen.getByTestId('file-card-FIL-GRP-101-002')).toBeInTheDocument();
      expect(screen.getByText('دليل إجراءات الطوارئ والسلامة المعتمد')).toBeInTheDocument();
      expect(screen.getByText('شعار وهيكل منظومة تشغيل المترو')).toBeInTheDocument();

      // Return to root via breadcrumb
      fireEvent.click(screen.getByTestId('breadcrumb-root'));

      await waitFor(() => {
        expect(screen.getByTestId('materials-folders-view')).toBeInTheDocument();
      });
    });

    it('filters files within folder via search input', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=materials', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('folder-card-FLD-GRP-101-01')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('open-folder-btn-FLD-GRP-101-01'));

      await waitFor(() => {
        expect(screen.getByTestId('file-card-FIL-GRP-101-001')).toBeInTheDocument();
        expect(screen.getByTestId('file-card-FIL-GRP-101-002')).toBeInTheDocument();
      });

      // Filter by 'طوارئ'
      const searchInput = screen.getByTestId('materials-search-input');
      fireEvent.change(searchInput, { target: { value: 'طوارئ' } });

      // PDF is visible, Image is hidden
      expect(screen.getByTestId('file-card-FIL-GRP-101-001')).toBeInTheDocument();
      expect(screen.queryByTestId('file-card-FIL-GRP-101-002')).not.toBeInTheDocument();
    });
  });

  // ── 3. File Upload, Staging & Validation ──────────────────────────────────

  describe('3. File Upload, Staging & Validation', () => {
    it('uploads valid files into folder and registers them in materials list', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=materials', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('folder-card-FLD-GRP-101-01')).toBeInTheDocument();
      });

      // Open folder 1
      fireEvent.click(screen.getByTestId('open-folder-btn-FLD-GRP-101-01'));

      await waitFor(() => {
        expect(screen.getByTestId('materials-files-view')).toBeInTheDocument();
      });

      // Open upload modal
      fireEvent.click(screen.getByTestId('folder-upload-files-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('group-upload-files-modal')).toBeInTheDocument();
      });

      // Create synthetic File objects
      const validFile = new File(['mock content line 1 line 2'], 'field-checklist.pdf', {
        type: 'application/pdf',
      });

      const fileInput = screen.getByTestId('file-input-element');
      fireEvent.change(fileInput, { target: { files: [validFile] } });

      // Staged file appears with size and type
      await waitFor(() => {
        expect(screen.getByTestId('staged-file-item-field-checklist.pdf')).toBeInTheDocument();
      });

      // Confirm upload
      const confirmUploadBtn = screen.getByTestId('confirm-upload-btn');
      fireEvent.click(confirmUploadBtn);

      // Modal closes and new file is displayed in the list
      await waitFor(() => {
        expect(screen.getByText('field-checklist')).toBeInTheDocument();
      });
    });

    it('rejects invalid file types and prevents uploading unsupported files', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=materials', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('folder-card-FLD-GRP-101-01')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('open-folder-btn-FLD-GRP-101-01'));

      await waitFor(() => {
        expect(screen.getByTestId('materials-files-view')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('folder-upload-files-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('group-upload-files-modal')).toBeInTheDocument();
      });

      // Executable file with unsupported extension
      const invalidFile = new File(['malicious-binary'], 'installer.exe', {
        type: 'application/octet-stream',
      });

      const fileInput = screen.getByTestId('file-input-element');
      fireEvent.change(fileInput, { target: { files: [invalidFile] } });

      await waitFor(() => {
        expect(screen.getByTestId('staged-file-item-installer.exe')).toBeInTheDocument();
      });

      // Confirm button is disabled because 0 valid files are selected
      const confirmUploadBtn = screen.getByTestId('confirm-upload-btn');
      expect(confirmUploadBtn).toBeDisabled();
    });
  });

  // ── 4. File Preview & Genuine Downloads ───────────────────────────────────

  describe('4. File Preview & Downloads', () => {
    it('previews PDF file in embedded viewer modal', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=materials', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('folder-card-FLD-GRP-101-01')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('open-folder-btn-FLD-GRP-101-01'));

      await waitFor(() => {
        expect(screen.getByTestId('file-card-FIL-GRP-101-001')).toBeInTheDocument();
      });

      // Click preview on PDF
      fireEvent.click(screen.getByTestId('preview-file-btn-FIL-GRP-101-001'));

      // Viewer modal opens with iframe
      await waitFor(() => {
        expect(screen.getByTestId('group-material-viewer-modal')).toBeInTheDocument();
        expect(screen.getByTestId('pdf-preview-frame')).toBeInTheDocument();
      });

      // Close viewer
      fireEvent.click(screen.getByTestId('close-viewer-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('group-material-viewer-modal')).not.toBeInTheDocument();
      });
    });

    it('previews Image file in lightbox modal', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=materials', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('folder-card-FLD-GRP-101-01')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('open-folder-btn-FLD-GRP-101-01'));

      await waitFor(() => {
        expect(screen.getByTestId('file-card-FIL-GRP-101-002')).toBeInTheDocument();
      });

      // Click preview on Image
      fireEvent.click(screen.getByTestId('preview-file-btn-FIL-GRP-101-002'));

      // Lightbox renders image element
      await waitFor(() => {
        expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      });
    });

    it('renders fallback download card for Office file formats', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=materials', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('folder-card-FLD-GRP-101-02')).toBeInTheDocument();
      });

      // Open folder 2 (contains Word doc)
      fireEvent.click(screen.getByTestId('open-folder-btn-FLD-GRP-101-02'));

      await waitFor(() => {
        expect(screen.getByTestId('file-card-FIL-GRP-101-003')).toBeInTheDocument();
      });

      // Click download/preview on Word document
      fireEvent.click(screen.getByTestId('preview-file-btn-FIL-GRP-101-003'));

      // Viewer displays informative fallback card
      await waitFor(() => {
        expect(screen.getByTestId('preview-fallback-card')).toBeInTheDocument();
        expect(screen.getByTestId('preview-fallback-download-btn')).toBeInTheDocument();
      });
    });

    it('downloads genuine uploaded bytes from blob registry', async () => {
      // Mock window.URL.createObjectURL and link click
      const originalCreateObjectURL = window.URL.createObjectURL;
      const originalRevokeObjectURL = window.URL.revokeObjectURL;
      window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url-123');
      window.URL.revokeObjectURL = vi.fn();

      const testBlob = new Blob(['sample-test-bytes'], { type: 'application/pdf' });
      registerMaterialBlob('FIL-GRP-101-001', testBlob);

      renderWithApp('/admin/groups/GRP-101/edit?tab=materials', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('folder-card-FLD-GRP-101-01')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('open-folder-btn-FLD-GRP-101-01'));

      await waitFor(() => {
        expect(screen.getByTestId('download-file-btn-FIL-GRP-101-001')).toBeInTheDocument();
      });

      // Click download button
      fireEvent.click(screen.getByTestId('download-file-btn-FIL-GRP-101-001'));

      expect(window.URL.createObjectURL).toHaveBeenCalledWith(testBlob);

      window.URL.createObjectURL = originalCreateObjectURL;
      window.URL.revokeObjectURL = originalRevokeObjectURL;
    });
  });

  // ── 5. Moving & Deleting Files ────────────────────────────────────────────

  describe('5. Moving & Deleting Files', () => {
    it('moves file to another folder in the same group', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=materials', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('folder-card-FLD-GRP-101-01')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('open-folder-btn-FLD-GRP-101-01'));

      await waitFor(() => {
        expect(screen.getByTestId('file-card-FIL-GRP-101-002')).toBeInTheDocument();
      });

      // Click move on image file
      fireEvent.click(screen.getByTestId('move-file-btn-FIL-GRP-101-002'));

      // Move modal opens
      await waitFor(() => {
        expect(screen.getByTestId('group-move-file-modal')).toBeInTheDocument();
      });

      // Select folder 2 as destination
      const select = screen.getByTestId('target-folder-select');
      fireEvent.change(select, { target: { value: 'FLD-GRP-101-02' } });

      // Confirm move
      fireEvent.click(screen.getByTestId('confirm-move-file-btn'));

      // File is no longer in folder 1
      await waitFor(() => {
        expect(screen.queryByTestId('file-card-FIL-GRP-101-002')).not.toBeInTheDocument();
      });

      // Verify in store: file is now in FLD-GRP-101-02
      const materials = inMemoryStore.getGroupMaterials('GRP-101');
      const targetFolder = materials.folders.find((f) => f.id === 'FLD-GRP-101-02');
      expect(targetFolder?.files.some((f) => f.id === 'FIL-GRP-101-002')).toBe(true);
    });

    it('safely deletes file with confirmation dialog', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=materials', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('folder-card-FLD-GRP-101-01')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('open-folder-btn-FLD-GRP-101-01'));

      await waitFor(() => {
        expect(screen.getByTestId('file-card-FIL-GRP-101-001')).toBeInTheDocument();
      });

      // Click delete file
      fireEvent.click(screen.getByTestId('delete-file-btn-FIL-GRP-101-001'));

      // Confirmation dialog appears
      await waitFor(() => {
        expect(screen.getByTestId('delete-file-confirm-dialog')).toBeInTheDocument();
      });

      const confirmBtn = screen.getByTestId('confirm-delete-btn');
      fireEvent.click(confirmBtn);

      // File removed from UI
      await waitFor(() => {
        expect(screen.queryByTestId('file-card-FIL-GRP-101-001')).not.toBeInTheDocument();
      });
    });
  });

  // ── 6. Trainee Read-Only Access ──────────────────────────────────────────

  describe('6. Trainee Read-Only Access', () => {
    it('allows trainee to view folders and preview files without management controls', async () => {
      renderWithApp('/my-groups/GRP-101', traineeUser);

      // Trainee group details page loads
      await waitFor(() => {
        expect(screen.getByTestId('group-detail-page')).toBeInTheDocument();
        expect(screen.getByTestId('trainee-group-materials-section')).toBeInTheDocument();
      });

      // Folders are visible to trainee
      await waitFor(() => {
        expect(screen.getByTestId('folder-card-FLD-GRP-101-01')).toBeInTheDocument();
      });

      // Strict Read-Only verification: management buttons are completely absent
      expect(screen.queryByTestId('open-create-folder-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('edit-folder-btn-FLD-GRP-101-01')).not.toBeInTheDocument();
      expect(screen.queryByTestId('delete-folder-btn-FLD-GRP-101-01')).not.toBeInTheDocument();

      // Trainee opens folder
      fireEvent.click(screen.getByTestId('open-folder-btn-FLD-GRP-101-01'));

      await waitFor(() => {
        expect(screen.getByTestId('file-card-FIL-GRP-101-001')).toBeInTheDocument();
      });

      // Trainee has preview and download buttons
      expect(screen.getByTestId('preview-file-btn-FIL-GRP-101-001')).toBeInTheDocument();
      expect(screen.getByTestId('download-file-btn-FIL-GRP-101-001')).toBeInTheDocument();

      // Trainee has NO move or delete buttons on files
      expect(screen.queryByTestId('move-file-btn-FIL-GRP-101-001')).not.toBeInTheDocument();
      expect(screen.queryByTestId('delete-file-btn-FIL-GRP-101-001')).not.toBeInTheDocument();
    });

    it('filters out hidden folders and files from trainee view', async () => {
      // Mark folder 2 as hidden
      inMemoryStore.updateMaterialFolder('FLD-GRP-101-02', { isVisibleToTrainees: false });

      renderWithApp('/my-groups/GRP-101', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('trainee-group-materials-section')).toBeInTheDocument();
      });

      // Folder 1 is visible
      await waitFor(() => {
        expect(screen.getByTestId('folder-card-FLD-GRP-101-01')).toBeInTheDocument();
      });

      // Folder 2 is strictly hidden
      expect(screen.queryByTestId('folder-card-FLD-GRP-101-02')).not.toBeInTheDocument();
    });
  });
});
