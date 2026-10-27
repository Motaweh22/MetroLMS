import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import { server } from '@/mocks/server';
import { inMemoryStore, MockStoreError } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import { commentsApi } from '@/features/comments/services/commentsApi';

describe('Increment 11 — Phase 5A: Comment Moderation Domain Contracts, Seed Data & Authorized Store/API Engine', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    server.resetHandlers();
    authStorage.clearSession();
  });
  afterAll(() => server.close());

  const setTestSession = (roleKey: keyof typeof SYNTHETIC_DEMO_ACCOUNTS) => {
    authStorage.setSession({
      token: `${roleKey}-test-token`,
      user: SYNTHETIC_DEMO_ACCOUNTS[roleKey].user,
      expiresAt: Date.now() + 86400000,
    });
  };

  beforeEach(() => {
    inMemoryStore.reset({ seedGroupDemo: true });
  });

  // ── 1. Comment Data Integrity & Seed Fixtures ───────────────────────
  describe('1. Comment Data Integrity & Seed Fixtures', () => {
    it('initializes canonical comments fixtures correctly with 6 total comments and 2 reported comments', () => {
      const allComments = inMemoryStore.getAllComments({ id: 'usr_admin_001', role: 'admin' });
      const reportedComments = inMemoryStore.getReportedComments({ id: 'usr_admin_001', role: 'admin' });

      expect(allComments).toHaveLength(6);
      expect(reportedComments).toHaveLength(2);

      const reportedIds = reportedComments.map((c) => c.id);
      expect(reportedIds).toContain('CMT001');
      expect(reportedIds).toContain('CMT004');
    });

    it('ensures each canonical fixture references a valid course and valid author', () => {
      const allComments = inMemoryStore.getAllComments({ id: 'usr_admin_001', role: 'admin' });
      const validCourses = ['CRS001', 'CRS002', 'CRS003'];

      for (const comment of allComments) {
        expect(validCourses).toContain(comment.courseId);
        expect(comment.id).toMatch(/^CMT\d+/);
        expect(comment.text.trim().length).toBeGreaterThan(0);
        expect(comment.userName.trim().length).toBeGreaterThan(0);
        expect(comment.createdAt).toBeDefined();
        if (comment.reported) {
          expect(comment.reportReason).toBeDefined();
          expect(comment.reportReasonLabelAr).toBeDefined();
          expect(comment.reportedBy).toBeDefined();
          expect(comment.reportedByName).toBeDefined();
          expect(comment.reportedAt).toBeDefined();
        }
      }
    });

    it('returns deep cloned records to avoid mutating internal store state', () => {
      const reported = inMemoryStore.getReportedComments({ id: 'usr_admin_001', role: 'admin' });
      const first = reported[0];
      first.text = 'MUTATED TEXT';

      const fresh = inMemoryStore.getReportedComments({ id: 'usr_admin_001', role: 'admin' });
      expect(fresh[0].text).not.toBe('MUTATED TEXT');
    });

    it('restores deterministic initial state on inMemoryStore.reset()', () => {
      // Delete a comment directly
      inMemoryStore.deleteComment('CMT001', { id: 'usr_admin_001', role: 'admin' });
      expect(inMemoryStore.getCommentById('CMT001')).toBeUndefined();

      // Reset store
      inMemoryStore.reset({ seedGroupDemo: true });

      const restored = inMemoryStore.getCommentById('CMT001');
      expect(restored).toBeDefined();
      expect(restored?.id).toBe('CMT001');
      expect(restored?.reported).toBe(true);
    });

    it('filters comments by courseId and search query correctly', () => {
      const crs1Comments = inMemoryStore.getAllComments(
        { id: 'usr_admin_001', role: 'admin' },
        { courseId: 'CRS001' }
      );
      expect(crs1Comments).toHaveLength(3);
      expect(crs1Comments.every((c) => c.courseId === 'CRS001')).toBe(true);

      const searched = inMemoryStore.getAllComments(
        { id: 'usr_admin_001', role: 'admin' },
        { query: 'خالد إبراهيم' }
      );
      expect(searched.length).toBeGreaterThanOrEqual(2);
      expect(searched.every((c) => c.userName.includes('خالد إبراهيم'))).toBe(true);
    });

    it('computes moderation summary KPI metrics accurately', () => {
      const summary = inMemoryStore.getCommentModerationSummary({ id: 'usr_admin_001', role: 'admin' });
      expect(summary.totalComments).toBe(6);
      expect(summary.reportedCommentsCount).toBe(2);
      expect(summary.coursesWithCommentsCount).toBe(3);
    });
  });

  // ── 2. Store Operations & Business Rules ────────────────────────────
  describe('2. Store Operations & Business Rules', () => {
    it('allows an enrolled trainee to post a comment and unshifts to course discussion', () => {
      const newComment = inMemoryStore.createComment(
        { courseId: 'CRS001', text: 'سؤال استفساري بخصوص التدريب العملي' },
        { id: 'usr_trainee_003', role: 'user', name: 'أحمد ممدوح سالم' }
      );

      expect(newComment.id).toMatch(/^CMT_/);
      expect(newComment.courseId).toBe('CRS001');
      expect(newComment.text).toBe('سؤال استفساري بخصوص التدريب العملي');
      expect(newComment.userId).toBe('usr_trainee_003');
      expect(newComment.userName).toBe('أحمد ممدوح سالم');
      expect(newComment.reported).toBe(false);

      const courseComments = inMemoryStore.getCourseComments('CRS001');
      expect(courseComments[0].id).toBe(newComment.id);
    });

    it('rejects posting an empty or whitespace-only comment with MockStoreError 400', () => {
      expect(() => {
        inMemoryStore.createComment(
          { courseId: 'CRS001', text: '   ' },
          { id: 'usr_trainee_003', role: 'user' }
        );
      }).toThrowError(MockStoreError);
    });

    it('rejects posting when commentsEnabled is false on the course with 400', () => {
      inMemoryStore.toggleCourseComments('CRS001', false, { id: 'usr_admin_001', role: 'admin' });

      expect(() => {
        inMemoryStore.createComment(
          { courseId: 'CRS001', text: 'تعليق في كورس مغلق' },
          { id: 'usr_trainee_003', role: 'user' }
        );
      }).toThrowError('التعليقات مغلقة على هذا المقرر التدريبي');
    });

    it('rejects posting by unenrolled trainee with MockStoreError 403', () => {
      // USR011 is not enrolled in CRS003
      expect(() => {
        inMemoryStore.createComment(
          { courseId: 'CRS003', text: 'محاولة تعليق غير مسجل' },
          { id: 'USR011', role: 'user' }
        );
      }).toThrowError('يجب أن تكون مسجلاً في المقرر للمشاركة في النقاشات');
    });

    it('allows reporting an inappropriate comment and records reporter metadata', () => {
      const reported = inMemoryStore.reportComment(
        'CMT002',
        { reason: 'inappropriate_content', notes: 'ملاحظة تدقيق' },
        { id: 'usr_trainee_003', role: 'user', name: 'أحمد ممدوح سالم' }
      );

      expect(reported.reported).toBe(true);
      expect(reported.reportReason).toBe('inappropriate_content');
      expect(reported.reportReasonLabelAr).toBe('محتوى غير لائق');
      expect(reported.reportedBy).toBe('usr_trainee_003');
      expect(reported.reportedByName).toBe('أحمد ممدوح سالم');
      expect(reported.reportedAt).toBeDefined();

      const reportedList = inMemoryStore.getReportedComments({ id: 'usr_admin_001', role: 'admin' });
      expect(reportedList.map((c) => c.id)).toContain('CMT002');
    });

    it('rejects duplicate report on the same comment by the same user with 400', () => {
      // CMT001 is already reported by USR004 in seed fixtures
      expect(() => {
        inMemoryStore.reportComment(
          'CMT001',
          { reason: 'harassment' },
          { id: 'USR004', role: 'user' }
        );
      }).toThrowError('لقد قمت بالإبلاغ عن هذا التعليق مسبقاً');
    });

    it('ignores report: clears report flag and metadata while strictly preserving the comment in course discussion', () => {
      const ignored = inMemoryStore.ignoreCommentReport('CMT001', {
        id: 'usr_admin_001',
        role: 'admin',
      });

      expect(ignored.reported).toBe(false);
      expect(ignored.reportReason).toBeNull();
      expect(ignored.reportedBy).toBeNull();
      expect(ignored.reportedAt).toBeNull();

      // Comment must still exist in course discussion
      const courseComments = inMemoryStore.getCourseComments('CRS001');
      expect(courseComments.map((c) => c.id)).toContain('CMT001');

      // Comment must no longer appear in reported queue
      const reportedQueue = inMemoryStore.getReportedComments({ id: 'usr_admin_001', role: 'admin' });
      expect(reportedQueue.map((c) => c.id)).not.toContain('CMT001');
    });

    it('permanently deletes comment: removes from both reported queue and course discussion', () => {
      const success = inMemoryStore.deleteComment('CMT001', {
        id: 'usr_admin_001',
        role: 'admin',
      });
      expect(success).toBe(true);

      expect(inMemoryStore.getCommentById('CMT001')).toBeUndefined();
      expect(inMemoryStore.getCourseComments('CRS001').map((c) => c.id)).not.toContain('CMT001');
      expect(
        inMemoryStore.getReportedComments({ id: 'usr_admin_001', role: 'admin' }).map((c) => c.id)
      ).not.toContain('CMT001');
    });

    it('toggles course comments setting atomically for the specified course only', () => {
      const crs1Before = inMemoryStore.getCourses().find((c) => c.id === 'CRS001');
      const crs2Before = inMemoryStore.getCourses().find((c) => c.id === 'CRS002');
      expect(crs1Before?.commentsEnabled).toBe(true);
      expect(crs2Before?.commentsEnabled).toBe(true);

      inMemoryStore.toggleCourseComments('CRS001', false, { id: 'usr_admin_001', role: 'admin' });

      const crs1After = inMemoryStore.getCourses().find((c) => c.id === 'CRS001');
      const crs2After = inMemoryStore.getCourses().find((c) => c.id === 'CRS002');
      expect(crs1After?.commentsEnabled).toBe(false);
      expect(crs2After?.commentsEnabled).toBe(true); // Unchanged!
    });
  });

  // ── 3. Role-Based Access Control (RBAC) via API ─────────────────────
  describe('3. Role-Based Access Control (RBAC) via API Layer', () => {
    it('allows System Administrator (admin) to access reported queue and all comments directory', async () => {
      setTestSession('admin');

      const reported = await commentsApi.getReportedComments();
      expect(reported).toHaveLength(2);

      const all = await commentsApi.getAllComments();
      expect(all).toHaveLength(6);

      const summary = await commentsApi.getCommentModerationSummary();
      expect(summary.totalComments).toBe(6);
      expect(summary.reportedCommentsCount).toBe(2);
    });

    it('allows Assistant Administrator (assistant_admin) read access to reported queue and all comments', async () => {
      setTestSession('assistant_admin');

      const reported = await commentsApi.getReportedComments();
      expect(reported).toHaveLength(2);

      const all = await commentsApi.getAllComments();
      expect(all).toHaveLength(6);
    });

    it('strictly forbids lecturer from platform-wide reported queue and all comments directory (HTTP 403)', async () => {
      setTestSession('lecturer');

      await expect(commentsApi.getReportedComments()).rejects.toThrow();
      await expect(commentsApi.getAllComments()).rejects.toThrow();
    });

    it('strictly forbids trainee (user) from accessing admin moderation endpoints (HTTP 403)', async () => {
      setTestSession('trainee');

      await expect(commentsApi.getReportedComments()).rejects.toThrow();
      await expect(commentsApi.getAllComments()).rejects.toThrow();
      await expect(commentsApi.getCommentModerationSummary()).rejects.toThrow();
      await expect(commentsApi.deleteComment('CMT001')).rejects.toThrow();
    });

    it('rejects unauthenticated requests with HTTP 401 Unauthorized', async () => {
      authStorage.clearSession();

      await expect(commentsApi.getReportedComments()).rejects.toThrow();
      await expect(commentsApi.getAllComments()).rejects.toThrow();
    });

    it('allows any authenticated user to view active course comments', async () => {
      setTestSession('trainee');
      const comments = await commentsApi.getCourseComments('CRS001');
      expect(comments).toHaveLength(3);

      setTestSession('lecturer');
      const commentsLec = await commentsApi.getCourseComments('CRS001');
      expect(commentsLec).toHaveLength(3);
    });

    it('allows assigned lecturer to delete comment within their instructed course', async () => {
      // USR002 is lecturer for CRS001
      authStorage.setSession({
        token: 'lecturer-usr002-token',
        user: {
          id: 'USR002',
          name: 'م. خالد إبراهيم',
          role: 'lecturer',
          email: 'khaled@metro.gov.eg',
          department: 'إدارة التدريب',
          jobTitle: 'مهندس تدريب أول',
          initials: 'خ.إ',
        },
        expiresAt: Date.now() + 86400000,
      });

      const res = await commentsApi.deleteCourseComment('CRS001', 'CMT003');
      expect(res.success).toBe(true);

      const freshComments = inMemoryStore.getCourseComments('CRS001');
      expect(freshComments.map((c) => c.id)).not.toContain('CMT003');
    });

    it('forbids lecturer from deleting comments on unrelated courses not instructed by them (HTTP 403)', async () => {
      // USR002 instructs CRS001, but does NOT instruct CRS003 (instructed by another or check)
      // Let's test a lecturer trying to delete comment CMT006 on CRS003 if they don't instruct it
      authStorage.setSession({
        token: 'unrelated-lecturer-token',
        user: {
          id: 'USR018_UNRELATED',
          name: 'محاضر غير مسند',
          role: 'lecturer',
          email: 'unrelated@metro.gov.eg',
          department: 'إدارة أخرى',
          jobTitle: 'محاضر',
          initials: 'م.غ',
        },
        expiresAt: Date.now() + 86400000,
      });

      await expect(commentsApi.deleteCourseComment('CRS001', 'CMT002')).rejects.toThrow();
    });
  });

  // ── 4. Assistant Administrator Dual-Control Governance ──────────────
  describe('4. Assistant Administrator Dual-Control Governance & Delegated Deletion', () => {
    it('intercepts Assistant Admin comment deletion without delegation: returns HTTP 202 Accepted and creates approval request', async () => {
      setTestSession('assistant_admin');
      const assistantId = SYNTHETIC_DEMO_ACCOUNTS.assistant_admin.user.id; // USR016
      expect(inMemoryStore.getDelegatedAuthority(assistantId)).toBe(false);

      const response = await commentsApi.deleteComment('CMT001');

      expect(response.approvalRequired).toBe(true);
      expect(response.requestId).toBeDefined();
      expect(response.message).toContain('تم إرسال طلب حذف التعليق للاعتماد بنجاح');

      // Crucial Integrity Requirement: Target comment must remain intact in store
      const commentInStore = inMemoryStore.getCommentById('CMT001');
      expect(commentInStore).toBeDefined();
      expect(commentInStore?.id).toBe('CMT001');

      // Approval request entity must be created in pending status
      const req = inMemoryStore.getApprovalRequests().find((r) => r.id === response.requestId);
      expect(req).toBeDefined();
      expect(req?.actionType).toBe('comments.delete');
      expect(req?.status).toBe('pending');
      expect(req?.requestedBy).toBe(assistantId);
    });

    it('approving deletion request by System Admin deletes comment and updates request to approved', () => {
      const assistantId = 'USR016';
      const approvalReq = inMemoryStore.createApprovalRequest({
        actionType: 'comments.delete',
        titleAr: 'طلب حذف تعليق مخالف',
        targetId: 'CMT001',
        targetResourceId: 'CMT001',
        requestedBy: assistantId,
        requesterId: assistantId,
        requesterName: 'أحمد شريف (مساعد مدير)',
        requesterRole: 'assistant_admin',
        payload: { commentId: 'CMT001', courseId: 'CRS001' },
      });

      expect(inMemoryStore.getCommentById('CMT001')).toBeDefined();

      // System administrator approves the request
      const approved = inMemoryStore.approveApprovalRequest(
        approvalReq.id,
        'usr_admin_001',
        'تمت مراجعة التعليق وثبوت مخالفته للضوابط'
      );

      expect(approved.status).toBe('approved');
      expect(approved.reviewedBy).toBe('usr_admin_001');

      // Comment must now be permanently deleted
      expect(inMemoryStore.getCommentById('CMT001')).toBeUndefined();
      expect(inMemoryStore.getCourseComments('CRS001').map((c) => c.id)).not.toContain('CMT001');
    });

    it('rejecting deletion request by System Admin leaves comment completely unchanged in store', () => {
      const assistantId = 'USR016';
      const approvalReq = inMemoryStore.createApprovalRequest({
        actionType: 'comments.delete',
        titleAr: 'طلب حذف تعليق',
        targetId: 'CMT001',
        targetResourceId: 'CMT001',
        requestedBy: assistantId,
        requesterId: assistantId,
        requesterName: 'أحمد شريف',
        requesterRole: 'assistant_admin',
        payload: { commentId: 'CMT001', courseId: 'CRS001' },
      });

      const rejected = inMemoryStore.rejectApprovalRequest(
        approvalReq.id,
        'usr_admin_001',
        'التعليق لا يخالف معايير النقاش'
      );

      expect(rejected.status).toBe('rejected');

      // Comment must remain completely unchanged and visible
      const comment = inMemoryStore.getCommentById('CMT001');
      expect(comment).toBeDefined();
      expect(comment?.reported).toBe(true);
    });

    it('handles stale or deleted comment upon approval execution safely with failed_execution status', () => {
      const assistantId = 'USR016';
      const approvalReq = inMemoryStore.createApprovalRequest({
        actionType: 'comments.delete',
        titleAr: 'طلب حذف تعليق',
        targetId: 'CMT001',
        targetResourceId: 'CMT001',
        requestedBy: assistantId,
        requesterId: assistantId,
        requesterName: 'أحمد شريف',
        requesterRole: 'assistant_admin',
        payload: { commentId: 'CMT001', courseId: 'CRS001' },
      });

      // Target comment is deleted before approval arrives (e.g. by another admin)
      inMemoryStore.deleteComment('CMT001', { id: 'usr_admin_001', role: 'admin' });
      expect(inMemoryStore.getCommentById('CMT001')).toBeUndefined();

      // Attempting to approve the stale request must throw and mark failed_execution
      expect(() => {
        inMemoryStore.approveApprovalRequest(approvalReq.id, 'usr_admin_001');
      }).toThrowError('تعذر تنفيذ الاعتماد: التعليق المستهدف لم يعد موجوداً في السجل');

      const failedReq = inMemoryStore.getApprovalRequests().find((r) => r.id === approvalReq.id);
      expect(failedReq?.status).toBe('failed_execution');
      expect(failedReq?.executionError).toBeDefined();
    });

    it('prevents duplicate or repeated execution of already decided approval requests', () => {
      const assistantId = 'USR016';
      const approvalReq = inMemoryStore.createApprovalRequest({
        actionType: 'comments.delete',
        titleAr: 'طلب حذف تعليق',
        targetId: 'CMT001',
        targetResourceId: 'CMT001',
        requestedBy: assistantId,
        requesterId: assistantId,
        requesterName: 'أحمد شريف',
        requesterRole: 'assistant_admin',
        payload: { commentId: 'CMT001', courseId: 'CRS001' },
      });

      inMemoryStore.approveApprovalRequest(approvalReq.id, 'usr_admin_001');

      // Second attempt to approve must throw
      expect(() => {
        inMemoryStore.approveApprovalRequest(approvalReq.id, 'usr_admin_001');
      }).toThrowError('تم البت في هذا الطلب مسبقاً');
    });

    it('allows Assistant Admin to directly delete comment when operational delegation is active', async () => {
      setTestSession('assistant_admin');
      const assistantId = SYNTHETIC_DEMO_ACCOUNTS.assistant_admin.user.id;

      // Enable operational delegation
      inMemoryStore.setDelegatedAuthority(assistantId, true);
      expect(inMemoryStore.getDelegatedAuthority(assistantId)).toBe(true);

      const response = await commentsApi.deleteComment('CMT001');
      expect(response.success).toBe(true);
      expect(response.approvalRequired).toBeFalsy();

      // Comment is deleted directly
      expect(inMemoryStore.getCommentById('CMT001')).toBeUndefined();
    });

    it('allows Assistant Admin to directly ignore a comment report without routine approval (Decision 2)', async () => {
      setTestSession('assistant_admin');

      const updated = await commentsApi.ignoreCommentReport('CMT001');
      expect(updated.id).toBe('CMT001');
      expect(updated.reported).toBe(false);

      const inStore = inMemoryStore.getCommentById('CMT001');
      expect(inStore?.reported).toBe(false);
    });
  });

  // ── 5. Security Audit Trail Logging ─────────────────────────────────
  describe('5. Security Audit Trail Logging for Comment Operations', () => {
    it('records security audit entry for permanent comment deletion with accurate metadata', () => {
      const initialLogs = inMemoryStore.getSystemAuditLogs().total;

      inMemoryStore.deleteComment('CMT001', { id: 'usr_admin_001', role: 'admin' });

      const logs = inMemoryStore.getSystemAuditLogs();
      expect(logs.total).toBe(initialLogs + 1);

      const latestLog = logs.entries[0];
      expect(latestLog.action).toBe('comments.delete');
      expect(latestLog.actionLabelAr).toBe('حذف تعليق نهائياً');
      expect(latestLog.outcome).toBe('success');
      expect(latestLog.actorId).toBe('usr_admin_001');
      expect(latestLog.targetResourceId).toBe('CMT001');
      expect(latestLog.metadata?.commentId).toBe('CMT001');
      expect(latestLog.metadata?.courseId).toBe('CRS001');
    });

    it('records security audit entry for ignoring comment reports', () => {
      inMemoryStore.ignoreCommentReport('CMT001', { id: 'usr_admin_001', role: 'admin' });

      const latestLog = inMemoryStore.getSystemAuditLogs().entries[0];
      expect(latestLog.action).toBe('comments.ignore_report');
      expect(latestLog.actionLabelAr).toBe('تجاهل بلاغ تعليق');
      expect(latestLog.outcome).toBe('success');
      expect(latestLog.targetResourceId).toBe('CMT001');
    });

    it('records security audit entry when course discussion policy is toggled', () => {
      inMemoryStore.toggleCourseComments('CRS001', false, { id: 'usr_admin_001', role: 'admin' });

      const latestLog = inMemoryStore.getSystemAuditLogs().entries[0];
      expect(latestLog.action).toBe('comments.toggle');
      expect(latestLog.actionLabelAr).toBe('تعديل حالة النقاشات للمقرر');
      expect(latestLog.outcome).toBe('success');
      expect(latestLog.targetResourceId).toBe('CRS001');
      expect(latestLog.metadata?.commentsEnabled).toBe(false);
    });

    it('records security audit entry when trainee reports an inappropriate comment', () => {
      inMemoryStore.reportComment(
        'CMT002',
        { reason: 'harassment', notes: 'إزعاج' },
        { id: 'usr_trainee_003', role: 'user', name: 'أحمد ممدوح سالم' }
      );

      const latestLog = inMemoryStore.getSystemAuditLogs().entries[0];
      expect(latestLog.action).toBe('comments.report');
      expect(latestLog.actionLabelAr).toBe('الإبلاغ عن تعليق مخالف');
      expect(latestLog.outcome).toBe('success');
      expect(latestLog.actorId).toBe('usr_trainee_003');
      expect(latestLog.targetResourceId).toBe('CMT002');
      expect(latestLog.metadata?.reason).toBe('harassment');
    });

    it('separates approval request submission event from eventual domain execution event', async () => {
      setTestSession('assistant_admin');
      const initialLogs = inMemoryStore.getSystemAuditLogs().total;

      // 1. Submit approval request via API
      const res = await commentsApi.deleteComment('CMT001');
      expect(res.approvalRequired).toBe(true);

      const logsAfterSubmit = inMemoryStore.getSystemAuditLogs();
      expect(logsAfterSubmit.total).toBe(initialLogs + 1);

      const submitLog = logsAfterSubmit.entries[0];
      expect(submitLog.action).toBe('approvals.submit_request');
      expect(submitLog.outcome).toBe('pending_approval');
      expect(submitLog.requestId).toBe(res.requestId);

      // 2. Decide and execute approval by Admin
      inMemoryStore.approveApprovalRequest(res.requestId!, 'usr_admin_001');

      const logsAfterApprove = inMemoryStore.getSystemAuditLogs();
      // Should have: approvals.decide_request (success) + comments.delete (success)
      expect(logsAfterApprove.total).toBe(initialLogs + 3);

      const actions = logsAfterApprove.entries.slice(0, 2).map((l) => l.action);
      expect(actions).toContain('comments.delete');
      expect(actions).toContain('approvals.decide_request');
    });
  });
});
