/**
 * Increment 4.1: Default Approval Policy & Exact Delegation
 *
 * Grounded in:
 * - docs/backend/pre-backend-migration-remediation-roadmap.md (Revision 5, Phase 4, Increment 4.1)
 * - MFR-35 (Fail-open policy gap elimination)
 * - INV-R9 (Every state-changing capability requires approval by default for assistant_admin)
 * - D-05 (Delegation authority governance & anti-self-dealing)
 *
 * TEST EXECUTION DIRECTIVE:
 * STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
 * Zero test runner commands (vitest, npm test, tsc, eslint) were executed during this increment.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import {
  evaluatePermission,
  isReadOnlyCapability,
  isDirectMetaCapability,
  READ_ONLY_CAPABILITIES,
  DIRECT_META_CAPABILITIES,
  ASSISTANT_ADMIN_APPROVAL_REQUIRED_CAPABILITIES,
} from '@/core/permissions/policy';
import { requireCapabilityOrApproval } from '@/mocks/handlers/utils/routeGuards';
import type { User, UserRole } from '@/core/auth/types';
import type { SystemCapability } from '@/core/permissions/types';

describe('Increment 4.1 — Default Approval Policy & Exact Delegation (INV-R9 / MFR-35)', () => {
  // Primary Assistant Admin Actor
  const assistantUser: User = {
    id: 'USR016',
    name: 'مساعد مدير النظام التجريبي',
    email: 'assistant@metro.gov.eg',
    role: 'assistant_admin',
    department: 'التشغيل والدعم الإداري',
    jobTitle: 'مساعد مدير نظام',
    initials: 'م.م',
  };

  // Secondary Assistant Admin Actor (for Identity Isolation tests)
  const otherAssistant: User = {
    id: 'USR017_OTHER',
    name: 'مساعد مدير نظام آخر',
    email: 'other_assistant@metro.gov.eg',
    role: 'assistant_admin',
    department: 'التشغيل والدعم الإداري',
    jobTitle: 'مساعد مدير نظام',
    initials: 'م.آ',
  };

  const adminActor = { id: 'usr-1', role: 'admin' as UserRole };

  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterEach(() => {
    server.resetHandlers();
    authStorage.clearSession();
    inMemoryStore.reset({ seedGroupDemo: true });
  });
  afterAll(() => server.close());

  beforeEach(() => {
    inMemoryStore.reset({ seedGroupDemo: true });
  });

  // ── Section 1: Default-to-Approval Invariant (INV-R9 & MFR-35) ─────────────

  it('1. requires approval by default for standard assistant_admin state-changing capabilities (INV-R9)', () => {
    const res = inMemoryStore.hasPermission(assistantUser, 'groups.create');
    expect(res.granted).toBe(true);
    expect(res.executionMode).toBe('requires_approval');
    expect(res.reason).toBe('REQUIRES_ADMIN_APPROVAL');
  });

  it('2. verifies each of the six previously omitted capabilities requires approval by default (MFR-35)', () => {
    const omittedStateChanging: SystemCapability[] = [
      'groups.generate_qr',
      'materials.manage_folders',
      'materials.upload_files',
      'materials.manage_meetings',
      'reviews.submit_course',
      'comments.ignore_report',
    ];

    for (const cap of omittedStateChanging) {
      const res = inMemoryStore.hasPermission(assistantUser, cap);
      expect(res.granted).toBe(true);
      expect(res.executionMode).toBe('requires_approval');
      expect(ASSISTANT_ADMIN_APPROVAL_REQUIRED_CAPABILITIES.has(cap)).toBe(true);
    }
  });

  it('3. retains direct execution mode for genuine read-only capabilities', () => {
    const readOnlyCaps: SystemCapability[] = [
      'users.view_directory',
      'users.view_transcript',
      'courses.view',
      'learning.access_assigned',
      'permissions.view_matrix',
      'comments.moderate',
    ];

    for (const cap of readOnlyCaps) {
      expect(isReadOnlyCapability(cap)).toBe(true);
      const res = inMemoryStore.hasPermission(assistantUser, cap);
      expect(res.granted).toBe(true);
      expect(res.executionMode).toBe('direct');
      expect(res.reason).toBe('GRANTED');
    }
  });

  it('4. classifies approvals.submit_request as a direct meta-action, NOT read-only', () => {
    expect(isReadOnlyCapability('approvals.submit_request')).toBe(false);
    expect(isDirectMetaCapability('approvals.submit_request')).toBe(true);
    expect(DIRECT_META_CAPABILITIES.has('approvals.submit_request')).toBe(true);

    // Direct meta-actions execute directly to prevent infinite approval recursion
    const res = inMemoryStore.hasPermission(assistantUser, 'approvals.submit_request');
    expect(res.granted).toBe(true);
    expect(res.executionMode).toBe('direct');
  });

  it('5. fails closed: arbitrary or newly introduced non-read capabilities cannot execute directly (fail-closed invariant)', () => {
    const unclassifiedCapability = 'custom_module.mutate_data' as SystemCapability;
    expect(isReadOnlyCapability(unclassifiedCapability)).toBe(false);
    expect(isDirectMetaCapability(unclassifiedCapability)).toBe(false);

    const evalResult = evaluatePermission(
      { id: assistantUser.id, role: 'assistant_admin' },
      unclassifiedCapability,
      {
        userOverrides: {
          [assistantUser.id]: {
            granted: [unclassifiedCapability],
            revoked: [],
          },
        },
      }
    );

    // Even if granted by override, Step 6 enforces requires_approval because it is not read-only or meta
    expect(evalResult.executionMode).toBe('requires_approval');
  });

  // ── Section 2: Exact Delegation Semantics & Identity Integrity ───────────

  it('6. permits direct execution when an active delegation covers the exact capability key', () => {
    inMemoryStore.setDelegatedAuthority(
      assistantUser.id,
      {
        capabilities: ['groups.create'],
        active: true,
      },
      adminActor
    );

    const checkCreate = inMemoryStore.hasPermission(assistantUser, 'groups.create');
    expect(checkCreate.granted).toBe(true);
    expect(checkCreate.executionMode).toBe('direct');
  });

  it('7. enforces delegation identity ownership: a grant for one assistant_admin cannot be used by another', () => {
    // Admin delegates groups.create strictly to otherAssistant
    inMemoryStore.setDelegatedAuthority(
      otherAssistant.id,
      {
        capabilities: ['groups.create'],
        active: true,
      },
      adminActor
    );

    // otherAssistant can execute directly
    const otherCheck = inMemoryStore.hasPermission(otherAssistant, 'groups.create');
    expect(otherCheck.executionMode).toBe('direct');

    // assistantUser has NO delegation and must continue to require approval
    const primaryCheck = inMemoryStore.hasPermission(assistantUser, 'groups.create');
    expect(primaryCheck.executionMode).toBe('requires_approval');
  });

  it('8. enforces exact capability isolation: delegation for C1 does not permit C2', () => {
    inMemoryStore.setDelegatedAuthority(
      assistantUser.id,
      {
        capabilities: ['materials.upload_files'],
        active: true,
      },
      adminActor
    );

    expect(inMemoryStore.hasPermission(assistantUser, 'materials.upload_files').executionMode).toBe('direct');
    expect(inMemoryStore.hasPermission(assistantUser, 'groups.create').executionMode).toBe('requires_approval');
    expect(inMemoryStore.hasPermission(assistantUser, 'comments.delete').executionMode).toBe('requires_approval');
  });

  it('9. enforces strict expiration boundary: expired at exact timestamp (now >= exp)', () => {
    const fixedNow = 1735689600000; // 2025-01-01T00:00:00.000Z
    const originalDateNow = Date.now;
    Date.now = () => fixedNow;

    try {
      // Grant that expires at exact current timestamp
      inMemoryStore.setDelegatedAuthority(
        assistantUser.id,
        {
          capabilities: ['groups.create'],
          active: true,
          expiresAt: fixedNow, // Exact boundary
        },
        adminActor
      );

      // Must be expired at exact timestamp
      const checkBoundary = inMemoryStore.hasPermission(assistantUser, 'groups.create');
      expect(checkBoundary.executionMode).toBe('requires_approval');

      // 1 millisecond before boundary: valid
      inMemoryStore.setDelegatedAuthority(
        assistantUser.id,
        {
          capabilities: ['groups.create'],
          active: true,
          expiresAt: fixedNow + 1,
        },
        adminActor
      );
      const checkValid = inMemoryStore.hasPermission(assistantUser, 'groups.create');
      expect(checkValid.executionMode).toBe('direct');
    } finally {
      Date.now = originalDateNow;
    }
  });

  it('10. enforces resource scope isolation: scoped grant cannot act as a global bypass', () => {
    inMemoryStore.setDelegatedAuthority(
      assistantUser.id,
      {
        capabilities: ['groups.manage_members'],
        active: true,
        resourceScope: { groupId: 'grp-authorized' },
      },
      adminActor
    );

    // Matching group: direct
    const checkMatching = inMemoryStore.hasPermission(assistantUser, 'groups.manage_members', {
      targetGroupId: 'grp-authorized',
    });
    expect(checkMatching.executionMode).toBe('direct');

    // Mismatched group: requires approval
    const checkWrongGroup = inMemoryStore.hasPermission(assistantUser, 'groups.manage_members', {
      targetGroupId: 'grp-other',
    });
    expect(checkWrongGroup.executionMode).toBe('requires_approval');

    // Missing target group in context: fails closed, requires approval
    const checkMissingGroup = inMemoryStore.hasPermission(assistantUser, 'groups.manage_members');
    expect(checkMissingGroup.executionMode).toBe('requires_approval');
  });

  it('11. enforces trust boundary: caller cannot forge hasDelegationBypass context flag', () => {
    // Untrusted caller supplies hasDelegationBypass: true in context without an actual delegation grant
    const check = inMemoryStore.hasPermission(assistantUser, 'groups.create', {
      hasDelegationBypass: true, // Forged flag
    } as any);

    // inMemoryStore must overwrite the flag from authoritative ledger, resulting in requires_approval
    expect(check.executionMode).toBe('requires_approval');
  });

  // ── Section 3: Handler-Level 202 Interception for the Six Capabilities ────

  it('12. intercepts groups.generate_qr at handler: returns 202 without mutating QR token', async () => {
    const groupId = 'GRP-101';
    const groupBefore = inMemoryStore.getGroupById(groupId);
    const tokenBefore = groupBefore?.enrollmentQrToken;

    // Call route guard directly as handlers do
    const guard = requireCapabilityOrApproval(assistantUser, 'groups.generate_qr', {
      context: { targetGroupId: groupId },
      targetId: groupId,
      resourceScope: { groupId },
      payload: { groupId, action: 'rotate' },
    });

    expect(guard.proceed).toBe(false);
    expect(guard.response?.status).toBe(202);

    // State not mutated
    const groupAfter = inMemoryStore.getGroupById(groupId);
    expect(groupAfter?.enrollmentQrToken).toBe(tokenBefore);
  });

  it('13. intercepts materials.manage_folders at handler: returns 202 without creating folder', async () => {
    const groupId = 'GRP-101';
    const foldersBefore = inMemoryStore.getGroupMaterials(groupId, 'admin').folders.length;

    const guard = requireCapabilityOrApproval(assistantUser, 'materials.manage_folders', {
      context: { targetGroupId: groupId },
      targetId: groupId,
      resourceScope: { groupId },
      payload: { groupId, name: 'مجلد اختبار جديد' },
    });

    expect(guard.proceed).toBe(false);
    expect(guard.response?.status).toBe(202);

    const foldersAfter = inMemoryStore.getGroupMaterials(groupId, 'admin').folders.length;
    expect(foldersAfter).toBe(foldersBefore);
  });

  it('14. intercepts materials.upload_files at handler: returns 202 without adding file', async () => {
    const groupId = 'GRP-101';
    const materialsBefore = inMemoryStore.getGroupMaterials(groupId, 'admin');
    const folder = materialsBefore.folders[0];
    const filesBeforeCount = folder?.files.length || 0;

    const guard = requireCapabilityOrApproval(assistantUser, 'materials.upload_files', {
      context: { targetGroupId: groupId },
      targetId: groupId,
      resourceScope: { groupId },
      payload: { groupId, folderId: folder?.id, fileName: 'test.pdf' },
    });

    expect(guard.proceed).toBe(false);
    expect(guard.response?.status).toBe(202);

    const materialsAfter = inMemoryStore.getGroupMaterials(groupId, 'admin');
    const filesAfterCount = materialsAfter.folders.find((f) => f.id === folder?.id)?.files.length || 0;
    expect(filesAfterCount).toBe(filesBeforeCount);
  });

  it('15. intercepts materials.manage_meetings at handler: returns 202 without modifying resources', async () => {
    const groupId = 'GRP-101';
    const groupBefore = inMemoryStore.getGroupById(groupId);
    const resourcesBefore = (groupBefore?.resources || []).length;

    const guard = requireCapabilityOrApproval(assistantUser, 'materials.manage_meetings', {
      context: { targetGroupId: groupId },
      targetId: groupId,
      resourceScope: { groupId },
      payload: {
        groupId,
        resources: [
          ...(groupBefore?.resources || []),
          { id: 'meeting-new', title: 'ورشة عمل تفاعلية', type: 'zoom', url: 'https://zoom.us/j/123' },
        ],
      },
    });

    expect(guard.proceed).toBe(false);
    expect(guard.response?.status).toBe(202);

    const groupAfter = inMemoryStore.getGroupById(groupId);
    expect((groupAfter?.resources || []).length).toBe(resourcesBefore);
  });

  it('16. intercepts reviews.submit_course at handler: returns 202 without advancing course status', async () => {
    const courseId = 'course-1';
    const courseBefore = inMemoryStore.getCourseById(courseId);
    const statusBefore = courseBefore?.status;

    const guard = requireCapabilityOrApproval(assistantUser, 'reviews.submit_course', {
      context: { targetCourseId: courseId },
      targetId: courseId,
      resourceScope: { courseId },
      payload: { courseId },
    });

    expect(guard.proceed).toBe(false);
    expect(guard.response?.status).toBe(202);

    const courseAfter = inMemoryStore.getCourseById(courseId);
    expect(courseAfter?.status).toBe(statusBefore);
  });

  it('17. intercepts comments.ignore_report at handler: returns 202 without clearing comment report', async () => {
    const targetCommentId = 'comm_rep_001';
    const commentBefore = inMemoryStore.getCommentById(targetCommentId);
    expect(commentBefore?.reported).toBe(true);

    const guard = requireCapabilityOrApproval(assistantUser, 'comments.ignore_report', {
      targetId: targetCommentId,
      payload: { commentId: targetCommentId },
    });

    expect(guard.proceed).toBe(false);
    expect(guard.response?.status).toBe(202);

    const commentAfter = inMemoryStore.getCommentById(targetCommentId);
    expect(commentAfter?.reported).toBe(true);
  });

  // ── Section 4: Approval Request Payload Integrity for Increment 4.2 ───────

  it('18. verifies approval request retains exact capability, requester, target, resourceScope, and payload', () => {
    const targetCommentId = 'comm_rep_001';
    const guard = requireCapabilityOrApproval(assistantUser, 'comments.ignore_report', {
      targetId: targetCommentId,
      targetResourceId: targetCommentId,
      targetResourceName: 'تعليق مخالف للتجربة',
      resourceScope: { courseId: 'course-1' },
      justification: 'تجاهل بلاغ تعليق تجريبي لسلامة الحمولة',
      payload: { commentId: targetCommentId, customKey: 'val-123' },
    });

    expect(guard.proceed).toBe(false);

    const pendingRequests = inMemoryStore.getApprovalRequests();
    const req = pendingRequests.find((r) => r.targetId === targetCommentId);
    expect(req).toBeDefined();

    // Exact fields verified for Increment 4.2 execution safety:
    expect(req?.actionType).toBe('comments.ignore_report');
    expect(req?.capability).toBe('comments.ignore_report');
    expect(req?.requesterId).toBe(assistantUser.id);
    expect(req?.requesterRole).toBe('assistant_admin');
    expect(req?.targetId).toBe(targetCommentId);
    expect(req?.targetResourceId).toBe(targetCommentId);
    expect(req?.targetResourceName).toBe('تعليق مخالف للتجربة');
    expect(req?.resourceScope?.courseId).toBe('course-1');
    expect(req?.payload).toEqual({ commentId: targetCommentId, customKey: 'val-123' });
    expect(req?.status).toBe('pending');
  });

  it('19. permits direct execution through route guard when active exact delegation is present', () => {
    inMemoryStore.setDelegatedAuthority(
      assistantUser.id,
      {
        capabilities: ['comments.ignore_report'],
        active: true,
      },
      adminActor
    );

    const guard = requireCapabilityOrApproval(assistantUser, 'comments.ignore_report', {
      targetId: 'comm_rep_001',
    });

    expect(guard.proceed).toBe(true);
    expect(guard.response).toBeUndefined();
    expect(guard.check.executionMode).toBe('direct');
  });

  // ── Section 5: Negative Delegation Edge Cases & Identity Isolation ───────

  it('20. negative delegation: revoked delegation (active: false) fails closed and cannot bypass approval', () => {
    inMemoryStore.setDelegatedAuthority(
      assistantUser.id,
      {
        capabilities: ['groups.create'],
        active: false, // Explicitly revoked / inactive
      },
      adminActor
    );

    const check = inMemoryStore.hasPermission(assistantUser, 'groups.create');
    expect(check.executionMode).toBe('requires_approval');
  });

  it('21. negative delegation: malformed expiration string (NaN) fails closed and requires approval', () => {
    inMemoryStore.setDelegatedAuthority(
      assistantUser.id,
      {
        capabilities: ['groups.create'],
        active: true,
        expiresAt: 'not-a-valid-date-string' as any,
      },
      adminActor
    );

    const check = inMemoryStore.hasPermission(assistantUser, 'groups.create');
    expect(check.executionMode).toBe('requires_approval');
  });

  it('22. negative delegation: malformed capabilities (not an array or null) fails closed', () => {
    // Injected malformed grant with null capabilities
    (inMemoryStore as any).delegatedGrants[assistantUser.id.toLowerCase()] = [
      {
        id: 'DEL_MALFORMED',
        userId: assistantUser.id,
        active: true,
        capabilities: null as any,
      },
    ];

    const check = inMemoryStore.hasPermission(assistantUser, 'groups.create');
    expect(check.executionMode).toBe('requires_approval');
  });

  it('23. negative delegation: grant indexed under User A with missing or empty userId fails closed', () => {
    (inMemoryStore as any).delegatedGrants[assistantUser.id.toLowerCase()] = [
      {
        id: 'DEL_MISSING_USERID',
        userId: '' as any,
        active: true,
        capabilities: ['groups.create'],
      },
    ];

    const check = inMemoryStore.hasPermission(assistantUser, 'groups.create');
    expect(check.executionMode).toBe('requires_approval');
  });

  it('24. negative delegation: grant indexed under User A with User B userId fails closed (cross-user injection protection)', () => {
    // Malicious injection: otherAssistant's grant placed in assistantUser's ledger slot
    (inMemoryStore as any).delegatedGrants[assistantUser.id.toLowerCase()] = [
      {
        id: 'DEL_STOLEN',
        userId: otherAssistant.id,
        active: true,
        capabilities: ['groups.create'],
      },
    ];

    const check = inMemoryStore.hasPermission(assistantUser, 'groups.create');
    expect(check.executionMode).toBe('requires_approval');
  });

  it('25. negative delegation: legacy authority object with mismatched userId fails closed', () => {
    (inMemoryStore as any).delegatedOperationalAuthority[assistantUser.id.toLowerCase()] = {
      id: 'DEL_LEGACY_MISMATCH',
      userId: otherAssistant.id,
      active: true,
      capabilities: ['groups.create'],
    };

    const check = inMemoryStore.hasPermission(assistantUser, 'groups.create');
    expect(check.executionMode).toBe('requires_approval');
  });

  // ── Section 6: comments.moderate Classification & Read/Mutation Separation ──

  it('26. comments.moderate classification: verified as read-only, granted direct execution for viewing queue without approval', () => {
    expect(isReadOnlyCapability('comments.moderate')).toBe(true);
    expect(ASSISTANT_ADMIN_APPROVAL_REQUIRED_CAPABILITIES.has('comments.moderate')).toBe(false);

    // Read-only moderation queue access executes directly
    const check = inMemoryStore.hasPermission(assistantUser, 'comments.moderate');
    expect(check.granted).toBe(true);
    expect(check.executionMode).toBe('direct');
  });

  it('27. comments mutations: comments.delete, comments.ignore_report, comments.toggle strictly require approval by default', () => {
    const commentMutations: SystemCapability[] = [
      'comments.delete',
      'comments.ignore_report',
      'comments.toggle',
    ];

    for (const mutationCap of commentMutations) {
      expect(isReadOnlyCapability(mutationCap)).toBe(false);
      expect(ASSISTANT_ADMIN_APPROVAL_REQUIRED_CAPABILITIES.has(mutationCap)).toBe(true);
      const check = inMemoryStore.hasPermission(assistantUser, mutationCap);
      expect(check.granted).toBe(true);
      expect(check.executionMode).toBe('requires_approval');
    }
  });

  // ── Section 7: Mixed Group/Meeting Mutation Defense & Payload Isolation ───

  it('28. mixed group/meeting mutation: PUT /api/admin/groups/:groupId with both config and resources is rejected with HTTP 400', async () => {
    authStorage.setSession({
      user: assistantUser,
      token: 'test-assistant-token',
      impersonatedBy: null,
    });

    const response = await fetch('http://localhost:3000/api/admin/groups/GRP-101', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-assistant-token',
      },
      body: JSON.stringify({
        name: 'اسم معدل بشكل غير مسموح',
        resources: [
          {
            id: 'meeting-sneak-in',
            type: 'zoom',
            title: 'محاولة تعديل جماعي',
            url: 'https://zoom.us/j/999',
          },
        ],
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toContain('لا يمكن دمج تعديل إعدادات المجموعة التدريبية مع تحديث الموارد والاجتماعات');
  });

  it('29. pure meeting update isolates ApprovalRequest.payload to strictly resources without config leakage', async () => {
    authStorage.setSession({
      user: assistantUser,
      token: 'test-assistant-token',
      impersonatedBy: null,
    });

    const meetingResources = [
      {
        id: 'meeting-iso-001',
        type: 'zoom',
        title: 'اجتماع تفاعلي مستقل',
        url: 'https://zoom.us/j/123456',
      },
    ];

    const response = await fetch('http://localhost:3000/api/admin/groups/GRP-101', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-assistant-token',
      },
      body: JSON.stringify({
        resources: meetingResources,
      }),
    });

    expect(response.status).toBe(202);
    const data = await response.json();
    expect(data.approvalRequired).toBe(true);

    const pendingRequests = inMemoryStore.getApprovalRequests();
    const req = pendingRequests.find((r) => r.id === data.requestId);
    expect(req).toBeDefined();
    expect(req?.actionType).toBe('materials.manage_meetings');
    expect(req?.capability).toBe('materials.manage_meetings');
    expect(req?.payload).toEqual({
      groupId: 'GRP-101',
      resources: meetingResources,
    });
    // Ensure no extraneous group configuration fields exist in the approval payload
    expect(req?.payload?.name).toBeUndefined();
    expect(req?.payload?.maxTrainees).toBeUndefined();
  });
});
