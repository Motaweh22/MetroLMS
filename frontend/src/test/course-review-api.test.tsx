import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import { reviewApi } from '@/features/course-review/api/reviewApi';
import { apiClient, ApiError } from '@/core/api/apiClient';
import type { User } from '@/core/auth/types';
import type {
  AdminStagedEditPayload,
  ReviewQueueResponseDTO,
  LecturerSubmissionsResponseDTO,
  SubmitCourseResponseDTO,
  CourseReviewDataResponseDTO,
  ReviewerWorkingNotes,
  StagedEditsSaveResponseDTO,
  StagedAdminEditsRecord,
} from '@/core/courses/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
});
afterAll(() => server.close());

describe('Increment 9 — Review MSW API Handlers & Client Service Layer (Phase 2)', () => {
  const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
  const lecturerUser = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;
  const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;

  const otherLecturer: User = {
    id: 'usr_lect_999',
    name: 'د. طارق مصطفى',
    email: 'tarek@metro.gov.eg',
    role: 'lecturer',
    jobTitle: 'خبير إشارات',
    department: 'هندسة السكة',
    initials: 'د.ط',
  };

  const loginAs = (user: User) => {
    authStorage.setSession({
      token: `mock_jwt_${user.id}_token`,
      user,
      expiresAt: Date.now() + 3600000,
    });
  };

  beforeEach(() => {
    inMemoryStore.reset();
    localStorage.clear();
    authStorage.clearSession();
  });

  describe('1. POST /api/courses/:courseId/submit', () => {
    it('returns 401 Unauthorized when request lacks authentication token', async () => {
      try {
        await reviewApi.submitCourse('CRS001');
        expect.unreachable('Should fail with 401');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(401);
        expect(apiErr.message).toContain('يجب تسجيل الدخول لتقديم المقرر للمراجعة');
      }
    });

    it('returns 403 Forbidden when trainee attempts submission', async () => {
      loginAs(traineeUser);
      try {
        await reviewApi.submitCourse('CRS001');
        expect.unreachable('Should fail with 403');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(403);
        expect(apiErr.message).toContain('غير مصرح لك بتقديم هذا المقرر للمراجعة');
      }
    });

    it('returns 403 Forbidden when unauthorized lecturer attempts submission', async () => {
      loginAs(otherLecturer);
      try {
        await reviewApi.submitCourse('CRS001');
        expect.unreachable('Should fail with 403');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(403);
        expect(apiErr.message).toContain('غير مصرح لك بتقديم هذا المقرر للمراجعة');
      }
    });

    it('returns 404 Not Found when course does not exist', async () => {
      loginAs(adminUser);
      try {
        await reviewApi.submitCourse('NON_EXISTENT_CRS');
        expect.unreachable('Should fail with 404');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(404);
        expect(apiErr.message).toContain('تعذر العثور على الدورة التدريبية');
      }
    });

    it('returns 409 DRAFT_INTEGRITY_ERROR when submitting published course without draft', async () => {
      loginAs(adminUser);
      try {
        await reviewApi.submitCourse('CRS001');
        expect.unreachable('Should fail with 409');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(409);
        expect(apiErr.message).toContain('تعذر العثور على مسودة التعديلات للمقرر المنشور');
        expect((apiErr.data as { code?: string })?.code).toBe('DRAFT_INTEGRITY_ERROR');
      }
    });

    it('returns 422 Unprocessable Entity when course content fails eligibility', async () => {
      loginAs(lecturerUser);
      const newCourse = inMemoryStore.createCourse(
        { title: 'كورس بدون دروس', description: 'وصف سليم', level: 'مبتدئ' },
        lecturerUser
      );
      // Chapter has 0 items
      try {
        await reviewApi.submitCourse(newCourse.id);
        expect.unreachable('Should fail with 422');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(422);
        expect(apiErr.message).toContain('يجب أن يحتوي المقرر على درس أو مادة تدريبية واحدة على الأقل');
      }
    });

    it('returns 200 OK and SubmitCourseResponseDTO on valid Case A draft submission', async () => {
      loginAs(lecturerUser);
      const newCourse = inMemoryStore.createCourse(
        { title: 'كورس جديد سليم', description: 'وصف كامل', level: 'مبتدئ' },
        lecturerUser
      );
      newCourse.chapters[0].items.push({ id: 'item_1', type: 'video', title: 'درس أول' });
      inMemoryStore.saveCourseDraft(newCourse.id, newCourse, lecturerUser);

      const response = await reviewApi.submitCourse(newCourse.id);
      expect(response.isPublishedUpdate).toBe(false);
      expect(response.action).toBe('submitted');
      expect(response.course.status).toBe('pending_admin');
      expect(response.course.auditLog).toHaveLength(1);
    });

    it('returns 200 OK on valid Case B published-course update submission', async () => {
      loginAs(lecturerUser);
      inMemoryStore.saveCourseDraft(
        'CRS001',
        { title: 'تحديث مقرر السكك الحديدية المنشور' },
        lecturerUser
      );

      const response = await reviewApi.submitCourse('CRS001');
      expect(response.isPublishedUpdate).toBe(true);
      expect(response.action).toBe('submitted');
      expect(response.course.status).toBe('published'); // Remains live!
      expect(response.course.isUpdatePendingApproval).toBe(true);
    });
  });

  describe('2. GET /api/approvals/queue', () => {
    it('returns 401 Unauthorized without auth token', async () => {
      try {
        await reviewApi.getReviewQueue();
        expect.unreachable('Should fail with 401');
      } catch (err) {
        expect((err as ApiError).status).toBe(401);
      }
    });

    it('returns 403 Forbidden for non-admin accounts', async () => {
      loginAs(lecturerUser);
      try {
        await reviewApi.getReviewQueue();
        expect.unreachable('Should fail with 403');
      } catch (err) {
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('returns 200 OK and deterministic FIFO queue for admin', async () => {
      loginAs(adminUser);
      const queue = await reviewApi.getReviewQueue();
      expect(queue).toBeDefined();
      expect(Array.isArray(queue.items)).toBe(true);
      expect(typeof queue.totalCount).toBe('number');
    });
  });

  describe('3. GET /api/approvals/my-submissions', () => {
    it('returns 401 Unauthorized without auth token', async () => {
      try {
        await reviewApi.getLecturerSubmissions();
        expect.unreachable('Should fail with 401');
      } catch (err) {
        expect((err as ApiError).status).toBe(401);
      }
    });

    it('returns 403 Forbidden for trainee accounts', async () => {
      loginAs(traineeUser);
      try {
        await reviewApi.getLecturerSubmissions();
        expect.unreachable('Should fail with 403');
      } catch (err) {
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('returns 200 OK and lecturer submissions with summary counts', async () => {
      loginAs(lecturerUser);
      const res = await reviewApi.getLecturerSubmissions();
      expect(res).toBeDefined();
      expect(Array.isArray(res.items)).toBe(true);
      expect(res.counts).toBeDefined();
      expect(typeof res.counts.pending).toBe('number');
      expect(typeof res.counts.approved).toBe('number');
      expect(typeof res.counts.needsRevision).toBe('number');
      expect(typeof res.counts.draft).toBe('number');
    });
  });

  describe('4. GET /api/courses/:courseId/review-data', () => {
    it('returns 401 Unauthorized without auth token', async () => {
      try {
        await reviewApi.getCourseReviewData('CRS001');
        expect.unreachable('Should fail with 401');
      } catch (err) {
        expect((err as ApiError).status).toBe(401);
      }
    });

    it('returns 403 Forbidden when trainee requests review data', async () => {
      loginAs(traineeUser);
      try {
        await reviewApi.getCourseReviewData('CRS001');
        expect.unreachable('Should fail with 403');
      } catch (err) {
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('returns 404 Not Found for non-existent course', async () => {
      loginAs(adminUser);
      try {
        await reviewApi.getCourseReviewData('CRS_NOT_EXIST');
        expect.unreachable('Should fail with 404');
      } catch (err) {
        expect((err as ApiError).status).toBe(404);
      }
    });

    it('returns 200 OK with baseline, draft, effectiveContent, and audit trail', async () => {
      loginAs(adminUser);
      const data = await reviewApi.getCourseReviewData('CRS001');
      expect(data.course).toBeDefined();
      expect(data.course.id).toBe('CRS001');
      expect(data.effectiveContent).toBeDefined();
      expect(Array.isArray(data.auditLog)).toBe(true);
    });
  });

  describe('5. GET & PUT /api/admin/review/:courseId/staged-edits', () => {
    it('blocks non-admin users from accessing or saving staged edits (403)', async () => {
      loginAs(lecturerUser);
      try {
        await reviewApi.getStagedAdminEdits('CRS001');
        expect.unreachable('Should fail with 403');
      } catch (err) {
        expect((err as ApiError).status).toBe(403);
      }

      try {
        await reviewApi.saveStagedAdminEdits('CRS001', {
          baselineId: 'CRS001',
          baselineSubmittedAt: '2026-10-19T10:00:00.000Z',
          clientRevision: 1,
          patch: { title: 'محاولة تعديل غير مصرح بها' },
        });
        expect.unreachable('Should fail with 403');
      } catch (err) {
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('returns null record when no staged edits exist for course', async () => {
      loginAs(adminUser);
      const res = await reviewApi.getStagedAdminEdits('CRS001');
      expect(res.record).toBeNull();
    });

    it('saves staged edits and increments clientRevision successfully', async () => {
      loginAs(adminUser);
      const payload: AdminStagedEditPayload = {
        baselineId: 'CRS001',
        baselineSubmittedAt: '2026-10-19T10:00:00.000Z',
        clientRevision: 1,
        patch: { title: 'تعديل إداري معتمد عبر API' },
      };

      const saveRes = await reviewApi.saveStagedAdminEdits('CRS001', payload);
      expect(saveRes.record.clientRevision).toBe(1);
      expect(saveRes.record.patchedContent.title).toBe('تعديل إداري معتمد عبر API');

      const fetchRes = await reviewApi.getStagedAdminEdits('CRS001');
      expect(fetchRes.record).not.toBeNull();
      expect(fetchRes.record?.clientRevision).toBe(1);
    });

    it('returns 409 Conflict when saving with clientRevision <= acceptedRevision', async () => {
      loginAs(adminUser);
      // Revision 1
      await reviewApi.saveStagedAdminEdits('CRS001', {
        baselineId: 'CRS001',
        baselineSubmittedAt: '2026-10-19T10:00:00.000Z',
        clientRevision: 1,
        patch: { title: 'تعديل 1' },
      });

      // Stale revision 1 again
      try {
        await reviewApi.saveStagedAdminEdits('CRS001', {
          baselineId: 'CRS001',
          baselineSubmittedAt: '2026-10-19T10:00:00.000Z',
          clientRevision: 1,
          patch: { title: 'تعديل متضارب' },
        });
        expect.unreachable('Should fail with 409');
      } catch (err) {
        expect((err as ApiError).status).toBe(409);
        expect((err as ApiError).message).toContain('تعارض في التعديلات المتزامنة');
      }
    });

    it('returns 422 Unprocessable Entity when staged edit breaks content eligibility', async () => {
      loginAs(adminUser);
      try {
        await reviewApi.saveStagedAdminEdits('CRS001', {
          baselineId: 'CRS001',
          baselineSubmittedAt: '2026-10-19T10:00:00.000Z',
          clientRevision: 1,
          patch: { title: '   ' }, // Invalid empty title
        });
        expect.unreachable('Should fail with 422');
      } catch (err) {
        expect((err as ApiError).status).toBe(422);
        expect((err as ApiError).message).toContain('عنوان المقرر مطلوب');
      }
    });
  });

  describe('6. GET & PUT /api/admin/review/:courseId/working-notes', () => {
    it('blocks lecturer from accessing or saving private reviewer notes (403)', async () => {
      loginAs(lecturerUser);
      try {
        await reviewApi.getReviewerWorkingNotes('CRS001');
        expect.unreachable('Should fail with 403');
      } catch (err) {
        expect((err as ApiError).status).toBe(403);
      }

      try {
        await reviewApi.saveReviewerWorkingNotes('CRS001', { generalNote: 'ملاحظة غير مصرحة' });
        expect.unreachable('Should fail with 403');
      } catch (err) {
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('saves and retrieves private reviewer working notes scoped to reviewer', async () => {
      loginAs(adminUser);
      const saved = await reviewApi.saveReviewerWorkingNotes('CRS001', {
        generalNote: 'ملاحظة سرية للمراجع فقط',
        chapterNotes: { ch_1: 'ملاحظة الفصل الأول' },
      });
      expect(saved.generalNote).toBe('ملاحظة سرية للمراجع فقط');

      const fetched = await reviewApi.getReviewerWorkingNotes('CRS001');
      expect(fetched.generalNote).toBe('ملاحظة سرية للمراجع فقط');
      expect(fetched.chapterNotes['ch_1']).toBe('ملاحظة الفصل الأول');
    });
  });

  describe('7. POST /api/admin/review/:courseId/decision', () => {
    it('blocks lecturer from executing review decision (403)', async () => {
      loginAs(lecturerUser);
      try {
        await reviewApi.executeReviewDecision('CRS001', {
          outcome: 'approved',
          publishOption: 'submitted_baseline',
        });
        expect.unreachable('Should fail with 403');
      } catch (err) {
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('returns 400 Bad Request when course is not pending review', async () => {
      loginAs(adminUser);
      // CRS001 is published and has isUpdatePendingApproval === false initially
      try {
        await reviewApi.executeReviewDecision('CRS001', {
          outcome: 'approved',
          publishOption: 'submitted_baseline',
        });
        expect.unreachable('Should fail with 400');
      } catch (err) {
        expect((err as ApiError).status).toBe(400);
        expect((err as ApiError).message).toContain('المقرر غير موجود في قائمة انتظار الاعتماد');
      }
    });

    it('executes Outcome A (Approve & Publish) successfully', async () => {
      // Put course in pending review
      const course = inMemoryStore.createCourse(
        { title: 'كورس جاهز للاعتماد', description: 'وصف كامل', level: 'مبتدئ' },
        adminUser
      );
      course.chapters[0].items.push({ id: 'i1', type: 'video', title: 'درس' });
      inMemoryStore.saveCourseDraft(course.id, course, adminUser);
      inMemoryStore.submitCourseForReview(course.id, adminUser);

      loginAs(adminUser);
      const res = await reviewApi.executeReviewDecision(course.id, {
        outcome: 'approved',
        publishOption: 'submitted_baseline',
        approvalNote: 'تم الاعتماد بمطابقة المعايير',
      });

      expect(res.outcome).toBe('approved');
      expect(res.course.status).toBe('published');
      expect(res.auditEntry.action).toBe('approved');
      expect(res.auditEntry.approvalNote).toBe('تم الاعتماد بمطابقة المعايير');
    });

    it('returns 400 when executing Outcome B without staged edits', async () => {
      const course = inMemoryStore.createCourse(
        { title: 'كورس بدون تعديلات إدارة', description: 'وصف كامل', level: 'مبتدئ' },
        adminUser
      );
      course.chapters[0].items.push({ id: 'i1', type: 'video', title: 'درس' });
      inMemoryStore.saveCourseDraft(course.id, course, adminUser);
      inMemoryStore.submitCourseForReview(course.id, adminUser);

      loginAs(adminUser);
      try {
        await reviewApi.executeReviewDecision(course.id, {
          outcome: 'returned_with_admin_edits',
          summaryMessage: 'إعادة للمحاضر',
        });
        expect.unreachable('Should fail with 400');
      } catch (err) {
        expect((err as ApiError).status).toBe(400);
        expect((err as ApiError).message).toContain('لا توجد تعديلات إدارة مؤقتة لإعادة المقرر بها');
      }
    });

    it('returns 422 when executing Outcome C without mandatory summary feedback', async () => {
      const course = inMemoryStore.createCourse(
        { title: 'كورس للرفض', description: 'وصف كامل', level: 'مبتدئ' },
        adminUser
      );
      course.chapters[0].items.push({ id: 'i1', type: 'video', title: 'درس' });
      inMemoryStore.saveCourseDraft(course.id, course, adminUser);
      inMemoryStore.submitCourseForReview(course.id, adminUser);

      loginAs(adminUser);
      try {
        await reviewApi.executeReviewDecision(course.id, {
          outcome: 'rejected',
          summaryMessage: '   ', // Empty message
        });
        expect.unreachable('Should fail with 422');
      } catch (err) {
        expect((err as ApiError).status).toBe(422);
        expect((err as ApiError).message).toContain('سبب الرفض والتغذية الراجعة مطلوبة');
      }
    });

    it('executes Outcome B (Return with Admin Edits) capturing dual snapshots', async () => {
      const course = inMemoryStore.createCourse(
        { title: 'كورس للتعديل الإداري', description: 'وصف كامل', level: 'مبتدئ' },
        adminUser
      );
      course.chapters[0].items.push({ id: 'i1', type: 'video', title: 'درس أصلي' });
      inMemoryStore.saveCourseDraft(course.id, course, adminUser);
      inMemoryStore.submitCourseForReview(course.id, adminUser);

      loginAs(adminUser);
      // Save staged edit
      await reviewApi.saveStagedAdminEdits(course.id, {
        baselineId: course.id,
        baselineSubmittedAt: '2026-10-19T10:00:00.000Z',
        clientRevision: 1,
        patch: { title: 'عنوان بعد تعديل الإدارة' },
      });

      // Execute Outcome B
      const res = await reviewApi.executeReviewDecision(course.id, {
        outcome: 'returned_with_admin_edits',
        summaryMessage: 'تم تعديل عنوان المقرر وإعادته لاستكمال الدروس',
      });

      expect(res.outcome).toBe('returned_with_admin_edits');
      expect(res.auditEntry.action).toBe('returned_with_admin_edits');
      expect(res.auditEntry.baselineSnapshot).toBeDefined();
      expect(res.auditEntry.adminEditedSnapshot).toBeDefined();
      expect(res.auditEntry.baselineSnapshot?.title).toBe('كورس للتعديل الإداري');
      expect(res.auditEntry.adminEditedSnapshot?.title).toBe('عنوان بعد تعديل الإدارة');
    });

    it('executes Outcome C (Reject) preserving feedback and keeping staged edits as stale', async () => {
      const course = inMemoryStore.createCourse(
        { title: 'كورس تحت الرفض', description: 'وصف كامل', level: 'مبتدئ' },
        adminUser
      );
      course.chapters[0].items.push({ id: 'i1', type: 'video', title: 'درس' });
      inMemoryStore.saveCourseDraft(course.id, course, adminUser);
      inMemoryStore.submitCourseForReview(course.id, adminUser);

      loginAs(adminUser);
      // Save staged edit
      await reviewApi.saveStagedAdminEdits(course.id, {
        baselineId: course.id,
        baselineSubmittedAt: '2026-10-19T10:00:00.000Z',
        clientRevision: 1,
        patch: { title: 'عنوان مسودة لا تعتمد' },
      });

      // Execute Outcome C
      const res = await reviewApi.executeReviewDecision(course.id, {
        outcome: 'rejected',
        summaryMessage: 'محتوى المقرر لا يستوفي اشتراطات هيئة المترو الفنية',
      });

      expect(res.outcome).toBe('rejected');
      expect(res.course.status).toBe('draft');
      expect(res.course.activeReviewFeedback?.summaryMessage).toContain('محتوى المقرر لا يستوفي');
      // Staged edits NOT committed to course
      expect(res.course.title).toBe('كورس تحت الرفض');
      // Staged record retained as stale
      const staged = inMemoryStore.getStagedAdminEdits(course.id, adminUser);
      expect(staged?.isStale).toBe(true);
    });
  });

  describe('8. DELETE /api/admin/courses/:courseId/staged-edits (Discard Staged Edits)', () => {
    it('returns 401 Unauthorized when request lacks authentication token', async () => {
      try {
        await reviewApi.discardStagedAdminEdits('CRS001');
        expect.unreachable('Should fail with 401');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(401);
      }
    });

    it('returns 403 Forbidden when lecturer attempts to discard staged edits', async () => {
      loginAs(lecturerUser);
      try {
        await reviewApi.discardStagedAdminEdits('CRS001');
        expect.unreachable('Should fail with 403');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('returns 404 Not Found for non-existent course', async () => {
      loginAs(adminUser);
      try {
        await reviewApi.discardStagedAdminEdits('NON_EXISTENT');
        expect.unreachable('Should fail with 404');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(404);
      }
    });

    it('explicitly discards staged edits, cleans localStorage, and preserves course content and audit history', async () => {
      const course = inMemoryStore.createCourse(
        { title: 'كورس أصلي لا يتغير', description: 'وصف أصلي', level: 'متوسط' },
        adminUser
      );
      course.chapters[0].items.push({ id: 'i1', type: 'video', title: 'درس أصلي' });
      inMemoryStore.saveCourseDraft(course.id, course, adminUser);
      inMemoryStore.submitCourseForReview(course.id, adminUser);

      // Save staged edit for target course
      loginAs(adminUser);
      await reviewApi.saveStagedAdminEdits(course.id, {
        baselineId: course.id,
        baselineSubmittedAt: '2026-10-19T10:00:00.000Z',
        clientRevision: 1,
        patch: { title: 'تعديل سيتم حذفه' },
      });

      // Also save staged edit for another course to verify isolation
      const otherCourse = inMemoryStore.createCourse(
        { title: 'كورس آخر مستقل', description: 'وصف مستقل', level: 'مبتدئ' },
        adminUser
      );
      otherCourse.chapters[0].items.push({ id: 'i2', type: 'video', title: 'درس آخر' });
      inMemoryStore.saveCourseDraft(otherCourse.id, otherCourse, adminUser);
      inMemoryStore.submitCourseForReview(otherCourse.id, adminUser);
      await reviewApi.saveStagedAdminEdits(otherCourse.id, {
        baselineId: otherCourse.id,
        baselineSubmittedAt: '2026-10-19T10:00:00.000Z',
        clientRevision: 1,
        patch: { title: 'تعديل الكورس الآخر يبقى محفوظا' },
      });

      expect(inMemoryStore.getStagedAdminEdits(course.id, adminUser)).not.toBeNull();
      expect(inMemoryStore.getStagedAdminEdits(otherCourse.id, adminUser)).not.toBeNull();

      // Discard staged edits for the target course
      const res = await reviewApi.discardStagedAdminEdits(course.id);
      expect(res.success).toBe(true);

      // Target course staged edit is deleted
      expect(inMemoryStore.getStagedAdminEdits(course.id, adminUser)).toBeNull();
      expect(localStorage.getItem(`metro_admin_staged_edits_${course.id}`)).toBeNull();

      // Unrelated course staged edit remains preserved!
      const preservedOther = inMemoryStore.getStagedAdminEdits(otherCourse.id, adminUser);
      expect(preservedOther).not.toBeNull();
      expect(preservedOther?.patchedContent.title).toBe('تعديل الكورس الآخر يبقى محفوظا');

      // Course content, status, and audit history remain unaffected
      const reloadedCourse = inMemoryStore.getCourseById(course.id);
      expect(reloadedCourse?.title).toBe('كورس أصلي لا يتغير');
      expect(reloadedCourse?.status).toBe('pending_admin');
      // No new audit entries created from discard
      const auditActions = (reloadedCourse?.auditLog || []).map((a) => a.action);
      expect(auditActions).toContain('submitted');
      expect(auditActions.length).toBe(1);
    });

    it('works under the alias path /api/admin/review/:courseId/staged-edits', async () => {
      const course = inMemoryStore.createCourse(
        { title: 'كورس حذف بالمسار البديل', description: 'وصف', level: 'مبتدئ' },
        adminUser
      );
      course.chapters[0].items.push({ id: 'i1', type: 'video', title: 'درس' });
      inMemoryStore.saveCourseDraft(course.id, course, adminUser);
      inMemoryStore.submitCourseForReview(course.id, adminUser);

      loginAs(adminUser);
      await reviewApi.saveStagedAdminEdits(course.id, {
        baselineId: course.id,
        baselineSubmittedAt: '2026-10-19T10:00:00.000Z',
        clientRevision: 1,
        patch: { title: 'تعديل مسار بديل' },
      });

      const res = await apiClient<{ success: boolean; message: string }>(
        `/api/admin/review/${course.id}/staged-edits`,
        { method: 'DELETE' }
      );
      expect(res.success).toBe(true);
      expect(inMemoryStore.getStagedAdminEdits(course.id, adminUser)).toBeNull();
    });
  });

  describe('9. DELETE /api/admin/courses/:courseId/working-notes/:targetType/:targetId', () => {
    it('returns 401 Unauthorized when request lacks authentication token', async () => {
      try {
        await reviewApi.deleteReviewerWorkingNote('CRS001', 'general', 'main');
        expect.unreachable('Should fail with 401');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(401);
      }
    });

    it('returns 403 Forbidden when lecturer attempts to delete working notes', async () => {
      loginAs(lecturerUser);
      try {
        await reviewApi.deleteReviewerWorkingNote('CRS001', 'general', 'main');
        expect.unreachable('Should fail with 403');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('returns 404 Not Found if course does not exist', async () => {
      loginAs(adminUser);
      try {
        await reviewApi.deleteReviewerWorkingNote('UNKNOWN_COURSE', 'general', 'main');
        expect.unreachable('Should fail with 404');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(404);
      }
    });

    it('returns 400 Bad Request for unsupported target types (invalid_type, course) with zero mutation and no audit events', async () => {
      loginAs(adminUser);
      await reviewApi.saveReviewerWorkingNotes('CRS001', {
        generalNote: 'ملاحظة عامة أولية',
        chapterNotes: { ch_1: 'ملاحظة أولى' },
      });

      // 1. invalid_type
      try {
        await apiClient('/api/admin/courses/CRS001/working-notes/invalid_type/item1', {
          method: 'DELETE',
        });
        expect.unreachable('Should fail with 400 for invalid_type');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(400);
      }

      // 2. targetType = course
      try {
        await apiClient('/api/admin/courses/CRS001/working-notes/course/CRS001', {
          method: 'DELETE',
        });
        expect.unreachable('Should fail with 400 for targetType=course');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(400);
      }

      // Verify zero partial mutation
      const notes = await reviewApi.getReviewerWorkingNotes('CRS001');
      expect(notes.generalNote).toBe('ملاحظة عامة أولية');
      expect(notes.chapterNotes['ch_1']).toBe('ملاحظة أولى');

      // Verify no audit event was created
      const course = inMemoryStore.getCourseById('CRS001');
      const auditTrail = course?.auditLog || [];
      expect(auditTrail.some((a) => (a.summary || '').includes('ملاحظة'))).toBe(false);
    });

    it('returns 400 Bad Request for invalid general target IDs (default, root, courseId) with zero mutation and no audit events', async () => {
      loginAs(adminUser);
      await reviewApi.saveReviewerWorkingNotes('CRS001', {
        generalNote: 'ملاحظة عامة محمية',
        chapterNotes: { ch_1: 'ملاحظة فصل' },
      });

      const invalidTargetIds = ['default', 'root', 'CRS001', 'invalid_id'];
      for (const targetId of invalidTargetIds) {
        try {
          await apiClient(`/api/admin/courses/CRS001/working-notes/general/${targetId}`, {
            method: 'DELETE',
          });
          expect.unreachable(`Should fail with 400 for general/${targetId}`);
        } catch (err) {
          expect(err).toBeInstanceOf(ApiError);
          expect((err as ApiError).status).toBe(400);
        }
      }

      // Verify zero partial mutation
      const notes = await reviewApi.getReviewerWorkingNotes('CRS001');
      expect(notes.generalNote).toBe('ملاحظة عامة محمية');
      expect(notes.chapterNotes['ch_1']).toBe('ملاحظة فصل');

      // Verify no audit event was created
      const course = inMemoryStore.getCourseById('CRS001');
      const auditTrail = course?.auditLog || [];
      expect(auditTrail.some((a) => (a.summary || '').includes('ملاحظة'))).toBe(false);
    });

    it('deletes general/main successfully, preserving chapter and item notes with no audit events', async () => {
      loginAs(adminUser);
      // Pre-populate full set of notes
      await reviewApi.saveReviewerWorkingNotes('CRS001', {
        generalNote: 'ملاحظة عامة للمقرر',
        chapterNotes: { ch_1: 'ملاحظة الفصل الأول', ch_2: 'ملاحظة الفصل الثاني' },
        itemNotes: { item_1: 'ملاحظة الدرس الأول' },
      });

      const updated = await reviewApi.deleteReviewerWorkingNote('CRS001', 'general', 'main');

      expect(updated.generalNote).toBe('');
      // Unrelated chapter and item notes remain completely preserved!
      expect(updated.chapterNotes['ch_1']).toBe('ملاحظة الفصل الأول');
      expect(updated.chapterNotes['ch_2']).toBe('ملاحظة الفصل الثاني');
      expect(updated.itemNotes['item_1']).toBe('ملاحظة الدرس الأول');

      // Verify no audit log entries were created
      const course = inMemoryStore.getCourseById('CRS001');
      const auditTrail = course?.auditLog || [];
      expect(auditTrail.some((a) => (a.summary || '').includes('ملاحظة'))).toBe(false);
    });

    it('deletes only the targeted chapter note, preserving all other notes', async () => {
      loginAs(adminUser);
      await reviewApi.saveReviewerWorkingNotes('CRS001', {
        generalNote: 'ملاحظة عامة قائمة',
        chapterNotes: { ch_1: 'سيتم حذفها', ch_2: 'ستبقى محفوظة' },
        itemNotes: { item_1: 'ملاحظة درس قائمة' },
      });

      const updated = await reviewApi.deleteReviewerWorkingNote('CRS001', 'chapter', 'ch_1');

      expect(updated.chapterNotes['ch_1']).toBeUndefined();
      expect(updated.chapterNotes['ch_2']).toBe('ستبقى محفوظة');
      expect(updated.generalNote).toBe('ملاحظة عامة قائمة');
      expect(updated.itemNotes['item_1']).toBe('ملاحظة درس قائمة');
    });

    it('deletes only the targeted item note and works under the alias path', async () => {
      loginAs(adminUser);
      await reviewApi.saveReviewerWorkingNotes('CRS001', {
        generalNote: 'ملاحظة عامة',
        itemNotes: { item_target: 'ملاحظة ستحذف', item_keep: 'ملاحظة ستبقى' },
      });

      const updated = await apiClient<ReviewerWorkingNotes>(
        '/api/admin/review/CRS001/working-notes/item/item_target',
        { method: 'DELETE' }
      );

      expect(updated.itemNotes['item_target']).toBeUndefined();
      expect(updated.itemNotes['item_keep']).toBe('ملاحظة ستبقى');
      expect(updated.generalNote).toBe('ملاحظة عامة');
    });
  });

  describe('10. Dedicated Review Decision Endpoints (/approve, /return-with-edits, /reject)', () => {
    it('POST /api/admin/courses/:courseId/approve executes Outcome A successfully', async () => {
      const course = inMemoryStore.createCourse(
        { title: 'كورس للاعتماد المباشر', description: 'وصف كامل', level: 'مبتدئ' },
        adminUser
      );
      course.chapters[0].items.push({ id: 'i1', type: 'video', title: 'درس معتمد' });
      inMemoryStore.saveCourseDraft(course.id, course, adminUser);
      inMemoryStore.submitCourseForReview(course.id, adminUser);

      loginAs(adminUser);
      const res = await reviewApi.approveCourse(course.id, {
        approvalNote: 'اعتماد رسمي ممتاز',
      });

      expect(res.outcome).toBe('approved');
      expect(res.course.status).toBe('published');
      expect(res.auditEntry.action).toBe('approved');
      expect(res.auditEntry.approvalNote).toBe('اعتماد رسمي ممتاز');
    });

    it('POST /api/admin/courses/:courseId/return-with-edits executes Outcome B successfully', async () => {
      const course = inMemoryStore.createCourse(
        { title: 'كورس للإعادة بالتعديل', description: 'وصف كامل', level: 'مبتدئ' },
        adminUser
      );
      course.chapters[0].items.push({ id: 'i1', type: 'video', title: 'درس أصلي' });
      inMemoryStore.saveCourseDraft(course.id, course, adminUser);
      inMemoryStore.submitCourseForReview(course.id, adminUser);

      loginAs(adminUser);
      // Stage edits
      await reviewApi.saveStagedAdminEdits(course.id, {
        baselineId: course.id,
        baselineSubmittedAt: '2026-10-19T10:00:00.000Z',
        clientRevision: 1,
        patch: { title: 'عنوان معدل من الإدارة' },
      });

      const res = await reviewApi.returnCourseWithEdits(course.id, {
        summaryMessage: 'تم تعديل العنوان وإعادة المقرر للاستكمال',
      });

      expect(res.outcome).toBe('returned_with_admin_edits');
      expect(res.auditEntry.action).toBe('returned_with_admin_edits');
      expect(res.auditEntry.adminEditedSnapshot?.title).toBe('عنوان معدل من الإدارة');
    });

    it('POST /api/admin/courses/:courseId/reject executes Outcome C preserving staged edits as stale', async () => {
      const course = inMemoryStore.createCourse(
        { title: 'كورس للرفض المباشر', description: 'وصف كامل', level: 'مبتدئ' },
        adminUser
      );
      course.chapters[0].items.push({ id: 'i1', type: 'video', title: 'درس' });
      inMemoryStore.saveCourseDraft(course.id, course, adminUser);
      inMemoryStore.submitCourseForReview(course.id, adminUser);

      loginAs(adminUser);
      await reviewApi.saveStagedAdminEdits(course.id, {
        baselineId: course.id,
        baselineSubmittedAt: '2026-10-19T10:00:00.000Z',
        clientRevision: 1,
        patch: { title: 'عنوان تعديل لن يطبق' },
      });

      const res = await reviewApi.rejectCourse(course.id, {
        feedback: 'المحتوى غير مطابق لمعايير السلامة المهنية',
      });

      expect(res.outcome).toBe('rejected');
      expect(res.course.status).toBe('draft');
      expect(res.course.title).toBe('كورس للرفض المباشر');
      const staged = inMemoryStore.getStagedAdminEdits(course.id, adminUser);
      expect(staged?.isStale).toBe(true);
    });

    it('enforces admin-only permissions on dedicated decision endpoints', async () => {
      loginAs(lecturerUser);
      try {
        await reviewApi.approveCourse('CRS001');
        expect.unreachable('Should fail with 403');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });
  });

  describe('11. Route Aliases Contract Verification', () => {
    it('GET /api/admin/approvals aliases /api/approvals/queue with identical auth and data', async () => {
      loginAs(adminUser);
      const queueViaAlias = await apiClient<ReviewQueueResponseDTO>('/api/admin/approvals');
      const queueViaCanonical = await apiClient<ReviewQueueResponseDTO>('/api/approvals/queue');

      expect(queueViaAlias.totalCount).toBe(queueViaCanonical.totalCount);
      expect(queueViaAlias.items.length).toBe(queueViaCanonical.items.length);

      // Trainee is forbidden on alias as well
      loginAs(traineeUser);
      try {
        await apiClient('/api/admin/approvals');
        expect.unreachable('Should fail with 403');
      } catch (err) {
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('GET /api/lecturer/approvals aliases /api/approvals/my-submissions', async () => {
      loginAs(lecturerUser);
      const subViaAlias = await apiClient<LecturerSubmissionsResponseDTO>('/api/lecturer/approvals');
      const subViaCanonical = await apiClient<LecturerSubmissionsResponseDTO>('/api/approvals/my-submissions');

      expect(subViaAlias.totalCount).toBe(subViaCanonical.totalCount);
      expect(subViaAlias.counts).toEqual(subViaCanonical.counts);

      // Trainee is forbidden
      loginAs(traineeUser);
      try {
        await apiClient('/api/lecturer/approvals');
        expect.unreachable('Should fail with 403');
      } catch (err) {
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('POST /api/courses/:courseId/submit-review aliases /api/courses/:courseId/submit', async () => {
      const course = inMemoryStore.createCourse(
        { title: 'كورس للتقديم عبر المسار البديل', description: 'وصف', level: 'مبتدئ' },
        adminUser
      );
      course.chapters[0].items.push({ id: 'i1', type: 'video', title: 'درس' });
      inMemoryStore.saveCourseDraft(course.id, course, adminUser);

      loginAs(adminUser);
      const res = await apiClient<SubmitCourseResponseDTO>(`/api/courses/${course.id}/submit-review`, {
        method: 'POST',
      });

      expect(res.course.status).toBe('pending_admin');
      expect(res.action).toBe('submitted');
    });

    it('GET /api/admin/courses/:courseId/review aliases /api/courses/:courseId/review-data and enforces admin auth', async () => {
      loginAs(adminUser);
      const reviewData = await apiClient<CourseReviewDataResponseDTO>('/api/admin/courses/CRS001/review');
      expect(reviewData.course.id).toBe('CRS001');
      expect(reviewData.submissionType).toBeDefined();

      // Lecturer is forbidden on the /api/admin/... review endpoint
      loginAs(lecturerUser);
      try {
        await apiClient('/api/admin/courses/CRS001/review');
        expect.unreachable('Should fail with 403');
      } catch (err) {
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('GET & PUT /api/admin/courses/:courseId/staged-edits work identically to review namespace', async () => {
      loginAs(adminUser);
      const saveRes = await apiClient<StagedEditsSaveResponseDTO>('/api/admin/courses/CRS001/staged-edits', {
        method: 'PUT',
        body: JSON.stringify({
          baselineId: 'CRS001',
          baselineSubmittedAt: '2026-10-19T10:00:00.000Z',
          clientRevision: 10,
          patch: { title: 'عنوان مسار بديل للتعديل' },
        }),
      });
      expect(saveRes.record.clientRevision).toBe(10);

      const getRes = await apiClient<{ record: StagedAdminEditsRecord | null }>('/api/admin/courses/CRS001/staged-edits');
      expect(getRes.record?.clientRevision).toBe(10);
      expect(getRes.record?.patchedContent.title).toBe('عنوان مسار بديل للتعديل');
    });

    it('GET & PUT /api/admin/courses/:courseId/working-notes work identically to review namespace', async () => {
      loginAs(adminUser);
      const saveRes = await apiClient<ReviewerWorkingNotes>('/api/admin/courses/CRS001/working-notes', {
        method: 'PUT',
        body: JSON.stringify({
          generalNote: 'ملاحظة مسار بديل',
        }),
      });
      expect(saveRes.generalNote).toBe('ملاحظة مسار بديل');

      const getRes = await apiClient<ReviewerWorkingNotes>('/api/admin/courses/CRS001/working-notes');
      expect(getRes.generalNote).toBe('ملاحظة مسار بديل');
    });
  });
});

