/**
 * MetroLMS — Session Transition Epoch Management
 * (Increment 5.4 / WP-5.4.2 — Asynchronous Race & Epoch Protection)
 *
 * Provides a monotonic session transition counter (sessionEpoch) to prevent
 * asynchronous operations started under one authenticated identity/session
 * from affecting application state after the session transitions.
 *
 * ARCHITECTURAL MANDATES:
 * 1. Monotonically increasing integer; never decrements or resets during active application lifecycle.
 * 2. In-memory only; NEVER persisted in localStorage, sessionStorage, or shared across tabs.
 * 3. Advances on:
 *    - Successful authenticated login / identity establishment
 *    - Isolated synthetic persona launch
 *    - Normal return to Developer session
 *    - Explicit logout
 *    - Emergency return from expired persona session
 *    - Authoritative server session invalidation (HTTP 401 / 403 / 404 in revalidateSession)
 *    - Expired active synthetic persona eviction
 *    - Corrupted snapshot eviction when terminating an active isolated persona session
 * 4. Zero dependencies on React context or DOM, preventing circular imports with apiClient.
 */

export type SessionEpochListener = (epoch: number) => void;

export interface SessionEpochManager {
  getCurrentSessionEpoch(): number;
  advanceSessionEpoch(): number;
  subscribeToSessionEpoch(listener: SessionEpochListener): () => void;
  isStaleEpoch(requestEpoch: number): boolean;
  advanceSessionEpochForEmergencyReturn(): number;
  __resetSessionEpochForTesting(initialEpoch?: number): void;
}

/**
 * Factory for creating independent SessionEpochManager instances.
 * In a real browser, each tab runs an independent JavaScript runtime with its own module memory.
 * For test harnesses simulating multiple tabs or isolated browsing contexts, createSessionEpochManager
 * provides strictly isolated monotonic epoch state, listeners, and stale-epoch predicates.
 */
export function createSessionEpochManager(initialEpoch = 1): SessionEpochManager {
  let currentSessionEpoch = initialEpoch;
  const listeners = new Set<SessionEpochListener>();

  function getCurrentSessionEpoch(): number {
    return currentSessionEpoch;
  }

  function advanceSessionEpoch(): number {
    currentSessionEpoch += 1;
    const newEpoch = currentSessionEpoch;
    listeners.forEach((listener) => {
      try {
        listener(newEpoch);
      } catch (err) {
        console.warn('Error in sessionEpoch subscriber:', err);
      }
    });
    return newEpoch;
  }

  function subscribeToSessionEpoch(listener: SessionEpochListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function isStaleEpoch(requestEpoch: number): boolean {
    return requestEpoch !== currentSessionEpoch;
  }

  function advanceSessionEpochForEmergencyReturn(): number {
    return advanceSessionEpoch();
  }

  function __resetSessionEpochForTesting(newInitialEpoch = 1): void {
    currentSessionEpoch = newInitialEpoch;
    listeners.clear();
  }

  return {
    getCurrentSessionEpoch,
    advanceSessionEpoch,
    subscribeToSessionEpoch,
    isStaleEpoch,
    advanceSessionEpochForEmergencyReturn,
    __resetSessionEpochForTesting,
  };
}

/**
 * Default singleton instance for the current application / browser tab context.
 */
const defaultEpochManager = createSessionEpochManager(1);

/**
 * Returns the current monotonic session transition epoch.
 */
export function getCurrentSessionEpoch(): number {
  return defaultEpochManager.getCurrentSessionEpoch();
}

/**
 * Monotonically advances the session transition epoch and notifies all registered subscribers.
 * Returns the newly advanced epoch.
 */
export function advanceSessionEpoch(): number {
  return defaultEpochManager.advanceSessionEpoch();
}

/**
 * Subscribes a callback to session epoch advancements.
 * Returns an unsubscribe function.
 */
export function subscribeToSessionEpoch(listener: SessionEpochListener): () => void {
  return defaultEpochManager.subscribeToSessionEpoch(listener);
}

/**
 * Predicate to check if a request epoch has been superseded by a newer session epoch.
 */
export function isStaleEpoch(requestEpoch: number): boolean {
  return defaultEpochManager.isStaleEpoch(requestEpoch);
}

/**
 * Shared integration hook for future WP-5.4.4 Emergency Return to advance session epoch.
 * Allows WP-5.4.4 to cleanly invalidate persona requests upon emergency restoration without
 * redesigning or re-implementing epoch infrastructure.
 */
export function advanceSessionEpochForEmergencyReturn(): number {
  return defaultEpochManager.advanceSessionEpochForEmergencyReturn();
}

/**
 * For deterministic testing isolation only: resets epoch to initialEpoch and clears listeners.
 * MUST NEVER be called in production code.
 */
export function __resetSessionEpochForTesting(initialEpoch = 1): void {
  defaultEpochManager.__resetSessionEpochForTesting(initialEpoch);
}
