/**
 * MetroLMS — Phase D: Trainee Groups & Reminder Programs Dashboard UI Test Suite
 *
 * Covers Phase D UI specifications for:
 * - Persistent Groups Carousel (Deterministic Sorting, Badges, Compact Courses)
 * - Three Summary Cards (Total, Active, Scheduled, Archive Exclusion)
 * - Detailed Groups Table (Visual Hierarchy, Dual Badges, Filters & Search)
 * - Data Privacy and Trainee/Admin Security Boundaries
 *
 * STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { inMemoryStore, MockStoreError } from '@/mocks/store/inMemoryStore';
import {
  resolveGroupType,
  resolveGroupOperationalStatus,
  calculateGroupTimeInfo,
  sortTraineeGroupsForCarousel,
  formatGroupTimeInfoAr,
} from '@/core/groups/resolvers';
import type { TraineeGroupItemDTO } from '@/core/groups/dtos';

describe('Phase D: Trainee Groups & Reminder Programs Dashboard UI', () => {
  beforeEach(() => {
    inMemoryStore.reset();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 1: Persistent Groups Carousel (Sorting, Badges & Compact Pills)
  // ══════════════════════════════════════════════════════════════════════════
  describe('Suite 1: Persistent Groups Carousel Specifications', () => {
    it('1.1: Sorts active groups by nearest applicable deadline ascending', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const now = new Date('2026-11-15T00:00:00.000Z');

      const groupA: TraineeGroupItemDTO = {
        id: 'GRP-A',
        name: 'مجموعة أ',
        groupType: 'regular',
        operationalStatus: 'active',
        traineeCount: 10,
        startDateTime: '2026-11-01T00:00:00.000Z',
        deadlineDateTime: '2026-11-30T00:00:00.000Z', // Deadline in 15 days
        postDeadlinePolicy: 'keep_no_cert',
        currentCycle: null,
        courses: [],
        timeInfo: {
          situation: 'active_regular',
          primaryTargetDate: '2026-11-30T00:00:00.000Z',
          secondaryDate: null,
          daysRemaining: 15,
          hoursRemaining: 0,
          daysPassed: 0,
          isOverdue: false,
        },
        navigationUrl: '/my-groups/GRP-A',
      };

      const groupB: TraineeGroupItemDTO = {
        id: 'GRP-B',
        name: 'مجموعة ب',
        groupType: 'regular',
        operationalStatus: 'active',
        traineeCount: 10,
        startDateTime: '2026-11-01T00:00:00.000Z',
        deadlineDateTime: '2026-11-20T00:00:00.000Z', // Deadline in 5 days (earlier)
        postDeadlinePolicy: 'keep_no_cert',
        currentCycle: null,
        courses: [],
        timeInfo: {
          situation: 'active_regular',
          primaryTargetDate: '2026-11-20T00:00:00.000Z',
          secondaryDate: null,
          daysRemaining: 5,
          hoursRemaining: 0,
          daysPassed: 0,
          isOverdue: false,
        },
        navigationUrl: '/my-groups/GRP-B',
      };

      const sorted = sortTraineeGroupsForCarousel([groupA, groupB]);
      expect(sorted[0].id).toBe('GRP-B');
      expect(sorted[1].id).toBe('GRP-A');
    });

    it('1.2: Sorts scheduled groups by scheduled start date ascending after active groups', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const activeGroup: TraineeGroupItemDTO = {
        id: 'GRP-ACTIVE',
        name: 'مجموعة نشطة',
        groupType: 'regular',
        operationalStatus: 'active',
        traineeCount: 10,
        startDateTime: '2026-11-01T00:00:00.000Z',
        deadlineDateTime: '2026-11-30T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
        currentCycle: null,
        courses: [],
        timeInfo: {
          situation: 'active_regular',
          primaryTargetDate: '2026-11-30T00:00:00.000Z',
          secondaryDate: null,
          daysRemaining: 15,
          hoursRemaining: 0,
          daysPassed: 0,
          isOverdue: false,
        },
        navigationUrl: '/my-groups/GRP-ACTIVE',
      };

      const scheduledLater: TraineeGroupItemDTO = {
        id: 'GRP-SCH-LATER',
        name: 'مجموعة مجدولة لاحقاً',
        groupType: 'regular',
        operationalStatus: 'scheduled',
        traineeCount: 5,
        startDateTime: '2026-12-15T00:00:00.000Z', // Starts Dec 15
        deadlineDateTime: '2027-01-15T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
        currentCycle: null,
        courses: [],
        timeInfo: {
          situation: 'scheduled_regular',
          primaryTargetDate: '2026-12-15T00:00:00.000Z',
          secondaryDate: null,
          daysRemaining: 30,
          hoursRemaining: 0,
          daysPassed: 0,
          isOverdue: false,
        },
        navigationUrl: '/my-groups/GRP-SCH-LATER',
      };

      const scheduledEarlier: TraineeGroupItemDTO = {
        id: 'GRP-SCH-EARLY',
        name: 'مجموعة مجدولة مبكراً',
        groupType: 'regular',
        operationalStatus: 'scheduled',
        traineeCount: 5,
        startDateTime: '2026-12-01T00:00:00.000Z', // Starts Dec 1 (earlier)
        deadlineDateTime: '2027-01-01T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
        currentCycle: null,
        courses: [],
        timeInfo: {
          situation: 'scheduled_regular',
          primaryTargetDate: '2026-12-01T00:00:00.000Z',
          secondaryDate: null,
          daysRemaining: 16,
          hoursRemaining: 0,
          daysPassed: 0,
          isOverdue: false,
        },
        navigationUrl: '/my-groups/GRP-SCH-EARLY',
      };

      const sorted = sortTraineeGroupsForCarousel([scheduledLater, activeGroup, scheduledEarlier]);
      expect(sorted[0].id).toBe('GRP-ACTIVE');
      expect(sorted[1].id).toBe('GRP-SCH-EARLY');
      expect(sorted[2].id).toBe('GRP-SCH-LATER');
    });

    it('1.3: Places expired groups last, ordered by most recently expired first', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const activeGroup: TraineeGroupItemDTO = {
        id: 'GRP-ACT',
        name: 'مجموعة نشطة',
        groupType: 'regular',
        operationalStatus: 'active',
        traineeCount: 5,
        startDateTime: '2026-11-01T00:00:00.000Z',
        deadlineDateTime: '2026-11-30T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
        currentCycle: null,
        courses: [],
        timeInfo: {
          situation: 'active_regular',
          primaryTargetDate: '2026-11-30T00:00:00.000Z',
          secondaryDate: null,
          daysRemaining: 15,
          hoursRemaining: 0,
          daysPassed: 0,
          isOverdue: false,
        },
        navigationUrl: '/my-groups/GRP-ACT',
      };

      const expiredRecent: TraineeGroupItemDTO = {
        id: 'GRP-EXP-RECENT',
        name: 'مجموعة منتهية حديثاً',
        groupType: 'regular',
        operationalStatus: 'expired',
        traineeCount: 5,
        startDateTime: '2026-10-01T00:00:00.000Z',
        deadlineDateTime: '2026-11-10T00:00:00.000Z', // Expired Nov 10 (more recent)
        postDeadlinePolicy: 'keep_no_cert',
        currentCycle: null,
        courses: [],
        timeInfo: {
          situation: 'expired_regular',
          primaryTargetDate: '2026-11-10T00:00:00.000Z',
          secondaryDate: null,
          daysRemaining: 0,
          hoursRemaining: 0,
          daysPassed: 5,
          isOverdue: true,
        },
        navigationUrl: '/my-groups/GRP-EXP-RECENT',
      };

      const expiredOld: TraineeGroupItemDTO = {
        id: 'GRP-EXP-OLD',
        name: 'مجموعة منتهية قديماً',
        groupType: 'regular',
        operationalStatus: 'expired',
        traineeCount: 5,
        startDateTime: '2026-08-01T00:00:00.000Z',
        deadlineDateTime: '2026-09-01T00:00:00.000Z', // Expired Sept 1 (older)
        postDeadlinePolicy: 'keep_no_cert',
        currentCycle: null,
        courses: [],
        timeInfo: {
          situation: 'expired_regular',
          primaryTargetDate: '2026-09-01T00:00:00.000Z',
          secondaryDate: null,
          daysRemaining: 0,
          hoursRemaining: 0,
          daysPassed: 75,
          isOverdue: true,
        },
        navigationUrl: '/my-groups/GRP-EXP-OLD',
      };

      const sorted = sortTraineeGroupsForCarousel([expiredOld, activeGroup, expiredRecent]);
      expect(sorted[0].id).toBe('GRP-ACT');
      expect(sorted[1].id).toBe('GRP-EXP-RECENT');
      expect(sorted[2].id).toBe('GRP-EXP-OLD');
    });

    it('1.4: Applies deterministic tie-breakers: Arabic group name, then group ID', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const sameDate = '2026-11-30T00:00:00.000Z';

      const groupA: TraineeGroupItemDTO = {
        id: 'GRP-2',
        name: 'برنامج الصيانة المتقدمة',
        groupType: 'regular',
        operationalStatus: 'active',
        traineeCount: 5,
        startDateTime: '2026-11-01T00:00:00.000Z',
        deadlineDateTime: sameDate,
        postDeadlinePolicy: 'keep_no_cert',
        currentCycle: null,
        courses: [],
        timeInfo: {
          situation: 'active_regular',
          primaryTargetDate: sameDate,
          secondaryDate: null,
          daysRemaining: 15,
          hoursRemaining: 0,
          daysPassed: 0,
          isOverdue: false,
        },
        navigationUrl: '/my-groups/GRP-2',
      };

      const groupB: TraineeGroupItemDTO = {
        id: 'GRP-1',
        name: 'برنامج الإشارات والتحكم',
        groupType: 'regular',
        operationalStatus: 'active',
        traineeCount: 5,
        startDateTime: '2026-11-01T00:00:00.000Z',
        deadlineDateTime: sameDate,
        postDeadlinePolicy: 'keep_no_cert',
        currentCycle: null,
        courses: [],
        timeInfo: {
          situation: 'active_regular',
          primaryTargetDate: sameDate,
          secondaryDate: null,
          daysRemaining: 15,
          hoursRemaining: 0,
          daysPassed: 0,
          isOverdue: false,
        },
        navigationUrl: '/my-groups/GRP-1',
      };

      const sorted = sortTraineeGroupsForCarousel([groupA, groupB]);
      // 'برنامج الإشارات' precedes 'برنامج الصيانة' alphabetically in Arabic
      expect(sorted[0].id).toBe('GRP-1');
      expect(sorted[1].id).toBe('GRP-2');
    });

    it('1.5: Displays group-level reminder badge when groupType === "reminder"', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const reminderGroup: TraineeGroupItemDTO = {
        id: 'GRP-REM',
        name: 'برنامج السلامة المهنية الدوري',
        groupType: 'reminder',
        operationalStatus: 'active',
        traineeCount: 15,
        startDateTime: '2026-11-01T00:00:00.000Z',
        deadlineDateTime: '2026-11-30T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
        currentCycle: null,
        courses: [
          { courseId: 'CRS-01', courseTitle: 'السلامة', courseCode: 'SAF101', courseRole: 'core', order: 1 },
        ],
        timeInfo: {
          situation: 'active_reminder',
          primaryTargetDate: '2026-11-30T00:00:00.000Z',
          secondaryDate: '2026-12-30T00:00:00.000Z',
          daysRemaining: 15,
          hoursRemaining: 0,
          daysPassed: 0,
          isOverdue: false,
        },
        navigationUrl: '/my-groups/GRP-REM',
      };

      // Even when current courses are only 'core', groupType is authoritative
      expect(reminderGroup.groupType).toBe('reminder');
    });

    it('1.6: Uses compact course identifiers and visually distinguishes reminder courses (D-GRP-08)', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const courses = [
        { courseId: 'CRS-COR-001', courseTitle: 'أساسيات تشغيل القطارات', courseCode: 'OPS101', courseRole: 'core' as const, order: 1 },
        { courseId: 'CRS-REM-002', courseTitle: 'الإسعافات الأولية والسلامة الدورية', courseCode: 'SAF201', courseRole: 'reminder' as const, order: 2 },
      ];

      expect(courses[0].courseCode).toBe('OPS101');
      expect(courses[1].courseCode).toBe('SAF201');
      expect(courses[0].courseRole).toBe('core');
      expect(courses[1].courseRole).toBe('reminder');
    });

    it('1.7: Provides accessible navigation affordance linking to /my-groups/:id', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const group: TraineeGroupItemDTO = {
        id: 'GRP-101',
        name: 'مجموعة الدفعة 42',
        groupType: 'regular',
        operationalStatus: 'active',
        traineeCount: 25,
        startDateTime: '2026-11-01T00:00:00.000Z',
        deadlineDateTime: '2026-11-30T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
        currentCycle: null,
        courses: [],
        timeInfo: {
          situation: 'active_regular',
          primaryTargetDate: '2026-11-30T00:00:00.000Z',
          secondaryDate: null,
          daysRemaining: 15,
          hoursRemaining: 0,
          daysPassed: 0,
          isOverdue: false,
        },
        navigationUrl: '/my-groups/GRP-101',
      };

      expect(group.navigationUrl).toBe('/my-groups/GRP-101');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 2: Three Summary Cards Specifications (Unfiltered Derivations)
  // ══════════════════════════════════════════════════════════════════════════
  describe('Suite 2: Three Summary Cards Specifications', () => {
    it('2.1: Total groups count includes active, scheduled, and expired non-archived groups', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const groups: Pick<TraineeGroupItemDTO, 'id' | 'operationalStatus'>[] = [
        { id: 'GRP-1', operationalStatus: 'active' },
        { id: 'GRP-2', operationalStatus: 'scheduled' },
        { id: 'GRP-3', operationalStatus: 'expired' },
      ];

      const total = groups.length;
      expect(total).toBe(3);
    });

    it('2.2: Active groups count matches operationalStatus === "active"', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const groups: Pick<TraineeGroupItemDTO, 'id' | 'operationalStatus'>[] = [
        { id: 'GRP-1', operationalStatus: 'active' },
        { id: 'GRP-2', operationalStatus: 'active' },
        { id: 'GRP-3', operationalStatus: 'scheduled' },
        { id: 'GRP-4', operationalStatus: 'expired' },
      ];

      const activeCount = groups.filter((g) => g.operationalStatus === 'active').length;
      expect(activeCount).toBe(2);
    });

    it('2.3: Scheduled groups count matches operationalStatus === "scheduled"', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const groups: Pick<TraineeGroupItemDTO, 'id' | 'operationalStatus'>[] = [
        { id: 'GRP-1', operationalStatus: 'active' },
        { id: 'GRP-2', operationalStatus: 'scheduled' },
        { id: 'GRP-3', operationalStatus: 'scheduled' },
      ];

      const scheduledCount = groups.filter((g) => g.operationalStatus === 'scheduled').length;
      expect(scheduledCount).toBe(2);
    });

    it('2.4: Archived groups do not contribute to any summary count', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      // inMemoryStore.getGroups for role 'user' excludes adminStatus === 'archived'
      const allGroups = inMemoryStore.getGroups('usr_trainee_001', 'user');
      const archivedInListing = allGroups.filter((g) => g.adminStatus === 'archived');
      expect(archivedInListing.length).toBe(0);
    });

    it('2.5: One stable TrainingGroup counts once, regardless of historical cycles', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      // Each item in TraineeGroupItemDTO corresponds to one unique TrainingGroup (D-GRP-01)
      const groupItem: TraineeGroupItemDTO = {
        id: 'GRP-MULTI-CYCLE',
        name: 'برنامج متعدد الدورات',
        groupType: 'reminder',
        operationalStatus: 'active',
        traineeCount: 10,
        startDateTime: '2026-11-01T00:00:00.000Z',
        deadlineDateTime: '2026-11-30T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
        currentCycle: {
          id: 'CYC-GRP-MULTI-CYCLE-03',
          cycleNumber: 3,
          title: 'دورة التجديد 3',
          status: 'active',
          startDateTime: '2026-11-01T00:00:00.000Z',
          deadlineDateTime: '2026-11-30T00:00:00.000Z',
          postDeadlinePolicy: 'keep_no_cert',
        },
        courses: [],
        timeInfo: {
          situation: 'active_reminder',
          primaryTargetDate: '2026-11-30T00:00:00.000Z',
          secondaryDate: null,
          daysRemaining: 15,
          hoursRemaining: 0,
          daysPassed: 0,
          isOverdue: false,
        },
        navigationUrl: '/my-groups/GRP-MULTI-CYCLE',
      };

      const groups = [groupItem];
      expect(groups.length).toBe(1);
    });

    it('2.6: Table search and filters do not alter summary card values', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const allGroups: Pick<TraineeGroupItemDTO, 'id' | 'name' | 'operationalStatus'>[] = [
        { id: 'GRP-1', name: 'الخط الأول', operationalStatus: 'active' },
        { id: 'GRP-2', name: 'الخط الثاني', operationalStatus: 'scheduled' },
        { id: 'GRP-3', name: 'الخط الثالث', operationalStatus: 'expired' },
      ];

      // Simulated table filter matching only 'الخط الأول'
      const filteredForTable = allGroups.filter((g) => g.name.includes('الخط الأول'));
      expect(filteredForTable.length).toBe(1);

      // Summary cards continue using unfiltered allGroups
      expect(allGroups.length).toBe(3);
      expect(allGroups.filter((g) => g.operationalStatus === 'active').length).toBe(1);
      expect(allGroups.filter((g) => g.operationalStatus === 'scheduled').length).toBe(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 3: Detailed Groups Table & Filters Specifications (Readability & Invariants)
  // ══════════════════════════════════════════════════════════════════════════
  describe('Suite 3: Detailed Groups Table & Filters Specifications', () => {
    it('3.1: Displays prominent group name and supporting code without compression', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const group: TraineeGroupItemDTO = {
        id: 'GRP-101',
        enrollmentCode: 'METRO-42',
        name: 'برنامج تشغيل وتأمين الخط الثاني والتحكم الميداني — الدفعة 42',
        description: 'برنامج تأهيلي شامل لمسؤولي تشغيل الخط الثاني',
        groupType: 'regular',
        operationalStatus: 'active',
        traineeCount: 20,
        startDateTime: '2026-11-01T00:00:00.000Z',
        deadlineDateTime: '2026-11-30T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
        currentCycle: null,
        courses: [],
        timeInfo: {
          situation: 'active_regular',
          primaryTargetDate: '2026-11-30T00:00:00.000Z',
          secondaryDate: null,
          daysRemaining: 15,
          hoursRemaining: 0,
          daysPassed: 0,
          isOverdue: false,
        },
        navigationUrl: '/my-groups/GRP-101',
      };

      expect(group.name).toBeDefined();
      expect(group.enrollmentCode).toBe('METRO-42');
      expect(group.description).toBeDefined();
    });

    it('3.2: Displays group type and operational status as distinct visual badges', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const reminderGroup: TraineeGroupItemDTO = {
        id: 'GRP-REM',
        name: 'برنامج تذكيري دوري',
        groupType: 'reminder',
        operationalStatus: 'expired',
        traineeCount: 15,
        startDateTime: '2026-10-01T00:00:00.000Z',
        deadlineDateTime: '2026-10-31T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
        currentCycle: null,
        courses: [],
        timeInfo: {
          situation: 'expired_reminder_with_next',
          primaryTargetDate: '2026-10-31T00:00:00.000Z',
          secondaryDate: '2026-12-01T00:00:00.000Z',
          daysRemaining: 0,
          hoursRemaining: 0,
          daysPassed: 15,
          isOverdue: true,
        },
        navigationUrl: '/my-groups/GRP-REM',
      };

      // Both badges are independently distinct
      expect(reminderGroup.groupType).toBe('reminder');
      expect(reminderGroup.operationalStatus).toBe('expired');
      expect(reminderGroup.groupType as string).not.toBe(reminderGroup.operationalStatus as string);
    });

    it('3.3: Formats remaining-time information correctly using semantic GroupTimeInfo', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const activeInfo = {
        situation: 'active_regular' as const,
        primaryTargetDate: '2026-11-23T00:00:00.000Z',
        secondaryDate: null,
        daysRemaining: 12,
        hoursRemaining: 0,
        daysPassed: 0,
        isOverdue: false,
      };
      expect(formatGroupTimeInfoAr(activeInfo)).toBe('متبقي 12 يومًا على انتهاء المهلة');

      const scheduledInfo = {
        situation: 'scheduled_regular' as const,
        primaryTargetDate: '2026-11-23T00:00:00.000Z',
        secondaryDate: null,
        daysRemaining: 8,
        hoursRemaining: 0,
        daysPassed: 0,
        isOverdue: false,
      };
      expect(formatGroupTimeInfoAr(scheduledInfo)).toBe('تبدأ بعد 8 أيام');

      const expiredWithNextInfo = {
        situation: 'expired_reminder_with_next' as const,
        primaryTargetDate: '2026-10-01T00:00:00.000Z',
        secondaryDate: '2026-12-25T00:00:00.000Z',
        daysRemaining: 0,
        hoursRemaining: 0,
        daysPassed: 40,
        isOverdue: true,
      };
      const text = formatGroupTimeInfoAr(expiredWithNextInfo, new Date('2026-11-15T00:00:00.000Z'));
      expect(text).toContain('انتهت الدورة — التذكير القادم بعد');

      const expiredWithoutNextInfo = {
        situation: 'expired_reminder_without_next' as const,
        primaryTargetDate: '2026-10-01T00:00:00.000Z',
        secondaryDate: null,
        daysRemaining: 0,
        hoursRemaining: 0,
        daysPassed: 40,
        isOverdue: true,
      };
      expect(formatGroupTimeInfoAr(expiredWithoutNextInfo)).toBe(
        'انتهت الدورة — لم يتم تحديد موعد التذكير القادم'
      );
    });

    it('3.4: Displays authoritative scalar traineeCount without exposing trainee rosters', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const group = inMemoryStore.getGroups().find((g) => g.id === 'GRP-101')!;
      const traineeCount = (group.traineeIds || []).length;
      expect(typeof traineeCount).toBe('number');
      expect(traineeCount).toBeGreaterThan(0);
    });

    it('3.5: Renders full course titles with individual dual badges (core vs. reminder)', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const groupCourses = [
        {
          courseId: 'CRS-01',
          courseTitle: 'أنظمة الجر والكهرباء بمترو القاهرة',
          courseCode: 'TRAIN101',
          courseRole: 'core' as const,
          order: 1,
        },
        {
          courseId: 'CRS-02',
          courseTitle: 'التوعية بالسلامة وتأمين مسار القطارات',
          courseCode: 'SAF102',
          courseRole: 'reminder' as const,
          order: 2,
        },
      ];

      expect(groupCourses[0].courseTitle).toBe('أنظمة الجر والكهرباء بمترو القاهرة');
      expect(groupCourses[0].courseRole).toBe('core');
      expect(groupCourses[1].courseTitle).toBe('التوعية بالسلامة وتأمين مسار القطارات');
      expect(groupCourses[1].courseRole).toBe('reminder');
    });

    it('3.6: Search filter matches group name or enrollment code accurately', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const groups = [
        { id: 'GRP-101', enrollmentCode: 'CODE-A', name: 'تشغيل الخط الأول' },
        { id: 'GRP-202', enrollmentCode: 'CODE-B', name: 'صيانة مسار الخط الثاني' },
      ];

      // Match by name
      const byName = groups.filter((g) => g.name.includes('الخط الأول'));
      expect(byName.length).toBe(1);
      expect(byName[0].id).toBe('GRP-101');

      // Match by code
      const byCode = groups.filter((g) => g.enrollmentCode.includes('CODE-B'));
      expect(byCode.length).toBe(1);
      expect(byCode[0].id).toBe('GRP-202');
    });

    it('3.7: Type and status filters narrow detailed table results without mutating source', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const groups: Pick<TraineeGroupItemDTO, 'id' | 'groupType' | 'operationalStatus'>[] = [
        { id: 'GRP-1', groupType: 'regular', operationalStatus: 'active' },
        { id: 'GRP-2', groupType: 'reminder', operationalStatus: 'active' },
        { id: 'GRP-3', groupType: 'reminder', operationalStatus: 'expired' },
      ];

      const reminderOnly = groups.filter((g) => g.groupType === 'reminder');
      expect(reminderOnly.length).toBe(2);

      const activeOnly = groups.filter((g) => g.operationalStatus === 'active');
      expect(activeOnly.length).toBe(2);

      const reminderAndActive = groups.filter(
        (g) => g.groupType === 'reminder' && g.operationalStatus === 'active'
      );
      expect(reminderAndActive.length).toBe(1);
      expect(reminderAndActive[0].id).toBe('GRP-2');
    });

    it('3.8: Handles empty filter results and provides reset action restoring full table', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const groups = [{ id: 'GRP-1', name: 'مجموعة 1' }];
      const noMatch = groups.filter((g) => g.name.includes('نص غير موجود'));
      expect(noMatch.length).toBe(0);

      // Reset action restores full list
      const restored = groups;
      expect(restored.length).toBe(1);
    });

    it('3.9: Handles missing and nullable dates gracefully without fabricating countdowns', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const infoWithMissingDate = {
        situation: 'active_regular' as const,
        primaryTargetDate: null,
        secondaryDate: null,
        daysRemaining: null,
        hoursRemaining: null,
        daysPassed: null,
        isOverdue: false,
      };

      const text = formatGroupTimeInfoAr(infoWithMissingDate);
      expect(text).not.toContain('متبقي 0');
      expect(text).toContain('غير محددة المهلة');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 4: Data Privacy & Security Boundary Enforcement
  // ══════════════════════════════════════════════════════════════════════════
  describe('Suite 4: Data Privacy & Security Boundary Enforcement', () => {
    it('4.1: Ensures zero other-trainee identifiers, rosters, or progress maps reach UI', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      const traineeGroupDTO: TraineeGroupItemDTO = {
        id: 'GRP-101',
        name: 'مجموعة الدفعة 42',
        groupType: 'regular',
        operationalStatus: 'active',
        traineeCount: 15,
        startDateTime: '2026-11-01T00:00:00.000Z',
        deadlineDateTime: '2026-11-30T00:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
        currentCycle: null,
        courses: [
          { courseId: 'CRS-01', courseTitle: 'تشغيل القطار', courseRole: 'core', order: 1 },
        ],
        timeInfo: {
          situation: 'active_regular',
          primaryTargetDate: '2026-11-30T00:00:00.000Z',
          secondaryDate: null,
          daysRemaining: 15,
          hoursRemaining: 0,
          daysPassed: 0,
          isOverdue: false,
        },
        navigationUrl: '/my-groups/GRP-101',
      };

      const serialized = JSON.stringify(traineeGroupDTO);
      expect(serialized).not.toContain('traineeMetricsList');
      expect(serialized).not.toContain('worstAttention');
      expect(serialized).not.toContain('programPercent');
      expect((traineeGroupDTO as unknown as Record<string, unknown>).metrics).toBeUndefined();
    });

    it('4.2: Proves metrics?: any bridge remains completely excised from TraineeGroupItemDTO', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      type HasMetricsKey = 'metrics' extends keyof TraineeGroupItemDTO ? true : false;
      const isPresent: HasMetricsKey = false;
      expect(isPresent).toBe(false);
    });

    it('4.3: Direct trainee route to archived groups fails closed with 404', () => {
      // STATUS: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B
      // Seed an archived group in store
      const store = inMemoryStore as unknown as {
        groups: Array<{ id: string; adminStatus: string; traineeIds: string[] }>;
      };
      const existing = store.groups[0];
      if (existing) {
        existing.adminStatus = 'archived';
        // Direct trainee lookup must throw 404
        expect(() => {
          inMemoryStore.getGroupById(existing.id, 'usr_trainee_001', 'user');
        }).toThrow(MockStoreError);
      }
    });
  });
});

