import { http, HttpResponse } from 'msw';
import { inMemoryStore, MockStoreError } from '../store/inMemoryStore';
import { resolveAuthenticatedUser } from './resolveUser';
import { resolveCanonicalDepartment } from '../fixtures/departmentTracksFixtures';
import { resolveCanonicalUserId } from '@/core/auth/canonicalIdentity';
import type {
  UserRole,
  PermissionKey,
  SystemCapability,
  UserPermissionOverride,
  ApprovalActionType,
  AuditEventOutcome,
  AuditEventSeverity,
  AuditFilterParams,
} from '@/core/permissions/types';
import type {
  WhatsAppSupportScenario,
  SaveUserWhatsAppVisibilityPayload,
} from '@/features/whatsapp/types';

/**
 * Centrally Managed MSW Handlers for Permissions Matrix & Governance (Increment 11 Phase 4)
 */
export const permissionsHandlers = [

  // GET /api/admin/permissions/roles - All role baseline permissions
  http.get('/api/admin/permissions/roles', async ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const hasAccess =
      user.role === 'developer' ||
      user.role === 'super_admin' ||
      user.role === 'admin' ||
      inMemoryStore.hasPermission(user, 'permissions.view_matrix').granted;
    if (!hasAccess) {
      return HttpResponse.json(
        { message: 'غير مصرح: هذه العملية تتطلب صلاحية عرض جدول الصلاحيات' },
        { status: 403 }
      );
    }

    const configs = inMemoryStore.getAllRolePermissions();
    return HttpResponse.json(configs, { status: 200 });
  }),

  // PUT /api/admin/permissions/roles/:role - Update baseline permissions for a role
  http.put('/api/admin/permissions/roles/:role', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    // Operational administrators (developer, super_admin, admin) can configure role defaults.
    // Assistant administrator cannot modify role defaults even under delegation.
    if (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'developer') {
      return HttpResponse.json(
        { message: 'غير مصرح: تعديل الصلاحيات الافتراضية للأدوار مخصص لمدير النظام فقط' },
        { status: 403 }
      );
    }

    const role = params.role as UserRole;
    try {
      const body = (await request.json()) as {
        permissions?: PermissionKey[];
        capabilities?: Partial<Record<SystemCapability, boolean>>;
      };
      const perms = body.permissions || body.capabilities || [];
      const updated = inMemoryStore.updateRolePermissions(role, perms, { id: user.id, role: user.role });
      return HttpResponse.json(updated, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة طلب تحديث صلاحيات الدور' },
        { status: 400 }
      );
    }
  }),

  // GET /api/admin/permissions/users/:userId - Get individual user permission override
  http.get('/api/admin/permissions/users/:userId', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const userId = params.userId as string;
    const targetUser = inMemoryStore.getManagedUserById(userId, user.role);
    if (!targetUser) {
      return HttpResponse.json(
        { message: 'المستخدم المطلوب غير موجود في دليل النظام' },
        { status: 404 }
      );
    }

    const hasAccess =
      user.role === 'developer' ||
      user.role === 'super_admin' ||
      user.role === 'admin' ||
      inMemoryStore.hasPermission(user, 'permissions.view_matrix').granted;
    if (!hasAccess) {
      return HttpResponse.json(
        { message: 'غير مصرح: هذه العملية تتطلب صلاحية عرض الصلاحيات' },
        { status: 403 }
      );
    }

    const override = inMemoryStore.getUserPermissionOverride(userId, user.role);
    return HttpResponse.json({ override }, { status: 200 });
  }),

  // PUT /api/admin/permissions/users/:userId - Set individual user permission override
  http.put('/api/admin/permissions/users/:userId', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const userId = params.userId as string;
    const targetUser = inMemoryStore.getManagedUserById(userId, user.role);
    if (!targetUser) {
      return HttpResponse.json(
        { message: 'المستخدم المطلوب غير موجود في دليل النظام' },
        { status: 404 }
      );
    }

    const hasAccess =
      user.role === 'developer' ||
      user.role === 'super_admin' ||
      user.role === 'admin' ||
      inMemoryStore.hasPermission(user, 'permissions.configure_users').granted;
    if (!hasAccess) {
      return HttpResponse.json(
        { message: 'غير مصرح: هذه العملية تتطلب صلاحية إدارة الصلاحيات' },
        { status: 403 }
      );
    }

    try {
      const body = (await request.json()) as Omit<UserPermissionOverride, 'updatedAt'>;
      const updated = inMemoryStore.setUserPermissionOverride({
        ...body,
        userId,
        updatedBy: user.id,
      });
      return HttpResponse.json(updated, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message, code: err.code }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة طلب تخصيص صلاحيات المستخدم' },
        { status: 400 }
      );
    }
  }),

  // DELETE /api/admin/permissions/users/:userId - Remove individual user override
  http.delete('/api/admin/permissions/users/:userId', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const userId = params.userId as string;
    const targetUser = inMemoryStore.getManagedUserById(userId, user.role);
    if (!targetUser) {
      return HttpResponse.json(
        { message: 'المستخدم المطلوب غير موجود في دليل النظام' },
        { status: 404 }
      );
    }

    const hasAccess =
      user.role === 'developer' ||
      user.role === 'super_admin' ||
      user.role === 'admin' ||
      inMemoryStore.hasPermission(user, 'permissions.configure_users').granted;
    if (!hasAccess) {
      return HttpResponse.json(
        { message: 'غير مصرح: هذه العملية تتطلب صلاحية إدارة الصلاحيات' },
        { status: 403 }
      );
    }

    try {
      inMemoryStore.deleteUserPermissionOverride(userId, user);
      return HttpResponse.json({ success: true, message: 'تم حذف التخصيص بنجاح' }, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message, code: err.code }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة حذف التخصيص' },
        { status: 400 }
      );
    }
  }),

  // ── Increment 11 Phase 2: WhatsApp Contact Routing & Visibility Endpoints ──

  // GET /api/admin/users/:userId/whatsapp-visibility - Read user WhatsApp scenario assignments
  http.get('/api/admin/users/:userId/whatsapp-visibility', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const hasAccess =
      user.role === 'developer' ||
      user.role === 'super_admin' ||
      user.role === 'admin' ||
      inMemoryStore.hasPermission(user, 'permissions.view_matrix').granted;

    if (!hasAccess) {
      return HttpResponse.json(
        { message: 'غير مصرح: هذه العملية تتطلب صلاحية استعراض إعدادات المستخدمين' },
        { status: 403 }
      );
    }

    const userId = params.userId as string;
    try {
      const config = inMemoryStore.getUserWhatsAppVisibility(userId, user.role);
      return HttpResponse.json(config, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'تعذر استرجاع إعدادات مسؤوليات واتساب للمستخدم' },
        { status: 400 }
      );
    }
  }),

  // PUT /api/admin/users/:userId/whatsapp-visibility - Update user WhatsApp scenario assignments
  http.put('/api/admin/users/:userId/whatsapp-visibility', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const hasAccess =
      user.role === 'developer' ||
      user.role === 'super_admin' ||
      user.role === 'admin' ||
      inMemoryStore.hasPermission(user, 'permissions.configure_users').granted;

    if (!hasAccess) {
      return HttpResponse.json(
        { message: 'غير مصرح: هذه العملية تتطلب صلاحية إدارة مسؤوليات المستخدمين' },
        { status: 403 }
      );
    }

    const userId = params.userId as string;
    try {
      const body = (await request.json()) as SaveUserWhatsAppVisibilityPayload;
      const updated = inMemoryStore.setUserWhatsAppVisibility(userId, body.assignments, user.id, user.role);
      return HttpResponse.json(updated, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة طلب تحديث مسؤوليات واتساب للمستخدم' },
        { status: 400 }
      );
    }
  }),

  // GET /api/public/support-contacts - Public Contact Resolver
  http.get('/api/public/support-contacts', async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get('scenario') as WhatsAppSupportScenario;

    const allowedScenarios: WhatsAppSupportScenario[] = [
      'account_registration',
      'password_recovery',
      'technical_support',
    ];

    if (!scenario || !allowedScenarios.includes(scenario)) {
      return HttpResponse.json(
        { message: 'سيناريو الدعم المطلوب غير صالح' },
        { status: 400 }
      );
    }

    try {
      const contacts = inMemoryStore.resolvePublicSupportContacts(scenario);
      return HttpResponse.json(
        {
          scenario,
          count: contacts.length,
          contacts,
        },
        { status: 200 }
      );
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'تعذر استرجاع جهات الدعم الفني للمنصة' },
        { status: 500 }
      );
    }
  }),

  // GET /api/admin/permissions/effective/:userId - Get computed effective permissions for a user
  http.get('/api/admin/permissions/effective/:userId', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const userId = params.userId as string;
    const targetUser = inMemoryStore.getManagedUserById(userId, user.role);
    if (!targetUser) {
      return HttpResponse.json(
        { message: 'المستخدم المطلوب غير موجود في دليل النظام' },
        { status: 404 }
      );
    }

    const isSelf = user.id.toLowerCase() === userId.toLowerCase();
    const hasAccess =
      isSelf ||
      user.role === 'developer' ||
      user.role === 'super_admin' ||
      user.role === 'admin' ||
      inMemoryStore.hasPermission(user, 'permissions.view_matrix').granted;

    if (!hasAccess) {
      return HttpResponse.json(
        { message: 'غير مصرح: لا تملك صلاحية استعلام الصلاحيات الفعالة لهذا المستخدم' },
        { status: 403 }
      );
    }

    const effective = inMemoryStore.getEffectiveUserPermissions(userId, user.role);
    return HttpResponse.json(effective, { status: 200 });
  }),

  // GET /api/admin/permissions/governance/delegation/:userId
  http.get('/api/admin/permissions/governance/delegation/:userId', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const userId = params.userId as string;
    const targetUser = inMemoryStore.getManagedUserById(userId, user.role);
    if (!targetUser) {
      return HttpResponse.json(
        { message: 'المستخدم المطلوب غير موجود في دليل النظام' },
        { status: 404 }
      );
    }

    const enabled = inMemoryStore.getDelegatedAuthority(userId);
    return HttpResponse.json({ userId, enabled }, { status: 200 });
  }),

  // POST /api/admin/permissions/governance/delegation/:userId
  http.post('/api/admin/permissions/governance/delegation/:userId', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'developer') {
      return HttpResponse.json(
        { message: 'غير مصرح: تفويض الصلاحيات التشغيلية مخصص لمدير النظام فقط' },
        { status: 403 }
      );
    }

    const userId = params.userId as string;
    const targetUser = inMemoryStore.getManagedUserById(userId, user.role);
    if (!targetUser) {
      return HttpResponse.json(
        { message: 'المستخدم المطلوب غير موجود في دليل النظام' },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      enabled?: boolean;
      active?: boolean;
      capabilities?: string[];
      expiresAt?: string | number | null;
      resourceScope?: {
        groupId?: string;
        department?: string;
        resourceType?: string;
      };
    };

    const isEnabled = body.enabled !== undefined ? !!body.enabled : (body.active !== undefined ? !!body.active : true);

    try {
      const grantPayload = body.capabilities !== undefined
        ? {
            active: isEnabled,
            capabilities: body.capabilities as SystemCapability[],
            expiresAt: body.expiresAt,
            resourceScope: body.resourceScope,
          }
        : isEnabled;

      inMemoryStore.setDelegatedAuthority(userId, grantPayload, user);
      return HttpResponse.json({ userId, enabled: isEnabled }, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message, code: err.code }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة طلب التفويض التشغيلي' },
        { status: 400 }
      );
    }
  }),

  // GET /api/admin/permissions/governance/approvals - List governance approval requests
  http.get('/api/admin/permissions/governance/approvals', async ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const hasAccess =
      user.role === 'developer' ||
      user.role === 'super_admin' ||
      user.role === 'admin' ||
      inMemoryStore.hasPermission(user, 'permissions.view_matrix').granted;
    if (!hasAccess) {
      return HttpResponse.json(
        { message: 'غير مصرح: لا تملك صلاحية عرض طلبات الاعتماد' },
        { status: 403 }
      );
    }

    const requests = inMemoryStore.getApprovalRequests(user.role);
    return HttpResponse.json(requests, { status: 200 });
  }),

  // POST /api/admin/permissions/governance/approvals - Submit approval request
  http.post('/api/admin/permissions/governance/approvals', async ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    try {
      const body = (await request.json()) as {
        actionType: string;
        targetId?: string;
        payload: Record<string, unknown>;
        justification: string;
      };

      const newReq = inMemoryStore.createApprovalRequest({
        actionType: body.actionType as ApprovalActionType,
        targetId: body.targetId,
        requestedBy: user.id,
        payload: body.payload,
        justification: body.justification || '',
      });

      return HttpResponse.json(newReq, { status: 201 });
    } catch {
      return HttpResponse.json(
        { message: 'فشلت معالجة طلب تقديم طلب الاعتماد' },
        { status: 400 }
      );
    }
  }),

  // POST /api/admin/permissions/governance/approvals/:id/approve
  http.post('/api/admin/permissions/governance/approvals/:id/approve', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin') {
      return HttpResponse.json(
        { message: 'غير مصرح: اعتماد العمليات الحساسة مخصص لمديري النظام فقط' },
        { status: 403 }
      );
    }

    const id = params.id as string;
    try {
      const body = (await request.json().catch(() => ({}))) as { notes?: string };
      const approved = inMemoryStore.approveApprovalRequest(id, user.id, body.notes);
      return HttpResponse.json(approved, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة اعتماد الطلب' },
        { status: 400 }
      );
    }
  }),

  // POST /api/admin/permissions/governance/approvals/:id/reject
  http.post('/api/admin/permissions/governance/approvals/:id/reject', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin') {
      return HttpResponse.json(
        { message: 'غير مصرح: رفض طلبات الاعتماد مخصص لمديري النظام فقط' },
        { status: 403 }
      );
    }

    const id = params.id as string;
    try {
      const body = (await request.json().catch(() => ({}))) as { notes?: string };
      const rejected = inMemoryStore.rejectApprovalRequest(id, user.id, body.notes);
      return HttpResponse.json(rejected, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة رفض الطلب' },
        { status: 400 }
      );
    }
  }),

  // ── Increment 3.2 (MFR-03): Secure Group-Assistant Endpoints ──

  // POST /api/groups/:groupId/assistants - Assign group assistant lecturer
  http.post('/api/groups/:groupId/assistants', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json({ message: 'غير مصرح: يرجى تسجيل الدخول أولاً' }, { status: 401 });
    }

    const groupId = params.groupId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json({ message: 'المجموعة التدريبية المطلوبة غير موجودة' }, { status: 404 });
    }

    // Operational administrators and group primary instructors are permitted to assign assistant lecturers.
    // Assistant Admin cannot mutate without explicit delegation; trainees and unassigned lecturers are denied.
    const isOperationalAdmin =
      user.role === 'developer' ||
      user.role === 'super_admin' ||
      user.role === 'admin';

    const isAuthorizedInstructor =
      user.role === 'lecturer' &&
      inMemoryStore.isUserGroupPrimaryInstructor(group, user.id);

    if (!isOperationalAdmin && !isAuthorizedInstructor) {
      return HttpResponse.json(
        { message: 'غير مصرح: إدارة المحاضرين المساعدين مقتصرة على مدير النظام أو المحاضر الأساسي للمجموعة فقط' },
        { status: 403 }
      );
    }

    try {
      const body = (await request.json()) as { assistantLecturerId: string };
      if (!body || !body.assistantLecturerId) {
        return HttpResponse.json({ message: 'معرف المحاضر المساعد مطلوب' }, { status: 400 });
      }

      // Group-Scoped Role Integrity: Candidate must be registered with canonical role 'lecturer'
      const candidate = inMemoryStore.getManagedUserById(body.assistantLecturerId, user.role);
      if (!candidate || candidate.role !== 'lecturer') {
        return HttpResponse.json(
          { message: 'المحاضر المساعد يجب أن يكون مستخدماً مسجلاً بدور محاضر معتمد' },
          { status: 400 }
        );
      }

      const assignment = inMemoryStore.assignGroupAssistant(groupId, body.assistantLecturerId, user.id);
      return HttpResponse.json(assignment, { status: 201 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json({ message: 'فشل تعيين المحاضر المساعد' }, { status: 400 });
    }
  }),

  // DELETE /api/groups/:groupId/assistants/:assistantId - Revoke group assistant lecturer
  http.delete('/api/groups/:groupId/assistants/:assistantId', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json({ message: 'غير مصرح: يرجى تسجيل الدخول أولاً' }, { status: 401 });
    }

    const groupId = params.groupId as string;
    const assistantId = params.assistantId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json({ message: 'المجموعة التدريبية المطلوبة غير موجودة' }, { status: 404 });
    }

    const isOperationalAdmin =
      user.role === 'developer' ||
      user.role === 'super_admin' ||
      user.role === 'admin';

    const isAuthorizedInstructor =
      user.role === 'lecturer' &&
      inMemoryStore.isUserGroupPrimaryInstructor(group, user.id);

    if (!isOperationalAdmin && !isAuthorizedInstructor) {
      return HttpResponse.json(
        { message: 'غير مصرح: إلغاء تعيين المحاضر المساعد مقتصر على مدير النظام أو المحاضر الأساسي للمجموعة فقط' },
        { status: 403 }
      );
    }

    const success = inMemoryStore.revokeGroupAssistant(groupId, assistantId);
    if (!success) {
      return HttpResponse.json({ message: 'التعيين غير موجود' }, { status: 404 });
    }
    return HttpResponse.json({ success: true }, { status: 200 });
  }),

  // GET /api/groups/:groupId/assistants - List group assistant lecturers
  http.get('/api/groups/:groupId/assistants', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json({ message: 'غير مصرح: يرجى تسجيل الدخول أولاً' }, { status: 401 });
    }

    const groupId = params.groupId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json({ message: 'المجموعة التدريبية المطلوبة غير موجودة' }, { status: 404 });
    }

    // Administrative read audience (Rule A / MFR-06 / D-14)
    const isAdministrativeReader =
      user.role === 'developer' ||
      user.role === 'super_admin' ||
      user.role === 'admin' ||
      user.role === 'assistant_admin';

    // Group-scoped instructors/supervisors
    const isAssignedSupervisor =
      user.role === 'lecturer' &&
      inMemoryStore.isUserAssignedGroupSupervisor(group, user.id);

    // Enrolled group trainees
    const isEnrolledTrainee =
      user.role === 'user' &&
      (group.traineeIds || []).some(
        (tid) =>
          tid.toLowerCase() === user.id.toLowerCase() ||
          resolveCanonicalUserId(tid).toLowerCase() === resolveCanonicalUserId(user.id).toLowerCase()
      );

    if (!isAdministrativeReader && !isAssignedSupervisor && !isEnrolledTrainee) {
      return HttpResponse.json(
        { message: 'غير مصرح: ليس لديك صلاحية استعراض المحاضرين المساعدين لهذه المجموعة' },
        { status: 403 }
      );
    }

    const assistants = inMemoryStore.getGroupAssistants(groupId, user.role);
    return HttpResponse.json(assistants, { status: 200 });
  }),

  // ── Increment 11 Phase 4D: System Security Audit Trail Endpoints ────

  // GET /api/admin/audit - Query System Security Audit Trail
  http.get('/api/admin/audit', async ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    // Administrative Audit Access Policy (D-14 & Rule A):
    // Authorized administrative roles (developer, super_admin, admin, assistant_admin)
    // may view the security audit trail in read-only mode.
    // Lecturers and trainees are strictly denied (HTTP 403).
    const hasAuditAccess =
      user.role === 'developer' ||
      user.role === 'super_admin' ||
      user.role === 'admin' ||
      user.role === 'assistant_admin';

    if (!hasAuditAccess) {
      // Record denied access attempt to audit trail
      inMemoryStore.recordAuditLog({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'audit.view_system_logs',
        actionLabelAr: 'استعراض سجل الرقابة الأمنية',
        severity: 'critical',
        outcome: 'denied',
        details: 'محاولة غير مصرح بها لاستعراض سجل الرقابة والأمان للمنظومة حُظرت بموجب سياسة الرقابة الإدارية',
        metadata: { attemptedRole: user.role },
      });

      return HttpResponse.json(
        { message: 'غير مصرح: استعراض سجل الرقابة والأمان مخصص للإدارة فقط بموجب سياسة الرقابة الإدارية' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const search = url.searchParams.get('search') || undefined;
    const action = url.searchParams.get('action') || undefined;
    const outcome = (url.searchParams.get('outcome') as AuditEventOutcome | 'all') || undefined;
    const severity = (url.searchParams.get('severity') as AuditEventSeverity | 'all') || undefined;
    const actorId = url.searchParams.get('actorId') || undefined;
    const startDate = url.searchParams.get('startDate') || undefined;
    const endDate = url.searchParams.get('endDate') || undefined;
    const pageParam = url.searchParams.get('page');
    const pageSizeParam = url.searchParams.get('pageSize');

    const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
    const pageSize = pageSizeParam ? Math.min(100, Math.max(1, parseInt(pageSizeParam, 10) || 15)) : 15;

    const filterParams: AuditFilterParams = {
      search,
      action,
      outcome,
      severity,
      actorId,
      startDate,
      endDate,
      page,
      pageSize,
    };

    const responseDto = inMemoryStore.getSystemAuditLogs(filterParams, user.role);
    return HttpResponse.json(responseDto, { status: 200 });
  }),

  // GET /api/admin/audit/:id - Get single audit log entry by ID
  http.get('/api/admin/audit/:id', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const hasAuditAccess =
      user.role === 'developer' ||
      user.role === 'super_admin' ||
      user.role === 'admin' ||
      user.role === 'assistant_admin';

    if (!hasAuditAccess) {
      return HttpResponse.json(
        { message: 'غير مصرح: استعراض سجل الرقابة والأمان مخصص للإدارة فقط بموجب سياسة الرقابة الإدارية' },
        { status: 403 }
      );
    }

    const id = params.id as string;
    const entry = inMemoryStore.getSystemAuditLogById(id, user.role);
    if (!entry) {
      return HttpResponse.json(
        { message: 'سجل التدقيق المطلوب غير موجود' },
        { status: 404 }
      );
    }

    return HttpResponse.json(entry, { status: 200 });
  }),

  // ── Increment 11 Phase 4E: Department Course-Track Configuration ────

  // GET /api/admin/department-tracks - Get all department track mappings & canonical catalogs
  http.get('/api/admin/department-tracks', async ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin' && user.role !== 'assistant_admin') {
      return HttpResponse.json(
        { message: 'غير مصرح: استعراض إعدادات مسارات الإدارات مخصص لمديري النظام فقط' },
        { status: 403 }
      );
    }

    return HttpResponse.json(
      {
        departments: inMemoryStore.getAllDepartmentTracks(user.role),
        canonicalDepartments: inMemoryStore.getCanonicalDepartments(),
        tracks: inMemoryStore.getCanonicalTracks(),
      },
      { status: 200 }
    );
  }),

  // GET /api/admin/department-tracks/:departmentId - Get single department track config
  http.get('/api/admin/department-tracks/:departmentId', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin' && user.role !== 'assistant_admin') {
      return HttpResponse.json(
        { message: 'غير مصرح: استعراض إعدادات مسارات الإدارات مخصص لمديري النظام فقط' },
        { status: 403 }
      );
    }

    const deptId = params.departmentId as string;
    const config = inMemoryStore.getDepartmentTracksById(deptId, user.role);
    if (!config) {
      return HttpResponse.json(
        { message: `الإدارة المطلوبة (${deptId}) غير موجودة في السجل القياسي` },
        { status: 404 }
      );
    }

    return HttpResponse.json(
      {
        department: config,
        tracks: inMemoryStore.getCanonicalTracks(),
      },
      { status: 200 }
    );
  }),

  // PUT /api/admin/department-tracks/:departmentId - Update department allowed tracks
  http.put('/api/admin/department-tracks/:departmentId', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    if (user.role === 'lecturer' || user.role === 'user') {
      return HttpResponse.json(
        { message: 'غير مصرح: تعديل مسارات الإدارات محظور لهذه الرتبة' },
        { status: 403 }
      );
    }

    const deptId = params.departmentId as string;
    const canonicalDept = resolveCanonicalDepartment(deptId);
    if (!canonicalDept) {
      return HttpResponse.json(
        { message: `تعذر التحديث: الإدارة المحددة (${deptId}) غير موجودة في السجل القياسي للمنظومة` },
        { status: 404 }
      );
    }

    let body: { allowedTracks?: string[]; justification?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return HttpResponse.json(
        { message: 'صيغة البيانات المرسلة غير صالحة' },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.allowedTracks)) {
      return HttpResponse.json(
        { message: 'حقل المسارات التدريبية المسموحة مطلوب ويجب أن يكون مصفوفة' },
        { status: 400 }
      );
    }

    // Evaluate permission using central evaluator
    const evalResult = inMemoryStore.hasPermission(user, 'permissions.configure_departments');

    if (!evalResult.granted) {
      return HttpResponse.json(
        { message: evalResult.reasonAr || 'غير مصرح لك بإجراء تعديل على مسارات الإدارات' },
        { status: 403 }
      );
    }

    // If requires approval (assistant admin without active delegation)
    if (evalResult.executionMode === 'requires_approval') {
      try {
        const approvalReq = inMemoryStore.createApprovalRequest({
          actionType: 'permissions.configure_departments',
          titleAr: `طلب تعديل مسارات التدريب لإدارة (${canonicalDept.nameAr})`,
          requestedBy: user.id,
          requesterId: user.id,
          requesterName: user.name,
          targetResourceId: canonicalDept.id,
          targetResourceName: canonicalDept.nameAr,
          justification: body.justification || 'تعديل مسارات تدريبية مقترح من مساعد مدير النظام',
          payload: {
            departmentId: canonicalDept.id,
            allowedTracks: body.allowedTracks,
          },
        });

        const currentConfig = inMemoryStore.getDepartmentTracksById(canonicalDept.id, user.role);

        return HttpResponse.json(
          {
            success: true,
            requiresApproval: true,
            approvalRequestId: approvalReq.id,
            messageAr: 'تم إرسال طلب تعديل مسارات التدريب إلى مدير النظام للاعتماد نظراً لأن هذا الإجراء يخضع للموافقة المسبقة',
            department: currentConfig,
          },
          { status: 202 }
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'تعذر إنشاء طلب الاعتماد';
        const status = err instanceof MockStoreError ? err.status : 400;
        return HttpResponse.json({ message }, { status });
      }
    }

    // Direct execution (admin or delegated assistant_admin)
    try {
      const updated = inMemoryStore.updateDepartmentTracks(
        canonicalDept.id,
        body.allowedTracks,
        user
      );
      const isDelegated = user.role === 'assistant_admin';
      return HttpResponse.json(
        {
          success: true,
          messageAr: isDelegated
            ? `تم تحديث مسارات التدريب لإدارة (${canonicalDept.nameAr}) بنجاح بموجب التفويض العملياتي المباشر`
            : `تم تحديث مسارات التدريب لإدارة (${canonicalDept.nameAr}) بنجاح`,
          department: updated,
        },
        { status: 200 }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'تعذر تحديث مسارات الإدارة';
      const status = err instanceof MockStoreError ? err.status : 400;
      return HttpResponse.json({ message }, { status });
    }
  }),
];
