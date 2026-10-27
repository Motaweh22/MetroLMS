import React, { useEffect } from 'react';
import { Icon } from '@/shared/ui/Icon';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  className?: string;
  bodyClassName?: string;
  hideHeader?: boolean;
  dataTestId?: string;
  'data-testid'?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  '2xl': 'max-w-5xl',
  full: 'max-w-[min(96vw,1200px)]',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className = '',
  bodyClassName,
  hideHeader = false,
  dataTestId,
  'data-testid': testIdProp,
  ariaLabelledBy,
  ariaDescribedBy,
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy || (title ? 'modal-title' : undefined)}
      aria-describedby={ariaDescribedBy || (description ? 'modal-description' : undefined)}
      data-testid={dataTestId || testIdProp}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Content */}
      <div
        className={`relative w-full ${sizeClasses[size]} bg-bg border border-border rounded-lg shadow-xl overflow-hidden z-10 flex flex-col max-h-[90vh] text-right transition-transform duration-200 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {!hideHeader && (
          <div className="flex items-center justify-between p-5 border-b border-border bg-surface/50">
            <div className="flex flex-col gap-0.5">
              {title && (
                <h2 id="modal-title" className="text-base font-bold text-primary-dark">
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-description" className="text-xs text-text-muted">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-text-muted hover:text-text rounded-md hover:bg-bg-alt transition-colors cursor-pointer"
              aria-label="إغلاق النافذة"
            >
              <Icon name="close" size="md" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className={bodyClassName ?? "p-6 overflow-y-auto text-sm leading-relaxed text-text"}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 bg-bg-alt/40 border-t border-border flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
