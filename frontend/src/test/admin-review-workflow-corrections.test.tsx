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
import { reviewApi } from '@/features/course-review/api/reviewApi';
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
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      externalResources: [
        {
          id: 'res_lesson_01',
          title: 'دليل تشغيل ATP باللغة العربية',
          url: 'https://metro.gov.eg/docs/atp-guide.pdf',
          order: 1,
        },
      ],
    },
  ];
  course.externalResources = [
    {
      id: 'res_course_01',
      title: 'اللائحة العامة للسلامة بمترو القاهرة',
      url: 'https://metro.gov.eg/safety-regulations.pdf',
      order: 1,
    },
  ];

  inMemoryStore.saveCourseDraft(course.id, course, lecturerUser);
  inMemoryStore.submitCourseForReview(course.id, lecturerUser);
  return course;
}

describe('Increment 9 — Administrator Review Workflow Usability Corrections', () => {
  describe('1. Return to Preview Control Visibility & Autosave Flush Safety', () => {
    it('displays exactly one prominent edit-mode transition control in the primary header and toggles label/icon', async () => {
      const course = createPendingCourseForReview();
      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('course-review-page')).toBeInTheDocument();
      });

      // Initially in readonly mode: exactly one primary edit-mode control
      expect(screen.getByTestId('mode-badge-readonly')).toBeInTheDocument();
      const readonlyControls = screen.getAllByTestId('toggle-edit-mode-btn');
      expect(readonlyControls).toHaveLength(1);
      expect(readonlyControls[0]).toHaveTextContent('تفعيل وضع التعديل');

      // Verify duplicate controls are not rendered
      expect(screen.queryByTestId('exit-edit-mode-root-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('exit-edit-mode-chapter-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('exit-edit-mode-item-btn')).not.toBeInTheDocument();

      // Activate edit mode
      fireEvent.click(readonlyControls[0]);

      // Exactly one primary edit-mode control in edit mode
      const editingControls = screen.getAllByTestId('toggle-edit-mode-btn');
      expect(editingControls).toHaveLength(1);
      expect(editingControls[0]).toHaveTextContent('إنهاء التعديل والعودة للمعاينة');
      expect(screen.getByTestId('mode-badge-editing')).toBeInTheDocument();

      // Verify no duplicate exit buttons appear in edit form footers
      expect(screen.queryByTestId('exit-edit-mode-root-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('exit-edit-mode-chapter-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('exit-edit-mode-item-btn')).not.toBeInTheDocument();
    });

    it('flushes pending autosaves and waits for save success before leaving edit mode', async () => {
      const course = createPendingCourseForReview();
      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('course-review-page')).toBeInTheDocument();
      });

      // Activate edit mode via primary toggle
      fireEvent.click(screen.getByTestId('toggle-edit-mode-btn'));

      // The first item (lesson) is selected by default; edit its title
      const itemTitleInput = screen.getByTestId('edit-item-title');
      fireEvent.change(itemTitleInput, { target: { value: 'عنوان درس تم تدقيقه وتعديله' } });

      // Pending changes badge is visible
      expect(screen.getByTestId('unsaved-indicator')).toBeInTheDocument();

      // Click "إنهاء التعديل والعودة للمعاينة" via primary toggle
      const exitBtn = screen.getByTestId('toggle-edit-mode-btn');
      fireEvent.click(exitBtn);

      // Wait for exit to complete and return to readonly mode
      await waitFor(() => {
        expect(screen.getByTestId('mode-badge-readonly')).toBeInTheDocument();
      });

      // Verify that changes were flushed and saved to the server staged record
      const staged = inMemoryStore.getStagedAdminEdits(course.id, adminUser);
      expect(staged?.patchedContent?.chapters?.[0]?.items?.[0]?.title).toBe(
        'عنوان درس تم تدقيقه وتعديله'
      );

      // Verify returning to preview NEVER executes a decision or changes review status
      const currentCourse = inMemoryStore.getCourseById(course.id);
      expect(currentCourse?.status).toBe('pending_admin');
    });

    it('does not silently discard local edits and displays clear error message if saving fails on exit', async () => {
      const course = createPendingCourseForReview();

      // Intercept staged edits save to simulate a server failure
      server.use(
        http.put('/api/admin/review/:courseId/staged-edits', () => {
          return HttpResponse.json(
            { message: 'فشل مؤقت في خادم حفظ التعديلات' },
            { status: 500 }
          );
        })
      );

      renderAppWithRoute(`/admin/review/${course.id}`, adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('course-review-page')).toBeInTheDocument();
      });

      // Activate edit mode
      fireEvent.click(screen.getByTestId('toggle-edit-mode-btn'));

      // Make local change to lesson title
      const itemTitleInput = screen.getByTestId('edit-item-title');
      fireEvent.change(itemTitleInput, { target: { value: 'عنوان درس لن يضيع عند فشل الحفظ' } });

      // Click "إنهاء التعديل والعودة للمعاينة" via primary toggle
      const exitBtn = screen.getByTestId('toggle-edit-mode-btn');
      fireEvent.click(exitBtn);

      // Verify error banner is shown and editor remains open
      await waitFor(() => {
        expect(screen.getByTestId('exit-edit-mode-error')).toBeInTheDocument();
      });

      // Editor remains in edit mode so changes are not lost
      expect(screen.getByTestId('mode-badge-editing')).toBeInTheDocument();
      expect(screen.getByTestId('edit-item-title')).toHaveValue('عنوان درس لن يضيع عند فشل الحفظ');
    });
  });

  describe('2. Separation between Private Notes and Official Feedback', () => {
    it('prevents lecturers from retrieving reviewer private working notes (HTTP 403)', async () => {
      const course = createPendingCourseForReview();

      // Admin saves private working notes
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      await reviewApi.saveReviewerWorkingNotes(course.id, {
        courseId: course.id,
        reviewerId: adminUser.id,
        generalNote: 'ملاحظة تدقيق سرية للإدارة فقط',
        chapterNotes: {},
        itemNotes: {},
        lastSavedAt: new Date().toISOString(),
      });

      // Lecturer attempts to fetch private notes
      authStorage.setSession({
        token: `mock_jwt_${lecturerUser.id}_test`,
        user: lecturerUser,
        expiresAt: Date.now() + 3600000,
      });

      await expect(reviewApi.getReviewerWorkingNotes(course.id)).rejects.toThrow();
    });

    it('allows lecturers to retrieve official feedback intended for them while keeping private notes confidential', async () => {
      const course = createPendingCourseForReview();

      // Admin saves private notes (does not notify lecturer or create audit entry)
      inMemoryStore.saveReviewerWorkingNotes(
        course.id,
        {
          courseId: course.id,
          reviewerId: adminUser.id,
          generalNote: 'ملاحظة سرية للمراجع',
          chapterNotes: {},
          itemNotes: {},
          lastSavedAt: new Date().toISOString(),
        },
        adminUser
      );

      // Verify audit log has no entry for private note edits
      const stored = inMemoryStore.getCourseById(course.id);
      expect(stored?.auditLog?.some((a) => a.summary?.includes('ملاحظة سرية'))).toBe(false);

      // Execute official decision: reject with feedback (or return with edits if staged edits exist)
      inMemoryStore.executeReviewDecision(
        course.id,
        {
          outcome: 'rejected',
          summaryMessage: 'يرجى استيفاء التعديلات الميدانية على الفصل الأول',
        },
        adminUser
      );

      // Lecturer retrieves review data
      const lecturerData = inMemoryStore.getCourseReviewData(course.id, lecturerUser);
      expect(lecturerData.activeReviewFeedback?.summaryMessage).toBe(
        'يرجى استيفاء التعديلات الميدانية على الفصل الأول'
      );
      // Staged edits in-flight must be null for lecturer
      expect(lecturerData.stagedEdits).toBeNull();
    });
  });

  describe('3. Course History & Dual Snapshots for Approval with Admin Edits', () => {
    it('preserves both baselineSnapshot and adminEditedSnapshot when approved with staged admin edits', async () => {
      const course = createPendingCourseForReview();
      const originalTitle = course.title;

      // Save staged admin edits
      inMemoryStore.saveStagedAdminEdits(
        course.id,
        {
          baselineId: course.id,
          baselineSubmittedAt: course.submittedAt || new Date().toISOString(),
          clientRevision: 1,
          patch: {
            title: 'مقرر إشارات وتحكم المترو الحديث - معتمد ومنقح',
            externalResources: [
              {
                id: 'res_course_01',
                title: 'اللائحة العامة للسلامة بمترو القاهرة',
                url: 'https://metro.gov.eg/safety-regulations.pdf',
                order: 1,
              },
              {
                id: 'res_course_02_new',
                title: 'دليل الصيانة الدورية المعتمد من الإدارة',
                url: 'https://metro.gov.eg/maintenance.pdf',
                order: 2,
              },
            ],
          },
        },
        adminUser
      );

      // Execute approval with staged edits
      const result = inMemoryStore.executeReviewDecision(
        course.id,
        {
          outcome: 'approved',
          publishOption: 'with_staged_edits',
          approvalNote: 'تم اعتماد المحتوى مع إضافة دليل الصيانة الدورية من قبل إدارة الجودة',
        },
        adminUser
      );

      expect(result.course.status).toBe('published');
      expect(result.course.title).toBe('مقرر إشارات وتحكم المترو الحديث - معتمد ومنقح');

      // Verify the approval audit entry contains dual immutable snapshots
      const approvalEntry = result.course.auditLog?.find((e) => e.action === 'approved');
      expect(approvalEntry).toBeDefined();
      expect(approvalEntry?.baselineSnapshot).toBeDefined();
      expect(approvalEntry?.adminEditedSnapshot).toBeDefined();

      // Verify baseline snapshot preserves the original submitted version
      expect(approvalEntry?.baselineSnapshot?.title).toBe(originalTitle);
      expect(approvalEntry?.baselineSnapshot?.externalResources?.length).toBe(1);

      // Verify adminEdited snapshot preserves the applied modifications
      expect(approvalEntry?.adminEditedSnapshot?.title).toBe(
        'مقرر إشارات وتحكم المترو الحديث - معتمد ومنقح'
      );
      expect(approvalEntry?.adminEditedSnapshot?.externalResources?.length).toBe(2);

      // Lecturer can inspect official history in their view
      const lecturerView = inMemoryStore.getCourseReviewData(course.id, lecturerUser);
      const lecturerApprovalEntry = lecturerView.auditLog.find((e) => e.action === 'approved');
      expect(lecturerApprovalEntry?.baselineSnapshot).toBeDefined();
      expect(lecturerApprovalEntry?.adminEditedSnapshot).toBeDefined();
    });

    it('does not expose uncommitted staged edits to the lecturer prior to official decision', async () => {
      const course = createPendingCourseForReview();

      // Admin stages uncommitted edits
      inMemoryStore.saveStagedAdminEdits(
        course.id,
        {
          baselineId: course.id,
          baselineSubmittedAt: course.submittedAt || new Date().toISOString(),
          clientRevision: 1,
          patch: {
            title: 'مسودة تعديل سري لم يتم اتخاذ قرار بشأنه',
          },
        },
        adminUser
      );

      // Lecturer requests course review data
      const lecturerData = inMemoryStore.getCourseReviewData(course.id, lecturerUser);

      // Lecturer receives their own content, not uncommitted admin staged edits
      expect(lecturerData.stagedEdits).toBeNull();
      expect(lecturerData.effectiveContent.title).toBe(course.title);
      expect(lecturerData.effectiveContent.title).not.toBe('مسودة تعديل سري لم يتم اتخاذ قرار بشأنه');
    });
  });
});
