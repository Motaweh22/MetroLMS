import React from 'react';

export type ProgressVariant = 'primary' | 'success' | 'warning' | 'danger';
export type ProgressSize = 'sm' | 'md' | 'lg';

export interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: ProgressVariant;
  size?: ProgressSize;
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

const trackHeights: Record<ProgressSize, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-3.5',
};

const barColors: Record<ProgressVariant, string> = {
  primary: 'bg-primary-dark',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger-dark',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  variant = 'primary',
  size = 'md',
  label,
  showPercentage = true,
  className = '',
}) => {
  const clampedValue = Math.min(Math.max(0, value), max);
  const percentage = Math.round((clampedValue / max) * 100);

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="font-medium text-text">{label}</span>}
          {showPercentage && (
            <span className="font-semibold text-text-muted">{percentage}%</span>
          )}
        </div>
      )}

      <div
        className={`w-full bg-border rounded-full overflow-hidden ${trackHeights[size]}`}
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'نسبة التقدم'}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${barColors[variant]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
