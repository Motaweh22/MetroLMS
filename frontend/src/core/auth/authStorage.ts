import type { AuthSession, User, LogoutStatus } from './types';
import { getSyntheticTestPersona } from './testPersonas';

const SESSION_STORAGE_KEY = 'metro_lms_auth_session';
const DEVELOPER_ORIGIN_STORAGE_KEY = 'metro_lms_developer_origin_session';
const LOGOUT_STATUS_STORAGE_KEY = 'metro_lms_logout_status';

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
 * A. Runtime / MSW Mock Interface (Increment 5.3 / Decision D-10)
 *
 * Represents the in-memory runtime input shape used by simulated authentication
 * workflows and historical test specifications.
 *
 * STRICT SECURITY BOUNDARY (T-1.1.1 Security Correction):
 * An existing mock interface may include `developerToken` for runtime MSW simulation,
 * but `developerToken` (and any other credential) MUST NEVER be serialized to
 * `metro_lms_developer_origin_session` in browser storage in ANY state.
 */
export interface RuntimeDeveloperOriginSession {
  schemaVersion: 1;
  savedAt: string;
  developerUser: User;
  /**
   * Runtime-only MSW mock token. Retained strictly in volatile runtime closure memory
   * when provided; NEVER serialized to sessionStorage or localStorage.
   */
  developerToken?: string;
  developerExpiresAt: number;
  personaId: string;
  snapshotState?: 'active_origin' | 'inert';
}

/**
 * Compatibility type alias for runtime callers and deferred test specifications.
 */
export type DeveloperOriginSession = RuntimeDeveloperOriginSession;

/**
 * Explicit allowlisted non-credential Developer profile fields permitted in persisted storage.
 */
export interface SanitizedDeveloperUserMetadata {
  id: 'USR_DEV_001';
  email: string;
  name: string;
  role: 'developer';
  department: string;
  jobTitle: string;
  initials: string;
}

/**
 * B. Persisted Developer Origin Snapshot (T-1.1.1 Credential-Free Persistence Representation)
 *
 * STRICT SECURITY REQUIREMENT (D-AUTH-01 & Decision C):
 * Serialized to `metro_lms_developer_origin_session` using an explicit allowlist ONLY.
 * Across ALL persisted states (`active_origin` in S3/S4/S6 and `inert` in S7), this record
 * MUST NEVER contain:
 * - developerToken
 * - Session IDs
 * - Bearer tokens
 * - Access tokens
 * - Refresh tokens
 * - Passwords
 * - Authorization credentials
 * - Any other reusable authentication secret
 */
export interface PersistedDeveloperOriginSnapshot {
  schemaVersion: 1;
  savedAt: string;
  developerUser: SanitizedDeveloperUserMetadata;
  developerExpiresAt: number;
  personaId: string;
  snapshotState?: 'active_origin' | 'inert';
}

/**
 * C. Inert S7 Snapshot (Owner Decision C: S8 -> S7 Real-User Logout)
 *
 * Preserves non-credential Developer origin metadata in an inert state after real-user logout
 * until browser tab termination. Must never independently restore authentication or expose
 * Developer return controls.
 */
export interface InertDeveloperOriginSnapshot extends PersistedDeveloperOriginSnapshot {
  snapshotState: 'inert';
}

const ALLOWED_PERSISTED_SNAPSHOT_KEYS = new Set<string>([
  'schemaVersion',
  'savedAt',
  'developerUser',
  'developerExpiresAt',
  'personaId',
  'snapshotState',
]);

const ALLOWED_DEVELOPER_USER_KEYS = new Set<string>([
  'id',
  'email',
  'name',
  'role',
  'department',
  'jobTitle',
  'initials',
]);

const PROHIBITED_SNAPSHOT_CREDENTIAL_KEYS = [
  'developerToken',
  'token',
  'rawToken',
  'personaToken',
  'sessionId',
  'accessToken',
  'refreshToken',
  'password',
  'authorization',
] as const;

const VALID_SYNTHETIC_PERSONA_IDS = [
  'USR_TEST_SUPER_001',
  'USR_TEST_ADMIN_001',
  'USR_TEST_AST_001',
  'USR_TEST_LEC_001',
  'USR_TEST_TRN_001',
] as const;

