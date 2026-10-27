import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '@/shared/ui/Icon/Icon';
import { Button } from '@/shared/ui/Button/Button';
import type { EnrichedChapterItem } from '../types';

export interface DocumentViewerProps {
  item: EnrichedChapterItem;
  isCompleted?: boolean;
  isSubmitting?: boolean;
  onComplete: (itemId: string) => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  item,
  isCompleted = false,
  isSubmitting = false,
  onComplete,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(5);
  const [canMarkComplete, setCanMarkComplete] = useState<boolean>(isCompleted);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [documentBlobUrl, setDocumentBlobUrl] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);

  // Load document content safely into an in-memory blob URL
  // This bypasses browser download manager extensions (such as IDM) that intercept raw PDF HTTP streams
  useEffect(() => {
    let isCancelled = false;

    // Helper to cleanup previous blob URL
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }

    if (!item.url) {
      setHasError(true);
      setIsLoading(false);
      setDocumentBlobUrl(null);
      return;
    }

    const docUrl = item.url;

    // If item.url is already a blob: or data: URL, use it directly
    if (docUrl.startsWith('blob:') || docUrl.startsWith('data:')) {
      setDocumentBlobUrl(docUrl);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    // In JSDOM / test environments, use direct item.url without network fetch
    if (typeof window !== 'undefined' && window.navigator?.userAgent?.includes('jsdom')) {
      setDocumentBlobUrl(docUrl);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    const loadDocument = async () => {
      try {
        let blob: Blob | null = null;

        // Strategy 1: Attempt JSON base64 format (immune to browser download manager hooks)
        const jsonUrl = docUrl.includes('format=json')
          ? docUrl
          : `${docUrl}${docUrl.includes('?') ? '&' : '?'}format=json`;

        try {
          const jsonRes = await fetch(jsonUrl, {
            headers: { Accept: 'application/json' },
          });

          if (jsonRes.ok) {
            const contentType = jsonRes.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const data = await jsonRes.json();
              if (data?.base64) {
                const byteCharacters = atob(data.base64);
                const byteNumbers = new Uint8Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                blob = new Blob([byteNumbers], { type: 'application/pdf' });
              }
            }
          }
        } catch {
          // JSON format not supported by endpoint; proceed to raw stream
        }

        // Strategy 2: If JSON wasn't available, fetch raw binary stream directly
        if (!blob) {
          const res = await fetch(docUrl);
          // Check for download manager interception (status 204 or empty response)
          if (res.status === 204 || !res.ok) {
            throw new Error(`تعذر استلام بيانات المستند (رمز الحالة: ${res.status})`);
          }
          const rawBlob = await res.blob();
          if (rawBlob.size === 0) {
            throw new Error('ملف المستند فارغ أو تم اعتراضه');
          }
          blob = rawBlob;
        }

        if (isCancelled) return;

        const blobUrl = URL.createObjectURL(blob);
        activeBlobUrlRef.current = blobUrl;
        setDocumentBlobUrl(blobUrl);
        setIsLoading(false);
        setHasError(false);
      } catch (err) {
        if (isCancelled) return;
        console.warn('DocumentViewer blob loading failed, falling back to direct URL:', err);
        // Fallback: attempt direct item.url
        setDocumentBlobUrl(docUrl);
        setIsLoading(false);
      }
    };

    loadDocument();

    return () => {
      isCancelled = true;
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, [item.id, item.url, reloadTrigger]);

  // Reset timer whenever the lesson item changes
  useEffect(() => {
    if (isCompleted) {
      setSecondsRemaining(0);
      setCanMarkComplete(true);
      return;
    }

    setSecondsRemaining(5);
    setCanMarkComplete(false);

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setCanMarkComplete(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [item.id, isCompleted]);

  const handleManualComplete = () => {
    if (!canMarkComplete || isSubmitting) return;
    onComplete(item.id);
  };

  const handleRetry = useCallback(() => {
    setHasError(false);
    setDocumentBlobUrl(null);
    setReloadTrigger((prev) => prev + 1);
  }, []);

  return (
    <div className="document-viewer-container" role="region" aria-label={`عارض المستند: ${item.title}`}>
      {/* Document Header Bar */}
      <div className="document-header-bar">
        <div className="document-title-meta">
          <Icon name="fileText" size="lg" className="text-primary-light" />
          <span>{item.title}</span>
        </div>

        <div className="document-actions">
          {/* Download button enabled strictly if canDownload === true */}
          {item.canDownload && (
            <a
              href={documentBlobUrl || item.url || '#'}
              download={`${item.title}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="ctrl-btn"
              title="تحميل المستند PDF"
              aria-label="تحميل المستند PDF"
            >
              <Icon name="download" size="md" />
            </a>
          )}
        </div>
      </div>

      {/* Embedded Document Frame, Loading, or Error Fallback */}
      {!item.url || hasError ? (
        <div className="video-error-state" style={{ flex: 1 }}>
          <Icon name="alertCircle" size={48} className="text-warning-dark" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
            المستند غير متوفر حالياً
          </h3>
          <p>تعذر فتح ملف المستند المطلوب، يرجى مراجعة المحاضر أو المحاولة في وقت لاحق.</p>
          <Button variant="secondary" size="sm" onClick={handleRetry}>
            إعادة المحاولة
          </Button>
        </div>
      ) : isLoading ? (
        <div className="video-buffering-overlay" style={{ background: '#0F172A', flex: 1 }}>
          <div className="buffering-spinner" />
          <span style={{ color: '#94A3B8', fontSize: '0.9rem' }}>جارٍ تحميل المستند...</span>
        </div>
      ) : (
        <iframe
          src={documentBlobUrl || item.url}
          title={item.title}
          className="document-frame"
          onError={() => setHasError(true)}
        />
      )}

      {/* 5-Second Reading Timer & Manual Completion Bar */}
      <div className="document-timer-box">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', color: '#CBD5E1' }}>
          {isCompleted ? (
            <span style={{ color: '#4ADE80', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
              <Icon name="checkCircle" size="md" />
              أتممت قراءة هذا المستند بنجاح
            </span>
          ) : secondsRemaining > 0 ? (
            <span style={{ color: '#94A3B8' }}>
              يرجى قراءة المستند ({secondsRemaining} ثوانٍ لتفعيل زر الإكمال)
            </span>
          ) : (
            <span style={{ color: '#38BDF8' }}>
              يمكنك الآن تأكيد إكمال قراءة المستند
            </span>
          )}
        </div>

        {!isCompleted && (
          <Button
            variant="primary"
            size="sm"
            disabled={!canMarkComplete || isSubmitting}
            isLoading={isSubmitting}
            onClick={handleManualComplete}
          >
            تحديد كمكتمل
          </Button>
        )}
      </div>
    </div>
  );
};
