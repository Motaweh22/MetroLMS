import { http, HttpResponse } from 'msw';
import { inMemoryStore, MockStoreError } from '../store/inMemoryStore';
import { SYNTHETIC_DEMO_ACCOUNTS } from '../fixtures/mockUsers';
import type { User } from '@/core/auth/types';

/**
 * Helper to authenticate request from Authorization Bearer token header
 */
function resolveAuthenticatedUser(request: Request): User | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  // Match token to synthetic accounts
  const matched = Object.values(SYNTHETIC_DEMO_ACCOUNTS).find((acc) =>
    token.includes(acc.user.id)
  );

  if (matched) {
    return matched.user;
  }

  // Fallback for mock tokens generated during login
  if (token.startsWith('mock_jwt_')) {
    // Check if token specifies a known role
    if (token.includes('usr_admin')) return SYNTHETIC_DEMO_ACCOUNTS.admin.user;
    if (token.includes('usr_lect')) return SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;
    return SYNTHETIC_DEMO_ACCOUNTS.trainee.user;
  }

  // Fallback for valid test session tokens
  if (token === 'valid-test-token') {
    return SYNTHETIC_DEMO_ACCOUNTS.trainee.user;
  }

  return null;
}

/**
 * MSW v2 REST Interceptors for Course Enrollment Mutation & Status
 */
export const enrollmentHandlers = [
  // POST /api/courses/:courseId/enrollments (Primary REST endpoint)
  http.post('/api/courses/:courseId/enrollments', async ({ request, params }) => {
    const { courseId } = params;
    const user = resolveAuthenticatedUser(request);

    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول أولاً لإتمام التسجيل في الدورة' },
        { status: 401 }
      );
    }

    if (!courseId) {
      return HttpResponse.json(
        { message: 'معرف الدورة التدريبية مطلوب' },
        { status: 400 }
      );
    }

    try {
      const result = inMemoryStore.enrollUser({
        courseId: String(courseId),
        userId: user.id,
        userRole: user.role,
      });

      return HttpResponse.json(result, { status: 201 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json(
          { message: err.message },
          { status: err.status }
        );
      }
      return HttpResponse.json(
        { message: 'حدث خطأ غير متوقع أثناء إتمام التسجيل' },
        { status: 500 }
      );
    }
  }),

  // POST /api/courses/:courseId/enroll (Alias support)
  http.post('/api/courses/:courseId/enroll', async ({ request, params }) => {
    const { courseId } = params;
    const user = resolveAuthenticatedUser(request);

    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول أولاً لإتمام التسجيل في الدورة' },
        { status: 401 }
      );
    }

    if (!courseId) {
      return HttpResponse.json(
        { message: 'معرف الدورة التدريبية مطلوب' },
        { status: 400 }
      );
    }

    try {
      const result = inMemoryStore.enrollUser({
        courseId: String(courseId),
        userId: user.id,
        userRole: user.role,
      });

      return HttpResponse.json(result, { status: 201 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json(
          { message: err.message },
          { status: err.status }
        );
      }
      return HttpResponse.json(
        { message: 'حدث خطأ غير متوقع أثناء إتمام التسجيل' },
        { status: 500 }
      );
    }
  }),

  // GET /api/courses/:courseId/enrollment
  http.get('/api/courses/:courseId/enrollment', ({ request, params }) => {
    const { courseId } = params;
    const user = resolveAuthenticatedUser(request);

    if (!user) {
      return HttpResponse.json({
        isEnrolled: false,
        enrollment: null,
      });
    }

    if (!courseId) {
      return HttpResponse.json(
        { message: 'معرف الدورة التدريبية مطلوب' },
        { status: 400 }
      );
    }

    const enrollment = inMemoryStore.getCourseEnrollment(String(courseId), user.id);

    return HttpResponse.json({
      isEnrolled: !!enrollment,
      enrollment: enrollment || null,
    });
  }),

  // GET /api/enrollments/my
  http.get('/api/enrollments/my', ({ request }) => {
    const user = resolveAuthenticatedUser(request);

    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول أولاً للوصول إلى بيانات التسجيل' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    if (url.searchParams.get('enriched') === 'true') {
      const enrichedCourses = inMemoryStore.getMyEnrolledCourses(user.id);
      return HttpResponse.json(enrichedCourses, { status: 200 });
    }

    const enrollments = inMemoryStore.getUserEnrollments(user.id);
    return HttpResponse.json(enrollments);
  }),
];
