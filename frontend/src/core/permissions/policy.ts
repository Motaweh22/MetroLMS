import type { UserRole } from '@/core/auth/types';
import { resolveCanonicalUserId } from '@/mocks/fixtures/userDirectoryFixtures';
import type {
  SystemCapability,
  PermissionCheckResult,
  EvaluationContext,
  UserPermissionOverride,
} from './types';
import { ROLE_CANONICAL_LABELS_AR } from './types';

/**
 * Exact Fixed Baseline Role Capabilities Matrix
 * Grounded in Section 3 of docs/frontend/authorization-and-permissions-design.md
 * 4 Canonical System Roles Only.
 */
export const ROLE_DEFAULT_CAPABILITIES: Record<UserRole, Partial<Record<SystemCapability, boolean>>> = {
  admin: {
    // 1. User Directory
    'users.view_directory': true,
    'users.view_transcript': true,
    'users.export_roster': true,
    // 2. Account Lifecycle
    'users.create': true,
    'users.change_role': true,
    'users.change_status': true,
    'users.delete': true,
    // 3. Group Management
    'groups.create': true,
    'groups.edit_config': true,
    'groups.archive': true,
    'groups.manage_members': true,
    // 4. QR & Join Requests
    'groups.generate_qr': true,
    'groups.review_join_requests': true,
    // 5. Group Materials
    'materials.manage_folders': true,
    'materials.upload_files': true,
    'materials.delete_files': true,
    'materials.manage_meetings': true,
    // 6. Course Operations
    'courses.create': true,
    'courses.edit_metadata': true,
    'courses.publish': true,
    // 7. Curriculum Authoring
    'courses.edit_curriculum': true,
    'courses.upload_lectures': true,
    'courses.delete_lectures': true,
    // 8. Quality & Approvals
    'reviews.submit_course': true,
    'reviews.decide_course': true,
    // 9. Trainee Access
    'learning.access_assigned': true,
    'learning.self_enroll': false,
    // 10. Permissions & Delegation
    'permissions.view_matrix': true,
    'permissions.configure_roles': true,
    'permissions.configure_users': true,
    'permissions.manage_delegation': true,
    'permissions.configure_departments': true,
    // 11. Audit & Compliance
    'audit.view_system_logs': true,
    // 12. Approvals Management
    'approvals.submit_request': false,
    'approvals.decide_request': true,
    // 13. Comments Moderation (Increment 11 Phase 5)
    'comments.moderate': true,
    'comments.delete': true,
    'comments.ignore_report': true,
    'comments.toggle': true,
  },

  assistant_admin: {
    // 1. User Directory
    'users.view_directory': true,
    'users.view_transcript': true,
    'users.export_roster': true,
    // 2. Account Lifecycle
    'users.create': true,
    'users.change_role': true,
    'users.change_status': true,
    'users.delete': true, // Eligible for ordinary users: requires approval by default, direct if delegated. Invariant blocks mutating Admin.
    // 3. Group Management
    'groups.create': true,
    'groups.edit_config': true,
    'groups.archive': true,
    'groups.manage_members': true,
    // 4. QR & Join Requests
    'groups.generate_qr': true,
    'groups.review_join_requests': true,
    // 5. Group Materials
    'materials.manage_folders': true,
    'materials.upload_files': true,
    'materials.delete_files': true,
    'materials.manage_meetings': true,
    // 6. Course Operations
    'courses.create': true,
    'courses.edit_metadata': true,
    'courses.publish': true,
    // 7. Curriculum Authoring
    'courses.edit_curriculum': true,
    'courses.upload_lectures': true,
    'courses.delete_lectures': true,
    // 8. Quality & Approvals
    'reviews.submit_course': true,
    'reviews.decide_course': false, // Immutably blocked for Assistant Admin (Admin sovereign review decision)
    // 9. Trainee Access
    'learning.access_assigned': true,
    'learning.self_enroll': false,
    // 10. Permissions & Delegation
    'permissions.view_matrix': true,
    'permissions.configure_roles': false, // Immutably blocked
    'permissions.configure_users': false, // Immutably blocked
    'permissions.manage_delegation': false, // Immutably blocked
    'permissions.configure_departments': true,
    // 11. Audit & Compliance
    'audit.view_system_logs': false, // Immutably blocked
    // 12. Approvals Management
    'approvals.submit_request': true,
    'approvals.decide_request': false, // Immutably blocked
    // 13. Comments Moderation (Increment 11 Phase 5)
    'comments.moderate': true,
    'comments.delete': true, // Requires approval by default, direct if delegated
    'comments.ignore_report': true, // Direct execution for triage
    'comments.toggle': true, // Requires approval by default, direct if delegated
  },

  lecturer: {
    // 1. User Directory
    'users.view_directory': true,
    'users.view_transcript': false,
    'users.export_roster': false,
    // 2. Account Lifecycle
    'users.create': false,
    'users.change_role': false,
    'users.change_status': false,
    'users.delete': false,
    // 3. Group Management
    'groups.create': false,
    'groups.edit_config': false,
    'groups.archive': false,
    'groups.manage_members': true, // Assigned groups only
    // 4. QR & Join Requests
    'groups.generate_qr': true, // Assigned groups only
    'groups.review_join_requests': true, // Assigned groups only
    // 5. Group Materials
    'materials.manage_folders': true, // Assigned groups only
    'materials.upload_files': true, // Assigned groups only
    'materials.delete_files': true, // Assigned groups only
    'materials.manage_meetings': true, // Assigned groups only
    // 6. Course Operations (Restricted by default, grantable via individual override)
    'courses.create': false,
    'courses.edit_metadata': false,
    // 7. Curriculum Authoring (Restricted by default, grantable via individual override)
    'courses.edit_curriculum': false,
    'courses.upload_lectures': false,
    'courses.delete_lectures': false,
    // 8. Quality & Approvals
    'reviews.submit_course': true, // Authored courses only
    'reviews.decide_course': false,
    // 9. Trainee Access
    'learning.access_assigned': true,
    'learning.self_enroll': false,
    // 10. Permissions & Delegation
    'permissions.view_matrix': false,
    'permissions.configure_roles': false,
    'permissions.configure_users': false,
    'permissions.manage_delegation': false,
    'permissions.configure_departments': false,
    // 11. Audit & Compliance
    'audit.view_system_logs': false,
    // 12. Approvals Management
    'approvals.submit_request': false,
    'approvals.decide_request': false,
    // 13. Comments Moderation (Platform-wide moderation forbidden for lecturers)
    'comments.moderate': false,
    'comments.delete': false,
    'comments.ignore_report': false,
    'comments.toggle': false,
  },

  user: {
    // 1. User Directory
    'users.view_directory': false,
    'users.view_transcript': true, // Own transcript only
    'users.export_roster': false,
    // 2. Account Lifecycle
    'users.create': false,
    'users.change_role': false,
    'users.change_status': false,
    'users.delete': false,
    // 3. Group Management
    'groups.create': false,
    'groups.edit_config': false,
    'groups.archive': false,
    'groups.manage_members': false,
    // 4. QR & Join Requests
    'groups.generate_qr': false,
    'groups.review_join_requests': false,
    // 5. Group Materials
    'materials.manage_folders': false,
    'materials.upload_files': false,
    'materials.delete_files': false,
    'materials.manage_meetings': false,
    // 6. Course Operations
    'courses.create': false,
    'courses.edit_metadata': false,
    // 7. Curriculum Authoring
    'courses.edit_curriculum': false,
    'courses.upload_lectures': false,
    'courses.delete_lectures': false,
    // 8. Quality & Approvals
    'reviews.submit_course': false,
    'reviews.decide_course': false,
    // 9. Trainee Access
    'learning.access_assigned': true,
    'learning.self_enroll': true,
    // 10. Permissions & Delegation
    'permissions.view_matrix': false,
    'permissions.configure_roles': false,
    'permissions.configure_users': false,
    'permissions.manage_delegation': false,
    'permissions.configure_departments': false,
    // 11. Audit & Compliance
    'audit.view_system_logs': false,
    // 12. Approvals Management
    'approvals.submit_request': false,
    'approvals.decide_request': false,
    // 13. Comments Moderation (Moderation forbidden for trainees)
    'comments.moderate': false,
    'comments.delete': false,
    'comments.ignore_report': false,
    'comments.toggle': false,
  },
};

