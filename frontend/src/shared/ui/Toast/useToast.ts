import { useContext } from 'react';
import { ToastContext, fallbackToastContext, type ToastContextValue } from './ToastContext';

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    return fallbackToastContext;
  }
  return context;
};

export default useToast;
