import React from 'react';

export type ToastVariant = 'success' | 'danger' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  title?: string;
  message: React.ReactNode;
  variant: ToastVariant;
  duration?: number; // In milliseconds. Default 4000ms. 0 means persistent until user dismisses.
  onClose?: () => void;
  action?: ToastAction;
}

export type ToastOptions = Omit<ToastItem, 'id'> & { id?: string };
