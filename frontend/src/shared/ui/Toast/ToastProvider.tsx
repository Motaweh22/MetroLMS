import React, { useState, useCallback, useMemo } from 'react';
import { ToastContext, type ToastContextValue } from './ToastContext';
import { ToastContainer } from './ToastContainer';
import type { ToastItem, ToastOptions } from './types';

export interface ToastProviderProps {
  children: React.ReactNode;
  maxVisible?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  maxVisible = 4,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const show = useCallback((options: ToastOptions): string => {
    const id = options.id || `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newItem: ToastItem = {
      ...options,
      id,
    };

    setToasts((prev) => {
      // If a toast with this id already exists, replace it
      const filtered = prev.filter((t) => t.id !== id);
      return [...filtered, newItem];
    });

    return id;
  }, []);

  const success = useCallback(
    (message: React.ReactNode, options?: Partial<ToastOptions>) => {
      return show({ message, variant: 'success', ...options });
    },
    [show]
  );

  const error = useCallback(
    (message: React.ReactNode, options?: Partial<ToastOptions>) => {
      return show({ message, variant: 'danger', ...options });
    },
    [show]
  );

  const warning = useCallback(
    (message: React.ReactNode, options?: Partial<ToastOptions>) => {
      return show({ message, variant: 'warning', ...options });
    },
    [show]
  );

  const info = useCallback(
    (message: React.ReactNode, options?: Partial<ToastOptions>) => {
      return show({ message, variant: 'info', ...options });
    },
    [show]
  );

  const contextValue = useMemo<ToastContextValue>(
    () => ({
      show,
      success,
      error,
      warning,
      info,
      dismiss,
      dismissAll,
    }),
    [show, success, error, warning, info, dismiss, dismissAll]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} maxVisible={maxVisible} />
    </ToastContext.Provider>
  );
};

export default ToastProvider;
