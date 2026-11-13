/**
 * MetroLMS — Course Builder User-Owned Draft Storage Service
 * (Increment 5.4 / WP-5.4.3: Final LocalStorage Ownership Verification)
 *
 * Enforces strict user-level data ownership for personal uncommitted course authoring
 * drafts in browser localStorage.
 *
 * SECURITY INVARIANTS:
 * 1. Key pattern is strictly: `metro_builder_draft_${userId}_${courseId}`.
 * 2. Missing identity (null, undefined, empty string) FAILS CLOSED: no read, no write.
 * 3. Legacy unscoped keys (`metro_builder_draft_${courseId}`) are NEVER read or written to.
 * 4. User A's uncommitted draft can NEVER be read or overwritten by User B.
 */

import type { Course } from '@/core/courses/types';

export const COURSE_BUILDER_DRAFT_PREFIX = 'metro_builder_draft_';

/**
 * Generates the user-scoped localStorage key for Course Builder drafts.
 * Strictly requires both userId and courseId. Returns null if either is missing.
 */
export function getCourseBuilderDraftKey(
  userId: string | null | undefined,
  courseId: string | null | undefined
): string | null {
  if (!userId || !courseId || userId.trim() === '' || courseId.trim() === '') {
    return null;
  }
  return `${COURSE_BUILDER_DRAFT_PREFIX}${userId.trim()}_${courseId.trim()}`;
}

/**
 * Returns the legacy unscoped key pattern for regression assertions.
 * PRODUCTION NOTICE: New code must NEVER read or write to this key.
 */
export function getLegacyCourseBuilderDraftKey(courseId: string): string {
  return `${COURSE_BUILDER_DRAFT_PREFIX}${courseId.trim()}`;
}

/**
 * Saves a user-owned Course Builder draft backup to localStorage.
 * Fails closed (does not write) if userId is missing.
 */
export function saveCourseBuilderDraft(
  userId: string | null | undefined,
  courseId: string | null | undefined,
  course: Course
): boolean {
  const key = getCourseBuilderDraftKey(userId, courseId);
  if (!key || typeof localStorage === 'undefined') {
    return false;
  }
  try {
    localStorage.setItem(key, JSON.stringify(course));
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieves a user-owned Course Builder draft backup from localStorage.
 * Fails closed (returns null) if userId is missing or if draft does not match courseId.
 * NEVER reads legacy unscoped drafts.
 */
export function getCourseBuilderDraft(
  userId: string | null | undefined,
  courseId: string | null | undefined
): Course | null {
  const key = getCourseBuilderDraftKey(userId, courseId);
  if (!key || typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Course;
    if (parsed && parsed.id === courseId) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clears a user-owned Course Builder draft backup from localStorage.
 */
export function clearCourseBuilderDraft(
  userId: string | null | undefined,
  courseId: string | null | undefined
): void {
  const key = getCourseBuilderDraftKey(userId, courseId);
  if (!key || typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

