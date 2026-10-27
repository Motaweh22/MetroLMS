import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { parseDurationToSeconds, formatDuration } from '@/core/domain/progress';
import { ItemEditorModal } from '@/features/course-builder/components/ItemEditorModal';
import { GoogleDrivePlayer } from '@/features/learning-player/components/GoogleDrivePlayer';
import { CurriculumSidebar } from '@/features/learning-player/components/CurriculumSidebar';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import type { ChapterItem, CourseChapter } from '@/core/courses/types';
import type { EnrichedChapterItem } from '@/features/learning-player/types';

describe('Minimum Viewing Time & Locked Content Icons Implementation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // Part A.1: Duration Parsing Domain Utility
  // =========================================================================
  describe('parseDurationToSeconds domain utility', () => {
    it('correctly parses MM:SS format into seconds', () => {
      expect(parseDurationToSeconds('18:30')).toBe(1110);
      expect(parseDurationToSeconds('10:00')).toBe(600);
      expect(parseDurationToSeconds('01:39')).toBe(99);
      expect(parseDurationToSeconds('0:05')).toBe(5);
    });

    it('correctly parses HH:MM:SS format into seconds', () => {
      expect(parseDurationToSeconds('01:15:30')).toBe(4530);
      expect(parseDurationToSeconds('02:00:00')).toBe(7200);
    });

    it('returns 0 for zero durations, empty strings, invalid inputs, and negative numbers', () => {
      expect(parseDurationToSeconds('00:00')).toBe(0);
      expect(parseDurationToSeconds('0:00')).toBe(0);
      expect(parseDurationToSeconds('')).toBe(0);
      expect(parseDurationToSeconds(undefined)).toBe(0);
      expect(parseDurationToSeconds('invalid')).toBe(0);
      expect(parseDurationToSeconds('-10:00')).toBe(0);
    });

    it('formats duration back properly with formatDuration', () => {
      expect(formatDuration(1110)).toBe('18:30');
      expect(formatDuration(4530)).toBe('01:15:30');
      expect(formatDuration(0)).toBe('00:00');
    });
  });

  // =========================================================================
  // Part A.2: Administrator Settings & Persistence in ItemEditorModal
  // =========================================================================
  describe('ItemEditorModal - Administrator Configuration & Defaults', () => {
    it('defaults requireMinimumViewingTime to true for newly created Google Drive lessons', () => {
      const handleSave = vi.fn();
      render(
        <ItemEditorModal
          isOpen={true}
          chapterTitle="فصل تجريبي"
          item={null}
          onClose={() => {}}
          onSave={handleSave}
        />
      );

      fireEvent.change(screen.getByTestId('item-title-input'), {
        target: { value: 'درس درايف تجريبي' },
      });
      fireEvent.click(screen.getByTestId('video-source-drive'));
      fireEvent.change(screen.getByTestId('drive-url-input'), {
        target: {
          value: 'https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/view',
        },
      });

      const toggle = screen.getByTestId('require-minimum-viewing-time-toggle') as HTMLInputElement;
      expect(toggle).toBeInTheDocument();
      expect(toggle.checked).toBe(true);

      fireEvent.click(screen.getByTestId('item-save-btn'));
      expect(handleSave).toHaveBeenCalledTimes(1);

      const savedItem: ChapterItem = handleSave.mock.calls[0][0];
      expect(savedItem.completionPolicy).toEqual({
        requireMinimumViewingTime: true,
      });
      // Separate from embedPolicy
      expect(savedItem.embedPolicy).toEqual({
        cropTopPixels: 55,
        blockPopups: true,
      });
    });

    it('allows administrator to explicitly disable the minimum-time requirement', () => {
      const handleSave = vi.fn();
      render(
        <ItemEditorModal
          isOpen={true}
          chapterTitle="فصل تجريبي"
          item={null}
          onClose={() => {}}
          onSave={handleSave}
        />
      );

      fireEvent.change(screen.getByTestId('item-title-input'), {
        target: { value: 'درس درايف اختياري' },
      });
      fireEvent.click(screen.getByTestId('video-source-drive'));
      fireEvent.change(screen.getByTestId('drive-url-input'), {
        target: {
          value: 'https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/view',
        },
      });

      const toggle = screen.getByTestId('require-minimum-viewing-time-toggle');
      fireEvent.click(toggle); // Uncheck it

      fireEvent.click(screen.getByTestId('item-save-btn'));
      expect(handleSave).toHaveBeenCalledTimes(1);

      const savedItem: ChapterItem = handleSave.mock.calls[0][0];
      expect(savedItem.completionPolicy).toEqual({
        requireMinimumViewingTime: false,
      });
    });

    it('preserves an existing lesson explicitly saved setting when editing', () => {
      const existingItem: ChapterItem = {
        id: 'item_drive_explicit',
        title: 'محاضرة محفوظة مسبقاً',
        type: 'video',
        videoSourceType: 'drive',
        driveFileId: '1aBcDeFgHiJkLmNoPqRsTuVwXyZ',
        duration: '15:00',
        completionPolicy: {
          requireMinimumViewingTime: false,
        },
        embedPolicy: {
          cropTopPixels: 55,
          blockPopups: true,
        },
      };

      const handleSave = vi.fn();
      render(
        <ItemEditorModal
          isOpen={true}
          chapterTitle="فصل تجريبي"
          item={existingItem}
          onClose={() => {}}
          onSave={handleSave}
        />
      );

      const toggle = screen.getByTestId('require-minimum-viewing-time-toggle') as HTMLInputElement;
      expect(toggle.checked).toBe(false);

      fireEvent.click(screen.getByTestId('item-save-btn'));
      expect(handleSave).toHaveBeenCalledTimes(1);

      const savedItem: ChapterItem = handleSave.mock.calls[0][0];
      expect(savedItem.completionPolicy?.requireMinimumViewingTime).toBe(false);
    });

    it('provides backward-compatible default (false) for historical lessons without completionPolicy', () => {
      const historicalItem: ChapterItem = {
        id: 'item_historical_drive',
        title: 'درس تاريخي بدون إعدادات إكمال',
        type: 'video',
        videoSourceType: 'drive',
        driveFileId: '1aBcDeFgHiJkLmNoPqRsTuVwXyZ',
        duration: '12:00',
        // completionPolicy omitted
      };

      render(
        <ItemEditorModal
          isOpen={true}
          chapterTitle="فصل تجريبي"
          item={historicalItem}
          onClose={() => {}}
          onSave={vi.fn()}
        />
      );

      const toggle = screen.getByTestId('require-minimum-viewing-time-toggle') as HTMLInputElement;
      // Should not be checked so existing learners are not unexpectedly locked out
      expect(toggle.checked).toBe(false);
    });

    it('validates that a usable duration exists and prevents invalid durations (00:00) when requirement is enabled', () => {
      const handleSave = vi.fn();
      render(
        <ItemEditorModal
          isOpen={true}
          chapterTitle="فصل تجريبي"
          item={null}
          onClose={() => {}}
          onSave={handleSave}
        />
      );

      fireEvent.change(screen.getByTestId('item-title-input'), {
        target: { value: 'درس مع مدة غير صالحة' },
      });
      fireEvent.click(screen.getByTestId('video-source-drive'));
      fireEvent.change(screen.getByTestId('drive-url-input'), {
        target: {
          value: 'https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/view',
        },
      });

      // Enter 00:00 as duration
      fireEvent.change(screen.getByTestId('item-duration-input'), {
        target: { value: '00:00' },
      });

      fireEvent.click(screen.getByTestId('item-save-btn'));

      // Save must be blocked and error shown
      expect(handleSave).not.toHaveBeenCalled();
      expect(
        screen.getByText(/يرجى تحديد مدة صالحة للمحاضرة.*عند تفعيل اشتراط الحد الأدنى لوقت المشاهدة/i)
      ).toBeInTheDocument();
    });

    it('does not display the Google Drive completion toggle for YouTube lessons', () => {
      render(
        <ItemEditorModal
          isOpen={true}
          chapterTitle="فصل تجريبي"
          item={null}
          onClose={() => {}}
          onSave={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId('video-source-youtube'));
      expect(screen.queryByTestId('gdrive-completion-policy-section')).not.toBeInTheDocument();
      expect(screen.queryByTestId('require-minimum-viewing-time-toggle')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Part A.3: Learner-Side GoogleDrivePlayer Timing Behavior
  // =========================================================================
  describe('GoogleDrivePlayer - Learner Foreground Timing & Completion Gate', () => {
    it('blocks lesson completion and displays remaining wait time until threshold is satisfied', async () => {
      const handleComplete = vi.fn().mockResolvedValue(true);
      const onProgressUpdate = vi.fn();

      render(
        <GoogleDrivePlayer
          driveFileId="1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
          itemId="item_01"
          title="محاضرة إشارات المترو"
          duration="00:05" // 5 seconds
          completionPolicy={{ requireMinimumViewingTime: true }}
          isCompleted={false}
          onComplete={handleComplete}
          onLocalProgressUpdate={onProgressUpdate}
        />
      );

      const completeBtn = screen.getByTestId('drive-mark-complete-btn');
      expect(completeBtn).toBeDisabled();
      expect(screen.getByTestId('drive-viewing-time-feedback')).toHaveTextContent(
        'الحد الأدنى للمشاهدة: متبقي 00:05 لتأكيد الإكمال'
      );

      // Advance 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(completeBtn).toBeDisabled();
      expect(screen.getByTestId('drive-viewing-time-feedback')).toHaveTextContent(
        'الحد الأدنى للمشاهدة: متبقي 00:03 لتأكيد الإكمال'
      );
      expect(onProgressUpdate).toHaveBeenCalledWith('item_01', expect.objectContaining({
        eligibleViewingSeconds: 2,
      }));
      // Verify that actual playback-position fields are untouched
      const reportedActivity = onProgressUpdate.mock.calls[0][1];
      expect(reportedActivity.lastPositionSeconds).toBeUndefined();
      expect(reportedActivity.furthestWatchedSeconds).toBeUndefined();

      // Advance remaining 3 seconds (reaches 5s threshold)
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Verification: Threshold met allows completion workflow to proceed
      expect(completeBtn).toBeEnabled();
      expect(screen.getByTestId('drive-viewing-time-feedback')).toHaveTextContent(
        'تم استيفاء الحد الأدنى لوقت المشاهدة المطلوب'
      );

      // CRITICAL RULE: Timer expiration MUST NOT auto-complete the lesson
      expect(handleComplete).not.toHaveBeenCalled();

      // Learner confirms completion manually
      await act(async () => {
        fireEvent.click(completeBtn);
      });
      expect(handleComplete).toHaveBeenCalledWith('item_01');
    });

    it('pauses time accumulation when document visibility becomes hidden and resumes when visible', () => {
      let visibilityState = 'visible';
      Object.defineProperty(document, 'visibilityState', {
        get: () => visibilityState,
        configurable: true,
      });

      render(
        <GoogleDrivePlayer
          driveFileId="1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
          itemId="item_02"
          title="محاضرة السلامة"
          duration="00:10"
          completionPolicy={{ requireMinimumViewingTime: true }}
          isCompleted={false}
          onComplete={vi.fn()}
          onLocalProgressUpdate={vi.fn()}
        />
      );

      // Accumulate 2s in foreground
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByTestId('drive-viewing-time-feedback')).toHaveTextContent(
        'الحد الأدنى للمشاهدة: متبقي 00:08 لتأكيد الإكمال'
      );

      // Learner switches tab -> page becomes hidden
      act(() => {
        visibilityState = 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Advance 5s while hidden
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Time should NOT have accumulated while hidden (still 8s remaining)
      expect(screen.getByTestId('drive-viewing-time-feedback')).toHaveTextContent(
        'الحد الأدنى للمشاهدة: متبقي 00:08 لتأكيد الإكمال'
      );

      // Learner returns to tab -> page becomes visible
      act(() => {
        visibilityState = 'visible';
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Advance 2s in foreground
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByTestId('drive-viewing-time-feedback')).toHaveTextContent(
        'الحد الأدنى للمشاهدة: متبقي 00:06 لتأكيد الإكمال'
      );
    });

    it('retains cumulative eligible time when returning to the lesson via initialEligibleSeconds', () => {
      // Simulates returning to lesson with 120s already accumulated in eligibleViewingSeconds
      render(
        <GoogleDrivePlayer
          driveFileId="1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
          itemId="item_03"
          title="محاضرة الصيانة"
          duration="03:00" // 180 seconds total
          completionPolicy={{ requireMinimumViewingTime: true }}
          isCompleted={false}
          initialEligibleSeconds={120} // 120 seconds previously accumulated in eligibleViewingSeconds
          onComplete={vi.fn()}
          onLocalProgressUpdate={vi.fn()}
        />
      );

      // Should start with remaining 60s (01:00) instead of restarting from 03:00
      expect(screen.getByTestId('drive-viewing-time-feedback')).toHaveTextContent(
        'الحد الأدنى للمشاهدة: متبقي 01:00 لتأكيد الإكمال'
      );
    });

    it('supports backward compatibility when legacy initialElapsedSeconds is supplied', () => {
      render(
        <GoogleDrivePlayer
          driveFileId="1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
          itemId="item_legacy"
          title="محاضرة قديمة"
          duration="03:00"
          completionPolicy={{ requireMinimumViewingTime: true }}
          isCompleted={false}
          initialElapsedSeconds={90}
          onComplete={vi.fn()}
          onLocalProgressUpdate={vi.fn()}
        />
      );

      expect(screen.getByTestId('drive-viewing-time-feedback')).toHaveTextContent(
        'الحد الأدنى للمشاهدة: متبقي 01:30 لتأكيد الإكمال'
      );
    });

    it('persists and restores accumulated eligibleViewingSeconds through inMemoryStore queries, resuming accurately', () => {
      inMemoryStore.reset();
      const userId = 'USR001';
      const courseId = 'CRS001';
      const itemId = 'ITEM001';

      // 1. Record eligible viewing seconds without touching playback positions
      const recorded = inMemoryStore.recordLessonActivity({
        userId,
        courseId,
        itemId,
        activity: {
          eligibleViewingSeconds: 45,
          durationSeconds: 120,
        },
      });

      expect(recorded.eligibleViewingSeconds).toBe(45);
      // Playback positions must remain untouched (0)
      expect(recorded.lastPositionSeconds).toBe(0);
      expect(recorded.furthestWatchedSeconds).toBe(0);

      // 2. Query course progress (simulating page reload/refresh)
      const freshProgress = inMemoryStore.getCourseProgress(userId, courseId);
      const itemProg = freshProgress.itemsProgress[itemId];
      expect(itemProg).toBeDefined();
      expect(itemProg.eligibleViewingSeconds).toBe(45);
      expect(itemProg.lastPositionSeconds).toBe(0);
      expect(itemProg.furthestWatchedSeconds).toBe(0);

      // 3. Mount GoogleDrivePlayer with restored eligibleViewingSeconds
      render(
        <GoogleDrivePlayer
          driveFileId="1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
          itemId={itemId}
          title="محاضرة مسترجعة بعد التحديث"
          duration="02:00" // 120s
          completionPolicy={{ requireMinimumViewingTime: true }}
          isCompleted={false}
          initialEligibleSeconds={itemProg.eligibleViewingSeconds}
          onComplete={vi.fn()}
          onLocalProgressUpdate={vi.fn()}
        />
      );

      // Resumes at 45s: remaining is 75s (01:15)
      expect(screen.getByTestId('drive-viewing-time-feedback')).toHaveTextContent(
        'الحد الأدنى للمشاهدة: متبقي 01:15 لتأكيد الإكمال'
      );
    });

    it('maintains backward compatibility for historical progress records lacking eligibleViewingSeconds without overwriting actual playback positions', () => {
      inMemoryStore.reset();
      const userId = 'USR001';
      const courseId = 'CRS001';
      const itemId = 'ITEM002';

      // Record actual video playback position (e.g. from YouTube or native video)
      inMemoryStore.recordLessonActivity({
        userId,
        courseId,
        itemId,
        activity: {
          lastPositionSeconds: 150,
          furthestWatchedSeconds: 200,
          durationSeconds: 300,
        },
      });

      const prog = inMemoryStore.getCourseProgress(userId, courseId).itemsProgress[itemId];
      expect(prog.lastPositionSeconds).toBe(150);
      expect(prog.furthestWatchedSeconds).toBe(200);
      expect(prog.eligibleViewingSeconds).toBe(0); // Safely initialized to 0 without mutating playback positions
    });

    it('does not require learner to wait again on subsequent visits after item is marked complete', () => {
      render(
        <GoogleDrivePlayer
          driveFileId="1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
          itemId="item_04"
          title="محاضرة مكتملة"
          duration="10:00"
          completionPolicy={{ requireMinimumViewingTime: true }}
          isCompleted={true}
          onComplete={vi.fn()}
        />
      );

      const completeBtn = screen.getByTestId('drive-mark-complete-btn');
      expect(completeBtn).toHaveTextContent(/تم توثيق إكمال المحاضرة/);
      // No timer feedback displayed for completed items
      expect(screen.queryByTestId('drive-viewing-time-feedback')).not.toBeInTheDocument();
    });

    it('restores existing completion workflow immediately when administrator disables requirement', async () => {
      const handleComplete = vi.fn();
      render(
        <GoogleDrivePlayer
          driveFileId="1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
          itemId="item_05"
          title="محاضرة بدون اشتراط زمني"
          duration="10:00"
          completionPolicy={{ requireMinimumViewingTime: false }}
          isCompleted={false}
          onComplete={handleComplete}
        />
      );

      const completeBtn = screen.getByTestId('drive-mark-complete-btn');
      // Button is enabled immediately without wait
      expect(completeBtn).toBeEnabled();
      expect(screen.queryByTestId('drive-viewing-time-feedback')).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(completeBtn);
      });
      expect(handleComplete).toHaveBeenCalledWith('item_05');
    });
  });

  // =========================================================================
  // Part B: Content-Type Icon & Lock Indicator Layout in Course Outline
  // =========================================================================
  describe('CurriculumSidebar - Content-Type Icon & Lock Indicator Independent Layout', () => {
    const mockChapters: CourseChapter[] = [
      {
        id: 'ch_01',
        title: 'وحدة التحكم المركزي',
        order: 1,
        items: [
          {
            id: 'item_unlocked_video',
            type: 'video',
            title: 'مقدمة غرفة التحكم',
            duration: '14:20',
          },
          {
            id: 'item_locked_video',
            type: 'video',
            title: 'بروتوكولات الطوارئ',
            duration: '08:45',
          },
          {
            id: 'item_locked_pdf',
            type: 'pdf',
            title: 'دليل السلامة الميداني',
          },
        ],
      },
    ];

    const mockFlatItems: EnrichedChapterItem[] = [
      {
        id: 'item_unlocked_video',
        chapterId: 'ch_01',
        chapterTitle: 'وحدة التحكم المركزي',
        globalIndex: 0,
        type: 'video',
        title: 'مقدمة غرفة التحكم',
        duration: '14:20',
        isCompleted: false,
        isLocked: false,
        isActive: true,
      },
      {
        id: 'item_locked_video',
        chapterId: 'ch_01',
        chapterTitle: 'وحدة التحكم المركزي',
        globalIndex: 1,
        type: 'video',
        title: 'بروتوكولات الطوارئ',
        duration: '08:45',
        isCompleted: false,
        isLocked: true,
        isActive: false,
      },
      {
        id: 'item_locked_pdf',
        chapterId: 'ch_01',
        chapterTitle: 'وحدة التحكم المركزي',
        globalIndex: 2,
        type: 'pdf',
        title: 'دليل السلامة الميداني',
        isCompleted: false,
        isLocked: true,
        isActive: false,
      },
    ];

    it('keeps content-type icon visible on the right for both locked and unlocked lessons', () => {
      render(
        <CurriculumSidebar
          chapters={mockChapters}
          flatItems={mockFlatItems}
          currentItemId="item_unlocked_video"
          onSelectItem={vi.fn()}
        />
      );

      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(3);

      // Item 0: Unlocked Video
      const unlockedItem = items[0];
      const unlockedTitleWrap = unlockedItem.querySelector('.lesson-title-wrap')!;
      expect(unlockedTitleWrap.querySelector('svg.lucide-video')).toBeInTheDocument();
      // Lock icon must NOT be inside title wrap
      expect(unlockedTitleWrap.querySelector('svg.lucide-lock')).toBeNull();

      // Item 1: Locked Video - content type icon MUST STAY VISIBLE in title wrap
      const lockedVideoItem = items[1];
      const lockedVideoTitleWrap = lockedVideoItem.querySelector('.lesson-title-wrap')!;
      expect(lockedVideoTitleWrap.querySelector('svg.lucide-video')).toBeInTheDocument();
      expect(lockedVideoTitleWrap.querySelector('svg.lucide-lock')).toBeNull();

      // Item 2: Locked PDF - content type icon (fileText) MUST STAY VISIBLE in title wrap
      const lockedPdfItem = items[2];
      const lockedPdfTitleWrap = lockedPdfItem.querySelector('.lesson-title-wrap')!;
      expect(lockedPdfTitleWrap.querySelector('svg.lucide-file-text')).toBeInTheDocument();
      expect(lockedPdfTitleWrap.querySelector('svg.lucide-lock')).toBeNull();
    });

    it('places lock icon in left metadata area beside duration for locked video, and omits lock for unlocked', () => {
      render(
        <CurriculumSidebar
          chapters={mockChapters}
          flatItems={mockFlatItems}
          currentItemId="item_unlocked_video"
          onSelectItem={vi.fn()}
        />
      );

      const items = screen.getAllByRole('listitem');

      // Item 0: Unlocked Video
      const unlockedMeta = items[0].querySelector('.lesson-meta-wrap')!;
      expect(unlockedMeta).toHaveTextContent('14:20');
      // No lock icon in metadata
      expect(unlockedMeta.querySelector('svg.lucide-lock')).toBeNull();

      // Item 1: Locked Video - lock icon in metadata beside duration [duration] [lock]
      const lockedVideoMeta = items[1].querySelector('.lesson-meta-wrap')!;
      expect(lockedVideoMeta).toHaveTextContent('08:45');
      expect(lockedVideoMeta.querySelector('svg.lucide-lock')).toBeInTheDocument();

      // Item 2: Locked PDF - lock icon in metadata without duration
      const lockedPdfMeta = items[2].querySelector('.lesson-meta-wrap')!;
      expect(lockedPdfMeta.querySelector('svg.lucide-lock')).toBeInTheDocument();
      expect(lockedPdfMeta).not.toHaveTextContent(':');
    });
  });
});
