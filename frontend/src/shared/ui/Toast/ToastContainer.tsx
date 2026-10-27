import React, { useState, useEffect } from 'react';
import { Toast } from './Toast';
import { checkBlockingOverlayActive } from './overlayDetector';
import type { ToastItem } from './types';

export interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  maxVisible?: number;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  maxVisible = 4,
}) => {
  const [isModalActive, setIsModalActive] = useState<boolean>(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const updateModalStatus = () => {
      setIsModalActive(checkBlockingOverlayActive());
    };

    // Initial check
    updateModalStatus();

    // Observe DOM changes (open/close of dialogs, style modifications)
    const observer = new MutationObserver(() => {
      updateModalStatus();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'aria-modal', 'role'],
    });

    window.addEventListener('resize', updateModalStatus);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateModalStatus);
    };
  }, []);

  if (toasts.length === 0) return null;

  // Take the most recent toasts up to maxVisible
  const visibleToasts = toasts.slice(-maxVisible);

  return (
    <div
      data-testid="toast-container"
      data-modal-active={isModalActive ? 'true' : 'false'}
      className="fixed bottom-5 left-5 z-40 flex flex-col gap-2.5 max-w-sm w-full sm:w-96 pointer-events-none"
      dir="rtl"
    >
      {visibleToasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          isModalActive={isModalActive}
        />
      ))}
    </div>
  );
};

export default ToastContainer;
