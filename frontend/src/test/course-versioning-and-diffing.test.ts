import { describe, it, expect, beforeEach } from 'vitest';
import {
  inMemoryStore,
  MockStoreError,
} from '@/mocks/store/inMemoryStore';
import type { User } from '@/core/auth/types';
import type { ChapterItem, Course } from '@/core/courses/types';

/**
 * MetroLMS — Phase 2 / WP-2.3 / T-2.3.1: Published Course Versions & Substantive vs. Metadata Diffing
 *
 * Requirements: MFR-10, Rule B
 * Target Checkpoint: CP-007 (reserved for full WP-2.3 acceptance after T-2.3.2)
 *
 * Authoritative Coverage Matrix:
 * 1. Initial publication creates PublishedCourseVersion with versionNumber = 1 and item contentVersion = 1.
 * 2. Subsequent approved publication creates versionNumber = 2 and preserves versionNumber = 1 immutably.
 * 3. Editing or saving a draft in courseDrafts does not create a published version or affect learner progress.
 * 4. Submitting a draft for review does not create a published version or affect learner progress.
 * 5. Substantive edit to type, videoUrl, pdfUrl, mediaId, content, or durationSeconds increments contentVersion and updates contentFingerprint.
 * 6. Metadata-only edit to title, description, order, or formatted duration string preserves contentVersion, contentFingerprint, and learner completion.
 * 7. Substantive edit resets completion only for the modified item in active, unsealed attempts.
 * 8. Unchanged items in the same active attempt remain completed.
 * 9. Sealed historical attempts remain unchanged after substantive edits.
 * 10. Duplicate approval/publication protection does not create duplicate version snapshots.
 * 11. No-op publication preserves item contentVersion and learner completion.
 * 12. Multiple trainees and multiple attempts are isolated correctly when item completion is reset.
 * 13. Attempts cannot treat completion of an older contentVersion as completion of an updated item, and client-supplied draft metadata cannot spoof publishedBy/publishedAt/versionNumber/contentVersion.
 *
 * Non-execution governance note:
 * Authored under the Two-Gate Verification Governance model (WRITTEN — NOT EXECUTED).
 * Queued for consolidated execution at Phase 4 / Gate B (T-4.4.1).
 */
