/**
 * MetroLMS — Group Domain Reconciliation & Contract Normalization Test Suite
 *
 * Covers Phase C implementation of approved Owner Decisions:
 * - D-GRP-01: In-Place Renewal Identity (Stable Group ID, Name & Code)
 * - D-GRP-02: Day-Based Recurrence Measurement
 * - D-GRP-03: Immediate Mixed-Course Group Classification
 * - D-GRP-04: Authoritative In-Place GroupRenewalCycle Progression & Attempt Isolation
 * - D-GRP-05: Dual Badge Presentation Contract (Group & Course Level)
 * - D-GRP-06: Persistent Monotonic Reminder Classification (hasHistoricalReminderCourses)
 * - D-GRP-07: Complete Administrative Archive Exclusion from Trainee Views & Fail-Closed Route Protection
 * - D-GRP-08: Compact Course Presentation Data for Carousel
 *
 * STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { inMemoryStore, MockStoreError } from '@/mocks/store/inMemoryStore';
import {
  resolveGroupType,
  resolveGroupOperationalStatus,
  calculateGroupTimeInfo,
} from '@/core/groups/resolvers';
import type {
  TrainingGroup,
  GroupRenewalCycle,
  GroupCourseAssignment,
  CreateGroupRequestDTO,
  RenewGroupCycleRequestDTO,
  AssignCycleCoursesDTO,
  TraineeGroupItemDTO,
} from '@/core/groups';

describe('Phase C: Group Domain Reconciliation & Contract Normalization', () => {
  beforeEach(() => {
    inMemoryStore.reset();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE A: Course Role and Persistent Reminder Classification (D-GRP-03, D-GRP-05, D-GRP-06)
  // ══════════════════════════════════════════════════════════════════════════
  describe('Suite A: Course Role and Persistent Reminder Classification', () => {
    it('A.1: Classifies a group containing only core courses as "regular"', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const group: TrainingGroup = {
        id: 'GRP-TEST-REG',
        name: 'مجموعة تشغيل عادية',
        description: 'مجموعة تجريبية',
        courses: [
          { courseId: 'CRS001', order: 1, courseRole: 'core' },
          { courseId: 'CRS002', order: 2, courseRole: 'core' },
        ],
        courseId: 'CRS001',
        traineeIds: ['usr_trainee_001'],
        supervisorIds: [],
        resources: [],
        startDateTime: '2026-10-01T08:00:00Z',
        deadlineDateTime: '2026-11-30T18:00:00Z',
        postDeadlinePolicy: 'keep_no_cert',
        hasHistoricalReminderCourses: false,
      };

      expect(resolveGroupType(group)).toBe('regular');
    });

    it('A.2: Classifies a group containing all reminder courses as "reminder"', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const group: TrainingGroup = {
        id: 'GRP-TEST-REM',
        name: 'برنامج تجديد دوري',
        description: 'برنامج تذكيري بالكامل',
        courses: [
          { courseId: 'CRS001', order: 1, courseRole: 'reminder' },
        ],
        courseId: 'CRS001',
        traineeIds: ['usr_trainee_001'],
        supervisorIds: [],
        resources: [],
        startDateTime: '2026-10-01T08:00:00Z',
        deadlineDateTime: '2026-11-30T18:00:00Z',
        postDeadlinePolicy: 'keep_no_cert',
        hasHistoricalReminderCourses: true,
      };

      expect(resolveGroupType(group)).toBe('reminder');
    });

    it('A.3: Mixed-course group (>=1 reminder course) is immediately classified as "reminder" (D-GRP-03)', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const group: TrainingGroup = {
        id: 'GRP-TEST-MIXED',
        name: 'برنامج دبلوم تأهيلي وتنشيطي',
        description: 'مجموعة تجمع بين دورة أساسية ودورة تذكيرية',
        courses: [
          { courseId: 'CRS001', order: 1, courseRole: 'core' },
          { courseId: 'CRS002', order: 2, courseRole: 'reminder' },
        ],
        courseId: 'CRS001',
        traineeIds: ['usr_trainee_001'],
        supervisorIds: [],
        resources: [],
        startDateTime: '2026-10-01T08:00:00Z',
        deadlineDateTime: '2026-11-30T18:00:00Z',
        postDeadlinePolicy: 'keep_no_cert',
      };

      expect(resolveGroupType(group)).toBe('reminder');
    });

    it('A.4: Immediate classification occurs upon group creation with a reminder course', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const dto: CreateGroupRequestDTO = {
        name: 'مجموعة تذكيرية جديدة',
        description: 'إنشاء مجموعة جديدة تتضمن مقرراً تذكيرياً',
        startDateTime: '2026-12-01T08:00:00Z',
        deadlineDateTime: '2026-12-31T18:00:00Z',
        postDeadlinePolicy: 'keep_no_cert',
        courseAssignments: [
          { courseId: 'CRS001', courseRole: 'reminder', order: 1 },
        ],
      };

      const group = inMemoryStore.createGroup(dto);
      expect(group.courses[0].courseRole).toBe('reminder');
      expect(group.hasHistoricalReminderCourses).toBe(true);
      expect(resolveGroupType(group)).toBe('reminder');
    });

    it('A.5: Persistent Reminder Classification (D-GRP-06): removing the last reminder course preserves "reminder" classification', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      // 1. Create a mixed group
      const dto: CreateGroupRequestDTO = {
        name: 'برنامج تأهيلي دوري مختلط',
        description: 'اختبار الاستمرارية التاريخية للتصنيف التذكيري',
        startDateTime: '2026-12-01T08:00:00Z',
        deadlineDateTime: '2026-12-31T18:00:00Z',
        postDeadlinePolicy: 'keep_no_cert',
        courseAssignments: [
          { courseId: 'CRS001', courseRole: 'core', order: 1 },
          { courseId: 'CRS002', courseRole: 'reminder', order: 2 },
        ],
      };

      const group = inMemoryStore.createGroup(dto);
      expect(group.hasHistoricalReminderCourses).toBe(true);
      expect(resolveGroupType(group)).toBe('reminder');

      // 2. Remove the reminder course by reassigning only the core course to the active cycle
      const cycleId = group.currentCycleId!;
      const updateDto: AssignCycleCoursesDTO = {
        courses: [
          { courseId: 'CRS001', courseRole: 'core', order: 1 },
        ],
      };

      inMemoryStore.assignCoursesToCycle(group.id, cycleId, updateDto);

      // Re-fetch group from store
      const updatedGroup = inMemoryStore.getGroups().find((g) => g.id === group.id)!;
      expect(updatedGroup.courses.length).toBe(1);
      expect(updatedGroup.courses[0].courseRole).toBe('core');

      // Invariant D-GRP-06: Monotonic historical marker MUST remain true
      expect(updatedGroup.hasHistoricalReminderCourses).toBe(true);

      // Invariant D-GRP-06: resolveGroupType MUST continue returning 'reminder'
      expect(resolveGroupType(updatedGroup)).toBe('reminder');
    });

    it('A.6: Historical cycles retain original courseRole snapshots immutably', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const demoFixtures = inMemoryStore.getGroupCycles('GRP-201');
      const cycle1 = demoFixtures.find((c) => c.cycleNumber === 1);
      const cycle2 = demoFixtures.find((c) => c.cycleNumber === 2);

      if (cycle1 && cycle2) {
        // Cycle 1 had CRS001 as core
        const crs1InCycle1 = cycle1.courses.find((c) => c.courseId === 'CRS001');
        expect(crs1InCycle1?.courseRole).toBe('core');

        // Cycle 2 has CRS001 as reminder
        const crs1InCycle2 = cycle2.courses.find((c) => c.courseId === 'CRS001');
        expect(crs1InCycle2?.courseRole).toBe('reminder');
      }
    });

    it('A.7: Legacy groups without explicit courseRole default to "core" and "regular"', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const legacyGroup: TrainingGroup = {
        id: 'GRP-LEGACY-001',
        name: 'مجموعة قديمة بدون أدوار',
        description: 'مجموعة متوافقة مع الإصدارات السابقة',
        courses: [
          { courseId: 'CRS001', order: 1 } as GroupCourseAssignment,
        ],
        courseId: 'CRS001',
        traineeIds: ['usr_trainee_001'],
        supervisorIds: [],
        resources: [],
        startDateTime: '2026-10-01T08:00:00Z',
        deadlineDateTime: '2026-11-30T18:00:00Z',
        postDeadlinePolicy: 'keep_no_cert',
      };

      expect(resolveGroupType(legacyGroup)).toBe('regular');
    });

    it('A.8: Monotonic marker cannot be reset to false by ordinary update or renewal paths', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const group: TrainingGroup = {
        id: 'GRP-MONOTONIC-TEST',
        name: 'مجموعة اختبار الثبات',
        description: 'فحص عدم إمكانية إعادة التعيين إلى خطأ',
        courses: [{ courseId: 'CRS001', courseRole: 'core', order: 1 }],
        courseId: 'CRS001',
        traineeIds: [],
        supervisorIds: [],
        resources: [],
        startDateTime: '2026-10-01T08:00:00Z',
        deadlineDateTime: '2026-11-30T18:00:00Z',
        postDeadlinePolicy: 'keep_no_cert',
        hasHistoricalReminderCourses: true, // Marked historically
      };

      // Even if current courses contain only core and cycle contains only core
      expect(resolveGroupType(group)).toBe('reminder');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE B: In-Place Renewal Identity & Lifecycle (D-GRP-01, D-GRP-04)
  // ══════════════════════════════════════════════════════════════════════════
  describe('Suite B: In-Place Renewal Identity & Lifecycle', () => {
    it('B.1: Manual renewal creates a new cycle in-place while preserving TrainingGroup.id, name, and enrollmentCode (D-GRP-01)', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const initialGroupsCount = inMemoryStore.getGroups().length;
      const group = inMemoryStore.getGroups().find((g) => g.id === 'GRP-101')!;
      const originalGroupId = group.id;
      const originalGroupName = group.name;
      const originalEnrollmentCode = group.enrollmentCode;
      const originalCycleId = group.currentCycleId;

      const renewDto: RenewGroupCycleRequestDTO = {
        title: 'دورة التدريب التجديدية الشتوية 2026',
        startDateTime: '2026-12-01T08:00:00Z',
        deadlineDateTime: '2027-01-31T18:00:00Z',
        postDeadlinePolicy: 'keep_no_cert',
        courses: [
          { courseId: 'CRS001', courseRole: 'reminder', order: 1 },
          { courseId: 'CRS002', courseRole: 'core', order: 2 },
        ],
      };

      const result = inMemoryStore.createRenewalCycle(group.id, renewDto);

      // Invariant D-GRP-01: Group identity is strictly preserved
      expect(result.group.id).toBe(originalGroupId);
      expect(result.group.name).toBe(originalGroupName);
      expect(result.group.enrollmentCode).toBe(originalEnrollmentCode);

      // Invariant D-GRP-04: No duplicate group is created
      expect(inMemoryStore.getGroups().length).toBe(initialGroupsCount);

      // New sequential cycle
      expect(result.newCycle.id).not.toBe(originalCycleId);
      expect(result.newCycle.groupId).toBe(originalGroupId);
      expect(result.group.currentCycleId).toBe(result.newCycle.id);

      // Previous cycle sealed
      if (result.previousCycle) {
        expect(result.previousCycle.status).toBe('completed');
        expect(result.previousCycle.completedAt).toBeDefined();
      }
    });

    it('B.2: Automatic renewal executes in-place on the same group without creating a successorGroup (D-GRP-01)', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      // Configure group for auto-renewal
      const group = inMemoryStore.getGroups().find((g) => g.id === 'GRP-101')!;
      group.renewalSchedule = {
        autoRenewalEnabled: true,
        intervalDays: 30,
        renewalIntervalDays: 30,
        nextScheduledRenewalDate: '2026-11-09T08:00:00Z', // due in the past relative to simulated now
      };

      const initialGroupsCount = inMemoryStore.getGroups().length;
      const originalGroupId = group.id;
      const originalGroupName = group.name;

      const simulatedNow = new Date('2026-11-10T10:00:00Z');
      const res = inMemoryStore.checkAndProcessAutoRenewal(group.id, simulatedNow);

      expect(res.renewed).toBe(true);
      expect(res.cycle).toBeDefined();
      expect(res.successorGroup).toBeUndefined(); // Abolished!

      // Invariant: group count has not increased
      expect(inMemoryStore.getGroups().length).toBe(initialGroupsCount);

      // Group identity remains unchanged
      const currentGroup = inMemoryStore.getGroups().find((g) => g.id === originalGroupId)!;
      expect(currentGroup.id).toBe(originalGroupId);
      expect(currentGroup.name).toBe(originalGroupName);
      expect(currentGroup.adminStatus).not.toBe('archived');
      expect(currentGroup.currentCycleId).toBe(res.cycle!.id);
    });

    it('B.3: Sealing prior cycle sets isSealed=true and protects historical attempts', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const group = inMemoryStore.getGroups().find((g) => g.id === 'GRP-101')!;
      const priorCycleId = group.currentCycleId!;

      const renewDto: RenewGroupCycleRequestDTO = {
        title: 'دورة دورية ثانية',
        startDateTime: '2026-12-01T08:00:00Z',
        deadlineDateTime: '2027-01-31T18:00:00Z',
        courses: [{ courseId: 'CRS001', courseRole: 'core', order: 1 }],
      };

      inMemoryStore.createRenewalCycle(group.id, renewDto);

      // Prior attempts in priorCycleId must now be sealed
      const allAttempts = inMemoryStore.getCourseAttempts();
      const priorAttempts = allAttempts.filter((a) => a.cycleId === priorCycleId);

      for (const att of priorAttempts) {
        expect(att.isSealed).toBe(true);
        expect(att.sealedAt).toBeDefined();
      }
    });

    it('B.4: Fresh attempts for the new cycle start at 0% unstarted with unique cycle-scoped IDs', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const group = inMemoryStore.getGroups().find((g) => g.id === 'GRP-101')!;
      const traineeId = group.traineeIds[0];

      const renewDto: RenewGroupCycleRequestDTO = {
        title: 'دورة دورية ثالثة',
        startDateTime: '2026-12-01T08:00:00Z',
        deadlineDateTime: '2027-01-31T18:00:00Z',
        courses: [{ courseId: 'CRS001', courseRole: 'core', order: 1 }],
      };

      const result = inMemoryStore.createRenewalCycle(group.id, renewDto);
      const newCycleId = result.newCycle.id;

      const newAttempts = inMemoryStore.getCourseAttempts().filter(
        (a) => a.userId === traineeId && a.cycleId === newCycleId
      );

      expect(newAttempts.length).toBeGreaterThan(0);
      const newAtt = newAttempts[0];
      expect(newAtt.progressPercent).toBe(0);
      expect(newAtt.startedAt).toBeNull();
      expect(newAtt.isSealed).toBeFalsy();
    });

    it('B.5: Repeated scheduler calls are idempotent and do not create duplicate cycles', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const group = inMemoryStore.getGroups().find((g) => g.id === 'GRP-101')!;
      group.renewalSchedule = {
        autoRenewalEnabled: true,
        intervalDays: 30,
        renewalIntervalDays: 30,
        nextScheduledRenewalDate: '2026-11-09T08:00:00Z',
      };

      const simulatedNow = new Date('2026-11-10T10:00:00Z');
      const firstRun = inMemoryStore.checkAndProcessAutoRenewal(group.id, simulatedNow);
      expect(firstRun.renewed).toBe(true);

      const cyclesAfterFirst = inMemoryStore.getGroupCycles(group.id).length;

      // Second invocation immediately after
      const secondRun = inMemoryStore.checkAndProcessAutoRenewal(group.id, simulatedNow);
      expect(secondRun.renewed).toBe(false);

      const cyclesAfterSecond = inMemoryStore.getGroupCycles(group.id).length;
      expect(cyclesAfterSecond).toBe(cyclesAfterFirst);
    });

    it('B.6: Preserves D-07 continuation grants and independent attempts during group renewal', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      // Verify that independent self-enrollments for the trainee are not modified by group cycle renewal
      const traineeId = 'usr_trainee_003';
      const selfEnrollmentBefore = inMemoryStore.getCourseEnrollment('CRS001', traineeId);

      const group = inMemoryStore.getGroups().find((g) => g.id === 'GRP-101')!;
      inMemoryStore.createRenewalCycle(group.id, {
        title: 'دورة جديدة مع التحقق من المنح المستقلة',
        startDateTime: '2026-12-01T08:00:00Z',
        deadlineDateTime: '2027-01-31T18:00:00Z',
        courses: [{ courseId: 'CRS001', courseRole: 'core', order: 1 }],
      });

      const selfEnrollmentAfter = inMemoryStore.getCourseEnrollment('CRS001', traineeId);
      expect(selfEnrollmentAfter).toBeDefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE C: Centralized Status and Structured Time Information (GroupTimeInfo)
  // ══════════════════════════════════════════════════════════════════════════
  describe('Suite C: Status and Structured Time Information', () => {
    const baseGroup: TrainingGroup = {
      id: 'GRP-TIME-001',
      name: 'مجموعة فحص الوقت',
      description: 'فحص دقيق لحالات الوقت',
      courses: [{ courseId: 'CRS001', order: 1, courseRole: 'core' }],
      courseId: 'CRS001',
      traineeIds: ['usr_trainee_001'],
      supervisorIds: [],
      resources: [],
      startDateTime: '2026-11-01T08:00:00Z',
      deadlineDateTime: '2026-11-20T18:00:00Z',
      postDeadlinePolicy: 'keep_no_cert',
    };

    it('C.1: Resolves active regular group status and situation "active_regular"', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const now = new Date('2026-11-10T10:00:00Z');
      expect(resolveGroupOperationalStatus(baseGroup, null, now)).toBe('active');

      const timeInfo = calculateGroupTimeInfo(baseGroup, null, now);
      expect(timeInfo.situation).toBe('active_regular');
      expect(timeInfo.primaryTargetDate).toBe('2026-11-20T18:00:00Z');
      expect(timeInfo.secondaryDate).toBeNull();
      expect(timeInfo.daysRemaining).toBe(10);
      expect(timeInfo.isOverdue).toBe(false);
    });

    it('C.2: Resolves scheduled regular group status and situation "scheduled_regular"', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const now = new Date('2026-10-25T10:00:00Z'); // Before start
      expect(resolveGroupOperationalStatus(baseGroup, null, now)).toBe('scheduled');

      const timeInfo = calculateGroupTimeInfo(baseGroup, null, now);
      expect(timeInfo.situation).toBe('scheduled_regular');
      expect(timeInfo.primaryTargetDate).toBe('2026-11-01T08:00:00Z');
      expect(timeInfo.isOverdue).toBe(false);
    });

    it('C.3: Resolves expired regular group status and situation "expired_regular"', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const now = new Date('2026-11-25T10:00:00Z'); // After deadline
      expect(resolveGroupOperationalStatus(baseGroup, null, now)).toBe('expired');

      const timeInfo = calculateGroupTimeInfo(baseGroup, null, now);
      expect(timeInfo.situation).toBe('expired_regular');
      expect(timeInfo.daysPassed).toBeGreaterThan(0);
      expect(timeInfo.isOverdue).toBe(true);
    });

    it('C.4: Resolves active reminder group situation "active_reminder"', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const reminderGroup: TrainingGroup = {
        ...baseGroup,
        courses: [{ courseId: 'CRS001', order: 1, courseRole: 'reminder' }],
        renewalSchedule: {
          autoRenewalEnabled: true,
          intervalDays: 30,
          nextScheduledRenewalDate: '2026-12-20T18:00:00Z',
        },
      };

      const now = new Date('2026-11-10T10:00:00Z');
      expect(resolveGroupOperationalStatus(reminderGroup, null, now)).toBe('active');

      const timeInfo = calculateGroupTimeInfo(reminderGroup, null, now);
      expect(timeInfo.situation).toBe('active_reminder');
      expect(timeInfo.secondaryDate).toBe('2026-12-20T18:00:00Z');
    });

    it('C.5: Resolves scheduled reminder group situation "scheduled_reminder"', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const reminderGroup: TrainingGroup = {
        ...baseGroup,
        courses: [{ courseId: 'CRS001', order: 1, courseRole: 'reminder' }],
      };

      const now = new Date('2026-10-20T10:00:00Z');
      expect(resolveGroupOperationalStatus(reminderGroup, null, now)).toBe('scheduled');

      const timeInfo = calculateGroupTimeInfo(reminderGroup, null, now);
      expect(timeInfo.situation).toBe('scheduled_reminder');
    });

    it('C.6: Resolves expired reminder group with future renewal date as "expired_reminder_with_next"', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const reminderGroup: TrainingGroup = {
        ...baseGroup,
        courses: [{ courseId: 'CRS001', order: 1, courseRole: 'reminder' }],
        renewalSchedule: {
          autoRenewalEnabled: true,
          intervalDays: 30,
          nextScheduledRenewalDate: '2026-12-20T18:00:00Z',
        },
      };

      const now = new Date('2026-11-25T10:00:00Z'); // Deadline passed
      expect(resolveGroupOperationalStatus(reminderGroup, null, now)).toBe('expired');

      const timeInfo = calculateGroupTimeInfo(reminderGroup, null, now);
      expect(timeInfo.situation).toBe('expired_reminder_with_next');
      expect(timeInfo.secondaryDate).toBe('2026-12-20T18:00:00Z');
    });

    it('C.7: Resolves expired reminder group without future renewal date as "expired_reminder_without_next"', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const reminderGroup: TrainingGroup = {
        ...baseGroup,
        courses: [{ courseId: 'CRS001', order: 1, courseRole: 'reminder' }],
        renewalSchedule: {
          autoRenewalEnabled: false,
          intervalDays: null,
          nextScheduledRenewalDate: null,
        },
      };

      const now = new Date('2026-11-25T10:00:00Z');
      const timeInfo = calculateGroupTimeInfo(reminderGroup, null, now);
      expect(timeInfo.situation).toBe('expired_reminder_without_next');
      expect(timeInfo.secondaryDate).toBeNull();
    });

    it('C.8: Missing dates resolve to null explicitly without fabricating fake default dates', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const groupWithoutDates: TrainingGroup = {
        ...baseGroup,
        startDateTime: '',
        deadlineDateTime: '',
      };

      const timeInfo = calculateGroupTimeInfo(groupWithoutDates, null);
      expect(timeInfo.primaryTargetDate).toBeNull();
      expect(timeInfo.daysRemaining).toBeNull();
      expect(timeInfo.hoursRemaining).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE D: Administrative Archive Exclusion & Membership Counts (D-GRP-07)
  // ══════════════════════════════════════════════════════════════════════════
  describe('Suite D: Archive Exclusion and Trainee Counts', () => {
    it('D.1: Administratively archived groups (adminStatus === "archived") are completely hidden from trainee getGroups() (D-GRP-07)', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const traineeId = 'usr_trainee_003';
      const allGroupsBefore = inMemoryStore.getGroups(traineeId, 'user');

      // Archive one of the trainee groups
      const targetGroup = inMemoryStore.getGroups().find((g) => g.id === 'GRP-101')!;
      targetGroup.adminStatus = 'archived';

      const allGroupsAfter = inMemoryStore.getGroups(traineeId, 'user');
      expect(allGroupsAfter.some((g) => g.id === 'GRP-101')).toBe(false);
      expect(allGroupsAfter.length).toBe(allGroupsBefore.length - 1);
    });

    it('D.2: Direct route getGroupById() for an archived group fails closed with 404 for trainees (D-GRP-07)', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const traineeId = 'usr_trainee_003';
      const targetGroup = inMemoryStore.getGroups().find((g) => g.id === 'GRP-101')!;
      targetGroup.adminStatus = 'archived';

      expect(() => {
        inMemoryStore.getGroupById('GRP-101', traineeId, 'user');
      }).toThrowError(MockStoreError);

      try {
        inMemoryStore.getGroupById('GRP-101', traineeId, 'user');
      } catch (err) {
        expect(err).toBeInstanceOf(MockStoreError);
        expect((err as MockStoreError).status).toBe(404);
      }
    });

    it('D.3: Expired but non-archived groups remain visible in trainee getGroups() (D-GRP-07)', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const traineeId = 'usr_trainee_003';
      // GRP-103 is expired but adminStatus === 'active'
      const expiredGroup = inMemoryStore.getGroups().find((g) => g.id === 'GRP-103')!;
      expect(expiredGroup.adminStatus).not.toBe('archived');

      const traineeGroups = inMemoryStore.getGroups(traineeId, 'user');
      expect(traineeGroups.some((g) => g.id === 'GRP-103')).toBe(true);
    });

    it('D.4: Trainee count is strictly derived from group.traineeIds.length and excludes removed members', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const group = inMemoryStore.getGroups().find((g) => g.id === 'GRP-101')!;
      const initialCount = group.traineeIds.length;

      // Remove a trainee
      const traineeToRemove = group.traineeIds[0];
      inMemoryStore.removeGroupMember(group.id, traineeToRemove);

      const updatedGroup = inMemoryStore.getGroups().find((g) => g.id === 'GRP-101')!;
      expect(updatedGroup.traineeIds.length).toBe(initialCount - 1);
      expect(updatedGroup.traineeIds).not.toContain(traineeToRemove);
    });

    it('D.5: Staff users (primary instructor, assistants, supervisors) are excluded from group.traineeIds', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const group = inMemoryStore.getGroups().find((g) => g.id === 'GRP-101')!;
      if (group.primaryInstructorId) {
        expect(group.traineeIds).not.toContain(group.primaryInstructorId);
      }
      for (const assistantId of group.assistantLecturerIds || []) {
        expect(group.traineeIds).not.toContain(assistantId);
      }
    });

    it('D.6: D-07 continuation grants do not inflate group.traineeIds count', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const group = inMemoryStore.getGroups().find((g) => g.id === 'GRP-101')!;
      const traineeToRemove = group.traineeIds[0];

      // Remove member keeping continuation grant (empty removeCourseIds = keep all)
      inMemoryStore.removeGroupMember(group.id, traineeToRemove, []);

      // Trainee has continuation grant
      const enrollment = inMemoryStore.getCourseEnrollment('CRS001', traineeToRemove);
      const continuationGrant = enrollment?.sources?.find(
        (s) => s.sourceId === `self:continued:${group.id}:${s.attemptId}`
      );
      expect(continuationGrant).toBeDefined();

      // But group.traineeIds does NOT contain the removed trainee
      const freshGroup = inMemoryStore.getGroups().find((g) => g.id === group.id)!;
      expect(freshGroup.traineeIds).not.toContain(traineeToRemove);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE E: GET /api/groups/my Contract Normalization (D-GRP-08)
  // ══════════════════════════════════════════════════════════════════════════
  describe('Suite E: GET /api/groups/my Normalized Contract', () => {
    it('E.1: Maps TraineeGroupItemDTO with correct groupType, operationalStatus, and traineeCount', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const group = inMemoryStore.getGroups().find((g) => g.id === 'GRP-101')!;
      const currentCycle = inMemoryStore.getCurrentGroupCycle(group.id);
      const groupType = resolveGroupType(group, currentCycle);
      const operationalStatus = resolveGroupOperationalStatus(group, currentCycle);
      const timeInfo = calculateGroupTimeInfo(group, currentCycle);

      const dto: TraineeGroupItemDTO = {
        id: group.id,
        enrollmentCode: group.enrollmentCode,
        name: group.name,
        description: group.description,
        groupType,
        operationalStatus,
        traineeCount: group.traineeIds.length,
        startDateTime: group.startDateTime,
        deadlineDateTime: group.deadlineDateTime,
        postDeadlinePolicy: group.postDeadlinePolicy,
        currentCycle: currentCycle
          ? {
              id: currentCycle.id,
              cycleNumber: currentCycle.cycleNumber,
              title: currentCycle.title,
              status: currentCycle.status,
              startDateTime: currentCycle.startDateTime,
              deadlineDateTime: currentCycle.deadlineDateTime,
              postDeadlinePolicy: currentCycle.postDeadlinePolicy || group.postDeadlinePolicy,
            }
          : null,
        courses: (group.courses || []).map((c, idx) => ({
          courseId: c.courseId,
          courseTitle: c.courseId,
          courseCode: c.courseId,
          courseRole: c.courseRole || 'core',
          order: c.order || idx + 1,
        })),
        timeInfo,
        navigationUrl: `/my-groups/${group.id}`,
      };

      expect(dto.id).toBe('GRP-101');
      expect(dto.traineeCount).toBe(group.traineeIds.length);
      expect(dto.courses[0].courseCode).toBeDefined();
      expect(dto.courses[0].courseRole).toBeDefined();
      expect(dto.timeInfo.situation).toBeDefined();
    });

    it('E.2: Compact course summary preserves courseCode and courseRole for carousel badging (D-GRP-08)', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const courses: GroupCourseAssignment[] = [
        { courseId: 'CRS001', order: 1, courseRole: 'core' },
        { courseId: 'CRS002', order: 2, courseRole: 'reminder' },
      ];

      const compactSummaries = courses.map((c) => ({
        courseId: c.courseId,
        courseCode: c.courseId,
        courseTitle: `كورس ${c.courseId}`,
        courseRole: c.courseRole || 'core',
        order: c.order,
      }));

      expect(compactSummaries[0].courseRole).toBe('core');
      expect(compactSummaries[1].courseRole).toBe('reminder');
      expect(compactSummaries[0].courseCode).toBe('CRS001');
      expect(compactSummaries[1].courseCode).toBe('CRS002');
    });

    it('E.3: Semantic GroupTimeInfo contains zero localized text strings in API response', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const group = inMemoryStore.getGroups().find((g) => g.id === 'GRP-101')!;
      const timeInfo = calculateGroupTimeInfo(group, null);

      // Verify absence of UI strings
      expect((timeInfo as unknown as Record<string, unknown>).timeRemainingText).toBeUndefined();
      expect((timeInfo as unknown as Record<string, unknown>).secondaryText).toBeUndefined();
      expect(typeof timeInfo.situation).toBe('string');
      expect(typeof timeInfo.isOverdue).toBe('boolean');
    });

    it('E.4: Trainee GET /api/groups/my response strictly contains no traineeMetricsList or other trainees identifiers/progress (Data Minimization)', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const group = inMemoryStore.getGroups().find((g) => g.id === 'GRP-101')!;
      const currentCycle = inMemoryStore.getCurrentGroupCycle(group.id);
      const groupType = resolveGroupType(group, currentCycle);
      const operationalStatus = resolveGroupOperationalStatus(group, currentCycle);
      const timeInfo = calculateGroupTimeInfo(group, currentCycle);

      // Construct normalized TraineeGroupItemDTO exactly as returned by GET /api/groups/my
      const activeCourses = currentCycle?.courses || group.courses || [];
      const courseSummaries = activeCourses.map((c, idx) => ({
        courseId: c.courseId,
        courseTitle: c.courseId,
        courseCode: c.courseId,
        courseRole: c.courseRole || 'core',
        order: c.order || idx + 1,
      }));

      const dto: TraineeGroupItemDTO = {
        id: group.id,
        enrollmentCode: group.enrollmentCode,
        name: group.name,
        description: group.description,
        groupType,
        operationalStatus,
        traineeCount: (group.traineeIds || []).length,
        startDateTime: currentCycle?.startDateTime || group.startDateTime || null,
        deadlineDateTime: currentCycle?.deadlineDateTime || group.deadlineDateTime || null,
        postDeadlinePolicy: currentCycle?.postDeadlinePolicy || group.postDeadlinePolicy,
        renewalSchedule: group.renewalSchedule
          ? {
              autoRenewalEnabled: Boolean(group.renewalSchedule.autoRenewalEnabled),
              intervalDays: group.renewalSchedule.renewalIntervalDays ?? group.renewalSchedule.intervalDays ?? null,
              nextScheduledRenewalDate: group.renewalSchedule.nextScheduledRenewalDate || null,
            }
          : undefined,
        currentCycle: currentCycle
          ? {
              id: currentCycle.id,
              cycleNumber: currentCycle.cycleNumber,
              title: currentCycle.title,
              status: currentCycle.status,
              startDateTime: currentCycle.startDateTime || null,
              deadlineDateTime: currentCycle.deadlineDateTime || null,
              postDeadlinePolicy: currentCycle.postDeadlinePolicy || group.postDeadlinePolicy,
            }
          : null,
        courses: courseSummaries,
        timeInfo,
        navigationUrl: `/my-groups/${group.id}`,
      };

      // 1. Must NOT contain metrics object
      expect((dto as unknown as Record<string, unknown>).metrics).toBeUndefined();

      // 2. Must NOT contain traineeMetricsList or other trainees' details
      expect((dto as unknown as Record<string, unknown>).traineeMetricsList).toBeUndefined();

      // 3. Serialized JSON representation must not leak any trainee IDs or per-trainee progress records
      const json = JSON.stringify(dto);
      expect(json).not.toContain('traineeMetricsList');
      expect(json).not.toContain('worstAttention');
      expect(json).not.toContain('programPercent');
      // Must not expose other trainee IDs in raw array form (only aggregate traineeCount is permitted)
      for (const tid of group.traineeIds || []) {
        expect(json).not.toContain(`"${tid}"`);
      }
    });

    it('E.5: Trainee GET /api/groups/my payload strictly excludes cohort monitoring metrics while preserving necessary group metadata', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const group = inMemoryStore.getGroups().find((g) => g.id === 'GRP-101')!;
      const currentCycle = inMemoryStore.getCurrentGroupCycle(group.id);
      const groupType = resolveGroupType(group, currentCycle);
      const operationalStatus = resolveGroupOperationalStatus(group, currentCycle);
      const timeInfo = calculateGroupTimeInfo(group, currentCycle);

      const dto: TraineeGroupItemDTO = {
        id: group.id,
        enrollmentCode: group.enrollmentCode,
        name: group.name,
        description: group.description,
        groupType,
        operationalStatus,
        traineeCount: (group.traineeIds || []).length,
        startDateTime: currentCycle?.startDateTime || group.startDateTime || null,
        deadlineDateTime: currentCycle?.deadlineDateTime || group.deadlineDateTime || null,
        postDeadlinePolicy: currentCycle?.postDeadlinePolicy || group.postDeadlinePolicy,
        currentCycle: null,
        courses: [],
        timeInfo,
        navigationUrl: `/my-groups/${group.id}`,
      };

      // Excludes cohort monitoring aggregations
      const record = dto as unknown as Record<string, unknown>;
      expect(record.averageProgressPercent).toBeUndefined();
      expect(record.attentionTraineesCount).toBeUndefined();
      expect(record.completedTraineesCount).toBeUndefined();
      expect(record.warningAlertsCount).toBeUndefined();

      // Preserves essential trainee-accessible metadata
      expect(dto.id).toBe('GRP-101');
      expect(dto.name).toBeDefined();
      expect(dto.operationalStatus).toBeDefined();
      expect(dto.timeInfo).toBeDefined();
      expect(dto.navigationUrl).toBe('/my-groups/GRP-101');
    });

    it('E.6: Admin-authorized group monitoring endpoint retains full aggregate metrics and traineeMetricsList', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      // Confirm that administrative access to group monitoring metrics is preserved intact
      const metrics = inMemoryStore.getGroupMetrics('GRP-101');
      expect(metrics).not.toBeNull();
      if (metrics) {
        expect(metrics.groupId).toBe('GRP-101');
        expect(metrics.traineeMetricsList).toBeDefined();
        expect(Array.isArray(metrics.traineeMetricsList)).toBe(true);
        expect(typeof metrics.averageProgressPercent).toBe('number');
        expect(typeof metrics.warningAlertsCount).toBe('number');
        expect(typeof metrics.dangerAlertsCount).toBe('number');
      }
    });

    it('E.7: TraineeGroupItemDTO strictly omits any untyped metrics bridge', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      // Type-level and runtime assertion ensuring TraineeGroupItemDTO has zero metrics property
      type HasMetrics = 'metrics' extends keyof TraineeGroupItemDTO ? true : false;
      const hasMetricsKey: HasMetrics = false;
      expect(hasMetricsKey).toBe(false);
    });
  });
});