/**
 * Controlled Role Capability Ceilings
 * Defines the absolute maximum capabilities an ordinary account in each canonical role may receive.
 * Any individual override attempting to exceed this boundary must be rejected by domain validation.
 */
export const ROLE_CAPABILITY_CEILINGS: Record<UserRole, ReadonlySet<SystemCapability>> = {
  // Trainee: Strictly learning & personal progress access. Never administrative privileges.
  user: new Set<SystemCapability>([
    'learning.access_assigned',
    'learning.self_enroll',
    'users.view_transcript',
  ]),

  // Lecturer: Teaching, course-related operations, assigned group management, group monitoring,
  // join requests, supplementary group materials. NEVER global user admin, delegation, or approvals.
  lecturer: new Set<SystemCapability>([
    // User directory & roster inspection
    'users.view_directory',
    'users.view_transcript',
    // Group management (assigned groups only)
    'groups.manage_members',
    'groups.generate_qr',
    'groups.review_join_requests',
    // Group materials & meetings (assigned groups only)
    'materials.manage_folders',
    'materials.upload_files',
    'materials.delete_files',
    'materials.manage_meetings',
    // Course authoring (eligible via individual administrator grant)
    'courses.create',
    'courses.edit_metadata',
    'courses.edit_curriculum',
    'courses.upload_lectures',
    'courses.delete_lectures',
    // Quality & reviews
    'reviews.submit_course',
    // Learning access
    'learning.access_assigned',
  ]),

  // Assistant Admin: Approved administrative capabilities subject to routine approval/delegation.
  // Sovereign admin capabilities remain forbidden (decide reviews, configure roles/users/delegation, audit logs, decide approvals).
  // Note: users.delete is permitted for ordinary non-admin users via approval/delegation; invariant protects admin accounts.
  assistant_admin: new Set<SystemCapability>([
    'users.view_directory',
    'users.view_transcript',
    'users.export_roster',
    'users.create',
    'users.change_role',
    'users.change_status',
    'users.delete',
    'groups.create',
    'groups.edit_config',
    'groups.archive',
    'groups.manage_members',
    'groups.generate_qr',
    'groups.review_join_requests',
    'materials.manage_folders',
    'materials.upload_files',
    'materials.delete_files',
    'materials.manage_meetings',
    'courses.create',
    'courses.edit_metadata',
    'courses.edit_curriculum',
    'courses.upload_lectures',
    'courses.delete_lectures',
    'courses.publish',
    'reviews.submit_course',
    'learning.access_assigned',
    'permissions.view_matrix',
    'permissions.configure_departments',
    'approvals.submit_request',
    'comments.moderate',
    'comments.delete',
    'comments.ignore_report',
    'comments.toggle',
  ]),

  // System Admin: Highest ordinary authority across all capabilities, subject to immutable safety invariants.
  admin: new Set<SystemCapability>([
    'users.view_directory',
    'users.view_transcript',
    'users.export_roster',
    'users.create',
    'users.change_role',
    'users.change_status',
    'users.delete',
    'groups.create',
    'groups.edit_config',
    'groups.archive',
    'groups.manage_members',
    'groups.generate_qr',
    'groups.review_join_requests',
    'materials.manage_folders',
    'materials.upload_files',
    'materials.delete_files',
    'materials.manage_meetings',
    'courses.create',
    'courses.edit_metadata',
    'courses.edit_curriculum',
    'courses.upload_lectures',
    'courses.delete_lectures',
    'courses.publish',
    'reviews.submit_course',
    'reviews.decide_course',
    'learning.access_assigned',
    'learning.self_enroll',
    'permissions.view_matrix',
    'permissions.configure_roles',
    'permissions.configure_users',
    'permissions.manage_delegation',
    'permissions.configure_departments',
    'audit.view_system_logs',
    'approvals.submit_request',
    'approvals.decide_request',
    'comments.moderate',
    'comments.delete',
    'comments.ignore_report',
    'comments.toggle',
  ]),
};

