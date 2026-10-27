import React, { useState, useEffect, useRef } from 'react';
import { Icon, type SemanticIconName } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { checkBlockingOverlayActive } from './overlayDetector';
import type { ToastItem, ToastVariant } from './types';

export interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
  isModalActive?: boolean;
}

const variantStyles: Record<
  ToastVariant,
  {
    container: string;
    iconColor: string;
    titleColor: string;
    defaultIcon: SemanticIconName;
    role: 'status' | 'alert';
    ariaLive: 'polite' | 'assertive';
  }
> = {
  success: {
    container: 'bg-success-light border-success/30 text-success-dark',
    iconColor: 'text-success',
    titleColor: 'text-success-dark font-bold',
    defaultIcon: 'checkCircle',
    role: 'status',
    ariaLive: 'polite',
  },
  danger: {
    container: 'bg-danger-light border-danger-dark/30 text-danger-dark',
    iconColor: 'text-danger-dark',
    titleColor: 'text-danger-dark font-bold',
    defaultIcon: 'xCircle',
    role: 'alert',
    ariaLive: 'assertive',
  },
  warning: {
    container: 'bg-warning-light border-warning-dark/25 text-warning-dark',
    iconColor: 'text-warning-dark',
    titleColor: 'text-warning-dark font-bold',
    defaultIcon: 'alert',
    role: 'alert',
    ariaLive: 'assertive',
  },
  info: {
    container: 'bg-info-light border-info-dark/25 text-info-dark',
    iconColor: 'text-info-dark',
    titleColor: 'text-info-dark font-bold',
    defaultIcon: 'info',
    role: 'status',
    ariaLive: 'polite',
  },
};

export const Toast: React.FC<ToastProps> = ({
  toast,
  onDismiss,
  isModalActive: propModalActive = false,
}) => {
  const { id, title, message, variant, duration = 4000, onClose, action } = toast;
  const config = variantStyles[variant] || variantStyles.info;

  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Exact remaining duration state and refs
  const remainingRef = useRef<number>(duration);
  const lastTickRef = useRef<number>(Date.now());
  const isDismissedRef = useRef<boolean>(false);

  useEffect(() => {
    // If duration is 0, notification stays until explicitly closed
    if (duration <= 0) return;

    lastTickRef.current = Date.now();
    isDismissedRef.current = false;

    const intervalId = setInterval(() => {
      if (isDismissedRef.current) {
        clearInterval(intervalId);
        return;
      }

      const now = Date.now();
      const isBlocking = checkBlockingOverlayActive();
      const isPaused = isHovered || isFocused || isBlocking;

      if (isPaused) {
        // Paused: freeze remaining time and update lastTick so no time elapses
        lastTickRef.current = now;
        return;
      }

      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      remainingRef.current = Math.max(0, remainingRef.current - delta);

      if (remainingRef.current <= 0) {
        isDismissedRef.current = true;
        clearInterval(intervalId);
        onClose?.();
        onDismiss(id);
      }
    }, 100);

    return () => {
      clearInterval(intervalId);
    };
  }, [id, duration, isHovered, isFocused, propModalActive, onDismiss, onClose]);

  const handleManualClose = () => {
    isDismissedRef.current = true;
    onClose?.();
    onDismiss(id);
  };

  return (
    <div
      role={config.role}
      aria-live={config.ariaLive}
      data-testid={`toast-${id}`}
      data-variant={variant}
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border shadow-lg text-sm leading-relaxed transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-2 ${config.container}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsFocused(false);
        }
      }}
    >
      {/* Semantic Icon */}
      <div className={`shrink-0 mt-0.5 ${config.iconColor}`} aria-hidden="true">
        <Icon name={config.defaultIcon} size="md" />
      </div>

      {/* Message and optional Title */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {title && <span className={`${config.titleColor} text-sm font-bold`}>{title}</span>}
        <div className="text-xs opacity-95 break-words">{message}</div>

        {/* Optional Action Button */}
        {action && (
          <div className="pt-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-xs h-7 px-2 font-bold"
              onClick={() => {
                action.onClick();
                handleManualClose();
              }}
            >
              {action.label}
            </Button>
          </div>
        )}
      </div>

      {/* Accessible Dismiss Button */}
      <button
        type="button"
        onClick={handleManualClose}
        aria-label="إغلاق الإشعار"
        data-testid="toast-dismiss-btn"
        className="shrink-0 p-1 -m-1 rounded hover:bg-black/10 transition-colors cursor-pointer text-current opacity-80 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-accent-cyan"
      >
        <Icon name="close" size="sm" />
      </button>
    </div>
  );
};

export default Toast;
