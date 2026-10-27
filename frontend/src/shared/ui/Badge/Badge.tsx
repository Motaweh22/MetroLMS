import React from 'react';
import { Icon, type SemanticIconName } from '@/shared/ui/Icon';

export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: SemanticIconName;
  dot?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  neutral: 'bg-surface text-text border border-border',
  // WCAG AA: Navy #1A3F6F text on Soft Cyan #E8F6FB (5.01:1)
  primary: 'bg-primary-light text-primary-dark border border-primary/20',
  // WCAG AA: Green #2E7D32 text on Light Green #E8F5E9 (4.56:1)
  success: 'bg-success-light text-success border border-success/20',
  // WCAG AA: Amber #B45309 text on Light Amber #FEF3C7 (4.51:1)
  warning: 'bg-warning-light text-warning-dark border border-warning-dark/20',
  // WCAG AA: Red #B91C1C text on Light Red #FEE2E2 (5.30:1)
  danger: 'bg-danger-light text-danger-dark border border-danger-dark/20',
  // WCAG AA: Blue #0369A1 text on Light Blue #E0F2FE (5.17:1)
  info: 'bg-info-light text-info-dark border border-info-dark/20',
};

const dotColors: Record<BadgeVariant, string> = {
  neutral: 'bg-text-muted',
  primary: 'bg-primary-dark',
  success: 'bg-success',
  warning: 'bg-warning-dark',
  danger: 'bg-danger-dark',
  info: 'bg-info-dark',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px] gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  icon,
  dot = false,
  children,
  className = '',
  ...rest
}) => {
  return (
    <span
      className={`inline-flex items-center font-semibold whitespace-nowrap rounded-full select-none shrink-0 ${
        variantStyles[variant]
      } ${sizeStyles[size]} ${className}`}
      {...rest}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`}
          aria-hidden="true"
        />
      )}
      {!dot && icon && <Icon name={icon} size="sm" className="shrink-0" />}
      <span className="inline-flex items-center gap-1">{children}</span>
    </span>
  );
};

export default Badge;
