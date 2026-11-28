import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icon } from '@/shared/ui/Icon/Icon';
import { clampSeekingPosition, formatDuration } from '@/core/domain/progress';
import {
  BLOB_FALLBACK_IDLE_TIMEOUT_MS,
  diagnoseProtectedMediaStream,
  fetchProtectedBlobFallback,
  isAbortError,
  MAX_BLOB_FALLBACK_BYTES,
  ProtectedStreamError,
  requestProtectedStreamTicket,
  STREAM_REQUEST_TIMEOUT_MS,
} from '@/core/storage/protectedMediaStream';
import { useVideoProgressSync } from '../hooks/useVideoProgressSync';
import type { LessonProgress } from '../types';
import '@/features/learning-player/styles/learningPlayer.css';

// Documented internal watchdog & recovery limits (tunable per network/server profile)
export const INITIAL_METADATA_TIMEOUT_MS = 20_000;
export const INITIAL_METADATA_MAX_TIMEOUT_MS = 60_000;
export const PLAYBACK_STALL_TIMEOUT_MS = 12_000;
export const STREAM_DIAGNOSTIC_TIMEOUT_MS = STREAM_REQUEST_TIMEOUT_MS;
export const MAX_AUTO_RECOVERY_ATTEMPTS = 2;
export const MAX_SOURCE_TOTAL_RECOVERIES = 4;
export const STABLE_PLAYBACK_RESET_MS = 30_000;

export type RecoveryPhase =
  | 'idle'
  | 'loading_metadata'
  | 'playing'
  | 'buffering'
  | 'paused'
  | 'ended'
  | 'diagnosing'
  | 'renewing_ticket'
  | 'retrying_stream'
  | 'retrying_blob'
  | 'error';

export type PlayerErrorCategory =
  | 'missing_src'
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'network'
  | 'decode'
  | 'unsupported_media'
  | 'exhausted';

const ERROR_UI_MESSAGES: Record<PlayerErrorCategory, { title: string; body: string }> = {
  missing_src: {
    title: 'عذراً، تعذر تحميل ملف الفيديو',
    body: 'الملف المرئي غير متوفر حالياً أو صيغته غير مدعومة على متصفحك. يرجى إعادة المحاولة لاحقاً.',
  },
  auth: {
    title: 'انتهت جلسة تسجيل الدخول',
    body: 'يرجى تسجيل الدخول مجدداً لاستكمال مشاهدة هذا الدرس.',
  },
  forbidden: {
    title: 'غير مصرح بالوصول إلى الفيديو',
    body: 'ليس لديك صلاحية للوصول إلى هذا الملف أو تعذر التحقق من أمان الطلب.',
  },
  not_found: {
    title: 'ملف الفيديو غير موجود',
    body: 'الملف المرئي المطلوب غير متوفر على الخادم أو تم نقله.',
  },
  network: {
    title: 'تعذر الاتصال بالخادم',
    body: 'انقطع الاتصال أو تأخر الخادم في الاستجابة أثناء تحميل الفيديو. يرجى التحقق من الشبكة وإعادة المحاولة.',
  },
  decode: {
    title: 'تعذر فك تشفير الفيديو',
    body: 'واجه المتصفح خطأ أثناء معالجة بيانات الفيديو. يمكنك الضغط على إعادة المحاولة.',
  },
  unsupported_media: {
    title: 'صيغة الفيديو غير مدعومة أو المصدر غير صالح',
    body: 'تعذر تشغيل هذا الملف على المتصفح الحالي. يرجى إعادة المحاولة لاحقاً.',
  },
  exhausted: {
    title: 'تعذرت استعادة تشغيل الفيديو تلقائياً',
    body: 'استمر توقف البث بعد عدة محاولات تلقائية. يرجى التحقق من الاتصال والضغط على إعادة المحاولة.',
  },
};

function mapFailureKindToErrorCategory(kind: ProtectedStreamError['kind']): PlayerErrorCategory {
  if (kind === 'auth') return 'auth';
  if (kind === 'forbidden') return 'forbidden';
  if (kind === 'not_found') return 'not_found';
  if (kind === 'too_large' || kind === 'invalid') return 'unsupported_media';
  return 'network';
}

