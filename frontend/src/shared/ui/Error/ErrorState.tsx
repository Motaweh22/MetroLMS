import React from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon, type SemanticIconName } from '@/shared/ui/Icon';
import { sanitizeErrorMessage } from '@/core/api/apiClient';

export interface ErrorStateProps {
  /** Localized Arabic headline */
  title?: string;
  /** Detailed error message */
  message?: string;
  /** Icon to render in header */
  icon?: SemanticIconName;
  /** Visual alert variant */
  variant?: 'danger' | 'warning' | 'info';
  /** Optional retry callback */
  onRetry?: () => void;
  /** Label for retry action */
  retryLabel?: string;
  /** Optional secondary back callback */
  onBack?: () => void;
  /** Label for back action */
  backLabel?: string;
  /** Minimum container height */
  minHeight?: string;
  /** Optional class overrides */
  className?: string;
  /** Custom data-testid */
  dataTestId?: string;
}

const variantStyles = {
  danger: {
    iconBg: 'bg-danger-light text-danger-dark',
    border: 'border-danger/30',
  },
  warning: {
    iconBg: 'bg-warning-light text-warning-dark',
    border: 'border-warning/30',
  },
  info: {
    iconBg: 'bg-info-light text-info-dark',
    border: 'border-info/30',
  },
};

/**
 * Reusable In-Page / Section Error State
 *
 * Displays sanitized Arabic error messages with optional retry and safe navigation,
 * preserving layout integrity and avoiding full-page disruption.
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'تعذر إتمام العملية',
  message,
  icon = 'alertCircle',
  variant = 'danger',
  onRetry,
  retryLabel = 'إعادة المحاولة',
  onBack,
  backLabel = 'العودة للخلف',
  minHeight = 'min-h-[260px]',
  className = '',
  dataTestId = 'error-state',
}) => {
  const currentVariant = variantStyles[variant];
  const safeMessage = sanitizeErrorMessage(
    message,
    'حدث خطأ أثناء معالجة الطلب. يرجى التحقق من اتصالك والمحاولة لاحقاً.'
  );

  return (
    <div
      role="alert"
      aria-live="polite"
      dir="rtl"
      data-testid={dataTestId}
      className={`flex flex-col items-center justify-center p-6 text-center select-none ${minHeight} ${className}`}
    >
      <div className={`w-13 h-13 rounded-2xl ${currentVariant.iconBg} flex items-center justify-center mb-4 shrink-0`}>
        <Icon name={icon} size="lg" />
      </div>

      <h3 className="text-base sm:text-lg font-bold text-text-heading mb-2">
        {title}
      </h3>

      {safeMessage && (
        <p className="text-xs sm:text-sm text-text-muted max-w-md leading-relaxed mb-6">
          {safeMessage}
        </p>
      )}

      {(onRetry || onBack) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {onRetry && (
            <Button
              variant="primary"
              size="sm"
              leftIcon="refresh"
              onClick={onRetry}
              data-testid="error-state-retry-btn"
            >
              {retryLabel}
            </Button>
          )}

          {onBack && (
            <Button
              variant="outline"
              size="sm"
              leftIcon="arrowRight"
              onClick={onBack}
            >
              {backLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default ErrorState;
