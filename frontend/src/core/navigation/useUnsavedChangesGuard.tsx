import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  useNavigate,
  UNSAFE_DataRouterContext,
  type Blocker,
} from 'react-router-dom';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';

export interface UseUnsavedChangesGuardOptions {
  /**
   * Boolean flag indicating whether there are genuine unsaved changes.
   */
  isDirty: boolean;

  /**
   * Optional custom dialog title in Arabic.
   * Defaults to: 'تعديلات غير محفوظة'
   */
  title?: string;

  /**
   * Optional custom dialog message in Arabic.
   * Defaults to: 'لديك تعديلات غير محفوظة في منشئ المحتوى. هل تريد مغادرة الصفحة وتجاهل هذه التغييرات؟'
   */
  message?: string;

  /**
   * Optional custom confirm button label.
   * Defaults to: 'مغادرة وتجاهل التعديلات'
   */
  confirmLabel?: string;

  /**
   * Optional custom cancel button label.
   * Defaults to: 'البقاء والمتابعة'
   */
  cancelLabel?: string;

  /**
   * Optional callback invoked when the user confirms discarding changes and leaving.
   */
  onConfirmDiscard?: () => void;
}

export interface UseUnsavedChangesGuardReturn {
  /**
   * The rendered ConfirmDialog component and blocker bridge ready to be placed in page JSX.
   */
  guardDialog: React.ReactNode;

  /**
   * Whether the confirmation dialog is currently visible.
   */
  isDialogOpen: boolean;

  /**
   * Programmatic safe navigation helper.
   * If isDirty is true, triggers the confirmation guard.
   * If clean, navigates immediately.
   */
  handleSafeNavigate: (targetPath: string) => void;

  /**
   * Explicitly confirm leaving and execute the blocked navigation.
   */
  confirmLeave: () => void;

  /**
   * Explicitly cancel leaving and stay on the current page.
   */
  cancelLeave: () => void;
}

import { DataRouterBlockerBridge } from './DataRouterBlockerBridge';

/**
 * Centralized, reusable unsaved-changes navigation guard for Metro Courses.
 *
 * Capabilities:
 * 1. Blocks in-app React Router navigation (Links, NavLinks, navigate, browser back/forward)
 *    via `useBlocker` when running under a Data Router.
 * 2. Provides safe fallback programmatic navigation for non-Data Router test environments.
 * 3. Preserves native browser `beforeunload` protection for tab/window close and refresh.
 * 4. Renders the standardized Phase 2 `ConfirmDialog` with approved Arabic messaging.
 */
export function useUnsavedChangesGuard({
  isDirty,
  title = 'تعديلات غير محفوظة',
  message = 'لديك تعديلات غير محفوظة في منشئ المحتوى. هل تريد مغادرة الصفحة وتجاهل هذه التغييرات؟',
  confirmLabel = 'مغادرة وتجاهل التعديلات',
  cancelLabel = 'البقاء والمتابعة',
  onConfirmDiscard,
}: UseUnsavedChangesGuardOptions): UseUnsavedChangesGuardReturn {
  const navigate = useNavigate();
  const dataRouterContext = useContext(UNSAFE_DataRouterContext);
  const hasDataRouter = Boolean(dataRouterContext);

  const [activeBlocker, setActiveBlocker] = useState<Blocker | null>(null);
  const [manualPendingPath, setManualPendingPath] = useState<string | null>(null);
  const [isManualOpen, setIsManualOpen] = useState(false);

  // Native beforeunload protection for window/tab close & page reload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleBlockStateChange = useCallback((blocker: Blocker) => {
    setActiveBlocker(blocker);
  }, []);

  const isDialogOpen = (activeBlocker?.state === 'blocked') || isManualOpen;

  const confirmLeave = useCallback(() => {
    onConfirmDiscard?.();

    if (activeBlocker && activeBlocker.state === 'blocked' && typeof activeBlocker.proceed === 'function') {
      activeBlocker.proceed();
    } else if (manualPendingPath) {
      navigate(manualPendingPath);
    }

    setManualPendingPath(null);
    setIsManualOpen(false);
    setActiveBlocker(null);
  }, [activeBlocker, manualPendingPath, navigate, onConfirmDiscard]);

  const cancelLeave = useCallback(() => {
    if (activeBlocker && activeBlocker.state === 'blocked' && typeof activeBlocker.reset === 'function') {
      activeBlocker.reset();
    }

    setManualPendingPath(null);
    setIsManualOpen(false);
    setActiveBlocker(null);
  }, [activeBlocker]);

  const handleSafeNavigate = useCallback(
    (targetPath: string) => {
      if (!isDirty) {
        navigate(targetPath);
        return;
      }

      if (hasDataRouter) {
        // Under a Data Router, navigate will be cleanly intercepted by useBlocker
        navigate(targetPath);
      } else {
        // Fallback for isolated tests running under simple non-data routers
        setManualPendingPath(targetPath);
        setIsManualOpen(true);
      }
    },
    [isDirty, hasDataRouter, navigate]
  );

  const guardDialog = (
    <>
      {hasDataRouter && (
        <DataRouterBlockerBridge
          isDirty={isDirty}
          onBlockStateChange={handleBlockStateChange}
        />
      )}
      <ConfirmDialog
        isOpen={isDialogOpen}
        title={title}
        message={message}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        variant="warning"
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
        testId="unsaved-leave-dialog"
        confirmTestId="confirm-delete-btn"
        cancelTestId="confirm-cancel-btn"
      />
    </>
  );

  return {
    guardDialog,
    isDialogOpen,
    handleSafeNavigate,
    confirmLeave,
    cancelLeave,
  };
}
