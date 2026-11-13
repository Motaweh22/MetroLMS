import type {
  CertificateRecord,
  ChapterItem,
  CourseAccessMode,
  EligibleAttemptOption,
} from '@/core/courses/types';

export type { CertificateRecord, CourseAccessMode, EligibleAttemptOption };

/**
 * Lesson-level watch progress entity.
 */
export interface LessonProgress {
  itemId: string;
  completed: boolean;
  completedAt?: string;
  lastPositionSeconds: number;
  furthestWatchedSeconds: number;
  durationSeconds?: number;
  /** Dedicated accumulated eligible foreground viewing time (e.g. for Google Drive minimum viewing-time requirement) */
  eligibleViewingSeconds?: number;
  /** Explicit accumulated viewing frequency / count (telemetry extension) */
  watchCount?: number;
  /** Substantive content version of the item when completed (MFR-10 / Rule B) */
  contentVersion?: number;
  updatedAt: string;
}

/**
 * Course-level progress aggregate entity.
 */
export interface CourseProgress {
  attemptId?: string;
  courseId: string;
  userId: string;
  progressPercent: number;
  completedItemIds: string[];
  lastWatchedItemId: string | null;
  isCompleted: boolean;
  updatedAt: string;
  itemsProgress: Record<string, LessonProgress>;
  accessMode?: CourseAccessMode;
  requiresAttemptSelection?: boolean;
  eligibleAttempts?: EligibleAttemptOption[];
  overallProgressPercentage?: number;
  certificates?: CertificateRecord[];
}

/**
 * Payload for recording continuous playback, reading, or eligible viewing activity.
 */
export interface RecordActivityPayload {
  itemId: string;
  lastPositionSeconds?: number;
  furthestWatchedSeconds?: number;
  durationSeconds?: number;
  eligibleViewingSeconds?: number;
  attemptId?: string;
  groupId?: string;
  cycleId?: string;
}

/**
 * Payload for marking a lesson item as completed.
 */
export interface CompleteLessonPayload {
  itemId: string;
  attemptId?: string;
  groupId?: string;
  cycleId?: string;
}

/**
 * Response for a lesson completion mutation.
 */
export interface CompleteLessonResponse {
  progress: CourseProgress;
  completedItem: LessonProgress;
  message: string;
  justCompletedCourse: boolean;
}

/**
 * Response for course progress queries.
 */
export interface CourseProgressResponse {
  progress?: CourseProgress;
  requiresAttemptSelection?: boolean;
  eligibleAttempts?: EligibleAttemptOption[];
  message?: string;
}

/**
 * Enriched chapter item with sequential access and completion metadata.
 */
export interface EnrichedChapterItem extends ChapterItem {
  chapterId: string;
  chapterTitle: string;
  globalIndex: number;
  isCompleted: boolean;
  isLocked: boolean;
  isActive: boolean;
  progress?: LessonProgress;
}

export type FlatCurriculumItem = EnrichedChapterItem;
