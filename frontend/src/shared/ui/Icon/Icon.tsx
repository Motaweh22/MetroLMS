import React from 'react';
import { ICON_REGISTRY } from './registry';
import type { IconProps, IconSize } from './types';

const sizeMap: Record<string, number> = {
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
};

function resolveSize(size: IconSize): number {
  if (typeof size === 'number') return size;
  return sizeMap[size] ?? 20;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 'lg',
  className = '',
  strokeWidth = 2,
  'aria-label': ariaLabel,
  ...rest
}) => {
  const numericSize = resolveSize(size);
  const IconComponent = (ICON_REGISTRY as Record<string, React.ElementType>)[name];

  if (!IconComponent) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[DesignSystem:Icon] Semantic icon name "${name}" is not registered in ICON_REGISTRY. Rendering fallback.`
      );
    }
    const FallbackComponent = ICON_REGISTRY.fallback;
    return (
      <FallbackComponent
        width={numericSize}
        height={numericSize}
        strokeWidth={strokeWidth}
        className={`shrink-0 inline-block align-middle text-warning-dark ${className}`}
        aria-hidden={!ariaLabel}
        aria-label={ariaLabel || 'أيقونة غير مسجلة'}
        role={ariaLabel ? 'img' : undefined}
        {...rest}
      />
    );
  }

  return (
    <IconComponent
      width={numericSize}
      height={numericSize}
      strokeWidth={strokeWidth}
      className={`shrink-0 inline-block align-middle ${className}`}
      aria-hidden={!ariaLabel}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
      {...rest}
    />
  );
};

export default Icon;
