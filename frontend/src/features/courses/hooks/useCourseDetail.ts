import { useState, useEffect, useCallback } from 'react';
import { coursesApi } from '../services/coursesApi';
import { ApiError, sanitizeErrorMessage } from '@/core/api/apiClient';
import type { Course } from '@/core/courses/types';

export interface UseCourseDetailResult {
  course: Course | null;
  isLoading: boolean;
  error: string | null;
  isNotFound: boolean;
  refetch: () => Promise<void>;
}

export function useCourseDetail(courseId?: string): UseCourseDetailResult {
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!courseId) {
      setIsNotFound(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsNotFound(false);

    try {
      const data = await coursesApi.getCourseById(courseId);
      setCourse(data);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) {
        setIsNotFound(true);
      } else {
        const fallbackMsg = 'تعذر تحميل بيانات الدورة التدريبية حاليًا. يرجى المحاولة مرة أخرى.';
        const rawMsg = err instanceof Error ? err.message : fallbackMsg;
        setError(sanitizeErrorMessage(rawMsg, fallbackMsg));
      }
      setCourse(null);
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return {
    course,
    isLoading,
    error,
    isNotFound,
    refetch: fetchDetail,
  };
}