/**
 * Validates whether an attempted individual permission grant is allowed within the target user's role ceiling.
 * Centralized domain guardrail enforcing controlled role boundaries.
 */
export function validatePermissionOverride(
  role: UserRole,
  capability: SystemCapability
): { valid: boolean; reasonAr?: string } {
  const ceiling = ROLE_CAPABILITY_CEILINGS[role];
  if (!ceiling || !ceiling.has(capability)) {
    const roleLabel = ROLE_CANONICAL_LABELS_AR[role] || role;
    return {
      valid: false,
      reasonAr: `غير مصرح: الصلاحية المطلوبة (${capability}) تتجاوز السقف الأقصى المحدد لدور (${roleLabel}). تتطلب هذه الصلاحية ترقية صريحة لرتبة المستخدم عبر إدارة الحسابات.`,
    };
  }
  return { valid: true };
}

/**
 * Capabilities that require approval for Assistant Administrator
 * unless full operational delegation is active
 */
export const ASSISTANT_ADMIN_APPROVAL_REQUIRED_CAPABILITIES: ReadonlySet<SystemCapability> = new Set([
  'users.export_roster',
  'users.create',
  'users.change_role',
  'users.change_status',
  'users.delete',
  'groups.create',
  'groups.edit_config',
  'groups.archive',
  'groups.manage_members',
  'groups.review_join_requests',
  'materials.delete_files',
  'courses.create',
  'courses.edit_metadata',
  'courses.edit_curriculum',
  'courses.upload_lectures',
  'courses.delete_lectures',
  'courses.publish',
  'permissions.configure_departments',
  'comments.delete',
  'comments.toggle',
]);