/**
 * Validates whether an input object (either a RuntimeDeveloperOriginSession input or a
 * PersistedDeveloperOriginSnapshot) satisfies structural and canonical identity invariants.
 *
 * Note: If `developerToken` is present on a runtime input passed to `saveDeveloperOriginSession()`,
 * it must be a non-empty string (preserving P5-T18-3 input validation), and is then stripped by
 * `sanitizeToPersistedDeveloperOriginSnapshot()` before persistence.
 */
export function isValidDeveloperOriginSession(
  origin: unknown
): origin is PersistedDeveloperOriginSnapshot {
  if (!origin || typeof origin !== 'object') {
    return false;
  }
  const snap = origin as Partial<RuntimeDeveloperOriginSession> & Record<string, unknown>;
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
  if (
    typeof snap.developerUser.email !== 'string' ||
    typeof snap.developerUser.name !== 'string'
  ) {
    return false;
  }
  if (snap.developerToken !== undefined) {
    if (typeof snap.developerToken !== 'string' || snap.developerToken.trim() === '') {
      return false;
    }
  }
  if (
    snap.snapshotState !== undefined &&
    snap.snapshotState !== 'active_origin' &&
    snap.snapshotState !== 'inert'
  ) {
    return false;
  }
  const userRecord = snap.developerUser as unknown as Record<string, unknown>;
  for (const key of PROHIBITED_SNAPSHOT_CREDENTIAL_KEYS) {
    if (key !== 'developerToken' && snap[key] !== undefined) {
      return false;
    }
    if (userRecord[key] !== undefined) {
      return false;
    }
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
  if (!(VALID_SYNTHETIC_PERSONA_IDS as readonly string[]).includes(snap.personaId)) {
    return false;
  }
  return true;
}

/**
 * Strict persistence-level validator confirming that a serialized snapshot conforms 100%
 * to the explicit allowlist and contains ZERO credential fields (including no `developerToken`).
 */
export function isPersistedDeveloperOriginSnapshot(
  origin: unknown
): origin is PersistedDeveloperOriginSnapshot {
  if (!isValidDeveloperOriginSession(origin)) {
    return false;
  }
  const snapRecord = origin as unknown as Record<string, unknown>;
  for (const key of Object.keys(snapRecord)) {
    if (!ALLOWED_PERSISTED_SNAPSHOT_KEYS.has(key)) {
      return false;
    }
  }
  for (const key of PROHIBITED_SNAPSHOT_CREDENTIAL_KEYS) {
    if (key in snapRecord || snapRecord[key] !== undefined) {
      return false;
    }
  }
  const userRecord = snapRecord.developerUser as Record<string, unknown>;
  for (const key of Object.keys(userRecord)) {
    if (!ALLOWED_DEVELOPER_USER_KEYS.has(key)) {
      return false;
    }
  }
  return true;
}

/**
 * Explicit allowlist serializer that constructs a credential-free `PersistedDeveloperOriginSnapshot`.
 * Never copies arbitrary properties; explicitly picks only approved non-credential metadata fields.
 */
export function sanitizeToPersistedDeveloperOriginSnapshot(
  origin: unknown,
  forcedState?: 'active_origin' | 'inert'
): PersistedDeveloperOriginSnapshot | null {
  if (!isValidDeveloperOriginSession(origin)) {
    return null;
  }
  const raw = origin as RuntimeDeveloperOriginSession;
  const resolvedState: 'active_origin' | 'inert' =
    forcedState ?? (raw.snapshotState === 'inert' ? 'inert' : 'active_origin');

  const sanitizedUser: SanitizedDeveloperUserMetadata = {
    id: 'USR_DEV_001',
    email: String(raw.developerUser.email),
    name: String(raw.developerUser.name),
    role: 'developer',
    department: typeof raw.developerUser.department === 'string' ? raw.developerUser.department : '',
    jobTitle: typeof raw.developerUser.jobTitle === 'string' ? raw.developerUser.jobTitle : '',
    initials: typeof raw.developerUser.initials === 'string' ? raw.developerUser.initials : '',
  };

  const persisted: PersistedDeveloperOriginSnapshot = {
    schemaVersion: 1,
    savedAt: String(raw.savedAt),
    developerUser: sanitizedUser,
    developerExpiresAt: Number(raw.developerExpiresAt),
    personaId: String(raw.personaId),
    snapshotState: resolvedState,
  };

  return isPersistedDeveloperOriginSnapshot(persisted) ? persisted : null;
}

/**
 * Verifies that a Developer origin snapshot is in a strictly inert, credential-free S7 state.
 */
export function isInertDeveloperOriginSession(
  origin: unknown
): origin is InertDeveloperOriginSnapshot {
  return (
    isPersistedDeveloperOriginSnapshot(origin) &&
    origin.snapshotState === 'inert'
  );
}

/**
 * Authoritative Session Storage Interface
 */
export interface AuthStorageInstance {
  getSession(): AuthSession | null;
  setSession(session: AuthSession): void;
  clearSession(): void;
  saveDeveloperOriginSession(
    origin: RuntimeDeveloperOriginSession | PersistedDeveloperOriginSnapshot
  ): boolean;
  preserveInertDeveloperOriginSession(): boolean;
  getDeveloperOriginSession(): PersistedDeveloperOriginSnapshot | null;
  getRuntimeDeveloperTokenForRestore(): string | null;
  clearDeveloperOriginSession(): void;
  hasDeveloperOriginSession(): boolean;
  inspectSessionContinuity(): SessionContinuityDescriptor;
  quarantineDeveloperOriginSession(
    origin: unknown,
    reason: 'DEVELOPER_SNAPSHOT_EXPIRED' | 'CORRUPTED_SNAPSHOT_STRUCTURE'
  ): void;
  getQuarantinedOriginSession(): SanitizedQuarantinedOriginSnapshot | null;
  clearQuarantinedOriginSession(): void;
  getDeveloperOriginSnapshotVersion(): number;
  subscribeToDeveloperOriginChanges(listener: () => void): () => void;
  getInMemorySessionForTesting(): AuthSession | null;
  getInMemoryDeveloperOriginSessionForTesting(): PersistedDeveloperOriginSnapshot | null;
}

/**
 * Factory for creating independent AuthStorage instances.
 * In a real browser, each tab runs an independent JavaScript runtime with its own module memory.
 * For test harnesses simulating multiple tabs or isolated browsing contexts, createAuthStorage
 * encapsulates all per-tab in-memory fallbacks, origin revision counters, listener sets,
 * and backing storage providers.
 */
export function createAuthStorage(storageProvider?: Storage | null): AuthStorageInstance {
  let inMemorySession: AuthSession | null = null;
  let inMemoryDeveloperOriginSession: PersistedDeveloperOriginSnapshot | null = null;
  let inMemoryRuntimeDeveloperToken: string | null = null;
  let originSnapshotVersion = 0;
  const originChangeListeners = new Set<() => void>();

  function getStorage(): Storage | null {
    if (storageProvider === null) {
      return null;
    }
    if (storageProvider !== undefined) {
      return storageProvider;
    }
    try {
      if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
        return window.sessionStorage;
      }
    } catch {
      return null;
    }
    return null;
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

  function clearSession(): void {
    inMemorySession = null;
    const storage = getStorage();
    if (!storage) return;

    try {
      storage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to remove auth session from storage:', error);
    }
  }

  function getSession(): AuthSession | null {
    const storage = getStorage();
    if (!storage) {
      return inMemorySession;
    }

    try {
      const raw = storage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;

      const session: AuthSession = JSON.parse(raw);
      if (!session || !session.user || !session.token) {
        clearSession();
        return null;
      }

      // Check expiry if set
      if (session.expiresAt && Date.now() > session.expiresAt) {
        clearSession();
        return null;
      }

      return session;
    } catch (error) {
      console.warn('Failed to parse auth session from storage:', error);
      clearSession();
      return null;
    }
  }

  function setSession(session: AuthSession): void {
    inMemorySession = session;
    const storage = getStorage();
    if (!storage) return;

    try {
      storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.warn('Failed to persist auth session to storage:', error);
    }
  }

  function getDeveloperOriginSession(): PersistedDeveloperOriginSnapshot | null {
    const storage = getStorage();
    if (!storage) {
      return sanitizeToPersistedDeveloperOriginSnapshot(inMemoryDeveloperOriginSession);
    }

    try {
      const raw = storage.getItem(DEVELOPER_ORIGIN_STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      return sanitizeToPersistedDeveloperOriginSnapshot(parsed);
    } catch (error) {
      console.warn('Failed to parse Developer origin session from storage:', error);
      return null;
    }
  }

  function getRuntimeDeveloperTokenForRestore(): string | null {
    const origin = getDeveloperOriginSession();
    if (
      !origin ||
      origin.snapshotState === 'inert' ||
      Date.now() >= origin.developerExpiresAt
    ) {
      return null;
    }
    return inMemoryRuntimeDeveloperToken;
  }

  function clearDeveloperOriginSession(): void {
    inMemoryDeveloperOriginSession = null;
    inMemoryRuntimeDeveloperToken = null;
    const storage = getStorage();
    if (storage) {
      try {
        storage.removeItem(DEVELOPER_ORIGIN_STORAGE_KEY);
      } catch (error) {
        console.warn('Failed to remove Developer origin session from storage:', error);
      }
    }
    notifyDeveloperOriginChanged();
  }

  function hasDeveloperOriginSession(): boolean {
    return Boolean(getDeveloperOriginSession());
  }

  function saveDeveloperOriginSession(
    origin: RuntimeDeveloperOriginSession | PersistedDeveloperOriginSnapshot
  ): boolean {
    // 1. Strict validation of snapshot structure and canonical identity invariants.
    // If `developerToken` is provided on a runtime input, it must be non-empty (P5-T18-3),
    // and is stripped before persistence so browser storage is 100% credential-free.
    if (!isValidDeveloperOriginSession(origin)) {
      return false;
    }

    const runtimeInput = origin as RuntimeDeveloperOriginSession;
    if (
      'developerToken' in runtimeInput &&
      runtimeInput.developerToken !== undefined &&
      (typeof runtimeInput.developerToken !== 'string' ||
        runtimeInput.developerToken.trim() === '')
    ) {
      return false;
    }

    const persistedSnapshot = sanitizeToPersistedDeveloperOriginSnapshot(
      origin,
      runtimeInput.snapshotState === 'inert' ? 'inert' : 'active_origin'
    );
    if (!persistedSnapshot || !isPersistedDeveloperOriginSnapshot(persistedSnapshot)) {
      return false;
    }

    const storage = getStorage();

    // 2. Anti-overwriting invariant: Do NOT overwrite an existing origin snapshot
    if (
      hasDeveloperOriginSession() ||
      (storage && Boolean(storage.getItem(DEVELOPER_ORIGIN_STORAGE_KEY)))
    ) {
      console.warn('Cannot overwrite existing Developer origin session snapshot.');
      return false;
    }

    // Retain runtime mock token ONLY in volatile closure memory when snapshot is active_origin
    inMemoryRuntimeDeveloperToken =
      persistedSnapshot.snapshotState !== 'inert' &&
      typeof runtimeInput.developerToken === 'string' &&
      runtimeInput.developerToken.trim() !== ''
        ? runtimeInput.developerToken.trim()
        : null;

    inMemoryDeveloperOriginSession = persistedSnapshot;

    if (!storage) {
      notifyDeveloperOriginChanged();
      return true;
    }

    try {
      // 3. Persist ONLY the credential-free allowlisted metadata
      storage.setItem(
        DEVELOPER_ORIGIN_STORAGE_KEY,
        JSON.stringify(persistedSnapshot)
      );

      // 4. Verify immediate read-back and strict credential-free persistence invariants
      const readBack = storage.getItem(DEVELOPER_ORIGIN_STORAGE_KEY);
      if (!readBack) {
        clearDeveloperOriginSession();
        return false;
      }
      try {
        const parsed = JSON.parse(readBack);
        if (!isPersistedDeveloperOriginSnapshot(parsed)) {
          clearDeveloperOriginSession();
          return false;
        }
      } catch {
        clearDeveloperOriginSession();
        return false;
      }
      notifyDeveloperOriginChanged();
      return true;
    } catch (error) {
      console.error('Failed to write Developer origin session to storage:', error);
      clearDeveloperOriginSession();
      return false;
    }
  }

  /**
   * Transitions and preserves an existing Developer origin snapshot in an inert, credential-free
   * state during real-user logout (Decision C: S8 -> S7).
   *
   * Purges any runtime in-memory Developer token (`inMemoryRuntimeDeveloperToken = null`) and marks
   * the persisted metadata record with `snapshotState: 'inert'` so it cannot independently restore
   * authentication or expose Developer return controls.
   */
  function preserveInertDeveloperOriginSession(): boolean {
    const existing = getDeveloperOriginSession();
    if (!existing) {
      return false;
    }

    const sanitized = sanitizeToPersistedDeveloperOriginSnapshot(existing, 'inert');
    if (!sanitized || !isInertDeveloperOriginSession(sanitized)) {
      return false;
    }

    inMemoryRuntimeDeveloperToken = null;
    inMemoryDeveloperOriginSession = sanitized;

    const storage = getStorage();
    if (!storage) {
      notifyDeveloperOriginChanged();
      return true;
    }

    try {
      storage.setItem(DEVELOPER_ORIGIN_STORAGE_KEY, JSON.stringify(sanitized));
      notifyDeveloperOriginChanged();
      return true;
    } catch (error) {
      console.warn('Failed to persist inert Developer origin session to storage:', error);
      return false;
    }
  }

  function inspectSessionContinuity(): SessionContinuityDescriptor {
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
    const storage = getStorage();

    if (storage) {
      try {
        raw = storage.getItem(SESSION_STORAGE_KEY);
      } catch (err) {
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
  }

  function quarantineDeveloperOriginSession(
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

      const storage = getStorage();
      if (storage) {
        storage.setItem(QUARANTINE_STORAGE_KEY, JSON.stringify(sanitized));
      }
      notifyDeveloperOriginChanged();
    } catch (error) {
      console.warn('Failed to quarantine Developer origin session snapshot:', error);
    }
  }

  function getQuarantinedOriginSession(): SanitizedQuarantinedOriginSnapshot | null {
    const storage = getStorage();
    if (!storage) return null;
    try {
      const raw = storage.getItem(QUARANTINE_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SanitizedQuarantinedOriginSnapshot;
    } catch {
      return null;
    }
  }

  function clearQuarantinedOriginSession(): void {
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.removeItem(QUARANTINE_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to remove quarantined session from storage:', error);
    }
  }

  function getDeveloperOriginSnapshotVersion(): number {
    return originSnapshotVersion;
  }

  function subscribeToDeveloperOriginChanges(listener: () => void): () => void {
    originChangeListeners.add(listener);
    return () => {
      originChangeListeners.delete(listener);
    };
  }

  let inMemoryLogoutStatus: LogoutStatus = null;

  function getLogoutStatus(): LogoutStatus {
    const storage = getStorage();
    if (!storage) return inMemoryLogoutStatus;
    try {
      const val = storage.getItem(LOGOUT_STATUS_STORAGE_KEY);
      if (val === 'LOGOUT_CONFIRMED' || val === 'LOGOUT_UNCONFIRMED') {
        return val;
      }
      return inMemoryLogoutStatus;
    } catch {
      return inMemoryLogoutStatus;
    }
  }

  function setLogoutStatus(status: 'LOGOUT_CONFIRMED' | 'LOGOUT_UNCONFIRMED'): void {
    inMemoryLogoutStatus = status;
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.setItem(LOGOUT_STATUS_STORAGE_KEY, status);
    } catch (error) {
      console.warn('Failed to save logout status to storage:', error);
    }
  }

  function clearLogoutStatus(): void {
    inMemoryLogoutStatus = null;
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.removeItem(LOGOUT_STATUS_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear logout status from storage:', error);
    }
  }

  return {
    getSession,
    setSession,
    clearSession,
    saveDeveloperOriginSession,
    preserveInertDeveloperOriginSession,
    getDeveloperOriginSession,
    getRuntimeDeveloperTokenForRestore,
    clearDeveloperOriginSession,
    hasDeveloperOriginSession,
    inspectSessionContinuity,
    quarantineDeveloperOriginSession,
    getQuarantinedOriginSession,
    clearQuarantinedOriginSession,
    getDeveloperOriginSnapshotVersion,
    subscribeToDeveloperOriginChanges,
    getLogoutStatus,
    setLogoutStatus,
    clearLogoutStatus,
    getInMemorySessionForTesting: () => inMemorySession,
    getInMemoryDeveloperOriginSessionForTesting: () => inMemoryDeveloperOriginSession,
  };
}

/**
 * Default singleton instance for the current application / browser tab context.
 */
export const defaultAuthStorage = createAuthStorage();
export const authStorage = defaultAuthStorage;

/**
 * Same-Tab Mutation Detection Counter & Listener Registry (Increment 5.4 / WP-5.4.1 Final Source Audit)
 * Tracks mutations to the Developer origin snapshot within the current browser tab.
 * Per-tab only: does not perform cross-tab synchronization or global epochs.
 */
export function getDeveloperOriginSnapshotVersion(): number {
  return defaultAuthStorage.getDeveloperOriginSnapshotVersion();
}

export function subscribeToDeveloperOriginChanges(listener: () => void): () => void {
  return defaultAuthStorage.subscribeToDeveloperOriginChanges(listener);
}
