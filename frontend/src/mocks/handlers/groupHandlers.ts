import { http, HttpResponse } from 'msw';
import { inMemoryStore, MockStoreError } from '../store/inMemoryStore';
import { resolveAuthenticatedUser } from './resolveUser';
import type { User } from '@/core/auth/types';
import type { TrainingGroup } from '@/core/groups/types';
import type {
  CreateGroupRequestDTO,
  UpdateGroupRequestDTO,
  AssignCycleCoursesDTO,
  RenewGroupCycleRequestDTO,
  JoinGroupQRRequestDTO,
  ReviewJoinRequestDTO,
  CreateMaterialFolderDTO,
  UpdateMaterialFolderDTO,
  AddMaterialFileRequestDTO,
  ReplaceMaterialFileRequestDTO,
  ToggleGroupEnrollmentDTO,
  AddGroupMembersRequestDTO,
} from '@/core/groups/dtos';

/**
 * Authorization Helper Functions
 */

function isGroupAdmin(user: User): boolean {
  return user.role === 'admin';
}

function isAssignedSupervisor(user: User, group: TrainingGroup): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'lecturer') {
    return (group.supervisorIds || []).some(
      (sid) => sid.toLowerCase() === user.id.toLowerCase()
    );
  }
  return false;
}

function isGroupMember(user: User, group: TrainingGroup): boolean {
  return (group.traineeIds || []).some(
    (tid) => tid.toLowerCase() === user.id.toLowerCase()
  );
}

function isSupervisorForTrainee(user: User, traineeId: string): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'lecturer') {
    const groups = inMemoryStore.getGroups();
    return groups.some(
      (g) =>
        (g.supervisorIds || []).some((sid) => sid.toLowerCase() === user.id.toLowerCase()) &&
        (g.traineeIds || []).some((tid) => tid.toLowerCase() === traineeId.toLowerCase())
    );
  }
  return false;
}

