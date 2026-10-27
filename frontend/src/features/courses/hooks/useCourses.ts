import { useState, useEffect, useCallback } from 'react';
import { coursesApi } from '../services/coursesApi';
import { sanitizeErrorMessage } from '@/core/api/apiClient';
import type { Course, CourseFilterParams } from '@/core/courses/types';

export interface UseCoursesResult {
  courses: Course[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCourses(params?: CourseFilterParams): UseCoursesResult {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const search = params?.search;
  const level = params?.level;
  const sortBy = params?.sortBy;

  const fetchCourses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await coursesApi.getCourses({ search, level, sortBy });
      setCourses(data);
    } catch (err: unknown) {
      const fallbackMsg = 'تعذر تحميل الدورات التدريبية حاليًا. يرجى المحاولة مرة أخرى.';
      const rawMsg = err instanceof Error ? err.message : fallbackMsg;
      setError(sanitizeErrorMessage(rawMsg, fallbackMsg));
      setCourses([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, level, sortBy]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  return {
    courses,
    totalCount: courses.length,
    isLoading,
    error,
    refetch: fetchCourses,
  };
}