describe('Phase 2 — WP-2.3 / T-2.3.1: Published Course Versions & Substantive vs. Metadata Diffing (MFR-10, Rule B)', () => {
  const adminActor: User = {
    id: 'usr_admin_001',
    username: 'admin',
    email: 'admin@metro.gov.eg',
    name: 'مدير النظام',
    role: 'admin',
    department: 'الإدارة العامة للتدريب',
    jobTitle: 'مدير النظام',
  };

  const superAdminActor: User = {
    id: 'usr_super_admin_001',
    username: 'superadmin',
    email: 'superadmin@metro.gov.eg',
    name: 'المشرف الأعلى للنظام',
    role: 'super_admin',
    department: 'الإدارة العليا',
    jobTitle: 'المشرف الأعلى',
  };

  const lecturerActor: User = {
    id: 'usr_lecturer_001',
    username: 'lecturer1',
    email: 'lecturer1@metro.gov.eg',
    name: 'م. طارق عبد السلام',
    role: 'lecturer',
    department: 'التشغيل والتحكم',
    jobTitle: 'محاضر أول',
  };

  const traineeA = 'usr_trainee_001';
  const traineeB = 'usr_trainee_002';
  const traineeC = 'usr_trainee_003';

  beforeEach(() => {
    inMemoryStore.reset({ seedReviewDemo: false, seedGroupDemo: false });
  });

  /**
   * Helper to clone chapters from a course and apply a mutator to a specific itemId.
   */
  function cloneChaptersWithItemMutation(
    course: Course,
    targetItemId: string,
    mutate: (item: ChapterItem) => void
  ) {
    const cloned = JSON.parse(JSON.stringify(course.chapters)) as Course['chapters'];
    for (const ch of cloned) {
      for (const item of ch.items) {
        if (item.id === targetItemId) {
          mutate(item);
        }
      }
    }
    return cloned;
  }

  /**
   * Helper to publish a draft update on an already-published course via the authoritative review decision flow.
   */
  function publishCourseUpdateViaReview(
    courseId: string,
    draftPatch: Partial<Course>,
    approver: User = adminActor
  ) {
    inMemoryStore.saveCourseDraft(courseId, draftPatch, adminActor);
    inMemoryStore.submitCourseForReview(courseId, adminActor);
    return inMemoryStore.executeReviewDecision(
      courseId,
      {
        outcome: 'approved',
        publishOption: 'as_submitted',
        approvalNote: 'اعتماد تحديث المقرر',
      },
      approver
    );
  }

  // ── 1. Initial Publication & Baseline Seeding ──────────────────────────

  describe('1. Initial publication creates PublishedCourseVersion v1 and item contentVersion = 1', () => {
    it('1a. Pre-seeded published courses are initialized at versionNumber = 1 with item contentVersion = 1 and deterministic fingerprints', () => {
      const course = inMemoryStore.getCourseById('CRS002');
      expect(course).toBeDefined();
      expect(course!.versionNumber).toBe(1);
      expect(course!.currentVersionNumber).toBe(1);
      expect(course!.publishedAt).toBeTruthy();
      expect(course!.publishedBy).toBeTruthy();

      const versions = inMemoryStore.getPublishedCourseVersions('CRS002');
      expect(versions).toHaveLength(1);
      expect(versions[0].versionNumber).toBe(1);
      expect(versions[0].courseId).toBe('CRS002');
      expect(versions[0].items.length).toBeGreaterThan(0);

      for (const itemSnap of versions[0].items) {
        expect(itemSnap.contentVersion).toBe(1);
        expect(itemSnap.contentFingerprint).toMatch(/^fnv1a64_[0-9a-f]{16}$/);
      }

      const flatItems = inMemoryStore.getCourseItems('CRS002');
      for (const item of flatItems) {
        expect(item.contentVersion).toBe(1);
        expect(item.contentFingerprint).toBe(
          inMemoryStore.computeItemSubstantiveFingerprint(item)
        );
      }
    });

    it('1b. Newly created draft course has no published versions until approved, then creates versionNumber = 1 with item contentVersion = 1', () => {
      const newCourse = inMemoryStore.createCourse(
        {
          title: 'دورة أنظمة الجر الكهربائي الحديثة',
          description: 'وصف تفصيلي لدورة الجر الكهربائي للخطوط الثلاثة',
          level: 'متوسط',
          estimatedHours: 6,
          chapters: [
            {
              id: 'CH-NEW-1',
              title: 'الفصل الأول: أساسيات الجر',
              order: 1,
              items: [
                {
                  id: 'ITM-NEW-1',
                  title: 'الدرس الأول: محولات الجر',
                  type: 'video',
                  duration: '12:00',
                  durationSeconds: 720,
                  videoUrl: '/media/traction-01.mp4',
                },
                {
                  id: 'ITM-NEW-2',
                  title: 'الدرس الثاني: دليل الصيانة الوقائية',
                  type: 'pdf',
                  duration: '15 دقيقة',
                  pdfUrl: '/media/traction-guide.pdf',
                },
              ],
            },
          ],
        },
        lecturerActor
      );

      expect(inMemoryStore.getPublishedCourseVersions(newCourse.id)).toHaveLength(0);
      expect(inMemoryStore.getLatestPublishedCourseVersion(newCourse.id)).toBeNull();

      // Submit for review — still not published
      inMemoryStore.submitCourseForReview(newCourse.id, lecturerActor);
      expect(inMemoryStore.getPublishedCourseVersions(newCourse.id)).toHaveLength(0);

      // Approve review decision -> Version 1 created
      const decision = inMemoryStore.executeReviewDecision(
        newCourse.id,
        { outcome: 'approved', publishOption: 'as_submitted' },
        adminActor
      );
      expect(decision.course.status).toBe('published');
      expect(decision.course.versionNumber).toBe(1);
      expect(decision.course.publishedBy).toBe('usr_admin_001');

      const versions = inMemoryStore.getPublishedCourseVersions(newCourse.id);
      expect(versions).toHaveLength(1);
      expect(versions[0].versionNumber).toBe(1);
      expect(versions[0].publishedBy).toBe('usr_admin_001');
      expect(versions[0].items).toHaveLength(2);
      expect(versions[0].items[0].contentVersion).toBe(1);
      expect(versions[0].items[1].contentVersion).toBe(1);
    });
  });

  // ── 2. Immutable Version History Across Subsequent Publications ────────

  describe('2. Subsequent approved publication creates versionNumber = 2 and preserves versionNumber = 1', () => {
    it('2a. Publishing an update appends versionNumber = 2 while keeping versionNumber = 1 snapshot completely intact (both review and approval-request paths)', () => {
      const courseBefore = inMemoryStore.getCourseById('CRS002')!;
      const v1Before = inMemoryStore.getPublishedCourseVersion('CRS002', 1)!;
      expect(v1Before).not.toBeNull();
      const firstItemId = courseBefore.chapters[0].items[0].id;
      const originalFirstItemTitle = courseBefore.chapters[0].items[0].title;

      // Publish Version 2 via executeReviewDecision with a substantive videoUrl change on item 1
      const v2Chapters = cloneChaptersWithItemMutation(courseBefore, firstItemId, (item) => {
        item.title = 'عنوان محدث للنسخة الثانية';
        item.videoUrl = 'https://cdn.metro.gov.eg/videos/crs002-item1-v2.mp4';
      });
      publishCourseUpdateViaReview('CRS002', {
        title: 'سلامة الركاب — الإصدار الثاني',
        chapters: v2Chapters,
      });

      const versionsAfterV2 = inMemoryStore.getPublishedCourseVersions('CRS002');
      expect(versionsAfterV2).toHaveLength(2);

      const v1After = inMemoryStore.getPublishedCourseVersion('CRS002', 1)!;
      const v2After = inMemoryStore.getPublishedCourseVersion('CRS002', 2)!;

      // Version 1 is strictly immutable
      expect(v1After.versionNumber).toBe(1);
      expect(v1After.title).toBe(v1Before.title);
      expect(v1After.chapters[0].items[0].title).toBe(originalFirstItemTitle);
      expect(v1After.items.find((i) => i.itemId === firstItemId)?.contentVersion).toBe(1);
      expect(v1After.items.find((i) => i.itemId === firstItemId)?.contentFingerprint).toBe(
        v1Before.items.find((i) => i.itemId === firstItemId)?.contentFingerprint
      );

      // Version 2 reflects the new snapshot
      expect(v2After.versionNumber).toBe(2);
      expect(v2After.title).toBe('سلامة الركاب — الإصدار الثاني');
      expect(v2After.items.find((i) => i.itemId === firstItemId)?.contentVersion).toBe(2);

      // Publish Version 3 via the governance approval request flow (approveApprovalRequest)
      const courseV2 = inMemoryStore.getCourseById('CRS002')!;
      const v3Chapters = cloneChaptersWithItemMutation(courseV2, firstItemId, (item) => {
        item.videoUrl = 'https://cdn.metro.gov.eg/videos/crs002-item1-v3.mp4';
      });
      inMemoryStore.saveCourseDraft('CRS002', { chapters: v3Chapters }, lecturerActor);
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'courses.publish',
        capability: 'courses.publish',
        requestedBy: lecturerActor.id,
        requesterName: lecturerActor.name,
        requesterRole: lecturerActor.role,
        targetResourceId: 'CRS002',
        targetResourceName: courseV2.title,
        titleAr: 'اعتماد نشر الإصدار الثالث',
        justification: 'تحديث مادة الفيديو',
        payload: { courseId: 'CRS002' },
      });
      inMemoryStore.approveApprovalRequest(req.id, adminActor.id, 'معتمد');

      const versionsAfterV3 = inMemoryStore.getPublishedCourseVersions('CRS002');
      expect(versionsAfterV3).toHaveLength(3);
      expect(versionsAfterV3[0].versionNumber).toBe(1);
      expect(versionsAfterV3[1].versionNumber).toBe(2);
      expect(versionsAfterV3[2].versionNumber).toBe(3);
      expect(versionsAfterV3[2].items.find((i) => i.itemId === firstItemId)?.contentVersion).toBe(3);
    });
  });

  // ── 3 & 4. Draft Saving & Review Submission Isolation ──────────────────

  describe('3 & 4. Saving drafts, submitting for review, or staging admin edits never creates a published version or affects learner progress', () => {
    it('3. Editing or saving a draft in courseDrafts does not create a published version or affect learner progress', () => {
      inMemoryStore.enrollUser({ courseId: 'CRS002', userId: traineeA, userRole: 'user' });
      const items = inMemoryStore.getCourseItems('CRS002');
      const item1Id = items[0].id;
      const item2Id = items[1].id;

      inMemoryStore.markLessonComplete({ userId: traineeA, courseId: 'CRS002', itemId: item1Id });
      inMemoryStore.markLessonComplete({ userId: traineeA, courseId: 'CRS002', itemId: item2Id });

      const progBefore = inMemoryStore.getCourseProgress(traineeA, 'CRS002');
      expect(progBefore.completedItemIds).toEqual([item1Id, item2Id]);

      const course = inMemoryStore.getCourseById('CRS002')!;
      const draftChapters = cloneChaptersWithItemMutation(course, item1Id, (item) => {
        item.videoUrl = 'https://cdn.metro.gov.eg/videos/unapproved-draft-change.mp4';
        item.durationSeconds = 9999;
      });

      // Save draft only
      const saved = inMemoryStore.saveCourseDraft(
        'CRS002',
        { chapters: draftChapters },
        adminActor
      );
      expect(saved.isPublishedPreserved).toBe(true);

      // No new PublishedCourseVersion created
      const versions = inMemoryStore.getPublishedCourseVersions('CRS002');
      expect(versions).toHaveLength(1);
      expect(inMemoryStore.getCourseById('CRS002')!.versionNumber).toBe(1);

      // Learner completion is 100% untouched
      const progAfterDraft = inMemoryStore.getCourseProgress(traineeA, 'CRS002');
      expect(progAfterDraft.completedItemIds).toEqual([item1Id, item2Id]);
      expect(progAfterDraft.progressPercent).toBe(progBefore.progressPercent);
    });

    it('4. Submitting a draft for review or saving staged admin edits does not create a published version or affect learner progress', () => {
      inMemoryStore.enrollUser({ courseId: 'CRS002', userId: traineeA, userRole: 'user' });
      const items = inMemoryStore.getCourseItems('CRS002');
      const item1Id = items[0].id;

      inMemoryStore.markLessonComplete({ userId: traineeA, courseId: 'CRS002', itemId: item1Id });
      const progBefore = inMemoryStore.getCourseProgress(traineeA, 'CRS002');
      expect(progBefore.completedItemIds).toContain(item1Id);

      const course = inMemoryStore.getCourseById('CRS002')!;
      const draftChapters = cloneChaptersWithItemMutation(course, item1Id, (item) => {
        item.type = 'pdf';
        item.pdfUrl = 'https://cdn.metro.gov.eg/docs/pending-review.pdf';
      });

      inMemoryStore.saveCourseDraft('CRS002', { chapters: draftChapters }, adminActor);
      inMemoryStore.submitCourseForReview('CRS002', adminActor);

      // Stage admin edits during review without approving yet
      inMemoryStore.saveStagedAdminEdits(
        'CRS002',
        {
          baselineId: 'CRS002',
          clientRevision: 1,
          patch: {
            chapters: draftChapters,
          },
        },
        adminActor
      );

      // Still at version 1; learner completion untouched
      expect(inMemoryStore.getPublishedCourseVersions('CRS002')).toHaveLength(1);
      expect(inMemoryStore.getCourseItems('CRS002')[0].contentVersion).toBe(1);

      const progDuringReview = inMemoryStore.getCourseProgress(traineeA, 'CRS002');
      expect(progDuringReview.completedItemIds).toContain(item1Id);
      expect(progDuringReview.progressPercent).toBe(progBefore.progressPercent);
    });
  });

  // ── 5 & 6. Substantive vs. Metadata-Only Field Classification (Rule B) ─

  describe('5 & 6. Rule B Substantive vs. Metadata-Only Field Diffing', () => {
    it('5. Substantive edit to any of [type, videoUrl, pdfUrl, mediaId, content, durationSeconds] increments contentVersion and updates contentFingerprint', () => {
      const course0 = inMemoryStore.getCourseById('CRS002')!;
      const targetItemId = course0.chapters[0].items[0].id;

      const substantiveSteps: Array<{
        field: string;
        mutate: (item: ChapterItem) => void;
      }> = [
        {
          field: 'videoUrl',
          mutate: (it) => {
            it.videoUrl = 'https://cdn.metro.gov.eg/v/substantive-video-1.mp4';
          },
        },
        {
          field: 'durationSeconds',
          mutate: (it) => {
            it.durationSeconds = 1450;
          },
        },
        {
          field: 'mediaId',
          mutate: (it) => {
            it.mediaId = 'MED-ASSET-9001';
          },
        },
        {
          field: 'content',
          mutate: (it) => {
            it.content = 'محتوى نصي جوهري محدث للدرس الأول';
          },
        },
        {
          field: 'type',
          mutate: (it) => {
            it.type = 'pdf';
          },
        },
        {
          field: 'pdfUrl',
          mutate: (it) => {
            it.pdfUrl = 'https://cdn.metro.gov.eg/docs/substantive-manual-v2.pdf';
          },
        },
      ];

      let expectedVersion = 1;
      let previousFingerprint =
        inMemoryStore.getCourseItems('CRS002').find((i) => i.id === targetItemId)!
          .contentFingerprint!;

      for (const step of substantiveSteps) {
        const currentCourse = inMemoryStore.getCourseById('CRS002')!;
        const mutatedChapters = cloneChaptersWithItemMutation(
          currentCourse,
          targetItemId,
          step.mutate
        );
        publishCourseUpdateViaReview('CRS002', { chapters: mutatedChapters });
        expectedVersion += 1;

        const updatedItem = inMemoryStore
          .getCourseItems('CRS002')
          .find((i) => i.id === targetItemId)!;
        expect(updatedItem.contentVersion, `Field ${step.field} must increment contentVersion`).toBe(
          expectedVersion
        );
        expect(
          updatedItem.contentFingerprint,
          `Field ${step.field} must update contentFingerprint`
        ).not.toBe(previousFingerprint);

        const latestSnap = inMemoryStore.getLatestPublishedCourseVersion('CRS002')!;
        expect(latestSnap.versionNumber).toBe(expectedVersion);
        const snapItem = latestSnap.items.find((i) => i.itemId === targetItemId)!;
        expect(snapItem.contentVersion).toBe(expectedVersion);
        expect(snapItem.contentFingerprint).toBe(updatedItem.contentFingerprint);

        previousFingerprint = updatedItem.contentFingerprint!;
      }
    });

    it('6. Metadata-only edit to [title, description, order, duration] preserves contentVersion, contentFingerprint, and learner completion', () => {
      inMemoryStore.enrollUser({ courseId: 'CRS002', userId: traineeA, userRole: 'user' });
      const initialItems = inMemoryStore.getCourseItems('CRS002');
      const item1Id = initialItems[0].id;
      const item2Id = initialItems[1].id;
      const initialFp1 = initialItems[0].contentFingerprint;
      const initialFp2 = initialItems[1].contentFingerprint;

      inMemoryStore.markLessonComplete({ userId: traineeA, courseId: 'CRS002', itemId: item1Id });
      inMemoryStore.markLessonComplete({ userId: traineeA, courseId: 'CRS002', itemId: item2Id });

      const progBefore = inMemoryStore.getCourseProgress(traineeA, 'CRS002');
      expect(progBefore.completedItemIds).toEqual([item1Id, item2Id]);

      // Edit all 4 metadata-only fields on item 1 and item 2 and publish Version 2
      const course = inMemoryStore.getCourseById('CRS002')!;
      const metadataEditedChapters = cloneChaptersWithItemMutation(course, item1Id, (item) => {
        item.title = 'عنوان معدل لأغراض التنسيق فقط';
        item.description = 'وصف تعريفي معدل للدرس دون تغيير المحتوى الجوهري';
        item.order = 10;
        item.duration = '45 دقيقة تقريباً';
      });
      for (const ch of metadataEditedChapters) {
        for (const it of ch.items) {
          if (it.id === item2Id) {
            it.title = 'عنوان الدرس الثاني بعد تصحيح إملائي';
            it.description = 'وصف الدرس الثاني المعدل';
            it.order = 20;
            it.duration = '20:00';
          }
        }
      }

      publishCourseUpdateViaReview('CRS002', { chapters: metadataEditedChapters });

      // Course versionNumber incremented to 2, but item contentVersion & contentFingerprint stayed at 1
      const latestVersion = inMemoryStore.getLatestPublishedCourseVersion('CRS002')!;
      expect(latestVersion.versionNumber).toBe(2);

      const updatedItems = inMemoryStore.getCourseItems('CRS002');
      const updatedItem1 = updatedItems.find((i) => i.id === item1Id)!;
      const updatedItem2 = updatedItems.find((i) => i.id === item2Id)!;

      expect(updatedItem1.title).toBe('عنوان معدل لأغراض التنسيق فقط');
      expect(updatedItem1.description).toBe('وصف تعريفي معدل للدرس دون تغيير المحتوى الجوهري');
      expect(updatedItem1.order).toBe(10);
      expect(updatedItem1.duration).toBe('45 دقيقة تقريباً');
      expect(updatedItem1.contentVersion).toBe(1);
      expect(updatedItem1.contentFingerprint).toBe(initialFp1);

      expect(updatedItem2.contentVersion).toBe(1);
      expect(updatedItem2.contentFingerprint).toBe(initialFp2);

      // Learner completion is 100% preserved
      const progAfter = inMemoryStore.getCourseProgress(traineeA, 'CRS002');
      expect(progAfter.completedItemIds).toEqual([item1Id, item2Id]);
      expect(progAfter.progressPercent).toBe(progBefore.progressPercent);
      expect(progAfter.itemsProgress[item1Id]?.completed).toBe(true);
      expect(progAfter.itemsProgress[item2Id]?.completed).toBe(true);
    });
  });

  // ── 7 & 8. Selective Item Completion Reset in Active Unsealed Attempts ─

  describe('7 & 8. Selective Item Completion Reset & Unchanged Item Preservation in Active Unsealed Attempts', () => {
    it('7 & 8. Substantive edit resets completion ONLY for the modified item in active unsealed attempts while unchanged items remain completed', () => {
      inMemoryStore.enrollUser({ courseId: 'CRS002', userId: traineeA, userRole: 'user' });
      const items = inMemoryStore.getCourseItems('CRS002');
      expect(items.length).toBeGreaterThanOrEqual(2);
      const item1Id = items[0].id;
      const item2Id = items[1].id;

      // Complete all items in the course
      for (const it of items) {
        inMemoryStore.markLessonComplete({
          userId: traineeA,
          courseId: 'CRS002',
          itemId: it.id,
        });
      }

      const progBefore = inMemoryStore.getCourseProgress(traineeA, 'CRS002');
      expect(progBefore.completedItemIds).toHaveLength(items.length);
      expect(progBefore.progressPercent).toBe(100);
      expect(progBefore.isCompleted).toBe(true);

      // Substantively modify ONLY item 2 (leave item 1 and any other items unchanged)
      const course = inMemoryStore.getCourseById('CRS002')!;
      const chaptersWithItem2Changed = cloneChaptersWithItemMutation(course, item2Id, (item) => {
        item.videoUrl = 'https://cdn.metro.gov.eg/videos/crs002-item2-substantive-v2.mp4';
        item.durationSeconds = 1800;
      });

      publishCourseUpdateViaReview('CRS002', { chapters: chaptersWithItem2Changed });

      // Verify item versions
      const itemsAfter = inMemoryStore.getCourseItems('CRS002');
      expect(itemsAfter.find((i) => i.id === item1Id)?.contentVersion).toBe(1);
      expect(itemsAfter.find((i) => i.id === item2Id)?.contentVersion).toBe(2);

      // Verify learner progress: item2 reset, item1 (and any other unchanged items) preserved!
      const progAfter = inMemoryStore.getCourseProgress(traineeA, 'CRS002');
      expect(progAfter.completedItemIds).toContain(item1Id);
      expect(progAfter.completedItemIds).not.toContain(item2Id);
      expect(progAfter.completedItemIds).toHaveLength(items.length - 1);
      expect(progAfter.isCompleted).toBe(false);
      expect(progAfter.progressPercent).toBe(
        Math.round(((items.length - 1) / items.length) * 100)
      );
      expect(progAfter.itemsProgress[item1Id]?.completed).toBe(true);
      expect(progAfter.itemsProgress[item2Id]?.completed).toBe(false);

      // Verify underlying CourseAttempt status transitioned back from 'completed' to 'in_progress'
      const activeAttempt = inMemoryStore.resolveActiveAttemptForLearning({
        userId: traineeA,
        courseId: 'CRS002',
      });
      expect(activeAttempt.status).toBe('in_progress');
      expect(activeAttempt.completedAt).toBeNull();
      expect(activeAttempt.completedItemIds).toContain(item1Id);
      expect(activeAttempt.completedItemIds).not.toContain(item2Id);
    });
  });

  // ── 9. Sealed Historical Attempt Preservation ──────────────────────────

  describe('9. Sealed historical attempts remain unchanged after substantive edits', () => {
    it('9a. Renewal-cycle sealed historical attempts remain 100% completed while the new active cycle attempt is subject to Rule B resets', () => {
      // Add traineeC to group GRP-101 (which assigns CRS002)
      inMemoryStore.addGroupMember('GRP-101', traineeC);
      const items = inMemoryStore.getCourseItems('CRS002');
      const item1Id = items[0].id;
      const item2Id = items[1].id;

      // Start initial renewal cycle 1 for GRP-101
      const cycle1Res = inMemoryStore.createRenewalCycle(
        'GRP-101',
        {
          title: 'الدورة الأولى 2026',
          startDateTime: '2026-01-01T00:00:00.000Z',
          deadlineDateTime: '2026-06-01T00:00:00.000Z',
          courses: [{ courseId: 'CRS002', courseRole: 'core', order: 1 }],
        },
        adminActor
      );
      const cycle1Id = cycle1Res.newCycle.id;

      // Complete all lessons in Cycle 1 attempt
      const cycle1Attempt = inMemoryStore.resolveActiveAttemptForLearning({
        userId: traineeC,
        courseId: 'CRS002',
        groupId: 'GRP-101',
        cycleId: cycle1Id,
      });
      for (const it of items) {
        inMemoryStore.markLessonComplete({
          userId: traineeC,
          courseId: 'CRS002',
          itemId: it.id,
          attemptId: cycle1Attempt.id,
        });
      }
      expect(cycle1Attempt.status).toBe('completed');
      expect(cycle1Attempt.progressPercent).toBe(100);

      // Start Renewal Cycle 2 — this seals Cycle 1 and provisions a fresh attempt for Cycle 2
      const cycle2Res = inMemoryStore.createRenewalCycle(
        'GRP-101',
        {
          title: 'الدورة الثانية 2026',
          startDateTime: '2026-06-02T00:00:00.000Z',
          deadlineDateTime: '2026-12-31T00:00:00.000Z',
          courses: [{ courseId: 'CRS002', courseRole: 'core', order: 1 }],
        },
        adminActor
      );
      const cycle2Id = cycle2Res.newCycle.id;

      expect(inMemoryStore.isAttemptSealed(cycle1Attempt.id)).toBe(true);

      // Trainee completes item 1 and item 2 in Cycle 2 active attempt
      const cycle2Attempt = inMemoryStore.resolveActiveAttemptForLearning({
        userId: traineeC,
        courseId: 'CRS002',
        groupId: 'GRP-101',
        cycleId: cycle2Id,
      });
      expect(inMemoryStore.isAttemptSealed(cycle2Attempt.id)).toBe(false);

      inMemoryStore.markLessonComplete({
        userId: traineeC,
        courseId: 'CRS002',
        itemId: item1Id,
        attemptId: cycle2Attempt.id,
      });
      inMemoryStore.markLessonComplete({
        userId: traineeC,
        courseId: 'CRS002',
        itemId: item2Id,
        attemptId: cycle2Attempt.id,
      });

      // Publish a substantive edit to item 1
      const course = inMemoryStore.getCourseById('CRS002')!;
      const mutatedChapters = cloneChaptersWithItemMutation(course, item1Id, (item) => {
        item.videoUrl = 'https://cdn.metro.gov.eg/videos/crs002-item1-cycle2-update.mp4';
      });
      publishCourseUpdateViaReview('CRS002', { chapters: mutatedChapters });

      // Sealed Cycle 1 attempt is completely untouched!
      const sealedAttemptAfter = inMemoryStore
        .getTraineeAttempts(traineeC, 'CRS002')
        .find((a) => a.id === cycle1Attempt.id)!;
      expect(sealedAttemptAfter.status).toBe('completed');
      expect(sealedAttemptAfter.progressPercent).toBe(100);
      expect(sealedAttemptAfter.completedItemIds).toContain(item1Id);
      expect(sealedAttemptAfter.completedItemIds).toContain(item2Id);
      expect(sealedAttemptAfter.lessonProgress[item1Id]?.completed).toBe(true);

      const sealedProgAfter = inMemoryStore.getCourseProgress(traineeC, 'CRS002', {
        attemptId: cycle1Attempt.id,
      });
      expect(sealedProgAfter.progressPercent).toBe(100);
      expect(sealedProgAfter.isCompleted).toBe(true);
      expect(sealedProgAfter.completedItemIds).toContain(item1Id);

      // Active Cycle 2 attempt has item 1 reset while item 2 remains completed
      const activeProgAfter = inMemoryStore.getCourseProgress(traineeC, 'CRS002', {
        attemptId: cycle2Attempt.id,
      });
      expect(activeProgAfter.completedItemIds).not.toContain(item1Id);
      expect(activeProgAfter.completedItemIds).toContain(item2Id);
    });

    it('9b. Explicitly sealed attempt via sealAttempt() is preserved unchanged after substantive edits', () => {
      inMemoryStore.enrollUser({ courseId: 'CRS002', userId: traineeA, userRole: 'user' });
      const items = inMemoryStore.getCourseItems('CRS002');
      for (const it of items) {
        inMemoryStore.markLessonComplete({
          userId: traineeA,
          courseId: 'CRS002',
          itemId: it.id,
        });
      }

      const attempt = inMemoryStore.resolveActiveAttemptForLearning({
        userId: traineeA,
        courseId: 'CRS002',
      });
      inMemoryStore.sealAttempt(attempt.id, '2026-05-01T10:00:00.000Z');
      expect(inMemoryStore.isAttemptSealed(attempt.id)).toBe(true);
      expect(attempt.sealedCourseVersion).toBe(1);

      // Substantively modify item 1
      const course = inMemoryStore.getCourseById('CRS002')!;
      const mutatedChapters = cloneChaptersWithItemMutation(course, items[0].id, (item) => {
        item.content = 'تحديث جوهري بعد إغلاق المحاولة التاريخية';
      });
      publishCourseUpdateViaReview('CRS002', { chapters: mutatedChapters });

      const progAfter = inMemoryStore.getCourseProgress(traineeA, 'CRS002', {
        attemptId: attempt.id,
      });
      expect(progAfter.isCompleted).toBe(true);
      expect(progAfter.progressPercent).toBe(100);
      expect(progAfter.completedItemIds).toHaveLength(items.length);
    });
  });

  // ── 10 & 11. Duplicate Approval Protection & No-Op Publication ─────────

  describe('10 & 11. Duplicate approval protection and no-op publication behavior', () => {
    it('10. Duplicate approval/publication calls without a new submission or draft do not create duplicate version snapshots', () => {
      const course = inMemoryStore.getCourseById('CRS002')!;
      const item1Id = course.chapters[0].items[0].id;
      const mutatedChapters = cloneChaptersWithItemMutation(course, item1Id, (item) => {
        item.videoUrl = 'https://cdn.metro.gov.eg/videos/v2-once.mp4';
      });

      publishCourseUpdateViaReview('CRS002', { chapters: mutatedChapters }, superAdminActor);
      expect(inMemoryStore.getPublishedCourseVersions('CRS002')).toHaveLength(2);

      // Super admin invokes executeReviewDecision again on the already-published course with no pending draft/review
      inMemoryStore.executeReviewDecision(
        'CRS002',
        { outcome: 'approved', publishOption: 'as_submitted' },
        superAdminActor
      );

      // Still at 2 versions — no duplicate snapshot created
      expect(inMemoryStore.getPublishedCourseVersions('CRS002')).toHaveLength(2);
      expect(inMemoryStore.getCourseById('CRS002')!.versionNumber).toBe(2);

      // Also verify governance approval request cannot be approved twice (409 ALREADY_DECIDED)
      inMemoryStore.saveCourseDraft('CRS002', { title: 'تحديث ثالث' }, lecturerActor);
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'courses.publish',
        capability: 'courses.publish',
        requestedBy: lecturerActor.id,
        requesterName: lecturerActor.name,
        requesterRole: lecturerActor.role,
        targetResourceId: 'CRS002',
        targetResourceName: 'CRS002',
        titleAr: 'اعتماد نشر',
        justification: 'تحديث',
        payload: { courseId: 'CRS002' },
      });
      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
      expect(inMemoryStore.getPublishedCourseVersions('CRS002')).toHaveLength(3);

      expect(() => inMemoryStore.approveApprovalRequest(req.id, adminActor.id)).toThrowError(
        MockStoreError
      );
      expect(inMemoryStore.getPublishedCourseVersions('CRS002')).toHaveLength(3);
    });

    it('11. No-op publication (approved review where no items changed) preserves item contentVersion and learner completion', () => {
      inMemoryStore.enrollUser({ courseId: 'CRS002', userId: traineeA, userRole: 'user' });
      const items = inMemoryStore.getCourseItems('CRS002');
      const item1Id = items[0].id;
      inMemoryStore.markLessonComplete({ userId: traineeA, courseId: 'CRS002', itemId: item1Id });

      // Save draft and submit without changing any item fields
      publishCourseUpdateViaReview('CRS002', {
        description: 'تحديث وصف المقرر العام فقط دون لمس الدروس',
      });

      const versions = inMemoryStore.getPublishedCourseVersions('CRS002');
      expect(versions).toHaveLength(2);
      expect(versions[1].versionNumber).toBe(2);
      for (const itemSnap of versions[1].items) {
        expect(itemSnap.contentVersion).toBe(1);
      }

      const progAfter = inMemoryStore.getCourseProgress(traineeA, 'CRS002');
      expect(progAfter.completedItemIds).toContain(item1Id);
      expect(progAfter.itemsProgress[item1Id]?.completed).toBe(true);
    });
  });

  // ── 12. Multi-Trainee & Multi-Attempt Isolation ────────────────────────

  describe('12. Multiple trainees and multiple attempts are isolated correctly when item completion is reset', () => {
    it('12. Substantive edit to item 1 resets item 1 across active attempts of Trainee A and Trainee B while preserving Trainee A item 2 and Trainee B multi-group isolation', () => {
      // Trainee A: standalone enrollment in CRS002, completes item 1 and item 2
      inMemoryStore.enrollUser({ courseId: 'CRS002', userId: traineeA, userRole: 'user' });
      // Trainee B: enrolled via GRP-101 AND standalone catalog enrollment in CRS002
      inMemoryStore.addGroupMember('GRP-101', traineeB);
      inMemoryStore.enrollUser({ courseId: 'CRS002', userId: traineeB, userRole: 'user' });

      const items = inMemoryStore.getCourseItems('CRS002');
      const item1Id = items[0].id;
      const item2Id = items[1].id;

      // Trainee A completes item 1 and item 2
      inMemoryStore.markLessonComplete({ userId: traineeA, courseId: 'CRS002', itemId: item1Id });
      inMemoryStore.markLessonComplete({ userId: traineeA, courseId: 'CRS002', itemId: item2Id });

      // Trainee B has 2 eligible attempts (group GRP-101 attempt + standalone attempt)
      const traineeBEligible = inMemoryStore.getEligibleAttemptsForCourse(traineeB, 'CRS002');
      expect(traineeBEligible).toHaveLength(2);
      const traineeBGroupAttemptId = traineeBEligible.find((o) => o.kind === 'group')!.attemptId;
      const traineeBSelfAttemptId = traineeBEligible.find((o) => o.kind === 'self')!.attemptId;

      // Trainee B completes item 1 in group attempt, and completes item 1 & item 2 in standalone attempt
      inMemoryStore.markLessonComplete({
        userId: traineeB,
        courseId: 'CRS002',
        itemId: item1Id,
        attemptId: traineeBGroupAttemptId,
      });
      inMemoryStore.markLessonComplete({
        userId: traineeB,
        courseId: 'CRS002',
        itemId: item1Id,
        attemptId: traineeBSelfAttemptId,
      });
      inMemoryStore.markLessonComplete({
        userId: traineeB,
        courseId: 'CRS002',
        itemId: item2Id,
        attemptId: traineeBSelfAttemptId,
      });

      // Publish substantive edit to item 1 only
      const course = inMemoryStore.getCourseById('CRS002')!;
      const mutatedChapters = cloneChaptersWithItemMutation(course, item1Id, (item) => {
        item.videoUrl = 'https://cdn.metro.gov.eg/videos/crs002-item1-multi-isolation.mp4';
      });
      publishCourseUpdateViaReview('CRS002', { chapters: mutatedChapters });

      // Trainee A: item 1 reset, item 2 still completed
      const progA = inMemoryStore.getCourseProgress(traineeA, 'CRS002');
      expect(progA.completedItemIds).toEqual([item2Id]);

      // Trainee B Group Attempt: item 1 reset -> 0 completed items
      const progBGroup = inMemoryStore.getCourseProgress(traineeB, 'CRS002', {
        attemptId: traineeBGroupAttemptId,
      });
      expect(progBGroup.completedItemIds).toEqual([]);
      expect(progBGroup.progressPercent).toBe(0);

      // Trainee B Standalone Attempt: item 1 reset, item 2 still completed
      const progBSelf = inMemoryStore.getCourseProgress(traineeB, 'CRS002', {
        attemptId: traineeBSelfAttemptId,
      });
      expect(progBSelf.completedItemIds).toEqual([item2Id]);
    });
  });

  // ── 13. Version-Mismatch Completion Rejection & Spoofing Hardening ─────

  describe('13. Stale contentVersion completion rejection & client draft spoofing hardening', () => {
    it('13a. An active unsealed attempt cannot treat a stale LessonProgress contentVersion as completed for an updated ChapterItem, until re-completed at the new version', () => {
      inMemoryStore.enrollUser({ courseId: 'CRS002', userId: traineeA, userRole: 'user' });
      const items = inMemoryStore.getCourseItems('CRS002');
      const item1Id = items[0].id;

      const markV1 = inMemoryStore.markLessonComplete({
        userId: traineeA,
        courseId: 'CRS002',
        itemId: item1Id,
      });
      expect(markV1.completedItem.contentVersion).toBe(1);

      // Publish substantive change to item 1 -> item 1 is now contentVersion = 2
      const course = inMemoryStore.getCourseById('CRS002')!;
      const mutatedChapters = cloneChaptersWithItemMutation(course, item1Id, (item) => {
        item.durationSeconds = 3600;
      });
      publishCourseUpdateViaReview('CRS002', { chapters: mutatedChapters });

      const updatedItem1 = inMemoryStore.getCourseItems('CRS002').find((i) => i.id === item1Id)!;
      expect(updatedItem1.contentVersion).toBe(2);

      const attempt = inMemoryStore.resolveActiveAttemptForLearning({
        userId: traineeA,
        courseId: 'CRS002',
      });

      // Even if a stale LessonProgress object claiming completed: true with contentVersion: 1 is evaluated,
      // isLessonCompletedForCurrentItemVersion rejects it for an active unsealed attempt
      expect(
        inMemoryStore.isLessonCompletedForCurrentItemVersion(
          attempt,
          updatedItem1,
          {
            itemId: item1Id,
            completed: true,
            contentVersion: 1,
            lastPositionSeconds: 100,
            furthestWatchedSeconds: 100,
            updatedAt: new Date().toISOString(),
          },
          [item1Id]
        )
      ).toBe(false);

      // Re-completing the lesson stamps contentVersion = 2 and restores valid completion
      const markV2 = inMemoryStore.markLessonComplete({
        userId: traineeA,
        courseId: 'CRS002',
        itemId: item1Id,
      });
      expect(markV2.completedItem.completed).toBe(true);
      expect(markV2.completedItem.contentVersion).toBe(2);

      const progAfterRecomplete = inMemoryStore.getCourseProgress(traineeA, 'CRS002');
      expect(progAfterRecomplete.completedItemIds).toContain(item1Id);
    });

    it('13b. Client-supplied draft payloads cannot spoof publishedBy, publishedAt, versionNumber, or item contentVersion', () => {
      const course = inMemoryStore.getCourseById('CRS002')!;
      const item1Id = course.chapters[0].items[0].id;

      const spoofedChapters = cloneChaptersWithItemMutation(course, item1Id, (item) => {
        item.title = 'عنوان معدل مع محاولة تزوير رقم النسخة';
        item.contentVersion = 999;
        item.contentFingerprint = 'fnv1a64_deadbeefdeadbeef';
      });

      const draftRes = inMemoryStore.saveCourseDraft(
        'CRS002',
        {
          chapters: spoofedChapters,
          versionNumber: 777,
          currentVersionNumber: 777,
          publishedBy: 'spoofed_actor',
          publishedAt: '1999-01-01T00:00:00.000Z',
        },
        lecturerActor
      );

      // Draft sanitization stripped spoofed course version and item contentVersion
      expect(draftRes.course.versionNumber).toBe(1);
      expect(draftRes.course.publishedBy).not.toBe('spoofed_actor');
      expect(draftRes.course.chapters[0].items[0].contentVersion).toBe(1);

      // When approved by adminActor, authoritative versioning sets course versionNumber = 2,
      // publishedBy = adminActor.id, and item contentVersion = 1 (since only title changed)
      inMemoryStore.submitCourseForReview('CRS002', lecturerActor);
      const approved = inMemoryStore.executeReviewDecision(
        'CRS002',
        { outcome: 'approved', publishOption: 'as_submitted' },
        adminActor
      );

      expect(approved.course.versionNumber).toBe(2);
      expect(approved.course.publishedBy).toBe(adminActor.id);
      expect(approved.course.chapters[0].items[0].contentVersion).toBe(1);
    });
  });
});

