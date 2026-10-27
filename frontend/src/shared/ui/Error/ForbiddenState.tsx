import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';

export interface ForbiddenStateProps {
  /** Headline title */
  title?: string;
  /** Detailed reason */
  message?: string;
  /** Link path for return action */
  returnTo?: string;
  /** Label for return button */
  returnLabel?: string;
  /** Optional container class overrides */
  className?: string;
  /** Custom test ID */
  dataTestId?: string;
}

/**
 * Standard 403 Forbidden State Component
 *
 * Used for unauthorized access warnings within page views or standalone pages.
 */
export const ForbiddenState: React.FC<ForbiddenStateProps> = ({
  title = 'غير مصرح بالوصول (403)',
  message = 'عذراً، ليس لديك الصلاحيات الكافية للوصول إلى هذا القسم أو المورد التدريبي المطلوب.',
  returnTo = '/dashboard',
  returnLabel = 'العودة إلى لوحة المتابعة',
  className = '',
  dataTestId = 'forbidden-state',
}) => {
  return (
    <div
      role="alert"
      aria-live="polite"
      dir="rtl"
      data-testid={dataTestId}
      className={`flex flex-col items-center justify-center p-6 text-center select-none min-h-[300px] ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-danger-light text-danger-dark flex items-center justify-center mb-4 shrink-0 shadow-sm">
        <Icon name="lock" size="xl" />
      </div>

      <h2 className="text-xl sm:text-2xl font-bold text-text-heading mb-2">
        {title}
      </h2>

      <p className="text-sm text-text-muted max-w-md leading-relaxed mb-6">
        {message}
      </p>

      <Link to={returnTo}>
        <Button variant="primary" leftIcon="home">
          {returnLabel}
        </Button>
      </Link>
    </div>
  );
};

export default ForbiddenState;
