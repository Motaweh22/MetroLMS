import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icon } from '@/shared/ui/Icon/Icon';
import { clampSeekingPosition, formatDuration } from '@/core/domain/progress';
import { useVideoProgressSync } from '../hooks/useVideoProgressSync';
import type { LessonProgress } from '../types';

export interface VideoPlayerProps {
  courseId?: string;
  itemId?: string;
  src?: string;
  poster?: string;
  title: string;
  initialPosition?: number;
  furthestWatched?: number;
  isCompleted?: boolean;
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
  onComplete,
  onLocalProgressUpdate,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const hasCompletedRef = useRef<boolean>(isCompleted);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  const [seekingClamped, setSeekingClamped] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [speedMenuOpen, setSpeedMenuOpen] = useState<boolean>(false);

  // Sync completion ref with prop
  useEffect(() => {
    hasCompletedRef.current = isCompleted;
  }, [isCompleted]);

  // Reset or initialize when lesson item changes
  useEffect(() => {
    setCurrentTime(initialPosition);
    setFurthestWatchedSecs(Math.max(initialPosition, furthestWatched));
    setHasError(false);
    setIsBuffering(false);
    setIsPlaying(false);

    if (videoRef.current) {
      videoRef.current.currentTime = initialPosition;
      videoRef.current.playbackRate = playbackRate;
    }
  }, [itemId, initialPosition, furthestWatched, playbackRate]);

  // Throttled background watch progress synchronization
  useVideoProgressSync({
    courseId,
    itemId,
    isPlaying,
    currentTime,
    furthestWatched: furthestWatchedSecs,
    duration,
    onLocalUpdate: onLocalProgressUpdate,
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
    const dur = videoRef.current.duration;
    if (Number.isFinite(dur) && dur > 0) {
      setDuration(dur);
    }
    // Resume at initialPosition if permitted
    if (initialPosition > 0 && initialPosition <= dur) {
      videoRef.current.currentTime = initialPosition;
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    setCurrentTime(curr);

    // Legitimate continuous playback expands furthestWatchedSecs
    setFurthestWatchedSecs((prev) => {
      const newFurthest = Math.max(prev, curr);
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
    setIsPlaying(false);
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

    // Forward-seeking restriction for incomplete lessons
    if (!hasCompletedRef.current && target > furthestWatchedSecs + 0.5) {
      videoRef.current.currentTime = furthestWatchedSecs;
      setCurrentTime(furthestWatchedSecs);
      setSeekingClamped(true);
      setTimeout(() => setSeekingClamped(false), 2500);
    }
  };

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    if (!videoRef.current || hasError) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    resetControlsTimeout();
  }, [hasError, resetControlsTimeout]);

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
        .catch(() => {});
    }
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // Scrubber seeking interaction
  const handleTimelineSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSeconds = percent * duration;

    // Apply seeking clamping
    const clampedSeconds = clampSeekingPosition(
      targetSeconds,
      furthestWatchedSecs,
      hasCompletedRef.current
    );

    if (clampedSeconds < targetSeconds && !hasCompletedRef.current) {
      setSeekingClamped(true);
      setTimeout(() => setSeekingClamped(false), 2500);
    }

    videoRef.current.currentTime = clampedSeconds;
    setCurrentTime(clampedSeconds);
    resetControlsTimeout();
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
      } else if (e.code === 'ArrowRight') {
        // In Arabic RTL, ArrowRight moves backward in video timeline
        e.preventDefault();
        if (videoRef.current) {
          const newTime = Math.max(0, videoRef.current.currentTime - 5);
          videoRef.current.currentTime = newTime;
          setCurrentTime(newTime);
        }
      } else if (e.code === 'ArrowLeft') {
        // In Arabic RTL, ArrowLeft moves forward in video timeline (clamped)
        e.preventDefault();
        if (videoRef.current) {
          const target = videoRef.current.currentTime + 5;
          const clamped = clampSeekingPosition(
            target,
            furthestWatchedSecs,
            hasCompletedRef.current
          );
          if (clamped < target && !hasCompletedRef.current) {
            setSeekingClamped(true);
            setTimeout(() => setSeekingClamped(false), 2500);
          }
          videoRef.current.currentTime = clamped;
          setCurrentTime(clamped);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleMute, toggleFullscreen, furthestWatchedSecs]);

  // Scrubber percentage positions
  const elapsedPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const furthestPercent = duration > 0 ? (furthestWatchedSecs / duration) * 100 : 0;

  return (
    <div
      ref={playerContainerRef}
      className="custom-video-container"
      tabIndex={0}
      onMouseMove={resetControlsTimeout}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
      }}
      aria-label={`مشغل الفيديو: ${title}`}
      role="region"
    >
      {/* Fallback state when media asset is missing or invalid */}
      {!src || hasError ? (
        <div className="video-error-state" role="alert">
          <Icon name="alertCircle" size={48} className="text-warning-dark" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
            عذراً، تعذر تحميل ملف الفيديو
          </h3>
          <p>
            الملف المرئي غير متوفر حالياً أو صيغته غير مدعومة على متصفحك. يرجى إعادة المحاولة لاحقاً.
          </p>
          <button
            type="button"
            className="speed-dropdown-btn"
            onClick={() => {
              setHasError(false);
              if (videoRef.current) {
                videoRef.current.load();
              }
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      ) : (
        <>
          {/* HTML5 Native Video Engine (Default Controls Disabled) */}
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            className="custom-video-element"
            controls={false}
            playsInline
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onSeeking={handleSeeking}
            onWaiting={() => setIsBuffering(true)}
            onCanPlay={() => setIsBuffering(false)}
            onPlaying={() => {
              setIsPlaying(true);
              setIsBuffering(false);
            }}
            onPause={() => setIsPlaying(false)}
            onError={() => {
              setHasError(true);
              setIsBuffering(false);
            }}
            onClick={togglePlay}
          />

          {/* Buffering Spinner */}
          {isBuffering && (
            <div className="video-buffering-overlay" aria-label="جاري التحميل...">
              <div className="video-spinner" />
            </div>
          )}

          {/* Forward-Seeking Clamped Warning Badge */}
          {seekingClamped && (
            <div className="seeking-clamped-badge" role="status">
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
