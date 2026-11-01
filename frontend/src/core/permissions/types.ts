import type { UserRole } from '@/core/auth/types';
export type { UserRole };

/**
 * 34 Semantic System Capabilities across 12 Operational Areas
 * Grounded in docs/frontend/authorization-and-permissions-design.md
 */
export type SystemCapability =
  // 1. User Directory & Identity Management
  | 'users.view_directory'
  | 'users.view_transcript'
  | 'users.export_roster'

  // 2. Account Lifecycle & Status Mutation
  | 'users.create'
  | 'users.change_role'
  | 'users.change_status'
  | 'users.delete'

  // 3. Training Group Lifecycle & Configuration
  | 'groups.create'
  | 'groups.edit_config'
  | 'groups.archive'
  | 'groups.manage_members'

  // 4. QR Enrollment & Join Requests
  | 'groups.generate_qr'
  | 'groups.review_join_requests'

  // 5. Group Materials & Interactive Meetings
  | 'materials.manage_folders'
  | 'materials.upload_files'
  | 'materials.delete_files'
  | 'materials.manage_meetings'

  // 6. Course Creation & General Metadata
  | 'courses.create'
  | 'courses.edit_metadata'

  // 7. Course Curriculum & Lesson Content Authoring
  | 'courses.edit_curriculum'
  | 'courses.upload_lectures'
  | 'courses.delete_lectures'

  // 8. Quality & Approvals
  | 'reviews.submit_course'
  | 'reviews.decide_course'

  // 9. Trainee Access & Learning
  | 'learning.access_assigned'
  | 'learning.self_enroll'

  // 10. Permissions & Delegation Governance
  | 'permissions.view_matrix'
  | 'permissions.configure_roles'
  | 'permissions.configure_users'
  | 'permissions.manage_delegation'
  | 'permissions.configure_departments'

  // 11. Audit & Compliance
  | 'audit.view_system_logs'

  // 12. Approval Requests & Administrative Reviews
  | 'approvals.submit_request'
  | 'approvals.decide_request'

  // 13. Comment Moderation & Discussion Management (Increment 11 Phase 5)
  | 'comments.moderate'
  | 'comments.delete'
  | 'comments.ignore_report'
  | 'comments.toggle'

  // Legacy/Convenience system capability keys
  | 'permissions.view'
  | 'permissions.manage'
  | 'audit.view'
  | 'courses.publish'
  | 'courses.view'
  | 'analytics.export'
  | 'materials.manage'
  | 'users.view'
  | 'users.manage'
  | 'transcripts.view'
  | (string & {});

/**
 * Execution Mode for Permitted Operations
 */
export type PermissionExecutionMode = 'direct' | 'requires_approval' | 'denied';

/**
 * Detailed Result of a Permission Check
 */
export interface PermissionCheckResult {
  granted: boolean;
  executionMode: PermissionExecutionMode;
  source: 'invariant' | 'user_override' | 'role_customization' | 'role_default';
  reason?: string;
  reasonAr?: string;
  violatesInvariant?: boolean;
  invariantCode?: string;
}

/**
 * Contextual Information for Evaluating Capabilities with Targets / Resources
 */
export interface EvaluationContext {
  /** Target user when the operation mutates or inspects an account */
  targetUser?: {
    id: string;
    role: UserRole;
    status?: string;
  };
  /** Target group identifier */
  targetGroupId?: string;
  /** Target course identifier */
  targetCourseId?: string;
  /** Whether the target group or course is assigned/authored by the actor */
  isAssigned?: boolean;
  /** Proposed new role if the capability is a role change */
  targetRole?: UserRole;
  /** Proposed new status if the capability is a status change */
  targetStatus?: 'active' | 'suspended';
  /** Whether full operational delegation / approval bypass is active for this actor */
  hasDelegationBypass?: boolean;
  /** Whether the actor is designated as primary supervisor for the target group */
  isGroupSupervisor?: boolean;
  /** Whether the actor is designated as assistant lecturer for the target group */
  isGroupAssistant?: boolean;
  /** Whether the capability context is delegation management */
  isDelegation?: boolean;
  /** Whether the capability context is transcript view */
  isTranscript?: boolean;
  /** Subsystem identifier for disambiguating management operations */
  subsystem?: 'permissions' | 'delegation';
  /** Scope identifier for disambiguating read operations */
  scope?: 'directory' | 'transcript';
}

