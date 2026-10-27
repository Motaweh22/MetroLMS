import React from 'react';

export interface InlineLoadingProps {
  /** Optional message to display alongside spinner */
  message?: string;
  /** Spinner size */
  size?: 'sm' | 'md';
  /** Optional class overrides */
  className?: string;
}

/**
 * Compact Inline Loading Indicator
 *
 * Designed for button labels, chips, and small widget updates.
 */
export const InlineLoading: React.FC<InlineLoadingProps> = ({
  message,
  size = 'sm',
  className = '',
}) => {
  const spinnerSize = size === 'sm' ? 'w-4 h-4 border-2' : 'w-5 h-5 border-2';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 align-middle ${className}`}
    >
      <span
        className={`${spinnerSize} rounded-full border-current border-t-transparent animate-spin shrink-0`}
        aria-hidden="true"
      />
      {message && <span className={`${textSize} font-medium`}>{message}</span>}
    </span>
  );
};

export default InlineLoading;
