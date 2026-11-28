/**
 * Shared protected media stream resolver for `/api/media/.../stream` endpoints.
 * Prefers progressive Range streaming (`POST /api/media/stream-ticket` -> `?st=`),
 * provides bounded `HEAD` stream access diagnosis without downloading media bytes,
 * and offers an opt-in authenticated `Blob` fallback (`X-MetroLMS-Stream: 1`) strictly
 * capped at `MAX_BLOB_FALLBACK_BYTES`.
 */

export const MAX_BLOB_FALLBACK_BYTES = 250 * 1024 * 1024; // 250 MB safety cap
export const STREAM_REQUEST_TIMEOUT_MS = 10_000; // 10s bounded timeout for ticket/HEAD requests
/**
 * 15s per-chunk / header idle timeout for Blob fallback fetches.
 * Kept separate from the 10s HEAD/ticket timeout so legitimate slow transfers up to 250 MB
 * continue cleanly while chunks arrive, yet stalled connections abort without hanging recovery.
 */
export const BLOB_FALLBACK_IDLE_TIMEOUT_MS = 15_000;

export type ProtectedStreamFailureKind =
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'network'
  | 'too_large'
  | 'invalid';

export class ProtectedStreamError extends Error {
  readonly kind: ProtectedStreamFailureKind;
  readonly statusCode?: number;
  readonly errorCode?: string;

  constructor(
    kind: ProtectedStreamFailureKind,
    message: string,
    options?: { statusCode?: number; errorCode?: string }
  ) {
    super(message);
    this.name = 'ProtectedStreamError';
    this.kind = kind;
    this.statusCode = options?.statusCode;
    this.errorCode = options?.errorCode;
  }
}

export interface ResolvedProtectedMediaStream {
  resolvedUrl: string;
  isBlobUrl: boolean;
  usedStreamTicket: boolean;
}

export interface StreamTicketResult {
  streamUrl: string;
  usedStreamTicket: true;
}

export interface StreamDiagnosisResult {
  outcome: 'valid' | 'auth' | 'forbidden' | 'not_found' | 'network';
  statusCode?: number;
  contentLength?: number;
  contentType?: string;
  canRenewTicket: boolean;
  /** True only when HEAD explicitly confirmed `Content-Length <= MAX_BLOB_FALLBACK_BYTES`. */
  canConsiderBlobFallback: boolean;
  /** True when HEAD explicitly confirmed `Content-Length > MAX_BLOB_FALLBACK_BYTES`. */
  isKnownOversizedForBlob: boolean;
}

export function isAbortError(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: unknown }).name;
  return name === 'AbortError';
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
}

function createBoundedSignal(
  parentSignal: AbortSignal | undefined,
  timeoutMs: number
): {
  signal: AbortSignal;
  wasTimedOut: () => boolean;
  cleanup: () => void;
} {
  const controller = new AbortController();
  let timedOut = false;

  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs)
      : null;

  return {
    signal: controller.signal,
    wasTimedOut: () => timedOut,
    cleanup: () => {
      if (timer !== null) clearTimeout(timer);
      if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort);
    },
  };
}

function mapHttpStatusToFailureKind(status: number): ProtectedStreamFailureKind {
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  return 'network';
}

async function safeReadBackendErrorCode(res: Response): Promise<string | undefined> {
  try {
    const contentType = res.headers?.get?.('content-type') || '';
    if (!contentType.includes('application/json') || typeof res.json !== 'function') {
      return undefined;
    }
    const body = (await res.json()) as { code?: unknown };
    return typeof body?.code === 'string' ? body.code : undefined;
  } catch {
    return undefined;
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
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    });
  } catch (err) {
    if (isAbortError(err, signal)) throw err;
  }
  throwIfAborted(signal);
  return readCsrfCookie();
}

/**
 * Request a fresh user-bound progressive streaming ticket (`POST /api/media/stream-ticket`).
 * Never triggers a Blob download; throws `ProtectedStreamError` with classified failure kind
 * or rethrows `AbortError` when cancelled by the caller.
 */
