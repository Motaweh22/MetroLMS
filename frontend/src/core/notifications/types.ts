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
  | 'forced_enrollment'
  | 'content_pending_review'
  | 'content_approved'
  | 'content_rejected'
  | 'new_registration_request'
  | 'enrollment_request'
  | 'deadline_reminder'
  | 'general_alert';

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title?: string;
  message: string;
  courseId?: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
  totalCount: number;
}
