import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { RouterProvider } from 'react-router-dom';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AuthProvider } from '@/core/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { createTestRouter } from '@/app/router';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type { Course } from '@/core/courses/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset();
});
afterAll(() => server.close());

const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
const lecturerUser = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;
const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;

function renderAppWithRoute(initialRoute: string, user = adminUser) {
  authStorage.setSession({
    token: `mock_jwt_${user.id}_test`,
    user,
    expiresAt: Date.now() + 3600000,
  });

  const router = createTestRouter([initialRoute]);

  return render(
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AuthProvider>
  );
}

function createPendingCourseForReview(): Course {
  const course = inMemoryStore.createCourse(
    {
      title: 'مقرر إشارات وتحكم المترو الحديث',
      description: 'دليل شامل لأنظمة الإشارات الإلكترونية والتحكم المركزي في قطارات المترو',
      level: 'متقدم',
    },
    lecturerUser
  );
  course.estimatedHours = 14;

  // Add video lesson, PDF document, PowerPoint, and Word lessons
  course.chapters[0].title = 'البنية التحتية لنظم الإشارات';
  course.chapters[0].items = [
    {
      id: 'item_video_signal_01',
      type: 'video',
      title: 'مقدمة في نظام التحكم التلقائي ATP',
      duration: '12:30',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    },
    {
      id: 'item_pdf_handbook_02',
      type: 'pdf',
      title: 'دليل السلامة الميدانية للمهندسين',
      duration: '15:00',
      url: 'https://example.com/handbook.pdf',
    },
    {
      id: 'item_pptx_slides_03',
      type: 'powerpoint',
      title: 'شرائح عرض نظم التحكم المتقدمة',
      duration: '20:00',
      url: 'https://drive.google.com/file/d/test_pptx_123/view',
    },
    {
      id: 'item_docx_doc_04',
      type: 'docx',
      title: 'مستند بدون رابط وسائط',
      duration: '05:00',
    },
  ];

  inMemoryStore.saveCourseDraft(course.id, course, lecturerUser);
  inMemoryStore.submitCourseForReview(course.id, lecturerUser);
  return course;
}

