import type { AuthSession, User } from './types';
import { getSyntheticTestPersona } from './testPersonas';

const SESSION_STORAGE_KEY = 'metro_lms_auth_session';
const DEVELOPER_ORIGIN_STORAGE_KEY = 'metro_lms_developer_origin_session';

/**
 * Diagnostic Quarantine Storage Key (Increment 5.4 / Decision A & Decision D)
 */
export const QUARANTINE_STORAGE_KEY = 'metro_lms_quarantined_snapshot';

/**
 * Sanitized diagnostic record of a rejected or expired Developer origin snapshot.
 * STRICT SECURITY REQUIREMENT:
 * Under NO circumstances may this record contain developerToken, personaToken,
 * passwords, authorization headers, or any reusable credentials.
 */
export interface SanitizedQuarantinedOriginSnapshot {
  schemaVersion: '1.0';
  developerId: 'USR_DEV_001';
  personaId: string;
  savedAt: number;
  developerExpiresAt: number;
  quarantinedAt: number;
  rejectionReason:
    | 'DEVELOPER_SNAPSHOT_EXPIRED'
    | 'CORRUPTED_SNAPSHOT_STRUCTURE';
}

/**
 * Public Sanitized Session Continuity Descriptor (Increment 5.4 / WP-5.4.1)
 *
 * STRICT SECURITY REQUIREMENT:
 * Under NO circumstances may this descriptor contain rawToken, password,
 * authorization headers, or any credentials. Raw token parsing and validation
 * remain strictly internal to inspectSessionContinuity().
 */
export interface SessionContinuityDescriptor {
  isRawSessionPresent: boolean;
  isExpired: boolean;
  userId: string | null;
  role: string | null;
  tokenSubject: string | null;
  tokenTimestamp: number | null;
  expiresAt: number | null;
  hasStructuralIntegrity: boolean;
}

/**
 * Developer Origin Session Snapshot Schema (Increment 5.3 / Decision D-10)
 *
 * PROTOTYPE SECURITY LIMITATION NOTICE:
 * window.sessionStorage is a browser-side development prototype storage mechanism,
 * not a cryptographically secured hardware token vault. In the future production
 * architecture (Phase 12), session separation must be controlled by server-side sessions
 * and HttpOnly SameSite cookies rather than browser-accessible storage.
 */
export interface DeveloperOriginSession {
  schemaVersion: 1;
  savedAt: string;
  developerUser: User;
  developerToken: string;
  developerExpiresAt: number;
  personaId: string;
}

/**
 * In-memory fallback in case window.sessionStorage is unavailable or restricted
 */
let inMemorySession: AuthSession | null = null;
let inMemoryDeveloperOriginSession: DeveloperOriginSession | null = null;

/**
 * Same-Tab Mutation Detection Counter & Listener Registry (Increment 5.4 / WP-5.4.1 Final Source Audit)
 * Tracks mutations to the Developer origin snapshot within the current browser tab.
 * Per-tab only: does not perform cross-tab synchronization or global epochs.
 */
let originSnapshotVersion = 0;
const originChangeListeners = new Set<() => void>();

export function getDeveloperOriginSnapshotVersion(): number {
  return originSnapshotVersion;
}

export function subscribeToDeveloperOriginChanges(listener: () => void): () => void {
  originChangeListeners.add(listener);
  return () => {
    originChangeListeners.delete(listener);
  };
}

function notifyDeveloperOriginChanged(): void {
  originSnapshotVersion++;
  originChangeListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.warn('Error in origin snapshot listener:', e);
    }
  });
}

function isStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Strict validator for Developer Origin Session Snapshots (Increment 5.3 / Decision D-10).
 *
 * Enforces all required invariants:
 * - schemaVersion === 1
 * - developerUser.id === 'USR_DEV_001'
 * - developerUser.role === 'developer'
 * - Non-empty developerToken
 * - Valid ISO timestamp string for savedAt
 * - Valid personaId from the approved synthetic personas list
 */
