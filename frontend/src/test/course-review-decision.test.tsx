import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AuthProvider } from '@/core/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { createTestRouter } from '@/app/router';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type { Course } from '@/core/courses/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset();
});
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset();
});
afterAll(() => server.close());

const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
const lecturerUser = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;

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

  course.chapters[0].title = 'البنية التحتية لنظم الإشارات';
  course.chapters[0].items = [
    {
      id: 'item_video_signal_01',
      type: 'video',
      title: 'مقدمة في نظام التحكم التلقائي ATP',
      duration: '12:00',
    },
  ];

  inMemoryStore.saveCourseDraft(course.id, course, lecturerUser);
  inMemoryStore.submitCourseForReview(course.id, lecturerUser);
  return course;
}

function createPublishedCourseWithPendingUpdate(): Course {
  const course = inMemoryStore.createCourse(
    {
      title: 'تشغيل قطارات الخط الثالث للمترو',
      description: 'إجراءات وبروتوكولات التشغيل الآمن للقطارات المكيفة في الخط الثالث',
      level: 'متوسط',
    },
    lecturerUser
  );
  course.chapters[0].items = [
    {
      id: 'item_third_line_01',
      type: 'video',
      title: 'إجراءات فحص كابينة القيادة',
      duration: '15:00',
    },
  ];

  // Update target course in store so it is genuinely published
  const target = inMemoryStore.getCourseById(course.id);
  if (target) {
    target.status = 'published';
    target.chapters = JSON.parse(JSON.stringify(course.chapters));
  }

  // Create authoritative draft with update and submit
  const updatedDraft: Course = {
    ...course,
    title: 'تشغيل قطارات الخط الثالث للمترو - الإصدار المحدث',
    estimatedHours: 20,
  };
  inMemoryStore.saveCourseDraft(course.id, updatedDraft, lecturerUser);
  inMemoryStore.submitCourseForReview(course.id, lecturerUser);
  return course;
}

