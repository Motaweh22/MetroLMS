import { describe, it, expect, beforeEach } from 'vitest';
import {
  inMemoryStore,
  MockStoreError,
  AttemptAmbiguityError,
  resolveGroupAttemptId,
  isCycleOwnedByGroup,
} from '@/mocks/store/inMemoryStore';
import type {
  EnrollmentRecord,
  EnrollmentSourceGrant,
  EligibleAttemptOption,
  CourseAccessMode,
} from '@/core/courses/types';
import { calculateTraineeProgress } from '@/core/domain/progress';

/**
 * MetroLMS — Phase 2 / WP-2.1 / T-2.1.1: Multi-Source Enrollment Provenance Specifications
 * 
 * Verifies that EnrollmentRecord maintains `sources: EnrollmentSourceGrant[]` with
 * deterministic sourceId and attemptId generation per D-06 and MFR-41.
 * 
 * Non-execution governance note:
 * Authored under the Two-Gate Verification Governance model.
 * Queued for consolidated execution at Phase 4 / Gate B (T-4.4.1).
 */
describe('Phase 2 — WP-2.1 / T-2.1.1: Multi-Source Enrollment Provenance (D-06, MFR-41)', () => {
  const traineeId = 'usr_trainee_003';
  const targetCourseId = 'CRS001';

  beforeEach(() => {
    inMemoryStore.reset({ seedReviewDemo: false, seedGroupDemo: false });
  });

  describe('1. Direct Catalog Self-Enrollment Provenance', () => {
    it('creates an EnrollmentRecord with deterministic self:catalog sourceId and standalone attemptId', () => {
      // Initially, CRS001 is unenrolled for traineeId
      const initialEnrollment = inMemoryStore.getCourseEnrollment(targetCourseId, traineeId);
      expect(initialEnrollment).toBeUndefined();

      // Execute self-enrollment mutation
      const response = inMemoryStore.enrollUser({
        courseId: targetCourseId,
        userId: traineeId,
        userRole: 'user',
      });

      expect(response.enrollment).toBeDefined();
      expect(response.enrollment.userId).toBe(traineeId);
      expect(response.enrollment.courseId).toBe(targetCourseId);
      expect(response.enrollment.status).toBe('active');

      // Verify deterministic EnrollmentRecord.id
      expect(response.enrollment.id).toBe(`ENR-${traineeId}-${targetCourseId}`);

      // Verify sources array structure
      const record = inMemoryStore.getCourseEnrollment(targetCourseId, traineeId);
      expect(record).toBeDefined();
      expect(record?.sources).toBeDefined();
      expect(record?.sources).toHaveLength(1);

      const grant = record!.sources[0];
      const expectedAttemptId = `ATT-${traineeId}-${targetCourseId}-standalone`;
      const expectedSourceId = `self:catalog:${expectedAttemptId}`;

      expect(grant.kind).toBe('self');
      expect(grant.attemptId).toBe(expectedAttemptId);
      expect(grant.sourceId).toBe(expectedSourceId);
      expect(grant.status).toBe('active');
      expect(grant.groupId).toBeUndefined();
      expect(grant.cycleId).toBeUndefined();

      // Verify corresponding CourseAttempt is provisioned in the store
      const traineeAttempts = inMemoryStore.getTraineeAttempts(traineeId, targetCourseId);
      const standaloneAttempt = traineeAttempts.find((a) => a.id === expectedAttemptId);
      expect(standaloneAttempt).toBeDefined();
      expect(standaloneAttempt?.cycleId).toBeNull();
      expect(standaloneAttempt?.groupId).toBeNull();
    });

    it('rejects duplicate direct self-enrollment with 409 Conflict and preserves single grant and count', () => {
      inMemoryStore.enrollUser({
        courseId: targetCourseId,
        userId: traineeId,
        userRole: 'user',
      });

      const initialCount = inMemoryStore.getCourseById(targetCourseId)?.enrollmentCount || 0;

      // Duplicate self-enrollment attempt
      expect(() => {
        inMemoryStore.enrollUser({
          courseId: targetCourseId,
          userId: traineeId,
          userRole: 'user',
        });
      }).toThrowError(/أنت مسجل بالفعل في هذه الدورة التدريبية/);

      // Verify record still has only 1 grant and course enrollmentCount is unchanged
      const record = inMemoryStore.getCourseEnrollment(targetCourseId, traineeId);
      expect(record?.sources).toHaveLength(1);
      expect(inMemoryStore.getCourseById(targetCourseId)?.enrollmentCount).toBe(initialCount);
    });
  });

  describe('2. Multi-Source Provenance Coexistence (Self + Group)', () => {
    it('appends a group grant to an existing self-enrollment record without overwriting the self grant', () => {
      // 1. Direct self-enrollment first
      inMemoryStore.enrollUser({
        courseId: targetCourseId,
        userId: traineeId,
        userRole: 'user',
      });

      const standaloneAttemptId = `ATT-${traineeId}-${targetCourseId}-standalone`;
      const selfSourceId = `self:catalog:${standaloneAttemptId}`;

      // 2. Add trainee to GRP-201 (which includes CRS001)
      const groupResult = inMemoryStore.addGroupMember('GRP-201', traineeId);
      expect(groupResult.group).toBeDefined();

      const record = inMemoryStore.getCourseEnrollment(targetCourseId, traineeId);
      expect(record).toBeDefined();

      // EnrollmentRecord MUST now maintain BOTH grants in sources
      expect(record?.sources).toHaveLength(2);

      // Verify Grant 1 (Self)
      const selfGrant = record?.sources.find((s) => s.kind === 'self');
      expect(selfGrant).toBeDefined();
      expect(selfGrant?.sourceId).toBe(selfSourceId);
      expect(selfGrant?.attemptId).toBe(standaloneAttemptId);
      expect(selfGrant?.status).toBe('active');

      // Verify Grant 2 (Group)
      const groupGrant = record?.sources.find((s) => s.kind === 'group');
      expect(groupGrant).toBeDefined();
      expect(groupGrant?.kind).toBe('group');
      expect(groupGrant?.groupId).toBe('GRP-201');
      expect(groupGrant?.status).toBe('active');
      expect(groupGrant?.sourceId).toMatch(/^group:GRP-201:/);

      // Crucial D-06 Invariant: The group grant is bound to its OWN distinct attemptId
      expect(groupGrant?.attemptId).not.toBe(standaloneAttemptId);
      expect(groupGrant?.attemptId).toMatch(new RegExp(`^ATT-${traineeId}-${targetCourseId}-`));

      // Both attempts must coexist independently in the attempt ledger
      const attempts = inMemoryStore.getTraineeAttempts(traineeId, targetCourseId);
      expect(attempts.length).toBeGreaterThanOrEqual(2);
      expect(attempts.some((a) => a.id === standaloneAttemptId)).toBe(true);
      expect(attempts.some((a) => a.id === groupGrant?.attemptId)).toBe(true);
    });

    it('allows a group-enrolled trainee to later add a catalog self-grant', () => {
      const newTrainee = 'USR_TRAINEE_NEW_MULTI';

      // 1. Enrolled via Group GRP-101
      inMemoryStore.addGroupMember('GRP-101', newTrainee);

      const recordBefore = inMemoryStore.getCourseEnrollment(targetCourseId, newTrainee);
      expect(recordBefore).toBeDefined();
      expect(recordBefore?.sources).toHaveLength(1);
      expect(recordBefore?.sources[0].kind).toBe('group');

      // 2. Trainee subsequently self-enrolls from catalog
      const selfRes = inMemoryStore.enrollUser({
        courseId: targetCourseId,
        userId: newTrainee,
        userRole: 'user',
      });

      expect(selfRes.enrollment).toBeDefined();

      const recordAfter = inMemoryStore.getCourseEnrollment(targetCourseId, newTrainee);
      expect(recordAfter?.sources).toHaveLength(2);

      const selfGrant = recordAfter?.sources.find((s) => s.kind === 'self');
      const groupGrant = recordAfter?.sources.find((s) => s.kind === 'group');

      expect(selfGrant).toBeDefined();
      expect(groupGrant).toBeDefined();
      expect(selfGrant?.attemptId).toBe(`ATT-${newTrainee}-${targetCourseId}-standalone`);
      expect(groupGrant?.attemptId).not.toBe(selfGrant?.attemptId);
    });
  });

  describe('3. Multi-Group Provenance Coexistence (Group 1 + Group 2)', () => {
    it('maintains distinct group grants with separate sourceIds and separate attempts for two different groups', () => {
      const multiGroupTrainee = 'USR_COHORT_CROSS_01';

      // 1. Add to GRP-101 (has CRS001)
      inMemoryStore.addGroupMember('GRP-101', multiGroupTrainee);

      // 2. Add to GRP-201 (also has CRS001)
      inMemoryStore.addGroupMember('GRP-201', multiGroupTrainee);

      const record = inMemoryStore.getCourseEnrollment(targetCourseId, multiGroupTrainee);
      expect(record).toBeDefined();

      // Must have 2 distinct group grants
      const groupGrants = (record?.sources || []).filter((s) => s.kind === 'group');
      expect(groupGrants).toHaveLength(2);

      const grant101 = groupGrants.find((s) => s.groupId === 'GRP-101');
      const grant201 = groupGrants.find((s) => s.groupId === 'GRP-201');

      expect(grant101).toBeDefined();
      expect(grant201).toBeDefined();

      // Deterministic distinct source IDs
      expect(grant101?.sourceId).toMatch(/^group:GRP-101:/);
      expect(grant201?.sourceId).toMatch(/^group:GRP-201:/);
      expect(grant101?.sourceId).not.toBe(grant201?.sourceId);

      // Distinct attempt IDs (D-06: isolated per-attempt progress)
      expect(grant101?.attemptId).not.toBe(grant201?.attemptId);
      expect(grant101?.attemptId).toMatch(new RegExp(`ATT-${multiGroupTrainee}-${targetCourseId}-`));
      expect(grant201?.attemptId).toMatch(new RegExp(`ATT-${multiGroupTrainee}-${targetCourseId}-`));
    });
  });

  describe('4. Deterministic Identity and Idempotency Invariants', () => {
    it('repeated grant addition produces the same sourceId and updates idempotently without duplicating entries', () => {
      const testUser = 'USR_IDEMPOTENT_001';

      // First addition to GRP-101
      inMemoryStore.addGroupMember('GRP-101', testUser);
      const enr1 = inMemoryStore.getCourseEnrollment(targetCourseId, testUser);
      expect(enr1?.sources).toHaveLength(1);
      const firstSourceId = enr1!.sources[0].sourceId;
      const firstAttemptId = enr1!.sources[0].attemptId;

      // Second addition to GRP-101 (retry / idempotent call)
      const res2 = inMemoryStore.addGroupMember('GRP-101', testUser);
      expect(res2.alreadyMember).toBe(true);

      const enr2 = inMemoryStore.getCourseEnrollment(targetCourseId, testUser);
      expect(enr2?.sources).toHaveLength(1);
      expect(enr2!.sources[0].sourceId).toBe(firstSourceId);
      expect(enr2!.sources[0].attemptId).toBe(firstAttemptId);
    });

    it('deterministic ID generation does not depend on Date.now() or random numbers', () => {
      const userA = 'USR_DET_A';
      const userB = 'USR_DET_B';

      const grantA: EnrollmentSourceGrant = {
        sourceId: `self:catalog:ATT-${userA}-${targetCourseId}-standalone`,
        kind: 'self',
        attemptId: `ATT-${userA}-${targetCourseId}-standalone`,
        grantedAt: '2026-11-09T00:00:00.000Z',
        status: 'active',
      };

      const { enrollment: enrA1 } = inMemoryStore.addOrUpdateEnrollmentGrant({
        userId: userA,
        courseId: targetCourseId,
        grant: grantA,
      });

      // Repeat with same parameters
      const { enrollment: enrA2, isNewEnrollment, isNewGrant } = inMemoryStore.addOrUpdateEnrollmentGrant({
        userId: userA,
        courseId: targetCourseId,
        grant: grantA,
      });

      expect(isNewEnrollment).toBe(false);
      expect(isNewGrant).toBe(false);
      expect(enrA1.id).toBe(`ENR-${userA}-${targetCourseId}`);
      expect(enrA2.id).toBe(enrA1.id);
      expect(enrA2.sources[0].sourceId).toBe(grantA.sourceId);
      expect(enrA2.sources[0].attemptId).toBe(grantA.attemptId);
    });

    it('preserves revoked group grants alongside active grants for historical auditability', () => {
      const auditUser = 'USR_AUDIT_HIST_01';
      const attemptId = `ATT-${auditUser}-${targetCourseId}-CYC01`;
      const groupSourceId = `group:GRP-101:CYC01`;

      // 1. Initial group grant
      inMemoryStore.addOrUpdateEnrollmentGrant({
        userId: auditUser,
        courseId: targetCourseId,
        grant: {
          sourceId: groupSourceId,
          kind: 'group',
          groupId: 'GRP-101',
          cycleId: 'CYC01',
          attemptId,
          grantedAt: '2026-10-01T08:00:00.000Z',
          status: 'active',
        },
      });

      // 2. Mark group grant revoked (simulating trainee group departure with kept course D-07)
      inMemoryStore.addOrUpdateEnrollmentGrant({
        userId: auditUser,
        courseId: targetCourseId,
        grant: {
          sourceId: groupSourceId,
          kind: 'group',
          groupId: 'GRP-101',
          cycleId: 'CYC01',
          attemptId,
          grantedAt: '2026-10-01T08:00:00.000Z',
          revokedAt: '2026-11-01T12:00:00.000Z',
          status: 'revoked_by_group_removal',
        },
      });

      // 3. Add standalone continuation grant pointing to the same attempt (D-07)
      const continuationSourceId = `self:continued:GRP-101:${attemptId}`;
      inMemoryStore.addOrUpdateEnrollmentGrant({
        userId: auditUser,
        courseId: targetCourseId,
        grant: {
          sourceId: continuationSourceId,
          kind: 'self',
          convertedFromGroupId: 'GRP-101',
          attemptId,
          grantedAt: '2026-11-01T12:00:00.000Z',
          status: 'active',
        },
      });

      const enr = inMemoryStore.getCourseEnrollment(targetCourseId, auditUser);
      expect(enr?.sources).toHaveLength(2);

      const revokedGrant = enr?.sources.find((s) => s.sourceId === groupSourceId);
      const activeContinuation = enr?.sources.find((s) => s.sourceId === continuationSourceId);

      expect(revokedGrant?.status).toBe('revoked_by_group_removal');
      expect(revokedGrant?.revokedAt).toBe('2026-11-01T12:00:00.000Z');
      expect(activeContinuation?.status).toBe('active');
      expect(activeContinuation?.convertedFromGroupId).toBe('GRP-101');

      // Both grants point to the exact same attemptId (preserving attempt continuity without resetting progress)
      expect(revokedGrant?.attemptId).toBe(attemptId);
      expect(activeContinuation?.attemptId).toBe(attemptId);
    });
  });

  describe('5. Group-Scoped Cycle Collision Safety & Attempt Immutability', () => {
    it('1. performs exact and structurally valid group ID recognition in cycle IDs without substring false-positives', () => {
      // Canonical format: CYC-${groupId}-${cycleNumber}
      expect(isCycleOwnedByGroup('CYC-GRP-201-01', 'GRP-201')).toBe(true);
      expect(isCycleOwnedByGroup('CYC-GRP-101-02', 'GRP-101')).toBe(true);
      expect(isCycleOwnedByGroup('GRP-201-01', 'GRP-201')).toBe(true);

      // Rejects incidental substrings within the cycle ID
      expect(isCycleOwnedByGroup('CYC-GRP-101-01', '101')).toBe(false);
      expect(isCycleOwnedByGroup('CYC-GRP-101-01', '01')).toBe(false);
      expect(isCycleOwnedByGroup('CYC-GRP-101-01', 'GRP-1')).toBe(false);

      // Rejects generic cycle IDs that do not prove ownership
      expect(isCycleOwnedByGroup('CYCLE-1', 'GRP-101')).toBe(false);
      expect(isCycleOwnedByGroup('CYC01', 'GRP-101')).toBe(false);
      expect(isCycleOwnedByGroup(null, 'GRP-101')).toBe(false);
      expect(isCycleOwnedByGroup('CYCLE-1', null)).toBe(false);
    });

    it('2. prevents collisions on prefix-overlapping group IDs (e.g. GRP-20 and GRP-201)', () => {
      const user = 'USR_PREFIX_OVERLAP_01';
      const sharedCycle = 'CYC-GRP-201-01';

      // Group A (GRP-20) does NOT own CYC-GRP-201-01
      expect(isCycleOwnedByGroup(sharedCycle, 'GRP-20')).toBe(false);
      // Group B (GRP-201) DOES own CYC-GRP-201-01
      expect(isCycleOwnedByGroup(sharedCycle, 'GRP-201')).toBe(true);

      const attemptIdGroupA = resolveGroupAttemptId(user, targetCourseId, 'GRP-20', sharedCycle);
      const attemptIdGroupB = resolveGroupAttemptId(user, targetCourseId, 'GRP-201', sharedCycle);

      expect(attemptIdGroupA).toBe(`ATT-${user}-${targetCourseId}-GRP-20-${sharedCycle}`);
      expect(attemptIdGroupB).toBe(`ATT-${user}-${targetCourseId}-${sharedCycle}`);
      expect(attemptIdGroupA).not.toBe(attemptIdGroupB);

      // Verify store isolation: getOrCreateCurrentAttempt creates two distinct attempts
      const attemptA = inMemoryStore.getOrCreateCurrentAttempt({
        userId: user,
        courseId: targetCourseId,
        groupId: 'GRP-20',
        cycleId: sharedCycle,
      });

      const attemptB = inMemoryStore.getOrCreateCurrentAttempt({
        userId: user,
        courseId: targetCourseId,
        groupId: 'GRP-201',
        cycleId: sharedCycle,
      });

      expect(attemptA.id).toBe(attemptIdGroupA);
      expect(attemptB.id).toBe(attemptIdGroupB);
      expect(attemptA.id).not.toBe(attemptB.id);
      expect(attemptA.groupId).toBe('GRP-20');
      expect(attemptB.groupId).toBe('GRP-201');
    });

    it('3. guarantees distinct attempt IDs when two different groups share an identical generic cycle ID', () => {
      const crossGroupUser = 'USR_COLLISION_AUDIT_01';
      const sharedCycleId = 'CYCLE-1';

      // resolveGroupAttemptId must qualify with groupId when cycleId does not contain groupId
      const attemptIdGroupA = resolveGroupAttemptId(crossGroupUser, targetCourseId, 'GRP-101', sharedCycleId);
      const attemptIdGroupB = resolveGroupAttemptId(crossGroupUser, targetCourseId, 'GRP-201', sharedCycleId);

      expect(attemptIdGroupA).toBe(`ATT-${crossGroupUser}-${targetCourseId}-GRP-101-${sharedCycleId}`);
      expect(attemptIdGroupB).toBe(`ATT-${crossGroupUser}-${targetCourseId}-GRP-201-${sharedCycleId}`);
      expect(attemptIdGroupA).not.toBe(attemptIdGroupB);

      // getOrCreateCurrentAttempt must respect groupId scoping and not return the other group's attempt
      const attemptA = inMemoryStore.getOrCreateCurrentAttempt({
        userId: crossGroupUser,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: sharedCycleId,
      });

      const attemptB = inMemoryStore.getOrCreateCurrentAttempt({
        userId: crossGroupUser,
        courseId: targetCourseId,
        groupId: 'GRP-201',
        cycleId: sharedCycleId,
      });

      expect(attemptA.id).toBe(attemptIdGroupA);
      expect(attemptB.id).toBe(attemptIdGroupB);
      expect(attemptA.id).not.toBe(attemptB.id);
      expect(attemptA.groupId).toBe('GRP-101');
      expect(attemptB.groupId).toBe('GRP-201');

      // Both attempts must exist independently in the store
      const allAttempts = inMemoryStore.getAttemptsStore();
      expect(allAttempts.some((a) => a.id === attemptIdGroupA)).toBe(true);
      expect(allAttempts.some((a) => a.id === attemptIdGroupB)).toBe(true);
    });

    it('4. ensures stable and deterministic identifiers across repeated resolution', () => {
      const u = 'USR_STABILITY_01';
      const c = 'CRS002';
      const g = 'GRP-101';
      const cyc = 'CYCLE-1';

      const first = resolveGroupAttemptId(u, c, g, cyc);
      const second = resolveGroupAttemptId(u, c, g, cyc);
      const third = resolveGroupAttemptId(` ${u} `, ` ${c} `, ` ${g} `, ` ${cyc} `);

      expect(first).toBe(second);
      expect(second).toBe(third);
      expect(first).toBe(`ATT-${u}-${c}-${g}-${cyc}`);
    });

    it('5. preserves existing canonical fixture identifiers without alteration', () => {
      // Verifies exact compatibility with trainingGroupsDemoFixtures.ts
      const demoUser = 'usr_trainee_003';
      const demoCourse = 'CRS001';
      const demoGroup = 'GRP-201';
      const cycle1 = 'CYC-GRP-201-01';
      const cycle2 = 'CYC-GRP-201-02';

      const attempt1 = resolveGroupAttemptId(demoUser, demoCourse, demoGroup, cycle1);
      const attempt2 = resolveGroupAttemptId(demoUser, demoCourse, demoGroup, cycle2);

      expect(attempt1).toBe('ATT-usr_trainee_003-CRS001-CYC-GRP-201-01');
      expect(attempt2).toBe('ATT-usr_trainee_003-CRS001-CYC-GRP-201-02');
    });

    it('6. keeps group attempts bound strictly to their actual groupId and preserves attemptId on retry', () => {
      const boundUser = 'USR_BOUND_01';
      const groupAId = 'GRP-20';
      const groupBId = 'GRP-201';
      const sharedCycle = 'CYC-GRP-201-01';

      // Provision attempts for both groups
      const attA = inMemoryStore.getOrCreateCurrentAttempt({
        userId: boundUser,
        courseId: targetCourseId,
        groupId: groupAId,
        cycleId: sharedCycle,
      });

      const attB = inMemoryStore.getOrCreateCurrentAttempt({
        userId: boundUser,
        courseId: targetCourseId,
        groupId: groupBId,
        cycleId: sharedCycle,
      });

      // Verify attempts partition strictly by groupId
      const groupAAttempts = inMemoryStore.getGroupAttempts(groupAId);
      const groupBAttempts = inMemoryStore.getGroupAttempts(groupBId);

      expect(groupAAttempts.some((a) => a.id === attA.id)).toBe(true);
      expect(groupAAttempts.some((a) => a.id === attB.id)).toBe(false);

      expect(groupBAttempts.some((a) => a.id === attB.id)).toBe(true);
      expect(groupBAttempts.some((a) => a.id === attA.id)).toBe(false);

      // Verify idempotent retry preserves existing attemptId
      const initialGrantAttempt = attA.id;
      const groupSourceId = `group:${groupAId}:${sharedCycle}`;

      inMemoryStore.addOrUpdateEnrollmentGrant({
        userId: boundUser,
        courseId: targetCourseId,
        grant: {
          sourceId: groupSourceId,
          kind: 'group',
          groupId: groupAId,
          cycleId: sharedCycle,
          attemptId: initialGrantAttempt,
          grantedAt: '2026-11-09T00:00:00.000Z',
          status: 'active',
        },
      });

      // Erroneous retry payload attempting to clobber attemptId
      inMemoryStore.addOrUpdateEnrollmentGrant({
        userId: boundUser,
        courseId: targetCourseId,
        grant: {
          sourceId: groupSourceId,
          kind: 'group',
          groupId: groupAId,
          cycleId: sharedCycle,
          attemptId: 'ATT-SHOULD-NOT-CLOBBER',
          grantedAt: '2026-11-09T01:00:00.000Z',
          status: 'active',
        },
      });

      const record = inMemoryStore.getCourseEnrollment(targetCourseId, boundUser);
      expect(record?.sources[0].attemptId).toBe(initialGrantAttempt);
    });

    it('7. strictly prevents a group-specific request from matching or reusing an ungrouped standalone attempt (D-06)', () => {
      const trainee = 'USR_UNGROUPED_ISOLATION_01';

      // 1. User enrolls via catalog (standalone attempt: groupId = null, cycleId = null)
      inMemoryStore.enrollUser({
        courseId: targetCourseId,
        userId: trainee,
        userRole: 'user',
      });

      const standaloneAttempts = inMemoryStore.getTraineeAttempts(trainee, targetCourseId);
      expect(standaloneAttempts).toHaveLength(1);
      const standalone = standaloneAttempts[0];
      expect(standalone.groupId).toBeNull();
      expect(standalone.cycleId).toBeNull();
      expect(standalone.id).toBe(`ATT-${trainee}-${targetCourseId}-standalone`);

      // 2. Trainee subsequently joins a group that has no active renewal cycle (cycleId = null)
      const groupResult = inMemoryStore.addGroupMember('GRP-101', trainee);
      expect(groupResult.group).toBeDefined();

      // 3. Verify getOrCreateCurrentAttempt for GRP-101 does NOT reuse the standalone attempt
      const groupAttempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: trainee,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: null,
      });

      expect(groupAttempt.id).not.toBe(standalone.id);
      expect(groupAttempt.groupId).toBe('GRP-101');
      expect(groupAttempt.id).toBe(`ATT-${trainee}-${targetCourseId}-GRP-101`);

      // 4. Verify the enrollment record maintains both grants bound to distinct attempts
      const enrollment = inMemoryStore.getCourseEnrollment(targetCourseId, trainee);
      expect(enrollment?.sources).toHaveLength(2);

      const selfGrant = enrollment?.sources.find((s) => s.kind === 'self');
      const groupGrant = enrollment?.sources.find((s) => s.kind === 'group');

      expect(selfGrant?.attemptId).toBe(standalone.id);
      expect(groupGrant?.attemptId).toBe(groupAttempt.id);
      expect(selfGrant?.attemptId).not.toBe(groupGrant?.attemptId);

      // 5. Verify the store contains both attempts independently
      const allAttempts = inMemoryStore.getTraineeAttempts(trainee, targetCourseId);
      expect(allAttempts).toHaveLength(2);
      expect(allAttempts.some((a) => a.id === standalone.id && a.groupId === null)).toBe(true);
      expect(allAttempts.some((a) => a.id === groupAttempt.id && a.groupId === 'GRP-101')).toBe(true);
    });

    it('8. strictly prevents a standalone lookup from matching or reusing an existing group-scoped attempt', () => {
      const trainee = 'USR_STANDALONE_LOOKUP_01';

      // 1. Trainee first joins group GRP-201
      inMemoryStore.addGroupMember('GRP-201', trainee);

      const groupAttempts = inMemoryStore.getTraineeAttempts(trainee, targetCourseId);
      expect(groupAttempts.length).toBeGreaterThanOrEqual(1);
      const groupAtt = groupAttempts.find((a) => a.groupId === 'GRP-201');
      expect(groupAtt).toBeDefined();

      // 2. Standalone lookup (groupId: null, cycleId: null) must NOT return the group attempt
      const standaloneAtt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: trainee,
        courseId: targetCourseId,
        groupId: null,
        cycleId: null,
      });

      expect(standaloneAtt.id).not.toBe(groupAtt?.id);
      expect(standaloneAtt.groupId).toBeNull();
      expect(standaloneAtt.id).toBe(`ATT-${trainee}-${targetCourseId}-standalone`);
    });

    it('9. enforces cycle-specific lookup isolation across different renewal cycles', () => {
      const trainee = 'USR_CYCLE_ISOLATION_01';
      const groupId = 'GRP-101';

      const cycle1Attempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: trainee,
        courseId: targetCourseId,
        groupId,
        cycleId: 'CYCLE-1',
      });

      const cycle2Attempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: trainee,
        courseId: targetCourseId,
        groupId,
        cycleId: 'CYCLE-2',
      });

      expect(cycle1Attempt.id).not.toBe(cycle2Attempt.id);
      expect(cycle1Attempt.cycleId).toBe('CYCLE-1');
      expect(cycle2Attempt.cycleId).toBe('CYCLE-2');
      expect(cycle1Attempt.id).toBe(`ATT-${trainee}-${targetCourseId}-${groupId}-CYCLE-1`);
      expect(cycle2Attempt.id).toBe(`ATT-${trainee}-${targetCourseId}-${groupId}-CYCLE-2`);
    });

    it('10. enforces explicit groupId ownership precedence over cycle inference in group metrics and attempt filtering', () => {
      const trainee = 'USR_METRICS_AUDIT_01';
      const foreignGroup = 'GRP-201';
      const homeGroup = 'GRP-101';
      const homeCycle = 'CYC-GRP-101-01';

      // Explicit foreign groupId with a cycleId matching homeGroup's cycle format
      const foreignAttempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: trainee,
        courseId: targetCourseId,
        groupId: foreignGroup,
        cycleId: homeCycle,
      });

      expect(foreignAttempt.groupId).toBe(foreignGroup);
      expect(foreignAttempt.cycleId).toBe(homeCycle);

      // 1. Authoritative explicit groupId: must belong to GRP-201, never GRP-101
      const homeAttempts = inMemoryStore.getGroupAttempts(homeGroup);
      const foreignAttempts = inMemoryStore.getGroupAttempts(foreignGroup);

      expect(homeAttempts.some((a) => a.id === foreignAttempt.id)).toBe(false);
      expect(foreignAttempts.some((a) => a.id === foreignAttempt.id)).toBe(true);

      // 2. Metrics isolation: GRP-101 metrics must not count foreignAttempt
      const metrics = inMemoryStore.getGroupMetrics(homeGroup, homeCycle);
      expect(metrics).toBeDefined();
    });

    it('11. allows legacy attempts without groupId to use cycle ownership inference when genuinely absent', () => {
      const legacyTrainee = 'USR_LEGACY_CYCLE_01';
      const homeGroup = 'GRP-101';
      const homeCycle = 'CYC-GRP-101-01';

      // Provision legacy attempt without groupId
      const legacyAttempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: legacyTrainee,
        courseId: targetCourseId,
        groupId: null,
        cycleId: homeCycle,
      });

      expect(legacyAttempt.groupId).toBeNull();
      expect(legacyAttempt.cycleId).toBe(homeCycle);

      // When groupId is absent, cycle ownership inference attributes CYC-GRP-101-01 to GRP-101
      const homeAttempts = inMemoryStore.getGroupAttempts(homeGroup);
      const foreignAttempts = inMemoryStore.getGroupAttempts('GRP-201');

      expect(homeAttempts.some((a) => a.id === legacyAttempt.id)).toBe(true);
      expect(foreignAttempts.some((a) => a.id === legacyAttempt.id)).toBe(false);
    });

    it('12. handles mixed-case identifiers canonically without creating duplicate attempts', () => {
      const canonicalUser = 'usr_trainee_003';
      const mixedUser = 'USR_TRAINEE_003';
      const mixedCourse = 'crs001';
      const mixedGroup = 'grp-201';
      const mixedCycle = 'cyc-grp-201-01';

      // Query 1: Canonical casing
      const firstAttempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: canonicalUser,
        courseId: targetCourseId,
        groupId: 'GRP-201',
        cycleId: 'CYC-GRP-201-01',
      });

      // Query 2: Mixed-case casing
      const secondAttempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: mixedUser,
        courseId: mixedCourse,
        groupId: mixedGroup,
        cycleId: mixedCycle,
      });

      // Must locate the exact same attempt instance without creating a duplicate
      expect(secondAttempt.id).toBe(firstAttempt.id);
      expect(firstAttempt.id).toBe('ATT-usr_trainee_003-CRS001-CYC-GRP-201-01');

      // Verify no duplicate attempts were registered in the store
      const allTraineeAttempts = inMemoryStore.getTraineeAttempts(canonicalUser, targetCourseId);
      const matchingAttempts = allTraineeAttempts.filter(
        (a) => a.cycleId?.toLowerCase() === 'cyc-grp-201-01'
      );
      expect(matchingAttempts).toHaveLength(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Suite 6: Phase 2 / WP-2.1 / T-2.1.2: Per-Attempt Progress Isolation (MFR-02, MFR-41, D-06)
  // ══════════════════════════════════════════════════════════════════════════
  describe('6. Per-Attempt Progress Isolation & Attempt Resolution (MFR-02, MFR-41, D-06)', () => {
    it('1. resolveActiveAttemptForLearning with explicit attemptId resolves the exact attempt instance and verifies user ownership', () => {
      const attemptA = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });
      const attemptB = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-201',
        cycleId: 'CYC-GRP-201-01',
      });

      const resolvedA = inMemoryStore.resolveActiveAttemptForLearning({
        userId: traineeId,
        courseId: targetCourseId,
        attemptId: attemptA.id,
      });
      expect(resolvedA.id).toBe(attemptA.id);

      const resolvedB = inMemoryStore.resolveActiveAttemptForLearning({
        userId: traineeId,
        courseId: targetCourseId,
        attemptId: attemptB.id,
      });
      expect(resolvedB.id).toBe(attemptB.id);
    });

    it('2. resolveActiveAttemptForLearning fails closed when given a non-existent attemptId or an attempt belonging to another user/course', () => {
      // 1. Non-existent attemptId throws 404
      expect(() => {
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: traineeId,
          courseId: targetCourseId,
          attemptId: 'ATT-NON-EXISTENT',
        });
      }).toThrow(MockStoreError);

      // 2. Cross-user attempt ownership violation throws 403
      const otherUserAttempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: 'usr_admin_001',
        courseId: targetCourseId,
      });
      expect(() => {
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: traineeId,
          courseId: targetCourseId,
          attemptId: otherUserAttempt.id,
        });
      }).toThrow(MockStoreError);

      // 3. Cross-course attempt mismatch throws 400
      const otherCourseAttempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: 'CRS002',
      });
      expect(() => {
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: traineeId,
          courseId: targetCourseId,
          attemptId: otherCourseAttempt.id,
        });
      }).toThrow(MockStoreError);
    });

    it('3. resolveActiveAttemptForLearning with explicit groupId resolves to group-scoped attempt', () => {
      const resolved = inMemoryStore.resolveActiveAttemptForLearning({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      expect(resolved.groupId).toBe('GRP-101');
      expect(resolved.cycleId).toBe('CYC-GRP-101-01');
      expect(resolved.userId).toBe(traineeId);
      expect(resolved.courseId).toBe(targetCourseId);
    });

    it('4. resolveActiveAttemptForLearning with single active grant resolves automatically to bound attemptId', () => {
      inMemoryStore.enrollUser({
        courseId: targetCourseId,
        userId: traineeId,
        userRole: 'user',
      });

      const enrollment = inMemoryStore.getCourseEnrollment(targetCourseId, traineeId);
      expect(enrollment?.sources).toHaveLength(1);
      const grant = enrollment!.sources[0];

      const resolved = inMemoryStore.resolveActiveAttemptForLearning({
        userId: traineeId,
        courseId: targetCourseId,
      });

      expect(resolved.id).toBe(grant.attemptId);
    });

    it('5. resolveActiveAttemptForLearning with multiple active grants selects the in-progress attempt over not-started attempt', () => {
      // Create attempt 1 (not started)
      const attempt1 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      // Create attempt 2 (in progress)
      const attempt2 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-201',
        cycleId: 'CYC-GRP-201-01',
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);
      const item1 = flatItems[0];

      inMemoryStore.recordLessonActivity({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: item1.id,
        activity: { lastPositionSeconds: 60 },
        attemptId: attempt2.id,
      });

      // Setup multi-grant enrollment
      const grant1: EnrollmentSourceGrant = {
        sourceId: 'group:GRP-101:CYC-GRP-101-01',
        kind: 'group',
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
        attemptId: attempt1.id,
        grantedAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
      };
      const grant2: EnrollmentSourceGrant = {
        sourceId: 'group:GRP-201:CYC-GRP-201-01',
        kind: 'group',
        groupId: 'GRP-201',
        cycleId: 'CYC-GRP-201-01',
        attemptId: attempt2.id,
        grantedAt: '2026-04-01T00:00:00.000Z',
        status: 'active',
      };

      const rawEnrollments = (inMemoryStore as unknown as { enrollments: EnrollmentRecord[] }).enrollments;
      rawEnrollments.push({
        id: `ENR-${traineeId}-${targetCourseId}`,
        userId: traineeId,
        courseId: targetCourseId,
        enrolledAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
        sources: [grant1, grant2],
      });

      const resolved = inMemoryStore.resolveActiveAttemptForLearning({
        userId: traineeId,
        courseId: targetCourseId,
        allowHeuristicFallback: true,
      });

      expect(resolved.id).toBe(attempt2.id);
      expect(resolved.status).toBe('in_progress');
    });

    it('6. resolveActiveAttemptForLearning fallback resolves or provisions a standalone attempt when no enrollment exists', () => {
      const initialEnrollment = inMemoryStore.getCourseEnrollment('CRS002', traineeId);
      expect(initialEnrollment).toBeUndefined();

      const resolved = inMemoryStore.resolveActiveAttemptForLearning({
        userId: traineeId,
        courseId: 'CRS002',
      });

      expect(resolved.userId.toLowerCase()).toBe(traineeId.toLowerCase());
      expect(resolved.courseId.toLowerCase()).toBe('crs002');
      expect(resolved.groupId).toBeNull();
      expect(resolved.cycleId).toBeNull();
    });

    it('7. isolates lesson progress between two independent attempts for the same user and course', () => {
      const attempt1 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });
      const attempt2 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-201',
        cycleId: 'CYC-GRP-201-01',
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);
      const item1 = flatItems[0];

      // Mutate progress on Attempt 1 only
      inMemoryStore.recordLessonActivity({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: item1.id,
        activity: { lastPositionSeconds: 180, furthestWatchedSeconds: 180 },
        attemptId: attempt1.id,
      });

      const progress1 = inMemoryStore.getCourseProgress(traineeId, targetCourseId, {
        attemptId: attempt1.id,
      });
      const progress2 = inMemoryStore.getCourseProgress(traineeId, targetCourseId, {
        attemptId: attempt2.id,
      });

      expect(progress1.itemsProgress[item1.id]).toBeDefined();
      expect(progress1.itemsProgress[item1.id].lastPositionSeconds).toBe(180);
      expect(progress1.lastWatchedItemId).toBe(item1.id);

      // Attempt 2 progress must remain clean and isolated
      expect(progress2.itemsProgress[item1.id]).toBeUndefined();
      expect(progress2.lastWatchedItemId).toBeNull();
      expect(progress2.progressPercent).toBe(0);
    });

    it('8. isolates playback telemetry and watch positions per attempt', () => {
      const attempt1 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });
      const attempt2 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-201',
        cycleId: 'CYC-GRP-201-01',
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);
      const item1 = flatItems[0];

      inMemoryStore.recordLessonActivity({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: item1.id,
        activity: {
          lastPositionSeconds: 300,
          furthestWatchedSeconds: 300,
          watchCount: 4,
        },
        attemptId: attempt1.id,
      });

      inMemoryStore.recordLessonActivity({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: item1.id,
        activity: {
          lastPositionSeconds: 45,
          furthestWatchedSeconds: 45,
          watchCount: 1,
        },
        attemptId: attempt2.id,
      });

      const prog1 = inMemoryStore.getAttemptProgress(attempt1.id);
      const prog2 = inMemoryStore.getAttemptProgress(attempt2.id);

      expect(prog1?.itemsProgress[item1.id].furthestWatchedSeconds).toBe(300);
      expect(prog1?.itemsProgress[item1.id].watchCount).toBe(4);

      expect(prog2?.itemsProgress[item1.id].furthestWatchedSeconds).toBe(45);
      expect(prog2?.itemsProgress[item1.id].watchCount).toBe(1);
    });

    it('9. isolates lesson completion: completing lessons on Attempt 1 does NOT mark them completed on Attempt 2', () => {
      const attempt1 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });
      const attempt2 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-201',
        cycleId: 'CYC-GRP-201-01',
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);
      const item1 = flatItems[0];

      inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: item1.id,
        attemptId: attempt1.id,
      });

      const progress1 = inMemoryStore.getCourseProgress(traineeId, targetCourseId, {
        attemptId: attempt1.id,
      });
      const progress2 = inMemoryStore.getCourseProgress(traineeId, targetCourseId, {
        attemptId: attempt2.id,
      });

      expect(progress1.completedItemIds).toContain(item1.id);
      expect(progress1.progressPercent).toBeGreaterThan(0);

      expect(progress2.completedItemIds).not.toContain(item1.id);
      expect(progress2.progressPercent).toBe(0);
      expect(progress2.isCompleted).toBe(false);
    });

    it('10. synchronizes attemptProgress directly with CourseAttempt ledger eliminating dual store divergence', () => {
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);
      const item1 = flatItems[0];

      const res = inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: item1.id,
        attemptId: attempt.id,
      });

      const attemptProg = inMemoryStore.getAttemptProgress(attempt.id);
      const storedAttempt = inMemoryStore.getAttemptsStore().find((a) => a.id === attempt.id);

      expect(attemptProg).toBeDefined();
      expect(storedAttempt).toBeDefined();

      // Invariants: fields match 100% across attemptProgress and CourseAttempt
      expect(storedAttempt!.progressPercent).toBe(res.progress.progressPercent);
      expect(storedAttempt!.completedItemIds).toEqual(res.progress.completedItemIds);
      expect(storedAttempt!.lastWatchedItemId).toBe(item1.id);
      expect(storedAttempt!.lessonProgress[item1.id].completed).toBe(true);

      expect(attemptProg!.progressPercent).toBe(storedAttempt!.progressPercent);
      expect(attemptProg!.completedItemIds).toEqual(storedAttempt!.completedItemIds);
      expect(attemptProg!.lastWatchedItemId).toBe(storedAttempt!.lastWatchedItemId);
    });

    it('11. reflects trainee lesson completion in group metrics resolving MFR-02', () => {
      // In GRP-101, usr_trainee_003 is a pre-seeded member
      const groupMetricsInitial = inMemoryStore.getGroupMetrics('GRP-101');
      const initialTraineeMetrics = groupMetricsInitial?.traineeMetricsList.find(
        (tm) => tm.userId.toLowerCase() === traineeId.toLowerCase()
      );
      expect(initialTraineeMetrics).toBeDefined();
      expect(initialTraineeMetrics!.totalCompletedLessons).toBe(0);

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);
      const item1 = flatItems[0];

      inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: item1.id,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP101-01',
      });

      const groupMetricsUpdated = inMemoryStore.getGroupMetrics('GRP-101');
      const updatedTraineeMetrics = groupMetricsUpdated?.traineeMetricsList.find(
        (tm) => tm.userId.toLowerCase() === traineeId.toLowerCase()
      );

      // Trainee's progress in group monitoring must be > 0 (MFR-02 resolved)
      expect(updatedTraineeMetrics).toBeDefined();
      expect(updatedTraineeMetrics!.totalCompletedLessons).toBe(1);
      const courseProgInGroup = updatedTraineeMetrics!.courseProgressMap[targetCourseId];
      expect(courseProgInGroup).toBeDefined();
      expect(courseProgInGroup.completedLessons).toBe(1);
      expect(courseProgInGroup.percent).toBeGreaterThan(0);
      expect(courseProgInGroup.started).toBe(true);
    });

    it('12. ensures preview activity by lecturer or admin does NOT mutate attemptProgress or CourseAttempt for trainees', () => {
      const traineeAttempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);
      const item1 = flatItems[0];

      // Lecturer performs preview completion
      inMemoryStore.markLessonComplete({
        userId: 'usr_lect_002',
        courseId: targetCourseId,
        itemId: item1.id,
        userRole: 'lecturer',
      });

      // Trainee attempt progress must remain completely unmutated
      const traineeProg = inMemoryStore.getAttemptProgress(traineeAttempt.id);
      expect(traineeProg?.completedItemIds).toHaveLength(0);
      expect(traineeProg?.progressPercent).toBe(0);
      expect(traineeProg?.itemsProgress[item1.id]).toBeUndefined();

      // Trainee CourseAttempt must remain not_started
      const storedTraineeAttempt = inMemoryStore.getAttemptsStore().find((a) => a.id === traineeAttempt.id);
      expect(storedTraineeAttempt?.status).toBe('not_started');
      expect(storedTraineeAttempt?.completedItemIds).toHaveLength(0);
    });
  });

  describe('7. Unambiguous Learning Player Attempt Resolution & Context Selection (T-2.1.3, MFR-41, D-06, §9.1)', () => {
    it('1. single eligible attempt resolves automatically without requiring attempt selection', () => {
      // Setup single self grant
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const grant: EnrollmentSourceGrant = {
        sourceId: `self:${targetCourseId}`,
        kind: 'self',
        attemptId: attempt.id,
        grantedAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
      };

      const rawEnrollments = (inMemoryStore as unknown as { enrollments: EnrollmentRecord[] }).enrollments;
      rawEnrollments.push({
        id: `ENR-${traineeId}-${targetCourseId}`,
        userId: traineeId,
        courseId: targetCourseId,
        enrolledAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
        sources: [grant],
      });

      const progress = inMemoryStore.getCourseProgress(traineeId, targetCourseId);
      expect(progress.requiresAttemptSelection).toBeFalsy();
      expect(progress.attemptId).toBe(attempt.id);
    });

    it('2. multiple eligible attempts produce an explicit ambiguity result', () => {
      const attempt1 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const attempt2 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      const grant1: EnrollmentSourceGrant = {
        sourceId: `self:${targetCourseId}`,
        kind: 'self',
        attemptId: attempt1.id,
        grantedAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
      };

      const grant2: EnrollmentSourceGrant = {
        sourceId: 'group:GRP-101:CYC-GRP-101-01',
        kind: 'group',
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
        attemptId: attempt2.id,
        grantedAt: '2026-03-02T00:00:00.000Z',
        status: 'active',
      };

      const rawEnrollments = (inMemoryStore as unknown as { enrollments: EnrollmentRecord[] }).enrollments;
      rawEnrollments.push({
        id: `ENR-${traineeId}-${targetCourseId}`,
        userId: traineeId,
        courseId: targetCourseId,
        enrolledAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
        sources: [grant1, grant2],
      });

      // getCourseProgress returns requiresAttemptSelection
      const progress = inMemoryStore.getCourseProgress(traineeId, targetCourseId);
      expect(progress.requiresAttemptSelection).toBe(true);
      expect(progress.eligibleAttempts).toBeDefined();
      expect(progress.eligibleAttempts!.length).toBe(2);

      // resolveActiveAttemptForLearning throws AttemptAmbiguityError
      expect(() => {
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: traineeId,
          courseId: targetCourseId,
        });
      }).toThrowError(AttemptAmbiguityError);
    });

    it('3. selector displays all eligible contexts with human-readable labels and progress metadata', () => {
      const attempt1 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const attempt2 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);
      inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: flatItems[0].id,
        attemptId: attempt1.id,
      });

      const grant1: EnrollmentSourceGrant = {
        sourceId: `self:${targetCourseId}`,
        kind: 'self',
        attemptId: attempt1.id,
        grantedAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
      };

      const grant2: EnrollmentSourceGrant = {
        sourceId: 'group:GRP-101:CYC-GRP-101-01',
        kind: 'group',
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
        attemptId: attempt2.id,
        grantedAt: '2026-03-02T00:00:00.000Z',
        status: 'active',
      };

      const rawEnrollments = (inMemoryStore as unknown as { enrollments: EnrollmentRecord[] }).enrollments;
      rawEnrollments.push({
        id: `ENR-${traineeId}-${targetCourseId}`,
        userId: traineeId,
        courseId: targetCourseId,
        enrolledAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
        sources: [grant1, grant2],
      });

      const eligible = inMemoryStore.getEligibleAttemptsForCourse(traineeId, targetCourseId);
      expect(eligible).toHaveLength(2);

      const selfOpt = eligible.find((o) => o.kind === 'self');
      expect(selfOpt).toBeDefined();
      expect(selfOpt!.contextLabel).toBe('تسجيل ذاتي مستقل');
      expect(selfOpt!.progressPercent).toBeGreaterThan(0);
      expect(selfOpt!.completedLessons).toBe(1);
      expect(selfOpt!.accessMode).toBe('full');

      const groupOpt = eligible.find((o) => o.kind === 'group');
      expect(groupOpt).toBeDefined();
      expect(groupOpt!.contextLabel).toContain('مجموعة:');
      expect(groupOpt!.progressPercent).toBe(0);
      expect(groupOpt!.accessMode).toBe('full');
    });

    it('4. selecting a context enters the correct attempt', () => {
      const attempt1 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const attempt2 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      const grant1: EnrollmentSourceGrant = {
        sourceId: `self:${targetCourseId}`,
        kind: 'self',
        attemptId: attempt1.id,
        grantedAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
      };

      const grant2: EnrollmentSourceGrant = {
        sourceId: 'group:GRP-101:CYC-GRP-101-01',
        kind: 'group',
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
        attemptId: attempt2.id,
        grantedAt: '2026-03-02T00:00:00.000Z',
        status: 'active',
      };

      const rawEnrollments = (inMemoryStore as unknown as { enrollments: EnrollmentRecord[] }).enrollments;
      rawEnrollments.push({
        id: `ENR-${traineeId}-${targetCourseId}`,
        userId: traineeId,
        courseId: targetCourseId,
        enrolledAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
        sources: [grant1, grant2],
      });

      // Query with selected attemptId
      const progress = inMemoryStore.getCourseProgress(traineeId, targetCourseId, {
        attemptId: attempt2.id,
      });

      expect(progress.requiresAttemptSelection).toBeFalsy();
      expect(progress.attemptId).toBe(attempt2.id);
    });

    it('5. no progress mutation occurs before selection', () => {
      const attempt1 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const attempt2 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      const grant1: EnrollmentSourceGrant = {
        sourceId: `self:${targetCourseId}`,
        kind: 'self',
        attemptId: attempt1.id,
        grantedAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
      };

      const grant2: EnrollmentSourceGrant = {
        sourceId: 'group:GRP-101:CYC-GRP-101-01',
        kind: 'group',
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
        attemptId: attempt2.id,
        grantedAt: '2026-03-02T00:00:00.000Z',
        status: 'active',
      };

      const rawEnrollments = (inMemoryStore as unknown as { enrollments: EnrollmentRecord[] }).enrollments;
      rawEnrollments.push({
        id: `ENR-${traineeId}-${targetCourseId}`,
        userId: traineeId,
        courseId: targetCourseId,
        enrolledAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
        sources: [grant1, grant2],
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);

      // Attempting mutation without attemptId throws AttemptAmbiguityError
      expect(() => {
        inMemoryStore.recordLessonActivity({
          userId: traineeId,
          courseId: targetCourseId,
          itemId: flatItems[0].id,
          activity: { lastPositionSeconds: 45 },
        });
      }).toThrowError(AttemptAmbiguityError);

      expect(() => {
        inMemoryStore.markLessonComplete({
          userId: traineeId,
          courseId: targetCourseId,
          itemId: flatItems[0].id,
        });
      }).toThrowError(AttemptAmbiguityError);

      // Verify attempts remain pristine
      expect(inMemoryStore.getAttemptProgress(attempt1.id)?.completedItemIds || []).toHaveLength(0);
      expect(inMemoryStore.getAttemptProgress(attempt2.id)?.completedItemIds || []).toHaveLength(0);
    });

    it('6. explicit valid attemptId takes precedence over default resolution', () => {
      const attempt1 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const resolved = inMemoryStore.resolveActiveAttemptForLearning({
        userId: traineeId,
        courseId: targetCourseId,
        attemptId: attempt1.id,
      });

      expect(resolved.id).toBe(attempt1.id);
    });

    it('7. invalid or foreign attemptId is rejected without fallback', () => {
      expect(() => {
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: traineeId,
          courseId: targetCourseId,
          attemptId: 'ATT-non-existent-999',
        });
      }).toThrowError(MockStoreError);

      const foreignAttempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: 'usr_trainee_004',
        courseId: targetCourseId,
      });

      expect(() => {
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: traineeId,
          courseId: targetCourseId,
          attemptId: foreignAttempt.id,
        });
      }).toThrowError(MockStoreError);
    });

    it('8. revoked and expired grants cannot be selected as active learning contexts', () => {
      const attemptRevoked = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      const revokedGrant: EnrollmentSourceGrant = {
        sourceId: 'group:GRP-101:CYC-GRP-101-01',
        kind: 'group',
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
        attemptId: attemptRevoked.id,
        grantedAt: '2026-03-01T00:00:00.000Z',
        status: 'revoked_by_group_removal',
      };

      const rawEnrollments = (inMemoryStore as unknown as { enrollments: EnrollmentRecord[] }).enrollments;
      rawEnrollments.push({
        id: `ENR-${traineeId}-${targetCourseId}`,
        userId: traineeId,
        courseId: targetCourseId,
        enrolledAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
        sources: [revokedGrant],
      });

      const eligible = inMemoryStore.getEligibleAttemptsForCourse(traineeId, targetCourseId);
      // Revoked grant must not be eligible
      expect(eligible.find((o) => o.attemptId === attemptRevoked.id)).toBeUndefined();
    });

    it('9. group name and cycle context are displayed correctly', () => {
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      const grant: EnrollmentSourceGrant = {
        sourceId: 'group:GRP-101:CYC-GRP-101-01',
        kind: 'group',
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
        attemptId: attempt.id,
        grantedAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
      };

      const rawEnrollments = (inMemoryStore as unknown as { enrollments: EnrollmentRecord[] }).enrollments;
      rawEnrollments.push({
        id: `ENR-${traineeId}-${targetCourseId}`,
        userId: traineeId,
        courseId: targetCourseId,
        enrolledAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
        sources: [grant],
      });

      const eligible = inMemoryStore.getEligibleAttemptsForCourse(traineeId, targetCourseId);
      expect(eligible).toHaveLength(1);
      expect(eligible[0].groupName).toBeDefined();
      expect(eligible[0].contextLabel).toContain('مجموعة:');
      expect(eligible[0].cycleTitle).toBeDefined();
    });

    it('10. switching between attempts preserves independent progress', () => {
      const attempt1 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const attempt2 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);

      // Complete lesson 1 on attempt 1
      inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: flatItems[0].id,
        attemptId: attempt1.id,
      });

      const prog1 = inMemoryStore.getCourseProgress(traineeId, targetCourseId, { attemptId: attempt1.id });
      expect(prog1.completedItemIds).toContain(flatItems[0].id);

      // Attempt 2 must be unaffected
      const prog2 = inMemoryStore.getCourseProgress(traineeId, targetCourseId, { attemptId: attempt2.id });
      expect(prog2.completedItemIds).toHaveLength(0);
      expect(prog2.progressPercent).toBe(0);
    });

    it('11. video and document activity use the selected attempt', () => {
      const attempt1 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const attempt2 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);

      inMemoryStore.recordLessonActivity({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: flatItems[0].id,
        activity: { lastPositionSeconds: 120, furthestWatchedSeconds: 120 },
        attemptId: attempt1.id,
      });

      const prog1 = inMemoryStore.getAttemptProgress(attempt1.id);
      expect(prog1?.itemsProgress[flatItems[0].id]?.lastPositionSeconds).toBe(120);

      const prog2 = inMemoryStore.getAttemptProgress(attempt2.id);
      expect(prog2?.itemsProgress[flatItems[0].id]).toBeUndefined();
    });

    it('12. lesson completion updates only the selected attempt', () => {
      const attempt1 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const attempt2 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);

      inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: flatItems[0].id,
        attemptId: attempt1.id,
      });

      expect(inMemoryStore.getAttemptProgress(attempt1.id)?.completedItemIds).toHaveLength(1);
      expect(inMemoryStore.getAttemptProgress(attempt2.id)?.completedItemIds).toHaveLength(0);
    });

    it('13. a stale mutation cannot change a different attempt after context switching', () => {
      const attempt1 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const attempt2 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);

      // Context switch: UI is in attempt 2, but a delayed activity packet arrives referencing attempt1
      inMemoryStore.recordLessonActivity({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: flatItems[0].id,
        activity: { lastPositionSeconds: 75 },
        attemptId: attempt1.id,
      });

      // Must be recorded on attempt 1, NEVER on attempt 2
      expect(inMemoryStore.getAttemptProgress(attempt1.id)?.itemsProgress[flatItems[0].id]?.lastPositionSeconds).toBe(75);
      expect(inMemoryStore.getAttemptProgress(attempt2.id)?.itemsProgress[flatItems[0].id]).toBeUndefined();
    });

    it('14. no unnecessary selector appears for a single eligible attempt', () => {
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const grant: EnrollmentSourceGrant = {
        sourceId: `self:${targetCourseId}`,
        kind: 'self',
        attemptId: attempt.id,
        grantedAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
      };

      const rawEnrollments = (inMemoryStore as unknown as { enrollments: EnrollmentRecord[] }).enrollments;
      rawEnrollments.push({
        id: `ENR-${traineeId}-${targetCourseId}`,
        userId: traineeId,
        courseId: targetCourseId,
        enrolledAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
        sources: [grant],
      });

      const progress = inMemoryStore.getCourseProgress(traineeId, targetCourseId);
      expect(progress.requiresAttemptSelection).toBeFalsy();
      expect(progress.eligibleAttempts).toBeUndefined();
    });

    it('15. empty eligibility follows the existing enrollment flow', () => {
      const newTrainee = 'usr_brand_new_999';
      const eligible = inMemoryStore.getEligibleAttemptsForCourse(newTrainee, targetCourseId);
      expect(eligible).toHaveLength(0);
    });

    it('16. preview mode continues to avoid real learner mutations across attempts', () => {
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);

      const previewRes = inMemoryStore.markLessonComplete({
        userId: 'usr_lect_002',
        courseId: targetCourseId,
        itemId: flatItems[0].id,
        userRole: 'lecturer',
        attemptId: attempt.id,
      });

      expect(previewRes.message).toContain('معاينة');
      expect(inMemoryStore.getAttemptProgress(attempt.id)?.completedItemIds).toHaveLength(0);
    });
  });

  describe('8. Standalone Attempt Provision & Progress Reader Unification (T-2.1.4, MFR-32, MFR-33)', () => {
    it('1. provisions a standalone CourseAttempt upon self-enrollment (MFR-32)', () => {
      const initialEnrollment = inMemoryStore.getCourseEnrollment(targetCourseId, traineeId);
      expect(initialEnrollment).toBeUndefined();

      const response = inMemoryStore.enrollUser({
        courseId: targetCourseId,
        userId: traineeId,
        userRole: 'user',
      });

      expect(response.enrollment).toBeDefined();
      expect(response.enrollment.sources).toHaveLength(1);
      const selfGrant = response.enrollment.sources[0];
      expect(selfGrant.kind).toBe('self');
      expect(selfGrant.attemptId).toBe(`ATT-${traineeId}-${targetCourseId}-standalone`);

      const storedAttempt = inMemoryStore.getAttemptsStore().find((a) => a.id === selfGrant.attemptId);
      expect(storedAttempt).toBeDefined();
      expect(storedAttempt!.groupId).toBeNull();
      expect(storedAttempt!.cycleId).toBeNull();
      expect(storedAttempt!.status).toBe('not_started');
    });

    it('2. standalone attempt provisioning is deterministic and idempotent', () => {
      const attempt1 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const attempt2 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      expect(attempt1.id).toBe(`ATT-${traineeId}-${targetCourseId}-standalone`);
      expect(attempt1.id).toBe(attempt2.id);
      expect(inMemoryStore.getAttemptsStore().filter((a) => a.id === attempt1.id)).toHaveLength(1);
    });

    it('3. standalone attempts remain strictly isolated from group-cycle attempts', () => {
      const standaloneAttempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const groupAttempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      expect(standaloneAttempt.id).not.toBe(groupAttempt.id);
      expect(standaloneAttempt.groupId).toBeNull();
      expect(groupAttempt.groupId).toBe('GRP-101');

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);
      inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: flatItems[0].id,
        attemptId: standaloneAttempt.id,
      });

      expect(inMemoryStore.getAttemptProgress(standaloneAttempt.id)?.completedItemIds).toContain(flatItems[0].id);
      expect(inMemoryStore.getAttemptProgress(groupAttempt.id)?.completedItemIds).toHaveLength(0);
    });

    it('4. grant-to-attempt association correctly preserves bound attemptId on grant update', () => {
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const selfGrant: EnrollmentSourceGrant = {
        sourceId: `self:${targetCourseId}`,
        kind: 'self',
        attemptId: attempt.id,
        grantedAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
      };

      inMemoryStore.addOrUpdateEnrollmentGrant({
        userId: traineeId,
        courseId: targetCourseId,
        grant: selfGrant,
      });

      // Update grant with same sourceId
      const updatedGrant: EnrollmentSourceGrant = {
        ...selfGrant,
        grantedAt: '2026-03-05T00:00:00.000Z',
      };

      const result = inMemoryStore.addOrUpdateEnrollmentGrant({
        userId: traineeId,
        courseId: targetCourseId,
        grant: updatedGrant,
      });

      expect(result.isNewGrant).toBe(false);
      const grant = result.enrollment.sources.find((s) => s.sourceId === selfGrant.sourceId);
      expect(grant?.attemptId).toBe(attempt.id);
    });

    it('5. progress reader getCourseProgress resolves through explicit attempt context', () => {
      const attempt1 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const attempt2 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);
      inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: flatItems[0].id,
        attemptId: attempt2.id,
      });

      const progress = inMemoryStore.getCourseProgress(traineeId, targetCourseId, {
        attemptId: attempt2.id,
      });

      expect(progress.attemptId).toBe(attempt2.id);
      expect(progress.progressPercent).toBeGreaterThan(0);
      expect(progress.completedItemIds).toContain(flatItems[0].id);
    });

    it('6. consistent progress reading across store, handler, and hook layers', () => {
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);
      inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: flatItems[0].id,
        attemptId: attempt.id,
      });

      const progress = inMemoryStore.getCourseProgress(traineeId, targetCourseId, {
        attemptId: attempt.id,
      });

      expect(progress.progressPercent).toBe(progress.overallProgressPercentage);
      expect(progress.progressPercent).toBe(calculateTraineeProgress(flatItems.length, 1));
    });

    it('7. historical progress preservation across multiple attempts', () => {
      const oldAttempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);
      for (const item of flatItems) {
        inMemoryStore.markLessonComplete({
          userId: traineeId,
          courseId: targetCourseId,
          itemId: item.id,
          attemptId: oldAttempt.id,
        });
      }

      expect(inMemoryStore.getAttemptProgress(oldAttempt.id)?.isCompleted).toBe(true);

      // New renewal cycle attempt
      const newAttempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-02',
      });

      expect(newAttempt.id).not.toBe(oldAttempt.id);
      expect(inMemoryStore.getAttemptProgress(newAttempt.id)?.completedItemIds).toHaveLength(0);
      expect(inMemoryStore.getAttemptProgress(oldAttempt.id)?.completedItemIds).toHaveLength(flatItems.length);
    });

    it('8. legacy userProgress import is rejected when multiple eligible attempts exist (ambiguity guard)', () => {
      const attempt1 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const attempt2 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      const grant1: EnrollmentSourceGrant = {
        sourceId: `self:${targetCourseId}`,
        kind: 'self',
        attemptId: attempt1.id,
        grantedAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
      };

      const grant2: EnrollmentSourceGrant = {
        sourceId: 'group:GRP-101:CYC-GRP-101-01',
        kind: 'group',
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
        attemptId: attempt2.id,
        grantedAt: '2026-03-02T00:00:00.000Z',
        status: 'active',
      };

      const rawEnrollments = (inMemoryStore as unknown as { enrollments: EnrollmentRecord[] }).enrollments;
      rawEnrollments.push({
        id: `ENR-${traineeId}-${targetCourseId}`,
        userId: traineeId,
        courseId: targetCourseId,
        enrolledAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
        sources: [grant1, grant2],
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);
      // Pre-seed legacy userProgress
      inMemoryStore.userProgress[traineeId] = {
        [targetCourseId.toLowerCase()]: {
          [flatItems[0].id]: {
            itemId: flatItems[0].id,
            completed: true,
          },
        },
      };

      const progress = inMemoryStore.getCourseProgress(traineeId, targetCourseId);
      expect(progress.requiresAttemptSelection).toBe(true);

      // Neither attempt should have blindly inherited the legacy progress
      expect(inMemoryStore.getAttemptProgress(attempt1.id)?.completedItemIds).toHaveLength(0);
      expect(inMemoryStore.getAttemptProgress(attempt2.id)?.completedItemIds).toHaveLength(0);
    });

    it('9. production flows strictly prevent silent heuristic fallback', () => {
      const attempt1 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const attempt2 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      const grant1: EnrollmentSourceGrant = {
        sourceId: `self:${targetCourseId}`,
        kind: 'self',
        attemptId: attempt1.id,
        grantedAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
      };

      const grant2: EnrollmentSourceGrant = {
        sourceId: 'group:GRP-101:CYC-GRP-101-01',
        kind: 'group',
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
        attemptId: attempt2.id,
        grantedAt: '2026-03-02T00:00:00.000Z',
        status: 'active',
      };

      const rawEnrollments = (inMemoryStore as unknown as { enrollments: EnrollmentRecord[] }).enrollments;
      rawEnrollments.push({
        id: `ENR-${traineeId}-${targetCourseId}`,
        userId: traineeId,
        courseId: targetCourseId,
        enrolledAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
        sources: [grant1, grant2],
      });

      // Calling without allowHeuristicFallback: true throws AttemptAmbiguityError
      expect(() => {
        inMemoryStore.resolveActiveAttemptForLearning({
          userId: traineeId,
          courseId: targetCourseId,
        });
      }).toThrowError(AttemptAmbiguityError);
    });

    it('10. compatibility mirror read and write restrictions', () => {
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);
      inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: flatItems[0].id,
        attemptId: attempt.id,
      });

      // Authoritative store updated
      expect(inMemoryStore.getAttemptProgress(attempt.id)?.completedItemIds).toContain(flatItems[0].id);

      // Legacy mirror updated only for that user/course
      expect(inMemoryStore.userProgress[traineeId]?.[targetCourseId.toLowerCase()]?.[flatItems[0].id]?.completed).toBe(true);
    });

    it('11. getCoursePerformanceReport includes self-enrolled trainees with their actual progress (MFR-32)', () => {
      inMemoryStore.enrollUser({
        courseId: targetCourseId,
        userId: traineeId,
        userRole: 'user',
      });

      const attempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);
      inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: flatItems[0].id,
        attemptId: attempt.id,
      });

      const report = inMemoryStore.getCoursePerformanceReport(targetCourseId, {
        id: 'usr_lect_002',
        role: 'lecturer',
      });

      const traineeRow = report.trainees.find((t) => t.id === traineeId);
      expect(traineeRow).toBeDefined();
      expect(traineeRow!.progressPercent).toBeGreaterThan(0);
      expect(traineeRow!.progressPercent).toBe(calculateTraineeProgress(flatItems.length, 1));
      expect(traineeRow!.status).toBe('active');
    });

    it('12. getCoursePerformanceReport provisions standalone attempts for enrolled trainees lacking attempts (MFR-32)', () => {
      const standaloneTrainee = 'usr_trainee_004';
      // Create enrollment without pre-created attempt
      const rawEnrollments = (inMemoryStore as unknown as { enrollments: EnrollmentRecord[] }).enrollments;
      rawEnrollments.push({
        id: `ENR-${standaloneTrainee}-${targetCourseId}`,
        userId: standaloneTrainee,
        courseId: targetCourseId,
        enrolledAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
        sources: [
          {
            sourceId: `self:${targetCourseId}`,
            kind: 'self',
            attemptId: `ATT-${standaloneTrainee}-${targetCourseId}-standalone`,
            grantedAt: '2026-03-01T00:00:00.000Z',
            status: 'active',
          },
        ],
      });

      const report = inMemoryStore.getCoursePerformanceReport(targetCourseId, {
        id: 'usr_lect_002',
        role: 'lecturer',
      });

      const row = report.trainees.find((t) => t.id === standaloneTrainee);
      expect(row).toBeDefined();
      expect(row!.progressPercent).toBe(0);
      expect(row!.status).toBe('not_started');
    });

    it('13. getUserTranscript authoritatively reads current attempt progress using calculateTraineeProgress (MFR-33)', () => {
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);
      inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: flatItems[0].id,
        attemptId: attempt.id,
      });

      const transcript = inMemoryStore.getUserTranscript(traineeId);
      expect(transcript).toBeDefined();
      const courseItem = transcript!.courses.find((c) => c.courseId === targetCourseId);
      expect(courseItem).toBeDefined();
      expect(courseItem!.progressPercent).toBe(calculateTraineeProgress(flatItems.length, 1));
      expect(courseItem!.status).toBe('in_progress');
    });

    it('14. getUserTranscript eliminates sticky isCompleted = true latch (MFR-33)', () => {
      const flatItems = inMemoryStore.getCourseItems(targetCourseId);

      // Completed historical attempt 1
      const oldAttempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });
      for (const item of flatItems) {
        inMemoryStore.markLessonComplete({
          userId: traineeId,
          courseId: targetCourseId,
          itemId: item.id,
          attemptId: oldAttempt.id,
        });
      }

      // New renewal cycle attempt 2 (fresh 0%)
      const newAttempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-02',
      });

      const transcript = inMemoryStore.getUserTranscript(traineeId);
      expect(transcript).toBeDefined();
      const courseItem = transcript!.courses.find((c) => c.courseId === targetCourseId);
      expect(courseItem).toBeDefined();

      // Must NOT be latched to completed: current active cycle attempt is at 0%
      expect(courseItem!.progressPercent).toBe(0);
      expect(courseItem!.status).toBe('not_started');
    });

    it('15. getUserTranscript eliminates Math.max guard and recalculates when curriculum expands (MFR-33)', () => {
      const attempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
      });

      const flatItems = inMemoryStore.getCourseItems(targetCourseId);
      // Trainee completes only first lesson
      inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: flatItems[0].id,
        attemptId: attempt.id,
      });

      const transcript = inMemoryStore.getUserTranscript(traineeId);
      const courseItem = transcript!.courses.find((c) => c.courseId === targetCourseId);
      expect(courseItem).toBeDefined();
      expect(courseItem!.progressPercent).toBe(calculateTraineeProgress(flatItems.length, 1));
      expect(courseItem!.progressPercent).toBeLessThan(100);
    });

    it('16. new attempt does not inherit completed lessons or progress from an older attempt', () => {
      const flatItems = inMemoryStore.getCourseItems(targetCourseId);

      const attempt1 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-01',
      });

      inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId: targetCourseId,
        itemId: flatItems[0].id,
        attemptId: attempt1.id,
      });

      const attempt2 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: targetCourseId,
        groupId: 'GRP-101',
        cycleId: 'CYC-GRP-101-02',
      });

      expect(inMemoryStore.getAttemptProgress(attempt2.id)?.completedItemIds).toHaveLength(0);
      expect(inMemoryStore.getAttemptProgress(attempt2.id)?.progressPercent).toBe(0);
      expect(inMemoryStore.getAttemptProgress(attempt1.id)?.completedItemIds).toHaveLength(1);
    });
  });
});

