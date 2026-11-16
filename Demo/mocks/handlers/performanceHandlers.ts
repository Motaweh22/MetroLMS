import { http, HttpResponse } from 'msw';
import { inMemoryStore, MockStoreError } from '../store/inMemoryStore';
import { resolveAuthenticatedUser } from './resolveUser';

/**
 * Centrally Managed MSW v2 Handlers for Lecturer Course Performance, Trainee Nudges & Course WhatsApp Overrides
 * (Increment 11 Phase 5D)
 */
export const performanceHandlers = [
  // GET /api/lecturer/courses/:courseId/performance
  http.get('/api/lecturer/courses/:courseId/performance', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const courseId = params.courseId as string;

    try {
      const report = inMemoryStore.getCoursePerformanceReport(courseId, {
        id: user.id,
        role: user.role,
      });
      return HttpResponse.json(report, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة استعراض تقرير أداء المقرر' },
        { status: 500 }
      );
    }
  }),

  // GET /api/courses/:courseId/whatsapp-contacts
  http.get('/api/courses/:courseId/whatsapp-contacts', async ({ params }) => {
    const courseId = params.courseId as string;
    const contacts = inMemoryStore.resolveCourseWhatsAppContacts(courseId);
    return HttpResponse.json({ contacts }, { status: 200 });
  }),

  // PUT /api/courses/:courseId/whatsapp-contacts (Administrator only)
  http.put('/api/courses/:courseId/whatsapp-contacts', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin') {
      return HttpResponse.json(
        { message: 'غير مصرح: إدارة وتخصيص أرقام واتساب للمقرر مقتصرة على مدير النظام فقط' },
        { status: 403 }
      );
    }

    const courseId = params.courseId as string;
    try {
      const body = (await request.json()) as {
        contacts?: Array<{ name: string; number: string; role?: string }> | null;
      };
      const updatedCourse = inMemoryStore.updateCourseWhatsAppContacts(courseId, body.contacts, {
        id: user.id,
        role: user.role,
      });
      return HttpResponse.json(updatedCourse, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة تحديث أرقام التواصل للمقرر' },
        { status: 500 }
      );
    }
  }),

  // PUT /api/courses/:courseId/instructors (Administrator only)
  http.put('/api/courses/:courseId/instructors', async ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'غير مصرح: يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin') {
      return HttpResponse.json(
        { message: 'غير مصرح: تعيين وإسناد محاضري المقرر مقتصر على مدير النظام فقط' },
        { status: 403 }
      );
    }

    const courseId = params.courseId as string;
    try {
      const body = (await request.json()) as {
        lecturerId: string;
        coLecturers?: string[];
      };
      const updatedCourse = inMemoryStore.assignCourseInstructors(courseId, body, {
        id: user.id,
        role: user.role,
      });
      return HttpResponse.json(updatedCourse, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشلت معالجة تعيين وإسناد محاضري المقرر' },
        { status: 500 }
      );
    }
  }),
];

