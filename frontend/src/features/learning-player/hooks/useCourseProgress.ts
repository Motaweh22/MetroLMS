import { useState, useEffect, useCallback, useRef } from 'react';
import { learningApi } from '../services/learningApi';
import { sanitizeErrorMessage } from '@/core/api/apiClient';
import type { CourseProgress, LessonProgress, CompleteLessonResponse } from '../types';

interface UseCourseProgressResult {
  progress: CourseProgress | null;
  isLoading: boolean;
  error: string | null;
  isSubmitting: boolean;
  refetch: () => Promise<void>;
  completeLesson: (itemId: string) => Promise<CompleteLessonResponse | null>;
  isItemCompleted: (itemId: string) => boolean;
  getItemProgress: (itemId: string) => LessonProgress | undefined;
  updateLocalActivity: (itemId: string, activity: Partial<LessonProgress>) => void;
}

export function useCourseProgress(courseId: string | undefined): UseCourseProgressResult {
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchProgress = useCallback(async () => {
    if (!courseId) {
      setProgress(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const res = await learningApi.getCourseProgress(courseId);
      if (isMountedRef.current) {
        setProgress(res.progress);
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const fallbackMsg = 'تعذر تحميل بيانات تقدم الدورة. يرجى المحاولة لاحقاً.';
        const rawMsg = err instanceof Error ? err.message : fallbackMsg;
        setError(sanitizeErrorMessage(rawMsg, fallbackMsg));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [courseId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const isItemCompleted = useCallback(
    (itemId: string): boolean => {
      if (!progress) return false;
      return progress.completedItemIds.includes(itemId);
    },
    [progress]
  );

  const getItemProgress = useCallback(
    (itemId: string): LessonProgress | undefined => {
      if (!progress?.itemsProgress) return undefined;
      return progress.itemsProgress[itemId];
    },
    [progress]
  );

  const updateLocalActivity = useCallback(
    (itemId: string, activity: Partial<LessonProgress>) => {
      setProgress((prev) => {
        if (!prev) return prev;
        const currentItemProg = prev.itemsProgress[itemId] || {
          itemId,
          completed: false,
          lastPositionSeconds: 0,
          furthestWatchedSeconds: 0,
          eligibleViewingSeconds: 0,
          updatedAt: new Date().toISOString(),
        };

        const updatedItem: LessonProgress = {
          ...currentItemProg,
          lastPositionSeconds:
            activity.lastPositionSeconds !== undefined
              ? activity.lastPositionSeconds
              : currentItemProg.lastPositionSeconds,
          furthestWatchedSeconds:
            activity.furthestWatchedSeconds !== undefined
              ? Math.max(
                  currentItemProg.furthestWatchedSeconds,
                  activity.furthestWatchedSeconds
                )
              : currentItemProg.furthestWatchedSeconds,
          durationSeconds:
            activity.durationSeconds !== undefined
              ? activity.durationSeconds
              : currentItemProg.durationSeconds,
          eligibleViewingSeconds:
            activity.eligibleViewingSeconds !== undefined
              ? Math.max(
                  currentItemProg.eligibleViewingSeconds ?? 0,
                  activity.eligibleViewingSeconds
                )
              : currentItemProg.eligibleViewingSeconds ?? 0,
          updatedAt: new Date().toISOString(),
        };

        return {
          ...prev,
          lastWatchedItemId: itemId,
          itemsProgress: {
            ...prev.itemsProgress,
            [itemId]: updatedItem,
          },
        };
      });
    },
    []
  );

  const completeLesson = useCallback(
    async (itemId: string): Promise<CompleteLessonResponse | null> => {
      if (!courseId || isSubmitting) return null;

      try {
        setIsSubmitting(true);
        const res = await learningApi.completeLesson(courseId, { itemId });
        if (isMountedRef.current) {
          setProgress(res.progress);
        }
        return res;
      } catch (err: unknown) {
        if (isMountedRef.current) {
          const fallbackMsg = 'تعذر إكمال الدرس حاليًا. يرجى المحاولة لاحقاً.';
          const rawMsg = err instanceof Error ? err.message : fallbackMsg;
          setError(sanitizeErrorMessage(rawMsg, fallbackMsg));
        }
        return null;
      } finally {
        if (isMountedRef.current) {
          setIsSubmitting(false);
        }
      }
    },
    [courseId, isSubmitting]
  );

  return {
    progress,
    isLoading,
    error,
    isSubmitting,
    refetch: fetchProgress,
    completeLesson,
    isItemCompleted,
    getItemProgress,
    updateLocalActivity,
  };
}
