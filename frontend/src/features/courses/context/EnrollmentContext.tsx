import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { coursesApi } from '../services/coursesApi';
import { sanitizeErrorMessage } from '@/core/api/apiClient';
import { EnrollmentContext, type EnrollmentContextValue } from './context';
import type { CourseEnrollment, EnrollmentResponse } from '@/core/courses/types';

export const EnrollmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refetchEnrollments = useCallback(async (): Promise<void> => {
    // Only authenticated trainees can fetch their enrollments
    if (!isAuthenticated || user?.role !== 'user') {
      setEnrollments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await coursesApi.getMyEnrollments();
      setEnrollments(data);
    } catch (err: unknown) {
      // Do not block UI on background query failure; record error
      const fallbackMsg = 'تعذر جلب بيانات التسجيلات حاليًا.';
      const rawMsg = err instanceof Error ? err.message : fallbackMsg;
      setError(sanitizeErrorMessage(rawMsg, fallbackMsg));
      setEnrollments([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.role]);

  // Synchronize enrollments whenever the active session or persona changes
  useEffect(() => {
    refetchEnrollments();
  }, [refetchEnrollments]);

  const enrolledCourseIds = useMemo(() => {
    return enrollments.map((e) => e.courseId.toLowerCase());
  }, [enrollments]);

  const isEnrolledInCourse = useCallback(
    (courseId: string): boolean => {
      if (!courseId) return false;
      return enrolledCourseIds.includes(courseId.toLowerCase());
    },
    [enrolledCourseIds]
  );

  const getEnrollment = useCallback(
    (courseId: string): CourseEnrollment | null => {
      if (!courseId) return null;
      return (
        enrollments.find(
          (e) => e.courseId.toLowerCase() === courseId.toLowerCase()
        ) || null
      );
    },
    [enrollments]
  );

  const enroll = useCallback(
    async (courseId: string): Promise<EnrollmentResponse> => {
      const response = await coursesApi.enrollCourse(courseId);
      // Immediately append new enrollment to state for immediate optimistic-like UI updates
      setEnrollments((prev) => {
        const exists = prev.some(
          (e) => e.courseId.toLowerCase() === response.enrollment.courseId.toLowerCase()
        );
        if (exists) return prev;
        return [...prev, response.enrollment];
      });
      return response;
    },
    []
  );

  const value = useMemo<EnrollmentContextValue>(
    () => ({
      enrollments,
      enrolledCourseIds,
      isLoading,
      error,
      isEnrolledInCourse,
      getEnrollment,
      enroll,
      refetchEnrollments,
    }),
    [
      enrollments,
      enrolledCourseIds,
      isLoading,
      error,
      isEnrolledInCourse,
      getEnrollment,
      enroll,
      refetchEnrollments,
    ]
  );

  return <EnrollmentContext.Provider value={value}>{children}</EnrollmentContext.Provider>;
};

export default EnrollmentProvider;
