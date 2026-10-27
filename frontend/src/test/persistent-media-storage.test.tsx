import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { mediaStorageService } from '@/core/storage/mediaStorageService';
import { ItemEditorModal } from '@/features/course-builder/components/ItemEditorModal';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { CONTENT_TEST_LAB_COURSE_ID } from '@/mocks/fixtures/contentLabFixture';
import type { ChapterItem, Course } from '@/core/courses/types';
import type { User } from '@/core/auth/types';

describe('Increment 8: Persistent Media Storage and Content Testing Lab', () => {
  beforeEach(async () => {
    await mediaStorageService.clearAll();
    localStorage.clear();
    inMemoryStore.reset();
  });

  afterEach(async () => {
    await mediaStorageService.clearAll();
    localStorage.clear();
  });

  describe('1. Shared Media Storage Service (IndexedDB & Fallback)', () => {
    it('stores file data in media storage and assigns a stable ID', async () => {
      const dummyBlob = new Blob(['sample-video-binary-data'], { type: 'video/mp4' });
      const asset = await mediaStorageService.saveMedia(dummyBlob, {
        fileName: 'test-track-safety.mp4',
        mimeType: 'video/mp4',
      });

      expect(asset.id).toBeDefined();
      expect(asset.id.startsWith('media_')).toBe(true);
      expect(asset.fileName).toBe('test-track-safety.mp4');
      expect(asset.fileSize).toBe(dummyBlob.size);
      expect(asset.mimeType).toBe('video/mp4');

      const retrieved = await mediaStorageService.getMedia(asset.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(asset.id);
      expect(retrieved?.fileName).toBe('test-track-safety.mp4');
    });

    it('recreates an object URL from stored media ID', async () => {
      const dummyFile = new File(['mock-stream-content'], 'operation-guide.mp4', {
        type: 'video/mp4',
      });
      const saved = await mediaStorageService.saveMedia(dummyFile);

      const objectUrl = await mediaStorageService.createMediaObjectUrl(saved.id);
      expect(objectUrl).toBeDefined();
      expect(typeof objectUrl).toBe('string');

      // Object URL can be safely revoked without deleting underlying file
      mediaStorageService.revokeMediaObjectUrl(objectUrl);
      const stillExists = await mediaStorageService.hasMedia(saved.id);
      expect(stillExists).toBe(true);
    });

    it('returns null for non-existent media IDs without throwing', async () => {
      const result = await mediaStorageService.getMedia('non_existent_id');
      expect(result).toBeNull();

      const url = await mediaStorageService.createMediaObjectUrl('non_existent_id');
      expect(url).toBeNull();
    });

    it('rejects empty files with descriptive Arabic validation error', async () => {
      const emptyBlob = new Blob([], { type: 'video/mp4' });
      await expect(mediaStorageService.saveMedia(emptyBlob)).rejects.toThrow(
        'عذراً، الملف المحدد فارغ أو غير صالح للحفظ.'
      );
    });

    it('deletes stored media when explicitly removed', async () => {
      const file = new File(['content'], 'to-delete.mp4', { type: 'video/mp4' });
      const saved = await mediaStorageService.saveMedia(file);

      expect(await mediaStorageService.hasMedia(saved.id)).toBe(true);
      await mediaStorageService.deleteMedia(saved.id);
      expect(await mediaStorageService.hasMedia(saved.id)).toBe(false);
    });

    it('provides clear Arabic storage boundary notice', () => {
      const notice = mediaStorageService.getStorageBoundaryNotice();
      expect(notice).toContain('IndexedDB');
      expect(notice).toContain('محلياً داخل متصفحك');
      expect(notice).toContain('لا يتم رفع الملفات إلى خادم خارجي');
    });
  });

  describe('2. Content Editor (ItemEditorModal) Media Persistence Integration', () => {
    it('persists selected video file into media storage and attaches mediaId on save', async () => {
      const onSaveMock = vi.fn();
      const onCloseMock = vi.fn();

      render(
        <ItemEditorModal
          isOpen={true}
          chapterTitle="فصل تجارب الفيديو"
          item={null}
          onClose={onCloseMock}
          onSave={onSaveMock}
        />
      );

      // Enter title
      const titleInput = screen.getByTestId('item-title-input');
      fireEvent.change(titleInput, { target: { value: 'درس فحص السكك الحديدية المرفوع' } });

      // Upload file
      const testFile = new File(['fake-mp4-stream-data'], 'rail-inspection.mp4', {
        type: 'video/mp4',
      });
      const fileInput = screen.getByTestId('item-file-input');
      fireEvent.change(fileInput, { target: { files: [testFile] } });

      // Live preview shows the selected file name
      expect(screen.getAllByText('rail-inspection.mp4').length).toBeGreaterThanOrEqual(1);

      // Submit form
      const submitBtn = screen.getByTestId('item-save-btn');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSaveMock).toHaveBeenCalledTimes(1);
      });

      const savedItem: ChapterItem = onSaveMock.mock.calls[0][0];
      expect(savedItem.title).toBe('درس فحص السكك الحديدية المرفوع');
      expect(savedItem.mediaId).toBeDefined();
      expect(savedItem.mediaId?.startsWith('media_')).toBe(true);
      expect(savedItem.originalFileName).toBe('rail-inspection.mp4');

      // Verify the file was actually written to media storage
      const persisted = await mediaStorageService.getMedia(savedItem.mediaId!);
      expect(persisted).not.toBeNull();
      expect(persisted?.fileName).toBe('rail-inspection.mp4');
    });

    it('displays the storage boundary notice explaining local-only prototype storage', () => {
      render(
        <ItemEditorModal
          isOpen={true}
          chapterTitle="فصل عام"
          item={null}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      const notice = screen.getByTestId('storage-boundary-notice');
      expect(notice).toBeInTheDocument();
      expect(notice).toHaveTextContent('IndexedDB');
      expect(notice).toHaveTextContent('لا يقوم برفع الملفات إلى خادم خارجي');
    });

    it('recreates object URL when reopening an existing item with mediaId', async () => {
      // Pre-seed an asset in media storage
      const existingFile = new File(['preseeded-video-bytes'], 'safety-drill.mp4', {
        type: 'video/mp4',
      });
      const savedAsset = await mediaStorageService.saveMedia(existingFile);

      const existingItem: ChapterItem = {
        id: 'ITEM_EXISTING_PERSISTED',
        type: 'video',
        videoSourceType: 'upload',
        title: 'محاضرة خطة الإخلاء والإنقاذ',
        mediaId: savedAsset.id,
        originalFileName: 'safety-drill.mp4',
        fileSizeBytes: existingFile.size,
      };

      render(
        <ItemEditorModal
          isOpen={true}
          chapterTitle="فصل إجراءات الطوارئ"
          item={existingItem}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      // Reopening should preserve the filename and recreate preview
      await waitFor(() => {
        expect(screen.getAllByText('safety-drill.mp4').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('clears mediaId when the lecturer removes the uploaded file', async () => {
      const onSaveMock = vi.fn();
      const existingFile = new File(['dummy-bytes'], 'old-video.mp4', { type: 'video/mp4' });
      const saved = await mediaStorageService.saveMedia(existingFile);

      const existingItem: ChapterItem = {
        id: 'ITEM_TO_REMOVE_FILE',
        type: 'video',
        videoSourceType: 'upload',
        title: 'درس سيتم إزالة ملفه',
        mediaId: saved.id,
        originalFileName: 'old-video.mp4',
        url: 'blob:http://localhost/old-url',
      };

      render(
        <ItemEditorModal
          isOpen={true}
          chapterTitle="فصل التعديل"
          item={existingItem}
          onClose={vi.fn()}
          onSave={onSaveMock}
        />
      );

      // Click remove button
      const removeBtn = screen.getByTestId('remove-selected-file-btn');
      fireEvent.click(removeBtn);

      // Submit
      const submitBtn = screen.getByTestId('item-save-btn');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSaveMock).toHaveBeenCalled();
      });

      const updated: ChapterItem = onSaveMock.mock.calls[0][0];
      expect(updated.mediaId).toBeUndefined();
      expect(updated.originalFileName).toBeUndefined();
    });
  });

  describe('3. Dedicated Content Testing Lab Course', () => {
    const mockLecturer: User = {
      id: 'usr_lect_002',
      name: 'د. طارق الجوهري',
      email: 'lecturer@cairo-metro.com',
      role: 'lecturer',
      department: 'مركز التدريب',
      jobTitle: 'كبير مدربين',
      initials: 'د.ط',
    };

    const mockTrainee: User = {
      id: 'usr_trainee_003',
      name: 'أحمد ممدوح سالم',
      email: 'trainee@cairo-metro.com',
      role: 'user',
      department: 'صيانة الوحدات',
      jobTitle: 'فني صيانة قطارات',
      initials: 'أ.م',
    };

    it('creates and registers the demo course with correct title and isTestLab flag', () => {
      const labCourse = inMemoryStore.getCourseById(CONTENT_TEST_LAB_COURSE_ID);
      expect(labCourse).toBeDefined();
      expect(labCourse?.title).toBe('معمل تجربة المحتوى — للاختبار فقط');
      expect(labCourse?.isTestLab).toBe(true);
      expect(labCourse?.lecturerId).toBe('usr_lect_002');
    });

    it('contains all 6 representative testing scenarios', () => {
      const labCourse = inMemoryStore.getCourseById(CONTENT_TEST_LAB_COURSE_ID);
      expect(labCourse).toBeDefined();

      const allItems = labCourse!.chapters.flatMap((ch) => ch.items);

      // 1. Uploaded/local video
      const localVideo = allItems.find(
        (it) => it.type === 'video' && it.videoSourceType === 'upload'
      );
      expect(localVideo).toBeDefined();
      expect(localVideo?.url).toBe('/dev-media/test-video.mp4');

      // 2. YouTube video
      const ytVideo = allItems.find(
        (it) => it.type === 'video' && it.videoSourceType === 'youtube'
      );
      expect(ytVideo).toBeDefined();
      expect(ytVideo?.youtubeVideoId).toBe('M7lc1UVf-VE');
      expect(ytVideo?.externalUrl).toContain('youtube.com');

      // 3. Google Drive video with exact required link
      const driveVideo = allItems.find(
        (it) => it.type === 'video' && it.videoSourceType === 'drive'
      );
      expect(driveVideo).toBeDefined();
      expect(driveVideo?.driveFileId).toBe('1JGwMIY5fP3pBlPxO9J15K74Yh56BFxyx');
      expect(driveVideo?.externalUrl).toBe(
        'https://drive.google.com/file/d/1JGwMIY5fP3pBlPxO9J15K74Yh56BFxyx/view?usp=drive_link'
      );
      expect(driveVideo?.url).toBe(
        'https://drive.google.com/file/d/1JGwMIY5fP3pBlPxO9J15K74Yh56BFxyx/preview'
      );

      // 4. PDF document
      const pdfItem = allItems.find((it) => it.type === 'pdf');
      expect(pdfItem).toBeDefined();
      expect(pdfItem?.url).toBe('/dev-media/test-document.pdf');

      // 5. Image content
      const imageItem = allItems.find((it) => it.type === 'image');
      expect(imageItem).toBeDefined();

      // 6. Downloadable ZIP file
      const downloadItem = allItems.find((it) => it.type === 'zip');
      expect(downloadItem).toBeDefined();
      expect(downloadItem?.canDownload).toBe(true);
      expect(downloadItem?.downloadPolicy).toBe('immediate');

      // External learning resources (Course-level and Lesson-level)
      expect(labCourse?.externalResources && labCourse.externalResources.length >= 2).toBe(true);
      expect(localVideo?.externalResources && localVideo.externalResources.length > 0).toBe(true);
      expect(ytVideo?.externalResources && ytVideo.externalResources.length > 0).toBe(true);
      expect(driveVideo?.externalResources && driveVideo.externalResources.length > 0).toBe(true);
    });

    it('isolates the demo course from public catalog and prevents trainee enrollment', () => {
      // 1. Excluded from public getCourses()
      const publicCourses = inMemoryStore.getCourses();
      const labInPublic = publicCourses.find((c) => c.id === CONTENT_TEST_LAB_COURSE_ID);
      expect(labInPublic).toBeUndefined();

      // 2. Visible in authorized lecturer workspace
      const lecturerCourses = inMemoryStore.getLecturerCourses(mockLecturer);
      const labInLecturer = lecturerCourses.find((c) => c.id === CONTENT_TEST_LAB_COURSE_ID);
      expect(labInLecturer).toBeDefined();
      expect(labInLecturer?.title).toBe('معمل تجربة المحتوى — للاختبار فقط');

      // 3. Trainee enrollment is blocked
      expect(() => {
        inMemoryStore.enrollUser({
          courseId: CONTENT_TEST_LAB_COURSE_ID,
          userId: mockTrainee.id,
          userRole: mockTrainee.role,
        });
      }).toThrow('معمل تجريبي للمحاضرين فقط');
    });

    it('preserves draft changes across simulated reloads without silent reset', () => {
      // Lecturer saves a modified draft in the lab
      const draftChanges: Partial<Course> = {
        title: 'معمل تجربة المحتوى — تم تعديل العنوان للاختبار',
      };
      inMemoryStore.saveCourseDraft(CONTENT_TEST_LAB_COURSE_ID, draftChanges, mockLecturer);

      // Verify draft saved
      const edited = inMemoryStore.getCourseForEditing(CONTENT_TEST_LAB_COURSE_ID, mockLecturer);
      expect(edited.title).toBe('معمل تجربة المحتوى — تم تعديل العنوان للاختبار');

      // Simulate browser reload by instantiating store anew while localStorage contains saved state
      inMemoryStore.reset();
      const afterReload = inMemoryStore.getCourseForEditing(CONTENT_TEST_LAB_COURSE_ID, mockLecturer);
      expect(afterReload.title).toBe('معمل تجربة المحتوى — تم تعديل العنوان للاختبار');
    });

    it('restores the original demo fixture when explicit reset is invoked', () => {
      // Save draft modifications
      inMemoryStore.saveCourseDraft(
        CONTENT_TEST_LAB_COURSE_ID,
        { title: 'عنوان مؤقت معدل' },
        mockLecturer
      );

      // Perform explicit reset
      const restored = inMemoryStore.resetContentLabCourse(CONTENT_TEST_LAB_COURSE_ID, mockLecturer);
      expect(restored.title).toBe('معمل تجربة المحتوى — للاختبار فقط');

      // Draft state should be cleared
      const current = inMemoryStore.getCourseForEditing(CONTENT_TEST_LAB_COURSE_ID, mockLecturer);
      expect(current.title).toBe('معمل تجربة المحتوى — للاختبار فقط');
      expect(localStorage.getItem('metro_lms_lab_course_state')).toBeNull();
    });
  });
});