/**
 * Role-Level Customization Config
 */
export interface RolePermissionsConfig {
  role: UserRole;
  capabilities?: Partial<Record<SystemCapability, boolean>>;
  permissions?: SystemCapability[];
  updatedAt?: string;
  updatedBy?: string;
}

/**
 * User-Specific Capability Override
 */
export interface UserPermissionOverride {
  userId: string;
  granted?: SystemCapability[];
  revoked?: SystemCapability[];
  grantedPermissions?: SystemCapability[];
  revokedPermissions?: SystemCapability[];
  updatedAt?: string;
  updatedBy?: string;
  reason?: string;
}

/**
 * Effective permissions for a user
 */
export interface EffectiveUserPermissions {
  permissions: SystemCapability[];
  role: UserRole;
  hasDelegatedAuthority: boolean;
  override: UserPermissionOverride | null;
}

/**
 * Exact Operational Delegation Grant (MFR-38, INV-R4, Legend A)
 */
export interface DelegationGrant {
  id?: string;
  userId: string;
  capabilities: SystemCapability[];
  active: boolean;
  expiresAt?: string | number | null;
  resourceScope?: {
    groupId?: string;
    department?: string;
    resourceType?: string;
  };
  grantedBy?: string;
  grantedAt?: string;
}

/**
 * Approval Action Types for Assistant Administrator Proposed Operations
 */
export type ApprovalActionType =
  | 'USER_CREATE'
  | 'USER_ROLE_CHANGE'
  | 'USER_STATUS_CHANGE'
  | 'USER_DELETE'
  | 'GROUP_CREATE'
  | 'GROUP_CONFIG_UPDATE'
  | 'GROUP_ARCHIVE'
  | 'GROUP_MEMBER_ASSIGN'
  | 'GROUP_MEMBER_REMOVE'
  | 'COURSE_CREATE'
  | 'COURSE_CURRICULUM_UPDATE'
  | 'COURSE_PUBLISH'
  | 'DEPARTMENT_CONFIG_UPDATE'
  | 'users.create'
  | 'users.change_role'
  | 'users.change_status'
  | 'users.delete'
  | 'groups.create'
  | 'groups.edit_config'
  | 'groups.archive'
  | 'courses.publish'
  | 'permissions.configure_departments'
  | 'comments.delete'
  | 'COMMENT_DELETE'
  | 'comments.toggle'
  | 'COMMENT_TOGGLE';

/**
 * Approval Request Status
 */
export type ApprovalRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'failed_execution';

/**
 * Formal Approval Request Entity
 */
export interface ApprovalRequest<TPayload = unknown> {
  id: string;
  actionType: ApprovalActionType;
  titleAr?: string;
  requesterId?: string;
  requesterName?: string;
  requesterRole?: 'assistant_admin' | UserRole;
  requestedBy?: string;
  justification?: string;
  targetResourceId?: string;
  targetResourceName?: string;
  targetId?: string;
  role?: string;
  status: ApprovalRequestStatus;
  createdAt?: string;
  submittedAt?: string;
  decidedBy?: string;
  decidedByName?: string;
  decidedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  decisionNote?: string;
  executionError?: string;
  payload?: TPayload;
}

/**
 * System Audit Log Event Severity
 */
export type AuditEventSeverity = 'info' | 'warning' | 'critical';

/**
 * System Audit Log Event Outcome
 */
export type AuditEventOutcome =
  | 'success'
  | 'denied'
  | 'failed'
  | 'pending_approval'
  | 'rejected';

/**
 * System Audit Log Entry DTO
 */
export interface SystemAuditLogEntryDTO {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  actionLabelAr: string;
  severity: AuditEventSeverity;
  resourceType?: string;
  targetResourceId?: string;
  targetResourceName?: string;
  details: string;
  outcome: AuditEventOutcome;
  requestId?: string;
  metadata?: Record<string, unknown>;
  clientContext?: {
    origin?: string;
    userAgent?: string;
  };
}

