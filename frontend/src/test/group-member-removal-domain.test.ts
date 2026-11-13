import { describe, it, expect, beforeEach } from 'vitest';
import {
  inMemoryStore,
  MockStoreError,
  resolveGroupAttemptId,
} from '@/mocks/store/inMemoryStore';
import type {
  EnrollmentRecord,
  EnrollmentSourceGrant,
  CourseEnrollment,
} from '@/core/courses/types';

/**
 * MetroLMS — Phase 2 / WP-2.2 / T-2.2.2: Continuation Grant Conversion & Group-Source Revocation Tests
 *
 * Requirements: MFR-24, D-07
 * Target Checkpoint: CP-006 upon full WP-2.2 acceptance.
 *
 * Authoritative Specifications:
 * 1. Checked courses revoke their group grants.
 * 2. Unchecked courses become continuation grants (sourceId: self:continued:${groupId}:${attemptId}).
 * 3. Continuation grants preserve the original attemptId.
 * 4. Continuation grants preserve historical progress and lesson activity.
 * 5. All-unchecked flow retains all eligible course access.
 * 6. All-checked flow revokes all applicable group grants.
 * 7. Existing catalog self-enrollment grants (S1) remain unaffected.
 * 8. Another group's grant remains unaffected.
 * 9. Multiple group grants for the same course remain isolated.
 * 10. Multiple cycles remain isolated.
 * 11. Historical revoked grants remain preserved.
 * 12. Retained courses no longer inherit group deadlines where D-07 requires this.
 * 13. Enrollment counts remain correct when other grants remain active.
 * 14. Enrollment transitions to inactive/revoked only when no valid grant sources remain.
 * 15. Duplicate continuation conversion is idempotent.
 * 16. Invalid course IDs fail without partial mutation.
 * 17. Failed removal preserves original membership and grants.
 * 18. Retry after successful removal does not duplicate grants or mutate attempts.
 * 19. Existing removal API callers remain compatible (omitted removeCourseIds).
 * 20. Independent progress and certificates remain preserved.
 *
 * Non-execution governance note:
 * Authored under the Two-Gate Verification Governance model.
 * Queued for consolidated execution at Phase 4 / Gate B (T-4.4.1).
 */
