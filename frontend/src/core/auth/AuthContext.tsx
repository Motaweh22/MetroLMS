import React, { useState, useEffect, useCallback } from 'react';
import type {
  User,
  LoginCredentials,
  UserRole,
  AuthContextValue,
  AuthSession,
  EmergencyContinuityProof,
} from './types';
import { AuthContext } from './context';
import {
  authStorage,
  isValidDeveloperOriginSession,
  getDeveloperOriginSnapshotVersion,
  subscribeToDeveloperOriginChanges,
  type DeveloperOriginSession,
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
import { sanitizeErrorMessage, ApiError } from '@/core/api/apiClient';

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
export async function computeOriginSnapshotDigest(origin: DeveloperOriginSession): Promise<string | null> {
  if (!origin) return null;

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

  const canonicalRepresentation = {
    schemaVersion: origin.schemaVersion,
    personaId: origin.personaId || '',
    savedAt: origin.savedAt || '',
    developerExpiresAt: origin.developerExpiresAt,
    developerToken: origin.developerToken || '',
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Increment 5.4 / WP-5.4.1: Non-destructive continuity inspection on initialization
  // Avoid calling getSession() directly if expired, preventing premature eviction
  const initialContinuity = authStorage.inspectSessionContinuity();
  const initialOrigin = authStorage.getDeveloperOriginSession();

  // Strict Expiration Boundary: Date.now() < developerExpiresAt (unexpired)
  const isInitialOriginValidAndUnexpired = Boolean(
    initialOrigin && Date.now() < initialOrigin.developerExpiresAt
  );

  // Persona session expiration boundary: Date.now() <= expiresAt (unexpired)
  const hasInitialToken = Boolean(
    initialContinuity.isRawSessionPresent &&
    !initialContinuity.isExpired &&
    initialContinuity.expiresAt &&
    Date.now() <= initialContinuity.expiresAt
  );

  // MFR-20: Gated session state — do NOT expose unvalidated stored user as authenticated
  // before successful server revalidation. Protected content remains inaccessible.
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(hasInitialToken);
  const [error, setError] = useState<string | null>(null);

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
    if (!isInitialOriginValidAndUnexpired || !initialOrigin) return false;
    return Boolean(
      initialContinuity.hasStructuralIntegrity &&
      !initialContinuity.isExpired &&
      initialContinuity.userId === initialOrigin.personaId
    );
  });

  const [isolatedPersona, setIsolatedPersona] = useState<SyntheticTestPersona | null>(() => {
    if (!isInitialOriginValidAndUnexpired || !initialOrigin) return null;
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
    setIsLoading(true);

    // 1. Inspect Developer origin snapshot safely
    let originSnapshot: DeveloperOriginSession | null = null;
    let isOriginCorrupted = false;

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const rawOrigin = window.sessionStorage.getItem('metro_lms_developer_origin_session');
        if (rawOrigin) {
          try {
            const parsedOrigin = JSON.parse(rawOrigin);
            if (isValidDeveloperOriginSession(parsedOrigin)) {
              originSnapshot = parsedOrigin;
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
      authStorage.clearDeveloperOriginSession();
      const continuity = authStorage.inspectSessionContinuity();
      if (continuity.isRawSessionPresent && continuity.userId && continuity.userId.startsWith('USR_TEST_')) {
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
    if (continuity.isExpired) {
      if (
        originSnapshot &&
        Date.now() < originSnapshot.developerExpiresAt &&
        continuity.hasStructuralIntegrity &&
        continuity.userId === originSnapshot.personaId &&
        continuity.tokenSubject === originSnapshot.personaId
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
          provenAt: Date.now(),
          tokenTimestamp: continuity.tokenTimestamp || Date.now(),
          originSnapshotFingerprint: snapshotDigest,
        });
        setIsIsolatedSession(true);
        setIsolatedPersona(getSyntheticTestPersona(originSnapshot.personaId));
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

    // 4. Server/API revalidation via GET /api/auth/me
    const activeSession = authStorage.getSession();
    if (!activeSession?.token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    const requestToken = activeSession.token;

    try {
      const response = await authApi.getCurrentUser();

      // Race condition protection: ensure stored token has not changed
      const currentSession = authStorage.getSession();
      if (currentSession && currentSession.token === requestToken) {
        setUser(response.user);
        authStorage.setSession({
          ...currentSession,
          user: response.user,
        });
        setError(null);
      }
    } catch (err: unknown) {
      const currentSession = authStorage.getSession();
      if (currentSession && currentSession.token === requestToken) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 404)) {
          // Authoritative session invalidation (401, 403, 404)
          authStorage.clearSession();
          setUser(null);
          setIsIsolatedSession(false);
          setIsolatedPersona(null);
          setEmergencyProof(null);
          setError(err.message || 'انتهت صلاحية الجلسة أو تم تعليق الحساب.');
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
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.login(credentials);
      const session = {
        user: response.user,
        token: response.token,
        expiresAt: response.expiresAt,
      };

      authStorage.setSession(session);
      setUser(response.user);
    } catch (err: unknown) {
      const fallbackMsg = 'فشل تسجيل الدخول. يرجى المحاولة مرة أخرى.';
      const rawMsg = err instanceof Error ? err.message : fallbackMsg;
      setError(sanitizeErrorMessage(rawMsg, fallbackMsg));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authApi.logout().catch(() => {});
    } finally {
      // Invariant INV-P5-7: Explicit logout must purge BOTH active test session
      // and saved Developer origin session, preventing orphaned Developer credentials.
      authStorage.clearSession();
      authStorage.clearDeveloperOriginSession();
      setUser(null);
      setIsIsolatedSession(false);
      setIsolatedPersona(null);
      setEmergencyProof(null);
      setError(null);
      setIsLoading(false);
    }
  }, []);

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
      const originSnapshot: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: user,
        developerToken: currentSession.token,
        developerExpiresAt: currentSession.expiresAt,
        personaId: persona.id,
      };

      const saved = authStorage.saveDeveloperOriginSession(originSnapshot);
      if (!saved) {
        throw new Error('فشل تأمين وحفظ لقطة جلسة المطور الأصلية في التخزين المعزول.');
      }

      // Explicit verification: read-back snapshot must represent the same canonical Developer, token, expiresAt, and personaId
      const verifiedSnapshot = authStorage.getDeveloperOriginSession();
      if (
        !verifiedSnapshot ||
        verifiedSnapshot.developerUser.id !== CANONICAL_DEVELOPER_ID ||
        verifiedSnapshot.developerUser.role !== 'developer' ||
        verifiedSnapshot.developerToken !== currentSession.token ||
        verifiedSnapshot.developerExpiresAt !== currentSession.expiresAt ||
        verifiedSnapshot.personaId !== persona.id
      ) {
        authStorage.clearDeveloperOriginSession();
        throw new Error('فشل التحقق من مطابقة لقطة جلسة المطور المحفوظة قبل تفعيل الشخصية الاختبارية.');
      }

      // Step 5: Activate the Synthetic Persona
      setIsLoading(true);
      setError(null);

      try {
        const response = await authApi.login(persona.credentials);
        const newSession: AuthSession = {
          user: response.user,
          token: response.token,
          expiresAt: response.expiresAt,
        };

        authStorage.setSession(newSession);
        setUser(response.user);
        setIsIsolatedSession(true);
        setIsolatedPersona(persona);
        return true;
      } catch (loginErr: unknown) {
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
            // 3. Verify all consistency requirements
            storageRestorationSucceeded = Boolean(
              restoredSession &&
              restoredSession.user &&
              restoredSession.user.id === CANONICAL_DEVELOPER_ID &&
              restoredSession.user.role === 'developer' &&
              restoredSession.token === originSnapshot.developerToken &&
              restoredSession.expiresAt === originSnapshot.developerExpiresAt
            );
          }
        } catch (storageErr) {
          console.error('Failed writing restored session to storage:', storageErr);
          storageRestorationSucceeded = false;
        }

        if (storageRestorationSucceeded) {
          // 4. Only after all checks succeed:
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
    // 1. Confirm that an isolated session is active
    const origin = authStorage.getDeveloperOriginSession();
    if (!origin) {
      throw new Error('لم يتم العثور على لقطة جلسة المطور الأصلية للرجوع إليها.');
    }

    // 2. Validate snapshot structure, version, canonical Developer identity, and finite positive expiration
    if (
      origin.schemaVersion !== 1 ||
      !origin.developerUser ||
      origin.developerUser.id !== CANONICAL_DEVELOPER_ID ||
      origin.developerUser.role !== 'developer' ||
      !origin.developerToken ||
      typeof origin.developerToken !== 'string' ||
      origin.developerToken.trim() === '' ||
      typeof origin.developerExpiresAt !== 'number' ||
      !Number.isFinite(origin.developerExpiresAt) ||
      origin.developerExpiresAt <= 0
    ) {
      // Do NOT destroy origin on corrupted snapshot, preserve for recovery
      throw new Error('بيانات جلسة المطور الأصلية المحفوظة غير صالحة أو تالفة.');
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
      currentSession.token === origin.developerToken
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
      // 7. Restore exact Developer user, token, and original expiration in storage first
      const developerSession: AuthSession = {
        user: origin.developerUser,
        token: origin.developerToken,
        expiresAt: origin.developerExpiresAt,
      };

      authStorage.setSession(developerSession);

      // 8. Confirm the active storage session matches restored Developer identity, token, and expiration
      const verifiedSession = authStorage.getSession();
      if (
        !verifiedSession ||
        verifiedSession.user.id !== CANONICAL_DEVELOPER_ID ||
        verifiedSession.user.role !== 'developer' ||
        verifiedSession.token !== origin.developerToken ||
        verifiedSession.expiresAt !== origin.developerExpiresAt
      ) {
        throw new Error('فشل التحقق من مطابقة الجلسة المستعادة في التخزين مع بيانات المطور الأصلية.');
      }

      // 9. Update React identity only after storage confirmation
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

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const currentOriginForProof = authStorage.getDeveloperOriginSession();

  // Synchronous structural and unexpired eligibility check
  const isSynchronouslyValid = Boolean(
    user === null &&
    emergencyProof !== null &&
    currentOriginForProof !== null &&
    isValidDeveloperOriginSession(currentOriginForProof) &&
    Date.now() < currentOriginForProof.developerExpiresAt &&
    emergencyProof.personaId === currentOriginForProof.personaId
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
    if (
      !currentOrigin ||
      !isValidDeveloperOriginSession(currentOrigin) ||
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
        // 1. Effect has not been cancelled & AuthProvider is still mounted for this effect lifecycle
        if (isCancelled) return;

        // 2. AuthStorage revision check: captured revision must still equal current authStorage version
        //    If snapshot B was written before cleanup ran, getDeveloperOriginSnapshotVersion() has already
        //    incremented synchronously, so digest A is rejected and discarded!
        const latestStorageVersion = getDeveloperOriginSnapshotVersion();
        if (latestStorageVersion !== currentRevision) {
          return;
        }

        // 3. Captured revision still corresponds to the revision currently being validated
        if (currentRevision !== snapshotRevision) {
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
        if (isCancelled) return;
        const latestStorageVersion = getDeveloperOriginSnapshotVersion();
        if (latestStorageVersion !== currentRevision || currentRevision !== snapshotRevision) {
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
    switchDemoUser,
    clearError,
    isIsolatedSession,
    isolatedPersona,
    launchIsolatedTestSession,
    returnToDeveloperSession,
    retryRevalidation,
    isEmergencyState,
    emergencyProof: activeEmergencyProof,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
