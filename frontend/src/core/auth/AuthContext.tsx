import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  User,
  LoginCredentials,
  UserRole,
  AuthContextValue,
  AuthSession,
  EmergencyContinuityProof,
  LogoutStatus,
} from './types';
import { AuthContext } from './context';
import {
  authStorage,
  isValidDeveloperOriginSession,
  isPersistedDeveloperOriginSnapshot,
  getDeveloperOriginSnapshotVersion,
  subscribeToDeveloperOriginChanges,
  type DeveloperOriginSession,
  type RuntimeDeveloperOriginSession,
  type PersistedDeveloperOriginSnapshot,
} from './authStorage';
import { authApi } from './authApi';
import { SYNTHETIC_DEMO_ACCOUNTS } from './demoAccounts';
import {
  getSyntheticTestPersona,
  CANONICAL_DEVELOPER_ID,
  SYNTHETIC_TEST_PERSONA_REGISTRY,
  type SyntheticTestPersona,
} from './testPersonas';
import { resolveCanonicalUserId } from './canonicalIdentity';
import { sanitizeErrorMessage, ApiError, StaleEpochError, isStaleEpochError } from '@/core/api/apiClient';
import {
  getCurrentSessionEpoch,
  advanceSessionEpoch,
  subscribeToSessionEpoch,
  advanceSessionEpochForEmergencyReturn,
} from './sessionEpoch';

/**
 * Computes a deterministic non-reversible SHA-256 digest for a Developer origin snapshot
 * using the browser Web Crypto API (crypto.subtle.digest) (WP-5.4.1 Final Fingerprint Quality Audit).
 *
 * Covers ALL relevant snapshot fields:
 * - schemaVersion
 * - personaId
 * - savedAt
 * - developerExpiresAt
 * - developerToken
 * - Complete canonical Developer user identity and claims (id, name, email, role, department, jobTitle, initials)
 *
 * STRICT SECURITY & DISCLOSURE CONSTRAINTS:
 * 1. The raw Developer token is NEVER stored in EmergencyContinuityProof or exposed in UI/logs.
 * 2. Only the non-reversible SHA-256 hex digest (sha256_...) is returned and stored in proof.
 * 3. The digest is memory-only and never written to sessionStorage or localStorage.
 * 4. If Web Crypto is unavailable, fails closed (returns null) rather than using a weak fallback.
 * 5. Used exclusively to detect snapshot replacement, modification, or inconsistency.
 */
export async function computeOriginSnapshotDigest(
  origin: PersistedDeveloperOriginSnapshot | RuntimeDeveloperOriginSession
): Promise<string | null> {
  // Strict Development-Only & Active-Origin Boundary (Decision D-10 / T-1.1.1 Remediation):
  // Synthetic test-persona snapshot digests are strictly disabled outside development mode
  // or when the snapshot is in an inert state.
  if (!import.meta.env.DEV || !origin || origin.snapshotState === 'inert') {
    return null;
  }

  const subtle =
    typeof window !== 'undefined' && window.crypto?.subtle
      ? window.crypto.subtle
      : typeof globalThis !== 'undefined' && globalThis.crypto?.subtle
        ? globalThis.crypto.subtle
        : null;

  if (!subtle || typeof subtle.digest !== 'function') {
    console.warn('Web Crypto API (crypto.subtle.digest) is unavailable. Failing closed.');
    return null;
  }

  // Detect any direct raw storage tampering where a prohibited credential key was injected into sessionStorage
  let rawStorageTamperMarker = '';
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem('metro_lms_developer_origin_session');
      if (raw) {
        const parsedRaw = JSON.parse(raw);
        if (!isPersistedDeveloperOriginSnapshot(parsedRaw)) {
          rawStorageTamperMarker = `tampered_raw_${raw}`;
        }
      }
    } catch {
      rawStorageTamperMarker = 'corrupted_raw';
    }
  }

  const explicitRuntimeToken =
    typeof (origin as RuntimeDeveloperOriginSession).developerToken === 'string' &&
      (origin as RuntimeDeveloperOriginSession).developerToken!.trim() !== ''
      ? (origin as RuntimeDeveloperOriginSession).developerToken!.trim()
      : null;
  const runtimeTokenScope =
    explicitRuntimeToken || authStorage.getRuntimeDeveloperTokenForRestore();

  // Strict Fail-Closed Invariant (T-1.1.1 Targeted Remediation):
  // If the volatile runtime credential is unavailable, persisted snapshot metadata must NEVER
  // silently fall back to an empty runtimeTokenScope, validate a digest, or authorize restoration.
  if (!runtimeTokenScope || typeof runtimeTokenScope !== 'string' || runtimeTokenScope.trim() === '') {
    return null;
  }

  const canonicalRepresentation = {
    schemaVersion: origin.schemaVersion,
    personaId: origin.personaId || '',
    savedAt: origin.savedAt || '',
    developerExpiresAt: origin.developerExpiresAt,
    snapshotState: origin.snapshotState || 'active_origin',
    runtimeTokenScope,
    rawStorageTamperMarker,
    developerUser: {
      id: origin.developerUser?.id || '',
      name: origin.developerUser?.name || '',
      email: origin.developerUser?.email || '',
      role: origin.developerUser?.role || '',
      department: origin.developerUser?.department || '',
      jobTitle: origin.developerUser?.jobTitle || '',
      initials: origin.developerUser?.initials || '',
    },
  };

  try {
    const json = JSON.stringify(canonicalRepresentation);
    const encoder = new TextEncoder();
    const data = encoder.encode(json);
    const hashBuffer = await subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hexString = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `sha256_${hexString}`;
  } catch (err) {
    console.warn('Failed to compute origin snapshot SHA-256 digest:', err);
    return null;
  }
}

/** @deprecated Use computeOriginSnapshotDigest */
export const computeOriginSnapshotFingerprint = computeOriginSnapshotDigest;

/**
 * Pre-commit acceptance predicate for asynchronous Developer origin snapshot validation
 * (Increment 5.4 / WP-5.4.1 Final Technical Acceptance).
 *
 * Enforces strict pre-commit guards:
 * 1. The effect has not been cancelled (AuthProvider still mounted for this effect lifecycle).
 * 2. The captured snapshot revision still equals the live storage version (no intervening storage mutations).
 * 3. The captured revision still corresponds to the active validation revision.
 */
export interface DigestCommitGuardParams {
  isCancelled: boolean;
  capturedRevision: number;
  liveStorageRevision: number;
  activeValidationRevision: number;
}

export function shouldCommitDigestResult(params: DigestCommitGuardParams): boolean {
  if (params.isCancelled) {
    return false;
  }
  if (params.capturedRevision !== params.liveStorageRevision) {
    return false;
  }
  if (params.capturedRevision !== params.activeValidationRevision) {
    return false;
  }
  return true;
}

/**
 * Strict validation for development-mode mock authentication responses (T-1.3.1 Targeted Remediation).
 * Validates that `response.token` is a non-empty string and that any supplied `expiresAt`
 * is a valid, finite future timestamp, defaulting to 24 hours only when absent.
 * Fails closed immediately if mock credentials are missing or invalid.
 */
export interface AuthRuntimeEnv {
  DEV?: boolean;
  PROD?: boolean;
  MODE?: string;
  VITE_DEMO_MODE?: string;
}

/**
 * Determines whether Demo/Test mock-session validation is permitted.
 * Production builds and runtime `production` mode NEVER allow Demo authentication,
 * even if `VITE_DEMO_MODE=true` is present in the environment.
 */
export function isDemoAuthMode(env: AuthRuntimeEnv = import.meta.env): boolean {
  if (env.PROD === true || env.MODE === 'production') {
    return false;
  }
  if (env.DEV !== true) {
    return false;
  }
  return (
    env.MODE === 'demo' ||
    env.MODE === 'test' ||
    env.VITE_DEMO_MODE === 'true'
  );
}

