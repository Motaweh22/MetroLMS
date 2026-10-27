import type { ChapterItem } from '@/core/courses/types';

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
  updatedAt: string;
}

/**
 * Course-level progress aggregate entity.
 */
export interface CourseProgress {
  courseId: string;
  userId: string;
  progressPercent: number;
  completedItemIds: string[];
  lastWatchedItemId: string | null;
  isCompleted: boolean;
  updatedAt: string;
  itemsProgress: Record<string, LessonProgress>;
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
}

/**
 * Payload for marking a lesson item as completed.
 */
export interface CompleteLessonPayload {
  itemId: string;
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
  progress: CourseProgress;
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
