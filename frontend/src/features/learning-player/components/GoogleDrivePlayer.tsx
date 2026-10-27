import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import type { VideoEmbedPolicy, LessonCompletionPolicy } from '@/core/courses/types';
import type { LessonProgress } from '../types';
import { parseDurationToSeconds, formatDuration } from '@/core/domain/progress';
import { learningApi } from '../services/learningApi';
import {
  deriveEffectiveSandbox,
  getTopCropIframeStyle,
  getMandatoryVideoEmbedPolicy,
} from '@/core/courses/videoEmbedPolicy';

export interface GoogleDrivePlayerProps {
  driveFileId: string;
  itemId?: string;
  courseId?: string;
  title: string;
  duration?: string;
  completionPolicy?: LessonCompletionPolicy;
  isCompleted?: boolean;
  initialEligibleSeconds?: number;
  /** Preserved for backward compatibility */
  initialElapsedSeconds?: number;
  onComplete?: (itemId: string) => Promise<boolean> | void;
  onLocalProgressUpdate?: (itemId: string, activity: Partial<LessonProgress>) => void;
  previewMode?: boolean;
  /** Legacy / experimental props preserved for backward compatibility */
  embedPolicy?: VideoEmbedPolicy;
  cropTopPixels?: number;
  blockPopups?: boolean;
}

/**
 * GoogleDrivePlayer Component
 *
 * Implements source-aware Google Drive video playback with:
 * 1. Mandatory 55px top crop and popup-blocking sandbox policy.
 * 2. Optional administrator-configured minimum viewing-time requirement.
 * 3. Eligible foreground time tracking via dedicated `eligibleViewingSeconds` property
 *    (pauses when page is hidden or user leaves; does NOT mutate playback position fields).
 * 4. Disabled completion confirmation action until requirement is satisfied.
 *
 * Technical Limitation Note:
 * Google Drive `/preview` iframes are cross-origin and do not expose an authoritative
 * playback-progress API. The minimum-time mechanism enforces active foreground time
 * spent on the lesson page, recorded into `eligibleViewingSeconds`. It does not claim to verify
 * actual video playback or touch playback position metrics (`lastPositionSeconds`).
 */
