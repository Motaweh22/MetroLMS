import { useState, useEffect, useRef, useCallback } from 'react';
import type { ContentItemType } from '@/core/courses/types';
import { isAbortError, resolveProtectedMediaStream } from './protectedMediaStream';

export interface AuthenticatedMediaPreviewResult {
  previewUrl: string | undefined;
  isLoading: boolean;
  error: string | null;
  fallbackToBlob: () => boolean;
}

/**
 * Resolve `/api/media/.../stream` URLs into safe in-browser stream or Blob URLs for `<video>`, `<audio>`,
 * and PDF `<iframe>` previews. Bypasses `403 DIRECT_DOWNLOAD_BLOCKED` (via stream tickets / `X-MetroLMS-Stream: 1`)
 * and `X-Frame-Options: DENY` / IDM interception on PDFs (via `?format=json`).
 */
export function useAuthenticatedMediaPreview(
  rawUrl: string | undefined,
  contentType: ContentItemType | string
): AuthenticatedMediaPreviewResult {
  const streamKey = `${rawUrl || ''}::${contentType}`;
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(rawUrl);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [blobFallbackKey, setBlobFallbackKey] = useState<string | null>(null);
  const activeBlobRef = useRef<string | null>(null);
  const usedStreamTicketRef = useRef<boolean>(false);

  const isJsdom =
    typeof window !== 'undefined' && window.navigator?.userAgent?.includes('jsdom');
  const needsProtectedFetch = Boolean(
    rawUrl &&
    !isJsdom &&
    rawUrl.startsWith('/api/media/') &&
    (contentType === 'video' || contentType === 'audio' || contentType === 'pdf')
  );
  const preferBlobFallback = blobFallbackKey === streamKey;

  const fallbackToBlob = useCallback((): boolean => {
    if (usedStreamTicketRef.current && blobFallbackKey !== streamKey) {
      setBlobFallbackKey(streamKey);
      return true;
    }
    return false;
  }, [blobFallbackKey, streamKey]);

  useEffect(() => {
    let cancelled = false;
    usedStreamTicketRef.current = false;
    if (activeBlobRef.current) {
      URL.revokeObjectURL(activeBlobRef.current);
      activeBlobRef.current = null;
    }

    if (!rawUrl || !needsProtectedFetch) {
      setResolvedUrl(rawUrl);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setResolvedUrl(undefined);

    const loadMedia = async () => {
      try {
        let blob: Blob | null = null;

        if (contentType === 'pdf') {
          const jsonUrl = rawUrl.includes('format=json')
            ? rawUrl
            : `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}format=json`;
          try {
            const jsonRes = await fetch(jsonUrl, {
              credentials: 'include',
              headers: { Accept: 'application/json' },
              signal: controller.signal,
            });
            if (jsonRes.ok && (jsonRes.headers.get('content-type') || '').includes('application/json')) {
              const payload = await jsonRes.json();
              if (payload?.base64) {
                const bin = atob(payload.base64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i += 1) {
                  bytes[i] = bin.charCodeAt(i);
                }
                blob = new Blob([bytes], { type: payload.mimeType || 'application/pdf' });
              }
            }
          } catch (err) {
            if (isAbortError(err, controller.signal)) throw err;
            // Fallback to raw fetch below unless aborted
          }
          if (!blob && !cancelled && !controller.signal.aborted) {
            const rawRes = await fetch(rawUrl, {
              credentials: 'include',
              signal: controller.signal,
            });
            if (!rawRes.ok || rawRes.status === 204) {
              throw new Error(`HTTP ${rawRes.status}`);
            }
            blob = await rawRes.blob();
          }
        } else if (contentType === 'video' || contentType === 'audio') {
          const result = await resolveProtectedMediaStream(rawUrl, {
            signal: controller.signal,
            defaultMimeType: contentType === 'audio' ? 'audio/mpeg' : 'video/mp4',
            preferBlobFallback,
          });
          if (cancelled) {
            if (result.isBlobUrl) URL.revokeObjectURL(result.resolvedUrl);
            return;
          }
          usedStreamTicketRef.current = result.usedStreamTicket;
          if (result.isBlobUrl) {
            activeBlobRef.current = result.resolvedUrl;
          }
          setResolvedUrl(result.resolvedUrl);
          return;
        }

        if (cancelled || !blob) return;
        const objectUrl = URL.createObjectURL(blob);
        activeBlobRef.current = objectUrl;
        setResolvedUrl(objectUrl);
      } catch (err: unknown) {
        if (cancelled || isAbortError(err, controller.signal)) return;
        setError('تعذر تحميل معاينة الملف المرفوع.');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadMedia();

    return () => {
      cancelled = true;
      controller.abort();
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
        activeBlobRef.current = null;
      }
    };
  }, [rawUrl, contentType, needsProtectedFetch, preferBlobFallback]);

  return { previewUrl: needsProtectedFetch ? resolvedUrl : rawUrl, isLoading, error, fallbackToBlob };
}
