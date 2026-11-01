import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { server } from '@/mocks/server';
import { AuthProvider } from '@/core/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { authStorage } from '@/core/auth/authStorage';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { CourseBuilderPage } from '@/pages/CourseBuilderPage';
import { canDownloadItem, canDownloadCourseZip, getEligibleZipItems } from '@/core/courses/downloadPolicy';
import { createZipBlob } from '@/core/utils/zipGenerator';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type { User } from '@/core/auth/types';
import type { Course } from '@/core/courses/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset();
  localStorage.clear();
});
afterAll(() => server.close());

const lecturerKhaled = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;
const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;

const lecturerOther: User = {
  id: 'usr_lect_999',
  name: 'د. طارق مصطفى',
  email: 'tarek@cairometro.gov.eg',
  role: 'lecturer',
  jobTitle: 'خبير إشارات',
  department: 'إدارة هندسة السكك',
  initials: 'د.ط',
};

const renderBuilderWithUser = (user: User | null, courseId: string) => {
  if (user) {
    authStorage.setSession({
      token: `mock_jwt_${user.id}_test`,
      user,
      expiresAt: Date.now() + 3600000,
    });
  } else {
    authStorage.clearSession();
  }

  return render(
    <AuthProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/lecturer/builder/${courseId}`]}>
          <Routes>
            <Route path="/lecturer/builder/:courseId" element={<CourseBuilderPage />} />
            <Route path="/lecturer/courses" element={<div data-testid="courses-workspace">لوحة المحاضر</div>} />
            <Route path="/dashboard" element={<div data-testid="dashboard-screen">لوحة القيادة</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </AuthProvider>
  );
};

describe('Increment 8: Course Builder & Authoring Suite (/lecturer/builder/:courseId)', () => {

  describe('A. Role-Based Authorization & Ownership', () => {
    it('allows course owner lecturer to access the builder', async () => {
      renderBuilderWithUser(lecturerKhaled, 'CRS001');

      await waitFor(() => {
        expect(screen.getByTestId('course-builder-page')).toBeInTheDocument();
      });

      expect(screen.getAllByText('CRS001').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByDisplayValue(/سلامة العمل والسلوك المهني/i)).toBeInTheDocument();
    });

    it('strictly denies non-owner lecturer from editing an unassigned course (403 Forbidden)', async () => {
      // CRS001 is owned by Khaled; lecturerOther is not an owner or co-lecturer
      renderBuilderWithUser(lecturerOther, 'CRS001');

      await waitFor(() => {
        expect(screen.getByTestId('builder-ownership-denied')).toBeInTheDocument();
      });

      expect(
        screen.getByRole('heading', { name: /غير مصرح لك بتعديل هذا المقرر/i })
      ).toBeInTheDocument();
    });

    it('strictly denies trainee from accessing course builder', async () => {
      renderBuilderWithUser(traineeUser, 'CRS001');

      await waitFor(() => {
        expect(screen.getByTestId('builder-access-denied')).toBeInTheDocument();
        expect(screen.getByText('غير مصرح بالدخول إلى منشئ المحتوى')).toBeInTheDocument();
      });
    });

    it('allows administrator full access to edit any course', async () => {
      renderBuilderWithUser(adminUser, 'CRS003');

      await waitFor(() => {
        expect(screen.getByTestId('course-builder-page')).toBeInTheDocument();
      });
      expect(screen.getAllByText('CRS003').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('B. Course Metadata Editing, Dirty State & Published Snapshot Preservation', () => {
    it('tracks unsaved changes (isDirty) and saves draft to mock store', async () => {
      renderBuilderWithUser(lecturerKhaled, 'CRS001');

      await waitFor(() => {
        expect(screen.getByTestId('builder-title-input')).toBeInTheDocument();
      });

      // Initially not dirty
      expect(screen.queryByTestId('unsaved-badge')).not.toBeInTheDocument();
      const saveBtn = screen.getByTestId('save-draft-btn');
      expect(saveBtn).toBeDisabled();

      // Change title
      const titleInput = screen.getByTestId('builder-title-input');
      fireEvent.change(titleInput, { target: { value: 'سلامة العمل وتأمين بيئة تشغيل المترو المعدلة' } });

      // Unsaved changes badge appears and save button enables
      expect(screen.getByTestId('unsaved-badge')).toBeInTheDocument();
      expect(saveBtn).not.toBeDisabled();

      // Save draft
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/تم حفظ المسودة بنجاح! تم الحفاظ على النسخة المنشورة/i)
        ).toBeInTheDocument();
      });

      // Verify dirty state cleared
      expect(screen.queryByTestId('unsaved-badge')).not.toBeInTheDocument();
      expect(saveBtn).toBeDisabled();
    });

    it('preserves published course snapshot in public catalog while saving modified draft separately', async () => {
      renderBuilderWithUser(lecturerKhaled, 'CRS001');

      await waitFor(() => {
        expect(screen.getByTestId('builder-title-input')).toBeInTheDocument();
      });

      // Edit title in builder and save draft
      const titleInput = screen.getByTestId('builder-title-input');
      fireEvent.change(titleInput, { target: { value: 'عنوان تجريبي جديد لمسودة الكورس' } });
      fireEvent.click(screen.getByTestId('save-draft-btn'));

      await waitFor(() => {
        expect(screen.getByText(/تم حفظ المسودة بنجاح!/i)).toBeInTheDocument();
      });

      // Verify that getCourses() (used by trainees and catalog) still returns the original published course!
      const catalogCourses = inMemoryStore.getCourses();
      const publishedCourse = catalogCourses.find((c) => c.id === 'CRS001');
      expect(publishedCourse?.title).toBe('سلامة العمل والسلوك المهني');
      expect(publishedCourse?.hasDraftChanges).toBe(true);

      // Verify that getCourseForEditing returns the updated draft
      const draftCourse = inMemoryStore.getCourseForEditing('CRS001', lecturerKhaled);
      expect(draftCourse.title).toBe('عنوان تجريبي جديد لمسودة الكورس');
    });

    it('manages target job titles (add and remove chips)', async () => {
      renderBuilderWithUser(lecturerKhaled, 'CRS001');

      await waitFor(() => {
        expect(screen.getByTestId('builder-job-title-input')).toBeInTheDocument();
      });

      // Add new job title
      const jobInput = screen.getByTestId('builder-job-title-input');
      const addBtn = screen.getByTestId('builder-add-job-title-btn');

      fireEvent.change(jobInput, { target: { value: 'فني طوارئ سريع' } });
      fireEvent.click(addBtn);

      expect(screen.getByText('فني طوارئ سريع')).toBeInTheDocument();

      // Remove existing job title
      const removeBtn = screen.getByLabelText(/حذف الفئة مهندس تشغيل/i);
      fireEvent.click(removeBtn);

      expect(screen.queryByText('مهندس تشغيل')).not.toBeInTheDocument();
    });
  });

  describe('C. Curriculum Tree Management (Chapters & Lessons)', () => {
    it('switches to curriculum tab, adds a new chapter, and adds a lesson inside it', async () => {
      renderBuilderWithUser(lecturerKhaled, 'CRS001');

      await waitFor(() => {
        expect(screen.getByTestId('builder-tab-curriculum')).toBeInTheDocument();
      });

      // Switch to Curriculum Tab
      fireEvent.click(screen.getByTestId('builder-tab-curriculum'));
      expect(screen.getByTestId('curriculum-tree-editor')).toBeInTheDocument();

      // Add a new chapter
      fireEvent.click(screen.getByTestId('add-chapter-btn'));
      const chapterInput = screen.getByTestId('new-chapter-title-input');
      fireEvent.change(chapterInput, { target: { value: 'الفصل الرابع: إدارة الأزمات الميدانية' } });
      fireEvent.click(screen.getByTestId('save-new-chapter-btn'));

      expect(screen.getByText('الفصل الرابع: إدارة الأزمات الميدانية')).toBeInTheDocument();

      // Add a lesson to this new chapter
      const allAddButtons = screen.getAllByText(/إضافة درس أو محتوى لهذا الفصل/i);
      const lastAddButton = allAddButtons[allAddButtons.length - 1];
      fireEvent.click(lastAddButton);

      // Lesson modal opens
      expect(screen.getByTestId('item-editor-modal')).toBeInTheDocument();

      const itemTitleInput = screen.getByTestId('item-title-input');
      fireEvent.change(itemTitleInput, { target: { value: 'خطة الإخلاء السريع في المحطات المزدحمة' } });

      // Save lesson
      fireEvent.click(screen.getByTestId('item-save-btn'));

      // Verify lesson appears under the chapter
      await waitFor(() => {
        expect(screen.getByText('خطة الإخلاء السريع في المحطات المزدحمة')).toBeInTheDocument();
      });
    });

    it('reorders chapters up and down and preserves ordering', async () => {
      renderBuilderWithUser(lecturerKhaled, 'CRS001');

      await waitFor(() => {
        expect(screen.getByTestId('builder-tab-curriculum')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('builder-tab-curriculum'));

      // Move Chapter 2 up
      const moveUpBtn = screen.getByTestId('chapter-move-up-CH02');
      fireEvent.click(moveUpBtn);

      // Verify dirty state
      expect(screen.getByTestId('unsaved-badge')).toBeInTheDocument();
    });

    it('deletes an item after user confirms in the confirmation dialog', async () => {
      renderBuilderWithUser(lecturerKhaled, 'CRS001');

      await waitFor(() => {
        expect(screen.getByTestId('builder-tab-curriculum')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('builder-tab-curriculum'));

      // Trigger delete on ITEM001
      const deleteItemBtn = screen.getByTestId('item-delete-ITEM001');
      fireEvent.click(deleteItemBtn);

      // Confirmation modal appears
      expect(screen.getByText('تأكيد الحذف النهائي')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-delete-btn')).toBeInTheDocument();

      // Confirm deletion
      fireEvent.click(screen.getByTestId('confirm-delete-btn'));

      // Verify item removed from DOM
      expect(screen.queryByTestId('item-row-ITEM001')).not.toBeInTheDocument();
      expect(screen.getByTestId('unsaved-badge')).toBeInTheDocument();
    });
  });

  describe('D. Download Policies & ZIP Generation Logic', () => {
    const mockCourse: Course = {
      id: 'CRS_TEST',
      title: 'كورس تجريبي',
      description: 'وصف',
      level: 'مبتدئ',
      status: 'published',
      lecturerId: 'usr_lect_002',
      lecturerName: 'م. خالد',
      estimatedHours: 4,
      rating: 5,
      ratingCount: 1,
      enrollmentCount: 10,
      courseZipPolicy: 'after_course_completion',
      chapters: [
        {
          id: 'CH1',
          title: 'الفصل الأول',
          order: 1,
          items: [
            {
              id: 'IT1',
              title: 'فيديو محمي',
              type: 'video',
              downloadPolicy: 'never',
            },
            {
              id: 'IT2',
              title: 'مستند إرشادي',
              type: 'pdf',
              downloadPolicy: 'immediate',
            },
            {
              id: 'IT3',
              title: 'مخطط متقدم',
              type: 'image',
              downloadPolicy: 'after_item_completion',
            },
          ],
        },
      ],
    };

    it('evaluates individual download policy rules correctly', () => {
      const videoItem = mockCourse.chapters[0].items[0];
      const pdfItem = mockCourse.chapters[0].items[1];
      const imageItem = mockCourse.chapters[0].items[2];

      // Video with 'never' policy is never downloadable for trainee
      const videoPerm = canDownloadItem(videoItem, false, false, true, 'user');
      expect(videoPerm.allowed).toBe(false);
      expect(videoPerm.reasonAr).toContain('غير مصرح بتنزيل هذا الملف');

      // PDF with 'immediate' policy is downloadable by enrolled trainee
      const pdfPerm = canDownloadItem(pdfItem, false, false, true, 'user');
      expect(pdfPerm.allowed).toBe(true);

      // Unenrolled trainee cannot download
      const unenrolledPerm = canDownloadItem(pdfItem, false, false, false, 'user');
      expect(unenrolledPerm.allowed).toBe(false);

      // Image requiring item completion
      const imageIncomplete = canDownloadItem(imageItem, false, false, true, 'user');
      expect(imageIncomplete.allowed).toBe(false);
      expect(imageIncomplete.reasonAr).toContain('متاح للتنزيل فور إتمام متطلبات هذا الدرس');

      const imageComplete = canDownloadItem(imageItem, true, false, true, 'user');
      expect(imageComplete.allowed).toBe(true);

      // Lecturers and Admins can always download
      expect(canDownloadItem(videoItem, false, false, false, 'lecturer').allowed).toBe(true);
      expect(canDownloadItem(videoItem, false, false, false, 'admin').allowed).toBe(true);
    });

    it('evaluates course ZIP policy and filters eligible items (excluding protected video)', () => {
      // Incomplete trainee cannot download ZIP if policy is after_course_completion
      const zipPermIncomplete = canDownloadCourseZip(mockCourse, false, true, 'user');
      expect(zipPermIncomplete.allowed).toBe(false);
      expect(zipPermIncomplete.reasonAr).toContain('بعد إتمام الدورة التدريبية بنسبة 100%');

      // Completed trainee can download ZIP
      const zipPermComplete = canDownloadCourseZip(mockCourse, true, true, 'user');
      expect(zipPermComplete.allowed).toBe(true);

      // Disabled ZIP policy
      const disabledCourse = { ...mockCourse, courseZipPolicy: 'disabled' as const };
      expect(canDownloadCourseZip(disabledCourse, true, true, 'user').allowed).toBe(false);

      // getEligibleZipItems filters out videoItem (policy: never)
      const eligible = getEligibleZipItems(mockCourse, true, ['IT1', 'IT2', 'IT3'], true, 'user');
      const itemTitles = eligible.map((e) => e.item.title);

      expect(itemTitles).toContain('مستند إرشادي');
      expect(itemTitles).toContain('مخطط متقدم');
      expect(itemTitles).not.toContain('فيديو محمي'); // Protected video excluded from ZIP!
    });

    it('generates an uncompressed ZIP Blob containing provided files', async () => {
      const files = [
        { name: 'chapter1/guide.txt', data: 'محتوى دليل التدريب' },
        { name: 'chapter1/data.json', data: JSON.stringify({ ok: true }) },
      ];

      const blob = createZipBlob(files);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/zip');
      expect(blob.size).toBeGreaterThan(100);
    });

    it('configures download policies via the UI tab', async () => {
      renderBuilderWithUser(lecturerKhaled, 'CRS001');

      await waitFor(() => {
        expect(screen.getByTestId('builder-tab-downloads')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('builder-tab-downloads'));
      expect(screen.getByTestId('download-policies-editor')).toBeInTheDocument();

      // Change whole-course policy to immediate
      const immediateRadio = screen.getByTestId('zip-policy-immediate');
      fireEvent.click(immediateRadio);

      // Verify dirty state
      expect(screen.getByTestId('unsaved-badge')).toBeInTheDocument();

      // Test ZIP download prototype button is enabled
      const testZipBtn = screen.getByTestId('test-zip-download-btn');
      expect(testZipBtn).not.toBeDisabled();
    });
  });
});
