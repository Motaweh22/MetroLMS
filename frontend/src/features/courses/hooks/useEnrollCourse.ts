import { useState, useCallback } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useEnrollment } from './useEnrollment';
import { sanitizeErrorMessage } from '@/core/api/apiClient';
import type { CourseEnrollment, EnrollmentResponse } from '@/core/courses/types';

export interface UseEnrollCourseResult {
  enroll: (overrideCourseId?: string) => Promise<EnrollmentResponse | undefined>;
  isEnrolled: boolean;
  enrollment: CourseEnrollment | null;
  isEligible: boolean;
  isSubmitting: boolean;
  isLoadingStatus: boolean;
  isSuccess: boolean;
  successMessage: string | null;
  error: string | null;
  resetState: () => void;
}

/**
 * Dedicated hook for course enrollment mutation and state
 */
export function useEnrollCourse(courseId?: string): UseEnrollCourseResult {
  const { user, isAuthenticated } = useAuth();
  const enrollmentContext = useEnrollment();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isEligible = isAuthenticated && user?.role === 'user';
  const isEnrolled = courseId ? enrollmentContext.isEnrolledInCourse(courseId) : false;
  const enrollment = courseId ? enrollmentContext.getEnrollment(courseId) : null;

  const enroll = useCallback(
    async (overrideCourseId?: string): Promise<EnrollmentResponse | undefined> => {
      const targetId = overrideCourseId || courseId;
      if (!targetId) {
        setError('معرف الدورة التدريبية غير محدد');
        return undefined;
      }

      if (!isAuthenticated) {
        setError('يجب تسجيل الدخول أولاً للتمكن من التسجيل');
        return undefined;
      }

      if (user?.role !== 'user') {
        setError('التسجيل في الدورات متاح فقط لحسابات المتدربين.');
        return undefined;
      }

      if (enrollmentContext.isEnrolledInCourse(targetId)) {
        setError('أنت مسجل بالفعل في هذه الدورة التدريبية');
        return undefined;
      }

      setIsSubmitting(true);
      setError(null);
      setIsSuccess(false);

      try {
        const response = await enrollmentContext.enroll(targetId);
        setIsSuccess(true);
        setSuccessMessage(response.message || 'تم التسجيل في الدورة بنجاح!');
        return response;
      } catch (err: unknown) {
        const fallbackMsg = 'حدث خطأ أثناء محاولة التسجيل. يرجى إعادة المحاولة.';
        const rawMsg = err instanceof Error ? err.message : fallbackMsg;
        setError(sanitizeErrorMessage(rawMsg, fallbackMsg));
        return undefined;
      } finally {
        setIsSubmitting(false);
      }
    },
    [courseId, isAuthenticated, user?.role, enrollmentContext]
  );

  const resetState = useCallback(() => {
    setError(null);
    setIsSuccess(false);
    setSuccessMessage(null);
  }, []);

  return {
    enroll,
    isEnrolled,
    enrollment,
    isEligible,
    isSubmitting,
    isLoadingStatus: enrollmentContext.isLoading,
    isSuccess,
    successMessage,
    error,
    resetState,
  };
}

export default useEnrollCourse;