export async function requestProtectedStreamTicket(
  url: string,
  options?: {
    signal?: AbortSignal;
    timeoutMs?: number;
  }
): Promise<StreamTicketResult> {
  const parentSignal = options?.signal;
  const timeoutMs = options?.timeoutMs ?? STREAM_REQUEST_TIMEOUT_MS;
  throwIfAborted(parentSignal);

  const bounded = createBoundedSignal(parentSignal, timeoutMs);
  try {
    const csrfToken = await ensureCsrfToken(bounded.signal);
    throwIfAborted(parentSignal);

    const ticketRes = await fetch('/api/media/stream-ticket', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
      },
      body: JSON.stringify({ url }),
      signal: bounded.signal,
    });
    throwIfAborted(parentSignal);

    if (!ticketRes.ok) {
      const errorCode = await safeReadBackendErrorCode(ticketRes);
      throwIfAborted(parentSignal);
      throw new ProtectedStreamError(
        mapHttpStatusToFailureKind(ticketRes.status),
        `HTTP ${ticketRes.status}`,
        { statusCode: ticketRes.status, errorCode }
      );
    }

    const ticketJson = (await ticketRes.json()) as { data?: { streamUrl?: unknown } };
    throwIfAborted(parentSignal);
    const streamUrl = typeof ticketJson?.data?.streamUrl === 'string' ? ticketJson.data.streamUrl : '';
    if (!streamUrl) {
      throw new ProtectedStreamError('invalid', 'MISSING_STREAM_URL');
    }

    return {
      streamUrl,
      usedStreamTicket: true,
    };
  } catch (err) {
    if (parentSignal?.aborted) {
      throw err;
    }
    if (bounded.wasTimedOut()) {
      throw new ProtectedStreamError('network', 'STREAM_TICKET_TIMEOUT');
    }
    if (isAbortError(err)) {
      throw err;
    }
    if (err instanceof ProtectedStreamError) {
      throw err;
    }
    throw new ProtectedStreamError('network', 'STREAM_TICKET_NETWORK_ERROR');
  } finally {
    bounded.cleanup();
  }
}

/**
 * Probe the current protected stream endpoint via authenticated `HEAD` to diagnose
 * access, resource existence, or network reachability without downloading media bytes
 * or exposing stream tickets.
 */
export async function diagnoseProtectedMediaStream(
  streamUrl: string,
  options?: {
    signal?: AbortSignal;
    timeoutMs?: number;
  }
): Promise<StreamDiagnosisResult> {
  const parentSignal = options?.signal;
  const timeoutMs = options?.timeoutMs ?? STREAM_REQUEST_TIMEOUT_MS;
  throwIfAborted(parentSignal);

  const bounded = createBoundedSignal(parentSignal, timeoutMs);
  try {
    const res = await fetch(streamUrl, {
      method: 'HEAD',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: bounded.signal,
    });
    throwIfAborted(parentSignal);

    const rawLen = res.headers?.get?.('Content-Length');
    const parsedLen = rawLen !== null && rawLen !== undefined && rawLen !== '' ? Number(rawLen) : undefined;
    const contentLength =
      parsedLen !== undefined && Number.isFinite(parsedLen) && parsedLen >= 0 ? parsedLen : undefined;
    const contentType = res.headers?.get?.('Content-Type') || undefined;

    if (res.ok) {
      return {
        outcome: 'valid',
        statusCode: res.status,
        contentLength,
        contentType,
        canRenewTicket: true,
        // Never treat unknown Content-Length as proof that Blob fallback is safe
        canConsiderBlobFallback:
          contentLength !== undefined && contentLength <= MAX_BLOB_FALLBACK_BYTES,
        isKnownOversizedForBlob:
          contentLength !== undefined && contentLength > MAX_BLOB_FALLBACK_BYTES,
      };
    }

    if (res.status === 401) {
      return {
        outcome: 'auth',
        statusCode: 401,
        canRenewTicket: false,
        canConsiderBlobFallback: false,
        isKnownOversizedForBlob: false,
      };
    }

    if (res.status === 403) {
      // A 403 on HEAD may reflect an expired/invalid ticket (`st`); renewing via stream-ticket disambiguates safely.
      return {
        outcome: 'forbidden',
        statusCode: 403,
        canRenewTicket: true,
        canConsiderBlobFallback: false,
        isKnownOversizedForBlob: false,
      };
    }

    if (res.status === 404) {
      return {
        outcome: 'not_found',
        statusCode: 404,
        canRenewTicket: false,
        canConsiderBlobFallback: false,
        isKnownOversizedForBlob: false,
      };
    }

    return {
      outcome: 'network',
      statusCode: res.status,
      canRenewTicket: true,
      canConsiderBlobFallback: false,
      isKnownOversizedForBlob: false,
    };
  } catch (err) {
    if (parentSignal?.aborted) {
      throw err;
    }
    if (isAbortError(err) && !bounded.wasTimedOut()) {
      throw err;
    }
    return {
      outcome: 'network',
      canRenewTicket: true,
      canConsiderBlobFallback: false,
      isKnownOversizedForBlob: false,
    };
  } finally {
    bounded.cleanup();
  }
}

async function safeCancelReader(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // Ignore cancellation errors when stream is already closed or errored
  }
}

/**
 * Clamp any requested Blob byte limit to the immutable production ceiling (`MAX_BLOB_FALLBACK_BYTES`).
 * Allows smaller limits in tests while preventing any caller from raising the 250 MiB cap.
 */
