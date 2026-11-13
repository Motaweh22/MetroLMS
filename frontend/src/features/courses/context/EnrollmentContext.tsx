import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { coursesApi } from '../services/coursesApi';
import { sanitizeErrorMessage, isStaleEpochError } from '@/core/api/apiClient';
import { getCurrentSessionEpoch } from '@/core/auth/sessionEpoch';
import { EnrollmentContext, type EnrollmentContextValue } from './context';
import type { CourseEnrollment, EnrollmentResponse } from '@/core/courses/types';

export const EnrollmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading: authLoading, sessionEpoch } = useAuth();
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [loadedEpoch, setLoadedEpoch] = useState<number>(sessionEpoch);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Stale-response guard & request tracker across account switches and session epoch transitions (WP-5.4.2)
  const activeUserIdRef = useRef<string | null>(user?.id ?? null);
  const activeEpochRef = useRef<number>(sessionEpoch);
  const requestSeqRef = useRef<number>(0);

  // Immediate cache purge and state isolation on user identity change or session epoch transition (WP-5.4.2)
  useEffect(() => {
    const currentId = user?.id ?? null;
    if (activeUserIdRef.current !== currentId || activeEpochRef.current !== sessionEpoch) {
      activeUserIdRef.current = currentId;
      activeEpochRef.current = sessionEpoch;
      requestSeqRef.current += 1;
      setEnrollments([]);
      setLoadedUserId(null);
      setLoadedEpoch(sessionEpoch);
      setError(null);
    }
  }, [user?.id, sessionEpoch]);

  const refetchEnrollments = useCallback(async (): Promise<void> => {
    // If authentication revalidation is currently pending, wait until it settles
    if (authLoading) {
      return;
    }

    const targetUserId = user?.id ?? null;
    const targetEpoch = sessionEpoch;

    // Only authenticated trainees can fetch their enrollments
    if (!isAuthenticated || !targetUserId || user?.role !== 'user') {
      setEnrollments([]);
      setLoadedUserId(null);
      setLoadedEpoch(targetEpoch);
      setIsLoading(false);
      return;
    }

    const currentSeq = ++requestSeqRef.current;

    setIsLoading(true);
    setError(null);
    try {
      const data = await coursesApi.getMyEnrollments();
      // Guard: Discard stale response if active user changed or epoch advanced
      if (
        currentSeq !== requestSeqRef.current ||
        activeUserIdRef.current !== targetUserId ||
        activeEpochRef.current !== targetEpoch ||
        getCurrentSessionEpoch() !== targetEpoch
      ) {
        return;
      }

      setEnrollments(data);
      setLoadedUserId(targetUserId);
      setLoadedEpoch(targetEpoch);
    } catch (err: unknown) {
      // Discard stale in-flight responses silently without recording error (WP-5.4.2)
      if (isStaleEpochError(err)) {
        return;
      }
      if (
        currentSeq !== requestSeqRef.current ||
        activeUserIdRef.current !== targetUserId ||
        activeEpochRef.current !== targetEpoch ||
        getCurrentSessionEpoch() !== targetEpoch
      ) {
        return;
      }
      // Do not block UI on background query failure; record error
      const fallbackMsg = 'تعذر جلب بيانات التسجيلات حاليًا.';
      const rawMsg = err instanceof Error ? err.message : fallbackMsg;
      setError(sanitizeErrorMessage(rawMsg, fallbackMsg));
      setEnrollments([]);
      setLoadedUserId(null);
      setLoadedEpoch(targetEpoch);
    } finally {
      if (
        currentSeq === requestSeqRef.current &&
        activeUserIdRef.current === targetUserId &&
        activeEpochRef.current === targetEpoch
      ) {
        setIsLoading(false);
      }
    }
  }, [authLoading, isAuthenticated, user?.id, user?.role, sessionEpoch]);

  // Synchronize enrollments whenever the active session or persona changes
  useEffect(() => {
    refetchEnrollments();
  }, [refetchEnrollments]);

  // Synchronous render-time cache ownership gating (WP-5.4.2 Final Cache Isolation Audit):
  // If stored cache values do NOT match the current authenticated user and current session epoch,
  // expose empty enrollments and empty enrolledCourseIds synchronously.
  // This guarantees that previous-session cache values are NEVER visible during transition renders before useEffect runs.
  const currentUserId = user?.id ?? null;
  const isCurrentSessionState = Boolean(
    isAuthenticated &&
    currentUserId &&
    user?.role === 'user' &&
    loadedUserId === currentUserId &&
    loadedEpoch === sessionEpoch
  );

  const activeEnrollments = isCurrentSessionState ? enrollments : [];
  const activeEnrolledCourseIds = useMemo(() => {
    return activeEnrollments.map((e) => e.courseId.toLowerCase());
  }, [activeEnrollments]);
  const activeError = isCurrentSessionState ? error : null;
  const activeIsLoading = isCurrentSessionState ? isLoading : Boolean(isAuthenticated && user?.role === 'user');

  const isEnrolledInCourse = useCallback(
    (courseId: string): boolean => {
      if (!courseId || !isCurrentSessionState) return false;
      return activeEnrolledCourseIds.includes(courseId.toLowerCase());
    },
    [isCurrentSessionState, activeEnrolledCourseIds]
  );

  const getEnrollment = useCallback(
    (courseId: string): CourseEnrollment | null => {
      if (!courseId || !isCurrentSessionState) return null;
      return (
        activeEnrollments.find(
          (e) => e.courseId.toLowerCase() === courseId.toLowerCase()
        ) || null
      );
    },
    [isCurrentSessionState, activeEnrollments]
  );

  const enroll = useCallback(
    async (courseId: string): Promise<EnrollmentResponse> => {
      const targetUserId = user?.id ?? null;
      const targetEpoch = sessionEpoch;
      const response = await coursesApi.enrollCourse(courseId);

      // Verify session has not transitioned before mutating state
      if (
        activeUserIdRef.current === targetUserId &&
        activeEpochRef.current === targetEpoch &&
        getCurrentSessionEpoch() === targetEpoch
      ) {
        setEnrollments((prev) => {
          const exists = prev.some(
            (e) => e.courseId.toLowerCase() === response.enrollment.courseId.toLowerCase()
          );
          if (exists) return prev;
          return [...prev, response.enrollment];
        });
        setLoadedUserId(targetUserId);
        setLoadedEpoch(targetEpoch);
      }
      return response;
    },
    [user?.id, sessionEpoch]
  );

  const value = useMemo<EnrollmentContextValue>(
    () => ({
      enrollments: activeEnrollments,
      enrolledCourseIds: activeEnrolledCourseIds,
      isLoading: activeIsLoading,
      error: activeError,
      isEnrolledInCourse,
      getEnrollment,
      enroll,
      refetchEnrollments,
    }),
    [
      activeEnrollments,
      activeEnrolledCourseIds,
      activeIsLoading,
      activeError,
      isEnrolledInCourse,
      getEnrollment,
      enroll,
      refetchEnrollments,
    ]
  );

  return <EnrollmentContext.Provider value={value}>{children}</EnrollmentContext.Provider>;
};

export default EnrollmentProvider;
