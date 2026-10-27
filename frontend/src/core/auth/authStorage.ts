import type { AuthSession } from './types';

const SESSION_STORAGE_KEY = 'metro_lms_auth_session';

/**
 * In-memory fallback in case window.sessionStorage is unavailable or restricted
 */
let inMemorySession: AuthSession | null = null;

function isStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Authoritative Session Storage Abstraction
 *
 * Rules:
 * 1. Plaintext passwords are NEVER stored.
 * 2. Only sanitized user profile metadata, mock token, and expiry timestamp are preserved.
 * 3. Session state is scoped to browser session tab lifecycle (sessionStorage).
 */
export const authStorage = {
  /**
   * Retrieves the currently stored session, or null if absent or expired
   */
  getSession(): AuthSession | null {
    if (!isStorageAvailable()) {
      return inMemorySession;
    }

    try {
      const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;

      const session: AuthSession = JSON.parse(raw);
      if (!session || !session.user || !session.token) {
        this.clearSession();
        return null;
      }

      // Check expiry if set
      if (session.expiresAt && Date.now() > session.expiresAt) {
        this.clearSession();
        return null;
      }

      return session;
    } catch (error) {
      console.warn('Failed to parse auth session from sessionStorage:', error);
      this.clearSession();
      return null;
    }
  },

  /**
   * Stores an active session. Plaintext passwords are never included.
   */
  setSession(session: AuthSession): void {
    inMemorySession = session;
    if (!isStorageAvailable()) return;

    try {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.warn('Failed to persist auth session to sessionStorage:', error);
    }
  },

  /**
   * Clears the current session
   */
  clearSession(): void {
    inMemorySession = null;
    if (!isStorageAvailable()) return;

    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to remove auth session from sessionStorage:', error);
    }
  },
};