function handleStoreError(err: unknown) {
  if (err instanceof MockStoreError) {
    return HttpResponse.json({ message: err.message, code: err.code }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الطلب';
  return HttpResponse.json({ message }, { status: 500 });
}

/**
 * MSW v2 REST Interceptors for Training Groups Management & Follow-up
 */
export const groupHandlers = [
  // ── 1. Trainee Increment 7 Endpoints (Preserved) ─────────────────────

  // Query groups assigned to current authenticated user
  http.get('/api/groups/my', ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لعرض المجموعات التدريبية' },
        { status: 401 }
      );
    }

    const groups = inMemoryStore.getGroups(user.id, user.role);
    const enriched = groups.map((g) => {
      const metrics = inMemoryStore.getGroupMetrics(g.id);
      return {
        ...g,
        metrics,
      };
    });

    return HttpResponse.json(enriched, { status: 200 });
  }),

  // Public QR preview info endpoint (no auth required)
  http.get('/api/groups/join/:code/info', ({ params }) => {
    const code = params.code as string;
    const val = inMemoryStore.validateGroupEnrollmentToken(code);
    if (!val.isValid || !val.group) {
      return HttpResponse.json(
        { message: val.error || 'رمز الانضمام غير صالح' },
        { status: val.status }
      );
    }

    const group = val.group;
    return HttpResponse.json(
      {
        id: group.id,
        name: group.name,
        description: group.description,
        enrollmentPolicy: group.enrollmentPolicy || 'open',
        isEnrollmentOpen: group.isEnrollmentOpen !== false,
        totalCoursesCount: (group.courses || []).length,
        currentTraineesCount: (group.traineeIds || []).length,
        maxTrainees: group.maxTrainees ?? null,
      },
      { status: 200 }
    );
  }),

  // Trainee self-join via QR token
  http.post('/api/groups/join', async ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول للانضمام إلى المجموعة التدريبية' },
        { status: 401 }
      );
    }

    if (user.role !== 'user') {
      return HttpResponse.json(
        { message: 'الانضمام عبر رمز الاستجابة السريعة متاح فقط لحسابات المتدربين' },
        { status: 403 }
      );
    }

    try {
      const body = (await request.json()) as JoinGroupQRRequestDTO;
      if (!body.enrollmentCode) {
        return HttpResponse.json(
          { message: 'رمز الانضمام مطلوب' },
          { status: 400 }
        );
      }

      const result = inMemoryStore.joinGroupByQRCode({
        code: body.enrollmentCode,
        userId: user.id,
        userRole: user.role,
        note: body.note,
      });

      return HttpResponse.json(result, { status: 200 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Query a single training group by ID with membership authorization check (Trainee endpoint)
  http.get('/api/groups/:groupId', ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول للوصول إلى تفاصيل المجموعة' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    try {
      const group = inMemoryStore.getGroupById(groupId, user.id, user.role);
      if (!group) {
        return HttpResponse.json(
          { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
          { status: 404 }
        );
      }

      const metrics = inMemoryStore.getGroupMetrics(group.id);
      return HttpResponse.json(
        {
          ...group,
          metrics,
        },
        { status: 200 }
      );
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // ── 2. Admin & Supervisor Training Groups Management ─────────────────

  // List all training groups with aggregate metrics (Admin: all, Supervisor: assigned only)
  http.get('/api/admin/groups', ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لعرض لوحة المجموعات التدريبية' },
        { status: 401 }
      );
    }

    if (user.role === 'user') {
      return HttpResponse.json(
        { message: 'غير مصرح لك باستعراض لوحة المجموعات التدريبية' },
        { status: 403 }
      );
    }

    const allGroups = inMemoryStore.getGroups();
    const accessibleGroups =
      user.role === 'admin'
        ? allGroups
        : allGroups.filter((g) =>
            (g.supervisorIds || []).some((sid) => sid.toLowerCase() === user.id.toLowerCase())
          );

    const summaries = accessibleGroups
      .map((g) => inMemoryStore.getGroupSummary(g.id))
      .filter((s): s is NonNullable<typeof s> => s !== null);

    return HttpResponse.json(summaries, { status: 200 });
  }),

  // Create a new training group (Admin only or delegated Assistant Admin)
  http.post('/api/admin/groups', async ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لإنشاء مجموعة تدريبية' },
        { status: 401 }
      );
    }

    const check = inMemoryStore.hasPermission(user, 'groups.create');
    if (!check.granted || check.executionMode === 'denied') {
      return HttpResponse.json(
        { message: check.reasonAr || 'صلاحية إنشاء المجموعات التدريبية تقتصر على مدراء النظام فقط' },
        { status: 403 }
      );
    }

    try {
      const body = (await request.json()) as CreateGroupRequestDTO;
      if (!body.name || !body.startDateTime || !body.deadlineDateTime || !body.postDeadlinePolicy) {
        return HttpResponse.json(
          { message: 'البيانات الأساسية للمجموعة غير مكتملة' },
          { status: 400 }
        );
      }

      if (check.executionMode === 'requires_approval') {
        const approvalReq = inMemoryStore.createApprovalRequest({
          actionType: 'groups.create',
          titleAr: `طلب إنشاء مجموعة تدريبية جديدة: "${body.name}"`,
          requestedBy: user.id,
          requesterId: user.id,
          requesterName: user.name,
          requesterRole: user.role,
          justification: 'طلب إنشاء مجموعة تدريبية جديدة عبر إدارة المجموعات',
          payload: body,
        });

        return HttpResponse.json(
          {
            id: 'REQ_PENDING',
            name: body.name,
            approvalRequired: true,
            requestId: approvalReq.id,
            message: 'تم إرسال طلب إنشاء المجموعة للاعتماد بنجاح؛ بانتظار موافقة مدير النظام.',
            request: approvalReq,
          },
          { status: 202 }
        );
      }

      const created = inMemoryStore.createGroup(body);
      return HttpResponse.json(created, { status: 201 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // ── 3. Sub-resource Operations under /api/admin/groups/:groupId ───────

  // Renew group cycle (Admin only)
  http.post('/api/admin/groups/:groupId/renew', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لبدء دورة تجديد' },
        { status: 401 }
      );
    }

    if (!isGroupAdmin(user)) {
      return HttpResponse.json(
        { message: 'بدء دورات التجديد يقتصر على مدراء النظام فقط' },
        { status: 403 }
      );
    }

    const groupId = params.groupId as string;
    try {
      const body = (await request.json()) as RenewGroupCycleRequestDTO;
      if (!body.title || !body.startDateTime || !body.deadlineDateTime || !body.courses) {
        return HttpResponse.json(
          { message: 'بيانات دورة التجديد غير مكتملة' },
          { status: 400 }
        );
      }

      const result = inMemoryStore.createRenewalCycle(groupId, body);
      return HttpResponse.json(result, { status: 201 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Check and process auto renewal for a group (Admin or Authorized Supervisor)
  http.post('/api/admin/groups/:groupId/check-auto-renewal', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لفحص وتحديث دورات التجديد الآلي' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    try {
      const result = inMemoryStore.checkAndProcessAutoRenewal(groupId);
      const updatedGroup = inMemoryStore.getGroupById(groupId);
      return HttpResponse.json({ ...result, group: updatedGroup }, { status: 200 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // List all cycles for a group (Admin, Assigned Supervisor, or Group Trainee)
  http.get('/api/admin/groups/:groupId/cycles', ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لعرض دورات التجديد' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json(
        { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    if (!isAssignedSupervisor(user, group) && !isGroupMember(user, group)) {
      return HttpResponse.json(
        { message: 'غير مصرح لك بالاطلاع على دورات تجديد هذه المجموعة' },
        { status: 403 }
      );
    }

    try {
      const cycles = inMemoryStore.getGroupCycles(groupId);
      return HttpResponse.json(cycles, { status: 200 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Get specific cycle by ID
  http.get('/api/admin/groups/:groupId/cycles/:cycleId', ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لعرض تفاصيل دورة التجديد' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const cycleId = params.cycleId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json(
        { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    if (!isAssignedSupervisor(user, group) && !isGroupMember(user, group)) {
      return HttpResponse.json(
        { message: 'غير مصرح لك بالاطلاع على دورة التجديد هذه' },
        { status: 403 }
      );
    }

    const cycle = inMemoryStore.getGroupCycleById(cycleId);
    if (!cycle || cycle.groupId.toLowerCase() !== group.id.toLowerCase()) {
      return HttpResponse.json(
        { message: 'دورة التجديد المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    return HttpResponse.json(cycle, { status: 200 });
  }),

  // Assign or update courses in a cycle (Admin only)
  http.post('/api/admin/groups/:groupId/courses', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لتعديل مقررات المجموعة' },
        { status: 401 }
      );
    }

    if (!isGroupAdmin(user)) {
      return HttpResponse.json(
        { message: 'تعديل مقررات المجموعة التدريبية يقتصر على مدراء النظام فقط' },
        { status: 403 }
      );
    }

    const groupId = params.groupId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json(
        { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    try {
      const body = (await request.json()) as AssignCycleCoursesDTO & { cycleId?: string };
      if (!body.courses || !Array.isArray(body.courses)) {
        return HttpResponse.json(
          { message: 'قائمة المقررات غير صالحة' },
          { status: 400 }
        );
      }

      const targetCycleId = body.cycleId || group.currentCycleId;
      if (!targetCycleId) {
        return HttpResponse.json(
          { message: 'لا توجد دورة تدريبية نشطة لتعيين المقررات بها' },
          { status: 400 }
        );
      }

      const updatedCycle = inMemoryStore.assignCoursesToCycle(groupId, targetCycleId, body);
      return HttpResponse.json(updatedCycle, { status: 200 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Get members of a group (Admin or Assigned Supervisor)
  http.get('/api/admin/groups/:groupId/members', ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لعرض قائمة المتدربين' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json(
        { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    if (!isAssignedSupervisor(user, group)) {
      return HttpResponse.json(
        { message: 'غير مصرح لك باستعراض أعضاء هذه المجموعة التدريبية' },
        { status: 403 }
      );
    }

    try {
      const members = inMemoryStore.getGroupMembers(groupId);
      return HttpResponse.json(members, { status: 200 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Add member(s) directly to group (Admin or Assigned Supervisor)
  http.post('/api/admin/groups/:groupId/members', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لإضافة متدربين' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json(
        { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    if (!isAssignedSupervisor(user, group)) {
      return HttpResponse.json(
        { message: 'غير مصرح لك بإضافة متدربين إلى هذه المجموعة التدريبية' },
        { status: 403 }
      );
    }

    try {
      const body = (await request.json()) as AddGroupMembersRequestDTO & { traineeId?: string };
      const traineeIds = body.traineeIds || (body.traineeId ? [body.traineeId] : []);
      if (traineeIds.length === 0) {
        return HttpResponse.json(
          { message: 'يجب تحديد متدرب واحد على الأقل للإضافة' },
          { status: 400 }
        );
      }

      let addedCount = 0;
      let alreadyMemberCount = 0;
      const joinSource = user.role === 'admin' ? 'admin_assigned' : 'supervisor_assigned';

      for (const tid of traineeIds) {
        const res = inMemoryStore.addGroupMember(groupId, tid, joinSource);
        if (res.alreadyMember) {
          alreadyMemberCount++;
        } else {
          addedCount++;
        }
      }

      const allMembers = inMemoryStore.getGroupMembers(groupId);
      return HttpResponse.json(
        {
          addedCount,
          alreadyMemberCount,
          members: allMembers,
        },
        { status: 200 }
      );
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // List candidate trainees for direct group membership assignment (Admin or Lecturer)
  http.get('/api/admin/trainees', ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لعرض قائمة المتدربين' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin' && user.role !== 'lecturer') {
      return HttpResponse.json(
        { message: 'غير مصرح لك باستعراض قائمة المتدربين المرشحين' },
        { status: 403 }
      );
    }

    const trainees = inMemoryStore.getCandidateTrainees();
    return HttpResponse.json(trainees, { status: 200 });
  }),

  // Remove member from group (Admin or Assigned Supervisor)
  http.delete('/api/admin/groups/:groupId/members/:userId', ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لإزالة متدرب' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const targetUserId = params.userId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json(
        { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    if (!isAssignedSupervisor(user, group)) {
      return HttpResponse.json(
        { message: 'غير مصرح لك بإزالة متدربين من هذه المجموعة التدريبية' },
        { status: 403 }
      );
    }

    try {
      const result = inMemoryStore.removeGroupMember(groupId, targetUserId);
      return HttpResponse.json(result, { status: 200 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Rotate QR code enrollment token (Admin only)
  http.post('/api/admin/groups/:groupId/qr-code/rotate', ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لإعادة توليد رمز الانضمام' },
        { status: 401 }
      );
    }

    if (!isGroupAdmin(user)) {
      return HttpResponse.json(
        { message: 'إعادة توليد رمز الاستجابة السريعة يقتصر على مدراء النظام فقط' },
        { status: 403 }
      );
    }

    const groupId = params.groupId as string;
    try {
      const result = inMemoryStore.rotateGroupEnrollmentCode(groupId);
      return HttpResponse.json(result, { status: 200 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Toggle QR enrollment open/closed (Admin only)
  http.post('/api/admin/groups/:groupId/qr-code/toggle', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لتغيير حالة الانضمام' },
        { status: 401 }
      );
    }

    if (!isGroupAdmin(user)) {
      return HttpResponse.json(
        { message: 'تغيير إعدادات الانضمام يقتصر على مدراء النظام فقط' },
        { status: 403 }
      );
    }

    const groupId = params.groupId as string;
    try {
      const body = (await request.json()) as ToggleGroupEnrollmentDTO;
      if (typeof body.isOpen !== 'boolean') {
        return HttpResponse.json(
          { message: 'قيمة حالة الانضمام غير صالحة' },
          { status: 400 }
        );
      }

      const updated = inMemoryStore.toggleGroupEnrollment(groupId, body.isOpen);
      return HttpResponse.json(
        { success: true, isEnrollmentOpen: updated.isEnrollmentOpen },
        { status: 200 }
      );
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // List join requests for a group (Admin or Assigned Supervisor)
  http.get('/api/admin/groups/:groupId/join-requests', ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لعرض طلبات الانضمام' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json(
        { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    if (!isAssignedSupervisor(user, group)) {
      return HttpResponse.json(
        { message: 'غير مصرح لك باستعراض طلبات الانضمام لهذه المجموعة' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') as 'pending' | 'approved' | 'rejected' | null;
    const requests = inMemoryStore.getGroupJoinRequests(groupId, status || undefined);
    return HttpResponse.json(requests, { status: 200 });
  }),

  // Review (approve/reject) a join request (Admin or Assigned Supervisor)
  http.post('/api/admin/groups/:groupId/join-requests/:requestId/review', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لمراجعة طلبات الانضمام' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json(
        { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    if (!isAssignedSupervisor(user, group)) {
      return HttpResponse.json(
        { message: 'غير مصرح لك بمراجعة طلبات الانضمام لهذه المجموعة' },
        { status: 403 }
      );
    }

    try {
      const requestId = params.requestId as string;
      const body = (await request.json()) as Omit<ReviewJoinRequestDTO, 'requestId'>;
      if (!body.decision || !['approved', 'rejected'].includes(body.decision)) {
        return HttpResponse.json(
          { message: 'قرار المراجعة غير صالح (يجب أن يكون approved أو rejected)' },
          { status: 400 }
        );
      }

      const reviewRes = inMemoryStore.reviewGroupJoinRequest(
        {
          requestId,
          decision: body.decision,
          reviewNote: body.reviewNote,
        },
        user
      );

      return HttpResponse.json(reviewRes, { status: 200 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // List group materials (Admin, Assigned Supervisor, or Group Trainee with visibility filter)
  http.get('/api/admin/groups/:groupId/materials', ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لعرض مواد المجموعة' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json(
        { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    // Strict scoped access check
    if (!isAssignedSupervisor(user, group) && !isGroupMember(user, group)) {
      return HttpResponse.json(
        { message: 'غير مصرح لك بالوصول إلى مواد هذه المجموعة التدريبية' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const cycleId = url.searchParams.get('cycleId');

    try {
      const materials = inMemoryStore.getGroupMaterials(groupId, user.role, cycleId);
      return HttpResponse.json(materials, { status: 200 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Create material folder (Admin or Assigned Supervisor)
  http.post('/api/admin/groups/:groupId/materials/folders', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لإنشاء مجلد' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json(
        { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    if (!isAssignedSupervisor(user, group)) {
      return HttpResponse.json(
        { message: 'غير مصرح لك بإنشاء مجلدات في هذه المجموعة التدريبية' },
        { status: 403 }
      );
    }

    try {
      const body = (await request.json()) as CreateMaterialFolderDTO;
      if (!body.name || !body.name.trim()) {
        return HttpResponse.json(
          { message: 'اسم المجلد مطلوب' },
          { status: 422 }
        );
      }

      const folder = inMemoryStore.createMaterialFolder(groupId, body);
      return HttpResponse.json(folder, { status: 201 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Update material folder (Admin or Assigned Supervisor)
  http.put('/api/admin/groups/:groupId/materials/folders/:folderId', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لتعديل المجلد' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const folderId = params.folderId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json(
        { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    if (!isAssignedSupervisor(user, group)) {
      return HttpResponse.json(
        { message: 'غير مصرح لك بتعديل مجلدات هذه المجموعة التدريبية' },
        { status: 403 }
      );
    }

    try {
      const body = (await request.json()) as UpdateMaterialFolderDTO;
      const updated = inMemoryStore.updateMaterialFolder(folderId, body);
      return HttpResponse.json(updated, { status: 200 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Delete material folder (Admin or Assigned Supervisor)
  http.delete('/api/admin/groups/:groupId/materials/folders/:folderId', ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لحذف المجلد' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const folderId = params.folderId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json(
        { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    if (!isAssignedSupervisor(user, group)) {
      return HttpResponse.json(
        { message: 'غير مصرح لك بحذف مجلدات من هذه المجموعة التدريبية' },
        { status: 403 }
      );
    }

    try {
      const result = inMemoryStore.deleteMaterialFolder(folderId);
      return HttpResponse.json(result, { status: 200 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Add material file metadata (Admin or Assigned Supervisor)
  http.post('/api/admin/groups/:groupId/materials/files', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لرفع ملف' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json(
        { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    if (!isAssignedSupervisor(user, group)) {
      return HttpResponse.json(
        { message: 'غير مصرح لك برفع ملفات إلى هذه المجموعة التدريبية' },
        { status: 403 }
      );
    }

    try {
      const body = (await request.json()) as AddMaterialFileRequestDTO;
      if (!body.folderId || !body.fileName || body.sizeBytes === undefined || !body.mimeType) {
        return HttpResponse.json(
          { message: 'بيانات الملف غير مكتملة' },
          { status: 400 }
        );
      }

      const file = inMemoryStore.addMaterialFile(groupId, body.folderId, body, user);
      return HttpResponse.json(file, { status: 201 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Replace material file metadata (Admin or Assigned Supervisor)
  http.put('/api/admin/groups/:groupId/materials/files/:fileId', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لاستبدال الملف' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const fileId = params.fileId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json(
        { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    if (!isAssignedSupervisor(user, group)) {
      return HttpResponse.json(
        { message: 'غير مصرح لك باستبدال ملفات هذه المجموعة التدريبية' },
        { status: 403 }
      );
    }

    try {
      const body = (await request.json()) as ReplaceMaterialFileRequestDTO;
      if (!body.fileName || body.sizeBytes === undefined || !body.mimeType) {
        return HttpResponse.json(
          { message: 'بيانات الملف البديل غير مكتملة' },
          { status: 400 }
        );
      }

      const replaced = inMemoryStore.replaceMaterialFile(fileId, body, user);
      return HttpResponse.json(replaced, { status: 200 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Delete material file (Admin or Assigned Supervisor)
  http.delete('/api/admin/groups/:groupId/materials/files/:fileId', ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لحذف الملف' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const fileId = params.fileId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json(
        { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    if (!isAssignedSupervisor(user, group)) {
      return HttpResponse.json(
        { message: 'غير مصرح لك بحذف ملفات من هذه المجموعة التدريبية' },
        { status: 403 }
      );
    }

    try {
      const result = inMemoryStore.deleteMaterialFile(fileId);
      return HttpResponse.json(result, { status: 200 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Move material file to another folder (Admin or Assigned Supervisor)
  http.put('/api/admin/groups/:groupId/materials/files/:fileId/move', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لنقل الملف' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const fileId = params.fileId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json(
        { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    if (!isAssignedSupervisor(user, group)) {
      return HttpResponse.json(
        { message: 'غير مصرح لك بنقل ملفات هذه المجموعة التدريبية' },
        { status: 403 }
      );
    }

    try {
      const body = (await request.json()) as { targetFolderId: string };
      if (!body.targetFolderId) {
        return HttpResponse.json(
          { message: 'المجلد الوجهة مطلوب' },
          { status: 400 }
        );
      }

      const moved = inMemoryStore.moveMaterialFile(fileId, body.targetFolderId);
      return HttpResponse.json(moved, { status: 200 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Update material file title or visibility (Admin or Assigned Supervisor)
  http.patch('/api/admin/groups/:groupId/materials/files/:fileId', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لتعديل الملف' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const fileId = params.fileId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json(
        { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    if (!isAssignedSupervisor(user, group)) {
      return HttpResponse.json(
        { message: 'غير مصرح لك بتعديل ملفات هذه المجموعة التدريبية' },
        { status: 403 }
      );
    }

    try {
      const body = (await request.json()) as { title?: string; isVisible?: boolean };
      const updated = inMemoryStore.updateMaterialFile(fileId, body);
      return HttpResponse.json(updated, { status: 200 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Trainee Course Attempt History & Statistics
  http.get('/api/users/:userId/courses/:courseId/attempts', ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لعرض سجل المحاولات' },
        { status: 401 }
      );
    }

    const targetUserId = params.userId as string;
    const courseId = params.courseId as string;

    // Authorization: Admin, Self, or Assigned Supervisor of the trainee's group
    const isSelf = user.id.toLowerCase() === targetUserId.toLowerCase();
    const isAdmin = isGroupAdmin(user);
    const isSupervisor = isSupervisorForTrainee(user, targetUserId);

    if (!isSelf && !isAdmin && !isSupervisor) {
      return HttpResponse.json(
        { message: 'غير مصرح لك باستعراض سجل محاولات هذا المتدرب' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const cycleId = url.searchParams.get('cycleId');

    try {
      const stats = inMemoryStore.getCourseAttemptStatsForTrainee(targetUserId, courseId, cycleId);
      return HttpResponse.json(stats, { status: 200 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Group Monitoring Dashboard Data (Admin or Assigned Supervisor)
  http.get('/api/admin/groups/:groupId/monitoring', ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لعرض لوحة المتابعة' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json(
        { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    if (!isAssignedSupervisor(user, group)) {
      return HttpResponse.json(
        { message: 'غير مصرح لك بمتابعة هذه المجموعة التدريبية' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const cycleId = url.searchParams.get('cycleId');

    try {
      const metrics = inMemoryStore.getGroupMetrics(groupId, cycleId || undefined);
      if (!metrics) {
        return HttpResponse.json(
          { message: 'تعذر حساب مؤشرات المجموعة' },
          { status: 500 }
        );
      }
      return HttpResponse.json(metrics, { status: 200 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Query detailed group by ID (Admin or Assigned Supervisor)
  http.get('/api/admin/groups/:groupId', ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لعرض تفاصيل المجموعة' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const group = inMemoryStore.getGroupById(groupId);
    if (!group) {
      return HttpResponse.json(
        { message: 'المجموعة التدريبية المطلوبة غير موجودة' },
        { status: 404 }
      );
    }

    if (!isAssignedSupervisor(user, group)) {
      return HttpResponse.json(
        { message: 'غير مصرح لك بالوصول إلى بيانات هذه المجموعة التدريبية' },
        { status: 403 }
      );
    }

    try {
      const metrics = inMemoryStore.getGroupMetrics(group.id);
      const currentCycle = inMemoryStore.getCurrentGroupCycle(group.id);
      const summary = inMemoryStore.getGroupSummary(group.id);

      return HttpResponse.json(
        {
          ...group,
          metrics,
          currentCycle,
          summary,
        },
        { status: 200 }
      );
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Update training group metadata, capacity, schedule, or policies (Admin only or delegated Assistant Admin)
  http.put('/api/admin/groups/:groupId', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لتحديث المجموعة التدريبية' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const check = inMemoryStore.hasPermission(user, 'groups.edit_config', { targetGroupId: groupId });
    if (!check.granted || check.executionMode === 'denied') {
      return HttpResponse.json(
        { message: check.reasonAr || 'تعديل إعدادات المجموعة التدريبية يقتصر على مدراء النظام ومساعديهم المصرح لهم' },
        { status: 403 }
      );
    }

    try {
      const body = (await request.json()) as UpdateGroupRequestDTO;

      if (check.executionMode === 'requires_approval') {
        const approvalReq = inMemoryStore.createApprovalRequest({
          actionType: 'groups.edit_config',
          titleAr: `طلب تعديل إعدادات المجموعة: "${groupId}"`,
          targetId: groupId,
          targetResourceId: groupId,
          requestedBy: user.id,
          requesterId: user.id,
          requesterName: user.name,
          requesterRole: user.role,
          justification: 'طلب تعديل إعدادات المجموعة التدريبية',
          payload: { groupId, ...body },
        });

        return HttpResponse.json(
          {
            id: groupId,
            approvalRequired: true,
            requestId: approvalReq.id,
            message: 'تم إرسال طلب تعديل المجموعة للاعتماد بنجاح؛ بانتظار موافقة مدير النظام.',
            request: approvalReq,
          },
          { status: 202 }
        );
      }

      const updated = inMemoryStore.updateGroup(groupId, body);
      return HttpResponse.json(updated, { status: 200 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),

  // Delete or safe archive group (Admin only or delegated Assistant Admin)
  http.delete('/api/admin/groups/:groupId', ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لحذف المجموعة التدريبية' },
        { status: 401 }
      );
    }

    const groupId = params.groupId as string;
    const check = inMemoryStore.hasPermission(user, 'groups.archive', { targetGroupId: groupId });
    if (!check.granted || check.executionMode === 'denied') {
      return HttpResponse.json(
        { message: check.reasonAr || 'حذف أو أرشفة المجموعة التدريبية يقتصر على مدراء النظام ومساعديهم المصرح لهم' },
        { status: 403 }
      );
    }

    if (check.executionMode === 'requires_approval') {
      const approvalReq = inMemoryStore.createApprovalRequest({
        actionType: 'groups.archive',
        titleAr: `طلب أرشفة المجموعة التدريبية: "${groupId}"`,
        targetId: groupId,
        targetResourceId: groupId,
        requestedBy: user.id,
        requesterId: user.id,
        requesterName: user.name,
        requesterRole: user.role,
        justification: 'طلب أرشفة المجموعة التدريبية',
        payload: { groupId },
      });

      return HttpResponse.json(
        {
          success: false,
          approvalRequired: true,
          requestId: approvalReq.id,
          message: 'تم إرسال طلب أرشفة المجموعة للاعتماد بنجاح؛ بانتظار موافقة مدير النظام.',
          request: approvalReq,
        },
        { status: 202 }
      );
    }

    try {
      const result = inMemoryStore.deleteGroup(groupId);
      return HttpResponse.json(result, { status: 200 });
    } catch (err) {
      return handleStoreError(err);
    }
  }),
];
