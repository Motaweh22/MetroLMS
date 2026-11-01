import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '@/mocks/server';
import { authStorage } from '@/core/auth/authStorage';
import { AppRouter } from '@/app/router';
import { inMemoryStore, MockStoreError } from '@/mocks/store/inMemoryStore';
import type { UserRole, TraineeRole } from '@/core/auth/types';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import {
  INITIAL_MANAGED_USERS,
  resolveCanonicalUserId,
} from '@/mocks/fixtures/userDirectoryFixtures';
import type { CreateUserRequestDTO } from '@/core/user-management/types';
import {
  USER_ROLE_LABELS_AR,
  USER_STATUS_LABELS_AR,
} from '@/core/user-management/types';
import type {
  SystemCapability,
  GroupAssistantAssignment,
  ApprovalRequest,
  SystemAuditLogEntryDTO,
  DepartmentPermissionDTO,
} from '@/core/permissions/types';
import {
  ROLE_CANONICAL_LABELS_AR,
  PERMISSION_DEFINITIONS,
} from '@/core/permissions/types';
import {
  ROLE_CAPABILITY_CEILINGS,
  validatePermissionOverride,
  evaluatePermission,
  ESSENTIAL_ADMIN_GOVERNANCE_CAPABILITIES,
  hasEssentialAdminGovernance,
  validateAdminGovernanceIntegrity,
} from '@/core/permissions/policy';

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    server.resetHandlers();
    authStorage.clearSession();
  });
  afterAll(() => server.close());

  beforeEach(() => {
    inMemoryStore.reset({ seedGroupDemo: true });
  });

  describe('1. Four Canonical System Roles Architecture', () => {
    it('defines exactly four canonical system roles with strict ASCII lowercased tokens', () => {
      const canonicalRoles: UserRole[] = [
        'admin',
        'assistant_admin',
        'lecturer',
        'user',
      ];

      expect(canonicalRoles).toHaveLength(4);
      canonicalRoles.forEach((role) => {
        expect(typeof role).toBe('string');
        expect(role).toBe(role.toLowerCase());
      });
      // Ensure 'assistant_lecturer' is NOT in the canonical roles list
      expect((canonicalRoles as string[]).includes('assistant_lecturer')).toBe(false);
    });

    it('provides compatibility TraineeRole alias mapping strictly to canonical "user"', () => {
      const traineeRole: TraineeRole = 'user';
      expect(traineeRole).toBe('user');
    });

    it('provides authoritative Arabic display labels for all four canonical roles', () => {
      expect(ROLE_CANONICAL_LABELS_AR.admin).toBe('مدير النظام');
      expect(ROLE_CANONICAL_LABELS_AR.assistant_admin).toBe('مدير النظام المساعد');
      expect(ROLE_CANONICAL_LABELS_AR.lecturer).toBe('المحاضر');
      expect(ROLE_CANONICAL_LABELS_AR.user).toBe('المتدرب');

      expect(USER_ROLE_LABELS_AR.admin).toBe('مدير');
      expect(USER_ROLE_LABELS_AR.assistant_admin).toBe('مساعد مدير');
      expect(USER_ROLE_LABELS_AR.lecturer).toBe('محاضر');
      expect(USER_ROLE_LABELS_AR.user).toBe('متدرب');

      // Verify assistant_lecturer is NOT in label dictionaries
      expect((ROLE_CANONICAL_LABELS_AR as Record<string, string>).assistant_lecturer).toBeUndefined();
      expect((USER_ROLE_LABELS_AR as Record<string, string>).assistant_lecturer).toBeUndefined();
    });

    it('provides Arabic display labels for account statuses', () => {
      expect(USER_STATUS_LABELS_AR.active).toBe('نشط');
      expect(USER_STATUS_LABELS_AR.suspended).toBe('موقوف');
    });
  });

  describe('2. Synthetic Demo Personas & USR017 Lecturer Migration', () => {
    it('defines assistant_admin_demo with canonical ID USR016 and deterministic development credentials', () => {
      const assistantAdmin = SYNTHETIC_DEMO_ACCOUNTS.assistant_admin;
      expect(assistantAdmin).toBeDefined();
      expect(assistantAdmin.user.id).toBe('USR016');
      expect(assistantAdmin.user.role).toBe('assistant_admin');
      expect(assistantAdmin.user.email).toBe('assistant.admin@metro.gov.eg');
      expect(assistantAdmin.credentials.password).toBe('metroAssistantAdmin2026!');
      expect(assistantAdmin.user.name).toContain('أحمد شريف');
    });

    it('migrates USR017 to canonical role "lecturer" while preserving credentials, email, and identity', () => {
      const assistantLecturerDemo = SYNTHETIC_DEMO_ACCOUNTS.assistant_lecturer;
      expect(assistantLecturerDemo).toBeDefined();
      expect(assistantLecturerDemo.user.id).toBe('USR017');
      // Crucial: canonical role is migrated to 'lecturer'
      expect(assistantLecturerDemo.user.role).toBe('lecturer');
      expect(assistantLecturerDemo.user.email).toBe('assistant.lecturer@metro.gov.eg');
      expect(assistantLecturerDemo.credentials.password).toBe('metroAssistantTrainer2026!');
      expect(assistantLecturerDemo.user.name).toContain('سارة خليل');
    });

    it('resolves canonical ID and verified aliases case-insensitively for demo personas', () => {
      expect(resolveCanonicalUserId('USR016')).toBe('USR016');
      expect(resolveCanonicalUserId('usr016')).toBe('USR016');
      expect(resolveCanonicalUserId('assistant_admin_demo')).toBe('USR016');
      expect(resolveCanonicalUserId('assistant.admin@metro.gov.eg')).toBe('USR016');

      expect(resolveCanonicalUserId('USR017')).toBe('USR017');
      expect(resolveCanonicalUserId('usr017')).toBe('USR017');
      expect(resolveCanonicalUserId('assistant_lecturer_demo')).toBe('USR017');
      expect(resolveCanonicalUserId('assistant.lecturer@metro.gov.eg')).toBe('USR017');
    });

    it('keeps development credentials strictly isolated from managed user DTOs', () => {
      const user16 = inMemoryStore.getManagedUserById('USR016');
      expect(user16).toBeDefined();
      expect((user16 as unknown as { password?: string }).password).toBeUndefined();

      const cred16 = inMemoryStore.getMockUserCredential('USR016');
      expect(cred16).toBe('metroAssistantAdmin2026!');

      const user17 = inMemoryStore.getManagedUserById('USR017');
      expect(user17).toBeDefined();
      expect(user17?.role).toBe('lecturer');
      expect((user17 as unknown as { password?: string }).password).toBeUndefined();

      const cred17 = inMemoryStore.getMockUserCredential('USR017');
      expect(cred17).toBe('metroAssistantTrainer2026!');
    });

    it('preserves the 15 canonical seed users in INITIAL_MANAGED_USERS without unapproved mutations', () => {
      expect(INITIAL_MANAGED_USERS).toHaveLength(15);
      const ids = INITIAL_MANAGED_USERS.map((u) => u.id);
      expect(ids).toContain('USR001');
      expect(ids).toContain('USR012');
      expect(ids).not.toContain('USR016');
      expect(ids).not.toContain('USR017');
    });
  });

  describe('3. Controlled Role Capability Ceilings', () => {
    it('defines controlled capability ceilings for all four canonical roles', () => {
      expect(ROLE_CAPABILITY_CEILINGS.user).toBeDefined();
      expect(ROLE_CAPABILITY_CEILINGS.lecturer).toBeDefined();
      expect(ROLE_CAPABILITY_CEILINGS.assistant_admin).toBeDefined();
      expect(ROLE_CAPABILITY_CEILINGS.admin).toBeDefined();
    });

    it('enforces strict Trainee ceiling: forbids all user-account and system administration', () => {
      const userCeiling = ROLE_CAPABILITY_CEILINGS.user;

      // Allowed for trainee:
      expect(userCeiling.has('learning.access_assigned')).toBe(true);
      expect(userCeiling.has('learning.self_enroll')).toBe(true);
      expect(userCeiling.has('users.view_transcript')).toBe(true);

      // Forbidden for trainee:
      expect(userCeiling.has('users.create')).toBe(false);
      expect(userCeiling.has('users.change_role')).toBe(false);
      expect(userCeiling.has('users.change_status')).toBe(false);
      expect(userCeiling.has('users.delete')).toBe(false);
      expect(userCeiling.has('groups.create')).toBe(false);
      expect(userCeiling.has('courses.create')).toBe(false);
      expect(userCeiling.has('permissions.view_matrix')).toBe(false);
      expect(userCeiling.has('permissions.configure_users')).toBe(false);
      expect(userCeiling.has('permissions.manage_delegation')).toBe(false);
      expect(userCeiling.has('audit.view_system_logs')).toBe(false);
      expect(userCeiling.has('approvals.decide_request')).toBe(false);
    });

    it('enforces Lecturer ceiling: allows teaching and group duties, but forbids system admin', () => {
      const lecturerCeiling = ROLE_CAPABILITY_CEILINGS.lecturer;

      // Allowed within ceiling:
      expect(lecturerCeiling.has('users.view_directory')).toBe(true);
      expect(lecturerCeiling.has('groups.manage_members')).toBe(true);
      expect(lecturerCeiling.has('groups.generate_qr')).toBe(true);
      expect(lecturerCeiling.has('groups.review_join_requests')).toBe(true);
      expect(lecturerCeiling.has('materials.manage_folders')).toBe(true);
      expect(lecturerCeiling.has('materials.upload_files')).toBe(true);
      expect(lecturerCeiling.has('materials.delete_files')).toBe(true);
      expect(lecturerCeiling.has('materials.manage_meetings')).toBe(true);
      expect(lecturerCeiling.has('courses.create')).toBe(true); // eligible via individual override
      expect(lecturerCeiling.has('courses.edit_curriculum')).toBe(true); // eligible via individual override
      expect(lecturerCeiling.has('reviews.submit_course')).toBe(true);

      // Forbidden outside ceiling:
      expect(lecturerCeiling.has('users.create')).toBe(false);
      expect(lecturerCeiling.has('users.change_role')).toBe(false);
      expect(lecturerCeiling.has('users.change_status')).toBe(false);
      expect(lecturerCeiling.has('users.delete')).toBe(false);
      expect(lecturerCeiling.has('groups.create')).toBe(false);
      expect(lecturerCeiling.has('groups.archive')).toBe(false);
      expect(lecturerCeiling.has('permissions.view_matrix')).toBe(false);
      expect(lecturerCeiling.has('permissions.configure_users')).toBe(false);
      expect(lecturerCeiling.has('permissions.manage_delegation')).toBe(false);
      expect(lecturerCeiling.has('audit.view_system_logs')).toBe(false);
      expect(lecturerCeiling.has('approvals.decide_request')).toBe(false);
      expect(lecturerCeiling.has('reviews.decide_course')).toBe(false);
    });

    it('enforces Assistant Admin ceiling: includes approval-eligible operations and excludes sovereign admin safeguards', () => {
      const astCeiling = ROLE_CAPABILITY_CEILINGS.assistant_admin;

      // Approval-eligible administrative operations (inside ceiling):
      expect(astCeiling.has('users.create')).toBe(true);
      expect(astCeiling.has('users.change_role')).toBe(true);
      expect(astCeiling.has('users.change_status')).toBe(true);
      expect(astCeiling.has('users.delete')).toBe(true); // Eligible for ordinary users (invariant protects admin)
      expect(astCeiling.has('groups.create')).toBe(true);
      expect(astCeiling.has('courses.create')).toBe(true);
      expect(astCeiling.has('courses.publish')).toBe(true);

      // Sovereign governance functions (outside ceiling):
      expect(astCeiling.has('reviews.decide_course')).toBe(false);
      expect(astCeiling.has('permissions.configure_roles')).toBe(false);
      expect(astCeiling.has('permissions.configure_users')).toBe(false);
      expect(astCeiling.has('permissions.manage_delegation')).toBe(false);
      expect(astCeiling.has('audit.view_system_logs')).toBe(false);
      expect(astCeiling.has('approvals.decide_request')).toBe(false);
    });

    it('validates overrides via validatePermissionOverride rejecting above-ceiling grants', () => {
      // Valid grant for lecturer (within ceiling):
      const validLecturerCourse = validatePermissionOverride('lecturer', 'courses.create');
      expect(validLecturerCourse.valid).toBe(true);

      // Invalid grant for lecturer (exceeds ceiling):
      const invalidLecturerAdmin = validatePermissionOverride('lecturer', 'users.create');
      expect(invalidLecturerAdmin.valid).toBe(false);
      expect(invalidLecturerAdmin.reasonAr).toContain('تتجاوز السقف الأقصى');

      // Invalid grant for trainee (exceeds ceiling):
      const invalidTrainee = validatePermissionOverride('user', 'groups.create');
      expect(invalidTrainee.valid).toBe(false);
      expect(invalidTrainee.reasonAr).toContain('تتجاوز السقف الأقصى');
    });
  });

  describe('4. Individual-User Permission Overrides & Isolation', () => {
    it('sets an individual grant affecting ONLY the target user and NOT other users of the same role', () => {
      const lecturer1Id = 'USR002'; // Dr. Tarek
      const lecturer2Id = 'USR017'; // Dr. Sarah (also lecturer)

      // Grant course creation specifically to USR002
      inMemoryStore.setUserPermissionOverride({
        userId: lecturer1Id,
        granted: ['courses.create', 'courses.edit_curriculum'],
        revoked: [],
        reason: 'تكليف بتأليف منهج جديد',
      });

      // Lecturer 1 now has course creation
      const res1 = inMemoryStore.hasPermission(lecturer1Id, 'courses.create');
      expect(res1.granted).toBe(true);
      expect(res1.source).toBe('user_override');

      // Lecturer 2 remains at baseline (courses.create is false)
      const res2 = inMemoryStore.hasPermission(lecturer2Id, 'courses.create');
      expect(res2.granted).toBe(false);
      expect(res2.source).toBe('role_default');
    });

    it('sets an individual revocation affecting ONLY the target user', () => {
      const lecturer1Id = 'USR002';
      const lecturer2Id = 'USR017';

      // Revoke materials.upload_files specifically from USR002
      inMemoryStore.setUserPermissionOverride({
        userId: lecturer1Id,
        granted: [],
        revoked: ['materials.upload_files'],
        reason: 'سحب مؤقت لصلاحية رفع الملفات',
      });

      // Lecturer 1 is denied
      const res1 = inMemoryStore.hasPermission(lecturer1Id, 'materials.upload_files');
      expect(res1.granted).toBe(false);
      expect(res1.source).toBe('user_override');

      // Lecturer 2 retains default baseline (materials.upload_files is true)
      const res2 = inMemoryStore.hasPermission(lecturer2Id, 'materials.upload_files');
      expect(res2.granted).toBe(true);
      expect(res2.source).toBe('role_default');
    });

    it('distinguishes absent overrides from explicit denials', () => {
      const lecturerId = 'USR017';

      // 1. Without override: absent override
      const noOverride = inMemoryStore.getUserPermissionOverride(lecturerId);
      expect(noOverride).toBeNull();

      // 2. Explicit denial
      inMemoryStore.setUserPermissionOverride({
        userId: lecturerId,
        granted: [],
        revoked: ['materials.manage_folders'],
        reason: 'تعطيل مجلدات المجموعة',
      });

      const explicitOverride = inMemoryStore.getUserPermissionOverride(lecturerId);
      expect(explicitOverride).not.toBeNull();
      expect(explicitOverride?.revoked).toContain('materials.manage_folders');
    });

    it('rejects above-ceiling grant without mutating in-memory store state', () => {
      const traineeId = 'USR003';
      const beforeOverride = inMemoryStore.getUserPermissionOverride(traineeId);
      expect(beforeOverride).toBeNull();

      // Attempt to grant system-wide user administration to a trainee
      expect(() => {
        inMemoryStore.setUserPermissionOverride({
          userId: traineeId,
          granted: ['users.create', 'users.change_role'],
          revoked: [],
          reason: 'محاولة غير مصرح بها لمنح صلاحيات إدارية لمتدرب',
        });
      }).toThrowError(MockStoreError);

      // Verify stored state was NOT changed
      const afterOverride = inMemoryStore.getUserPermissionOverride(traineeId);
      expect(afterOverride).toBeNull();

      const check = inMemoryStore.hasPermission(traineeId, 'users.create');
      expect(check.granted).toBe(false);
    });

    it('rejects attempt to grant sovereign admin capabilities to assistant admin via override', () => {
      const assistantId = 'USR016';

      expect(() => {
        inMemoryStore.setUserPermissionOverride({
          userId: assistantId,
          granted: ['permissions.configure_roles', 'reviews.decide_course'],
          revoked: [],
          reason: 'محاولة منح صلاحيات سيادية لمساعد مدير',
        });
      }).toThrowError(MockStoreError);

      const check = inMemoryStore.hasPermission(assistantId, 'permissions.configure_roles');
      expect(check.granted).toBe(false);
    });

    it('allows granting individual curriculum authoring to a lecturer without affecting other lecturers', () => {
      const lecturer1Id = 'USR002'; // Dr. Tarek
      const lecturer2Id = 'USR017'; // Dr. Sarah (also role: lecturer)

      // 1. By default, neither lecturer has curriculum authoring
      const defaultCheck1 = inMemoryStore.hasPermission(lecturer1Id, 'courses.edit_curriculum');
      const defaultCheck2 = inMemoryStore.hasPermission(lecturer2Id, 'courses.edit_curriculum');
      expect(defaultCheck1.granted).toBe(false);
      expect(defaultCheck2.granted).toBe(false);

      // 2. Grant curriculum authoring to lecturer 1 only
      inMemoryStore.setUserPermissionOverride({
        userId: lecturer1Id,
        granted: ['courses.create', 'courses.edit_curriculum', 'courses.upload_lectures'],
        revoked: [],
        reason: 'تكليف خاص بإعداد وتطوير المناهج لمدرب معتمد',
      });

      // 3. Lecturer 1 now has curriculum authoring via user_override
      const updatedCheck1 = inMemoryStore.hasPermission(lecturer1Id, 'courses.edit_curriculum');
      expect(updatedCheck1.granted).toBe(true);
      expect(updatedCheck1.source).toBe('user_override');

      // 4. Lecturer 2 remains strictly denied curriculum authoring
      const updatedCheck2 = inMemoryStore.hasPermission(lecturer2Id, 'courses.edit_curriculum');
      expect(updatedCheck2.granted).toBe(false);
      expect(updatedCheck2.source).toBe('role_default');

      // 5. Attempting to grant above-ceiling capability (e.g. users.delete or users.create) to a lecturer is rejected
      expect(() => {
        inMemoryStore.setUserPermissionOverride({
          userId: lecturer1Id,
          granted: ['users.delete'],
          revoked: [],
          reason: 'محاولة غير مصرح بها لمنح حذف المستخدمين لمحاضر',
        });
      }).toThrowError(MockStoreError);
    });
  });

  describe('5. Group-Scoped Assistant Lecturer Assignment Engine', () => {
    it('allows a lecturer to designate another lecturer as assistant for a specific group', () => {
      const primaryLecturerId = 'usr_lect_002';
      const assistantLecturerId = 'USR017'; // Dr. Sarah (role: lecturer)
      const groupId = 'GRP-101';

      const assignment: GroupAssistantAssignment = inMemoryStore.assignGroupAssistant(
        groupId,
        assistantLecturerId,
        primaryLecturerId
      );

      expect(assignment.groupId).toBe(groupId);
      expect(assignment.assistantLecturerId).toBe(assistantLecturerId);
      expect(assignment.assignedByLecturerId).toBe(primaryLecturerId);
      expect(assignment.status).toBe('active');
      expect(assignment.assignedAt).toBeDefined();

      expect(inMemoryStore.isGroupAssistant(groupId, assistantLecturerId)).toBe(true);
    });

    it('rejects designating a trainee as group assistant lecturer', () => {
      const primaryLecturerId = 'usr_lect_002';
      const traineeId = 'usr_trainee_003'; // role: user
      const groupId = 'GRP-101';

      expect(() => {
        inMemoryStore.assignGroupAssistant(groupId, traineeId, primaryLecturerId);
      }).toThrowError('المحاضر المساعد يجب أن يكون مستخدماً مسجلاً بدور محاضر معتمد');
    });

    it('authorizes group materials operations for assigned assistant lecturer within the designated group', () => {
      const assistantLecturerId = 'USR017';
      const assignedGroupId = 'GRP-101';
      const unrelatedGroupId = 'GRP-102';

      inMemoryStore.assignGroupAssistant(assignedGroupId, assistantLecturerId, 'usr_lect_002');

      // 1. Within assigned group: materials.upload_files is granted
      const assignedCheck = inMemoryStore.hasPermission(assistantLecturerId, 'materials.upload_files', {
        targetGroupId: assignedGroupId,
      });
      expect(assignedCheck.granted).toBe(true);

      // 2. For an unrelated group where user is NOT assigned: materials.upload_files is denied
      const unrelatedCheck = inMemoryStore.hasPermission(assistantLecturerId, 'materials.upload_files', {
        targetGroupId: unrelatedGroupId,
        isGroupSupervisor: false,
        isGroupAssistant: false,
      });
      expect(unrelatedCheck.granted).toBe(false);
      expect(unrelatedCheck.reason).toBe('UNASSIGNED_GROUP_CONTEXT');
    });

    it('does NOT grant course curriculum authoring or user administration via assistant assignment', () => {
      const assistantLecturerId = 'USR017';
      const assignedGroupId = 'GRP-101';

      inMemoryStore.assignGroupAssistant(assignedGroupId, assistantLecturerId, 'usr_lect_002');

      // Curriculum editing is NOT group materials
      const curriculumCheck = inMemoryStore.hasPermission(assistantLecturerId, 'courses.edit_curriculum', {
        targetGroupId: assignedGroupId,
      });
      expect(curriculumCheck.granted).toBe(false);

      // User account creation is NOT group materials
      const userCreateCheck = inMemoryStore.hasPermission(assistantLecturerId, 'users.create', {
        targetGroupId: assignedGroupId,
      });
      expect(userCreateCheck.granted).toBe(false);
    });

    it('revoking assistant assignment removes group-derived capabilities without deleting user or records', () => {
      const assistantLecturerId = 'USR017';
      const groupId = 'GRP-101';

      inMemoryStore.assignGroupAssistant(groupId, assistantLecturerId, 'usr_lect_002');
      expect(inMemoryStore.isGroupAssistant(groupId, assistantLecturerId)).toBe(true);

      // Revoke assignment
      const revoked = inMemoryStore.revokeGroupAssistant(groupId, assistantLecturerId);
      expect(revoked).toBe(true);
      expect(inMemoryStore.isGroupAssistant(groupId, assistantLecturerId)).toBe(false);

      // User account is preserved
      const user = inMemoryStore.getManagedUserById(assistantLecturerId);
      expect(user).toBeDefined();
      expect(user?.role).toBe('lecturer');
    });
  });

  describe('6. Immutable Administrator Safeguards & Protected Invariants', () => {
    it('Invariant 1: Assistant Administrator CANNOT mutate or decide operations on a System Administrator', () => {
      const assistantActor = { id: 'USR016', role: 'assistant_admin' as UserRole };
      const adminTarget = { id: 'usr_admin_001', role: 'admin' as UserRole };

      // Role mutation
      const roleChange = evaluatePermission(assistantActor, 'users.change_role', {
        context: { targetUser: adminTarget, targetRole: 'lecturer' },
      });
      expect(roleChange.granted).toBe(false);
      expect(roleChange.violatesInvariant).toBe(true);
      expect(roleChange.invariantCode).toBe('INVARIANT_ASSISTANT_CANNOT_MUTATE_ADMIN');

      // Account suspension
      const suspendChange = evaluatePermission(assistantActor, 'users.change_status', {
        context: { targetUser: adminTarget, targetStatus: 'suspended' },
      });
      expect(suspendChange.granted).toBe(false);
      expect(suspendChange.violatesInvariant).toBe(true);

      // Account deletion
      const deleteChange = evaluatePermission(assistantActor, 'users.delete', {
        context: { targetUser: adminTarget },
      });
      expect(deleteChange.granted).toBe(false);
    });

    it('Invariant 2: Self-Mutation Prohibition requires peer administrator verification', () => {
      const adminActor = { id: 'usr_admin_001', role: 'admin' as UserRole };

      // Self-demotion
      const selfDemote = evaluatePermission(adminActor, 'users.change_role', {
        context: { targetUser: { id: 'usr_admin_001', role: 'admin' }, targetRole: 'lecturer' },
      });
      expect(selfDemote.granted).toBe(false);
      expect(selfDemote.violatesInvariant).toBe(true);
      expect(selfDemote.invariantCode).toBe('INVARIANT_SELF_MUTATION_PROHIBITED');

      // Self-suspension
      const selfSuspend = evaluatePermission(adminActor, 'users.change_status', {
        context: { targetUser: { id: 'usr_admin_001', role: 'admin' }, targetStatus: 'suspended' },
      });
      expect(selfSuspend.granted).toBe(false);
      expect(selfSuspend.violatesInvariant).toBe(true);

      // Under INV-R3, regular admin mutating peer admin is strictly forbidden
      const allUsers = [
        { id: 'usr_admin_001', role: 'admin' as UserRole, status: 'active' },
        { id: 'usr_admin_002', role: 'admin' as UserRole, status: 'active' },
      ];
      const peerAdminAction = evaluatePermission(adminActor, 'users.change_status', {
        context: { targetUser: { id: 'usr_admin_002', role: 'admin' }, targetStatus: 'suspended' },
        allUsers,
      });
      expect(peerAdminAction.granted).toBe(false);
      expect(peerAdminAction.invariantCode).toBe('INVARIANT_ADMIN_PROTECTED');

      // Super Administrator mutating an admin is permitted (assuming multiple active admins)
      const superAdminActor = { id: 'USR_SUPER_001', role: 'super_admin' as UserRole };
      const superAdminAction = evaluatePermission(superAdminActor, 'users.change_status', {
        context: { targetUser: { id: 'usr_admin_002', role: 'admin' }, targetStatus: 'suspended' },
        allUsers,
      });
      expect(superAdminAction.granted).toBe(true);
    });

    it('Invariant 3: Zero Administrator Lockout Prevention', () => {
      const adminActor = { id: 'usr_admin_001', role: 'admin' as UserRole };
      const loneAdminUsers = [
        { id: 'usr_admin_001', role: 'admin' as UserRole, status: 'active' },
        { id: 'usr_lect_002', role: 'lecturer' as UserRole, status: 'active' },
      ];

      const lockoutCheck = evaluatePermission(adminActor, 'users.change_status', {
        context: { targetUser: { id: 'usr_admin_001', role: 'admin', status: 'active' }, targetStatus: 'suspended' },
        allUsers: loneAdminUsers,
      });
      expect(lockoutCheck.granted).toBe(false);
      expect(lockoutCheck.violatesInvariant).toBe(true);
    });

    it('Invariant 4: Fail-safe rejection when sensitive context is missing', () => {
      const adminActor = { id: 'usr_admin_001', role: 'admin' as UserRole };

      const missingTargetCheck = evaluatePermission(adminActor, 'users.change_role', {
        context: undefined,
      });
      expect(missingTargetCheck.granted).toBe(false);
      expect(missingTargetCheck.violatesInvariant).toBe(true);
      expect(missingTargetCheck.invariantCode).toBe('INVARIANT_CONTEXT_MISSING');
    });
  });

  describe('7. Administrator-Configurable Role Defaults within Role Ceilings', () => {
    it('allows authorized System Administrator to update eligible default capabilities for a role within ceiling', () => {
      // Initially, lecturer does NOT have courses.create by default
      const checkBefore = inMemoryStore.hasPermission('USR002', 'courses.create');
      expect(checkBefore.granted).toBe(false);

      // Admin enables courses.create for lecturer baseline (courses.create is in lecturer ceiling)
      const lecturerDefaults = inMemoryStore.getRolePermissions('lecturer').permissions || [];
      const updated = inMemoryStore.updateRolePermissions(
        'lecturer',
        [...lecturerDefaults, 'courses.create'],
        'usr_admin_001'
      );

      expect(updated.permissions).toContain('courses.create');

      // Now lecturer USR002 has courses.create granted via role_default
      const checkAfter = inMemoryStore.hasPermission('USR002', 'courses.create');
      expect(checkAfter.granted).toBe(true);
      expect(checkAfter.source).toBe('role_default');
    });

    it('ensures role default change affects users of that role but NOT users of other roles', () => {
      // Enable courses.create for lecturer
      inMemoryStore.updateRolePermissions('lecturer', ['courses.create'], 'usr_admin_001');

      // USR002 is lecturer, USR003 is user (trainee)
      expect(inMemoryStore.hasPermission('USR002', 'courses.create').granted).toBe(true);
      expect(inMemoryStore.hasPermission('USR003', 'courses.create').granted).toBe(false);
    });

    it('preserves individual overrides over updated role defaults (precedence)', () => {
      // Enable courses.create in lecturer defaults
      inMemoryStore.updateRolePermissions('lecturer', ['courses.create'], 'usr_admin_001');

      // Set explicit individual revocation of courses.create for USR017 (another lecturer)
      inMemoryStore.setUserPermissionOverride({
        userId: 'USR017',
        revoked: ['courses.create'],
        reason: 'سحب فردي صريح للتأليف',
      });

      // USR017 check: individual override takes precedence, denied!
      const checkRevoked = inMemoryStore.hasPermission('USR017', 'courses.create');
      expect(checkRevoked.granted).toBe(false);
      expect(checkRevoked.source).toBe('user_override');
      expect(checkRevoked.reason).toBe('USER_OVERRIDE_REVOKED');

      // USR002 (no override) still has it via role_default
      expect(inMemoryStore.hasPermission('USR002', 'courses.create').granted).toBe(true);
    });

    it('ensures role default changes never erase or modify existing individual user overrides', () => {
      // Set override first on USR017
      inMemoryStore.setUserPermissionOverride({
        userId: 'USR017',
        revoked: ['courses.create'],
        reason: 'سحب فردي صريح للتأليف',
      });

      const overrideBefore = inMemoryStore.getUserPermissionOverride('USR017');
      expect(overrideBefore?.revoked).toContain('courses.create');

      // Update lecturer defaults
      inMemoryStore.updateRolePermissions(
        'lecturer',
        ['materials.manage_folders', 'materials.upload_files'],
        'usr_admin_001'
      );

      const overrideAfter = inMemoryStore.getUserPermissionOverride('USR017');
      expect(overrideAfter?.revoked).toContain('courses.create');
    });

    it('atomically rejects above-ceiling capability grants with HTTP 400 MockStoreError', () => {
      // Attempting to grant users.create to lecturer (outside lecturer ceiling)
      expect(() => {
        inMemoryStore.updateRolePermissions('lecturer', ['users.create'], 'usr_admin_001');
      }).toThrowError(/تتجاوز السقف الأقصى المحدد لدور/);

      // Verify stored state was not modified
      const config = inMemoryStore.getRolePermissions('lecturer');
      expect(config.permissions).not.toContain('users.create');
    });

    it('strictly forbids assistant administrators from modifying role defaults with HTTP 403 MockStoreError', () => {
      expect(() => {
        inMemoryStore.updateRolePermissions('lecturer', ['courses.create'], 'USR016'); // USR016 is assistant_admin
      }).toThrowError(/غير مصرح: تعديل الصلاحيات الافتراضية للأدوار مخصص لمدير النظام فقط/);

      // Even if delegated!
      inMemoryStore.setDelegatedAuthority('USR016', true);
      expect(() => {
        inMemoryStore.updateRolePermissions('lecturer', ['courses.create'], 'USR016');
      }).toThrowError(/غير مصرح: تعديل الصلاحيات الافتراضية للأدوار مخصص لمدير النظام فقط/);
    });

    it('prevents administrative lockout by rejecting removal of essential admin capabilities', () => {
      // Admin defaults missing permissions.configure_roles
      expect(() => {
        inMemoryStore.updateRolePermissions('admin', ['users.view_directory'], 'usr_admin_001');
      }).toThrowError(/لا يمكن إزالة الصلاحيات الإدارية الجوهرية/);
    });

    it('getAllRolePermissions returns configurations for exactly 4 canonical roles', () => {
      const allConfigs = inMemoryStore.getAllRolePermissions();
      expect(allConfigs).toHaveLength(4);
      const roles = allConfigs.map((c) => c.role);
      expect(roles).toEqual(['admin', 'assistant_admin', 'lecturer', 'user']);
    });
  });

  describe('8. Assistant Administrator Delegation & Execution Modes', () => {
    it('requires approval by default for sensitive assistant admin actions', () => {
      const assistantId = 'USR016';
      const check = inMemoryStore.hasPermission(assistantId, 'users.create', {
        targetUser: { id: 'USR099', role: 'user' },
      });
      expect(check.granted).toBe(true);
      expect(check.executionMode).toBe('requires_approval');
    });

    it('allows direct execution when operational authority is explicitly delegated', () => {
      const assistantId = 'USR016';

      // Grant delegation
      inMemoryStore.setDelegatedAuthority(assistantId, true);
      expect(inMemoryStore.getDelegatedAuthority(assistantId)).toBe(true);

      const check = inMemoryStore.hasPermission(assistantId, 'users.create', {
        targetUser: { id: 'USR099', role: 'user' },
      });
      expect(check.granted).toBe(true);
      expect(check.executionMode).toBe('direct');
    });

    it('delegation CANNOT bypass protected administrator safeguards', () => {
      const assistantId = 'USR016';
      inMemoryStore.setDelegatedAuthority(assistantId, true);

      // Attempting to mutate an Admin remains strictly blocked
      const check = inMemoryStore.hasPermission(assistantId, 'users.change_role', {
        targetUser: { id: 'usr_admin_001', role: 'admin' },
        targetRole: 'lecturer',
      });
      expect(check.granted).toBe(false);
      expect(check.violatesInvariant).toBe(true);
      expect(check.invariantCode).toBe('INVARIANT_ASSISTANT_CANNOT_MUTATE_ADMIN');
    });

    it('requires approval by default for deleting an ordinary user, but allows direct execution when delegated', () => {
      const assistantId = 'USR016';

      // 1. Without delegation, deleting an ordinary user requires approval
      const checkOrdinary = inMemoryStore.hasPermission(assistantId, 'users.delete', {
        targetUser: { id: 'USR003', role: 'user' },
      });
      expect(checkOrdinary.granted).toBe(true);
      expect(checkOrdinary.executionMode).toBe('requires_approval');

      // 2. With delegation, deleting an ordinary user executes directly
      inMemoryStore.setDelegatedAuthority(assistantId, true);
      const checkDelegated = inMemoryStore.hasPermission(assistantId, 'users.delete', {
        targetUser: { id: 'USR003', role: 'user' },
      });
      expect(checkDelegated.granted).toBe(true);
      expect(checkDelegated.executionMode).toBe('direct');

      // 3. But deleting an Admin remains strictly blocked by invariant even when delegated
      const checkAdmin = inMemoryStore.hasPermission(assistantId, 'users.delete', {
        targetUser: { id: 'usr_admin_001', role: 'admin' },
      });
      expect(checkAdmin.granted).toBe(false);
      expect(checkAdmin.violatesInvariant).toBe(true);
      expect(checkAdmin.invariantCode).toBe('INVARIANT_ASSISTANT_CANNOT_MUTATE_ADMIN');
    });

    it('distinguishes course publication execution from sovereign course review decisions', () => {
      const assistantId = 'USR016';

      // 1. Submitting course for review executes directly
      const checkSubmit = inMemoryStore.hasPermission(assistantId, 'reviews.submit_course');
      expect(checkSubmit.granted).toBe(true);
      expect(checkSubmit.executionMode).toBe('direct');

      // 2. Executing publication requires approval by default
      const checkPublishDefault = inMemoryStore.hasPermission(assistantId, 'courses.publish');
      expect(checkPublishDefault.granted).toBe(true);
      expect(checkPublishDefault.executionMode).toBe('requires_approval');

      // 3. Executing publication allows direct execution when delegated
      inMemoryStore.setDelegatedAuthority(assistantId, true);
      const checkPublishDelegated = inMemoryStore.hasPermission(assistantId, 'courses.publish');
      expect(checkPublishDelegated.granted).toBe(true);
      expect(checkPublishDelegated.executionMode).toBe('direct');

      // 4. Deciding/approving course publication review is permanently forbidden to assistant admin
      const checkDecide = inMemoryStore.hasPermission(assistantId, 'reviews.decide_course');
      expect(checkDecide.granted).toBe(false);
      expect(checkDecide.executionMode).toBe('denied');
    });

    it('sovereign administrative governance functions remain permanently forbidden to assistant admin', () => {
      const assistantId = 'USR016';
      inMemoryStore.setDelegatedAuthority(assistantId, true); // Even with delegation active

      const sovereignCapabilities: SystemCapability[] = [
        'permissions.configure_roles',
        'permissions.configure_users',
        'permissions.manage_delegation',
        'audit.view_system_logs',
        'approvals.decide_request',
        'reviews.decide_course',
      ];

      sovereignCapabilities.forEach((cap) => {
        const check = inMemoryStore.hasPermission(assistantId, cap);
        expect(check.granted).toBe(false);
        expect(check.executionMode).toBe('denied');
      });
    });
  });

  describe('9. Individual User Permissions UI Workflow (/admin/users & UserPermissionsModal)', () => {
    const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;

    it('renders "تحديد الصلاحيات" action button for each user in the directory table', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      render(<AppRouter initialEntries={['/admin/users']} />);

      // Wait for table to load
      await waitFor(() => {
        expect(screen.getByTestId('manage-permissions-btn-USR002')).toBeInTheDocument();
      });

      const permBtn = screen.getByTestId('manage-permissions-btn-USR002');
      expect(permBtn).toHaveTextContent('تحديد الصلاحيات');
    });

    it('opens UserPermissionsModal when clicking "تحديد الصلاحيات" displaying user identity and role ceiling policy', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      render(<AppRouter initialEntries={['/admin/users']} />);

      await waitFor(() => {
        expect(screen.getByTestId('manage-permissions-btn-USR002')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('manage-permissions-btn-USR002'));

      // Modal opens
      await waitFor(() => {
        expect(screen.getByTestId('user-permissions-modal')).toBeInTheDocument();
      });

      expect(screen.getByText('تحديد الصلاحيات الفردية للمستخدم')).toBeInTheDocument();
      expect(screen.getByText('د. طارق الجوهري')).toBeInTheDocument();
      expect(screen.getByText(/سياسة السقف الأقصى للأدوار/)).toBeInTheDocument();
    });

    it('displays above-ceiling capabilities as disabled with "خارج سقف الدور" badge', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      render(<AppRouter initialEntries={['/admin/users']} />);

      await waitFor(() => {
        expect(screen.getByTestId('manage-permissions-btn-USR002')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('manage-permissions-btn-USR002'));

      await waitFor(() => {
        expect(screen.getByTestId('user-permissions-modal')).toBeInTheDocument();
      });

      // users.create is above ceiling for lecturer USR002
      await waitFor(() => {
        const toggleBtn = screen.getByTestId('toggle-perm-users.create');
        expect(toggleBtn).toBeDisabled();
      });
      const row = screen.getByTestId('perm-row-users.create');
      expect(row).toHaveTextContent('خارج سقف الدور');
    });

    it('allows toggling eligible capabilities within ceiling and saving with justification', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      render(<AppRouter initialEntries={['/admin/users']} />);

      await waitFor(() => {
        expect(screen.getByTestId('manage-permissions-btn-USR002')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('manage-permissions-btn-USR002'));

      await waitFor(() => {
        expect(screen.getByTestId('user-permissions-modal')).toBeInTheDocument();
      });

      // courses.create is eligible for lecturer (within ceiling, off by default)
      await waitFor(() => {
        const toggleBtn = screen.getByTestId('toggle-perm-courses.create');
        expect(toggleBtn).not.toBeDisabled();
      });

      const courseToggle = screen.getByTestId('toggle-perm-courses.create');
      fireEvent.click(courseToggle);

      // Enter justification
      const reasonInput = screen.getByTestId('permission-override-reason-input');
      fireEvent.change(reasonInput, {
        target: { value: 'تكليف استثنائي بإعداد دورة الإشارات' },
      });

      // Save
      fireEvent.click(screen.getByTestId('save-user-permissions-btn'));

      // Verify override was persisted in store
      await waitFor(() => {
        const override = inMemoryStore.getUserPermissionOverride('USR002');
        expect(override).not.toBeNull();
        expect(override?.granted).toContain('courses.create');
        expect(override?.reason).toBe('تكليف استثنائي بإعداد دورة الإشارات');
      });
    });
  });

  describe('10. Governance Contracts, Capability Catalog & Schema Grounding', () => {
    it('grounds the system capability catalog with all categories and identifies sovereign capabilities', () => {
      expect(PERMISSION_DEFINITIONS.length).toBeGreaterThanOrEqual(34);

      const sovereignCapabilities = PERMISSION_DEFINITIONS.filter((p) => p.isSovereign).map((p) => p.key);
      expect(sovereignCapabilities).toEqual(
        expect.arrayContaining([
          'permissions.configure_roles',
          'permissions.configure_users',
          'permissions.manage_delegation',
          'audit.view_system_logs',
          'approvals.decide_request',
          'reviews.decide_course',
        ])
      );

      // Operational actions must not be marked sovereign
      const operationalActions: SystemCapability[] = [
        'users.delete',
        'courses.publish',
        'users.create',
        'users.change_role',
        'users.change_status',
      ];
      operationalActions.forEach((op) => {
        const def = PERMISSION_DEFINITIONS.find((p) => p.key === op);
        expect(def).toBeDefined();
        expect(def?.isSovereign).toBeFalsy();
      });
    });

    it('grounds ApprovalRequest data contract for approval-controlled administrative operations', () => {
      const sampleApprovalRequest: ApprovalRequest = {
        id: 'REQ-AUDIT-001',
        actionType: 'USER_DELETE',
        requestedBy: 'USR016',
        requesterId: 'USR016',
        targetId: 'USR003',
        status: 'pending',
        justification: 'طلب حذف حساب مستخدم عادي مكتمل الإجراءات',
        createdAt: '2026-10-25T12:00:00Z',
      };

      expect(sampleApprovalRequest.actionType).toBe('USER_DELETE');
      expect(sampleApprovalRequest.status).toBe('pending');
      expect(sampleApprovalRequest.targetId).toBe('USR003');
    });

    it('grounds SystemAuditLogEntryDTO and DepartmentPermissionDTO data contracts', () => {
      const sampleAuditLog: SystemAuditLogEntryDTO = {
        id: 'AUDIT-001',
        actorId: 'usr_admin_001',
        actorName: 'م. أحمد محمود',
        actorRole: 'admin',
        action: 'PERMISSIONS_OVERRIDE_GRANTED',
        actionLabelAr: 'منح صلاحية فردية',
        severity: 'info',
        details: 'منح صلاحية courses.create للمستخدم USR002',
        outcome: 'success',
        clientContext: {
          origin: 'https://metro-lms.cairo.gov.eg',
          userAgent: 'Mozilla/5.0 Chrome/120',
        },
        timestamp: '2026-10-25T12:00:00Z',
      };

      const sampleDeptPermission: DepartmentPermissionDTO = {
        departmentId: 'DEPT-SIGNALS',
        departmentName: 'إدارة الإشارات والتحكم',
        allowedTracks: ['TRK-001', 'TRK-002'],
        updatedAt: '2026-10-25T12:00:00Z',
      };

      expect(sampleAuditLog.actorRole).toBe('admin');
      expect(sampleDeptPermission.allowedTracks).toHaveLength(2);
    });
  });

  describe('11. Streamlined Permissions Policy & Governance UI (/admin/permissions)', () => {
    const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;

    it('renders exactly two tabs on /admin/permissions and reflects four canonical roles', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      render(<AppRouter initialEntries={['/admin/permissions']} />);

      await waitFor(() => {
        expect(screen.getByTestId('permissions-matrix-page')).toBeInTheDocument();
      });

      // Verify header and breadcrumbs
      expect(screen.getByText('مرجع سياسة الصلاحيات والحوكمة المؤسسية')).toBeInTheDocument();

      // Verify exactly 4 canonical roles KPI card
      expect(screen.getByText('4 أدوار')).toBeInTheDocument();
      expect(screen.getByText('مدير، مدير مساعد، محاضر، متدرب')).toBeInTheDocument();

      // Verify exactly two tabs
      const tabsContainer = screen.getByTestId('permissions-page-tabs');
      expect(tabsContainer).toBeInTheDocument();
      expect(screen.getByTestId('tab-matrix-btn')).toHaveTextContent('الأدوار وسقوف الصلاحيات');
      expect(screen.getByTestId('tab-governance-btn')).toHaveTextContent('التفويض والرقابة الثنائية');

      // Assert duplicate user table tab is NOT present
      expect(screen.queryByTestId('tab-users-btn')).toBeNull();
      expect(screen.queryByTestId('search-user-for-override-input')).toBeNull();

      // Verify direct link callout to User Management
      expect(screen.getByTestId('navigate-to-users-btn')).toBeInTheDocument();
      expect(screen.getByText(/تخصيص الصلاحيات الفردية للمستخدمين/)).toBeInTheDocument();
    });

    it('renders read-only matrix table with distinct semantic statuses for baseline, ceiling, scope, and approval', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      render(<AppRouter initialEntries={['/admin/permissions']} />);

      await waitFor(() => {
        expect(screen.getByTestId('role-permissions-matrix-table')).toBeInTheDocument();
      });

      // Fixed policy notice is displayed
      expect(screen.getByTestId('fixed-policy-notice')).toBeInTheDocument();

      // 1. Assistant admin users.delete: approval/delegation
      const astDelStatus = screen.getByTestId('cell-status-assistant_admin-users.delete');
      expect(astDelStatus).toHaveTextContent('اعتماد / تفويض');

      // 2. Assistant admin reviews.decide_course: permanently forbidden (outside ceiling)
      const astDecideStatus = screen.getByTestId('cell-status-assistant_admin-reviews.decide_course');
      expect(astDecideStatus).toHaveTextContent('محظورة نهائياً');

      // 3. Lecturer courses.create: eligible for individual override within ceiling
      const lecCourseCreate = screen.getByTestId('cell-status-lecturer-courses.create');
      expect(lecCourseCreate).toHaveTextContent('قابلة للمنح الفردي');

      // 4. Lecturer groups.manage_members: group-scoped
      const lecGroupScope = screen.getByTestId('cell-status-lecturer-groups.manage_members');
      expect(lecGroupScope).toHaveTextContent('نطاق مجموعة');

      // 5. Lecturer users.create: permanently forbidden (outside ceiling)
      const lecUserCreate = screen.getByTestId('cell-status-lecturer-users.create');
      expect(lecUserCreate).toHaveTextContent('محظورة نهائياً');
    });

    it('switches to Governance tab and preserves working delegation controls and dual-control approvals', async () => {
      // Provision an assistant_admin in store to test governance delegation
      inMemoryStore.updateUserRole('USR001', 'assistant_admin');

      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      render(<AppRouter initialEntries={['/admin/permissions']} />);

      await waitFor(() => {
        expect(screen.getByTestId('tab-governance-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('tab-governance-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('governance-tab-content')).toBeInTheDocument();
      });

      // Delegation panel and Approval table are reachable
      expect(screen.getByTestId('governance-delegation-panel')).toBeInTheDocument();
      expect(screen.getByTestId('approval-requests-table')).toBeInTheDocument();

      // Verify toggle delegation button for assistant admin USR001
      await waitFor(() => {
        expect(screen.getByTestId('toggle-delegation-btn-USR001')).toBeInTheDocument();
      });
    });
  });

  describe('12. Assistant Admin Approval Interception and Safe Execution Semantics', () => {
    const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
    const assistantAdminUser = SYNTHETIC_DEMO_ACCOUNTS.assistant_admin.user; // USR016

    const asAssistantAdmin = () => {
      authStorage.setSession({
        token: `mock_jwt_${assistantAdminUser.id}_test`,
        user: assistantAdminUser,
        expiresAt: Date.now() + 3600000,
      });
    };

    const asAdmin = () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });
    };

    it('rejects un-delegated assistant_admin role change with HTTP 403 without mutating target or creating approval request (Phase 2)', async () => {
      asAssistantAdmin();
      inMemoryStore.setDelegatedAuthority(assistantAdminUser.id, false);
      const prevApprovalCount = inMemoryStore.getApprovalRequests().length;

      // Target USR003 role is currently 'user'
      expect(inMemoryStore.getManagedUserById('USR003')?.role).toBe('user');

      const response = await fetch('/api/admin/users/USR003/role', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer mock_jwt_${assistantAdminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'lecturer', reason: 'ترقية محاضر تحت الاعتماد' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.code).toBe('INVARIANT_ASSISTANT_ADMIN_CEILING');

      // Target in store remains UNMUTATED
      expect(inMemoryStore.getManagedUserById('USR003')?.role).toBe('user');

      // Zero approval requests created in Phase 2
      expect(inMemoryStore.getApprovalRequests().length).toBe(prevApprovalCount);
    });

    it('rejects un-delegated assistant_admin status suspension with HTTP 403 without suspending account or creating approval request (Phase 2)', async () => {
      asAssistantAdmin();
      inMemoryStore.setDelegatedAuthority(assistantAdminUser.id, false);
      const prevApprovalCount = inMemoryStore.getApprovalRequests().length;

      // Target USR003 status is active
      expect(inMemoryStore.getManagedUserById('USR003')?.status).toBe('active');

      const response = await fetch('/api/admin/users/USR003/status', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer mock_jwt_${assistantAdminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'suspended', reason: 'إيقاف حساب قيد المراجعة' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.code).toBe('INVARIANT_ASSISTANT_ADMIN_CEILING');

      // Crucial: Target remains active in store
      expect(inMemoryStore.getManagedUserById('USR003')?.status).toBe('active');

      // Zero approval requests created in Phase 2
      expect(inMemoryStore.getApprovalRequests().length).toBe(prevApprovalCount);
    });

    it('rejects un-delegated assistant_admin user creation with HTTP 403 without adding to directory or creating approval request (Phase 2)', async () => {
      asAssistantAdmin();
      inMemoryStore.setDelegatedAuthority(assistantAdminUser.id, false);
      const prevApprovalCount = inMemoryStore.getApprovalRequests().length;

      const payload = {
        name: 'م. مروان البدري',
        username: 'marwan_elbadry',
        email: 'marwan.elbadry@cairo-metro.com',
        phone: '01011223344',
        jobTitle: 'مهندس إشارات',
        department: 'قطاع الصيانة الكهربائية',
        role: 'user',
        status: 'active',
        password: 'Password123!',
      };

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${assistantAdminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.code).toBe('INVARIANT_ASSISTANT_ADMIN_CEILING');

      // Crucial: User is NOT created in directory
      const directory = inMemoryStore.getManagedUsers();
      expect(directory.some((u) => u.username === 'marwan_elbadry')).toBe(false);

      // Zero approval requests created in Phase 2
      expect(inMemoryStore.getApprovalRequests().length).toBe(prevApprovalCount);
    });

    it('rejects un-delegated assistant_admin user deletion with HTTP 403 without deleting user or creating approval request (Phase 2)', async () => {
      asAssistantAdmin();
      inMemoryStore.setDelegatedAuthority(assistantAdminUser.id, false);
      const prevApprovalCount = inMemoryStore.getApprovalRequests().length;

      expect(inMemoryStore.getManagedUserById('USR003')).toBeDefined();

      const response = await fetch('/api/admin/users/USR003', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer mock_jwt_${assistantAdminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'حذف مستخدم عادي تجريبي' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.code).toBe('INVARIANT_ASSISTANT_ADMIN_CEILING');

      // Crucial: User still exists in directory
      expect(inMemoryStore.getManagedUserById('USR003')).toBeDefined();

      // Zero approval requests created in Phase 2
      expect(inMemoryStore.getApprovalRequests().length).toBe(prevApprovalCount);
    });

    it('intercepts un-delegated assistant_admin group creation and archiving into approval requests', async () => {
      asAssistantAdmin();
      inMemoryStore.setDelegatedAuthority(assistantAdminUser.id, false);

      // 1. Group creation
      const resCreate = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${assistantAdminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'مجموعة الصيانة المقترحة',
          startDateTime: '2026-11-01T08:00:00Z',
          deadlineDateTime: '2026-11-30T16:00:00Z',
          postDeadlinePolicy: 'allow_view_only',
        }),
      });

      expect(resCreate.status).toBe(202);
      const createData = await resCreate.json();
      expect(createData.approvalRequired).toBe(true);

      // Verify group was NOT created
      const groups = inMemoryStore.getGroups();
      expect(groups.some((g) => g.name === 'مجموعة الصيانة المقترحة')).toBe(false);

      // 2. Group archive
      const resArchive = await fetch('/api/admin/groups/GRP-201', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer mock_jwt_${assistantAdminUser.id}_test`,
          'Content-Type': 'application/json',
        },
      });

      expect(resArchive.status).toBe(202);
      const archiveData = await resArchive.json();
      expect(archiveData.approvalRequired).toBe(true);

      // Verify group is NOT archived
      const grp = inMemoryStore.getGroupById('GRP-201');
      expect(grp?.adminStatus).not.toBe('archived');
    });

    it('executes eligible operations directly when assistant_admin has active explicit delegation', async () => {
      asAssistantAdmin();
      inMemoryStore.setDelegatedAuthority(assistantAdminUser.id, true);

      // 1. Direct role change
      const resRole = await fetch('/api/admin/users/USR003/role', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer mock_jwt_${assistantAdminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'lecturer' }),
      });

      expect(resRole.status).toBe(200);
      expect(inMemoryStore.getManagedUserById('USR003')?.role).toBe('lecturer');

      // 2. Direct status change
      const resStatus = await fetch('/api/admin/users/USR003/status', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer mock_jwt_${assistantAdminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'suspended' }),
      });

      expect(resStatus.status).toBe(200);
      expect(inMemoryStore.getManagedUserById('USR003')?.status).toBe('suspended');

      // 3. Direct user deletion
      const resDel = await fetch('/api/admin/users/USR003', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer mock_jwt_${assistantAdminUser.id}_test`,
          'Content-Type': 'application/json',
        },
      });

      expect(resDel.status).toBe(200);
      expect(inMemoryStore.getManagedUserById('USR003')).toBeUndefined();
    });

    it('strictly forbids assistant_admin from mutating or deleting protected admin account even under delegation', async () => {
      asAssistantAdmin();
      // Even with active delegation!
      inMemoryStore.setDelegatedAuthority(assistantAdminUser.id, true);

      // Attempt role mutation of admin usr_admin_001
      const resRole = await fetch('/api/admin/users/usr_admin_001/role', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer mock_jwt_${assistantAdminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'lecturer' }),
      });

      expect(resRole.status).toBe(403);
      const roleData = await resRole.json();
      expect(roleData.message).toContain('لا يمكن لمساعد مدير النظام تعديل أو إيقاف أو حذف حساب مدير النظام');
      expect(inMemoryStore.getManagedUserById('usr_admin_001')?.role).toBe('admin');

      // Attempt deletion of admin usr_admin_001
      const resDel = await fetch('/api/admin/users/usr_admin_001', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer mock_jwt_${assistantAdminUser.id}_test`,
          'Content-Type': 'application/json',
        },
      });

      expect(resDel.status).toBe(403);
      const delData = await resDel.json();
      expect(delData.message).toContain('لا يمكن لمساعد مدير النظام تعديل أو إيقاف أو حذف حساب مدير النظام');
      expect(inMemoryStore.getManagedUserById('usr_admin_001')).toBeDefined();

      // No executable approval request was generated
      const reqs = inMemoryStore.getApprovalRequests();
      expect(reqs.some((r) => r.targetId === 'usr_admin_001')).toBe(false);
    });

    it('enforces dual-control: assistant_admin requester cannot approve their own request', async () => {
      asAssistantAdmin();
      inMemoryStore.setDelegatedAuthority(assistantAdminUser.id, false);

      // Create request via role change
      const res = await fetch('/api/admin/users/USR003/role', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer mock_jwt_${assistantAdminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'lecturer' }),
      });
      const data = await res.json();
      const requestId = data.requestId;

      // Attempt approval by the SAME assistant_admin requester
      const approveRes = await fetch(`/api/admin/permissions/governance/approvals/${requestId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${assistantAdminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'اعتماد ذاتي غير مسموح' }),
      });

      // Dual-control check rejects this
      expect(approveRes.status).toBe(403);
      const errData = await approveRes.json();
      expect(errData.message).toMatch(/(لا يمكن لمقدم الطلب|مخصص لمديري النظام فقط|مخصصة لمديري النظام)/);

      // Target remains unmutated, request remains pending
      expect(inMemoryStore.getManagedUserById('USR003')?.role).toBe('user');
      const req = inMemoryStore.getApprovalRequests().find((r) => r.id === requestId);
      expect(req?.status).toBe('pending');
    });

    it('enforces dual-control: system administrator cannot approve their own submitted request', async () => {
      asAdmin();

      // Admin directly creates an approval request (e.g. self-submitted dual-control request)
      const newReq = inMemoryStore.createApprovalRequest({
        actionType: 'users.delete',
        titleAr: 'طلب حذف مستخدم خاضع للرقابة الثنائية',
        requestedBy: adminUser.id,
        requesterId: adminUser.id,
        requesterName: adminUser.name,
        requesterRole: adminUser.role,
        targetId: 'USR003',
        targetResourceName: 'عمرو فؤاد سليم',
        payload: { userId: 'USR003' },
        justification: 'حذف يتطلب موافقة مدير نظام آخر',
      });

      // Admin attempts to approve their own request
      const approveRes = await fetch(`/api/admin/permissions/governance/approvals/${newReq.id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${adminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'محاولة اعتماد ذاتي من المدير' }),
      });

      expect(approveRes.status).toBe(403);
      const errData = await approveRes.json();
      expect(errData.message).toContain('لا يمكن لمقدم الطلب اعتماد طلبه الذاتي');

      // Request remains pending
      const req = inMemoryStore.getApprovalRequests().find((r) => r.id === newReq.id);
      expect(req?.status).toBe('pending');
    });

    it('allows authorized system administrator to approve request, executing domain mutation exactly once', async () => {
      asAssistantAdmin();
      inMemoryStore.setDelegatedAuthority(assistantAdminUser.id, false);

      // Create request to promote USR003 to lecturer
      const res = await fetch('/api/admin/users/USR003/role', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer mock_jwt_${assistantAdminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'lecturer' }),
      });
      const { requestId } = await res.json();

      // Switch session to authorized Admin
      asAdmin();

      const approveRes = await fetch(`/api/admin/permissions/governance/approvals/${requestId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${adminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'تمت المراجعة والاعتماد' }),
      });

      expect(approveRes.status).toBe(200);
      const approvedData = await approveRes.json();
      expect(approvedData.status).toBe('approved');
      expect(approvedData.reviewedBy).toBe(adminUser.id);

      // Domain mutation executed!
      expect(inMemoryStore.getManagedUserById('USR003')?.role).toBe('lecturer');

      // Attempting to approve AGAIN must be rejected (duplicate execution prevention)
      const duplicateRes = await fetch(`/api/admin/permissions/governance/approvals/${requestId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${adminUser.id}_test`,
          'Content-Type': 'application/json',
        },
      });
      expect(duplicateRes.status).toBe(400);
    });

    it('marks request as failed_execution if target state became invalid before approval', async () => {
      asAssistantAdmin();
      inMemoryStore.setDelegatedAuthority(assistantAdminUser.id, false);

      // Create request for USR003
      const res = await fetch('/api/admin/users/USR003/role', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer mock_jwt_${assistantAdminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'lecturer' }),
      });
      const { requestId } = await res.json();

      // Admin deletes USR003 before approval
      asAdmin();
      inMemoryStore.deleteUser('USR003', { id: adminUser.id, role: adminUser.role });
      expect(inMemoryStore.getManagedUserById('USR003')).toBeUndefined();

      // Now approve the stale request
      const approveRes = await fetch(`/api/admin/permissions/governance/approvals/${requestId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${adminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'محاولة اعتماد بعد حذف الهدف' }),
      });

      expect(approveRes.status).toBe(404);
      const resData = await approveRes.json();
      expect(resData.message).toContain('المستخدم المستهدف لم يعد موجوداً');

      // Request record transitioned to failed_execution
      const req = inMemoryStore.getApprovalRequests().find((r) => r.id === requestId);
      expect(req?.status).toBe('failed_execution');
      expect(req?.executionError).toBeDefined();
    });

    it('rejects approval request, leaves target unchanged, and seals request against future execution', async () => {
      asAssistantAdmin();
      inMemoryStore.setDelegatedAuthority(assistantAdminUser.id, false);

      // Create status change request
      const res = await fetch('/api/admin/users/USR003/status', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer mock_jwt_${assistantAdminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'suspended' }),
      });
      const { requestId } = await res.json();

      // Admin rejects request
      asAdmin();
      const rejectRes = await fetch(`/api/admin/permissions/governance/approvals/${requestId}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${adminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'مرفوض لعدم اكتمال المبررات' }),
      });

      expect(rejectRes.status).toBe(200);
      const rejectedData = await rejectRes.json();
      expect(rejectedData.status).toBe('rejected');

      // Target remains active
      expect(inMemoryStore.getManagedUserById('USR003')?.status).toBe('active');

      // Subsequent attempt to approve must be blocked
      const approveAttempt = await fetch(`/api/admin/permissions/governance/approvals/${requestId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${adminUser.id}_test`,
          'Content-Type': 'application/json',
        },
      });
      expect(approveAttempt.status).toBe(400);
      expect(inMemoryStore.getManagedUserById('USR003')?.status).toBe('active');
    });

    it('preserves direct execution for system administrator without creating approval requests', async () => {
      asAdmin();

      // Admin creates user directly
      const payload = {
        name: 'م. حسام التميمي',
        username: 'hossam_tamimi',
        email: 'hossam.tamimi@cairo-metro.com',
        phone: '01055443322',
        jobTitle: 'مهندس اتصالات',
        department: 'قطاع الصيانة الكهربائية',
        role: 'user',
        status: 'active',
        password: 'Password123!',
      };

      const resCreate = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${adminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      expect(resCreate.status).toBe(201);
      const createdUser = await resCreate.json();
      expect(createdUser.id).toBeDefined();

      // No approval requests generated
      const reqs = inMemoryStore.getApprovalRequests();
      expect(reqs.some((r) => r.actionType === 'users.create' && r.requesterId === adminUser.id)).toBe(false);
    });
  });

  describe('13. Administrator Account Creation and Deletion Lifecycle Invariants', () => {
    const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
    const assistantAdminUser = SYNTHETIC_DEMO_ACCOUNTS.assistant_admin.user;
    const superAdminUser = {
      id: 'USR_SUPER_001',
      name: 'م. ياسين رضوان',
      email: 'superadmin@cairo-metro.com',
      role: 'super_admin' as UserRole,
      department: 'الإدارة العليا',
      jobTitle: 'المسؤول الأعلى للأنظمة',
      initials: 'ي.ر',
    };

    const asSuperAdmin = () => {
      authStorage.setSession({
        token: `mock_jwt_${superAdminUser.id}_test`,
        user: superAdminUser,
        expiresAt: Date.now() + 3600000,
      });
    };

    const asAssistantAdmin = () => {
      authStorage.setSession({
        token: `mock_jwt_${assistantAdminUser.id}_test`,
        user: assistantAdminUser,
        expiresAt: Date.now() + 3600000,
      });
    };

    const asAdmin = () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });
    };

    it('allows authorized Super Administrator to create another administrator account directly', async () => {
      asSuperAdmin();

      const newAdminPayload: CreateUserRequestDTO = {
        name: 'م. طارق عبد الحميد',
        username: 'tarek_admin_peer',
        email: 'tarek.admin@cairo-metro.com',
        phone: '01011223344',
        jobTitle: 'مدير نظم ومعلومات مساعد',
        department: 'الإدارة العامة لنظم وتكنولوجيا المعلومات',
        role: 'admin',
        status: 'active',
        password: 'SecureAdminPassword123!',
      };

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${superAdminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newAdminPayload),
      });

      expect(res.status).toBe(201);
      const created = await res.json();
      expect(created.id).toBeDefined();
      expect(created.role).toBe('admin');

      // Verify user is in directory with admin role
      const stored = inMemoryStore.getManagedUserById(created.id);
      expect(stored).toBeDefined();
      expect(stored?.role).toBe('admin');

      // Under INV-R3, regular admin attempting to create an admin is strictly forbidden (HTTP 403)
      asAdmin();
      const forbiddenAdminPayload: CreateUserRequestDTO = {
        ...newAdminPayload,
        username: 'unauth_peer_admin_attempt',
        email: 'unauth.peer@cairo-metro.com',
      };
      const resForbidden = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${adminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(forbiddenAdminPayload),
      });
      expect(resForbidden.status).toBe(403);
    });

    it('strictly forbids assistant administrator from creating an admin account directly or under delegation (HTTP 403)', async () => {
      asAssistantAdmin();
      // Even with active delegation!
      inMemoryStore.setDelegatedAuthority(assistantAdminUser.id, true);

      const unauthorizedAdminPayload: CreateUserRequestDTO = {
        name: 'محاولة اختراق رتبة مدير',
        username: 'unauth_admin_attempt',
        email: 'unauth.admin@cairo-metro.com',
        jobTitle: 'مهندس صيانة',
        department: 'قطاع الصيانة',
        role: 'admin',
        status: 'active',
      };

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer mock_jwt_${assistantAdminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(unauthorizedAdminPayload),
      });

      expect(res.status).toBe(403);
      const resData = await res.json();
      expect(resData.message).toContain('لا يمكن لمساعد مدير النظام إنشاء حساب برتبة مدير نظام');

      // Account was NOT created
      const stored = inMemoryStore.getManagedUsers().find((u) => u.username === 'unauth_admin_attempt');
      expect(stored).toBeUndefined();

      // No approval requests generated
      const reqs = inMemoryStore.getApprovalRequests();
      expect(reqs.some((r) => r.actionType === 'users.create' && (r.payload as Record<string, unknown>)?.role === 'admin')).toBe(false);
    });

    it('strictly forbids approval requests seeking to create an administrator account', () => {
      expect(() => {
        inMemoryStore.createApprovalRequest({
          actionType: 'users.create',
          titleAr: 'طلب مشبوه لإنشاء مدير نظام',
          requestedBy: assistantAdminUser.id,
          payload: {
            name: 'مدير عبر اعتماد',
            username: 'admin_via_approval',
            email: 'admin.approval@cairo-metro.com',
            role: 'admin',
          },
        });
      }).toThrowError(/لا يمكن لمساعد مدير النظام إنشاء حساب برتبة مدير نظام حتى عبر طلبات الاعتماد/);
    });

    it('forbids deletion of existing system administrator accounts by any user (HTTP 403)', async () => {
      // 1. Peer admin attempts to delete another admin (usr_admin_001)
      asAdmin();
      // Create a second admin by Super Admin to test peer deletion
      const secondAdmin = inMemoryStore.createUser(
        {
          name: 'مدير نظير ثان',
          username: 'second_admin',
          email: 'second.admin@cairo-metro.com',
          jobTitle: 'مدير نظام',
          department: 'الإدارة العامة للمعلومات',
          role: 'admin',
          status: 'active',
        },
        { id: superAdminUser.id, role: superAdminUser.role }
      );

      // Attempt deletion of secondAdmin by adminUser
      const resDeletePeer = await fetch(`/api/admin/users/${secondAdmin.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer mock_jwt_${adminUser.id}_test`,
          'Content-Type': 'application/json',
        },
      });

      expect(resDeletePeer.status).toBe(403);
      const peerData = await resDeletePeer.json();
      expect(peerData.message).toContain('إدارة حسابات مديري النظام محجوزة للمطور والمسؤول الأعلى فقط');
      expect(inMemoryStore.getManagedUserById(secondAdmin.id)).toBeDefined();

      // 2. Assistant admin attempts to delete secondAdmin
      asAssistantAdmin();
      inMemoryStore.setDelegatedAuthority(assistantAdminUser.id, true);

      const resDeleteByAssistant = await fetch(`/api/admin/users/${secondAdmin.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer mock_jwt_${assistantAdminUser.id}_test`,
          'Content-Type': 'application/json',
        },
      });

      expect(resDeleteByAssistant.status).toBe(403);
      const astData = await resDeleteByAssistant.json();
      expect(astData.message).toContain('لا يمكن لمساعد مدير النظام تعديل أو إيقاف أو حذف حساب مدير النظام');
      expect(inMemoryStore.getManagedUserById(secondAdmin.id)).toBeDefined();
    });
  });

  describe('14. Interactive UI for Editable Role Defaults (/admin/permissions)', () => {
    const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
    const assistantAdminUser = SYNTHETIC_DEMO_ACCOUNTS.assistant_admin.user;

    const asAssistantAdmin = () => {
      authStorage.setSession({
        token: `mock_jwt_${assistantAdminUser.id}_test`,
        user: assistantAdminUser,
        expiresAt: Date.now() + 3600000,
      });
    };

    const asAdmin = () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });
    };

    it('allows system administrator to toggle eligible role capabilities and save with Arabic confirmation', async () => {
      asAdmin();

      render(<AppRouter initialEntries={['/admin/permissions']} />);

      await waitFor(() => {
        expect(screen.getByTestId('permissions-matrix-page')).toBeInTheDocument();
      });

      // Tab 1 is active by default
      await waitFor(() => {
        expect(screen.getByTestId('role-permissions-matrix-table')).toBeInTheDocument();
      });

      // Find toggle for lecturer courses.create (initially unchecked)
      const toggleLecturerCourseCreate = screen.getByTestId(
        'toggle-role-capability-lecturer-courses.create'
      ) as HTMLInputElement;
      expect(toggleLecturerCourseCreate).not.toBeChecked();

      // Toggle it to checked
      fireEvent.click(toggleLecturerCourseCreate);
      expect(toggleLecturerCourseCreate).toBeChecked();

      // Unsaved changes bar should appear
      await waitFor(() => {
        expect(screen.getByTestId('unsaved-role-changes-bar')).toBeInTheDocument();
      });
      expect(screen.getByText(/تعديلات غير محفوظة على الصلاحيات الافتراضية/)).toBeInTheDocument();

      // Click save button
      const saveBtn = screen.getByTestId('save-role-defaults-btn');
      fireEvent.click(saveBtn);

      // Confirm dialog opens with shared impact warning
      await waitFor(() => {
        expect(screen.getByTestId('confirm-save-role-defaults-dialog')).toBeInTheDocument();
      });
      expect(screen.getByText(/سيؤثر على جميع المستخدمين الذين يحملون هذا الدور ولا يملكون استثناءات فردية مسبقة/)).toBeInTheDocument();

      // Confirm save
      const confirmBtn = screen.getByTestId('confirm-dialog-confirm-btn');
      fireEvent.click(confirmBtn);

      // Wait for success and store update
      await waitFor(() => {
        const updatedConfig = inMemoryStore.getRolePermissions('lecturer');
        expect(updatedConfig.permissions).toContain('courses.create');
      });
    });

    it('renders read-only view for assistant administrator without interactive toggles or save buttons', async () => {
      asAssistantAdmin();

      render(<AppRouter initialEntries={['/admin/permissions']} />);

      await waitFor(() => {
        expect(screen.getByTestId('permissions-matrix-page')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByTestId('role-permissions-matrix-table')).toBeInTheDocument();
      });

      // Toggles and save buttons must NOT be present for assistant admin
      expect(screen.queryByTestId('toggle-role-capability-lecturer-courses.create')).toBeNull();
      expect(screen.queryByTestId('save-role-defaults-btn')).toBeNull();
      expect(screen.queryByTestId('unsaved-role-changes-bar')).toBeNull();
    });
  });

  describe('15. Comprehensive Admin Lockout Audit & Governance Integrity Invariants', () => {
    const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;

    const asAdmin = () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });
    };

    it('identifies the exact 4 essential governance capabilities required for viable administration', () => {
      expect(ESSENTIAL_ADMIN_GOVERNANCE_CAPABILITIES).toEqual([
        'permissions.configure_roles',
        'permissions.configure_users',
        'users.view_directory',
        'users.change_role',
      ]);

      const integrity = validateAdminGovernanceIntegrity(inMemoryStore.getManagedUsers(), {
        roleDefaults: inMemoryStore.getEffectiveRoleDefaults(),
      });
      expect(integrity.valid).toBe(true);
      expect(integrity.viableAdminCount).toBeGreaterThanOrEqual(1);
    });

    it('rejects explicit denial of essential governance capabilities to the sole viable administrator', () => {
      // In base fixture, USR001 is also admin. Demote USR001 to isolate usr_admin_001 as the sole active admin.
      inMemoryStore.updateUserRole('USR001', 'assistant_admin');

      for (const essentialCap of ESSENTIAL_ADMIN_GOVERNANCE_CAPABILITIES) {
        expect(() => {
          inMemoryStore.setUserPermissionOverride({
            userId: 'usr_admin_001',
            revoked: [essentialCap],
          });
        }).toThrowError(/لا يمكن تطبيق هذا التعديل لأنه سيؤدي إلى حرمان آخر مدير نظام نشط/);

        // Verify atomic rejection: no partial mutation was stored
        expect(inMemoryStore.getUserPermissionOverride('usr_admin_001')).toBeNull();
      }
    });

    it('rejects self-mutation via API attempting to revoke essential governance capabilities from the sole administrator', async () => {
      inMemoryStore.updateUserRole('USR001', 'assistant_admin');
      asAdmin();

      const response = await fetch('/api/admin/permissions/users/usr_admin_001', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer mock_jwt_${adminUser.id}_test`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          revokedPermissions: ['permissions.configure_roles'],
          reason: 'محاولة سحب صلاحية إدارة الأدوار من الحساب الذاتي',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('إغلاق إداري كامل للمنظومة');

      // Crucial: Store remains pristine
      expect(inMemoryStore.getUserPermissionOverride('usr_admin_001')).toBeNull();
    });

    it('allows legitimate customization on a peer administrator when another viable administrator exists', () => {
      // In default fixture, usr_admin_001 and USR001 are both active admins.
      // Restricting USR001 from changing roles is legitimate as long as usr_admin_001 remains viable.
      const override = inMemoryStore.setUserPermissionOverride({
        userId: 'USR001',
        revoked: ['users.change_role'],
        reason: 'تقييد حساب المدير المساعد عن تعديل الرتب',
      });

      expect(override.revoked).toContain('users.change_role');
      expect(inMemoryStore.getUserPermissionOverride('USR001')?.revoked).toContain('users.change_role');

      // USR001 is denied users.change_role due to user override
      const checkUSR001 = inMemoryStore.hasPermission('USR001', 'users.change_role', {
        targetUser: { id: 'USR003', role: 'user' },
      });
      expect(checkUSR001.granted).toBe(false);
      expect(checkUSR001.source).toBe('user_override');
      expect(checkUSR001.reason).toBe('USER_OVERRIDE_REVOKED');

      // But usr_admin_001 still retains users.change_role directly
      const checkAdmin1 = inMemoryStore.hasPermission('usr_admin_001', 'users.change_role', {
        targetUser: { id: 'USR003', role: 'user' },
      });
      expect(checkAdmin1.granted).toBe(true);
    });

    it('rejects cascading overrides that would strip the last remaining viable administrator of an essential capability', () => {
      // Step 1: USR001 has users.change_role revoked (permitted because usr_admin_001 retains it)
      inMemoryStore.setUserPermissionOverride({
        userId: 'USR001',
        revoked: ['users.change_role'],
      });

      // Step 2: Now attempt to revoke users.change_role on usr_admin_001 as well
      expect(() => {
        inMemoryStore.setUserPermissionOverride({
          userId: 'usr_admin_001',
          revoked: ['users.change_role'],
        });
      }).toThrowError(/لا يمكن تطبيق هذا التعديل لأنه سيؤدي إلى حرمان آخر مدير نظام نشط/);

      // Verify usr_admin_001 override was NOT committed
      expect(inMemoryStore.getUserPermissionOverride('usr_admin_001')).toBeNull();

      // Verify usr_admin_001 still holds full governance
      expect(
        hasEssentialAdminGovernance('usr_admin_001', {
          roleDefaults: inMemoryStore.getEffectiveRoleDefaults(),
          userOverrides: { USR001: inMemoryStore.getUserPermissionOverride('USR001')! },
        })
      ).toBe(true);
    });

    it('evaluates effective permissions to prevent suspending or demoting the last viable administrator', () => {
      // USR001 has permissions.configure_users revoked (so USR001 is non-viable for recovery)
      inMemoryStore.setUserPermissionOverride({
        userId: 'USR001',
        revoked: ['permissions.configure_users'],
      });

      // Attempting to suspend usr_admin_001 (the only viable admin) by an authorized supervisor
      expect(() => {
        inMemoryStore.updateUserStatus('usr_admin_001', 'suspended', 'اختبار إيقاف المدير الأخير', {
          id: 'USR_SUPER_001',
          role: 'super_admin',
        });
      }).toThrowError(/لا يمكن إيقاف أو تخفيض رتبة أو حذف مدير النظام الأخير الذي يحتفظ بالصلاحيات الإدارية الجوهرية/);

      // Verify usr_admin_001 remains active
      expect(inMemoryStore.getManagedUserById('usr_admin_001')?.status).toBe('active');
    });

    it('validates combined role defaults and individual overrides to reject governance lockout atomically', () => {
      inMemoryStore.updateUserRole('USR001', 'assistant_admin');

      // Attempting to update role defaults to omit essential capabilities fails
      expect(() => {
        inMemoryStore.updateRolePermissions('admin', ['users.view_directory'], 'usr_admin_001');
      }).toThrowError(/لا يمكن إزالة الصلاحيات الإدارية الجوهرية/);

      // Role config remains intact
      const adminConfig = inMemoryStore.getRolePermissions('admin');
      expect(adminConfig.permissions).toContain('permissions.configure_roles');
      expect(adminConfig.permissions).toContain('permissions.configure_users');
      expect(adminConfig.permissions).toContain('users.view_directory');
      expect(adminConfig.permissions).toContain('users.change_role');
    });

    it('displays error alert in UserPermissionsModal when attempting to strip essential capability from sole admin', async () => {
      inMemoryStore.updateUserRole('USR001', 'assistant_admin');
      asAdmin();

      render(<AppRouter initialEntries={['/admin/users']} />);

      // Find user row for usr_admin_001
      await waitFor(() => {
        expect(screen.getByTestId('manage-permissions-btn-usr_admin_001')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('manage-permissions-btn-usr_admin_001'));

      await waitFor(() => {
        expect(screen.getByTestId('user-permissions-modal')).toBeInTheDocument();
      });

      // Toggle off users.view_directory (which is baseline, so toggling adds it to revoked)
      const toggleViewDir = screen.getByTestId('toggle-perm-users.view_directory');
      fireEvent.click(toggleViewDir);

      // Click save button
      const saveBtn = screen.getByTestId('save-user-permissions-btn');
      fireEvent.click(saveBtn);

      // Error alert appears
      await waitFor(() => {
        expect(screen.getByTestId('permissions-error-alert')).toBeInTheDocument();
      });

      expect(screen.getByTestId('permissions-error-alert')).toHaveTextContent(/إغلاق إداري/);

      // Modal remains open and override is not saved in store
      expect(screen.getByTestId('user-permissions-modal')).toBeInTheDocument();
      expect(inMemoryStore.getUserPermissionOverride('usr_admin_001')).toBeNull();
    });
  });