/**
 * Capabilities that are immutably blocked for Assistant Administrator
 * and cannot be granted even via role configuration, delegation, or user override
 */
export const IMMUTABLE_BLOCKED_FOR_ASSISTANT_ADMIN: ReadonlySet<SystemCapability> = new Set([
  'reviews.decide_course',
  'permissions.configure_roles',
  'permissions.configure_users',
  'permissions.manage_delegation',
  'audit.view_system_logs',
  'approvals.decide_request',
]);

/**
 * Group-Scoped Capabilities that require assignment validation for lecturers
 */
export const GROUP_SCOPED_CAPABILITIES: ReadonlySet<SystemCapability> = new Set([
  'groups.manage_members',
  'groups.generate_qr',
  'groups.review_join_requests',
  'materials.manage_folders',
  'materials.upload_files',
  'materials.delete_files',
  'materials.manage_meetings',
]);

/**
 * Essential Administrative Capabilities Required for Viable Platform Governance.
 * At least one active administrator MUST effectively possess all of these capabilities
 * at all times to prevent catastrophic governance lockout.
 */
export const ESSENTIAL_ADMIN_GOVERNANCE_CAPABILITIES: readonly SystemCapability[] = [
  'permissions.configure_roles',
  'permissions.configure_users',
  'users.view_directory',
  'users.change_role',
] as const;

/**
 * Checks whether an administrator effectively retains all essential governance capabilities
 * under the combination of role defaults and individual overrides.
 */