export function isValidDeveloperOriginSession(origin: unknown): origin is DeveloperOriginSession {
  if (!origin || typeof origin !== 'object') {
    return false;
  }
  const snap = origin as Partial<DeveloperOriginSession>;
  if (snap.schemaVersion !== 1) {
    return false;
  }
  if (!snap.savedAt || typeof snap.savedAt !== 'string' || Number.isNaN(Date.parse(snap.savedAt))) {
    return false;
  }
  if (!snap.developerUser || typeof snap.developerUser !== 'object') {
    return false;
  }
  if (snap.developerUser.id !== 'USR_DEV_001' || snap.developerUser.role !== 'developer') {
    return false;
  }
  if (!snap.developerToken || typeof snap.developerToken !== 'string' || snap.developerToken.trim() === '') {
    return false;
  }
  if (
    typeof snap.developerExpiresAt !== 'number' ||
    !Number.isFinite(snap.developerExpiresAt) ||
    snap.developerExpiresAt <= 0
  ) {
    return false;
  }
  if (!snap.personaId || typeof snap.personaId !== 'string') {
    return false;
  }
  const validPersonaIds = [
    'USR_TEST_SUPER_001',
    'USR_TEST_ADMIN_001',
    'USR_TEST_AST_001',
    'USR_TEST_LEC_001',
    'USR_TEST_TRN_001',
  ];
  if (!validPersonaIds.includes(snap.personaId)) {
    return false;
  }
  return true;
}

