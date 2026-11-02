/**
 * Notification Center Domain Types & Models
 *
 * Models system, operational, and enrollment notifications for learners,
 * instructors, and administrators.
 */

export type NotificationType =
  | 'enrollment_approved'
  | 'enrollment_rejected'
  | 'new_course_suggested'
  | 'new_comment'
  | 'comment_reported'
  | 'forced_enrollment'
  | 'content_pending_review'
  | 'content_approved'
  | 'content_rejected'
  | 'new_registration_request'
  | 'enrollment_request'
  | 'deadline_reminder'
  | 'general_alert'
  | 'security_alert'
  | 'group_renewed'
  | 'group_archived'
  | 'instructor_assigned'
  | 'group_updated'
  | 'course_completed';

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title?: string;
  message: string;
  actorId?: string | null;
  actorRole?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  metadata?: Record<string, unknown> | null;
  courseId?: string | null;
  groupId?: string | null;
  requestId?: string | null;
  commentId?: string | null;
  auditLogId?: string | null;
  targetUrl?: string | null;
  dedupeKey?: string;
  read: boolean;
  createdAt: string;
  actionRequired?: boolean;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
  totalCount: number;
}
