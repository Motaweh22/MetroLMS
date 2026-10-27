import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { loadYouTubeIframeApi } from '../utils/youtubeApiLoader';
import type { LessonProgress } from '../types';
import type { VideoEmbedPolicy } from '@/core/courses/types';
import {
  deriveEffectiveSandbox,
  deriveEffectivePermissions,
  getMandatoryVideoEmbedPolicy,
} from '@/core/courses/videoEmbedPolicy';

export interface YouTubePlayerProps {
  videoId: string;
  itemId?: string;
  title: string;
  isCompleted?: boolean;
  initialPosition?: number;
  onComplete?: (itemId: string) => Promise<boolean> | void;
  onLocalProgressUpdate?: (itemId: string, activity: Partial<LessonProgress>) => void;
  previewMode?: boolean;
  /** Legacy / experimental props preserved for backward compatibility */
  embedPolicy?: VideoEmbedPolicy;
  cropTopPixels?: number;
  blockPopups?: boolean;
}

// Global window declarations for YouTube IFrame API
declare global {
  interface Window {
    YT?: {
      Player: new (
        element: string | HTMLElement,
        options: YTPlayerOptions
      ) => YTPlayerInstance;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YTPlayerOptions {
  width?: string | number;
  height?: string | number;
  videoId: string;
  playerVars?: {
    autoplay?: number;
    controls?: number;
    enablejsapi?: number;
    fs?: number;
    rel?: number;
    playsinline?: number;
    disablekb?: number;
    iv_load_policy?: number;
    start?: number;
    origin?: string;
    [key: string]: unknown;
  };
  events?: {
    onReady?: (event: { target: YTPlayerInstance }) => void;
    onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
    onError?: (event: { data: number }) => void;
  };
}

export interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState?: () => number;
  destroy: () => void;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  itemId,
  title,
  isCompleted = false,
  initialPosition = 0,
  onComplete,
  onLocalProgressUpdate,
  previewMode = false,
}) => {
  const mountContainerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mandatory platform policy: YouTube ALWAYS receives 0px top crop and popup blocking enabled.
  // Stale saved metadata or prop overrides cannot weaken the production platform policy.
  const mandatoryPolicy = getMandatoryVideoEmbedPolicy('youtube');
  const effectiveCrop = mandatoryPolicy.cropTopPixels; // 0
  const effectiveBlockPopups = mandatoryPolicy.blockPopups; // true

  const previewModeRef = useRef(previewMode);
  useEffect(() => {
    previewModeRef.current = previewMode;
  }, [previewMode]);

  // Volatile callback and prop references: prevents player destruction on re-renders
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const onLocalProgressUpdateRef = useRef(onLocalProgressUpdate);
  useEffect(() => {
    onLocalProgressUpdateRef.current = onLocalProgressUpdate;
  }, [onLocalProgressUpdate]);

  const itemIdRef = useRef(itemId);
  useEffect(() => {
    itemIdRef.current = itemId;
  }, [itemId]);

  const hasCompletedRef = useRef<boolean>(isCompleted);
  useEffect(() => {
    if (isCompleted) {
      hasCompletedRef.current = true;
    }
  }, [isCompleted]);

  const titleRef = useRef(title);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  // Initial playback start position (evaluated only once upon initial mount or videoId change)
  const initialPositionRef = useRef<number>(initialPosition);

  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize and preserve YouTube Player instance across React renders
  useEffect(() => {
    let isMounted = true;
    const container = mountContainerRef.current;
    setHasError(false);
    setErrorMessage(null);

    // Stop any previously running progress polling interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    const applySecurityAttributesToIframe = (iframe: HTMLIFrameElement) => {
      if (!effectiveBlockPopups) return;
      const sandboxStr = deriveEffectiveSandbox(true);
      if (sandboxStr && iframe.getAttribute('sandbox') !== sandboxStr) {
        iframe.setAttribute('sandbox', sandboxStr);
      }
      const permissionsStr = deriveEffectivePermissions(true);
      if (permissionsStr && iframe.getAttribute('allow') !== permissionsStr) {
        iframe.setAttribute('allow', permissionsStr);
      }
    };

    // Watch for any dynamic iframe replacements within container to ensure security attributes persist
    let observer: MutationObserver | null = null;
    if (container && effectiveBlockPopups) {
      observer = new MutationObserver(() => {
        const currentIframe = container.querySelector('iframe');
        if (currentIframe) {
          applySecurityAttributesToIframe(currentIframe);
        }
      });
      observer.observe(container, { childList: true, subtree: true });
    }

    const init = async () => {
      try {
        await loadYouTubeIframeApi();
        if (!isMounted) return;

        if (!window.YT || typeof window.YT.Player !== 'function') {
          throw new Error('تعذر تهيئة مشغل YouTube IFrame API.');
        }

        const container = mountContainerRef.current;
        if (!container) return;

        // Clear any previous mount contents
        container.innerHTML = '';

        // Safely destroy existing player instance if any
        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch {
            // Ignore destruction error
          }
          playerRef.current = null;
        }

        // Pre-create the <iframe> element and apply mandatory sandbox and permissions policy
        // BEFORE setting its source and before appending to DOM.
        // Applying the sandbox to an existing iframe prior to its initial content navigation
        // ensures browser engines enforce sandboxing flags (blocking popups and top navigation)
        // on the browsing context from initial load, rather than relying on ineffective post-load mutation.
        const iframe = document.createElement('iframe');
        iframe.id = `youtube-player-${videoId}`;
        iframe.title = titleRef.current;
        iframe.className = 'w-full h-full border-0';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.setAttribute('data-testid', 'youtube-iframe');

        // Apply mandatory sandbox BEFORE setting src or attaching to DOM
        const effectiveSandbox = deriveEffectiveSandbox(effectiveBlockPopups);
        if (effectiveSandbox) {
          iframe.setAttribute('sandbox', effectiveSandbox);
        }

        // Apply permissions policy: permit essential playback features, strictly omit picture-in-picture
        const effectivePermissions = deriveEffectivePermissions(effectiveBlockPopups);
        iframe.setAttribute('allow', effectivePermissions);
        iframe.setAttribute('allowfullscreen', '1');

        // Construct official YouTube embed URL with required parameters
        const embedParams = new URLSearchParams({
          enablejsapi: '1',
          controls: '1',
          fs: '1',
          rel: '0',
          playsinline: '1',
          disablekb: '0',
          iv_load_policy: '3',
          start: String(Math.floor(initialPositionRef.current || 0)),
        });

        if (typeof window !== 'undefined' && window.location.origin) {
          embedParams.set('origin', window.location.origin);
          embedParams.set('widget_referrer', window.location.origin);
        }

        iframe.src = `https://www.youtube.com/embed/${videoId}?${embedParams.toString()}`;

        // Append the pre-configured iframe to the DOM
        container.appendChild(iframe);

        // Bind the official YouTube Player instance to the pre-created, pre-sandboxed <iframe>
        playerRef.current = new window.YT.Player(iframe, {
          width: '100%',
          height: '100%',
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 1, // Expose standard native YouTube controls (play/pause, seekbar, volume, settings, etc.)
            enablejsapi: 1, // Enable official JavaScript API communication
            fs: 1, // Enable standard fullscreen control
            rel: 0, // Show related videos from same channel only
            playsinline: 1, // Inline playback on mobile without OS takeover
            disablekb: 0, // Allow standard keyboard controls
            iv_load_policy: 3, // Hide video annotations
            start: Math.floor(initialPositionRef.current || 0),
            origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          },
          events: {
            onReady: () => {
              applySecurityAttributesToIframe(iframe);
            },
            onStateChange: (event) => {
              if (!isMounted) return;
              const yt = window.YT;
              if (!yt) return;

              const state = event.data;

              // Active playback state: poll progress and check completion threshold
              if (state === yt.PlayerState.PLAYING) {
                if (progressIntervalRef.current) {
                  clearInterval(progressIntervalRef.current);
                }

                if (!previewModeRef.current) {
                  progressIntervalRef.current = setInterval(() => {
                    if (!playerRef.current || !itemIdRef.current) return;
                    try {
                      const currentSec = playerRef.current.getCurrentTime();
                      const totalSec = playerRef.current.getDuration();

                      if (typeof totalSec === 'number' && totalSec > 0) {
                        onLocalProgressUpdateRef.current?.(itemIdRef.current, {
                          lastPositionSeconds: currentSec,
                          furthestWatchedSeconds: currentSec,
                          durationSeconds: totalSec,
                        });

                        // 90% threshold for lesson completion
                        if (currentSec / totalSec >= 0.9 && !hasCompletedRef.current) {
                          hasCompletedRef.current = true;
                          onCompleteRef.current?.(itemIdRef.current);
                        }
                      }
                    } catch {
                      // Suppress polling read errors on unmount
                    }
                  }, 2000);
                }
              } else {
                // Non-playing states (Paused, Buffering, Cued, Ended)
                if (progressIntervalRef.current) {
                  clearInterval(progressIntervalRef.current);
                  progressIntervalRef.current = null;
                }
              }

              // Finished playback event
              if (!previewModeRef.current && state === yt.PlayerState.ENDED) {
                if (!hasCompletedRef.current && itemIdRef.current) {
                  hasCompletedRef.current = true;
                  onCompleteRef.current?.(itemIdRef.current);
                }
              }
            },
            onError: (errEvent) => {
              if (!isMounted) return;
              setHasError(true);
              const code = errEvent.data;
              if (code === 101 || code === 150) {
                setErrorMessage(
                  'عذراً، صاحب هذا الفيديو قام بحظر تشغيله خارج موقع YouTube.'
                );
              } else if (code === 100 || code === 2) {
                setErrorMessage('عذراً، تعذر العثور على هذا الفيديو أو تم حذفه.');
              } else {
                setErrorMessage('حدث خطأ أثناء تحميل فيديو YouTube المضمن.');
              }
            },
          },
        });
      } catch (err: unknown) {
        if (!isMounted) return;
        setHasError(true);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'تعذر تهيئة مشغل YouTube على هذا المتصفح.'
        );
      }
    };

    init();

    return () => {
      isMounted = false;
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (observer) {
        observer.disconnect();
      }
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignore destruction error
        }
        playerRef.current = null;
      }
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [videoId, effectiveBlockPopups]);

  const youtubeDirectLink = `https://www.youtube.com/watch?v=${videoId}`;

  return (
    <div
      className="custom-video-container relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-xl flex flex-col justify-center items-center"
      data-testid="youtube-player-container"
      data-crop-pixels={effectiveCrop}
      data-popup-blocking={effectiveBlockPopups ? 'enabled' : 'disabled'}
      aria-label={`مشغل الفيديو: ${title}`}
    >
      {hasError ? (
        <div
          className="video-error-state p-6 text-center space-y-3"
          role="alert"
          data-testid="youtube-error-state"
        >
          <Icon name="alertCircle" size={48} className="text-warning-dark mx-auto" />
          <h3 className="text-base font-bold text-white">تعذر تشغيل الفيديو المضمن</h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            {errorMessage || 'تعذر تشغيل محتوى الفيديو في المتصفح حالياً.'}
          </p>
          <a
            href={youtubeDirectLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-dark transition-colors"
            data-testid="open-youtube-external-link"
          >
            <span>مشاهدة الفيديو على موقع YouTube مباشرة</span>
            <Icon name="link" size="sm" />
          </a>
        </div>
      ) : (
        /* 
          Dedicated DOM mount container.
          React never renders children into this div, leaving the YouTube-generated <iframe>
          completely undisturbed during ordinary state updates and re-renders.
        */
        <div
          ref={mountContainerRef}
          className="w-full h-full"
          data-testid="youtube-iframe-holder"
        />
      )}
    </div>
  );
};

export default YouTubePlayer;
