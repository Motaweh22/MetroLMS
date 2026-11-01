/**
 * Canonical Course Instructor & Performance Authorization Engine
 *
 * GOVERNANCE & IDENTITY INTEGRITY PRINCIPLES:
 * 1. Authorization is strictly identity-based (canonical unique user IDs).
 * 2. Display names (e.g. course.lecturerName === user.name) MUST NEVER be used for authorization
 *    decisions under any circumstances, because names are human-readable display labels, not unique identity keys.
 * 3. The synthetic demo persona 'usr_lect_002' (Dr. Tarek El-Gohary) and legacy employee 'USR002' (Eng. Khaled Ibrahim)
 *    are documented, trusted aliases for the primary instructor slot across prototype LMS course fixtures.
 * 4. UI authorization helpers and store/API authorization checks share this exact authoritative logic
 *    to guarantee zero authorization drift across the application boundary.
 */

import { resolveCanonicalUserId } from '@/core/auth/canonicalIdentity';

export interface CourseInstructorContext {
  lecturerId?: string | null;
  coLecturers?: string[] | null;
}

export interface AuthActorContext {
  id: string;
  role: string;
}

/**
 * Normalizes and compares an actor user ID against an assigned course instructor ID (primary or co-lecturer).
 *
 * Rules:
 * 1. Both IDs are trimmed and case-normalized.
 * 2. If strictly equal, return true.
 * 3. If matching the documented trusted synthetic lecturer demo pair ('usr_lect_002' <-> 'usr002'), return true.
 * 4. Otherwise, return false.
 * 5. Display names are strictly ignored.
 */
export function isMatchingInstructorId(actorUserId: string, assignedLecturerId: string): boolean {
  if (!actorUserId || !assignedLecturerId) return false;

  const actorLower = actorUserId.trim().toLowerCase();
  const assignedLower = assignedLecturerId.trim().toLowerCase();

  if (actorLower === assignedLower) return true;

  // Canonical identity comparison (e.g. 'usr_lect_001' <-> 'USR003')
  const canonicalActor = resolveCanonicalUserId(actorUserId).toLowerCase();
  const canonicalAssigned = resolveCanonicalUserId(assignedLecturerId).toLowerCase();
  if (canonicalActor === canonicalAssigned) return true;

  // Documented trusted synthetic demo lecturer alias ('usr_lect_002' <-> 'usr002' / 'USR002')
  const isSyntheticDemoPair =
    (actorLower === 'usr_lect_002' && assignedLower === 'usr002') ||
    (actorLower === 'usr002' && assignedLower === 'usr_lect_002');

  return isSyntheticDemoPair;
}

/**
 * Checks whether an actor is an authorized instructor (primary or co-lecturer) for a given course.
 *
 * Strictly evaluates user IDs; never relies on display names.
 */
export function isUserAuthorizedCourseInstructor(
  course: CourseInstructorContext,
  actorUserId: string
): boolean {
  if (!actorUserId) return false;

  // 1. Primary instructor match
  if (course.lecturerId && isMatchingInstructorId(actorUserId, course.lecturerId)) {
    return true;
  }

  // 2. Co-lecturer match
  if (Array.isArray(course.coLecturers)) {
    return course.coLecturers.some((coId) => isMatchingInstructorId(actorUserId, coId));
  }

  return false;
}

/**
 * Authoritative evaluation of course-performance report access.
 *
 * Access Matrix:
 * - System Administrator ('admin'): Platform-wide performance oversight.
 * - Assistant Administrator ('assistant_admin'): Platform-wide read-only performance oversight.
 * - Assigned Lecturer ('lecturer'): Scoped strictly to courses they instruct (primary or co-lecturer).
 * - Trainee ('user') and any other role: Prohibited (returns false / 403).
 */
export function isAuthorizedForCoursePerformance(
  course: CourseInstructorContext,
  user: AuthActorContext | null | undefined
): boolean {
  if (!user) return false;

  // System Administrator: Platform-wide performance oversight
  if (user.role === 'admin') return true;

  // Assistant Administrator: Approved platform-wide read-only performance oversight
  if (user.role === 'assistant_admin') return true;

  // Lecturer: Scoped strictly to courses they instruct
  if (user.role === 'lecturer') {
    return isUserAuthorizedCourseInstructor(course, user.id);
  }

  // Trainee ('user') and unauthorized roles
  return false;
}
