/**
 * Shared protected media stream resolver for `/api/media/.../stream` endpoints.
 * Prefers progressive Range streaming (`POST /api/media/stream-ticket` -> `?st=`)
 * and transparently falls back to authenticated `fetch` (`X-MetroLMS-Stream: 1`)
 * -> in-memory `Blob` URL (bounded by `MAX_BLOB_FALLBACK_BYTES`) when `<video>`
 * direct streaming fails on client devices.
 */

export const MAX_BLOB_FALLBACK_BYTES = 250 * 1024 * 1024; // 250 MB safety cap

export interface ResolvedProtectedMediaStream {
  resolvedUrl: string;
  isBlobUrl: boolean;
  usedStreamTicket: boolean;
}

export function isAbortError(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: unknown }).name;
  return name === 'AbortError';
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
}

export function readCsrfCookie(): string {
  if (typeof document === 'undefined' || !document.cookie) return '';
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  if (!match || !match[1]) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export async function ensureCsrfToken(signal?: AbortSignal): Promise<string> {
  const existing = readCsrfCookie();
  if (existing) return existing;
  try {
    await fetch('/api/auth/csrf', {
      method: 'GET',
      credentials: 'include',
      signal,
    });
  } catch (err) {
    if (isAbortError(err, signal)) throw err;
  }
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
  return readCsrfCookie();
}

export async function resolveProtectedMediaStream(
  url: string,
  options: {
    signal: AbortSignal;
    defaultMimeType?: string;
    preferBlobFallback?: boolean;
  }
): Promise<ResolvedProtectedMediaStream> {
  const { signal, defaultMimeType = 'video/mp4', preferBlobFallback = false } = options;
  throwIfAborted(signal);

  if (!preferBlobFallback) {
    try {
      const csrfToken = await ensureCsrfToken(signal);
      throwIfAborted(signal);

      const ticketRes = await fetch('/api/media/stream-ticket', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
        },
        body: JSON.stringify({ url }),
        signal,
      });
      throwIfAborted(signal);

      if (ticketRes.ok) {
        const ticketJson = await ticketRes.json();
        throwIfAborted(signal);
        const streamUrl = ticketJson?.data?.streamUrl;
        if (streamUrl) {
          return {
            resolvedUrl: streamUrl,
            isBlobUrl: false,
            usedStreamTicket: true,
          };
        }
      }
    } catch (err) {
      if (isAbortError(err, signal)) throw err;
      // Fall through to authenticated Blob stream fallback on non-abort failures
    }
  }

  throwIfAborted(signal);

  // Tie an internal AbortController to parent signal so oversized fallback responses can cancel immediately
  const fallbackController = new AbortController();
  const onParentAbort = () => fallbackController.abort();
  signal.addEventListener('abort', onParentAbort, { once: true });

  try {
    const streamRes = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'X-MetroLMS-Stream': '1' },
      signal: fallbackController.signal,
    });
    throwIfAborted(signal);

    if (!streamRes.ok || streamRes.status === 204) {
      throw new Error(`HTTP ${streamRes.status}`);
    }

    const declaredSize = Number(streamRes.headers.get('Content-Length') || 0);
    if (Number.isFinite(declaredSize) && declaredSize > MAX_BLOB_FALLBACK_BYTES) {
      fallbackController.abort();
      throw new Error('BLOB_FALLBACK_TOO_LARGE');
    }

    const mime = streamRes.headers.get('X-Original-Mime-Type') || defaultMimeType;
    let blob: Blob;
    if (typeof streamRes.blob === 'function') {
      const rawBlob = await streamRes.blob();
      throwIfAborted(signal);
      if (!rawBlob || rawBlob.size === 0) {
        throw new Error('EMPTY_STREAM');
      }
      if (rawBlob.size > MAX_BLOB_FALLBACK_BYTES) {
        throw new Error('BLOB_FALLBACK_TOO_LARGE');
      }
      blob = rawBlob.type === mime ? rawBlob : rawBlob.slice(0, rawBlob.size, mime);
    } else {
      const buffer = await streamRes.arrayBuffer();
      throwIfAborted(signal);
      if (!buffer || buffer.byteLength === 0) {
        throw new Error('EMPTY_STREAM');
      }
      if (buffer.byteLength > MAX_BLOB_FALLBACK_BYTES) {
        throw new Error('BLOB_FALLBACK_TOO_LARGE');
      }
      blob = new Blob([buffer], { type: mime });
    }

    return {
      resolvedUrl: URL.createObjectURL(blob),
      isBlobUrl: true,
      usedStreamTicket: false,
    };
  } finally {
    signal.removeEventListener('abort', onParentAbort);
  }
}
