import { apiClient, type RequestOptions } from '@/core/api/apiClient';
import type {
  CourseComment,
  CommentFilterParams,
  CommentModerationSummaryDTO,
  CommentReportReason,
  CommentModerationActionResponse,
} from '@/core/comments/types';

/**
 * Centrally Managed Comment Moderation & Discussion API Service Layer
 * Grounded in Increment 11 Phase 5A specifications.
 */
export const commentsApi = {
  /**
   * Fetches the queue of reported comments across all courses (Admin & Assistant Admin)
   */
  async getReportedComments(options?: RequestOptions): Promise<CourseComment[]> {
    return apiClient<CourseComment[]>('/api/admin/comments/reported', {
      method: 'GET',
      ...options,
    });
  },

  /**
   * Fetches all comments with search and course filter support
   */
  async getAllComments(
    params?: CommentFilterParams,
    options?: RequestOptions
  ): Promise<CourseComment[]> {
    const searchParams = new URLSearchParams();
    if (params?.query && params.query.trim()) {
      searchParams.set('query', params.query.trim());
    }
    if (params?.courseId) {
      searchParams.set('courseId', params.courseId);
    }
    if (params?.reportedOnly) {
      searchParams.set('reportedOnly', 'true');
    }

    const qs = searchParams.toString();
    const endpoint = `/api/admin/comments${qs ? `?${qs}` : ''}`;
    return apiClient<CourseComment[]>(endpoint, {
      method: 'GET',
      ...options,
    });
  },

  /**
   * Fetches high-level comment moderation summary metrics
   */
  async getCommentModerationSummary(
    options?: RequestOptions
  ): Promise<CommentModerationSummaryDTO> {
    return apiClient<CommentModerationSummaryDTO>('/api/admin/comments/summary', {
      method: 'GET',
      ...options,
    });
  },

  /**
   * Fetches all active comments for a specific course discussion
   */
  async getCourseComments(
    courseId: string,
    options?: RequestOptions
  ): Promise<CourseComment[]> {
    return apiClient<CourseComment[]>(`/api/courses/${courseId}/comments`, {
      method: 'GET',
      ...options,
    });
  },

  /**
   * Posts a new comment to a course discussion
   */
  async createComment(
    courseId: string,
    text: string,
    options?: RequestOptions
  ): Promise<CourseComment> {
    return apiClient<CourseComment>(`/api/courses/${courseId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
      ...options,
    });
  },

  /**
   * Submits an inappropriate comment report
   */
  async reportComment(
    commentId: string,
    reason: CommentReportReason,
    notes?: string,
    options?: RequestOptions
  ): Promise<CourseComment> {
    return apiClient<CourseComment>(`/api/comments/${commentId}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason, notes }),
      ...options,
    });
  },

  /**
   * Permanently deletes a comment (Direct execution for Admin; Approval request for Assistant Admin)
   */
  async deleteComment(
    commentId: string,
    options?: RequestOptions
  ): Promise<CommentModerationActionResponse> {
    return apiClient<CommentModerationActionResponse>(`/api/admin/comments/${commentId}`, {
      method: 'DELETE',
      ...options,
    });
  },

  /**
   * Course-scoped comment deletion for instructors
   */
  async deleteCourseComment(
    courseId: string,
    commentId: string,
    options?: RequestOptions
  ): Promise<CommentModerationActionResponse> {
    return apiClient<CommentModerationActionResponse>(`/api/courses/${courseId}/comments/${commentId}`, {
      method: 'DELETE',
      ...options,
    });
  },

  /**
   * Clears report flag on a comment (Non-destructive triage action)
   */
  async ignoreCommentReport(
    commentId: string,
    options?: RequestOptions
  ): Promise<CourseComment> {
    return apiClient<CourseComment>(`/api/admin/comments/${commentId}/ignore-report`, {
      method: 'PATCH',
      ...options,
    });
  },

  /**
   * Toggles course discussion policy (enabled/disabled)
   */
  async toggleCourseComments(
    courseId: string,
    commentsEnabled?: boolean,
    options?: RequestOptions
  ): Promise<{ courseId: string; commentsEnabled: boolean; approvalRequired?: boolean; requestId?: string }> {
    return apiClient<{ courseId: string; commentsEnabled: boolean; approvalRequired?: boolean; requestId?: string }>(
      `/api/admin/courses/${courseId}/comments-toggle`,
      {
        method: 'PATCH',
        body: JSON.stringify({ commentsEnabled }),
        ...options,
      }
    );
  },
};
