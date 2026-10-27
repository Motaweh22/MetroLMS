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

    return apiClient<Course[]>('/api/courses', {
      method: 'GET',
      params: queryParams,
    });
  },

  /**
   * Fetch single course details by ID
   */
  async getCourseById(courseId: string): Promise<Course> {
    return apiClient<Course>(`/api/courses/${encodeURIComponent(courseId)}`, {
      method: 'GET',
    });
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
    return apiClient<CourseEnrollment[]>('/api/enrollments/my', {
      method: 'GET',
    });
  },

  /**
   * Retrieve all enriched enrolled courses for the current trainee
   */
  async getMyEnrolledCourses(): Promise<import('@/core/courses/types').EnrolledCourseDetail[]> {
    return apiClient<import('@/core/courses/types').EnrolledCourseDetail[]>(
      '/api/enrollments/my?enriched=true',
      {
        method: 'GET',
      }
    );
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
};
