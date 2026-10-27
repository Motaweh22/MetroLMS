import { useEffect } from 'react';

/**
 * Custom hook to lock body scrolling when a modal or mobile drawer is open.
 * Restores the previous body overflow state on unmount or when unlocked.
 */
export function useLockBodyScroll(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;

    // Save initial overflow style
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [locked]);
}
