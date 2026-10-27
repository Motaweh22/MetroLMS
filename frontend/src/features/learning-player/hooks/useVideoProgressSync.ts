import { useEffect, useRef, useCallback } from 'react';
import { learningApi } from '../services/learningApi';
import type { LessonProgress } from '../types';

interface UseVideoProgressSyncProps {
  courseId: string | undefined;
  itemId: string | undefined;
  isPlaying: boolean;
  currentTime: number;
  furthestWatched: number;
  duration?: number;
  onLocalUpdate?: (itemId: string, activity: Partial<LessonProgress>) => void;
}

export function useVideoProgressSync({
  courseId,
  itemId,
  isPlaying,
  currentTime,
  furthestWatched,
  duration,
  onLocalUpdate,
}: UseVideoProgressSyncProps) {
  const latestStateRef = useRef({
    courseId,
    itemId,
    currentTime,
    furthestWatched,
    duration,
  });

  latestStateRef.current = {
    courseId,
    itemId,
    currentTime,
    furthestWatched,
    duration,
  };

  const lastSyncedRef = useRef<{
    position: number;
    furthest: number;
    time: number;
  }>({ position: 0, furthest: 0, time: 0 });

  const syncActivity = useCallback(async (forced: boolean = false) => {
    const { courseId: cId, itemId: itId, currentTime: curr, furthestWatched: fur, duration: dur } =
      latestStateRef.current;

    if (!cId || !itId) return;

    const now = Date.now();
    const posDiff = Math.abs(curr - lastSyncedRef.current.position);
    const furDiff = Math.abs(fur - lastSyncedRef.current.furthest);
    const timeDiff = now - lastSyncedRef.current.time;

    // Throttle: don't sync if negligible change and not forced, or if under 2s since last sync
    if (!forced && timeDiff < 2500) {
      return;
    }

    if (!forced && posDiff < 1 && furDiff < 1) {
      return;
    }

    lastSyncedRef.current = { position: curr, furthest: fur, time: now };

    try {
      if (onLocalUpdate) {
        onLocalUpdate(itId, {
          lastPositionSeconds: curr,
          furthestWatchedSeconds: fur,
          durationSeconds: dur,
        });
      }

      await learningApi.recordActivity(cId, {
        itemId: itId,
        lastPositionSeconds: curr,
        furthestWatchedSeconds: fur,
        durationSeconds: dur,
      });
    } catch {
      // Background sync errors are safely suppressed to avoid interrupting trainee playback
    }
  }, [onLocalUpdate]);

  // Periodic heartbeat every 5 seconds during active playback
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      syncActivity(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [isPlaying, syncActivity]);

  // Flush sync on pause
  useEffect(() => {
    if (!isPlaying) {
      syncActivity(true);
    }
  }, [isPlaying, syncActivity]);

  // Flush sync on document visibility change (e.g. backgrounding tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        syncActivity(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [syncActivity]);

  // Flush sync on item change or unmount
  useEffect(() => {
    return () => {
      syncActivity(true);
    };
  }, [itemId, syncActivity]);

  return { syncActivity };
}
