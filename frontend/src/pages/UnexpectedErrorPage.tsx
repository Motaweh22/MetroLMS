import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { sanitizeErrorMessage } from '@/core/api/apiClient';

export interface UnexpectedErrorPageProps {
  /** Internal or caught error object */
  error?: unknown;
  /** Custom error code/status if known (e.g. 500, 502, 503) */
  status?: number;
  /** Optional retry callback */
  onRetry?: () => void;
  /** Error identifier for support */
  errorId?: string;
}

/**
 * Centrally Managed 500 / Unexpected Error Page
 *
 * Catches top-level routing or application errors, presents a clear localized message,
 * provides safe recovery without exposing sensitive stack traces or tokens.
 */
export const UnexpectedErrorPage: React.FC<UnexpectedErrorPageProps> = ({
  error,
  status = 500,
  onRetry,
  errorId: customErrorId,
}) => {

  const fallbackErrorId = React.useMemo(() => {
    if (customErrorId) return customErrorId;
    return `ERR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }, [customErrorId]);

  const rawMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : null;
  const isServerHttpError = status >= 500 && status < 600;

  const displayTitle = isServerHttpError
    ? `خطأ في استجابة الخادم (${status})`
    : 'حدث خطأ غير متوقع في المنظومة';

  const defaultDescription = isServerHttpError
    ? 'تعذر على خادم التدريب معالجة الطلب في الوقت الحالي. تم تسجيل الخلل ويمكنك محاولة إعادة التحميل بعد قليل.'
    : 'نعتذر عن هذا الخلل المؤقت. حدث خطأ تقني غير متوقع أثناء تحميل أو معالجة الصفحة.';

  const safeMessage = sanitizeErrorMessage(rawMessage, defaultDescription);

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      dir="rtl"
      data-testid="unexpected-error-page"
      className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-12 text-center select-none"
    >
      <div className="w-16 h-16 rounded-2xl bg-danger-light text-danger-dark flex items-center justify-center mb-4 shadow-sm">
        <Icon name="alertCircle" size="xl" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-text-heading mb-2">
        {displayTitle}
      </h1>

      <p className="text-sm text-text-muted max-w-lg mb-4 leading-relaxed">
        {safeMessage}
      </p>

      {/* Error Reference Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-bg-alt text-xs font-mono text-text-muted mb-6 border border-border">
        <span>رمز الخطأ المرجعي:</span>
        <span className="font-bold text-text" data-testid="error-reference-id">
          {fallbackErrorId}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="primary"
          leftIcon="refresh"
          onClick={handleRetry}
          data-testid="unexpected-error-retry-btn"
        >
          إعادة المحاولة
        </Button>

        <Link to="/dashboard">
          <Button variant="outline" leftIcon="home">
            العودة إلى لوحة المتابعة
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default UnexpectedErrorPage;
