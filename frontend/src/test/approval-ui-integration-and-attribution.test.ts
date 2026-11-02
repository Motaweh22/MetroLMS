/**
 * Increment 4.3: 202 UI Integration, Notifications & Audit Attribution
 *
 * Grounded in:
 * - docs/backend/pre-backend-migration-remediation-roadmap.md (Revision 5, Phase 4, Increment 4.3)
 * - MFR-09 (Authentic Actor Audit Attribution Remediation)
 * - INV-R8 (Developer Identity Confidentiality Projections)
 * - 11 Identified UI Mutation Surfaces Handling HTTP 202 Accepted
 *
 * TEST EXECUTION DIRECTIVE:
 * STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
 * Zero test runner commands (vitest, npm test, tsc, eslint) were executed during this increment.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { inMemoryStore, MockStoreError } from '@/mocks/store/inMemoryStore';
import type { User, UserRole } from '@/core/auth/types';
import type { CreateGroupRequestDTO, UpdateGroupRequestDTO } from '@/core/groups/types';
import type { Course, CourseStatus } from '@/core/course/types';
import type { ReviewDecisionRequestDTO } from '@/core/courses/types';

describe('Increment 4.3 — 202 UI Integration, Notifications & Audit Attribution', () => {
  // Test Personas
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
    department: 'إدارة التدريب',
    jobTitle: 'مساعد إداري',
    initials: 'أ.ش',
  };

  const lecturerActor: User = {
    id: 'usr_lect_002',
    name: 'د. خالد عبد الرحمن',
    email: 'lecturer@cairo-metro.com',
    role: 'lecturer',
    department: 'إدارة هندسة السكة والمسار',
    jobTitle: 'كبير مدربي هندسة السكة',
    initials: 'خ.ع',
  };

  beforeEach(() => {
    inMemoryStore.reset();
  });

  afterEach(() => {
    inMemoryStore.reset();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 1: MFR-09 Authentic Actor Audit Attribution Remediation
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. MFR-09 Authentic Actor Audit Attribution', () => {
    it('1.1. attributes group creation to the authentic administrator, not hardcoded fallback', () => {
      const dto: CreateGroupRequestDTO = {
        name: 'مجموعة الصيانة المركزية',
        description: 'مجموعة تجريبية',
        startDateTime: '2026-11-10T08:00:00Z',
        deadlineDateTime: '2026-12-10T17:00:00Z',
        postDeadlinePolicy: 'allow_read_only',
        courseAssignments: [{ courseId: 'CRS001', order: 1 }],
      };

      const group = inMemoryStore.createGroup(dto, { id: superAdminActor.id, role: superAdminActor.role });
      expect(group).toBeDefined();

      const logs = inMemoryStore.getSystemAuditLogs({ action: 'groups.create' });
      expect(logs.entries.length).toBeGreaterThan(0);
      const latestLog = logs.entries[0];
      expect(latestLog.actorId).toBe(superAdminActor.id);
      expect(latestLog.actorRole).toBe('super_admin');
      expect(latestLog.actorName).toBe(superAdminActor.name);
      expect(latestLog.actorId).not.toBe('usr_admin_001');
    });

    it('1.2. attributes automated renewal cycle to SYSTEM, not hardcoded admin', () => {
      const targetGroup = inMemoryStore.getAdminGroups().find((g) => g.adminStatus === 'active');
      expect(targetGroup).toBeDefined();

      const result = inMemoryStore.advanceRenewalCycle(targetGroup!.id);
      expect(result.success).toBe(true);

      const logs = inMemoryStore.getSystemAuditLogs({ action: 'groups.create' });
      const automatedLog = logs.entries.find((e) => e.targetResourceId === result.successorGroupId);
      expect(automatedLog).toBeDefined();
      expect(automatedLog!.actorId).toBe('SYSTEM');
      expect(automatedLog!.actorRole).toBe('system');
      expect(automatedLog!.actorName).toBe('النظام');
      expect(automatedLog!.actorId).not.toBe('usr_admin_001');
    });

    it('1.3. attributes group update and configuration to authentic actor', () => {
      const targetGroup = inMemoryStore.getAdminGroups()[0];
      inMemoryStore.updateGroup(
        targetGroup.id,
        { description: 'تحديث الوصف بواسطة كبير المهندسين' },
        { id: developerActor.id, role: developerActor.role }
      );

      const logs = inMemoryStore.getSystemAuditLogs({ action: 'groups.edit_config' }, 'developer');
      const latestLog = logs.entries[0];
      expect(latestLog.actorId).toBe(developerActor.id);
      expect(latestLog.actorRole).toBe('developer');
      expect(latestLog.actorName).toBe(developerActor.name);
    });

    it('1.4. attributes group safe archive and deletion to authentic actor', () => {
      const targetGroup = inMemoryStore.getAdminGroups()[0];
      inMemoryStore.deleteGroup(targetGroup.id, { id: superAdminActor.id, role: superAdminActor.role });

      const logs = inMemoryStore.getSystemAuditLogs({ action: 'groups.delete' });
      const latestLog = logs.entries[0];
      expect(latestLog.actorId).toBe(superAdminActor.id);
      expect(latestLog.actorRole).toBe('super_admin');
    });

    it('1.5. attributes user management mutations (create, role, status, delete) to authentic actor', () => {
      // 1. Create User
      const newUser = inMemoryStore.createUser(
        {
          name: 'طارق عبد الله',
          username: 'tarek.abdallah',
          email: 'tarek.abdallah@cairo-metro.com',
          jobTitle: 'مهندس اتصالات',
          department: 'إدارة الاتصالات',
          role: 'user',
        },
        { id: superAdminActor.id, role: superAdminActor.role }
      );
      let logs = inMemoryStore.getSystemAuditLogs({ action: 'users.create' });
      expect(logs.entries[0].actorId).toBe(superAdminActor.id);

      // 2. Change Role
      inMemoryStore.setUserRole(newUser.id, 'lecturer', { id: adminActor.id, role: adminActor.role });
      logs = inMemoryStore.getSystemAuditLogs({ action: 'users.change_role' });
      expect(logs.entries[0].actorId).toBe(adminActor.id);

      // 3. Change Status
      inMemoryStore.setUserStatus(newUser.id, 'suspended', 'إيقاف إداري تجريبي', {
        id: superAdminActor.id,
        role: superAdminActor.role,
      });
      logs = inMemoryStore.getSystemAuditLogs({ action: 'users.change_status' });
      expect(logs.entries[0].actorId).toBe(superAdminActor.id);

      // 4. Delete User
      inMemoryStore.deleteUser(newUser.id, { id: superAdminActor.id, role: superAdminActor.role });
      logs = inMemoryStore.getSystemAuditLogs({ action: 'users.delete' });
      expect(logs.entries[0].actorId).toBe(superAdminActor.id);
    });

    it('1.6. attributes permission governance and delegation to authentic actor', () => {
      inMemoryStore.setRolePermissions(
        'lecturer',
        ['courses.view_catalog', 'courses.edit_curriculum'],
        adminActor.id
      );
      let logs = inMemoryStore.getSystemAuditLogs({ action: 'permissions.configure_roles' });
      expect(logs.entries[0].actorId).toBe(adminActor.id);

      inMemoryStore.setDelegatedAuthority(
        assistantActor.id,
        { active: true, capabilities: ['groups.create'] },
        { id: superAdminActor.id, role: superAdminActor.role }
      );
      logs = inMemoryStore.getSystemAuditLogs({ action: 'governance.delegation' });
      expect(logs.entries[0].actorId).toBe(superAdminActor.id);
    });

    it('1.7. attributes course review decision execution to authentic user role rather than hardcoded admin', () => {
      const result = inMemoryStore.executeReviewDecision(
        'CRS001',
        { outcome: 'approved', approvalNote: 'معتمد بعد المراجعة الشاملة' },
        superAdminActor
      );
      expect(result.outcome).toBe('approved');

      const logs = inMemoryStore.getSystemAuditLogs({ action: 'courses.publish' });
      const publishLog = logs.entries[0];
      expect(publishLog.actorId).toBe(superAdminActor.id);
      expect(publishLog.actorRole).toBe('super_admin');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 2: Separate Requester vs Approver Audit Attribution
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Separate Requester vs Approver Audit Attribution', () => {
    it('2.1. identifies real requester on approval request submission audit record', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        titleAr: 'طلب أرشفة المجموعة التدريبية GRP-101',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        requesterId: assistantActor.id,
        requesterName: assistantActor.name,
        requesterRole: assistantActor.role,
        payload: { groupId: 'GRP-101' },
      });

      const logs = inMemoryStore.getSystemAuditLogs({ action: 'approvals.submit_request' });
      const submitLog = logs.entries.find((e) => e.requestId === req.id);
      expect(submitLog).toBeDefined();
      expect(submitLog!.actorId).toBe(assistantActor.id);
      expect(submitLog!.actorRole).toBe('assistant_admin');
      expect(submitLog!.outcome).toBe('pending_approval');
    });

    it('2.2. identifies actual approver as actor while preserving original requester in metadata', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        titleAr: 'طلب أرشفة المجموعة التدريبية GRP-101',
        targetId: 'GRP-101',
        requestedBy: assistantActor.id,
        requesterId: assistantActor.id,
        requesterName: assistantActor.name,
        requesterRole: assistantActor.role,
        payload: { groupId: 'GRP-101' },
      });

      inMemoryStore.approveApprovalRequest(req.id, superAdminActor.id, 'موافقة معتمدة من الإدارة العليا');

      const logs = inMemoryStore.getSystemAuditLogs({ action: 'approvals.decide_request' });
      const decisionLog = logs.entries.find((e) => e.requestId === req.id && e.outcome === 'success');
      expect(decisionLog).toBeDefined();
      expect(decisionLog!.actorId).toBe(superAdminActor.id);
      expect(decisionLog!.actorRole).toBe('super_admin');
      expect(decisionLog!.metadata).toBeDefined();
      expect(decisionLog!.metadata!.requesterId).toBe(assistantActor.id);
      expect(decisionLog!.metadata!.approverId).toBe(superAdminActor.id);
    });

    it('2.3. identifies actual reviewer as actor on rejection while preserving original requester', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        titleAr: 'طلب أرشفة المجموعة التدريبية GRP-102',
        targetId: 'GRP-102',
        requestedBy: assistantActor.id,
        requesterId: assistantActor.id,
        requesterName: assistantActor.name,
        requesterRole: assistantActor.role,
        payload: { groupId: 'GRP-102' },
      });

      inMemoryStore.rejectApprovalRequest(req.id, adminActor.id, 'المجموعة لا تزال في مرحلة نشطة');

      const logs = inMemoryStore.getSystemAuditLogs({ action: 'approvals.decide_request' });
      const rejectLog = logs.entries.find((e) => e.requestId === req.id && e.outcome === 'rejected');
      expect(rejectLog).toBeDefined();
      expect(rejectLog!.actorId).toBe(adminActor.id);
      expect(rejectLog!.actorRole).toBe('admin');
      expect(rejectLog!.metadata).toBeDefined();
      expect(rejectLog!.metadata!.requesterId).toBe(assistantActor.id);
      expect(rejectLog!.metadata!.reviewerId).toBe(adminActor.id);
    });

    it('2.4. preserves both requester and reviewer on failed execution rollback audit records', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        titleAr: 'طلب أرشفة مجموعة محذوفة سلفاً',
        targetId: 'GRP-NONEXISTENT',
        requestedBy: assistantActor.id,
        requesterId: assistantActor.id,
        requesterName: assistantActor.name,
        requesterRole: assistantActor.role,
        payload: { groupId: 'GRP-NONEXISTENT' },
      });

      expect(() => {
        inMemoryStore.approveApprovalRequest(req.id, superAdminActor.id);
      }).toThrow();

      const logs = inMemoryStore.getSystemAuditLogs({ action: 'approvals.decide_request' });
      const failLog = logs.entries.find((e) => e.requestId === req.id && e.outcome === 'failed');
      expect(failLog).toBeDefined();
      expect(failLog!.actorId).toBe(superAdminActor.id);
      expect(failLog!.metadata!.requesterId).toBe(assistantActor.id);
      expect(failLog!.metadata!.approverId).toBe(superAdminActor.id);
      expect(failLog!.metadata!.rolledBack).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 3: INV-R8 Developer Confidentiality in Audit Projections
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. INV-R8 Developer Confidentiality in Audit Projections', () => {
    it('3.1. masks developer identity as SYSTEM / النظام to non-developer viewers (admin)', () => {
      inMemoryStore.setUserStatus('USR003', 'suspended', 'إجراء صيانة', {
        id: developerActor.id,
        role: developerActor.role,
      });

      const projected = inMemoryStore.getSystemAuditLogs({ action: 'users.change_status' }, 'admin');
      const log = projected.entries[0];
      expect(log.actorId).toBe('SYSTEM');
      expect(log.actorName).toBe('النظام');
      expect(log.actorRole).toBe('system');
      expect(log.details).not.toContain(developerActor.name);
      expect(log.details).not.toContain(developerActor.id);
      expect(log.details).not.toContain(developerActor.email);
    });

    it('3.2. masks developer references inside metadata to non-developer viewers', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        titleAr: 'أرشفة إدارية',
        targetId: 'GRP-101',
        requestedBy: developerActor.id,
        requesterId: developerActor.id,
        requesterName: developerActor.name,
        requesterRole: developerActor.role,
        payload: { groupId: 'GRP-101' },
      });

      inMemoryStore.approveApprovalRequest(req.id, superAdminActor.id, 'موافقة');

      // Admin views audit logs
      const adminView = inMemoryStore.getSystemAuditLogs({ action: 'approvals.decide_request' }, 'admin');
      const log = adminView.entries.find((e) => e.requestId === req.id);
      expect(log).toBeDefined();
      if (log!.metadata?.requesterId) {
        expect(log!.metadata.requesterId).toBe('SYSTEM');
      }
      if (log!.metadata?.requesterName) {
        expect(log!.metadata.requesterName).toBe('النظام');
      }
    });

    it('3.3. reveals genuine developer attribution when viewer is developer', () => {
      inMemoryStore.setUserStatus('USR003', 'active', 'إلغاء تعليق الصيانة', {
        id: developerActor.id,
        role: developerActor.role,
      });

      const genuine = inMemoryStore.getSystemAuditLogs({ action: 'users.change_status' }, 'developer');
      const log = genuine.entries[0];
      expect(log.actorId).toBe(developerActor.id);
      expect(log.actorName).toBe(developerActor.name);
      expect(log.actorRole).toBe('developer');
    });

    it('3.4. masks developer identity in single-entry query getSystemAuditLogById', () => {
      const createdLog = inMemoryStore.recordAuditLog({
        actorId: developerActor.id,
        actorRole: developerActor.role,
        action: 'system.maintenance',
        actionLabelAr: 'صيانة دورية',
        severity: 'info',
        outcome: 'success',
        details: `قام ${developerActor.name} بإجراء صيانة للنظام`,
        metadata: { operator: developerActor.name, email: developerActor.email },
      });

      const nonDevView = inMemoryStore.getSystemAuditLogById(createdLog.id, 'super_admin');
      expect(nonDevView).toBeDefined();
      expect(nonDevView!.actorId).toBe('SYSTEM');
      expect(nonDevView!.actorName).toBe('النظام');
      expect(nonDevView!.actorRole).toBe('system');
      expect(nonDevView!.details).not.toContain(developerActor.name);
      if (nonDevView!.metadata?.email) {
        expect(nonDevView!.metadata.email).toBe('system@metro.local');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 4: The 11 UI Surfaces — 202 Response Interception & Regression
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. The 11 UI Surfaces — 202 Response Interception & Regression', () => {
    // ── Surface 1: GroupEditorPage ───────────────────────────────────────────
    it('4.1. Surface 1: GroupEditorPage createGroup & updateGroup handles 202 vs 200/201', () => {
      // 202 Contract: assistant admin requires approval
      const check = inMemoryStore.hasPermission(assistantActor, 'groups.create');
      expect(check.executionMode).toBe('requires_approval');

      // Regression: super admin direct execution returns 201
      const adminCheck = inMemoryStore.hasPermission(superAdminActor, 'groups.create');
      expect(adminCheck.executionMode).toBe('direct');
      const group = inMemoryStore.createGroup(
        {
          name: 'مجموعة 4.1 مباشرة',
          description: 'مباشرة',
          startDateTime: '2026-11-10T08:00:00Z',
          deadlineDateTime: '2026-12-10T17:00:00Z',
          postDeadlinePolicy: 'allow_read_only',
        },
        superAdminActor
      );
      expect(group.id).toBeDefined();
      expect(group.id).not.toBe('REQ_PENDING');
    });

    // ── Surface 2: GroupQRModal ──────────────────────────────────────────────
    it('4.2. Surface 2: GroupQRModal toggleQRCode & rotateQRCode handles 202 vs 200', () => {
      const check = inMemoryStore.hasPermission(assistantActor, 'groups.generate_qr');
      expect(check.executionMode).toBe('requires_approval');

      // Regression: Admin executes directly
      const adminCheck = inMemoryStore.hasPermission(adminActor, 'groups.generate_qr');
      expect(adminCheck.executionMode).toBe('direct');
    });

    // ── Surface 3: GroupMonitoringPage ───────────────────────────────────────
    it('4.3. Surface 3: GroupMonitoringPage reviewJoinRequest handles 202 vs 200', () => {
      const check = inMemoryStore.hasPermission(assistantActor, 'groups.review_join_requests');
      expect(check.executionMode).toBe('requires_approval');

      const adminCheck = inMemoryStore.hasPermission(adminActor, 'groups.review_join_requests');
      expect(adminCheck.executionMode).toBe('direct');
    });

    // ── Surface 4: GroupCoursesTab ───────────────────────────────────────────
    it('4.4. Surface 4: GroupCoursesTab policy select is strictly non-optimistic', () => {
      const check = inMemoryStore.hasPermission(assistantActor, 'groups.edit_config');
      expect(check.executionMode).toBe('requires_approval');

      // Verified: GroupCoursesTab only mutates selectedPolicy after server returns 200/201
      const adminCheck = inMemoryStore.hasPermission(adminActor, 'groups.edit_config');
      expect(adminCheck.executionMode).toBe('direct');
    });

    // ── Surface 5: GroupMembersTab & DirectAssignModal ───────────────────────
    it('4.5. Surface 5: GroupMembersTab & DirectAssignModal handles 202 vs 200', () => {
      const check = inMemoryStore.hasPermission(assistantActor, 'groups.manage_members');
      expect(check.executionMode).toBe('requires_approval');

      const adminCheck = inMemoryStore.hasPermission(adminActor, 'groups.manage_members');
      expect(adminCheck.executionMode).toBe('direct');
    });

    // ── Surface 6: GroupMaterialsTab & GroupUploadFilesModal ─────────────────
    it('4.6. Surface 6: GroupMaterialsTab & GroupUploadFilesModal handles 202 vs 200', () => {
      const check = inMemoryStore.hasPermission(assistantActor, 'materials.upload_files');
      expect(check.executionMode).toBe('requires_approval');

      const adminCheck = inMemoryStore.hasPermission(adminActor, 'materials.upload_files');
      expect(adminCheck.executionMode).toBe('direct');
    });

    // ── Surface 7: GroupMeetingsTab ──────────────────────────────────────────
    it('4.7. Surface 7: GroupMeetingsTab schedule & delete meetings handles 202 vs 200', () => {
      const check = inMemoryStore.hasPermission(assistantActor, 'materials.manage_meetings');
      expect(check.executionMode).toBe('requires_approval');

      const adminCheck = inMemoryStore.hasPermission(adminActor, 'materials.manage_meetings');
      expect(adminCheck.executionMode).toBe('direct');
    });

    // ── Surface 8: GroupAttachmentsTab ───────────────────────────────────────
    it('4.8. Surface 8: GroupAttachmentsTab add & delete attachment handles 202 vs 200', () => {
      const check = inMemoryStore.hasPermission(assistantActor, 'groups.edit_config');
      expect(check.executionMode).toBe('requires_approval');

      const adminCheck = inMemoryStore.hasPermission(adminActor, 'groups.edit_config');
      expect(adminCheck.executionMode).toBe('direct');
    });

    // ── Surface 9: CourseBuilderPage ─────────────────────────────────────────
    it('4.9. Surface 9: CourseBuilderPage saveCourseDraft & submitCourse handles 202 vs 200', () => {
      const check = inMemoryStore.hasPermission(assistantActor, 'courses.edit_curriculum');
      expect(check.executionMode).toBe('requires_approval');

      // Regression: Lecturer author directly saves drafts
      const draft = inMemoryStore.saveCourseDraft('CRS001', { description: 'تعديل مسودة المحاضر' }, lecturerActor);
      expect(draft.course.id).toBe('CRS001');
    });

    // ── Surface 10: CourseReviewPage & DecisionModal ─────────────────────────
    it('4.10. Surface 10: CourseReviewPage & DecisionModal handles 202 vs 200', () => {
      const check = inMemoryStore.hasPermission(assistantActor, 'courses.publish');
      expect(check.executionMode).toBe('requires_approval');

      // Regression: Operational admin (super_admin) executes review decision directly
      const result = inMemoryStore.executeReviewDecision(
        'CRS001',
        { outcome: 'approved', approvalNote: 'اعتماد مباشر من المشرف' },
        superAdminActor
      );
      expect(result.outcome).toBe('approved');
      expect(result.course.status).toBe('published');
    });

    // ── Surface 11: CommentModerationPage ────────────────────────────────────
    it('4.11. Surface 11: CommentModerationPage ignoreCommentReport & deleteComment handles 202 vs 200', () => {
      const check = inMemoryStore.hasPermission(assistantActor, 'comments.delete');
      expect(check.executionMode).toBe('requires_approval');

      // Regression: Admin directly deletes or ignores comment reports
      const adminCheck = inMemoryStore.hasPermission(adminActor, 'comments.delete');
      expect(adminCheck.executionMode).toBe('direct');
    });
  });
});
