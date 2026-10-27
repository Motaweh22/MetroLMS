import React, { createContext } from 'react';
import type { ToastOptions } from './types';

export interface ToastContextValue {
  show: (options: ToastOptions) => string;
  success: (message: React.ReactNode, options?: Partial<ToastOptions>) => string;
  error: (message: React.ReactNode, options?: Partial<ToastOptions>) => string;
  warning: (message: React.ReactNode, options?: Partial<ToastOptions>) => string;
  info: (message: React.ReactNode, options?: Partial<ToastOptions>) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

export const fallbackToastContext: ToastContextValue = {
  show: (options) => {
    if (import.meta.env?.DEV || process.env.NODE_ENV !== 'production') {
      console.warn(
        '[useToast] useToast was invoked outside of a <ToastProvider>. Ensure your component tree or test wrapper includes <ToastProvider>.'
      );
    }
    return options.id || 'fallback-toast-id';
  },
  success: (message, options) => {
    return fallbackToastContext.show({ message, variant: 'success', ...options });
  },
  error: (message, options) => {
    return fallbackToastContext.show({ message, variant: 'danger', ...options });
  },
  warning: (message, options) => {
    return fallbackToastContext.show({ message, variant: 'warning', ...options });
  },
  info: (message, options) => {
    return fallbackToastContext.show({ message, variant: 'info', ...options });
  },
  dismiss: () => {
    if (import.meta.env?.DEV || process.env.NODE_ENV !== 'production') {
      console.warn(
        '[useToast] dismiss was invoked outside of a <ToastProvider>.'
      );
    }
  },
  dismissAll: () => {
    if (import.meta.env?.DEV || process.env.NODE_ENV !== 'production') {
      console.warn(
        '[useToast] dismissAll was invoked outside of a <ToastProvider>.'
      );
    }
  },
};

export const ToastContext = createContext<ToastContextValue | null>(null);