export const GoogleDrivePlayer: React.FC<GoogleDrivePlayerProps> = ({
  driveFileId,
  itemId,
  courseId,
  title,
  duration,
  completionPolicy,
  isCompleted = false,
  initialEligibleSeconds = 0,
  initialElapsedSeconds = 0,
  onComplete,
  onLocalProgressUpdate,
  previewMode = false,
}) => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [hasCompleted, setHasCompleted] = useState<boolean>(isCompleted);
  const [loadError, setLoadError] = useState<boolean>(false);

  // Policy and duration resolution
  const isTimeRequirementEnabled = Boolean(completionPolicy?.requireMinimumViewingTime);
  const targetDurationSeconds = parseDurationToSeconds(duration);

  const effectiveInitialSeconds = Math.max(
    0,
    initialEligibleSeconds || initialElapsedSeconds || 0
  );

  // Cumulative eligible foreground time state
  const [accumulatedSeconds, setAccumulatedSeconds] = useState<number>(() => {
    if (isCompleted) {
      return targetDurationSeconds > 0 ? targetDurationSeconds : 0;
    }
    return effectiveInitialSeconds;
  });

  // Mandatory platform policy: Google Drive ALWAYS receives 55px top crop and popup blocking enabled.
  const mandatoryPolicy = getMandatoryVideoEmbedPolicy('drive');
  const effectiveCrop = mandatoryPolicy.cropTopPixels; // 55
  const effectiveBlockPopups = mandatoryPolicy.blockPopups; // true
  const effectiveSandbox = deriveEffectiveSandbox(effectiveBlockPopups);

  const previewUrl = `https://drive.google.com/file/d/${driveFileId}/preview`;

  // Synchronize state when item or completion status changes
  useEffect(() => {
    setHasCompleted(isCompleted);
    if (isCompleted) {
      setAccumulatedSeconds(targetDurationSeconds > 0 ? targetDurationSeconds : 0);
    } else if (effectiveInitialSeconds > 0) {
      setAccumulatedSeconds((prev) => Math.max(prev, effectiveInitialSeconds));
    }
  }, [itemId, isCompleted, effectiveInitialSeconds, targetDurationSeconds]);

  // Determine whether the minimum viewing time requirement has been met
  const isTimeRequirementMet =
    !isTimeRequirementEnabled ||
    hasCompleted ||
    isCompleted ||
    targetDurationSeconds <= 0 ||
    accumulatedSeconds >= targetDurationSeconds;

  const remainingSeconds = Math.max(0, targetDurationSeconds - accumulatedSeconds);

  const accumulatedRef = useRef(accumulatedSeconds);
  accumulatedRef.current = accumulatedSeconds;

  const onLocalProgressUpdateRef = useRef(onLocalProgressUpdate);
  onLocalProgressUpdateRef.current = onLocalProgressUpdate;

  const itemIdRef = useRef(itemId);
  itemIdRef.current = itemId;

  const courseIdRef = useRef(courseId);
  courseIdRef.current = courseId;

  // Background progress sync helper to persist accumulated eligible time without touching playback positions
  const syncServerActivity = useCallback(async (seconds: number) => {
    if (!courseIdRef.current || !itemIdRef.current) return;
    try {
      await learningApi.recordActivity(courseIdRef.current, {
        itemId: itemIdRef.current,
        eligibleViewingSeconds: seconds,
        durationSeconds: targetDurationSeconds,
      });
    } catch {
      // Background sync errors are safely suppressed
    }
  }, [targetDurationSeconds]);

  // Foreground active page timer
  useEffect(() => {
    // Skip timer in preview mode, when already completed, or when requirement is disabled
    if (
      previewMode ||
      hasCompleted ||
      isCompleted ||
      !isTimeRequirementEnabled ||
      targetDurationSeconds <= 0
    ) {
      return;
    }

    // Already satisfied required time
    if (accumulatedRef.current >= targetDurationSeconds) {
      return;
    }

    let intervalId: NodeJS.Timeout | null = null;

    const startAccumulation = () => {
      if (intervalId) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        intervalId = setInterval(() => {
          if (document.visibilityState !== 'visible') {
            return;
          }

          setAccumulatedSeconds((prev) => {
            const next = prev + 1;
            accumulatedRef.current = next;

            // Dispatch local progress update for eligibleViewingSeconds only
            if (itemIdRef.current && onLocalProgressUpdateRef.current) {
              onLocalProgressUpdateRef.current(itemIdRef.current, {
                eligibleViewingSeconds: next,
                durationSeconds: targetDurationSeconds,
              });
            }

            // Sync with server every 5 seconds or upon meeting requirement
            if (next % 5 === 0 || next >= targetDurationSeconds) {
              syncServerActivity(next);
            }

            // Once the threshold is met, stop timer. DO NOT auto-complete the lesson!
            if (next >= targetDurationSeconds) {
              if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
              }
            }

            return next;
          });
        }, 1000);
      }
    };

    const stopAccumulation = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startAccumulation();
      } else {
        stopAccumulation();
        syncServerActivity(accumulatedRef.current);
      }
    };

    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      startAccumulation();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopAccumulation();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      syncServerActivity(accumulatedRef.current);
    };
  }, [
    previewMode,
    hasCompleted,
    isCompleted,
    isTimeRequirementEnabled,
    targetDurationSeconds,
    itemId,
    syncServerActivity,
  ]);

  const handleMarkComplete = async () => {
    if (!itemId || hasCompleted || isSubmitting || !onComplete || !isTimeRequirementMet) return;
    setIsSubmitting(true);
    try {
      const res = await onComplete(itemId);
      if (res !== false) {
        setHasCompleted(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-3" data-testid="drive-player-stage">
      {/* 1. Video Viewport: Clean, responsive 16:9 container matching YouTube */}
      <div
        className="custom-video-container relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-xl"
        data-testid="drive-player-container"
        data-crop-pixels={effectiveCrop}
        data-popup-blocking={effectiveBlockPopups ? 'enabled' : 'disabled'}
        aria-label={`مشغل الفيديو: ${title}`}
      >
        {loadError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <Icon name="alertCircle" size={48} className="text-warning-dark" />
            <h3 className="text-sm font-bold text-white">تعذر تشغيل محتوى الفيديو</h3>
            <p className="text-xs text-text-muted max-w-sm">
              يرجى التحقق من الاتصال بالإنترنت أو تحديث الصفحة لإعادة المحاولة.
            </p>
          </div>
        ) : (
          <div
            className={`w-full h-full relative overflow-hidden ${effectiveCrop > 0 ? 'gdrive-top-crop-wrapper' : ''}`}
            data-testid="drive-top-crop-wrapper"
            data-crop-pixels={effectiveCrop}
            data-popup-blocking={effectiveBlockPopups ? 'enabled' : 'disabled'}
          >
            <iframe
              src={previewUrl}
              title={title}
              className="w-full border-0 absolute left-0"
              style={getTopCropIframeStyle(effectiveCrop)}
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              sandbox={effectiveSandbox}
              onError={() => setLoadError(true)}
              data-testid="drive-iframe"
            />
          </div>
        )}
      </div>

      {/* 2. Completion Action Container: Located cleanly outside the video viewport */}
      {previewMode ? (
        <div
          className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-muted"
          data-testid="drive-preview-info-bar"
        >
          <div className="flex items-center gap-2">
            <Icon name="checkCircle" size="sm" className="text-success" />
            <span className="font-semibold text-white">معاينة المحاضر — الفيديو متصل وجاهز للعرض</span>
          </div>
          <span className="text-[11px] text-text-muted">وضع المعاينة الفورية (لا يسجل تقدماً للمتدرب)</span>
        </div>
      ) : (
        <div
          className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3"
          data-testid="drive-completion-action-bar"
        >
          {/* Minimum Viewing Time Feedback */}
          {isTimeRequirementEnabled && !hasCompleted && (
            <div
              className={`text-xs flex items-center gap-2 ${
                isTimeRequirementMet ? 'text-success font-semibold' : 'text-text-muted'
              }`}
              data-testid="drive-viewing-time-feedback"
            >
              <Icon
                name={isTimeRequirementMet ? 'checkCircle' : 'clock'}
                size="sm"
                className={isTimeRequirementMet ? 'text-success shrink-0' : 'text-primary-light shrink-0'}
              />
              <span>
                {isTimeRequirementMet
                  ? 'تم استيفاء الحد الأدنى لوقت المشاهدة المطلوب — يمكنك الآن تأكيد الإكمال.'
                  : `الحد الأدنى للمشاهدة: متبقي ${formatDuration(remainingSeconds)} لتأكيد الإكمال`}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 mr-auto">
            <Button
              type="button"
              variant={hasCompleted ? 'outline' : 'primary'}
              size="sm"
              onClick={handleMarkComplete}
              disabled={hasCompleted || isSubmitting || !isTimeRequirementMet}
              className={`shrink-0 font-bold text-xs gap-2 px-5 ${
                hasCompleted
                  ? 'border-success text-success bg-success/10 cursor-default'
                  : !isTimeRequirementMet
                  ? 'opacity-60 cursor-not-allowed bg-slate-700 text-slate-400 border-slate-600'
                  : 'shadow-md'
              }`}
              data-testid="drive-mark-complete-btn"
              title={
                !isTimeRequirementMet
                  ? `متبقي ${formatDuration(remainingSeconds)} لتأكيد الإكمال`
                  : undefined
              }
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon name={hasCompleted ? 'checkCircle' : 'check'} size="sm" className="shrink-0" />
                <span>
                  {hasCompleted
                    ? '✓ تم توثيق إكمال المحاضرة'
                    : isSubmitting
                    ? 'جاري التوثيق...'
                    : 'تأكيد المشاهدة والإكمال'}
                </span>
              </span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleDrivePlayer;