export function hasEssentialAdminGovernance(
  userId: string,
  options: {
    roleDefaults?: Record<UserRole, Partial<Record<SystemCapability, boolean>>>;
    userOverrides?: Record<string, UserPermissionOverride>;
  }
): boolean {
  const { roleDefaults, userOverrides } = options;
  const canonicalId = (resolveCanonicalUserId(userId) || userId).toLowerCase();
  const userIdLower = userId.toLowerCase();

  const override =
    userOverrides?.[userId] ||
    userOverrides?.[userIdLower] ||
    userOverrides?.[canonicalId];

  const revokedList = override?.revoked || override?.revokedPermissions || [];
  const grantedList = override?.granted || override?.grantedPermissions || [];
  const adminDefaults = roleDefaults?.admin || ROLE_DEFAULT_CAPABILITIES.admin;

  for (const cap of ESSENTIAL_ADMIN_GOVERNANCE_CAPABILITIES) {
    if (revokedList.includes(cap)) {
      return false;
    }
    const isGranted = grantedList.includes(cap) || Boolean(adminDefaults?.[cap]);
    if (!isGranted) {
      return false;
    }
  }

  return true;
}

/**
 * Validates that at least one active system administrator retains all essential governance capabilities.
 * Rejects any proposed state (user overrides, role defaults, or user account mutations)
 * that would leave the system without a viable governance administrator.
 */
export function validateAdminGovernanceIntegrity(
  users: Array<{ id: string; role: UserRole; status?: string }>,
  options: {
    roleDefaults?: Record<UserRole, Partial<Record<SystemCapability, boolean>>>;
    userOverrides?: Record<string, UserPermissionOverride>;
  }
): { valid: boolean; viableAdminCount: number; reasonAr?: string } {
  const activeAdmins = users.filter((u) => u.role === 'admin' && u.status !== 'suspended');

  let viableCount = 0;
  for (const admin of activeAdmins) {
    if (hasEssentialAdminGovernance(admin.id, options)) {
      viableCount++;
    }
  }

  if (viableCount === 0) {
    return {
      valid: false,
      viableAdminCount: 0,
      reasonAr:
        'غير مصرح: لا يمكن تطبيق هذا التعديل لأنه سيؤدي إلى حرمان آخر مدير نظام نشط من الصلاحيات الإدارية الجوهرية (إدارة الأدوار، إدارة الصلاحيات، دليل المستخدمين، وتعديل الرتب)، مما يتسبب في إغلاق إداري كامل للمنظومة.',
    };
  }

  return { valid: true, viableAdminCount: viableCount };
}

/**
 * Evaluates whether an action violates any Protected Administrator Invariants
 */
