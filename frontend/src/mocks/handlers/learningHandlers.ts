import { http, HttpResponse } from 'msw';
import { inMemoryStore, MockStoreError, AttemptAmbiguityError } from '../store/inMemoryStore';
import { resolveAuthenticatedUser } from './resolveUser';
import type { RecordActivityPayload } from '@/features/learning-player/types';

// Reusable Activity Handler (MFR-23, MFR-42)
async function handleRecordActivity({
  request,
  params,
}: {
  request: Request;
  params: Record<string, string | readonly string[] | undefined>;
}) {
  const { courseId, itemId } = params;
  const user = resolveAuthenticatedUser(request);

  if (!user) {
    return HttpResponse.json(
      { message: 'يجب تسجيل الدخول أولاً لتسجيل النشاط' },
      { status: 401 }
    );
  }

  let payload: Partial<RecordActivityPayload> = {};
  try {
    payload = (await request.json()) as Partial<RecordActivityPayload>;
  } catch {
    payload = {};
  }

  const effectiveItemId = (itemId as string) || (payload.itemId as string);

  if (!courseId || !effectiveItemId) {
    return HttpResponse.json(
      { message: 'معرف الدورة والدرس مطلوبان' },
      { status: 400 }
    );
  }

  try {
    const url = new URL(request.url);
    const attemptId = payload.attemptId || url.searchParams.get('attemptId') || undefined;
    const groupId = payload.groupId || url.searchParams.get('groupId') || undefined;
    const cycleId = payload.cycleId || url.searchParams.get('cycleId') || undefined;

    const updatedItem = inMemoryStore.recordLessonActivity({
      userId: user.id,
      courseId: courseId as string,
      itemId: effectiveItemId,
      activity: payload,
      userRole: user.role,
      attemptId,
      groupId,
      cycleId,
    });

    return HttpResponse.json({ item: updatedItem }, { status: 200 });
  } catch (err) {
    if (err instanceof AttemptAmbiguityError) {
      return HttpResponse.json(
        {
          message: err.message,
          code: err.code || 'AMBIGUOUS_ATTEMPT_CONTEXT',
          requiresAttemptSelection: true,
          eligibleAttempts: err.eligibleAttempts,
        },
        { status: err.status }
      );
    }
    if (err instanceof MockStoreError) {
      return HttpResponse.json({ message: err.message, code: err.code }, { status: err.status });
    }
    return HttpResponse.json({ message: 'حدث خطأ غير متوقع' }, { status: 500 });
  }
}

// Reusable Complete Handler (MFR-23, MFR-42)
async function handleCompleteLesson({
  request,
  params,
}: {
  request: Request;
  params: Record<string, string | readonly string[] | undefined>;
}) {
  const { courseId, itemId } = params;
  const user = resolveAuthenticatedUser(request);

  if (!user) {
    return HttpResponse.json(
      { message: 'يجب تسجيل الدخول أولاً لإكمال الدرس' },
      { status: 401 }
    );
  }

  let payload: { attemptId?: string; groupId?: string; cycleId?: string; itemId?: string } = {};
  try {
    payload = (await request.json()) as { attemptId?: string; groupId?: string; cycleId?: string; itemId?: string };
  } catch {
    payload = {};
  }

  const effectiveItemId = (itemId as string) || (payload.itemId as string);

  if (!courseId || !effectiveItemId) {
    return HttpResponse.json(
      { message: 'معرف الدورة والدرس مطلوبان' },
      { status: 400 }
    );
  }

  try {
    const url = new URL(request.url);
    const attemptId = payload.attemptId || url.searchParams.get('attemptId') || undefined;
    const groupId = payload.groupId || url.searchParams.get('groupId') || undefined;
    const cycleId = payload.cycleId || url.searchParams.get('cycleId') || undefined;

    const result = inMemoryStore.markLessonComplete({
      userId: user.id,
      courseId: courseId as string,
      itemId: effectiveItemId,
      userRole: user.role,
      attemptId,
      groupId,
      cycleId,
    });

    return HttpResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof AttemptAmbiguityError) {
      return HttpResponse.json(
        {
          message: err.message,
          code: err.code || 'AMBIGUOUS_ATTEMPT_CONTEXT',
          requiresAttemptSelection: true,
          eligibleAttempts: err.eligibleAttempts,
        },
        { status: err.status }
      );
    }
    if (err instanceof MockStoreError) {
      return HttpResponse.json({ message: err.message, code: err.code }, { status: err.status });
    }
    return HttpResponse.json({ message: 'حدث خطأ غير متوقع' }, { status: 500 });
  }
}

