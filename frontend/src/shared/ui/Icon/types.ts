import React from 'react';
import type { ICON_REGISTRY } from './registry';

export type SemanticIconName = keyof typeof ICON_REGISTRY;

export type IconSize = 'sm' | 'md' | 'lg' | 'xl' | number;

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'name'> {
  /** Registered semantic icon name */
  name: SemanticIconName | (string & {});
  /** Standard size preset or explicit numeric pixel size */
  size?: IconSize;
  /** Custom classes */
  className?: string;
  /** Stroke thickness */
  strokeWidth?: number;
  /** Accessible label when the icon is interactive or conveys standalone meaning */
  'aria-label'?: string;
}
