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
  isReadOnly?: boolean;
}

export function useVideoProgressSync({
  courseId,
  itemId,
  isPlaying,
  currentTime,
  furthestWatched,
  duration,
  onLocalUpdate,
  isReadOnly = false,
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

  const hasUserInteractedRef = useRef<boolean>(false);
  const wasPlayingRef = useRef<boolean>(false);

  useEffect(() => {
    hasUserInteractedRef.current = false;
    wasPlayingRef.current = false;
    lastSyncedRef.current = { position: 0, furthest: 0, time: 0 };
  }, [courseId, itemId]);

  useEffect(() => {
    if (isPlaying) {
      hasUserInteractedRef.current = true;
      wasPlayingRef.current = true;
    }
  }, [isPlaying]);

  const syncActivity = useCallback(async (forced: boolean = false) => {
    const { courseId: cId, itemId: itId, currentTime: curr, furthestWatched: fur, duration: dur } =
      latestStateRef.current;

    // Suppress synchronization in read-only mode or before user starts playback
    if (!cId || !itId || isReadOnly || !hasUserInteractedRef.current) return;

    const now = Date.now();
    const posRound = Math.floor(curr);
    const furRound = Math.floor(fur);
    const posDiff = Math.abs(posRound - lastSyncedRef.current.position);
    const furDiff = Math.abs(furRound - lastSyncedRef.current.furthest);
    const timeDiff = now - lastSyncedRef.current.time;

    // Throttle: don't sync if negligible change and not forced, or if under 2s since last sync
    if (!forced && timeDiff < 2500) {
      return;
    }

    if (!forced && posDiff < 1 && furDiff < 1) {
      return;
    }

    lastSyncedRef.current = { position: posRound, furthest: furRound, time: now };

    try {
      if (onLocalUpdate) {
        onLocalUpdate(itId, {
          lastPositionSeconds: posRound,
          furthestWatchedSeconds: furRound,
          durationSeconds: dur,
        });
      }

      await learningApi.recordActivity(cId, {
        itemId: itId,
        lastPositionSeconds: posRound,
        furthestWatchedSeconds: furRound,
        durationSeconds: dur,
      });
    } catch {
      // Background sync errors are safely suppressed to avoid interrupting trainee playback
    }
  }, [onLocalUpdate, isReadOnly]);

  // Periodic heartbeat every 5 seconds during active playback (disabled in read-only mode)
  useEffect(() => {
    if (!isPlaying || isReadOnly) return;

    const interval = setInterval(() => {
      syncActivity(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [isPlaying, isReadOnly, syncActivity]);

  // Flush sync only when transitioning from playing -> paused (never on initial mount)
  useEffect(() => {
    if (!isPlaying && wasPlayingRef.current && !isReadOnly) {
      wasPlayingRef.current = false;
      syncActivity(true);
    }
  }, [isPlaying, isReadOnly, syncActivity]);

  // Flush sync on document visibility change or tab close/refresh
  useEffect(() => {
    if (isReadOnly) return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        syncActivity(true);
      }
    };
    const handlePageHide = () => {
      syncActivity(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    };
  }, [isReadOnly, syncActivity]);

  // Flush sync on item change or unmount (suppressed in read-only mode)
  useEffect(() => {
    return () => {
      if (!isReadOnly && hasUserInteractedRef.current) {
        syncActivity(true);
      }
    };
  }, [itemId, isReadOnly, syncActivity]);

  return { syncActivity };
}
