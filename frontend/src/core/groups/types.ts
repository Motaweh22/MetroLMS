/**
 * Training Group Domain Types & Models
 *
 * Models training cohorts, group-level and course-level deadline schedules,
 * resources, and trainee progress metrics.
 */

import type { LessonProgress } from '@/features/learning-player/types';

export type GroupStatus = 'active' | 'scheduled' | 'expired';

export type PostDeadlinePolicy = 'keep_no_cert' | 'hide';

export type GroupAdminStatus = 'draft' | 'active' | 'archived';

export type GroupEnrollmentPolicy = 'open' | 'approval_required' | 'closed';

export type CourseRole = 'core' | 'reminder';

export interface GroupCourseAssignment {
  courseId: string;
  order: number;
  customStartDateTime?: string | null;
  customDeadlineDateTime?: string | null;
  customPostDeadlinePolicy?: PostDeadlinePolicy | null;
}

export interface GroupCycleCourseAssignment {
  courseId: string;
  courseRole: CourseRole; // 'core' | 'reminder'
  order: number;
  customStartDateTime?: string | null;
  customDeadlineDateTime?: string | null;
  customPostDeadlinePolicy?: PostDeadlinePolicy | null;
}

export interface GroupResource {
  id: string;
  title: string;
  url: string;
  description: string;
  order: number;
  type?: 'teams' | 'zoom' | 'meet' | 'pdf' | 'link';
  createdAt?: string;
}

export interface GroupRenewalSchedule {
  autoRenewalEnabled: boolean;
  intervalDays?: number | null;
  renewalIntervalDays?: number | null;
  nextScheduledRenewalDate?: string | null;
  lastAutoRenewedCycleId?: string | null;
  recurrenceType?: 'none' | 'monthly' | 'bimonthly' | 'quarterly' | 'custom';
}

