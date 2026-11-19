import { apiClient } from '@/core/api/apiClient';
import type {
  Course,
  CourseFilterParams,
  CourseEnrollment,
  EnrollmentResponse,
  EnrollmentStatusResponse,
} from '@/core/courses/types';

/**
 * Course Service API Client
 *
 * Communicates with course catalog and enrollment endpoints.
 * Ready for future production backend replacement without UI changes.
 */
export const coursesApi = {
  /**
   * Fetch courses catalog with optional search, level filter, and sorting
   */
  async getCourses(params?: CourseFilterParams): Promise<Course[]> {
    const queryParams: Record<string, string> = {};
    if (params?.search) queryParams.search = params.search;
    if (params?.level && params.level !== 'all') queryParams.level = params.level;
    if (params?.sortBy) queryParams.sortBy = params.sortBy;

    const res = await apiClient<Course[] | { courses: Course[] }>('/api/courses', {
      method: 'GET',
      params: queryParams,
    });
    return Array.isArray(res) ? res : (res?.courses ?? []);
  },

  /**
   * Fetch single course details by ID
   */
  async getCourseById(courseId: string): Promise<Course> {
    const res = await apiClient<Course | { course: Course }>(
      `/api/courses/${encodeURIComponent(courseId)}`,
      {
        method: 'GET',
      }
    );
    return 'course' in res ? res.course : res;
  },

  /**
   * Enroll the currently authenticated trainee in a course
   */
  async enrollCourse(courseId: string): Promise<EnrollmentResponse> {
    return apiClient<EnrollmentResponse>(
      `/api/courses/${encodeURIComponent(courseId)}/enrollments`,
      {
        method: 'POST',
      }
    );
  },

  /**
   * Check enrollment status for a single course
   */
  async getCourseEnrollment(courseId: string): Promise<EnrollmentStatusResponse> {
    return apiClient<EnrollmentStatusResponse>(
      `/api/courses/${encodeURIComponent(courseId)}/enrollment`,
      {
        method: 'GET',
      }
    );
  },

  /**
   * Retrieve all enrollments for the current trainee
   */
  async getMyEnrollments(): Promise<CourseEnrollment[]> {
    const res = await apiClient<CourseEnrollment[] | { enrollments: CourseEnrollment[] }>('/api/enrollments/my', {
      method: 'GET',
    });
    return Array.isArray(res) ? res : (res?.enrollments ?? []);
  },

  /**
   * Retrieve all enriched enrolled courses for the current trainee
   */
  async getMyEnrolledCourses(): Promise<import('@/core/courses/types').EnrolledCourseDetail[]> {
    const res = await apiClient<
      | import('@/core/courses/types').EnrolledCourseDetail[]
      | { enrollments: import('@/core/courses/types').EnrolledCourseDetail[] }
    >('/api/enrollments/my?enriched=true', {
      method: 'GET',
    });
    return Array.isArray(res) ? res : (res?.enrollments ?? []);
  },

  /**
   * Update or override course-specific WhatsApp contacts (Admin only)
   */
  async updateCourseWhatsAppContacts(
    courseId: string,
    contacts: Array<{ name: string; number: string; role?: string }> | null
  ): Promise<Course> {
    return apiClient<Course>(`/api/courses/${encodeURIComponent(courseId)}/whatsapp-contacts`, {
      method: 'PUT',
      body: JSON.stringify({ contacts }),
    });
  },

  /**
   * Assign primary course lecturer and co-lecturers (Admin only)
   */
  async assignCourseInstructors(
    courseId: string,
    payload: { lecturerId: string; coLecturers?: string[] }
  ): Promise<Course> {
    return apiClient<Course>(`/api/courses/${encodeURIComponent(courseId)}/instructors`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async getCourseEnrollments(
    courseId: string
  ): Promise<import('@/core/courses/types').CourseEnrollmentMember[]> {
    const res = await apiClient<{ enrollments: import('@/core/courses/types').CourseEnrollmentMember[] }>(
      `/api/courses/${encodeURIComponent(courseId)}/enrollments`,
      { method: 'GET' }
    );
    return res?.enrollments ?? [];
  },

  async bulkAddCourseEnrollments(
    courseId: string,
    userIds: number[]
  ): Promise<{ addedCount: number; enrollments: import('@/core/courses/types').CourseEnrollmentMember[] }> {
    return apiClient(`/api/courses/${encodeURIComponent(courseId)}/enrollments/bulk-add`, {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    });
  },

  async revokeDirectCourseEnrollment(
    courseId: string,
    userId: number | string
  ): Promise<{ revoked: boolean; hasActiveAccess: boolean }> {
    return apiClient(
      `/api/courses/${encodeURIComponent(courseId)}/enrollments/${encodeURIComponent(String(userId))}/direct-grant`,
      { method: 'DELETE' }
    );
  },

  async getCourseLinkedGroups(
    courseId: string
  ): Promise<import('@/core/courses/types').CourseLinkedGroupSummary[]> {
    const res = await apiClient<{ groups: import('@/core/courses/types').CourseLinkedGroupSummary[] }>(
      `/api/lecturer/courses/${encodeURIComponent(courseId)}/groups`,
      { method: 'GET' }
    );
    return res?.groups ?? [];
  },

  async getCourseQrSettings(
    courseId: string
  ): Promise<import('@/core/courses/types').CourseQrSettings> {
    const res = await apiClient<{ qrSettings: import('@/core/courses/types').CourseQrSettings }>(
      `/api/lecturer/courses/${encodeURIComponent(courseId)}/qr-settings`,
      { method: 'GET' }
    );
    return res.qrSettings;
  },

  async updateCourseQrSettings(
    courseId: string,
    payload: { isEnabled?: boolean; qrMode?: 'view_only' | 'auto_enroll'; expiresAt?: string | null }
  ): Promise<import('@/core/courses/types').CourseQrSettings> {
    const res = await apiClient<{ qrSettings: import('@/core/courses/types').CourseQrSettings }>(
      `/api/lecturer/courses/${encodeURIComponent(courseId)}/qr-settings`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
    return res.qrSettings;
  },

  async rotateCourseQrToken(
    courseId: string
  ): Promise<import('@/core/courses/types').CourseQrSettings> {
    const res = await apiClient<{ qrSettings: import('@/core/courses/types').CourseQrSettings }>(
      `/api/lecturer/courses/${encodeURIComponent(courseId)}/qr-settings/rotate`,
      { method: 'POST' }
    );
    return res.qrSettings;
  },

  async getCourseQrJoinInfo(token: string): Promise<{
    course: {
      id: string;
      title: string;
      description?: string;
      lecturerName: string;
      lifecycleStatus: string;
      accessMode: import('@/core/courses/types').CourseAccessMode;
    };
    qrSettings: {
      isEnabled: boolean;
      qrMode: import('@/core/courses/types').CourseQrMode;
      expiresAt: string | null;
      isExpired: boolean;
    };
  }> {
    return apiClient(`/api/courses/join/${encodeURIComponent(token)}/info`, { method: 'GET' });
  },

  async joinCourseByQr(token: string): Promise<{
    courseId: string;
    qrMode: import('@/core/courses/types').CourseQrMode;
    enrolled: boolean;
  }> {
    return apiClient('/api/courses/join-by-qr', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
};
