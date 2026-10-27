import React from 'react';
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { reviewApi } from '@/features/course-review/api/reviewApi';
import {
  ActiveReviewFeedbackBanner,
  CourseDiffViewerModal,
} from '@/features/course-review';
import { CurriculumTreeEditor } from '@/features/course-builder/components/CurriculumTreeEditor';
import { CourseBuilderPage } from '@/pages/CourseBuilderPage';
import { AuthProvider } from '@/core/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type {
  CourseBaselineSnapshot,
  CourseActiveReviewFeedback,
  ReviewFeedbackItem,
} from '@/core/courses/types';
import type { User } from '@/core/auth/types';

const mockLecturer = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;
const mockAdmin = SYNTHETIC_DEMO_ACCOUNTS.admin.user;

const otherLecturer: User = {
  id: 'lec_other',
  name: 'د. سامي فؤاد',
  email: 'sami@metro.gov.eg',
  role: 'lecturer',
  department: 'هندسة السكة والتحكم',
  jobTitle: 'كبير محاضرين',
  initials: 'س.ف',
};

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <AuthProvider>
      <ToastProvider>
        {ui}
      </ToastProvider>
    </AuthProvider>
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  server.resetHandlers();
  inMemoryStore.reset();
  authStorage.setSession({
    token: `mock_jwt_${mockLecturer.id}_test`,
    user: mockLecturer,
    expiresAt: Date.now() + 3600000,
  });
});
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
});
afterAll(() => server.close());

