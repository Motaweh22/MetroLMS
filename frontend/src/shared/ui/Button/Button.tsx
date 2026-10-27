import React from 'react';
import { Icon, type SemanticIconName } from '@/shared/ui/Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'danger' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: SemanticIconName;
  rightIcon?: SemanticIconName;
  children?: React.ReactNode;
}

const destructiveStyle =
  'bg-danger-dark text-white hover:bg-[#991B1B] active:bg-[#7F1D1D] focus-visible:ring-danger-dark shadow-sm';

const variantStyles: Record<ButtonVariant, string> = {
  // WCAG AAA: White text on #1A3F6F (10.58:1 ratio)
  primary:
    'bg-primary-dark text-white hover:bg-[#143259] active:bg-[#0F2643] focus-visible:ring-primary-dark shadow-sm',
  // WCAG AA: Navy text on Soft Cyan #E8F6FB (5.01:1 ratio)
  secondary:
    'bg-primary-light text-primary-dark hover:bg-[#D5EEF7] active:bg-[#C2E5F3] focus-visible:ring-primary',
  // Destructive: White text on Red #B91C1C (5.30:1 ratio)
  destructive: destructiveStyle,
  danger: destructiveStyle,
  outline:
    'border border-border bg-transparent text-text hover:bg-surface active:bg-bg-alt focus-visible:ring-primary-dark',
  ghost:
    'bg-transparent text-text-muted hover:text-text hover:bg-surface active:bg-bg-alt focus-visible:ring-primary-dark',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-sm gap-1.5',
  md: 'px-4 py-2 text-sm rounded-md gap-2',
  lg: 'px-5 py-2.5 text-base rounded-lg gap-2.5',
};

const iconSizes: Record<ButtonSize, 'sm' | 'md' | 'lg'> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={`inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
          variantStyles[variant]
        } ${sizeStyles[size]} ${
          isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
        } ${className}`}
        {...rest}
      >
        {isLoading && (
          <span
            className="inline-block animate-spin border-2 border-current border-t-transparent rounded-full shrink-0"
            style={{
              width: size === 'sm' ? '12px' : size === 'md' ? '14px' : '16px',
              height: size === 'sm' ? '12px' : size === 'md' ? '14px' : '16px',
            }}
            aria-hidden="true"
          />
        )}
        {!isLoading && leftIcon && <Icon name={leftIcon} size={iconSizes[size]} />}
        {children}
        {!isLoading && rightIcon && <Icon name={rightIcon} size={iconSizes[size]} />}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
