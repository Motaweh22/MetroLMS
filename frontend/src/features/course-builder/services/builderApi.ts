import { apiClient } from '@/core/api/apiClient';
import type { Course, CourseLevel } from '@/core/courses/types';

export interface CreateCourseRequest {
  title: string;
  level: CourseLevel;
  description: string;
}

export interface SaveDraftResponse {
  course: Course;
  isPublishedPreserved: boolean;
}

export const builderApi = {
  /**
   * Fetch courses assigned to the current lecturer (or all courses for admins)
   */
  async getLecturerCourses(): Promise<(Course & { hasDraft?: boolean })[]> {
    return apiClient<(Course & { hasDraft?: boolean })[]>('/api/lecturer/courses', {
      method: 'GET',
    });
  },

  /**
   * Fetch course structure for editing in Course Builder
   */
  async getCourseForEditing(courseId: string): Promise<Course> {
    return apiClient<Course>(`/api/lecturer/courses/${encodeURIComponent(courseId)}`, {
      method: 'GET',
    });
  },

  /**
   * Create a new course in draft status
   */
  async createCourse(data: CreateCourseRequest): Promise<Course> {
    return apiClient<Course>('/api/lecturer/courses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Save draft changes for a course (preserves published version if already live)
   */
  async saveCourseDraft(courseId: string, draftData: Partial<Course>): Promise<SaveDraftResponse> {
    return apiClient<SaveDraftResponse>(`/api/lecturer/courses/${encodeURIComponent(courseId)}/draft`, {
      method: 'PUT',
      body: JSON.stringify(draftData),
    });
  },

  /**
   * Reset the Content Testing Lab course fixture to its original state
   */
  async resetContentLab(courseId: string): Promise<{ course: Course; message: string }> {
    return apiClient<{ course: Course; message: string }>(
      `/api/lecturer/courses/${encodeURIComponent(courseId)}/reset-lab`,
      {
        method: 'POST',
      }
    );
  },
};
