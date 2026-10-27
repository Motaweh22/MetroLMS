import type { UserRole } from '@/core/auth/types';

/**
 * Standard Reason Codes for Reporting Inappropriate Comments
 * Grounded in legacy app.js/course.js/admin.js specifications
 */
export type CommentReportReason =
  | 'inappropriate_content' // محتوى غير لائق
  | 'misinformation'         // معلومات خاطئة
  | 'harassment'             // إزعاج أو تحرش
  | 'spam'                   // رسائل مزعجة
  | 'other';                 // أخرى

/**
 * Localized Arabic Labels for Comment Report Reasons
 */
export const COMMENT_REPORT_REASONS_AR: Record<CommentReportReason, string> = {
  inappropriate_content: 'محتوى غير لائق',
  misinformation: 'معلومات خاطئة',
  harassment: 'إزعاج أو تحرش',
  spam: 'رسائل مزعجة',
  other: 'أخرى',
};

/**
 * Canonical Course Comment Entity
 */
export interface CourseComment {
  id: string;
  courseId: string;
  courseTitle: string;
  commentsEnabled?: boolean;
  userId: string;
  userName: string;
  userRole: UserRole;
  userInitial?: string;
  userAvatar?: string;
  isLecturer?: boolean;
  text: string;
  time?: string;
  createdAt: string; // ISO string
  reported: boolean;
  reportReason?: CommentReportReason | string | null;
  reportReasonLabelAr?: string | null;
  reportedBy?: string | null;
  reportedByName?: string | null;
  reportedAt?: string | null;
}

/**
 * High-Level Comment Moderation Summary KPI Metrics
 */
export interface CommentModerationSummaryDTO {
  totalComments: number;
  reportedCommentsCount: number;
  coursesWithCommentsCount: number;
  coursesWithCommentsDisabledCount?: number;
}

/**
 * Trainee/User Request Payload to Post a New Comment
 */
export interface CreateCommentRequestDTO {
  courseId: string;
  text: string;
}

/**
 * Trainee/User Request Payload to Report a Comment
 */
export interface ReportCommentRequestDTO {
  commentId?: string;
  reason: CommentReportReason;
  notes?: string;
}

/**
 * Administrator/Lecturer Request Payload to Toggle Course Comments
 */
export interface ToggleCourseCommentsDTO {
  courseId: string;
  commentsEnabled: boolean;
}

/**
 * Filter Parameters for Querying Comments
 */
export interface CommentFilterParams {
  query?: string;
  courseId?: string;
  reportedOnly?: boolean;
}

/**
 * Operational Response for Moderation Actions
 */
export interface CommentModerationActionResponse {
  success: boolean;
  approvalRequired?: boolean;
  requestId?: string;
  message?: string;
  comment?: CourseComment;
}
