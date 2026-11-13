import { describe, it, expect, beforeEach } from 'vitest';
import { inMemoryStore, MockStoreError, resolveCourseAccess } from '@/mocks/store/inMemoryStore';
import type { ChapterItem, Course, CourseChapter } from '@/core/courses/types';
import type { TrainingGroup, GroupRenewalCycle, GroupCycleCourseAssignment } from '@/core/groups/types';
import type { User } from '@/core/auth/types';

/**
 * MetroLMS — Phase 2 / WP-2.4 / T-2.4.2:
 * Seven-Surface Post-Deadline Access Enforcement & Multi-Attempt Cross-Mutation Isolation
 *
 * Requirements: MFR-23, MFR-42
 * Owner Decisions: D-06, D-07, D-12, D-13
 *
 * Scope:
 * - Surface 1: My Courses (`getMyEnrolledCourses`, `MyCoursesPage`)
 * - Surface 2: Student Dashboard (`getDashboardData`, `DashboardPage`)
 * - Surface 3: Group Details (`GroupDetailPage`, effective course metrics & UI action buttons)
 * - Surface 4: Learning Player (`resolveActiveAttemptForLearning`, `LearningPlayerPage`, attempt scoping)
 * - Surface 5: Progress Read API (`GET /api/courses/:courseId/progress`, `getCourseProgress`)
 * - Surface 6: Activity & Completion Mutation APIs (`recordLessonActivity`, `markLessonComplete`)
 * - Surface 7: Version-Scoped Certificate Issuance (`issueCourseVersionCertificate`)
 * - Multi-Attempt Cross-Mutation Isolation:
 *   * Scenario A: Active Standalone (S1 full) + Expired Group Hide (G1 none)
 *   * Scenario B: Active Standalone (S1 full) + Expired Group Keep No Cert (G1 review_only)
 *   * Scenario C: Independent Multi-Group Attempts (G2 full + G1 none/review_only)
 *
 * Non-execution governance note:
 * Authored under the Two-Gate Verification Governance model.
 * Status: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B (Phase 4 / T-4.4.1).
 */