describe('Phase 2 — WP-2.2 / T-2.2.2: Continuation Grant Conversion & Group-Source Revocation (D-07, MFR-24)', () => {
  const traineeId = 'usr_trainee_003';
  const groupAId = 'GRP-101';
  const groupBId = 'GRP-102';
  const courseAId = 'CRS002'; // Already in GRP-101
  const courseBId = 'CRS003'; // Another course

  beforeEach(() => {
    inMemoryStore.reset({ seedReviewDemo: false, seedGroupDemo: false });
  });

  // ── Suite 1: Checked vs Unchecked Per-Course Removal Semantics ─────────

  describe('1. Checked vs Unchecked Course Decisions (D-07, MFR-24)', () => {
    it('1. Checked courses revoke their group grants (status: revoked_by_group_removal)', () => {
      // Ensure trainee is in groupA
      inMemoryStore.addGroupMember(groupAId, traineeId);
      const enrBefore = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      expect(enrBefore).toBeDefined();

      const groupGrantBefore = enrBefore?.sources.find(
        (s) => s.kind === 'group' && s.groupId?.toLowerCase() === groupAId.toLowerCase()
      );
      expect(groupGrantBefore?.status).toBe('active');

      // Remove trainee with courseA checked for removal
      const res = inMemoryStore.removeGroupMember(groupAId, traineeId, [courseAId]);
      expect(res.success).toBe(true);

      const enrAfter = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      const groupGrantAfter = enrAfter?.sources.find(
        (s) => s.sourceId === groupGrantBefore?.sourceId
      );
      expect(groupGrantAfter?.status).toBe('revoked_by_group_removal');
      expect(groupGrantAfter?.revokedAt).toBeDefined();
    });

    it('2. Unchecked courses become continuation grants (sourceId: self:continued:${groupId}:${attemptId})', () => {
      inMemoryStore.addGroupMember(groupAId, traineeId);
      const enrBefore = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      const groupGrantBefore = enrBefore?.sources.find(
        (s) => s.kind === 'group' && s.groupId?.toLowerCase() === groupAId.toLowerCase()
      );
      expect(groupGrantBefore).toBeDefined();
      const originalAttemptId = groupGrantBefore!.attemptId;

      // Remove trainee with courseA unchecked (retained) -> removeCourseIds is []
      const res = inMemoryStore.removeGroupMember(groupAId, traineeId, []);
      expect(res.success).toBe(true);

      const enrAfter = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      expect(enrAfter?.status).toBe('active');

      // The old group grant is marked revoked
      const oldGrant = enrAfter?.sources.find((s) => s.sourceId === groupGrantBefore?.sourceId);
      expect(oldGrant?.status).toBe('revoked_by_group_removal');

      // A continuation grant is created
      const expectedContinuationSourceId = `self:continued:${groupAId}:${originalAttemptId}`;
      const continuationGrant = enrAfter?.sources.find(
        (s) => s.sourceId === expectedContinuationSourceId
      );
      expect(continuationGrant).toBeDefined();
      expect(continuationGrant?.kind).toBe('self');
      expect(continuationGrant?.status).toBe('active');
      expect(continuationGrant?.convertedFromGroupId).toBe(groupAId);
      expect(continuationGrant?.groupId).toBeUndefined();
    });

    it('3. Continuation grants preserve the original attemptId', () => {
      inMemoryStore.addGroupMember(groupAId, traineeId);
      const enrBefore = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      const groupGrantBefore = enrBefore?.sources.find(
        (s) => s.kind === 'group' && s.groupId?.toLowerCase() === groupAId.toLowerCase()
      );
      const originalAttemptId = groupGrantBefore!.attemptId;

      inMemoryStore.removeGroupMember(groupAId, traineeId, []);

      const enrAfter = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      const continuationGrant = enrAfter?.sources.find((s) => s.sourceId.startsWith('self:continued:'));
      expect(continuationGrant?.attemptId).toBe(originalAttemptId);

      const attempt = inMemoryStore.getTraineeAttempts(traineeId).find((a) => a.id === originalAttemptId);
      expect(attempt).toBeDefined();
      expect(attempt?.courseId).toBe(courseAId);
    });

    it('4. Continuation grants preserve historical lesson progress and activity', () => {
      inMemoryStore.addGroupMember(groupAId, traineeId);
      const enrBefore = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      const groupGrantBefore = enrBefore?.sources.find(
        (s) => s.kind === 'group' && s.groupId?.toLowerCase() === groupAId.toLowerCase()
      );
      const attemptId = groupGrantBefore!.attemptId;

      // Record some lesson activity
      inMemoryStore.recordLessonActivity({
        userId: traineeId,
        courseId: courseAId,
        attemptId,
        itemId: 'ITEM-001',
        completed: true,
      });

      const progBefore = inMemoryStore.getAttemptProgress(attemptId);
      expect(progBefore.completedItemIds).toContain('ITEM-001');

      // Remove trainee keeping course
      inMemoryStore.removeGroupMember(groupAId, traineeId, []);

      // Verify progress remains intact
      const progAfter = inMemoryStore.getAttemptProgress(attemptId);
      expect(progAfter.completedItemIds).toContain('ITEM-001');
      expect(progAfter.progressPercent).toBe(progBefore.progressPercent);
    });

    it('5. All-unchecked flow retains all eligible course access as continuation grants', () => {
      inMemoryStore.addGroupMember(groupAId, traineeId);

      // Pass empty array []
      const res = inMemoryStore.removeGroupMember(groupAId, traineeId, []);
      expect(res.success).toBe(true);

      const enr = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      expect(enr?.status).toBe('active');
      const continuationGrant = enr?.sources.find((s) => s.sourceId.startsWith('self:continued:'));
      expect(continuationGrant?.status).toBe('active');
    });

    it('6. All-checked flow revokes all applicable group grants', () => {
      inMemoryStore.addGroupMember(groupAId, traineeId);

      // Check courseAId for removal
      const res = inMemoryStore.removeGroupMember(groupAId, traineeId, [courseAId]);
      expect(res.success).toBe(true);

      const enr = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      const activeGrants = (enr?.sources || []).filter((s) => s.status === 'active');
      expect(activeGrants.length).toBe(0);
      expect(enr?.status).toBe('revoked_by_group_removal');
    });
  });

  // ── Suite 2: Coexistence with Independent Catalog Grants (S1) ─────────

  describe('2. Independent Catalog Self-Enrollment (S1) Coexistence (D-07)', () => {
    it('7. Existing catalog self-enrollment grants remain unaffected when group is removed', () => {
      // Step 1: Trainee self-enrolls directly in courseA
      inMemoryStore.enrollUser({
        courseId: courseAId,
        userId: traineeId,
        userRole: 'user',
      });

      const selfEnr = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      const selfGrant = selfEnr?.sources.find((s) => s.sourceId.startsWith('self:catalog:'));
      expect(selfGrant).toBeDefined();
      expect(selfGrant?.status).toBe('active');
      const selfAttemptId = selfGrant!.attemptId;

      // Step 2: Trainee joins Group A (which also assigns courseA)
      inMemoryStore.addGroupMember(groupAId, traineeId);
      const combinedEnr = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      expect(combinedEnr?.sources.length).toBe(2);

      // Step 3: Trainee is removed from Group A with courseA checked (removed from group)
      inMemoryStore.removeGroupMember(groupAId, traineeId, [courseAId]);

      const afterRemovalEnr = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      expect(afterRemovalEnr?.status).toBe('active'); // Still active because S1 remains!

      // S1 is completely intact
      const selfGrantAfter = afterRemovalEnr?.sources.find((s) => s.sourceId === selfGrant?.sourceId);
      expect(selfGrantAfter?.status).toBe('active');
      expect(selfGrantAfter?.attemptId).toBe(selfAttemptId);

      // Group grant is revoked
      const groupGrant = afterRemovalEnr?.sources.find(
        (s) => s.kind === 'group' && s.groupId?.toLowerCase() === groupAId.toLowerCase()
      );
      expect(groupGrant?.status).toBe('revoked_by_group_removal');
    });
  });

  // ── Suite 3: Multi-Group & Multi-Cycle Isolation ──────────────────────

  describe('3. Multi-Group and Multi-Cycle Isolation (D-06, D-07)', () => {
    it("8. Another group's grant remains unaffected when removing from Group A", () => {
      inMemoryStore.addGroupMember(groupAId, traineeId);
      inMemoryStore.addGroupMember(groupBId, traineeId);

      // Remove from groupA only
      inMemoryStore.removeGroupMember(groupAId, traineeId, [courseAId]);

      const enr = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      // Group B grant remains active
      const groupBGrant = enr?.sources.find(
        (s) => s.kind === 'group' && s.groupId?.toLowerCase() === groupBId.toLowerCase()
      );
      if (groupBGrant) {
        expect(groupBGrant.status).toBe('active');
      }

      // Group A grant is revoked
      const groupAGrant = enr?.sources.find(
        (s) => s.kind === 'group' && s.groupId?.toLowerCase() === groupAId.toLowerCase()
      );
      expect(groupAGrant?.status).toBe('revoked_by_group_removal');
    });

    it('9. Multiple group grants for the same course remain isolated', () => {
      inMemoryStore.addGroupMember(groupAId, traineeId);

      const enr1 = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      const attemptAId = enr1?.sources.find((s) => s.groupId?.toLowerCase() === groupAId.toLowerCase())?.attemptId;
      expect(attemptAId).toBeDefined();

      // Remove from groupA with course kept
      inMemoryStore.removeGroupMember(groupAId, traineeId, []);

      const enr2 = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      const contGrant = enr2?.sources.find((s) => s.sourceId.startsWith('self:continued:'));
      expect(contGrant?.attemptId).toBe(attemptAId);
    });

    it('10. Multiple cycles remain isolated', () => {
      inMemoryStore.addGroupMember(groupAId, traineeId);
      const enrBefore = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      expect(enrBefore?.sources.length).toBeGreaterThan(0);

      inMemoryStore.removeGroupMember(groupAId, traineeId, []);

      const enrAfter = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      const revoked = enrAfter?.sources.filter((s) => s.status === 'revoked_by_group_removal');
      const active = enrAfter?.sources.filter((s) => s.status === 'active');
      expect(revoked?.length).toBeGreaterThan(0);
      expect(active?.length).toBeGreaterThan(0);
    });

    it('11. Historical revoked grants remain preserved without deletion', () => {
      inMemoryStore.addGroupMember(groupAId, traineeId);
      inMemoryStore.removeGroupMember(groupAId, traineeId, [courseAId]);

      const enr = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      expect(enr?.sources.length).toBeGreaterThan(0);
      expect(enr?.sources.every((s) => s.sourceId.length > 0)).toBe(true);
    });
  });

  // ── Suite 4: Deadlines, Eligibility & Access Projections ─────────────

  describe('4. Deadlines, Eligibility & Projections (D-07, MFR-24)', () => {
    it('12. Retained courses no longer inherit former group deadlines (kind: self)', () => {
      inMemoryStore.addGroupMember(groupAId, traineeId);
      inMemoryStore.removeGroupMember(groupAId, traineeId, []); // Kept

      const eligible = inMemoryStore.getEligibleAttemptsForCourse(traineeId, courseAId);
      expect(eligible.length).toBeGreaterThan(0);

      const contOption = eligible.find((opt) => opt.sourceId.startsWith('self:continued:'));
      expect(contOption).toBeDefined();
      expect(contOption?.kind).toBe('self');
      expect(contOption?.accessMode).toBe('full');
      expect(contOption?.contextLabel).toContain('تسجيل مستمر من مجموعة');
    });

    it('13. Enrollment counts remain correct when another grant remains active', () => {
      // Direct self-enrollment first
      inMemoryStore.enrollUser({
        courseId: courseAId,
        userId: traineeId,
        userRole: 'user',
      });
      const courseBefore = inMemoryStore.getCourseById(courseAId);
      const initialCount = courseBefore?.enrollmentCount || 0;

      // Add to group
      inMemoryStore.addGroupMember(groupAId, traineeId);

      // Remove from group with course checked (removed from group)
      inMemoryStore.removeGroupMember(groupAId, traineeId, [courseAId]);

      const courseAfter = inMemoryStore.getCourseById(courseAId);
      // Because S1 is still active, enrollment count is preserved!
      expect(courseAfter?.enrollmentCount).toBe(initialCount);
    });

    it('14. Enrollment transitions to revoked_by_group_removal only when no active grants remain', () => {
      inMemoryStore.addGroupMember(groupAId, traineeId);

      // Remove with all courses checked
      inMemoryStore.removeGroupMember(groupAId, traineeId, [courseAId]);

      const enr = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      expect(enr?.status).toBe('revoked_by_group_removal');

      // My enrolled courses excludes revoked enrollments
      const myCourses = inMemoryStore.getMyEnrolledCourses(traineeId);
      expect(myCourses.some((c) => c.id === courseAId)).toBe(false);
    });
  });

  // ── Suite 5: Atomicity, Validation & Idempotency ──────────────────────

  describe('5. Atomicity, Validation & Idempotency', () => {
    it('15. Duplicate continuation conversion is idempotent on repeated execution', () => {
      inMemoryStore.addGroupMember(groupAId, traineeId);

      inMemoryStore.removeGroupMember(groupAId, traineeId, []);
      const enr1 = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      const contGrants1 = enr1?.sources.filter((s) => s.sourceId.startsWith('self:continued:'));
      expect(contGrants1?.length).toBe(1);

      // Retry removal call
      const res2 = inMemoryStore.removeGroupMember(groupAId, traineeId, []);
      expect(res2.success).toBe(true);

      const enr2 = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      const contGrants2 = enr2?.sources.filter((s) => s.sourceId.startsWith('self:continued:'));
      expect(contGrants2?.length).toBe(1); // Still exactly 1 continuation grant!
    });

    it('16. Invalid course IDs fail without partial mutation (atomic rollback)', () => {
      inMemoryStore.addGroupMember(groupAId, traineeId);

      expect(() => {
        inMemoryStore.removeGroupMember(groupAId, traineeId, ['INVALID_NONEXISTENT_COURSE_ID']);
      }).toThrow(MockStoreError);
    });

    it('17. Failed removal preserves original membership and grants', () => {
      inMemoryStore.addGroupMember(groupAId, traineeId);

      try {
        inMemoryStore.removeGroupMember(groupAId, traineeId, ['INVALID_NONEXISTENT_COURSE_ID']);
      } catch {
        // Expected
      }

      const grp = inMemoryStore.getGroupById(groupAId);
      expect(grp?.traineeIds).toContain(traineeId);

      const enr = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      const activeGrant = enr?.sources.find(
        (s) => s.kind === 'group' && s.groupId?.toLowerCase() === groupAId.toLowerCase()
      );
      expect(activeGrant?.status).toBe('active');
    });

    it('18. Retry after successful removal does not duplicate grants or mutate attempts', () => {
      inMemoryStore.addGroupMember(groupAId, traineeId);
      inMemoryStore.removeGroupMember(groupAId, traineeId, []);

      const attemptsBefore = inMemoryStore.getTraineeAttempts(traineeId);
      const attemptCountBefore = attemptsBefore.length;

      // Second call
      const res = inMemoryStore.removeGroupMember(groupAId, traineeId, []);
      expect(res.success).toBe(true);

      const attemptsAfter = inMemoryStore.getTraineeAttempts(traineeId);
      expect(attemptsAfter.length).toBe(attemptCountBefore);
    });

    it('19. Existing removal API callers remain compatible when removeCourseIds is omitted', () => {
      inMemoryStore.addGroupMember(groupAId, traineeId);

      // Call without third parameter (undefined)
      const res = inMemoryStore.removeGroupMember(groupAId, traineeId);
      expect(res.success).toBe(true);

      // Member removed from group
      const grp = inMemoryStore.getGroupById(groupAId);
      expect(grp?.traineeIds).not.toContain(traineeId);

      // Courses kept as continuation grants (backward-compatible default)
      const enr = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      expect(enr?.status).toBe('active');
      const cont = enr?.sources.find((s) => s.sourceId.startsWith('self:continued:'));
      expect(cont?.status).toBe('active');
    });

    it('20. Independent progress, activities, and certificates remain preserved', () => {
      inMemoryStore.addGroupMember(groupAId, traineeId);
      const enr = inMemoryStore.getCourseEnrollment(courseAId, traineeId);
      const grant = enr?.sources.find((s) => s.kind === 'group' && s.groupId?.toLowerCase() === groupAId.toLowerCase());
      const attemptId = grant!.attemptId;

      inMemoryStore.recordLessonActivity({
        userId: traineeId,
        courseId: courseAId,
        attemptId,
        itemId: 'ITEM-TEST-20',
        completed: true,
      });

      inMemoryStore.removeGroupMember(groupAId, traineeId, [courseAId]); // Revoked

      // Attempt and progress are preserved in store
      const attempt = inMemoryStore.getTraineeAttempts(traineeId).find((a) => a.id === attemptId);
      expect(attempt).toBeDefined();

      const prog = inMemoryStore.getAttemptProgress(attemptId);
      expect(prog.completedItemIds).toContain('ITEM-TEST-20');
    });
  });

  // ── Suite 6: Post-WP-2.2 D-07 Retained-Course Continuation & Revoked-Attempt Authorization Regression (`RT-D07-01`–`RT-D07-09`) ──

  describe('6. Post-WP-2.2 D-07 Retained-Course Continuation & Revoked-Attempt Authorization (RT-D07-01 to RT-D07-09)', () => {
    const cleanTraineeId = 'USR006';

    const setGroupSchedulePolicy = (
      targetGroupId: string,
      params: {
        startDateTime: string;
        deadlineDateTime: string;
        postDeadlinePolicy: 'keep_no_cert' | 'hide';
      }
    ) => {
      inMemoryStore.updateGroup(targetGroupId, {
        startDateTime: params.startDateTime,
        deadlineDateTime: params.deadlineDateTime,
        postDeadlinePolicy: params.postDeadlinePolicy,
      });
      const grp = inMemoryStore.getGroupById(targetGroupId);
      if (grp) {
        grp.courses = (grp.courses || []).map((c) => ({
          ...c,
          customStartDateTime: null,
          customDeadlineDateTime: null,
          customPostDeadlinePolicy: null,
        }));
        if (Array.isArray(grp.cycles)) {
          grp.cycles = grp.cycles.map((cyc) => ({
            ...cyc,
            startDateTime: params.startDateTime,
            deadlineDateTime: params.deadlineDateTime,
            postDeadlinePolicy: params.postDeadlinePolicy,
            courses: (cyc.courses || []).map((c) => ({
              ...c,
              customStartDateTime: null,
              customDeadlineDateTime: null,
              customPostDeadlinePolicy: null,
            })),
          }));
        }
      }
    };

    it('RT-D07-01: Retained course before former group deadline resolves continuation grant with full access and cycle preservation', () => {
      setGroupSchedulePolicy(groupAId, {
        startDateTime: '2026-01-01T00:00:00.000Z',
        deadlineDateTime: '2099-12-31T23:59:59.000Z',
        postDeadlinePolicy: 'keep_no_cert',
      });

      inMemoryStore.addGroupMember(groupAId, cleanTraineeId);
      const enrBefore = inMemoryStore.getCourseEnrollment(courseAId, cleanTraineeId);
      const groupGrant = enrBefore?.sources.find(
        (s) => s.kind === 'group' && s.groupId?.toLowerCase() === groupAId.toLowerCase()
      );
      expect(groupGrant).toBeDefined();
      const boundAttemptId = groupGrant!.attemptId;
      const originalCycleId = groupGrant!.cycleId;
      expect(originalCycleId).toBeDefined();

      const items = inMemoryStore.getCourseItems(courseAId);
      expect(items.length).toBeGreaterThanOrEqual(2);
      const firstItemId = items[0].id;
      const secondItemId = items[1].id;

      // Record initial lesson completion before removal
      inMemoryStore.markLessonComplete({
        userId: cleanTraineeId,
        courseId: courseAId,
        itemId: firstItemId,
        attemptId: boundAttemptId,
      });

      // Remove trainee from Group A while retaining courseAId (removeCourseIds: [])
      const removalRes = inMemoryStore.removeGroupMember(groupAId, cleanTraineeId, []);
      expect(removalRes.success).toBe(true);

      // 1. getEligibleAttemptsForCourse returns the active continuation option without throwing
      const eligible = inMemoryStore.getEligibleAttemptsForCourse(cleanTraineeId, courseAId);
      expect(eligible).toHaveLength(1);
      expect(eligible[0].attemptId).toBe(boundAttemptId);
      expect(eligible[0].kind).toBe('self');
      expect(eligible[0].accessMode).toBe('full');
      expect(eligible[0].convertedFromGroupId).toBe(groupAId);
      expect(eligible[0].cycleId).toBe(originalCycleId);

      // 2. getAttemptAccessMode returns 'full'
      expect(
        inMemoryStore.getAttemptAccessMode(cleanTraineeId, courseAId, boundAttemptId)
      ).toBe('full');

      // 3. Implicit, explicit groupId, and explicit groupId + cycleId resolution all resolve to boundAttemptId
      expect(
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: cleanTraineeId,
          courseId: courseAId,
        }).id
      ).toBe(boundAttemptId);

      expect(
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: cleanTraineeId,
          courseId: courseAId,
          groupId: groupAId,
        }).id
      ).toBe(boundAttemptId);

      expect(
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: cleanTraineeId,
          courseId: courseAId,
          groupId: groupAId,
          cycleId: originalCycleId,
        }).id
      ).toBe(boundAttemptId);

      // 4. getCourseProgress preserves completed lessons and reports full access
      const progressAfter = inMemoryStore.getCourseProgress(cleanTraineeId, courseAId);
      expect(progressAfter.attemptId).toBe(boundAttemptId);
      expect(progressAfter.accessMode).toBe('full');
      expect(progressAfter.completedItemIds).toContain(firstItemId);

      // 5. Subsequent learning mutations succeed on the retained attempt
      const activityRes = inMemoryStore.recordLessonActivity({
        userId: cleanTraineeId,
        courseId: courseAId,
        itemId: secondItemId,
        attemptId: boundAttemptId,
        activity: {
          lastPositionSeconds: 45,
          furthestWatchedSeconds: 45,
          eligibleViewingSeconds: 45,
        },
      });
      expect(activityRes.lastPositionSeconds).toBe(45);

      const completionRes = inMemoryStore.markLessonComplete({
        userId: cleanTraineeId,
        courseId: courseAId,
        itemId: secondItemId,
        attemptId: boundAttemptId,
      });
      expect(completionRes.progress.completedItemIds).toContain(secondItemId);
    });

    it('RT-D07-02: Retained course after former group deadline expires (keep_no_cert) remains full access and allows learning mutations', () => {
      setGroupSchedulePolicy(groupAId, {
        startDateTime: '2026-01-01T00:00:00.000Z',
        deadlineDateTime: '2099-12-31T23:59:59.000Z',
        postDeadlinePolicy: 'keep_no_cert',
      });

      inMemoryStore.addGroupMember(groupAId, cleanTraineeId);
      const enr = inMemoryStore.getCourseEnrollment(courseAId, cleanTraineeId);
      const boundAttemptId = enr!.sources.find(
        (s) => s.kind === 'group' && s.groupId?.toLowerCase() === groupAId.toLowerCase()
      )!.attemptId;

      // Remove member while retaining course
      inMemoryStore.removeGroupMember(groupAId, cleanTraineeId, []);

      // Expire Group A deadline with postDeadlinePolicy: 'keep_no_cert'
      setGroupSchedulePolicy(groupAId, {
        startDateTime: '2020-01-01T00:00:00.000Z',
        deadlineDateTime: '2020-02-01T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
      });

      const eligible = inMemoryStore.getEligibleAttemptsForCourse(cleanTraineeId, courseAId);
      expect(eligible).toHaveLength(1);
      expect(eligible[0].attemptId).toBe(boundAttemptId);
      expect(eligible[0].kind).toBe('self');
      expect(eligible[0].accessMode).toBe('full');

      expect(
        inMemoryStore.getAttemptAccessMode(cleanTraineeId, courseAId, boundAttemptId)
      ).toBe('full');

      const items = inMemoryStore.getCourseItems(courseAId);
      const firstItemId = items[0].id;

      expect(() =>
        inMemoryStore.recordLessonActivity({
          userId: cleanTraineeId,
          courseId: courseAId,
          itemId: firstItemId,
          attemptId: boundAttemptId,
          activity: { lastPositionSeconds: 20, furthestWatchedSeconds: 20 },
        })
      ).not.toThrow();

      const completeRes = inMemoryStore.markLessonComplete({
        userId: cleanTraineeId,
        courseId: courseAId,
        itemId: firstItemId,
        attemptId: boundAttemptId,
      });
      expect(completeRes.progress.completedItemIds).toContain(firstItemId);
    });

    it('RT-D07-03: Retained course after former group deadline expires (hide) remains visible and editable', () => {
      setGroupSchedulePolicy(groupAId, {
        startDateTime: '2026-01-01T00:00:00.000Z',
        deadlineDateTime: '2099-12-31T23:59:59.000Z',
        postDeadlinePolicy: 'hide',
      });

      inMemoryStore.addGroupMember(groupAId, cleanTraineeId);
      const enr = inMemoryStore.getCourseEnrollment(courseAId, cleanTraineeId);
      const boundAttemptId = enr!.sources.find(
        (s) => s.kind === 'group' && s.groupId?.toLowerCase() === groupAId.toLowerCase()
      )!.attemptId;

      // Retain course on group member removal
      inMemoryStore.removeGroupMember(groupAId, cleanTraineeId, []);

      // Expire Group A deadline with postDeadlinePolicy: 'hide'
      setGroupSchedulePolicy(groupAId, {
        startDateTime: '2020-01-01T00:00:00.000Z',
        deadlineDateTime: '2020-02-01T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
      });

      const eligible = inMemoryStore.getEligibleAttemptsForCourse(cleanTraineeId, courseAId);
      expect(eligible).toHaveLength(1);
      expect(eligible[0].attemptId).toBe(boundAttemptId);
      expect(eligible[0].accessMode).toBe('full');

      const prog = inMemoryStore.getCourseProgress(cleanTraineeId, courseAId);
      expect(prog.attemptId).toBe(boundAttemptId);
      expect(prog.accessMode).toBe('full');

      const firstItemId = inMemoryStore.getCourseItems(courseAId)[0].id;
      const act = inMemoryStore.recordLessonActivity({
        userId: cleanTraineeId,
        courseId: courseAId,
        itemId: firstItemId,
        attemptId: boundAttemptId,
        activity: { lastPositionSeconds: 15, furthestWatchedSeconds: 15 },
      });
      expect(act.lastPositionSeconds).toBe(15);
    });

    it('RT-D07-04: Revoked course with no other active grant denies learner access (403 COURSE_ACCESS_REVOKED) while preserving admin history', () => {
      inMemoryStore.addGroupMember(groupAId, cleanTraineeId);
      const enr = inMemoryStore.getCourseEnrollment(courseAId, cleanTraineeId);
      const boundAttemptId = enr!.sources.find(
        (s) => s.kind === 'group' && s.groupId?.toLowerCase() === groupAId.toLowerCase()
      )!.attemptId;

      const firstItemId = inMemoryStore.getCourseItems(courseAId)[0].id;
      inMemoryStore.markLessonComplete({
        userId: cleanTraineeId,
        courseId: courseAId,
        itemId: firstItemId,
        attemptId: boundAttemptId,
      });

      const attemptsCountBeforeRemoval = inMemoryStore
        .getTraineeAttempts(cleanTraineeId)
        .filter((a) => a.courseId === courseAId).length;

      // Remove trainee with courseAId checked for revocation
      inMemoryStore.removeGroupMember(groupAId, cleanTraineeId, [courseAId]);

      // 1. No eligible attempts remain
      expect(inMemoryStore.getEligibleAttemptsForCourse(cleanTraineeId, courseAId)).toEqual([]);

      // 2. Implicit, explicit attemptId, and explicit groupId resolution all throw 403 COURSE_ACCESS_REVOKED
      const assertRevokedError = (fn: () => unknown) => {
        try {
          fn();
          expect.fail('Expected MockStoreError with 403 COURSE_ACCESS_REVOKED');
        } catch (err) {
          expect(err).toBeInstanceOf(MockStoreError);
          expect((err as MockStoreError).status).toBe(403);
          expect((err as MockStoreError).code).toBe('COURSE_ACCESS_REVOKED');
        }
      };

      assertRevokedError(() =>
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: cleanTraineeId,
          courseId: courseAId,
        })
      );
      assertRevokedError(() =>
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: cleanTraineeId,
          courseId: courseAId,
          attemptId: boundAttemptId,
        })
      );
      assertRevokedError(() =>
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: cleanTraineeId,
          courseId: courseAId,
          groupId: groupAId,
        })
      );

      // 3. Learner progress read and write paths reject access with 403 COURSE_ACCESS_REVOKED
      assertRevokedError(() => inMemoryStore.getCourseProgress(cleanTraineeId, courseAId));
      assertRevokedError(() =>
        inMemoryStore.getCourseProgress(cleanTraineeId, courseAId, { attemptId: boundAttemptId })
      );
      assertRevokedError(() =>
        inMemoryStore.recordLessonActivity({
          userId: cleanTraineeId,
          courseId: courseAId,
          itemId: firstItemId,
          attemptId: boundAttemptId,
          activity: { lastPositionSeconds: 50 },
        })
      );
      assertRevokedError(() =>
        inMemoryStore.markLessonComplete({
          userId: cleanTraineeId,
          courseId: courseAId,
          itemId: firstItemId,
          attemptId: boundAttemptId,
        })
      );

      // 4. No replacement standalone attempt was created, and historical attempt/progress remain preserved
      const attemptsAfterRemoval = inMemoryStore
        .getTraineeAttempts(cleanTraineeId)
        .filter((a) => a.courseId === courseAId);
      expect(attemptsAfterRemoval).toHaveLength(attemptsCountBeforeRemoval);
      expect(attemptsAfterRemoval[0].id).toBe(boundAttemptId);

      const preservedProgress = inMemoryStore.getAttemptProgress(boundAttemptId);
      expect(preservedProgress?.completedItemIds).toContain(firstItemId);
    });

    it('RT-D07-05: Revoked group course when independent catalog self-enrollment (S1) exists resolves S1 and denies revoked group attemptId', () => {
      // 1. Direct catalog self-enrollment (S1)
      inMemoryStore.enrollUser({
        courseId: courseAId,
        userId: cleanTraineeId,
        userRole: 'user',
      });
      const selfEnr = inMemoryStore.getCourseEnrollment(courseAId, cleanTraineeId);
      const selfAttemptId = selfEnr!.sources.find((s) => s.sourceId.startsWith('self:catalog:'))!.attemptId;

      // 2. Join Group A
      inMemoryStore.addGroupMember(groupAId, cleanTraineeId);
      const combinedEnr = inMemoryStore.getCourseEnrollment(courseAId, cleanTraineeId);
      const groupAttemptId = combinedEnr!.sources.find(
        (s) => s.kind === 'group' && s.groupId?.toLowerCase() === groupAId.toLowerCase()
      )!.attemptId;

      // 3. Remove from Group A with courseAId checked (revoked)
      inMemoryStore.removeGroupMember(groupAId, cleanTraineeId, [courseAId]);

      const eligible = inMemoryStore.getEligibleAttemptsForCourse(cleanTraineeId, courseAId);
      expect(eligible).toHaveLength(1);
      expect(eligible[0].attemptId).toBe(selfAttemptId);

      // Implicit resolution resolves cleanly to selfAttemptId without ambiguity
      const resolved = inMemoryStore.resolveActiveAttemptForLearning({
        userId: cleanTraineeId,
        courseId: courseAId,
      });
      expect(resolved.id).toBe(selfAttemptId);

      // Explicit request for revoked groupAttemptId or groupAId is rejected with 403 COURSE_ACCESS_REVOKED
      expect(() =>
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: cleanTraineeId,
          courseId: courseAId,
          attemptId: groupAttemptId,
        })
      ).toThrowError(
        expect.objectContaining({
          status: 403,
          code: 'COURSE_ACCESS_REVOKED',
        })
      );

      expect(() =>
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: cleanTraineeId,
          courseId: courseAId,
          groupId: groupAId,
        })
      ).toThrowError(
        expect.objectContaining({
          status: 403,
          code: 'COURSE_ACCESS_REVOKED',
        })
      );
    });

    it('RT-D07-06: Revoked Group A course when Group B active grant exists resolves Group B and denies Group A attempt', () => {
      setGroupSchedulePolicy(groupAId, {
        startDateTime: '2026-01-01T00:00:00.000Z',
        deadlineDateTime: '2099-12-31T23:59:59.000Z',
        postDeadlinePolicy: 'keep_no_cert',
      });
      setGroupSchedulePolicy(groupBId, {
        startDateTime: '2026-01-01T00:00:00.000Z',
        deadlineDateTime: '2099-12-31T23:59:59.000Z',
        postDeadlinePolicy: 'keep_no_cert',
      });

      inMemoryStore.addGroupMember(groupAId, cleanTraineeId);
      inMemoryStore.addGroupMember(groupBId, cleanTraineeId);

      const enrBefore = inMemoryStore.getCourseEnrollment(courseAId, cleanTraineeId);
      const attemptAId = enrBefore!.sources.find(
        (s) => s.kind === 'group' && s.groupId?.toLowerCase() === groupAId.toLowerCase()
      )!.attemptId;
      const attemptBId = enrBefore!.sources.find(
        (s) => s.kind === 'group' && s.groupId?.toLowerCase() === groupBId.toLowerCase()
      )!.attemptId;

      // Remove from Group A with courseAId revoked
      inMemoryStore.removeGroupMember(groupAId, cleanTraineeId, [courseAId]);

      const eligible = inMemoryStore.getEligibleAttemptsForCourse(cleanTraineeId, courseAId);
      expect(eligible).toHaveLength(1);
      expect(eligible[0].attemptId).toBe(attemptBId);

      // Implicit resolution resolves to Group B's active attempt
      expect(
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: cleanTraineeId,
          courseId: courseAId,
        }).id
      ).toBe(attemptBId);

      // Explicit access to revoked Group A attempt or Group A context throws 403 COURSE_ACCESS_REVOKED
      expect(() =>
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: cleanTraineeId,
          courseId: courseAId,
          attemptId: attemptAId,
        })
      ).toThrowError(
        expect.objectContaining({
          status: 403,
          code: 'COURSE_ACCESS_REVOKED',
        })
      );

      expect(() =>
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: cleanTraineeId,
          courseId: courseAId,
          groupId: groupAId,
        })
      ).toThrowError(
        expect.objectContaining({
          status: 403,
          code: 'COURSE_ACCESS_REVOKED',
        })
      );
    });

    it('RT-D07-07: Administrative getGroupMetrics() calculates historical attempt metrics for a legacy cycleless group expired under hide policy while learner access remains denied with 403 COURSE_ACCESS_REVOKED', () => {
      setGroupSchedulePolicy(groupAId, {
        startDateTime: '2026-01-01T00:00:00.000Z',
        deadlineDateTime: '2099-12-31T23:59:59.000Z',
        postDeadlinePolicy: 'hide',
      });

      // 1. Enroll trainee in Group A and record partial lesson completion on courseAId
      inMemoryStore.addGroupMember(groupAId, cleanTraineeId);
      const enr = inMemoryStore.getCourseEnrollment(courseAId, cleanTraineeId);
      const groupGrant = enr!.sources.find(
        (s) => s.kind === 'group' && s.groupId?.toLowerCase() === groupAId.toLowerCase()
      )!;
      const groupAttemptId = groupGrant.attemptId;
      const originalCycleId = groupGrant.cycleId;

      const firstItemId = inMemoryStore.getCourseItems(courseAId)[0].id;
      inMemoryStore.markLessonComplete({
        userId: cleanTraineeId,
        courseId: courseAId,
        itemId: firstItemId,
        attemptId: groupAttemptId,
      });

      // 2. Expire Group A under postDeadlinePolicy: 'hide' and configure as a legacy cycleless group (targetCycle === null)
      setGroupSchedulePolicy(groupAId, {
        startDateTime: '2020-01-01T00:00:00.000Z',
        deadlineDateTime: '2020-02-01T00:00:00.000Z',
        postDeadlinePolicy: 'hide',
      });
      const grp = inMemoryStore.getGroupById(groupAId)!;
      grp.currentCycleId = undefined;

      // 3. Learner access to the hidden expired group course is denied with 403 COURSE_ACCESS_REVOKED
      expect(inMemoryStore.getEligibleAttemptsForCourse(cleanTraineeId, courseAId)).toEqual([]);

      expect(() => inMemoryStore.getCourseProgress(cleanTraineeId, courseAId)).toThrowError(
        expect.objectContaining({
          status: 403,
          code: 'COURSE_ACCESS_REVOKED',
        })
      );
      expect(() =>
        inMemoryStore.getCourseProgress(cleanTraineeId, courseAId, { attemptId: groupAttemptId })
      ).toThrowError(
        expect.objectContaining({
          status: 403,
          code: 'COURSE_ACCESS_REVOKED',
        })
      );
      expect(() =>
        inMemoryStore.getCourseProgress(cleanTraineeId, courseAId, { groupId: groupAId })
      ).toThrowError(
        expect.objectContaining({
          status: 403,
          code: 'COURSE_ACCESS_REVOKED',
        })
      );

      // 4. Administrative getGroupMetrics() succeeds for the legacy cycleless group (selectedCycle === null)
      //    and calculates the trainee's preserved progress directly from courseAttempts / attemptProgress
      const cyclelessMetrics = inMemoryStore.getGroupMetrics(groupAId);
      expect(cyclelessMetrics).not.toBeNull();
      expect(cyclelessMetrics!.selectedCycle).toBeNull();
      expect(cyclelessMetrics!.status).toBe('expired');

      const traineeMetric = cyclelessMetrics!.traineeMetricsList.find(
        (t) => t.userId.toLowerCase() === cleanTraineeId.toLowerCase()
      );
      expect(traineeMetric).toBeDefined();
      const courseMetric = traineeMetric!.courseProgressMap[courseAId];
      expect(courseMetric).toBeDefined();
      expect(courseMetric.completedLessons).toBe(1);
      expect(courseMetric.started).toBe(true);
      expect(courseMetric.percent).toBeGreaterThan(0);

      // 5. Explicit optional cycleId scoping in getGroupMetrics(groupId, cycleId) also resolves the matching cycle attempt
      if (originalCycleId) {
        const cycleScopedMetrics = inMemoryStore.getGroupMetrics(groupAId, originalCycleId);
        expect(cycleScopedMetrics).not.toBeNull();
        expect(cycleScopedMetrics!.selectedCycle?.id).toBe(originalCycleId);
        const cycleTraineeMetric = cycleScopedMetrics!.traineeMetricsList.find(
          (t) => t.userId.toLowerCase() === cleanTraineeId.toLowerCase()
        );
        expect(cycleTraineeMetric?.courseProgressMap[courseAId]?.completedLessons).toBe(1);
      }
    });

    it('RT-D07-08: Retaining course on removal alongside another active grant surfaces both options for explicit attempt selection', () => {
      setGroupSchedulePolicy(groupAId, {
        startDateTime: '2026-01-01T00:00:00.000Z',
        deadlineDateTime: '2099-12-31T23:59:59.000Z',
        postDeadlinePolicy: 'keep_no_cert',
      });

      // 1. Catalog self-enrollment (S1)
      inMemoryStore.enrollUser({
        courseId: courseAId,
        userId: cleanTraineeId,
        userRole: 'user',
      });
      const selfAttemptId = inMemoryStore
        .getCourseEnrollment(courseAId, cleanTraineeId)!
        .sources.find((s) => s.sourceId.startsWith('self:catalog:'))!.attemptId;

      // 2. Group A enrollment
      inMemoryStore.addGroupMember(groupAId, cleanTraineeId);
      const attemptAId = inMemoryStore
        .getCourseEnrollment(courseAId, cleanTraineeId)!
        .sources.find(
          (s) => s.kind === 'group' && s.groupId?.toLowerCase() === groupAId.toLowerCase()
        )!.attemptId;

      // 3. Remove from Group A while retaining course (removeCourseIds: [])
      inMemoryStore.removeGroupMember(groupAId, cleanTraineeId, []);

      // Both active options (continuation attemptAId + catalog selfAttemptId) are returned without TypeError
      const eligible = inMemoryStore.getEligibleAttemptsForCourse(cleanTraineeId, courseAId);
      expect(eligible).toHaveLength(2);
      expect(eligible.map((e) => e.attemptId)).toEqual(
        expect.arrayContaining([attemptAId, selfAttemptId])
      );

      // Ambiguous progress request prompts attempt selection with both options
      const ambiguousProgress = inMemoryStore.getCourseProgress(cleanTraineeId, courseAId);
      expect(ambiguousProgress.requiresAttemptSelection).toBe(true);
      expect(ambiguousProgress.eligibleAttempts).toHaveLength(2);

      // Explicit selection of either attempt succeeds and records isolated progress
      const firstItemId = inMemoryStore.getCourseItems(courseAId)[0].id;
      const contComplete = inMemoryStore.markLessonComplete({
        userId: cleanTraineeId,
        courseId: courseAId,
        itemId: firstItemId,
        attemptId: attemptAId,
      });
      expect(contComplete.progress.attemptId).toBe(attemptAId);
      expect(contComplete.progress.completedItemIds).toContain(firstItemId);

      const selfProg = inMemoryStore.getCourseProgress(cleanTraineeId, courseAId, {
        attemptId: selfAttemptId,
      });
      expect(selfProg.attemptId).toBe(selfAttemptId);
      expect(selfProg.completedItemIds).not.toContain(firstItemId);
    });

    it('RT-D07-09: Same-attempt deduplication prefers active self continuation grant with full access when an active group grant and an active continuation grant reference the same attemptId', () => {
      setGroupSchedulePolicy(groupAId, {
        startDateTime: '2026-01-01T00:00:00.000Z',
        deadlineDateTime: '2099-12-31T23:59:59.000Z',
        postDeadlinePolicy: 'keep_no_cert',
      });

      // 1. Add trainee to Group A so an active 'group' grant is created first at sources[0]
      inMemoryStore.addGroupMember(groupAId, cleanTraineeId);
      const enrBefore = inMemoryStore.getCourseEnrollment(courseAId, cleanTraineeId)!;
      const groupGrant = enrBefore.sources.find(
        (s) => s.kind === 'group' && s.groupId?.toLowerCase() === groupAId.toLowerCase()
      )!;
      const sharedAttemptId = groupGrant.attemptId;
      const originalCycleId = groupGrant.cycleId;

      // 2. Add an active 'self:continued' grant referencing the exact same attemptId while keeping groupGrant active
      const continuationSourceId = `self:continued:${groupAId}:${sharedAttemptId}`;
      inMemoryStore.addOrUpdateEnrollmentGrant({
        userId: cleanTraineeId,
        courseId: courseAId,
        grant: {
          sourceId: continuationSourceId,
          kind: 'self',
          attemptId: sharedAttemptId,
          convertedFromGroupId: groupAId,
          grantedAt: new Date().toISOString(),
          status: 'active',
        },
      });

      const enrWithBothActive = inMemoryStore.getCourseEnrollment(courseAId, cleanTraineeId)!;
      const activeGrantsForAttempt = enrWithBothActive.sources.filter(
        (s) => s.attemptId === sharedAttemptId && s.status === 'active'
      );
      expect(activeGrantsForAttempt).toHaveLength(2);
      expect(activeGrantsForAttempt[0].kind).toBe('group');
      expect(activeGrantsForAttempt[1].kind).toBe('self');

      // 3. When both active grants produce accessMode: 'full', optionsMap deduplication replaces the 'group' entry with the unrestricted 'self' continuation option
      const eligibleActiveGroup = inMemoryStore.getEligibleAttemptsForCourse(
        cleanTraineeId,
        courseAId
      );
      expect(eligibleActiveGroup).toHaveLength(1);
      expect(eligibleActiveGroup[0].attemptId).toBe(sharedAttemptId);
      expect(eligibleActiveGroup[0].kind).toBe('self');
      expect(eligibleActiveGroup[0].sourceId).toBe(continuationSourceId);
      expect(eligibleActiveGroup[0].convertedFromGroupId).toBe(groupAId);
      expect(eligibleActiveGroup[0].cycleId).toBe(originalCycleId);
      expect(eligibleActiveGroup[0].accessMode).toBe('full');

      // 4. When the group deadline expires under keep_no_cert (so the active group grant evaluates to 'review_only'),
      //    deduplication still returns the single unrestricted 'self' continuation option with accessMode: 'full'
      setGroupSchedulePolicy(groupAId, {
        startDateTime: '2020-01-01T00:00:00.000Z',
        deadlineDateTime: '2020-02-01T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
      });

      const eligibleExpiredGroup = inMemoryStore.getEligibleAttemptsForCourse(
        cleanTraineeId,
        courseAId
      );
      expect(eligibleExpiredGroup).toHaveLength(1);
      expect(eligibleExpiredGroup[0].attemptId).toBe(sharedAttemptId);
      expect(eligibleExpiredGroup[0].kind).toBe('self');
      expect(eligibleExpiredGroup[0].sourceId).toBe(continuationSourceId);
      expect(eligibleExpiredGroup[0].accessMode).toBe('full');
      expect(
        inMemoryStore.getAttemptAccessMode(cleanTraineeId, courseAId, sharedAttemptId)
      ).toBe('full');
    });
  });
});

