import type { UserRole } from '@/core/auth/types';
import type { ChapterItem } from '@/core/courses/types';

/**
 * Calculates authoritative lesson-based course progress percentage.
 *
 * Requirements:
 * - Uses approved formula: round((completedItems / totalItems) * 100)
 * - Returns 0% for empty courses (totalItems <= 0) without division by zero.
 * - Guarantees 100% only when ALL eligible items are completed (completedCount === totalItems).
 * - Caps rounded values at 99% if not all items are finished.
 */
export function calculateTraineeProgress(totalItems: number, completedCount: number): number {
  if (totalItems <= 0 || completedCount <= 0 || !Number.isFinite(totalItems) || !Number.isFinite(completedCount)) {
    return 0;
  }

  const validTotal = Math.max(0, Math.floor(totalItems));
  const validCompleted = Math.max(0, Math.min(validTotal, Math.floor(completedCount)));

  if (validTotal === 0 || validCompleted === 0) {
    return 0;
  }

  if (validCompleted === validTotal) {
    return 100;
  }

  const rawPercent = Math.round((validCompleted / validTotal) * 100);

  // Safeguard: Never claim 100% unless all items are complete
  return Math.min(rawPercent, 99);
}

/**
 * Determines whether a specific lesson item is locked for the current user.
 *
 * Rules:
 * - Instructors ('lecturer') and Administrators ('admin') bypass sequencing restrictions.
 * - The very first lesson in the curriculum (index 0) is always unlocked.
 * - Any subsequent lesson (index N > 0) is unlocked if and only if the immediately
 *   preceding lesson (index N - 1) is in completedItemIds.
 */
export function isLessonLocked(
  itemIndex: number,
  flatItems: ChapterItem[],
  completedItemIds: string[],
  userRole?: UserRole
): boolean {
  if (
    userRole === 'admin' ||
    userRole === 'super_admin' ||
    userRole === 'developer' ||
    userRole === 'assistant_admin' ||
    userRole === 'lecturer'
  ) {
    return false;
  }

  if (itemIndex === 0) {
    return false;
  }

  if (!flatItems || flatItems.length === 0 || itemIndex < 0) {
    return true;
  }

  const prevIndex = itemIndex - 1;
  if (prevIndex >= flatItems.length) {
    return true;
  }

  const prevItem = flatItems[prevIndex];
  if (!prevItem) {
    return true;
  }

  return !completedItemIds.includes(prevItem.id);
}

/**
 * Resolves the starting lesson according to the approved legacy resume hierarchy:
 * 1. Resumes at `lastWatchedItemId` if valid and unlocked.
 * 2. Otherwise selects the first incomplete, unlocked lesson.
 * 3. Fallback: If all lessons are completed, returns the first lesson.
 *
 * Trainees are never resumed into a locked lesson.
 */
export function resolveResumeLesson(
  flatItems: ChapterItem[],
  completedItemIds: string[],
  lastWatchedItemId: string | null,
  userRole?: UserRole
): ChapterItem | null {
  if (!flatItems || flatItems.length === 0) {
    return null;
  }

  // Priority 1: Last watched item if present and unlocked
  if (lastWatchedItemId) {
    const lastIndex = flatItems.findIndex((it) => it.id === lastWatchedItemId);
    if (lastIndex !== -1) {
      const locked = isLessonLocked(lastIndex, flatItems, completedItemIds, userRole);
      if (!locked) {
        return flatItems[lastIndex];
      }
    }
  }

  // Priority 2: First incomplete, unlocked lesson
  for (let i = 0; i < flatItems.length; i++) {
    const item = flatItems[i];
    const isCompleted = completedItemIds.includes(item.id);
    const locked = isLessonLocked(i, flatItems, completedItemIds, userRole);
    if (!isCompleted && !locked) {
      return item;
    }
  }

  // Priority 3: Fallback to the first lesson
  return flatItems[0];
}

/**
 * Clamps a proposed seeking target position against the furthest permitted watched position.
 *
 * Rules:
 * - If the lesson is already completed, the trainee may seek freely across the duration.
 * - If the lesson is incomplete, seeking forward beyond furthestWatchedSeconds is clamped
 *   to furthestWatchedSeconds.
 * - Seeking backward (target <= furthestWatchedSeconds) is permitted.
 */
export function clampSeekingPosition(
  targetTime: number,
  furthestWatchedSeconds: number,
  isCompleted: boolean
): number {
  if (!Number.isFinite(targetTime) || targetTime < 0) {
    return 0;
  }

  if (isCompleted) {
    return targetTime;
  }

  const safeFurthest = Math.max(0, Number.isFinite(furthestWatchedSeconds) ? furthestWatchedSeconds : 0);
  return Math.min(targetTime, safeFurthest);
}

/**
 * Formats seconds into an accessible time string (mm:ss or hh:mm:ss).
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00';
  }

  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Parses a duration string (e.g. "18:30" or "01:15:30") into total seconds.
 * Returns 0 for invalid, non-finite, empty, or negative inputs.
 */
export function parseDurationToSeconds(durationStr?: string): number {
  if (!durationStr || typeof durationStr !== 'string') {
    return 0;
  }

  const trimmed = durationStr.trim();
  if (!trimmed) {
    return 0;
  }

  const parts = trimmed.split(':').map((part) => Number(part.trim()));
  if (parts.some((p) => isNaN(p) || p < 0 || !Number.isFinite(p))) {
    return 0;
  }

  if (parts.length === 2) {
    const [mins, secs] = parts;
    return mins * 60 + secs;
  }

  if (parts.length === 3) {
    const [hrs, mins, secs] = parts;
    return hrs * 3600 + mins * 60 + secs;
  }

  // Fallback for single integer string (e.g. "600")
  if (parts.length === 1 && !isNaN(parts[0])) {
    return Math.floor(parts[0]);
  }

  return 0;
}
