/**
 * Increment 4.2: Approval Lifecycle, Execution & Security Hardening
 *
 * Grounded in:
 * - docs/backend/pre-backend-migration-remediation-roadmap.md (Revision 5, Phase 4, Increment 4.2)
 * - MFR-31 (Complete approval execution branches & draft merge)
 * - MFR-44 (Replay prevention 409 ALREADY_DECIDED, approver expansion, INV-R6 anti-self-approval, INV-R10 revalidation)
 * - INV-R9 (Default approval for assistant_admin)
 *
 * TEST EXECUTION DIRECTIVE:
 * STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
 * Zero test runner commands (vitest, npm test, tsc, eslint) were executed during this increment.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { server } from '@/mocks/server';
import { inMemoryStore, MockStoreError } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import type { User } from '@/core/auth/types';
import type { Course } from '@/core/courses/types';

describe('Increment 4.2 — Approval Lifecycle, Execution & Security Hardening', () => {
  // Actors
  const adminActor: User = {
    id: 'usr_admin_001',
    name: 'م. محمود عبد السلام',
    email: 'admin@cairo-metro.com',
    role: 'admin',
    department: 'الإدارة العامة للتشغيل',
    jobTitle: 'مدير عام أنظمة التشغيل',
    initials: 'م.ع',
  };

  const superAdminActor: User = {
    id: 'USR_SUPER_001',
    name: 'م. ياسين رضوان',
    email: 'superadmin@cairo-metro.com',
    role: 'super_admin',
    department: 'الإدارة العليا',
    jobTitle: 'المسؤول الأعلى للأنظمة',
    initials: 'ي.ر',
  };

  const developerActor: User = {
    id: 'USR_DEV_001',
    name: 'مطور النظام',
    email: 'developer.metro@internal.local',
    role: 'developer',
    department: 'هندسة البرمجيات والتطوير',
    jobTitle: 'كبير مهندسي النظام',
    initials: 'م.ن',
  };

  const assistantActor: User = {
    id: 'USR016',
    name: 'أحمد شريف (مساعد مدير)',
    email: 'assistant.admin@metro.gov.eg',
    role: 'assistant_admin',
    department: 'الإدارة العامة لتكنولوجيا المعلومات',
    jobTitle: 'مساعد مدير نظام',
    initials: 'أ.ش',
  };

  const traineeActor: User = {
    id: 'usr_trainee_003',
    name: 'أحمد ممدوح سالم',
    email: 'trainee@cairo-metro.com',
    role: 'user',
    department: 'قطاع صيانة الوحدات المتحركة',
    jobTitle: 'فني صيانة قطارات أول',
    initials: 'أ.م',
  };

  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterEach(() => {
    server.resetHandlers();
    authStorage.clearSession();
    inMemoryStore.setTestDecisionDelay(0);
    inMemoryStore.reset({ seedGroupDemo: true });
  });
  afterAll(() => server.close());

  beforeEach(() => {
    inMemoryStore.reset({ seedGroupDemo: true });
  });

  // ── 1. Approver Eligibility (MFR-44) ──────────────────────────────────────

  describe('1. Approver Eligibility & Role Ceilings (MFR-44)', () => {
    it('1.1. allows regular admin (usr_admin_001) to approve an eligible request', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'أرشفة مجموعة مكتملة',
        payload: { groupId: 'GRP-101' },
      });

      const approved = inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
      expect(approved.status).toBe('approved');
      expect(approved.reviewedBy).toBe(adminActor.id);
    });

    it('1.2. allows super_admin (USR_SUPER_001) to approve an eligible request', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'أرشفة مجموعة عبر السوبر أدمن',
        payload: { groupId: 'GRP-101' },
      });

      const approved = inMemoryStore.approveApprovalRequest(req.id, superAdminActor.id);
      expect(approved.status).toBe('approved');
      expect(approved.reviewedBy).toBe(superAdminActor.id);
    });

    it('1.3. allows developer (USR_DEV_001) to approve an eligible request', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'أرشفة مجموعة عبر المطور',
        payload: { groupId: 'GRP-101' },
      });

      const approved = inMemoryStore.approveApprovalRequest(req.id, developerActor.id);
      expect(approved.status).toBe('approved');
      expect(approved.reviewedBy).toBe(developerActor.id);
    });

    it('1.4. forbids assistant_admin from deciding approval requests (HTTP 403)', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: 'USR_ANOTHER_ASSISTANT',
        justification: 'محاولة غير مصرحة',
        payload: { groupId: 'GRP-101' },
      });

      expect(() => {
        inMemoryStore.approveApprovalRequest(req.id, assistantActor.id);
      }).toThrowError(MockStoreError);

      try {
        inMemoryStore.approveApprovalRequest(req.id, assistantActor.id);
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
      }
    });

    it('1.5. forbids regular user/trainee from deciding approval requests (HTTP 403)', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'محاولة متدرب',
        payload: { groupId: 'GRP-101' },
      });

      expect(() => {
        inMemoryStore.approveApprovalRequest(req.id, traineeActor.id);
      }).toThrowError(MockStoreError);

      try {
        inMemoryStore.approveApprovalRequest(req.id, traineeActor.id);
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
      }
    });
  });

  // ── 2. Anti-Self-Approval (INV-R6 / INV-R10) ──────────────────────────────

  describe('2. Anti-Self-Approval (INV-R6 / INV-R10)', () => {
    it('2.1. rejects requester attempting to approve their own request (INV-R6)', () => {
      // Admin creates an approval request for a sensitive action
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: adminActor.id,
        justification: 'طلب إداري من مدير النظام نفسه',
        payload: { groupId: 'GRP-101' },
      });

      expect(() => {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
      }).toThrowError(MockStoreError);

      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
        expect((err as MockStoreError).code).toBe('INVARIANT_ANTI_SELF_APPROVAL');
      }
    });

    it('2.2. prevents alias-based bypass of anti-self-approval rule', () => {
      // Request submitted with canonical ID 'USR001'
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: 'USR001',
        justification: 'طلب بواسطة المعرف الأساسي',
        payload: { groupId: 'GRP-101' },
      });

      // Same user attempts approval using legacy alias 'admin'
      expect(() => {
        inMemoryStore.approveApprovalRequest(req.id, 'admin');
      }).toThrowError(MockStoreError);

      try {
        inMemoryStore.approveApprovalRequest(req.id, 'admin');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
        expect((err as MockStoreError).code).toBe('INVARIANT_ANTI_SELF_APPROVAL');
      }
    });
  });

  // ── 3. Replay Protection & Single Execution (MFR-44) ──────────────────────

  describe('3. Replay Protection & Single Execution (MFR-44)', () => {
    it('3.1. returns 409 ALREADY_DECIDED when attempting to re-approve an approved request', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'أرشفة مجموعة',
        payload: { groupId: 'GRP-101' },
      });

      // First decision succeeds
      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

      // Replay attempt throws 409 ALREADY_DECIDED
      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
        expect.unreachable('Must throw 409 ALREADY_DECIDED');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(409);
        expect((err as MockStoreError).code).toBe('ALREADY_DECIDED');
      }
    });

    it('3.2. returns 409 ALREADY_DECIDED when attempting to re-reject a rejected request', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'أرشفة مجموعة',
        payload: { groupId: 'GRP-101' },
      });

      // First rejection succeeds
      inMemoryStore.rejectApprovalRequest(req.id, adminActor.id, 'رفض لدواعي تشغيلية');

      // Replay attempt throws 409 ALREADY_DECIDED
      try {
        inMemoryStore.rejectApprovalRequest(req.id, adminActor.id);
        expect.unreachable('Must throw 409 ALREADY_DECIDED');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(409);
        expect((err as MockStoreError).code).toBe('ALREADY_DECIDED');
      }
    });

    it('3.3. returns 409 ALREADY_DECIDED when attempting to approve a previously rejected request', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'أرشفة مجموعة',
        payload: { groupId: 'GRP-101' },
      });

      inMemoryStore.rejectApprovalRequest(req.id, adminActor.id);

      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
        expect.unreachable('Must throw 409 ALREADY_DECIDED');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(409);
        expect((err as MockStoreError).code).toBe('ALREADY_DECIDED');
      }
    });

    it('3.4. mutation failure sets status to failed_execution and does not mark approved', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-NONEXISTENT',
        requestedBy: assistantActor.id,
        justification: 'محاولة أرشفة مجموعة غير موجودة',
        payload: { groupId: 'GRP-NONEXISTENT' },
      });

      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
      } catch {
        // Expected failure
      }

      const pendingList = inMemoryStore.getApprovalRequests();
      const updatedReq = pendingList.find((r) => r.id === req.id);
      expect(updatedReq).toBeDefined();
      expect(updatedReq?.status).toBe('failed_execution');
      expect(updatedReq?.executionError).toBeDefined();

      // Subsequent attempt on failed_execution also returns 409 ALREADY_DECIDED
      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
        expect.unreachable('Must throw 409');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(409);
        expect((err as MockStoreError).code).toBe('ALREADY_DECIDED');
      }
    });
  });

  // ── 4. Approval-Time Revalidation (INV-R10) ───────────────────────────────

  describe('4. Approval-Time Revalidation (INV-R10)', () => {
    it('4.1. rejects approval when target course was deleted prior to decision (404)', () => {
      const courseId = 'course-temp';
      inMemoryStore.createCourse({ title: 'مقرر مؤقت للحذف', level: 'beginner' }, adminActor);

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'courses.publish',
        targetId: courseId,
        requestedBy: assistantActor.id,
        justification: 'نشر مقرر مؤقت',
        payload: { courseId },
      });

      // Target course is deleted before approver reviews the request
      inMemoryStore.deleteCourse(courseId);

      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
        expect.unreachable('Must fail revalidation with 404');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(404);
      }
    });

    it('4.2. rejects approval when target group was deleted prior to decision (404)', () => {
      const groupId = 'GRP-101';
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.edit_config',
        targetId: groupId,
        requestedBy: assistantActor.id,
        justification: 'تعديل مجموعة محذوفة',
        payload: { groupId, name: 'اسم جديد' },
      });

      // Target group deleted
      inMemoryStore.deleteGroup(groupId);

      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
        expect.unreachable('Must fail revalidation with 404');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(404);
      }
    });

    it('4.3. fails closed when action type is unsupported or unknown (400)', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'arbitrary_module.unknown_mutation' as any,
        targetId: 'XYZ',
        requestedBy: assistantActor.id,
        justification: 'عملية غير معتمدة',
        payload: {},
      });

      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
        expect.unreachable('Must fail closed on unknown action');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(400);
      }
    });
  });

  // ── 5. Complete Approval Execution Branches (MFR-31) ──────────────────────

  describe('5. Complete Approval Execution Branches (MFR-31)', () => {
    // 5.1. Courses: courses.publish draft merge
    it('5.1. courses.publish merges pending draft into live course and resets flags', () => {
      const courseId = 'course-1';
      const courseBefore = inMemoryStore.getCourseById(courseId);
      expect(courseBefore).toBeDefined();

      // Lecturer saves a draft with updated title and duration
      inMemoryStore.saveCourseDraft(
        courseId,
        {
          title: 'أنظمة التحكم الآلي للمترو (إصدار معتمد مطور)',
          estimatedHours: 12,
        },
        adminActor
      );

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'courses.publish',
        targetId: courseId,
        requestedBy: assistantActor.id,
        justification: 'اعتماد ونشر تحديثات المقرر',
        payload: { courseId },
      });

      // Admin approves
      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

      const courseAfter = inMemoryStore.getCourseById(courseId);
      expect(courseAfter?.status).toBe('published');
      expect(courseAfter?.title).toBe('أنظمة التحكم الآلي للمترو (إصدار معتمد مطور)');
      expect(courseAfter?.estimatedHours).toBe(12);
      expect(courseAfter?.isUpdatePendingApproval).toBe(false);
      expect(courseAfter?.hasDraftChanges).toBe(false);
      expect(courseAfter?.publishedAt).toBeDefined();
    });

    // 5.2. Courses: courses.create
    it('5.2. courses.create instantiates new course in draft status', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'courses.create',
        requestedBy: assistantActor.id,
        justification: 'إنشاء مسار تدريبي جديد للسلامة المهنية',
        payload: {
          title: 'دورة السلامة المهنية ومكافحة الحريق في الأنفاق',
          level: 'beginner',
          description: 'إجراءات السلامة القياسية لمحطات وقطارات المترو',
        },
      });

      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

      const allCourses = inMemoryStore.getCourses();
      const created = allCourses.find((c) =>
        c.title.includes('دورة السلامة المهنية ومكافحة الحريق')
      );
      expect(created).toBeDefined();
      expect(created?.status).toBe('draft');
    });

    // 5.3. Reviews: reviews.submit_course
    it('5.3. reviews.submit_course transitions course to under_review', () => {
      const courseId = 'course-1';
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'reviews.submit_course',
        targetId: courseId,
        requestedBy: assistantActor.id,
        justification: 'تقديم الدورة للمراجعة والاعتماد',
        payload: { courseId },
      });

      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

      const courseAfter = inMemoryStore.getCourseById(courseId);
      expect(courseAfter?.submittedAt).toBeDefined();
    });

    // 5.4. Groups: groups.create
    it('5.4. groups.create registers new training group in cohort collection', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.create',
        requestedBy: assistantActor.id,
        justification: 'إنشاء دفعة متدربي الخط الرابع',
        payload: {
          name: 'دفعة صيانة الخط الرابع 2026',
          description: 'المجموعة المخصصة للدفعة الجديدة',
          startDateTime: '2026-06-01T08:00:00Z',
          deadlineDateTime: '2026-08-31T16:00:00Z',
          postDeadlinePolicy: 'keep_no_cert',
        },
      });

      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

      const groups = inMemoryStore.getGroups();
      const createdGroup = groups.find((g) => g.name === 'دفعة صيانة الخط الرابع 2026');
      expect(createdGroup).toBeDefined();
      expect(createdGroup?.adminStatus).toBe('active');
    });

    // 5.5. Groups: groups.edit_config preserves isolated payload and strips resources
    it('5.5. groups.edit_config updates metadata and strips resources field', () => {
      const groupId = 'GRP-101';
      const originalGroup = inMemoryStore.getGroupById(groupId);
      const originalResources = originalGroup?.resources || [];

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.edit_config',
        targetId: groupId,
        requestedBy: assistantActor.id,
        justification: 'تحديث سعة المجموعة التدريبية',
        payload: {
          groupId,
          maxTrainees: 45,
          resources: [{ id: 'meeting-injected', title: 'محاولة تعديل موارد' }], // Should be stripped!
        },
      });

      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

      const updatedGroup = inMemoryStore.getGroupById(groupId);
      expect(updatedGroup?.maxTrainees).toBe(45);
      // Injected resources must NOT have been applied by config approval
      expect(updatedGroup?.resources?.some((r) => r.id === 'meeting-injected')).toBe(false);
    });

    // 5.6. Groups: materials.manage_meetings strictly executes meetings and ignores config
    it('5.6. materials.manage_meetings updates resources and cannot alter group metadata', () => {
      const groupId = 'GRP-101';
      const groupBefore = inMemoryStore.getGroupById(groupId);
      const originalName = groupBefore!.name;
      const originalMax = groupBefore!.maxTrainees;

      const meetingResource = {
        id: 'meeting-iso-approved',
        type: 'zoom',
        title: 'ورشة عمل صيانة الإشارات المعتمدة',
        url: 'https://zoom.us/j/777888',
      };

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'materials.manage_meetings',
        targetId: groupId,
        requestedBy: assistantActor.id,
        justification: 'جدولة ورشة عمل تفاعلية',
        payload: {
          groupId,
          resources: [...(groupBefore?.resources || []), meetingResource],
          name: 'محاولة تغيير اسم المجموعة خلسة', // Should be ignored!
          maxTrainees: 9999, // Should be ignored!
        },
      });

      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

      const groupAfter = inMemoryStore.getGroupById(groupId);
      expect(groupAfter?.resources?.some((r) => r.id === 'meeting-iso-approved')).toBe(true);
      expect(groupAfter?.name).toBe(originalName);
      expect(groupAfter?.maxTrainees).toBe(originalMax);
    });

    // 5.7. Groups: groups.manage_members
    it('5.7. groups.manage_members adds trainees and respects maxTrainees ceiling', () => {
      const groupId = 'GRP-101';
      const traineeId = 'USR003';

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.manage_members',
        targetId: groupId,
        requestedBy: assistantActor.id,
        justification: 'إضافة متدربين للمجموعة',
        payload: {
          groupId,
          traineeIds: [traineeId],
        },
      });

      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

      const members = inMemoryStore.getGroupMembers(groupId);
      expect(members.some((m) => m.userId.toLowerCase() === traineeId.toLowerCase())).toBe(true);
    });

    // 5.8. Groups: groups.generate_qr
    it('5.8. groups.generate_qr rotates enrollment token upon approval', () => {
      const groupId = 'GRP-101';
      const groupBefore = inMemoryStore.getGroupById(groupId);
      const tokenBefore = groupBefore?.enrollmentCode;

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.generate_qr',
        targetId: groupId,
        requestedBy: assistantActor.id,
        justification: 'تجديد رمز الاستجابة السريعة للمجموعة',
        payload: { groupId, action: 'rotate' },
      });

      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

      const groupAfter = inMemoryStore.getGroupById(groupId);
      expect(groupAfter?.enrollmentCode).toBeDefined();
      expect(groupAfter?.enrollmentCode).not.toBe(tokenBefore);
    });

    // 5.9. Materials: materials.manage_folders
    it('5.9. materials.manage_folders creates library folder upon approval', () => {
      const groupId = 'GRP-101';
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'materials.manage_folders',
        targetId: groupId,
        requestedBy: assistantActor.id,
        justification: 'إنشاء مجلد تدريبي للمواد التعليمية',
        payload: {
          groupId,
          name: 'المخططات الهندسية المعتمدة',
          description: 'مخططات ومسارات الخط الأول',
        },
      });

      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

      const materials = inMemoryStore.getGroupMaterials(groupId, 'admin');
      const folder = materials.folders.find((f) => f.name === 'المخططات الهندسية المعتمدة');
      expect(folder).toBeDefined();
    });

    // 5.10. Comments: comments.ignore_report
    it('5.10. comments.ignore_report clears reported status upon approval', () => {
      const commentId = 'comm_rep_001';
      const commentBefore = inMemoryStore.getCommentById(commentId);
      expect(commentBefore?.reported).toBe(true);

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'comments.ignore_report',
        targetId: commentId,
        requestedBy: assistantActor.id,
        justification: 'تجاهل بلاغ كيدي',
        payload: { commentId },
      });

      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

      const commentAfter = inMemoryStore.getCommentById(commentId);
      expect(commentAfter?.reported).toBe(false);
      expect(commentAfter?.reportReason).toBeNull();
    });

    // 5.11. Comments: comments.delete
    it('5.11. comments.delete permanently deletes reported comment upon approval', () => {
      const commentId = 'comm_rep_001';
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'comments.delete',
        targetId: commentId,
        requestedBy: assistantActor.id,
        justification: 'حذف تعليق مخالف للائحة التدريب',
        payload: { commentId },
      });

      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

      const commentAfter = inMemoryStore.getCommentById(commentId);
      expect(commentAfter).toBeUndefined();
    });

    // 5.12. Groups: groups.assign_courses
    it('5.12. groups.assign_courses assigns courses to cycle upon approval', () => {
      const groupId = 'GRP-101';
      const group = inMemoryStore.getGroupById(groupId);
      expect(group).toBeDefined();

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.assign_courses',
        targetId: groupId,
        requestedBy: assistantActor.id,
        justification: 'تعيين مقررات للدورة التدريبية',
        payload: {
          groupId,
          cycleId: group!.currentCycleId || 'CYC-101',
          courses: [
            {
              courseId: 'course-1',
              orderIndex: 0,
              passingScore: 70,
              isMandatory: true,
            },
          ],
        },
      });

      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

      const updatedGroup = inMemoryStore.getGroupById(groupId);
      expect(updatedGroup).toBeDefined();
    });

    // 5.13. Groups: groups.review_join_requests
    it('5.13. groups.review_join_requests approves trainee join request upon approval', () => {
      const joinReq = inMemoryStore.getGroupJoinRequests()[0];
      if (joinReq) {
        const req = inMemoryStore.createApprovalRequest({
          actionType: 'groups.review_join_requests',
          targetId: joinReq.id,
          requestedBy: assistantActor.id,
          justification: 'اعتماد قبول طلب انضمام متدرب',
          payload: {
            requestId: joinReq.id,
            decision: 'approved',
            reviewNote: 'مستوفي شروط الالتحاق',
          },
        });

        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

        const updatedJoinReq = inMemoryStore.getGroupJoinRequests().find((r) => r.id === joinReq.id);
        expect(updatedJoinReq?.status).toBe('approved');
      }
    });

    // 5.14. Materials: materials.delete_files
    it('5.14. materials.delete_files removes file and updates folder count upon approval', () => {
      const groupId = 'GRP-101';
      const materials = inMemoryStore.getGroupMaterials(groupId, 'admin');
      const targetFile = materials.files[0];
      if (targetFile) {
        const req = inMemoryStore.createApprovalRequest({
          actionType: 'materials.delete_files',
          targetId: targetFile.id,
          requestedBy: assistantActor.id,
          justification: 'حذف ملف ملغى',
          payload: {
            groupId,
            fileId: targetFile.id,
            action: 'delete',
          },
        });

        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

        const materialsAfter = inMemoryStore.getGroupMaterials(groupId, 'admin');
        expect(materialsAfter.files.some((f) => f.id === targetFile.id)).toBe(false);
      }
    });

    // 5.15. Comments: comments.toggle
    it('5.15. comments.toggle changes course comments enabled state upon approval', () => {
      const courseId = 'course-1';
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'comments.toggle',
        targetId: courseId,
        requestedBy: assistantActor.id,
        justification: 'إيقاف التعليقات مؤقتاً لأعمال الصيانة',
        payload: {
          courseId,
          commentsEnabled: false,
        },
      });

      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

      const course = inMemoryStore.getCourseById(courseId);
      expect(course?.commentsEnabled).toBe(false);
    });

    // 5.16. Courses: courses.edit_metadata
    it('5.16. courses.edit_metadata updates course draft metadata upon approval', () => {
      const courseId = 'course-1';
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'courses.edit_metadata',
        targetId: courseId,
        requestedBy: assistantActor.id,
        justification: 'تحديث وصف المقرر الإرشادي',
        payload: {
          courseId,
          description: 'الوصف الجديد المحدث للسلامة في مترو القاهرة',
        },
      });

      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

      const draft = inMemoryStore.getCourseDraft(courseId);
      expect(draft?.description).toBe('الوصف الجديد المحدث للسلامة في مترو القاهرة');
    });

    // 5.17. Courses: courses.edit_curriculum
    it('5.17. courses.edit_curriculum updates curriculum sections in course draft', () => {
      const courseId = 'course-1';
      const newSections = [
        {
          id: 'sec-new-1',
          title: 'الوحدة التدريبية الجديدة المعتمدة',
          order: 1,
          lessons: [
            {
              id: 'les-new-1',
              title: 'مقدمة فحص المسارات',
              duration: '15:00',
              order: 1,
            },
          ],
        },
      ];

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'courses.edit_curriculum',
        targetId: courseId,
        requestedBy: assistantActor.id,
        justification: 'إعادة هيكلة المنهج التدريبي',
        payload: {
          courseId,
          sections: newSections,
        },
      });

      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

      const draft = inMemoryStore.getCourseDraft(courseId);
      expect(draft?.sections?.[0]?.title).toBe('الوحدة التدريبية الجديدة المعتمدة');
    });

    // 5.18. Permissions: permissions.configure_departments
    it('5.18. permissions.configure_departments updates department tracks upon approval', () => {
      const deptId = 'operation';
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'permissions.configure_departments',
        targetId: deptId,
        requestedBy: assistantActor.id,
        justification: 'إضافة مسار إشارات التحكم للتشغيل',
        payload: {
          departmentId: deptId,
          allowedTracks: ['general', 'safety', 'signals'],
        },
      });

      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

      const depts = inMemoryStore.getDepartmentConfigs();
      const updatedDept = depts.find((d) => d.departmentId === deptId);
      expect(updatedDept?.allowedTracks).toContain('signals');
    });
  });

  // ── 6. Approval Notifications & Deep Link Routing (MFR-31) ────────────────

  describe('6. Approval Notifications & Deep Link Routing (MFR-31)', () => {
    it('6.1. createApprovalRequest notifies administrators with targetUrl pointing to /approvals', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'فحص رابط الإشعار الإداري',
        payload: { groupId: 'GRP-101' },
      });

      const adminNotifications = inMemoryStore.getUserNotifications(adminActor.id);
      const notif = adminNotifications.find((n) => n.requestId === req.id);
      expect(notif).toBeDefined();
      expect(notif?.targetUrl).toBe('/approvals');
    });

    it('6.2. approveApprovalRequest notifies requester with targetUrl pointing to /approvals', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'فحص رابط إشعار الاعتماد',
        payload: { groupId: 'GRP-101' },
      });

      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

      const requesterNotifications = inMemoryStore.getUserNotifications(assistantActor.id);
      const approvalNotif = requesterNotifications.find(
        (n) => n.requestId === req.id && n.title === 'تم اعتماد طلب الحوكمة الإداري'
      );
      expect(approvalNotif).toBeDefined();
      expect(approvalNotif?.targetUrl).toBe('/approvals');
    });

    it('6.3. rejectApprovalRequest notifies requester with targetUrl pointing to /approvals', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'فحص رابط إشعار الرفض',
        payload: { groupId: 'GRP-101' },
      });

      inMemoryStore.rejectApprovalRequest(req.id, adminActor.id, 'رفض للتجربة');

      const requesterNotifications = inMemoryStore.getUserNotifications(assistantActor.id);
      const rejectNotif = requesterNotifications.find(
        (n) => n.requestId === req.id && n.title === 'تم رفض طلب الحوكمة الإداري'
      );
      expect(rejectNotif).toBeDefined();
      expect(rejectNotif?.targetUrl).toBe('/approvals');
    });
  });

  // ── 7. Course Draft Version Integrity & Anti-Stale Guardrails ───────────────

  describe('7. Course Draft Version Integrity & Anti-Stale Guardrails', () => {
    it('7.1. publishes and merges course draft when draft is intact and unmodified', () => {
      const courseId = 'course-1';
      inMemoryStore.saveCourseDraft(
        courseId,
        { title: 'أنظمة التحكم للمترو - إصدار متوافق ومحدث' },
        adminActor
      );

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'courses.publish',
        targetId: courseId,
        requestedBy: assistantActor.id,
        justification: 'اعتماد مسودة متكاملة',
        payload: { courseId },
      });

      const approved = inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
      expect(approved.status).toBe('approved');

      const course = inMemoryStore.getCourseById(courseId);
      expect(course?.title).toBe('أنظمة التحكم للمترو - إصدار متوافق ومحدث');
      expect(course?.status).toBe('published');
      expect(inMemoryStore.getCourseDraft(courseId)).toBeUndefined();
    });

    it('7.2. rejects approval with 409 DRAFT_MODIFIED_CONFLICT when draft was edited after request creation', () => {
      const courseId = 'course-1';
      inMemoryStore.saveCourseDraft(
        courseId,
        { title: 'مسودة أصلية مقدمة للاعتماد' },
        adminActor
      );

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'courses.publish',
        targetId: courseId,
        requestedBy: assistantActor.id,
        justification: 'اعتماد المسودة الأصلية',
        payload: { courseId },
      });

      // Draft is subsequently edited while approval is pending
      inMemoryStore.saveCourseDraft(
        courseId,
        { title: 'تعديل خفي متسلل للمسودة دون إعادة التقديم' },
        adminActor
      );

      expect(() => {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
      }).toThrowError(MockStoreError);

      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
      } catch (err) {
        expect((err as MockStoreError).status).toBe(409);
        expect((err as MockStoreError).code).toBe('DRAFT_MODIFIED_CONFLICT');
      }
    });

    it('7.3. rejects approval with 404 DRAFT_NOT_FOUND when draft was deleted while request was pending', () => {
      const courseId = 'course-1';
      inMemoryStore.saveCourseDraft(
        courseId,
        { title: 'مسودة سيتم حذفها' },
        adminActor
      );

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'courses.publish',
        targetId: courseId,
        requestedBy: assistantActor.id,
        justification: 'اعتماد مسودة سيتم حذفها',
        payload: { courseId },
      });

      // Delete draft directly from store
      inMemoryStore.discardCourseDraft(courseId);

      expect(() => {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
      }).toThrowError(MockStoreError);

      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
      } catch (err) {
        expect((err as MockStoreError).status).toBe(404);
        expect((err as MockStoreError).code).toBe('DRAFT_NOT_FOUND');
      }
    });

    it('7.4. rejects approval when draft content fails eligibility revalidation', () => {
      const courseId = 'course-1';
      // Save draft with empty sections, which violates content eligibility
      inMemoryStore.saveCourseDraft(
        courseId,
        {
          title: 'مقرر بدون أقسام تدريبية',
          sections: [],
        },
        adminActor
      );

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'courses.publish',
        targetId: courseId,
        requestedBy: assistantActor.id,
        justification: 'محاولة نشر مقرر غير مستوفي',
        payload: { courseId },
      });

      expect(() => {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
      }).toThrowError(MockStoreError);

      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
      } catch (err) {
        expect((err as MockStoreError).status).toBe(400);
      }
    });

    it('7.5. rejects approval with 409 DRAFT_MODIFIED_CONFLICT when nested lesson was modified (content digest mismatch)', () => {
      const courseId = 'course-1';
      inMemoryStore.saveCourseDraft(
        courseId,
        {
          title: 'مقرر مسودة بمحتوى أولي',
          sections: [
            {
              id: 'sec-1',
              title: 'القسم الأول',
              lessons: [{ id: 'les-1', title: 'الدرس الأصلي', duration: '10:00' }],
            },
          ],
        },
        adminActor
      );

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'courses.publish',
        targetId: courseId,
        requestedBy: assistantActor.id,
        justification: 'اعتماد مسودة مع محتوى تدريبي',
        payload: { courseId },
      });

      // Modify a nested lesson title inside the section
      inMemoryStore.saveCourseDraft(
        courseId,
        {
          sections: [
            {
              id: 'sec-1',
              title: 'القسم الأول',
              lessons: [{ id: 'les-1', title: 'تم تعديل عنوان الدرس خلسة', duration: '10:00' }],
            },
          ],
        },
        adminActor
      );

      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
        expect.unreachable('Must throw 409 DRAFT_MODIFIED_CONFLICT');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(409);
        expect((err as MockStoreError).code).toBe('DRAFT_MODIFIED_CONFLICT');
      }
    });

    it('7.6. rejects approval with 409 DRAFT_MODIFIED_CONFLICT when lecture metadata or resources are modified', () => {
      const courseId = 'course-1';
      inMemoryStore.saveCourseDraft(
        courseId,
        {
          title: 'مقرر باختبار الموارد',
          chapters: [
            {
              id: 'ch-1',
              title: 'الباب الأول',
              order: 1,
              items: [{ id: 'it-1', title: 'محاضرة 1', type: 'video', duration: 300 }],
            },
          ],
          externalResources: [{ title: 'كتيب إرشادي', url: 'https://metro.local/guide.pdf' }],
        },
        adminActor
      );

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'courses.publish',
        targetId: courseId,
        requestedBy: assistantActor.id,
        justification: 'اعتماد مقرر مع موارد',
        payload: { courseId },
      });

      // Modify external resources list after submission
      inMemoryStore.saveCourseDraft(
        courseId,
        {
          externalResources: [
            { title: 'كتيب إرشادي', url: 'https://metro.local/guide.pdf' },
            { title: 'رابط خارجي غير معتمد', url: 'https://untrusted.com/malicious.pdf' },
          ],
        },
        adminActor
      );

      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
        expect.unreachable('Must throw 409 DRAFT_MODIFIED_CONFLICT');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(409);
        expect((err as MockStoreError).code).toBe('DRAFT_MODIFIED_CONFLICT');
      }
    });

    it('7.7. rejects approval with 409 DRAFT_MODIFIED_CONFLICT when draft is replaced with same title and section count', () => {
      const courseId = 'course-1';
      inMemoryStore.saveCourseDraft(
        courseId,
        {
          title: 'العنوان المطابق',
          sections: [{ id: 'sec-1', title: 'قسم مطابق', lessons: [{ id: 'l1', title: 'درس 1' }] }],
        },
        adminActor
      );

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'courses.publish',
        targetId: courseId,
        requestedBy: assistantActor.id,
        justification: 'اعتماد النسخة الأصلية',
        payload: { courseId },
      });

      // Save new draft with identical title and same section count but incremented draftVersion and different lesson ID
      inMemoryStore.saveCourseDraft(
        courseId,
        {
          title: 'العنوان المطابق',
          sections: [{ id: 'sec-1', title: 'قسم مطابق', lessons: [{ id: 'l2_replaced', title: 'درس بديل' }] }],
        },
        adminActor
      );

      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
        expect.unreachable('Must throw 409 DRAFT_MODIFIED_CONFLICT');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(409);
        expect((err as MockStoreError).code).toBe('DRAFT_MODIFIED_CONFLICT');
      }
    });

    it('7.8. rejects reviews.submit_course with 409 DRAFT_MODIFIED_CONFLICT when draft was modified after request submission', () => {
      const courseId = 'course-1';
      inMemoryStore.saveCourseDraft(
        courseId,
        { title: 'مسودة مقدمة للمراجعة والتقييم' },
        adminActor
      );

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'reviews.submit_course',
        targetId: courseId,
        requestedBy: assistantActor.id,
        justification: 'طلب مراجعة المقرر',
        payload: { courseId },
      });

      // Modify draft content while review request is pending
      inMemoryStore.saveCourseDraft(
        courseId,
        { title: 'تعديل لاحق بعد طلب المراجعة' },
        adminActor
      );

      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
        expect.unreachable('Must throw 409 DRAFT_MODIFIED_CONFLICT');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(409);
        expect((err as MockStoreError).code).toBe('DRAFT_MODIFIED_CONFLICT');
      }
    });
  });

  // ── 8. Concurrency, In-Progress Claim Latching & Transactional Safety ───────

  describe('8. Concurrency, In-Progress Claim Latching & Transactional Safety', () => {
    it('8.1. rejects concurrent decision attempt on in_progress request with 409 DECISION_IN_PROGRESS', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'فحص قفل الحالة قيد المعالجة',
        payload: { groupId: 'GRP-101' },
      });

      // Simulate atomic claim transition
      const rawReq = inMemoryStore.getApprovalRequests().find((r) => r.id === req.id);
      if (rawReq) {
        rawReq.status = 'in_progress';
      }

      // Concurrent approval attempt
      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
        expect.unreachable('Must throw 409 DECISION_IN_PROGRESS');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(409);
        expect((err as MockStoreError).code).toBe('DECISION_IN_PROGRESS');
      }

      // Concurrent rejection attempt
      try {
        inMemoryStore.rejectApprovalRequest(req.id, adminActor.id);
        expect.unreachable('Must throw 409 DECISION_IN_PROGRESS');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(409);
        expect((err as MockStoreError).code).toBe('DECISION_IN_PROGRESS');
      }
    });

    it('8.2. true concurrent approval execution via Promise.allSettled: exactly one succeeds and one receives 409 DECISION_IN_PROGRESS', async () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'فحص التزامن الحقيقي لاعتمادين متزامنين',
        payload: { groupId: 'GRP-101' },
      });

      const [res1, res2] = await Promise.allSettled([
        inMemoryStore.approveApprovalRequestAsync(req.id, adminActor.id, 'اعتماد متزامن 1', 25),
        inMemoryStore.approveApprovalRequestAsync(req.id, superAdminActor.id, 'اعتماد متزامن 2', 25),
      ]);

      const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
      const rejected = [res1, res2].filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const err = (rejected[0] as PromiseRejectedResult).reason as MockStoreError;
      expect(err.status).toBe(409);
      expect(err.code).toBe('DECISION_IN_PROGRESS');

      const approvedReq = (fulfilled[0] as PromiseFulfilledResult<ApprovalRequest>).value;
      expect(approvedReq.status).toBe('approved');

      // Subsequent attempt on decided request returns ALREADY_DECIDED
      try {
        inMemoryStore.approveApprovalRequest(req.id, developerActor.id);
        expect.unreachable('Must throw 409 ALREADY_DECIDED');
      } catch (e) {
        expect((e as MockStoreError).status).toBe(409);
        expect((e as MockStoreError).code).toBe('ALREADY_DECIDED');
      }
    });

    it('8.3. true concurrent approval and rejection execution via Promise.allSettled: exactly one succeeds and one receives 409 DECISION_IN_PROGRESS', async () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'فحص التزامن الحقيقي بين الاعتماد والرفض',
        payload: { groupId: 'GRP-101' },
      });

      const [res1, res2] = await Promise.allSettled([
        inMemoryStore.approveApprovalRequestAsync(req.id, adminActor.id, 'اعتماد سريع', 25),
        inMemoryStore.rejectApprovalRequestAsync(req.id, superAdminActor.id, 'رفض متزامن', 25),
      ]);

      const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
      const rejected = [res1, res2].filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const err = (rejected[0] as PromiseRejectedResult).reason as MockStoreError;
      expect(err.status).toBe(409);
      expect(err.code).toBe('DECISION_IN_PROGRESS');
    });

    it('8.4. verifies approval cannot succeed if request was already rejected (race-safe)', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'سباق الرفض والاعتماد',
        payload: { groupId: 'GRP-101' },
      });

      // Rejecter wins race
      inMemoryStore.rejectApprovalRequest(req.id, adminActor.id, 'تم الرفض أولاً');

      // Approver loses race
      try {
        inMemoryStore.approveApprovalRequest(req.id, superAdminActor.id);
        expect.unreachable('Must throw 409 ALREADY_DECIDED');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(409);
        expect((err as MockStoreError).code).toBe('ALREADY_DECIDED');
      }
    });

    it('8.5. verifies rejection cannot succeed if request was already approved (race-safe)', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'سباق الاعتماد والرفض',
        payload: { groupId: 'GRP-101' },
      });

      // Approver wins race
      inMemoryStore.approveApprovalRequest(req.id, adminActor.id);

      // Rejecter loses race
      try {
        inMemoryStore.rejectApprovalRequest(req.id, superAdminActor.id, 'محاولة متأخرة للرفض');
        expect.unreachable('Must throw 409 ALREADY_DECIDED');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(409);
        expect((err as MockStoreError).code).toBe('ALREADY_DECIDED');
      }
    });

    it('8.6. transactional pre-validation: groups.manage_members fails closed before any state mutation', () => {
      const groupId = 'GRP-101';
      const membersBefore = inMemoryStore.getGroupMembers(groupId).length;

      // Request contains 1 valid trainee and 1 non-existent trainee
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.manage_members',
        targetId: groupId,
        requestedBy: assistantActor.id,
        justification: 'إضافة متدربين مع متدرب وهمي',
        payload: {
          groupId,
          traineeIds: ['USR003', 'USR_NON_EXISTENT_999'],
        },
      });

      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
        expect.unreachable('Must throw 404 due to pre-validation failure');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(404);
      }

      // Group members count must NOT have changed (zero partial mutations)
      const membersAfter = inMemoryStore.getGroupMembers(groupId).length;
      expect(membersAfter).toBe(membersBefore);

      // Request status must be marked failed_execution, not approved or in_progress
      const reqRecord = inMemoryStore.getApprovalRequests().find((r) => r.id === req.id);
      expect(reqRecord?.status).toBe('failed_execution');
    });

    it('8.7. partial mutation rollback: runtime failure during execution restores store to pre-execution state and sets status failed_execution', () => {
      const groupId = 'GRP-101';
      const groupBefore = JSON.parse(JSON.stringify(inMemoryStore.getTrainingGroups().find((g) => g.id === groupId)));

      // Request attempting batch file deletion where one file is invalid
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'materials.delete_files',
        targetId: groupId,
        requestedBy: assistantActor.id,
        justification: 'حذف ملفات متعددة مع ملف تالف',
        payload: {
          groupId,
          fileIds: ['NON_EXISTENT_FILE_XYZ'],
        },
      });

      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
        expect.unreachable('Must throw 404');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(404);
      }

      // Request must be failed_execution
      const reqRecord = inMemoryStore.getApprovalRequests().find((r) => r.id === req.id);
      expect(reqRecord?.status).toBe('failed_execution');
      expect(reqRecord?.executionError).toBeDefined();

      // Store collections must match pre-execution state
      const groupAfter = JSON.parse(JSON.stringify(inMemoryStore.getTrainingGroups().find((g) => g.id === groupId)));
      expect(groupAfter).toEqual(groupBefore);
    });
  });

  // ── 9. Approver Authority, Role Ceilings & Protected Invariants (INV-R1, INV-R2, INV-R3) ─────

  describe('9. Approver Authority, Role Ceilings & Protected Invariants (INV-R1, INV-R2, INV-R3)', () => {
    it('9.1. regular admin cannot approve actions exceeding admin role capability ceiling', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'system.reconfigure_platform_kernel' as any,
        capability: 'system.reconfigure_platform_kernel' as any,
        targetId: 'SYS-CORE',
        requestedBy: assistantActor.id,
        justification: 'طلب صلاحية سيادية',
        payload: {},
      });

      expect(() => {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
      }).toThrowError(MockStoreError);

      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
        expect((err as MockStoreError).code).toBe('INVARIANT_APPROVER_CEILING_EXCEEDED');
      }
    });

    it('9.2. prohibited Developer creation (INV-R1): Super Admin approver cannot approve users.create with role developer (403 INVARIANT_DEVELOPER_IMMUTABLE)', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'users.create',
        requestedBy: 'USR002',
        justification: 'محاولة إنشاء حساب مطور عبر السوبر أدمن',
        payload: {
          username: 'rogue_dev',
          email: 'rogue.dev@metro.local',
          name: 'مطور دخيل',
          role: 'developer',
        },
      });

      try {
        inMemoryStore.approveApprovalRequest(req.id, superAdminActor.id);
        expect.unreachable('Must throw 403 INVARIANT_DEVELOPER_IMMUTABLE');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
        expect((err as MockStoreError).code).toBe('INVARIANT_DEVELOPER_IMMUTABLE');
      }
    });

    it('9.3. prohibited Developer creation (INV-R1): Developer approver cannot approve users.create with role developer (403 INVARIANT_DEVELOPER_IMMUTABLE)', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'users.create',
        requestedBy: 'USR002',
        justification: 'محاولة إنشاء حساب مطور عبر المطور ذاته في التطبيق',
        payload: {
          username: 'peer_dev',
          email: 'peer.dev@metro.local',
          name: 'مطور نظير',
          role: 'developer',
        },
      });

      try {
        inMemoryStore.approveApprovalRequest(req.id, developerActor.id);
        expect.unreachable('Must throw 403 INVARIANT_DEVELOPER_IMMUTABLE');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
        expect((err as MockStoreError).code).toBe('INVARIANT_DEVELOPER_IMMUTABLE');
      }
    });

    it('9.4. prohibited Developer assignment (INV-R1): Approver cannot approve users.change_role to developer (403 INVARIANT_DEVELOPER_IMMUTABLE)', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'users.change_role',
        targetId: 'USR003',
        requestedBy: assistantActor.id,
        justification: 'ترقية متدرب إلى مطور',
        payload: { userId: 'USR003', role: 'developer' },
      });

      try {
        inMemoryStore.approveApprovalRequest(req.id, superAdminActor.id);
        expect.unreachable('Must throw 403 INVARIANT_DEVELOPER_IMMUTABLE');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
        expect((err as MockStoreError).code).toBe('INVARIANT_DEVELOPER_IMMUTABLE');
      }
    });

    it('9.5. prohibited Super Admin mutation by Super Admin (INV-R2): Super Admin cannot approve mutations targeting another Super Admin (403 INVARIANT_SUPER_ADMIN_EXCLUSIVITY)', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'users.change_status',
        targetId: 'USR_SUPER_001',
        requestedBy: assistantActor.id,
        justification: 'إيقاف حساب المسؤول الأعلى من قبل نظير',
        payload: { userId: 'USR_SUPER_001', status: 'suspended', reason: 'تدقيق دوري' },
      });

      try {
        inMemoryStore.approveApprovalRequest(req.id, superAdminActor.id);
        expect.unreachable('Must throw 403 INVARIANT_SUPER_ADMIN_EXCLUSIVITY or INVARIANT_ANTI_SELF_APPROVAL');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
      }
    });

    it('9.6. permitted Super Admin mutation by Developer (INV-R2): Developer approver CAN approve mutations targeting Super Admin', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'users.change_status',
        targetId: 'USR_SUPER_001',
        requestedBy: 'USR002',
        justification: 'إيقاف حساب المسؤول الأعلى عبر المطور المخول حصراً',
        payload: { userId: 'USR_SUPER_001', status: 'suspended', reason: 'إجراء تطويري معتمد' },
      });

      const approved = inMemoryStore.approveApprovalRequest(req.id, developerActor.id);
      expect(approved.status).toBe('approved');
      expect(approved.reviewedBy).toBe(developerActor.id);

      // Revert status
      const superUser = inMemoryStore.getManagedUserById('USR_SUPER_001', 'developer');
      if (superUser) superUser.status = 'active';
    });

    it('9.7. prohibited Admin creation/mutation by Admin (INV-R3): Admin approver cannot approve users.create or mutate another Admin (403 INVARIANT_ADMIN_PROTECTED)', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'users.create',
        requestedBy: 'USR002',
        justification: 'طلب إنشاء حساب مدير نظام جديد',
        payload: {
          username: 'new_sub_admin',
          email: 'subadmin@cairo-metro.com',
          name: 'مدير فرعي جديد',
          role: 'admin',
        },
      });

      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
        expect.unreachable('Must throw 403 INVARIANT_ADMIN_PROTECTED');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
        expect((err as MockStoreError).code).toBe('INVARIANT_ADMIN_PROTECTED');
      }
    });

    it('9.8. permitted Admin creation/mutation by Super Admin or Developer (INV-R3): Super Admin CAN approve Admin creation', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'users.create',
        requestedBy: 'USR002',
        justification: 'إنشاء حساب مدير نظام عبر المسؤول الأعلى المخول',
        payload: {
          username: 'authorized_admin_created',
          email: 'auth_admin@cairo-metro.com',
          name: 'مدير نظام معتمد جديد',
          role: 'admin',
        },
      });

      const approved = inMemoryStore.approveApprovalRequest(req.id, superAdminActor.id);
      expect(approved.status).toBe('approved');
      expect(approved.reviewedBy).toBe(superAdminActor.id);
    });

    it('9.9. prohibited Admin creation request by Assistant Admin (INV-R10): Assistant Admin requester cannot request Admin creation (403 INVARIANT_ASSISTANT_CANNOT_CREATE_ADMIN)', () => {
      expect(() => {
        inMemoryStore.createApprovalRequest({
          actionType: 'users.create',
          requestedBy: assistantActor.id,
          justification: 'محاولة إنشاء مدير نظام من قبل مساعد مدير النظام',
          payload: {
            username: 'assistant_spawned_admin',
            email: 'spawned@cairo-metro.com',
            name: 'مدير منشأ بواسطة مساعد',
            role: 'admin',
          },
        });
      }).toThrowError(MockStoreError);

      try {
        inMemoryStore.createApprovalRequest({
          actionType: 'users.create',
          requestedBy: assistantActor.id,
          justification: 'محاولة إنشاء مدير نظام من قبل مساعد مدير النظام',
          payload: {
            username: 'assistant_spawned_admin',
            email: 'spawned@cairo-metro.com',
            name: 'مدير منشأ بواسطة مساعد',
            role: 'admin',
          },
        });
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
        expect((err as MockStoreError).code).toBe('INVARIANT_ASSISTANT_CANNOT_CREATE_ADMIN');
      }
    });

    it('9.10. super_admin can approve eligible administrative mutations within authority', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'أرشفة مجموعة عبر السوبر أدمن',
        payload: { groupId: 'GRP-101' },
      });

      const approved = inMemoryStore.approveApprovalRequest(req.id, superAdminActor.id);
      expect(approved.status).toBe('approved');
      expect(approved.reviewedBy).toBe(superAdminActor.id);
    });

    it('9.11. developer can approve sovereign administrative mutations', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'أرشفة مجموعة عبر المطور',
        payload: { groupId: 'GRP-101' },
      });

      const approved = inMemoryStore.approveApprovalRequest(req.id, developerActor.id);
      expect(approved.status).toBe('approved');
      expect(approved.reviewedBy).toBe(developerActor.id);
    });
  });

  // ── 10. Fail-Closed Anti-Self-Approval Identity Verification ───────────────

  describe('10. Fail-Closed Anti-Self-Approval Identity Verification', () => {
    it('10.1. fails closed (403) when requestedBy/requesterId is missing or empty', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: '',
        justification: 'طلب بدون معرف مقدم الطلب',
        payload: { groupId: 'GRP-101' },
      });

      delete (req as any).requesterId;
      delete (req as any).requestedBy;

      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
        expect.unreachable('Must fail closed with 403');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
        expect((err as MockStoreError).code).toBe('INVARIANT_IDENTITY_RESOLUTION_FAILED');
      }
    });

    it('10.2. fails closed (403) when reviewedBy is missing or whitespace-only', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'طلب صالح ولكن المعتمد مجهول',
        payload: { groupId: 'GRP-101' },
      });

      try {
        inMemoryStore.approveApprovalRequest(req.id, '   ');
        expect.unreachable('Must fail closed with 403');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
      }
    });

    it('10.3. fails closed (403 INVARIANT_IDENTITY_RESOLUTION_FAILED) when approver canonical identity cannot be verified in user directory', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'فحص هوية غير معتمدة للمعتمد',
        payload: { groupId: 'GRP-101' },
      });

      try {
        inMemoryStore.approveApprovalRequest(req.id, 'ghost_unregistered_actor');
        expect.unreachable('Must fail closed with 403');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
      }
    });

    it('10.4. fails closed (403 INVARIANT_IDENTITY_RESOLUTION_FAILED) when requester canonical identity cannot be verified in user directory (unregistered ID)', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: 'ghost_unregistered_requester_id',
        justification: 'طلب مقدم من هوية وهمية غير مسجلة في دليل النظام',
        payload: { groupId: 'GRP-101' },
      });

      try {
        inMemoryStore.approveApprovalRequest(req.id, adminActor.id);
        expect.unreachable('Must fail closed with 403 INVARIANT_IDENTITY_RESOLUTION_FAILED');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
        expect((err as MockStoreError).code).toBe('INVARIANT_IDENTITY_RESOLUTION_FAILED');
      }
    });

    it('10.5. blocks Developer self-approval across all alias variations', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: 'USR_DEV_001',
        justification: 'طلب مقدم من حساب المطور الأساسي',
        payload: { groupId: 'GRP-101' },
      });

      // Attempt approval using username alias 'developer_internal'
      try {
        inMemoryStore.approveApprovalRequest(req.id, 'developer_internal');
        expect.unreachable('Must block self-approval via username alias');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
        expect((err as MockStoreError).code).toBe('INVARIANT_ANTI_SELF_APPROVAL');
      }

      // Attempt approval using lowercase alias 'usr_dev_001'
      try {
        inMemoryStore.approveApprovalRequest(req.id, 'usr_dev_001');
        expect.unreachable('Must block self-approval via lowercase alias');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
        expect((err as MockStoreError).code).toBe('INVARIANT_ANTI_SELF_APPROVAL');
      }
    });

    it('10.6. blocks Super Admin self-approval across all alias variations', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: 'USR_SUPER_001',
        justification: 'طلب مقدم من حساب المسؤول الأعلى الأساسي',
        payload: { groupId: 'GRP-101' },
      });

      // Attempt approval using username alias 'super_admin_demo'
      try {
        inMemoryStore.approveApprovalRequest(req.id, 'super_admin_demo');
        expect.unreachable('Must block self-approval via username alias');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
        expect((err as MockStoreError).code).toBe('INVARIANT_ANTI_SELF_APPROVAL');
      }

      // Attempt approval using lowercase alias 'usr_super_001'
      try {
        inMemoryStore.approveApprovalRequest(req.id, 'usr_super_001');
        expect.unreachable('Must block self-approval via lowercase alias');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
        expect((err as MockStoreError).code).toBe('INVARIANT_ANTI_SELF_APPROVAL');
      }
    });

    it('10.7. blocks Admin self-approval across all alias variations', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: 'usr_admin_001',
        justification: 'طلب مقدم من مدير النظام',
        payload: { groupId: 'GRP-101' },
      });

      // Attempt approval using legacy alias 'admin_demo'
      try {
        inMemoryStore.approveApprovalRequest(req.id, 'admin_demo');
        expect.unreachable('Must block self-approval via demo alias');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
        expect((err as MockStoreError).code).toBe('INVARIANT_ANTI_SELF_APPROVAL');
      }

      // Attempt approval using email alias 'admin@cairo-metro.com'
      try {
        inMemoryStore.approveApprovalRequest(req.id, 'admin@cairo-metro.com');
        expect.unreachable('Must block self-approval via email alias');
      } catch (err) {
        expect((err as MockStoreError).status).toBe(403);
        expect((err as MockStoreError).code).toBe('INVARIANT_ANTI_SELF_APPROVAL');
      }
    });
  });

  // ── 11. Real HTTP Endpoint Concurrency & Decision Wiring (MSW) ─────────────

  describe('11. Real HTTP Endpoint Concurrency & Decision Wiring (MSW)', () => {
    it('11.1. HTTP POST /api/admin/permissions/governance/approvals/:id/approve returns 200 OK and executes mutation', async () => {
      const targetUser = inMemoryStore.getManagedUserById('USR003');
      expect(targetUser?.role).toBe('user');

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'users.change_role',
        targetId: 'USR003',
        requestedBy: assistantActor.id,
        justification: 'ترقية مستخدم عبر طلب اعتماد خاضع للرقابة',
        payload: { userId: 'USR003', newRole: 'lecturer' },
      });

      const res = await fetch(`/api/admin/permissions/governance/approvals/${req.id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${adminActor.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'تم التدقيق والاعتماد عبر نقطة النهاية الرسمية' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('approved');
      expect(data.reviewedBy).toBe(adminActor.id);
      expect(inMemoryStore.getManagedUserById('USR003')?.role).toBe('lecturer');
    });

    it('11.2. Two concurrent HTTP POST requests via simulated overlap — exactly one returns 200 OK, the other returns 409 DECISION_IN_PROGRESS', async () => {
      const targetUser = inMemoryStore.getManagedUserById('USR003');
      expect(targetUser?.role).toBe('user');

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'users.change_role',
        targetId: 'USR003',
        requestedBy: assistantActor.id,
        justification: 'فحص التنافس والتزامن عبر نقطة النهاية الحقيقية',
        payload: { userId: 'USR003', newRole: 'lecturer' },
      });

      // Inject deterministic decision overlap via test-only store configuration (unexposed to HTTP clients)
      inMemoryStore.setTestDecisionDelay(25);
      try {
        const [resA, resB] = await Promise.all([
          fetch(`/api/admin/permissions/governance/approvals/${req.id}/approve`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer mock_jwt_${adminActor.id}_test`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ notes: 'اعتماد متزامن A' }),
          }),
          fetch(`/api/admin/permissions/governance/approvals/${req.id}/approve`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer mock_jwt_${superAdminActor.id}_test`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ notes: 'اعتماد متزامن B' }),
          }),
        ]);

        const statuses = [resA.status, resB.status].sort();
        expect(statuses).toEqual([200, 409]);

        const successRes = resA.status === 200 ? resA : resB;
        const conflictRes = resA.status === 409 ? resA : resB;

        const successData = await successRes.json();
        expect(successData.status).toBe('approved');

        const conflictData = await conflictRes.json();
        expect(conflictData.code).toBe('DECISION_IN_PROGRESS');

        // Domain mutation was executed exactly once
        expect(inMemoryStore.getManagedUserById('USR003')?.role).toBe('lecturer');
      } finally {
        inMemoryStore.setTestDecisionDelay(0);
      }
    });

    it('11.3. Subsequent HTTP POST on decided request returns 409 ALREADY_DECIDED', async () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'users.change_role',
        targetId: 'USR003',
        requestedBy: assistantActor.id,
        justification: 'طلب للاختبار بعد البت',
        payload: { userId: 'USR003', newRole: 'lecturer' },
      });

      // First decision succeeds
      const firstRes = await fetch(`/api/admin/permissions/governance/approvals/${req.id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${adminActor.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'الاعتماد الأولي' }),
      });
      expect(firstRes.status).toBe(200);

      // Replay attempt fails with 409 ALREADY_DECIDED
      const replayRes = await fetch(`/api/admin/permissions/governance/approvals/${req.id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${adminActor.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'محاولة إعادة اعتماد' }),
      });
      expect(replayRes.status).toBe(409);
      const replayData = await replayRes.json();
      expect(replayData.code).toBe('ALREADY_DECIDED');

      // Reject replay attempt also fails with 409 ALREADY_DECIDED
      const rejectRes = await fetch(`/api/admin/permissions/governance/approvals/${req.id}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${adminActor.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'محاولة رفض لطلب معتمد سابقاً' }),
      });
      expect(rejectRes.status).toBe(409);
      const rejectData = await rejectRes.json();
      expect(rejectData.code).toBe('ALREADY_DECIDED');
    });

    it('11.4. HTTP POST by non-admin role (e.g. assistant_admin / user) returns 403 Forbidden', async () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        justification: 'طلب فحص صلاحية نقطة النهاية',
        payload: { groupId: 'GRP-101' },
      });

      // Non-privileged user
      const userRes = await fetch(`/api/admin/permissions/governance/approvals/${req.id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${traineeActor.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'محاولة غير مصرح بها من متدرب' }),
      });
      expect(userRes.status).toBe(403);

      // Assistant admin cannot approve
      const assistantRes = await fetch(`/api/admin/permissions/governance/approvals/${req.id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${assistantActor.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'محاولة غير مصرح بها من مساعد مدير' }),
      });
      expect(assistantRes.status).toBe(403);
    });

    it('11.5. HTTP POST with anti-self-approval returns 403 INVARIANT_ANTI_SELF_APPROVAL', async () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        targetId: 'GRP-101',
        requestedBy: adminActor.id,
        justification: 'طلب مقدم من نفس المدير',
        payload: { groupId: 'GRP-101' },
      });

      const res = await fetch(`/api/admin/permissions/governance/approvals/${req.id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${adminActor.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'محاولة اعتماد ذاتي عبر HTTP' }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('INVARIANT_ANTI_SELF_APPROVAL');
      expect(data.message).toContain('لا يمكن لمقدم الطلب اعتماد طلبه الذاتي');
    });

    it('11.6. HTTP POST /api/admin/permissions/governance/approvals/:id/reject returns 200 OK and rejects request without mutation', async () => {
      const targetUser = inMemoryStore.getManagedUserById('USR003');
      expect(targetUser?.role).toBe('user');

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'users.change_role',
        targetId: 'USR003',
        requestedBy: assistantActor.id,
        justification: 'طلب سيتم رفضه عبر نقطة النهاية الرسمية',
        payload: { userId: 'USR003', newRole: 'lecturer' },
      });

      const res = await fetch(`/api/admin/permissions/governance/approvals/${req.id}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${adminActor.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'تم الرفض لعدم استيفاء الشروط' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('rejected');
      expect(data.reviewedBy).toBe(adminActor.id);
      expect(inMemoryStore.getManagedUserById('USR003')?.role).toBe('user');
    });
  });
});

