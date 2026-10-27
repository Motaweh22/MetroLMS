import React from 'react';
import { Icon, type SemanticIconName } from '@/shared/ui/Icon';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps {
  variant?: AlertVariant;
  type?: AlertVariant | string;
  title?: string;
  message?: string;
  children?: React.ReactNode;
  icon?: SemanticIconName;
  onClose?: () => void;
  className?: string;
  'data-testid'?: string;
  dataTestId?: string;
}

const variantStyles: Record<
  AlertVariant,
  { container: string; iconColor: string; titleColor: string; defaultIcon: SemanticIconName }
> = {
  info: {
    container: 'bg-info-light border-info-dark/25 text-info-dark',
    iconColor: 'text-info-dark',
    titleColor: 'text-info-dark font-bold',
    defaultIcon: 'info',
  },
  success: {
    container: 'bg-success-light border-success/25 text-success',
    iconColor: 'text-success',
    titleColor: 'text-success font-bold',
    defaultIcon: 'checkCircle',
  },
  warning: {
    container: 'bg-warning-light border-warning-dark/25 text-warning-dark',
    iconColor: 'text-warning-dark',
    titleColor: 'text-warning-dark font-bold',
    defaultIcon: 'alert',
  },
  danger: {
    container: 'bg-danger-light border-danger-dark/25 text-danger-dark',
    iconColor: 'text-danger-dark',
    titleColor: 'text-danger-dark font-bold',
    defaultIcon: 'xCircle',
  },
};

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  type,
  title,
  message,
  children,
  icon,
  onClose,
  className = '',
  'data-testid': testId,
  dataTestId,
}) => {
  const resolvedVariantKey = (type as AlertVariant) || variant;
  const styles = variantStyles[resolvedVariantKey] || variantStyles.info;
  const iconName = icon || styles.defaultIcon;
  const content = children || message;

  return (
    <div
      role="alert"
      data-testid={dataTestId || testId}
      className={`flex items-start gap-3 p-4 rounded-md border text-sm leading-relaxed ${styles.container} ${className}`}
    >
      <div className={`shrink-0 mt-0.5 ${styles.iconColor}`}>
        <Icon name={iconName} size="lg" />
      </div>

      <div className="flex-1 flex flex-col gap-0.5">
        {title && <span className={`${styles.titleColor} text-sm`}>{title}</span>}
        <div className="text-xs opacity-90">{content}</div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-1 -m-1 rounded hover:bg-black/5 transition-colors cursor-pointer"
          aria-label="إغلاق التنبيه"
        >
          <Icon name="close" size="sm" />
        </button>
      )}
    </div>
  );
};

export default Alert;