/**
 * Filter Parameters for Querying Security Audit Trail
 */
export interface AuditFilterParams {
  actorId?: string;
  action?: string;
  outcome?: AuditEventOutcome | 'all';
  severity?: AuditEventSeverity | 'all';
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Paginated Security Audit Trail API Response DTO
 */
export interface AuditLogResponseDTO {
  entries: SystemAuditLogEntryDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Canonical Training Track Entity
 */
export interface CanonicalTrackDTO {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
}

/**
 * Canonical Department Entity
 */
export interface CanonicalDepartmentDTO {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string;
}

/**
 * Department Course Track Permission Configuration DTO
 */
export interface DepartmentPermissionDTO {
  departmentId: string;
  departmentName: string;
  allowedTracks: string[];
  updatedAt: string;
  updatedBy?: string;
}

export type DepartmentTracksConfigDTO = DepartmentPermissionDTO;

export interface UpdateDepartmentTracksRequestDTO {
  allowedTracks: string[];
  justification?: string;
}

export interface UpdateDepartmentTracksResponseDTO {
  success: boolean;
  messageAr: string;
  department: DepartmentPermissionDTO;
  requiresApproval?: boolean;
  approvalRequestId?: string;
}

/**
 * Full Canonical Arabic Display Labels for Roles
 */
export const ROLE_CANONICAL_LABELS_AR: Record<UserRole, string> = {
  developer: 'المطور',
  super_admin: 'المسؤول الأعلى',
  admin: 'مدير النظام',
  assistant_admin: 'مدير النظام المساعد',
  lecturer: 'المحاضر',
  user: 'المتدرب',
};

export const ROLE_DISPLAY_LABELS = ROLE_CANONICAL_LABELS_AR;

/**
 * Group-Scoped Assistant Lecturer Assignment
 * Represents a lecturer designated to assist in a specific training group.
 * The user remains canonical role 'lecturer' platform-wide.
 */
export interface GroupAssistantAssignment {
  groupId: string;
  assistantLecturerId: string;
  assignedByLecturerId: string;
  status: 'active' | 'revoked';
  assignedAt: string;
  revokedAt?: string | null;
}

/**
 * User Permissions Editor Data Contract
 */
export interface UserPermissionsEditorData {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    department: string;
  };
  baselineCapabilities: SystemCapability[];
  roleCeilingCapabilities: SystemCapability[];
  grantedPermissions: SystemCapability[];
  revokedPermissions: SystemCapability[];
  effectiveCapabilities: SystemCapability[];
}

export type PermissionKey = SystemCapability;

export interface PermissionDefinition {
  key: PermissionKey;
  labelAr: string;
  category: string;
  descriptionAr: string;
  isSovereign?: boolean;
}

export interface PermissionCategory {
  id: string;
  labelAr: string;
  descriptionAr: string;
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  { id: 'users', labelAr: 'إدارة المستخدمين والحسابات', descriptionAr: 'استعراض الدليل، إنشاء وتعديل الرتب والحالات' },
  { id: 'groups', labelAr: 'إدارة المجموعات التدريبية', descriptionAr: 'المجموعات، رموز QR، الحقائب والاجتماعات' },
  { id: 'courses', labelAr: 'المقررات والمناهج والجودة', descriptionAr: 'إنشاء وتعديل المناهج والمحاضرات وتدقيق الجودة' },
  { id: 'learning', labelAr: 'التعلم والتسجيل الذاتي', descriptionAr: 'الوصول للمحتوى التدريبي والتسجيل الذاتي' },
  { id: 'governance', labelAr: 'الحوكمة والرقابة والاعتمادات', descriptionAr: 'مصفوفة الصلاحيات، سجل التدقيق، واعتماد الطلبات' },
];

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // 1. Users
  { key: 'users.view_directory', labelAr: 'استعراض دليل المستخدمين والبحث', category: 'users', descriptionAr: 'الوصول إلى سجل المستخدمين والاطلاع على البيانات الأساسية' },
  { key: 'users.view_transcript', labelAr: 'استعراض السجل التعليمي التفصيلي للمستخدم', category: 'users', descriptionAr: 'عرض سجل التدريب والمحاولات والشهادات والنتائج' },
  { key: 'users.export_roster', labelAr: 'تصدير بيانات المستخدمين', category: 'users', descriptionAr: 'تصدير قوائم وبيانات المستخدمين إلى ملفات خارجية' },
  { key: 'users.create', labelAr: 'إنشاء حساب مستخدم جديد', category: 'users', descriptionAr: 'إضافة حسابات متدربين أو محاضرين أو موظفين للنظام' },
  { key: 'users.change_role', labelAr: 'تعديل دور وصلاحيات الحساب', category: 'users', descriptionAr: 'ترقية أو تغيير الرتبة الوظيفية للمستخدم' },
  { key: 'users.change_status', labelAr: 'إيقاف وتنشيط حسابات المستخدمين', category: 'users', descriptionAr: 'تجميد الحسابات مؤقتاً أو إعادة تفعيلها' },
  { key: 'users.delete', labelAr: 'حذف حساب مستخدم نهائياً', category: 'users', descriptionAr: 'حذف بيانات الحساب من المنظومة' },

