import { useState, useEffect, useRef } from 'react';
import type { ContentItemType } from '@/core/courses/types';

export interface AuthenticatedMediaPreviewResult {
  previewUrl: string | undefined;
  isLoading: boolean;
  error: string | null;
}

/**
 * Resolve `/api/media/.../stream` URLs into safe in-browser Blob URLs for `<video>`, `<audio>`,
 * and PDF `<iframe>` previews. Bypasses `403 DIRECT_DOWNLOAD_BLOCKED` (via `X-MetroLMS-Stream: 1`)
 * and `X-Frame-Options: DENY` / IDM interception on PDFs (via `?format=json`).
 */
export function useAuthenticatedMediaPreview(
  rawUrl: string | undefined,
  contentType: ContentItemType | string
): AuthenticatedMediaPreviewResult {
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(rawUrl);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const activeBlobRef = useRef<string | null>(null);

  const isJsdom =
    typeof window !== 'undefined' && window.navigator?.userAgent?.includes('jsdom');
  const needsProtectedFetch = Boolean(
    rawUrl &&
      !isJsdom &&
      rawUrl.startsWith('/api/media/') &&
      (contentType === 'video' || contentType === 'audio' || contentType === 'pdf')
  );

  useEffect(() => {
    let cancelled = false;
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
          } catch {
            // Fallback to raw fetch below unless aborted
          }
          if (!blob && !cancelled) {
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
          const csrfMatch = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
          const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
          const ticketRes = await fetch('/api/media/stream-ticket', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
            },
            body: JSON.stringify({ url: rawUrl }),
            signal: controller.signal,
          });
          if (ticketRes.ok) {
            const ticketJson = await ticketRes.json();
            const streamUrl = ticketJson?.data?.streamUrl;
            if (streamUrl && !cancelled) {
              setResolvedUrl(streamUrl);
              return;
            }
          }
          const streamRes = await fetch(rawUrl, {
            method: 'GET',
            credentials: 'include',
            headers: { 'X-MetroLMS-Stream': '1' },
            signal: controller.signal,
          });
          if (!streamRes.ok || streamRes.status === 204) {
            throw new Error(`HTTP ${streamRes.status}`);
          }
          const mime =
            streamRes.headers.get('X-Original-Mime-Type') ||
            (contentType === 'audio' ? 'audio/mpeg' : 'video/mp4');
          const buffer = await streamRes.arrayBuffer();
          if (!buffer || buffer.byteLength === 0) {
            throw new Error('EMPTY_STREAM');
          }
          blob = new Blob([buffer], { type: mime });
        }

        if (cancelled || !blob) return;
        const objectUrl = URL.createObjectURL(blob);
        activeBlobRef.current = objectUrl;
        setResolvedUrl(objectUrl);
      } catch (err: unknown) {
        if (cancelled || (err instanceof Error && err.name === 'AbortError')) return;
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
  }, [rawUrl, contentType, needsProtectedFetch]);

  return { previewUrl: needsProtectedFetch ? resolvedUrl : rawUrl, isLoading, error };
}
