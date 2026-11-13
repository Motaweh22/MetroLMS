import { apiClient } from '@/core/api/apiClient';
import type {
  CourseProgressResponse,
  RecordActivityPayload,
  LessonProgress,
  CompleteLessonPayload,
  CompleteLessonResponse,
} from '../types';

/**
 * Learning Player Service API Client
 *
 * Communicates with course progress and lesson completion endpoints.
 * Ready for future production backend replacement without restructuring UI components.
 */
export const learningApi = {
  /**
   * Fetch course progress for the current authenticated user
   */
  async getCourseProgress(
    courseId: string,
    options?: { attemptId?: string; groupId?: string; cycleId?: string }
  ): Promise<CourseProgressResponse> {
    const params = new URLSearchParams();
    if (options?.attemptId) params.set('attemptId', options.attemptId);
    if (options?.groupId) params.set('groupId', options.groupId);
    if (options?.cycleId) params.set('cycleId', options.cycleId);
    const queryString = params.toString() ? `?${params.toString()}` : '';

    return apiClient<CourseProgressResponse>(
      `/api/courses/${encodeURIComponent(courseId)}/progress${queryString}`,
      {
        method: 'GET',
      }
    );
  },

  /**
   * Record watch duration, furthest watched position, or reading activity
   */
  async recordActivity(
    courseId: string,
    payload: RecordActivityPayload
  ): Promise<{ item: LessonProgress }> {
    return apiClient<{ item: LessonProgress }>(
      `/api/courses/${encodeURIComponent(courseId)}/items/${encodeURIComponent(payload.itemId)}/activity`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  /**
   * Authoritatively mark a lesson item as completed
   */
  async completeLesson(
    courseId: string,
    payload: CompleteLessonPayload
  ): Promise<CompleteLessonResponse> {
    return apiClient<CompleteLessonResponse>(
      `/api/courses/${encodeURIComponent(courseId)}/items/${encodeURIComponent(payload.itemId)}/complete`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },
};
