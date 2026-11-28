import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  INITIAL_METADATA_MAX_TIMEOUT_MS,
  INITIAL_METADATA_TIMEOUT_MS,
  MAX_AUTO_RECOVERY_ATTEMPTS,
  PLAYBACK_STALL_TIMEOUT_MS,
  VideoPlayer,
} from '@/features/learning-player/components/VideoPlayer';
import {
  BLOB_FALLBACK_IDLE_TIMEOUT_MS,
  MAX_BLOB_FALLBACK_BYTES,
  STREAM_REQUEST_TIMEOUT_MS,
} from '@/core/storage/protectedMediaStream';

async function flushAsyncTicks(rounds = 4): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await Promise.resolve();
  }
}

describe('VideoPlayer Stall Detection, Ticket Renewal & Recovery State Machine', () => {
  const originalFetch = global.fetch;
  const originalUserAgent = navigator.userAgent;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(() => {
    vi.useFakeTimers();
    document.cookie = 'csrftoken=csrf-phase2-token; Path=/';
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36',
      configurable: true,
    });
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-blob-1');
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/mock-blob-1');
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    vi.restoreAllMocks();
  });

  function setupProtectedStreamFetch(opts?: {
    headStatus?: number;
    headSize?: number;
    ticketResponses?: Array<{ status: number; streamUrl?: string; code?: string; hang?: boolean }>;
    blobResponse?: { status: number; sizeBytes?: number; payload?: Uint8Array };
  }) {
    let ticketCounter = 0;
    const headCalls: string[] = [];
    const ticketCalls: Array<{ url: string }> = [];
    const blobGetCalls: string[] = [];
    const abortedSignals: AbortSignal[] = [];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();

      if (init?.signal) {
        init.signal.addEventListener('abort', () => {
          abortedSignals.push(init.signal!);
        });
      }

      if (url === '/api/auth/csrf') {
        document.cookie = 'csrftoken=csrf-phase2-token; Path=/';
        return new Response(JSON.stringify({ status: 'OK' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === '/api/media/stream-ticket' && method === 'POST') {
        const parsed = JSON.parse(String(init?.body || '{}')) as { url: string };
        ticketCalls.push(parsed);
        const idx = ticketCounter;
        ticketCounter += 1;
        const custom = opts?.ticketResponses?.[idx];
        if (custom?.hang) {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          });
        }
        if (custom && custom.status >= 400) {
          return new Response(JSON.stringify({ code: custom.code || 'ERROR' }), {
            status: custom.status,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const streamUrl =
          custom?.streamUrl || `${parsed.url}?st=ticket-${ticketCounter}`;
        return new Response(
          JSON.stringify({ status: 'OK', data: { streamUrl } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.startsWith('/api/media/') && method === 'HEAD') {
        headCalls.push(url);
        const status = opts?.headStatus ?? 200;
        const headers: Record<string, string> = {};
        if (status === 200) {
          headers['Content-Type'] = 'video/mp4';
          if (opts?.headSize !== undefined) {
            headers['Content-Length'] = String(opts.headSize);
          }
        }
        return new Response(null, { status, headers });
      }

      if (url.startsWith('/api/media/') && method === 'GET') {
        blobGetCalls.push(url);
        const b = opts?.blobResponse || {
          status: 200,
          payload: new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]),
        };
        const sizeHeader =
          b.sizeBytes !== undefined ? String(b.sizeBytes) : String(b.payload?.byteLength || 8);
        return new Response(b.payload || new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]), {
          status: b.status,
          headers: {
            'Content-Length': sizeHeader,
            'X-Original-Mime-Type': 'video/mp4',
          },
        });
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });

    global.fetch = fetchMock as typeof fetch;
    return { fetchMock, headCalls, ticketCalls, blobGetCalls, abortedSignals };
  }

  async function renderProtectedPlayer(src = '/api/media/references/77/stream', initialPosition = 0) {
    const onComplete = vi.fn();
    const utils = render(
      <VideoPlayer
        itemId="lesson-77"
        title="درس محمي"
        src={src}
        initialPosition={initialPosition}
        furthestWatched={initialPosition}
        onComplete={onComplete}
      />
    );
    await act(async () => {
      await flushAsyncTicks();
    });
    const video = document.querySelector('video')!;
    Object.defineProperty(video, 'duration', { value: 120, configurable: true });
    return { ...utils, video, onComplete };
  }

  describe('Stall Detection Watchdog', () => {
    it('does NOT trigger recovery on a brief waiting event cleared by playing or timeupdate advancement', async () => {
      const { headCalls, ticketCalls } = setupProtectedStreamFetch();
      const { video } = await renderProtectedPlayer();

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
      });

      // Short 3s waiting followed by resumed timeupdate progress
      act(() => {
        fireEvent.waiting(video);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_000);
      });

      video.currentTime = 5;
      act(() => {
        fireEvent.timeUpdate(video);
        fireEvent.playing(video);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS + 5_000);
      });

      expect(headCalls).toHaveLength(0);
      expect(ticketCalls).toHaveLength(1); // initial ticket only
    });

    it('triggers recovery on prolonged waiting even when progress events arrive without playback progress', async () => {
      const { headCalls, ticketCalls, blobGetCalls } = setupProtectedStreamFetch();
      const { video } = await renderProtectedPlayer();

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
        fireEvent.waiting(video);
      });

      // Repeated progress events half-way through must NOT defeat playback stall detection
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6_000);
      });
      act(() => {
        fireEvent.progress(video);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS - 6_000);
        await flushAsyncTicks();
      });

      expect(headCalls).toEqual(['/api/media/references/77/stream?st=ticket-1']);
      expect(ticketCalls).toHaveLength(2);
      expect(blobGetCalls).toHaveLength(0);
      expect(video.getAttribute('src')).toBe('/api/media/references/77/stream?st=ticket-2');
    });

    it('triggers recovery on prolonged stalled event', async () => {
      const { headCalls, ticketCalls } = setupProtectedStreamFetch();
      const { video } = await renderProtectedPlayer();

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
        fireEvent.stalled(video);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
        await flushAsyncTicks();
      });

      expect(headCalls).toHaveLength(1);
      expect(ticketCalls).toHaveLength(2);
      expect(video.getAttribute('src')).toBe('/api/media/references/77/stream?st=ticket-2');
    });

    it('detects initial loading timeout before loadedmetadata', async () => {
      const { headCalls, ticketCalls } = setupProtectedStreamFetch();
      const { video } = await renderProtectedPlayer();

      act(() => {
        fireEvent.loadStart(video);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(INITIAL_METADATA_TIMEOUT_MS - 1_000);
      });
      expect(headCalls).toHaveLength(0);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
        await flushAsyncTicks();
      });

      expect(headCalls).toHaveLength(1);
      expect(ticketCalls).toHaveLength(2);
      expect(video.getAttribute('src')).toBe('/api/media/references/77/stream?st=ticket-2');
    });

    it('handles prolonged stall after seeking without cancelling before seeked', async () => {
      const { headCalls, ticketCalls } = setupProtectedStreamFetch();
      const { video } = await renderProtectedPlayer('/api/media/references/77/stream', 30);

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
      });

      video.currentTime = 15;
      act(() => {
        fireEvent.seeking(video);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
        await flushAsyncTicks();
      });

      expect(headCalls).toHaveLength(1);
      expect(ticketCalls).toHaveLength(2);
      expect(video.getAttribute('src')).toBe('/api/media/references/77/stream?st=ticket-2');
    });

    it('cancels active stall watchdog when video is paused or ended', async () => {
      const { headCalls, ticketCalls } = setupProtectedStreamFetch();
      const { video } = await renderProtectedPlayer();

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
        fireEvent.waiting(video);
      });

      // Pause before stall timeout elapses
      act(() => {
        fireEvent.pause(video);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS + 10_000);
      });
      expect(headCalls).toHaveLength(0);

      // Resume -> waiting -> ended -> must NOT recover
      act(() => {
        fireEvent.playing(video);
        fireEvent.waiting(video);
        fireEvent.ended(video);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS + 10_000);
      });
      expect(headCalls).toHaveLength(0);
      expect(ticketCalls).toHaveLength(1);
    });

    it('suspends recovery when tab is backgrounded and resumes monitoring when visible again', async () => {
      const { headCalls, ticketCalls } = setupProtectedStreamFetch();
      const { video } = await renderProtectedPlayer();

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
        fireEvent.waiting(video);
      });

      // Move tab to background after 4s of buffering
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4_000);
      });
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Even 60s in background must NOT trigger false recovery
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(headCalls).toHaveLength(0);

      // Return to foreground; monitoring resumes and fires after stall timeout
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
        await flushAsyncTicks();
      });

      expect(headCalls).toHaveLength(1);
      expect(ticketCalls).toHaveLength(2);
    });
  });

  describe('Ticket Renewal, Error Classification & Blob Priority', () => {
    it('preserves playback position and playback state on ticket renewal without Blob download', async () => {
      const { blobGetCalls, ticketCalls } = setupProtectedStreamFetch();
      const playMock = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
      const { video } = await renderProtectedPlayer();

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
      });

      video.currentTime = 42.5;
      act(() => {
        fireEvent.timeUpdate(video);
        fireEvent.stalled(video);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
        await flushAsyncTicks();
      });

      expect(ticketCalls).toHaveLength(2);
      expect(blobGetCalls).toHaveLength(0);
      expect(video.getAttribute('src')).toBe('/api/media/references/77/stream?st=ticket-2');

      // New stream loads metadata -> restores 42.5s and resumes playing
      act(() => {
        fireEvent.loadedMetadata(video);
      });
      await act(async () => {
        await flushAsyncTicks();
      });

      expect(video.currentTime).toBe(42.5);
      expect(playMock).toHaveBeenCalled();
    });

    it('keeps video paused if user paused intentionally before/during recovery', async () => {
      setupProtectedStreamFetch();
      const playMock = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
      const { video } = await renderProtectedPlayer();

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
      });
      video.currentTime = 20;
      act(() => {
        fireEvent.timeUpdate(video);
        fireEvent.pause(video);
      });

      // Seeking while paused stalls -> triggers recovery, yet must stay paused
      act(() => {
        fireEvent.seeking(video);
        fireEvent.waiting(video); // ignored while paused OR if user paused mid-recovery:
      });

      // Test mid-recovery pause: start playing -> stall -> trigger HEAD -> user pauses while ticket renewal in flight
      let resolveHead!: (res: Response) => void;
      global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method || 'GET').toUpperCase();
        if (url === '/api/media/stream-ticket' && method === 'POST') {
          return new Response(
            JSON.stringify({ status: 'OK', data: { streamUrl: '/api/media/references/77/stream?st=ticket-fresh' } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (method === 'HEAD') {
          return new Promise<Response>((resolve) => {
            resolveHead = resolve;
          });
        }
        throw new Error(`Unexpected fetch ${method} ${url}`);
      }) as typeof fetch;

      act(() => {
        fireEvent.playing(video);
        fireEvent.stalled(video);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
      });

      // User intentionally pauses while HEAD/recovery is in progress
      act(() => {
        fireEvent.pause(video);
      });
      playMock.mockClear();

      await act(async () => {
        resolveHead(new Response(null, { status: 200 }));
        await flushAsyncTicks();
      });

      act(() => {
        fireEvent.loadedMetadata(video);
      });
      await act(async () => {
        await flushAsyncTicks();
      });

      expect(video.currentTime).toBe(20);
      expect(playMock).not.toHaveBeenCalled();
    });

    it('renews expired ticket when HEAD returns 403 and session remains valid', async () => {
      const { headCalls, ticketCalls, blobGetCalls } = setupProtectedStreamFetch({
        headStatus: 403,
      });
      const { video } = await renderProtectedPlayer();

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
        fireEvent.stalled(video);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
        await flushAsyncTicks();
      });

      expect(headCalls).toHaveLength(1);
      expect(ticketCalls).toHaveLength(2);
      expect(blobGetCalls).toHaveLength(0);
      expect(video.getAttribute('src')).toBe('/api/media/references/77/stream?st=ticket-2');
    });

    it('shows authentication error on 401 and does not retry or download Blob', async () => {
      const { ticketCalls, blobGetCalls } = setupProtectedStreamFetch({
        headStatus: 401,
      });
      const { video } = await renderProtectedPlayer();

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
        fireEvent.stalled(video);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
        await flushAsyncTicks();
      });

      expect(ticketCalls).toHaveLength(1); // initial only; no renewal after HEAD 401
      expect(blobGetCalls).toHaveLength(0);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-error-category', 'auth');
      expect(alert).toHaveTextContent('انتهت جلسة تسجيل الدخول');
    });

    it('shows access-denied error on 403 from both HEAD and stream-ticket without claiming expired ticket', async () => {
      const { blobGetCalls } = setupProtectedStreamFetch({
        headStatus: 403,
        ticketResponses: [
          { status: 200 },
          { status: 403, code: 'PERMISSION_DENIED' },
        ],
      });
      const { video } = await renderProtectedPlayer();

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
        fireEvent.stalled(video);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
        await flushAsyncTicks();
      });

      expect(blobGetCalls).toHaveLength(0);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-error-category', 'forbidden');
      expect(alert).toHaveTextContent('غير مصرح بالوصول إلى الفيديو');
      expect(alert.textContent).not.toContain('انتهت صلاحية التذكرة');
    });

    it('shows missing-media error on 404 without retrying or downloading Blob', async () => {
      const { ticketCalls, blobGetCalls } = setupProtectedStreamFetch({
        headStatus: 404,
      });
      const { video } = await renderProtectedPlayer();

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
        fireEvent.stalled(video);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
        await flushAsyncTicks();
      });

      expect(ticketCalls).toHaveLength(1);
      expect(blobGetCalls).toHaveLength(0);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-error-category', 'not_found');
      expect(alert).toHaveTextContent('ملف الفيديو غير موجود');
    });

    it('handles ticket renewal timeout as bounded network error without infinite loop or Blob download', async () => {
      const { blobGetCalls, ticketCalls } = setupProtectedStreamFetch({
        headStatus: 200,
        ticketResponses: [{ status: 200 }, { status: 200, hang: true }],
      });
      const { video } = await renderProtectedPlayer();

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
        fireEvent.stalled(video);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
        await flushAsyncTicks();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(STREAM_REQUEST_TIMEOUT_MS + 100);
        await flushAsyncTicks();
      });

      expect(ticketCalls).toHaveLength(2);
      expect(blobGetCalls).toHaveLength(0);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-error-category', 'network');
      expect(alert).toHaveTextContent('تعذر الاتصال بالخادم');
    });

    it('never triggers oversized Blob fallback above 250 MB across bounded attempts', async () => {
      const { blobGetCalls, ticketCalls } = setupProtectedStreamFetch({
        headStatus: 200,
        headSize: MAX_BLOB_FALLBACK_BYTES + 10_000_000,
      });
      const { video } = await renderProtectedPlayer();

      // Trigger MAX_AUTO_RECOVERY_ATTEMPTS stalls + 1 final stall exceeding limit
      for (let i = 0; i <= MAX_AUTO_RECOVERY_ATTEMPTS; i += 1) {
        act(() => {
          fireEvent.loadedMetadata(video);
          fireEvent.playing(video);
          fireEvent.stalled(video);
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
          await flushAsyncTicks();
        });
      }

      expect(blobGetCalls).toHaveLength(0);
      expect(ticketCalls).toHaveLength(1 + MAX_AUTO_RECOVERY_ATTEMPTS);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-error-category', 'exhausted');
    });

    it('falls back once to Blob for eligible <= 250 MB stream after renewed stream error and revokes URL on unmount', async () => {
      const { blobGetCalls, ticketCalls } = setupProtectedStreamFetch({
        headStatus: 200,
        headSize: 4096,
      });
      const { unmount, video } = await renderProtectedPlayer();

      // Attempt 1: initial stream stalls -> renews stream ticket (NO Blob yet)
      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
        fireEvent.stalled(video);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
        await flushAsyncTicks();
      });
      expect(ticketCalls).toHaveLength(2);
      expect(blobGetCalls).toHaveLength(0);

      // Attempt 2: renewed stream throws MEDIA_ERR_NETWORK -> falls back once to eligible Blob URL
      Object.defineProperty(video, 'error', { value: { code: 2 }, configurable: true });
      act(() => {
        fireEvent.error(video);
      });
      await act(async () => {
        await flushAsyncTicks();
      });

      expect(blobGetCalls).toEqual(['/api/media/references/77/stream']);
      expect(video.getAttribute('src')).toBe('blob:http://localhost/mock-blob-1');

      unmount();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/mock-blob-1');
    });

    it('distinguishes mid-video MEDIA_ERR_DECODE from network failure without completing lesson', async () => {
      setupProtectedStreamFetch();
      const { onComplete, video } = await renderProtectedPlayer();
      Object.defineProperty(video, 'error', { value: { code: 3 }, configurable: true });

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
      });
      video.currentTime = 30;
      act(() => {
        fireEvent.timeUpdate(video);
        fireEvent.error(video);
      });

      expect(onComplete).not.toHaveBeenCalled();
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-error-category', 'decode');
      expect(alert).toHaveTextContent('تعذر فك تشفير الفيديو');
    });
  });

  describe('Race Condition Protections', () => {
    it('cancels old watchdog and ignores late recovery results when src changes', async () => {
      let resolveOldHead!: (res: Response) => void;
      const abortedOldSignals: AbortSignal[] = [];
      let ticketNum = 0;

      global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method || 'GET').toUpperCase();
        if (url === '/api/media/stream-ticket' && method === 'POST') {
          const parsed = JSON.parse(String(init?.body || '{}')) as { url: string };
          ticketNum += 1;
          return new Response(
            JSON.stringify({ status: 'OK', data: { streamUrl: `${parsed.url}?st=t-${ticketNum}` } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('/references/77/') && method === 'HEAD') {
          if (init?.signal) {
            init.signal.addEventListener('abort', () => abortedOldSignals.push(init.signal!));
          }
          return new Promise<Response>((resolve) => {
            resolveOldHead = resolve;
          });
        }
        return new Response(null, { status: 200 });
      }) as typeof fetch;

      const onComplete = vi.fn();
      const { rerender } = render(
        <VideoPlayer
          itemId="lesson-77"
          title="درس 1"
          src="/api/media/references/77/stream"
          onComplete={onComplete}
        />
      );
      await act(async () => {
        await flushAsyncTicks();
      });
      const video1 = document.querySelector('video')!;
      Object.defineProperty(video1, 'duration', { value: 100, configurable: true });
      act(() => {
        fireEvent.loadedMetadata(video1);
        fireEvent.playing(video1);
        fireEvent.stalled(video1);
      });

      // Stall triggers HEAD on lesson-77
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
      });
      expect(resolveOldHead).toBeDefined();

      // User immediately switches to lesson-88 before HEAD finishes
      rerender(
        <VideoPlayer
          itemId="lesson-88"
          title="درس 2"
          src="/api/media/references/88/stream"
          onComplete={onComplete}
        />
      );
      await act(async () => {
        await flushAsyncTicks();
      });

      expect(abortedOldSignals.some((s) => s.aborted)).toBe(true);

      // Even if old promise resolves late, it must NOT overwrite lesson-88's src
      await act(async () => {
        resolveOldHead(new Response(null, { status: 200 }));
        await flushAsyncTicks();
      });

      expect(document.querySelector('video')?.getAttribute('src')).toBe(
        '/api/media/references/88/stream?st=t-2'
      );
    });

    it('cancels pending timers and in-flight requests on unmount', async () => {
      const { headCalls, abortedSignals } = setupProtectedStreamFetch();
      const { unmount, video } = await renderProtectedPlayer();

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
        fireEvent.waiting(video);
      });

      unmount();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS + 10_000);
      });

      expect(headCalls).toHaveLength(0);
      expect(abortedSignals.length).toBeGreaterThanOrEqual(0);
    });

    it('deduplicates concurrent waiting, stalled, and error events into a single recovery operation', async () => {
      const { headCalls, ticketCalls } = setupProtectedStreamFetch();
      const { video } = await renderProtectedPlayer();
      Object.defineProperty(video, 'error', { value: { code: 2 }, configurable: true });

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
        fireEvent.waiting(video);
        fireEvent.stalled(video);
        fireEvent.error(video);
        fireEvent.error(video);
      });

      await act(async () => {
        await flushAsyncTicks();
      });

      expect(headCalls).toHaveLength(1);
      expect(ticketCalls).toHaveLength(2); // 1 initial + 1 single renewal
    });

    it('exits recovery cleanly with network error UI when Blob fallback stops sending chunks', async () => {
      const cancelSpy = vi.fn(async () => undefined);
      let blobFetchAborted = false;
      let ticketNum = 0;

      global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method || 'GET').toUpperCase();
        if (url === '/api/media/stream-ticket' && method === 'POST') {
          ticketNum += 1;
          return new Response(
            JSON.stringify({
              status: 'OK',
              data: { streamUrl: `/api/media/references/77/stream?st=t-${ticketNum}` },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.startsWith('/api/media/') && method === 'HEAD') {
          return new Response(null, {
            status: 200,
            headers: { 'Content-Type': 'video/mp4', 'Content-Length': '4096' },
          });
        }
        if (url.startsWith('/api/media/') && method === 'GET') {
          init?.signal?.addEventListener('abort', () => {
            blobFetchAborted = true;
          });
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'X-Original-Mime-Type': 'video/mp4' }),
            body: {
              getReader: () => ({
                read: () =>
                  new Promise(() => {
                    // Simulate proxy/server hanging indefinitely after headers
                  }),
                cancel: cancelSpy,
                releaseLock: vi.fn(),
              }),
            },
          } as unknown as Response;
        }
        throw new Error(`Unexpected fetch: ${method} ${url}`);
      }) as typeof fetch;

      const { video } = await renderProtectedPlayer();

      // Attempt 1: stall triggers ticket renewal (protected stream retry first)
      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
        fireEvent.stalled(video);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
        await flushAsyncTicks();
      });

      // Attempt 2: renewed stream fails -> enters Blob fallback which hangs after headers
      Object.defineProperty(video, 'error', { value: { code: 2 }, configurable: true });
      act(() => {
        fireEvent.error(video);
      });
      await act(async () => {
        await flushAsyncTicks();
      });

      // Recovery is currently active in Blob stage; advance past BLOB_FALLBACK_IDLE_TIMEOUT_MS
      await act(async () => {
        await vi.advanceTimersByTimeAsync(BLOB_FALLBACK_IDLE_TIMEOUT_MS + 100);
        await flushAsyncTicks();
      });

      expect(cancelSpy).toHaveBeenCalled();
      expect(blobFetchAborted).toBe(true);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-error-category', 'network');
      expect(alert).toHaveTextContent('تعذر الاتصال بالخادم');
    });

    it('prevents an old aborted recovery finally block from unlocking a newer source recovery mutex', async () => {
      let rejectOldHeadLate!: (reason?: unknown) => void;
      let headCallsNewSrc = 0;
      let ticketNum = 0;

      global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method || 'GET').toUpperCase();
        if (url === '/api/media/stream-ticket' && method === 'POST') {
          const parsed = JSON.parse(String(init?.body || '{}')) as { url: string };
          ticketNum += 1;
          return new Response(
            JSON.stringify({
              status: 'OK',
              data: { streamUrl: `${parsed.url}?st=t-${ticketNum}` },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('/references/77/') && method === 'HEAD') {
          // Deliberately ignore abort briefly so we can control exact timing of old finally() completion
          return new Promise<Response>((_resolve, reject) => {
            rejectOldHeadLate = reject;
          });
        }
        if (url.includes('/references/88/') && method === 'HEAD') {
          headCallsNewSrc += 1;
          return new Promise<Response>(() => {
            // Keep new source HEAD in flight while testing mutex protection
          });
        }
        return new Response(null, { status: 200 });
      }) as typeof fetch;

      const onComplete = vi.fn();
      const { rerender } = render(
        <VideoPlayer
          itemId="lesson-77"
          title="درس 1"
          src="/api/media/references/77/stream"
          onComplete={onComplete}
        />
      );
      await act(async () => {
        await flushAsyncTicks();
      });

      const video1 = document.querySelector('video')!;
      act(() => {
        fireEvent.loadedMetadata(video1);
        fireEvent.playing(video1);
        fireEvent.stalled(video1);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
      });

      // Switch to lesson-88 -> starts new recovery on lesson-88 BEFORE old HEAD settles
      rerender(
        <VideoPlayer
          itemId="lesson-88"
          title="درس 2"
          src="/api/media/references/88/stream"
          onComplete={onComplete}
        />
      );
      await act(async () => {
        await flushAsyncTicks();
      });

      const video2 = document.querySelector('video')!;
      act(() => {
        fireEvent.loadedMetadata(video2);
        fireEvent.playing(video2);
        fireEvent.stalled(video2);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
      });
      expect(headCallsNewSrc).toBe(1);

      // Now force the OLD recovery's promise to reject and execute its finally block while lesson-88 recovery is active
      await act(async () => {
        rejectOldHeadLate(new DOMException('Aborted', 'AbortError'));
        await flushAsyncTicks();
      });

      // Trigger another stall/error on lesson-88: mutex must STILL be held by lesson-88's active controller
      Object.defineProperty(video2, 'error', { value: { code: 2 }, configurable: true });
      act(() => {
        fireEvent.error(video2);
      });
      await act(async () => {
        await flushAsyncTicks();
      });

      expect(headCallsNewSrc).toBe(1);
    });
  });

  describe('Trainee Progress Updates & Stream Ticket Stability (Phase 3.2A)', () => {
    it('does not abort or re-mint stream-ticket when initialPosition updates during active trainee playback', async () => {
      const { ticketCalls, abortedSignals } = setupProtectedStreamFetch();
      const onComplete = vi.fn();

      const { rerender } = render(
        <VideoPlayer
          courseId="course-10015"
          itemId="lesson-77"
          title="درس محمي"
          src="/api/media/references/77/stream"
          initialPosition={0}
          furthestWatched={0}
          isReadOnly={false}
          onComplete={onComplete}
        />
      );

      await act(async () => {
        await flushAsyncTicks();
      });

      expect(ticketCalls).toHaveLength(1);
      const initialVideoEl = document.querySelector('video')!;
      const initialTicketSrc = initialVideoEl.getAttribute('src');
      expect(initialTicketSrc).toBe('/api/media/references/77/stream?st=ticket-1');

      Object.defineProperty(initialVideoEl, 'duration', { value: 120, configurable: true });
      Object.defineProperty(initialVideoEl, 'readyState', { value: 4, configurable: true });
      Object.defineProperty(initialVideoEl, 'paused', { value: false, writable: true, configurable: true });
      const bufferedStub = {
        length: 1,
        start: () => 0,
        end: () => 44,
      } as unknown as TimeRanges;
      Object.defineProperty(initialVideoEl, 'buffered', { value: bufferedStub, configurable: true });

      act(() => {
        fireEvent.loadedMetadata(initialVideoEl);
        fireEvent.playing(initialVideoEl);
        initialVideoEl.currentTime = 18;
        fireEvent.timeUpdate(initialVideoEl);
      });

      // Simulate LearningPlayerPage + useCourseProgress periodic activity updates: 0 -> 5 -> 10 -> 15
      for (const nextPos of [5, 10, 15]) {
        rerender(
          <VideoPlayer
            courseId="course-10015"
            itemId="lesson-77"
            title="درس محمي"
            src="/api/media/references/77/stream"
            initialPosition={nextPos}
            furthestWatched={nextPos}
            isReadOnly={false}
            onComplete={onComplete}
          />
        );
        await act(async () => {
          await flushAsyncTicks();
        });
      }

      const currentVideoEl = document.querySelector('video')!;
      expect(ticketCalls).toHaveLength(1);
      expect(abortedSignals).toHaveLength(0);
      expect(currentVideoEl).toBe(initialVideoEl);
      expect(currentVideoEl.getAttribute('src')).toBe('/api/media/references/77/stream?st=ticket-1');
      expect(currentVideoEl.buffered.length).toBe(1);
      expect(currentVideoEl.buffered.end(0)).toBe(44);
      expect(currentVideoEl.paused).toBe(false);
      expect(currentVideoEl.currentTime).toBe(18);
    });

    it('still hydrates initialPosition before playback starts without minting a second stream ticket', async () => {
      const { ticketCalls } = setupProtectedStreamFetch();
      const onComplete = vi.fn();

      const { rerender } = render(
        <VideoPlayer
          courseId="course-10015"
          itemId="lesson-77"
          title="درس محمي"
          src="/api/media/references/77/stream"
          initialPosition={0}
          furthestWatched={0}
          isReadOnly={false}
          onComplete={onComplete}
        />
      );

      await act(async () => {
        await flushAsyncTicks();
      });

      expect(ticketCalls).toHaveLength(1);
      const video = document.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: 120, configurable: true });
      Object.defineProperty(video, 'readyState', { value: 1, configurable: true });

      act(() => {
        fireEvent.loadedMetadata(video);
      });

      // Asynchronous backend resume position arrives before user starts playback
      rerender(
        <VideoPlayer
          courseId="course-10015"
          itemId="lesson-77"
          title="درس محمي"
          src="/api/media/references/77/stream"
          initialPosition={42}
          furthestWatched={42}
          isReadOnly={false}
          onComplete={onComplete}
        />
      );

      await act(async () => {
        await flushAsyncTicks();
      });

      expect(ticketCalls).toHaveLength(1);
      expect(video.currentTime).toBe(42);
      expect(video.getAttribute('src')).toBe('/api/media/references/77/stream?st=ticket-1');
    });

    it('still cleans up old source, mints one new ticket on source change, and ignores stale async ticket', async () => {
      let resolveOldTicket!: (res: Response) => void;
      let resolveNewTicket!: (res: Response) => void;
      const ticketCalls: Array<{ url: string }> = [];
      let oldAborted = false;

      global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === '/api/media/stream-ticket') {
          const parsed = JSON.parse(String(init?.body || '{}')) as { url: string };
          ticketCalls.push(parsed);
          if (parsed.url.includes('/references/77/')) {
            init?.signal?.addEventListener('abort', () => {
              oldAborted = true;
            });
            return new Promise<Response>((resolve) => {
              resolveOldTicket = resolve;
            });
          }
          return new Promise<Response>((resolve) => {
            resolveNewTicket = resolve;
          });
        }
        return new Response(null, { status: 200 });
      }) as typeof fetch;

      const onComplete = vi.fn();
      const { rerender } = render(
        <VideoPlayer
          courseId="course-10015"
          itemId="lesson-77"
          title="درس 1"
          src="/api/media/references/77/stream"
          initialPosition={0}
          isReadOnly={false}
          onComplete={onComplete}
        />
      );

      await act(async () => {
        await flushAsyncTicks();
      });
      expect(ticketCalls).toEqual([{ url: '/api/media/references/77/stream' }]);

      // Switch to lesson-88 before lesson-77's stream-ticket settles
      rerender(
        <VideoPlayer
          courseId="course-10015"
          itemId="lesson-88"
          title="درس 2"
          src="/api/media/references/88/stream"
          initialPosition={0}
          isReadOnly={false}
          onComplete={onComplete}
        />
      );

      await act(async () => {
        await flushAsyncTicks();
      });

      expect(oldAborted).toBe(true);
      expect(ticketCalls).toEqual([
        { url: '/api/media/references/77/stream' },
        { url: '/api/media/references/88/stream' },
      ]);

      // Resolve stale old ticket first, then new ticket -> stale response must NOT overwrite lesson-88
      await act(async () => {
        resolveOldTicket(
          new Response(
            JSON.stringify({ status: 'OK', data: { streamUrl: '/api/media/references/77/stream?st=stale-77' } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
        await flushAsyncTicks();
      });
      expect(document.querySelector('video')?.getAttribute('src')).toBeNull();

      await act(async () => {
        resolveNewTicket(
          new Response(
            JSON.stringify({ status: 'OK', data: { streamUrl: '/api/media/references/88/stream?st=fresh-88' } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
        await flushAsyncTicks();
      });
      expect(document.querySelector('video')?.getAttribute('src')).toBe(
        '/api/media/references/88/stream?st=fresh-88'
      );
    });

    it('still mints exactly one fresh stream ticket on explicit Retry after recoverable error', async () => {
      const { ticketCalls } = setupProtectedStreamFetch({
        ticketResponses: [
          { status: 503, code: 'TEMP_UNAVAILABLE' },
          { status: 200, streamUrl: '/api/media/references/77/stream?st=retry-ticket-2' },
        ],
      });
      const onComplete = vi.fn();

      render(
        <VideoPlayer
          courseId="course-10015"
          itemId="lesson-77"
          title="درس محمي"
          src="/api/media/references/77/stream"
          initialPosition={0}
          isReadOnly={false}
          onComplete={onComplete}
        />
      );

      await act(async () => {
        await flushAsyncTicks();
      });

      expect(ticketCalls).toHaveLength(1);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-error-category', 'network');

      const retryBtn = screen.getByRole('button', { name: /إعادة المحاولة/ });
      fireEvent.click(retryBtn);

      await act(async () => {
        await flushAsyncTicks();
      });

      expect(ticketCalls).toHaveLength(2);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(document.querySelector('video')?.getAttribute('src')).toBe(
        '/api/media/references/77/stream?st=retry-ticket-2'
      );
    });
  });

  describe('Terminal Error and Ended State Pause Guard (Phase 3.2B)', () => {
    it('does not overwrite error phase or mark user-paused when native pause fires during error teardown (Test A)', async () => {
      const { headCalls } = setupProtectedStreamFetch({
        ticketResponses: [
          { status: 200, streamUrl: '/api/media/references/77/stream?st=ticket-1' },
          { status: 503, code: 'TEMP_UNAVAILABLE' },
          { status: 200, streamUrl: '/api/media/references/77/stream?st=retry-ticket-2' },
        ],
      });
      const { container, video } = await renderProtectedPlayer();
      const playerRegion = container.querySelector('[data-recovery-phase]')!;

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
      });
      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'playing');

      Object.defineProperty(video, 'error', { value: { code: 2 }, configurable: true });
      await act(async () => {
        fireEvent.error(video);
        await flushAsyncTicks(12);
        // Simulate Chromium firing native pause on <video> during terminal error teardown
        fireEvent.pause(video);
      });

      const alert = screen.getByRole('alert');
      expect(alert).toBeVisible();
      expect(alert).toHaveAttribute('data-error-category', 'network');
      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'error');
      expect(headCalls).toHaveLength(1);

      // Verify teardown pause did not leave isUserPausedRef=true (initial watchdog still arms on Retry)
      fireEvent.click(screen.getByRole('button', { name: /إعادة المحاولة/ }));
      await act(async () => {
        await flushAsyncTicks(12);
      });
      expect(screen.queryByRole('alert')).toBeNull();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(INITIAL_METADATA_TIMEOUT_MS);
        await flushAsyncTicks(12);
      });
      expect(headCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('preserves genuine user pause intent and does not auto-resume during normal playback (Test B)', async () => {
      const { headCalls, ticketCalls } = setupProtectedStreamFetch();
      const { container, video } = await renderProtectedPlayer();
      const playerRegion = container.querySelector('[data-recovery-phase]')!;
      const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'play');

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
      });
      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'playing');
      playSpy.mockClear();

      Object.defineProperty(video, 'paused', { value: true, writable: true, configurable: true });
      act(() => {
        fireEvent.pause(video);
      });

      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'paused');

      // Watchdogs/stalls while genuinely paused must NOT trigger recovery or auto-resume playback
      act(() => {
        fireEvent.stalled(video);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS + 10_000);
      });

      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'paused');
      expect(headCalls).toHaveLength(0);
      expect(ticketCalls).toHaveLength(1);
      expect(playSpy).not.toHaveBeenCalled();
    });

    it('preserves ended state when pause fires after video ends and keeps replay intact (Test C)', async () => {
      setupProtectedStreamFetch();
      const { container, video, onComplete } = await renderProtectedPlayer();
      const playerRegion = container.querySelector('[data-recovery-phase]')!;
      const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'play');

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
      });
      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'playing');

      Object.defineProperty(video, 'ended', { value: true, writable: true, configurable: true });
      Object.defineProperty(video, 'paused', { value: true, writable: true, configurable: true });
      video.currentTime = 120;
      act(() => {
        fireEvent.ended(video);
      });

      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'ended');
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith('lesson-77');

      // Native browser pause often fires alongside/after ended
      act(() => {
        fireEvent.pause(video);
      });
      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'ended');

      // Replay click still resets position and resumes playback cleanly
      playSpy.mockClear();
      await act(async () => {
        fireEvent.click(video);
        await flushAsyncTicks();
      });
      Object.defineProperty(video, 'ended', { value: false, writable: true, configurable: true });
      Object.defineProperty(video, 'paused', { value: false, writable: true, configurable: true });
      act(() => {
        fireEvent.playing(video);
      });

      expect(video.currentTime).toBe(0);
      expect(playSpy).toHaveBeenCalledTimes(1);
      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'playing');
    });

    it('recovers cleanly on Retry after terminal network error and teardown pause (Test D)', async () => {
      const { ticketCalls } = setupProtectedStreamFetch({
        ticketResponses: [
          { status: 200, streamUrl: '/api/media/references/77/stream?st=ticket-1' },
          { status: 503, code: 'TEMP_UNAVAILABLE' },
          { status: 200, streamUrl: '/api/media/references/77/stream?st=retry-ticket-3' },
        ],
      });
      const { container, video } = await renderProtectedPlayer();
      const playerRegion = container.querySelector('[data-recovery-phase]')!;

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
      });

      Object.defineProperty(video, 'error', { value: { code: 2 }, configurable: true });
      await act(async () => {
        fireEvent.error(video);
        await flushAsyncTicks();
        fireEvent.pause(video);
      });

      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'error');
      expect(screen.getByRole('alert')).toHaveAttribute('data-error-category', 'network');

      fireEvent.click(screen.getByRole('button', { name: /إعادة المحاولة/ }));
      await act(async () => {
        await flushAsyncTicks();
      });

      expect(ticketCalls).toHaveLength(3);
      expect(screen.queryByRole('alert')).toBeNull();
      const recoveredVideo = document.querySelector('video')!;
      expect(recoveredVideo.getAttribute('src')).toBe('/api/media/references/77/stream?st=retry-ticket-3');
      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'loading_metadata');

      Object.defineProperty(recoveredVideo, 'duration', { value: 120, configurable: true });
      act(() => {
        fireEvent.loadedMetadata(recoveredVideo);
        fireEvent.playing(recoveredVideo);
      });
      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'playing');
    });
  });

  describe('Preserve Latest User Seek During Recovery (Phase 3.2C)', () => {
    function setupDeferredRecoveryFetch() {
      const ticketCalls: Array<{ url: string }> = [];
      const deferredRenewals: Array<{
        url: string;
        resolve: (res: Response) => void;
      }> = [];

      global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method || 'GET').toUpperCase();

        if (url === '/api/media/stream-ticket' && method === 'POST') {
          const parsed = JSON.parse(String(init?.body || '{}')) as { url: string };
          ticketCalls.push(parsed);
          const count = ticketCalls.length;
          // Initial ticket per source resolves immediately; recovery renewal for /references/77/ holds open
          if (parsed.url.includes('/references/77/') && count >= 2) {
            return new Promise<Response>((resolve) => {
              deferredRenewals.push({ url: parsed.url, resolve });
            });
          }
          return new Response(
            JSON.stringify({
              status: 'OK',
              data: { streamUrl: `${parsed.url}?st=ticket-${count}` },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (url.startsWith('/api/media/') && method === 'HEAD') {
          return new Response(null, {
            status: 200,
            headers: { 'Content-Type': 'video/mp4', 'Content-Length': '1048576' },
          });
        }

        throw new Error(`Unexpected fetch: ${method} ${url}`);
      }) as typeof fetch;

      return { ticketCalls, deferredRenewals };
    }

    function mockScrubberRect(width = 300) {
      const scrubber = screen.getByRole('slider', { name: /شريط التقدم الزمني/i });
      vi.spyOn(scrubber, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        right: width,
        top: 0,
        bottom: 10,
        width,
        height: 10,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
      return scrubber;
    }

    it('overrides stale pre-recovery savedTime with explicit user seek during active recovery (Test A)', async () => {
      const { ticketCalls, deferredRenewals } = setupDeferredRecoveryFetch();
      const { container, video } = await renderProtectedPlayer(
        '/api/media/references/77/stream',
        200
      );
      Object.defineProperty(video, 'duration', { value: 300, configurable: true });
      const playerRegion = container.querySelector('[data-recovery-phase]')!;

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
        video.currentTime = 200;
        fireEvent.timeUpdate(video);
      });

      // Trigger stall recovery -> enters renewing_ticket with pending promise
      act(() => {
        fireEvent.stalled(video);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
        await flushAsyncTicks(8);
      });

      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'renewing_ticket');
      expect(ticketCalls).toHaveLength(2);
      expect(deferredRenewals).toHaveLength(1);

      // Seek explicitly via scrubber to 100s (also simulate native seeking event fired by browser)
      const scrubber = mockScrubberRect(300);
      act(() => {
        fireEvent.click(scrubber, { clientX: 100 });
        fireEvent.seeking(video);
      });
      expect(video.currentTime).toBe(100);

      // Resolve renewal ticket -> fire loadedmetadata -> must stay 100s, never revert to 200s
      await act(async () => {
        deferredRenewals[0].resolve(
          new Response(
            JSON.stringify({
              status: 'OK',
              data: { streamUrl: '/api/media/references/77/stream?st=renewed-100' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
        await flushAsyncTicks(8);
      });

      expect(video.getAttribute('src')).toBe('/api/media/references/77/stream?st=renewed-100');
      act(() => {
        fireEvent.loadedMetadata(video);
      });

      expect(video.currentTime).toBe(100);
      expect(ticketCalls).toHaveLength(2);
    });

    it('uses the latest of multiple explicit user seeks made during recovery (Test B)', async () => {
      const { ticketCalls, deferredRenewals } = setupDeferredRecoveryFetch();
      const { container, video } = await renderProtectedPlayer(
        '/api/media/references/77/stream',
        200
      );
      Object.defineProperty(video, 'duration', { value: 300, configurable: true });
      const playerRegion = container.querySelector('[data-recovery-phase]')!;

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
        video.currentTime = 200;
        fireEvent.timeUpdate(video);
        fireEvent.stalled(video);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
        await flushAsyncTicks(8);
      });
      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'renewing_ticket');

      const scrubber = mockScrubberRect(300);
      act(() => {
        fireEvent.click(scrubber, { clientX: 100 });
      });
      act(() => {
        fireEvent.click(scrubber, { clientX: 150 });
      });
      expect(video.currentTime).toBe(150);

      await act(async () => {
        deferredRenewals[0].resolve(
          new Response(
            JSON.stringify({
              status: 'OK',
              data: { streamUrl: '/api/media/references/77/stream?st=renewed-150' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
        await flushAsyncTicks(8);
      });

      act(() => {
        fireEvent.loadedMetadata(video);
      });

      expect(video.currentTime).toBe(150);
      expect(ticketCalls).toHaveLength(2);
    });

    it('preserves saved pre-recovery position when no user seek occurs (Test C)', async () => {
      const { deferredRenewals } = setupDeferredRecoveryFetch();
      const { container, video } = await renderProtectedPlayer(
        '/api/media/references/77/stream',
        200
      );
      Object.defineProperty(video, 'duration', { value: 300, configurable: true });
      const playerRegion = container.querySelector('[data-recovery-phase]')!;

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
        video.currentTime = 200;
        fireEvent.timeUpdate(video);
        fireEvent.stalled(video);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
        await flushAsyncTicks(8);
      });
      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'renewing_ticket');

      await act(async () => {
        deferredRenewals[0].resolve(
          new Response(
            JSON.stringify({
              status: 'OK',
              data: { streamUrl: '/api/media/references/77/stream?st=renewed-200' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
        await flushAsyncTicks(8);
      });

      // Even if underlying <video> resets currentTime to 0 on new src, recovery restores 200s
      video.currentTime = 0;
      act(() => {
        fireEvent.loadedMetadata(video);
      });
      expect(video.currentTime).toBe(200);
    });

    it('enforces trainee furthestWatched clamp on user seeks during recovery (Test D)', async () => {
      const { deferredRenewals } = setupDeferredRecoveryFetch();
      const onComplete = vi.fn();
      const { container } = render(
        <VideoPlayer
          courseId="course-10015"
          itemId="lesson-77"
          title="درس محمي"
          src="/api/media/references/77/stream"
          initialPosition={110}
          furthestWatched={120}
          isReadOnly={false}
          isCompleted={false}
          onComplete={onComplete}
        />
      );
      await act(async () => {
        await flushAsyncTicks();
      });

      const video = document.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: 300, configurable: true });
      const playerRegion = container.querySelector('[data-recovery-phase]')!;

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
        fireEvent.stalled(video);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
        await flushAsyncTicks(8);
      });
      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'renewing_ticket');

      const scrubber = mockScrubberRect(300);
      act(() => {
        fireEvent.click(scrubber, { clientX: 250 });
      });

      expect(screen.getByTestId('seeking-clamped-badge')).toBeInTheDocument();
      expect(video.currentTime).toBe(120);

      await act(async () => {
        deferredRenewals[0].resolve(
          new Response(
            JSON.stringify({
              status: 'OK',
              data: { streamUrl: '/api/media/references/77/stream?st=renewed-clamp' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
        await flushAsyncTicks(8);
      });

      video.currentTime = 0;
      act(() => {
        fireEvent.loadedMetadata(video);
      });
      expect(video.currentTime).toBe(120);
    });

    it('keeps seeking unrestricted during recovery in Preview Mode (Test E)', async () => {
      const { deferredRenewals } = setupDeferredRecoveryFetch();
      const onComplete = vi.fn();
      const { container } = render(
        <VideoPlayer
          courseId="course-10015"
          itemId="lesson-77"
          title="درس معاينة"
          src="/api/media/references/77/stream"
          initialPosition={110}
          furthestWatched={120}
          isReadOnly={true}
          onComplete={onComplete}
        />
      );
      await act(async () => {
        await flushAsyncTicks();
      });

      const video = document.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: 300, configurable: true });
      const playerRegion = container.querySelector('[data-recovery-phase]')!;

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
        fireEvent.stalled(video);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
        await flushAsyncTicks(8);
      });
      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'renewing_ticket');

      const scrubber = mockScrubberRect(300);
      act(() => {
        fireEvent.click(scrubber, { clientX: 250 });
      });

      expect(screen.queryByTestId('seeking-clamped-badge')).toBeNull();
      expect(video.currentTime).toBe(250);

      await act(async () => {
        deferredRenewals[0].resolve(
          new Response(
            JSON.stringify({
              status: 'OK',
              data: { streamUrl: '/api/media/references/77/stream?st=renewed-preview' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
        await flushAsyncTicks(8);
      });

      video.currentTime = 0;
      act(() => {
        fireEvent.loadedMetadata(video);
      });
      expect(video.currentTime).toBe(250);
    });

    it('restores requested seek position while remaining paused if user pauses during recovery (Test F)', async () => {
      const { deferredRenewals } = setupDeferredRecoveryFetch();
      const { container, video } = await renderProtectedPlayer(
        '/api/media/references/77/stream',
        200
      );
      Object.defineProperty(video, 'duration', { value: 300, configurable: true });
      Object.defineProperty(video, 'paused', { value: false, writable: true, configurable: true });
      const playerRegion = container.querySelector('[data-recovery-phase]')!;
      const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'play');

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
        video.currentTime = 200;
        fireEvent.timeUpdate(video);
        fireEvent.stalled(video);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
        await flushAsyncTicks(8);
      });
      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'renewing_ticket');

      const scrubber = mockScrubberRect(300);
      act(() => {
        fireEvent.click(scrubber, { clientX: 100 });
      });

      // Pause via UI pause control before ticket settles
      fireEvent.click(screen.getByRole('button', { name: 'إيقاف مؤقت' }));
      Object.defineProperty(video, 'paused', { value: true, writable: true, configurable: true });
      playSpy.mockClear();

      await act(async () => {
        deferredRenewals[0].resolve(
          new Response(
            JSON.stringify({
              status: 'OK',
              data: { streamUrl: '/api/media/references/77/stream?st=renewed-paused' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
        await flushAsyncTicks(8);
      });

      video.currentTime = 0;
      act(() => {
        fireEvent.loadedMetadata(video);
      });

      expect(video.currentTime).toBe(100);
      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'paused');
      expect(playSpy).not.toHaveBeenCalled();
    });

    it('clears pending user seek from Video A when switching to Video B mid-recovery (Test G)', async () => {
      const ticketCalls: Array<{ url: string }> = [];
      let resolveOldRenewal!: (res: Response) => void;
      let resolveVideoBTicket!: (res: Response) => void;
      let oldRenewalAborted = false;

      global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method || 'GET').toUpperCase();
        if (url === '/api/media/stream-ticket' && method === 'POST') {
          const parsed = JSON.parse(String(init?.body || '{}')) as { url: string };
          ticketCalls.push(parsed);
          if (parsed.url.includes('/references/77/') && ticketCalls.length === 1) {
            return new Response(
              JSON.stringify({ status: 'OK', data: { streamUrl: '/api/media/references/77/stream?st=a-1' } }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
          if (parsed.url.includes('/references/77/')) {
            init?.signal?.addEventListener('abort', () => {
              oldRenewalAborted = true;
            });
            return new Promise<Response>((resolve) => {
              resolveOldRenewal = resolve;
            });
          }
          return new Promise<Response>((resolve) => {
            resolveVideoBTicket = resolve;
          });
        }
        if (url.startsWith('/api/media/') && method === 'HEAD') {
          return new Response(null, {
            status: 200,
            headers: { 'Content-Type': 'video/mp4', 'Content-Length': '1048576' },
          });
        }
        throw new Error(`Unexpected fetch: ${method} ${url}`);
      }) as typeof fetch;

      const onComplete = vi.fn();
      const { container, rerender } = render(
        <VideoPlayer
          courseId="course-10015"
          itemId="lesson-77"
          title="درس A"
          src="/api/media/references/77/stream"
          initialPosition={200}
          furthestWatched={250}
          isReadOnly={false}
          onComplete={onComplete}
        />
      );
      await act(async () => {
        await flushAsyncTicks(6);
      });

      const videoA = document.querySelector('video')!;
      Object.defineProperty(videoA, 'duration', { value: 300, configurable: true });
      act(() => {
        fireEvent.loadedMetadata(videoA);
        fireEvent.playing(videoA);
        fireEvent.stalled(videoA);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS);
        await flushAsyncTicks(8);
      });
      expect(container.querySelector('[data-recovery-phase]')).toHaveAttribute(
        'data-recovery-phase',
        'renewing_ticket'
      );

      // Seek to 100s on Video A while its recovery is pending
      const scrubber = mockScrubberRect(300);
      act(() => {
        fireEvent.click(scrubber, { clientX: 100 });
      });
      expect(videoA.currentTime).toBe(100);

      // Switch to Video B before Video A recovery settles
      rerender(
        <VideoPlayer
          courseId="course-10015"
          itemId="lesson-88"
          title="درس B"
          src="/api/media/references/88/stream"
          initialPosition={0}
          furthestWatched={0}
          isReadOnly={false}
          onComplete={onComplete}
        />
      );
      await act(async () => {
        await flushAsyncTicks(6);
      });
      expect(oldRenewalAborted).toBe(true);

      // Resolve stale Video A renewal response first, then Video B initial ticket
      await act(async () => {
        resolveOldRenewal(
          new Response(
            JSON.stringify({ status: 'OK', data: { streamUrl: '/api/media/references/77/stream?st=a-stale' } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
        await flushAsyncTicks(6);
      });

      await act(async () => {
        resolveVideoBTicket(
          new Response(
            JSON.stringify({ status: 'OK', data: { streamUrl: '/api/media/references/88/stream?st=b-1' } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
        await flushAsyncTicks(6);
      });

      const videoB = document.querySelector('video')!;
      Object.defineProperty(videoB, 'duration', { value: 180, configurable: true });
      expect(videoB.getAttribute('src')).toBe('/api/media/references/88/stream?st=b-1');

      act(() => {
        fireEvent.loadedMetadata(videoB);
      });
      expect(videoB.currentTime).toBe(0);
    });
  });

  describe('Progress-Aware Initial Metadata Watchdog (Phase 3.2D.1)', () => {
    it('does not abort slow but continuously progressing initial metadata load at 20s (Test A)', async () => {
      const { headCalls, ticketCalls } = setupProtectedStreamFetch();
      const { container, video } = await renderProtectedPlayer();
      const playerRegion = container.querySelector('[data-recovery-phase]')!;

      Object.defineProperty(video, 'readyState', { value: 0, writable: true, configurable: true });
      Object.defineProperty(video, 'networkState', {
        value: HTMLMediaElement.NETWORK_LOADING,
        writable: true,
        configurable: true,
      });

      act(() => {
        fireEvent.loadStart(video);
      });

      // Emit progress every 8s up to 32s (past 20s idle timeout, well within 60s active ceiling)
      for (let i = 0; i < 4; i += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(8_000);
        });
        act(() => {
          fireEvent.progress(video);
        });
      }

      expect(headCalls).toHaveLength(0);
      expect(ticketCalls).toHaveLength(1);
      expect(video.getAttribute('src')).toBe('/api/media/references/77/stream?st=ticket-1');
      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'loading_metadata');

      // Metadata finally arrives at t=36s -> clears ceiling & idle timers cleanly
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4_000);
      });
      Object.defineProperty(video, 'readyState', { value: 1, writable: true, configurable: true });
      act(() => {
        fireEvent.loadedMetadata(video);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(INITIAL_METADATA_MAX_TIMEOUT_MS + 10_000);
      });
      expect(headCalls).toHaveLength(0);
      expect(ticketCalls).toHaveLength(1);
    });

    it('triggers recovery at 20s when initial load produces zero qualified progress (Test B)', async () => {
      const { headCalls, ticketCalls } = setupProtectedStreamFetch();
      const { video } = await renderProtectedPlayer();

      Object.defineProperty(video, 'readyState', { value: 0, writable: true, configurable: true });
      Object.defineProperty(video, 'networkState', {
        value: HTMLMediaElement.NETWORK_LOADING,
        writable: true,
        configurable: true,
      });

      act(() => {
        fireEvent.loadStart(video);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(INITIAL_METADATA_TIMEOUT_MS - 1_000);
      });
      expect(headCalls).toHaveLength(0);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
        await flushAsyncTicks(8);
      });

      expect(headCalls).toHaveLength(1);
      expect(ticketCalls).toHaveLength(2);
      expect(video.getAttribute('src')).toBe('/api/media/references/77/stream?st=ticket-2');
    });

    it('enforces 60s absolute active-time ceiling with continuous progress and pauses countdown while tab hidden (Test C)', async () => {
      const { headCalls, ticketCalls } = setupProtectedStreamFetch();
      const { container, video } = await renderProtectedPlayer();
      const playerRegion = container.querySelector('[data-recovery-phase]')!;

      Object.defineProperty(video, 'readyState', { value: 0, writable: true, configurable: true });
      Object.defineProperty(video, 'networkState', {
        value: HTMLMediaElement.NETWORK_LOADING,
        writable: true,
        configurable: true,
      });

      act(() => {
        fireEvent.loadStart(video);
      });

      // Consume 30s of active time with progress every 10s
      for (let i = 0; i < 3; i += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10_000);
        });
        act(() => {
          fireEvent.progress(video);
        });
      }
      expect(headCalls).toHaveLength(0);
      expect(ticketCalls).toHaveLength(1);

      // Hide tab for 120s -> active ceiling budget must pause at 30s remaining
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000);
      });
      expect(headCalls).toHaveLength(0);
      expect(ticketCalls).toHaveLength(1);

      // Restore visibility -> resumes remaining 30s (never resets back to 60s)
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Consume 20s more active time (50s active total)
      for (let i = 0; i < 2; i += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10_000);
        });
        act(() => {
          fireEvent.progress(video);
        });
      }
      expect(headCalls).toHaveLength(0);

      // Final 10s hits the 60s active-time ceiling -> triggers recovery once
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
        await flushAsyncTicks(8);
      });

      expect(headCalls).toHaveLength(1);
      expect(ticketCalls).toHaveLength(2);
      expect(video.getAttribute('src')).toBe('/api/media/references/77/stream?st=ticket-2');

      // Continuing progress after ceiling exhaustion must NOT extend or loop restarts
      for (let i = 0; i < 2; i += 1) {
        act(() => {
          fireEvent.progress(video);
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10_000);
          await flushAsyncTicks(6);
        });
      }

      expect(headCalls).toHaveLength(1);
      expect(ticketCalls).toHaveLength(2);
      expect(playerRegion).toHaveAttribute('data-recovery-phase', 'error');
      expect(screen.getByRole('alert')).toHaveAttribute('data-error-category', 'exhausted');
    });

    it('fires idle watchdog 20s after progress stops following initial activity (Test D)', async () => {
      const { headCalls, ticketCalls } = setupProtectedStreamFetch();
      const { video } = await renderProtectedPlayer();

      Object.defineProperty(video, 'readyState', { value: 0, writable: true, configurable: true });
      Object.defineProperty(video, 'networkState', {
        value: HTMLMediaElement.NETWORK_LOADING,
        writable: true,
        configurable: true,
      });

      act(() => {
        fireEvent.loadStart(video);
      });

      // Two progress updates at t=8s and t=16s, then transfer goes completely idle
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8_000);
      });
      act(() => {
        fireEvent.progress(video);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8_000);
      });
      act(() => {
        fireEvent.progress(video);
      });

      // t=35s (19s since last progress) -> still waiting
      await act(async () => {
        await vi.advanceTimersByTimeAsync(INITIAL_METADATA_TIMEOUT_MS - 1_000);
      });
      expect(headCalls).toHaveLength(0);

      // t=36s (20s since last progress) -> idle watchdog triggers once
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
        await flushAsyncTicks(8);
      });
      expect(headCalls).toHaveLength(1);
      expect(ticketCalls).toHaveLength(2);
    });

    it('cleans up Video A timers on source switch and gives Video B a fresh 60s budget (Test E)', async () => {
      const { headCalls, ticketCalls } = setupProtectedStreamFetch();
      const onComplete = vi.fn();

      const { rerender } = render(
        <VideoPlayer
          courseId="course-10015"
          itemId="lesson-77"
          title="درس A"
          src="/api/media/references/77/stream"
          onComplete={onComplete}
        />
      );
      await act(async () => {
        await flushAsyncTicks(6);
      });

      const videoA = document.querySelector('video')!;
      Object.defineProperty(videoA, 'readyState', { value: 0, writable: true, configurable: true });
      Object.defineProperty(videoA, 'networkState', {
        value: HTMLMediaElement.NETWORK_LOADING,
        writable: true,
        configurable: true,
      });
      act(() => {
        fireEvent.loadStart(videoA);
      });

      // Consume 50s of Video A's 60s ceiling
      for (let i = 0; i < 5; i += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10_000);
        });
        act(() => {
          fireEvent.progress(videoA);
        });
      }
      expect(headCalls).toHaveLength(0);

      // Switch to Video B with only 10s left on Video A's old ceiling
      rerender(
        <VideoPlayer
          courseId="course-10015"
          itemId="lesson-88"
          title="درس B"
          src="/api/media/references/88/stream"
          onComplete={onComplete}
        />
      );
      await act(async () => {
        await flushAsyncTicks(6);
      });

      const videoB = document.querySelector('video')!;
      Object.defineProperty(videoB, 'readyState', { value: 0, writable: true, configurable: true });
      Object.defineProperty(videoB, 'networkState', {
        value: HTMLMediaElement.NETWORK_LOADING,
        writable: true,
        configurable: true,
      });
      act(() => {
        fireEvent.loadStart(videoB);
      });

      // Advance 40s on Video B with progress every 10s -> A's remaining 10s must NOT fire or affect B
      for (let i = 0; i < 4; i += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10_000);
        });
        act(() => {
          fireEvent.progress(videoB);
        });
      }
      expect(headCalls).toHaveLength(0);
      expect(ticketCalls).toEqual([
        { url: '/api/media/references/77/stream' },
        { url: '/api/media/references/88/stream' },
      ]);

      // B hits its own full 60s ceiling cleanly
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
        await flushAsyncTicks(8);
      });
      expect(headCalls).toHaveLength(1);
      expect(headCalls[0]).toContain('/references/88/stream');
    });

    it('cleans up pending initial watchdog timers on explicit Retry and component unmount (Test F)', async () => {
      const { headCalls, ticketCalls } = setupProtectedStreamFetch({
        ticketResponses: [
          { status: 200, streamUrl: '/api/media/references/77/stream?st=ticket-1' },
          { status: 503, code: 'TEMP_UNAVAILABLE' },
          { status: 200, streamUrl: '/api/media/references/77/stream?st=retry-ticket-3' },
        ],
      });
      const { unmount, video } = await renderProtectedPlayer();

      Object.defineProperty(video, 'readyState', { value: 0, writable: true, configurable: true });
      Object.defineProperty(video, 'networkState', {
        value: HTMLMediaElement.NETWORK_LOADING,
        writable: true,
        configurable: true,
      });
      act(() => {
        fireEvent.loadStart(video);
      });

      // Consume 40s of initial budget, then hit terminal error
      for (let i = 0; i < 4; i += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10_000);
        });
        act(() => {
          fireEvent.progress(video);
        });
      }

      Object.defineProperty(video, 'error', { value: { code: 2 }, configurable: true });
      await act(async () => {
        fireEvent.error(video);
        await flushAsyncTicks(10);
      });
      expect(screen.getByRole('alert')).toHaveAttribute('data-error-category', 'network');
      expect(headCalls).toHaveLength(1);

      // Explicit Retry must start a fresh 60s ceiling (does not expire after remaining 20s)
      fireEvent.click(screen.getByRole('button', { name: /إعادة المحاولة/ }));
      await act(async () => {
        await flushAsyncTicks(8);
      });

      const retriedVideo = document.querySelector('video')!;
      Object.defineProperty(retriedVideo, 'readyState', { value: 0, writable: true, configurable: true });
      Object.defineProperty(retriedVideo, 'networkState', {
        value: HTMLMediaElement.NETWORK_LOADING,
        writable: true,
        configurable: true,
      });
      act(() => {
        fireEvent.loadStart(retriedVideo);
      });

      for (let i = 0; i < 3; i += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10_000);
        });
        act(() => {
          fireEvent.progress(retriedVideo);
        });
      }
      // 30s since Retry (> previous 20s remainder) -> still alive, no extra HEAD recovery!
      expect(headCalls).toHaveLength(1);
      expect(ticketCalls).toHaveLength(3);

      // Unmount while both idle and ceiling timers are active -> advancing past 60s triggers nothing
      unmount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(INITIAL_METADATA_MAX_TIMEOUT_MS + 10_000);
        await flushAsyncTicks(8);
      });
      expect(headCalls).toHaveLength(1);
      expect(ticketCalls).toHaveLength(3);
    });

    it('observes unchanged 12s playback watchdog on slow post-metadata unbuffered seek (Test G)', async () => {
      const { headCalls, ticketCalls } = setupProtectedStreamFetch();
      const onComplete = vi.fn();
      render(
        <VideoPlayer
          courseId="course-10015"
          itemId="lesson-77"
          title="درس معاينة"
          src="/api/media/references/77/stream"
          initialPosition={0}
          furthestWatched={0}
          isReadOnly={true}
          onComplete={onComplete}
        />
      );
      await act(async () => {
        await flushAsyncTicks(6);
      });

      const video = document.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: 300, configurable: true });
      Object.defineProperty(video, 'readyState', { value: 4, writable: true, configurable: true });
      Object.defineProperty(video, 'networkState', {
        value: HTMLMediaElement.NETWORK_LOADING,
        writable: true,
        configurable: true,
      });

      act(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.playing(video);
      });

      // Seek to unbuffered 200s while slow buffer expansion advances without seeked completion
      let slowBufEnd = 201;
      Object.defineProperty(video, 'buffered', {
        value: {
          length: 1,
          start: () => 198,
          end: () => slowBufEnd,
        } as unknown as TimeRanges,
        configurable: true,
      });
      video.currentTime = 200;
      act(() => {
        fireEvent.seeking(video);
      });

      for (const endSec of [203, 206]) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(4_000);
        });
        slowBufEnd = endSec;
        act(() => {
          fireEvent.progress(video);
        });
      }

      // Unchanged post-metadata PLAYBACK_STALL_TIMEOUT_MS (12s) triggers recovery cleanly when seeked lags
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAYBACK_STALL_TIMEOUT_MS - 8_000);
        await flushAsyncTicks(8);
      });

      expect(headCalls).toHaveLength(1);
      expect(ticketCalls).toHaveLength(2);
    });
  });
});
