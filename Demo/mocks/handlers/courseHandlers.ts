import { http, HttpResponse } from 'msw';
import { inMemoryStore } from '../store/inMemoryStore';
import type { CourseLevel } from '@/core/courses/types';

/**
 * MSW v2 REST Interceptors for Course Catalog & Course Details
 *
 * Provides realistic mock API responses with query filtering,
 * level segmentation, search filtering, and 404 handling.
 */
export const courseHandlers = [
  // GET /api/courses
  http.get('/api/courses', ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || undefined;
    const level = (url.searchParams.get('level') as CourseLevel | 'all') || undefined;
    const sortBy = (url.searchParams.get('sortBy') as 'rating' | 'enrollment' | 'newest') || undefined;

    const results = inMemoryStore.getCourses({ search, level, sortBy });
    return HttpResponse.json(results);
  }),

  // GET /api/courses/:courseId
  http.get('/api/courses/:courseId', ({ params }) => {
    const { courseId } = params;

    if (!courseId) {
      return HttpResponse.json(
        { message: 'معرف الكورس مطلوب' },
        { status: 400 }
      );
    }

    const course = inMemoryStore.getCourseById(String(courseId));

    if (!course) {
      return HttpResponse.json(
        { message: 'الكورس غير موجود' },
        { status: 404 }
      );
    }

    return HttpResponse.json(course);
  }),
];
