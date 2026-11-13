import { describe, it, expect, beforeEach } from 'vitest';
import { inMemoryStore, MockStoreError } from '@/mocks/store/inMemoryStore';
import { calculateTraineeProgress } from '@/core/domain/progress';
import type { ChapterItem, Course, CourseChapter } from '@/core/courses/types';
import type { User } from '@/core/auth/types';

/**
 * MetroLMS — Phase 2 / WP-2.3 / T-2.3.2:
 * Authoritative Progress Rounding (D-12, MFR-09) & Version-Scoped Certificate Issuance (D-13, MFR-46)
 *
 * Non-execution governance note:
 * Authored under the Two-Gate Verification Governance model.
 * Status: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B (Phase 4 / T-4.4.1).
 */
describe('Phase 2 — WP-2.3 / T-2.3.2: Authoritative Progress Rounding (D-12) & Version-Scoped Certificates (D-13, MFR-46)', () => {
  const adminUser: User = {
    id: 'usr_admin_001',
    name: 'م. أحمد محمود',
    email: 'admin@cairo-metro.gov.eg',
    role: 'admin',
    department: 'الإدارة العامة للتدريب',
    jobTitle: 'مدير عام أنظمة التشغيل',
  };

  const lecturerUser: User = {
    id: 'usr_lect_002',
    name: 'د. طارق الجوهري',
    email: 'tarek.elgohary@cairo-metro.gov.eg',
    role: 'lecturer',
    department: 'قطاع الوحدات المتحركة',
    jobTitle: 'كبير محاضري هندسة الجر',
  };

  const traineeId = 'usr_trainee_003';

  beforeEach(() => {
    inMemoryStore.reset({ seedReviewDemo: false, seedGroupDemo: false });
  });

  /**
   * Helper: creates a published course with the specified number of required items
   * and seeds its Version 1 PublishedCourseVersion snapshot.
   */
  function createPublishedCourseWithItems(courseId: string, itemCount: number, title = 'مقرر هندسة الجر الكهربائي'): Course {
    const items: ChapterItem[] = Array.from({ length: itemCount }, (_, idx) => ({
      id: `${courseId}-ITEM-${idx + 1}`,
      type: 'video',
      title: `الدرس ${idx + 1}`,
      url: `/media/${courseId.toLowerCase()}-lesson-${idx + 1}.mp4`,
      videoUrl: `/media/${courseId.toLowerCase()}-lesson-${idx + 1}.mp4`,
      durationSeconds: 300,
      order: idx + 1,
    }));

    const chapters: CourseChapter[] = [
      {
        id: `${courseId}-CH-1`,
        title: 'الفصل الأول',
        order: 1,
        items,
      },
    ];

    const draftCourse = inMemoryStore.createCourse(
      {
        title,
        level: 'متوسط',
        description: 'وصف تفصيلي للمقرر التدريبي المعتمد',
      },
      lecturerUser
    );

    // Override ID deterministically for test clarity
    const rawCourses = inMemoryStore.getCoursesStore();
    const createdIdx = rawCourses.findIndex((c) => c.id === draftCourse.id);
    rawCourses[createdIdx].id = courseId;
    rawCourses[createdIdx].chapters = JSON.parse(JSON.stringify(chapters));
    rawCourses[createdIdx].status = 'pending_admin';
    rawCourses[createdIdx].submittedAt = '2026-11-10T08:00:00.000Z';

    if (itemCount > 0) {
      inMemoryStore.executeReviewDecision(
        courseId,
        {
          outcome: 'approved',
          publishOption: 'submitted_baseline',
          approvalNote: 'اعتماد ونشر الإصدار الأول',
        },
        adminUser
      );
    } else {
      rawCourses[createdIdx].status = 'published';
      rawCourses[createdIdx].versionNumber = 1;
      rawCourses[createdIdx].currentVersionNumber = 1;
    }

    return inMemoryStore.getCourseById(courseId)!;
  }

  /**
   * Helper: submits and approves a curriculum update to publish the next course version.
   */
  function publishCourseUpdate(courseId: string, updatedChapters: CourseChapter[], updatedTitle?: string): Course {
    const current = inMemoryStore.getCourseById(courseId)!;
    inMemoryStore.saveCourseDraft(
      courseId,
      {
        title: updatedTitle ?? current.title,
        description: current.description,
        chapters: JSON.parse(JSON.stringify(updatedChapters)),
      },
      lecturerUser
    );
    inMemoryStore.submitCourseForReview(courseId, lecturerUser);
    const decision = inMemoryStore.executeReviewDecision(
      courseId,
      {
        outcome: 'approved',
        publishOption: 'submitted_baseline',
        approvalNote: 'اعتماد ونشر تحديث المقرر',
      },
      adminUser
    );
    return decision.course;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. D-12 Authoritative Progress Rounding & Clamping (Scenarios 1–9)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('1. D-12 Authoritative Progress Rounding & Clamping (Scenarios 1–9)', () => {
    it('Scenario 1: 0 / 5 completed required items -> 0% and isCompleted = false', () => {
      const courseId = 'CRS-D12-S1';
      createPublishedCourseWithItems(courseId, 5);
      inMemoryStore.enrollUser({ courseId, userId: traineeId, userRole: 'user' });
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({ userId: traineeId, courseId });

      expect(calculateTraineeProgress(5, 0)).toBe(0);

      const computed = inMemoryStore.computeAttemptProgress(attempt.id);
      expect(computed.completedRequiredItems).toBe(0);
      expect(computed.totalRequiredItems).toBe(5);
      expect(computed.progressPercent).toBe(0);
      expect(computed.isCompleted).toBe(false);
    });

    it('Scenario 2: 1 / 3 completed required items -> 33% and isCompleted = false', () => {
      const courseId = 'CRS-D12-S2';
      const course = createPublishedCourseWithItems(courseId, 3);
      inMemoryStore.enrollUser({ courseId, userId: traineeId, userRole: 'user' });
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({ userId: traineeId, courseId });

      const items = inMemoryStore.getCourseItems(course.id);
      inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId,
        itemId: items[0].id,
        attemptId: attempt.id,
      });

      expect(calculateTraineeProgress(3, 1)).toBe(33);
      const computed = inMemoryStore.computeAttemptProgress(attempt.id);
      expect(computed.completedRequiredItems).toBe(1);
      expect(computed.totalRequiredItems).toBe(3);
      expect(computed.progressPercent).toBe(33);
      expect(computed.isCompleted).toBe(false);
    });

    it('Scenario 3: 2 / 3 completed required items -> 67% and isCompleted = false', () => {
      const courseId = 'CRS-D12-S3';
      const course = createPublishedCourseWithItems(courseId, 3);
      inMemoryStore.enrollUser({ courseId, userId: traineeId, userRole: 'user' });
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({ userId: traineeId, courseId });

      const items = inMemoryStore.getCourseItems(course.id);
      inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: items[0].id, attemptId: attempt.id });
      inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: items[1].id, attemptId: attempt.id });

      expect(calculateTraineeProgress(3, 2)).toBe(67);
      const computed = inMemoryStore.computeAttemptProgress(attempt.id);
      expect(computed.completedRequiredItems).toBe(2);
      expect(computed.totalRequiredItems).toBe(3);
      expect(computed.progressPercent).toBe(67);
      expect(computed.isCompleted).toBe(false);
    });

    it('Scenario 4: 1 / 6 completed required items -> 17% and isCompleted = false', () => {
      const courseId = 'CRS-D12-S4';
      const course = createPublishedCourseWithItems(courseId, 6);
      inMemoryStore.enrollUser({ courseId, userId: traineeId, userRole: 'user' });
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({ userId: traineeId, courseId });

      const items = inMemoryStore.getCourseItems(course.id);
      inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: items[0].id, attemptId: attempt.id });

      expect(calculateTraineeProgress(6, 1)).toBe(17);
      const computed = inMemoryStore.computeAttemptProgress(attempt.id);
      expect(computed.progressPercent).toBe(17);
      expect(computed.isCompleted).toBe(false);
    });

    it('Scenario 5: 5 / 6 completed required items -> 83% and isCompleted = false', () => {
      const courseId = 'CRS-D12-S5';
      const course = createPublishedCourseWithItems(courseId, 6);
      inMemoryStore.enrollUser({ courseId, userId: traineeId, userRole: 'user' });
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({ userId: traineeId, courseId });

      const items = inMemoryStore.getCourseItems(course.id);
      for (let i = 0; i < 5; i++) {
        inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: items[i].id, attemptId: attempt.id });
      }

      expect(calculateTraineeProgress(6, 5)).toBe(83);
      const computed = inMemoryStore.computeAttemptProgress(attempt.id);
      expect(computed.completedRequiredItems).toBe(5);
      expect(computed.totalRequiredItems).toBe(6);
      expect(computed.progressPercent).toBe(83);
      expect(computed.isCompleted).toBe(false);
    });

    it('Scenario 6: 3 / 3 completed required items -> 100% and isCompleted = true', () => {
      const courseId = 'CRS-D12-S6';
      const course = createPublishedCourseWithItems(courseId, 3);
      inMemoryStore.enrollUser({ courseId, userId: traineeId, userRole: 'user' });
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({ userId: traineeId, courseId });

      const items = inMemoryStore.getCourseItems(course.id);
      for (const item of items) {
        inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: item.id, attemptId: attempt.id });
      }

      expect(calculateTraineeProgress(3, 3)).toBe(100);
      const computed = inMemoryStore.computeAttemptProgress(attempt.id);
      expect(computed.completedRequiredItems).toBe(3);
      expect(computed.totalRequiredItems).toBe(3);
      expect(computed.progressPercent).toBe(100);
      expect(computed.isCompleted).toBe(true);
    });

    it('Scenario 7: 0 / 0 (empty curriculum) -> 0% and isCompleted = false (never NaN, Infinity, or 100%)', () => {
      const courseId = 'CRS-D12-EMPTY';
      createPublishedCourseWithItems(courseId, 0);
      inMemoryStore.enrollUser({ courseId, userId: traineeId, userRole: 'user' });
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({ userId: traineeId, courseId });

      expect(calculateTraineeProgress(0, 0)).toBe(0);
      expect(Number.isNaN(calculateTraineeProgress(0, 0))).toBe(false);

      const computed = inMemoryStore.computeAttemptProgress(attempt.id);
      expect(computed.totalRequiredItems).toBe(0);
      expect(computed.completedRequiredItems).toBe(0);
      expect(computed.progressPercent).toBe(0);
      expect(computed.isCompleted).toBe(false);

      const courseProgress = inMemoryStore.getCourseProgress(traineeId, courseId, { attemptId: attempt.id });
      expect(courseProgress.progressPercent).toBe(0);
      expect(courseProgress.isCompleted).toBe(false);

      // Even if completeAttemptLessonItem is invoked on an empty curriculum, it must report 0% and not_started/in_progress, never 100%
      const mutationResult = inMemoryStore.completeAttemptLessonItem({
        attemptId: attempt.id,
        itemId: 'NON-EXISTENT-ITEM',
      });
      expect(mutationResult.attempt.progressPercent).toBe(0);
      expect(mutationResult.attempt.status).not.toBe('completed');
      expect(mutationResult.justCompletedAttempt).toBe(false);
    });

    it('Scenario 8 & Scenario 9: 199 / 200 -> 99% & isCompleted = false; 200 / 200 -> 100% & isCompleted = true', () => {
      const courseId = 'CRS-D12-200';
      const course = createPublishedCourseWithItems(courseId, 200);
      inMemoryStore.enrollUser({ courseId, userId: traineeId, userRole: 'user' });
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({ userId: traineeId, courseId });

      const items = inMemoryStore.getCourseItems(course.id);
      expect(items).toHaveLength(200);

      // Complete 199 of 200 items via completeAttemptLessonItem & markLessonComplete
      for (let i = 0; i < 199; i++) {
        inMemoryStore.completeAttemptLessonItem({
          attemptId: attempt.id,
          itemId: items[i].id,
        });
      }

      // Raw Math.round((199 / 200) * 100) is 100, but D-12 strictly caps incomplete progress at 99%
      expect(Math.round((199 / 200) * 100)).toBe(100);
      expect(calculateTraineeProgress(200, 199)).toBe(99);

      const computedAt199 = inMemoryStore.computeAttemptProgress(attempt.id);
      expect(computedAt199.completedRequiredItems).toBe(199);
      expect(computedAt199.totalRequiredItems).toBe(200);
      expect(computedAt199.progressPercent).toBe(99);
      expect(computedAt199.isCompleted).toBe(false);

      const playerProgressAt199 = inMemoryStore.getCourseProgress(traineeId, courseId, { attemptId: attempt.id });
      expect(playerProgressAt199.progressPercent).toBe(99);
      expect(playerProgressAt199.isCompleted).toBe(false);

      const transcriptAt199 = inMemoryStore.getUserTranscript(traineeId);
      const transcriptCourseAt199 = transcriptAt199.courses.find((c) => c.courseId === courseId)!;
      expect(transcriptCourseAt199.progressPercent).toBe(99);
      expect(transcriptCourseAt199.status).toBe('in_progress');

      const perfReportAt199 = inMemoryStore.getCoursePerformanceReport(courseId, {
        id: lecturerUser.id,
        role: 'lecturer',
      });
      const traineeRowAt199 = perfReportAt199.trainees.find((t) => t.id === traineeId)!;
      expect(traineeRowAt199.progressPercent).toBe(99);
      expect(traineeRowAt199.status).not.toBe('completed');

      // Scenario 9: Complete the final 200th item -> 100% and isCompleted = true
      inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId,
        itemId: items[199].id,
        attemptId: attempt.id,
      });

      const computedAt200 = inMemoryStore.computeAttemptProgress(attempt.id);
      expect(computedAt200.completedRequiredItems).toBe(200);
      expect(computedAt200.totalRequiredItems).toBe(200);
      expect(computedAt200.progressPercent).toBe(100);
      expect(computedAt200.isCompleted).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Cross-Surface Progress Consistency (Scenarios 10–13)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('2. Cross-Surface Progress Consistency (Scenarios 10–13)', () => {
    it('Scenario 10: Substantive addition in Version 2 recalculates active attempt from 3/3 (100%) to 3/4 (75%) and isCompleted = false', () => {
      const courseId = 'CRS-D12-S10';
      const courseV1 = createPublishedCourseWithItems(courseId, 3);
      inMemoryStore.enrollUser({ courseId, userId: traineeId, userRole: 'user' });
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({ userId: traineeId, courseId });

      const v1Items = inMemoryStore.getCourseItems(courseV1.id);
      for (const item of v1Items) {
        inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: item.id, attemptId: attempt.id });
      }

      expect(inMemoryStore.computeAttemptProgress(attempt.id).progressPercent).toBe(100);
      expect(inMemoryStore.computeAttemptProgress(attempt.id).isCompleted).toBe(true);

      // Publish Version 2 with a 4th required item added
      const v2Chapters: CourseChapter[] = JSON.parse(JSON.stringify(courseV1.chapters));
      v2Chapters[0].items.push({
        id: `${courseId}-ITEM-4`,
        type: 'video',
        title: 'الدرس الرابع المضاف',
        url: `/media/${courseId.toLowerCase()}-lesson-4.mp4`,
        videoUrl: `/media/${courseId.toLowerCase()}-lesson-4.mp4`,
        durationSeconds: 420,
        order: 4,
      });

      publishCourseUpdate(courseId, v2Chapters);

      const computedV2 = inMemoryStore.computeAttemptProgress(attempt.id);
      expect(computedV2.courseVersionNumber).toBe(2);
      expect(computedV2.completedRequiredItems).toBe(3);
      expect(computedV2.totalRequiredItems).toBe(4);
      expect(computedV2.progressPercent).toBe(75);
      expect(computedV2.isCompleted).toBe(false);
    });

    it('Scenario 11: Substantive replacement in Version 2 recalculates active attempt from 3/3 (100%) to 2/3 (67%) and isCompleted = false', () => {
      const courseId = 'CRS-D12-S11';
      const courseV1 = createPublishedCourseWithItems(courseId, 3);
      inMemoryStore.enrollUser({ courseId, userId: traineeId, userRole: 'user' });
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({ userId: traineeId, courseId });

      const v1Items = inMemoryStore.getCourseItems(courseV1.id);
      for (const item of v1Items) {
        inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: item.id, attemptId: attempt.id });
      }

      // Publish Version 2 where Lesson 2 video URL is substantively replaced
      const v2Chapters: CourseChapter[] = JSON.parse(JSON.stringify(courseV1.chapters));
      v2Chapters[0].items[1].url = '/media/replaced-substantive-video-v2.mp4';
      v2Chapters[0].items[1].videoUrl = '/media/replaced-substantive-video-v2.mp4';

      publishCourseUpdate(courseId, v2Chapters);

      const computedV2 = inMemoryStore.computeAttemptProgress(attempt.id);
      expect(computedV2.courseVersionNumber).toBe(2);
      expect(computedV2.completedRequiredItems).toBe(2);
      expect(computedV2.totalRequiredItems).toBe(3);
      expect(computedV2.progressPercent).toBe(67);
      expect(computedV2.isCompleted).toBe(false);
    });

    it('Scenario 12: Metadata-only rename in Version 2 preserves 3/3 (100%) and isCompleted = true', () => {
      const courseId = 'CRS-D12-S12';
      const courseV1 = createPublishedCourseWithItems(courseId, 3);
      inMemoryStore.enrollUser({ courseId, userId: traineeId, userRole: 'user' });
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({ userId: traineeId, courseId });

      const v1Items = inMemoryStore.getCourseItems(courseV1.id);
      for (const item of v1Items) {
        inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: item.id, attemptId: attempt.id });
      }

      // Publish Version 2 with metadata-only title and description edits on Lesson 2
      const v2Chapters: CourseChapter[] = JSON.parse(JSON.stringify(courseV1.chapters));
      v2Chapters[0].items[1].title = 'الدرس الثاني — عنوان معدل دون تغيير المادة العلمية';
      v2Chapters[0].items[1].description = 'وصف توضيحي محدث';

      publishCourseUpdate(courseId, v2Chapters);

      const computedV2 = inMemoryStore.computeAttemptProgress(attempt.id);
      expect(computedV2.courseVersionNumber).toBe(2);
      expect(computedV2.completedRequiredItems).toBe(3);
      expect(computedV2.totalRequiredItems).toBe(3);
      expect(computedV2.progressPercent).toBe(100);
      expect(computedV2.isCompleted).toBe(true);
    });

    it('Scenario 13: All 7 progress readers return identical percentage and completion state for the same attempt and course version', () => {
      const courseId = 'CRS-D12-S13';
      const courseV1 = createPublishedCourseWithItems(courseId, 3);

      // Create a training group with CRS-D12-S13 assigned and add traineeId
      const group = inMemoryStore.createGroup(
        {
          name: 'مجموعة التحقق الموحد للتقدم',
          description: 'اختبار تطابق قارئات التقدم السبعة',
          startDateTime: '2026-10-01T00:00:00.000Z',
          deadlineDateTime: '2027-10-01T00:00:00.000Z',
          postDeadlinePolicy: 'keep_no_cert',
          enrollmentPolicy: 'open',
          courses: [{ courseId, order: 1, courseRole: 'core' }],
          traineeIds: [traineeId],
          primaryInstructorId: lecturerUser.id,
        },
        adminUser
      );

      const groupAttempt = inMemoryStore.resolveActiveAttemptForLearning({
        userId: traineeId,
        courseId,
        groupId: group.id,
      });

      const items = inMemoryStore.getCourseItems(courseV1.id);
      // Complete 2 of 3 items -> 67%
      inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: items[0].id, attemptId: groupAttempt.id });
      inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: items[1].id, attemptId: groupAttempt.id });

      // Reader 1: computeAttemptProgress
      const r1 = inMemoryStore.computeAttemptProgress(groupAttempt.id);
      // Reader 2: getCourseProgress (Learning Player & Course Details)
      const r2 = inMemoryStore.getCourseProgress(traineeId, courseId, { attemptId: groupAttempt.id });
      // Reader 3: getAttemptProgress
      const r3 = inMemoryStore.getAttemptProgress(groupAttempt.id)!;
      // Reader 4: getMyEnrolledCourses / getEnrolledCoursesForUser (Student Dashboard & Profile)
      const r4 = inMemoryStore.getEnrolledCoursesForUser(traineeId).find((c) => c.id === courseId)!;
      // Reader 5: getGroupMetrics (Group Supervision & Group Details)
      const r5Metrics = inMemoryStore.getGroupMetrics(group.id)!;
      const r5Trainee = r5Metrics.traineeMetricsList.find((tm) => tm.userId === traineeId)!;
      const r5Course = r5Trainee.courseProgressMap[courseId];
      // Reader 6: getCoursePerformanceReport (Instructor Analytics & Performance Report)
      const r6Report = inMemoryStore.getCoursePerformanceReport(courseId, { id: lecturerUser.id, role: 'lecturer' });
      const r6Row = r6Report.trainees.find((t) => t.id === traineeId)!;
      // Reader 7: getUserTranscript (Admin User Transcript)
      const r7Transcript = inMemoryStore.getUserTranscript(traineeId);
      const r7Course = r7Transcript.courses.find((c) => c.courseId === courseId)!;

      expect(r1.progressPercent).toBe(67);
      expect(r2.progressPercent).toBe(67);
      expect(r3.progressPercent).toBe(67);
      expect(r4.progress.progressPercent).toBe(67);
      expect(r5Course.progressPercent).toBe(67);
      expect(r6Row.progressPercent).toBe(67);
      expect(r7Course.progressPercent).toBe(67);

      expect(r1.isCompleted).toBe(false);
      expect(r2.isCompleted).toBe(false);
      expect(r3.isCompleted).toBe(false);
      expect(r4.progress.isCompleted).toBe(false);
      expect(r5Course.isCompleted).toBe(false);
      expect(r6Row.status).toBe('active');
      expect(r7Course.status).toBe('in_progress');

      // Complete 3rd item -> 100%, then publish Version 2 with substantive edit on item 2 -> drops back to 67% across all 7 readers
      inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: items[2].id, attemptId: groupAttempt.id });
      const v2Chapters: CourseChapter[] = JSON.parse(JSON.stringify(courseV1.chapters));
      v2Chapters[0].items[1].url = '/media/v2-substantive-change.mp4';
      v2Chapters[0].items[1].videoUrl = '/media/v2-substantive-change.mp4';
      publishCourseUpdate(courseId, v2Chapters);

      expect(inMemoryStore.computeAttemptProgress(groupAttempt.id).progressPercent).toBe(67);
      expect(inMemoryStore.getCourseProgress(traineeId, courseId, { attemptId: groupAttempt.id }).progressPercent).toBe(67);
      expect(inMemoryStore.getAttemptProgress(groupAttempt.id)?.progressPercent).toBe(67);
      expect(inMemoryStore.getEnrolledCoursesForUser(traineeId).find((c) => c.id === courseId)?.progress.progressPercent).toBe(67);
      expect(inMemoryStore.getGroupMetrics(group.id)?.traineeMetricsList.find((tm) => tm.userId === traineeId)?.courseProgressMap[courseId].progressPercent).toBe(67);
      expect(inMemoryStore.getCoursePerformanceReport(courseId, { id: lecturerUser.id, role: 'lecturer' }).trainees.find((t) => t.id === traineeId)?.progressPercent).toBe(67);
      expect(inMemoryStore.getUserTranscript(traineeId).courses.find((c) => c.courseId === courseId)?.progressPercent).toBe(67);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. D-13 / MFR-46 Version-Scoped Certificates (Scenarios 14–22)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('3. D-13 / MFR-46 Version-Scoped Certificate Issuance (Scenarios 14–22)', () => {
    it('Scenario 14, 15, 16: Issues Version 1 certificate on V1 completion, preserves V1 certificate untouched when V2 is published and drops progress, and issues a separate Version 2 certificate upon V2 completion', () => {
      const courseId = 'CRS-D13-VERSIONED';
      const courseV1 = createPublishedCourseWithItems(courseId, 3, 'دورة صيانة نظم الجر الكهربائي');
      inMemoryStore.enrollUser({ courseId, userId: traineeId, userRole: 'user' });
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({ userId: traineeId, courseId });

      const v1Items = inMemoryStore.getCourseItems(courseV1.id);

      // Complete 2 of 3 items -> no certificate yet
      inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: v1Items[0].id, attemptId: attempt.id });
      inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: v1Items[1].id, attemptId: attempt.id });
      expect(inMemoryStore.getUserCertificates(traineeId, courseId)).toHaveLength(0);

      // Scenario 14: Complete 3rd item in Version 1 -> issues Version 1 certificate
      const completionResV1 = inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId,
        itemId: v1Items[2].id,
        attemptId: attempt.id,
      });

      expect(completionResV1.progress.isCompleted).toBe(true);
      expect(completionResV1.progress.progressPercent).toBe(100);

      const certsAfterV1 = inMemoryStore.getUserCertificates(traineeId, courseId);
      expect(certsAfterV1).toHaveLength(1);
      const certV1 = certsAfterV1[0];
      expect(certV1.userId).toBe(traineeId);
      expect(certV1.courseId).toBe(courseId);
      expect(certV1.attemptId).toBe(attempt.id);
      expect(certV1.courseVersionNumber).toBe(1);
      expect(certV1.courseVersion).toBe(1);
      expect(certV1.certificateLabel).toBe('Certificate — Course Version 1');
      expect(certV1.certificateLabelAr).toBe('شهادة إتمام — الإصدار 1');
      expect(certV1.courseTitleSnapshot).toBe('دورة صيانة نظم الجر الكهربائي');
      expect(certV1.verificationCode).toContain('V1');
      expect(certV1.issuedAt).toBeTruthy();

      // Scenario 15: Publish Course Version 2 (substantively updating Lesson 2 and adding Lesson 4)
      const v2Chapters: CourseChapter[] = JSON.parse(JSON.stringify(courseV1.chapters));
      v2Chapters[0].items[1].url = '/media/traction-v2-lesson-2.mp4';
      v2Chapters[0].items[1].videoUrl = '/media/traction-v2-lesson-2.mp4';
      v2Chapters[0].items.push({
        id: `${courseId}-ITEM-4`,
        type: 'video',
        title: 'الدرس الرابع: اختبارات العزل',
        url: '/media/traction-v2-lesson-4.mp4',
        videoUrl: '/media/traction-v2-lesson-4.mp4',
        durationSeconds: 360,
        order: 4,
      });

      publishCourseUpdate(courseId, v2Chapters, 'دورة صيانة نظم الجر الكهربائي — الإصدار الثاني');

      // Active attempt progress drops from 100% to 2/4 = 50%
      const computedAfterV2Publish = inMemoryStore.computeAttemptProgress(attempt.id);
      expect(computedAfterV2Publish.courseVersionNumber).toBe(2);
      expect(computedAfterV2Publish.completedRequiredItems).toBe(2);
      expect(computedAfterV2Publish.totalRequiredItems).toBe(4);
      expect(computedAfterV2Publish.progressPercent).toBe(50);
      expect(computedAfterV2Publish.isCompleted).toBe(false);

      // Version 1 certificate remains completely intact and no Version 2 certificate is issued yet
      const certsWhileV2Incomplete = inMemoryStore.getUserCertificates(traineeId, courseId);
      expect(certsWhileV2Incomplete).toHaveLength(1);
      expect(certsWhileV2Incomplete[0]).toEqual(certV1);
      expect(
        inMemoryStore.issueCourseVersionCertificate({
          userId: traineeId,
          courseId,
          attemptId: attempt.id,
        })
      ).toBeNull();

      // Scenario 16: Trainee completes the updated Lesson 2 and new Lesson 4 in Version 2
      inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId,
        itemId: `${courseId}-ITEM-2`,
        attemptId: attempt.id,
      });
      expect(inMemoryStore.computeAttemptProgress(attempt.id).progressPercent).toBe(75);
      expect(inMemoryStore.getUserCertificates(traineeId, courseId)).toHaveLength(1);

      const completionResV2 = inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId,
        itemId: `${courseId}-ITEM-4`,
        attemptId: attempt.id,
      });

      expect(completionResV2.progress.progressPercent).toBe(100);
      expect(completionResV2.progress.isCompleted).toBe(true);

      const certsAfterV2 = inMemoryStore.getUserCertificates(traineeId, courseId);
      expect(certsAfterV2).toHaveLength(2);

      // Version 1 certificate is still preserved untouched alongside the new Version 2 certificate
      expect(certsAfterV2[0]).toEqual(certV1);

      const certV2 = certsAfterV2[1];
      expect(certV2.id).not.toBe(certV1.id);
      expect(certV2.userId).toBe(traineeId);
      expect(certV2.courseId).toBe(courseId);
      expect(certV2.attemptId).toBe(attempt.id);
      expect(certV2.courseVersionNumber).toBe(2);
      expect(certV2.courseVersion).toBe(2);
      expect(certV2.certificateLabel).toBe('Certificate — Course Version 2');
      expect(certV2.certificateLabelAr).toBe('شهادة إتمام — الإصدار 2');
      expect(certV2.courseTitleSnapshot).toBe('دورة صيانة نظم الجر الكهربائي — الإصدار الثاني');
      expect(certV2.verificationCode).toContain('V2');
    });

    it('Scenario 17: Enforces strict idempotency per (userId, courseId, attemptId, courseVersionNumber)', () => {
      const courseId = 'CRS-D13-IDEMPOTENT';
      const course = createPublishedCourseWithItems(courseId, 2);
      inMemoryStore.enrollUser({ courseId, userId: traineeId, userRole: 'user' });
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({ userId: traineeId, courseId });

      const items = inMemoryStore.getCourseItems(course.id);
      inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: items[0].id, attemptId: attempt.id });
      inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: items[1].id, attemptId: attempt.id });

      const initialCerts = inMemoryStore.getUserCertificates(traineeId, courseId);
      expect(initialCerts).toHaveLength(1);

      // Repeated markLessonComplete on already completed lesson, completeAttemptLessonItem, and direct issueCourseVersionCertificate
      inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: items[1].id, attemptId: attempt.id });
      inMemoryStore.completeAttemptLessonItem({ attemptId: attempt.id, itemId: items[1].id });
      const reissued = inMemoryStore.issueCourseVersionCertificate({
        userId: traineeId,
        courseId,
        attemptId: attempt.id,
        courseVersionNumber: 1,
      });

      expect(reissued).toEqual(initialCerts[0]);
      expect(inMemoryStore.getUserCertificates(traineeId, courseId)).toHaveLength(1);
      expect(inMemoryStore.getAttemptCertificates(attempt.id)).toHaveLength(1);
    });

    it('Scenario 18: Issues separate attempt-scoped certificates when a learner completes the same course across separate attempts (Cycle 1 vs. Cycle 2)', () => {
      const courseId = 'CRS-D13-MULTI-ATTEMPT';
      const course = createPublishedCourseWithItems(courseId, 2);
      const items = inMemoryStore.getCourseItems(course.id);

      const group = inMemoryStore.createGroup(
        {
          name: 'مجموعة الدورات الدورية',
          description: 'اختبار الشهادات عبر دورات التجديد',
          startDateTime: '2026-01-01T00:00:00.000Z',
          deadlineDateTime: '2027-01-01T00:00:00.000Z',
          postDeadlinePolicy: 'keep_no_cert',
          enrollmentPolicy: 'open',
          courses: [{ courseId, order: 1, courseRole: 'core' }],
          traineeIds: [traineeId],
          primaryInstructorId: lecturerUser.id,
        },
        adminUser
      );

      const attemptCycle1 = inMemoryStore.resolveActiveAttemptForLearning({
        userId: traineeId,
        courseId,
        groupId: group.id,
      });

      // Complete Cycle 1 attempt
      inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: items[0].id, attemptId: attemptCycle1.id });
      inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: items[1].id, attemptId: attemptCycle1.id });

      expect(inMemoryStore.getAttemptCertificates(attemptCycle1.id)).toHaveLength(1);

      // Renew group cycle to provision Cycle 2 attempt
      const renewal = inMemoryStore.renewGroupCycle(group.id, {
        title: 'الدورة التدريبية الثانية',
        startDateTime: '2026-11-01T00:00:00.000Z',
        deadlineDateTime: '2027-11-01T00:00:00.000Z',
        courses: [{ courseId, order: 1, courseRole: 'core' }],
      });

      const attemptCycle2 = inMemoryStore.resolveActiveAttemptForLearning({
        userId: traineeId,
        courseId,
        groupId: group.id,
        cycleId: renewal.newCycle.id,
      });

      expect(attemptCycle2.id).not.toBe(attemptCycle1.id);

      // Complete Cycle 2 attempt
      inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: items[0].id, attemptId: attemptCycle2.id });
      inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: items[1].id, attemptId: attemptCycle2.id });

      const userCerts = inMemoryStore.getUserCertificates(traineeId, courseId);
      expect(userCerts).toHaveLength(2);
      expect(userCerts.map((c) => c.attemptId)).toContain(attemptCycle1.id);
      expect(userCerts.map((c) => c.attemptId)).toContain(attemptCycle2.id);
    });

    it('Scenario 19: Retained continuation attempt (D-07 self:continued:...) has full access mode and receives a version-scoped certificate upon completion', () => {
      const courseId = 'CRS-D13-D07-CONT';
      const course = createPublishedCourseWithItems(courseId, 2);
      const items = inMemoryStore.getCourseItems(course.id);

      const group = inMemoryStore.createGroup(
        {
          name: 'مجموعة استمرار المقرر D-07',
          description: 'اختبار أهلية الشهادة بعد الاحتفاظ بالمقرر عند الإزالة من المجموعة',
          startDateTime: '2026-01-01T00:00:00.000Z',
          deadlineDateTime: '2026-06-01T00:00:00.000Z', // Expired group deadline lifted by D-07 continuation
          postDeadlinePolicy: 'keep_no_cert',
          enrollmentPolicy: 'open',
          courses: [{ courseId, order: 1, courseRole: 'core' }],
          traineeIds: [traineeId],
          primaryInstructorId: lecturerUser.id,
        },
        adminUser
      );

      // Remove trainee from group while retaining the course (removeCourseIds = [])
      inMemoryStore.removeGroupMember(group.id, traineeId, { removeCourseIds: [] });

      // Continuation attempt has accessMode === 'full' despite expired origin group deadline
      const continuationAttempt = inMemoryStore.resolveActiveAttemptForLearning({
        userId: traineeId,
        courseId,
      });
      expect(inMemoryStore.getAttemptAccessMode(traineeId, courseId, continuationAttempt.id)).toBe('full');

      // Complete both required lessons on the retained continuation attempt
      inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: items[0].id, attemptId: continuationAttempt.id });
      inMemoryStore.markLessonComplete({ userId: traineeId, courseId, itemId: items[1].id, attemptId: continuationAttempt.id });

      const certs = inMemoryStore.getUserCertificates(traineeId, courseId);
      expect(certs).toHaveLength(1);
      expect(certs[0].attemptId).toBe(continuationAttempt.id);
      expect(certs[0].courseVersionNumber).toBe(1);
    });

    it('Scenario 20: Never issues a certificate when attempt accessMode is review_only (expired group under keep_no_cert)', () => {
      const courseId = 'CRS-D13-REVIEW-ONLY';
      const course = createPublishedCourseWithItems(courseId, 2);
      const items = inMemoryStore.getCourseItems(course.id);

      // Create group with past deadline and keep_no_cert policy
      const group = inMemoryStore.createGroup(
        {
          name: 'مجموعة منتهية للمطالعة فقط',
          description: 'اختبار عدم إصدار شهادة في وضع المراجعة فقط',
          startDateTime: '2025-01-01T00:00:00.000Z',
          deadlineDateTime: '2025-06-01T00:00:00.000Z',
          postDeadlinePolicy: 'keep_no_cert',
          enrollmentPolicy: 'open',
          courses: [{ courseId, order: 1, courseRole: 'core' }],
          traineeIds: [traineeId],
          primaryInstructorId: lecturerUser.id,
        },
        adminUser
      );

      const attempt = inMemoryStore.resolveActiveAttemptForLearning({
        userId: traineeId,
        courseId,
        groupId: group.id,
      });

      expect(inMemoryStore.getAttemptAccessMode(traineeId, courseId, attempt.id)).toBe('review_only');

      // Learner mutation in review_only mode is rejected with 403 COURSE_ACCESS_REVIEW_ONLY
      expect(() => {
        inMemoryStore.markLessonComplete({
          userId: traineeId,
          courseId,
          itemId: items[0].id,
          attemptId: attempt.id,
        });
      }).toThrowError(MockStoreError);

      // Even if items are marked via internal helper or direct issueCourseVersionCertificate is called, review_only blocks issuance
      inMemoryStore.completeAttemptLessonItem({ attemptId: attempt.id, itemId: items[0].id });
      inMemoryStore.completeAttemptLessonItem({ attemptId: attempt.id, itemId: items[1].id });

      const cert = inMemoryStore.issueCourseVersionCertificate({
        userId: traineeId,
        courseId,
        attemptId: attempt.id,
      });
      expect(cert).toBeNull();
      expect(inMemoryStore.getUserCertificates(traineeId, courseId)).toHaveLength(0);
    });

    it('Scenario 21: Never issues a certificate for a draft or unpublished course', () => {
      const draftCourse = inMemoryStore.createCourse(
        {
          title: 'مقرر مسودة غير منشور',
          level: 'مبتدئ',
          description: 'مسودة قيد الإعداد',
        },
        lecturerUser
      );

      const rawCourses = inMemoryStore.getCoursesStore();
      const target = rawCourses.find((c) => c.id === draftCourse.id)!;
      target.chapters = [
        {
          id: 'CH-DRAFT-1',
          title: 'الفصل الأول',
          order: 1,
          items: [
            {
              id: 'ITEM-DRAFT-1',
              type: 'video',
              title: 'درس مسودة',
              url: '/media/draft.mp4',
            },
          ],
        },
      ];

      inMemoryStore.enrollUser({ courseId: draftCourse.id, userId: traineeId, userRole: 'user' });
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({ userId: traineeId, courseId: draftCourse.id });

      inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId: draftCourse.id,
        itemId: 'ITEM-DRAFT-1',
        attemptId: attempt.id,
      });

      expect(
        inMemoryStore.issueCourseVersionCertificate({
          userId: traineeId,
          courseId: draftCourse.id,
          attemptId: attempt.id,
        })
      ).toBeNull();
      expect(inMemoryStore.getUserCertificates(traineeId, draftCourse.id)).toHaveLength(0);
    });

    it('Scenario 22: Never issues a certificate when 199 / 200 items are completed (99% capped rounding) and issues only upon 200 / 200', () => {
      const courseId = 'CRS-D13-199-OF-200';
      const course = createPublishedCourseWithItems(courseId, 200);
      inMemoryStore.enrollUser({ courseId, userId: traineeId, userRole: 'user' });
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({ userId: traineeId, courseId });

      const items = inMemoryStore.getCourseItems(course.id);
      for (let i = 0; i < 199; i++) {
        inMemoryStore.completeAttemptLessonItem({
          attemptId: attempt.id,
          itemId: items[i].id,
        });
      }

      expect(inMemoryStore.computeAttemptProgress(attempt.id).progressPercent).toBe(99);
      expect(inMemoryStore.computeAttemptProgress(attempt.id).isCompleted).toBe(false);
      expect(inMemoryStore.getUserCertificates(traineeId, courseId)).toHaveLength(0);
      expect(
        inMemoryStore.issueCourseVersionCertificate({
          userId: traineeId,
          courseId,
          attemptId: attempt.id,
        })
      ).toBeNull();

      // Completing the 200th item issues the Version 1 certificate
      inMemoryStore.completeAttemptLessonItem({
        attemptId: attempt.id,
        itemId: items[199].id,
      });

      const certs = inMemoryStore.getUserCertificates(traineeId, courseId);
      expect(certs).toHaveLength(1);
      expect(certs[0].courseVersionNumber).toBe(1);
    });
  });
});