function validateDevMockSession(response: {
  user: User;
  token?: string;
  expiresAt?: number;
}): { token: string; expiresAt: number } {
  if (typeof response.token !== 'string') {
    throw new Error('فشل تسجيل الدخول في بيئة التطوير: لم يتم استلام رمز جلسة المحاكاة (mock token).');
  }

  const trimmedToken = response.token.trim();
  if (!trimmedToken) {
    throw new Error('فشل تسجيل الدخول في بيئة التطوير: رمز جلسة المحاكاة (mock token) فارغ أو غير صالح.');
  }

  let expiresAt: number;
  if (response.expiresAt === undefined || response.expiresAt === null) {
    // Documented 24-hour default when absent under existing DEV mock contract
    expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  } else if (
    typeof response.expiresAt === 'number' &&
    Number.isFinite(response.expiresAt) &&
    response.expiresAt > Date.now()
  ) {
    expiresAt = response.expiresAt;
  } else {
    throw new Error('فشل تسجيل الدخول في بيئة التطوير: مدة صلاحية جلسة المحاكاة (expiresAt) غير صالحة أو منتهية.');
  }

  return { token: trimmedToken, expiresAt };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Increment 5.4 / WP-5.4.1: Non-destructive continuity inspection on initialization
  // Avoid calling getSession() directly if expired, preventing premature eviction
  const initialContinuity = authStorage.inspectSessionContinuity();
  const initialOrigin = authStorage.getDeveloperOriginSession();

  // Strict Expiration & Active-Origin Boundary: Date.now() < developerExpiresAt (unexpired)
  // An inert credential-free S7 snapshot (snapshotState === 'inert') never activates isolated state.
  const isInitialOriginValidAndUnexpired = Boolean(
    import.meta.env.DEV &&
    initialOrigin &&
    initialOrigin.snapshotState !== 'inert' &&
    Date.now() < initialOrigin.developerExpiresAt
  );

  // Persona session expiration boundary: Date.now() <= expiresAt (unexpired)
  // In production builds, authentication is cookie-first; initial loading begins in loading state
  // to avoid flashing unauthenticated content while GET /api/auth/me is in flight.
  const hasInitialToken = Boolean(
    import.meta.env.DEV &&
    initialContinuity.isRawSessionPresent &&
    !initialContinuity.isExpired &&
    initialContinuity.expiresAt &&
    Date.now() <= initialContinuity.expiresAt
  );

  // MFR-20: Gated session state — do NOT expose unvalidated stored user as authenticated
  // before successful server revalidation. Protected content remains inaccessible.
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(
    import.meta.env.DEV ? hasInitialToken : true
  );
  const [error, setError] = useState<string | null>(null);

  // Safety timeout: Guarantee that isLoading is NEVER stuck indefinitely on bootstrap
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setIsLoading((currentlyLoading) => {
        if (currentlyLoading) {
          console.warn('[AuthProvider] Initial session revalidation safety timeout fired after 3s; releasing loading barrier.');
          return false;
        }
        return false;
      });
    }, 3000);
    return () => clearTimeout(safetyTimer);
  }, []);

  // Synchronized reference for current user state during asynchronous lifecycle transitions
  const userRef = useRef<User | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Lifecycle reference tracking the sessionEpoch for which Production authentication has been
  // confirmed by Django, preserved across transient S5 presentation clearing (T-1.3.1 Remediation).
  // Initialized to null; exists strictly in volatile memory (never persisted to storage or cookies).
  const authenticatedSessionEpochRef = useRef<number | null>(null);

  // WP-5.4.2: Monotonic session transition epoch for asynchronous race and post-logout protection
  // Monotonically advances on authenticated identity establishment, persona launch, return, or logout
  const [sessionEpoch, setSessionEpoch] = useState<number>(() => getCurrentSessionEpoch());

  // T-1.3.2: Server-side logout confirmation tracking (LOGOUT_CONFIRMED vs LOGOUT_UNCONFIRMED)
  const [logoutStatus, setLogoutStatus] = useState<LogoutStatus>(() => authStorage.getLogoutStatus());

  // WP-5.4.2 Audit: Operation-scoped sequence guard for asynchronous authentication lifecycle operations
  // Discards delayed responses/commits from superseded login, logout, or revalidation operations
  const authOpSeqRef = useRef<number>(0);

  // WP-5.4.4: Single-flight transaction guard for emergency return from expired persona session
  const isEmergencyReturnInFlightRef = useRef<boolean>(false);

  useEffect(() => {
    return subscribeToSessionEpoch((newEpoch) => {
      setSessionEpoch(newEpoch);
    });
  }, []);

  // WP-5.4.1 Acceptance Audit: Memory-only emergency continuity proof
  // STRICT SECURITY REQUIREMENT:
  // Exists strictly in React memory for current AuthProvider lifecycle.
  // NEVER serialized to sessionStorage or localStorage.
  const [emergencyProof, setEmergencyProof] = useState<EmergencyContinuityProof | null>(null);

  // WP-5.4.1 Final Source Audit:
  // Tracks local snapshot revision and asynchronously verified snapshot revision.
  // STRICT SECURITY REQUIREMENT:
  // Replaces verifiedRawSnapshot to avoid storing credential-bearing snapshot copies in React state.
  // Integer version increments on any same-tab mutation via authStorage notification.
  const [snapshotRevision, setSnapshotRevision] = useState<number>(() => getDeveloperOriginSnapshotVersion());
  const [verifiedSnapshotRevision, setVerifiedSnapshotRevision] = useState<number | null>(null);
  const [verifiedSnapshotDigest, setVerifiedSnapshotDigest] = useState<string | null>(null);

  // Subscribe to same-tab origin snapshot mutations (Increment 5.4 / WP-5.4.1 Final Source Audit)
  useEffect(() => {
    return subscribeToDeveloperOriginChanges(() => {
      setSnapshotRevision(getDeveloperOriginSnapshotVersion());
    });
  }, []);

  // Increment 5.4 / WP-5.4.1: Reconcile initial isolated session state
  // Only activate isolated state initially if both origin snapshot is unexpired
  // and active session has matching persona structural integrity.
  const [isIsolatedSession, setIsIsolatedSession] = useState<boolean>(() => {
    if (!import.meta.env.DEV || !isInitialOriginValidAndUnexpired || !initialOrigin) return false;
    return Boolean(
      initialContinuity.hasStructuralIntegrity &&
      !initialContinuity.isExpired &&
      initialContinuity.userId === initialOrigin.personaId
    );
  });

  const [isolatedPersona, setIsolatedPersona] = useState<SyntheticTestPersona | null>(() => {
    if (!import.meta.env.DEV || !isInitialOriginValidAndUnexpired || !initialOrigin) return null;
    if (
      initialContinuity.hasStructuralIntegrity &&
      !initialContinuity.isExpired &&
      initialContinuity.userId === initialOrigin.personaId
    ) {
      return getSyntheticTestPersona(initialOrigin.personaId);
    }
    return null;
  });

  // Revalidate stored authenticated session on mount (Phase 1 MFR-20 & Increment 5.4 WP-5.4.1)
  const revalidateSession = useCallback(async () => {
    const opId = ++authOpSeqRef.current;
    const requestEpoch = getCurrentSessionEpoch();
    setIsLoading(true);

    // =========================================================================
    // PRODUCTION COOKIE-FIRST BOOTSTRAP PATH (D-AUTH-01 / T-1.3.1 Critical Remediation)
    // =========================================================================
    // In production builds, authentication is established and validated exclusively
    // via Django HttpOnly session cookies (credentials: 'same-origin').
    // Proactively purge obsolete prototype mock tokens from Web Storage before
    // server revalidation. Server response from GET /api/auth/me is the sole authority.
    if (!import.meta.env.DEV) {
      // 1. Proactively purge obsolete active prototype mock session from client storage
      authStorage.clearSession();

      // LOGOUT_UNCONFIRMED Active Logout Barrier (§2.2.B / T-1.3.2):
      // An unresolved logout must NOT silently restore an authenticated React user from /api/auth/me!
      const currentLogoutStatus = authStorage.getLogoutStatus();
      const isLogoutUnconfirmed = currentLogoutStatus === 'LOGOUT_UNCONFIRMED';

      try {
        // 2. Dispatch authoritative server session hydration with scoped timeout signal
        const timeoutSignal =
          typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
            ? AbortSignal.timeout(10000)
            : undefined;
        const response = await authApi.getCurrentUser({ signal: timeoutSignal });

        // 3. Lifecycle fence & operation guard (WP-5.4.2 Targeted Acceptance Audit)
        const currentEpoch = getCurrentSessionEpoch();
        const isRevalidationCurrent =
          opId === authOpSeqRef.current &&
          currentEpoch === requestEpoch;

        if (isRevalidationCurrent) {
          if (isLogoutUnconfirmed) {
            // PROHIBITION ON SILENT RESTORATION:
            // A late session was discovered while LOGOUT_UNCONFIRMED is active.
            // Do NOT set user. Remain unauthenticated on /login and trigger reconciliation.
            setUser(null);
            setError('تعذر تأكيد إنهاء الجلسة على الخادم بسبب خطأ سابق في الاتصال. تم إغلاق الواجهة محلياً — يرجى إعادة المحاولة لتأكيد تسجيل الخروج الكامل.');
            // Attempt automatic background reconciliation logout to clear orphaned cookie on server
            authApi.logout({ signal: timeoutSignal })
              .then(() => {
                if (opId === authOpSeqRef.current) {
                  setLogoutStatus('LOGOUT_CONFIRMED');
                  authStorage.setLogoutStatus('LOGOUT_CONFIRMED');
                  setError(null);
                }
              })
              .catch(() => { });
          } else {
            authenticatedSessionEpochRef.current = requestEpoch;
            setUser(response.user);
            setError(null);
          }
        }
      } catch (err: unknown) {
        const currentEpoch = getCurrentSessionEpoch();
        const isRevalidationCurrent =
          opId === authOpSeqRef.current &&
          currentEpoch === requestEpoch;

        if (isRevalidationCurrent) {
          if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 404)) {
            // Authoritative session invalidation (401, 403, 404)
            // Advance session epoch only if invalidating an authenticated session matching this request epoch
            if (authenticatedSessionEpochRef.current === requestEpoch) {
              advanceSessionEpoch();
              authenticatedSessionEpochRef.current = null;
            }
            setUser(null);
            setIsIsolatedSession(false);
            setIsolatedPersona(null);
            setEmergencyProof(null);

            // Cold start 401: Clean unauthenticated guest state (no error banner)
            // If an unconfirmed logout is active, maintain LOGOUT_UNCONFIRMED:
            // a 401 on /api/auth/me does not prove the server executed session eviction or cleared
            // server-side session state for an unconfirmed logout.
            if (isLogoutUnconfirmed) {
              setError(
                'تعذر تأكيد إنهاء الجلسة على الخادم بسبب خطأ سابق في الاتصال. تم إغلاق الواجهة محلياً — يرجى إعادة المحاولة لتأكيد تسجيل الخروج الكامل.'
              );
            } else if (err.status !== 401) {
              setError(err.message || 'انتهت صلاحية الجلسة أو تم تعليق الحساب.');
            } else {
              setError(null);
            }
          } else {
            // Temporary network failure / timeout / HTTP 500 (Section 5.G / State S5)
            // Keep browser session cookie untouched; do not authenticate user
            setUser(null);
            setEmergencyProof(null);
            setError('تعذر التحقق من صلاحية الجلسة بسبب مشكلة في الاتصال بالخادم. يرجى إعادة المحاولة.');
          }
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // =========================================================================
    // DEVELOPMENT / MSW MOCK & DEVELOPER ISOLATION PATH (S0 - S15)
    // =========================================================================
    // 1. Inspect Developer origin snapshot safely (returns sanitized PersistedDeveloperOriginSnapshot)
    let originSnapshot: PersistedDeveloperOriginSnapshot | null = null;
    let isOriginCorrupted = false;

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const rawOrigin = window.sessionStorage.getItem('metro_lms_developer_origin_session');
        if (rawOrigin) {
          try {
            const parsedOrigin = JSON.parse(rawOrigin);
            if (isValidDeveloperOriginSession(parsedOrigin)) {
              originSnapshot = authStorage.getDeveloperOriginSession();
            } else {
              isOriginCorrupted = true;
            }
          } catch {
            isOriginCorrupted = true;
          }
        }
      } catch (err) {
        console.warn('Storage access error while reading origin snapshot:', err);
      }
    } else {
      originSnapshot = authStorage.getDeveloperOriginSession();
    }

    // 2. Conclusively Expired Developer Snapshot Check (Case 9 / State S11 / Section 5.F)
    // Strict comparison boundary: Date.now() >= originSnapshot.developerExpiresAt
    if (originSnapshot && Date.now() >= originSnapshot.developerExpiresAt) {
      // Quarantine sanitized metadata strictly without tokens or secrets
      authStorage.quarantineDeveloperOriginSession(originSnapshot, 'DEVELOPER_SNAPSHOT_EXPIRED');
      authStorage.clearDeveloperOriginSession();

      // Identity-Specific Active Session Handling (WP-5.4.1 Acceptance Point 4):
      const continuity = authStorage.inspectSessionContinuity();

      if (continuity.isRawSessionPresent && continuity.userId === originSnapshot.personaId) {
        // Active session is the synthetic persona associated with the expired Developer snapshot:
        // Evict persona session and fail closed to /login.
        if (opId !== authOpSeqRef.current) {
          return;
        }
        advanceSessionEpoch();
        authStorage.clearSession();
        setUser(null);
        setIsIsolatedSession(false);
        setIsolatedPersona(null);
        setEmergencyProof(null);
        setError('انتهت صلاحية جلسة المطور. يرجى تسجيل الدخول مجدداً.');
        setIsLoading(false);
        return;
      }

      if (continuity.isRawSessionPresent && continuity.userId !== originSnapshot.personaId) {
        // A DIFFERENT authenticated real user is active (e.g. USR_SUPER_001):
        // PRESERVE that user's active session and AuthContext identity (Decision D)!
        // Do NOT clear active session, do NOT set user to null, do NOT restore Developer.
        setIsIsolatedSession(false);
        setIsolatedPersona(null);
        setEmergencyProof(null);
        // Continue to server revalidation for the active real user below!
      } else {
        // No active session is present:
        setUser(null);
        setIsIsolatedSession(false);
        setIsolatedPersona(null);
        setEmergencyProof(null);
        setIsLoading(false);
        return;
      }
    }

    // Corrupted origin snapshot check (State S10)
    if (isOriginCorrupted) {
      if (opId !== authOpSeqRef.current) {
        return;
      }
      authStorage.clearDeveloperOriginSession();
      const continuity = authStorage.inspectSessionContinuity();
      if (continuity.isRawSessionPresent && continuity.userId && continuity.userId.startsWith('USR_TEST_')) {
        advanceSessionEpoch();
        authStorage.clearSession();
        setUser(null);
      }
      setIsIsolatedSession(false);
      setIsolatedPersona(null);
      setEmergencyProof(null);
      setError('تم إلغاء الجلسة بسبب تلف بيانات الاستعادة المحفوظة.');
      setIsLoading(false);
      return;
    }

    // 3. Inspect active session continuity non-destructively (Section 4 & 5)
    const continuity = authStorage.inspectSessionContinuity();

    // Case D: Completely Missing Active Session (Section 5.D / State S7)
    if (!continuity.isRawSessionPresent) {
      // An origin snapshot alone NEVER authorizes Developer restoration or emergency state.
      // Valid Developer snapshot remains inert until tab close.
      setUser(null);
      setIsIsolatedSession(false);
      setIsolatedPersona(null);
      setEmergencyProof(null);
      setIsLoading(false);
      return;
    }

    // Case E: Expired Persona Session (Section 5.E / State S6)
    // Boundary comparison: Date.now() > continuity.expiresAt (from inspectSessionContinuity)
    // and Developer snapshot unexpired: Date.now() < originSnapshot.developerExpiresAt
    // Note: Inert S7 snapshots (snapshotState === 'inert') or missing volatile runtime credentials cannot enter S6.
    if (continuity.isExpired) {
      const canonicalPersona =
        import.meta.env.DEV && originSnapshot
          ? getSyntheticTestPersona(originSnapshot.personaId)
          : null;
      const runtimeDevTokenAvailable = Boolean(authStorage.getRuntimeDeveloperTokenForRestore());
      if (
        import.meta.env.DEV &&
        runtimeDevTokenAvailable &&
        originSnapshot &&
        originSnapshot.snapshotState !== 'inert' &&
        canonicalPersona &&
        Date.now() < originSnapshot.developerExpiresAt &&
        continuity.hasStructuralIntegrity &&
        continuity.userId === originSnapshot.personaId &&
        continuity.tokenSubject === originSnapshot.personaId &&
        continuity.role === canonicalPersona.role &&
        typeof continuity.expiresAt === 'number' &&
        Number.isSafeInteger(continuity.expiresAt) &&
        continuity.expiresAt > 0 &&
        Date.now() > continuity.expiresAt
      ) {
        // Persona continuity proven!
        // Compute SHA-256 digest asynchronously via Web Crypto API
        const preDigestVersion = getDeveloperOriginSnapshotVersion();
        const snapshotDigest = await computeOriginSnapshotDigest(originSnapshot);
        if (!snapshotDigest || getDeveloperOriginSnapshotVersion() !== preDigestVersion) {
          // Web Crypto failure / unavailable or snapshot mutated during digest: fail closed immediately
          authStorage.clearSession();
          setUser(null);
          setIsIsolatedSession(false);
          setIsolatedPersona(null);
          setEmergencyProof(null);
          setVerifiedSnapshotDigest(null);
          setVerifiedSnapshotRevision(null);
          setIsLoading(false);
          return;
        }

        // Evict expired persona session so it cannot be transmitted in network requests
        authStorage.clearSession();
        setUser(null);

        // Capture verified snapshot version (non-credential revision counter)
        const currentVersion = getDeveloperOriginSnapshotVersion();
        setVerifiedSnapshotDigest(snapshotDigest);
        setVerifiedSnapshotRevision(currentVersion);
        setSnapshotRevision(currentVersion);

        // Establish memory-only emergency proof in current AuthProvider lifecycle
        setEmergencyProof({
          personaId: originSnapshot.personaId,
          personaRole: canonicalPersona.role,
          tokenSubject: continuity.tokenSubject || originSnapshot.personaId,
          tokenTimestamp: continuity.tokenTimestamp || Date.now(),
          personaExpiresAt: continuity.expiresAt,
          provenAt: Date.now(),
          originSnapshotFingerprint: snapshotDigest,
        });
        setIsIsolatedSession(true);
        setIsolatedPersona(canonicalPersona);
        setError('انتهت صلاحية جلسة الحساب الاختباري. الرجوع إلى جلسة المطور متاح للطوارئ.');
      } else {
        // Continuity lost or missing origin: clear expired session and fail closed
        authStorage.clearSession();
        setUser(null);
        setIsIsolatedSession(false);
        setIsolatedPersona(null);
        setEmergencyProof(null);
        setVerifiedSnapshotDigest(null);
        setVerifiedSnapshotRevision(null);
      }
      setIsLoading(false);
      return;
    }

    // Case B / C: Active Session is Present and Not Expired
    if (originSnapshot) {
      const persona = getSyntheticTestPersona(originSnapshot.personaId);
      const isMatchingPersona = Boolean(
        originSnapshot.snapshotState !== 'inert' &&
        continuity.hasStructuralIntegrity &&
        continuity.userId === originSnapshot.personaId &&
        continuity.tokenSubject === originSnapshot.personaId
      );

      if (!isMatchingPersona) {
        // Persona Token Tampering Check (Case 10 / State S9):
        if (continuity.userId === originSnapshot.personaId && !continuity.hasStructuralIntegrity) {
          authStorage.clearSession();
          setUser(null);
          setIsIsolatedSession(false);
          setIsolatedPersona(null);
          setEmergencyProof(null);
          setError('تم إلغاء الجلسة بسبب عدم مطابقة رمز التحقق للشخصية الاختبارية.');
          setIsLoading(false);
          return;
        }

        // Real-User Identity Mismatch (Case 7 / State S8 / Decision D):
        // Real user active (e.g. USR_SUPER_001), Developer snapshot kept inert.
        setIsIsolatedSession(false);
        setIsolatedPersona(null);
        setEmergencyProof(null);
      } else {
        // Valid Active Synthetic Persona Session (Section 5.B / State S4)
        setIsIsolatedSession(true);
        setIsolatedPersona(persona);
        setEmergencyProof(null);
      }
    } else {
      // Normal Developer or other user without origin snapshot (Section 5.A)
      setIsIsolatedSession(false);
      setIsolatedPersona(null);
      setEmergencyProof(null);
    }

    // 4. Server/API revalidation via GET /api/auth/me (DEV MSW mock prototype)
    const activeSession = authStorage.getSession();
    const requestToken = activeSession?.token || null;

    try {
      const devTimeoutSignal =
        typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
          ? AbortSignal.timeout(8000)
          : undefined;
      const response = await authApi.getCurrentUser({ signal: devTimeoutSignal });

      // Lifecycle fence & operation guard (WP-5.4.2 Targeted Acceptance Audit):
      // Only commit if:
      // 1. This revalidation operation is still current (not superseded by newer login/logout/transition)
      // 2. The session epoch has not advanced since revalidation was dispatched
      // 3. If a mock token was present at dispatch time, active storage still matches that token
      const currentSession = authStorage.getSession();
      const currentEpoch = getCurrentSessionEpoch();
      const isRevalidationCurrent =
        opId === authOpSeqRef.current &&
        currentEpoch === requestEpoch &&
        (requestToken ? Boolean(currentSession && currentSession.token === requestToken) : true);

      if (isRevalidationCurrent) {
        setUser(response.user);
        if (import.meta.env.DEV && currentSession) {
          authStorage.setSession({
            ...currentSession,
            user: response.user,
          });
        }
        setError(null);
      }
    } catch (err: unknown) {
      const currentSession = authStorage.getSession();
      const currentEpoch = getCurrentSessionEpoch();
      const isRevalidationCurrent =
        opId === authOpSeqRef.current &&
        currentEpoch === requestEpoch &&
        (requestToken ? Boolean(currentSession && currentSession.token === requestToken) : true);

      if (isRevalidationCurrent) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 404)) {
          // Authoritative session invalidation (401, 403, 404)
          // Advance session epoch if invalidating an existing session to cancel stale in-flight responses
          if (requestToken || user) {
            advanceSessionEpoch();
          }
          authStorage.clearSession();
          setUser(null);
          setIsIsolatedSession(false);
          setIsolatedPersona(null);
          setEmergencyProof(null);
          // Only surface an explicit error message on cold start if there was a prior session that was rejected
          if (requestToken || err.status !== 401) {
            setError(err.message || 'انتهت صلاحية الجلسة أو تم تعليق الحساب.');
          } else {
            setError(null);
          }
        } else {
          // Temporary network failure / timeout / HTTP 500 (Section 5.G / State S5)
          // PRESERVE valid active session and origin snapshot in storage!
          // Do NOT destroy credentials, do NOT quarantine snapshot.
          // Do NOT elevate to Developer; do NOT expose unverified user in UI.
          setUser(null);
          setEmergencyProof(null); // No emergency proof during transient transport failure
          setError('تعذر التحقق من صلاحية الجلسة بسبب مشكلة في الاتصال بالخادم. يرجى إعادة المحاولة.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    revalidateSession();
  }, [revalidateSession]);

  const retryRevalidation = useCallback(async (): Promise<void> => {
    return revalidateSession();
  }, [revalidateSession]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    const opId = ++authOpSeqRef.current;
    const requestEpoch = getCurrentSessionEpoch();
    setIsLoading(true);
    setError(null);

    try {
      const timeoutSignal =
        typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
          ? AbortSignal.timeout(15000)
          : undefined;
      const response = await authApi.login(credentials, { signal: timeoutSignal });

      // 1. Validate response payload
      if (!response || !response.user || typeof response.user !== 'object' || !response.user.id) {
        throw new Error('استجابة غير صالحة من خادم المصادقة: تعذر التحقق من بيانات المستخدم.');
      }

      // 2. Operation-scoped & session-epoch guards (WP-5.4.2 & T-1.3.1 Acceptance Audit):
      // A superseded or stale login operation must NOT resolve as a successful login.
      const currentEpoch = getCurrentSessionEpoch();
      if (opId !== authOpSeqRef.current || currentEpoch !== requestEpoch) {
        throw new StaleEpochError(requestEpoch, currentEpoch, '/api/auth/login');
      }

      if (isDemoAuthMode()) {
        // Strict DEV token and expiry validation (T-1.3.1 Targeted Remediation)
        // A DEV/MSW authentication flow that requires a mock token must not establish an authenticated
        // state when that token is missing, empty, whitespace-only, or has an invalid expiry.
        const validated = validateDevMockSession(response);
        const session: AuthSession = {
          user: response.user,
          token: validated.token,
          expiresAt: validated.expiresAt,
        };
        advanceSessionEpoch();
        authStorage.setSession(session);
      } else {
        // D-AUTH-01: In production, authentication is established via Django HttpOnly session cookies.
        // Do not store session credentials in browser Web Storage in production.
        advanceSessionEpoch();
        authStorage.clearSession();
        authenticatedSessionEpochRef.current = getCurrentSessionEpoch();
      }

      setUser(response.user);
      setLogoutStatus(null);
      authStorage.clearLogoutStatus();

      // Decision D (WP-5.4.4): Preserve valid Developer origin snapshot in storage as inert.
      // Clear isolated session flags and invalidate any existing emergency proof for new identity.
      setIsIsolatedSession(false);
      setIsolatedPersona(null);
      setEmergencyProof(null);
      setVerifiedSnapshotDigest(null);
      setVerifiedSnapshotRevision(null);
    } catch (err: unknown) {
      if (opId === authOpSeqRef.current && !isStaleEpochError(err)) {
        const fallbackMsg = 'فشل تسجيل الدخول. يرجى المحاولة مرة أخرى.';
        const rawMsg = err instanceof Error ? err.message : fallbackMsg;
        setError(sanitizeErrorMessage(rawMsg, fallbackMsg));
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    const opId = ++authOpSeqRef.current;

    // Distinguish Isolated Persona Logout (S3/S4/S6 -> S12 -> S0, INV-P5-7)
    // from Real-User Logout (S1 -> S0 and Owner Decision C: S8 -> S7)
    const originAtStart = authStorage.getDeveloperOriginSession();
    const continuityAtStart = authStorage.inspectSessionContinuity();
    const isPersonaSessionInStorage = Boolean(
      originAtStart &&
      originAtStart.snapshotState !== 'inert' &&
      continuityAtStart.isRawSessionPresent &&
      continuityAtStart.userId === originAtStart.personaId
    );
    const isIsolatedPersonaLogout = Boolean(
      isIsolatedSession ||
      emergencyProof !== null ||
      (user !== null && originAtStart !== null && user.id === originAtStart.personaId) ||
      (user === null && isPersonaSessionInStorage)
    );

    // WP-5.4.2: Advance session epoch immediately upon initiating logout to invalidate all
    // pending protected in-flight requests before awaiting the network call
    advanceSessionEpoch();
    authenticatedSessionEpochRef.current = null;

    // Immediate client-side eviction: purge active session and reset user identity synchronously
    // so the application immediately transitions to /login without displaying the bootstrap LoadingScreen.
    authStorage.clearSession();

    if (isIsolatedPersonaLogout) {
      // Invariant INV-P5-7 (S3/S4/S6 -> S12 -> S0):
      // Explicit logout during an isolated persona session purges BOTH active test session
      // and saved Developer origin session, preventing orphaned Developer credentials.
      authStorage.clearDeveloperOriginSession();
    } else if (authStorage.hasDeveloperOriginSession()) {
      // Owner Decision C (S8 -> S7 / Real-User Logout Lifecycle):
      // Preserve the existing Developer origin snapshot in per-tab sessionStorage
      // in an inert, credential-free state until the browser tab terminates.
      authStorage.preserveInertDeveloperOriginSession();
    }

    setUser(null);
    setIsIsolatedSession(false);
    setIsolatedPersona(null);
    setEmergencyProof(null);
    setVerifiedSnapshotDigest(null);
    setVerifiedSnapshotRevision(null);
    setIsLoading(false);

    let isServerConfirmed = false;
    let unconfirmedErrorMsg: string | null = null;

    try {
      const timeoutSignal =
        typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
          ? AbortSignal.timeout(10000)
          : undefined;
      await authApi.logout({ signal: timeoutSignal });
      isServerConfirmed = true;
    } catch (err: unknown) {
      // Any error thrown by apiClient means the server did not successfully process the logout request.
      // A 401 response indicates that DRF authentication/permission checks failed before the logout view
      // executed; django.contrib.auth.logout() was NOT called and no Set-Cookie eviction was issued.
      isServerConfirmed = false;
      unconfirmedErrorMsg =
        err instanceof ApiError && err.status === 403
          ? 'فشل التحقق الأمني (CSRF) عند تسجيل الخروج. تم إغلاق الجلسة محلياً — يرجى إعادة المحاولة لتأكيد الإنهاء على الخادم.'
          : 'تعذر تأكيد إنهاء الجلسة على الخادم بسبب خطأ في الاتصال. تم إغلاق الواجهة محلياً — يرجى إعادة المحاولة لتأكيد تسجيل الخروج الكامل.';
    } finally {
      // Operation-scoped guard (WP-5.4.2 Audit): only commit logout state if this logout operation
      // has NOT been superseded by a newer login or authentication operation
      if (opId === authOpSeqRef.current) {
        if (isServerConfirmed) {
          setLogoutStatus('LOGOUT_CONFIRMED');
          authStorage.setLogoutStatus('LOGOUT_CONFIRMED');
          setError(null);
        } else {
          setLogoutStatus('LOGOUT_UNCONFIRMED');
          authStorage.setLogoutStatus('LOGOUT_UNCONFIRMED');
          setError(unconfirmedErrorMsg);
        }
      }
      setIsLoading(false);
    }
  }, [user, isIsolatedSession, emergencyProof]);

  const retryLogout = useCallback(async (): Promise<void> => {
    return logout();
  }, [logout]);

  /**
   * Legacy demo user switching — DECOMMISSIONED per Decision D-10 & Finding MFR-40.
   * Unrestricted session switching without origin preservation is strictly prohibited.
   */
  const switchDemoUser = useCallback(async (_role: UserRole): Promise<void> => {
    console.warn(
      '[DEPRECATED] switchDemoUser is decommissioned per Decision D-10 / MFR-40. ' +
      'Use launchIsolatedTestSession(personaId) for controlled role testing.'
    );
    throw new Error(
      'تم إلغاء آلية التبديل التجريبي المباشر (switchDemoUser). يرجى استخدام «جلسات اختبار الصلاحيات المعزولة» (launchIsolatedTestSession).'
    );
  }, []);

  /**
   * Controlled Isolated Test Session Launch (Increment 5.3 / Decision D-10 / MFR-40)
   *
   * Executes a strict 6-step transaction:
   * 1. Authenticates that the actor is the genuine Developer (AuthContext.user.role === 'developer').
   * 2. Validates personaId strictly against SYNTHETIC_TEST_PERSONA_REGISTRY (rejects real users, prefix-only).
   * 3. Validates session state (rejects nested launch, verifies no prior origin session).
   * 4. Preserves Developer session snapshot in metro_lms_developer_origin_session with write-back verification.
   * 5. Authenticates as synthetic persona; persona token becomes active apiClient token.
   * 6. Transactional rollback: On login failure, restores Developer session and removes origin snapshot.
   */
  const launchIsolatedTestSession = useCallback(
    async (personaId: string): Promise<boolean> => {
      // Step 0: Strict Development-Only Entry Boundary (Decision D-10 / T-1.1.1 Remediation)
      // Synthetic test-persona operations cannot execute in production builds.
      if (!import.meta.env.DEV) {
        throw new Error(
          'جلسات اختبار الصلاحيات المعزولة متاحة فقط في بيئة التطوير ولا يُسمح بتشغيلها في بيئة الإنتاج.'
        );
      }

      const opId = ++authOpSeqRef.current;

      // Step 1: Enforce Canonical Developer Actor Validation (Finding B / Invariants INV-R1, INV-R8)
      // 1. AuthContext.user exists
      // 2. AuthContext.user.role === 'developer'
      // 3. AuthContext.user.id === CANONICAL_DEVELOPER_ID ('USR_DEV_001')
      if (!user || user.role !== 'developer' || user.id !== CANONICAL_DEVELOPER_ID) {
        throw new Error(
          'فقط مطور النظام المعتمد بالمعرف القياسي USR_DEV_001 مصرح له ببدء جلسة اختبار صلاحيات معزولة.'
        );
      }

      // Step 2: Validate Target Persona against strict allowlist registry
      const persona = getSyntheticTestPersona(personaId);
      if (!persona) {
        throw new Error(
          `الحساب الاختباري «${personaId}» غير مسجل في سجل الشخصيات الاختبارية المصرح بها (SYNTHETIC_TEST_PERSONA_REGISTRY).`
        );
      }

      // Step 3: Validate Current Session State (anti-nesting and consistency)
      // 4. The active session exists and contains a non-empty token
      const currentSession = authStorage.getSession();
      if (!currentSession || !currentSession.token || typeof currentSession.token !== 'string' || currentSession.token.trim() === '') {
        throw new Error('تعذر قراءة رمز جلسة المطور الحالية لحفظها قبل التبديل.');
      }

      // 5. Active session user ID and role agree with authenticated AuthContext user
      if (
        !currentSession.user ||
        currentSession.user.id !== user.id ||
        currentSession.user.role !== user.role ||
        currentSession.user.id !== CANONICAL_DEVELOPER_ID
      ) {
        throw new Error('عدم تطابق بين هوية المستخدم النشط في السياق وبيانات الجلسة المحفوظة.');
      }

      // 6. Active session is not already an isolated persona session
      // 7. No existing Developer origin snapshot can be overwritten
      if (authStorage.hasDeveloperOriginSession() || isIsolatedSession) {
        throw new Error('لا يمكن بدء جلسة اختبار متداخلة؛ توجد جلسة اختبار معزولة نشطة بالفعل.');
      }

      // Step 4: Preserve the Developer Session with consistency verification
      // Note: saveDeveloperOriginSession strips `developerToken` before persisting to sessionStorage
      // and retains the runtime token strictly in volatile closure memory.
      const originSnapshot: RuntimeDeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: user,
        developerToken: currentSession.token,
        developerExpiresAt: currentSession.expiresAt,
        personaId: persona.id,
        snapshotState: 'active_origin',
      };

      const saved = authStorage.saveDeveloperOriginSession(originSnapshot);
      if (!saved) {
        throw new Error('فشل تأمين وحفظ لقطة جلسة المطور الأصلية في التخزين المعزول.');
      }

      // Explicit verification: read-back snapshot must represent the same canonical Developer, expiresAt,
      // and personaId, and must NOT persist any credential field (developerToken omitted from storage).
      const verifiedSnapshot = authStorage.getDeveloperOriginSession();
      if (
        !verifiedSnapshot ||
        verifiedSnapshot.developerUser.id !== CANONICAL_DEVELOPER_ID ||
        verifiedSnapshot.developerUser.role !== 'developer' ||
        verifiedSnapshot.developerExpiresAt !== currentSession.expiresAt ||
        verifiedSnapshot.personaId !== persona.id ||
        verifiedSnapshot.snapshotState === 'inert' ||
        'developerToken' in verifiedSnapshot
      ) {
        authStorage.clearDeveloperOriginSession();
        throw new Error('فشل التحقق من مطابقة لقطة جلسة المطور المحفوظة قبل تفعيل الشخصية الاختبارية.');
      }

      // Step 5: Activate the Synthetic Persona
      setIsLoading(true);
      setError(null);

      try {
        const response = await authApi.login(persona.credentials);
        if (opId !== authOpSeqRef.current) {
          return false;
        }
        // Strict DEV persona token and expiry validation (T-1.3.1 Targeted Remediation)
        // Must reject missing, empty, or whitespace tokens, and invalid expiresAt.
        // Fails closed immediately without calling authStorage.setSession or activating React isolated state.
        const validated = validateDevMockSession(response);
        const newSession: AuthSession = {
          user: response.user,
          token: validated.token,
          expiresAt: validated.expiresAt,
        };

        // Monotonically advance session epoch to invalidate Developer-owned in-flight requests (WP-5.4.2)
        advanceSessionEpoch();
        authStorage.setSession(newSession);
        setUser(response.user);
        setIsIsolatedSession(true);
        setIsolatedPersona(persona);
        return true;
      } catch (loginErr: unknown) {
        if (opId !== authOpSeqRef.current) {
          return false;
        }
        // Step 6: Transaction Rollback on Failure (Fail-Closed Ordering)
        console.error('Failed to authenticate synthetic test persona. Initiating rollback to Developer session:', loginErr);

        // 1. Attempt to restore the original Developer session in authStorage
        let storageRestorationSucceeded = false;
        try {
          if (originSnapshot.developerExpiresAt <= Date.now()) {
            storageRestorationSucceeded = false;
          } else {
            authStorage.setSession(currentSession);
            // 2. Read the active session back
            const restoredSession = authStorage.getSession();
            // 3. Verify all consistency requirements against the local runtime session
            storageRestorationSucceeded = Boolean(
              restoredSession &&
              restoredSession.user &&
              restoredSession.user.id === CANONICAL_DEVELOPER_ID &&
              restoredSession.user.role === 'developer' &&
              restoredSession.token === currentSession.token &&
              restoredSession.expiresAt === originSnapshot.developerExpiresAt
            );
          }
        } catch (storageErr) {
          console.error('Failed writing restored session to storage:', storageErr);
          storageRestorationSucceeded = false;
        }

        if (storageRestorationSucceeded && opId === authOpSeqRef.current) {
          // 4. Only after all checks succeed:
          // Advance session epoch on rollback to invalidate persona-owned in-flight requests (WP-5.4.2)
          advanceSessionEpoch();
          // Update AuthContext.user to the canonical Developer user
          setUser(originSnapshot.developerUser);
          // Clear isolated-session marker and persona state
          setIsIsolatedSession(false);
          setIsolatedPersona(null);
          // Clear the origin snapshot
          authStorage.clearDeveloperOriginSession();

          const fallback = 'فشل تسجيل الدخول بحساب الشخصية الاختبارية، وتم التراجع واستعادة جلسة المطور بنجاح.';
          const msg = loginErr instanceof Error ? loginErr.message : fallback;
          setError(msg);
          throw new Error(msg);
        } else {
          // 5. Fail-closed: Restoration cannot be confirmed
          // - Preserve the Developer origin snapshot
          // - Do not expose Developer identity in AuthContext
          // - Do not silently clear isolated-session state while active token may belong to test persona
          // - Prevent privileged Developer UI or actions from being exposed
          setUser(null);
          console.error('CRITICAL: Rollback failed to verify Developer session in storage. Preserving origin snapshot and failing closed.');
          const recoveryError =
            'فشل تفعيل جلسة الشخصية الاختبارية وتعذر تأكيد استعادة جلسة المطور في التخزين. ' +
            'تم تأمين التطبيق وإيقاف الصلاحيات، مع الاحتفاظ ببيانات الجلسة الأصلية للاسترداد.';
          setError(recoveryError);
          throw new Error(recoveryError);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [user, isIsolatedSession]
  );

  /**
   * Return to Developer Session (Increment 5.3 / Decision D-10)
   *
   * Executes the full return flow with strict consistency verification:
   * 1. Confirms an isolated session is active and retrieves snapshot.
   * 2. Validates snapshot structure, version, canonical Developer identity, and exact expiration.
   * 3. Restores exact Developer user, token, and expiration in storage first.
   * 4. Verifies active storage session matches restored Developer identity, token, and expiration.
   * 5. Updates React identity and clears isolated state and origin snapshot.
   * 6. Preserves origin snapshot if restoration fails.
   */
  const returnToDeveloperSession = useCallback(async (): Promise<boolean> => {
    // 0. Strict Development-Only Entry Boundary (Decision D-10 / T-1.1.1 Remediation)
    // In production builds, fail closed immediately before reading/creating tokens or mutating state.
    if (!import.meta.env.DEV) {
      throw new Error(
        'استعادة جلسة المطور من جلسة اختبار معزولة متاحة فقط في بيئة التطوير ولا يُسمح بتشغيلها في بيئة الإنتاج.'
      );
    }

    const opId = ++authOpSeqRef.current;

    // 1. Confirm that an isolated session is active
    const origin = authStorage.getDeveloperOriginSession();
    if (!origin) {
      throw new Error('لم يتم العثور على لقطة جلسة المطور الأصلية للرجوع إليها.');
    }

    // 2. Validate snapshot structure, version, active_origin state, canonical Developer identity, and finite positive expiration
    // Inert S7 snapshots (snapshotState === 'inert') NEVER authorize Developer session restoration.
    if (
      origin.schemaVersion !== 1 ||
      origin.snapshotState === 'inert' ||
      !origin.developerUser ||
      origin.developerUser.id !== CANONICAL_DEVELOPER_ID ||
      origin.developerUser.role !== 'developer' ||
      typeof origin.developerExpiresAt !== 'number' ||
      !Number.isFinite(origin.developerExpiresAt) ||
      origin.developerExpiresAt <= 0
    ) {
      // Do NOT destroy origin on corrupted snapshot, preserve for recovery
      throw new Error('بيانات جلسة المطور الأصلية المحفوظة غير صالحة أو تالفة.');
    }

    // 2b. Strict Fail-Closed Volatile Runtime Credential Requirement (T-1.1.1 Targeted Remediation):
    // Obtain the runtime credential exclusively through authStorage.getRuntimeDeveloperTokenForRestore().
    // Never synthesize, derive, reconstruct, or substitute a token from savedAt, user IDs, or snapshot metadata.
    const runtimeDeveloperToken = authStorage.getRuntimeDeveloperTokenForRestore();
    if (
      !runtimeDeveloperToken ||
      typeof runtimeDeveloperToken !== 'string' ||
      runtimeDeveloperToken.trim() === ''
    ) {
      const missingCredentialMsg =
        'رمز جلسة المطور المؤقت في الذاكرة غير متوفر. تعذر استعادة جلسة المطور من اللقطة المحفوظة وحدها؛ يرجى تسجيل الدخول مجدداً.';
      setError(missingCredentialMsg);
      throw new Error(missingCredentialMsg);
    }

    // 3. Core Return-State Consistency (Increment 5.3 / Finding MFR-40)
    // Both storage snapshot and React AuthContext state must agree that an isolated session is active
    if (!isIsolatedSession) {
      throw new Error('حالة الجلسة المعزولة غير مفعلة في سياق التطبيق.');
    }

    if (!isolatedPersona) {
      throw new Error('بيانات الشخصية الاختبارية غير متوفرة في سياق التطبيق.');
    }

    if (isolatedPersona.id !== origin.personaId) {
      throw new Error('الشخصية الاختبارية في سياق التطبيق لا تطابق معرف الشخصية المحفوظ في لقطة المطور.');
    }

    // 4. Actor Validation & Security Barrier: The active authenticated user must be the genuine target persona
    // Invariant: An origin snapshot NEVER authorizes restoration by itself.
    if (!user) {
      throw new Error('لا يوجد مستخدم نشط مسجل للدخول لتأكيد استعادة جلسة المطور.');
    }

    if (user.id !== origin.personaId) {
      throw new Error('المستخدم النشط الحالي لا يطابق الشخصية الاختبارية المرتبطة بالجلسة المعزولة.');
    }

    // 5. Validate registered persona from allowlist
    const persona = getSyntheticTestPersona(origin.personaId);
    if (!persona) {
      throw new Error('شخصية الجلسة المعزولة غير مسجلة في سجل الشخصيات الاختبارية المصرح بها.');
    }

    if (user.id !== persona.id || user.role !== persona.role) {
      throw new Error('بيانات المستخدم النشط لا تتطابق مع هوية وصلاحيات الشخصية الاختبارية المعتمدة.');
    }

    // 6. Active Storage Session Verification
    const currentSession = authStorage.getSession();
    if (
      !currentSession ||
      !currentSession.user ||
      currentSession.user.id !== user.id ||
      currentSession.user.role !== user.role ||
      !currentSession.token ||
      typeof currentSession.token !== 'string' ||
      currentSession.token.trim() === '' ||
      currentSession.token === runtimeDeveloperToken
    ) {
      throw new Error('عدم تطابق بين هوية المستخدم النشط وبيانات الجلسة المحفوظة في التخزين.');
    }

    // 7. Strict Token Format & Persona Binding Verification (Increment 5.3 / Finding MFR-40)
    // The active storage token must strictly conform to the exact structure generated by MSW login:
    // ^mock_jwt_<exact-origin.personaId>_<13-digit-epoch-millisecond-timestamp>$
    // Rejects empty tokens, missing prefixes, missing subjects, missing/non-numeric timestamps,
    // short or oversized numeric suffixes, non-safe integers, unexpected trailing suffixes,
    // alternative formats, or tokens belonging to any other persona/actor.
    const escapedPersonaId = origin.personaId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const strictPersonaTokenPattern = new RegExp(`^mock_jwt_${escapedPersonaId}_(\\d{13})$`);
    const tokenMatch = currentSession.token.match(strictPersonaTokenPattern);

    if (!tokenMatch) {
      throw new Error('رمز الجلسة النشط في التخزين غير مطابق للصيغة القياسية المعتمدة للشخصية الاختبارية.');
    }

    const parsedTimestamp = Number(tokenMatch[1]);
    if (!Number.isSafeInteger(parsedTimestamp) || parsedTimestamp <= 0) {
      throw new Error('رمز الجلسة النشط في التخزين غير مطابق للصيغة القياسية المعتمدة للشخصية الاختبارية.');
    }

    // 8. Runtime Expiration Check: verify Developer expiration timestamp is still in the future
    if (Date.now() >= origin.developerExpiresAt) {
      // Invariant: Do not restore Developer identity, do not create replacement expiration,
      // preserve origin snapshot for diagnosis/recovery, fail closed.
      const expiredMsg =
        'انتهت صلاحية جلسة المطور الأصلية أثناء جلسة الاختبار المعزولة. ' +
        'تم تأمين التطبيق والاحتفاظ ببيانات الجلسة الأصلية للاسترداد دون تمديد غير مصرح به.';
      setError(expiredMsg);
      throw new Error(expiredMsg);
    }

    setIsLoading(true);
    try {
      // Advance session epoch to invalidate persona-owned in-flight requests before restoring Developer (WP-5.4.2)
      advanceSessionEpoch();

      // 7. Restore exact Developer user, runtime token, and original expiration in storage first
      const developerSession: AuthSession = {
        user: origin.developerUser,
        token: runtimeDeveloperToken,
        expiresAt: origin.developerExpiresAt,
      };

      authStorage.setSession(developerSession);

      // 8. Confirm the active storage session matches restored Developer identity, token, and expiration
      const verifiedSession = authStorage.getSession();
      if (
        !verifiedSession ||
        verifiedSession.user.id !== CANONICAL_DEVELOPER_ID ||
        verifiedSession.user.role !== 'developer' ||
        verifiedSession.token !== runtimeDeveloperToken ||
        verifiedSession.expiresAt !== origin.developerExpiresAt
      ) {
        throw new Error('فشل التحقق من مطابقة الجلسة المستعادة في التخزين مع بيانات المطور الأصلية.');
      }

      // 9. Update React identity only after storage confirmation
      if (opId !== authOpSeqRef.current) {
        return false;
      }
      setUser(origin.developerUser);

      // 10. Only then clear origin snapshot and isolated session state
      authStorage.clearDeveloperOriginSession();
      setIsIsolatedSession(false);
      setIsolatedPersona(null);
      setEmergencyProof(null);
      setVerifiedSnapshotDigest(null);
      setVerifiedSnapshotRevision(null);
      setError(null);
      return true;
    } catch (err: unknown) {
      console.error('Failed to restore Developer session:', err);
      // Invariant: Do NOT destroy the origin session on failure!
      const fallback = 'تعذر استعادة جلسة المطور الأصلية. تم الإبقاء على اللقطة المحفوظة للمحاولة لاحقاً.';
      const msg = err instanceof Error ? err.message : fallback;
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [user, isIsolatedSession, isolatedPersona]);

  /**
   * Dedicated Emergency Return from Expired Persona Session (Increment 5.4 / WP-5.4.4 / Decision A)
   *
   * Executes the mandatory 13-step emergency return transaction:
   * Step 1: Inspect historical session state from active-lifecycle memory-only proof.
   * Step 2: Safely validate stored session structure (fail closed if malformed/missing).
   * Step 3: Validate synthetic persona allowlist (SYNTHETIC_TEST_PERSONA_REGISTRY).
   * Step 4: Validate historical persona token evidence (mock_jwt_ format, positive timestamp, conclusively expired).
   * Step 5: Match historical persona ID and Developer origin snapshot personaId.
   * Step 6: Reconfirm persona expiration (Date.now() > expiresAt).
   * Step 7: Validate Developer origin snapshot (schema, USR_DEV_001, developer role, token, unexpired developerExpiresAt).
   *         If expired: apply Decision C quarantine under metro_lms_quarantined_snapshot, clear snapshot, fail closed.
   * Step 8: Validate internal ephemeral continuity proof and recompute SHA-256 snapshot digest.
   * Step 9: Ensure expired persona token cannot be used and no other real user is active.
   * Step 10: Render dedicated Emergency Return Banner with explicit user action (handled in UI).
   * Step 11: Single-flight guard against duplicate or concurrent execution.
   * Step 12: Advance session epoch via advanceSessionEpochForEmergencyReturn(), restore exact Developer identity/token/expiration,
   *          and verify storage write with immediate read-back.
   * Step 13: Cleanup and clear origin snapshot only after verified restoration; on failure, fail closed and preserve snapshot.
   */
  const returnFromExpiredPersonaSession = useCallback(async (): Promise<boolean> => {
    // Step 0: Strict Development-Only Entry Boundary (Decision D-10 / T-1.1.1 Remediation)
    // Fail closed in production before any state updates, counter increments, or operations.
    if (!import.meta.env.DEV) {
      throw new Error(
        'استعادة الطوارئ لجلسة المطور متاحة فقط في بيئة التطوير ولا يُسمح بتشغيلها في بيئة الإنتاج.'
      );
    }

    // Step 11: Single-flight / transaction-in-progress guard
    if (isEmergencyReturnInFlightRef.current) {
      console.warn('Emergency return transaction is already in flight.');
      return false;
    }
    isEmergencyReturnInFlightRef.current = true;

    // Capture generation and snapshot revision at initiation
    const opId = ++authOpSeqRef.current;
    const initialStorageRevision = getDeveloperOriginSnapshotVersion();
    setIsLoading(true);

    try {

      // Step 1 & 8: Validate internal memory-only emergency proof in current lifecycle
      if (!emergencyProof) {
        throw new Error('لا يوجد إثبات استمرارية طوارئ صالح في دورة الحياة الحالية للاستعادة.');
      }

      // Step 2 & 9: Verify current application identity state
      // Emergency return is ONLY authorized when AuthContext.user === null (no active authenticated identity)
      if (user !== null) {
        setEmergencyProof(null);
        setVerifiedSnapshotDigest(null);
        setVerifiedSnapshotRevision(null);
        throw new Error('يوجد مستخدم نشط مسجل الدخول بالفعل. تم إلغاء استعادة الطوارئ لحماية الجلسة النشطة.');
      }

      // Active storage session check: must NOT have a different real user session active
      const activeStoredSession = authStorage.getSession();
      if (activeStoredSession && activeStoredSession.user?.id !== emergencyProof.personaId) {
        setEmergencyProof(null);
        setVerifiedSnapshotDigest(null);
        setVerifiedSnapshotRevision(null);
        throw new Error('يوجد مستخدم آخر نشط في التخزين. تم إلغاء استعادة الطوارئ.');
      }

      // Step 3: Validate synthetic persona allowlist & canonical role
      const targetPersonaId = emergencyProof.personaId;
      const persona = getSyntheticTestPersona(targetPersonaId);
      if (!persona || persona.id !== targetPersonaId) {
        setEmergencyProof(null);
        setVerifiedSnapshotDigest(null);
        setVerifiedSnapshotRevision(null);
        throw new Error('الشخصية الاختبارية غير مسجلة في سجل الشخصيات المصرح بها.');
      }

      // Validate mandatory canonical persona role matching
      if (
        !emergencyProof.personaRole ||
        typeof emergencyProof.personaRole !== 'string' ||
        emergencyProof.personaRole !== persona.role
      ) {
        setEmergencyProof(null);
        setVerifiedSnapshotDigest(null);
        setVerifiedSnapshotRevision(null);
        throw new Error('صلاحية الشخصية التاريخية غير مطابقة لسجل الشخصيات المصرح بها.');
      }

      // Step 4: Validate historical persona token evidence & retained historical continuity metadata
      const tokenTs = emergencyProof.tokenTimestamp;
      if (!tokenTs || !Number.isSafeInteger(tokenTs) || tokenTs <= 0) {
        setEmergencyProof(null);
        setVerifiedSnapshotDigest(null);
        setVerifiedSnapshotRevision(null);
        throw new Error('بيانات الطابع الزمني لرمز الجلسة التاريخية غير صالحة.');
      }

      // Validate historical tokenSubject
      if (!emergencyProof.tokenSubject || emergencyProof.tokenSubject !== targetPersonaId) {
        setEmergencyProof(null);
        setVerifiedSnapshotDigest(null);
        setVerifiedSnapshotRevision(null);
        throw new Error('رمز الجلسة التاريخي لا يطابق شخصية المطور الأصلية.');
      }

      // Validate conclusive historical persona expiration (Date.now() > personaExpiresAt)
      if (
        typeof emergencyProof.personaExpiresAt !== 'number' ||
        !Number.isSafeInteger(emergencyProof.personaExpiresAt) ||
        emergencyProof.personaExpiresAt <= 0 ||
        Date.now() <= emergencyProof.personaExpiresAt
      ) {
        setEmergencyProof(null);
        setVerifiedSnapshotDigest(null);
        setVerifiedSnapshotRevision(null);
        throw new Error('بيانات انتهاء صلاحية الشخصية التاريخية غير صالحة أو لم تنتهِ صلاحيتها بشكل قاطع.');
      }

      // Step 7: Retrieve and validate Developer origin snapshot
      const origin = authStorage.getDeveloperOriginSession();
      if (!origin) {
        setEmergencyProof(null);
        setVerifiedSnapshotDigest(null);
        setVerifiedSnapshotRevision(null);
        throw new Error('لم يتم العثور على لقطة جلسة المطور الأصلية المحفوظة.');
      }

      if (!isValidDeveloperOriginSession(origin)) {
        authStorage.clearDeveloperOriginSession();
        setEmergencyProof(null);
        setVerifiedSnapshotDigest(null);
        setVerifiedSnapshotRevision(null);
        throw new Error('لقطة جلسة المطور الأصلية تالفة أو غير صالحة.');
      }

      if (
        origin.snapshotState === 'inert' ||
        origin.developerUser.id !== CANONICAL_DEVELOPER_ID ||
        origin.developerUser.role !== 'developer'
      ) {
        authStorage.clearDeveloperOriginSession();
        setEmergencyProof(null);
        setVerifiedSnapshotDigest(null);
        setVerifiedSnapshotRevision(null);
        throw new Error('بيانات المستخدم في لقطة المطور غير مطابقة للهوية القياسية للمطور.');
      }

      // Step 5: Match persona and Developer origin snapshot
      if (origin.personaId !== targetPersonaId || origin.personaId !== emergencyProof.tokenSubject) {
        setEmergencyProof(null);
        setVerifiedSnapshotDigest(null);
        setVerifiedSnapshotRevision(null);
        throw new Error('معرف الشخصية في اللقطة لا يطابق إثبات استمرارية الطوارئ.');
      }

      // Step 7 (cont): Check Developer snapshot expiration (Decision C)
      if (Date.now() >= origin.developerExpiresAt) {
        // Conclusively expired Developer snapshot: Quarantine sanitized diagnostic metadata
        authStorage.quarantineDeveloperOriginSession(origin, 'DEVELOPER_SNAPSHOT_EXPIRED');
        authStorage.clearDeveloperOriginSession();
        setEmergencyProof(null);
        setVerifiedSnapshotDigest(null);
        setVerifiedSnapshotRevision(null);
        const expiredMsg =
          'انتهت صلاحية جلسة المطور الأصلية المحفوظة وتم نقل البيانات التشخيصية المعقمة للحجر. يرجى تسجيل الدخول مجدداً.';
        setError(expiredMsg);
        throw new Error(expiredMsg);
      }

      // Step 8: Recompute SHA-256 digest of current Developer origin snapshot
      const currentDigest = await computeOriginSnapshotDigest(origin);
      if (!currentDigest || currentDigest !== emergencyProof.originSnapshotFingerprint) {
        setEmergencyProof(null);
        setVerifiedSnapshotDigest(null);
        setVerifiedSnapshotRevision(null);
        throw new Error('بصمة لقطة المطور الأصلية لا تطابق إثبات الاستمرارية المعتمد.');
      }

      // PRE-WRITE SUPERSESSION & IDENTITY SWITCH CHECK:
      // Verify that after all asynchronous digest/validation work:
      // 1. The emergency transaction has not been superseded by a newer login, logout, or session transition
      // 2. AuthContext user is still null (no real user authenticated)
      // 3. Storage does not have a newer active user session
      // 4. Emergency proof is still valid and unconsumed
      // 5. Origin snapshot in storage is still present, valid, and unchanged in revision
      const currentStorageSession = authStorage.getSession();
      const liveStorageRevision = getDeveloperOriginSnapshotVersion();
      const liveOrigin = authStorage.getDeveloperOriginSession();

      if (
        opId !== authOpSeqRef.current ||
        user !== null ||
        !emergencyProof ||
        !liveOrigin ||
        liveOrigin.snapshotState === 'inert' ||
        liveStorageRevision !== initialStorageRevision ||
        (currentStorageSession && currentStorageSession.user?.id !== emergencyProof.personaId)
      ) {
        console.warn('Emergency return transaction superseded or context invalidated before storage commit.');
        return false;
      }

      // Step 9: Ensure volatile runtime Developer credential is available BEFORE evicting storage or advancing epoch
      // Strict Fail-Closed Requirement (T-1.1.1 Targeted Remediation):
      // Obtain the runtime credential exclusively through authStorage.getRuntimeDeveloperTokenForRestore().
      // Never synthesize, derive, reconstruct, or substitute a token from savedAt, user IDs, or snapshot metadata.
      const runtimeDeveloperToken = authStorage.getRuntimeDeveloperTokenForRestore();
      if (
        !runtimeDeveloperToken ||
        typeof runtimeDeveloperToken !== 'string' ||
        runtimeDeveloperToken.trim() === ''
      ) {
        setEmergencyProof(null);
        setVerifiedSnapshotDigest(null);
        setVerifiedSnapshotRevision(null);
        setIsIsolatedSession(false);
        setIsolatedPersona(null);
        setUser(null);
        const missingTokenMsg =
          'رمز جلسة المطور المؤقت في الذاكرة غير متوفر. تم إبطال استعادة الطوارئ وتأمين التطبيق؛ يرجى تسجيل الدخول مجدداً.';
        setError(missingTokenMsg);
        throw new Error(missingTokenMsg);
      }

      // Ensure expired persona session is completely evicted from storage before Developer write
      if (currentStorageSession && currentStorageSession.user?.id === emergencyProof.personaId) {
        authStorage.clearSession();
      }

      // Step 12: Restore and verify exact original Developer session
      // Advance session epoch through approved emergency return integration hook (WP-5.4.2)
      // Strictly invoked AFTER pre-write supersession and volatile token validation have succeeded!
      advanceSessionEpochForEmergencyReturn();

      // Restore exact Developer session
      const restoredDeveloperSession: AuthSession = {
        user: origin.developerUser,
        token: runtimeDeveloperToken,
        expiresAt: origin.developerExpiresAt,
      };

      // Write to storage first
      authStorage.setSession(restoredDeveloperSession);

      // Verify active storage session matches restored Developer identity, token, and expiration
      const verifiedSession = authStorage.getSession();
      const isReadbackValid = Boolean(
        verifiedSession &&
        verifiedSession.user.id === CANONICAL_DEVELOPER_ID &&
        verifiedSession.user.role === 'developer' &&
        verifiedSession.token === runtimeDeveloperToken &&
        verifiedSession.expiresAt === origin.developerExpiresAt
      );

      if (!isReadbackValid) {
        // Rollback identity safety: ONLY clear if stored session belongs to this attempted transaction!
        const latestSession = authStorage.getSession();
        if (
          latestSession &&
          latestSession.token === runtimeDeveloperToken &&
          latestSession.user.id === CANONICAL_DEVELOPER_ID
        ) {
          authStorage.clearSession();
        }
        setEmergencyProof(null);
        setVerifiedSnapshotDigest(null);
        setVerifiedSnapshotRevision(null);
        throw new Error('فشل التحقق من مطابقة جلسة المطور المستعادة في التخزين.');
      }

      // POST-READBACK FINAL SUPERSESSION CHECK:
      // Verify no newer operation superseded this transaction while write/read-back occurred
      if (opId !== authOpSeqRef.current) {
        console.warn('Emergency return superseded immediately after storage write.');
        const latestSession = authStorage.getSession();
        if (
          latestSession &&
          latestSession.token === runtimeDeveloperToken &&
          latestSession.user.id === CANONICAL_DEVELOPER_ID
        ) {
          authStorage.clearSession();
        }
        return false;
      }

      // Step 13: Cleanup ONLY after successful verification and un-superseded confirmation
      authStorage.clearDeveloperOriginSession();
      setUser(origin.developerUser);
      setIsIsolatedSession(false);
      setIsolatedPersona(null);
      setEmergencyProof(null);
      setVerifiedSnapshotDigest(null);
      setVerifiedSnapshotRevision(null);
      setError(null);
      return true;
    } catch (err: unknown) {
      console.error('Failed to execute emergency return from expired persona session:', err);
      // Invalidate the proof on any failed attempt to prevent replay attacks
      setEmergencyProof(null);
      setVerifiedSnapshotDigest(null);
      setVerifiedSnapshotRevision(null);
      const fallback = 'تعذر استعادة جلسة المطور لحالة الطوارئ. تم الإبقاء على اللقطة الصالحة في التخزين.';
      const msg = err instanceof Error ? err.message : fallback;
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
      isEmergencyReturnInFlightRef.current = false;
    }
  }, [user, emergencyProof]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const currentOriginForProof = authStorage.getDeveloperOriginSession();

  // Synchronous structural, development-boundary, volatile-token, and unexpired eligibility check
  const isSynchronouslyValid = Boolean(
    import.meta.env.DEV &&
    user === null &&
    emergencyProof !== null &&
    currentOriginForProof !== null &&
    isValidDeveloperOriginSession(currentOriginForProof) &&
    currentOriginForProof.snapshotState !== 'inert' &&
    Date.now() < currentOriginForProof.developerExpiresAt &&
    emergencyProof.personaId === currentOriginForProof.personaId &&
    Boolean(authStorage.getRuntimeDeveloperTokenForRestore())
  );

  // Derive emergency eligibility strictly as false while async validation is pending or on mismatch:
  // (WP-5.4.1 Final Source Audit)
  // Requires:
  // 1. Synchronously valid snapshot and matching personaId.
  // 2. Snapshot revision in storage matches verified revision (no same-tab mutation).
  // 3. Verified SHA-256 digest matches emergencyProof.originSnapshotFingerprint.
  const isEmergencyState = Boolean(
    isSynchronouslyValid &&
    verifiedSnapshotDigest !== null &&
    verifiedSnapshotRevision !== null &&
    snapshotRevision === verifiedSnapshotRevision &&
    verifiedSnapshotDigest === emergencyProof?.originSnapshotFingerprint
  );

  // Effect for asynchronous SHA-256 digest verification and stale proof invalidation
  // (WP-5.4.1 Final Source Audit).
  // STRICT LIFECYCLE REQUIREMENTS:
  // 1. Never updates state during render phase.
  // 2. Local cancellation flag (isCancelled) prevents stale async results from restoring eligibility
  //    after snapshot changes (Case B) or component unmounts (Case A).
  // 3. When snapshot identity or revision changes, cleanup cancels in-flight digest and triggers fresh validation.
  // 4. On digest mismatch or Web Crypto unavailability, invalidates proof and clears verified digest and revision.
  useEffect(() => {
    let isCancelled = false;

    if (!emergencyProof) {
      if (verifiedSnapshotDigest !== null || verifiedSnapshotRevision !== null) {
        setVerifiedSnapshotDigest(null);
        setVerifiedSnapshotRevision(null);
      }
      return;
    }

    const currentOrigin = authStorage.getDeveloperOriginSession();
    const runtimeTokenAvailable = Boolean(authStorage.getRuntimeDeveloperTokenForRestore());
    if (
      !import.meta.env.DEV ||
      !runtimeTokenAvailable ||
      !currentOrigin ||
      !isValidDeveloperOriginSession(currentOrigin) ||
      currentOrigin.snapshotState === 'inert' ||
      Date.now() >= currentOrigin.developerExpiresAt ||
      currentOrigin.personaId !== emergencyProof.personaId
    ) {
      // Synchronous failure: invalidate proof immediately
      setVerifiedSnapshotDigest(null);
      setVerifiedSnapshotRevision(null);
      setEmergencyProof(null);
      return;
    }

    // If already verified for the current snapshot revision and matching digest, skip re-computation
    if (
      verifiedSnapshotRevision !== null &&
      snapshotRevision === verifiedSnapshotRevision &&
      verifiedSnapshotDigest === emergencyProof.originSnapshotFingerprint
    ) {
      return;
    }

    const currentRevision = snapshotRevision;
    if (getDeveloperOriginSnapshotVersion() !== currentRevision) {
      // Storage version already diverged before starting; another render/update is in flight
      return;
    }

    // Asynchronously compute SHA-256 digest of current storage snapshot
    computeOriginSnapshotDigest(currentOrigin)
      .then((digest) => {
        // Pre-commit validation guards (WP-5.4.1 Final Technical Acceptance):
        const latestStorageVersion = getDeveloperOriginSnapshotVersion();
        const canCommit = shouldCommitDigestResult({
          isCancelled,
          capturedRevision: currentRevision,
          liveStorageRevision: latestStorageVersion,
          activeValidationRevision: snapshotRevision,
        });

        if (!canCommit) {
          return;
        }

        if (digest && digest === emergencyProof.originSnapshotFingerprint) {
          setVerifiedSnapshotDigest(digest);
          setVerifiedSnapshotRevision(currentRevision);
        } else {
          // Digest mismatch or Web Crypto failure: fail closed immediately
          setVerifiedSnapshotDigest(null);
          setVerifiedSnapshotRevision(null);
          setEmergencyProof(null);
        }
      })
      .catch(() => {
        const latestStorageVersion = getDeveloperOriginSnapshotVersion();
        const canCommit = shouldCommitDigestResult({
          isCancelled,
          capturedRevision: currentRevision,
          liveStorageRevision: latestStorageVersion,
          activeValidationRevision: snapshotRevision,
        });
        if (!canCommit) {
          return;
        }
        setVerifiedSnapshotDigest(null);
        setVerifiedSnapshotRevision(null);
        setEmergencyProof(null);
      });

    return () => {
      isCancelled = true;
    };
  }, [emergencyProof, snapshotRevision, verifiedSnapshotRevision, verifiedSnapshotDigest]);

  const activeEmergencyProof = isEmergencyState ? emergencyProof : null;

  const value: AuthContextValue = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    error,
    login,
    logout,
    logoutStatus,
    retryLogout,
    switchDemoUser,
    clearError,
    isIsolatedSession,
    isolatedPersona,
    launchIsolatedTestSession,
    returnToDeveloperSession,
    returnFromExpiredPersonaSession,
    retryRevalidation,
    isEmergencyState,
    emergencyProof: activeEmergencyProof,
    sessionEpoch,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
