import { http, HttpResponse } from 'msw';
import { inMemoryStore, MockStoreError } from '../store/inMemoryStore';
import { resolveAuthenticatedUser } from './resolveUser';
import type {
  CreateCommentRequestDTO,
  ReportCommentRequestDTO,
  ToggleCourseCommentsDTO,
  CommentFilterParams,
} from '@/core/comments/types';

/**
 * Centrally Managed MSW v2 Handlers for Comment Moderation & Discussion Management (Increment 11 Phase 5A)
 */
export const commentsHandlers = [
  // 1. GET /api/admin/comments/reported - Queue of reported comments
  http.get('/api/admin/comments/reported', async ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin' && user.role !== 'assistant_admin') {
      return HttpResponse.json(
        { message: 'غير مصرح: استعراض قائمة التعليقات المُبلّغ عنها للمنظومة مخصص لمديري النظام فقط' },
        { status: 403 }
      );
    }

    try {
      const reported = inMemoryStore.getReportedComments({ id: user.id, role: user.role });
      return HttpResponse.json(reported, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة طلب استعراض التعليقات المُبلّغ عنها' },
        { status: 500 }
      );
    }
  }),

  // 2. GET /api/admin/comments - Directory of all comments with search/course filters
  http.get('/api/admin/comments', async ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin' && user.role !== 'assistant_admin') {
      return HttpResponse.json(
        { message: 'غير مصرح: استعراض دليل التعليقات الشامل مخصص لمديري النظام فقط' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const query = url.searchParams.get('query') || undefined;
    const courseId = url.searchParams.get('courseId') || undefined;
    const reportedOnly = url.searchParams.get('reportedOnly') === 'true';

    const params: CommentFilterParams = {
      query,
      courseId,
      reportedOnly,
    };

    try {
      const comments = inMemoryStore.getAllComments({ id: user.id, role: user.role }, params);
      return HttpResponse.json(comments, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة استعراض التعليقات' },
        { status: 500 }
      );
    }
  }),

  // 3. GET /api/admin/comments/summary - Moderation KPI summary
  http.get('/api/admin/comments/summary', async ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin' && user.role !== 'assistant_admin') {
      return HttpResponse.json(
        { message: 'غير مصرح: استعراض إحصائيات التعليقات مخصص للإدارة فقط' },
        { status: 403 }
      );
    }

    try {
      const summary = inMemoryStore.getCommentModerationSummary({ id: user.id, role: user.role });
      return HttpResponse.json(summary, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة إحصائيات التعليقات' },
        { status: 500 }
      );
    }
  }),

  // 4. GET /api/courses/:courseId/comments - Active comments for a course
  http.get('/api/courses/:courseId/comments', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const courseId = params.courseId as string;
    try {
      const comments = inMemoryStore.getCourseComments(courseId);
      return HttpResponse.json(comments, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة استعراض تعليقات المقرر' },
        { status: 500 }
      );
    }
  }),

  // 5. POST /api/courses/:courseId/comments - Post a new comment
  http.post('/api/courses/:courseId/comments', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const courseId = params.courseId as string;
    try {
      const body = (await request.json()) as CreateCommentRequestDTO;
      const comment = inMemoryStore.createComment(
        { courseId, text: body.text },
        { id: user.id, role: user.role, name: user.name }
      );
      return HttpResponse.json(comment, { status: 201 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت إضافة التعليق' },
        { status: 400 }
      );
    }
  }),

  // 6. POST /api/comments/:commentId/report - Report an inappropriate comment
  http.post('/api/comments/:commentId/report', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const commentId = params.commentId as string;
    try {
      const body = (await request.json()) as ReportCommentRequestDTO;
      const updated = inMemoryStore.reportComment(
        commentId,
        body,
        { id: user.id, role: user.role, name: user.name }
      );
      return HttpResponse.json(updated, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة الإبلاغ عن التعليق' },
        { status: 400 }
      );
    }
  }),

  // 7. DELETE /api/admin/comments/:commentId - Permanent deletion with dual-control governance
  http.delete('/api/admin/comments/:commentId', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    if (user.role === 'user') {
      return HttpResponse.json(
        { message: 'غير مصرح: حذف التعليقات مخصص للإدارة فقط' },
        { status: 403 }
      );
    }

    if (user.role === 'lecturer') {
      return HttpResponse.json(
        { message: 'غير مصرح: الحذف الإداري العام مخصص لمديري النظام فقط' },
        { status: 403 }
      );
    }

    const commentId = params.commentId as string;
    const targetComment = inMemoryStore.getCommentById(commentId);
    if (!targetComment) {
      return HttpResponse.json(
        { message: 'التعليق المطلوب غير موجود' },
        { status: 404 }
      );
    }

    // Assistant admin dual-control interception: requires delegation for direct execution
    if (user.role === 'assistant_admin') {
      const hasDelegation = inMemoryStore.getDelegatedAuthority(user.id);
      if (!hasDelegation) {
        // Create pending approval request
        const approvalReq = inMemoryStore.createApprovalRequest({
          actionType: 'comments.delete',
          titleAr: `طلب حذف تعليق في مقرر "${targetComment.courseTitle}"`,
          targetId: targetComment.id,
          targetResourceId: targetComment.id,
          targetResourceName: targetComment.text.slice(0, 30),
          requestedBy: user.id,
          requesterId: user.id,
          requesterName: user.name,
          requesterRole: user.role,
          justification: 'طلب حذف تعليق مخالف عبر إدارة التعليقات',
          payload: {
            commentId: targetComment.id,
            courseId: targetComment.courseId,
            author: targetComment.userName,
          },
        });

        return HttpResponse.json(
          {
            approvalRequired: true,
            requestId: approvalReq.id,
            message: 'تم إرسال طلب حذف التعليق للاعتماد بنجاح؛ العملية بانتظار موافقة مدير النظام.',
            request: approvalReq,
          },
          { status: 202 }
        );
      }
    }

    // Direct deletion execution
    try {
      inMemoryStore.deleteComment(commentId, { id: user.id, role: user.role });
      return HttpResponse.json({ success: true, message: 'تم حذف التعليق بنجاح' }, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة حذف التعليق' },
        { status: 400 }
      );
    }
  }),

  // 8. DELETE /api/courses/:courseId/comments/:commentId - Course-scoped deletion (Instructors & Admins)
  http.delete('/api/courses/:courseId/comments/:commentId', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const commentId = params.commentId as string;
    const targetComment = inMemoryStore.getCommentById(commentId);
    if (!targetComment) {
      return HttpResponse.json(
        { message: 'التعليق المطلوب غير موجود' },
        { status: 404 }
      );
    }

    // Assistant admin dual-control interception
    if (user.role === 'assistant_admin') {
      const hasDelegation = inMemoryStore.getDelegatedAuthority(user.id);
      if (!hasDelegation) {
        const approvalReq = inMemoryStore.createApprovalRequest({
          actionType: 'comments.delete',
          titleAr: `طلب حذف تعليق في مقرر "${targetComment.courseTitle}"`,
          targetId: targetComment.id,
          targetResourceId: targetComment.id,
          targetResourceName: targetComment.text.slice(0, 30),
          requestedBy: user.id,
          requesterId: user.id,
          requesterName: user.name,
          requesterRole: user.role,
          justification: 'طلب حذف تعليق مخالف عبر إدارة المقرر',
          payload: {
            commentId: targetComment.id,
            courseId: targetComment.courseId,
          },
        });

        return HttpResponse.json(
          {
            approvalRequired: true,
            requestId: approvalReq.id,
            message: 'تم إرسال طلب حذف التعليق للاعتماد بنجاح؛ العملية بانتظار موافقة مدير النظام.',
            request: approvalReq,
          },
          { status: 202 }
        );
      }
    }

    try {
      inMemoryStore.deleteComment(commentId, { id: user.id, role: user.role });
      return HttpResponse.json({ success: true, message: 'تم حذف التعليق بنجاح' }, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة حذف التعليق' },
        { status: 400 }
      );
    }
  }),

  // 9. PATCH /api/admin/comments/:commentId/ignore-report - Ignore report (Direct execution for Admins & Assistant Admins)
  http.patch('/api/admin/comments/:commentId/ignore-report', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    if (user.role === 'user') {
      return HttpResponse.json(
        { message: 'غير مصرح: إدارة بلاغات التعليقات مخصصة للإدارة فقط' },
        { status: 403 }
      );
    }

    if (user.role === 'lecturer') {
      return HttpResponse.json(
        { message: 'غير مصرح: إدارة البلاغات المركزية مخصصة لمديري النظام فقط' },
        { status: 403 }
      );
    }

    const commentId = params.commentId as string;
    try {
      const updated = inMemoryStore.ignoreCommentReport(commentId, { id: user.id, role: user.role });
      return HttpResponse.json(updated, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة تجاهل البلاغ' },
        { status: 400 }
      );
    }
  }),

  // 10. PATCH /api/admin/courses/:courseId/comments-toggle - Toggle course commenting policy
  http.patch('/api/admin/courses/:courseId/comments-toggle', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    if (user.role === 'user') {
      return HttpResponse.json(
        { message: 'غير مصرح: تعديل إعدادات المقرر مخصص للإدارة فقط' },
        { status: 403 }
      );
    }

    if (user.role === 'lecturer') {
      return HttpResponse.json(
        { message: 'غير مصرح: التحكم المركزي بالنقاشات مخصص لمديري النظام فقط' },
        { status: 403 }
      );
    }

    const courseId = params.courseId as string;
    let enabled: boolean | undefined;
    try {
      const body = (await request.json().catch(() => ({}))) as ToggleCourseCommentsDTO;
      if (typeof body.commentsEnabled === 'boolean') {
        enabled = body.commentsEnabled;
      }
    } catch {
      // Body is optional
    }

    // Assistant admin dual-control check
    if (user.role === 'assistant_admin') {
      const hasDelegation = inMemoryStore.getDelegatedAuthority(user.id);
      if (!hasDelegation) {
        const approvalReq = inMemoryStore.createApprovalRequest({
          actionType: 'comments.toggle',
          titleAr: `طلب تعديل سياسة النقاشات للمقرر`,
          targetId: courseId,
          targetResourceId: courseId,
          requestedBy: user.id,
          requesterId: user.id,
          requesterName: user.name,
          requesterRole: user.role,
          justification: 'طلب تعديل سياسة النقاشات للمقرر عبر إدارة التعليقات',
          payload: {
            courseId,
            commentsEnabled: enabled,
          },
        });

        return HttpResponse.json(
          {
            approvalRequired: true,
            requestId: approvalReq.id,
            message: 'تم إرسال طلب تعديل سياسة النقاشات للاعتماد بنجاح.',
            request: approvalReq,
          },
          { status: 202 }
        );
      }
    }

    try {
      const updatedCourse = inMemoryStore.toggleCourseComments(courseId, enabled, {
        id: user.id,
        role: user.role,
      });
      return HttpResponse.json(
        {
          courseId: updatedCourse.id,
          commentsEnabled: updatedCourse.commentsEnabled,
        },
        { status: 200 }
      );
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة تعديل حالة النقاشات' },
        { status: 400 }
      );
    }
  }),
];