export function resolveEffectiveBlobMaxBytes(requestedMaxBytes?: number): number {
  if (
    requestedMaxBytes === undefined ||
    !Number.isFinite(requestedMaxBytes) ||
    requestedMaxBytes < 0
  ) {
    return MAX_BLOB_FALLBACK_BYTES;
  }
  return Math.min(requestedMaxBytes, MAX_BLOB_FALLBACK_BYTES);
}

/**
 * Incrementally read a `Response` body using `ReadableStream.getReader()`, resetting an idle
 * watchdog on every received chunk and cancelling/aborting immediately if total bytes exceed
 * `effectiveMaxBytes`. Fails safely if `ReadableStream` is unavailable rather than calling `.blob()`.
 */
export async function readResponseBodyWithLimit(
  response: Response,
  options: {
    maxBytes?: number;
    idleTimeoutMs?: number;
    signal?: AbortSignal;
    onAbortOrTimeout?: () => void;
    mimeType?: string;
  } = {}
): Promise<Blob> {
  const {
    maxBytes,
    idleTimeoutMs = BLOB_FALLBACK_IDLE_TIMEOUT_MS,
    signal,
    onAbortOrTimeout,
    mimeType = 'video/mp4',
  } = options;
  const effectiveMaxBytes = resolveEffectiveBlobMaxBytes(maxBytes);

  throwIfAborted(signal);

  const reader =
    response.body && typeof response.body.getReader === 'function'
      ? response.body.getReader()
      : null;
  if (!reader) {
    onAbortOrTimeout?.();
    throw new ProtectedStreamError('invalid', 'STREAM_READER_UNAVAILABLE');
  }

  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let totalBytes = 0;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let rejectPendingRead: ((reason: unknown) => void) | null = null;
  let abortedBySignal = false;
  let idleTimedOut = false;
  let overflowed = false;

  const clearIdleTimer = () => {
    if (idleTimer !== null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const armIdleTimer = () => {
    clearIdleTimer();
    if (idleTimeoutMs <= 0) return;
    idleTimer = setTimeout(() => {
      idleTimer = null;
      idleTimedOut = true;
      onAbortOrTimeout?.();
      void safeCancelReader(reader);
      const reject = rejectPendingRead;
      rejectPendingRead = null;
      reject?.(new ProtectedStreamError('network', 'BLOB_FALLBACK_IDLE_TIMEOUT'));
    }, idleTimeoutMs);
  };

  const onSignalAbort = () => {
    if (idleTimedOut || overflowed) return;
    abortedBySignal = true;
    clearIdleTimer();
    void safeCancelReader(reader);
    const reject = rejectPendingRead;
    rejectPendingRead = null;
    reject?.(new DOMException('The operation was aborted.', 'AbortError'));
  };

  if (signal) {
    signal.addEventListener('abort', onSignalAbort, { once: true });
  }

  try {
    while (true) {
      throwIfAborted(signal);
      if (abortedBySignal) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }
      if (idleTimedOut) {
        throw new ProtectedStreamError('network', 'BLOB_FALLBACK_IDLE_TIMEOUT');
      }

      const abortOrTimeoutRace = new Promise<never>((_resolve, reject) => {
        rejectPendingRead = reject;
      });

      armIdleTimer();
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await Promise.race([reader.read(), abortOrTimeoutRace]);
      } finally {
        rejectPendingRead = null;
        clearIdleTimer();
      }

      if (idleTimedOut) {
        throw new ProtectedStreamError('network', 'BLOB_FALLBACK_IDLE_TIMEOUT');
      }
      if (abortedBySignal || signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }

      if (result.done) {
        break;
      }

      const rawValue = result.value;
      if (!rawValue || rawValue.byteLength === 0) {
        continue;
      }

      if (totalBytes + rawValue.byteLength > effectiveMaxBytes) {
        overflowed = true;
        clearIdleTimer();
        onAbortOrTimeout?.();
        void safeCancelReader(reader);
        throw new ProtectedStreamError('too_large', 'BLOB_FALLBACK_TOO_LARGE');
      }

      totalBytes += rawValue.byteLength;
      chunks.push(new Uint8Array(rawValue));
    }

    if (totalBytes === 0) {
      throw new ProtectedStreamError('invalid', 'EMPTY_STREAM');
    }

    return new Blob(chunks, { type: mimeType });
  } finally {
    clearIdleTimer();
    rejectPendingRead = null;
    if (signal) {
      signal.removeEventListener('abort', onSignalAbort);
    }
    try {
      reader.releaseLock();
    } catch {
      // Reader already released
    }
  }
}

/**
 * Fetch an authenticated protected media stream as an in-memory Blob URL strictly
 * capped at `MAX_BLOB_FALLBACK_BYTES` during incremental stream reading and guarded
 * by a per-chunk/header idle timeout.
 */
