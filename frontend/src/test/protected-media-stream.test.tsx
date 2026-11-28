import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import {
  BLOB_FALLBACK_IDLE_TIMEOUT_MS,
  diagnoseProtectedMediaStream,
  fetchProtectedBlobFallback,
  MAX_BLOB_FALLBACK_BYTES,
  ProtectedStreamError,
  readResponseBodyWithLimit,
  requestProtectedStreamTicket,
  resolveEffectiveBlobMaxBytes,
  resolveProtectedMediaStream,
  STREAM_REQUEST_TIMEOUT_MS,
} from '@/core/storage/protectedMediaStream';
import { useAuthenticatedMediaPreview } from '@/core/storage/useAuthenticatedMediaPreview';
import { GroupMaterialViewerModal } from '@/features/groups/components/GroupMaterialViewerModal';

describe('Protected Media Stream & Cross-Device Fallback', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    document.cookie = 'csrftoken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('bootstraps CSRF cookie if missing before minting progressive stream ticket', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === '/api/auth/csrf') {
        document.cookie = 'csrftoken=bootstrapped-token-123; Path=/';
        return new Response(JSON.stringify({ status: 'OK' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === '/api/media/stream-ticket') {
        return new Response(
          JSON.stringify({
            status: 'OK',
            data: { streamUrl: '/api/media/references/53/stream?st=ticket-abc' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    const controller = new AbortController();
    const res = await resolveProtectedMediaStream('/api/media/references/53/stream', {
      signal: controller.signal,
    });

    expect(res.usedStreamTicket).toBe(true);
    expect(res.isBlobUrl).toBe(false);
    expect(res.resolvedUrl).toBe('/api/media/references/53/stream?st=ticket-abc');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/csrf', expect.objectContaining({ method: 'GET' }));
    const ticketCall = fetchMock.mock.calls.find((c) => String(c[0]) === '/api/media/stream-ticket');
    expect((ticketCall?.[1]?.headers as Record<string, string>)['X-CSRFToken']).toBe(
      'bootstrapped-token-123'
    );
  });

  it('does NOT trigger Blob fallback when aborted via AbortError during ticket fetch', async () => {
    document.cookie = 'csrftoken=existing-token; Path=/';
    const controller = new AbortController();

    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === '/api/media/stream-ticket') {
        controller.abort();
        throw new DOMException('Aborted', 'AbortError');
      }
      throw new Error(`Should never fetch fallback after AbortError: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(
      resolveProtectedMediaStream('/api/media/references/53/stream', {
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/media/stream-ticket');
  });

  it('aborts oversized Blob fallback streams above MAX_BLOB_FALLBACK_BYTES without buffering', async () => {
    document.cookie = 'csrftoken=existing-token; Path=/';
    const blobSpy = vi.fn();

    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === '/api/media/stream-ticket') {
        return new Response('CSRF Failed', { status: 403 });
      }
      if (url === '/api/media/references/53/stream') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({
            'Content-Length': String(MAX_BLOB_FALLBACK_BYTES + 1024),
            'X-Original-Mime-Type': 'video/mp4',
          }),
          blob: blobSpy,
        } as unknown as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    const controller = new AbortController();
    await expect(
      resolveProtectedMediaStream('/api/media/references/53/stream', {
        signal: controller.signal,
      })
    ).rejects.toThrow('BLOB_FALLBACK_TOO_LARGE');

    expect(blobSpy).not.toHaveBeenCalled();
  });

  it('falls back once to X-MetroLMS-Stream Blob on <video> error and resets cleanly when URL changes', async () => {
    document.cookie = 'csrftoken=existing-token; Path=/';
    const origUa = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 Chrome/130.0', configurable: true });

    try {
      const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === '/api/media/stream-ticket') {
          const parsed = JSON.parse(String(init?.body || '{}'));
          const id = parsed.url.includes('/60/') ? '60' : '61';
          return new Response(
            JSON.stringify({
              status: 'OK',
              data: { streamUrl: `/api/media/references/${id}/stream?st=ticket-${id}` },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url === '/api/media/references/60/stream') {
          expect((init?.headers as Record<string, string>)['X-MetroLMS-Stream']).toBe('1');
          return new Response(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]), {
            status: 200,
            headers: { 'X-Original-Mime-Type': 'video/mp4' },
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });
      global.fetch = fetchMock as typeof fetch;

      function TestPreviewHarness({ streamUrl }: { streamUrl: string }) {
        const { previewUrl, fallbackToBlob } = useAuthenticatedMediaPreview(streamUrl, 'video');
        return (
          <video
            data-testid="test-preview-video"
            src={previewUrl}
            onError={() => {
              fallbackToBlob();
            }}
          />
        );
      }

      const { getByTestId, rerender } = render(
        <TestPreviewHarness streamUrl="/api/media/references/60/stream" />
      );
      await waitFor(() => {
        expect(getByTestId('test-preview-video').getAttribute('src')).toBe(
          '/api/media/references/60/stream?st=ticket-60'
        );
      });

      await act(async () => {
        fireEvent.error(getByTestId('test-preview-video'));
      });

      await waitFor(() => {
        expect(getByTestId('test-preview-video').getAttribute('src')).toMatch(/^blob:/);
      });

      // Second error on Blob URL must NOT loop
      const callsBeforeSecondError = fetchMock.mock.calls.length;
      fireEvent.error(getByTestId('test-preview-video'));
      expect(fetchMock.mock.calls.length).toBe(callsBeforeSecondError);

      // Switching to video 61 starts cleanly with ticket (NOT Blob fallback)
      rerender(<TestPreviewHarness streamUrl="/api/media/references/61/stream" />);
      await waitFor(() => {
        expect(getByTestId('test-preview-video').getAttribute('src')).toBe(
          '/api/media/references/61/stream?st=ticket-61'
        );
      });
      expect(
        fetchMock.mock.calls.some((c) => String(c[0]) === '/api/media/references/61/stream')
      ).toBe(false);

      const { result } = renderHook(() =>
        useAuthenticatedMediaPreview('/api/media/references/60/stream', 'video')
      );
      await waitFor(() => expect(result.current.previewUrl).toContain('?st=ticket-60'));
    } finally {
      Object.defineProperty(navigator, 'userAgent', { value: origUa, configurable: true });
    }
  });

  it('GroupMaterialViewerModal does not mount raw /api/media stream before stream-ticket resolves', async () => {
    document.cookie = 'csrftoken=existing-token; Path=/';
    const origUa = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 Chrome/130.0', configurable: true });

    let resolveTicket!: (res: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveTicket = resolve;
        })
    );
    global.fetch = fetchMock as typeof fetch;

    try {
      const { queryByTestId } = render(
        <GroupMaterialViewerModal
          isOpen={true}
          onClose={vi.fn()}
          file={{
            id: 'mat-1',
            groupId: '1',
            title: 'فيديو المجموعة',
            originalFileName: 'group-clip.mp4',
            fileType: 'video',
            fileSizeBytes: 1024,
            url: '/api/media/assets/25/stream',
            uploadedAt: '2026-11-26T10:00:00Z',
            uploadedByName: 'المدرب',
          }}
        />
      );

      // While ticket request is in flight, no <video> with raw /api/media/assets/25/stream should exist
      expect(queryByTestId('video-preview')).toBeNull();
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe('/api/media/stream-ticket');
      });

      await act(async () => {
        resolveTicket(
          new Response(
            JSON.stringify({
              status: 'OK',
              data: { streamUrl: '/api/media/assets/25/stream?st=group-ticket' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      });

      await waitFor(() => {
        expect(queryByTestId('video-preview')?.getAttribute('src')).toBe(
          '/api/media/assets/25/stream?st=group-ticket'
        );
      });
    } finally {
      Object.defineProperty(navigator, 'userAgent', { value: origUa, configurable: true });
    }
  });

  it('diagnoseProtectedMediaStream uses HEAD with same-origin/no-store and maps 200/401/403/404/timeout', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(init?.method).toBe('HEAD');
      expect(init?.credentials).toBe('same-origin');
      expect(init?.cache).toBe('no-store');

      if (url.includes('/valid-big')) {
        return new Response(null, {
          status: 200,
          headers: {
            'Content-Length': String(MAX_BLOB_FALLBACK_BYTES + 1),
            'Content-Type': 'video/mp4',
          },
        });
      }
      if (url.includes('/valid-small')) {
        return new Response(null, {
          status: 200,
          headers: { 'Content-Length': '1024', 'Content-Type': 'video/mp4' },
        });
      }
      if (url.includes('/expired-session')) {
        return new Response(null, { status: 401 });
      }
      if (url.includes('/forbidden-ticket')) {
        return new Response(null, { status: 403 });
      }
      if (url.includes('/missing')) {
        return new Response(null, { status: 404 });
      }
      return new Response(null, { status: 503 });
    });
    global.fetch = fetchMock as typeof fetch;

    const big = await diagnoseProtectedMediaStream('/api/media/references/valid-big/stream?st=secret');
    expect(big.outcome).toBe('valid');
    expect(big.canConsiderBlobFallback).toBe(false);

    const small = await diagnoseProtectedMediaStream('/api/media/references/valid-small/stream?st=secret');
    expect(small.outcome).toBe('valid');
    expect(small.canConsiderBlobFallback).toBe(true);

    const auth = await diagnoseProtectedMediaStream('/api/media/references/expired-session/stream?st=secret');
    expect(auth.outcome).toBe('auth');
    expect(auth.canRenewTicket).toBe(false);
    expect(auth.canConsiderBlobFallback).toBe(false);

    const forb = await diagnoseProtectedMediaStream('/api/media/references/forbidden-ticket/stream?st=secret');
    expect(forb.outcome).toBe('forbidden');
    expect(forb.canRenewTicket).toBe(true);

    const miss = await diagnoseProtectedMediaStream('/api/media/references/missing/stream?st=secret');
    expect(miss.outcome).toBe('not_found');
    expect(miss.canRenewTicket).toBe(false);

    const net = await diagnoseProtectedMediaStream('/api/media/references/down/stream?st=secret');
    expect(net.outcome).toBe('network');

    // Timeout returns network outcome without throwing uncaught AbortError
    vi.useFakeTimers();
    try {
      global.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }) as typeof fetch;

      const diagPromise = diagnoseProtectedMediaStream('/api/media/references/hang/stream?st=secret');
      await vi.advanceTimersByTimeAsync(STREAM_REQUEST_TIMEOUT_MS);
      const timedOut = await diagPromise;
      expect(timedOut.outcome).toBe('network');
    } finally {
      vi.useRealTimers();
    }
  });

  it('requestProtectedStreamTicket mints fresh ticket without Blob GET fallback and classifies errors', async () => {
    document.cookie = 'csrftoken=csrf-ok; Path=/';

    const makeResponseFetch = (status: number, body?: Record<string, unknown>) =>
      vi.fn(async (input: RequestInfo | URL) => {
        expect(String(input)).toBe('/api/media/stream-ticket');
        return new Response(body ? JSON.stringify(body) : '', {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;

    global.fetch = makeResponseFetch(401, { code: 'AUTHENTICATION_FAILED' });
    await expect(requestProtectedStreamTicket('/api/media/references/9/stream')).rejects.toMatchObject({
      name: 'ProtectedStreamError',
      kind: 'auth',
      statusCode: 401,
    } satisfies Partial<ProtectedStreamError>);

    global.fetch = makeResponseFetch(403, { code: 'PERMISSION_DENIED' });
    await expect(requestProtectedStreamTicket('/api/media/references/9/stream')).rejects.toMatchObject({
      kind: 'forbidden',
      statusCode: 403,
      errorCode: 'PERMISSION_DENIED',
    } satisfies Partial<ProtectedStreamError>);

    global.fetch = makeResponseFetch(404, { code: 'RESOURCE_NOT_FOUND' });
    await expect(requestProtectedStreamTicket('/api/media/references/9/stream')).rejects.toMatchObject({
      kind: 'not_found',
      statusCode: 404,
    } satisfies Partial<ProtectedStreamError>);
  });

  it('diagnoseProtectedMediaStream treats missing Content-Length as unknown rather than proven safe for Blob', async () => {
    global.fetch = vi.fn(async () => new Response(null, { status: 200 })) as typeof fetch;

    const result = await diagnoseProtectedMediaStream('/api/media/references/no-len/stream?st=secret');
    expect(result.outcome).toBe('valid');
    expect(result.contentLength).toBeUndefined();
    expect(result.canConsiderBlobFallback).toBe(false);
    expect(result.isKnownOversizedForBlob).toBe(false);
  });

  it('readResponseBodyWithLimit accepts exact limit and rejects 1 byte over without reading unbounded body', async () => {
    const cancelSpy = vi.fn(async () => undefined);
    const releaseSpy = vi.fn();

    const makeChunkedResponse = (chunks: Uint8Array[]) => {
      let idx = 0;
      return {
        body: {
          getReader: () => ({
            read: async () => {
              if (idx >= chunks.length) return { done: true, value: undefined };
              return { done: false, value: chunks[idx++] };
            },
            cancel: cancelSpy,
            releaseLock: releaseSpy,
          }),
        },
      } as unknown as Response;
    };

    // Exactly at maxBytes (10 bytes) -> accepted
    const okBlob = await readResponseBodyWithLimit(
      makeChunkedResponse([new Uint8Array(4), new Uint8Array(6)]),
      { maxBytes: 10, mimeType: 'video/mp4' }
    );
    expect(okBlob.size).toBe(10);
    expect(okBlob.type).toBe('video/mp4');
    expect(cancelSpy).not.toHaveBeenCalled();

    // Exceeds limit by 1 byte (11 > 10) -> rejected and cancels reader
    await expect(
      readResponseBodyWithLimit(
        makeChunkedResponse([new Uint8Array(4), new Uint8Array(7)]),
        { maxBytes: 10, mimeType: 'video/mp4' }
      )
    ).rejects.toMatchObject({ kind: 'too_large', message: 'BLOB_FALLBACK_TOO_LARGE' });
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(releaseSpy).toHaveBeenCalled();
  });

  it('enforces byte limit incrementally on missing or underreported Content-Length without creating Object URL', async () => {
    document.cookie = 'csrftoken=existing-token; Path=/';
    const createUrlSpy = vi.spyOn(URL, 'createObjectURL');

    for (const reportedHeader of [null, '8']) {
      const cancelSpy = vi.fn(async () => undefined);
      let chunkIdx = 0;
      const chunks = [new Uint8Array(10), new Uint8Array(10), new Uint8Array(10)];
      let abortedFetch = false;

      global.fetch = vi.fn(async (_url, init?: RequestInit) => {
        init?.signal?.addEventListener('abort', () => {
          abortedFetch = true;
        });
        const headers = new Headers({ 'X-Original-Mime-Type': 'video/mp4' });
        if (reportedHeader !== null) headers.set('Content-Length', reportedHeader);
        return {
          ok: true,
          status: 200,
          headers,
          body: {
            getReader: () => ({
              read: async () => {
                if (chunkIdx >= chunks.length) return { done: true, value: undefined };
                return { done: false, value: chunks[chunkIdx++] };
              },
              cancel: cancelSpy,
              releaseLock: vi.fn(),
            }),
          },
        } as unknown as Response;
      }) as typeof fetch;

      const controller = new AbortController();
      await expect(
        fetchProtectedBlobFallback('/api/media/references/77/stream', {
          signal: controller.signal,
          maxBytes: 16,
        })
      ).rejects.toMatchObject({ kind: 'too_large', message: 'BLOB_FALLBACK_TOO_LARGE' });

      expect(cancelSpy).toHaveBeenCalledTimes(1);
      expect(abortedFetch).toBe(true);
      expect(chunkIdx).toBe(2); // Stopped cleanly on second chunk (20 > 16), never read third chunk
      expect(createUrlSpy).not.toHaveBeenCalled();
    }
  });

  it('fails safely when ReadableStream is unavailable without calling blob() or arrayBuffer()', async () => {
    document.cookie = 'csrftoken=existing-token; Path=/';
    const blobSpy = vi.fn();
    const arrayBufferSpy = vi.fn();

    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'X-Original-Mime-Type': 'video/mp4' }),
      body: null,
      blob: blobSpy,
      arrayBuffer: arrayBufferSpy,
    })) as unknown as typeof fetch;

    const controller = new AbortController();
    await expect(
      fetchProtectedBlobFallback('/api/media/references/77/stream', {
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ kind: 'invalid', message: 'STREAM_READER_UNAVAILABLE' });

    expect(blobSpy).not.toHaveBeenCalled();
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });

  it('supports slow continuous chunks within idle window, aborts stalled body idle timeout, and honors parent cancel', async () => {
    vi.useFakeTimers();
    document.cookie = 'csrftoken=existing-token; Path=/';
    const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/ok');

    try {
      // 1. Slow stream arriving within BLOB_FALLBACK_IDLE_TIMEOUT_MS (3 chunks x 4s = 12s, idle window = 5s) -> succeeds
      let readCount = 0;
      global.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'X-Original-Mime-Type': 'video/mp4' }),
        body: {
          getReader: () => ({
            read: () => {
              readCount += 1;
              if (readCount <= 3) {
                return new Promise((resolve) => {
                  setTimeout(() => resolve({ done: false, value: new Uint8Array(5) }), 4_000);
                });
              }
              return Promise.resolve({ done: true, value: undefined });
            },
            cancel: vi.fn(async () => undefined),
            releaseLock: vi.fn(),
          }),
        },
      })) as unknown as Response as unknown as typeof fetch;

      const slowCtrl = new AbortController();
      const slowPromise = fetchProtectedBlobFallback('/api/media/references/slow/stream', {
        signal: slowCtrl.signal,
        idleTimeoutMs: 5_000,
      });
      await vi.advanceTimersByTimeAsync(12_500);
      const slowRes = await slowPromise;
      expect(slowRes.isBlobUrl).toBe(true);
      expect(slowRes.resolvedUrl).toBe('blob:http://localhost/ok');

      // 2. Stalled chunk stream stops sending after chunk 1 -> aborts at idle timeout & cancels reader
      createUrlSpy.mockClear();
      const stalledCancelSpy = vi.fn(async () => undefined);
      let stalledAborted = false;
      let stalledReads = 0;
      global.fetch = vi.fn(async (_u, init?: RequestInit) => {
        init?.signal?.addEventListener('abort', () => {
          stalledAborted = true;
        });
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'X-Original-Mime-Type': 'video/mp4' }),
          body: {
            getReader: () => ({
              read: () => {
                stalledReads += 1;
                if (stalledReads === 1) {
                  return Promise.resolve({ done: false, value: new Uint8Array(5) });
                }
                return new Promise(() => {
                  // Intentionally never sends another chunk
                });
              },
              cancel: stalledCancelSpy,
              releaseLock: vi.fn(),
            }),
          },
        } as unknown as Response;
      }) as typeof fetch;

      const stallCtrl = new AbortController();
      const stallErrPromise = fetchProtectedBlobFallback('/api/media/references/stall/stream', {
        signal: stallCtrl.signal,
        idleTimeoutMs: BLOB_FALLBACK_IDLE_TIMEOUT_MS,
      }).catch((err: unknown) => err);
      await vi.advanceTimersByTimeAsync(BLOB_FALLBACK_IDLE_TIMEOUT_MS + 100);
      expect(await stallErrPromise).toMatchObject({
        kind: 'network',
        message: 'BLOB_FALLBACK_IDLE_TIMEOUT',
      });
      expect(stalledCancelSpy).toHaveBeenCalledTimes(1);
      expect(stalledAborted).toBe(true);
      expect(createUrlSpy).not.toHaveBeenCalled();

      // 3. Parent AbortSignal cancels immediately
      const parentCancelSpy = vi.fn(async () => undefined);
      global.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'X-Original-Mime-Type': 'video/mp4' }),
        body: {
          getReader: () => ({
            read: () => new Promise(() => { }),
            cancel: parentCancelSpy,
            releaseLock: vi.fn(),
          }),
        },
      })) as unknown as typeof fetch;

      const parentCtrl = new AbortController();
      const parentErrPromise = fetchProtectedBlobFallback('/api/media/references/abort/stream', {
        signal: parentCtrl.signal,
      }).catch((err: unknown) => err);
      await vi.advanceTimersByTimeAsync(0);
      parentCtrl.abort();
      expect(await parentErrPromise).toMatchObject({ name: 'AbortError' });
      expect(parentCancelSpy).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('aborts fetch and rejects with too_large immediately even when reader.cancel() never settles', async () => {
    document.cookie = 'csrftoken=existing-token; Path=/';
    const createUrlSpy = vi.spyOn(URL, 'createObjectURL');
    const neverSettlingCancel = vi.fn(() => new Promise<void>(() => { }));
    const releaseLockSpy = vi.fn(() => {
      throw new Error('LOCK_CLEANUP_NON_FATAL');
    });
    let fetchAborted = false;

    global.fetch = vi.fn(async (_u, init?: RequestInit) => {
      init?.signal?.addEventListener('abort', () => {
        fetchAborted = true;
      });
      let sent = 0;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'X-Original-Mime-Type': 'video/mp4' }),
        body: {
          getReader: () => ({
            read: async () => {
              sent += 1;
              if (sent === 1) return { done: false, value: new Uint8Array(12) };
              return { done: true, value: undefined };
            },
            cancel: neverSettlingCancel,
            releaseLock: releaseLockSpy,
          }),
        },
      } as unknown as Response;
    }) as typeof fetch;

    const controller = new AbortController();
    await expect(
      fetchProtectedBlobFallback('/api/media/references/hanging-cancel/stream', {
        signal: controller.signal,
        maxBytes: 10,
      })
    ).rejects.toMatchObject({ kind: 'too_large', message: 'BLOB_FALLBACK_TOO_LARGE' });

    expect(fetchAborted).toBe(true);
    expect(neverSettlingCancel).toHaveBeenCalledTimes(1);
    expect(releaseLockSpy).toHaveBeenCalledTimes(1);
    expect(createUrlSpy).not.toHaveBeenCalled();
  });

  it('clamps requested maxBytes above MAX_BLOB_FALLBACK_BYTES (250 MiB) across header, knownSize, and reader paths', async () => {
    document.cookie = 'csrftoken=existing-token; Path=/';

    // 1. Clamp function behavior
    expect(resolveEffectiveBlobMaxBytes(undefined)).toBe(MAX_BLOB_FALLBACK_BYTES);
    expect(resolveEffectiveBlobMaxBytes(1024)).toBe(1024);
    expect(resolveEffectiveBlobMaxBytes(MAX_BLOB_FALLBACK_BYTES)).toBe(MAX_BLOB_FALLBACK_BYTES);
    expect(resolveEffectiveBlobMaxBytes(MAX_BLOB_FALLBACK_BYTES + 1024)).toBe(MAX_BLOB_FALLBACK_BYTES);
    expect(resolveEffectiveBlobMaxBytes(Number.POSITIVE_INFINITY)).toBe(MAX_BLOB_FALLBACK_BYTES);
    expect(resolveEffectiveBlobMaxBytes(-1)).toBe(MAX_BLOB_FALLBACK_BYTES);

    const controller = new AbortController();

    // 2. Oversized knownSizeBytes (> 250 MiB) still rejected even when caller requests larger maxBytes
    await expect(
      fetchProtectedBlobFallback('/api/media/references/oversized-known/stream', {
        signal: controller.signal,
        knownSizeBytes: MAX_BLOB_FALLBACK_BYTES + 1,
        maxBytes: MAX_BLOB_FALLBACK_BYTES * 2,
      })
    ).rejects.toMatchObject({ kind: 'too_large', message: 'BLOB_FALLBACK_TOO_LARGE' });

    // 3. Exactly 250 MiB knownSizeBytes / Content-Length remains eligible (stream completes if actual bytes <= cap)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/exact-cap');
    global.fetch = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: {
          'Content-Length': String(MAX_BLOB_FALLBACK_BYTES),
          'X-Original-Mime-Type': 'video/mp4',
        },
      })
    ) as typeof fetch;

    const exactOk = await fetchProtectedBlobFallback('/api/media/references/exact-cap/stream', {
      signal: controller.signal,
      knownSizeBytes: MAX_BLOB_FALLBACK_BYTES,
      maxBytes: MAX_BLOB_FALLBACK_BYTES * 2,
    });
    expect(exactOk.isBlobUrl).toBe(true);
    expect(exactOk.resolvedUrl).toBe('blob:http://localhost/exact-cap');

    // 4. Reader chunk counting rejects 250 MiB + 1 byte without allocating 250 MiB, even with larger requested maxBytes
    const cancelSpy = vi.fn(async () => undefined);
    const virtual250MiBChunk = new Uint8Array(1);
    Object.defineProperty(virtual250MiBChunk, 'byteLength', { value: MAX_BLOB_FALLBACK_BYTES });
    const plusOneByteChunk = new Uint8Array(1);

    let chunkNum = 0;
    const fakeStreamResp = {
      body: {
        getReader: () => ({
          read: async () => {
            chunkNum += 1;
            if (chunkNum === 1) return { done: false, value: virtual250MiBChunk };
            if (chunkNum === 2) return { done: false, value: plusOneByteChunk };
            return { done: true, value: undefined };
          },
          cancel: cancelSpy,
          releaseLock: vi.fn(),
        }),
      },
    } as unknown as Response;

    let abortedOnReaderCap = false;
    await expect(
      readResponseBodyWithLimit(fakeStreamResp, {
        maxBytes: MAX_BLOB_FALLBACK_BYTES * 4,
        onAbortOrTimeout: () => {
          abortedOnReaderCap = true;
        },
      })
    ).rejects.toMatchObject({ kind: 'too_large', message: 'BLOB_FALLBACK_TOO_LARGE' });

    expect(abortedOnReaderCap).toBe(true);
    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });
});
