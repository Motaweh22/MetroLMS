import React from 'react';

export interface PageLoadingProps {
  /** Localized Arabic loading message */
  message?: string;
  /** Size scale of the indicator */
  size?: 'sm' | 'md' | 'lg';
  /** Minimum container height */
  minHeight?: string;
  /** Optional class overrides */
  className?: string;
}

const sizeConfig = {
  sm: { spinner: 'w-6 h-6 border-2', text: 'text-xs' },
  md: { spinner: 'w-9 h-9 border-3', text: 'text-sm' },
  lg: { spinner: 'w-12 h-12 border-3', text: 'text-base' },
};

/**
 * Standard In-Page Loading Indicator
 *
 * Used inside page layouts and containers to indicate local data fetching
 * without unmounting the application shell, navigation, or breadcrumbs.
 */
export const PageLoading: React.FC<PageLoadingProps> = ({
  message = 'جارٍ تحميل البيانات...',
  size = 'md',
  minHeight = 'min-h-[280px]',
  className = '',
}) => {
  const config = sizeConfig[size];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      dir="rtl"
      data-testid="page-loading"
      className={`flex flex-col items-center justify-center p-8 text-center select-none ${minHeight} ${className}`}
    >
      <div
        className={`${config.spinner} rounded-full border-primary/25 border-t-primary animate-spin mb-3`}
        aria-hidden="true"
      />
      <p className={`${config.text} font-medium text-text-muted`}>
        {message}
      </p>
    </div>
  );
};

export default PageLoading;
