import { http, HttpResponse } from 'msw';
import { inMemoryStore, MockStoreError } from '../store/inMemoryStore';
import { resolveAuthenticatedUser } from './resolveUser';
import type { RecordActivityPayload } from '@/features/learning-player/types';

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
    }

    try {
      const progress = inMemoryStore.getCourseProgress(user.id, courseId as string);
      return HttpResponse.json({ progress }, { status: 200 });
    } catch (err) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json({ message: 'حدث خطأ غير متوقع' }, { status: 500 });
    }
  }),

  // POST /api/courses/:courseId/items/:itemId/activity
  http.post('/api/courses/:courseId/items/:itemId/activity', async ({ request, params }) => {
    const { courseId, itemId } = params;
    const user = resolveAuthenticatedUser(request);

    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول أولاً لتسجيل النشاط' },
        { status: 401 }
      );
    }

    if (!courseId || !itemId) {
      return HttpResponse.json(
        { message: 'معرف الدورة والدرس مطلوبان' },
        { status: 400 }
      );
    }

    let payload: Partial<RecordActivityPayload> = {};
    try {
      payload = (await request.json()) as Partial<RecordActivityPayload>;
    } catch {
      payload = {};
    }

    try {
      const updatedItem = inMemoryStore.recordLessonActivity({
        userId: user.id,
        courseId: courseId as string,
        itemId: itemId as string,
        activity: payload,
        userRole: user.role,
      });

      return HttpResponse.json({ item: updatedItem }, { status: 200 });
    } catch (err) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json({ message: 'حدث خطأ غير متوقع' }, { status: 500 });
    }
  }),

  // POST /api/courses/:courseId/items/:itemId/complete
  http.post('/api/courses/:courseId/items/:itemId/complete', async ({ request, params }) => {
    const { courseId, itemId } = params;
    const user = resolveAuthenticatedUser(request);

    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول أولاً لإكمال الدرس' },
        { status: 401 }
      );
    }

    if (!courseId || !itemId) {
      return HttpResponse.json(
        { message: 'معرف الدورة والدرس مطلوبان' },
        { status: 400 }
      );
    }

    try {
      const result = inMemoryStore.markLessonComplete({
        userId: user.id,
        courseId: courseId as string,
        itemId: itemId as string,
        userRole: user.role,
      });

      return HttpResponse.json(result, { status: 200 });
    } catch (err) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json({ message: 'حدث خطأ غير متوقع' }, { status: 500 });
    }
  }),
];
