import { http, HttpResponse } from 'msw';
import { inMemoryStore, MockStoreError } from '../store/inMemoryStore';
import { resolveAuthenticatedUser } from './resolveUser';
import type {
  UserRole,
  UserStatus,
  CreateUserRequestDTO,
  UpdateUserRoleDTO,
  UpdateUserStatusDTO,
} from '@/core/user-management/types';

/**
 * Centrally Managed MSW Handlers for User Directory Management
 *
 * Implemented in Phase 1 & 2:
 * - GET /api/admin/users: Administrator-only query for directory users.
 * - POST /api/admin/users: Administrator-only creation of directory users.
 * - PATCH /api/admin/users/:id/role: Administrator-only role mutation.
 * - PATCH /api/admin/users/:id/status: Administrator-only account status mutation.
 */
export const userManagementHandlers = [
  // GET /api/admin/users
  http.get('/api/admin/users', async ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const hasAccess = user.role === 'admin' || inMemoryStore.hasUserPermission(user.id, 'users.view');
    if (!hasAccess) {
      return HttpResponse.json(
        { message: 'غير مصرح: هذه العملية مخصصة لمديري النظام فقط أو من يمتلك صلاحية عرض المستخدمين' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const query = url.searchParams.get('query') || undefined;
    const role = (url.searchParams.get('role') as UserRole) || undefined;
    const status = (url.searchParams.get('status') as UserStatus) || undefined;
    const department = url.searchParams.get('department') || undefined;

    const users = inMemoryStore.getManagedUsers({
      query,
      role,
      status,
      department,
    });

    return HttpResponse.json(users, { status: 200 });
  }),

  // POST /api/admin/users
  http.post('/api/admin/users', async ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const check = inMemoryStore.hasPermission(user, 'users.create');
    if (!check.granted || check.executionMode === 'denied') {
      return HttpResponse.json(
        { message: check.reasonAr || 'غير مصرح: هذه العملية مخصصة لمديري النظام فقط أو من يمتلك صلاحية إنشاء المستخدمين' },
        { status: 403 }
      );
    }

    try {
      const body = (await request.json()) as CreateUserRequestDTO;

      // Re-evaluate permission with explicit target role context
      const roleCheck = inMemoryStore.hasPermission(user, 'users.create', {
        targetRole: body.role,
        targetUser: { id: '', role: body.role },
      });
      if (!roleCheck.granted || roleCheck.executionMode === 'denied') {
        return HttpResponse.json(
          { message: roleCheck.reasonAr || 'غير مصرح: لا يمكن لمساعد مدير النظام إنشاء حساب برتبة مدير نظام' },
          { status: 403 }
        );
      }

      // Uniqueness validation
      const trimmedUsername = (body.username || '').trim().toLowerCase();
      const trimmedEmail = (body.email || '').trim().toLowerCase();
      const existingUsers = inMemoryStore.getManagedUsers();
      if (existingUsers.some((u) => u.username.toLowerCase() === trimmedUsername || u.id.toLowerCase() === trimmedUsername)) {
        return HttpResponse.json({ message: 'اسم المستخدم مسجل مسبقاً لمستخدم آخر' }, { status: 409 });
      }
      if (existingUsers.some((u) => u.email.toLowerCase() === trimmedEmail)) {
        return HttpResponse.json({ message: 'البريد الإلكتروني مسجل مسبقاً لمستخدم آخر' }, { status: 409 });
      }

      if (roleCheck.executionMode === 'requires_approval') {
        const approvalReq = inMemoryStore.createApprovalRequest({
          actionType: 'users.create',
          titleAr: `طلب إنشاء حساب جديد للمستخدم: "${body.name}"`,
          requestedBy: user.id,
          requesterId: user.id,
          requesterName: user.name,
          requesterRole: user.role,
          justification: 'طلب إنشاء حساب مستخدم جديد عبر إدارة المستخدمين',
          payload: body,
        });

        return HttpResponse.json(
          {
            id: 'REQ_PENDING',
            name: body.name,
            username: body.username,
            email: body.email,
            role: body.role,
            status: body.status || 'active',
            department: body.department,
            jobTitle: body.jobTitle,
            createdAt: new Date().toISOString(),
            approvalRequired: true,
            requestId: approvalReq.id,
            message: 'تم إرسال طلب إنشاء الحساب للاعتماد بنجاح؛ بانتظار موافقة مدير النظام.',
            request: approvalReq,
          },
          { status: 202 }
        );
      }

      const createdUser = inMemoryStore.createUser(body, { id: user.id, role: user.role });
      return HttpResponse.json(createdUser, { status: 201 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة طلب إنشاء المستخدم' },
        { status: 400 }
      );
    }
  }),

  // PATCH /api/admin/users/:id/role
  http.patch('/api/admin/users/:id/role', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const userId = params.id as string;
    const targetUser = inMemoryStore.getManagedUserById(userId);
    if (!targetUser) {
      return HttpResponse.json(
        { message: 'المستخدم المطلوب غير موجود في دليل النظام' },
        { status: 404 }
      );
    }

    try {
      const body = (await request.json()) as UpdateUserRoleDTO;
      const check = inMemoryStore.hasPermission(user, 'users.change_role', {
        targetUser,
        targetRole: body.role,
      });

      if (!check.granted || check.executionMode === 'denied') {
        return HttpResponse.json(
          { message: check.reasonAr || 'غير مصرح: هذه العملية تتطلب صلاحية تعديل الأدوار الوظيفية' },
          { status: 403 }
        );
      }

      if (check.executionMode === 'requires_approval') {
        const approvalReq = inMemoryStore.createApprovalRequest({
          actionType: 'users.change_role',
          titleAr: `طلب تعديل رتبة المستخدم "${targetUser.name}" إلى ${body.role}`,
          targetId: targetUser.id,
          targetResourceId: targetUser.id,
          targetResourceName: targetUser.name,
          requestedBy: user.id,
          requesterId: user.id,
          requesterName: user.name,
          requesterRole: user.role,
          justification: 'طلب تعديل الدور الوظيفي للمستخدم عبر إدارة المستخدمين',
          payload: {
            userId: targetUser.id,
            role: body.role,
            previousRole: targetUser.role,
          },
        });

        return HttpResponse.json(
          {
            ...targetUser,
            role: targetUser.role, // Unchanged!
            approvalRequired: true,
            requestId: approvalReq.id,
            message: 'تم إرسال طلب تعديل الدور للاعتماد بنجاح؛ العملية بانتظار موافقة مدير النظام.',
            request: approvalReq,
          },
          { status: 202 }
        );
      }

      const updatedUser = inMemoryStore.updateUserRole(userId, body.role, {
        id: user.id,
        role: user.role,
      });
      return HttpResponse.json(updatedUser, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة طلب تعديل الدور الوظيفي' },
        { status: 400 }
      );
    }
  }),

  // PATCH /api/admin/users/:id/status
  http.patch('/api/admin/users/:id/status', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const userId = params.id as string;
    const targetUser = inMemoryStore.getManagedUserById(userId);
    if (!targetUser) {
      return HttpResponse.json(
        { message: 'المستخدم المطلوب غير موجود في دليل النظام' },
        { status: 404 }
      );
    }

    try {
      const body = (await request.json()) as UpdateUserStatusDTO;
      const check = inMemoryStore.hasPermission(user, 'users.change_status', {
        targetUser,
        targetStatus: body.status,
      });

      if (!check.granted || check.executionMode === 'denied') {
        return HttpResponse.json(
          { message: check.reasonAr || 'غير مصرح: هذه العملية تتطلب صلاحية تعديل حالة الحساب' },
          { status: 403 }
        );
      }

      if (check.executionMode === 'requires_approval') {
        const isSuspending = body.status === 'suspended';
        const actionText = isSuspending ? 'إيقاف' : 'إعادة تنشيط';
        const approvalReq = inMemoryStore.createApprovalRequest({
          actionType: 'users.change_status',
          titleAr: `طلب ${actionText} حساب المستخدم "${targetUser.name}"`,
          targetId: targetUser.id,
          targetResourceId: targetUser.id,
          targetResourceName: targetUser.name,
          requestedBy: user.id,
          requesterId: user.id,
          requesterName: user.name,
          requesterRole: user.role,
          justification: body.reason || `طلب ${actionText} الحساب عبر إدارة المستخدمين`,
          payload: {
            userId: targetUser.id,
            status: body.status,
            previousStatus: targetUser.status,
            reason: body.reason,
          },
        });

        return HttpResponse.json(
          {
            ...targetUser,
            status: targetUser.status, // Unchanged!
            approvalRequired: true,
            requestId: approvalReq.id,
            message: `تم إرسال طلب ${actionText} الحساب للاعتماد بنجاح؛ العملية بانتظار موافقة مدير النظام.`,
            request: approvalReq,
          },
          { status: 202 }
        );
      }

      const updatedUser = inMemoryStore.updateUserStatus(userId, body.status, body.reason, {
        id: user.id,
        role: user.role,
      });
      return HttpResponse.json(updatedUser, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة طلب تعديل حالة الحساب' },
        { status: 400 }
      );
    }
  }),

  // DELETE /api/admin/users/:id
  http.delete('/api/admin/users/:id', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const userId = params.id as string;
    const targetUser = inMemoryStore.getManagedUserById(userId);
    if (!targetUser) {
      return HttpResponse.json(
        { message: 'المستخدم المطلوب غير موجود في دليل النظام' },
        { status: 404 }
      );
    }

    const check = inMemoryStore.hasPermission(user, 'users.delete', {
      targetUser,
    });

    if (!check.granted || check.executionMode === 'denied') {
      return HttpResponse.json(
        { message: check.reasonAr || 'غير مصرح بحذف هذا الحساب' },
        { status: 403 }
      );
    }

    if (check.executionMode === 'requires_approval') {
      const approvalReq = inMemoryStore.createApprovalRequest({
        actionType: 'users.delete',
        titleAr: `طلب حذف حساب المستخدم "${targetUser.name}" (${targetUser.id})`,
        targetId: targetUser.id,
        targetResourceId: targetUser.id,
        targetResourceName: targetUser.name,
        requestedBy: user.id,
        requesterId: user.id,
        requesterName: user.name,
        requesterRole: user.role,
        justification: 'طلب حذف حساب مستخدم عبر إدارة المستخدمين',
        payload: {
          userId: targetUser.id,
        },
      });

      return HttpResponse.json(
        {
          success: false,
          approvalRequired: true,
          requestId: approvalReq.id,
          message: 'تم إرسال طلب حذف الحساب للاعتماد بنجاح؛ العملية بانتظار موافقة مدير النظام.',
          request: approvalReq,
        },
        { status: 202 }
      );
    }

    try {
      inMemoryStore.deleteUser(userId, { id: user.id, role: user.role });
      return HttpResponse.json({ success: true, message: 'تم حذف المستخدم بنجاح' }, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json({ message: 'فشلت معالجة حذف الحساب' }, { status: 400 });
    }
  }),

  // GET /api/admin/users/:userId/transcript (Phase 3)
  http.get('/api/admin/users/:userId/transcript', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const hasAccess = user.role === 'admin' || inMemoryStore.hasUserPermission(user.id, 'transcripts.view');
    if (!hasAccess) {
      return HttpResponse.json(
        { message: 'غير مصرح: هذه العملية تتطلب صلاحية عرض السجل التدريبي' },
        { status: 403 }
      );
    }

    const userId = params.userId as string;
    try {
      const transcript = inMemoryStore.getUserTranscript(userId);
      if (!transcript) {
        return HttpResponse.json(
          { message: 'المستخدم المطلوب غير موجود في دليل النظام' },
          { status: 404 }
        );
      }
      return HttpResponse.json(transcript, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة طلب عرض السجل التدريبي للمستخدم' },
        { status: 400 }
      );
    }
  }),
];