  // 2. Groups
  { key: 'groups.create', labelAr: 'إنشاء مجموعة تدريبية جديدة', category: 'groups', descriptionAr: 'تأسيس دفعات ومجموعات تدريبية وتعيين المشرفين' },
  { key: 'groups.edit_config', labelAr: 'تعديل إعدادات وسياسات المجموعة', category: 'groups', descriptionAr: 'تغيير مواعيد المجموعة، التجديد المخصص وسياسات الحضور' },
  { key: 'groups.archive', labelAr: 'أرشفة المجموعة التدريبية', category: 'groups', descriptionAr: 'إنهاء الدفعة ونقلها إلى سجل الأرشيف' },
  { key: 'groups.manage_members', labelAr: 'إدارة متدربي المجموعة', category: 'groups', descriptionAr: 'إضافة أو استبعاد المتدربين من الدفعة' },
  { key: 'groups.generate_qr', labelAr: 'توليد وإدارة رموز QR للمجموعات', category: 'groups', descriptionAr: 'إنشاء باركود الانضمام السريع لجلسات التدريب' },
  { key: 'groups.review_join_requests', labelAr: 'مراجعة طلبات الانضمام للمجموعة', category: 'groups', descriptionAr: 'قبول أو رفض طلبات المتدربين للانضمام للدفعة' },
  { key: 'materials.manage_folders', labelAr: 'إدارة مجلدات الحقيبة التدريبية', category: 'groups', descriptionAr: 'إنشاء وتنظيم مجلدات المواد التعليمية' },
  { key: 'materials.upload_files', labelAr: 'رفع ملفات ومرفقات المجموعة', category: 'groups', descriptionAr: 'تحميل المذكرات والملفات الفنية للمتدربين' },
  { key: 'materials.delete_files', labelAr: 'حذف ملفات ومرفقات المجموعة', category: 'groups', descriptionAr: 'إزالة الملفات من الحقيبة التدريبية' },
  { key: 'materials.manage_meetings', labelAr: 'جدولة اجتماعات تدريبية تفاعلية', category: 'groups', descriptionAr: 'إنشاء روابط ورش العمل الافتراضية واللقاءات الحية' },

