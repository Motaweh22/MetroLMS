import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Course, ChapterItem } from '@/core/courses/types';
import type { UserRole } from '@/core/auth/types';
import type { CourseProgress, EnrichedChapterItem } from '../types';
import { isLessonLocked, resolveResumeLesson } from '@/core/domain/progress';

interface UseLearningPlayerProps {
  course: Course | null;
  progress: CourseProgress | null;
  userRole?: UserRole;
  initialItemId?: string;
  onItemChange?: (newItem: EnrichedChapterItem) => void;
}

interface UseLearningPlayerResult {
  flatItems: EnrichedChapterItem[];
  currentItem: EnrichedChapterItem | null;
  currentIndex: number;
  prevItem: EnrichedChapterItem | null;
  nextItem: EnrichedChapterItem | null;
  canGoPrev: boolean;
  canGoNext: boolean;
  lockedWarning: string | null;
  clearLockedWarning: () => void;
  selectItem: (itemId: string) => boolean;
  goToPrev: () => void;
  goToNext: () => void;
}

export function useLearningPlayer({
  course,
  progress,
  userRole,
  initialItemId,
  onItemChange,
}: UseLearningPlayerProps): UseLearningPlayerResult {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(initialItemId || null);
  const [lockedWarning, setLockedWarning] = useState<string | null>(null);

  // Flatten course chapters into linear enriched items
  const flatItems: EnrichedChapterItem[] = useMemo(() => {
    if (!course?.chapters) return [];

    const completedIds = progress?.completedItemIds || [];

    // Step 1: Linearize all curriculum items first to provide full curriculum context
    const linearItems: { item: ChapterItem; chapterId: string; chapterTitle: string }[] = [];
    for (const ch of course.chapters) {
      for (const item of ch.items) {
        linearItems.push({
          item,
          chapterId: ch.id,
          chapterTitle: ch.title,
        });
      }
    }

    const rawChapterItems = linearItems.map((li) => li.item);

    // Step 2: Enrich items with authoritative sequential lock states and progress
    return linearItems.map(({ item, chapterId, chapterTitle }, globalIndex) => {
      const isCompleted = completedIds.includes(item.id);
      const locked = isLessonLocked(globalIndex, rawChapterItems, completedIds, userRole);
      const itemProg = progress?.itemsProgress?.[item.id];

      return {
        ...item,
        chapterId,
        chapterTitle,
        globalIndex,
        isCompleted,
        isLocked: locked,
        isActive: false, // will be set dynamically below
        progress: itemProg,
      };
    });
  }, [course, progress, userRole]);

  // Initial resume item selection & locked lesson URL route guarding
  useEffect(() => {
    if (flatItems.length === 0) return;

    if (!selectedItemId) {
      const resume = resolveResumeLesson(
        flatItems,
        progress?.completedItemIds || [],
        progress?.lastWatchedItemId || null,
        userRole
      );
      if (resume) {
        setSelectedItemId(resume.id);
      }
    } else {
      // Verify currently selected item exists in course and is not locked for trainees
      const currentSelected = flatItems.find((it) => it.id === selectedItemId);
      if (!currentSelected || (currentSelected.isLocked && userRole !== 'admin' && userRole !== 'lecturer')) {
        const resume = resolveResumeLesson(
          flatItems,
          progress?.completedItemIds || [],
          progress?.lastWatchedItemId || null,
          userRole
        );
        if (resume && resume.id !== selectedItemId) {
          setSelectedItemId(resume.id);
          if (onItemChange) {
            onItemChange(resume as EnrichedChapterItem);
          }
        }
      }
    }
  }, [flatItems, progress, selectedItemId, userRole, onItemChange]);

  // Synchronize selection if initialItemId prop changes from URL
  useEffect(() => {
    if (initialItemId && initialItemId !== selectedItemId && flatItems.length > 0) {
      const target = flatItems.find((it) => it.id === initialItemId);
      if (target) {
        if (!target.isLocked || userRole === 'admin' || userRole === 'lecturer') {
          setSelectedItemId(initialItemId);
        } else {
          setLockedWarning('عليك إكمال الدرس السابق أولاً لتتمكن من الوصول إلى هذا المحتوى');
        }
      }
    }
  }, [initialItemId, flatItems, selectedItemId, userRole]);

  // Derive active items and indices
  const currentIndex = useMemo(() => {
    if (!selectedItemId) return 0;
    const idx = flatItems.findIndex((it) => it.id === selectedItemId);
    return idx !== -1 ? idx : 0;
  }, [flatItems, selectedItemId]);

  const currentItem = useMemo(() => {
    if (flatItems.length === 0) return null;
    const item = flatItems[currentIndex];
    return item ? { ...item, isActive: true } : null;
  }, [flatItems, currentIndex]);

  const prevItem = useMemo(() => {
    if (currentIndex > 0) return flatItems[currentIndex - 1];
    return null;
  }, [flatItems, currentIndex]);

  const nextItem = useMemo(() => {
    if (currentIndex < flatItems.length - 1) return flatItems[currentIndex + 1];
    return null;
  }, [flatItems, currentIndex]);

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < flatItems.length - 1 && (!nextItem?.isLocked);

  const clearLockedWarning = useCallback(() => {
    setLockedWarning(null);
  }, []);

  const selectItem = useCallback(
    (itemId: string): boolean => {
      const target = flatItems.find((it) => it.id === itemId);
      if (!target) return false;

      if (target.isLocked) {
        setLockedWarning('عليك إكمال الدرس السابق أولاً لتتمكن من الوصول إلى هذا المحتوى');
        return false;
      }

      setLockedWarning(null);
      setSelectedItemId(itemId);
      if (onItemChange) {
        onItemChange(target);
      }
      return true;
    },
    [flatItems, onItemChange]
  );

  const goToPrev = useCallback(() => {
    if (prevItem) {
      selectItem(prevItem.id);
    }
  }, [prevItem, selectItem]);

  const goToNext = useCallback(() => {
    if (nextItem) {
      selectItem(nextItem.id);
    }
  }, [nextItem, selectItem]);

  return {
    flatItems,
    currentItem,
    currentIndex,
    prevItem,
    nextItem,
    canGoPrev,
    canGoNext,
    lockedWarning,
    clearLockedWarning,
    selectItem,
    goToPrev,
    goToNext,
  };
}
