import { http, HttpResponse } from 'msw';
import { inMemoryStore } from '../store/inMemoryStore';
import { resolveAuthenticatedUser } from './resolveUser';

/**
 * MSW v2 REST Interceptors for Dashboard, My Courses, and Profile
 */
export const dashboardHandlers = [
  // Adaptive Dashboard Data based on authenticated session role
  http.get('/api/dashboard', ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لعرض لوحة المتابعة' },
        { status: 401 }
      );
    }

    const data = inMemoryStore.getDashboardData(user);
    return HttpResponse.json(data, { status: 200 });
  }),

  // User Profile Data
  http.get('/api/profile', ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لعرض الملف الشخصي' },
        { status: 401 }
      );
    }

    const enrolledCourses = inMemoryStore.getMyEnrolledCourses(user.id);
    const completedCoursesCount = enrolledCourses.filter((c) => c.progress.isCompleted).length;

    return HttpResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          jobTitle: user.jobTitle,
          initials: user.initials,
          status: 'active',
        },
        stats: {
          totalLearningHours: 24,
          enrolledCoursesCount: enrolledCourses.length,
          completedCoursesCount,
        },
      },
      { status: 200 }
    );
  }),
];