describe('Increment 9 — Phase 6: Decision Modal & The Three Review Outcomes', () => {
  describe('Review Studio Inspector Action Buttons', () => {
    it('renders the 3 action buttons and disables return-with-edits when no staged edits exist', async () => {
      const course = createPendingCourseForReview();
      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('action-approve-btn')).toBeInTheDocument();
      });

      expect(screen.getByTestId('action-approve-btn')).toHaveTextContent('اعتماد ونشر المقرر');
      expect(screen.getByTestId('action-return-edits-btn')).toBeDisabled();
      expect(screen.getByTestId('action-reject-btn')).toBeEnabled();
    });

    it('shows contextual tooltip on hover and focus explaining how to enable the return-with-edits button when no staged edits exist', async () => {
      const course = createPendingCourseForReview();
      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('action-approve-btn')).toBeInTheDocument();
      });

      const returnBtn = screen.getByTestId('action-return-edits-btn');
      expect(returnBtn).toBeDisabled();

      // Trigger hover on the trigger wrapper
      fireEvent.mouseEnter(returnBtn.parentElement!);
      const tooltip = screen.getByTestId('return-edits-tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent(
        'لتفعيل هذا الإجراء، فعّل وضع التعديل، وأجرِ تعديلًا واحدًا على الأقل، ثم انتظر حتى يتم حفظه بنجاح.'
      );

      // Mouse leave hides tooltip
      fireEvent.mouseLeave(returnBtn.parentElement!);
      expect(screen.queryByTestId('return-edits-tooltip')).not.toBeInTheDocument();

      // Keyboard focus on the accessible trigger wrapper displays tooltip
      fireEvent.focus(returnBtn.parentElement!);
      expect(screen.getByTestId('return-edits-tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('return-edits-tooltip')).toHaveTextContent(
        'لتفعيل هذا الإجراء، فعّل وضع التعديل، وأجرِ تعديلًا واحدًا على الأقل، ثم انتظر حتى يتم حفظه بنجاح.'
      );
    });

    it('shows contextual tooltip when edits exist locally but are still unsaved or being saved', async () => {
      const course = createPendingCourseForReview();
      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('toggle-edit-mode-btn')).toBeInTheDocument();
      });

      // Activate edit mode
      fireEvent.click(screen.getByTestId('toggle-edit-mode-btn'));

      // Make a local edit so changes exist locally
      const itemTitleInput = screen.getByTestId('edit-item-title');
      fireEvent.change(itemTitleInput, { target: { value: 'عنوان تجريبي غير محفوظ' } });

      // Unsaved changes exist
      expect(screen.getByTestId('unsaved-indicator')).toBeInTheDocument();

      const returnBtn = screen.getByTestId('action-return-edits-btn');
      expect(returnBtn).toBeDisabled();

      fireEvent.mouseEnter(returnBtn.parentElement!);
      const tooltip = screen.getByTestId('return-edits-tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent('جارٍ حفظ التعديلات؛ انتظر اكتمال الحفظ قبل إرجاع المقرر.');
    });

    it('shows contextual tooltip when an unresolved revision conflict is present', async () => {
      const course = createPendingCourseForReview();

      // Setup initial staged edits
      inMemoryStore.saveStagedAdminEdits(
        course.id,
        {
          baselineId: course.id,
          baselineSubmittedAt: course.submittedAt || new Date().toISOString(),
          clientRevision: 1,
          patch: { title: 'عنوان محفوظ مبدئياً' },
        },
        adminUser
      );

      // Simulate a conflict response on staged-edits endpoint
      server.use(
        http.get('/api/admin/review/:courseId/staged-edits', () => {
          return HttpResponse.json({
            record: {
              courseId: course.id,
              baselineId: course.id,
              baselineSubmittedAt: '',
              clientRevision: 2,
              patchedContent: { title: 'عنوان خادم متعارض' },
              lastSavedAt: new Date().toISOString(),
              savedByAdminId: 'other_admin',
            },
          });
        }),
        http.put('/api/admin/review/:courseId/staged-edits', () => {
          return HttpResponse.json(
            { message: 'تعارض في المراجعة' },
            { status: 409 }
          );
        })
      );

      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('toggle-edit-mode-btn')).toBeInTheDocument();
      });

      // Activate edit mode and trigger save conflict
      fireEvent.click(screen.getByTestId('toggle-edit-mode-btn'));
      fireEvent.click(screen.getByTestId('nav-course-root'));
      const courseTitleInput = screen.getByTestId('edit-course-title');
      fireEvent.change(courseTitleInput, { target: { value: 'عنوان محلي متعارض' } });

      await waitFor(() => {
        expect(screen.getByTestId('save-now-btn')).not.toBeDisabled();
      });
      fireEvent.click(screen.getByTestId('save-now-btn'));

      // Wait for conflict resolution modal to trigger conflict status
      await waitFor(() => {
        expect(screen.getByTestId('conflict-resolution-modal')).toBeInTheDocument();
      });

      const returnBtn = screen.getByTestId('action-return-edits-btn');
      expect(returnBtn).toBeDisabled();

      fireEvent.mouseEnter(returnBtn.parentElement!);
      const tooltip = screen.getByTestId('return-edits-tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent(
        'توجد تعارضات غير محلولة في التعديلات؛ يجب حل التعارض أولاً قبل إرجاع المقرر.'
      );
    });

    it('enables return-with-edits when staged edits are present and no blocking operation remains', async () => {
      const course = createPendingCourseForReview();

      // Save staged edits
      inMemoryStore.saveStagedAdminEdits(
        course.id,
        {
          baselineId: course.id,
          baselineSubmittedAt: course.submittedAt || new Date().toISOString(),
          clientRevision: 1,
          patch: { title: 'عنوان معدل من الإدارة' },
        },
        adminUser
      );

      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('action-return-edits-btn')).toBeEnabled();
      });
    });
  });

  describe('Outcome A: Approve & Publish', () => {
    it('approves submitted baseline when no staged edits exist and includes optional approval note', async () => {
      const course = createPendingCourseForReview();
      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('action-approve-btn')).toBeInTheDocument();
      });

      // Open Modal
      fireEvent.click(screen.getByTestId('action-approve-btn'));
      expect(screen.getByTestId('decision-modal')).toBeInTheDocument();
      expect(screen.getByTestId('decision-modal-title')).toHaveTextContent(
        'اعتماد ونشر المقرر التدريبي'
      );

      // Verify no staged choice container since no staged edits exist
      expect(screen.queryByTestId('publish-choice-container')).not.toBeInTheDocument();

      // Enter optional approval note
      const noteInput = screen.getByTestId('approval-note-input');
      fireEvent.change(noteInput, {
        target: { value: 'مقرر ممتاز ومستوفٍ لكافة المعايير الفنية' },
      });

      // Confirm approval
      fireEvent.click(screen.getByTestId('confirm-approve-btn'));

      // Wait for redirect to /approvals
      await waitFor(() => {
        expect(screen.getByTestId('approvals-page')).toBeInTheDocument();
      }, { timeout: 4000 });

      // Verify course is published in store
      const updated = inMemoryStore.getCourseById(course.id);
      expect(updated?.status).toBe('published');
      expect(updated?.activeReviewFeedback).toBeNull();

      // Verify audit log entry
      const audit = updated?.auditLog?.find((a) => a.action === 'approved');
      expect(audit).toBeDefined();
      expect(audit?.actorId).toBe(adminUser.id);
      expect(audit?.approvalNote).toBe('مقرر ممتاز ومستوفٍ لكافة المعايير الفنية');
    });

    it('presents two-way choice when staged edits exist: choice 1 publishes submitted baseline unchanged', async () => {
      const course = createPendingCourseForReview();
      const originalTitle = course.title;

      inMemoryStore.saveStagedAdminEdits(
        course.id,
        {
          baselineId: course.id,
          baselineSubmittedAt: course.submittedAt || new Date().toISOString(),
          clientRevision: 1,
          patch: { title: 'عنوان إداري مؤقت يجب تجاهله' },
        },
        adminUser
      );

      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('action-approve-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('action-approve-btn'));

      // Verify explicit two-way choice container is displayed
      expect(screen.getByTestId('publish-choice-container')).toBeInTheDocument();
      expect(screen.getByTestId('publish-choice-submitted')).toBeInTheDocument();
      expect(screen.getByTestId('publish-choice-staged')).toBeInTheDocument();

      // Select Choice 1: Publish submitted baseline unchanged
      fireEvent.click(screen.getByTestId('publish-choice-submitted'));

      // Submit
      fireEvent.click(screen.getByTestId('confirm-approve-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('approvals-page')).toBeInTheDocument();
      }, { timeout: 4000 });

      const updated = inMemoryStore.getCourseById(course.id);
      expect(updated?.status).toBe('published');
      expect(updated?.title).toBe(originalTitle); // Staged edits were discarded!

      // Staged edits store cleaned
      const staged = inMemoryStore.getStagedAdminEdits(course.id, adminUser);
      expect(staged).toBeNull();
    });

    it('presents two-way choice when staged edits exist: choice 2 publishes with staged admin edits', async () => {
      const course = createPendingCourseForReview();

      inMemoryStore.saveStagedAdminEdits(
        course.id,
        {
          baselineId: course.id,
          baselineSubmittedAt: course.submittedAt || new Date().toISOString(),
          clientRevision: 1,
          patch: {
            title: 'عنوان مقرر معتمد بعد تدقيق الجودة',
            level: 'متقدم',
          },
        },
        adminUser
      );

      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('action-approve-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('action-approve-btn'));

      // Choice 2 (with_staged_edits) is default when staged edits exist
      fireEvent.click(screen.getByTestId('publish-choice-staged'));

      // Submit
      fireEvent.click(screen.getByTestId('confirm-approve-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('approvals-page')).toBeInTheDocument();
      }, { timeout: 4000 });

      const updated = inMemoryStore.getCourseById(course.id);
      expect(updated?.status).toBe('published');
      expect(updated?.title).toBe('عنوان مقرر معتمد بعد تدقيق الجودة');
      expect(updated?.level).toBe('متقدم');
      expect(updated?.lastEditedByAdminId).toBe(adminUser.id);
      expect(updated?.lastEditedByAdminName).toBe(adminUser.name);

      // Ownership is strictly preserved
      expect(updated?.lecturerId).toBe(lecturerUser.id);
      expect(updated?.lecturerName).toBe(lecturerUser.name);
    });

    it('preserves published-course isolation until update approval executes', async () => {
      const course = createPublishedCourseWithPendingUpdate();
      const liveOriginalTitle = course.title;

      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('action-approve-btn')).toBeInTheDocument();
      });

      // Before approval, base course in catalog is still published with liveOriginalTitle
      const current = inMemoryStore.getCourseById(course.id);
      expect(current?.title).toBe(liveOriginalTitle);
      expect(current?.isUpdatePendingApproval).toBe(true);

      // Approve
      fireEvent.click(screen.getByTestId('action-approve-btn'));
      fireEvent.click(screen.getByTestId('confirm-approve-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('approvals-page')).toBeInTheDocument();
      }, { timeout: 4000 });

      const approved = inMemoryStore.getCourseById(course.id);
      expect(approved?.status).toBe('published');
      expect(approved?.title).toBe('تشغيل قطارات الخط الثالث للمترو - الإصدار المحدث');
      expect(approved?.isUpdatePendingApproval).toBe(false);
      expect(inMemoryStore.getCourseReviewData(course.id, adminUser).draft).toBeNull();
    });
  });

  describe('Outcome B: Return with Admin Edits', () => {
    it('blocks submission if mandatory feedback message is missing', async () => {
      const course = createPendingCourseForReview();

      inMemoryStore.saveStagedAdminEdits(
        course.id,
        {
          baselineId: course.id,
          baselineSubmittedAt: course.submittedAt || new Date().toISOString(),
          clientRevision: 1,
          patch: { title: 'تعديل إداري معتمد' },
        },
        adminUser
      );

      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('action-return-edits-btn')).toBeEnabled();
      });

      fireEvent.click(screen.getByTestId('action-return-edits-btn'));
      expect(screen.getByTestId('decision-modal')).toBeInTheDocument();
      expect(screen.getByTestId('staged-edits-summary-box')).toBeInTheDocument();

      // Submit without entering feedback
      fireEvent.click(screen.getByTestId('confirm-return-edits-btn'));

      // Validation error displayed
      expect(screen.getByTestId('decision-validation-error')).toHaveTextContent(
        'رسالة التغذية الراجعة للمحاضر مطلوبة'
      );
    });

    it('captures dual snapshots, updates course, and records audit trail', async () => {
      const course = createPendingCourseForReview();
      const originalBaselineTitle = course.title;

      inMemoryStore.saveStagedAdminEdits(
        course.id,
        {
          baselineId: course.id,
          baselineSubmittedAt: course.submittedAt || new Date().toISOString(),
          clientRevision: 1,
          patch: {
            title: 'مقرر إشارات وتحكم المترو الحديث - نسخة منقحة',
            description: 'وصف منقح ومعدل بواسطة إدارة الجودة للوضوح والدقة',
          },
        },
        adminUser
      );

      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('action-return-edits-btn')).toBeEnabled();
      });

      fireEvent.click(screen.getByTestId('action-return-edits-btn'));

      // Enter feedback
      const feedbackInput = screen.getByTestId('decision-feedback-input');
      fireEvent.change(feedbackInput, {
        target: {
          value: 'قمنا بتعديل العنوان والوصف لمطابقة المعايير الفنية لهيئة المترو، يرجى مراجعتها وتأكيدها.',
        },
      });

      fireEvent.click(screen.getByTestId('confirm-return-edits-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('approvals-page')).toBeInTheDocument();
      }, { timeout: 4000 });

      const updated = inMemoryStore.getCourseById(course.id);
      expect(updated?.status).toBe('draft');
      expect(updated?.title).toBe('مقرر إشارات وتحكم المترو الحديث - نسخة منقحة');
      expect(updated?.activeReviewFeedback?.outcome).toBe('returned_with_admin_edits');
      expect(updated?.activeReviewFeedback?.summaryMessage).toContain('قمنا بتعديل العنوان والوصف');
      expect(updated?.lastEditedByAdminId).toBe(adminUser.id);

      // Verify audit log has dual snapshots
      const audit = updated?.auditLog?.find((a) => a.action === 'returned_with_admin_edits');
      expect(audit).toBeDefined();
      expect(audit?.baselineSnapshot?.title).toBe(originalBaselineTitle);
      expect(audit?.adminEditedSnapshot?.title).toBe(
        'مقرر إشارات وتحكم المترو الحديث - نسخة منقحة'
      );
    });
  });

  describe('Outcome C: Reject without Admin Edits', () => {
    it('blocks submission without mandatory rejection reason', async () => {
      const course = createPendingCourseForReview();
      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('action-reject-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('action-reject-btn'));
      expect(screen.getByTestId('decision-modal')).toBeInTheDocument();

      // Submit without reason
      fireEvent.click(screen.getByTestId('confirm-reject-btn'));

      expect(screen.getByTestId('decision-validation-error')).toHaveTextContent(
        'سبب الرفض والتغذية الراجعة للمحاضر مطلوبة'
      );
    });

    it('does not commit staged content edits, marks them as stale, and records rejection audit', async () => {
      const course = createPendingCourseForReview();
      const originalTitle = course.title;

      // Have staged edits
      inMemoryStore.saveStagedAdminEdits(
        course.id,
        {
          baselineId: course.id,
          baselineSubmittedAt: course.submittedAt || new Date().toISOString(),
          clientRevision: 1,
          patch: { title: 'عنوان إداري مؤقت لن يتم تطبيقه' },
        },
        adminUser
      );

      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('action-reject-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('action-reject-btn'));

      // Warning about stale edits is visible
      expect(screen.getByTestId('stale-edits-warning')).toBeInTheDocument();

      // Enter rejection reason
      const feedbackInput = screen.getByTestId('decision-feedback-input');
      fireEvent.change(feedbackInput, {
        target: {
          value: 'المحتوى غير مكتمل في الفصل الثاني ومقاطع الفيديو تحتاج إلى تحسين جودة الصوت.',
        },
      });

      fireEvent.click(screen.getByTestId('confirm-reject-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('approvals-page')).toBeInTheDocument();
      }, { timeout: 4000 });

      const updated = inMemoryStore.getCourseById(course.id);
      expect(updated?.status).toBe('draft');
      expect(updated?.title).toBe(originalTitle); // Content unchanged!
      expect(updated?.activeReviewFeedback?.outcome).toBe('rejected');

      // Staged edits are NOT wiped, but marked stale
      const staged = inMemoryStore.getStagedAdminEdits(course.id, adminUser);
      expect(staged).not.toBeNull();
      expect(staged?.isStale).toBe(true);

      // Audit log entry
      const audit = updated?.auditLog?.find((a) => a.action === 'rejected');
      expect(audit).toBeDefined();
      expect(audit?.feedback?.summaryMessage).toContain('المحتوى غير مكتمل');
    });
  });

  describe('Private Working Notes Import Flow', () => {
    it('prompts confirmation dialog and copies private notes to official feedback upon confirmation', async () => {
      const course = createPendingCourseForReview();

      // Save reviewer private working notes
      inMemoryStore.saveReviewerWorkingNotes(
        course.id,
        {
          generalNote: 'ملاحظة سرية: التأكد من ترخيص المادة العلمية للفصل الأول',
          chapterNotes: {
            [course.chapters[0].id]: 'ملاحظة فصل: مراجعة المسميات الفنية',
          },
        },
        adminUser
      );

      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('action-reject-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('action-reject-btn'));

      // Import button is visible because private notes exist
      const importBtn = screen.getByTestId('import-private-notes-btn');
      expect(importBtn).toBeInTheDocument();

      // Click import -> opens ConfirmDialog
      fireEvent.click(importBtn);
      expect(screen.getByTestId('import-notes-confirm-dialog')).toBeInTheDocument();

      // Cancel import first
      fireEvent.click(screen.getByTestId('cancel-import-notes-btn'));
      expect(screen.queryByTestId('import-notes-confirm-dialog')).not.toBeInTheDocument();
      expect(screen.getByTestId('decision-feedback-input')).toHaveValue('');

      // Open import dialog again and confirm
      fireEvent.click(importBtn);
      fireEvent.click(screen.getByTestId('confirm-import-notes-btn'));

      // Private notes should now be populated in the textarea
      const feedbackInput = screen.getByTestId('decision-feedback-input') as HTMLTextAreaElement;
      expect(feedbackInput.value).toContain('التأكد من ترخيص المادة العلمية');
    });
  });
});
