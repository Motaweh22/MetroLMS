import React from 'react';
import { brandConfig } from '@/shared/config/brand';

export interface BrandLogoProps {
  /** Logo display variant */
  variant?: 'horizontal' | 'compact' | 'icon-only' | 'training' | 'navbar';
  /** Dimension scale */
  size?: 'sm' | 'md' | 'lg';
  /** Optional class overrides */
  className?: string;
  /** Whether to render the organizational subtitle */
  showSubtitle?: boolean;
  /** Specific logo asset override */
  logoAsset?: 'primary' | 'training' | 'emblem' | 'navbar';
}

const sizeMap = {
  sm: { img: 'h-8.5 w-auto', title: 'text-sm', subtitle: 'text-[11px]' },
  md: { img: 'h-10 w-auto', title: 'text-base', subtitle: 'text-xs' },
  lg: { img: 'h-14 w-auto', title: 'text-xl', subtitle: 'text-sm' },
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = '',
  showSubtitle = true,
  logoAsset,
}) => {
  const styles = sizeMap[size];
  const isTrainingVariant = variant === 'training' || logoAsset === 'training';
  const isNavbarOrEmblem = variant === 'navbar' || logoAsset === 'emblem' || logoAsset === 'navbar';

  let logoSrc: string = brandConfig.logos.primary;
  let altText: string = brandConfig.altText;

  if (isTrainingVariant) {
    logoSrc = brandConfig.logos.training;
  } else if (isNavbarOrEmblem) {
    logoSrc = brandConfig.logos.emblem;
    altText = brandConfig.emblemAltText;
  }

  if (variant === 'icon-only') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <img
          src={logoSrc}
          alt={altText}
          className={`${styles.img} object-contain transition-transform duration-200 hover:scale-105`}
        />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 select-none ${className}`}>
      <img
        src={logoSrc}
        alt={altText}
        className={`${styles.img} object-contain shrink-0`}
      />
      <div className="flex flex-col justify-center leading-tight">
        <span className={`font-bold text-primary-dark ${styles.title} tracking-tight`}>
          {isTrainingVariant ? 'المنظومة التدريبية' : brandConfig.nameAr}
        </span>
        {showSubtitle && variant !== 'compact' && variant !== 'navbar' && (
          <span className={`text-text-muted ${styles.subtitle} font-medium`}>
            {brandConfig.subtitleAr}
          </span>
        )}
      </div>
    </div>
  );
};

export default BrandLogo;

