import metroLogo from '@/assets/brand/metro-logo.png';
import trainingLogo from '@/assets/brand/training-logo.png';
import geometricStarEmblem from '@/assets/brand/Geometric Metro Star Emblem logo.png';

/**
 * Authoritative Branding Configuration
 * 
 * To replace or update logos across the entire application:
 * 1. Update the logo asset file in `src/assets/brand/`
 * 2. Update the import/reference below.
 * All <BrandLogo /> consumers propagate the change automatically.
 */
export const brandConfig = {
  nameAr: 'مترو القاهرة',
  nameEn: 'Cairo Metro',
  subtitleAr: 'المنظومة التدريبية الذكية',
  subtitleEn: 'Smart Learning Management System',
  logos: {
    primary: metroLogo,
    training: trainingLogo,
    emblem: geometricStarEmblem,
    navbar: geometricStarEmblem,
  },
  altText: 'شعار مترو القاهرة — Cairo Metro LMS',
  emblemAltText: 'شعار نجمة مترو القاهرة الهندسية — Cairo Metro Emblem',
} as const;

export type BrandConfig = typeof brandConfig;

