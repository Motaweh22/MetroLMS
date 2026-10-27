import { describe, it, expect } from 'vitest';
import type {
  TrainingGroup,
  GroupCourseAssignment,
  GroupCycleCourseAssignment,
  GroupRenewalCycle,
  CourseAttempt,
} from '@/core/groups/types';
import {
  validateDateRange,
  getEffectiveCourseSettings,
  validateCycleCourseAssignments,
  createCourseAttempt,
  isAttemptStarted,
  isAttemptCompleted,
  startCourseAttempt,
  calculateCourseAttemptStats,
  formatAttemptBadge,
  resolveMaterialFileType,
  validateMaterialUpload,
} from '@/core/domain/groups';

describe('Increment 10 — Phase 1: Training Groups Domain Contracts & Pure Logic', () => {
  const baseGroup: TrainingGroup = {
    id: 'GRP-101',
    name: 'مجموعة تشغيل وصيانة المترو — الدفعة 42',
    description: 'تدريب تشغيلي وفني معتمد',
    courseId: 'CRS-001',
    courses: [
      {
        courseId: 'CRS-001',
        order: 1,
      },
      {
        courseId: 'CRS-002',
        order: 2,
        customStartDateTime: '2026-11-05T08:00:00.000Z',
        customDeadlineDateTime: '2026-11-20T16:00:00.000Z',
        customPostDeadlinePolicy: 'hide',
      },
    ],
    traineeIds: ['usr_trainee_001', 'usr_trainee_002'],
    supervisorIds: ['usr_lect_001'],
    startDateTime: '2026-11-01T08:00:00.000Z',
    deadlineDateTime: '2026-11-30T16:00:00.000Z',
    postDeadlinePolicy: 'keep_no_cert',
    resources: [],
    adminStatus: 'active',
    enrollmentPolicy: 'open',
  };

  const sampleCycle: GroupRenewalCycle = {
    id: 'CYC-GRP101-01',
    groupId: 'GRP-101',
    cycleNumber: 1,
    title: 'دورة تجديد نوفمبر 2026',
    status: 'active',
    startDateTime: '2026-11-02T08:00:00.000Z',
    deadlineDateTime: '2026-11-25T16:00:00.000Z',
    postDeadlinePolicy: 'keep_no_cert',
    courses: [
      {
        courseId: 'CRS-001',
        courseRole: 'core',
        order: 1,
      },
      {
        courseId: 'CRS-002',
        courseRole: 'reminder',
        order: 2,
        customStartDateTime: '2026-11-10T08:00:00.000Z',
        customDeadlineDateTime: '2026-11-22T16:00:00.000Z',
      },
      {
        courseId: 'CRS-003',
        courseRole: 'reminder',
        order: 3,
        customDeadlineDateTime: '2026-11-28T16:00:00.000Z',
      },
    ],
    traineeIds: ['usr_trainee_001'],
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-20T00:00:00.000Z',
  };

  describe('1. Date Precedence & Validation (Course Override > Cycle Date > Group Default)', () => {
    it('inherits all dates and policies from group default when no cycle or course overrides exist', () => {
      const assignment: GroupCourseAssignment = {
        courseId: 'CRS-001',
        order: 1,
      };

      const settings = getEffectiveCourseSettings(baseGroup, assignment);

      expect(settings.effectiveStartDateTime).toBe(baseGroup.startDateTime);
      expect(settings.effectiveDeadlineDateTime).toBe(baseGroup.deadlineDateTime);
      expect(settings.effectivePostDeadlinePolicy).toBe('keep_no_cert');
      expect(settings.inheritedFrom?.start).toBe('group');
      expect(settings.inheritedFrom?.deadline).toBe('group');
      expect(settings.inheritedFrom?.policy).toBe('group');
      expect(settings.hasAnyOverride).toBe(false);
      expect(settings.isValidDateRange).toBe(true);
    });

    it('allows cycle dates to override group defaults when course has no overrides', () => {
      const assignment: GroupCycleCourseAssignment = {
        courseId: 'CRS-001',
        courseRole: 'core',
        order: 1,
      };

      const settings = getEffectiveCourseSettings(baseGroup, assignment, new Date('2026-11-05T00:00:00.000Z'), sampleCycle);

      expect(settings.effectiveStartDateTime).toBe(sampleCycle.startDateTime);
      expect(settings.effectiveDeadlineDateTime).toBe(sampleCycle.deadlineDateTime);
      expect(settings.inheritedFrom?.start).toBe('cycle');
      expect(settings.inheritedFrom?.deadline).toBe('cycle');
      expect(settings.cycleId).toBe('CYC-GRP101-01');
      expect(settings.courseRole).toBe('core');
      expect(settings.isActive).toBe(true);
    });

    it('allows course-specific overrides to take highest precedence over both cycle and group', () => {
      const assignment: GroupCycleCourseAssignment = {
        courseId: 'CRS-002',
        courseRole: 'reminder',
        order: 2,
        customStartDateTime: '2026-11-10T08:00:00.000Z',
        customDeadlineDateTime: '2026-11-22T16:00:00.000Z',
        customPostDeadlinePolicy: 'hide',
      };

      const settings = getEffectiveCourseSettings(baseGroup, assignment, new Date('2026-11-15T00:00:00.000Z'), sampleCycle);

      expect(settings.effectiveStartDateTime).toBe('2026-11-10T08:00:00.000Z');
      expect(settings.effectiveDeadlineDateTime).toBe('2026-11-22T16:00:00.000Z');
      expect(settings.effectivePostDeadlinePolicy).toBe('hide');
      expect(settings.inheritedFrom?.start).toBe('course_override');
      expect(settings.inheritedFrom?.deadline).toBe('course_override');
      expect(settings.inheritedFrom?.policy).toBe('course_override');
      expect(settings.hasStartOverride).toBe(true);
      expect(settings.hasDeadlineOverride).toBe(true);
      expect(settings.hasPolicyOverride).toBe(true);
    });

    it('resolves mixed precedence correctly (e.g. deadline from course, start from cycle, policy from group)', () => {
      const cycleWithoutPolicy: GroupRenewalCycle = {
        ...sampleCycle,
        postDeadlinePolicy: undefined,
      };

      const assignment: GroupCycleCourseAssignment = {
        courseId: 'CRS-003',
        courseRole: 'reminder',
        order: 3,
        customDeadlineDateTime: '2026-11-28T16:00:00.000Z',
        // start and policy omitted
      };

      const settings = getEffectiveCourseSettings(baseGroup, assignment, new Date('2026-11-05T00:00:00.000Z'), cycleWithoutPolicy);

      expect(settings.effectiveStartDateTime).toBe(sampleCycle.startDateTime); // From cycle
      expect(settings.effectiveDeadlineDateTime).toBe('2026-11-28T16:00:00.000Z'); // From course override
      expect(settings.effectivePostDeadlinePolicy).toBe('keep_no_cert'); // From group
      expect(settings.inheritedFrom?.start).toBe('cycle');
      expect(settings.inheritedFrom?.deadline).toBe('course_override');
      expect(settings.inheritedFrom?.policy).toBe('group');
    });

    it('preserves 100% backward compatibility for legacy groups without renewal cycles', () => {
      // Legacy caller passes group, string courseId, and date
      const settings = getEffectiveCourseSettings(baseGroup, 'CRS-001', new Date('2026-11-15T00:00:00.000Z'));

      expect(settings.courseId).toBe('CRS-001');
      expect(settings.effectiveStartDateTime).toBe(baseGroup.startDateTime);
      expect(settings.effectiveDeadlineDateTime).toBe(baseGroup.deadlineDateTime);
      expect(settings.cycleId).toBeNull();
      expect(settings.isActive).toBe(true);
    });

    it('validates date ranges and rejects start date after deadline', () => {
      const invalid = validateDateRange('2026-11-25T08:00:00.000Z', '2026-11-20T08:00:00.000Z');
      expect(invalid.isValid).toBe(false);
      expect(invalid.error).toBe('يجب أن يكون تاريخ وموعد النهاية بعد تاريخ وموعد البداية');

      const tooShort = validateDateRange('2026-11-20T08:00:00.000Z', '2026-11-20T08:30:00.000Z', 1);
      expect(tooShort.isValid).toBe(false);
      expect(tooShort.error).toContain('ساعة واحدة على الأقل');

      const valid = validateDateRange('2026-11-20T08:00:00.000Z', '2026-11-20T10:00:00.000Z');
      expect(valid.isValid).toBe(true);
      expect(valid.durationMs).toBe(2 * 3600 * 1000);
    });
  });

  describe('2. Cycle Course Assignments Validation (Core vs Reminder)', () => {
    it('validates a correct list of distinct core and reminder courses', () => {
      const courses: GroupCycleCourseAssignment[] = [
        { courseId: 'CRS-001', courseRole: 'core', order: 1 },
        { courseId: 'CRS-002', courseRole: 'reminder', order: 2 },
      ];

      const res = validateCycleCourseAssignments(courses);
      expect(res.isValid).toBe(true);
      expect(res.coreCoursesCount).toBe(1);
      expect(res.reminderCoursesCount).toBe(1);
    });

    it('rejects assigning the same course multiple times or as both core and reminder in the same cycle', () => {
      const courses: GroupCycleCourseAssignment[] = [
        { courseId: 'CRS-001', courseRole: 'core', order: 1 },
        { courseId: 'CRS-001', courseRole: 'reminder', order: 2 },
      ];

      const res = validateCycleCourseAssignments(courses);
      expect(res.isValid).toBe(false);
      expect(res.duplicates).toContain('CRS-001');
      expect(res.error).toContain('لا يمكن تعيين المقرر التدريبي (CRS-001) أكثر من مرة');
    });

    it('rejects empty course list for a renewal cycle', () => {
      const res = validateCycleCourseAssignments([]);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('يجب تعيين مقرر تدريبي واحد على الأقل');
    });
  });

  describe('3. Cycle-Aware Course Attempt Tracking & Historical Preservation', () => {
    it('factory creates clean unstarted attempt with attemptNumber null and status not_started', () => {
      const attempt = createCourseAttempt({
        id: 'ATT-USR001-CRS001-CYC01',
        userId: 'usr_trainee_001',
        courseId: 'CRS-001',
        cycleId: 'CYC-GRP101-01',
        groupId: 'GRP-101',
        courseRole: 'core',
      });

      expect(attempt.id).toBe('ATT-USR001-CRS001-CYC01');
      expect(attempt.attemptNumber).toBeNull(); // Provisioning is not starting!
      expect(attempt.status).toBe('not_started');
      expect(attempt.startedAt).toBeNull();
      expect(attempt.completedAt).toBeNull();
      expect(attempt.progressPercent).toBe(0);
      expect(attempt.completedItemIds).toEqual([]);
      expect(isAttemptStarted(attempt)).toBe(false);
      expect(isAttemptCompleted(attempt)).toBe(false);
    });

    it('does not increment started attempts count when attempt is merely provisioned/unstarted', () => {
      const unstartedAttempt = createCourseAttempt({
        id: 'ATT-USR001-CRS001-CYC01',
        userId: 'usr_trainee_001',
        courseId: 'CRS-001',
        cycleId: 'CYC-GRP101-01',
      });

      const stats = calculateCourseAttemptStats({
        attempts: [unstartedAttempt],
        userId: 'usr_trainee_001',
        courseId: 'CRS-001',
        currentCycleId: 'CYC-GRP101-01',
      });

      expect(stats.previousStartedAttemptsCount).toBe(0);
      expect(stats.previousCompletionsCount).toBe(0);
      expect(stats.currentAttemptNumber).toBeNull();
      expect(stats.displayAttemptNumber).toBe(1); // Projected first attempt
      expect(stats.hasStartedCurrentAttempt).toBe(false);
    });

    it('assigns attemptNumber = 1 dynamically upon actual start and remains stable thereafter', () => {
      const unstartedAttempt = createCourseAttempt({
        id: 'ATT-USR001-CRS001-CYC01',
        userId: 'usr_trainee_001',
        courseId: 'CRS-001',
        cycleId: 'CYC-GRP101-01',
      });

      const startTime = '2026-11-03T10:00:00.000Z';
      const startedAttempt = startCourseAttempt(unstartedAttempt, [], startTime);

      expect(startedAttempt.attemptNumber).toBe(1);
      expect(startedAttempt.status).toBe('in_progress');
      expect(startedAttempt.startedAt).toBe(startTime);
      expect(isAttemptStarted(startedAttempt)).toBe(true);

      // Calling startCourseAttempt again must be idempotent and preserve attemptNumber
      const repeatedStart = startCourseAttempt(startedAttempt, [], '2026-11-04T12:00:00.000Z');
      expect(repeatedStart.attemptNumber).toBe(1);
      expect(repeatedStart.startedAt).toBe(startTime);
    });

    it('preserves completed attempt in Cycle 1 while starting fresh attempt at 0% in Cycle 2', () => {
      // Historical Cycle 1 completed attempt
      const cycle1Attempt: CourseAttempt = {
        id: 'ATT-USR001-CRS001-CYC01',
        userId: 'usr_trainee_001',
        courseId: 'CRS-001',
        cycleId: 'CYC-GRP101-01',
        groupId: 'GRP-101',
        attemptNumber: 1,
        courseRole: 'core',
        status: 'completed',
        startedAt: '2026-11-03T10:00:00.000Z',
        completedAt: '2026-11-15T14:30:00.000Z',
        lastActivityAt: '2026-11-15T14:30:00.000Z',
        progressPercent: 100,
        completedItemIds: ['item_1', 'item_2', 'item_3'],
        lastWatchedItemId: 'item_3',
        lessonProgress: {},
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-15T14:30:00.000Z',
      };

      // Fresh Cycle 2 unstarted attempt
      const cycle2Attempt = createCourseAttempt({
        id: 'ATT-USR001-CRS001-CYC02',
        userId: 'usr_trainee_001',
        courseId: 'CRS-001',
        cycleId: 'CYC-GRP101-02',
        groupId: 'GRP-101',
        courseRole: 'reminder',
      });

      // Calculate stats for Cycle 2 before starting
      const statsBeforeStart = calculateCourseAttemptStats({
        attempts: [cycle1Attempt, cycle2Attempt],
        userId: 'usr_trainee_001',
        courseId: 'CRS-001',
        currentCycleId: 'CYC-GRP101-02',
      });

      expect(statsBeforeStart.previousStartedAttemptsCount).toBe(1);
      expect(statsBeforeStart.previousCompletionsCount).toBe(1);
      expect(statsBeforeStart.displayAttemptNumber).toBe(2);
      expect(statsBeforeStart.hasStartedCurrentAttempt).toBe(false);
      expect(statsBeforeStart.currentAttempt?.progressPercent).toBe(0);

      // Trainee starts Cycle 2
      const startedCycle2 = startCourseAttempt(cycle2Attempt, [cycle1Attempt], '2026-12-01T09:00:00.000Z');
      expect(startedCycle2.attemptNumber).toBe(2);
      expect(startedCycle2.status).toBe('in_progress');

      // Re-calculate stats after starting Cycle 2
      const statsAfterStart = calculateCourseAttemptStats({
        attempts: [cycle1Attempt, startedCycle2],
        userId: 'usr_trainee_001',
        courseId: 'CRS-001',
        currentCycleId: 'CYC-GRP101-02',
      });

      expect(statsAfterStart.previousStartedAttemptsCount).toBe(1);
      expect(statsAfterStart.previousCompletionsCount).toBe(1);
      expect(statsAfterStart.currentAttemptNumber).toBe(2);
      expect(statsAfterStart.displayAttemptNumber).toBe(2);
      expect(statsAfterStart.hasStartedCurrentAttempt).toBe(true);

      // Verify Cycle 1 attempt remains 100% frozen and intact
      expect(cycle1Attempt.status).toBe('completed');
      expect(cycle1Attempt.progressPercent).toBe(100);
      expect(cycle1Attempt.attemptNumber).toBe(1);
    });

    it('handles starting a new attempt after an incomplete prior attempt correctly', () => {
      // Historical Cycle 1: started but incomplete (e.g. 40%)
      const cycle1Incomplete: CourseAttempt = {
        id: 'ATT-USR001-CRS001-CYC01',
        userId: 'usr_trainee_001',
        courseId: 'CRS-001',
        cycleId: 'CYC-GRP101-01',
        attemptNumber: 1,
        status: 'expired_incomplete',
        startedAt: '2026-11-03T10:00:00.000Z',
        completedAt: null,
        progressPercent: 40,
        completedItemIds: ['item_1'],
        lessonProgress: {},
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-25T16:00:00.000Z',
      };

      const cycle2Attempt = createCourseAttempt({
        id: 'ATT-USR001-CRS001-CYC02',
        userId: 'usr_trainee_001',
        courseId: 'CRS-001',
        cycleId: 'CYC-GRP101-02',
      });

      const stats = calculateCourseAttemptStats({
        attempts: [cycle1Incomplete, cycle2Attempt],
        userId: 'usr_trainee_001',
        courseId: 'CRS-001',
        currentCycleId: 'CYC-GRP101-02',
      });

      expect(stats.previousStartedAttemptsCount).toBe(1);
      expect(stats.previousCompletionsCount).toBe(0); // Incomplete does NOT count as completion
      expect(stats.displayAttemptNumber).toBe(2);
    });

    it('does not duplicate attempts or inflate counts when trainee belongs to multiple groups with same course', () => {
      // Two identical attempt records belonging to the same cycle (e.g. from 2 group enrollments in the same cycle)
      const attemptA: CourseAttempt = {
        id: 'ATT-USR001-CRS001-A',
        userId: 'usr_trainee_001',
        courseId: 'CRS-001',
        cycleId: 'CYC-GRP101-01',
        groupId: 'GRP-101',
        attemptNumber: 1,
        status: 'in_progress',
        startedAt: '2026-11-03T10:00:00.000Z',
        progressPercent: 50,
        completedItemIds: ['item_1'],
        lessonProgress: {},
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-03T10:00:00.000Z',
      };

      const duplicateAttemptB: CourseAttempt = {
        id: 'ATT-USR001-CRS001-B',
        userId: 'usr_trainee_001',
        courseId: 'CRS-001',
        cycleId: 'CYC-GRP101-01',
        groupId: 'GRP-102', // Different group, same cycle
        attemptNumber: 1,
        status: 'in_progress',
        startedAt: '2026-11-03T10:00:00.000Z',
        progressPercent: 50,
        completedItemIds: ['item_1'],
        lessonProgress: {},
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-03T10:00:00.000Z',
      };

      const stats = calculateCourseAttemptStats({
        attempts: [attemptA, duplicateAttemptB],
        userId: 'usr_trainee_001',
        courseId: 'CRS-001',
        currentCycleId: 'CYC-GRP101-01',
      });

      // Deduplication guarantees previous started count is 0 (current attempt is active attempt #1)
      expect(stats.previousStartedAttemptsCount).toBe(0);
      expect(stats.currentAttemptNumber).toBe(1);
      expect(stats.displayAttemptNumber).toBe(1);
    });

    it('formats Arabic attempt badge correctly for display', () => {
      const badge1 = formatAttemptBadge({
        courseId: 'CRS-001',
        currentAttemptNumber: 1,
        displayAttemptNumber: 1,
        previousStartedAttemptsCount: 0,
        previousCompletionsCount: 0,
        currentAttempt: null,
        hasStartedCurrentAttempt: false,
        historicalAttempts: [],
      });

      expect(badge1.title).toBe('محاولتك الأولى لهذا المقرر');
      expect(badge1.badgeText).toBe('محاولة 1');
      expect(badge1.detailsText).toBe('المحاولة الأولى');

      const badge3 = formatAttemptBadge({
        courseId: 'CRS-001',
        currentAttemptNumber: 3,
        displayAttemptNumber: 3,
        previousStartedAttemptsCount: 2,
        previousCompletionsCount: 2,
        currentAttempt: null,
        hasStartedCurrentAttempt: true,
        historicalAttempts: [],
      });

      expect(badge3.title).toBe('محاولتك الثالثة لهذا المقرر');
      expect(badge3.badgeText).toBe('محاولة 3');
      expect(badge3.detailsText).toBe('2 إكمال سابق ناجح');
    });
  });

  describe('4. Group Materials Contracts & Validation Helpers', () => {
    it('resolves material file types accurately from extension and MIME type', () => {
      expect(resolveMaterialFileType('operation-guide.pdf')).toBe('pdf');
      expect(resolveMaterialFileType('track-photo.PNG')).toBe('image');
      expect(resolveMaterialFileType('handbook.docx')).toBe('word');
      expect(resolveMaterialFileType('maintenance-checklist.xlsx')).toBe('excel');
      expect(resolveMaterialFileType('training-slides.pptx')).toBe('powerpoint');
      expect(resolveMaterialFileType('tools-bundle.ZIP')).toBe('archive');
      expect(resolveMaterialFileType('unknown.xyz')).toBe('other');
    });

    it('validates material uploads and enforces size and extension policies', () => {
      const validPdf = validateMaterialUpload({ name: 'guide.pdf', size: 1024 * 1024 });
      expect(validPdf.isValid).toBe(true);

      const emptyName = validateMaterialUpload({ name: '', size: 1024 });
      expect(emptyName.isValid).toBe(false);
      expect(emptyName.error).toBe('اسم الملف مطلوب');

      const emptyFile = validateMaterialUpload({ name: 'file.pdf', size: 0 });
      expect(emptyFile.isValid).toBe(false);
      expect(emptyFile.error).toContain('الملف فارغ');

      const oversize = validateMaterialUpload({ name: 'giant.zip', size: 60 * 1024 * 1024 }, 50 * 1024 * 1024);
      expect(oversize.isValid).toBe(false);
      expect(oversize.error).toContain('يتجاوز الحد الأقصى');

      const disallowed = validateMaterialUpload({ name: 'script.exe', size: 1024 });
      expect(disallowed.isValid).toBe(false);
      expect(disallowed.error).toContain('غير مدعوم');
    });
  });
});
