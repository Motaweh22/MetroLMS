import { useEffect, useRef } from 'react';
import { groupsApi } from '../services/groupsApi';

/**
 * 5-minute interval (in milliseconds) for periodic automatic renewal evaluation in the prototype.
 */
export const AUTO_RENEWAL_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Application-level hook that periodically checks and processes due automatic group renewals.
 *
 * Lifecycle Triggers:
 * 1. Executes immediately when mounted (application or authenticated layout becomes active).
 * 2. Executes on a periodic timer every 5 minutes while the session remains active.
 * 3. Executes upon returning to an inactive browser tab via standard `visibilitychange` lifecycle event.
 *
 * Prototype Limitation:
 * Operates in-memory within active browser sessions. Does not run autonomously when all application
 * browser sessions are closed.
 *
 * @param enabled Whether the scheduler should be active (typically true when authenticated).
 */
export function useAutoRenewalScheduler(enabled: boolean = true) {
  const isExecutingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;

    const executeCheck = async () => {
      // Prevent concurrent runs if a previous check is still in flight
      if (isExecutingRef.current) return;
      isExecutingRef.current = true;

      try {
        await groupsApi.checkAllDueRenewals();
      } catch {
        // Silently swallow errors to avoid disrupting UI or logging noise in prototype
      } finally {
        if (isMounted) {
          isExecutingRef.current = false;
        }
      }
    };

    // 1. Initial execution on mount / session activation
    executeCheck();

    // 2. Periodic execution every 5 minutes
    const intervalId = window.setInterval(executeCheck, AUTO_RENEWAL_CHECK_INTERVAL_MS);

    // 3. Document visibility change (when user returns to an inactive tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        executeCheck();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup interval and event listeners on unmount
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);
}

