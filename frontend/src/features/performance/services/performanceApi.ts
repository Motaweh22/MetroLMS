import { apiClient, type RequestOptions } from '@/core/api/apiClient';
import type { CoursePerformanceReportDTO } from '@/core/performance/types';

/**
 * Lecturer Course Performance API Service Layer
 * (Increment 11 Phase 5D)
 */
export const performanceApi = {
  /**
   * Fetches the cohort performance report for a specific course.
   * Scoped to assigned instructors and system administrators.
   */
  async getCoursePerformanceReport(
    courseId: string,
    options?: RequestOptions
  ): Promise<CoursePerformanceReportDTO> {
    return apiClient<CoursePerformanceReportDTO>(
      `/api/lecturer/courses/${encodeURIComponent(courseId)}/performance`,
      {
        method: 'GET',
        ...options,
      }
    );
  },
};