export async function fetchProtectedBlobFallback(
  url: string,
  options: {
    signal: AbortSignal;
    defaultMimeType?: string;
    knownSizeBytes?: number;
    maxBytes?: number;
    idleTimeoutMs?: number;
  }
): Promise<ResolvedProtectedMediaStream> {
  const {
    signal,
    defaultMimeType = 'video/mp4',
    knownSizeBytes,
    maxBytes,
    idleTimeoutMs = BLOB_FALLBACK_IDLE_TIMEOUT_MS,
  } = options;
  throwIfAborted(signal);
  const effectiveMaxBytes = resolveEffectiveBlobMaxBytes(maxBytes);

  if (knownSizeBytes !== undefined && Number.isFinite(knownSizeBytes) && knownSizeBytes > effectiveMaxBytes) {
    throw new ProtectedStreamError('too_large', 'BLOB_FALLBACK_TOO_LARGE');
  }

  const fallbackController = new AbortController();
  let headerTimedOut = false;
  let headerTimer: ReturnType<typeof setTimeout> | null = null;
  const clearHeaderTimer = () => {
    if (headerTimer !== null) {
      clearTimeout(headerTimer);
      headerTimer = null;
    }
  };

  const onParentAbort = () => {
    clearHeaderTimer();
    fallbackController.abort();
  };
  signal.addEventListener('abort', onParentAbort, { once: true });

  if (idleTimeoutMs > 0) {
    headerTimer = setTimeout(() => {
      headerTimer = null;
      headerTimedOut = true;
      fallbackController.abort();
    }, idleTimeoutMs);
  }

  try {
    let streamRes: Response;
    try {
      streamRes = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'X-MetroLMS-Stream': '1' },
        signal: fallbackController.signal,
      });
    } finally {
      clearHeaderTimer();
    }

    throwIfAborted(signal);
    if (headerTimedOut) {
      throw new ProtectedStreamError('network', 'BLOB_FALLBACK_IDLE_TIMEOUT');
    }

    if (!streamRes.ok || streamRes.status === 204) {
      const errorCode = await safeReadBackendErrorCode(streamRes);
      throw new ProtectedStreamError(
        mapHttpStatusToFailureKind(streamRes.status),
        `HTTP ${streamRes.status}`,
        { statusCode: streamRes.status, errorCode }
      );
    }

    const declaredSize = Number(streamRes.headers.get('Content-Length') || 0);
    if (Number.isFinite(declaredSize) && declaredSize > effectiveMaxBytes) {
      fallbackController.abort();
      throw new ProtectedStreamError('too_large', 'BLOB_FALLBACK_TOO_LARGE');
    }

    const mime = streamRes.headers.get('X-Original-Mime-Type') || defaultMimeType;
    const blob = await readResponseBodyWithLimit(streamRes, {
      maxBytes: effectiveMaxBytes,
      idleTimeoutMs,
      signal: fallbackController.signal,
      onAbortOrTimeout: () => fallbackController.abort(),
      mimeType: mime,
    });
    throwIfAborted(signal);

    return {
      resolvedUrl: URL.createObjectURL(blob),
      isBlobUrl: true,
      usedStreamTicket: false,
    };
  } catch (err) {
    if (signal.aborted || isAbortError(err, signal)) {
      throw err;
    }
    if (headerTimedOut) {
      throw new ProtectedStreamError('network', 'BLOB_FALLBACK_IDLE_TIMEOUT');
    }
    if (err instanceof ProtectedStreamError) {
      throw err;
    }
    throw new ProtectedStreamError('network', 'BLOB_FALLBACK_NETWORK_ERROR');
  } finally {
    clearHeaderTimer();
    signal.removeEventListener('abort', onParentAbort);
  }
}

export async function resolveProtectedMediaStream(
  url: string,
  options: {
    signal: AbortSignal;
    defaultMimeType?: string;
    preferBlobFallback?: boolean;
    allowBlobFallback?: boolean;
  }
): Promise<ResolvedProtectedMediaStream> {
  const {
    signal,
    defaultMimeType = 'video/mp4',
    preferBlobFallback = false,
    allowBlobFallback = true,
  } = options;
  throwIfAborted(signal);

  if (!preferBlobFallback) {
    try {
      const ticketResult = await requestProtectedStreamTicket(url, { signal });
      return {
        resolvedUrl: ticketResult.streamUrl,
        isBlobUrl: false,
        usedStreamTicket: true,
      };
    } catch (err) {
      if (isAbortError(err, signal)) throw err;
      if (!allowBlobFallback) throw err;
      // Preserve explicit Blob fallback for eligible callers (e.g. small media preview fallbacks)
    }
  }

  if (!allowBlobFallback) {
    throw new ProtectedStreamError('network', 'BLOB_FALLBACK_DISABLED');
  }

  return fetchProtectedBlobFallback(url, { signal, defaultMimeType });
}