describe('Phase 2 — WP-2.4 / T-2.4.2: Seven-Surface Post-Deadline Access Enforcement & Cross-Mutation Isolation', () => {
  const traineeUser: User = {
    id: 'usr_trainee_007',
    name: 'م. حسام الدين مصطفى',
    email: 'hossam.mostafa@cairo-metro.gov.eg',
    role: 'user',
    department: 'قطاع صيانة الوحدات المتحركة',
    jobTitle: 'فني صيانة قطارات أول',
  };

  const courseId = 'CRS-SURFACES-01';
  const groupAId = 'GRP-SURFACES-A';
  const groupBId = 'GRP-SURFACES-B';

  beforeEach(() => {
    inMemoryStore.reset({ seedReviewDemo: false, seedGroupDemo: false });
  });

  /**
   * Helper: Seeds a published course with required video items.
   */
  function seedCourse(id: string, itemCount = 3, title = 'إدارة وصيانة نظم الإشارات الحديثة'): Course {
    const items: ChapterItem[] = Array.from({ length: itemCount }, (_, idx) => ({
      id: `${id}-ITEM-${idx + 1}`,
      type: 'video',
      title: `درس النظم ${idx + 1}`,
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
      description: 'مقرر اختباري لإنفاذ سياسات الوصول عبر الأسطح السبعة',
      status: 'published',
      published: true,
      authorId: 'usr_lect_002',
      lecturerId: 'usr_lect_002',
      lecturerName: 'د. طارق الجوهري',
      category: 'هندسة الجر والإشارات',
      chapters,
      durationTotal: 900,
      passingGrade: 80,
      thumbnail: '/media/course-signals.jpg',
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
   * Helper: Seeds a training group with courses, cycles, and post-deadline policy.
   */
  function seedTrainingGroup(params: {
    groupId: string;
    courseId: string;
    postDeadlinePolicy: 'hide' | 'keep_no_cert';
    deadlineDaysAgo: number;
    traineeId: string;
    cycleId?: string;
  }): TrainingGroup {
    const pastDate = new Date(Date.now() - params.deadlineDaysAgo * 86400000).toISOString();
    const cycleId = params.cycleId || 'cycle_surface_01';

    const courseAssignment: GroupCycleCourseAssignment = {
      courseId: params.courseId,
      required: true,
      order: 1,
      deadlineOverride: pastDate,
      postDeadlinePolicyOverride: params.postDeadlinePolicy,
    };

    const cycle: GroupRenewalCycle = {
      id: cycleId,
      name: 'دورة التأهيل الفني المتقدمة',
      startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
      endDate: pastDate,
      status: 'completed',
      courses: [courseAssignment],
    };

    const group: TrainingGroup = {
      id: params.groupId,
      name: `مجموعة الصيانة المركزية ${params.groupId}`,
      code: `GRP-${params.groupId}`,
      description: 'مجموعة تدريبية لاختبار سياسات انتهاء الموعد',
      department: 'قطاع الوحدات المتحركة',
      status: 'active',
      adminStatus: 'active',
      postDeadlinePolicy: params.postDeadlinePolicy,
      deadlineDateTime: pastDate,
      assignedCourseIds: [params.courseId],
      courses: [
        {
          courseId: params.courseId,
          order: 1,
          required: true,
          deadlineDateTime: pastDate,
          postDeadlinePolicy: params.postDeadlinePolicy,
        },
      ],
      cycles: [cycle],
      traineeIds: [params.traineeId],
      supervisorIds: ['usr_lect_002'],
      resources: [],
      createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
      updatedAt: pastDate,
    };

    inMemoryStore.createGroup(group);
    return group;
  }

  // ===========================================================================
  // Surface 1: My Courses (`getMyEnrolledCourses` & `MyCoursesPage`)
  // ===========================================================================
  describe('Surface 1 — My Courses (`getMyEnrolledCourses`)', () => {
    it('S1-1: excludes courses with accessMode "none" from the trainee enrolled courses list', () => {
      seedCourse(courseId, 2);
      seedTrainingGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'hide',
        deadlineDaysAgo: 5,
        traineeId: traineeUser.id,
      });

      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_surface_01');

      const enrolled = inMemoryStore.getMyEnrolledCourses(traineeUser.id);
      expect(enrolled.find((c) => c.id === courseId)).toBeUndefined();
      expect(enrolled.length).toBe(0);
    });

    it('S1-2: includes courses with accessMode "review_only" marked with isExpired: true and policyLabel', () => {
      seedCourse(courseId, 2);
      seedTrainingGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'keep_no_cert',
        deadlineDaysAgo: 3,
        traineeId: traineeUser.id,
      });

      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_surface_01');

      const enrolled = inMemoryStore.getMyEnrolledCourses(traineeUser.id);
      const match = enrolled.find((c) => c.id === courseId);
      expect(match).toBeDefined();
      expect(match?.isExpired).toBe(true);
      expect(match?.canCertify).toBe(false);
      expect(match?.policyLabel).toBe('منتهية الصلاحية — للمطالعة بدون شهادة');
    });

    it('S1-3: retains course in My Courses with accessMode "full" when active standalone grant coexists with expired group grant', () => {
      seedCourse(courseId, 2);
      seedTrainingGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'hide',
        deadlineDaysAgo: 10,
        traineeId: traineeUser.id,
      });

      // Expired group grant + active standalone self-enrollment
      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_surface_01');
      inMemoryStore.selfEnrollUser(traineeUser.id, courseId);

      const enrolled = inMemoryStore.getMyEnrolledCourses(traineeUser.id);
      const match = enrolled.find((c) => c.id === courseId);
      expect(match).toBeDefined();
      expect(match?.isExpired).toBe(false);
      expect(match?.canCertify).toBe(true);
      expect(match?.policyLabel).toBeUndefined();
    });
  });

  // ===========================================================================
  // Surface 2: Student Dashboard (`getDashboardData` & `DashboardPage`)
  // ===========================================================================
  describe('Surface 2 — Student Dashboard (`getDashboardData`)', () => {
    it('S2-1: omits expired "none" courses from stats.enrolledCount, completedCount, and continueLearning', () => {
      seedCourse(courseId, 2);
      seedTrainingGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'hide',
        deadlineDaysAgo: 7,
        traineeId: traineeUser.id,
      });

      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_surface_01');

      const dashboard = inMemoryStore.getDashboardData(traineeUser);
      expect(dashboard.role).toBe('user');
      expect(dashboard.stats.enrolledCount).toBe(0);
      expect(dashboard.stats.completedCount).toBe(0);
      expect(dashboard.continueLearning).toBeNull();
    });

    it('S2-2: includes expired "review_only" course in dashboard stats and allows continueLearning card', () => {
      seedCourse(courseId, 2);
      seedTrainingGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'keep_no_cert',
        deadlineDaysAgo: 4,
        traineeId: traineeUser.id,
      });

      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_surface_01');

      const dashboard = inMemoryStore.getDashboardData(traineeUser);
      expect(dashboard.stats.enrolledCount).toBe(1);
      expect(dashboard.continueLearning).not.toBeNull();
      expect(dashboard.continueLearning?.courseId).toBe(courseId);
    });
  });

  // ===========================================================================
  // Surface 3: Group Details (`GroupDetailPage` & Metrics)
  // ===========================================================================
  describe('Surface 3 — Group Details (`getGroupMetrics` & Effective Settings)', () => {
    it('S3-1: marks expired course in group metrics with isExpired: true and preserves effective policy', () => {
      seedCourse(courseId, 2);
      const group = seedTrainingGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'hide',
        deadlineDaysAgo: 6,
        traineeId: traineeUser.id,
      });

      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_surface_01');

      const metrics = inMemoryStore.getGroupMetrics(group.id);
      expect(metrics).not.toBeNull();
      const courseMetric = metrics?.assignedCoursesMetrics.find((ac) => ac.courseId === courseId);
      expect(courseMetric).toBeDefined();
      expect(courseMetric?.effective.isExpired).toBe(true);
      expect(courseMetric?.effective.effectivePostDeadlinePolicy).toBe('hide');
    });

    it('S3-2: preserves review-only distinction for keep_no_cert policy in group course metrics', () => {
      seedCourse(courseId, 2);
      const group = seedTrainingGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'keep_no_cert',
        deadlineDaysAgo: 2,
        traineeId: traineeUser.id,
      });

      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_surface_01');

      const metrics = inMemoryStore.getGroupMetrics(group.id);
      const courseMetric = metrics?.assignedCoursesMetrics.find((ac) => ac.courseId === courseId);
      expect(courseMetric?.effective.isExpired).toBe(true);
      expect(courseMetric?.effective.effectivePostDeadlinePolicy).toBe('keep_no_cert');
    });
  });

  // ===========================================================================
  // Surface 4: Learning Player (`resolveActiveAttemptForLearning`)
  // ===========================================================================
  describe('Surface 4 — Learning Player Attempt Scoping', () => {
    it('S4-1: throws 403 COURSE_ACCESS_EXPIRED when attempting to access a course expired under "hide"', () => {
      seedCourse(courseId, 2);
      seedTrainingGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'hide',
        deadlineDaysAgo: 5,
        traineeId: traineeUser.id,
      });

      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_surface_01');

      expect(() => {
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: traineeUser.id,
          courseId,
          groupId: groupAId,
        });
      }).toThrowError(MockStoreError);

      try {
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: traineeUser.id,
          courseId,
          groupId: groupAId,
        });
      } catch (err: unknown) {
        const storeErr = err as MockStoreError;
        expect(storeErr.status).toBe(403);
        expect(storeErr.code).toBe('COURSE_ACCESS_EXPIRED');
      }
    });

    it('S4-2: allows reading attempt progress under "review_only" mode with accessMode: "review_only"', () => {
      seedCourse(courseId, 2);
      seedTrainingGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'keep_no_cert',
        deadlineDaysAgo: 3,
        traineeId: traineeUser.id,
      });

      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_surface_01');

      const attempt = inMemoryStore.resolveActiveAttemptForLearning({
        userId: traineeUser.id,
        courseId,
        groupId: groupAId,
      });
      expect(attempt).toBeDefined();

      const accessMode = inMemoryStore.getAttemptAccessMode(traineeUser.id, courseId, attempt.id);
      expect(accessMode).toBe('review_only');
    });
  });

  // ===========================================================================
  // Surface 5: Progress Read API (`getCourseProgress`)
  // ===========================================================================
  describe('Surface 5 — Progress Read API (`getCourseProgress`)', () => {
    it('S5-1: returns normal progress with accessMode: "full" when active', () => {
      seedCourse(courseId, 2);
      inMemoryStore.selfEnrollUser(traineeUser.id, courseId);

      const progress = inMemoryStore.getCourseProgress(traineeUser.id, courseId);
      expect(progress.accessMode).toBe('full');
      expect(progress.progressPercent).toBe(0);
      expect(progress.isCompleted).toBe(false);
    });

    it('S5-2: returns readable progress with accessMode: "review_only" when group deadline expired under keep_no_cert', () => {
      seedCourse(courseId, 2);
      seedTrainingGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'keep_no_cert',
        deadlineDaysAgo: 5,
        traineeId: traineeUser.id,
      });

      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_surface_01');

      const progress = inMemoryStore.getCourseProgress(traineeUser.id, courseId, { groupId: groupAId });
      expect(progress.accessMode).toBe('review_only');
      expect(progress.courseId).toBe(courseId);
    });

    it('S5-3: throws 403 COURSE_ACCESS_EXPIRED when reading progress for an attempt expired under "hide"', () => {
      seedCourse(courseId, 2);
      seedTrainingGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'hide',
        deadlineDaysAgo: 8,
        traineeId: traineeUser.id,
      });

      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_surface_01');

      expect(() => {
        inMemoryStore.getCourseProgress(traineeUser.id, courseId, { groupId: groupAId });
      }).toThrowError(MockStoreError);

      try {
        inMemoryStore.getCourseProgress(traineeUser.id, courseId, { groupId: groupAId });
      } catch (err: unknown) {
        const storeErr = err as MockStoreError;
        expect(storeErr.status).toBe(403);
        expect(storeErr.code).toBe('COURSE_ACCESS_EXPIRED');
      }
    });
  });

  // ===========================================================================
  // Surface 6: Activity & Completion Mutation APIs
  // ===========================================================================
  describe('Surface 6 — Activity & Completion Mutation APIs', () => {
    it('S6-1: allows recordLessonActivity and markLessonComplete when accessMode is "full"', () => {
      const course = seedCourse(courseId, 2);
      inMemoryStore.selfEnrollUser(traineeUser.id, courseId);

      const firstItem = course.chapters[0].items[0];

      // Activity recording
      const updatedItem = inMemoryStore.recordLessonActivity({
        userId: traineeUser.id,
        courseId,
        itemId: firstItem.id,
        activity: { currentTime: 150, furthestWatched: 150 },
        userRole: 'user',
      });
      expect(updatedItem.currentTime).toBe(150);

      // Lesson completion
      const completeRes = inMemoryStore.markLessonComplete({
        userId: traineeUser.id,
        courseId,
        itemId: firstItem.id,
        userRole: 'user',
      });
      expect(completeRes.item.completed).toBe(true);
      expect(completeRes.progress.completedItemIds).toContain(firstItem.id);
    });

    it('S6-2: rejects recordLessonActivity with 403 COURSE_ACCESS_REVIEW_ONLY on review_only attempts without modifying state', () => {
      const course = seedCourse(courseId, 2);
      seedTrainingGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'keep_no_cert',
        deadlineDaysAgo: 2,
        traineeId: traineeUser.id,
      });

      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_surface_01');
      const firstItem = course.chapters[0].items[0];

      expect(() => {
        inMemoryStore.recordLessonActivity({
          userId: traineeUser.id,
          courseId,
          itemId: firstItem.id,
          activity: { currentTime: 200 },
          userRole: 'user',
          groupId: groupAId,
        });
      }).toThrowError(MockStoreError);

      try {
        inMemoryStore.recordLessonActivity({
          userId: traineeUser.id,
          courseId,
          itemId: firstItem.id,
          activity: { currentTime: 200 },
          userRole: 'user',
          groupId: groupAId,
        });
      } catch (err: unknown) {
        const storeErr = err as MockStoreError;
        expect(storeErr.status).toBe(403);
        expect(storeErr.code).toBe('COURSE_ACCESS_REVIEW_ONLY');
      }

      // Verify state was NOT mutated
      const prog = inMemoryStore.getCourseProgress(traineeUser.id, courseId, { groupId: groupAId });
      expect(prog.itemsProgress[firstItem.id]?.currentTime || 0).toBe(0);
    });

    it('S6-3: rejects markLessonComplete with 403 COURSE_ACCESS_REVIEW_ONLY on review_only attempts without modifying state', () => {
      const course = seedCourse(courseId, 2);
      seedTrainingGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'keep_no_cert',
        deadlineDaysAgo: 2,
        traineeId: traineeUser.id,
      });

      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_surface_01');
      const firstItem = course.chapters[0].items[0];

      expect(() => {
        inMemoryStore.markLessonComplete({
          userId: traineeUser.id,
          courseId,
          itemId: firstItem.id,
          userRole: 'user',
          groupId: groupAId,
        });
      }).toThrowError(MockStoreError);

      try {
        inMemoryStore.markLessonComplete({
          userId: traineeUser.id,
          courseId,
          itemId: firstItem.id,
          userRole: 'user',
          groupId: groupAId,
        });
      } catch (err: unknown) {
        const storeErr = err as MockStoreError;
        expect(storeErr.status).toBe(403);
        expect(storeErr.code).toBe('COURSE_ACCESS_REVIEW_ONLY');
      }

      const prog = inMemoryStore.getCourseProgress(traineeUser.id, courseId, { groupId: groupAId });
      expect(prog.completedItemIds).not.toContain(firstItem.id);
      expect(prog.isCompleted).toBe(false);
    });

    it('S6-4: rejects mutations with 403 COURSE_ACCESS_EXPIRED on attempts with accessMode "none"', () => {
      const course = seedCourse(courseId, 2);
      seedTrainingGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'hide',
        deadlineDaysAgo: 5,
        traineeId: traineeUser.id,
      });

      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_surface_01');
      const firstItem = course.chapters[0].items[0];

      expect(() => {
        inMemoryStore.markLessonComplete({
          userId: traineeUser.id,
          courseId,
          itemId: firstItem.id,
          userRole: 'user',
          groupId: groupAId,
        });
      }).toThrowError(MockStoreError);

      try {
        inMemoryStore.markLessonComplete({
          userId: traineeUser.id,
          courseId,
          itemId: firstItem.id,
          userRole: 'user',
          groupId: groupAId,
        });
      } catch (err: unknown) {
        const storeErr = err as MockStoreError;
        expect(storeErr.status).toBe(403);
        expect(storeErr.code).toBe('COURSE_ACCESS_EXPIRED');
      }
    });
  });

  // ===========================================================================
  // Surface 7: Certificate Issuance
  // ===========================================================================
  describe('Surface 7 — Certificate Issuance (`issueCourseVersionCertificate`)', () => {
    it('S7-1: issues certificate for an active attempt with accessMode "full" upon 100% completion', () => {
      const course = seedCourse(courseId, 2);
      inMemoryStore.selfEnrollUser(traineeUser.id, courseId);

      const items = course.chapters[0].items;
      items.forEach((item) => {
        inMemoryStore.markLessonComplete({
          userId: traineeUser.id,
          courseId,
          itemId: item.id,
          userRole: 'user',
        });
      });

      const certs = inMemoryStore.getUserCertificates(traineeUser.id, courseId);
      expect(certs.length).toBe(1);
      expect(certs[0].courseId).toBe(courseId);
      expect(certs[0].courseVersionNumber).toBe(1);
    });

    it('S7-2: rejects certificate issuance for an attempt with accessMode "review_only"', () => {
      const course = seedCourse(courseId, 1);
      seedTrainingGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'keep_no_cert',
        deadlineDaysAgo: 2,
        traineeId: traineeUser.id,
      });

      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_surface_01');
      const attempt = inMemoryStore.resolveActiveAttemptForLearning({
        userId: traineeUser.id,
        courseId,
        groupId: groupAId,
      });

      // Attempt certificate issuance directly
      const cert = inMemoryStore.issueCourseVersionCertificate({
        userId: traineeUser.id,
        courseId,
        attemptId: attempt.id,
      });
      expect(cert).toBeNull();
    });

    it('S7-3: rejects certificate issuance for an attempt with accessMode "none"', () => {
      seedCourse(courseId, 1);
      seedTrainingGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'hide',
        deadlineDaysAgo: 5,
        traineeId: traineeUser.id,
      });

      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_surface_01');

      // Find the created attempt
      const attempts = inMemoryStore.getUserCourseAttempts(traineeUser.id, courseId);
      expect(attempts.length).toBe(1);

      const cert = inMemoryStore.issueCourseVersionCertificate({
        userId: traineeUser.id,
        courseId,
        attemptId: attempts[0].id,
      });
      expect(cert).toBeNull();
    });
  });

  // ===========================================================================
  // Multi-Attempt Cross-Mutation Isolation: Scenarios A, B, C
  // ===========================================================================
  describe('Multi-Attempt Cross-Mutation Isolation', () => {
    // -------------------------------------------------------------------------
    // Scenario A: Active Standalone (S1 full) + Expired Group Hide (G1 none)
    // -------------------------------------------------------------------------
    describe('Scenario A — Active Standalone (S1 full) + Expired Group Hide (G1 none)', () => {
      it('asserts attempt-scoped authorization, mutation rejection, and zero progress leakage', () => {
        const course = seedCourse(courseId, 2);
        const item1 = course.chapters[0].items[0];
        const item2 = course.chapters[0].items[1];

        // 1. Setup expired group with policy: 'hide'
        seedTrainingGroup({
          groupId: groupAId,
          courseId,
          postDeadlinePolicy: 'hide',
          deadlineDaysAgo: 10,
          traineeId: traineeUser.id,
        });
        inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_surface_01');

        const groupAttempts = inMemoryStore.getUserCourseAttempts(traineeUser.id, courseId);
        expect(groupAttempts.length).toBe(1);
        const attemptG1 = groupAttempts[0];

        // 2. Setup active catalog self-enrollment (S1)
        inMemoryStore.selfEnrollUser(traineeUser.id, courseId);

        const allAttempts = inMemoryStore.getUserCourseAttempts(traineeUser.id, courseId);
        expect(allAttempts.length).toBe(2);
        const attemptS1 = allAttempts.find((a) => a.id !== attemptG1.id)!;
        expect(attemptS1).toBeDefined();

        // Verify individual access modes
        expect(inMemoryStore.getAttemptAccessMode(traineeUser.id, courseId, attemptS1.id)).toBe('full');
        expect(inMemoryStore.getAttemptAccessMode(traineeUser.id, courseId, attemptG1.id)).toBe('none');
        // Course-level access is preserved via active S1 grant
        expect(inMemoryStore.resolveCourseAccess(traineeUser.id, courseId)).toBe('full');

        // 3. Mutating S1 succeeds
        const s1Activity = inMemoryStore.recordLessonActivity({
          userId: traineeUser.id,
          courseId,
          itemId: item1.id,
          activity: { currentTime: 180, furthestWatched: 180 },
          userRole: 'user',
          attemptId: attemptS1.id,
        });
        expect(s1Activity.currentTime).toBe(180);

        const s1Complete = inMemoryStore.markLessonComplete({
          userId: traineeUser.id,
          courseId,
          itemId: item1.id,
          userRole: 'user',
          attemptId: attemptS1.id,
        });
        expect(s1Complete.item.completed).toBe(true);

        // 4. Mutating G1 returns 403 COURSE_ACCESS_EXPIRED
        expect(() => {
          inMemoryStore.recordLessonActivity({
            userId: traineeUser.id,
            courseId,
            itemId: item1.id,
            activity: { currentTime: 180 },
            userRole: 'user',
            attemptId: attemptG1.id,
          });
        }).toThrowError(MockStoreError);

        try {
          inMemoryStore.recordLessonActivity({
            userId: traineeUser.id,
            courseId,
            itemId: item1.id,
            activity: { currentTime: 180 },
            userRole: 'user',
            attemptId: attemptG1.id,
          });
        } catch (err: unknown) {
          const storeErr = err as MockStoreError;
          expect(storeErr.status).toBe(403);
          expect(storeErr.code).toBe('COURSE_ACCESS_EXPIRED');
        }

        expect(() => {
          inMemoryStore.markLessonComplete({
            userId: traineeUser.id,
            courseId,
            itemId: item1.id,
            userRole: 'user',
            attemptId: attemptG1.id,
          });
        }).toThrowError(MockStoreError);

        try {
          inMemoryStore.markLessonComplete({
            userId: traineeUser.id,
            courseId,
            itemId: item1.id,
            userRole: 'user',
            attemptId: attemptG1.id,
          });
        } catch (err: unknown) {
          const storeErr = err as MockStoreError;
          expect(storeErr.status).toBe(403);
          expect(storeErr.code).toBe('COURSE_ACCESS_EXPIRED');
        }

        // 5. Attempt G1 remains completely unchanged (0% progress, 0 completed items)
        const g1Prog = inMemoryStore.getAttemptProgress(attemptG1.id);
        expect(g1Prog?.completedItemIds.length).toBe(0);
        expect(g1Prog?.progressPercent).toBe(0);
        expect(g1Prog?.isCompleted).toBe(false);

        // 6. Certificate issuance for G1 is rejected
        const certG1 = inMemoryStore.issueCourseVersionCertificate({
          userId: traineeUser.id,
          courseId,
          attemptId: attemptG1.id,
        });
        expect(certG1).toBeNull();

        // 7. Complete S1 100% and verify S1 certificate issuance succeeds
        inMemoryStore.markLessonComplete({
          userId: traineeUser.id,
          courseId,
          itemId: item2.id,
          userRole: 'user',
          attemptId: attemptS1.id,
        });

        const certS1 = inMemoryStore.issueCourseVersionCertificate({
          userId: traineeUser.id,
          courseId,
          attemptId: attemptS1.id,
        });
        expect(certS1).not.toBeNull();
        expect(certS1?.courseVersionNumber).toBe(1);

        // 8. Progress is NEVER merged between S1 and G1
        const finalS1Prog = inMemoryStore.getAttemptProgress(attemptS1.id);
        const finalG1Prog = inMemoryStore.getAttemptProgress(attemptG1.id);
        expect(finalS1Prog?.progressPercent).toBe(100);
        expect(finalS1Prog?.completedItemIds).toEqual([item1.id, item2.id]);
        expect(finalG1Prog?.progressPercent).toBe(0);
        expect(finalG1Prog?.completedItemIds).toEqual([]);
      });
    });

    // -------------------------------------------------------------------------
    // Scenario B: Active Standalone (S1 full) + Expired Group Keep No Cert (G1 review_only)
    // -------------------------------------------------------------------------
    describe('Scenario B — Active Standalone (S1 full) + Expired Group Keep No Cert (G1 review_only)', () => {
      it('asserts review_only read permissions, mutation rejection, and independent lifecycle', () => {
        const course = seedCourse(courseId, 2);
        const item1 = course.chapters[0].items[0];

        // 1. Setup expired group with policy: 'keep_no_cert'
        seedTrainingGroup({
          groupId: groupAId,
          courseId,
          postDeadlinePolicy: 'keep_no_cert',
          deadlineDaysAgo: 4,
          traineeId: traineeUser.id,
        });
        inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_surface_01');

        const groupAttempts = inMemoryStore.getUserCourseAttempts(traineeUser.id, courseId);
        const attemptG1 = groupAttempts[0];

        // 2. Setup active catalog self-enrollment (S1)
        inMemoryStore.selfEnrollUser(traineeUser.id, courseId);
        const allAttempts = inMemoryStore.getUserCourseAttempts(traineeUser.id, courseId);
        const attemptS1 = allAttempts.find((a) => a.id !== attemptG1.id)!;

        expect(inMemoryStore.getAttemptAccessMode(traineeUser.id, courseId, attemptS1.id)).toBe('full');
        expect(inMemoryStore.getAttemptAccessMode(traineeUser.id, courseId, attemptG1.id)).toBe('review_only');

        // 3. Mutating S1 succeeds
        const s1Res = inMemoryStore.markLessonComplete({
          userId: traineeUser.id,
          courseId,
          itemId: item1.id,
          userRole: 'user',
          attemptId: attemptS1.id,
        });
        expect(s1Res.item.completed).toBe(true);

        // 4. Mutating G1 returns 403 COURSE_ACCESS_REVIEW_ONLY
        expect(() => {
          inMemoryStore.markLessonComplete({
            userId: traineeUser.id,
            courseId,
            itemId: item1.id,
            userRole: 'user',
            attemptId: attemptG1.id,
          });
        }).toThrowError(MockStoreError);

        try {
          inMemoryStore.markLessonComplete({
            userId: traineeUser.id,
            courseId,
            itemId: item1.id,
            userRole: 'user',
            attemptId: attemptG1.id,
          });
        } catch (err: unknown) {
          const storeErr = err as MockStoreError;
          expect(storeErr.status).toBe(403);
          expect(storeErr.code).toBe('COURSE_ACCESS_REVIEW_ONLY');
        }

        // 5. G1 remains readable
        const g1Prog = inMemoryStore.getCourseProgress(traineeUser.id, courseId, { attemptId: attemptG1.id });
        expect(g1Prog.accessMode).toBe('review_only');
        expect(g1Prog.completedItemIds).toEqual([]);

        // 6. Certificate issuance for G1 returns no certificate
        const certG1 = inMemoryStore.issueCourseVersionCertificate({
          userId: traineeUser.id,
          courseId,
          attemptId: attemptG1.id,
        });
        expect(certG1).toBeNull();

        // 7. S1 and G1 remain completely independent
        const s1Prog = inMemoryStore.getCourseProgress(traineeUser.id, courseId, { attemptId: attemptS1.id });
        expect(s1Prog.completedItemIds).toEqual([item1.id]);
        expect(g1Prog.completedItemIds).toEqual([]);
      });
    });

    // -------------------------------------------------------------------------
    // Scenario C: Independent Multi-Group Attempts
    // -------------------------------------------------------------------------
    describe('Scenario C — Independent Multi-Group Attempts', () => {
      it('asserts active group attempt (G2 full) coexists with expired group attempt (G1 hide / none)', () => {
        const course = seedCourse(courseId, 2);
        const item1 = course.chapters[0].items[0];

        // Group 1: expired hide
        seedTrainingGroup({
          groupId: groupAId,
          courseId,
          postDeadlinePolicy: 'hide',
          deadlineDaysAgo: 12,
          traineeId: traineeUser.id,
          cycleId: 'cycle_grp_a',
        });
        inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_grp_a');

        // Group 2: active with future deadline
        const futureDate = new Date(Date.now() + 15 * 86400000).toISOString();
        const group2: TrainingGroup = {
          id: groupBId,
          name: `مجموعة الإشارات المستقبلية ${groupBId}`,
          code: `GRP-${groupBId}`,
          description: 'مجموعة تدريبية نشطة',
          department: 'قطاع الوحدات المتحركة',
          status: 'active',
          adminStatus: 'active',
          postDeadlinePolicy: 'hide',
          deadlineDateTime: futureDate,
          assignedCourseIds: [courseId],
          courses: [
            {
              courseId,
              order: 1,
              required: true,
              deadlineDateTime: futureDate,
              postDeadlinePolicy: 'hide',
            },
          ],
          cycles: [],
          traineeIds: [traineeUser.id],
          supervisorIds: ['usr_lect_002'],
          resources: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        inMemoryStore.createGroup(group2);
        inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupBId);

        const attempts = inMemoryStore.getUserCourseAttempts(traineeUser.id, courseId);
        expect(attempts.length).toBe(2);

        const attemptG1 = attempts.find((a) => a.groupId === groupAId)!;
        const attemptG2 = attempts.find((a) => a.groupId === groupBId)!;

        expect(inMemoryStore.getAttemptAccessMode(traineeUser.id, courseId, attemptG1.id)).toBe('none');
        expect(inMemoryStore.getAttemptAccessMode(traineeUser.id, courseId, attemptG2.id)).toBe('full');

        // Mutating G2 succeeds
        const g2Res = inMemoryStore.markLessonComplete({
          userId: traineeUser.id,
          courseId,
          itemId: item1.id,
          userRole: 'user',
          attemptId: attemptG2.id,
        });
        expect(g2Res.item.completed).toBe(true);

        // Mutating G1 fails with 403 COURSE_ACCESS_EXPIRED
        expect(() => {
          inMemoryStore.markLessonComplete({
            userId: traineeUser.id,
            courseId,
            itemId: item1.id,
            userRole: 'user',
            attemptId: attemptG1.id,
          });
        }).toThrowError(MockStoreError);

        // Progress remains unmerged
        const p1 = inMemoryStore.getAttemptProgress(attemptG1.id);
        const p2 = inMemoryStore.getAttemptProgress(attemptG2.id);
        expect(p1?.completedItemIds).toEqual([]);
        expect(p2?.completedItemIds).toEqual([item1.id]);
      });

      it('asserts active group attempt (G2 full) coexists with expired group attempt (G1 keep_no_cert / review_only)', () => {
        const course = seedCourse(courseId, 2);
        const item1 = course.chapters[0].items[0];

        // Group 1: expired keep_no_cert
        seedTrainingGroup({
          groupId: groupAId,
          courseId,
          postDeadlinePolicy: 'keep_no_cert',
          deadlineDaysAgo: 5,
          traineeId: traineeUser.id,
          cycleId: 'cycle_grp_a',
        });
        inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId, 'cycle_grp_a');

        // Group 2: active with future deadline
        const futureDate = new Date(Date.now() + 20 * 86400000).toISOString();
        const group2: TrainingGroup = {
          id: groupBId,
          name: `مجموعة الصيانة الدورية ${groupBId}`,
          code: `GRP-${groupBId}`,
          description: 'مجموعة تدريبية نشطة',
          department: 'قطاع الوحدات المتحركة',
          status: 'active',
          adminStatus: 'active',
          postDeadlinePolicy: 'keep_no_cert',
          deadlineDateTime: futureDate,
          assignedCourseIds: [courseId],
          courses: [
            {
              courseId,
              order: 1,
              required: true,
              deadlineDateTime: futureDate,
              postDeadlinePolicy: 'keep_no_cert',
            },
          ],
          cycles: [],
          traineeIds: [traineeUser.id],
          supervisorIds: ['usr_lect_002'],
          resources: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        inMemoryStore.createGroup(group2);
        inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupBId);

        const attempts = inMemoryStore.getUserCourseAttempts(traineeUser.id, courseId);
        const attemptG1 = attempts.find((a) => a.groupId === groupAId)!;
        const attemptG2 = attempts.find((a) => a.groupId === groupBId)!;

        expect(inMemoryStore.getAttemptAccessMode(traineeUser.id, courseId, attemptG1.id)).toBe('review_only');
        expect(inMemoryStore.getAttemptAccessMode(traineeUser.id, courseId, attemptG2.id)).toBe('full');

        // Mutating G2 succeeds
        const g2Res = inMemoryStore.markLessonComplete({
          userId: traineeUser.id,
          courseId,
          itemId: item1.id,
          userRole: 'user',
          attemptId: attemptG2.id,
        });
        expect(g2Res.item.completed).toBe(true);

        // Mutating G1 fails with 403 COURSE_ACCESS_REVIEW_ONLY
        expect(() => {
          inMemoryStore.markLessonComplete({
            userId: traineeUser.id,
            courseId,
            itemId: item1.id,
            userRole: 'user',
            attemptId: attemptG1.id,
          });
        }).toThrowError(MockStoreError);

        // Progress remains completely isolated
        const p1 = inMemoryStore.getAttemptProgress(attemptG1.id);
        const p2 = inMemoryStore.getAttemptProgress(attemptG2.id);
        expect(p1?.completedItemIds).toEqual([]);
        expect(p2?.completedItemIds).toEqual([item1.id]);
      });
    });
  });
});

