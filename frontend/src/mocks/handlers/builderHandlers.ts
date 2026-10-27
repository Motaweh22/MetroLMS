import { http, HttpResponse } from 'msw';
import { inMemoryStore, MockStoreError } from '../store/inMemoryStore';
import { resolveAuthenticatedUser } from './resolveUser';
import type { Course } from '@/core/courses/types';

/**
 * MSW v2 REST Interceptors for Lecturer Workspace & Course Builder
 */
export const builderHandlers = [
  // 1. GET /api/lecturer/courses — List assigned courses for authenticated lecturer
  http.get('/api/lecturer/courses', ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول للوصول إلى لوحة المحاضر' },
        { status: 401 }
      );
    }

    try {
      const courses = inMemoryStore.getLecturerCourses(user);
      return HttpResponse.json(courses, { status: 200 });
    } catch (err) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json({ message: 'خطأ غير متوقع في الخادم' }, { status: 500 });
    }
  }),

  // 2. GET /api/lecturer/courses/:courseId — Load course for editing in Course Builder
  http.get('/api/lecturer/courses/:courseId', ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لتعديل المقرر' },
        { status: 401 }
      );
    }

    const { courseId } = params as { courseId: string };

    try {
      const course = inMemoryStore.getCourseForEditing(courseId, user);
      return HttpResponse.json(course, { status: 200 });
    } catch (err) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json({ message: 'خطأ غير متوقع' }, { status: 500 });
    }
  }),

  // 3. POST /api/lecturer/courses — Create new course
  http.post('/api/lecturer/courses', async ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لإنشاء مقرر' },
        { status: 401 }
      );
    }

    try {
      const body = (await request.json()) as {
        title: string;
        level: Course['level'];
        description: string;
      };

      if (!body.title || body.title.trim().length < 5) {
        return HttpResponse.json(
          { message: 'عنوان الدورة قصير جداً — 5 أحرف على الأقل' },
          { status: 400 }
        );
      }

      const created = inMemoryStore.createCourse(body, user);
      return HttpResponse.json(created, { status: 201 });
    } catch (err) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json({ message: 'فشل في إنشاء الدورة' }, { status: 500 });
    }
  }),

  // 4. PUT /api/lecturer/courses/:courseId/draft — Save draft changes
  http.put('/api/lecturer/courses/:courseId/draft', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لحفظ التعديلات' },
        { status: 401 }
      );
    }

    const { courseId } = params as { courseId: string };

    try {
      const body = (await request.json()) as Partial<Course>;
      const result = inMemoryStore.saveCourseDraft(courseId, body, user);
      return HttpResponse.json(result, { status: 200 });
    } catch (err) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json({ message: 'فشل في حفظ المسودة' }, { status: 500 });
    }
  }),

  // 5. POST /api/lecturer/courses/:courseId/reset-lab — Reset Content Testing Lab to initial fixture state
  http.post('/api/lecturer/courses/:courseId/reset-lab', ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لإعادة ضبط المعمل' },
        { status: 401 }
      );
    }

    const { courseId } = params as { courseId: string };

    try {
      const resetCourse = inMemoryStore.resetContentLabCourse(courseId, user);
      return HttpResponse.json(
        {
          course: resetCourse,
          message: 'تمت إعادة ضبط معمل تجربة المحتوى إلى الحالة الافتراضية بنجاح.',
        },
        { status: 200 }
      );
    } catch (err) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json({ message: 'فشل في إعادة ضبط المعمل' }, { status: 500 });
    }
  }),
];
