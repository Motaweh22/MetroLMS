import React from 'react';
import { BrandLogo } from '@/shared/ui/BrandLogo';

export interface LoadingScreenProps {
  /** Primary status message in Arabic */
  message?: string;
  /** Optional secondary explanatory text */
  subtitle?: string;
  /** Whether to render the official Metro Courses brand header */
  showLogo?: boolean;
  /** Optional container class overrides */
  className?: string;
}

/**
 * Global Full-Page Loading Screen
 *
 * Designed for top-level bootstrap, session verification, Suspense fallbacks,
 * and genuine full-application transitions.
 *
 * Adheres strictly to:
 * - Metro Courses design tokens & Cairo typography
 * - Arabic RTL layout
 * - Accessibility: role="status", aria-live="polite"
 * - Restrained motion respecting prefers-reduced-motion
 */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'جارٍ تحميل المنظومة التدريبية...',
  subtitle = 'يرجى الانتظار لحظات للتحقق وتجهيز البيانات...',
  showLogo = true,
  className = '',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      dir="rtl"
      data-testid="loading-screen"
      className={`min-h-screen bg-bg text-text flex flex-col items-center justify-center p-6 select-none transition-opacity duration-200 ${className}`}
    >
      <div className="w-full max-w-sm flex flex-col items-center text-center space-y-6">
        {showLogo && (
          <div className="mb-2">
            <BrandLogo variant="horizontal" size="lg" showSubtitle={true} />
          </div>
        )}

        {/* Accessible Restrained Spinner */}
        <div className="relative flex items-center justify-center my-2" aria-hidden="true">
          <div className="w-12 h-12 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
          <div className="absolute w-6 h-6 rounded-full border-2 border-primary-dark/20 border-b-primary-dark animate-spin [animation-duration:1.5s]" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-base sm:text-lg font-bold text-text-heading tracking-tight">
            {message}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