export function evaluateProtectedInvariant(
  actor: { id: string; role: UserRole },
  capability: SystemCapability,
  context?: EvaluationContext,
  allUsers?: Array<{ id: string; role: UserRole; status?: string }>,
  governanceOptions?: {
    roleDefaults?: Record<UserRole, Partial<Record<SystemCapability, boolean>>>;
    userOverrides?: Record<string, UserPermissionOverride>;
  }
): { allowed: boolean; code?: string; messageAr?: string } {
  // Invariant 1: Assistant Administrator can NEVER mutate or decide operations on a System Administrator,
  // and can NEVER create a new System Administrator account.
  if (actor.role === 'assistant_admin') {
    if (capability === 'users.create' && (context?.targetRole === 'admin' || context?.targetUser?.role === 'admin')) {
      return {
        allowed: false,
        code: 'INVARIANT_ASSISTANT_CANNOT_CREATE_ADMIN',
        messageAr: 'غير مصرح: لا يمكن لمساعد مدير النظام إنشاء حساب برتبة مدير نظام سواء بطلب اعتماد أو تفويض مباشر',
      };
    }
    if (context?.targetUser?.role === 'admin') {
      if (['users.change_role', 'users.change_status', 'users.delete', 'approvals.decide_request'].includes(capability)) {
        return {
          allowed: false,
          code: 'INVARIANT_ASSISTANT_CANNOT_MUTATE_ADMIN',
          messageAr: 'غير مصرح: لا يمكن لمساعد مدير النظام تعديل أو إيقاف أو حذف حساب مدير النظام أو البت في طلب يتعلق به',
        };
      }
    }
  }

  // Invariant 2: Self-Mutation Prohibition & Peer Verification Safeguard
  // A System Administrator cannot demote, suspend, or delete their own account.
  // Sensitive account mutations targeting an Admin require peer administrator action.
  if (actor.role === 'admin' && context?.targetUser) {
    const actorCanonical = resolveCanonicalUserId(actor.id);
    const targetCanonical = resolveCanonicalUserId(context.targetUser.id);

    if (actorCanonical && targetCanonical && actorCanonical === targetCanonical) {
      if (capability === 'users.delete') {
        return {
          allowed: false,
          code: 'INVARIANT_SELF_MUTATION_PROHIBITED',
          messageAr: 'غير مصرح: لا يمكن لمدير النظام حذف حسابه الذاتي',
        };
      }
      if (capability === 'users.change_role' && (!context.targetRole || context.targetRole !== 'admin')) {
        return {
          allowed: false,
          code: 'INVARIANT_SELF_MUTATION_PROHIBITED',
          messageAr: 'غير مصرح: لا يمكن لمدير النظام تخفيض رتبة حسابه الذاتي؛ تتطلب العملية تدقيقاً من مدير نظام نظير',
        };
      }
      if (capability === 'users.change_status' && (!context.targetStatus || context.targetStatus === 'suspended')) {
        return {
          allowed: false,
          code: 'INVARIANT_SELF_MUTATION_PROHIBITED',
          messageAr: 'غير مصرح: لا يمكن لمدير النظام إيقاف حسابه الذاتي',
        };
      }
    }
  }

  // Invariant 2b: Protected Administrator Deletion
  // An existing system-administrator account cannot be deleted by anyone through ordinary user management.
  if (capability === 'users.delete' && context?.targetUser?.role === 'admin') {
    return {
      allowed: false,
      code: 'INVARIANT_ADMIN_ACCOUNT_NON_DELETABLE',
      messageAr: 'غير مصرح: حسابات مديري النظام محصنة ولا يمكن حذفها نهائياً عبر إدارة المستخدمين',
    };
  }

  // Invariant 3: Last Active Administrator Lockout Prevention
  if (context?.targetUser?.role === 'admin' && allUsers && allUsers.length > 0) {
    const isTargetCurrentlyActive = context.targetUser.status !== 'suspended';
    const isRemovingAdmin =
      capability === 'users.delete' ||
      (capability === 'users.change_role' && (!context.targetRole || context.targetRole !== 'admin')) ||
      (capability === 'users.change_status' && (!context.targetStatus || context.targetStatus === 'suspended'));

    if (isRemovingAdmin && isTargetCurrentlyActive) {
      const targetCanonical = resolveCanonicalUserId(context.targetUser.id).toLowerCase();
      const remainingActiveAdmins = allUsers.filter(
        (u) =>
          u.role === 'admin' &&
          u.status !== 'suspended' &&
          resolveCanonicalUserId(u.id).toLowerCase() !== targetCanonical
      );

      if (remainingActiveAdmins.length === 0) {
        return {
          allowed: false,
          code: 'INVARIANT_ZERO_ADMIN_LOCKOUT',
          messageAr: 'غير مصرح: لا يمكن إيقاف أو تخفيض رتبة أو حذف مدير النظام الأخير في المنظومة لمنع الإغلاق الإداري',
        };
      }

      // If governance configuration is provided, verify at least one REMAINING active admin retains essential governance
      if (governanceOptions) {
        const remainingViable = remainingActiveAdmins.filter((u) =>
          hasEssentialAdminGovernance(u.id, governanceOptions)
        );
        if (remainingViable.length === 0) {
          return {
            allowed: false,
            code: 'INVARIANT_ZERO_ADMIN_LOCKOUT',
            messageAr:
              'غير مصرح: لا يمكن إيقاف أو تخفيض رتبة أو حذف مدير النظام الأخير الذي يحتفظ بالصلاحيات الإدارية الجوهرية لمنع الإغلاق الإداري',
          };
        }
      }
    }
  }

  // Invariant 4: Fail-Safe Guardrail when Sensitive Target Context is Missing
  if (['users.change_role', 'users.change_status', 'users.delete'].includes(capability)) {
    if (!context?.targetUser) {
      return {
        allowed: false,
        code: 'INVARIANT_CONTEXT_MISSING',
        messageAr: 'غير مصرح: لا يمكن تنفيذ عمليات تعديل الحسابات الحساسة دون تمرير سياق المستخدم المستهدف',
      };
    }
  }

  return { allowed: true };
}

