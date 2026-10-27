import { apiClient } from '@/core/api/apiClient';
import type {
  SubmitCourseRequestDTO,
  SubmitCourseResponseDTO,
  ReviewQueueResponseDTO,
  LecturerSubmissionsResponseDTO,
  CourseReviewDataResponseDTO,
  StagedAdminEditsRecord,
  StagedEditsSaveRequestDTO,
  StagedEditsSaveResponseDTO,
  ReviewerWorkingNotes,
  ReviewDecisionRequestDTO,
  ReviewDecisionResponseDTO,
  DiscardStagedEditsResponseDTO,
  ApproveCourseRequestDTO,
  ReturnCourseWithEditsRequestDTO,
  RejectCourseRequestDTO,
} from '@/core/courses/types';

/**
 * Client Service for Increment 9: Review & Quality Audit Workflow
 *
 * Communicates with review, approval, staging, and audit endpoints.
 * Wraps all requests with strongly typed DTOs and standard error propagation.
 */
export const reviewApi = {
  /**
   * Submit course for review (Case A draft or Case B published update)
   */
  async submitCourse(
    courseId: string,
    payload?: SubmitCourseRequestDTO
  ): Promise<SubmitCourseResponseDTO> {
    return apiClient<SubmitCourseResponseDTO>(
      `/api/courses/${encodeURIComponent(courseId)}/submit`,
      {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      }
    );
  },

  /**
   * Retrieve deterministic FIFO admin approval queue
   */
  async getReviewQueue(): Promise<ReviewQueueResponseDTO> {
    return apiClient<ReviewQueueResponseDTO>('/api/approvals/queue', {
      method: 'GET',
    });
  },

  /**
   * Retrieve lecturer submissions overview
   */
  async getLecturerSubmissions(): Promise<LecturerSubmissionsResponseDTO> {
    return apiClient<LecturerSubmissionsResponseDTO>('/api/approvals/my-submissions', {
      method: 'GET',
    });
  },

  /**
   * Retrieve authoritative review baseline, draft, staged edits, feedback & audit trail
   */
  async getCourseReviewData(courseId: string): Promise<CourseReviewDataResponseDTO> {
    return apiClient<CourseReviewDataResponseDTO>(
      `/api/courses/${encodeURIComponent(courseId)}/review-data`,
      {
        method: 'GET',
      }
    );
  },

  /**
   * Fetch latest accepted staged edits and revision token for a course
   */
  async getStagedAdminEdits(
    courseId: string
  ): Promise<{ record: StagedAdminEditsRecord | null }> {
    return apiClient<{ record: StagedAdminEditsRecord | null }>(
      `/api/admin/review/${encodeURIComponent(courseId)}/staged-edits`,
      {
        method: 'GET',
      }
    );
  },

  /**
   * Autosave staged administrator content edits with optimistic concurrency revision token
   */
  async saveStagedAdminEdits(
    courseId: string,
    payload: StagedEditsSaveRequestDTO
  ): Promise<StagedEditsSaveResponseDTO> {
    return apiClient<StagedEditsSaveResponseDTO>(
      `/api/admin/review/${encodeURIComponent(courseId)}/staged-edits`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
  },

  /**
   * Explicitly discard staged administrator content edits
   */
  async discardStagedAdminEdits(
    courseId: string
  ): Promise<DiscardStagedEditsResponseDTO> {
    return apiClient<DiscardStagedEditsResponseDTO>(
      `/api/admin/courses/${encodeURIComponent(courseId)}/staged-edits`,
      {
        method: 'DELETE',
      }
    );
  },

  /**
   * Fetch private reviewer working notes
   */
  async getReviewerWorkingNotes(courseId: string): Promise<ReviewerWorkingNotes> {
    return apiClient<ReviewerWorkingNotes>(
      `/api/admin/review/${encodeURIComponent(courseId)}/working-notes`,
      {
        method: 'GET',
      }
    );
  },

  /**
   * Save private reviewer working notes
   */
  async saveReviewerWorkingNotes(
    courseId: string,
    notes: Partial<ReviewerWorkingNotes>
  ): Promise<ReviewerWorkingNotes> {
    return apiClient<ReviewerWorkingNotes>(
      `/api/admin/review/${encodeURIComponent(courseId)}/working-notes`,
      {
        method: 'PUT',
        body: JSON.stringify(notes),
      }
    );
  },

  /**
   * Delete scoped reviewer working note (general, chapter, or item)
   */
  async deleteReviewerWorkingNote(
    courseId: string,
    targetType: 'general' | 'chapter' | 'item',
    targetId: string
  ): Promise<ReviewerWorkingNotes> {
    return apiClient<ReviewerWorkingNotes>(
      `/api/admin/courses/${encodeURIComponent(courseId)}/working-notes/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`,
      {
        method: 'DELETE',
      }
    );
  },

  /**
   * Execute formal review decision (Outcome A: Approve, Outcome B: Return with Edits, Outcome C: Reject)
   */
  async executeReviewDecision(
    courseId: string,
    payload: ReviewDecisionRequestDTO
  ): Promise<ReviewDecisionResponseDTO> {
    return apiClient<ReviewDecisionResponseDTO>(
      `/api/admin/review/${encodeURIComponent(courseId)}/decision`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  /**
   * Dedicated Approve endpoint
   */
  async approveCourse(
    courseId: string,
    payload?: ApproveCourseRequestDTO
  ): Promise<ReviewDecisionResponseDTO> {
    return apiClient<ReviewDecisionResponseDTO>(
      `/api/admin/courses/${encodeURIComponent(courseId)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      }
    );
  },

  /**
   * Dedicated Return with Edits endpoint
   */
  async returnCourseWithEdits(
    courseId: string,
    payload: ReturnCourseWithEditsRequestDTO
  ): Promise<ReviewDecisionResponseDTO> {
    return apiClient<ReviewDecisionResponseDTO>(
      `/api/admin/courses/${encodeURIComponent(courseId)}/return-with-edits`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  /**
   * Dedicated Reject endpoint
   */
  async rejectCourse(
    courseId: string,
    payload: RejectCourseRequestDTO
  ): Promise<ReviewDecisionResponseDTO> {
    return apiClient<ReviewDecisionResponseDTO>(
      `/api/admin/courses/${encodeURIComponent(courseId)}/reject`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },
};
