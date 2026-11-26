import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import {
  MAX_BLOB_FALLBACK_BYTES,
  resolveProtectedMediaStream,
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
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
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

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
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

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
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
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'X-Original-Mime-Type': 'video/mp4' }),
            arrayBuffer: async () => new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]).buffer,
          } as Response;
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
});