/**
 * Authoritative Session Storage Abstraction
 *
 * Rules:
 * 1. Plaintext passwords are NEVER stored.
 * 2. Only sanitized user profile metadata, mock token, and expiry timestamp are preserved.
 * 3. Session state is scoped to browser session tab lifecycle (sessionStorage).
 * 4. Dedicated Developer Origin slot is strictly isolated from active auth session slot.
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

  /**
   * Captures and securely preserves the Developer origin session snapshot
   * before transitioning to a synthetic test persona (Increment 5.3 / Decision D-10).
   *
   * Invariants:
   * 1. Rejects overwriting an existing valid Developer origin snapshot (prevents nested launches).
   * 2. Rejects any non-developer user identity as the origin snapshot.
   * 3. Verifies that the snapshot can be immediately read back before returning success.
   */
  saveDeveloperOriginSession(origin: DeveloperOriginSession): boolean {
    // 1. Strict validation of snapshot structure and identity invariants
    if (!isValidDeveloperOriginSession(origin)) {
      return false;
    }

    // 2. Anti-overwriting invariant: Do NOT overwrite an existing origin snapshot
    if (
      this.hasDeveloperOriginSession() ||
      (isStorageAvailable() && Boolean(window.sessionStorage.getItem(DEVELOPER_ORIGIN_STORAGE_KEY)))
    ) {
      console.warn('Cannot overwrite existing Developer origin session snapshot.');
      return false;
    }

    inMemoryDeveloperOriginSession = origin;

    if (!isStorageAvailable()) {
      notifyDeveloperOriginChanged();
      return true;
    }

    try {
      window.sessionStorage.setItem(
        DEVELOPER_ORIGIN_STORAGE_KEY,
        JSON.stringify(origin)
      );

      // 3. Verify immediate read-back and validation
      const readBack = window.sessionStorage.getItem(DEVELOPER_ORIGIN_STORAGE_KEY);
      if (!readBack) {
        this.clearDeveloperOriginSession();
        return false;
      }
      try {
        const parsed = JSON.parse(readBack);
        if (!isValidDeveloperOriginSession(parsed)) {
          this.clearDeveloperOriginSession();
          return false;
        }
      } catch {
        this.clearDeveloperOriginSession();
        return false;
      }
      notifyDeveloperOriginChanged();
      return true;
    } catch (error) {
      console.error('Failed to write Developer origin session to sessionStorage:', error);
      this.clearDeveloperOriginSession();
      return false;
    }
  },

  /**
   * Retrieves the stored Developer origin session snapshot.
   * Validates snapshot integrity without destroying storage on read error.
   */
  getDeveloperOriginSession(): DeveloperOriginSession | null {
    if (!isStorageAvailable()) {
      return isValidDeveloperOriginSession(inMemoryDeveloperOriginSession)
        ? inMemoryDeveloperOriginSession
        : null;
    }

    try {
      const raw = window.sessionStorage.getItem(DEVELOPER_ORIGIN_STORAGE_KEY);
      if (!raw) return null;

      const origin = JSON.parse(raw);
      if (!isValidDeveloperOriginSession(origin)) {
        return null;
      }

      return origin;
    } catch (error) {
      console.warn('Failed to parse Developer origin session from sessionStorage:', error);
      return null;
    }
  },

  /**
   * Clears the Developer origin session slot.
   */
  clearDeveloperOriginSession(): void {
    inMemoryDeveloperOriginSession = null;
    if (isStorageAvailable()) {
      try {
        window.sessionStorage.removeItem(DEVELOPER_ORIGIN_STORAGE_KEY);
      } catch (error) {
        console.warn('Failed to remove Developer origin session from sessionStorage:', error);
      }
    }
    notifyDeveloperOriginChanged();
  },

  /**
   * Returns true if a valid Developer origin session snapshot exists.
   */
  hasDeveloperOriginSession(): boolean {
    return Boolean(this.getDeveloperOriginSession());
  },

  /**
   * Non-authorizing, non-destructive inspection of stored session continuity (Increment 5.4 / WP-5.4.1).
   *
   * Rules:
   * 1. Does NOT destructively clear storage even if the session is expired.
   * 2. Raw-token parsing and regex validation remain strictly internal.
   * 3. NEVER exposes rawToken in the returned descriptor.
   * 4. Validates persona ID against SYNTHETIC_TEST_PERSONA_REGISTRY.
   * 5. Validates exact mock token format: ^mock_jwt_${personaId}_${13-digit-timestamp}$
   * 6. Fails closed on storage exceptions without exposing errors as authorization evidence.
   */
  inspectSessionContinuity(): SessionContinuityDescriptor {
    const emptyDescriptor: SessionContinuityDescriptor = {
      isRawSessionPresent: false,
      isExpired: false,
      userId: null,
      role: null,
      tokenSubject: null,
      tokenTimestamp: null,
      expiresAt: null,
      hasStructuralIntegrity: false,
    };

    let raw: string | null = null;
    let parsedFromMemory: AuthSession | null = null;

    if (isStorageAvailable()) {
      try {
        raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      } catch (err) {
        // Storage access failure (e.g. SecurityError in restricted browser context)
        // Fail closed immediately: return empty descriptor
        console.warn('Storage access failed during inspectSessionContinuity:', err);
        return emptyDescriptor;
      }
    } else {
      if (inMemorySession) {
        parsedFromMemory = inMemorySession;
        try {
          raw = JSON.stringify(inMemorySession);
        } catch {
          raw = null;
        }
      }
    }

    if (!raw) {
      return emptyDescriptor;
    }

    let session: any = parsedFromMemory;
    if (!session) {
      try {
        session = JSON.parse(raw);
      } catch {
        return {
          ...emptyDescriptor,
          isRawSessionPresent: true,
          hasStructuralIntegrity: false,
        };
      }
    }

    if (!session || typeof session !== 'object') {
      return {
        ...emptyDescriptor,
        isRawSessionPresent: true,
        hasStructuralIntegrity: false,
      };
    }

    const userId = typeof session.user?.id === 'string' ? session.user.id : null;
    const role = typeof session.user?.role === 'string' ? session.user.role : null;
    const expiresAt =
      typeof session.expiresAt === 'number' && Number.isFinite(session.expiresAt) && session.expiresAt > 0
        ? session.expiresAt
        : null;
    const isExpired = Boolean(expiresAt && Date.now() > expiresAt);

    let tokenSubject: string | null = null;
    let tokenTimestamp: number | null = null;
    let isTokenFormatValid = false;

    if (typeof session.token === 'string' && session.token.trim() !== '') {
      const match = session.token.match(/^mock_jwt_([A-Za-z0-9_]+)_(\d{13})$/);
      if (match) {
        tokenSubject = match[1];
        const parsedTs = Number(match[2]);
        if (Number.isSafeInteger(parsedTs) && parsedTs > 0) {
          tokenTimestamp = parsedTs;
          isTokenFormatValid = true;
        }
      }
    }

    // Persona Registry validation: must be registered in SYNTHETIC_TEST_PERSONA_REGISTRY
    const registeredPersona = userId ? getSyntheticTestPersona(userId) : null;
    const isPersonaValid = Boolean(
      registeredPersona &&
      registeredPersona.id === userId &&
      registeredPersona.role === role &&
      tokenSubject === userId
    );

    const hasStructuralIntegrity = Boolean(
      isPersonaValid &&
      isTokenFormatValid &&
      expiresAt !== null
    );

    return {
      isRawSessionPresent: true,
      isExpired,
      userId,
      role,
      tokenSubject,
      tokenTimestamp,
      expiresAt,
      hasStructuralIntegrity,
    };
  },

  /**
   * Persists a sanitized diagnostic quarantine record for an expired or corrupted Developer origin snapshot.
   * STRICT SECURITY REQUIREMENT:
   * Under NO circumstances may any token, password, or credential be written into quarantine.
   */
  quarantineDeveloperOriginSession(
    origin: unknown,
    reason: 'DEVELOPER_SNAPSHOT_EXPIRED' | 'CORRUPTED_SNAPSHOT_STRUCTURE'
  ): void {
    try {
      const snap = (origin && typeof origin === 'object') ? (origin as any) : {};
      const rawSavedAt = snap.savedAt;
      const parsedSavedAt =
        typeof rawSavedAt === 'string'
          ? Date.parse(rawSavedAt)
          : typeof rawSavedAt === 'number'
          ? rawSavedAt
          : Date.now();

      const sanitized: SanitizedQuarantinedOriginSnapshot = {
        schemaVersion: '1.0',
        developerId: 'USR_DEV_001',
        personaId: typeof snap.personaId === 'string' ? snap.personaId : 'UNKNOWN',
        savedAt: Number.isFinite(parsedSavedAt) ? parsedSavedAt : Date.now(),
        developerExpiresAt:
          typeof snap.developerExpiresAt === 'number' && Number.isFinite(snap.developerExpiresAt)
            ? snap.developerExpiresAt
            : 0,
        quarantinedAt: Date.now(),
        rejectionReason: reason,
      };

      if (isStorageAvailable()) {
        window.sessionStorage.setItem(QUARANTINE_STORAGE_KEY, JSON.stringify(sanitized));
      }
      notifyDeveloperOriginChanged();
    } catch (error) {
      console.warn('Failed to quarantine Developer origin session snapshot:', error);
    }
  },

  /**
   * Retrieves the stored sanitized quarantine snapshot, if any.
   */
  getQuarantinedOriginSession(): SanitizedQuarantinedOriginSnapshot | null {
    if (!isStorageAvailable()) return null;
    try {
      const raw = window.sessionStorage.getItem(QUARANTINE_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SanitizedQuarantinedOriginSnapshot;
    } catch {
      return null;
    }
  },

  /**
   * Clears the quarantined origin session slot.
   */
  clearQuarantinedOriginSession(): void {
    if (!isStorageAvailable()) return;
    try {
      window.sessionStorage.removeItem(QUARANTINE_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to remove quarantined session from sessionStorage:', error);
    }
  },

  /**
   * Retrieves the current mutation version counter for the Developer origin snapshot.
   * Increments on saveDeveloperOriginSession, clearDeveloperOriginSession, and quarantineDeveloperOriginSession.
   */
  getDeveloperOriginSnapshotVersion(): number {
    return getDeveloperOriginSnapshotVersion();
  },

  /**
   * Subscribes to local same-tab Developer origin session snapshot mutations.
   */
  subscribeToDeveloperOriginChanges(listener: () => void): () => void {
    return subscribeToDeveloperOriginChanges(listener);
  },
};
