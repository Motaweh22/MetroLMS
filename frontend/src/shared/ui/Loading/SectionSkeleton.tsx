import React from 'react';

export type SkeletonVariant = 'text' | 'card' | 'table' | 'metric' | 'custom';

export interface SectionSkeletonProps {
  /** Skeleton display variant */
  variant?: SkeletonVariant;
  /** Number of repeated skeleton elements */
  count?: number;
  /** Accessible aria-label describing what is loading */
  ariaLabel?: string;
  /** Optional container class overrides */
  className?: string;
}

/**
 * Reusable Content Skeleton Loader
 *
 * Provides smooth, accessible placeholder blocks for cards, tables, metrics, and text sections.
 * Automatically respects prefers-reduced-motion via global tokens.
 */
export const SectionSkeleton: React.FC<SectionSkeletonProps> = ({
  variant = 'card',
  count = 3,
  ariaLabel = 'جارٍ تحميل المحتوى...',
  className = '',
}) => {
  const items = Array.from({ length: Math.max(1, count) }, (_, i) => i);

  if (variant === 'text') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={ariaLabel}
        data-testid="skeleton-text"
        className={`space-y-3 animate-pulse ${className}`}
      >
        {items.map((key) => (
          <div key={key} className="space-y-2">
            <div className="h-4 bg-border/70 rounded-md w-3/4" />
            <div className="h-3.5 bg-border/40 rounded-md w-full" />
            <div className="h-3.5 bg-border/40 rounded-md w-5/6" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'metric') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={ariaLabel}
        data-testid="skeleton-metric"
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse ${className}`}
      >
        {items.map((key) => (
          <div
            key={key}
            className="p-4 rounded-xl border border-border bg-surface/50 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 bg-border/60 rounded-md w-24" />
              <div className="w-8 h-8 rounded-lg bg-border/50" />
            </div>
            <div className="h-7 bg-border/80 rounded-md w-20" />
            <div className="h-2.5 bg-border/40 rounded-md w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={ariaLabel}
        data-testid="skeleton-table"
        className={`w-full border border-border rounded-xl overflow-hidden bg-surface/30 animate-pulse ${className}`}
      >
        {/* Table Header Placeholder */}
        <div className="bg-bg-alt/70 p-4 border-b border-border flex items-center gap-4">
          <div className="h-4 bg-border/80 rounded-md w-32" />
          <div className="h-4 bg-border/60 rounded-md w-24 mr-auto" />
          <div className="h-4 bg-border/60 rounded-md w-20" />
          <div className="h-4 bg-border/60 rounded-md w-16" />
        </div>
        {/* Table Rows Placeholder */}
        <div className="divide-y divide-border/60">
          {items.map((key) => (
            <div key={key} className="p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-border/50 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3.5 bg-border/70 rounded-md w-1/3" />
                <div className="h-2.5 bg-border/40 rounded-md w-1/4" />
              </div>
              <div className="h-6 bg-border/50 rounded-full w-20" />
              <div className="h-8 bg-border/40 rounded-md w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default: 'card' variant
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
      data-testid="skeleton-cards"
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse ${className}`}
    >
      {items.map((key) => (
        <div
          key={key}
          className="border border-border rounded-2xl p-5 bg-surface/50 space-y-4"
        >
          <div className="h-40 bg-border/50 rounded-xl w-full" />
          <div className="h-5 bg-border/70 rounded-md w-3/4" />
          <div className="h-3.5 bg-border/40 rounded-md w-1/2" />
          <div className="flex gap-2 pt-2">
            <div className="h-4 bg-border/40 rounded-md w-16" />
            <div className="h-4 bg-border/40 rounded-md w-20" />
          </div>
          <div className="h-9 bg-border/60 rounded-lg w-full mt-4" />
        </div>
      ))}
    </div>
  );
};

export default SectionSkeleton;