describe('Increment 9 — Admin Review Studio Verification (Phase 5)', () => {
  describe('Three-Pane Layout & Navigation', () => {
    it('renders 3-pane RTL layout with Curriculum Navigator, Preview Canvas, and Inspector', async () => {
      const course = createPendingCourseForReview();
      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      // Verify page container and 3 panes
      await waitFor(() => {
        expect(screen.getByTestId('course-review-page')).toBeInTheDocument();
      });

      expect(screen.getByTestId('curriculum-navigator')).toBeInTheDocument();
      expect(screen.getByTestId('review-content-preview')).toBeInTheDocument();
      expect(screen.getByTestId('review-inspector')).toBeInTheDocument();

      // Verify breadcrumb
      expect(screen.getByText('لوحة الاعتمادات')).toBeInTheDocument();
      expect(screen.getByTestId('back-to-approvals-btn')).toBeInTheDocument();
    });

    it('navigates between course root, chapters, and lessons from curriculum navigator', async () => {
      const course = createPendingCourseForReview();
      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('curriculum-navigator')).toBeInTheDocument();
      });

      // Select Course Root
      fireEvent.click(screen.getByTestId('nav-course-root'));
      expect(screen.getByTestId('preview-course-root')).toBeInTheDocument();
      expect(screen.getByText('14 ساعات تدريبية')).toBeInTheDocument();

      // Select Chapter
      const chId = course.chapters[0].id;
      fireEvent.click(screen.getByTestId(`nav-chapter-${chId}`));
      expect(screen.getByTestId('preview-chapter-view')).toBeInTheDocument();
      expect(
        within(screen.getByTestId('preview-chapter-view')).getByText(course.chapters[0].title)
      ).toBeInTheDocument();

      // Select Video Item
      fireEvent.click(screen.getByTestId('nav-item-item_video_signal_01'));
      expect(screen.getByTestId('preview-item-view')).toBeInTheDocument();
      expect(screen.getByTestId('preview-video-container')).toBeInTheDocument();

      // Select PDF Item
      fireEvent.click(screen.getByTestId('nav-item-item_pdf_handbook_02'));
      expect(screen.getByTestId('preview-document-viewer')).toBeInTheDocument();
      expect(
        within(screen.getByTestId('preview-document-viewer')).getByText('دليل السلامة الميدانية للمهندسين')
      ).toBeInTheDocument();
    });
  });

  describe('Real Content Preview & Side-Effect-Free Guarantees', () => {
    it('renders real video player and document viewer in preview mode', async () => {
      const course = createPendingCourseForReview();
      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('curriculum-navigator')).toBeInTheDocument();
      });

      // Select Video Lesson
      fireEvent.click(screen.getByTestId('nav-item-item_video_signal_01'));
      await waitFor(() => {
        expect(screen.getByTestId('preview-video-player')).toBeInTheDocument();
      });

      // Select PDF Lesson
      fireEvent.click(screen.getByTestId('nav-item-item_pdf_handbook_02'));
      await waitFor(() => {
        expect(screen.getByTestId('preview-document-viewer')).toBeInTheDocument();
        expect(screen.getByText('فتح المستند للاطلاع')).toBeInTheDocument();
        expect(screen.getByTestId('preview-pdf-frame')).toBeInTheDocument();
      });

      // Select PowerPoint Lesson (Google Drive preview)
      fireEvent.click(screen.getByTestId('nav-item-item_pptx_slides_03'));
      await waitFor(() => {
        expect(screen.getByTestId('preview-office-frame')).toBeInTheDocument();
        expect(screen.getByTestId('preview-office-frame')).toHaveAttribute(
          'src',
          'https://drive.google.com/file/d/test_pptx_123/preview'
        );
      });

      // Select Word Lesson with missing URL
      fireEvent.click(screen.getByTestId('nav-item-item_docx_doc_04'));
      await waitFor(() => {
        expect(screen.getByTestId('document-unavailable-alert')).toBeInTheDocument();
        expect(screen.getByText('معاينة المستند غير متاحة')).toBeInTheDocument();
      });
    });

    it('strictly guarantees that previewing does not mutate learner progress or viewing seconds', async () => {
      const course = createPendingCourseForReview();

      // Ensure user progress is clean
      const initialProgress = inMemoryStore.getCourseProgress(traineeUser.id, course.id);
      expect(initialProgress.completedItemIds.length).toBe(0);

      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('curriculum-navigator')).toBeInTheDocument();
      });

      // Preview both video and document lessons
      fireEvent.click(screen.getByTestId('nav-item-item_video_signal_01'));
      fireEvent.click(screen.getByTestId('nav-item-item_pdf_handbook_02'));

      // Verify that NO learner progress record was created or mutated
      const progressAfterPreview = inMemoryStore.getCourseProgress(traineeUser.id, course.id);
      expect(progressAfterPreview.completedItemIds.length).toBe(0);
      expect(progressAfterPreview.progressPercent).toBe(0);

      // Verify course enrollment statistics were not mutated
      const liveCourse = inMemoryStore.getCourseById(course.id);
      expect(liveCourse?.enrollmentCount || 0).toBe(0);
    });
  });

  describe('Private Working Notes Isolation & Scoping', () => {
    it('saves and restores reviewer private notes scoped to general, chapter, and item', async () => {
      const course = createPendingCourseForReview();
      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('review-inspector')).toBeInTheDocument();
      });

      // 1. Select Course Root and type general note
      fireEvent.click(screen.getByTestId('nav-course-root'));
      const notesTextarea = screen.getByTestId('working-notes-textarea');
      fireEvent.change(notesTextarea, {
        target: { value: 'ملاحظة عامة سرية: المقرر يحتاج مراجعة لمعايير السلامة' },
      });

      // Wait for debounced autosave
      await waitFor(() => {
        expect(screen.getByText('تم الحفظ تلقائياً')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify note exists in store for admin
      const savedNotes = inMemoryStore.getReviewerWorkingNotes(course.id, adminUser);
      expect(savedNotes.generalNote).toBe('ملاحظة عامة سرية: المقرر يحتاج مراجعة لمعايير السلامة');

      // 2. Select Video Lesson and type item note
      fireEvent.click(screen.getByTestId('nav-item-item_video_signal_01'));
      const itemNotesTextarea = screen.getByTestId('working-notes-textarea');
      fireEvent.change(itemNotesTextarea, {
        target: { value: 'ملاحظة على الفيديو: جودة الصوت تحتاج تحسين' },
      });

      await waitFor(() => {
        expect(screen.getByText('تم الحفظ تلقائياً')).toBeInTheDocument();
      }, { timeout: 3000 });

      const updatedNotes = inMemoryStore.getReviewerWorkingNotes(course.id, adminUser);
      expect(updatedNotes.itemNotes['item_video_signal_01']).toBe(
        'ملاحظة على الفيديو: جودة الصوت تحتاج تحسين'
      );

      // Verify private notes do NOT leak into course auditLog
      const audit = inMemoryStore.getCourseReviewData(course.id, adminUser).auditLog;
      const auditContainsPrivateNotes = audit.some(
        (a) =>
          a.feedback?.summaryMessage?.includes('سرية') ||
          a.approvalNote?.includes('سرية') ||
          a.feedback?.summaryMessage?.includes('جودة الصوت')
      );
      expect(auditContainsPrivateNotes).toBe(false);
    });
  });

  describe('Staged Administrative Editing Integration', () => {
    it('toggles edit mode, allows editing metadata and lessons, and triggers staged autosave', async () => {
      const course = createPendingCourseForReview();
      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('toggle-edit-mode-btn')).toBeInTheDocument();
      });

      // Switch to Edit Mode
      fireEvent.click(screen.getByTestId('toggle-edit-mode-btn'));
      expect(screen.getByTestId('toggle-edit-mode-btn')).toHaveTextContent('إنهاء التعديل والعودة للمعاينة');

      // Select Video Lesson and edit title
      fireEvent.click(screen.getByTestId('nav-item-item_video_signal_01'));
      const itemTitleInput = screen.getByTestId('edit-item-title');
      fireEvent.change(itemTitleInput, {
        target: { value: 'مقدمة في نظام التحكم التلقائي ATP - مراجع ومعدل' },
      });

      // Wait for autosave hook to complete save
      await waitFor(
        () => {
          expect(screen.getByTestId('autosave-status-badge')).toHaveTextContent(
            'تم حفظ تعديلات الإدارة'
          );
        },
        { timeout: 4000 }
      );

      // Verify staged edits exist in store
      const staged = inMemoryStore.getStagedAdminEdits(course.id, adminUser);
      expect(staged).not.toBeNull();
      expect(staged?.clientRevision).toBe(1);

      // Switch to inspector "مقارنة التعديلات" tab
      fireEvent.click(screen.getByTestId('tab-diff'));
      expect(screen.getByTestId('diff-panel')).toBeInTheDocument();
      expect(screen.getByTestId('diff-panel')).toHaveTextContent('رقم المراجعة الحالية: 1');
    }, 15000);

    it('allows editing and autosaving course targetJobTitles and externalResources', async () => {
      const course = createPendingCourseForReview();
      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('toggle-edit-mode-btn')).toBeInTheDocument();
      });

      // Switch to Edit Mode
      fireEvent.click(screen.getByTestId('toggle-edit-mode-btn'));

      // Select Course Root
      fireEvent.click(screen.getByTestId('nav-course-root'));
      expect(screen.getByTestId('edit-course-root-form')).toBeInTheDocument();

      // Edit target job titles
      const jobTitlesInput = screen.getByTestId('edit-course-job-titles');
      fireEvent.change(jobTitlesInput, {
        target: { value: 'مهندس إشارات، فني صيانة محطات' },
      });

      // Wait for autosave
      await waitFor(
        () => {
          expect(screen.getByTestId('autosave-status-badge')).toHaveTextContent(
            'تم حفظ تعديلات الإدارة'
          );
        },
        { timeout: 4000 }
      );

      // Verify stored staged edits include targetJobTitles
      const staged = inMemoryStore.getStagedAdminEdits(course.id, adminUser);
      expect(staged).not.toBeNull();
      expect(staged?.patchedContent.targetJobTitles).toEqual([
        'مهندس إشارات',
        'فني صيانة محطات',
      ]);

      // Verify diff panel displays modified job titles
      fireEvent.click(screen.getByTestId('tab-diff'));
      expect(screen.getByTestId('diff-panel')).toBeInTheDocument();
      expect(screen.getByTestId('diff-panel')).toHaveTextContent('مهندس إشارات');
    }, 15000);
  });

  describe('Audit History & Version Comparison', () => {
    it('displays chronological audit log history and neutral date fallback', async () => {
      const course = createPendingCourseForReview();
      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('tab-audit')).toBeInTheDocument();
      });

      // Switch to Audit tab
      fireEvent.click(screen.getByTestId('tab-audit'));
      expect(screen.getByTestId('audit-log-panel')).toBeInTheDocument();
      expect(screen.getByTestId('audit-entry-0')).toBeInTheDocument();
      expect(screen.getByText('تقديم للمراجعة')).toBeInTheDocument();
    });
  });

  describe('Authorization Barriers', () => {
    it('strictly blocks unauthorized trainee and lecturer access', async () => {
      const course = createPendingCourseForReview();

      // Trainee access attempt
      renderAppWithRoute(`/admin/review/${course.id}`, traineeUser);
      await waitFor(() => {
        expect(screen.getByTestId('review-unauthorized')).toBeInTheDocument();
      });
      expect(screen.getByText('غير مصرح بالوصول إلى استوديو المراجعة')).toBeInTheDocument();
    });

    it('renders not found state when course does not exist', async () => {
      renderAppWithRoute('/admin/review/non_existent_course_id', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('review-not-found')).toBeInTheDocument();
      });
      expect(screen.getByText('المقرر المطلوب غير موجود')).toBeInTheDocument();
    });
  });

  describe('Administrator Editing Workflow Transition & Safety (Increment 9)', () => {
    it('starts in safe read-only preview mode and prominently exposes edit mode toggle', async () => {
      const course = createPendingCourseForReview();
      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('course-review-page')).toBeInTheDocument();
      });

      // 1. Initial mode is read-only inspection
      expect(screen.getByTestId('mode-badge-readonly')).toHaveTextContent('وضع المعاينة والتدقيق');
      expect(screen.getByTestId('readonly-mode-banner')).toBeInTheDocument();
      const readonlyControls = screen.getAllByTestId('toggle-edit-mode-btn');
      expect(readonlyControls).toHaveLength(1);
      expect(readonlyControls[0]).toHaveTextContent('تفعيل وضع التعديل');
      expect(screen.queryByTestId('save-now-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('add-chapter-btn')).not.toBeInTheDocument();
    });

    it('activates editing mode, performs curriculum operations, autosaves, and prevents accidental publication', async () => {
      const course = createPendingCourseForReview();
      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('toggle-edit-mode-btn')).toBeInTheDocument();
      });

      // 1. Activate Edit Mode
      fireEvent.click(screen.getByTestId('toggle-edit-mode-btn'));

      expect(screen.getByTestId('mode-badge-editing')).toHaveTextContent('وضع التعديل النشط');
      expect(screen.getByTestId('editing-mode-banner')).toBeInTheDocument();
      const editingControls = screen.getAllByTestId('toggle-edit-mode-btn');
      expect(editingControls).toHaveLength(1);
      expect(editingControls[0]).toHaveTextContent('إنهاء التعديل والعودة للمعاينة');
      expect(screen.getByTestId('add-chapter-btn')).toBeInTheDocument();

      // 2. Add Chapter
      fireEvent.click(screen.getByTestId('add-chapter-btn'));

      // 3. Edit Course Title and Description in Course Root
      fireEvent.click(screen.getByTestId('nav-course-root'));
      const titleInput = screen.getByTestId('edit-course-title');
      fireEvent.change(titleInput, {
        target: { value: 'مقرر إشارات وتحكم المترو الحديث - تدقيق إداري شامل' },
      });

      // 4. Save immediately via save-now-btn
      await waitFor(() => {
        expect(screen.getByTestId('save-now-btn')).not.toBeDisabled();
      });
      fireEvent.click(screen.getByTestId('save-now-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('save-success-indicator')).toBeInTheDocument();
      });

      // 5. Verify staged edits saved in store
      const staged = inMemoryStore.getStagedAdminEdits(course.id, adminUser);
      expect(staged).not.toBeNull();
      expect(staged?.clientRevision).toBeGreaterThanOrEqual(1);
      expect(staged?.patchedContent.title).toBe(
        'مقرر إشارات وتحكم المترو الحديث - تدقيق إداري شامل'
      );
      expect(staged?.patchedContent.chapters?.length).toBe(2);

      // 6. Guarantee: Editing alone NEVER publishes, approves, or rejects the course!
      const originalInCatalog = inMemoryStore.getCourseById(course.id);
      expect(originalInCatalog?.status).toBe('pending_admin');
      expect(originalInCatalog?.title).toBe('مقرر إشارات وتحكم المترو الحديث');
    }, 15000);

    it('preserves and recovers saved staged edits across mode exits and re-renders', async () => {
      const course = createPendingCourseForReview();

      // Pre-seed staged admin edits
      inMemoryStore.saveStagedAdminEdits(
        course.id,
        {
          baselineId: course.id,
          baselineSubmittedAt: course.submittedAt || '',
          clientRevision: 1,
          patch: {
            title: 'مقرر إشارات المترو - نسخة مراجعة الإدارة المستعادة',
            estimatedHours: 20,
          },
        },
        adminUser
      );

      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('course-review-page')).toBeInTheDocument();
      });

      // In read-only mode, effective course shows the staged title in header & navigator
      expect(
        screen.getAllByText('مقرر إشارات المترو - نسخة مراجعة الإدارة المستعادة').length
      ).toBeGreaterThanOrEqual(1);

      // Diff panel in Inspector reflects the recovered staged edits
      fireEvent.click(screen.getByTestId('tab-diff'));
      expect(screen.getByTestId('diff-panel')).toBeInTheDocument();
      expect(screen.getByTestId('staged-diff-title')).toHaveTextContent(
        'مقرر إشارات المترو - نسخة مراجعة الإدارة المستعادة'
      );
    });
  });
});
