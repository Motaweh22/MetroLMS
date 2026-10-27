/**
 * Checks if any modal or blocking overlay is currently mounted and active in the DOM.
 */
export const checkBlockingOverlayActive = (): boolean => {
  if (typeof document === 'undefined') return false;

  // 1. Check for standard modal dialogs or blocking overlays
  const modalCandidates = document.querySelectorAll(
    '[role="dialog"], [aria-modal="true"], .fixed.inset-0.z-50'
  );

  for (const el of Array.from(modalCandidates)) {
    // Exclude ToastContainer itself
    if (el.closest('[data-testid="toast-container"]')) {
      continue;
    }
    // Verify element is rendered and visible in DOM
    if (el instanceof HTMLElement) {
      const style = window.getComputedStyle(el);
      if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
        return true;
      }
    }
  }

  // 2. Also check body scroll lock used by Modal.tsx
  if (document.body && document.body.style.overflow === 'hidden') {
    return true;
  }

  return false;
};