export interface GroupRenewalCycle {
  id: string; // e.g. "CYC-GRP101-01"
  groupId: string;
  cycleNumber: number; // 1, 2, 3...
  title: string; // e.g. "دورة تدريب أبريل - مايو 2026"
  status: 'active' | 'completed' | 'archived';
  startDateTime: string;
  deadlineDateTime: string;
  postDeadlinePolicy?: PostDeadlinePolicy;
  courses: GroupCycleCourseAssignment[];
  traineeIds: string[];
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CourseAttemptStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'expired_incomplete';

export interface CourseAttempt {
  id: string; // e.g. "ATT-USR003-CRS001-CYC01"
  userId: string;
  courseId: string;
  cycleId?: string | null; // ID of the specific renewal cycle (null for standalone)
  groupId?: string | null; // Provenance group ID
  attemptNumber: number | null; // Unassigned (null) until trainee actually starts learning!
  courseRole?: CourseRole; // 'core' | 'reminder'
  status: CourseAttemptStatus;
  startedAt?: string | null; // Set ONLY when trainee views first lesson / begins progress
  completedAt?: string | null;
  lastActivityAt?: string | null;
  progressPercent: number; // 0..100
  completedItemIds: string[];
  lastWatchedItemId?: string | null;
  lessonProgress: Record<string, LessonProgress>;
  createdAt: string;
  updatedAt: string;
}

export interface TraineeCourseAttemptStats {
  courseId: string;
  courseTitle?: string;
  currentAttemptNumber: number | null; // Assigned attempt number if started, or null if unstarted
  displayAttemptNumber: number; // Projected or active attempt number for user display (e.g. 1, 2, 3)
  previousStartedAttemptsCount: number; // Distinct historical attempts where startedAt !== null
  previousCompletionsCount: number; // Distinct historical attempts where status === 'completed'
  currentAttempt: CourseAttempt | null;
  hasStartedCurrentAttempt: boolean;
  historicalAttempts: CourseAttempt[];
}

export type MaterialFileType =
  | 'pdf'
  | 'image'
  | 'word'
  | 'excel'
  | 'powerpoint'
  | 'archive'
  | 'video'
  | 'audio'
  | 'other';

export interface GroupMaterialFolder {
  id: string; // e.g. "FLD-GRP101-01"
  groupId: string;
  parentId?: string | null; // Optional nested folder hierarchy
  cycleId?: string | null; // Optional association with a renewal cycle
  name: string; // e.g. "ماتريال اليوم الأول", "تعليمات التشغيل"
  order: number;
  isVisibleToTrainees: boolean;
  filesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMaterialFile {
  id: string; // e.g. "FIL-GRP101-001"
  folderId: string;
  groupId: string;
  cycleId?: string | null;
  title: string; // Display name
  originalFileName: string;
  fileSizeBytes: number;
  mimeType: string;
  fileType: MaterialFileType;
  url: string; // Mock / Blob URL
  order: number;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
  isVisible: boolean;
  downloadCount: number;
}

export interface GroupMember {
  userId: string;
  name: string;
  email: string;
  department?: string;
  jobTitle?: string;
  joinedAt: string;
  joinSource: 'admin_assigned' | 'supervisor_assigned' | 'qr_code';
}

export interface GroupJoinRequest {
  id: string; // e.g. "REQ-GRP101-USR004"
  groupId: string;
  groupName: string;
  userId: string;
  userName: string;
  userEmail: string;
  department?: string;
  jobTitle?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewNote?: string | null;
}

export interface TrainingGroup {
  id: string;
  name: string;
  description: string;
  courses: GroupCourseAssignment[];
  courseId: string;
  traineeIds: string[];
  supervisorIds: string[];
  startDateTime: string;
  deadlineDateTime: string;
  postDeadlinePolicy: PostDeadlinePolicy;
  resources: GroupResource[];
  // Increment 10 Extensions:
  adminStatus?: GroupAdminStatus; // 'draft' | 'active' | 'archived' (default: 'active')
  enrollmentPolicy?: GroupEnrollmentPolicy; // 'open' | 'approval_required' | 'closed' (default: 'open')
  renewalSchedule?: GroupRenewalSchedule;
  currentCycleId?: string | null;
  enrollmentCode?: string;
  isEnrollmentOpen?: boolean;
  enrollmentExpiresAt?: string | null;
  maxTrainees?: number | null;
  foldersCount?: number;
  filesCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface EffectiveCourseSettings {
  courseId: string;
  startDateTime: string;
  deadlineDateTime: string;
  effectiveStartDateTime: string;
  effectiveDeadlineDateTime: string;
  postDeadlinePolicy: PostDeadlinePolicy;
  effectivePostDeadlinePolicy: PostDeadlinePolicy;
  hasStartOverride: boolean;
  hasDeadlineOverride: boolean;
  hasPolicyOverride: boolean;
  hasAnyOverride: boolean;
  status: GroupStatus;
  statusInfo: {
    key: GroupStatus;
    label: string;
    badgeVariant: 'primary' | 'warning' | 'neutral' | 'danger';
  };
  isExpired: boolean;
  isScheduled: boolean;
  isActive: boolean;
  // Increment 10 3-Level Precedence Metadata:
  cycleId?: string | null;
  courseRole?: CourseRole;
  inheritedFrom?: {
    start: 'course_override' | 'cycle' | 'group';
    deadline: 'course_override' | 'cycle' | 'group';
    policy: 'course_override' | 'cycle' | 'group';
  };
  isValidDateRange?: boolean;
  dateRangeError?: string;
}

export interface TraineeAttentionResult {
  needsAttention: boolean;
  reason: string;
  badge: string;
  level: 'warning' | 'danger' | 'info' | '';
  groupId?: string;
  courseId?: string;
}

export interface TraineeCourseProgressInGroup {
  courseId: string;
  courseTitle: string;
  percent: number;
  completedLessons: number;
  totalLessons: number;
  isCompleted: boolean;
  status: GroupStatus;
  effectiveDeadline: string;
  effectivePolicy: PostDeadlinePolicy;
  needsAttention: boolean;
  attentionReason?: string;
  courseRole?: CourseRole;
  started?: boolean;
  lastActivityAt?: string | null;
}

export interface TraineeGroupMetrics {
  userId: string;
  userName: string;
  email?: string;
  department?: string;
  jobTitle?: string;
  joinedAt?: string;
  programPercent: number;
  completedLessonsTotal: number;
  totalRequiredLessons: number;
  completedCoursesCount: number;
  totalAssignedCourses: number;
  startedCoursesCount?: number;
  completedCoreCoursesCount?: number;
  totalCoreCoursesCount?: number;
  isAllCoreCompleted?: boolean;
  isProgramCompleted: boolean;
  lastActivityAt?: string | null;
  courseProgressMap: Record<string, TraineeCourseProgressInGroup>;
  worstAttention: TraineeAttentionResult;
}

export interface CohortSummaryMetrics {
  totalMembers: number;
  totalCourses: number;
  coreCoursesCount: number;
  reminderCoursesCount: number;
  traineesStarted: number;
  traineesCompletedAllCore: number;
  inProgressAttempts: number;
  completedAttempts: number;
  notStartedAttempts: number;
  averageProgressPercent: number;
  warningAlertsCount: number;
  dangerAlertsCount: number;
  totalAttentionCount: number;
}

export interface AssignedCourseProgressMetric {
  assignment: GroupCourseAssignment | GroupCycleCourseAssignment;
  courseId: string;
  courseTitle: string;
  courseRole?: CourseRole;
  order?: number;
  effective: EffectiveCourseSettings;
  totalRequiredLessons: number;
  timeRemainingText: string;
  status: GroupStatus;
  enrolledCount?: number;
  startedCount?: number;
  inProgressCount?: number;
  completedCount?: number;
  notStartedCount?: number;
  overdueCount?: number;
  averageProgressPercent?: number;
}

export interface GroupMetrics {
  group: TrainingGroup;
  status: GroupStatus;
  statusLabelAr: string;
  timeRemainingText: string;
  selectedCycle?: GroupRenewalCycle | null;
  cycles?: GroupRenewalCycle[];
  cohortSummary?: CohortSummaryMetrics;
  assignedCoursesMetrics: AssignedCourseProgressMetric[];
  programTotalRequiredLessons: number;
  traineeMetricsList: TraineeGroupMetrics[];
}