  // 3. Courses
  { key: 'courses.create', labelAr: 'إنشاء دورة تدريبية جديدة', category: 'courses', descriptionAr: 'إضافة مقرر تدريبي جديد في النظام' },
  { key: 'courses.edit_metadata', labelAr: 'تعديل البيانات العامة للدورة', category: 'courses', descriptionAr: 'تحديث العنوان والوصف والمسارات والأهداف' },
  { key: 'courses.edit_curriculum', labelAr: 'تعديل الفصول وهيكل المحتوى', category: 'courses', descriptionAr: 'ترتيب الوحدات التدريبية وإضافة الدروس' },
  { key: 'courses.upload_lectures', labelAr: 'رفع محتوى المحاضرات والفيديوهات', category: 'courses', descriptionAr: 'تحميل ملفات الفيديو والاختبارات القصيرة' },
  { key: 'courses.delete_lectures', labelAr: 'حذف دروس أو اختبارات من الكورس', category: 'courses', descriptionAr: 'حذف عناصر تعليمية من هيكل المقرر' },
  { key: 'courses.publish', labelAr: 'نشر المقرر التدريبي', category: 'courses', descriptionAr: 'تنفيذ نشر المقرر في الدليل العام للمنصة' },
  { key: 'reviews.submit_course', labelAr: 'تقديم كورس للاعتماد والتدقيق', category: 'courses', descriptionAr: 'إرسال المقرر بعد اكتماله إلى لجنة مراجعة الجودة' },
  { key: 'reviews.decide_course', labelAr: 'مراجعة واعتماد نشر الكورسات', category: 'courses', descriptionAr: 'الموافقة على نشر الكورس في الدليل العام أو رفضه', isSovereign: true },

  // 4. Learning
  { key: 'learning.access_assigned', labelAr: 'دراسة الكورسات المسجلة ومتابعة التقدم', category: 'learning', descriptionAr: 'تشغيل مشغل التعلم التفاعلي وإنجاز الدروس' },
  { key: 'learning.self_enroll', labelAr: 'التسجيل الذاتي في الكورسات المفتوحة', category: 'learning', descriptionAr: 'الالتحاق المباشر بالكورسات العامة المتاحة' },

  // 5. Governance
  { key: 'permissions.view_matrix', labelAr: 'استعراض مصفوفة الصلاحيات وسجل النشاط', category: 'governance', descriptionAr: 'الاطلاع على توزيع الصلاحيات بين الأدوار' },
  { key: 'permissions.configure_roles', labelAr: 'تعديل صلاحيات الأدوار الافتراضية', category: 'governance', descriptionAr: 'تعديل مصفوفة الصلاحيات الأساسية للمنظومة', isSovereign: true },
  { key: 'permissions.configure_users', labelAr: 'منح استثناءات وصلاحيات فردية لمستخدم', category: 'governance', descriptionAr: 'تخصيص صلاحيات إضافية أو حجب صلاحيات لمستخدم محدد', isSovereign: true },
  { key: 'permissions.manage_delegation', labelAr: 'منح أو إلغاء التفويض الإداري المباشر', category: 'governance', descriptionAr: 'تفعيل أو تعطيل التفويض التشغيلي المباشر للمساعدين', isSovereign: true },
  { key: 'permissions.configure_departments', labelAr: 'ضبط مسارات تدريب الإدارات', category: 'governance', descriptionAr: 'تحديد الكورسات الإلزامية والاختيارية لكل قطاع' },
  { key: 'audit.view_system_logs', labelAr: 'استعراض وتصفية سجل رقابة النظام', category: 'governance', descriptionAr: 'الوصول إلى سجل الرقابة والامتثال الأمني', isSovereign: true },
  { key: 'approvals.submit_request', labelAr: 'تقديم طلب اعتماد إداري معلق', category: 'governance', descriptionAr: 'إرسال طلب عملية تتطلب موافقة ثنائية' },
  { key: 'approvals.decide_request', labelAr: 'قبول أو رفض طلبات الاعتماد المعلقة', category: 'governance', descriptionAr: 'اعتماد أو رفض طلبات العمليات المعلقة', isSovereign: true },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  developer: PERMISSION_DEFINITIONS.map((p) => p.key),
  super_admin: PERMISSION_DEFINITIONS.map((p) => p.key),
  admin: PERMISSION_DEFINITIONS.map((p) => p.key),
  assistant_admin: [
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
  ],
  lecturer: [
    'groups.manage_members',
    'groups.generate_qr',
    'groups.review_join_requests',
    'materials.manage_folders',
    'materials.upload_files',
    'materials.delete_files',
    'materials.manage_meetings',
    'reviews.submit_course',
    'learning.access_assigned',
  ],
  user: [
    'learning.access_assigned',
    'learning.self_enroll',
  ],
};