describe('Increment 9 — Phase 7: Lecturer Course Builder Feedback & Dual-Snapshot Diff Viewer', () => {
  // Helper to create valid baseline and admin snapshots
  const createSnapshotsFixture = (): {
    baseline: CourseBaselineSnapshot;
    adminEdited: CourseBaselineSnapshot;
  } => {
    const baseline: CourseBaselineSnapshot = {
      id: 'CRS_DIFF_01',
      title: 'صيانة خطوط الجهد العالي - مسودة أولى',
      description: 'دورة تمهيدية في صيانة الخطوط الهوائية للمترو',
      level: 'مبتدئ',
      estimatedHours: 12,
      coverType: 'color',
      coverColor: '#003366',
      targetJobTitles: ['فني صيانة'],
      courseZipPolicy: 'disabled',
      capturedAt: '2026-10-18T10:00:00.000Z',
      submittedAt: '2026-10-18T10:00:00.000Z',
      chapters: [
        {
          id: 'CH01',
          title: 'الفصل الأول: أسس السلامة الكهربائية',
          order: 1,
          items: [
            {
              id: 'ITM01',
              title: 'إجراءات العزل الأرضي',
              type: 'video',
              duration: '15:00',
              downloadPolicy: 'never',
            },
            {
              id: 'ITM02',
              title: 'دليل مهمات الوقاية الشخصية',
              type: 'pdf',
              downloadPolicy: 'immediate',
            },
          ],
        },
        {
          id: 'CH02',
          title: 'الفصل الثاني: خطوط التغذية الهوائية',
          order: 2,
          items: [
            {
              id: 'ITM03',
              title: 'مخطط شبكة الخط الثالث',
              type: 'image',
              downloadPolicy: 'immediate',
            },
          ],
        },
      ],
    };

    const adminEdited: CourseBaselineSnapshot = {
      id: 'CRS_DIFF_01',
      title: 'صيانة خطوط الجهد العالي - النسخة المعتمدة والمعدلة',
      description: 'دورة متقدمة في هندسة صيانة الخطوط الهوائية وتوزيع القدرة',
      level: 'متوسط',
      estimatedHours: 16,
      coverType: 'color',
      coverColor: '#1E3A8A',
      targetJobTitles: ['فني صيانة', 'مهندس صيانة كهربائية'],
      courseZipPolicy: 'immediate',
      capturedAt: '2026-10-19T14:30:00.000Z',
      submittedAt: '2026-10-18T10:00:00.000Z',
      chapters: [
        {
          id: 'CH01',
          title: 'الفصل الأول: معايير السلامة المهنية المحدثة',
          order: 1,
          items: [
            {
              id: 'ITM01',
              title: 'إجراءات العزل الأرضي القياسية',
              type: 'video',
              duration: '20:00',
              downloadPolicy: 'immediate',
            },
            // ITM02 removed by admin
          ],
        },
        {
          id: 'CH02',
          title: 'الفصل الثاني: خطوط التغذية الهوائية',
          order: 2,
          items: [
            {
              id: 'ITM03',
              title: 'مخطط شبكة الخط الثالث',
              type: 'image',
              downloadPolicy: 'immediate',
            },
            {
              id: 'ITM04_NEW',
              title: 'فيديو الفحص الميداني للأبراج',
              type: 'video',
              duration: '10:00',
              downloadPolicy: 'never',
            },
          ],
        },
        {
          id: 'CH03_NEW',
          title: 'الفصل الثالث: بروتوكول الطوارئ والأعطال',
          order: 3,
          items: [
            {
              id: 'ITM05_NEW',
              title: 'كتيب إرشادات الاستجابة السريعة',
              type: 'pdf',
              downloadPolicy: 'immediate',
            },
          ],
        },
      ],
    };

    return { baseline, adminEdited };
  };

  describe('1. ActiveReviewFeedbackBanner & Official Feedback Presentation', () => {
    it('renders reviewer feedback, formatted Arabic decision date, outcome badge, and summary message', () => {
      const feedback: CourseActiveReviewFeedback = {
        outcome: 'returned_with_admin_edits',
        reviewerId: 'admin_1',
        reviewerName: 'أحمد محمود',
        reviewedAt: '2026-10-19T14:30:00.000Z',
        summaryMessage: 'تمت إضافة فصل الطوارئ وتعديل مدد المحاضرات لتتوافق مع معايير السلامة.',
        items: [
          {
            targetType: 'chapter',
            targetId: 'CH01',
            comment: 'تم تحديث عنوان الفصل لمعايير السلامة.',
            severity: 'note',
          },
        ],
        stagedEditsApplied: true,
      };

      const handleOpenDiff = vi.fn();

      render(
        <ActiveReviewFeedbackBanner
          feedback={feedback}
          onOpenDiff={handleOpenDiff}
          hasSnapshots={true}
        />
      );

      // Verify outcome badge
      expect(screen.getByTestId('feedback-outcome-badge')).toHaveTextContent(
        'إعادة المقرر مع تعديلات الإدارة'
      );
      // Verify reviewer name
      expect(screen.getByTestId('feedback-reviewer-name')).toHaveTextContent('أحمد محمود');
      // Verify summary message
      expect(screen.getByTestId('feedback-summary-message')).toHaveTextContent(
        'تمت إضافة فصل الطوارئ وتعديل مدد المحاضرات لتتوافق مع معايير السلامة.'
      );
      // Verify contextual feedback notice
      expect(screen.getByTestId('feedback-contextual-notice')).toHaveTextContent(
        'توجد 1 ملاحظات تفصيلية محددة على الفصول والدروس'
      );
      // Verify diff action button
      const diffBtn = screen.getByTestId('view-admin-diff-btn');
      expect(diffBtn).toBeInTheDocument();
      fireEvent.click(diffBtn);
      expect(handleOpenDiff).toHaveBeenCalledTimes(1);
    });

    it('renders rejected outcome badge and guidance when outcome is rejected', () => {
      const feedback: CourseActiveReviewFeedback = {
        outcome: 'rejected',
        reviewerId: 'admin_1',
        reviewerName: 'أحمد محمود',
        reviewedAt: '2026-10-19T14:30:00.000Z',
        summaryMessage: 'المحتوى غير مكتمل؛ يرجى رفع ملفات PDF المذكورة في المنهج.',
        items: [],
        stagedEditsApplied: false,
      };

      render(<ActiveReviewFeedbackBanner feedback={feedback} />);

      expect(screen.getByTestId('feedback-outcome-badge')).toHaveTextContent(
        'مرفوض / يتطلب تعديلات'
      );
      expect(screen.getByTestId('feedback-summary-message')).toHaveTextContent(
        'المحتوى غير مكتمل؛ يرجى رفع ملفات PDF المذكورة في المنهج.'
      );
      // No diff button when outcome is rejected without admin edits
      expect(screen.queryByTestId('view-admin-diff-btn')).not.toBeInTheDocument();
    });

    it('handles missing dates and empty messages gracefully with neutral fallback labels without fabricating content', () => {
      const incompleteFeedback: CourseActiveReviewFeedback = {
        outcome: 'returned_with_admin_edits',
        reviewerId: 'admin_1',
        reviewerName: '',
        reviewedAt: '',
        summaryMessage: '',
        items: [],
      };

      render(<ActiveReviewFeedbackBanner feedback={incompleteFeedback} />);

      expect(screen.getByTestId('feedback-reviewer-name')).toHaveTextContent('غير متوفر');
      expect(screen.getByTestId('feedback-decision-date')).toHaveTextContent('تاريخ القرار: غير متوفر');
      expect(screen.getByTestId('feedback-summary-message')).toHaveTextContent(
        'لا توجد رسالة ملاحظات تفصيلية مسجلة.'
      );
    });
  });

  describe('2. Dual-Snapshot Diff Viewer (CourseDiffViewerModal)', () => {
    it('accurately identifies and highlights metadata changes between baseline and admin snapshots', () => {
      const { baseline, adminEdited } = createSnapshotsFixture();
      const handleClose = vi.fn();

      render(
        <CourseDiffViewerModal
          isOpen={true}
          onClose={handleClose}
          baselineSnapshot={baseline}
          adminEditedSnapshot={adminEdited}
        />
      );

      // Verify title diff
      expect(screen.getByTestId('baseline-title')).toHaveTextContent(
        'صيانة خطوط الجهد العالي - مسودة أولى'
      );
      expect(screen.getByTestId('admin-title')).toHaveTextContent(
        'صيانة خطوط الجهد العالي - النسخة المعتمدة والمعدلة'
      );

      // Verify level diff
      expect(screen.getByTestId('baseline-level')).toHaveTextContent('مبتدئ');
      expect(screen.getByTestId('admin-level')).toHaveTextContent('متوسط');

      // Verify estimated hours diff
      expect(screen.getByTestId('baseline-estimatedHours')).toHaveTextContent('12 ساعة');
      expect(screen.getByTestId('admin-estimatedHours')).toHaveTextContent('16 ساعة');

      // Total diff counter
      const totalCount = screen.getByTestId('total-diff-count');
      expect(Number(totalCount.textContent)).toBeGreaterThan(0);
    });

    it('accurately identifies chapter additions, removals, and modifications', () => {
      const { baseline, adminEdited } = createSnapshotsFixture();

      render(
        <CourseDiffViewerModal
          isOpen={true}
          onClose={vi.fn()}
          baselineSnapshot={baseline}
          adminEditedSnapshot={adminEdited}
        />
      );

      // Switch to chapters tab
      fireEvent.click(screen.getByTestId('diff-tab-chapters'));

      // CH01 was modified
      const ch1Diff = screen.getByTestId('chapter-diff-CH01');
      expect(ch1Diff).toHaveTextContent('فصل معدل');
      expect(ch1Diff).toHaveTextContent('الفصل الأول: أسس السلامة الكهربائية');
      expect(ch1Diff).toHaveTextContent('الفصل الأول: معايير السلامة المهنية المحدثة');

      // CH03_NEW was added
      const ch3Diff = screen.getByTestId('chapter-diff-CH03_NEW');
      expect(ch3Diff).toHaveTextContent('فصل مضاف');
      expect(ch3Diff).toHaveTextContent('الفصل الثالث: بروتوكول الطوارئ والأعطال');
    });

    it('accurately identifies lesson item additions, removals, and modifications', () => {
      const { baseline, adminEdited } = createSnapshotsFixture();

      render(
        <CourseDiffViewerModal
          isOpen={true}
          onClose={vi.fn()}
          baselineSnapshot={baseline}
          adminEditedSnapshot={adminEdited}
        />
      );

      // Switch to lessons tab
      fireEvent.click(screen.getByTestId('diff-tab-lessons'));

      // ITM01 modified (duration 15:00 -> 20:00, policy never -> always)
      const itm1Diff = screen.getByTestId('lesson-diff-ITM01');
      expect(itm1Diff).toHaveTextContent('درس معدل');
      expect(itm1Diff).toHaveTextContent('15:00');
      expect(itm1Diff).toHaveTextContent('20:00');

      // ITM02 was removed
      const itm2Diff = screen.getByTestId('lesson-diff-ITM02');
      expect(itm2Diff).toHaveTextContent('درس محذوف');

      // ITM04_NEW was added
      const itm4Diff = screen.getByTestId('lesson-diff-ITM04_NEW');
      expect(itm4Diff).toHaveTextContent('درس مضاف');
      expect(itm4Diff).toHaveTextContent('فيديو الفحص الميداني للأبراج');
    });

    it('renders zero changes notice when baseline and admin snapshots are identical', () => {
      const { baseline } = createSnapshotsFixture();

      render(
        <CourseDiffViewerModal
          isOpen={true}
          onClose={vi.fn()}
          baselineSnapshot={baseline}
          adminEditedSnapshot={baseline}
        />
      );

      expect(screen.getByTestId('no-changes-notice')).toHaveTextContent('لا توجد أي تغييرات مرصودة');
      expect(screen.getByTestId('total-diff-count')).toHaveTextContent('0');
    });

    it('handles missing snapshot fallbacks gracefully without crashing', () => {
      render(
        <CourseDiffViewerModal
          isOpen={true}
          onClose={vi.fn()}
          baselineSnapshot={null}
          adminEditedSnapshot={null}
        />
      );

      expect(screen.getByTestId('missing-snapshots-notice')).toHaveTextContent(
        'اللقطات التاريخية للمقرر غير متوفرة بالكامل'
      );
    });

    it('accurately identifies and displays course-level external resource additions, removals, and modifications', () => {
      const { baseline } = createSnapshotsFixture();

      // Baseline has 1 resource
      const baselineWithRes: CourseBaselineSnapshot = {
        ...baseline,
        externalResources: [
          {
            id: 'RES_BASE_01',
            title: 'دليل السلامة الميدانية 2025',
            url: 'https://cairo-metro.gov.eg/docs/safety-v1.pdf',
            order: 1,
          },
          {
            id: 'RES_BASE_02',
            title: 'لوائح التشغيل القديمة',
            url: 'https://cairo-metro.gov.eg/docs/rules-old.pdf',
            order: 2,
          },
        ],
      };

      // Admin snapshot:
      // RES_BASE_01: modified (title and URL updated)
      // RES_BASE_02: removed
      // RES_ADMIN_03: added
      const adminEditedWithRes: CourseBaselineSnapshot = {
        ...baseline,
        externalResources: [
          {
            id: 'RES_BASE_01',
            title: 'دليل السلامة الميدانية المعتمد 2026',
            url: 'https://cairo-metro.gov.eg/docs/safety-v2-certified.pdf',
            order: 1,
          },
          {
            id: 'RES_ADMIN_03',
            title: 'بوابة لوائح هيئة الأنفاق الرسمية',
            url: 'https://cairo-metro.gov.eg/portal/regulations',
            order: 2,
          },
        ],
      };

      render(
        <CourseDiffViewerModal
          isOpen={true}
          onClose={vi.fn()}
          baselineSnapshot={baselineWithRes}
          adminEditedSnapshot={adminEditedWithRes}
        />
      );

      // Verify metadata table shows externalResources row
      expect(screen.getByTestId('metadata-diff-row-externalResources')).toBeInTheDocument();
      expect(screen.getByTestId('baseline-externalResources')).toHaveTextContent('2 مصادر');
      expect(screen.getByTestId('admin-externalResources')).toHaveTextContent('2 مصادر');

      // Verify detailed panel renders
      const panel = screen.getByTestId('course-resource-diffs-panel');
      expect(panel).toBeInTheDocument();

      // Check modified resource
      const modDiff = screen.getByTestId('course-resource-diff-RES_BASE_01');
      expect(modDiff).toHaveTextContent('مصدر معدل');
      expect(modDiff).toHaveTextContent('دليل السلامة الميدانية المعتمد 2026');

      // Check removed resource
      const remDiff = screen.getByTestId('course-resource-diff-RES_BASE_02');
      expect(remDiff).toHaveTextContent('مصدر محذوف');
      expect(remDiff).toHaveTextContent('لوائح التشغيل القديمة');

      // Check added resource
      const addDiff = screen.getByTestId('course-resource-diff-RES_ADMIN_03');
      expect(addDiff).toHaveTextContent('مصدر مضاف');
      expect(addDiff).toHaveTextContent('بوابة لوائح هيئة الأنفاق الرسمية');
    });

    it('accurately identifies and displays lesson-level external resource additions, removals, and modifications', () => {
      const { baseline } = createSnapshotsFixture();

      // Baseline lesson has 1 resource
      const baselineSnapshot: CourseBaselineSnapshot = {
        ...baseline,
        chapters: [
          {
            id: 'CH01',
            title: 'الفصل الأول',
            order: 1,
            items: [
              {
                id: 'ITM01',
                title: 'درس إجراءات العزل',
                type: 'video',
                duration: '15:00',
                externalResources: [
                  {
                    id: 'RES_ITM_01',
                    title: 'مخطط الدائرة الكهربائية',
                    url: 'https://cairo-metro.gov.eg/circuit.pdf',
                    order: 1,
                  },
                ],
              },
            ],
          },
        ],
      };

      // Admin snapshot: modified existing resource + added new resource to the lesson
      const adminSnapshot: CourseBaselineSnapshot = {
        ...baseline,
        chapters: [
          {
            id: 'CH01',
            title: 'الفصل الأول',
            order: 1,
            items: [
              {
                id: 'ITM01',
                title: 'درس إجراءات العزل',
                type: 'video',
                duration: '15:00', // same duration
                externalResources: [
                  {
                    id: 'RES_ITM_01',
                    title: 'مخطط الدائرة الكهربائية الرقمي',
                    url: 'https://cairo-metro.gov.eg/circuit-v2.pdf',
                    order: 1,
                  },
                  {
                    id: 'RES_ITM_02',
                    title: 'فيديو توضيحي إضافي',
                    url: 'https://youtube.com/watch?v=demo',
                    order: 2,
                  },
                ],
              },
            ],
          },
        ],
      };

      render(
        <CourseDiffViewerModal
          isOpen={true}
          onClose={vi.fn()}
          baselineSnapshot={baselineSnapshot}
          adminEditedSnapshot={adminSnapshot}
        />
      );

      // Switch to lessons tab
      fireEvent.click(screen.getByTestId('diff-tab-lessons'));

      // ITM01 must be flagged as modified due to resource diffs
      const lessonRow = screen.getByTestId('lesson-diff-ITM01');
      expect(lessonRow).toHaveTextContent('درس معدل');

      // Breakdown of lesson resources
      const resContainer = screen.getByTestId('lesson-resource-diffs-ITM01');
      expect(resContainer).toHaveTextContent('المصادر المرفقة (2)');
      expect(screen.getByTestId('lesson-resource-diff-RES_ITM_01')).toHaveTextContent('معدل');
      expect(screen.getByTestId('lesson-resource-diff-RES_ITM_02')).toHaveTextContent('مضاف');
    });

    it('gracefully handles legacy snapshots without externalResources field and reports zero resource diffs', () => {
      const { baseline } = createSnapshotsFixture();

      // Legacy snapshot without externalResources property
      const legacyBaseline: CourseBaselineSnapshot = {
        ...baseline,
        externalResources: undefined,
        chapters: [
          {
            id: 'CH01',
            title: 'الفصل الأول',
            order: 1,
            items: [
              {
                id: 'ITM01',
                title: 'درس بدون مصادر',
                type: 'video',
                duration: '15:00',
                externalResources: undefined,
              },
            ],
          },
        ],
      };

      const legacyAdmin: CourseBaselineSnapshot = {
        ...legacyBaseline,
      };

      render(
        <CourseDiffViewerModal
          isOpen={true}
          onClose={vi.fn()}
          baselineSnapshot={legacyBaseline}
          adminEditedSnapshot={legacyAdmin}
        />
      );

      expect(screen.queryByTestId('course-resource-diffs-panel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('metadata-diff-row-externalResources')).not.toBeInTheDocument();
      expect(screen.getByTestId('total-diff-count')).toHaveTextContent('0');
    });

    it('handles resource changes safely when identity is unavailable by matching on URL or title', () => {
      const { baseline } = createSnapshotsFixture();

      // Resource without `id`
      const baselineNoId: CourseBaselineSnapshot = {
        ...baseline,
        externalResources: [
          {
            id: '',
            title: 'دليل فني بدون معرف',
            url: 'https://cairo-metro.gov.eg/manual.pdf',
            order: 1,
          },
        ],
      };

      const adminEditedNoId: CourseBaselineSnapshot = {
        ...baseline,
        externalResources: [
          {
            id: '',
            title: 'دليل فني بدون معرف محدث',
            url: 'https://cairo-metro.gov.eg/manual.pdf', // matched by URL!
            order: 1,
          },
        ],
      };

      render(
        <CourseDiffViewerModal
          isOpen={true}
          onClose={vi.fn()}
          baselineSnapshot={baselineNoId}
          adminEditedSnapshot={adminEditedNoId}
        />
      );

      expect(screen.getByTestId('course-resource-diffs-panel')).toBeInTheDocument();
      expect(screen.getByTestId('course-resource-diff-res-mod-0')).toHaveTextContent('مصدر معدل');
      expect(screen.getByTestId('course-resource-diff-res-mod-0')).toHaveTextContent('دليل فني بدون معرف محدث');
    });
  });

  describe('3. Contextual Item/Chapter Feedback in CurriculumTreeEditor', () => {
    it('renders contextual feedback badge on targeted chapters and items', () => {
      const chapters = [
        {
          id: 'CH01',
          title: 'الفصل الأول: أسس ومفاهيم',
          order: 1,
          items: [
            {
              id: 'ITM01',
              title: 'درس المقدمة الأول',
              type: 'video' as const,
              duration: '10:00',
              order: 1,
            },
            {
              id: 'ITM02',
              title: 'ملف الإرشادات',
              type: 'pdf' as const,
              order: 2,
            },
          ],
        },
      ];

      const feedbackItems: ReviewFeedbackItem[] = [
        {
          targetType: 'chapter',
          targetId: 'CH01',
          comment: 'يرجى مراجعة الصياغة الفنية لعنوان هذا الفصل.',
          severity: 'required',
        },
        {
          targetType: 'item',
          targetId: 'ITM01',
          comment: 'مدة هذا الفيديو تحتاج إلى تقليص لتناسب المتدربين.',
          severity: 'suggestion',
        },
      ];

      render(
        <CurriculumTreeEditor
          chapters={chapters}
          mode="curriculum"
          feedbackItems={feedbackItems}
        />
      );

      // Verify chapter feedback badge exists
      const chBadge = screen.getByTestId('chapter-feedback-badge-CH01');
      expect(chBadge).toBeInTheDocument();
      expect(chBadge).toHaveTextContent('ملاحظة المراجع');

      // Verify item feedback badge exists on ITM01 but NOT on ITM02
      const itemBadge = screen.getByTestId('item-feedback-badge-ITM01');
      expect(itemBadge).toBeInTheDocument();
      expect(screen.queryByTestId('item-feedback-badge-ITM02')).not.toBeInTheDocument();

      // Click chapter feedback badge to inspect comment modal
      fireEvent.click(chBadge);
      expect(screen.getByTestId('contextual-feedback-modal')).toBeInTheDocument();
      expect(screen.getByTestId('contextual-feedback-comment')).toHaveTextContent(
        'يرجى مراجعة الصياغة الفنية لعنوان هذا الفصل.'
      );

      // Close modal
      fireEvent.click(screen.getByTestId('close-contextual-feedback-btn'));
      expect(screen.queryByTestId('contextual-feedback-modal')).not.toBeInTheDocument();

      // Click lesson item feedback badge
      fireEvent.click(itemBadge);
      expect(screen.getByTestId('contextual-feedback-modal')).toBeInTheDocument();
      expect(screen.getByTestId('contextual-feedback-comment')).toHaveTextContent(
        'مدة هذا الفيديو تحتاج إلى تقليص لتناسب المتدربين.'
      );
    });

    it('enforces read-only mode in CurriculumTreeEditor when readOnly=true (guards modifications during pending review)', () => {
      const chapters = [
        {
          id: 'CH01',
          title: 'الفصل الأول: أسس ومفاهيم',
          order: 1,
          items: [
            {
              id: 'ITM01',
              title: 'درس المقدمة الأول',
              type: 'video' as const,
              duration: '10:00',
              order: 1,
            },
          ],
        },
      ];

      render(
        <CurriculumTreeEditor
          chapters={chapters}
          mode="curriculum"
          readOnly={true}
        />
      );

      // Add chapter button must not be rendered
      expect(screen.queryByTestId('add-chapter-btn')).not.toBeInTheDocument();
      // Chapter controls (move, edit title, delete) must not be rendered
      expect(screen.queryByTestId('chapter-delete-CH01')).not.toBeInTheDocument();
      expect(screen.queryByTestId('chapter-edit-title-CH01')).not.toBeInTheDocument();
      // Add item button must not be rendered
      expect(screen.queryByTestId('chapter-add-item-btn-CH01')).not.toBeInTheDocument();
      // Item controls must not be rendered
      expect(screen.queryByTestId('item-delete-ITM01')).not.toBeInTheDocument();
      expect(screen.queryByTestId('item-edit-ITM01')).not.toBeInTheDocument();
    });
  });

  describe('4. Historical Snapshot Preservation & Resubmission Lifecycle', () => {
    it('preserves baseline and admin snapshots across subsequent draft updates and resubmissions', async () => {
      // Step 1: Create a draft course by lecturer
      const course = inMemoryStore.createCourse(
        {
          title: 'دورة هندسة الإشارات الميدانية',
          level: 'متوسط',
          description: 'دورة معتمدة لتدريب فنيي الإشارات',
        },
        mockLecturer
      );

      // Add an item so content eligibility passes
      course.chapters[0].items.push({
        id: 'ITM_TEST_01',
        title: 'مقدمة في صندوق الإشارات',
        type: 'video',
        duration: '10:00',
      });
      inMemoryStore.saveCourseDraft(course.id, course, mockLecturer);

      // Step 2: Lecturer submits course
      inMemoryStore.submitCourseForReview(course.id, mockLecturer);

      // Step 3: Admin stages content edits
      inMemoryStore.saveStagedAdminEdits(
        course.id,
        {
          baselineId: course.id,
          baselineSubmittedAt: course.submittedAt || new Date().toISOString(),
          clientRevision: 1,
          patch: {
            title: 'دورة هندسة الإشارات الميدانية - تعديل الجودة',
          },
        },
        mockAdmin
      );

      // Step 4: Admin executes Outcome B (return with admin edits)
      inMemoryStore.executeReviewDecision(
        course.id,
        {
          outcome: 'returned_with_admin_edits',
          summaryMessage: 'تم تعديل العنوان وإرجاع المقرر لاستكمال المحاضرات.',
          items: [],
        },
        mockAdmin
      );

      // Verify that course now has activeReviewFeedback and auditLog with snapshots
      const courseAfterReturn = inMemoryStore.getCourseById(course.id);
      expect(courseAfterReturn?.activeReviewFeedback).toBeDefined();
      expect(courseAfterReturn?.activeReviewFeedback?.outcome).toBe('returned_with_admin_edits');
      const returnedAudit = courseAfterReturn?.auditLog?.find(
        (e) => e.action === 'returned_with_admin_edits'
      );
      expect(returnedAudit).toBeDefined();
      expect(returnedAudit?.baselineSnapshot).toBeDefined();
      expect(returnedAudit?.adminEditedSnapshot).toBeDefined();

      // Step 5: Lecturer edits draft further
      const currentDraft = inMemoryStore.getCourseForEditing(course.id, mockLecturer);
      currentDraft.description = 'وصف معدل من المحاضر بعد ملاحظات الإدارة';
      inMemoryStore.saveCourseDraft(course.id, currentDraft, mockLecturer);

      // Step 6: Lecturer resubmits course
      const resubmitResult = inMemoryStore.submitCourseForReview(course.id, mockLecturer);
      expect(resubmitResult.action).toBe('resubmitted');

      // Verify that original baseline and admin-edited snapshots from earlier decision SURVIVED
      const courseAfterResubmit = inMemoryStore.getCourseById(course.id);
      const preservedAuditEntry = courseAfterResubmit?.auditLog?.find(
        (e) => e.action === 'returned_with_admin_edits'
      );
      expect(preservedAuditEntry?.baselineSnapshot).toBeDefined();
      expect(preservedAuditEntry?.adminEditedSnapshot).toBeDefined();
      expect(preservedAuditEntry?.baselineSnapshot?.title).toBe('دورة هندسة الإشارات الميدانية');
      expect(preservedAuditEntry?.adminEditedSnapshot?.title).toBe(
        'دورة هندسة الإشارات الميدانية - تعديل الجودة'
      );

      // And resubmission audit was added
      const resubmittedAudit = courseAfterResubmit?.auditLog?.find(
        (e) => e.action === 'resubmitted'
      );
      expect(resubmittedAudit).toBeDefined();
    });
  });

  describe('5. Privacy Boundaries & Ownership Enforcement', () => {
    it('prevents lecturers from accessing private reviewer working notes (returns 403)', async () => {
      const course = inMemoryStore.createCourse(
        { title: 'دورة سرية للاختبار', level: 'مبتدئ', description: 'وصف الدورة' },
        mockLecturer
      );

      // Lecturer attempts to fetch private working notes
      await expect(reviewApi.getReviewerWorkingNotes(course.id)).rejects.toMatchObject({
        status: 403,
      });

      // Lecturer attempts to save private working notes
      await expect(
        reviewApi.saveReviewerWorkingNotes(course.id, {
          courseId: course.id,
          generalNote: 'محاولة اختراق الملاحظات',
        })
      ).rejects.toMatchObject({
        status: 403,
      });

      // Lecturer attempts to delete private working notes
      await expect(
        reviewApi.deleteReviewerWorkingNote(course.id, 'general', 'main')
      ).rejects.toMatchObject({
        status: 403,
      });
    });

    it('prevents unauthorized lecturers from inspecting another lecturer course review data (returns 403)', async () => {
      const course = inMemoryStore.createCourse(
        { title: 'دورة خاصة بمحاضر آخر', level: 'مبتدئ', description: 'وصف الدورة' },
        otherLecturer
      );

      // Current user in authStorage is mockLecturer, course belongs to otherLecturer
      await expect(reviewApi.getCourseReviewData(course.id)).rejects.toMatchObject({
        status: 403,
      });
    });

    it('never exposes uncommitted in-flight staged admin edits to the lecturer', async () => {
      const course = inMemoryStore.createCourse(
        { title: 'دورة مسودة للاختبار', level: 'مبتدئ', description: 'وصف الدورة' },
        mockLecturer
      );
      course.chapters[0].items.push({
        id: 'ITM_01',
        title: 'درس',
        type: 'video',
        duration: '10:00',
      });
      inMemoryStore.saveCourseDraft(course.id, course, mockLecturer);
      inMemoryStore.submitCourseForReview(course.id, mockLecturer);

      // Admin creates uncommitted staged edits
      inMemoryStore.saveStagedAdminEdits(
        course.id,
        {
          baselineId: course.id,
          baselineSubmittedAt: course.submittedAt || new Date().toISOString(),
          clientRevision: 1,
          patch: { title: 'تعديل سري غير معتمد' },
        },
        mockAdmin
      );

      // Lecturer fetches review data
      const lecturerReviewData = inMemoryStore.getCourseReviewData(course.id, mockLecturer);
      // stagedEdits MUST be null for lecturer
      expect(lecturerReviewData.stagedEdits).toBeNull();
      // Effective content must remain the submitted content for lecturer
      expect(lecturerReviewData.effectiveContent.title).toBe('دورة مسودة للاختبار');
    });
  });

  describe('6. CourseBuilderPage Integration with Feedback & Pending Review Guard', () => {
    it('displays pending review banner and disables editing when course status is pending_admin', async () => {
      const course = inMemoryStore.createCourse(
        { title: 'دورة قيد المراجعة', level: 'مبتدئ', description: 'وصف الدورة' },
        mockLecturer
      );
      course.chapters[0].items.push({
        id: 'ITM_P1',
        title: 'درس تجريبي',
        type: 'video',
        duration: '10:00',
      });
      inMemoryStore.saveCourseDraft(course.id, course, mockLecturer);
      inMemoryStore.submitCourseForReview(course.id, mockLecturer);

      renderWithProviders(
        <MemoryRouter initialEntries={[`/lecturer/builder/${course.id}`]}>
          <Routes>
            <Route path="/lecturer/builder/:courseId" element={<CourseBuilderPage />} />
          </Routes>
        </MemoryRouter>
      );

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.getByTestId('pending-review-banner')).toBeInTheDocument();
      });

      // Verify pending review guidance text
      expect(screen.getByTestId('pending-review-banner')).toHaveTextContent(
        'المقرر قيد المراجعة والاعتماد حالياً لدى إدارة التدريب والجودة ولا يمكن تعديله حتى صدور القرار الرسمي.'
      );

      // Verify save draft button is disabled
      const saveDraftBtn = screen.getByTestId('save-draft-btn');
      expect(saveDraftBtn).toBeDisabled();

      // Submit button should NOT be present while pending review
      expect(screen.queryByTestId('builder-submit-for-review-btn')).not.toBeInTheDocument();
    });

    it('displays ActiveReviewFeedbackBanner in CourseBuilderPage when returned with admin edits and opens Diff Viewer', async () => {
      const course = inMemoryStore.createCourse(
        { title: 'دورة للتعديل الإداري', level: 'مبتدئ', description: 'وصف الدورة' },
        mockLecturer
      );
      course.chapters[0].items.push({
        id: 'ITM_R1',
        title: 'درس للتعديل',
        type: 'video',
        duration: '10:00',
      });
      inMemoryStore.saveCourseDraft(course.id, course, mockLecturer);
      inMemoryStore.submitCourseForReview(course.id, mockLecturer);

      inMemoryStore.saveStagedAdminEdits(
        course.id,
        {
          baselineId: course.id,
          baselineSubmittedAt: course.submittedAt || new Date().toISOString(),
          clientRevision: 1,
          patch: { title: 'دورة للتعديل الإداري - نسخة الجودة' },
        },
        mockAdmin
      );

      inMemoryStore.executeReviewDecision(
        course.id,
        {
          outcome: 'returned_with_admin_edits',
          summaryMessage: 'يرجى مراجعة التعديلات المرفقة في هيكل المقرر.',
          items: [],
        },
        mockAdmin
      );

      renderWithProviders(
        <MemoryRouter initialEntries={[`/lecturer/builder/${course.id}`]}>
          <Routes>
            <Route path="/lecturer/builder/:courseId" element={<CourseBuilderPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('active-review-feedback-banner')).toBeInTheDocument();
      });

      // Verify banner content
      expect(screen.getByTestId('feedback-outcome-badge')).toHaveTextContent(
        'إعادة المقرر مع تعديلات الإدارة'
      );
      expect(screen.getByTestId('feedback-summary-message')).toHaveTextContent(
        'يرجى مراجعة التعديلات المرفقة في هيكل المقرر.'
      );

      // Verify diff button exists and opens modal
      const viewDiffBtn = screen.getByTestId('view-admin-diff-btn');
      expect(viewDiffBtn).toBeInTheDocument();
      fireEvent.click(viewDiffBtn);

      await waitFor(() => {
        expect(screen.getByTestId('course-diff-viewer-modal')).toBeInTheDocument();
      });

      // Close modal
      fireEvent.click(screen.getByTestId('close-diff-modal-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('course-diff-viewer-modal')).not.toBeInTheDocument();
      });
    });
  });
});
