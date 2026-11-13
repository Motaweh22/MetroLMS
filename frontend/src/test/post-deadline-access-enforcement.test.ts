import { describe, it, expect, beforeEach } from 'vitest';
import { inMemoryStore, MockStoreError, resolveCourseAccess } from '@/mocks/store/inMemoryStore';
import type { ChapterItem, Course, CourseChapter } from '@/core/courses/types';
import type { TrainingGroup, GroupRenewalCycle, GroupCycleCourseAssignment } from '@/core/groups/types';
import type { User } from '@/core/auth/types';

/**
 * MetroLMS — Phase 2 / WP-2.4 / T-2.4.1:
 * Post-Deadline Access Policy Enforcement (hide vs. keep_no_cert, MFR-23, MFR-42)
 *
 * Non-execution governance note:
 * Authored under the Two-Gate Verification Governance model.
 * Status: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B (Phase 4 / T-4.4.1).
 */
describe('Phase 2 — WP-2.4 / T-2.4.1: Post-Deadline Access Policy Enforcement (MFR-23, MFR-42)', () => {
  const traineeUser: User = {
    id: 'usr_trainee_003',
    name: 'م. علي حسن',
    email: 'ali.hassan@cairo-metro.gov.eg',
    role: 'user',
    department: 'قطاع الوحدات المتحركة',
    jobTitle: 'فني صيانة قطارات أول',
  };

  const courseId = 'CRS-POST-DEADLINE-01';
  const groupId = 'GRP-POST-DEADLINE-01';

  beforeEach(() => {
    inMemoryStore.reset({ seedReviewDemo: false, seedGroupDemo: false });
  });

  /**
   * Helper: creates and seeds a published course with the specified number of required video items.
   */
  function seedCourse(id: string, itemCount = 3, title = 'مقرر السلامة وتشغيل القطارات'): Course {
    const items: ChapterItem[] = Array.from({ length: itemCount }, (_, idx) => ({
      id: `${id}-ITEM-${idx + 1}`,
      type: 'video',
      title: `الدرس ${idx + 1}`,
      url: `/media/${id.toLowerCase()}-lesson-${idx + 1}.mp4`,
      videoUrl: `/media/${id.toLowerCase()}-lesson-${idx + 1}.mp4`,
      durationSeconds: 300,
      order: idx + 1,
      contentVersion: 1,
    }));

    const chapters: CourseChapter[] = [
      {
        id: `${id}-CH-1`,
        title: 'الفصل التدريبي الأول',
        order: 1,
        items,
      },
    ];

    const course: Course = {
      id,
      title,
      description: 'مقرر اختباري لسياسات ما بعد الموعد النهائي',
      status: 'published',
      published: true,
      authorId: 'usr_lect_002',
      lecturerId: 'usr_lect_002',
      lecturerName: 'د. طارق الجوهري',
      category: 'هندسة الجر',
      chapters,
      durationTotal: 900,
      passingGrade: 80,
      thumbnail: '/media/course-thumb.jpg',
      enrolledCount: 1,
      versionNumber: 1,
      currentVersionNumber: 1,
      publishedAt: '2026-01-01T00:00:00.000Z',
    };

    inMemoryStore.createCourse(course);
    inMemoryStore.seedInitialPublishedCourseVersion(course);
    return course;
  }

  /**
   * Helper: creates and seeds a training group with assigned course and cycle schedule.
   */
  function seedGroup(params: {
    id: string;
    courseId: string;
    traineeId: string;
    startIso: string;
    deadlineIso: string;
    postDeadlinePolicy: 'keep_no_cert' | 'hide';
    customPostDeadlinePolicy?: 'keep_no_cert' | 'hide' | null;
    customDeadlineIso?: string | null;
    adminStatus?: 'active' | 'archived';
    cycleStatus?: 'active' | 'completed' | 'archived';
  }): TrainingGroup {
    const cycleCourses: GroupCycleCourseAssignment[] = [
      {
        courseId: params.courseId,
        order: 1,
        courseRole: 'core',
        customStartDateTime: null,
        customDeadlineDateTime: params.customDeadlineIso ?? null,
        customPostDeadlinePolicy: params.customPostDeadlinePolicy ?? null,
      },
    ];

    const cycleId = `${params.id}-CYCLE-1`;
    const cycle: GroupRenewalCycle = {
      id: cycleId,
      cycleNumber: 1,
      name: 'الدورة التشغيلية الأولى',
      startDateTime: params.startIso,
      deadlineDateTime: params.deadlineIso,
      postDeadlinePolicy: params.postDeadlinePolicy,
      status: params.cycleStatus || 'active',
      traineeIds: [params.traineeId],
      courses: cycleCourses,
    };

    const group: TrainingGroup = {
      id: params.id,
      name: 'مجموعة الصيانة الدورية',
      department: 'قطاع الوحدات المتحركة',
      code: `GRP-${params.id}`,
      enrollmentPolicy: 'admin_only',
      adminStatus: params.adminStatus || 'active',
      status: 'active',
      startDateTime: params.startIso,
      deadlineDateTime: params.deadlineIso,
      postDeadlinePolicy: params.postDeadlinePolicy,
      primaryInstructorId: 'usr_lect_002',
      assistantLecturerIds: [],
      supervisorIds: [],
      traineeIds: [params.traineeId],
      courses: cycleCourses,
      cycles: [cycle],
      currentCycleId: cycleId,
      resources: [],
      whatsappContactIds: [],
    };

    (inMemoryStore as any).groups.push(group);

    // Seed enrollment with source grant
    const attemptId = `ATT-${params.id}-${params.courseId}`;
    inMemoryStore.createCourseAttempt({
      id: attemptId,
      userId: params.traineeId,
      courseId: params.courseId,
      groupId: params.id,
      cycleId,
      status: 'in_progress',
      progressPercent: 0,
      completedItemIds: [],
      lessonProgress: {},
    });

    inMemoryStore.upsertEnrollmentGrant({
      userId: params.traineeId,
      courseId: params.courseId,
      grant: {
        sourceId: `group:${params.id}:${cycleId}`,
        kind: 'group',
        groupId: params.id,
        cycleId,
        attemptId,
        status: 'active',
        enrolledAt: params.startIso,
      },
    });

    return group;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Suite A: Authoritative Course Access Resolver Truth Table (resolveCourseAccess)
  // ══════════════════════════════════════════════════════════════════════════

  describe('Suite A: Authoritative Course Access Resolver Truth Table', () => {
    it('RT-2.4.1-01: Active standalone enrollment (kind: self, status: active) resolves to "full"', () => {
      seedCourse(courseId);
      const attemptId = 'ATT-SELF-01';
      inMemoryStore.createCourseAttempt({
        id: attemptId,
        userId: traineeUser.id,
        courseId,
        status: 'in_progress',
      });
      inMemoryStore.upsertEnrollmentGrant({
        userId: traineeUser.id,
        courseId,
        grant: {
          sourceId: `self:catalog:${attemptId}`,
          kind: 'self',
          attemptId,
          status: 'active',
          enrolledAt: '2026-01-01T00:00:00.000Z',
        },
      });

      const mode = resolveCourseAccess(traineeUser.id, courseId);
      expect(mode).toBe('full');
    });

    it('RT-2.4.1-02: Active group enrollment before deadline resolves to "full"', () => {
      seedCourse(courseId);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-12-31T23:59:59.000Z',
        postDeadlinePolicy: 'hide',
      });

      const mode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, '2026-06-01T00:00:00.000Z');
      expect(mode).toBe('full');
    });

    it('RT-2.4.1-03: Active group enrollment with no deadline (null/absent) resolves to "full"', () => {
      seedCourse(courseId);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '', // absent/empty
        postDeadlinePolicy: 'hide',
      });

      const mode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, '2026-06-01T00:00:00.000Z');
      expect(mode).toBe('full');
    });

    it('RT-2.4.1-04: Expired group enrollment with postDeadlinePolicy "hide" resolves to "none"', () => {
      seedCourse(courseId);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-05-01T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
      });

      const mode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, '2026-06-01T00:00:00.000Z');
      expect(mode).toBe('none');
    });

    it('RT-2.4.1-05: Expired group enrollment with postDeadlinePolicy "keep_no_cert" resolves to "review_only"', () => {
      seedCourse(courseId);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-05-01T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
      });

      const mode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, '2026-06-01T00:00:00.000Z');
      expect(mode).toBe('review_only');
    });

    it('RT-2.4.1-06: Archived group (adminStatus: archived) with postDeadlinePolicy "hide" resolves to "none"', () => {
      seedCourse(courseId);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-12-31T00:00:00.000Z', // deadline in future
        postDeadlinePolicy: 'hide',
        adminStatus: 'archived',
      });

      const mode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, '2026-06-01T00:00:00.000Z');
      expect(mode).toBe('none');
    });

    it('RT-2.4.1-07: Archived group (adminStatus: archived) with postDeadlinePolicy "keep_no_cert" resolves to "review_only"', () => {
      seedCourse(courseId);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-12-31T00:00:00.000Z', // deadline in future
        postDeadlinePolicy: 'keep_no_cert',
        adminStatus: 'archived',
      });

      const mode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, '2026-06-01T00:00:00.000Z');
      expect(mode).toBe('review_only');
    });

    it('RT-2.4.1-08: Archived cycle (status: archived/completed) resolves according to policy (hide -> none, keep_no_cert -> review_only)', () => {
      seedCourse(courseId);
      seedGroup({
        id: `${groupId}-A`,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-12-31T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
        cycleStatus: 'archived',
      });
      seedGroup({
        id: `${groupId}-B`,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-12-31T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
        cycleStatus: 'completed',
      });

      const modeA = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, '2026-06-01T00:00:00.000Z');
      // Group B provides review_only which dominates Group A's none
      expect(modeA).toBe('review_only');
    });

    it('RT-2.4.1-09: Revoked source grant (revoked_by_group_removal) does not grant access (none)', () => {
      seedCourse(courseId);
      inMemoryStore.upsertEnrollmentGrant({
        userId: traineeUser.id,
        courseId,
        grant: {
          sourceId: `group:${groupId}:cycle-1`,
          kind: 'group',
          groupId,
          attemptId: 'ATT-REVOKED-01',
          status: 'revoked_by_group_removal',
          enrolledAt: '2026-01-01T00:00:00.000Z',
        },
      });

      const mode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId);
      expect(mode).toBe('none');
    });

    it('RT-2.4.1-10: Multi-group precedence: expired keep_no_cert group + expired hide group resolves to "review_only"', () => {
      seedCourse(courseId);
      seedGroup({
        id: `${groupId}-HIDE`,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
      });
      seedGroup({
        id: `${groupId}-KEEP`,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
      });

      const mode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, '2026-06-01T00:00:00.000Z');
      expect(mode).toBe('review_only');
    });

    it('RT-2.4.1-11: Independent standalone source overrides expired hide group, resolving to "full"', () => {
      seedCourse(courseId);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
      });

      // Add independent active standalone grant
      const standaloneAttemptId = 'ATT-STANDALONE-OVERRIDE';
      inMemoryStore.createCourseAttempt({
        id: standaloneAttemptId,
        userId: traineeUser.id,
        courseId,
        status: 'in_progress',
      });
      inMemoryStore.upsertEnrollmentGrant({
        userId: traineeUser.id,
        courseId,
        grant: {
          sourceId: `self:catalog:${standaloneAttemptId}`,
          kind: 'self',
          attemptId: standaloneAttemptId,
          status: 'active',
          enrolledAt: '2026-05-01T00:00:00.000Z',
        },
      });

      const mode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, '2026-06-01T00:00:00.000Z');
      expect(mode).toBe('full');
    });

    it('RT-2.4.1-12: Another active group source overrides expired hide group, resolving to "full"', () => {
      seedCourse(courseId);
      seedGroup({
        id: `${groupId}-EXPIRED-HIDE`,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
      });
      seedGroup({
        id: `${groupId}-ACTIVE`,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-05-01T00:00:00.000Z',
        deadlineIso: '2026-12-31T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
      });

      const mode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, '2026-06-01T00:00:00.000Z');
      expect(mode).toBe('full');
    });

    it('RT-2.4.1-13: D-07 continuation grant (self:continued:...) preserves independent "full" access regardless of group schedule', () => {
      seedCourse(courseId);
      const continuationAttemptId = 'ATT-CONTINUATION-01';
      inMemoryStore.createCourseAttempt({
        id: continuationAttemptId,
        userId: traineeUser.id,
        courseId,
        groupId,
        status: 'in_progress',
      });
      inMemoryStore.upsertEnrollmentGrant({
        userId: traineeUser.id,
        courseId,
        grant: {
          sourceId: `self:continued:${groupId}:${continuationAttemptId}`,
          kind: 'self',
          groupId: null,
          convertedFromGroupId: groupId,
          attemptId: continuationAttemptId,
          status: 'active',
          enrolledAt: '2026-05-01T00:00:00.000Z',
        },
      });

      const mode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, '2026-06-01T00:00:00.000Z');
      expect(mode).toBe('full');
    });

    it('RT-2.4.1-14: Course-level custom deadline and custom postDeadlinePolicy overrides take precedence over group defaults', () => {
      seedCourse(courseId);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z', // Group deadline is expired
        postDeadlinePolicy: 'hide', // Group default policy is hide
        customDeadlineIso: '2026-10-01T00:00:00.000Z', // Course custom deadline is active
        customPostDeadlinePolicy: 'keep_no_cert',
      });

      // At 2026-06-01: Group default is expired, but course override deadline is still active
      const activeMode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, '2026-06-01T00:00:00.000Z');
      expect(activeMode).toBe('full');

      // At 2026-11-01: Both are expired, but custom policy 'keep_no_cert' overrides group policy 'hide'
      const expiredMode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, '2026-11-01T00:00:00.000Z');
      expect(expiredMode).toBe('review_only');
    });

    it('RT-2.4.1-15: Exact deadline boundary: now === deadline remains active "full"; transitions to expired only when now > deadline', () => {
      seedCourse(courseId);
      const deadlineIso = '2026-06-01T12:00:00.000Z';
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso,
        postDeadlinePolicy: 'hide',
      });

      // Exactly at the deadline: now === deadline
      const boundaryMode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, deadlineIso);
      expect(boundaryMode).toBe('full');

      // One millisecond after deadline: now > deadline
      const afterDeadline = new Date(new Date(deadlineIso).getTime() + 1).toISOString();
      const expiredMode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, afterDeadline);
      expect(expiredMode).toBe('none');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Suite B: MFR-42 Completed-Trainee Exemption Removal (hide Policy)
  // ══════════════════════════════════════════════════════════════════════════

  describe('Suite B: MFR-42 Completed-Trainee Exemption Removal under "hide"', () => {
    it('RT-2.4.1-16: 100% completed trainee in an expired "hide" group loses course access through that group source (none)', () => {
      seedCourse(courseId, 2);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
      });

      const attemptId = `ATT-${groupId}-${courseId}`;
      inMemoryStore.completeAttemptLessonItem({ attemptId, itemId: `${courseId}-ITEM-1` });
      inMemoryStore.completeAttemptLessonItem({ attemptId, itemId: `${courseId}-ITEM-2` });

      const attempt = inMemoryStore.getCourseAttempt(attemptId)!;
      expect(attempt.progressPercent).toBe(100);
      expect(attempt.status).toBe('completed');

      // Evaluated at a time after the deadline
      const mode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, '2026-06-01T00:00:00.000Z');
      expect(mode).toBe('none');

      // Course MUST be completely omitted from getMyEnrolledCourses despite progress.isCompleted === true
      const enrolled = inMemoryStore.getMyEnrolledCourses(traineeUser.id);
      expect(enrolled.some((c) => c.id === courseId)).toBe(false);
    });

    it('RT-2.4.1-17: Incomplete trainee in the same expired "hide" group also receives "none" access (equal treatment)', () => {
      seedCourse(courseId, 2);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
      });

      const attemptId = `ATT-${groupId}-${courseId}`;
      inMemoryStore.completeAttemptLessonItem({ attemptId, itemId: `${courseId}-ITEM-1` });

      const attempt = inMemoryStore.getCourseAttempt(attemptId)!;
      expect(attempt.progressPercent).toBe(50);
      expect(attempt.status).toBe('in_progress');

      const mode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, '2026-06-01T00:00:00.000Z');
      expect(mode).toBe('none');

      const enrolled = inMemoryStore.getMyEnrolledCourses(traineeUser.id);
      expect(enrolled.some((c) => c.id === courseId)).toBe(false);
    });

    it('RT-2.4.1-18: 100% completed trainee with an independent active standalone source retains "full" access', () => {
      seedCourse(courseId, 2);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
      });

      // Complete group attempt
      const groupAttemptId = `ATT-${groupId}-${courseId}`;
      inMemoryStore.completeAttemptLessonItem({ attemptId: groupAttemptId, itemId: `${courseId}-ITEM-1` });
      inMemoryStore.completeAttemptLessonItem({ attemptId: groupAttemptId, itemId: `${courseId}-ITEM-2` });

      // Add independent active standalone grant
      const standaloneAttemptId = 'ATT-STANDALONE-COMPLETED';
      inMemoryStore.createCourseAttempt({
        id: standaloneAttemptId,
        userId: traineeUser.id,
        courseId,
        status: 'in_progress',
      });
      inMemoryStore.upsertEnrollmentGrant({
        userId: traineeUser.id,
        courseId,
        grant: {
          sourceId: `self:catalog:${standaloneAttemptId}`,
          kind: 'self',
          attemptId: standaloneAttemptId,
          status: 'active',
          enrolledAt: '2026-05-01T00:00:00.000Z',
        },
      });

      const mode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, '2026-06-01T00:00:00.000Z');
      expect(mode).toBe('full');

      // Visible in My Courses through standalone enrollment
      const enrolled = inMemoryStore.getMyEnrolledCourses(traineeUser.id);
      expect(enrolled.some((c) => c.id === courseId)).toBe(true);
    });

    it('RT-2.4.1-19: 100% completed trainee with another active group source retains "full" access', () => {
      seedCourse(courseId, 2);
      seedGroup({
        id: `${groupId}-EXPIRED`,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
      });
      seedGroup({
        id: `${groupId}-ACTIVE-GROUP`,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-05-01T00:00:00.000Z',
        deadlineIso: '2026-12-31T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
      });

      const mode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, '2026-06-01T00:00:00.000Z');
      expect(mode).toBe('full');
    });

    it('RT-2.4.1-20: Historical certificate earned before deadline remains preserved and verifiable even when course is hidden', () => {
      seedCourse(courseId, 2);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
      });

      const attemptId = `ATT-${groupId}-${courseId}`;
      inMemoryStore.completeAttemptLessonItem({ attemptId, itemId: `${courseId}-ITEM-1` });
      inMemoryStore.completeAttemptLessonItem({ attemptId, itemId: `${courseId}-ITEM-2` });

      // Issue certificate before deadline
      const cert = inMemoryStore.issueCourseVersionCertificate({
        userId: traineeUser.id,
        courseId,
        attemptId,
      });
      expect(cert).not.toBeNull();
      expect(cert?.courseVersionNumber).toBe(1);

      // Verify certificate persists in ledger
      const certsBefore = inMemoryStore.getUserCertificates(traineeUser.id, courseId);
      expect(certsBefore).toHaveLength(1);

      // Now time advances past deadline: course access is hidden ('none')
      const mode = inMemoryStore.resolveCourseAccess(traineeUser.id, courseId, '2026-06-01T00:00:00.000Z');
      expect(mode).toBe('none');

      // Certificate record MUST remain permanently intact
      const certsAfter = inMemoryStore.getUserCertificates(traineeUser.id, courseId);
      expect(certsAfter).toHaveLength(1);
      expect(certsAfter[0].id).toBe(cert?.id);
      expect(certsAfter[0].verificationCode).toBe(cert?.verificationCode);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Suite C: keep_no_cert — Genuine Read-Only Access Enforcement
  // ══════════════════════════════════════════════════════════════════════════

  describe('Suite C: keep_no_cert — Genuine Read-Only Access Enforcement', () => {
    it('RT-2.4.1-21: Trainee can view course lessons and read existing progress with accessMode "review_only"', () => {
      seedCourse(courseId, 3);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
      });

      const attemptId = `ATT-${groupId}-${courseId}`;
      inMemoryStore.completeAttemptLessonItem({ attemptId, itemId: `${courseId}-ITEM-1` });

      // After deadline, progress is readable and reports accessMode: 'review_only'
      const progress = inMemoryStore.getCourseProgress(traineeUser.id, courseId, { attemptId });
      expect(progress.accessMode).toBe('review_only');
      expect(progress.completedItemIds).toContain(`${courseId}-ITEM-1`);
      expect(progress.progressPercent).toBe(33);
    });

    it('RT-2.4.1-22: recordLessonActivity on review_only attempt is rejected with 403 COURSE_ACCESS_REVIEW_ONLY', () => {
      seedCourse(courseId, 3);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
      });

      const attemptId = `ATT-${groupId}-${courseId}`;

      expect(() => {
        inMemoryStore.recordLessonActivity({
          userId: traineeUser.id,
          courseId,
          itemId: `${courseId}-ITEM-2`,
          attemptId,
          activity: { lastPositionSeconds: 120 },
        });
      }).toThrowError(
        expect.objectContaining({
          status: 403,
          code: 'COURSE_ACCESS_REVIEW_ONLY',
        })
      );
    });

    it('RT-2.4.1-23: markLessonComplete on review_only attempt is rejected with 403 COURSE_ACCESS_REVIEW_ONLY', () => {
      seedCourse(courseId, 3);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
      });

      const attemptId = `ATT-${groupId}-${courseId}`;

      expect(() => {
        inMemoryStore.markLessonComplete({
          userId: traineeUser.id,
          courseId,
          itemId: `${courseId}-ITEM-1`,
          attemptId,
        });
      }).toThrowError(
        expect.objectContaining({
          status: 403,
          code: 'COURSE_ACCESS_REVIEW_ONLY',
        })
      );
    });

    it('RT-2.4.1-24: Progress and attempt records remain byte-for-byte / field-for-field unmodified after rejected mutations', () => {
      seedCourse(courseId, 3);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
      });

      const attemptId = `ATT-${groupId}-${courseId}`;
      inMemoryStore.completeAttemptLessonItem({ attemptId, itemId: `${courseId}-ITEM-1` });

      const attemptSnapshot = JSON.stringify(inMemoryStore.getCourseAttempt(attemptId));
      const progressSnapshot = JSON.stringify(inMemoryStore.getAttemptProgress(attemptId));

      // Attempt rejected activity
      try {
        inMemoryStore.recordLessonActivity({
          userId: traineeUser.id,
          courseId,
          itemId: `${courseId}-ITEM-2`,
          attemptId,
          activity: { lastPositionSeconds: 100 },
        });
      } catch {}

      // Attempt rejected completion
      try {
        inMemoryStore.markLessonComplete({
          userId: traineeUser.id,
          courseId,
          itemId: `${courseId}-ITEM-2`,
          attemptId,
        });
      } catch {}

      expect(JSON.stringify(inMemoryStore.getCourseAttempt(attemptId))).toBe(attemptSnapshot);
      expect(JSON.stringify(inMemoryStore.getAttemptProgress(attemptId))).toBe(progressSnapshot);
    });

    it('RT-2.4.1-25: issueCourseVersionCertificate returns null for review_only attempts (zero certificate issued)', () => {
      seedCourse(courseId, 2);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
      });

      const attemptId = `ATT-${groupId}-${courseId}`;
      // Seed completion internally
      inMemoryStore.completeAttemptLessonItem({ attemptId, itemId: `${courseId}-ITEM-1` });
      inMemoryStore.completeAttemptLessonItem({ attemptId, itemId: `${courseId}-ITEM-2` });

      const cert = inMemoryStore.issueCourseVersionCertificate({
        userId: traineeUser.id,
        courseId,
        attemptId,
      });

      expect(cert).toBeNull();
      expect(inMemoryStore.getUserCertificates(traineeUser.id, courseId)).toHaveLength(0);
    });

    it('RT-2.4.1-26: Expired/archived keep_no_cert review attempts remain visible and selectable in getEligibleAttemptsForCourse', () => {
      seedCourse(courseId, 3);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
      });

      const attemptId = `ATT-${groupId}-${courseId}`;
      const eligible = inMemoryStore.getEligibleAttemptsForCourse(traineeUser.id, courseId);

      expect(eligible).toHaveLength(1);
      expect(eligible[0].attemptId).toBe(attemptId);
      expect(eligible[0].accessMode).toBe('review_only');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Suite D: none — Hidden / Denied Access Enforcement
  // ══════════════════════════════════════════════════════════════════════════

  describe('Suite D: none — Hidden / Denied Access Enforcement', () => {
    it('RT-2.4.1-27: Course is completely omitted from getMyEnrolledCourses and getEnrolledCoursesForUser', () => {
      seedCourse(courseId, 3);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
      });

      const enrolled = inMemoryStore.getMyEnrolledCourses(traineeUser.id);
      expect(enrolled.find((c) => c.id === courseId)).toBeUndefined();

      const aliasEnrolled = inMemoryStore.getEnrolledCoursesForUser(traineeUser.id);
      expect(aliasEnrolled.find((c) => c.id === courseId)).toBeUndefined();
    });

    it('RT-2.4.1-28: Student dashboard (getDashboardData) excludes hidden course from enrolled counts, completed counts, and continue-learning', () => {
      seedCourse(courseId, 2);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
      });

      const attemptId = `ATT-${groupId}-${courseId}`;
      inMemoryStore.completeAttemptLessonItem({ attemptId, itemId: `${courseId}-ITEM-1` });
      inMemoryStore.completeAttemptLessonItem({ attemptId, itemId: `${courseId}-ITEM-2` });

      const dashboard = inMemoryStore.getDashboardData(traineeUser);
      expect(dashboard.stats.enrolledCount).toBe(0);
      expect(dashboard.continueLearning).toBeNull();
    });

    it('RT-2.4.1-29: recordLessonActivity on an attempt expired under "hide" is rejected with 403 COURSE_ACCESS_EXPIRED', () => {
      seedCourse(courseId, 2);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
      });

      const attemptId = `ATT-${groupId}-${courseId}`;

      expect(() => {
        inMemoryStore.recordLessonActivity({
          userId: traineeUser.id,
          courseId,
          itemId: `${courseId}-ITEM-1`,
          attemptId,
          activity: { lastPositionSeconds: 60 },
        });
      }).toThrowError(
        expect.objectContaining({
          status: 403,
          code: 'COURSE_ACCESS_EXPIRED',
        })
      );
    });

    it('RT-2.4.1-30: markLessonComplete on an attempt expired under "hide" is rejected with 403 COURSE_ACCESS_EXPIRED', () => {
      seedCourse(courseId, 2);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
      });

      const attemptId = `ATT-${groupId}-${courseId}`;

      expect(() => {
        inMemoryStore.markLessonComplete({
          userId: traineeUser.id,
          courseId,
          itemId: `${courseId}-ITEM-1`,
          attemptId,
        });
      }).toThrowError(
        expect.objectContaining({
          status: 403,
          code: 'COURSE_ACCESS_EXPIRED',
        })
      );
    });

    it('RT-2.4.1-31: Zero store mutations occur when mutation requests on hidden/expired attempts are rejected', () => {
      seedCourse(courseId, 2);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
      });

      const attemptId = `ATT-${groupId}-${courseId}`;
      const initialAttempt = JSON.stringify(inMemoryStore.getCourseAttempt(attemptId));

      try {
        inMemoryStore.recordLessonActivity({
          userId: traineeUser.id,
          courseId,
          itemId: `${courseId}-ITEM-1`,
          attemptId,
          activity: { lastPositionSeconds: 90 },
        });
      } catch {}

      try {
        inMemoryStore.markLessonComplete({
          userId: traineeUser.id,
          courseId,
          itemId: `${courseId}-ITEM-1`,
          attemptId,
        });
      } catch {}

      expect(JSON.stringify(inMemoryStore.getCourseAttempt(attemptId))).toBe(initialAttempt);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Suite E: Seven-Surface Cross-Surface Consistency
  // ══════════════════════════════════════════════════════════════════════════

  describe('Suite E: Seven-Surface Cross-Surface Consistency', () => {
    it('RT-2.4.1-32: Seven surfaces agree on "none" access mode (omission, denial, zero mutations, zero certs)', () => {
      seedCourse(courseId, 3);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
      });

      const attemptId = `ATT-${groupId}-${courseId}`;

      // 1. Resolver
      expect(inMemoryStore.resolveCourseAccess(traineeUser.id, courseId)).toBe('none');

      // 2. My Courses discovery omission
      expect(inMemoryStore.getMyEnrolledCourses(traineeUser.id).some((c) => c.id === courseId)).toBe(false);

      // 3. Dashboard omission
      const db = inMemoryStore.getDashboardData(traineeUser);
      expect(db.stats.enrolledCount).toBe(0);

      // 4. Eligible attempts empty
      expect(inMemoryStore.getEligibleAttemptsForCourse(traineeUser.id, courseId)).toEqual([]);

      // 5. Activity rejected with 403
      expect(() => {
        inMemoryStore.recordLessonActivity({
          userId: traineeUser.id,
          courseId,
          itemId: `${courseId}-ITEM-1`,
          attemptId,
          activity: { lastPositionSeconds: 50 },
        });
      }).toThrowError(expect.objectContaining({ status: 403, code: 'COURSE_ACCESS_EXPIRED' }));

      // 6. Complete rejected with 403
      expect(() => {
        inMemoryStore.markLessonComplete({
          userId: traineeUser.id,
          courseId,
          itemId: `${courseId}-ITEM-1`,
          attemptId,
        });
      }).toThrowError(expect.objectContaining({ status: 403, code: 'COURSE_ACCESS_EXPIRED' }));

      // 7. Certificate issuance returns null
      expect(
        inMemoryStore.issueCourseVersionCertificate({
          userId: traineeUser.id,
          courseId,
          attemptId,
        })
      ).toBeNull();
    });

    it('RT-2.4.1-33: Seven surfaces agree on "review_only" access mode (read permitted, mutation blocked, zero new certs)', () => {
      seedCourse(courseId, 3);
      seedGroup({
        id: groupId,
        courseId,
        traineeId: traineeUser.id,
        startIso: '2026-01-01T00:00:00.000Z',
        deadlineIso: '2026-04-01T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
      });

      const attemptId = `ATT-${groupId}-${courseId}`;

      // 1. Resolver
      expect(inMemoryStore.resolveCourseAccess(traineeUser.id, courseId)).toBe('review_only');

      // 2. My Courses discovery: included with isExpired: true and canCertify: false
      const enrolled = inMemoryStore.getMyEnrolledCourses(traineeUser.id);
      const match = enrolled.find((c) => c.id === courseId);
      expect(match).toBeDefined();
      expect(match?.isExpired).toBe(true);
      expect(match?.canCertify).toBe(false);

      // 3. Dashboard counts course
      const db = inMemoryStore.getDashboardData(traineeUser);
      expect(db.stats.enrolledCount).toBe(1);

      // 4. Eligible attempts: 1 review_only option
      const eligible = inMemoryStore.getEligibleAttemptsForCourse(traineeUser.id, courseId);
      expect(eligible).toHaveLength(1);
      expect(eligible[0].accessMode).toBe('review_only');

      // 5. Progress read: readable with accessMode: 'review_only'
      const prog = inMemoryStore.getCourseProgress(traineeUser.id, courseId, { attemptId });
      expect(prog.accessMode).toBe('review_only');

      // 6. Activity rejected with 403 COURSE_ACCESS_REVIEW_ONLY
      expect(() => {
        inMemoryStore.recordLessonActivity({
          userId: traineeUser.id,
          courseId,
          itemId: `${courseId}-ITEM-1`,
          attemptId,
          activity: { lastPositionSeconds: 50 },
        });
      }).toThrowError(expect.objectContaining({ status: 403, code: 'COURSE_ACCESS_REVIEW_ONLY' }));

      // 7. Complete rejected with 403 COURSE_ACCESS_REVIEW_ONLY
      expect(() => {
        inMemoryStore.markLessonComplete({
          userId: traineeUser.id,
          courseId,
          itemId: `${courseId}-ITEM-1`,
          attemptId,
        });
      }).toThrowError(expect.objectContaining({ status: 403, code: 'COURSE_ACCESS_REVIEW_ONLY' }));

      // Certificate issuance blocked
      expect(
        inMemoryStore.issueCourseVersionCertificate({
          userId: traineeUser.id,
          courseId,
          attemptId,
        })
      ).toBeNull();
    });
  });
});

