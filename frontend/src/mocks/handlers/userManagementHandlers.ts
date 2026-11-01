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

    const hasAccess =
      user.role === 'developer' ||
      user.role === 'super_admin' ||
      user.role === 'admin' ||
      inMemoryStore.hasPermission(user, 'users.view_directory').granted;
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

    const users = inMemoryStore.getManagedUsers(
      {
        query,
        role,
        status,
        department,
      },
      user.role
    );

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

      // Invariant INV-R1: In-app creation of developer account is strictly prohibited
      if (body.role === 'developer') {
        return HttpResponse.json(
          { message: 'غير مصرح: لا يمكن إنشاء أو ترقية أو تعديل حسابات المطورين برمجياً عبر إدارة المستخدمين' },
          { status: 403 }
        );
      }

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

      // Uniqueness validation across all users (including hidden developer)
      const trimmedUsername = (body.username || '').trim().toLowerCase();
      const trimmedEmail = (body.email || '').trim().toLowerCase();
      const allUsers = inMemoryStore.getUsersRaw();
      if (allUsers.some((u) => u.username.toLowerCase() === trimmedUsername || u.id.toLowerCase() === trimmedUsername)) {
        return HttpResponse.json({ message: 'اسم المستخدم مسجل مسبقاً لمستخدم آخر' }, { status: 409 });
      }
      const conflictingEmailUser = allUsers.find((u) => u.email.toLowerCase() === trimmedEmail);
      if (conflictingEmailUser) {
        // Surface 9 & Decision D-09: Generic message for all collisions preventing role/account discovery
        return HttpResponse.json({ message: 'البريد الإلكتروني مستخدم بالفعل أو غير متاح' }, { status: 409 });
      }

      if (roleCheck.executionMode === 'requires_approval') {
        return HttpResponse.json(
          {
            message: 'غير مصرح: لا يملك مساعد مدير النظام تفويضاً تشغيلياً سارياً لتنفيذ هذه العملية مباشرة',
            code: 'INVARIANT_ASSISTANT_ADMIN_CEILING',
          },
          { status: 403 }
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
    const targetUser = inMemoryStore.getManagedUserById(userId, user.role);
    if (!targetUser) {
      return HttpResponse.json(
        { message: 'المستخدم المطلوب غير موجود في دليل النظام' },
        { status: 404 }
      );
    }

    try {
      const body = (await request.json()) as UpdateUserRoleDTO;
      if (body.role === 'developer') {
        return HttpResponse.json(
          { message: 'غير مصرح: لا يمكن إنشاء أو ترقية أو تعديل حسابات المطورين برمجياً عبر إدارة المستخدمين' },
          { status: 403 }
        );
      }
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
        return HttpResponse.json(
          {
            message: 'غير مصرح: لا يملك مساعد مدير النظام تفويضاً تشغيلياً سارياً لتعديل الدور الوظيفي مباشرة',
            code: 'INVARIANT_ASSISTANT_ADMIN_CEILING',
          },
          { status: 403 }
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
    const targetUser = inMemoryStore.getManagedUserById(userId, user.role);
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
        return HttpResponse.json(
          {
            message: 'غير مصرح: لا يملك مساعد مدير النظام تفويضاً تشغيلياً سارياً لتعديل حالة الحساب مباشرة',
            code: 'INVARIANT_ASSISTANT_ADMIN_CEILING',
          },
          { status: 403 }
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
    const targetUser = inMemoryStore.getManagedUserById(userId, user.role);
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
      return HttpResponse.json(
        {
          message: 'غير مصرح: لا يملك مساعد مدير النظام تفويضاً تشغيلياً سارياً لحذف الحسابات مباشرة',
          code: 'INVARIANT_ASSISTANT_ADMIN_CEILING',
        },
        { status: 403 }
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

    const hasAccess =
      user.role === 'developer' ||
      user.role === 'super_admin' ||
      user.role === 'admin' ||
      inMemoryStore.hasPermission(user, 'users.view_transcript').granted;
    if (!hasAccess) {
      return HttpResponse.json(
        { message: 'غير مصرح: هذه العملية تتطلب صلاحية عرض السجل التدريبي' },
        { status: 403 }
      );
    }

    const userId = params.userId as string;
    try {
      const transcript = inMemoryStore.getUserTranscript(userId, user.role);
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

