import type { UserRole } from '@/core/auth/types';
import type { CourseAttempt } from '@/core/groups/types';

export type { UserRole };

export type UserStatus = 'active' | 'suspended';

/**
 * Centrally Managed User Directory DTO
 * 
 * Strict Architectural Rules:
 * 1. Credentials (passwords, tokens, hashes) are NEVER stored in ManagedUserDTO.
 * 2. Learning metrics (totalLearningHours, completedCourses) are DERIVED from training records
 *    in Phase 3, not stored as authoritative duplicate state here.
 * 3. Each verified person has exactly one canonical record with optional legacyAliases.
 */
export interface ManagedUserDTO {
  /** Canonical unique user ID */
  id: string;
  /** Full display name (in Arabic) */
  name: string;
  /** Username for login / identity resolution */
  username: string;
  /** Primary contact and system email */
  email: string;
  /** Contact phone number (where available from HR/legacy fixtures) */
  phone?: string;
  /** Job title / position */
  jobTitle: string;
  /** Organizational unit / department */
  department: string;
  /** Core application role */
  role: UserRole;
  /** Account status */
  status: UserStatus;
  /** Optional avatar URL or fallback */
  avatar?: string;
  /** Account creation timestamp / date */
  createdAt?: string;
  /** Last login timestamp (or null if never logged in) */
  lastLogin?: string | null;
  /** Explicitly verified legacy identifiers that alias to this canonical person */
  legacyAliases?: string[];
}

/**
 * DTO for creating a new user through the directory (Phase 2)
 */
export interface CreateUserRequestDTO {
  name: string;
  username: string;
  email: string;
  phone?: string;
  jobTitle: string;
  department: string;
  role: UserRole;
  status?: UserStatus;
  /** Optional development password provisioned separately from directory records */
  password?: string;
}

/**
 * DTO for mutating a user's role (Phase 2)
 */
export interface UpdateUserRoleDTO {
  role: UserRole;
}

/**
 * DTO for suspending or reactivating an account (Phase 2)
 */
export interface UpdateUserStatusDTO {
  status: UserStatus;
  reason?: string;
}

/**
 * Parameters for querying the central user directory
 */
export interface UserFilterParams {
  /** Free-text search matching name, username, canonical ID, alias, jobTitle, department */
  query?: string;
  /** Role filter: all, admin, lecturer, user */
  role?: UserRole | 'all';
  /** Status filter: all, active, suspended */
  status?: UserStatus | 'all';
  /** Department filter: all or exact department name */
  department?: string | 'all';
}

/**
 * Arabic display labels for user roles
 */
export const USER_ROLE_LABELS_AR: Record<UserRole, string> = {
  developer: 'مطور',
  super_admin: 'مسؤول أعلى',
  admin: 'مدير',
  assistant_admin: 'مساعد مدير',
  lecturer: 'محاضر',
  user: 'متدرب',
};

/**
 * Arabic display labels for user statuses
 */
export const USER_STATUS_LABELS_AR: Record<UserStatus, string> = {
  active: 'نشط',
  suspended: 'موقوف',
};

/**
 * Standard Cairo Metro organizational departments
 */
export const METRO_DEPARTMENTS: string[] = [
  'الإدارة العامة للتشغيل والتحكم المركزي',
  'مركز تدريب وإعداد القادة بمترو القاهرة',
  'إدارة تكنولوجيا المعلومات',
  'إدارة التدريب',
  'قطاع التشغيل',
  'قطاع صيانة الوحدات المتحركة — الخط الأول',
  'قطاع الصيانة',
  'قطاع خدمة العملاء',
  'قطاع الصيانة الكهربائية',
  'قطاع الإشارات والاتصالات',
  'قطاع الأمن',
  'قطاع الصيانة الميكانيكية',
  'الإدارة العامة',
];

/**
 * Standard Cairo Metro positions & job titles
 */
export const METRO_JOB_TITLES: string[] = [
  'مدير عام أنظمة التشغيل',
  'كبير مدربي الإشارات والتحكم الآلي',
  'مدير النظام',
  'مهندس تدريب أول',
  'مهندس تشغيل',
  'فني صيانة قطارات أول',
  'فني صيانة',
  'سائق قطار',
  'مشرف محطة',
  'موظف خدمة عملاء',
  'مهندس كهرباء',
  'فني إشارات',
  'مشرف أمن',
  'مهندس ميكانيكا',
  'موظف إداري',
];

/**
 * Metric summary card data for a user's transcript (Phase 3)
 */
export interface UserTranscriptMetrics {
  /** Total verified accumulated learning hours, or null when cumulative multi-session telemetry is not tracked */
  totalLearningHours: number | null;
  /** Average course progress rate (0..100) across distinct enrolled courses */
  averageCompletionRate: number;
  /** Number of distinct courses where the user has an individual enrollment or attempt */
  enrolledCoursesCount: number;
  /** Number of distinct courses with verified completion */
  completedCoursesCount: number;
  /** Total count of distinct attempts across all courses */
  totalAttemptsCount: number;
  /** Total count of completed attempts across all courses */
  completedAttemptsCount: number;
}

/**
 * Historical course item in a user's transcript (Phase 3)
 */
export interface UserTranscriptCourseItem {
  courseId: string;
  title: string;
  description?: string;
  level?: string;
  thumbnailUrl?: string;
  progressPercent: number;
  status: 'not_started' | 'in_progress' | 'completed';
  enrolledAt: string;
  lastActivityAt: string | null;
  /** Times opened is null because React learning-player does not track open telemetry */
  timesOpened: number | null;
  /** Title of the most recent watched or highest-progress lesson, or null if unstarted */
  mostWatchedLessonTitle: string | null;
  /** Most watched count is null because per-lesson open frequencies are not tracked */
  mostWatchedCount: number | null;
  /** Total count of attempts on this course */
  attemptsCount: number;
  /** Associated attempts (chronologically sorted from newest to oldest) */
  attempts: CourseAttempt[];
}

/**
 * Full User Transcript DTO returned by GET /api/admin/users/:userId/transcript (Phase 3)
 */
export interface UserTranscriptDTO {
  user: ManagedUserDTO;
  metrics: UserTranscriptMetrics;
  courses: UserTranscriptCourseItem[];
}

