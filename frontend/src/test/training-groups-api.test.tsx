import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { groupsApi } from '@/features/groups/services/groupsApi';
import { ApiError } from '@/core/api/apiClient';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type { User } from '@/core/auth/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset({ seedReviewDemo: false });
});
afterAll(() => server.close());

const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
const supervisorUser = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;
const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;

// Second lecturer who is not assigned to GRP-101
const unassignedLecturer: User = {
  id: 'usr_lect_999',
  email: 'other_lecturer@cairo-metro.com',
  name: 'م. عصام الشريف',
  role: 'lecturer',
  department: 'إدارة الورش الميكانيكية',
  jobTitle: 'مدرب صيانة الوحدات',
  initials: 'ع.ش',
};

// Second trainee who is not in GRP-102
const outsiderTrainee: User = {
  id: 'usr_trainee_999',
  email: 'outsider@cairo-metro.com',
  name: 'خالد عبد الرازق',
  role: 'user',
  department: 'هندسة السكة والإنشاءات',
  jobTitle: 'فني سكة حديد',
  initials: 'خ.ع',
};

function setSession(user: User) {
  authStorage.setSession({
    token: `mock_jwt_${user.id}_test`,
    user,
    expiresAt: Date.now() + 3600000,
  });
}

describe('Increment 10 — Phase 3: MSW v2 Mock API Handlers & Client Service Layer', () => {
  // ── 1. Authentication & Role Boundaries ─────────────────────────────

  describe('1. Global Authentication & Role Barriers', () => {
    it('rejects unauthenticated requests with HTTP 401 Unauthorized', async () => {
      authStorage.clearSession();

      await expect(groupsApi.getAdminGroups()).rejects.toThrow(ApiError);
      try {
        await groupsApi.getAdminGroups();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(401);
      }
    });

    it('blocks trainees from accessing admin groups overview with HTTP 403 Forbidden', async () => {
      setSession(traineeUser);

      try {
        await groupsApi.getAdminGroups();
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('blocks supervisors from creating new groups with HTTP 403 Forbidden', async () => {
      setSession(supervisorUser);

      try {
        await groupsApi.createGroup({
          name: 'محاولة إنشاء بواسطة مشرف',
          description: 'وصف',
          startDateTime: '2026-11-01T08:00:00',
          deadlineDateTime: '2026-12-01T18:00:00',
          postDeadlinePolicy: 'keep_no_cert',
        });
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('blocks unassigned supervisor from accessing unassigned group details with HTTP 403', async () => {
      // GRP-103 supervisor is 'usr_admin_001', not 'usr_lect_002'
      setSession(supervisorUser);

      try {
        await groupsApi.getAdminGroupById('GRP-103');
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });
  });

  // ── 2. Training Groups CRUD & Scoped Listings ────────────────────────

  describe('2. Training Groups Management Operations', () => {
    it('allows administrator to list all groups with summary metrics', async () => {
      setSession(adminUser);

      const summaries = await groupsApi.getAdminGroups();
      expect(summaries.length).toBeGreaterThanOrEqual(3);
      const grp101 = summaries.find((s) => s.id === 'GRP-101');
      expect(grp101).toBeDefined();
      expect(grp101?.name).toContain('الخط الثاني');
      expect(grp101?.totalCoursesCount).toBe(2);
      expect(grp101?.currentCycleNumber).toBe(1);
    });

    it('scopes supervisor group listings strictly to assigned cohorts', async () => {
      setSession(supervisorUser);

      const summaries = await groupsApi.getAdminGroups();
      // supervisorUser (usr_lect_002) is supervisor for GRP-101 and GRP-102, but NOT GRP-103
      expect(summaries.some((s) => s.id === 'GRP-101')).toBe(true);
      expect(summaries.some((s) => s.id === 'GRP-102')).toBe(true);
      expect(summaries.some((s) => s.id === 'GRP-103')).toBe(false);
    });

    it('allows administrator to create a new group returning HTTP 201 Created and baseline Cycle 1', async () => {
      setSession(adminUser);

      const newGroup = await groupsApi.createGroup({
        name: 'برنامج دبلوم هندسة الأنظمة ومحاكاة الحركة',
        description: 'برنامج تأهيلي مكثف لمشغلي ومراقبي الحركة المركزية',
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
        initialTraineeIds: [traineeUser.id],
        maxTrainees: 25,
      });

      expect(newGroup.id).toMatch(/^GRP-\d+/);
      expect(newGroup.name).toBe('برنامج دبلوم هندسة الأنظمة ومحاكاة الحركة');
      expect(newGroup.maxTrainees).toBe(25);
      expect(newGroup.courses.length).toBe(2);
      expect(newGroup.currentCycleId).toBeDefined();

      // Verify Cycle 1 created via API
      const cycles = await groupsApi.getGroupCycles(newGroup.id);
      expect(cycles.length).toBe(1);
      expect(cycles[0].cycleNumber).toBe(1);
      expect(cycles[0].courses[0].courseRole).toBe('core');
    });

    it('rejects group creation with invalid date range returning HTTP 422', async () => {
      setSession(adminUser);

      try {
        await groupsApi.createGroup({
          name: 'مجموعة غير صالحة',
          description: 'تواريخ معكوسة',
          startDateTime: '2026-12-01T08:00:00',
          deadlineDateTime: '2026-11-01T08:00:00', // deadline before start!
          postDeadlinePolicy: 'keep_no_cert',
        });
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(422);
      }
    });

    it('allows administrator to update group settings and capacity', async () => {
      setSession(adminUser);

      const updated = await groupsApi.updateGroup('GRP-101', {
        name: 'اسم المجموعة المعدل بالكامل',
        maxTrainees: 40,
        enrollmentPolicy: 'closed',
      });

      expect(updated.name).toBe('اسم المجموعة المعدل بالكامل');
      expect(updated.maxTrainees).toBe(40);
      expect(updated.enrollmentPolicy).toBe('closed');
    });

    it('safely archives active group with members instead of permanent deletion', async () => {
      setSession(adminUser);

      const result = await groupsApi.deleteGroup('GRP-101');
      expect(result.success).toBe(true);
      expect(result.archivedInstead).toBe(true);
      expect(result.message).toContain('أرشفة');

      const group = await groupsApi.getAdminGroupById('GRP-101');
      expect(group.adminStatus).toBe('archived');
      expect(group.isEnrollmentOpen).toBe(false);
    });

    it('permanently deletes empty draft group', async () => {
      setSession(adminUser);

      const draft = await groupsApi.createGroup({
        name: 'مسودة مؤقتة للحذف',
        description: 'مسودة لا تحتوي على متدربين',
        startDateTime: '2026-11-01T08:00:00',
        deadlineDateTime: '2026-12-01T18:00:00',
        postDeadlinePolicy: 'keep_no_cert',
        adminStatus: 'draft',
      });

      const result = await groupsApi.deleteGroup(draft.id);
      expect(result.success).toBe(true);
      expect(result.archivedInstead).toBe(false);

      try {
        await groupsApi.getAdminGroupById(draft.id);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(404);
      }
    });
  });

  // ── 3. Renewal Cycles & Cycle Course Assignments ─────────────────────

  describe('3. Renewal Cycles & Core/Reminder Course Assignments', () => {
    it('creates a new renewal cycle sealing previous cycle and provisioning attempts', async () => {
      setSession(adminUser);

      const result = await groupsApi.renewCycle('GRP-101', {
        title: 'دورة التجديد الدورية — شتاء 2026',
        startDateTime: '2026-11-01T08:00:00',
        deadlineDateTime: '2026-12-31T18:00:00',
        courses: [
          { courseId: 'CRS001', courseRole: 'core' },
          { courseId: 'CRS002', courseRole: 'reminder' },
        ],
      });

      expect(result.previousCycle?.status).toBe('completed');
      expect(result.newCycle.cycleNumber).toBe(2);
      expect(result.newCycle.id).toBe('CYC-GRP-101-02');
      expect(result.newCycle.courses.length).toBe(2);
      expect(result.group.currentCycleId).toBe('CYC-GRP-101-02');
    });

    it('rejects cycle renewal when course is assigned as both core and reminder returning HTTP 422', async () => {
      setSession(adminUser);

      try {
        await groupsApi.renewCycle('GRP-101', {
          title: 'دورة غير صالحة',
          startDateTime: '2026-11-01T08:00:00',
          deadlineDateTime: '2026-12-31T18:00:00',
          courses: [
            { courseId: 'CRS001', courseRole: 'core' },
            { courseId: 'CRS001', courseRole: 'reminder' }, // duplicate course!
          ],
        });
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(422);
      }
    });

    it('allows updating courses on active cycle and rejects updates to completed cycles', async () => {
      setSession(adminUser);

      const activeCycle = await groupsApi.getGroupCycleById('GRP-101', 'CYC-GRP-101-01');
      expect(activeCycle.status).toBe('active');

      const updatedCycle = await groupsApi.assignCycleCourses('GRP-101', {
        courses: [{ courseId: 'CRS001', courseRole: 'core', order: 1 }],
        cycleId: activeCycle.id,
      });
      expect(updatedCycle.courses.length).toBe(1);

      // Now renew to complete Cycle 1
      await groupsApi.renewCycle('GRP-101', {
        title: 'دورة ثانية',
        startDateTime: '2026-12-01T08:00:00',
        deadlineDateTime: '2026-12-31T18:00:00',
        courses: [{ courseId: 'CRS001', courseRole: 'core' }],
      });

      // Attempting to modify completed Cycle 1 must fail with 400 Bad Request
      try {
        await groupsApi.assignCycleCourses('GRP-101', {
          courses: [{ courseId: 'CRS002', courseRole: 'core' }],
          cycleId: activeCycle.id,
        });
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(400);
      }
    });
  });

  // ── 4. Course Attempt Ledger & Isolation ─────────────────────────────

  describe('4. Course Attempt Ledger & Historical Isolation', () => {
    it('retrieves unstarted course attempt statistics accurately without count inflation', async () => {
      setSession(traineeUser);

      const stats = await groupsApi.getTraineeCourseAttempts(traineeUser.id, 'CRS001');
      expect(stats.courseId).toBe('CRS001');
      expect(stats.previousStartedAttemptsCount).toBe(0);
      expect(stats.previousCompletionsCount).toBe(0);
      expect(stats.hasStartedCurrentAttempt).toBe(false);
      expect(stats.currentAttemptNumber).toBeNull();
      expect(stats.displayAttemptNumber).toBe(1);
    });

    it('blocks unrelated trainees from retrieving another trainee attempts with HTTP 403', async () => {
      setSession(outsiderTrainee);

      try {
        await groupsApi.getTraineeCourseAttempts(traineeUser.id, 'CRS001');
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('allows assigned supervisor to view supervised trainee attempts', async () => {
      // supervisorUser (usr_lect_002) is supervisor for GRP-101 which contains traineeUser
      setSession(supervisorUser);

      const stats = await groupsApi.getTraineeCourseAttempts(traineeUser.id, 'CRS001');
      expect(stats).toBeDefined();
      expect(stats.courseId).toBe('CRS001');
    });
  });

  // ── 5. Group Membership & Direct Enrollment ──────────────────────────

  describe('5. Group Membership Management & Idempotent Enrollment', () => {
    it('direct-adds a trainee to group with course enrollment and unstarted attempt', async () => {
      setSession(adminUser);
      const newTraineeId = 'USR007';

      const res = await groupsApi.addGroupMembers('GRP-101', [newTraineeId]);
      expect(res.addedCount).toBe(1);
      expect(res.alreadyMemberCount).toBe(0);
      expect(res.members.some((m) => m.userId === newTraineeId)).toBe(true);

      // Verify course enrollment created
      expect(inMemoryStore.getCourseEnrollment('CRS001', newTraineeId)).toBeDefined();

      // Verify unstarted attempt provisioned
      const attempts = inMemoryStore.getTraineeAttempts(newTraineeId, 'CRS001');
      expect(attempts.length).toBeGreaterThanOrEqual(1);
      expect(attempts[0].status).toBe('not_started');
      expect(attempts[0].attemptNumber).toBeNull();
    });

    it('is idempotent on retry and prevents duplicate membership', async () => {
      setSession(adminUser);

      // traineeUser (usr_trainee_003) is already in GRP-101
      const res = await groupsApi.addGroupMembers('GRP-101', [traineeUser.id]);
      expect(res.addedCount).toBe(0);
      expect(res.alreadyMemberCount).toBe(1);
    });

    it('enforces maximum group capacity returning HTTP 409 Conflict', async () => {
      setSession(adminUser);
      await groupsApi.updateGroup('GRP-101', { maxTrainees: 2 });
      // GRP-101 already has 2 members: usr_trainee_003, USR004

      try {
        await groupsApi.addGroupMembers('GRP-101', ['USR_OVERFLOW_01']);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(409);
      }
    });

    it('removes member while strictly preserving course enrollments and attempt history', async () => {
      setSession(adminUser);
      const traineeId = traineeUser.id;

      const removeRes = await groupsApi.removeGroupMember('GRP-101', traineeId);
      expect(removeRes.success).toBe(true);

      const members = await groupsApi.getGroupMembers('GRP-101');
      expect(members.some((m) => m.userId === traineeId)).toBe(false);

      // Critical Data Integrity Check:
      // Course enrollment and historical attempts MUST NOT be deleted
      expect(inMemoryStore.getCourseEnrollment('CRS002', traineeId)).toBeDefined();
      expect(inMemoryStore.getTraineeAttempts(traineeId).length).toBeGreaterThan(0);
    });
  });

  // ── 6. QR Code Enrollment Protocol & Join Requests ───────────────────

  describe('6. QR Code Self-Enrollment & Join Requests', () => {
    it('provides public preview metadata without requiring authentication', async () => {
      authStorage.clearSession();

      const preview = await groupsApi.getJoinInfo('GRP-101-SEC-DEMO');
      expect(preview.id).toBe('GRP-101');
      expect(preview.name).toContain('الخط الثاني');
      expect(preview.totalCoursesCount).toBe(2);
      expect(preview.isEnrollmentOpen).toBe(true);
    });

    it('returns HTTP 404 for unknown or revoked QR code token', async () => {
      authStorage.clearSession();

      try {
        await groupsApi.getJoinInfo('NON-EXISTENT-CODE');
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(404);
      }
    });

    it('rotates group QR code token invalidating previous token', async () => {
      setSession(adminUser);

      const rotateRes = await groupsApi.rotateQRCode('GRP-101');
      expect(rotateRes.newEnrollmentCode).toBeDefined();
      expect(rotateRes.newEnrollmentCode).not.toBe('GRP-101-SEC-DEMO');

      // Old token returns 404
      authStorage.clearSession();
      try {
        await groupsApi.getJoinInfo('GRP-101-SEC-DEMO');
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(404);
      }

      // New token returns valid preview
      const preview = await groupsApi.getJoinInfo(rotateRes.newEnrollmentCode);
      expect(preview.id).toBe('GRP-101');
    });

    it('toggles QR enrollment closed and rejects preview with HTTP 403', async () => {
      setSession(adminUser);
      await groupsApi.toggleQRCode('GRP-101', false);

      authStorage.clearSession();
      try {
        await groupsApi.getJoinInfo('GRP-101-SEC-DEMO');
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('allows instant join on open group for eligible trainee', async () => {
      setSession(outsiderTrainee);

      const joinRes = await groupsApi.joinGroupByQR({
        enrollmentCode: 'GRP-101-SEC-DEMO',
      });

      expect(joinRes.enrolledCoursesCount).toBe(2);
      expect(joinRes.group.traineeIds).toContain(outsiderTrainee.id);
      expect(joinRes.isPendingApproval).toBeUndefined();

      // Scanning again indicates already a member
      const retryRes = await groupsApi.joinGroupByQR({
        enrollmentCode: 'GRP-101-SEC-DEMO',
      });
      expect(retryRes.enrolledCoursesCount).toBe(0);
      expect(retryRes.message).toContain('أنت عضو بالفعل');
    });

    it('creates pending request on approval_required group and avoids duplicates', async () => {
      setSession(adminUser);
      await groupsApi.updateGroup('GRP-101', { enrollmentPolicy: 'approval_required' });

      setSession(outsiderTrainee);
      const joinRes = await groupsApi.joinGroupByQR({
        enrollmentCode: 'GRP-101-SEC-DEMO',
        note: 'طلب انضمام لتأهيل العمل الميداني',
      });

      expect(joinRes.isPendingApproval).toBe(true);
      expect(joinRes.enrolledCoursesCount).toBe(0);
      expect(joinRes.message).toContain('بانتظار موافقة');

      // Supervisor views pending requests
      setSession(supervisorUser);
      const requests = await groupsApi.getJoinRequests('GRP-101', 'pending');
      expect(requests.length).toBe(1);
      expect(requests[0].userId).toBe(outsiderTrainee.id);

      // Trainee scanning again gets pending notice without duplicating request
      setSession(outsiderTrainee);
      const retryRes = await groupsApi.joinGroupByQR({
        enrollmentCode: 'GRP-101-SEC-DEMO',
      });
      expect(retryRes.isPendingApproval).toBe(true);
      expect(retryRes.message).toContain('قيد المراجعة');

      setSession(supervisorUser);
      const requestsAfter = await groupsApi.getJoinRequests('GRP-101', 'pending');
      expect(requestsAfter.length).toBe(1);
    });

    it('approves join request adding member and enrolling in courses', async () => {
      setSession(adminUser);
      await groupsApi.updateGroup('GRP-101', { enrollmentPolicy: 'approval_required' });

      setSession(outsiderTrainee);
      await groupsApi.joinGroupByQR({
        enrollmentCode: 'GRP-101-SEC-DEMO',
      });

      setSession(supervisorUser);
      const [pending] = await groupsApi.getJoinRequests('GRP-101', 'pending');

      const reviewRes = await groupsApi.reviewJoinRequest(
        'GRP-101',
        pending.id,
        'approved',
        'معتمد من المشرف المباشر'
      );

      expect(reviewRes.request.status).toBe('approved');
      expect(reviewRes.newlyEnrolledCoursesCount).toBe(2);
      expect(reviewRes.group.traineeIds).toContain(outsiderTrainee.id);

      // Verify course enrollment created
      expect(inMemoryStore.getCourseEnrollment('CRS001', outsiderTrainee.id)).toBeDefined();
    });

    it('rejects join request with note and does not add member', async () => {
      setSession(adminUser);
      await groupsApi.updateGroup('GRP-101', { enrollmentPolicy: 'approval_required' });

      setSession(outsiderTrainee);
      await groupsApi.joinGroupByQR({
        enrollmentCode: 'GRP-101-SEC-DEMO',
      });

      setSession(supervisorUser);
      const [pending] = await groupsApi.getJoinRequests('GRP-101', 'pending');

      const reviewRes = await groupsApi.reviewJoinRequest(
        'GRP-101',
        pending.id,
        'rejected',
        'المقاعد ممتلئة للدفعة الحالية'
      );

      expect(reviewRes.request.status).toBe('rejected');
      expect(reviewRes.group.traineeIds).not.toContain(outsiderTrainee.id);
      expect(inMemoryStore.getCourseEnrollment('CRS001', outsiderTrainee.id)).toBeUndefined();
    });
  });

  // ── 7. Group Materials Library & Scoped Data Access ──────────────────

  describe('7. Group Materials Library & Authorization Boundaries', () => {
    it('creates, renames, and manages material folders', async () => {
      setSession(supervisorUser);

      const folder = await groupsApi.createMaterialFolder('GRP-101', {
        name: 'نماذج الفحص الميداني والسلامة',
        isVisibleToTrainees: true,
      });

      expect(folder.id).toMatch(/^FLD-GRP-101-/);
      expect(folder.name).toBe('نماذج الفحص الميداني والسلامة');
      expect(folder.isVisibleToTrainees).toBe(true);

      // Rename
      const updated = await groupsApi.updateMaterialFolder('GRP-101', folder.id, {
        name: 'نماذج الفحص الميداني المحدثة',
        isVisibleToTrainees: false,
      });
      expect(updated.name).toBe('نماذج الفحص الميداني المحدثة');
      expect(updated.isVisibleToTrainees).toBe(false);
    });

    it('rejects duplicate folder name with HTTP 409 Conflict', async () => {
      setSession(supervisorUser);
      await groupsApi.createMaterialFolder('GRP-101', { name: 'المجلد المميز' });

      try {
        await groupsApi.createMaterialFolder('GRP-101', { name: 'المجلد المميز' });
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(409);
      }
    });

    it('validates uploaded file metadata and rejects invalid files with HTTP 422', async () => {
      setSession(supervisorUser);
      const folder = await groupsApi.createMaterialFolder('GRP-101', { name: 'مجلد التحقق' });

      // 1. Empty file (0 bytes)
      try {
        await groupsApi.addMaterialFile('GRP-101', {
          folderId: folder.id,
          title: 'ملف فارغ',
          fileName: 'empty.pdf',
          sizeBytes: 0,
          mimeType: 'application/pdf',
        });
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(422);
      }

      // 2. Exceeding 50MB (60MB)
      try {
        await groupsApi.addMaterialFile('GRP-101', {
          folderId: folder.id,
          title: 'ملف ضخم',
          fileName: 'huge.pdf',
          sizeBytes: 60 * 1024 * 1024,
          mimeType: 'application/pdf',
        });
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(422);
      }

      // 3. Unsupported extension (.exe)
      try {
        await groupsApi.addMaterialFile('GRP-101', {
          folderId: folder.id,
          title: 'برنامج',
          fileName: 'malicious.exe',
          sizeBytes: 1024,
          mimeType: 'application/octet-stream',
        });
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(422);
      }
    });

    it('uploads valid files, supports replacement and deletion', async () => {
      setSession(supervisorUser);
      const folder = await groupsApi.createMaterialFolder('GRP-101', { name: 'مستندات التشغيل' });

      const file = await groupsApi.addMaterialFile('GRP-101', {
        folderId: folder.id,
        title: 'دليل التشغيل القياسي',
        fileName: 'sop-guide.pdf',
        sizeBytes: 2 * 1024 * 1024,
        mimeType: 'application/pdf',
      });

      expect(file.id).toMatch(/^FIL-GRP-101-/);
      expect(file.fileType).toBe('pdf');
      expect(file.uploadedByName).toBe(supervisorUser.name);

      // Replace file
      const replaced = await groupsApi.replaceMaterialFile('GRP-101', file.id, {
        fileName: 'sop-guide-v2.pdf',
        sizeBytes: 2500000,
        mimeType: 'application/pdf',
      });
      expect(replaced.originalFileName).toBe('sop-guide-v2.pdf');

      // Delete file
      const delRes = await groupsApi.deleteMaterialFile('GRP-101', file.id);
      expect(delRes.success).toBe(true);
    });

    it('filters hidden folders and files for trainee members', async () => {
      setSession(adminUser);

      // Create a hidden folder
      const hiddenFolder = await groupsApi.createMaterialFolder('GRP-101', {
        name: 'مجلد خاص بالإدارة فقط',
        isVisibleToTrainees: false,
      });

      // Admin can see it
      const adminMaterials = await groupsApi.getGroupMaterials('GRP-101');
      expect(adminMaterials.folders.some((f) => f.id === hiddenFolder.id)).toBe(true);

      // Member trainee cannot see the hidden folder
      setSession(traineeUser); // member of GRP-101
      const traineeMaterials = await groupsApi.getGroupMaterials('GRP-101');
      expect(traineeMaterials.folders.some((f) => f.id === hiddenFolder.id)).toBe(false);
    });

    it('CRITICAL: blocks outsider trainee from viewing another group materials with HTTP 403 Forbidden', async () => {
      // outsiderTrainee is NOT a member of GRP-101
      setSession(outsiderTrainee);

      try {
        await groupsApi.getGroupMaterials('GRP-101');
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('CRITICAL: blocks unassigned lecturer from viewing unassigned group materials with HTTP 403 Forbidden', async () => {
      // unassignedLecturer is NOT a supervisor of GRP-101
      setSession(unassignedLecturer);

      try {
        await groupsApi.getGroupMaterials('GRP-101');
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });
  });

  // ── 8. Group Monitoring Dashboard Data ───────────────────────────────

  describe('8. Group Follow-up & Progress Monitoring Endpoint', () => {
    it('retrieves group monitoring metrics for active cycle', async () => {
      setSession(supervisorUser);

      const metrics = await groupsApi.getGroupMonitoringData('GRP-101');
      expect(metrics.group.id).toBe('GRP-101');
      expect(metrics.status).toBeDefined();
      expect(metrics.assignedCoursesMetrics.length).toBe(2);
      expect(metrics.traineeMetricsList.length).toBe(2);
    });

    it('retrieves group monitoring metrics for specific historical cycle', async () => {
      setSession(adminUser);

      // Advance GRP-101 to Cycle 2
      await groupsApi.renewCycle('GRP-101', {
        title: 'دورة تجديد قادمة',
        startDateTime: '2026-12-01T08:00:00',
        deadlineDateTime: '2027-01-15T18:00:00',
        courses: [{ courseId: 'CRS001', courseRole: 'core' }],
      });

      // Request historical Cycle 1 explicitly
      const cycle1Metrics = await groupsApi.getGroupMonitoringData(
        'GRP-101',
        'CYC-GRP-101-01'
      );
      expect(cycle1Metrics.assignedCoursesMetrics.length).toBe(2);

      // Request Cycle 2 explicitly
      const cycle2Metrics = await groupsApi.getGroupMonitoringData(
        'GRP-101',
        'CYC-GRP-101-02'
      );
      expect(cycle2Metrics.assignedCoursesMetrics.length).toBe(1);
    });

    it('blocks unassigned supervisor or trainee from accessing group monitoring with HTTP 403', async () => {
      setSession(unassignedLecturer);

      try {
        await groupsApi.getGroupMonitoringData('GRP-101');
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }

      setSession(traineeUser);
      try {
        await groupsApi.getGroupMonitoringData('GRP-101');
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });
  });
});
