/**
 * MetroLMS — Administrative Review Staged Edits Local Fallback Storage Service
 * (Increment 5.4 / WP-5.4.3: Final LocalStorage Ownership Verification)
 *
 * Enforces strict administrator-level data ownership for local uncommitted fallback
 * drafts in browser localStorage.
 *
 * ARCHITECTURAL NOTICE:
 * Server-backed shared review records (`StagedAdminEditsRecord`) remain collaborative
 * on the backend database via optimistic revision tokens and 3-Way Rebase (`threeWayRebase`).
 * This service strictly isolates client-side offline fallback cache.
 *
 * SECURITY INVARIANTS:
 * 1. Fallback key pattern is strictly: `metro_admin_staged_edits_${adminId}_${courseId}`.
 * 2. Missing adminId (null, undefined, empty string) FAILS CLOSED: no read, no write.
 * 3. Legacy unscoped keys (`metro_admin_staged_edits_${courseId}`) are NEVER read or written to.
 * 4. Admin A's local fallback can NEVER be read or overwritten by Admin B.
 */

import type { StagedAdminEditsRecord } from '@/core/courses/types';

export const ADMIN_STAGED_EDITS_PREFIX = 'metro_admin_staged_edits_';

/**
 * Generates the admin-scoped localStorage key for review staged edits fallback.
 * Strictly requires both adminId and courseId. Returns null if either is missing.
 */
export function getAdminStagedEditsKey(
  adminId: string | null | undefined,
  courseId: string | null | undefined
): string | null {
  if (!adminId || !courseId || adminId.trim() === '' || courseId.trim() === '') {
    return null;
  }
  return `${ADMIN_STAGED_EDITS_PREFIX}${adminId.trim()}_${courseId.trim()}`;
}

/**
 * Returns the legacy unscoped key pattern for regression assertions.
 * PRODUCTION NOTICE: New code must NEVER read or write to this key.
 */
export function getLegacyAdminStagedEditsKey(courseId: string): string {
  return `${ADMIN_STAGED_EDITS_PREFIX}${courseId.trim()}`;
}

/**
 * Saves an administrative review local fallback draft to localStorage.
 * Fails closed (does not write) if adminId is missing or if record.savedByAdminId !== adminId.
 */
export function saveAdminStagedEditsFallback(
  adminId: string | null | undefined,
  courseId: string | null | undefined,
  record: StagedAdminEditsRecord
): boolean {
  const key = getAdminStagedEditsKey(adminId, courseId);
  if (!key || !adminId || record.savedByAdminId !== adminId || typeof localStorage === 'undefined') {
    return false;
  }
  try {
    localStorage.setItem(key, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieves an administrative review local fallback draft from localStorage.
 * Fails closed (returns null) if adminId is missing or if record.savedByAdminId !== adminId.
 * NEVER reads legacy unscoped drafts.
 */
export function getAdminStagedEditsFallback(
  adminId: string | null | undefined,
  courseId: string | null | undefined
): StagedAdminEditsRecord | null {
  const key = getAdminStagedEditsKey(adminId, courseId);
  if (!key || !adminId || typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StagedAdminEditsRecord;
    if (parsed && parsed.savedByAdminId === adminId && parsed.courseId === courseId) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clears an administrative review local fallback draft from localStorage.
 */
export function clearAdminStagedEditsFallback(
  adminId: string | null | undefined,
  courseId: string | null | undefined
): void {
  const key = getAdminStagedEditsKey(adminId, courseId);
  if (!key || typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

