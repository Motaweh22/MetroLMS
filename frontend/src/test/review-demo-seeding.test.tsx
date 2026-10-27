import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { inMemoryStore, MockStoreError } from '@/mocks/store/inMemoryStore';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import { authStorage } from '@/core/auth/authStorage';
import { AuthProvider } from '@/core/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { RouterProvider } from 'react-router-dom';
import { createTestRouter } from '@/app/router';
import { server } from '@/mocks/server';
import { CourseDiffViewerModal } from '@/features/course-review/components/CourseDiffViewerModal';
import type { User } from '@/core/auth/types';

const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
const lecturerUser = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;

function renderAppWithRoute(initialRoute: string, user: User = adminUser) {
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

describe('Increment 9 — Review Workflow Demo Data Seeding & End-to-End Consistency', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  beforeEach(() => {
    server.resetHandlers();
    // Resetting store with default options seeds the deterministic demo courses
    inMemoryStore.reset();
  });
  afterEach(() => {
    server.resetHandlers();
    authStorage.clearSession();
  });
  afterAll(() => server.close());

  describe('1. Administrator Approvals Dashboard & Queue Seeding', () => {
    it('admin account sees both kinds of pending submissions in FIFO order with proper type badges', async () => {
      renderAppWithRoute('/approvals', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('admin-approvals-view')).toBeInTheDocument();
        expect(screen.getByTestId('admin-queue-table')).toBeInTheDocument();
      });

      // 1. New course awaiting first review
      expect(screen.getByTestId('queue-row-CRS-REV-NEW-01')).toBeInTheDocument();
      expect(screen.getByTestId('badge-type-CRS-REV-NEW-01')).toHaveTextContent('جديد');
      expect(screen.getByText('إجراءات الطوارئ ومكافحة الحرائق في محطات وأنفاق المترو')).toBeInTheDocument();

      // 2. Published course update awaiting approval
      expect(screen.getByTestId('queue-row-CRS-REV-UPD-02')).toBeInTheDocument();
      expect(screen.getByTestId('badge-type-CRS-REV-UPD-02')).toHaveTextContent('تحديث لمقرر منشور');
      expect(screen.getByTestId('badge-staged-CRS-REV-UPD-02')).toHaveTextContent('مسودة تعديلات الإدارة');

      // Metric counts
      expect(screen.getByTestId('admin-stat-total')).toHaveTextContent('2');
      expect(screen.getByTestId('admin-stat-new')).toHaveTextContent('1');
      expect(screen.getByTestId('admin-stat-update')).toHaveTextContent('1');
    });

    it('admin can navigate from queue directly to Review Studio for the staged edit course', async () => {
      renderAppWithRoute('/approvals', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('review-btn-CRS-REV-UPD-02')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('review-btn-CRS-REV-UPD-02'));

      await waitFor(() => {
        expect(screen.getByTestId('course-review-page')).toBeInTheDocument();
      });

      // Curriculum navigator indicates staged edits
      expect(screen.getByTestId('nav-course-root')).toHaveTextContent('معدل');

      // Inspector diff tab displays staged admin edits
      fireEvent.click(screen.getByTestId('tab-diff'));
      expect(screen.getByText('تعديلات مسودة الإدارة النشطة')).toBeInTheDocument();
      expect(
        screen.getAllByText('صيانة أنظمة التحكم والفرامل الهوائية المتطورة للوحدات المتحركة').length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  describe('2. Lecturer Approvals Dashboard & Submission States', () => {
    it('lecturer account sees the approved, returned, and rejected demo examples belonging to them', async () => {
      renderAppWithRoute('/approvals', lecturerUser);

      await waitFor(() => {
        expect(screen.getByTestId('lecturer-approvals-view')).toBeInTheDocument();
        expect(screen.getByTestId('lecturer-submissions-table')).toBeInTheDocument();
      });

      // Pending courses
      expect(screen.getByTestId('status-badge-CRS-REV-NEW-01')).toHaveTextContent('قيد المراجعة');
      expect(screen.getByTestId('status-badge-CRS-REV-UPD-02')).toHaveTextContent('قيد المراجعة');

      // Returned with admin edits
      expect(screen.getByTestId('status-badge-CRS-REV-RET-03')).toHaveTextContent('تتطلب تعديلات');
      expect(screen.getByTestId('feedback-summary-CRS-REV-RET-03')).toHaveTextContent('تمت مراجعة الحقيبة التدريبية');

      // Rejected
      expect(screen.getByTestId('status-badge-CRS-REV-REJ-04')).toHaveTextContent('تتطلب تعديلات');
      expect(screen.getByTestId('feedback-summary-CRS-REV-REJ-04')).toHaveTextContent('يتطلب المقرر مراجعة جذرية');

      // Approved & published
      expect(screen.getByTestId('status-badge-CRS-REV-APP-05')).toHaveTextContent('معتمد ومنشور');

      // Metric cards
      expect(screen.getByTestId('lecturer-stat-pending')).toHaveTextContent('2');
      expect(screen.getByTestId('lecturer-stat-needs-revision')).toHaveTextContent('2');
      expect(screen.getByTestId('lecturer-stat-approved')).toHaveTextContent(/[1-9]/);
    });

    it('filters lecturer submissions across tabs seamlessly', async () => {
      renderAppWithRoute('/approvals', lecturerUser);

      await waitFor(() => {
        expect(screen.getByTestId('lecturer-submissions-table')).toBeInTheDocument();
      });

      // Switch to "تتطلب تعديلات"
      fireEvent.click(screen.getByTestId('lecturer-filter-needs-revision'));
      expect(screen.getByTestId('submission-row-CRS-REV-RET-03')).toBeInTheDocument();
      expect(screen.getByTestId('submission-row-CRS-REV-REJ-04')).toBeInTheDocument();
      expect(screen.queryByTestId('submission-row-CRS-REV-NEW-01')).not.toBeInTheDocument();

      // Switch to "معتمدة ومنشورة"
      fireEvent.click(screen.getByTestId('lecturer-filter-approved'));
      expect(screen.getByTestId('submission-row-CRS-REV-APP-05')).toBeInTheDocument();
      expect(screen.queryByTestId('submission-row-CRS-REV-RET-03')).not.toBeInTheDocument();
    });
  });

  describe('3. Isolation Guarantees & Published Course Stability', () => {
    it('leaves published base course completely unchanged while update is pending review', () => {
      const publicBase = inMemoryStore.getCourseById('CRS-REV-UPD-02');
      expect(publicBase).toBeDefined();
      expect(publicBase?.status).toBe('published');
      expect(publicBase?.isUpdatePendingApproval).toBe(true);
      expect(publicBase?.estimatedHours).toBe(10);
      expect(publicBase?.chapters).toHaveLength(2);

      // Trainees calling getCourses see the un-mutated base course
      const publishedCatalog = inMemoryStore.getCourses();
      const catalogItem = publishedCatalog.find((c) => c.id === 'CRS-REV-UPD-02');
      expect(catalogItem?.title).toBe('صيانة أنظمة التحكم والفرامل الهوائية للقطارات');
      expect(catalogItem?.estimatedHours).toBe(10);

      // Draft retrieved via getCourseForEditing contains the separate pending update curriculum
      const draft = inMemoryStore.getCourseForEditing('CRS-REV-UPD-02', lecturerUser);
      expect(draft).toBeDefined();
      expect(draft?.title).toBe('صيانة أنظمة التحكم والفرامل الهوائية للقطارات (تحديث 2026)');
      expect(draft?.estimatedHours).toBe(14);
      expect(draft?.chapters).toHaveLength(3);
    });

    it('strictly hides private reviewer working notes and uncommitted staged edits from lecturers', async () => {
      // 1. Staged edits access forbidden for lecturer
      expect(() => {
        inMemoryStore.getStagedAdminEdits('CRS-REV-UPD-02', lecturerUser);
      }).toThrow(MockStoreError);

      // 2. Working notes access forbidden for lecturer
      expect(() => {
        inMemoryStore.getReviewerWorkingNotes('CRS-REV-UPD-02', lecturerUser);
      }).toThrow(MockStoreError);

      // 3. getCourseReviewData for lecturer strips in-flight staged edits
      const reviewDataForLecturer = inMemoryStore.getCourseReviewData('CRS-REV-UPD-02', lecturerUser);
      expect(reviewDataForLecturer.stagedEdits).toBeNull();

      // 4. Admin sees staged edits
      const reviewDataForAdmin = inMemoryStore.getCourseReviewData('CRS-REV-UPD-02', adminUser);
      expect(reviewDataForAdmin.stagedEdits).not.toBeNull();
      expect(reviewDataForAdmin.stagedEdits?.patchedContent.title).toBe(
        'صيانة أنظمة التحكم والفرامل الهوائية المتطورة للوحدات المتحركة'
      );
    });
  });

  describe('4. Historical Snapshots & External Resources Diff Inspection in Demo Data', () => {
    it('returned course contains usable historical snapshots with external resources diff', () => {
      const course = inMemoryStore.getCourseById('CRS-REV-RET-03')!;
      expect(course).toBeDefined();
      expect(course.activeReviewFeedback?.outcome).toBe('returned_with_admin_edits');

      // Audit entry containing snapshots
      const returnAudit = course.auditLog?.find((a) => a.action === 'returned_with_admin_edits');
      expect(returnAudit).toBeDefined();
      expect(returnAudit?.baselineSnapshot).toBeDefined();
      expect(returnAudit?.adminEditedSnapshot).toBeDefined();

      const bSnap = returnAudit!.baselineSnapshot!;
      const aSnap = returnAudit!.adminEditedSnapshot!;

      // Render CourseDiffViewerModal with the seeded snapshots
      render(
        <CourseDiffViewerModal
          isOpen={true}
          onClose={vi.fn()}
          baselineSnapshot={bSnap}
          adminEditedSnapshot={aSnap}
        />
      );

      // 1. Metadata diffs
      expect(screen.getByTestId('metadata-diff-row-title')).toBeInTheDocument();
      expect(screen.getByTestId('baseline-title')).toHaveTextContent('بروتوكولات الاتصال اللاسلكي وتتبع القطارات');
      expect(screen.getByTestId('admin-title')).toHaveTextContent('بروتوكولات الاتصال اللاسلكي ونظم تتبع حركة مسار القطارات');

      // 2. Course-level external resource diff
      expect(screen.getByTestId('metadata-diff-row-externalResources')).toBeInTheDocument();
      expect(screen.getByTestId('course-resource-diffs-panel')).toBeInTheDocument();
      expect(screen.getByTestId('course-resource-diff-RES_RET_REG')).toHaveTextContent('مصدر مضاف');
      expect(screen.getByTestId('course-resource-diff-RES_RET_REG')).toHaveTextContent('دليل تنظيم الترددات اللاسلكية بهيئة مترو القاهرة');

      // 3. Lesson-level external resource diff in lessons tab
      fireEvent.click(screen.getByTestId('diff-tab-lessons'));
      expect(screen.getByTestId('lesson-diff-ITM_RET_101')).toHaveTextContent('درس معدل');
      expect(screen.getByTestId('lesson-resource-diffs-ITM_RET_101')).toHaveTextContent('المصادر المرفقة');
      expect(screen.getByTestId('lesson-resource-diff-RES_RET_TETRA')).toHaveTextContent('مضاف');
      expect(screen.getByTestId('lesson-resource-diff-RES_RET_TETRA')).toHaveTextContent('المعيار الدولي لشبكات TETRA في سكك حديد المدن');
    });

    it('Course Builder renders ActiveReviewFeedbackBanner and opens Diff Viewer for returned course', async () => {
      renderAppWithRoute('/lecturer/builder/CRS-REV-RET-03', lecturerUser);

      await waitFor(() => {
        expect(screen.getByTestId('course-builder-page')).toBeInTheDocument();
        expect(screen.getByTestId('active-review-feedback-banner')).toBeInTheDocument();
      });

      expect(screen.getByTestId('feedback-outcome-badge')).toHaveTextContent('إعادة المقرر مع تعديلات الإدارة');
      expect(screen.getByTestId('feedback-reviewer-name')).toHaveTextContent('م. محمود عبد السلام');

      // Click "عرض مقارنة تعديلات الإدارة" button
      const diffBtn = screen.getByTestId('view-admin-diff-btn');
      expect(diffBtn).toBeInTheDocument();
      fireEvent.click(diffBtn);

      await waitFor(() => {
        expect(screen.getByTestId('course-diff-viewer-modal')).toBeInTheDocument();
      });

      expect(screen.getByText('مقارنة تعديلات إدارة الجودة والتدريب (اللقطات الرسمية)')).toBeInTheDocument();
    });

    it('Course Builder displays ActiveReviewFeedbackBanner in danger mode for rejected course without diff button', async () => {
      renderAppWithRoute('/lecturer/builder/CRS-REV-REJ-04', lecturerUser);

      await waitFor(() => {
        expect(screen.getByTestId('course-builder-page')).toBeInTheDocument();
        expect(screen.getByTestId('active-review-feedback-banner')).toBeInTheDocument();
      });

      expect(screen.getByTestId('feedback-outcome-badge')).toHaveTextContent('مرفوض / يتطلب تعديلات');
      expect(screen.getByTestId('feedback-summary-message')).toHaveTextContent('يتطلب المقرر مراجعة جذرية');
      expect(screen.queryByTestId('view-admin-diff-btn')).not.toBeInTheDocument();
    });
  });
});
