import { describe, it, expect } from 'vitest';
import {
  calculateTraineeProgress,
  isLessonLocked,
  resolveResumeLesson,
  clampSeekingPosition,
  formatDuration,
} from '@/core/domain/progress';
import type { ChapterItem } from '@/core/courses/types';

describe('Increment 6: Domain Logic Characterization Suite', () => {
  describe('calculateTraineeProgress', () => {
    it('returns 0% for an empty course (0 items) without division by zero', () => {
      expect(calculateTraineeProgress(0, 0)).toBe(0);
      expect(calculateTraineeProgress(0, 5)).toBe(0);
    });

    it('returns 0% when completed count is 0', () => {
      expect(calculateTraineeProgress(10, 0)).toBe(0);
    });

    it('handles negative, non-finite, and NaN inputs safely', () => {
      expect(calculateTraineeProgress(-5, 2)).toBe(0);
      expect(calculateTraineeProgress(10, -2)).toBe(0);
      expect(calculateTraineeProgress(NaN, 5)).toBe(0);
      expect(calculateTraineeProgress(10, NaN)).toBe(0);
      expect(calculateTraineeProgress(Infinity, 5)).toBe(0);
    });

    it('calculates and rounds partial completion percentages correctly', () => {
      // 3/10 -> 30%
      expect(calculateTraineeProgress(10, 3)).toBe(30);

      // 3/7 -> 42.857% -> 43%
      expect(calculateTraineeProgress(7, 3)).toBe(43);

      // 1/3 -> 33.333% -> 33%
      expect(calculateTraineeProgress(3, 1)).toBe(33);

      // 2/3 -> 66.666% -> 67%
      expect(calculateTraineeProgress(3, 2)).toBe(67);
    });

    it('returns 100% only when all eligible items are completed', () => {
      expect(calculateTraineeProgress(1, 1)).toBe(100);
      expect(calculateTraineeProgress(10, 10)).toBe(100);
      expect(calculateTraineeProgress(5, 5)).toBe(100);
    });

    it('caps progress at 99% if rounding would hit 100% before all items are finished', () => {
      // 999 / 1000 = 99.9% -> without safeguard Math.round gives 100%
      expect(calculateTraineeProgress(1000, 999)).toBe(99);
    });

    it('clamps completed count to total items if completed exceeds total', () => {
      expect(calculateTraineeProgress(5, 8)).toBe(100);
    });
  });

  describe('isLessonLocked', () => {
    const mockItems: ChapterItem[] = [
      { id: 'item_01', type: 'video', title: 'Lesson 1' },
      { id: 'item_02', type: 'video', title: 'Lesson 2' },
      { id: 'item_03', type: 'pdf', title: 'Lesson 3' },
      { id: 'item_04', type: 'video', title: 'Lesson 4' },
    ];

    it('first lesson (index 0) is always unlocked for trainees', () => {
      expect(isLessonLocked(0, mockItems, [], 'user')).toBe(false);
    });

    it('subsequent lesson (index N > 0) is locked if predecessor is incomplete', () => {
      // Lesson 2 requires Lesson 1 to be in completedItemIds
      expect(isLessonLocked(1, mockItems, [], 'user')).toBe(true);

      // Even if Lesson 3 or 4 somehow had completion, Lesson 2 is locked if Lesson 1 is not complete
      expect(isLessonLocked(1, mockItems, ['item_03'], 'user')).toBe(true);
    });

    it('subsequent lesson unlocks once immediately preceding lesson is completed', () => {
      expect(isLessonLocked(1, mockItems, ['item_01'], 'user')).toBe(false);

      // Lesson 3 is locked until Lesson 2 is completed
      expect(isLessonLocked(2, mockItems, ['item_01'], 'user')).toBe(true);
      expect(isLessonLocked(2, mockItems, ['item_01', 'item_02'], 'user')).toBe(false);
    });

    it('correctly unlocks lesson when flatItems contains items up to predecessor', () => {
      // Partial array containing only the predecessor item [mockItems[0]]
      const singleItemArray = [mockItems[0]];
      expect(isLessonLocked(1, singleItemArray, ['item_01'], 'user')).toBe(false);
      expect(isLessonLocked(1, singleItemArray, [], 'user')).toBe(true);
    });

    it('bypasses locking for lecturers and administrators (preview mode)', () => {
      expect(isLessonLocked(0, mockItems, [], 'lecturer')).toBe(false);
      expect(isLessonLocked(1, mockItems, [], 'lecturer')).toBe(false);
      expect(isLessonLocked(2, mockItems, [], 'lecturer')).toBe(false);
      expect(isLessonLocked(3, mockItems, [], 'lecturer')).toBe(false);

      expect(isLessonLocked(1, mockItems, [], 'admin')).toBe(false);
      expect(isLessonLocked(2, mockItems, [], 'admin')).toBe(false);
      expect(isLessonLocked(3, mockItems, [], 'admin')).toBe(false);
    });

    it('returns true for out-of-bounds indices', () => {
      expect(isLessonLocked(10, mockItems, ['item_01', 'item_02', 'item_03', 'item_04'], 'user')).toBe(true);
      expect(isLessonLocked(-1, mockItems, [], 'user')).toBe(true);
    });
  });

  describe('resolveResumeLesson', () => {
    const mockItems: ChapterItem[] = [
      { id: 'item_01', type: 'video', title: 'Lesson 1' },
      { id: 'item_02', type: 'video', title: 'Lesson 2' },
      { id: 'item_03', type: 'pdf', title: 'Lesson 3' },
    ];

    it('returns null for an empty curriculum', () => {
      expect(resolveResumeLesson([], [], null, 'user')).toBeNull();
    });

    it('resumes at lastWatchedItemId if valid and unlocked', () => {
      // Item 1 completed, trainee was on Item 2 (which is unlocked)
      const resume = resolveResumeLesson(mockItems, ['item_01'], 'item_02', 'user');
      expect(resume?.id).toBe('item_02');
    });

    it('guards against resuming into a locked lastWatchedItemId, falling back to first unlocked incomplete', () => {
      // Suppose corrupted store has lastWatchedItem = item_03, but item_01 is NOT completed
      // item_03 is locked, so resolveResumeLesson must not return item_03!
      const resume = resolveResumeLesson(mockItems, [], 'item_03', 'user');
      expect(resume?.id).toBe('item_01');
    });

    it('selects first incomplete unlocked lesson when lastWatchedItemId is missing', () => {
      // item_01 is completed, item_02 is next
      const resume = resolveResumeLesson(mockItems, ['item_01'], null, 'user');
      expect(resume?.id).toBe('item_02');
    });

    it('falls back to the first lesson if all lessons are completed', () => {
      const resume = resolveResumeLesson(mockItems, ['item_01', 'item_02', 'item_03'], null, 'user');
      expect(resume?.id).toBe('item_01');
    });
  });

  describe('clampSeekingPosition', () => {
    it('clamps forward seeking past furthestWatchedSeconds for incomplete lesson', () => {
      // Furthest watched is 30s; trainee tries to seek to 45s
      expect(clampSeekingPosition(45, 30, false)).toBe(30);
    });

    it('allows backward seeking to previously watched positions for incomplete lesson', () => {
      // Furthest watched is 30s; trainee seeks to 15s
      expect(clampSeekingPosition(15, 30, false)).toBe(15);
    });

    it('allows unrestricted seeking across duration for completed lesson', () => {
      // Lesson is completed; trainee seeks to 120s even if furthestWatched was 90s
      expect(clampSeekingPosition(120, 90, true)).toBe(120);
    });

    it('handles negative or invalid target times safely', () => {
      expect(clampSeekingPosition(-10, 30, false)).toBe(0);
      expect(clampSeekingPosition(NaN, 30, false)).toBe(0);
    });
  });

  describe('formatDuration', () => {
    it('formats seconds < 3600 as mm:ss', () => {
      expect(formatDuration(0)).toBe('00:00');
      expect(formatDuration(45)).toBe('00:45');
      expect(formatDuration(255)).toBe('04:15');
      expect(formatDuration(1110)).toBe('18:30');
    });

    it('formats seconds >= 3600 as hh:mm:ss', () => {
      expect(formatDuration(3600)).toBe('01:00:00');
      expect(formatDuration(4530)).toBe('01:15:30');
    });

    it('handles negative, non-finite, and NaN gracefully', () => {
      expect(formatDuration(-10)).toBe('00:00');
      expect(formatDuration(NaN)).toBe('00:00');
      expect(formatDuration(Infinity)).toBe('00:00');
    });
  });
});
