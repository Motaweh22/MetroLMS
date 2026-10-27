import { describe, it, expect, beforeEach } from 'vitest';
import { inMemoryStore, MockStoreError } from '@/mocks/store/inMemoryStore';
import type { User } from '@/core/auth/types';

describe('Increment 10 — Phase 2: Training Groups Mock Store & State Machines', () => {
  const adminUser: User = {
    id: 'usr_admin_001',
    name: 'م. محمود عبد السلام',
    email: 'admin@cairo-metro.com',
    role: 'admin',
    department: 'الإدارة العامة للتشغيل والتحكم المركزي',
    jobTitle: 'مدير عام أنظمة التشغيل',
    initials: 'م.ع',
  };

  const supervisorUser: User = {
    id: 'usr_lect_002',
    name: 'د. طارق الجوهري',
    email: 'lecturer@cairo-metro.com',
    role: 'lecturer',
    department: 'مركز تدريب وإعداد القادة بمترو القاهرة',
    jobTitle: 'كبير مدربي الإشارات والتحكم الآلي',
    initials: 'د.ط',
  };


  beforeEach(() => {
    inMemoryStore.reset({ seedReviewDemo: false });
  });

  // ── 1. Store Lifecycle, Reset & Baseline State ───────────────────────

  describe('1. Store Baseline State & Deterministic Reset', () => {
    it('initializes baseline mock groups with Increment 10 contracts and Cycle 1', () => {
      const groups = inMemoryStore.getGroups();
      expect(groups.length).toBeGreaterThanOrEqual(3);

      const grp101 = groups.find((g) => g.id === 'GRP-101');
      expect(grp101).toBeDefined();
      expect(grp101?.adminStatus).toBe('active');
      expect(grp101?.enrollmentPolicy).toBe('open');
      expect(grp101?.enrollmentCode).toBe('GRP-101-SEC-DEMO');
      expect(grp101?.currentCycleId).toBe('CYC-GRP-101-01');

      // Verify Cycle 1 exists
      const cycles = inMemoryStore.getGroupCycles('GRP-101');
      expect(cycles.length).toBe(1);
      expect(cycles[0].id).toBe('CYC-GRP-101-01');
      expect(cycles[0].cycleNumber).toBe(1);
      expect(cycles[0].status).toBe('active');
      expect(cycles[0].courses[0].courseRole).toBe('core');

      // Verify seeded group members
      const members = inMemoryStore.getGroupMembers('GRP-101');
      expect(members.length).toBe(grp101?.traineeIds.length);
      expect(members.some((m) => m.userId === 'usr_trainee_003')).toBe(true);

      // Verify provisioned baseline attempts
      const attempts = inMemoryStore.getTraineeAttempts('usr_trainee_003', 'CRS001');
      expect(attempts.length).toBeGreaterThanOrEqual(1);
      expect(attempts[0].status).toBe('not_started');
      expect(attempts[0].attemptNumber).toBeNull();
    });

    it('reset restores initial state cleanly and clears temporary mutations', () => {
      // Mutate state by creating a new group
      inMemoryStore.createGroup({
        name: 'مجموعة مؤقتة للاختبار',
        description: 'وصف المجموعة',
        startDateTime: '2026-11-01T08:00:00',
        deadlineDateTime: '2026-12-01T18:00:00',
        postDeadlinePolicy: 'keep_no_cert',
      });

      const mutatedCount = inMemoryStore.getGroups().length;
      expect(mutatedCount).toBe(4);

      // Reset
      inMemoryStore.reset({ seedReviewDemo: false });

      const restoredGroups = inMemoryStore.getGroups();
      expect(restoredGroups.length).toBe(3);
      expect(restoredGroups.some((g) => g.name === 'مجموعة مؤقتة للاختبار')).toBe(false);
    });
  });

  // ── 2. Training Group CRUD & Lifecycle Operations ────────────────────

  describe('2. Training Group CRUD & Lifecycle State Transitions', () => {
    it('creates a new training group with baseline Cycle 1 and initial trainees', () => {
      const created = inMemoryStore.createGroup({
        name: 'برنامج صيانة القطارات الكهربائية السريعة',
        description: 'برنامج متخصص لمهندسي الوحدات المتحركة والورش',
        startDateTime: '2026-11-01T08:00:00',
        deadlineDateTime: '2026-12-15T18:00:00',
        postDeadlinePolicy: 'keep_no_cert',
        adminStatus: 'active',
        enrollmentPolicy: 'approval_required',
        courseAssignments: [
          { courseId: 'CRS001', courseRole: 'core', order: 1 },
          { courseId: 'CRS002', courseRole: 'reminder', order: 2 },
        ],
        supervisorIds: [supervisorUser.id],
        initialTraineeIds: ['usr_trainee_003'],
        maxTrainees: 30,
      });

      expect(created.id).toMatch(/^GRP-\d+/);
      expect(created.name).toBe('برنامج صيانة القطارات الكهربائية السريعة');
      expect(created.adminStatus).toBe('active');
      expect(created.enrollmentPolicy).toBe('approval_required');
      expect(created.enrollmentCode).toBeDefined();
      expect(created.maxTrainees).toBe(30);
      expect(created.courses.length).toBe(2);

      // Verify Cycle 1 created automatically
      const cycles = inMemoryStore.getGroupCycles(created.id);
      expect(cycles.length).toBe(1);
      expect(cycles[0].cycleNumber).toBe(1);
      expect(cycles[0].courses.length).toBe(2);
      expect(cycles[0].courses[0].courseRole).toBe('core');
      expect(cycles[0].courses[1].courseRole).toBe('reminder');

      // Verify initial trainee enrolled
      expect(created.traineeIds).toContain('usr_trainee_003');
      const members = inMemoryStore.getGroupMembers(created.id);
      expect(members.length).toBe(1);
      expect(members[0].userId).toBe('usr_trainee_003');

      // Verify attempt provisioned for initial trainee
      const attempts = inMemoryStore.getTraineeAttempts('usr_trainee_003', 'CRS001');
      const cycleAttempt = attempts.find((a) => a.cycleId === cycles[0].id);
      expect(cycleAttempt).toBeDefined();
      expect(cycleAttempt?.status).toBe('not_started');
      expect(cycleAttempt?.courseRole).toBe('core');
    });

    it('rejects group creation with invalid date range', () => {
      expect(() => {
        inMemoryStore.createGroup({
          name: 'مجموعة غير صالحة',
          description: 'تواريخ مقلوبة',
          startDateTime: '2026-12-01T08:00:00',
          deadlineDateTime: '2026-11-01T08:00:00', // deadline before start!
          postDeadlinePolicy: 'keep_no_cert',
        });
      }).toThrowError(MockStoreError);
    });

    it('updates training group metadata, capacity, and enrollment settings', () => {
      const updated = inMemoryStore.updateGroup('GRP-101', {
        name: 'اسم المجموعة المحدث',
        maxTrainees: 50,
        enrollmentPolicy: 'closed',
        isEnrollmentOpen: false,
      });

      expect(updated.name).toBe('اسم المجموعة المحدث');
      expect(updated.maxTrainees).toBe(50);
      expect(updated.enrollmentPolicy).toBe('closed');
      expect(updated.isEnrollmentOpen).toBe(false);
    });

    it('archives training group safely', () => {
      const archived = inMemoryStore.archiveGroup('GRP-101');
      expect(archived.adminStatus).toBe('archived');
      expect(archived.isEnrollmentOpen).toBe(false);
    });

    it('safely archives group with members instead of permanent deletion', () => {
      const result = inMemoryStore.deleteGroup('GRP-101');
      expect(result.success).toBe(true);
      expect(result.archivedInstead).toBe(true);
      expect(result.message).toContain('أرشفة');

      const grp = inMemoryStore.getGroupById('GRP-101', adminUser.id, 'admin');
      expect(grp?.adminStatus).toBe('archived');
      expect(grp?.isEnrollmentOpen).toBe(false);
    });

    it('permanently deletes an empty draft group with zero dependent data', () => {
      const draft = inMemoryStore.createGroup({
        name: 'مسودة فارغة للحذف',
        description: 'مسودة',
        startDateTime: '2026-11-01T08:00:00',
        deadlineDateTime: '2026-12-01T18:00:00',
        postDeadlinePolicy: 'keep_no_cert',
        adminStatus: 'draft',
      });

      const result = inMemoryStore.deleteGroup(draft.id);
      expect(result.success).toBe(true);
      expect(result.archivedInstead).toBe(false);
      expect(inMemoryStore.getGroupById(draft.id, adminUser.id, 'admin')).toBeNull();
    });
  });

  // ── 3. Group Membership & Idempotent Enrollment ─────────────────────

  describe('3. Group Membership & Idempotent Course Enrollment', () => {
    it('adds a new member and synthesizes course enrollments and unstarted attempts', () => {
      const newTraineeId = 'USR_NEW_007';
      const result = inMemoryStore.addGroupMember('GRP-101', newTraineeId, 'admin_assigned');

      expect(result.alreadyMember).toBe(false);
      expect(result.member.userId).toBe(newTraineeId);
      expect(result.group.traineeIds).toContain(newTraineeId);
      expect(result.newlyEnrolledCoursesCount).toBe(2); // GRP-101 has CRS001 and CRS002

      // Verify course enrollment created in store
      const enr1 = inMemoryStore.getCourseEnrollment('CRS001', newTraineeId);
      expect(enr1).toBeDefined();
      expect(enr1?.status).toBe('active');

      const enr2 = inMemoryStore.getCourseEnrollment('CRS002', newTraineeId);
      expect(enr2).toBeDefined();

      // Verify unstarted attempts provisioned
      const attempts = inMemoryStore.getTraineeAttempts(newTraineeId);
      expect(attempts.length).toBe(2);
      expect(attempts.every((a) => a.status === 'not_started')).toBe(true);
      expect(attempts.every((a) => a.attemptNumber === null)).toBe(true);
    });

    it('prevent duplicate membership and keeps enrollment idempotent on retry', () => {
      // 'usr_trainee_003' is already in GRP-101
      const initialEnrollmentsCount = inMemoryStore.getUserEnrollments('usr_trainee_003').length;

      const result = inMemoryStore.addGroupMember('GRP-101', 'usr_trainee_003');
      expect(result.alreadyMember).toBe(true);
      expect(result.newlyEnrolledCoursesCount).toBe(0);

      // Verify enrollments count unchanged
      const afterCount = inMemoryStore.getUserEnrollments('usr_trainee_003').length;
      expect(afterCount).toBe(initialEnrollmentsCount);
    });

    it('enforces maximum group capacity when set', () => {
      inMemoryStore.updateGroup('GRP-101', { maxTrainees: 2 });
      // GRP-101 already has 2 members: 'usr_trainee_003', 'USR004'

      expect(() => {
        inMemoryStore.addGroupMember('GRP-101', 'USR_NEW_OVERFLOW');
      }).toThrowError('اكتمل العدد الأقصى للمتدربين');
    });

    it('removes member while preserving course enrollments and attempt history', () => {
      const traineeId = 'usr_trainee_003';
      expect(inMemoryStore.getCourseEnrollment('CRS002', traineeId)).toBeDefined();

      const removeResult = inMemoryStore.removeGroupMember('GRP-101', traineeId);
      expect(removeResult.success).toBe(true);

      const grp = inMemoryStore.getGroupById('GRP-101', adminUser.id, 'admin');
      expect(grp?.traineeIds).not.toContain(traineeId);

      // Critical Data Integrity Check:
      // Course enrollment and historical attempts MUST NOT be deleted
      const enr = inMemoryStore.getCourseEnrollment('CRS002', traineeId);
      expect(enr).toBeDefined();

      const attempts = inMemoryStore.getTraineeAttempts(traineeId);
      expect(attempts.length).toBeGreaterThan(0);
    });
  });

  // ── 4. Renewal Cycles & Cycle-Specific Course Assignments ────────────

  describe('4. Renewal Cycles & Course Role Assignment Rules', () => {
    it('creates a new renewal cycle, sealing the previous cycle and incrementing cycleNumber', () => {
      const renewResult = inMemoryStore.createRenewalCycle('GRP-101', {
        title: 'دورة تجديد نوفمبر - ديسمبر 2026',
        startDateTime: '2026-11-01T08:00:00',
        deadlineDateTime: '2026-12-31T18:00:00',
        postDeadlinePolicy: 'keep_no_cert',
        courses: [
          { courseId: 'CRS001', courseRole: 'core' },
          { courseId: 'CRS002', courseRole: 'reminder' },
        ],
      });

      expect(renewResult.previousCycle).toBeDefined();
      expect(renewResult.previousCycle?.status).toBe('completed');
      expect(renewResult.previousCycle?.completedAt).toBeDefined();

      expect(renewResult.newCycle.cycleNumber).toBe(2);
      expect(renewResult.newCycle.id).toBe('CYC-GRP-101-02');
      expect(renewResult.newCycle.status).toBe('active');
      expect(renewResult.group.currentCycleId).toBe('CYC-GRP-101-02');

      // Verify active members have fresh unstarted attempts for Cycle 2
      const cycle2Attempts = inMemoryStore.getCycleAttempts('CYC-GRP-101-02');
      expect(cycle2Attempts.length).toBe(4); // 2 members * 2 courses
      expect(cycle2Attempts.every((a) => a.status === 'not_started')).toBe(true);
      expect(cycle2Attempts.every((a) => a.progressPercent === 0)).toBe(true);
    });

    it('rejects renewal cycle when course is assigned as both core and reminder in the same cycle', () => {
      expect(() => {
        inMemoryStore.createRenewalCycle('GRP-101', {
          title: 'دورة غير صالحة',
          startDateTime: '2026-11-01T08:00:00',
          deadlineDateTime: '2026-12-31T18:00:00',
          courses: [
            { courseId: 'CRS001', courseRole: 'core' },
            { courseId: 'CRS001', courseRole: 'reminder' }, // duplicate course!
          ],
        });
      }).toThrowError('لا يمكن تعيين المقرر التدريبي (CRS001) أكثر من مرة');
    });

    it('updates cycle courses on active cycle and prevents editing completed cycles', () => {
      const activeCycle = inMemoryStore.getCurrentGroupCycle('GRP-101');
      expect(activeCycle).toBeDefined();

      const updatedCycle = inMemoryStore.assignCoursesToCycle('GRP-101', activeCycle!.id, {
        courses: [{ courseId: 'CRS001', courseRole: 'core', order: 1 }],
      });
      expect(updatedCycle.courses.length).toBe(1);

      // Now seal cycle
      inMemoryStore.createRenewalCycle('GRP-101', {
        title: 'دورة جديدة',
        startDateTime: '2026-11-15T08:00:00',
        deadlineDateTime: '2026-12-15T18:00:00',
        courses: [{ courseId: 'CRS001', courseRole: 'core' }],
      });

      // Trying to edit the now-completed cycle must fail
      expect(() => {
        inMemoryStore.assignCoursesToCycle('GRP-101', activeCycle!.id, {
          courses: [{ courseId: 'CRS002', courseRole: 'core' }],
        });
      }).toThrowError('لا يمكن تعديل مقررات دورة تجديد مكتملة أو مؤرشفة');
    });
  });

  // ── 5. Course Attempt Ledger & Historical Isolation ─────────────────

  describe('5. Course Attempt Ledger & Cycle Isolation', () => {
    it('provisioned attempt does not count towards started count', () => {
      const traineeId = 'usr_trainee_003';
      const stats = inMemoryStore.getCourseAttemptStatsForTrainee(traineeId, 'CRS001');

      expect(stats.previousStartedAttemptsCount).toBe(0);
      expect(stats.previousCompletionsCount).toBe(0);
      expect(stats.hasStartedCurrentAttempt).toBe(false);
      expect(stats.displayAttemptNumber).toBe(1);
    });

    it('starting an attempt assigns attemptNumber monotonically and is idempotent', () => {
      const traineeId = 'usr_trainee_003';
      const initialAttempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId: 'CRS001',
        cycleId: 'CYC-GRP-101-01',
      });
      expect(initialAttempt.attemptNumber).toBeNull();

      // Start attempt
      const started = inMemoryStore.startAttempt(initialAttempt.id, '2026-10-15T10:00:00Z');
      expect(started.attemptNumber).toBe(1);
      expect(started.status).toBe('in_progress');
      expect(started.startedAt).toBe('2026-10-15T10:00:00Z');

      // Repeated start calls must be strictly idempotent
      const restarted = inMemoryStore.startAttempt(initialAttempt.id, '2026-10-16T12:00:00Z');
      expect(restarted.attemptNumber).toBe(1);
      expect(restarted.startedAt).toBe('2026-10-15T10:00:00Z'); // keeps original timestamp
      expect(restarted.id).toBe(started.id);
    });

    it('preserves completed Cycle 1 attempt when starting fresh Cycle 2 attempt', () => {
      const traineeId = 'usr_trainee_003';
      const courseId = 'CRS001';

      // 1. Start and complete Cycle 1 attempt
      const cycle1Attempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId,
        cycleId: 'CYC-GRP-101-01',
      });
      inMemoryStore.startAttempt(cycle1Attempt.id);

      const items = inMemoryStore.getCourseItems(courseId);
      for (const item of items) {
        inMemoryStore.completeAttemptLessonItem({
          attemptId: cycle1Attempt.id,
          itemId: item.id,
        });
      }

      // Verify Cycle 1 attempt is 100% complete
      const completedCycle1Attempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId,
        cycleId: 'CYC-GRP-101-01',
      });
      expect(completedCycle1Attempt.status).toBe('completed');
      expect(completedCycle1Attempt.progressPercent).toBe(100);

      // 2. Trigger renewal to Cycle 2
      inMemoryStore.createRenewalCycle('GRP-101', {
        title: 'دورة تجديد 2027',
        startDateTime: '2027-01-01T08:00:00',
        deadlineDateTime: '2027-02-01T18:00:00',
        courses: [{ courseId, courseRole: 'reminder' }],
      });

      // 3. Cycle 2 attempt should start at 0%
      const cycle2Attempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId,
        cycleId: 'CYC-GRP-101-02',
      });
      expect(cycle2Attempt.id).not.toBe(cycle1Attempt.id);
      expect(cycle2Attempt.status).toBe('not_started');
      expect(cycle2Attempt.progressPercent).toBe(0);
      expect(cycle2Attempt.completedItemIds.length).toBe(0);

      // Cycle 1 attempt MUST remain 100% complete
      const verifiedCycle1 = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId,
        cycleId: 'CYC-GRP-101-01',
      });
      expect(verifiedCycle1.status).toBe('completed');
      expect(verifiedCycle1.progressPercent).toBe(100);

      // 4. Start Cycle 2 attempt and check statistics
      inMemoryStore.startAttempt(cycle2Attempt.id);

      const stats = inMemoryStore.getCourseAttemptStatsForTrainee(
        traineeId,
        courseId,
        'CYC-GRP-101-02'
      );
      expect(stats.currentAttemptNumber).toBe(2);
      expect(stats.previousStartedAttemptsCount).toBe(1);
      expect(stats.previousCompletionsCount).toBe(1);
      expect(stats.displayAttemptNumber).toBe(2);
    });

    it('keeps legacy userProgress functional without overwriting cycle attempt ledger', () => {
      const traineeId = 'usr_trainee_003';
      const courseId = 'CRS001';

      // Playback using legacy method
      const items = inMemoryStore.getCourseItems(courseId);
      const res = inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId,
        itemId: items[0].id,
        userRole: 'user',
      });
      expect(res.completedItem.completed).toBe(true);

      // Verify legacy progress is returned
      const legacyProgress = inMemoryStore.getCourseProgress(traineeId, courseId);
      expect(legacyProgress.completedItemIds).toContain(items[0].id);

      // Cycle 2 attempt in the ledger remains isolated and independent
      const cycleAttempt = inMemoryStore.getOrCreateCurrentAttempt({
        userId: traineeId,
        courseId,
        cycleId: 'CYC-GRP-101-01',
      });
      // The attempt has not recorded activity yet so its completedItemIds is empty
      expect(cycleAttempt.completedItemIds.length).toBe(0);
    });
  });

  // ── 6. Join Requests & QR Enrollment ────────────────────────────────

  describe('6. QR Code Enrollment Protocol & Join Requests', () => {
    it('allows instant join on open group with course synchronization', () => {
      const code = 'GRP-101-SEC-DEMO';
      const newUserId = 'USR_QR_TRAINEE_01';

      const joinRes = inMemoryStore.joinGroupByQRCode({
        code,
        userId: newUserId,
        userRole: 'user',
      });

      expect(joinRes.enrolledCoursesCount).toBe(2);
      expect(joinRes.group.traineeIds).toContain(newUserId);
      expect(joinRes.isPendingApproval).toBeUndefined();

      // Scanning again indicates already a member
      const retryRes = inMemoryStore.joinGroupByQRCode({
        code,
        userId: newUserId,
        userRole: 'user',
      });
      expect(retryRes.message).toContain('أنت عضو بالفعل');
      expect(retryRes.enrolledCoursesCount).toBe(0);
    });

    it('creates pending join request on approval_required group and avoids duplicates', () => {
      inMemoryStore.updateGroup('GRP-101', { enrollmentPolicy: 'approval_required' });
      const code = 'GRP-101-SEC-DEMO';
      const applicantId = 'USR_APPLICANT_02';

      const res = inMemoryStore.joinGroupByQRCode({
        code,
        userId: applicantId,
        userRole: 'user',
        note: 'أرغب بالانضمام للبرنامج لتأهيل موقعي الميداني',
      });

      expect(res.isPendingApproval).toBe(true);
      expect(res.enrolledCoursesCount).toBe(0);
      expect(res.message).toContain('بانتظار موافقة');

      // Verify join request record created
      const pending = inMemoryStore.getGroupJoinRequests('GRP-101', 'pending');
      expect(pending.length).toBe(1);
      expect(pending[0].userId).toBe(applicantId);
      expect(pending[0].status).toBe('pending');

      // Repeated scan while pending returns pending notice without duplicating request
      const retryRes = inMemoryStore.joinGroupByQRCode({
        code,
        userId: applicantId,
        userRole: 'user',
      });
      expect(retryRes.isPendingApproval).toBe(true);
      expect(retryRes.message).toContain('قيد المراجعة حالياً');
      expect(inMemoryStore.getGroupJoinRequests('GRP-101', 'pending').length).toBe(1);
    });

    it('approving a join request adds member and enrolls in courses', () => {
      inMemoryStore.updateGroup('GRP-101', { enrollmentPolicy: 'approval_required' });
      const req = inMemoryStore.submitGroupJoinRequest({
        groupId: 'GRP-101',
        userId: 'USR_APPLICANT_03',
        note: 'طلب انضمام',
      });

      const reviewRes = inMemoryStore.reviewGroupJoinRequest(
        { requestId: req.id, decision: 'approved', reviewNote: 'معتمد من مشرف الحركة' },
        adminUser
      );

      expect(reviewRes.request.status).toBe('approved');
      expect(reviewRes.request.reviewedBy).toBe(adminUser.id);
      expect(reviewRes.group.traineeIds).toContain('USR_APPLICANT_03');
      expect(reviewRes.newlyEnrolledCoursesCount).toBe(2);

      // Verify enrollment exists in store
      expect(inMemoryStore.getCourseEnrollment('CRS001', 'USR_APPLICANT_03')).toBeDefined();
    });

    it('rejecting a join request does not add member or enroll in courses', () => {
      inMemoryStore.updateGroup('GRP-101', { enrollmentPolicy: 'approval_required' });
      const req = inMemoryStore.submitGroupJoinRequest({
        groupId: 'GRP-101',
        userId: 'USR_APPLICANT_04',
      });

      const reviewRes = inMemoryStore.reviewGroupJoinRequest(
        { requestId: req.id, decision: 'rejected', reviewNote: 'اكتملت المقاعد المخصصة' },
        adminUser
      );

      expect(reviewRes.request.status).toBe('rejected');
      expect(reviewRes.group.traineeIds).not.toContain('USR_APPLICANT_04');
      expect(inMemoryStore.getCourseEnrollment('CRS001', 'USR_APPLICANT_04')).toBeUndefined();
    });

    it('blocks self-join on closed group with 403 Forbidden', () => {
      inMemoryStore.updateGroup('GRP-101', { enrollmentPolicy: 'closed' });
      expect(() => {
        inMemoryStore.joinGroupByQRCode({
          code: 'GRP-101-SEC-DEMO',
          userId: 'USR_BLOCKED',
          userRole: 'user',
        });
      }).toThrowError('الانضمام الذاتي غير متاح');
    });

    it('rotates group QR token invalidating old token', () => {
      const oldCode = 'GRP-101-SEC-DEMO';
      const rotated = inMemoryStore.rotateGroupEnrollmentCode('GRP-101');

      expect(rotated.newEnrollmentCode).not.toBe(oldCode);
      expect(rotated.newEnrollmentCode.length).toBeGreaterThan(6);

      // Old code should now be rejected as not found
      const valOld = inMemoryStore.validateGroupEnrollmentToken(oldCode);
      expect(valOld.isValid).toBe(false);
      expect(valOld.status).toBe(404);

      // New code is valid
      const valNew = inMemoryStore.validateGroupEnrollmentToken(rotated.newEnrollmentCode);
      expect(valNew.isValid).toBe(true);
      expect(valNew.group?.id).toBe('GRP-101');
    });

    it('blocks token when enrollment is toggled closed', () => {
      inMemoryStore.toggleGroupEnrollment('GRP-101', false);
      const val = inMemoryStore.validateGroupEnrollmentToken('GRP-101-SEC-DEMO');
      expect(val.isValid).toBe(false);
      expect(val.status).toBe(403);
      expect(val.error).toContain('الانضمام مغلق');
    });
  });

  // ── 7. Group Materials Library ───────────────────────────────────────

  describe('7. Group Materials Library Operations', () => {
    it('creates, renames, and manages material folder lifecycle', () => {
      const folder = inMemoryStore.createMaterialFolder('GRP-101', {
        name: 'نماذج الفحص الميداني',
        isVisibleToTrainees: true,
      });

      expect(folder.id).toMatch(/^FLD-GRP-101-/);
      expect(folder.name).toBe('نماذج الفحص الميداني');
      expect(folder.filesCount).toBe(0);

      // Rename
      const updated = inMemoryStore.updateMaterialFolder(folder.id, {
        name: 'نماذج الفحص الميداني والاختبارات',
        isVisibleToTrainees: false,
      });
      expect(updated.name).toBe('نماذج الفحص الميداني والاختبارات');
      expect(updated.isVisibleToTrainees).toBe(false);
    });

    it('rejects duplicate folder name in the same group', () => {
      inMemoryStore.createMaterialFolder('GRP-101', { name: 'المجلد الفريد' });
      expect(() => {
        inMemoryStore.createMaterialFolder('GRP-101', { name: 'المجلد الفريد' });
      }).toThrowError('يوجد مجلد آخر بنفس الاسم');
    });

    it('validates uploaded file metadata and rejects invalid files without partial state', () => {
      const folder = inMemoryStore.createMaterialFolder('GRP-101', { name: 'مجلد الاختبار' });

      // 1. Empty file size
      expect(() => {
        inMemoryStore.addMaterialFile(
          'GRP-101',
          folder.id,
          {
            title: 'ملف فارغ',
            fileName: 'empty.pdf',
            sizeBytes: 0,
            mimeType: 'application/pdf',
          },
          supervisorUser
        );
      }).toThrowError('الملف فارغ');

      // 2. Exceeding 50MB
      expect(() => {
        inMemoryStore.addMaterialFile(
          'GRP-101',
          folder.id,
          {
            title: 'ملف ضخم',
            fileName: 'huge.pdf',
            sizeBytes: 60 * 1024 * 1024,
            mimeType: 'application/pdf',
          },
          supervisorUser
        );
      }).toThrowError('يتجاوز الحد الأقصى');

      // 3. Unsupported extension
      expect(() => {
        inMemoryStore.addMaterialFile(
          'GRP-101',
          folder.id,
          {
            title: 'برنامج تنفيذي',
            fileName: 'script.exe',
            sizeBytes: 1024,
            mimeType: 'application/octet-stream',
          },
          supervisorUser
        );
      }).toThrowError('غير مدعوم');

      // Folder should remain completely empty (no partial state)
      const materials = inMemoryStore.getGroupMaterials('GRP-101');
      const testFolder = materials.folders.find((f) => f.id === folder.id);
      expect(testFolder?.files.length).toBe(0);
    });

    it('uploads valid files, classifies them accurately, and supports replacement and deletion', () => {
      const folder = inMemoryStore.createMaterialFolder('GRP-101', { name: 'المستندات الهندسية' });

      // Add PDF
      const pdfFile = inMemoryStore.addMaterialFile(
        'GRP-101',
        folder.id,
        {
          title: 'كتالوج الصيانة الكهربائية',
          fileName: 'maintenance-guide.pdf',
          sizeBytes: 5 * 1024 * 1024,
          mimeType: 'application/pdf',
        },
        supervisorUser
      );
      expect(pdfFile.fileType).toBe('pdf');
      expect(pdfFile.uploadedByName).toBe(supervisorUser.name);

      // Add Word document
      const docFile = inMemoryStore.addMaterialFile(
        'GRP-101',
        folder.id,
        {
          title: 'مسودة تعليمات التشغيل',
          fileName: 'draft-instructions.docx',
          sizeBytes: 500 * 1024,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
        supervisorUser
      );
      expect(docFile.fileType).toBe('word');

      // Replace Word document with updated version
      const replaced = inMemoryStore.replaceMaterialFile(
        docFile.id,
        {
          fileName: 'draft-instructions-v2.docx',
          sizeBytes: 550 * 1024,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
        adminUser
      );
      expect(replaced.originalFileName).toBe('draft-instructions-v2.docx');
      expect(replaced.uploadedByName).toBe(adminUser.name);

      // Delete file
      const delResult = inMemoryStore.deleteMaterialFile(pdfFile.id);
      expect(delResult.success).toBe(true);

      const materials = inMemoryStore.getGroupMaterials('GRP-101');
      const updatedFolder = materials.folders.find((f) => f.id === folder.id);
      expect(updatedFolder?.files.length).toBe(1);
      expect(updatedFolder?.files[0].id).toBe(docFile.id);
    });

    it('filters hidden materials folders and files from trainee role', () => {
      const hiddenFolder = inMemoryStore.createMaterialFolder('GRP-101', {
        name: 'مجلد خاص بالمشرفين',
        isVisibleToTrainees: false,
      });

      inMemoryStore.addMaterialFile(
        'GRP-101',
        hiddenFolder.id,
        {
          title: 'أسئلة الاختبار النهائي',
          fileName: 'exam-keys.pdf',
          sizeBytes: 1024 * 1024,
          mimeType: 'application/pdf',
        },
        adminUser
      );

      // Admin can see the hidden folder
      const adminView = inMemoryStore.getGroupMaterials('GRP-101', 'admin');
      expect(adminView.folders.some((f) => f.id === hiddenFolder.id)).toBe(true);

      // Trainee cannot see the hidden folder
      const traineeView = inMemoryStore.getGroupMaterials('GRP-101', 'user');
      expect(traineeView.folders.some((f) => f.id === hiddenFolder.id)).toBe(false);
    });
  });

  // ── 8. Group Summary & Aggregated Metrics ───────────────────────────

  describe('8. Group Summary & Cycle-Aware Aggregated Metrics', () => {
    it('computes aggregated group summary correctly', () => {
      const summary = inMemoryStore.getGroupSummary('GRP-101');
      expect(summary).toBeDefined();
      expect(summary?.id).toBe('GRP-101');
      expect(summary?.totalCoursesCount).toBe(2);
      expect(summary?.totalTraineesCount).toBe(2);
      expect(summary?.currentCycleNumber).toBe(1);
      expect(summary?.timeStatusLabelAr).toBeDefined();
    });

    it('evaluates group metrics against a specific historical renewal cycle', () => {
      // 1. Advance GRP-101 to Cycle 2
      inMemoryStore.createRenewalCycle('GRP-101', {
        title: 'دورة تجديد تالية',
        startDateTime: '2026-12-01T08:00:00',
        deadlineDateTime: '2027-01-15T18:00:00',
        courses: [{ courseId: 'CRS001', courseRole: 'core' }],
      });

      // 2. Request metrics for historical Cycle 1 explicitly
      const cycle1Metrics = inMemoryStore.getGroupMetrics('GRP-101', 'CYC-GRP-101-01');
      expect(cycle1Metrics).toBeDefined();
      expect(cycle1Metrics?.assignedCoursesMetrics.length).toBe(2);

      // 3. Request metrics for Cycle 2 explicitly
      const cycle2Metrics = inMemoryStore.getGroupMetrics('GRP-101', 'CYC-GRP-101-02');
      expect(cycle2Metrics).toBeDefined();
      expect(cycle2Metrics?.assignedCoursesMetrics.length).toBe(1);
    });
  });
});
