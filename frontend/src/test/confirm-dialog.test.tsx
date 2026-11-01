import { describe, it, expect, vi, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '@/mocks/server';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { CurriculumTreeEditor } from '@/features/course-builder/components/CurriculumTreeEditor';
import { CourseBuilderPage } from '@/pages/CourseBuilderPage';
import { AuthProvider } from '@/core/auth/AuthContext';
import { authStorage } from '@/core/auth/authStorage';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { User } from '@/core/auth/types';
import type { CourseChapter, Course, RefresherCourseConfig } from '@/core/courses/types';
import { builderApi } from '@/features/course-builder/services/builderApi';

// =========================================================================
// Mock Users & Fixtures
// =========================================================================
const lecturerKhaled: User = {
  id: 'USR002',
  name: 'م. خالد إبراهيم',
  email: 'khaled.ibrahim@cairo-metro.com',
  role: 'lecturer',
  jobTitle: 'مهندس تدريب أول',
  department: 'إدارة التدريب',
  initials: 'خ.إ',
};

const mockChapters: CourseChapter[] = [
  {
    id: 'CH01',
    title: 'الفصل الأول: قواعد السلامة',
    order: 1,
    items: [
      {
        id: 'IT01',
        title: 'محاضرة رقم 1',
        type: 'video',
        videoSourceType: 'upload',
      },
    ],
  },
  {
    id: 'CH02',
    title: 'الفصل الثاني: إجراءات الطوارئ',
    order: 2,
    items: [
      {
        id: 'IT02',
        title: 'دليل الطوارئ',
        type: 'pdf',
      },
    ],
  },
];

const mockBaseCourse: Course = {
  id: 'CRS_TEST_01',
  title: 'مقرر تجريبي للتحقق من نوافذ التأكيد',
  description: 'وصف تجريبي',
  lecturerId: 'USR002',
  lecturerName: 'م. خالد إبراهيم',
  status: 'draft',
  estimatedHours: 3,
  rating: 5,
  ratingCount: 1,
  enrollmentCount: 10,
  level: 'مبتدئ',
  isTestLab: false,
  chapters: mockChapters,
};

const renderBuilderWithCourse = (course: Course, initialPath = `/lecturer/builder/${course.id}`) => {
  authStorage.setSession({
    token: `mock_jwt_${lecturerKhaled.id}_test`,
    user: lecturerKhaled,
    expiresAt: Date.now() + 3600000,
  });
  vi.spyOn(builderApi, 'getCourseForEditing').mockResolvedValue(course);

  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/lecturer/builder/:courseId" element={<CourseBuilderPage />} />
          <Route
            path="/lecturer/courses"
            element={<div data-testid="lecturer-courses-destination">صفحة قائمة المقررات</div>}
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
};

describe('Phase 2 Verification: Standardized ConfirmDialog & Course Authoring Flows', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });
  afterEach(() => {
    server.resetHandlers();
    authStorage.clearSession();
  });
  afterAll(() => server.close());

  // =========================================================================
  // 1. ConfirmDialog Component Unit Tests
  // =========================================================================
  describe('ConfirmDialog Unit Tests', () => {
    it('renders with custom title, message, and default action labels', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          title="تأكيد حذف المحتوى"
          message="هل تريد حذف هذا العنصر نهائياً؟"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByTestId('confirm-dialog-title')).toHaveTextContent('تأكيد حذف المحتوى');
      expect(screen.getByTestId('confirm-dialog-message')).toHaveTextContent(
        'هل تريد حذف هذا العنصر نهائياً؟'
      );
      expect(screen.getByTestId('confirm-cancel-btn')).toHaveTextContent('إلغاء');
      expect(screen.getByTestId('confirm-delete-btn')).toHaveTextContent('تأكيد');
    });

    it('renders custom confirm and cancel labels when provided', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          title="تعديلات غير محفوظة"
          message="هل تريد مغادرة الصفحة؟"
          confirmLabel="مغادرة وتجاهل التعديلات"
          cancelLabel="البقاء والمتابعة"
          variant="warning"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByTestId('confirm-cancel-btn')).toHaveTextContent('البقاء والمتابعة');
      expect(screen.getByTestId('confirm-delete-btn')).toHaveTextContent('مغادرة وتجاهل التعديلات');
    });

    it('invokes onConfirm when confirm button is clicked', () => {
      const handleConfirm = vi.fn();
      const handleCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="تأكيد العملية"
          message="رسالة توضيحية"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      );

      fireEvent.click(screen.getByTestId('confirm-delete-btn'));
      expect(handleConfirm).toHaveBeenCalledTimes(1);
      expect(handleCancel).not.toHaveBeenCalled();
    });

    it('invokes onCancel when cancel button is clicked without invoking onConfirm', () => {
      const handleConfirm = vi.fn();
      const handleCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="تأكيد العملية"
          message="رسالة توضيحية"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      );

      fireEvent.click(screen.getByTestId('confirm-cancel-btn'));
      expect(handleCancel).toHaveBeenCalledTimes(1);
      expect(handleConfirm).not.toHaveBeenCalled();
    });

    it('closes on Escape key press by inheriting from Modal', () => {
      const handleCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="تأكيد العملية"
          message="رسالة توضيحية"
          onConfirm={vi.fn()}
          onCancel={handleCancel}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleCancel).toHaveBeenCalledTimes(1);
    });

    it('does not render when isOpen is false', () => {
      render(
        <ConfirmDialog
          isOpen={false}
          title="نافذة مغلقة"
          message="لا يجب أن تظهر"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.queryByTestId('confirm-dialog-title')).not.toBeInTheDocument();
    });

    it('supports danger, warning, and info variants', () => {
      const { rerender } = render(
        <ConfirmDialog
          isOpen={true}
          title="خطر"
          message="عملية خطيرة"
          variant="danger"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      expect(screen.getByTestId('confirm-dialog-title')).toBeInTheDocument();

      rerender(
        <ConfirmDialog
          isOpen={true}
          title="تحذير"
          message="رسالة تحذيرية"
          variant="warning"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      expect(screen.getByTestId('confirm-dialog-title')).toHaveTextContent('تحذير');

      rerender(
        <ConfirmDialog
          isOpen={true}
          title="معلومة"
          message="رسالة إرشادية"
          variant="info"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      expect(screen.getByTestId('confirm-dialog-title')).toHaveTextContent('معلومة');
    });
  });

  // =========================================================================
  // 2. CourseBuilderPage Confirmation Dialogs
  // =========================================================================
  describe('CourseBuilderPage Confirmation Flows', () => {
    it('navigates immediately on back button when course has NO unsaved changes', async () => {
      renderBuilderWithCourse(mockBaseCourse);

      await waitFor(() => {
        expect(screen.getByTestId('course-builder-page')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('unsaved-badge')).not.toBeInTheDocument();

      const backBtn = screen.getByTestId('builder-back-btn');
      fireEvent.click(backBtn);

      // Navigated to lecturer courses destination directly without confirmation dialog
      expect(screen.getByTestId('lecturer-courses-destination')).toBeInTheDocument();
      expect(screen.queryByTestId('confirm-dialog-title')).not.toBeInTheDocument();
    });

    it('opens styled ConfirmDialog when back button is clicked with unsaved changes', async () => {
      renderBuilderWithCourse(mockBaseCourse);

      await waitFor(() => {
        expect(screen.getByTestId('course-builder-page')).toBeInTheDocument();
      });

      // Make a change in metadata to make the form dirty
      const titleInput = screen.getByDisplayValue(mockBaseCourse.title);
      fireEvent.change(titleInput, { target: { value: 'عنوان جديد غير محفوظ' } });

      expect(screen.getByTestId('unsaved-badge')).toBeInTheDocument();

      // Click back button
      fireEvent.click(screen.getByTestId('builder-back-btn'));

      // Confirm dialog appears
      expect(screen.getByTestId('confirm-dialog-title')).toHaveTextContent('تعديلات غير محفوظة');
      expect(screen.getByTestId('confirm-dialog-message')).toHaveTextContent(
        'لديك تعديلات غير محفوظة في منشئ المحتوى. هل تريد مغادرة الصفحة وتجاهل هذه التغييرات؟'
      );
      expect(screen.getByTestId('confirm-cancel-btn')).toHaveTextContent('البقاء والمتابعة');
      expect(screen.getByTestId('confirm-delete-btn')).toHaveTextContent('مغادرة وتجاهل التعديلات');

      // Destination screen is NOT shown yet
      expect(screen.queryByTestId('lecturer-courses-destination')).not.toBeInTheDocument();

      // Click "البقاء والمتابعة" (Cancel)
      fireEvent.click(screen.getByTestId('confirm-cancel-btn'));

      // Dialog is dismissed, user remains on builder page, dirty changes preserved
      expect(screen.queryByTestId('confirm-dialog-title')).not.toBeInTheDocument();
      expect(screen.getByTestId('course-builder-page')).toBeInTheDocument();
      expect(screen.getByDisplayValue('عنوان جديد غير محفوظ')).toBeInTheDocument();
    });

    it('navigates away when confirming exit from unsaved changes dialog', async () => {
      renderBuilderWithCourse(mockBaseCourse);

      await waitFor(() => {
        expect(screen.getByTestId('course-builder-page')).toBeInTheDocument();
      });

      // Make a change
      const titleInput = screen.getByDisplayValue(mockBaseCourse.title);
      fireEvent.change(titleInput, { target: { value: 'تعديل سيتم تجاهله' } });

      // Click back button
      fireEvent.click(screen.getByTestId('builder-back-btn'));

      expect(screen.getByTestId('confirm-dialog-title')).toHaveTextContent('تعديلات غير محفوظة');

      // Click "مغادرة وتجاهل التعديلات" (Confirm)
      fireEvent.click(screen.getByTestId('confirm-delete-btn'));

      // Successfully navigated to destination
      expect(screen.getByTestId('lecturer-courses-destination')).toBeInTheDocument();
    });

    it('opens styled ConfirmDialog on test lab reset and calls resetContentLab on confirm', async () => {
      const labCourse: Course = {
        ...mockBaseCourse,
        id: 'LAB_CRS_01',
        isTestLab: true,
      };

      const resetSpy = vi.spyOn(builderApi, 'resetContentLab').mockResolvedValue({
        course: labCourse,
        message: 'تمت إعادة ضبط معمل تجربة المحتوى لحالته الافتراضية بنجاح.',
      });

      renderBuilderWithCourse(labCourse);

      await waitFor(() => {
        expect(screen.getByTestId('reset-test-lab-btn')).toBeInTheDocument();
      });

      // Click reset lab button
      fireEvent.click(screen.getByTestId('reset-test-lab-btn'));

      // Confirm dialog appears
      expect(screen.getByTestId('confirm-dialog-title')).toHaveTextContent('إعادة ضبط معمل الاختبار');
      expect(screen.getByTestId('confirm-dialog-message')).toHaveTextContent(
        'هل أنت متأكد من رغبتك في إعادة ضبط معمل تجربة المحتوى إلى حالته الافتراضية؟'
      );
      expect(screen.getByTestId('confirm-cancel-btn')).toHaveTextContent('إلغاء');
      expect(screen.getByTestId('confirm-delete-btn')).toHaveTextContent('إعادة ضبط المعمل');

      // Test cancel: does not invoke API
      fireEvent.click(screen.getByTestId('confirm-cancel-btn'));
      expect(resetSpy).not.toHaveBeenCalled();
      expect(screen.queryByTestId('confirm-dialog-title')).not.toBeInTheDocument();

      // Open again and confirm
      fireEvent.click(screen.getByTestId('reset-test-lab-btn'));
      fireEvent.click(screen.getByTestId('confirm-delete-btn'));

      await waitFor(() => {
        expect(resetSpy).toHaveBeenCalledWith('LAB_CRS_01');
      });
    });
  });

  // =========================================================================
  // 3. CurriculumTreeEditor Inline Chapter Title Editing
  // =========================================================================
  describe('CurriculumTreeEditor Inline Chapter Title Editing', () => {
    it('opens inline input when clicking edit title button in curriculum mode', () => {
      render(
        <CurriculumTreeEditor
          chapters={mockChapters}
          onChange={vi.fn()}
          mode="curriculum"
        />
      );

      expect(screen.queryByTestId('chapter-title-input-CH01')).not.toBeInTheDocument();

      // Click edit button for Chapter 1
      fireEvent.click(screen.getByTestId('chapter-edit-title-CH01'));

      // Inline input and actions appear
      const input = screen.getByTestId('chapter-title-input-CH01') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe('الفصل الأول: قواعد السلامة');
      expect(screen.getByTestId('chapter-title-save-CH01')).toBeInTheDocument();
      expect(screen.getByTestId('chapter-title-cancel-CH01')).toBeInTheDocument();
    });

    it('cancels inline title editing without mutating chapter title', () => {
      const handleChange = vi.fn();
      render(
        <CurriculumTreeEditor
          chapters={mockChapters}
          onChange={handleChange}
          mode="curriculum"
        />
      );

      fireEvent.click(screen.getByTestId('chapter-edit-title-CH01'));

      const input = screen.getByTestId('chapter-title-input-CH01');
      fireEvent.change(input, { target: { value: 'عنوان تم التراجع عنه' } });

      // Click cancel
      fireEvent.click(screen.getByTestId('chapter-title-cancel-CH01'));

      expect(handleChange).not.toHaveBeenCalled();
      expect(screen.queryByTestId('chapter-title-input-CH01')).not.toBeInTheDocument();
      expect(screen.getByText('الفصل الأول: قواعد السلامة')).toBeInTheDocument();
    });

    it('saves updated chapter title directly when refresher is not enabled', () => {
      const handleChange = vi.fn();
      render(
        <CurriculumTreeEditor
          chapters={mockChapters}
          onChange={handleChange}
          mode="curriculum"
          refresherConfig={{ enabled: false }}
        />
      );

      fireEvent.click(screen.getByTestId('chapter-edit-title-CH01'));

      const input = screen.getByTestId('chapter-title-input-CH01');
      fireEvent.change(input, { target: { value: 'الفصل الأول: قواعد السلامة المعدلة' } });

      // Click save
      fireEvent.click(screen.getByTestId('chapter-title-save-CH01'));

      expect(handleChange).toHaveBeenCalledTimes(1);
      const updatedChapters = handleChange.mock.calls[0][0];
      expect(updatedChapters[0].title).toBe('الفصل الأول: قواعد السلامة المعدلة');
      expect(screen.queryByTestId('confirm-dialog-title')).not.toBeInTheDocument();
    });

    it('warns with ConfirmDialog when editing a chapter title with active Refresher impact', () => {
      const handleChange = vi.fn();
      // Configure refresher with enabled = true and item IT01 enabled in refresher
      const refresherConfig: RefresherCourseConfig = {
        enabled: true,
        items: {
          IT01: { itemId: 'IT01', isVisible: true },
        },
      };

      render(
        <CurriculumTreeEditor
          chapters={mockChapters}
          onChange={handleChange}
          mode="curriculum"
          refresherConfig={refresherConfig}
        />
      );

      fireEvent.click(screen.getByTestId('chapter-edit-title-CH01'));

      const input = screen.getByTestId('chapter-title-input-CH01');
      fireEvent.change(input, { target: { value: 'الفصل الأول: العنوان الجديد ذو التأثير' } });

      fireEvent.click(screen.getByTestId('chapter-title-save-CH01'));

      // ConfirmDialog is opened due to impact on enabled refresher version
      expect(screen.getByTestId('confirm-dialog-title')).toHaveTextContent(
        'تأثير تعديل عنوان الفصل على النسخة التذكيرية'
      );
      expect(screen.getByTestId('confirm-cancel-btn')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-delete-btn')).toHaveTextContent('تأكيد تعديل عنوان الفصل');

      // Click cancel in dialog: does not apply change
      fireEvent.click(screen.getByTestId('confirm-cancel-btn'));
      expect(handleChange).not.toHaveBeenCalled();

      // Click save again and confirm
      fireEvent.click(screen.getByTestId('chapter-edit-title-CH01'));
      fireEvent.change(screen.getByTestId('chapter-title-input-CH01'), {
        target: { value: 'الفصل الأول: العنوان الجديد ذو التأثير' },
      });
      fireEvent.click(screen.getByTestId('chapter-title-save-CH01'));
      fireEvent.click(screen.getByTestId('confirm-delete-btn'));

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange.mock.calls[0][0][0].title).toBe('الفصل الأول: العنوان الجديد ذو التأثير');
    });
  });
});