export const learningHandlers = [
  // GET /api/courses/:courseId/progress
  http.get('/api/courses/:courseId/progress', async ({ request, params }) => {
    const { courseId } = params;
    const user = resolveAuthenticatedUser(request);

    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول أولاً للوصول إلى بيانات التقدم' },
        { status: 401 }
      );
    }

    if (!courseId) {
      return HttpResponse.json(
        { message: 'معرف الدورة التدريبية مطلوب' },
        { status: 400 }
      );
    }

    // Role & Enrollment check: Trainees must be enrolled
    if (user.role === 'user') {
      const enrollment = inMemoryStore.getCourseEnrollment(courseId as string, user.id);
      if (!enrollment) {
        return HttpResponse.json(
          { message: 'عذراً، يجب التسجيل في الدورة التدريبية أولاً لعرض مسار التعلم' },
          { status: 403 }
        );
      }

      // Access Mode check (MFR-23, MFR-42): Denied when accessMode is 'none'
      const accessMode = inMemoryStore.resolveCourseAccess(user.id, courseId as string);
      if (accessMode === 'none') {
        return HttpResponse.json(
          {
            code: 'COURSE_ACCESS_EXPIRED',
            message: 'انتهت صلاحية الوصول إلى هذا المقرر التدريبي بعد انتهاء المهلة المحددة للمجموعة التدريبية',
          },
          { status: 403 }
        );
      }
    }

    try {
      const url = new URL(request.url);
      const attemptId = url.searchParams.get('attemptId') || undefined;
      const groupId = url.searchParams.get('groupId') || undefined;
      const cycleId = url.searchParams.get('cycleId') || undefined;

      const progress = inMemoryStore.getCourseProgress(user.id, courseId as string, {
        attemptId,
        groupId,
        cycleId,
      });

      if (progress.requiresAttemptSelection) {
        return HttpResponse.json(
          {
            requiresAttemptSelection: true,
            eligibleAttempts: progress.eligibleAttempts || [],
            message: 'يرجى اختيار سياق التدريب المطلوب للمتابعة',
            progress,
          },
          { status: 200 }
        );
      }

      return HttpResponse.json({ progress }, { status: 200 });
    } catch (err) {
      if (err instanceof AttemptAmbiguityError) {
        return HttpResponse.json(
          {
            message: err.message,
            code: err.code || 'AMBIGUOUS_ATTEMPT_CONTEXT',
            requiresAttemptSelection: true,
            eligibleAttempts: err.eligibleAttempts,
          },
          { status: err.status }
        );
      }
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message, code: err.code }, { status: err.status });
      }
      return HttpResponse.json({ message: 'حدث خطأ غير متوقع' }, { status: 500 });
    }
  }),

  // POST /api/courses/:courseId/items/:itemId/activity
  http.post('/api/courses/:courseId/items/:itemId/activity', handleRecordActivity),
  // POST /api/courses/:courseId/lessons/:itemId/activity (contract alias)
  http.post('/api/courses/:courseId/lessons/:itemId/activity', handleRecordActivity),
  // POST /api/courses/:courseId/activity (direct endpoint)
  http.post('/api/courses/:courseId/activity', handleRecordActivity),

  // POST /api/courses/:courseId/items/:itemId/complete
  http.post('/api/courses/:courseId/items/:itemId/complete', handleCompleteLesson),
  // POST /api/courses/:courseId/lessons/:itemId/complete (contract alias)
  http.post('/api/courses/:courseId/lessons/:itemId/complete', handleCompleteLesson),
  // POST /api/courses/:courseId/complete (direct endpoint)
  http.post('/api/courses/:courseId/complete', handleCompleteLesson),
];