export interface VideoPlayerProps {
  courseId?: string;
  itemId?: string;
  src?: string;
  poster?: string;
  title: string;
  initialPosition?: number;
  furthestWatched?: number;
  isCompleted?: boolean;
  isReadOnly?: boolean;
  allowFreeSeek?: boolean;
  canDownload?: boolean;
  onComplete: (itemId: string) => Promise<boolean> | void;
  onLocalProgressUpdate?: (itemId: string, activity: Partial<LessonProgress>) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  courseId,
  itemId,
  src,
  poster,
  title,
  initialPosition = 0,
  furthestWatched = 0,
  isCompleted = false,
  isReadOnly = false,
  allowFreeSeek = false,
  canDownload = false,
  onComplete,
  onLocalProgressUpdate,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const hasCompletedRef = useRef<boolean>(isCompleted);
  const canSeekFreely = Boolean(isCompleted || isReadOnly || allowFreeSeek);
  const canSeekFreelyRef = useRef<boolean>(canSeekFreely);
  const furthestWatchedRef = useRef<number>(Math.max(initialPosition, furthestWatched));
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const seekingClampedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(initialPosition);
  const [duration, setDuration] = useState<number>(0);
  const [furthestWatchedSecs, setFurthestWatchedSecs] = useState<number>(
    Math.max(initialPosition, furthestWatched)
  );
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorCategory, setErrorCategory] = useState<PlayerErrorCategory | null>(null);
  const [recoveryPhase, setRecoveryPhase] = useState<RecoveryPhase>('idle');
  const [recoveryStatusMessage, setRecoveryStatusMessage] = useState<string | null>(null);
  const [seekingClamped, setSeekingClamped] = useState<boolean>(false);
  const [seekClampKey, setSeekClampKey] = useState<number>(0);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [speedMenuOpen, setSpeedMenuOpen] = useState<boolean>(false);
  const [protectedBlobUrl, setProtectedBlobUrl] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState<number>(0);
  const [resumedFromSeconds, setResumedFromSeconds] = useState<number | null>(null);

  const activeVideoBlobRef = useRef<string | null>(null);
  const activeStreamUrlRef = useRef<string | null>(null);
  const isBlobUrlRef = useRef<boolean>(false);
  const usedStreamTicketRef = useRef<boolean>(false);
  const hasRetriedRenewedStreamRef = useRef<boolean>(false);
  const blobFallbackAttemptedSrcRef = useRef<string | null>(null);
  const knownContentLengthRef = useRef<number | undefined>(undefined);
  const initialPositionRef = useRef<number>(initialPosition);
  initialPositionRef.current = initialPosition;

  const sourceGenerationRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(initialPosition);
  const durationRef = useRef<number>(0);
  const hasLoadedMetadataRef = useRef<boolean>(false);
  const hasStartedPlaybackRef = useRef<boolean>(false);
  const wantsPlayingRef = useRef<boolean>(false);
  const isUserPausedRef = useRef<boolean>(false);
  const isSeekingRef = useRef<boolean>(false);
  const internalReloadRef = useRef<boolean>(false);
  const eofDecodeRecoveryRef = useRef<boolean>(false);
  const pendingReplayActionRef = useRef<{ time: number; autoPlay: boolean } | null>(null);
  const pendingRecoveryResumeRef = useRef<{ time: number; autoPlay: boolean } | null>(null);
  const pendingUserSeekDuringRecoveryRef = useRef<{ time: number; generation: number } | null>(null);
  const programmaticSeekRef = useRef<{ time: number; timestamp: number } | null>(null);
  const resumeBannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogKindRef = useRef<'initial' | 'playback' | null>(null);
  const suspendedWatchdogKindRef = useRef<'initial' | 'playback' | null>(null);
  const initialCeilingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialCeilingRemainingMsRef = useRef<number | null>(null);
  const initialCeilingStartedAtRef = useRef<number | null>(null);
  const initialCeilingExhaustedRef = useRef<boolean>(false);
  const lastInitialBufferedEndRef = useRef<number>(0);
  const lastInitialReadyStateRef = useRef<number>(0);
  const recoveryPhaseRef = useRef<RecoveryPhase>('idle');
  const hasErrorRef = useRef<boolean>(false);
  const isRecoveringRef = useRef<boolean>(false);
  const inFlightRecoveryControllerRef = useRef<AbortController | null>(null);
  const recoveryAttemptsRef = useRef<number>(0);
  const totalSourceRecoveriesRef = useRef<number>(0);
  const lastMediaProgressTimeRef = useRef<number>(initialPosition);
  const stablePlaybackStartedAtRef = useRef<number | null>(null);

  const updateRecoveryPhase = useCallback((nextPhase: RecoveryPhase, message: string | null = null) => {
    recoveryPhaseRef.current = nextPhase;
    setRecoveryPhase(nextPhase);
    setRecoveryStatusMessage(message);
  }, []);

  const assignProgrammaticCurrentTime = useCallback((media: HTMLMediaElement, targetTime: number) => {
    programmaticSeekRef.current = { time: targetTime, timestamp: Date.now() };
    media.currentTime = targetTime;
  }, []);

  const recordUserSeekDuringRecovery = useCallback((effectiveSeconds: number) => {
    if (!isRecoveringRef.current && pendingRecoveryResumeRef.current === null) {
      return;
    }
    const nextOverride = {
      time: effectiveSeconds,
      generation: sourceGenerationRef.current,
    };
    pendingUserSeekDuringRecoveryRef.current = nextOverride;
    if (pendingRecoveryResumeRef.current) {
      pendingRecoveryResumeRef.current = {
        ...pendingRecoveryResumeRef.current,
        time: effectiveSeconds,
      };
    }
  }, []);

  const resolveRecoveryResumeTime = useCallback(
    (fallbackTime: number, expectedGeneration: number): number => {
      const override = pendingUserSeekDuringRecoveryRef.current;
      pendingUserSeekDuringRecoveryRef.current = null;
      if (override && override.generation === expectedGeneration) {
        return override.time;
      }
      return fallbackTime;
    },
    []
  );

  const pauseInitialCeilingBudget = useCallback(() => {
    if (initialCeilingTimerRef.current !== null) {
      clearTimeout(initialCeilingTimerRef.current);
      initialCeilingTimerRef.current = null;
    }
    if (initialCeilingStartedAtRef.current !== null && initialCeilingRemainingMsRef.current !== null) {
      const elapsedMs = Math.max(0, Date.now() - initialCeilingStartedAtRef.current);
      initialCeilingRemainingMsRef.current = Math.max(
        0,
        initialCeilingRemainingMsRef.current - elapsedMs
      );
      initialCeilingStartedAtRef.current = null;
    }
  }, []);

  const resetInitialMetadataBudget = useCallback(() => {
    if (initialCeilingTimerRef.current !== null) {
      clearTimeout(initialCeilingTimerRef.current);
      initialCeilingTimerRef.current = null;
    }
    initialCeilingRemainingMsRef.current = null;
    initialCeilingStartedAtRef.current = null;
    initialCeilingExhaustedRef.current = false;
    lastInitialBufferedEndRef.current = 0;
    lastInitialReadyStateRef.current = 0;
  }, []);

  const clearWatchdog = useCallback(() => {
    if (watchdogTimerRef.current !== null) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    watchdogKindRef.current = null;
    suspendedWatchdogKindRef.current = null;
    pauseInitialCeilingBudget();
  }, [pauseInitialCeilingBudget]);

  const failPlayerWithCategory = useCallback(
    (category: PlayerErrorCategory) => {
      pendingUserSeekDuringRecoveryRef.current = null;
      pendingRecoveryResumeRef.current = null;
      programmaticSeekRef.current = null;
      resetInitialMetadataBudget();
      hasErrorRef.current = true;
      setHasError(true);
      setErrorCategory(category);
      setIsBuffering(false);
      setIsPlaying(false);
      updateRecoveryPhase('error', null);
    },
    [resetInitialMetadataBudget, updateRecoveryPhase]
  );

  const cancelInFlightRecovery = useCallback(() => {
    if (inFlightRecoveryControllerRef.current) {
      inFlightRecoveryControllerRef.current.abort();
      inFlightRecoveryControllerRef.current = null;
    }
    isRecoveringRef.current = false;
  }, []);

  const isJsdomEnv = useCallback(() => {
    return typeof window !== 'undefined' && Boolean(window.navigator?.userAgent?.includes('jsdom'));
  }, []);

  const isProtectedSource = useCallback(
    (candidateSrc: string | undefined) => {
      return Boolean(candidateSrc && candidateSrc.startsWith('/api/media/') && !isJsdomEnv());
    },
    [isJsdomEnv]
  );

  const applyVideoReloadWithResume = useCallback(
    (nextUrl: string, resume: { time: number; autoPlay: boolean }, isBlob: boolean) => {
      hasLoadedMetadataRef.current = false;
      pendingRecoveryResumeRef.current = resume;
      isBlobUrlRef.current = isBlob;
      usedStreamTicketRef.current = !isBlob;

      const prevUrl = activeStreamUrlRef.current;
      activeStreamUrlRef.current = nextUrl;

      if (isBlob) {
        if (activeVideoBlobRef.current && activeVideoBlobRef.current !== nextUrl) {
          URL.revokeObjectURL(activeVideoBlobRef.current);
        }
        activeVideoBlobRef.current = nextUrl;
      }

      updateRecoveryPhase('retrying_stream', 'جاري إعادة تحميل الفيديو عند نفس موضع التشغيل...');
      setIsBuffering(true);
      setProtectedBlobUrl(nextUrl);

      if (videoRef.current && prevUrl === nextUrl && typeof videoRef.current.load === 'function') {
        internalReloadRef.current = true;
        try {
          videoRef.current.load();
        } finally {
          internalReloadRef.current = false;
        }
      }
    },
    [updateRecoveryPhase]
  );

  const armWatchdogRef = useRef<(kind: 'initial' | 'playback', preserveExisting?: boolean) => void>(() => { });

  const triggerRecovery = useCallback(
    async (reason: 'stall' | 'error', expectedGeneration: number, mediaErrCode?: number) => {
      if (expectedGeneration !== sourceGenerationRef.current) return;
      if (isRecoveringRef.current || hasErrorRef.current || !src) return;
      if (reason === 'stall' && (isUserPausedRef.current || videoRef.current?.ended)) return;

      clearWatchdog();

      const protectedStream = isProtectedSource(src);

      // On non-protected local/test sources, native errors map directly without fake ticket calls
      if (!protectedStream && reason === 'error') {
        failPlayerWithCategory(mediaErrCode === 3 ? 'decode' : 'unsupported_media');
        return;
      }

      if (
        recoveryAttemptsRef.current >= MAX_AUTO_RECOVERY_ATTEMPTS ||
        totalSourceRecoveriesRef.current >= MAX_SOURCE_TOTAL_RECOVERIES
      ) {
        failPlayerWithCategory('exhausted');
        return;
      }

      isRecoveringRef.current = true;
      pendingUserSeekDuringRecoveryRef.current = null;
      recoveryAttemptsRef.current += 1;
      totalSourceRecoveriesRef.current += 1;
      stablePlaybackStartedAtRef.current = null;

      const controller = new AbortController();
      inFlightRecoveryControllerRef.current = controller;
      const handoffRecoveryToReloadWatchdog = () => {
        if (inFlightRecoveryControllerRef.current === controller) {
          inFlightRecoveryControllerRef.current = null;
          isRecoveringRef.current = false;
        }
        armWatchdogRef.current('initial', false);
      };

      const savedTime =
        videoRef.current?.currentTime ?? currentTimeRef.current ?? initialPositionRef.current;
      const shouldAutoResume = Boolean(
        wantsPlayingRef.current && !isUserPausedRef.current && !videoRef.current?.ended
      );

      setIsBuffering(true);

      try {
        if (!protectedStream) {
          const resumeAutoPlay = shouldAutoResume && !isUserPausedRef.current && wantsPlayingRef.current;
          pendingRecoveryResumeRef.current = {
            time: resolveRecoveryResumeTime(savedTime, expectedGeneration),
            autoPlay: resumeAutoPlay,
          };
          hasLoadedMetadataRef.current = false;
          updateRecoveryPhase('retrying_stream', 'جاري إعادة محاولة تحميل البث...');
          if (videoRef.current && typeof videoRef.current.load === 'function') {
            internalReloadRef.current = true;
            try {
              videoRef.current.load();
            } finally {
              internalReloadRef.current = false;
            }
          }
          handoffRecoveryToReloadWatchdog();
          return;
        }

        // Step 1: Diagnose stream access via bounded authenticated HEAD when holding a stream URL
        const currentUrl = activeStreamUrlRef.current || src;

        if (!isBlobUrlRef.current) {
          updateRecoveryPhase('diagnosing', 'جاري التحقق من حالة الاتصال بالبث...');
          const diagnosis = await diagnoseProtectedMediaStream(currentUrl, {
            signal: controller.signal,
            timeoutMs: STREAM_DIAGNOSTIC_TIMEOUT_MS,
          });

          if (
            expectedGeneration !== sourceGenerationRef.current ||
            inFlightRecoveryControllerRef.current !== controller ||
            controller.signal.aborted
          ) {
            return;
          }

          if (diagnosis.contentLength !== undefined) {
            knownContentLengthRef.current = diagnosis.contentLength;
          } else if (diagnosis.isKnownOversizedForBlob) {
            knownContentLengthRef.current = MAX_BLOB_FALLBACK_BYTES + 1;
          }

          if (diagnosis.outcome === 'auth') {
            failPlayerWithCategory('auth');
            return;
          }
          if (diagnosis.outcome === 'not_found') {
            failPlayerWithCategory('not_found');
            return;
          }
        }

        const sizeKnownTooLarge =
          knownContentLengthRef.current !== undefined &&
          knownContentLengthRef.current > MAX_BLOB_FALLBACK_BYTES;

        // Step 2: Prefer bounded ticket renewal + stream retry BEFORE any Blob fallback
        const canAttemptBlobLastResort =
          !isBlobUrlRef.current &&
          blobFallbackAttemptedSrcRef.current !== src &&
          !sizeKnownTooLarge &&
          ((reason === 'error' && hasRetriedRenewedStreamRef.current) ||
            (recoveryAttemptsRef.current >= MAX_AUTO_RECOVERY_ATTEMPTS &&
              hasRetriedRenewedStreamRef.current));

        if (!canAttemptBlobLastResort) {
          if (isBlobUrlRef.current) {
            failPlayerWithCategory('exhausted');
            return;
          }

          updateRecoveryPhase('renewing_ticket', 'جاري تحديث رابط التشغيل الآمن...');
          try {
            const renewed = await requestProtectedStreamTicket(src, {
              signal: controller.signal,
              timeoutMs: STREAM_DIAGNOSTIC_TIMEOUT_MS,
            });
            if (
              expectedGeneration !== sourceGenerationRef.current ||
              inFlightRecoveryControllerRef.current !== controller ||
              controller.signal.aborted
            ) {
              return;
            }
            hasRetriedRenewedStreamRef.current = true;
            const resumeAutoPlay =
              shouldAutoResume && !isUserPausedRef.current && wantsPlayingRef.current;
            applyVideoReloadWithResume(
              renewed.streamUrl,
              {
                time: resolveRecoveryResumeTime(savedTime, expectedGeneration),
                autoPlay: resumeAutoPlay,
              },
              false
            );
            handoffRecoveryToReloadWatchdog();
            return;
          } catch (renewErr) {
            if (
              expectedGeneration !== sourceGenerationRef.current ||
              inFlightRecoveryControllerRef.current !== controller ||
              isAbortError(renewErr, controller.signal)
            ) {
              return;
            }
            if (renewErr instanceof ProtectedStreamError) {
              if (
                renewErr.kind === 'auth' ||
                renewErr.kind === 'forbidden' ||
                renewErr.kind === 'not_found'
              ) {
                failPlayerWithCategory(mapFailureKindToErrorCategory(renewErr.kind));
                return;
              }
            }
            // Ticket renewal failed due to transient network error/timeout -> report honest network error without Blob download
            failPlayerWithCategory('network');
            return;
          }
        }

        // Step 3: Last-resort authenticated Blob fallback ONLY when eligible and enforced incrementally <= 250 MB
        blobFallbackAttemptedSrcRef.current = src;
        updateRecoveryPhase('retrying_blob', 'جاري التحميل عبر المسار البديل الآمن...');
        try {
          const blobStream = await fetchProtectedBlobFallback(src, {
            signal: controller.signal,
            defaultMimeType: 'video/mp4',
            knownSizeBytes: knownContentLengthRef.current,
            idleTimeoutMs: BLOB_FALLBACK_IDLE_TIMEOUT_MS,
          });
          if (
            expectedGeneration !== sourceGenerationRef.current ||
            inFlightRecoveryControllerRef.current !== controller ||
            controller.signal.aborted
          ) {
            if (blobStream.isBlobUrl) URL.revokeObjectURL(blobStream.resolvedUrl);
            return;
          }
          const resumeAutoPlay =
            shouldAutoResume && !isUserPausedRef.current && wantsPlayingRef.current;
          applyVideoReloadWithResume(
            blobStream.resolvedUrl,
            {
              time: resolveRecoveryResumeTime(savedTime, expectedGeneration),
              autoPlay: resumeAutoPlay,
            },
            true
          );
          handoffRecoveryToReloadWatchdog();
        } catch (blobErr) {
          if (
            expectedGeneration !== sourceGenerationRef.current ||
            inFlightRecoveryControllerRef.current !== controller ||
            controller.signal.aborted
          ) {
            return;
          }
          if (blobErr instanceof ProtectedStreamError) {
            failPlayerWithCategory(mapFailureKindToErrorCategory(blobErr.kind));
          } else {
            failPlayerWithCategory('exhausted');
          }
        }
      } catch (err) {
        if (
          controller.signal.aborted ||
          expectedGeneration !== sourceGenerationRef.current ||
          inFlightRecoveryControllerRef.current !== controller
        ) {
          return;
        }
        failPlayerWithCategory(
          err instanceof ProtectedStreamError
            ? mapFailureKindToErrorCategory(err.kind)
            : 'network'
        );
      } finally {
        if (inFlightRecoveryControllerRef.current === controller) {
          inFlightRecoveryControllerRef.current = null;
          isRecoveringRef.current = false;
        }
      }
    },
    [
      src,
      clearWatchdog,
      isProtectedSource,
      failPlayerWithCategory,
      updateRecoveryPhase,
      applyVideoReloadWithResume,
      resolveRecoveryResumeTime,
    ]
  );

  const scheduleInitialIdleTimer = useCallback(
    (gen: number) => {
      if (watchdogTimerRef.current !== null) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
      watchdogKindRef.current = 'initial';
      watchdogTimerRef.current = setTimeout(() => {
        watchdogTimerRef.current = null;
        watchdogKindRef.current = null;
        if (gen !== sourceGenerationRef.current) return;
        if (initialCeilingExhaustedRef.current) {
          // Ceiling already triggered recovery once; fail terminally rather than restarting bytes=0- repeatedly.
          clearWatchdog();
          failPlayerWithCategory('exhausted');
          return;
        }
        void triggerRecovery('stall', gen);
      }, INITIAL_METADATA_TIMEOUT_MS);
    },
    [clearWatchdog, failPlayerWithCategory, triggerRecovery]
  );

  const ensureInitialCeilingTimer = useCallback(
    (gen: number) => {
      if (initialCeilingExhaustedRef.current) return;
      if (initialCeilingRemainingMsRef.current === null) {
        initialCeilingRemainingMsRef.current = INITIAL_METADATA_MAX_TIMEOUT_MS;
      }
      const remainingMs = initialCeilingRemainingMsRef.current;
      if (remainingMs <= 0) {
        initialCeilingRemainingMsRef.current = 0;
        initialCeilingExhaustedRef.current = true;
        return;
      }
      if (initialCeilingTimerRef.current !== null) return;
      initialCeilingStartedAtRef.current = Date.now();
      initialCeilingTimerRef.current = setTimeout(() => {
        initialCeilingTimerRef.current = null;
        initialCeilingStartedAtRef.current = null;
        initialCeilingRemainingMsRef.current = 0;
        initialCeilingExhaustedRef.current = true;
        if (gen !== sourceGenerationRef.current) return;
        clearWatchdog();
        void triggerRecovery('stall', gen);
      }, remainingMs);
    },
    [clearWatchdog, triggerRecovery]
  );

  const armWatchdog = useCallback(
    (kind: 'initial' | 'playback', preserveExisting = true) => {
      if (!src || hasErrorRef.current || isRecoveringRef.current || isUserPausedRef.current) return;
      const media = videoRef.current;
      if (kind === 'playback') {
        if (media?.ended) return;
        if (media?.paused && !wantsPlayingRef.current && !isSeekingRef.current) return;
      }

      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        suspendedWatchdogKindRef.current = kind;
        return;
      }

      const gen = sourceGenerationRef.current;

      if (preserveExisting && watchdogTimerRef.current !== null && watchdogKindRef.current === kind) {
        if (kind === 'initial') {
          ensureInitialCeilingTimer(gen);
        }
        return;
      }

      clearWatchdog();

      if (kind === 'initial') {
        ensureInitialCeilingTimer(gen);
        scheduleInitialIdleTimer(gen);
        return;
      }

      watchdogKindRef.current = 'playback';
      watchdogTimerRef.current = setTimeout(() => {
        watchdogTimerRef.current = null;
        watchdogKindRef.current = null;
        void triggerRecovery('stall', gen);
      }, PLAYBACK_STALL_TIMEOUT_MS);
    },
    [src, clearWatchdog, triggerRecovery, ensureInitialCeilingTimer, scheduleInitialIdleTimer]
  );

  useEffect(() => {
    armWatchdogRef.current = armWatchdog;
  }, [armWatchdog]);

  // Suspend watchdog timers when tab is backgrounded; resume monitoring only if still stalled on return
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'hidden') {
        const activeKind = watchdogKindRef.current;
        if (watchdogTimerRef.current !== null) {
          clearTimeout(watchdogTimerRef.current);
          watchdogTimerRef.current = null;
        }
        pauseInitialCeilingBudget();
        if (activeKind) {
          suspendedWatchdogKindRef.current = activeKind;
          watchdogKindRef.current = null;
        }
        return;
      }

      if (document.visibilityState === 'visible') {
        const pendingKind = suspendedWatchdogKindRef.current;
        suspendedWatchdogKindRef.current = null;
        const media = videoRef.current;
        if (!pendingKind || hasErrorRef.current || isRecoveringRef.current || isUserPausedRef.current) {
          return;
        }
        if (pendingKind === 'initial' && !hasLoadedMetadataRef.current && src) {
          armWatchdog('initial', false);
        } else if (
          pendingKind === 'playback' &&
          media &&
          !media.ended &&
          (wantsPlayingRef.current || !media.paused || isSeekingRef.current)
        ) {
          armWatchdog('playback', false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [src, armWatchdog, pauseInitialCeilingBudget]);

  // Acquire initial progressive Range streaming ticket when src/retryNonce changes (never downloads Blob preemptively)
  useEffect(() => {
    let cancelled = false;
    sourceGenerationRef.current += 1;
    const generation = sourceGenerationRef.current;

    cancelInFlightRecovery();
    clearWatchdog();
    resetInitialMetadataBudget();

    usedStreamTicketRef.current = false;
    isBlobUrlRef.current = false;
    hasRetriedRenewedStreamRef.current = false;
    hasLoadedMetadataRef.current = false;
    pendingRecoveryResumeRef.current = null;
    pendingUserSeekDuringRecoveryRef.current = null;
    programmaticSeekRef.current = null;
    recoveryAttemptsRef.current = 0;
    totalSourceRecoveriesRef.current = 0;
    stablePlaybackStartedAtRef.current = null;
    knownContentLengthRef.current = undefined;
    hasErrorRef.current = false;

    if (activeVideoBlobRef.current) {
      URL.revokeObjectURL(activeVideoBlobRef.current);
      activeVideoBlobRef.current = null;
    }
    activeStreamUrlRef.current = null;

    if (!src) {
      setProtectedBlobUrl(null);
      setErrorCategory('missing_src');
      hasErrorRef.current = true;
      setHasError(true);
      updateRecoveryPhase('error', null);
      return;
    }

    setHasError(false);
    setErrorCategory(null);

    const isProtectedApiStream = isProtectedSource(src);
    if (!isProtectedApiStream) {
      activeStreamUrlRef.current = src;
      setProtectedBlobUrl(src);
      updateRecoveryPhase('loading_metadata', null);
      return;
    }

    setIsBuffering(true);
    setProtectedBlobUrl(null);
    updateRecoveryPhase('loading_metadata', 'جاري الاتصال بخادم الفيديو...');

    const controller = new AbortController();

    requestProtectedStreamTicket(src, {
      signal: controller.signal,
      timeoutMs: STREAM_DIAGNOSTIC_TIMEOUT_MS,
    })
      .then((result) => {
        if (cancelled || generation !== sourceGenerationRef.current) return;
        usedStreamTicketRef.current = true;
        isBlobUrlRef.current = false;
        activeStreamUrlRef.current = result.streamUrl;
        setProtectedBlobUrl(result.streamUrl);
        updateRecoveryPhase('loading_metadata', null);
        armWatchdogRef.current('initial', false);
      })
      .catch((err) => {
        if (cancelled || generation !== sourceGenerationRef.current || isAbortError(err, controller.signal)) {
          return;
        }
        if (err instanceof ProtectedStreamError) {
          failPlayerWithCategory(mapFailureKindToErrorCategory(err.kind));
        } else {
          failPlayerWithCategory('network');
        }
      });

    return () => {
      cancelled = true;
      sourceGenerationRef.current += 1;
      controller.abort();
      cancelInFlightRecovery();
      clearWatchdog();
      resetInitialMetadataBudget();
      pendingRecoveryResumeRef.current = null;
      pendingUserSeekDuringRecoveryRef.current = null;
      programmaticSeekRef.current = null;
      if (activeVideoBlobRef.current) {
        URL.revokeObjectURL(activeVideoBlobRef.current);
        activeVideoBlobRef.current = null;
      }
    };
  }, [
    src,
    retryNonce,
    isProtectedSource,
    cancelInFlightRecovery,
    clearWatchdog,
    resetInitialMetadataBudget,
    updateRecoveryPhase,
    failPlayerWithCategory,
  ]);

  // Trigger seeking clamped warning with active timer reset and animation remounting
  const triggerSeekingClamped = useCallback(() => {
    if (seekingClampedTimeoutRef.current) {
      clearTimeout(seekingClampedTimeoutRef.current);
    }
    setSeekingClamped(true);
    setSeekClampKey((prev) => prev + 1);
    seekingClampedTimeoutRef.current = setTimeout(() => {
      setSeekingClamped(false);
      seekingClampedTimeoutRef.current = null;
    }, 2500);
  }, []);

  // Cleanup pending seeking clamped, resume banner, controls, and watchdog timers on unmount
  useEffect(() => {
    return () => {
      if (seekingClampedTimeoutRef.current) {
        clearTimeout(seekingClampedTimeoutRef.current);
      }
      if (resumeBannerTimeoutRef.current) {
        clearTimeout(resumeBannerTimeoutRef.current);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      clearWatchdog();
      resetInitialMetadataBudget();
      cancelInFlightRecovery();
    };
  }, [clearWatchdog, resetInitialMetadataBudget, cancelInFlightRecovery]);

  const showResumeNotification = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    if (resumeBannerTimeoutRef.current) {
      clearTimeout(resumeBannerTimeoutRef.current);
    }
    setResumedFromSeconds(Math.floor(seconds));
    resumeBannerTimeoutRef.current = setTimeout(() => {
      setResumedFromSeconds(null);
      resumeBannerTimeoutRef.current = null;
    }, 5000);
  }, []);

  // Sync completion and unrestricted-seek refs with props
  useEffect(() => {
    hasCompletedRef.current = isCompleted;
    canSeekFreelyRef.current = Boolean(isCompleted || isReadOnly || allowFreeSeek);
  }, [isCompleted, isReadOnly, allowFreeSeek]);

  useEffect(() => {
    const safeMax = Math.max(initialPosition, furthestWatched);
    furthestWatchedRef.current = Math.max(furthestWatchedRef.current, safeMax);
    setFurthestWatchedSecs((prev) => Math.max(prev, safeMax));
    // If initialPosition arrives asynchronously from backend before user starts playing, apply it
    if (initialPosition > 0 && !hasStartedPlaybackRef.current) {
      currentTimeRef.current = initialPosition;
      setCurrentTime(initialPosition);
      if (videoRef.current && videoRef.current.readyState >= 1) {
        const dur = videoRef.current.duration;
        const targetPos = Number.isFinite(dur) && dur > 3 && initialPosition >= dur - 2 ? 0 : initialPosition;
        if (targetPos > 0) {
          assignProgrammaticCurrentTime(videoRef.current, targetPos);
          currentTimeRef.current = targetPos;
          setCurrentTime(targetPos);
          showResumeNotification(targetPos);
        }
      }
    }
  }, [initialPosition, furthestWatched, showResumeNotification, assignProgrammaticCurrentTime]);

  // Reset or initialize ONLY when the lesson item (itemId / src) changes
  const initializedItemRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const itemKey = `${itemId || ''}::${src || ''}`;
    if (initializedItemRef.current === itemKey) {
      return;
    }
    initializedItemRef.current = itemKey;
    hasStartedPlaybackRef.current = false;
    wantsPlayingRef.current = false;
    isUserPausedRef.current = false;
    isSeekingRef.current = false;
    eofDecodeRecoveryRef.current = false;
    pendingReplayActionRef.current = null;
    pendingRecoveryResumeRef.current = null;
    pendingUserSeekDuringRecoveryRef.current = null;
    programmaticSeekRef.current = null;
    blobFallbackAttemptedSrcRef.current = null;
    setResumedFromSeconds(null);

    const initialFurthest = Math.max(initialPosition, furthestWatched);
    currentTimeRef.current = initialPosition;
    lastMediaProgressTimeRef.current = initialPosition;
    setCurrentTime(initialPosition);
    setFurthestWatchedSecs(initialFurthest);
    furthestWatchedRef.current = initialFurthest;
    hasErrorRef.current = !src;
    setHasError(!src);
    setErrorCategory(!src ? 'missing_src' : null);
    if (!isProtectedSource(src)) {
      setIsBuffering(false);
    }
    setIsPlaying(false);

    if (videoRef.current) {
      assignProgrammaticCurrentTime(videoRef.current, initialPosition);
      videoRef.current.playbackRate = playbackRate;
    }
  }, [itemId, src, initialPosition, furthestWatched, playbackRate, isProtectedSource, assignProgrammaticCurrentTime]);

  // Apply playbackRate changes without resetting currentTime or playback state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Throttled background watch progress synchronization (suppressed in read-only mode)
  useVideoProgressSync({
    courseId,
    itemId,
    isPlaying,
    currentTime,
    furthestWatched: furthestWatchedSecs,
    duration,
    onLocalUpdate: onLocalProgressUpdate,
    isReadOnly,
  });

  // Fullscreen state listener (handles button click and native Escape key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFs = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFs);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Controls auto-hide on inactivity during playback
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setSpeedMenuOpen(false);
      }, 3500);
    }
  }, [isPlaying]);

  // Video media event listeners
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    hasLoadedMetadataRef.current = true;
    if (watchdogKindRef.current === 'initial' || initialCeilingRemainingMsRef.current !== null) {
      clearWatchdog();
    }
    resetInitialMetadataBudget();

    const dur = videoRef.current.duration;
    if (Number.isFinite(dur) && dur > 0) {
      durationRef.current = dur;
      setDuration(dur);
    }

    if (pendingRecoveryResumeRef.current) {
      const resumeAction = pendingRecoveryResumeRef.current;
      pendingRecoveryResumeRef.current = null;
      pendingUserSeekDuringRecoveryRef.current = null;
      const safeTime =
        Number.isFinite(dur) && dur > 0 ? Math.min(resumeAction.time, dur) : resumeAction.time;
      assignProgrammaticCurrentTime(videoRef.current, safeTime);
      currentTimeRef.current = safeTime;
      lastMediaProgressTimeRef.current = safeTime;
      setCurrentTime(safeTime);

      const shouldPlay =
        resumeAction.autoPlay && wantsPlayingRef.current && !isUserPausedRef.current;
      if (shouldPlay) {
        Promise.resolve(videoRef.current.play())
          .then(() => {
            setIsPlaying(true);
            setIsBuffering(false);
            updateRecoveryPhase('playing', null);
          })
          .catch(() => {
            setIsBuffering(false);
            setIsPlaying(false);
            updateRecoveryPhase('paused', null);
          });
      } else {
        setIsBuffering(false);
        setIsPlaying(false);
        updateRecoveryPhase('paused', null);
      }
      return;
    }

    if (pendingReplayActionRef.current) {
      const action = pendingReplayActionRef.current;
      pendingReplayActionRef.current = null;
      const safeTime = Number.isFinite(dur) && dur > 0 ? Math.min(action.time, dur) : action.time;
      assignProgrammaticCurrentTime(videoRef.current, safeTime);
      currentTimeRef.current = safeTime;
      lastMediaProgressTimeRef.current = safeTime;
      setCurrentTime(safeTime);
      if (action.autoPlay) {
        wantsPlayingRef.current = true;
        isUserPausedRef.current = false;
        Promise.resolve(videoRef.current.play())
          .then(() => {
            setIsPlaying(true);
            setIsBuffering(false);
            updateRecoveryPhase('playing', null);
          })
          .catch(() => {
            setIsBuffering(false);
            setIsPlaying(false);
          });
      } else {
        setIsBuffering(false);
      }
      return;
    }

    setIsBuffering(false);
    // Resume at initialPosition if permitted (if already at the very end of a completed video, start from 0)
    if (initialPosition > 0 && Number.isFinite(dur) && dur > 0) {
      const targetPos = dur > 3 && initialPosition >= dur - 2 ? 0 : Math.min(initialPosition, dur);
      if (targetPos > 0) {
        furthestWatchedRef.current = Math.max(furthestWatchedRef.current, targetPos, furthestWatched);
        setFurthestWatchedSecs((prev) => Math.max(prev, furthestWatchedRef.current));
        assignProgrammaticCurrentTime(videoRef.current, targetPos);
        currentTimeRef.current = targetPos;
        lastMediaProgressTimeRef.current = targetPos;
        setCurrentTime(targetPos);
        showResumeNotification(targetPos);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const advanced = Math.abs(curr - lastMediaProgressTimeRef.current) > 0.01;
    currentTimeRef.current = curr;
    setCurrentTime(curr);

    if (advanced) {
      lastMediaProgressTimeRef.current = curr;
      if (watchdogKindRef.current === 'playback') {
        clearWatchdog();
      }
      if (!videoRef.current.paused || wantsPlayingRef.current) {
        setIsBuffering(false);
        if (
          recoveryPhaseRef.current === 'buffering' ||
          recoveryPhaseRef.current === 'retrying_stream' ||
          recoveryPhaseRef.current === 'retrying_blob'
        ) {
          updateRecoveryPhase('playing', null);
        }
        if (recoveryAttemptsRef.current > 0) {
          const now = Date.now();
          if (stablePlaybackStartedAtRef.current === null) {
            stablePlaybackStartedAtRef.current = now;
          } else if (now - stablePlaybackStartedAtRef.current >= STABLE_PLAYBACK_RESET_MS) {
            recoveryAttemptsRef.current = 0;
            stablePlaybackStartedAtRef.current = null;
          }
        }
      }
    }

    // Legitimate continuous playback expands furthestWatchedSecs
    setFurthestWatchedSecs((prev) => {
      const newFurthest = Math.max(prev, curr);
      furthestWatchedRef.current = Math.max(furthestWatchedRef.current, newFurthest);
      // Check 90% completion threshold
      const totalDur = videoRef.current?.duration || duration;
      if (
        totalDur > 0 &&
        newFurthest / totalDur > 0.9 &&
        !hasCompletedRef.current &&
        itemId
      ) {
        hasCompletedRef.current = true;
        const res = onComplete(itemId);
        if (res && typeof (res as Promise<boolean>).then === 'function') {
          (res as Promise<boolean>)
            .then((ok) => {
              if (ok === false) hasCompletedRef.current = false;
            })
            .catch(() => {
              hasCompletedRef.current = false;
            });
        }
      }
      return newFurthest;
    });
  };

  const handleEnded = () => {
    wantsPlayingRef.current = false;
    isUserPausedRef.current = false;
    isSeekingRef.current = false;
    pendingUserSeekDuringRecoveryRef.current = null;
    pendingRecoveryResumeRef.current = null;
    stablePlaybackStartedAtRef.current = null;
    clearWatchdog();
    resetInitialMetadataBudget();
    setIsPlaying(false);
    setIsBuffering(false);
    updateRecoveryPhase('ended', null);
    if (!hasCompletedRef.current && itemId) {
      hasCompletedRef.current = true;
      const res = onComplete(itemId);
      if (res && typeof (res as Promise<boolean>).then === 'function') {
        (res as Promise<boolean>)
          .then((ok) => {
            if (ok === false) hasCompletedRef.current = false;
          })
          .catch(() => {
            hasCompletedRef.current = false;
          });
      }
    }
  };

  const handleSeeking = () => {
    if (!videoRef.current) return;
    const target = videoRef.current.currentTime;
    const safeFurthest = furthestWatchedRef.current;

    const prog = programmaticSeekRef.current;
    const isProgrammatic =
      prog !== null &&
      Date.now() - prog.timestamp <= 1000 &&
      Math.abs(target - prog.time) < 0.5;
    if (isProgrammatic) {
      programmaticSeekRef.current = null;
    }

    let effectiveTarget = target;
    // Forward-seeking restriction applies only to active incomplete trainees (never completed/preview/review-only)
    if (!canSeekFreelyRef.current && target > safeFurthest + 0.05) {
      effectiveTarget = safeFurthest;
      assignProgrammaticCurrentTime(videoRef.current, safeFurthest);
      currentTimeRef.current = safeFurthest;
      setCurrentTime(safeFurthest);
      triggerSeekingClamped();
    } else if (!isProgrammatic) {
      currentTimeRef.current = effectiveTarget;
      setCurrentTime(effectiveTarget);
    }

    if (!isProgrammatic) {
      recordUserSeekDuringRecovery(effectiveTarget);
    }

    isSeekingRef.current = true;
    if (!videoRef.current.ended && !isUserPausedRef.current && (wantsPlayingRef.current || !videoRef.current.paused)) {
      armWatchdog('playback', true);
    }
  };

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    if (!videoRef.current || hasError) return;
    const media = videoRef.current;
    if (media.error || eofDecodeRecoveryRef.current) {
      eofDecodeRecoveryRef.current = false;
      isUserPausedRef.current = false;
      wantsPlayingRef.current = true;
      hasLoadedMetadataRef.current = false;
      pendingReplayActionRef.current = { time: 0, autoPlay: true };
      currentTimeRef.current = 0;
      setCurrentTime(0);
      setIsBuffering(true);
      if (typeof media.load === 'function') {
        internalReloadRef.current = true;
        try {
          media.load();
        } finally {
          internalReloadRef.current = false;
        }
      }
      resetControlsTimeout();
      return;
    }
    if (media.paused || media.ended) {
      if (media.ended) {
        assignProgrammaticCurrentTime(media, 0);
        currentTimeRef.current = 0;
        lastMediaProgressTimeRef.current = 0;
        setCurrentTime(0);
      }
      isUserPausedRef.current = false;
      wantsPlayingRef.current = true;
      Promise.resolve(media.play())
        .then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
          updateRecoveryPhase('playing', null);
        })
        .catch(() => {
          wantsPlayingRef.current = false;
          setIsBuffering(false);
          setIsPlaying(false);
        });
    } else {
      isUserPausedRef.current = true;
      wantsPlayingRef.current = false;
      stablePlaybackStartedAtRef.current = null;
      clearWatchdog();
      if (pendingRecoveryResumeRef.current) {
        pendingRecoveryResumeRef.current = { ...pendingRecoveryResumeRef.current, autoPlay: false };
      }
      media.pause();
      setIsPlaying(false);
      setIsBuffering(false);
      updateRecoveryPhase('paused', null);
    }
    resetControlsTimeout();
  }, [
    hasError,
    resetControlsTimeout,
    clearWatchdog,
    updateRecoveryPhase,
    assignProgrammaticCurrentTime,
  ]);

  // Volume & Mute controls
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    resetControlsTimeout();
  }, [isMuted, resetControlsTimeout]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
    resetControlsTimeout();
  };

  // Playback speed selector (1x, 1.25x, 1.5x, 2x)
  const handleSpeedSelect = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setSpeedMenuOpen(false);
    resetControlsTimeout();
  };

  // Fullscreen toggle via Browser Fullscreen API
  const toggleFullscreen = useCallback(() => {
    if (!playerContainerRef.current) return;

    if (!document.fullscreenElement) {
      playerContainerRef.current
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {
          // Gracefully suppress rejected requests (e.g. permission policies)
        });
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => { });
    }
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // Authoritative seek request processor shared across scrubber, keyboard, and direct requests
  const requestSeek = useCallback(
    (targetSeconds: number) => {
      if (!videoRef.current || duration <= 0) return;
      const safeFurthest = furthestWatchedRef.current;
      const clampedSeconds = clampSeekingPosition(
        targetSeconds,
        safeFurthest,
        canSeekFreelyRef.current
      );

      if (clampedSeconds < targetSeconds && !canSeekFreelyRef.current) {
        triggerSeekingClamped();
      }

      if (isRecoveringRef.current || pendingRecoveryResumeRef.current !== null) {
        if (!videoRef.current.error) {
          assignProgrammaticCurrentTime(videoRef.current, clampedSeconds);
        }
        currentTimeRef.current = clampedSeconds;
        setCurrentTime(clampedSeconds);
        recordUserSeekDuringRecovery(clampedSeconds);
        resetControlsTimeout();
        return;
      }

      if (videoRef.current.error || eofDecodeRecoveryRef.current) {
        eofDecodeRecoveryRef.current = false;
        hasLoadedMetadataRef.current = false;
        pendingReplayActionRef.current = { time: clampedSeconds, autoPlay: false };
        currentTimeRef.current = clampedSeconds;
        setCurrentTime(clampedSeconds);
        setIsBuffering(true);
        if (typeof videoRef.current.load === 'function') {
          internalReloadRef.current = true;
          try {
            videoRef.current.load();
          } finally {
            internalReloadRef.current = false;
          }
        }
        resetControlsTimeout();
        return;
      }

      assignProgrammaticCurrentTime(videoRef.current, clampedSeconds);
      currentTimeRef.current = clampedSeconds;
      setCurrentTime(clampedSeconds);
      resetControlsTimeout();
    },
    [
      duration,
      triggerSeekingClamped,
      resetControlsTimeout,
      assignProgrammaticCurrentTime,
      recordUserSeekDuringRecovery,
    ]
  );

  // Scrubber seeking interaction
  const handleTimelineSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSeconds = percent * duration;
    requestSeek(targetSeconds);
  };

  // Keyboard navigation & accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Only handle when container is active or hovered
      if (!playerContainerRef.current?.contains(document.activeElement) && document.activeElement !== document.body) {
        // Allow shortcut if container has focus
      }

      if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'ArrowRight' || e.key === 'ArrowRight') {
        // ArrowRight moves forward (+5s, clamped for incomplete lessons) matching the LTR video timeline
        e.preventDefault();
        if (videoRef.current) {
          requestSeek(videoRef.current.currentTime + 5);
        }
      } else if (e.code === 'ArrowLeft' || e.key === 'ArrowLeft') {
        // ArrowLeft moves backward (-5s) matching the LTR video timeline
        e.preventDefault();
        if (videoRef.current) {
          requestSeek(Math.max(0, videoRef.current.currentTime - 5));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleMute, toggleFullscreen, requestSeek, resetControlsTimeout]);

  // Scrubber percentage positions
  const elapsedPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const furthestPercent = duration > 0 ? (furthestWatchedSecs / duration) * 100 : 0;
  const errorDisplay = ERROR_UI_MESSAGES[errorCategory || 'missing_src'];

  return (
    <div
      ref={playerContainerRef}
      className="custom-video-container"
      data-recovery-phase={recoveryPhase}
      tabIndex={0}
      onMouseMove={resetControlsTimeout}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
      }}
      aria-label={`مشغل الفيديو: ${title}`}
      role="region"
    >
      {/* Fallback state when media asset is missing or unrecoverable */}
      {!src || hasError ? (
        <div className="video-error-state" role="alert" data-error-category={errorCategory || 'missing_src'}>
          <Icon name="alertCircle" size={48} className="text-warning-dark" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{errorDisplay.title}</h3>
          <p>{errorDisplay.body}</p>
          <button
            type="button"
            className="speed-dropdown-btn"
            onClick={() => {
              sourceGenerationRef.current += 1;
              cancelInFlightRecovery();
              clearWatchdog();
              resetInitialMetadataBudget();
              pendingUserSeekDuringRecoveryRef.current = null;
              pendingRecoveryResumeRef.current = null;
              programmaticSeekRef.current = null;
              hasErrorRef.current = false;
              setHasError(false);
              setErrorCategory(null);
              blobFallbackAttemptedSrcRef.current = null;
              hasRetriedRenewedStreamRef.current = false;
              knownContentLengthRef.current = undefined;
              recoveryAttemptsRef.current = 0;
              totalSourceRecoveriesRef.current = 0;
              setRetryNonce((prev) => prev + 1);
              if (videoRef.current && !isProtectedSource(src)) {
                videoRef.current.load();
              }
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      ) : (
        <>
          {/* HTML5 Native Video Engine with Progressive Range Streaming */}
          <video
            ref={videoRef}
            src={protectedBlobUrl || undefined}
            poster={poster}
            preload="metadata"
            className="custom-video-element"
            controls={false}
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            onContextMenu={(e) => e.preventDefault()}
            playsInline
            onLoadStart={() => {
              hasLoadedMetadataRef.current = false;
              if (!isUserPausedRef.current && !hasErrorRef.current) {
                armWatchdog('initial', false);
              }
            }}
            onLoadedMetadata={handleLoadedMetadata}
            onLoadedData={() => {
              if (videoRef.current && videoRef.current.readyState >= 2 && !videoRef.current.paused) {
                setIsBuffering(false);
              }
            }}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onSeeking={handleSeeking}
            onSeeked={() => {
              isSeekingRef.current = false;
              setIsBuffering(false);
              lastMediaProgressTimeRef.current = videoRef.current?.currentTime ?? currentTimeRef.current;
              if (watchdogKindRef.current === 'playback') {
                clearWatchdog();
              }
              if (
                recoveryPhaseRef.current === 'buffering' ||
                recoveryPhaseRef.current === 'retrying_stream' ||
                recoveryPhaseRef.current === 'retrying_blob'
              ) {
                updateRecoveryPhase(wantsPlayingRef.current ? 'playing' : 'paused', null);
              }
            }}
            onWaiting={() => {
              if (videoRef.current?.ended || isUserPausedRef.current || isRecoveringRef.current) return;
              setIsBuffering(true);
              updateRecoveryPhase('buffering', null);
              armWatchdog(hasLoadedMetadataRef.current ? 'playback' : 'initial', true);
            }}
            onStalled={() => {
              if (videoRef.current?.ended || isUserPausedRef.current || isRecoveringRef.current) return;
              if (!hasLoadedMetadataRef.current) {
                armWatchdog('initial', true);
              } else if (wantsPlayingRef.current || !videoRef.current?.paused || isSeekingRef.current) {
                setIsBuffering(true);
                updateRecoveryPhase('buffering', null);
                armWatchdog('playback', true);
              }
            }}
            onProgress={() => {
              // Post-metadata: progress events alone must NOT reset playback stall watchdog.
              if (
                watchdogKindRef.current !== 'initial' ||
                hasLoadedMetadataRef.current ||
                initialCeilingExhaustedRef.current ||
                hasErrorRef.current ||
                isRecoveringRef.current ||
                isUserPausedRef.current
              ) {
                return;
              }
              const media = videoRef.current;
              if (!media) return;

              let maxBufferedEnd = 0;
              if (media.buffered) {
                for (let i = 0; i < media.buffered.length; i += 1) {
                  const end = media.buffered.end(i);
                  if (Number.isFinite(end) && end > maxBufferedEnd) {
                    maxBufferedEnd = end;
                  }
                }
              }

              const bufferedAdvanced = maxBufferedEnd > lastInitialBufferedEndRef.current + 0.01;
              const readyStateAdvanced = media.readyState > lastInitialReadyStateRef.current;
              const isNetworkLoading =
                typeof HTMLMediaElement !== 'undefined'
                  ? media.networkState === HTMLMediaElement.NETWORK_LOADING
                  : media.networkState === 2;

              if (bufferedAdvanced) {
                lastInitialBufferedEndRef.current = maxBufferedEnd;
              }
              if (readyStateAdvanced) {
                lastInitialReadyStateRef.current = media.readyState;
              }

              if (!(bufferedAdvanced || readyStateAdvanced || isNetworkLoading)) {
                return;
              }

              if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                suspendedWatchdogKindRef.current = 'initial';
                return;
              }

              scheduleInitialIdleTimer(sourceGenerationRef.current);
            }}
            onCanPlay={() => {
              setIsBuffering(false);
              if (watchdogKindRef.current === 'playback' && !isSeekingRef.current) {
                clearWatchdog();
              }
              if (
                recoveryPhaseRef.current === 'buffering' ||
                recoveryPhaseRef.current === 'retrying_stream' ||
                recoveryPhaseRef.current === 'retrying_blob'
              ) {
                updateRecoveryPhase(wantsPlayingRef.current ? 'playing' : 'paused', null);
              }
            }}
            onCanPlayThrough={() => {
              setIsBuffering(false);
              if (watchdogKindRef.current === 'playback' && !isSeekingRef.current) {
                clearWatchdog();
              }
            }}
            onPlaying={() => {
              hasStartedPlaybackRef.current = true;
              eofDecodeRecoveryRef.current = false;
              isUserPausedRef.current = false;
              wantsPlayingRef.current = true;
              isSeekingRef.current = false;
              clearWatchdog();
              lastMediaProgressTimeRef.current =
                videoRef.current?.currentTime ?? currentTimeRef.current;
              setIsPlaying(true);
              setIsBuffering(false);
              updateRecoveryPhase('playing', null);
            }}
            onPause={() => {
              if (
                hasErrorRef.current ||
                recoveryPhaseRef.current === 'error' ||
                recoveryPhaseRef.current === 'ended' ||
                videoRef.current?.ended
              ) {
                return;
              }
              setIsPlaying(false);
              setIsBuffering(false);
              if (
                !internalReloadRef.current &&
                (hasLoadedMetadataRef.current || hasStartedPlaybackRef.current) &&
                recoveryPhaseRef.current !== 'retrying_stream' &&
                recoveryPhaseRef.current !== 'retrying_blob'
              ) {
                isUserPausedRef.current = true;
                wantsPlayingRef.current = false;
                stablePlaybackStartedAtRef.current = null;
                clearWatchdog();
                updateRecoveryPhase('paused', null);
                if (pendingRecoveryResumeRef.current) {
                  pendingRecoveryResumeRef.current = {
                    ...pendingRecoveryResumeRef.current,
                    autoPlay: false,
                  };
                }
              }
            }}
            onError={() => {
              clearWatchdog();
              const mediaErrCode = videoRef.current?.error?.code;
              const curr = videoRef.current?.currentTime ?? currentTimeRef.current;
              const dur = videoRef.current?.duration || durationRef.current || duration;
              // Trailing corrupt AAC/frame packets near EOF (MEDIA_ERR_DECODE=3) after active playback
              // should gracefully finish playback instead of discarding progress or blaming network loading.
              if (
                mediaErrCode === 3 &&
                hasStartedPlaybackRef.current &&
                dur > 0 &&
                (curr >= Math.max(0, dur - 1.5) || curr / dur >= 0.9)
              ) {
                eofDecodeRecoveryRef.current = true;
                handleEnded();
                return;
              }
              if (mediaErrCode === 3) {
                failPlayerWithCategory('decode');
                return;
              }
              void triggerRecovery('error', sourceGenerationRef.current, mediaErrCode);
            }}
            onClick={togglePlay}
          />

          {/* Buffering Spinner & Recovery Status Indicator */}
          {isBuffering && (
            <div
              className="video-buffering-overlay"
              aria-label={recoveryStatusMessage || 'جاري التحميل...'}
              style={{ flexDirection: 'column', gap: '0.65rem' }}
            >
              <div className="video-spinner" />
              {recoveryStatusMessage && (
                <div
                  role="status"
                  data-testid="video-recovery-status"
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    color: '#F8FAFC',
                    padding: '0.35rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {recoveryStatusMessage}
                </div>
              )}
            </div>
          )}

          {/* Auto-Resume Timestamp Notification Pill */}
          {resumedFromSeconds !== null && resumedFromSeconds > 0 && !seekingClamped && (
            <div
              role="status"
              data-testid="video-auto-resume-badge"
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                zIndex: 49,
                backgroundColor: 'rgba(15, 23, 42, 0.92)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#F8FAFC',
                padding: '0.45rem 0.85rem',
                borderRadius: '10px',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.45)',
              }}
            >
              <Icon name="clock" size="sm" className="text-sky-400" />
              <span>تم استكمال الفيديو تلقائياً من الدقيقة {formatDuration(resumedFromSeconds)}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (videoRef.current) {
                    assignProgrammaticCurrentTime(videoRef.current, 0);
                    setCurrentTime(0);
                  }
                  setResumedFromSeconds(null);
                }}
                style={{
                  background: 'rgba(56, 189, 248, 0.18)',
                  color: '#38BDF8',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: '6px',
                  padding: '0.15rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                data-testid="video-restart-from-zero-btn"
              >
                البدء من الأول
              </button>
            </div>
          )}

          {/* Forward-Seeking Clamped Warning Badge (Resilient Visibility) */}
          {seekingClamped && (
            <div
              key={`seek-clamped-${seekClampKey}`}
              className="seeking-clamped-badge"
              role="status"
              data-testid="seeking-clamped-badge"
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                zIndex: 50,
                backgroundColor: 'rgba(220, 38, 38, 0.95)',
                color: '#FFFFFF',
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                pointerEvents: 'none',
                opacity: 1,
              }}
            >
              <Icon name="lock" size="sm" />
              <span>لا يمكن التقديم للأمام متجاوزاً ما تمت مشاهدته</span>
            </div>
          )}

          {/* Big Center Play Button when paused */}
          {!isPlaying && !isBuffering && (
            <button
              type="button"
              className="video-big-play-btn"
              onClick={togglePlay}
              aria-label="تشغيل الفيديو"
            >
              <Icon name="play" size={32} />
            </button>
          )}

          {/* Custom React Controls Overlay Bar */}
          <div className={`custom-controls-bar ${!showControls && isPlaying ? 'hidden' : ''}`}>
            {/* Scrubber Timeline */}
            <div
              className="timeline-scrubber-wrap"
              onClick={handleTimelineSeek}
              role="slider"
              aria-label="شريط التقدم الزمني"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={currentTime}
              aria-valuetext={`${formatDuration(currentTime)} من ${formatDuration(duration)}`}
              tabIndex={0}
            >
              {/* Furthest Watched High-Water Mark Range */}
              <div
                className="timeline-furthest-bar"
                style={{ width: `${Math.min(100, furthestPercent)}%` }}
              />
              {/* Current Elapsed Position Range */}
              <div
                className="timeline-elapsed-bar"
                style={{ width: `${Math.min(100, elapsedPercent)}%` }}
              />
              {/* Scrubber Thumb */}
              <div
                className="timeline-thumb"
                style={{ left: `${Math.min(100, elapsedPercent)}%` }}
              />
            </div>

            {/* Actions Bar */}
            <div className="controls-actions-row">
              {/* Start Group: Play/Pause, Volume, Time */}
              <div className="controls-group-start">
                <button
                  type="button"
                  className="ctrl-btn"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
                  title={isPlaying ? 'إيقاف مؤقت (Space)' : 'تشغيل (Space)'}
                >
                  <Icon name={isPlaying ? 'pause' : 'play'} size="lg" />
                </button>

                <button
                  type="button"
                  className="ctrl-btn"
                  onClick={toggleMute}
                  aria-label={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
                  title={isMuted ? 'إلغاء كتم الصوت (M)' : 'كتم الصوت (M)'}
                >
                  <Icon name={isMuted ? 'volumeX' : 'volume'} size="md" />
                </button>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="volume-slider"
                  aria-label="مستوى الصوت"
                />

                <span className="video-time-display">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>
              </div>

              {/* End Group: Speed Selector & Fullscreen Toggle */}
              <div className="controls-group-end" style={{ position: 'relative' }}>
                {/* Playback Speed Menu */}
                {speedMenuOpen && (
                  <div className="speed-menu" role="menu">
                    {[1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        className={`speed-option ${playbackRate === rate ? 'active' : ''}`}
                        onClick={() => handleSpeedSelect(rate)}
                        role="menuitem"
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  className="speed-dropdown-btn"
                  onClick={() => setSpeedMenuOpen(!speedMenuOpen)}
                  aria-label="سرعة التشغيل"
                  aria-expanded={speedMenuOpen}
                  title="سرعة التشغيل"
                >
                  {playbackRate}x
                </button>

                {/* Download Button (when enabled by course downloadPolicy) */}
                {canDownload && (protectedBlobUrl || src) && (
                  <a
                    href={protectedBlobUrl || src}
                    download={`${title || 'video'}.mp4`}
                    className="ctrl-btn"
                    title="تحميل الفيديو"
                    aria-label="تحميل الفيديو"
                    data-testid="video-download-btn"
                  >
                    <Icon name="download" size="md" />
                  </a>
                )}

                {/* Visible Fullscreen Toggle Button */}
                <button
                  type="button"
                  className="ctrl-btn"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}
                  title={isFullscreen ? 'الخروج من ملء الشاشة (F / Esc)' : 'ملء الشاشة (F)'}
                >
                  <Icon name={isFullscreen ? 'minimize' : 'maximize'} size="lg" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
