import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { YouTubePlayer } from '@/features/learning-player/components/YouTubePlayer';
import type { YTPlayerOptions, YTPlayerInstance } from '@/features/learning-player/components/YouTubePlayer';
import { resetYouTubeApiLoaderForTesting } from '@/features/learning-player/utils/youtubeApiLoader';

describe('YouTubePlayer Stability & Controls Verification', () => {
  let mockPlayerInstance: {
    playVideo: ReturnType<typeof vi.fn>;
    pauseVideo: ReturnType<typeof vi.fn>;
    seekTo: ReturnType<typeof vi.fn>;
    getCurrentTime: ReturnType<typeof vi.fn>;
    getDuration: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };

  let playerConstructorSpy: ReturnType<typeof vi.fn>;
  let capturedOptions: (YTPlayerOptions & {
    events: {
      onReady?: (event: { target: YTPlayerInstance }) => void;
      onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
      onError?: (event: { data: number }) => void;
    };
  }) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    resetYouTubeApiLoaderForTesting();

    // Clean up any lingering scripts
    const existingScript = document.getElementById('youtube-iframe-api');
    if (existingScript) {
      existingScript.remove();
    }

    mockPlayerInstance = {
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      seekTo: vi.fn(),
      getCurrentTime: vi.fn().mockReturnValue(0),
      getDuration: vi.fn().mockReturnValue(100),
      destroy: vi.fn(),
    };

    playerConstructorSpy = vi.fn().mockImplementation((_element: HTMLElement, options: YTPlayerOptions) => {
      capturedOptions = options as NonNullable<typeof capturedOptions>;
      return mockPlayerInstance;
    });

    // Mock window.YT and PlayerState
    window.YT = {
      Player: playerConstructorSpy as unknown as new (element: string | HTMLElement, options: YTPlayerOptions) => YTPlayerInstance,
      PlayerState: {
        ENDED: 0,
        PLAYING: 1,
        PAUSED: 2,
        BUFFERING: 3,
        CUED: 5,
      },
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    delete (window as unknown as Record<string, unknown>).YT;
    delete (window as unknown as Record<string, unknown>).onYouTubeIframeAPIReady;
  });

  it('initializes the player with full controls parameters and 100% dimensions', async () => {
    render(
      <YouTubePlayer
        videoId="dQw4w9WgXcQ"
        itemId="ITEM_YT_01"
        title="مقدمة في أنظمة الإشارات"
        isCompleted={false}
        initialPosition={15}
        onComplete={vi.fn()}
        onLocalProgressUpdate={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(playerConstructorSpy).toHaveBeenCalledTimes(1);
    expect(capturedOptions).not.toBeNull();
    const opts = capturedOptions!;

    // Verify dimensions passed to official constructor
    expect(opts.width).toBe('100%');
    expect(opts.height).toBe('100%');
    expect(opts.videoId).toBe('dQw4w9WgXcQ');

    // Verify complete supported controls in playerVars
    const vars = opts.playerVars!;
    expect(vars.controls).toBe(1); // Standard YouTube controls exposed
    expect(vars.enablejsapi).toBe(1); // Official API communication enabled
    expect(vars.fs).toBe(1); // Fullscreen control enabled
    expect(vars.playsinline).toBe(1); // Mobile inline playback enabled
    expect(vars.disablekb).toBe(0); // Keyboard shortcuts allowed
    expect(vars.rel).toBe(0); // Restrict related videos
    expect(vars.start).toBe(15); // Started at initial position
    expect(vars.origin).toBe(window.location.origin);
  });

  it('preserves the player instance across ordinary React progress and state updates without re-initializing', async () => {
    const onComplete = vi.fn();
    const onLocalProgressUpdate = vi.fn();

    const { rerender } = render(
      <YouTubePlayer
        videoId="dQw4w9WgXcQ"
        itemId="ITEM_YT_01"
        title="مقدمة في أنظمة الإشارات"
        isCompleted={false}
        initialPosition={0}
        onComplete={onComplete}
        onLocalProgressUpdate={onLocalProgressUpdate}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(playerConstructorSpy).toHaveBeenCalledTimes(1);
    expect(mockPlayerInstance.destroy).not.toHaveBeenCalled();
    const opts = capturedOptions!;

    // Simulate playback start
    act(() => {
      opts.events.onStateChange?.({
        data: window.YT!.PlayerState.PLAYING,
        target: mockPlayerInstance,
      });
    });

    // Advance 2 seconds during active playback
    mockPlayerInstance.getCurrentTime.mockReturnValue(2);
    mockPlayerInstance.getDuration.mockReturnValue(100);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onLocalProgressUpdate).toHaveBeenCalledWith('ITEM_YT_01', {
      lastPositionSeconds: 2,
      furthestWatchedSeconds: 2,
      durationSeconds: 100,
    });

    // Parent re-renders because progress updated and passed new initialPosition + new inline onComplete
    rerender(
      <YouTubePlayer
        videoId="dQw4w9WgXcQ"
        itemId="ITEM_YT_01"
        title="مقدمة في أنظمة الإشارات"
        isCompleted={false}
        initialPosition={2} // Updated position
        onComplete={vi.fn()} // New function reference
        onLocalProgressUpdate={onLocalProgressUpdate}
      />
    );

    // CRITICAL: Player must NOT be destroyed or re-created on ordinary state updates
    expect(playerConstructorSpy).toHaveBeenCalledTimes(1);
    expect(mockPlayerInstance.destroy).not.toHaveBeenCalled();

    // Advance another 2 seconds
    mockPlayerInstance.getCurrentTime.mockReturnValue(4);
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onLocalProgressUpdate).toHaveBeenCalledWith('ITEM_YT_01', {
      lastPositionSeconds: 4,
      furthestWatchedSeconds: 4,
      durationSeconds: 100,
    });

    // Verify still zero extra constructor calls
    expect(playerConstructorSpy).toHaveBeenCalledTimes(1);
    expect(mockPlayerInstance.destroy).not.toHaveBeenCalled();
  });

  it('triggers lesson completion exactly once when reaching the 90% threshold', async () => {
    const onComplete = vi.fn();

    render(
      <YouTubePlayer
        videoId="dQw4w9WgXcQ"
        itemId="ITEM_YT_01"
        title="مقدمة في أنظمة الإشارات"
        isCompleted={false}
        initialPosition={0}
        onComplete={onComplete}
        onLocalProgressUpdate={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    const opts = capturedOptions!;

    // Start playing
    act(() => {
      opts.events.onStateChange?.({
        data: window.YT!.PlayerState.PLAYING,
        target: mockPlayerInstance,
      });
    });

    // 85% watched: should not complete
    mockPlayerInstance.getCurrentTime.mockReturnValue(85);
    mockPlayerInstance.getDuration.mockReturnValue(100);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onComplete).not.toHaveBeenCalled();

    // 90% watched: triggers completion
    mockPlayerInstance.getCurrentTime.mockReturnValue(90);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('ITEM_YT_01');

    // 95% watched: should not call onComplete a second time
    mockPlayerInstance.getCurrentTime.mockReturnValue(95);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('triggers lesson completion on ENDED playback state if not already completed', async () => {
    const onComplete = vi.fn();

    render(
      <YouTubePlayer
        videoId="dQw4w9WgXcQ"
        itemId="ITEM_YT_01"
        title="مقدمة في أنظمة الإشارات"
        isCompleted={false}
        initialPosition={0}
        onComplete={onComplete}
        onLocalProgressUpdate={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    const opts = capturedOptions!;

    act(() => {
      opts.events.onStateChange?.({
        data: window.YT!.PlayerState.ENDED,
        target: mockPlayerInstance,
      });
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('ITEM_YT_01');
  });

  it('pauses progress polling when video is paused or buffering', async () => {
    const onLocalProgressUpdate = vi.fn();

    render(
      <YouTubePlayer
        videoId="dQw4w9WgXcQ"
        itemId="ITEM_YT_01"
        title="مقدمة في أنظمة الإشارات"
        isCompleted={false}
        initialPosition={0}
        onComplete={vi.fn()}
        onLocalProgressUpdate={onLocalProgressUpdate}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    const opts = capturedOptions!;

    // Start playing
    act(() => {
      opts.events.onStateChange?.({
        data: window.YT!.PlayerState.PLAYING,
        target: mockPlayerInstance,
      });
    });

    // Pause playback
    act(() => {
      opts.events.onStateChange?.({
        data: window.YT!.PlayerState.PAUSED,
        target: mockPlayerInstance,
      });
    });

    // Advance time while paused
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    // No progress updates while paused
    expect(onLocalProgressUpdate).not.toHaveBeenCalled();
  });

  it('cleans up resources and player instance when navigating away or unmounting', async () => {
    const { unmount } = render(
      <YouTubePlayer
        videoId="dQw4w9WgXcQ"
        itemId="ITEM_YT_01"
        title="مقدمة في أنظمة الإشارات"
        isCompleted={false}
        initialPosition={0}
        onComplete={vi.fn()}
        onLocalProgressUpdate={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(mockPlayerInstance.destroy).toHaveBeenCalledTimes(1);
  });

  it('gracefully handles blocked embedding and presents a friendly Arabic alert with external link', async () => {
    render(
      <YouTubePlayer
        videoId="BLOCKED_ID"
        itemId="ITEM_YT_01"
        title="فيديو محظور التضمين"
        isCompleted={false}
        initialPosition={0}
        onComplete={vi.fn()}
        onLocalProgressUpdate={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    const opts = capturedOptions!;

    // Simulate YouTube error 150 (not allowed to be embedded)
    act(() => {
      opts.events.onError?.({ data: 150 });
    });

    expect(screen.getByTestId('youtube-error-state')).toBeInTheDocument();
    expect(
      screen.getByText(/صاحب هذا الفيديو قام بحظر تشغيله خارج موقع YouTube/)
    ).toBeInTheDocument();

    const externalLink = screen.getByTestId('open-youtube-external-link');
    expect(externalLink).toHaveAttribute(
      'href',
      'https://www.youtube.com/watch?v=BLOCKED_ID'
    );
    expect(externalLink).toHaveAttribute('target', '_blank');
  });

  it('gracefully handles deleted or unavailable videos', async () => {
    render(
      <YouTubePlayer
        videoId="NOT_FOUND_ID"
        itemId="ITEM_YT_01"
        title="فيديو غير موجود"
        isCompleted={false}
        initialPosition={0}
        onComplete={vi.fn()}
        onLocalProgressUpdate={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    const opts = capturedOptions!;

    // Simulate YouTube error 100 (video removed or not found)
    act(() => {
      opts.events.onError?.({ data: 100 });
    });

    expect(screen.getByTestId('youtube-error-state')).toBeInTheDocument();
    expect(
      screen.getByText(/عذراً، تعذر العثور على هذا الفيديو أو تم حذفه/)
    ).toBeInTheDocument();
  });

  it('binds official YT.Player to a pre-created sandboxed iframe with picture-in-picture omitted', async () => {
    render(
      <YouTubePlayer
        videoId="dQw4w9WgXcQ"
        itemId="ITEM_YT_01"
        title="مقدمة في أنظمة الإشارات"
        isCompleted={false}
        initialPosition={0}
        onComplete={vi.fn()}
        onLocalProgressUpdate={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(playerConstructorSpy).toHaveBeenCalledTimes(1);
    const passedElement = playerConstructorSpy.mock.calls[0][0] as HTMLElement;

    // Verify it is an HTMLIFrameElement with sandbox and permissions already applied before navigation
    expect(passedElement.tagName).toBe('IFRAME');
    expect(passedElement.getAttribute('sandbox')).toBe(
      'allow-scripts allow-same-origin allow-presentation allow-forms'
    );
    expect(passedElement.getAttribute('sandbox')).not.toContain('allow-popups');
    expect(passedElement.getAttribute('sandbox')).not.toContain('allow-top-navigation');

    // Permissions policy strictly omits picture-in-picture
    const allowAttr = passedElement.getAttribute('allow') || '';
    expect(allowAttr).not.toContain('picture-in-picture');
    expect(allowAttr).toContain('autoplay');
    expect(allowAttr).toContain('encrypted-media');
    expect(allowAttr).toContain('accelerometer');
    expect(passedElement).toHaveAttribute('allowfullscreen');
  });
});