/**
 * Evaluates whether an actor has permission to execute or propose a capability
 * Strict Conceptual Evaluation Precedence:
 * 1. Immutable Protected Security Invariants (Hard Safety Stop)
 * 2. Canonical Role Capability Ceiling & Mandatory Prohibitions
 * 3. Individual-User Permission Overrides (within ceiling)
 * 4. Fixed Baseline Permissions of Canonical Role
 * 5. Resource and Group Scope Validation (supervisor / assistant lecturer duties)
 * 6. Approval / Delegation Execution Policy (direct vs requires approval)
 */
export function evaluatePermission(
  actor: { id: string; role: UserRole },
  capability: SystemCapability,
  options?: {
    context?: EvaluationContext;
    userOverrides?: Record<string, UserPermissionOverride>;
    allUsers?: Array<{ id: string; role: UserRole; status?: string }>;
    roleDefaults?: Record<UserRole, Partial<Record<SystemCapability, boolean>>>;
  }
): PermissionCheckResult {
  const { context, userOverrides, allUsers, roleDefaults } = options || {};

  // 1. Immutable Protected Security Invariants Check
  const invariant = evaluateProtectedInvariant(actor, capability, context, allUsers);
  if (!invariant.allowed) {
    return {
      granted: false,
      executionMode: 'denied',
      source: 'invariant',
      violatesInvariant: true,
      invariantCode: invariant.code,
      reason: invariant.code,
      reasonAr: invariant.messageAr,
    };
  }

  // 2. Canonical Role Capability Ceiling Check
  const ceiling = ROLE_CAPABILITY_CEILINGS[actor.role];
  if (!ceiling || !ceiling.has(capability)) {
    const roleLabel = ROLE_CANONICAL_LABELS_AR[actor.role] || actor.role;
    return {
      granted: false,
      executionMode: 'denied',
      source: 'role_default',
      reason: 'ROLE_CEILING_EXCEEDED',
      reasonAr: `غير مصرح: هذه العملية مخصصة لمديري النظام فقط وتقع خارج السقف الأقصى المسموح لدور (${roleLabel}).`,
    };
  }

  // 2b. Immutable Blocked Set for Assistant Admin
  if (actor.role === 'assistant_admin' && IMMUTABLE_BLOCKED_FOR_ASSISTANT_ADMIN.has(capability)) {
    return {
      granted: false,
      executionMode: 'denied',
      source: 'invariant',
      violatesInvariant: true,
      invariantCode: 'INVARIANT_IMMUTABLE_BLOCKED',
      reason: 'IMMUTABLE_BLOCKED_FOR_ASSISTANT_ADMIN',
      reasonAr: 'هذه الصلاحية محجوبة بصورة قطعية عن مساعد مدير النظام وتتطلب رتبة مدير النظام الأصيل',
    };
  }

  let isGranted: boolean | undefined = undefined;
  let source: PermissionCheckResult['source'] = 'role_default';

  // 3. Individual-User Permission Override (Evaluated strictly within ceiling)
  const canonicalActorId = (resolveCanonicalUserId(actor.id) || actor.id).toLowerCase();
  const actorIdLower = actor.id.toLowerCase();
  const override =
    userOverrides?.[actor.id] ||
    userOverrides?.[actorIdLower] ||
    userOverrides?.[canonicalActorId];

  if (override) {
    const revokedList = override.revoked || [];
    if (revokedList.includes(capability)) {
      return {
        granted: false,
        executionMode: 'denied',
        source: 'user_override',
        reason: 'USER_OVERRIDE_REVOKED',
        reasonAr: 'تم سحب هذه الصلاحية صراحة من حساب المستخدم عبر التخصيص الفردي',
      };
    }

    const grantedList = override.granted || override.grantedPermissions || [];
    if (grantedList.includes(capability)) {
      // Override grant is valid because ceiling was already verified in Step 2
      isGranted = true;
      source = 'user_override';
    }
  }

  // 4. Configured Role Defaults / Fixed Baseline Permissions of Canonical Role
  if (isGranted === undefined) {
    const configuredDefaults = roleDefaults?.[actor.role];
    if (configuredDefaults && configuredDefaults[capability] !== undefined) {
      isGranted = Boolean(configuredDefaults[capability]);
    } else {
      isGranted = Boolean(ROLE_DEFAULT_CAPABILITIES[actor.role]?.[capability]);
    }
    source = 'role_default';
    if (!isGranted) {
      return {
        granted: false,
        executionMode: 'denied',
        source: 'role_default',
        reason: 'ROLE_DEFAULT_DENIED',
        reasonAr: 'غير مصرح: الصلاحية غير متضمنة في الدور الوظيفي الافتراضي للمستخدم',
      };
    }
  }

  // 5. Resource and Group Scope Validation
  // For group-scoped operations performed by a lecturer, verify supervisor or assistant lecturer assignment
  if (GROUP_SCOPED_CAPABILITIES.has(capability) && actor.role === 'lecturer') {
    if (context?.targetGroupId) {
      const isSupervisor = context.isGroupSupervisor === true;
      const isAssistant = context.isGroupAssistant === true;
      const isAssigned = context.isAssigned !== false;

      // If context explicitly defines assignment status, enforce it
      if (context.isGroupSupervisor !== undefined || context.isGroupAssistant !== undefined) {
        if (!isSupervisor && !isAssistant) {
          return {
            granted: false,
            executionMode: 'denied',
            source: 'role_default',
            reason: 'UNASSIGNED_GROUP_CONTEXT',
            reasonAr: 'غير مصرح: لا يمتلك المحاضر تعييناً كمدرب أو محاضر مساعد في هذه المجموعة التدريبية المحددة',
          };
        }
      } else if (!isAssigned) {
        return {
          granted: false,
          executionMode: 'denied',
          source: 'role_default',
          reason: 'UNASSIGNED_GROUP_CONTEXT',
          reasonAr: 'غير مصرح: لا يمتلك المحاضر تعييناً في هذه المجموعة التدريبية',
        };
      }
    }
  }

  // 6. Approval / Delegation Execution Policy Resolution
  let executionMode: PermissionCheckResult['executionMode'] = 'direct';

  if (actor.role === 'assistant_admin') {
    if (context?.hasDelegationBypass) {
      executionMode = 'direct';
    } else if (ASSISTANT_ADMIN_APPROVAL_REQUIRED_CAPABILITIES.has(capability)) {
      executionMode = 'requires_approval';
    } else {
      executionMode = 'direct';
    }
  }

  return {
    granted: true,
    executionMode,
    source,
    reason: executionMode === 'requires_approval' ? 'REQUIRES_ADMIN_APPROVAL' : 'GRANTED',
    reasonAr:
      executionMode === 'requires_approval'
        ? 'العملية مصرح بتقديمها ولكن تتطلب اعتماد مدير النظام قبل التنفيذ'
        : 'مصرح بالتنفيذ المباشر',
  };
}
