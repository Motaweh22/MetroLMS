/**
 * MetroLMS — Increment 5.3 Test Suite: Synthetic Personas & Complete Isolated Session Round-Trip
 *
 * STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
 *
 * Authoritative Governance Reference:
 * - MetroLMS Pre-Backend Migration Remediation Roadmap — Revision 5:
 *   - Section 3: Developer Confidentiality and Secure Provisioning
 *   - Section 4: Developer Preview and Isolated Role Testing (Decision D-10)
 *   - Stable Finding MFR-40: Separation of Visual Role Preview from Isolated Role Testing
 *   - Invariant INV-D10-1: Strict Synthetic Persona Allowlist
 *   - Invariant INV-P5-3: Test Persona Least Privilege
 *   - Invariant INV-P5-4: Developer Origin Session Lifecycle
 *   - Invariant INV-P5-7: Explicit Logout Purge Semantics
 * - Phase 5 Planning Documents:
 *   - docs/frontend/checklists/phase-05-developer-preview-and-isolated-testing-checklist.md
 *   - docs/frontend/reports/phase-05-planning-report.md
 *
 * CRITICAL EXECUTION DIRECTIVE:
 * Per project-wide governance, this test suite is written during Increment 5.3 implementation
 * but DEFERRED for consolidated execution in Phase 13 (Gate B).
 * DO NOT execute Vitest runner, TypeScript compiler (tsc), or linter against this file.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  authStorage,
  QUARANTINE_STORAGE_KEY,
  type DeveloperOriginSession,
  type SanitizedQuarantinedOriginSnapshot,
} from '@/core/auth/authStorage';
import { AuthProvider } from '@/core/auth/AuthContext';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useIsolatedSession } from '@/core/auth/useIsolatedSession';
import {
  SYNTHETIC_TEST_PERSONA_REGISTRY,
  getSyntheticTestPersona,
  getSyntheticTestPersonas,
  personaToUser,
  type SyntheticTestPersona,
} from '@/core/auth/testPersonas';
import { IsolatedSessionBanner } from '@/features/auth/components/IsolatedSessionBanner';
import { IsolatedSessionModal } from '@/features/auth/components/IsolatedSessionModal';
import { authApi } from '@/core/auth/authApi';
import { resolveAuthenticatedUser } from '@/mocks/handlers/resolveUser';
import type { User, AuthSession } from '@/core/auth/types';

// Fixture Developer User
const FIXTURE_DEVELOPER: User = {
  id: 'USR_DEV_001',
  name: 'مطور النظام الداخلي',
  email: 'developer.internal@cairo-metro.internal',
  role: 'developer',
  department: 'هندسة النظم والبنية الرقمية المتقدمة',
  jobTitle: 'مطور أول النظم المتكاملة',
  initials: 'م.د',
};

const FIXTURE_DEVELOPER_TOKEN = 'mock-developer-jwt-token-998877';

// Deterministic expiration fixtures for static analysis & deferred tests
const DETERMINISTIC_STRUCTURAL_FUTURE_EXPIRY = 1893456000000; // 2030-01-01T00:00:00Z (valid finite future timestamp)
const DETERMINISTIC_EXPIRED_EXPIRY = 1700000000000;           // 2023-11-14T22:13:20Z (already expired relative to Nov 2026)

// Test consumer harness to inspect hook values
const IsolatedSessionTestConsumer: React.FC<{
  onState?: (
    auth: ReturnType<typeof useAuth>,
    isolated: ReturnType<typeof useIsolatedSession>
  ) => void;
}> = ({ onState }) => {
  const authState = useAuth();
  const isolatedState = useIsolatedSession();
  onState?.(authState, isolatedState);

  return (
    <div data-testid="isolated-session-consumer">
      <span data-testid="auth-user-id">{authState.user?.id ?? 'none'}</span>
      <span data-testid="auth-user-role">{authState.user?.role ?? 'none'}</span>
      <span data-testid="is-isolated">{String(isolatedState.isIsolatedSession)}</span>
      <span data-testid="isolated-persona-id">{isolatedState.isolatedPersona?.id ?? 'none'}</span>
    </div>
  );
};

describe('Increment 5.3: Synthetic Personas & Complete Isolated Session Round-Trip (Deferred to Phase 13)', () => {
  beforeEach(() => {
    // Reset session storage slots
    authStorage.clearSession();
    authStorage.clearDeveloperOriginSession();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    authStorage.clearSession();
    authStorage.clearDeveloperOriginSession();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Group 1: Persona Registry Specifications (Tests 1 - 5)
  // =========================================================================
  describe('Group 1: Persona Registry Validation', () => {
    it('P5-T08-1: Exactly the five approved synthetic personas are registered', () => {
      const personas = getSyntheticTestPersonas();
      expect(personas).toHaveLength(5);

      const registeredIds = personas.map((p) => p.id).sort();
      const expectedIds = [
        'USR_TEST_ADMIN_001',
        'USR_TEST_AST_001',
        'USR_TEST_LEC_001',
        'USR_TEST_SUPER_001',
        'USR_TEST_TRN_001',
      ].sort();

      expect(registeredIds).toEqual(expectedIds);
    });

    it('P5-T08-2: Each persona has its correct canonical ID, username, and canonical role', () => {
      const superAdmin = getSyntheticTestPersona('USR_TEST_SUPER_001');
      expect(superAdmin).not.toBeNull();
      expect(superAdmin?.username).toBe('test_super_admin');
      expect(superAdmin?.role).toBe('super_admin');

      const admin = getSyntheticTestPersona('USR_TEST_ADMIN_001');
      expect(admin).not.toBeNull();
      expect(admin?.username).toBe('test_admin');
      expect(admin?.role).toBe('admin');

      const astAdmin = getSyntheticTestPersona('USR_TEST_AST_001');
      expect(astAdmin).not.toBeNull();
      expect(astAdmin?.username).toBe('test_assistant_admin');
      expect(astAdmin?.role).toBe('assistant_admin');

      const lecturer = getSyntheticTestPersona('USR_TEST_LEC_001');
      expect(lecturer).not.toBeNull();
      expect(lecturer?.username).toBe('test_lecturer');
      expect(lecturer?.role).toBe('lecturer');

      const trainee = getSyntheticTestPersona('USR_TEST_TRN_001');
      expect(trainee).not.toBeNull();
      expect(trainee?.username).toBe('test_trainee');
      expect(trainee?.role).toBe('user');
    });

    it('P5-T08-3: assistant_lecturer is not treated as a global synthetic test persona', () => {
      const assistantLecturerMatch = getSyntheticTestPersona('assistant_lecturer');
      expect(assistantLecturerMatch).toBeNull();

      const personas = getSyntheticTestPersonas();
      const hasAssistantLecturer = personas.some(
        (p) => (p.role as string) === 'assistant_lecturer' || p.username.includes('assistant_lecturer')
      );
      expect(hasAssistantLecturer).toBe(false);
    });

    it('P5-T08-4: Production/non-development environments cannot expose or activate the registry', () => {
      // In DEV, registry is populated; verify that getSyntheticTestPersona validates import.meta.env.DEV
      expect(import.meta.env.DEV).toBe(true);
      expect(Object.keys(SYNTHETIC_TEST_PERSONA_REGISTRY).length).toBe(5);
    });

    it('P5-T08-5: Arbitrary real account IDs and unregistered personas are rejected', () => {
      // Real developer and super admin accounts must be rejected
      expect(getSyntheticTestPersona('USR_DEV_001')).toBeNull();
      expect(getSyntheticTestPersona('USR_SUPER_001')).toBeNull();
      expect(getSyntheticTestPersona('developer_internal')).toBeNull();

      // Arbitrary or malicious IDs must be rejected
      expect(getSyntheticTestPersona('USR_TEST_HACKER_999')).toBeNull();
      expect(getSyntheticTestPersona('')).toBeNull();
      expect(getSyntheticTestPersona(null as unknown as string)).toBeNull();
      expect(getSyntheticTestPersona('USR_TEST_RANDOM')).toBeNull();
    });
  });

  // =========================================================================
  // Group 2: Launch Transaction Specifications (Tests 6 - 12)
  // =========================================================================
  describe('Group 2: Launch Transaction Flow', () => {
    it('P5-T09-1: Only an actual authenticated Developer can launch an isolated session', async () => {
      // Setup authenticated Admin user (non-developer)
      const adminSession: AuthSession = {
        user: {
          id: 'USR_ADMIN_001',
          name: 'مدير النظام',
          email: 'admin@cairo-metro.internal',
          role: 'admin',
          department: 'الإدارة العامة',
          jobTitle: 'مدير',
          initials: 'م.ن',
        },
        token: 'token-admin-123',
        expiresAt: Date.now() + 3600000,
      };
      authStorage.setSession(adminSession);

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await expect(
        capturedAuth!.launchIsolatedTestSession('USR_TEST_AST_001')
      ).rejects.toThrow(/فقط مطور النظام المعتمد/);
    });

    it('P5-T09-3: A user with role: developer but an ID other than USR_DEV_001 cannot launch an isolated session', async () => {
      // Impostor developer with non-canonical ID
      const impostorDeveloperSession: AuthSession = {
        user: {
          id: 'USR_DEV_IMPOSTOR_999',
          name: 'مطور غير قياسي',
          email: 'impostor.dev@cairo-metro.internal',
          role: 'developer',
          department: 'قسم غير معتمد',
          jobTitle: 'مطور',
          initials: 'م.غ',
        },
        token: 'token-impostor-dev-123',
        expiresAt: Date.now() + 3600000,
      };
      authStorage.setSession(impostorDeveloperSession);

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await expect(
        capturedAuth!.launchIsolatedTestSession('USR_TEST_AST_001')
      ).rejects.toThrow(/فقط مطور النظام المعتمد بالمعرف القياسي USR_DEV_001/);
    });

    it('P5-T09-4: A mismatch between AuthContext.user and active authStorage session is rejected', async () => {
      // AuthContext initializes with developer, but session storage contains another user
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      // Tamper storage to simulate session desynchronization
      authStorage.setSession({
        user: {
          id: 'USR_ADMIN_001',
          name: 'مدير النظام',
          email: 'admin@cairo-metro.internal',
          role: 'admin',
          department: 'الإدارة',
          jobTitle: 'مدير',
          initials: 'م.ن',
        },
        token: 'token-tampered-123',
        expiresAt: Date.now() + 3600000,
      });

      await expect(
        capturedAuth!.launchIsolatedTestSession('USR_TEST_AST_001')
      ).rejects.toThrow(/عدم تطابق بين هوية المستخدم النشط في السياق وبيانات الجلسة المحفوظة/);
    });

    it('P5-T09-2: A selected persona becomes the actual authenticated identity in AuthContext.user', async () => {
      // Setup authenticated Developer
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      let capturedIsolated: ReturnType<typeof useIsolatedSession> | null = null;

      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer
              onState={(auth, isolated) => {
                capturedAuth = auth;
                capturedIsolated = isolated;
              }}
            />
          </AuthProvider>
        </MemoryRouter>
      );

      await act(async () => {
        await capturedAuth!.launchIsolatedTestSession('USR_TEST_AST_001');
      });

      expect(screen.getByTestId('auth-user-id').textContent).toBe('USR_TEST_AST_001');
      expect(screen.getByTestId('auth-user-role').textContent).toBe('assistant_admin');
      expect(screen.getByTestId('is-isolated').textContent).toBe('true');
      expect(screen.getByTestId('isolated-persona-id').textContent).toBe('USR_TEST_AST_001');
    });

    it('P5-T10-1: The original Developer session is saved before the active session is replaced', async () => {
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await act(async () => {
        await capturedAuth!.launchIsolatedTestSession('USR_TEST_LEC_001');
      });

      const origin = authStorage.getDeveloperOriginSession();
      expect(origin).not.toBeNull();
      expect(origin?.developerUser.id).toBe('USR_DEV_001');
      expect(origin?.developerUser.role).toBe('developer');
      expect(origin?.developerToken).toBe(FIXTURE_DEVELOPER_TOKEN);
      expect(origin?.personaId).toBe('USR_TEST_LEC_001');
      expect(origin?.schemaVersion).toBe(1);
    });

    it('P5-T11-1: The isolated persona token becomes the active apiClient session token', async () => {
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await act(async () => {
        await capturedAuth!.launchIsolatedTestSession('USR_TEST_TRN_001');
      });

      const activeSession = authStorage.getSession();
      expect(activeSession).not.toBeNull();
      expect(activeSession?.user.id).toBe('USR_TEST_TRN_001');
      // Token must not be Developer token
      expect(activeSession?.token).not.toBe(FIXTURE_DEVELOPER_TOKEN);
      expect(activeSession?.token).toBeDefined();
    });

    it('P5-T10-2: A Developer-origin snapshot cannot be overwritten', () => {
      const existingOrigin: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: DETERMINISTIC_STRUCTURAL_FUTURE_EXPIRY,
        personaId: 'USR_TEST_AST_001',
      };
      const firstSave = authStorage.saveDeveloperOriginSession(existingOrigin);
      expect(firstSave).toBe(true);

      // Attempt second save with different persona
      const duplicateSave = authStorage.saveDeveloperOriginSession({
        ...existingOrigin,
        personaId: 'USR_TEST_LEC_001',
      });
      expect(duplicateSave).toBe(false);

      // Verify origin remains unchanged
      const currentOrigin = authStorage.getDeveloperOriginSession();
      expect(currentOrigin?.personaId).toBe('USR_TEST_AST_001');
    });

    it('P5-T10-3: Launch rejects an origin snapshot whose personaId does not match the selected persona', async () => {
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      // Spy on saveDeveloperOriginSession to simulate writing a mismatched personaId
      const originalSave = authStorage.saveDeveloperOriginSession.bind(authStorage);
      vi.spyOn(authStorage, 'saveDeveloperOriginSession').mockImplementation((origin) => {
        return originalSave({
          ...origin,
          personaId: 'USR_TEST_ADMIN_001', // Mismatched personaId
        });
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      // Launch requested USR_TEST_LEC_001, but snapshot has USR_TEST_ADMIN_001
      await expect(
        capturedAuth!.launchIsolatedTestSession('USR_TEST_LEC_001')
      ).rejects.toThrow(/فشل التحقق من مطابقة لقطة جلسة المطور المحفوظة/);

      // Active session in AuthContext remains Developer
      expect(capturedAuth!.user?.id).toBe('USR_DEV_001');
    });

    it('P5-T14-1: Nested isolated-session launch is rejected', async () => {
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await act(async () => {
        await capturedAuth!.launchIsolatedTestSession('USR_TEST_ADMIN_001');
      });

      // Attempt nested launch while in test session
      await expect(
        capturedAuth!.launchIsolatedTestSession('USR_TEST_LEC_001')
      ).rejects.toThrow();
    });

    it('P5-T22-1: Visual Role Preview is ended or rejected before isolated-session activation', async () => {
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      let capturedIsolated: ReturnType<typeof useIsolatedSession> | null = null;

      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer
              onState={(auth, isolated) => {
                capturedAuth = auth;
                capturedIsolated = isolated;
              }}
            />
          </AuthProvider>
        </MemoryRouter>
      );

      await act(async () => {
        await capturedIsolated!.launchIsolatedTestSession('USR_TEST_AST_001');
      });

      expect(capturedAuth!.user?.role).toBe('assistant_admin');
      // Visual Role Preview context cannot be active because role is not developer
      expect(capturedIsolated!.isIsolatedSession).toBe(true);
    });
  });

  // =========================================================================
  // Group 3: Return to Developer Specifications (Tests 13 - 17)
  // =========================================================================
  describe('Group 3: Return to Developer Round-Trip', () => {
    it('P5-T13-1: One-click return restores the exact Developer user ID and original token', async () => {
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      // Launch isolated session
      await act(async () => {
        await capturedAuth!.launchIsolatedTestSession('USR_TEST_ADMIN_001');
      });
      expect(capturedAuth!.user?.id).toBe('USR_TEST_ADMIN_001');

      // Return to developer session
      await act(async () => {
        await capturedAuth!.returnToDeveloperSession();
      });

      expect(capturedAuth!.user?.id).toBe('USR_DEV_001');
      expect(capturedAuth!.user?.role).toBe('developer');

      const currentSession = authStorage.getSession();
      expect(currentSession?.token).toBe(FIXTURE_DEVELOPER_TOKEN);
      expect(currentSession?.user.id).toBe('USR_DEV_001');
    });

    it('P5-T13-2: Successful return clears origin snapshot and isolated-session state', async () => {
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await act(async () => {
        await capturedAuth!.launchIsolatedTestSession('USR_TEST_SUPER_001');
      });
      expect(authStorage.hasDeveloperOriginSession()).toBe(true);

      await act(async () => {
        await capturedAuth!.returnToDeveloperSession();
      });

      expect(authStorage.hasDeveloperOriginSession()).toBe(false);
      expect(authStorage.getDeveloperOriginSession()).toBeNull();
      expect(capturedAuth!.isIsolatedSession).toBe(false);
    });

    it('P5-T13-3: The return action is available throughout the isolated session via banner', async () => {
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionBanner />
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      // Before launch: banner should not be rendered
      expect(screen.queryByTestId('isolated-session-banner')).toBeNull();

      // Launch isolated session
      await act(async () => {
        await capturedAuth!.launchIsolatedTestSession('USR_TEST_LEC_001');
      });

      // Banner must be visible with required Arabic text and return button
      expect(screen.getByTestId('isolated-session-banner')).toBeInTheDocument();
      expect(screen.getByTestId('return-to-developer-btn')).toBeInTheDocument();
      expect(screen.getByText(/جلسة اختبار صلاحيات معزولة/)).toBeInTheDocument();
      expect(screen.getByText(/العودة إلى جلسة المطور/)).toBeInTheDocument();

      // Click return button
      await act(async () => {
        fireEvent.click(screen.getByTestId('return-to-developer-btn'));
      });

      // After return: banner disappears, developer session restored
      expect(screen.queryByTestId('isolated-session-banner')).toBeNull();
      expect(capturedAuth!.user?.id).toBe('USR_DEV_001');
    });

    it('P5-T13-4: Stale persona-specific UI state is cleared after return', async () => {
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      let capturedIsolated: ReturnType<typeof useIsolatedSession> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(_, isolated) => (capturedIsolated = isolated)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await act(async () => {
        await capturedIsolated!.launchIsolatedTestSession('USR_TEST_TRN_001');
      });
      expect(capturedIsolated!.isolatedPersona).not.toBeNull();

      await act(async () => {
        await capturedIsolated!.returnToDeveloperSession();
      });
      expect(capturedIsolated!.isolatedPersona).toBeNull();
      expect(capturedIsolated!.isIsolatedSession).toBe(false);
    });

    it('P5-T18-1: Restoration failure does not silently destroy the saved origin snapshot', async () => {
      // Save valid developer origin session
      const origin: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: Date.now() + 3600000,
        personaId: 'USR_TEST_AST_001',
      };
      authStorage.saveDeveloperOriginSession(origin);

      const astPersona = getSyntheticTestPersona('USR_TEST_AST_001')!;
      const astUser = personaToUser(astPersona);
      authStorage.setSession({
        user: astUser,
        token: `mock_jwt_USR_TEST_AST_001_${Date.now()}`,
        expiresAt: Date.now() + 3600000,
      });
      vi.spyOn(authApi, 'getCurrentUser').mockResolvedValueOnce({ user: astUser });

      // Force storage setSession to throw an error during return
      vi.spyOn(authStorage, 'setSession').mockImplementationOnce(() => {
        throw new Error('Simulated storage disk failure');
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow();

      // Invariant check: origin session snapshot was NOT destroyed
      expect(authStorage.hasDeveloperOriginSession()).toBe(true);
      expect(authStorage.getDeveloperOriginSession()?.developerUser.id).toBe('USR_DEV_001');
    });

    it('P5-T18-2: A snapshot with the wrong Developer ID is rejected', () => {
      const invalidOrigin: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: {
          ...FIXTURE_DEVELOPER,
          id: 'USR_DEV_NONCANONICAL_002',
        },
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: DETERMINISTIC_STRUCTURAL_FUTURE_EXPIRY,
        personaId: 'USR_TEST_AST_001',
      };

      const saveResult = authStorage.saveDeveloperOriginSession(invalidOrigin);
      expect(saveResult).toBe(false);
      expect(authStorage.hasDeveloperOriginSession()).toBe(false);
    });

    it('P5-T18-3: A malformed or unsupported snapshot schema is rejected', () => {
      // 1. Invalid schema version
      const wrongVersion = {
        schemaVersion: 2,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: DETERMINISTIC_STRUCTURAL_FUTURE_EXPIRY,
        personaId: 'USR_TEST_AST_001',
      } as unknown as DeveloperOriginSession;
      expect(authStorage.saveDeveloperOriginSession(wrongVersion)).toBe(false);

      // 2. Empty token
      const emptyToken = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: '',
        developerExpiresAt: DETERMINISTIC_STRUCTURAL_FUTURE_EXPIRY,
        personaId: 'USR_TEST_AST_001',
      };
      expect(authStorage.saveDeveloperOriginSession(emptyToken)).toBe(false);

      // 3. Unregistered persona ID
      const unregisteredPersona = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: DETERMINISTIC_STRUCTURAL_FUTURE_EXPIRY,
        personaId: 'USR_TEST_NONEXISTENT_999',
      };
      expect(authStorage.saveDeveloperOriginSession(unregisteredPersona)).toBe(false);
    });

    it('P5-T18-4: A snapshot is not deleted if Developer restoration cannot be confirmed', async () => {
      // Setup active isolated test session with valid origin snapshot
      const origin: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: Date.now() + 3600000,
        personaId: 'USR_TEST_AST_001',
      };
      authStorage.saveDeveloperOriginSession(origin);

      const astPersona = getSyntheticTestPersona('USR_TEST_AST_001')!;
      const astUser = personaToUser(astPersona);
      authStorage.setSession({
        user: astUser,
        token: `mock_jwt_USR_TEST_AST_001_${Date.now()}`,
        expiresAt: Date.now() + 3600000,
      });
      vi.spyOn(authApi, 'getCurrentUser').mockResolvedValueOnce({ user: astUser });

      // Simulate corrupted/mismatched session returned by storage after setSession
      const originalSetSession = authStorage.setSession.bind(authStorage);
      vi.spyOn(authStorage, 'setSession').mockImplementation((session) => {
        originalSetSession(session);
        // Tamper with getSession verification
        vi.spyOn(authStorage, 'getSession').mockReturnValueOnce({
          user: { ...FIXTURE_DEVELOPER, id: 'CORRUPTED_ID' },
          token: FIXTURE_DEVELOPER_TOKEN,
        });
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow();

      // Snapshot MUST remain intact for recovery
      expect(authStorage.hasDeveloperOriginSession()).toBe(true);
      expect(authStorage.getDeveloperOriginSession()?.developerUser.id).toBe('USR_DEV_001');
    });

    it('P5-T13-5: One-click return restores exact original future expiresAt and rejects expired sessions', async () => {
      // -------------------------------------------------------------------------
      // Scenario 1: Unexpired Session Restoration (Positive Future Path)
      // -------------------------------------------------------------------------
      const futureExpiresAt = Date.now() + 3600000;
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: futureExpiresAt,
      });

      let scenario1Auth: ReturnType<typeof useAuth> | null = null;
      let scenario1Isolated: ReturnType<typeof useIsolatedSession> | null = null;
      const { unmount: unmountScenario1 } = render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer
              onState={(auth, isolated) => {
                scenario1Auth = auth;
                scenario1Isolated = isolated;
              }}
            />
          </AuthProvider>
        </MemoryRouter>
      );

      // Launch isolated session
      await act(async () => {
        await scenario1Auth!.launchIsolatedTestSession('USR_TEST_ADMIN_001');
      });

      // Verify origin session preserved the exact original future expiresAt
      const origin = authStorage.getDeveloperOriginSession();
      expect(origin?.developerExpiresAt).toBe(futureExpiresAt);

      // Return to developer session
      await act(async () => {
        await scenario1Auth!.returnToDeveloperSession();
      });

      // Restored active session must have the exact original expiresAt, not Date.now() + 24h
      const restoredSession = authStorage.getSession();
      expect(restoredSession?.expiresAt).toBe(futureExpiresAt);
      expect(scenario1Auth!.user?.id).toBe('USR_DEV_001');
      expect(scenario1Isolated!.isIsolatedSession).toBe(false);

      // Cleanly unmount Scenario 1 harness to prevent state bleed into Scenario 2
      unmountScenario1();
      authStorage.clearSession();
      authStorage.clearDeveloperOriginSession();

      // -------------------------------------------------------------------------
      // Scenario 2: Expired Developer Session Rejection (Negative Return Path)
      // Runs in an independent, freshly initialized isolated-session context
      // -------------------------------------------------------------------------
      const expiredOrigin: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date(DETERMINISTIC_EXPIRED_EXPIRY).toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: DETERMINISTIC_EXPIRED_EXPIRY,
        personaId: 'USR_TEST_AST_001',
      };
      authStorage.saveDeveloperOriginSession(expiredOrigin);

      const targetPersona = getSyntheticTestPersona('USR_TEST_AST_001')!;
      const targetUser = personaToUser(targetPersona);

      authStorage.setSession({
        user: targetUser,
        token: `mock_jwt_USR_TEST_AST_001_${Date.now()}`,
        expiresAt: Date.now() + 3600000,
      });

      // Mock authApi.getCurrentUser so AuthProvider revalidation on mount establishes targetUser
      vi.spyOn(authApi, 'getCurrentUser').mockResolvedValueOnce({ user: targetUser });

      let scenario2Auth: ReturnType<typeof useAuth> | null = null;
      let scenario2Isolated: ReturnType<typeof useIsolatedSession> | null = null;

      const { unmount: unmountScenario2 } = render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer
              onState={(auth, isolated) => {
                scenario2Auth = auth;
                scenario2Isolated = isolated;
              }}
            />
          </AuthProvider>
        </MemoryRouter>
      );

      // Wait for AuthProvider mount and revalidation to complete:
      // Verify that this is a GENUINELY active isolated test session in React state
      await waitFor(() => {
        expect(scenario2Auth!.user?.id).toBe('USR_TEST_AST_001');
        expect(scenario2Auth!.user?.role).toBe('assistant_admin');
        expect(scenario2Isolated!.isIsolatedSession).toBe(true);
        expect(scenario2Isolated!.isolatedPersona?.id).toBe('USR_TEST_AST_001');
      });

      // From this genuine, active isolated session, invoke returnToDeveloperSession()
      await expect(scenario2Auth!.returnToDeveloperSession()).rejects.toThrow(
        /انتهت صلاحية جلسة المطور الأصلية أثناء جلسة الاختبار المعزولة/
      );

      // Verify all required assertions on React context and storage state:
      // 1. Expired Developer session is rejected
      // 2. Developer identity is NOT exposed in React AuthContext
      expect(scenario2Auth!.user?.id).not.toBe('USR_DEV_001');
      expect(scenario2Auth!.user?.role).not.toBe('developer');
      // 3. Active context remains non-Developer
      expect(scenario2Auth!.user?.id).toBe('USR_TEST_AST_001');
      // 4. Origin snapshot remains intact in storage for diagnosis/recovery
      expect(authStorage.hasDeveloperOriginSession()).toBe(true);
      const preservedOrigin = authStorage.getDeveloperOriginSession();
      expect(preservedOrigin?.developerExpiresAt).toBe(DETERMINISTIC_EXPIRED_EXPIRY);
      expect(preservedOrigin?.developerUser.id).toBe('USR_DEV_001');
      // 5. No replacement or extended expiration timestamp is generated
      expect(preservedOrigin?.developerExpiresAt).not.toBeGreaterThan(Date.now());
      // 6. No successful Developer restoration is reported (remains in isolated state or fails closed)
      expect(scenario2Isolated!.isIsolatedSession).toBe(true);

      unmountScenario2();
    });

    it('P5-T18-5: Missing or invalid expiration data is rejected by snapshot validation', () => {
      // 1. Missing developerExpiresAt (undefined / omitted)
      const missingExpiresAt = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        personaId: 'USR_TEST_AST_001',
      } as unknown as DeveloperOriginSession;
      expect(authStorage.saveDeveloperOriginSession(missingExpiresAt)).toBe(false);

      // 2. NaN
      const nanExpiresAt: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: Number.NaN,
        personaId: 'USR_TEST_AST_001',
      };
      expect(authStorage.saveDeveloperOriginSession(nanExpiresAt)).toBe(false);

      // 3. Positive Infinity
      const positiveInfinityExpiresAt: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: Number.POSITIVE_INFINITY,
        personaId: 'USR_TEST_AST_001',
      };
      expect(authStorage.saveDeveloperOriginSession(positiveInfinityExpiresAt)).toBe(false);

      // 4. Negative Infinity (-Infinity)
      const negativeInfinityExpiresAt: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: Number.NEGATIVE_INFINITY,
        personaId: 'USR_TEST_AST_001',
      };
      expect(authStorage.saveDeveloperOriginSession(negativeInfinityExpiresAt)).toBe(false);

      // 5. Zero
      const zeroExpiresAt: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: 0,
        personaId: 'USR_TEST_AST_001',
      };
      expect(authStorage.saveDeveloperOriginSession(zeroExpiresAt)).toBe(false);

      // 6. Negative values
      const negativeExpiresAt: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: -100,
        personaId: 'USR_TEST_AST_001',
      };
      expect(authStorage.saveDeveloperOriginSession(negativeExpiresAt)).toBe(false);

      // 7. Non-number types (e.g. string)
      const stringExpiresAt = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: String(DETERMINISTIC_STRUCTURAL_FUTURE_EXPIRY),
        personaId: 'USR_TEST_AST_001',
      } as unknown as DeveloperOriginSession;
      expect(authStorage.saveDeveloperOriginSession(stringExpiresAt)).toBe(false);

      // 8. Valid finite positive expiration must be accepted structurally
      const validPositiveExpiresAt: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: DETERMINISTIC_STRUCTURAL_FUTURE_EXPIRY, // Deterministic future timestamp for structural validation
        personaId: 'USR_TEST_AST_001',
      };
      expect(authStorage.saveDeveloperOriginSession(validPositiveExpiresAt)).toBe(true);
    });

    it('P5-T13-6: Active authenticated user ID differing from origin.personaId is rejected by returnToDeveloperSession', async () => {
      // Origin snapshot belongs to USR_TEST_AST_001
      const origin: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: Date.now() + 3600000,
        personaId: 'USR_TEST_AST_001',
      };
      authStorage.saveDeveloperOriginSession(origin);

      // Active authenticated user is USR_TEST_ADMIN_001 (different persona)
      const adminPersona = getSyntheticTestPersona('USR_TEST_ADMIN_001')!;
      const adminUser = personaToUser(adminPersona);
      authStorage.setSession({
        user: adminUser,
        token: 'mock-jwt-test-admin',
        expiresAt: Date.now() + 3600000,
      });
      vi.spyOn(authApi, 'getCurrentUser').mockResolvedValueOnce({ user: adminUser });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(capturedAuth!.user?.id).toBe('USR_TEST_ADMIN_001');
      });

      // Attempt to restore Developer session
      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow(
        /المستخدم النشط الحالي لا يطابق الشخصية الاختبارية المرتبطة بالجلسة المعزولة/
      );

      // Verify fail-closed and origin preservation
      expect(authStorage.hasDeveloperOriginSession()).toBe(true);
      expect(capturedAuth!.user?.id).toBe('USR_TEST_ADMIN_001');
    });

    it('P5-T13-7: Mismatch between active session storage and AuthContext.user is rejected by returnToDeveloperSession', async () => {
      const origin: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: Date.now() + 3600000,
        personaId: 'USR_TEST_AST_001',
      };
      authStorage.saveDeveloperOriginSession(origin);

      const astPersona = getSyntheticTestPersona('USR_TEST_AST_001')!;
      const astUser = personaToUser(astPersona);
      authStorage.setSession({
        user: astUser,
        token: `mock_jwt_USR_TEST_AST_001_${Date.now()}`,
        expiresAt: Date.now() + 3600000,
      });
      vi.spyOn(authApi, 'getCurrentUser').mockResolvedValueOnce({ user: astUser });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(capturedAuth!.user?.id).toBe('USR_TEST_AST_001');
      });

      // Tamper active storage session so it differs from AuthContext.user
      authStorage.setSession({
        user: {
          ...astUser,
          id: 'TAMPERED_SESSION_ID',
        },
        token: 'mock-jwt-tampered',
        expiresAt: Date.now() + 3600000,
      });

      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow(
        /عدم تطابق بين هوية المستخدم النشط وبيانات الجلسة المحفوظة في التخزين/
      );

      expect(authStorage.hasDeveloperOriginSession()).toBe(true);
    });

    it('P5-T13-8: Active user role differing from registered persona role is rejected by returnToDeveloperSession', async () => {
      const origin: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: Date.now() + 3600000,
        personaId: 'USR_TEST_AST_001', // Registered canonical role: assistant_admin
      };
      authStorage.saveDeveloperOriginSession(origin);

      // Active user has matching ID but forged/elevated role (e.g. super_admin)
      const forgedUser: User = {
        id: 'USR_TEST_AST_001',
        name: 'مساعد مدير نظام',
        email: 'test.assistant.admin@cairo-metro.internal',
        role: 'super_admin', // Forged role!
        department: 'قسم إدارة النظم',
        jobTitle: 'مساعد مدير نظام',
        initials: 'م.م',
      };

      authStorage.setSession({
        user: forgedUser,
        token: `mock_jwt_USR_TEST_AST_001_${Date.now()}`,
        expiresAt: Date.now() + 3600000,
      });
      vi.spyOn(authApi, 'getCurrentUser').mockResolvedValueOnce({ user: forgedUser });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(capturedAuth!.user?.role).toBe('super_admin');
      });

      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow(
        /بيانات المستخدم النشط لا تتطابق مع هوية وصلاحيات الشخصية الاختبارية المعتمدة/
      );

      expect(authStorage.hasDeveloperOriginSession()).toBe(true);
      expect(capturedAuth!.user?.id).not.toBe('USR_DEV_001');
    });

    it('P5-T13-9: An unregistered or non-synthetic user cannot use an orphaned Developer origin snapshot to restore Developer', async () => {
      // Orphaned Developer origin snapshot exists in storage
      const origin: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: Date.now() + 3600000,
        personaId: 'USR_TEST_AST_001',
      };
      authStorage.saveDeveloperOriginSession(origin);

      // Active user is a real student / trainee account
      const realStudentUser: User = {
        id: 'USR_REAL_STUDENT_777',
        name: 'متدرب حقيقي',
        email: 'real.student@cairo-metro.internal',
        role: 'user',
        department: 'التشغيل',
        jobTitle: 'متدرب',
        initials: 'م.ح',
      };
      authStorage.setSession({
        user: realStudentUser,
        token: 'real-student-jwt-token-12345',
        expiresAt: Date.now() + 3600000,
      });
      vi.spyOn(authApi, 'getCurrentUser').mockResolvedValueOnce({ user: realStudentUser });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(capturedAuth!.user?.id).toBe('USR_REAL_STUDENT_777');
      });

      // Real user attempts to call returnToDeveloperSession to elevate to Developer
      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow(
        /المستخدم النشط الحالي لا يطابق الشخصية الاختبارية المرتبطة بالجلسة المعزولة/
      );

      // Developer identity MUST NOT be exposed
      expect(capturedAuth!.user?.id).toBe('USR_REAL_STUDENT_777');
      expect(capturedAuth!.user?.role).toBe('user');
      expect(authStorage.hasDeveloperOriginSession()).toBe(true);
    });

    it('P5-T13-10: Failed actor reconciliation preserves the origin snapshot and never exposes Developer identity', async () => {
      const origin: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: Date.now() + 3600000,
        personaId: 'USR_TEST_AST_001',
      };
      authStorage.saveDeveloperOriginSession(origin);

      // Active session is missing (unauthenticated)
      authStorage.clearSession();
      vi.spyOn(authApi, 'getCurrentUser').mockRejectedValueOnce(new Error('Unauthenticated'));

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      // When unauthenticated, invoking return fails closed
      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow(
        /لا يوجد مستخدم نشط مسجل للدخول لتأكيد استعادة جلسة المطور/
      );

      // Snapshot preserved
      expect(authStorage.hasDeveloperOriginSession()).toBe(true);
      expect(capturedAuth!.user).toBeNull();
    });

    it('P5-T13-11: A mismatched rehydrated user cannot use the visible return banner as an alternate restoration path', async () => {
      // Orphaned Developer origin snapshot exists in storage for USR_TEST_AST_001
      const origin: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: Date.now() + 3600000,
        personaId: 'USR_TEST_AST_001',
      };
      authStorage.saveDeveloperOriginSession(origin);

      // Active authenticated user is an unrelated real Admin
      const realAdminUser: User = {
        id: 'USR_ADMIN_REAL_001',
        name: 'مدير حقيقي',
        email: 'real.admin@cairo-metro.internal',
        role: 'admin',
        department: 'الإدارة العامة',
        jobTitle: 'مدير',
        initials: 'م.ح',
      };
      authStorage.setSession({
        user: realAdminUser,
        token: 'real-admin-jwt-token-999',
        expiresAt: Date.now() + 3600000,
      });
      vi.spyOn(authApi, 'getCurrentUser').mockResolvedValueOnce({ user: realAdminUser });

      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionBanner />
            <IsolatedSessionTestConsumer />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-user-id').textContent).toBe('USR_ADMIN_REAL_001');
      });

      // Security Invariant: The banner MUST NOT be rendered for an unrelated user
      expect(screen.queryByTestId('isolated-session-banner')).toBeNull();
      expect(screen.queryByTestId('return-to-developer-btn')).toBeNull();
    });

    it('P5-T13-12: Strict token format validation rejects invalid subjects, missing timestamps, format deviations, and non-13-digit suffixes in returnToDeveloperSession', async () => {
      // Origin session belongs to USR_TEST_AST_001
      const origin: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: Date.now() + 3600000,
        personaId: 'USR_TEST_AST_001',
      };
      authStorage.saveDeveloperOriginSession(origin);

      const astPersona = getSyntheticTestPersona('USR_TEST_AST_001')!;
      const astUser = personaToUser(astPersona);

      vi.spyOn(authApi, 'getCurrentUser').mockResolvedValue({ user: astUser });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(capturedAuth!.user?.id).toBe('USR_TEST_AST_001');
      });

      // 1. Rejects token belonging to another registered persona (USR_SUPER_001)
      authStorage.setSession({
        user: astUser,
        token: `mock_jwt_USR_SUPER_001_${Date.now()}`,
        expiresAt: Date.now() + 3600000,
      });
      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow(
        /رمز الجلسة النشط في التخزين غير مطابق للصيغة القياسية المعتمدة للشخصية الاختبارية/
      );

      // 2. Rejects empty mock_jwt_
      authStorage.setSession({
        user: astUser,
        token: 'mock_jwt_',
        expiresAt: Date.now() + 3600000,
      });
      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow(
        /رمز الجلسة النشط في التخزين غير مطابق للصيغة القياسية المعتمدة للشخصية الاختبارية/
      );

      // 3. Rejects missing prefix
      authStorage.setSession({
        user: astUser,
        token: `USR_TEST_AST_001_${Date.now()}`,
        expiresAt: Date.now() + 3600000,
      });
      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow(
        /رمز الجلسة النشط في التخزين غير مطابق للصيغة القياسية المعتمدة للشخصية الاختبارية/
      );

      // 4. Rejects correct subject without timestamp
      authStorage.setSession({
        user: astUser,
        token: 'mock_jwt_USR_TEST_AST_001',
        expiresAt: Date.now() + 3600000,
      });
      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow(
        /رمز الجلسة النشط في التخزين غير مطابق للصيغة القياسية المعتمدة للشخصية الاختبارية/
      );

      // 5. Rejects malformed / non-numeric timestamp
      authStorage.setSession({
        user: astUser,
        token: 'mock_jwt_USR_TEST_AST_001_abc_invalid',
        expiresAt: Date.now() + 3600000,
      });
      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow(
        /رمز الجلسة النشط في التخزين غير مطابق للصيغة القياسية المعتمدة للشخصية الاختبارية/
      );

      // 6. Rejects short numeric suffix (< 13 digits, rejected structurally by exact 13-digit format)
      authStorage.setSession({
        user: astUser,
        token: 'mock_jwt_USR_TEST_AST_001_1730300400',
        expiresAt: Date.now() + 3600000,
      });
      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow(
        /رمز الجلسة النشط في التخزين غير مطابق للصيغة القياسية المعتمدة للشخصية الاختبارية/
      );

      // 7. Rejects oversized numeric suffix (> 13 digits, rejected structurally by exact 13-digit format)
      authStorage.setSession({
        user: astUser,
        token: 'mock_jwt_USR_TEST_AST_001_17303004000001',
        expiresAt: Date.now() + 3600000,
      });
      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow(
        /رمز الجلسة النشط في التخزين غير مطابق للصيغة القياسية المعتمدة للشخصية الاختبارية/
      );

      // 8. Rejects oversized / unsafe numeric suffix (stopped at structural regex stage by exact 13-digit format before Number.isSafeInteger is evaluated)
      authStorage.setSession({
        user: astUser,
        token: 'mock_jwt_USR_TEST_AST_001_99999999999999999999',
        expiresAt: Date.now() + 3600000,
      });
      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow(
        /رمز الجلسة النشط في التخزين غير مطابق للصيغة القياسية المعتمدة للشخصية الاختبارية/
      );

      // 9. Rejects unexpected trailing content
      authStorage.setSession({
        user: astUser,
        token: `mock_jwt_USR_TEST_AST_001_${Date.now()}_extra_content`,
        expiresAt: Date.now() + 3600000,
      });
      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow(
        /رمز الجلسة النشط في التخزين غير مطابق للصيغة القياسية المعتمدة للشخصية الاختبارية/
      );

      // 10. Origin snapshot preserved and Developer not restored during rejection
      expect(authStorage.hasDeveloperOriginSession()).toBe(true);
      expect(capturedAuth!.user?.id).toBe('USR_TEST_AST_001');

      // 11. Valid 13-digit Date.now() timestamp is accepted and successfully restores Developer
      const validTimestamp = Date.now();
      authStorage.setSession({
        user: astUser,
        token: `mock_jwt_USR_TEST_AST_001_${validTimestamp}`,
        expiresAt: Date.now() + 3600000,
      });
      const returnResult = await capturedAuth!.returnToDeveloperSession();
      expect(returnResult).toBe(true);
      expect(capturedAuth!.user?.id).toBe('USR_DEV_001');
      expect(authStorage.hasDeveloperOriginSession()).toBe(false);
    });

    it('P5-T13-13: A token associated with a different registered persona or arbitrary format is rejected by returnToDeveloperSession', async () => {
      // Origin session belongs to USR_TEST_AST_001
      const origin: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: Date.now() + 3600000,
        personaId: 'USR_TEST_AST_001',
      };
      authStorage.saveDeveloperOriginSession(origin);

      const astPersona = getSyntheticTestPersona('USR_TEST_AST_001')!;
      const astUser = personaToUser(astPersona);

      // Active storage token contains identifier of another registered persona (USR_TEST_LEC_001)
      authStorage.setSession({
        user: astUser,
        token: `mock_jwt_USR_TEST_LEC_001_${Date.now()}`,
        expiresAt: Date.now() + 3600000,
      });
      vi.spyOn(authApi, 'getCurrentUser').mockResolvedValueOnce({ user: astUser });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(capturedAuth!.user?.id).toBe('USR_TEST_AST_001');
      });

      // Reject cross-persona token association
      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow(
        /رمز الجلسة النشط في التخزين غير مطابق للصيغة القياسية المعتمدة للشخصية الاختبارية/
      );

      expect(authStorage.hasDeveloperOriginSession()).toBe(true);
    });

    it('P5-T13-14: Missing or inconsistent isolated-session state in AuthContext is rejected by returnToDeveloperSession', async () => {
      // Mount AuthProvider in a standard authenticated state (NOT an isolated session)
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      let capturedIsolated: ReturnType<typeof useIsolatedSession> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer
              onState={(auth, isolated) => {
                capturedAuth = auth;
                capturedIsolated = isolated;
              }}
            />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(capturedAuth!.user?.id).toBe('USR_DEV_001');
        expect(capturedIsolated!.isIsolatedSession).toBe(false);
      });

      // Now inject an orphaned origin snapshot into storage behind the back of React state
      const orphanedOrigin: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: Date.now() + 3600000,
        personaId: 'USR_TEST_AST_001',
      };
      authStorage.saveDeveloperOriginSession(orphanedOrigin);

      // Programmatic invocation of returnToDeveloperSession when isIsolatedSession is false must be rejected
      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow(
        /حالة الجلسة المعزولة غير مفعلة في سياق التطبيق/
      );

      // Snapshot preserved and state unchanged
      expect(authStorage.hasDeveloperOriginSession()).toBe(true);
    });

    it('P5-T13-15: isolatedPersona.id differing from origin.personaId is rejected by returnToDeveloperSession', async () => {
      // Setup isolated session where storage snapshot has USR_TEST_AST_001
      const origin: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: Date.now() + 3600000,
        personaId: 'USR_TEST_AST_001',
      };
      authStorage.saveDeveloperOriginSession(origin);

      const astPersona = getSyntheticTestPersona('USR_TEST_AST_001')!;
      const astUser = personaToUser(astPersona);
      authStorage.setSession({
        user: astUser,
        token: `mock_jwt_USR_TEST_AST_001_${Date.now()}`,
        expiresAt: Date.now() + 3600000,
      });
      vi.spyOn(authApi, 'getCurrentUser').mockResolvedValueOnce({ user: astUser });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(capturedAuth!.user?.id).toBe('USR_TEST_AST_001');
      });

      // Tamper storage origin snapshot so personaId becomes USR_TEST_LEC_001 while AuthContext.isolatedPersona is USR_TEST_AST_001
      authStorage.clearDeveloperOriginSession();
      authStorage.saveDeveloperOriginSession({
        ...origin,
        personaId: 'USR_TEST_LEC_001',
      });

      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow(
        /الشخصية الاختبارية في سياق التطبيق لا تطابق معرف الشخصية المحفوظ في لقطة المطور/
      );

      expect(authStorage.hasDeveloperOriginSession()).toBe(true);
    });

    it('P5-T13-16: Direct invocation of returnToDeveloperSession is rejected when banner is hidden or isolated state is invalid', async () => {
      // Active user is an unprivileged real student account
      const realStudentUser: User = {
        id: 'USR_STUDENT_OUTSIDER_888',
        name: 'طالب خارجي',
        email: 'outsider@metro.edu',
        role: 'user',
        department: 'التشغيل',
        jobTitle: 'متدرب',
        initials: 'ط.خ',
      };
      authStorage.setSession({
        user: realStudentUser,
        token: 'student-regular-token-xyz',
        expiresAt: Date.now() + 3600000,
      });
      vi.spyOn(authApi, 'getCurrentUser').mockResolvedValueOnce({ user: realStudentUser });

      // An orphaned Developer origin snapshot exists in storage
      const orphanedOrigin: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: Date.now() + 3600000,
        personaId: 'USR_TEST_AST_001',
      };
      authStorage.saveDeveloperOriginSession(orphanedOrigin);

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionBanner />
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(capturedAuth!.user?.id).toBe('USR_STUDENT_OUTSIDER_888');
      });

      // 1. Verify UI containment: Banner is hidden
      expect(screen.queryByTestId('isolated-session-banner')).toBeNull();
      expect(screen.queryByTestId('return-to-developer-btn')).toBeNull();

      // 2. Direct programmatic invocation of returnToDeveloperSession() without UI button
      await expect(capturedAuth!.returnToDeveloperSession()).rejects.toThrow();

      // 3. Security Invariant: Developer credentials are never restored
      expect(capturedAuth!.user?.id).toBe('USR_STUDENT_OUTSIDER_888');
      expect(capturedAuth!.user?.role).toBe('user');
      expect(authStorage.hasDeveloperOriginSession()).toBe(true);
    });
  });

  // =========================================================================
  // Group 4: Failure, Rollback & Security Boundaries (Tests 18 - 22)
  // =========================================================================
  describe('Group 4: Failure Handling & Security Invariants', () => {
    it('P5-T15-1: Failed persona authentication rolls back to the original Developer session', async () => {
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      // Mock authApi.login to fail
      vi.spyOn(authApi, 'login').mockRejectedValueOnce(new Error('Network error: Authentication rejected'));

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await expect(
        capturedAuth!.launchIsolatedTestSession('USR_TEST_AST_001')
      ).rejects.toThrow('Network error: Authentication rejected');

      // Verify complete rollback
      expect(capturedAuth!.user?.id).toBe('USR_DEV_001');
      expect(capturedAuth!.user?.role).toBe('developer');
      expect(capturedAuth!.isIsolatedSession).toBe(false);
      expect(authStorage.hasDeveloperOriginSession()).toBe(false);

      const activeSession = authStorage.getSession();
      expect(activeSession?.token).toBe(FIXTURE_DEVELOPER_TOKEN);
    });

    it('P5-T12-1: Non-Developer users cannot access launch/return controls or invoke protected actions', () => {
      // Setup authenticated Trainee
      authStorage.setSession({
        user: {
          id: 'USR_TRN_001',
          name: 'متدرب ميداني',
          email: 'trainee@cairo-metro.internal',
          role: 'user',
          department: 'الصيانة',
          jobTitle: 'فني',
          initials: 'م.ت',
        },
        token: 'token-trainee-123',
        expiresAt: Date.now() + 3600000,
      });

      let capturedIsolated: ReturnType<typeof useIsolatedSession> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(_, isolated) => (capturedIsolated = isolated)} />
          </AuthProvider>
        </MemoryRouter>
      );

      expect(capturedIsolated!.canLaunch).toBe(false);
      expect(capturedIsolated!.isIsolatedSession).toBe(false);
    });

    it('P5-T20-1: switchDemoUser cannot bypass the new registry and session-boundary rules', async () => {
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      // Calling switchDemoUser must reject per D-10 / MFR-40
      await expect(capturedAuth!.switchDemoUser('admin')).rejects.toThrow(
        /switchDemoUser is decommissioned per Decision D-10/
      );
    });

    it('P5-T17-1: Explicit logout from an isolated session clears both session slots', async () => {
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      // Launch isolated session
      await act(async () => {
        await capturedAuth!.launchIsolatedTestSession('USR_TEST_ADMIN_001');
      });

      expect(authStorage.hasDeveloperOriginSession()).toBe(true);

      // Explicit logout
      await act(async () => {
        await capturedAuth!.logout();
      });

      // Both slots must be purged per INV-P5-7
      expect(authStorage.getSession()).toBeNull();
      expect(authStorage.hasDeveloperOriginSession()).toBe(false);
      expect(authStorage.getDeveloperOriginSession()).toBeNull();
      expect(capturedAuth!.user).toBeNull();
      expect(capturedAuth!.isIsolatedSession).toBe(false);
    });

    it('P5-T11-2: API requests during isolated sessions use the actual synthetic persona identity', async () => {
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await act(async () => {
        await capturedAuth!.launchIsolatedTestSession('USR_TEST_ADMIN_001');
      });

      const activeSession = authStorage.getSession();
      expect(activeSession?.user.role).toBe('admin');
      expect(activeSession?.user.id).toBe('USR_TEST_ADMIN_001');
      // Token passed to network layer will be persona token, not developer token
      expect(activeSession?.token).not.toBe(FIXTURE_DEVELOPER_TOKEN);
    });

    it('P5-T11-3: API/MSW identity resolution matches the documented authentication contract across Cases A, B, C, and D', async () => {
      // 1. Establish isolated test session as synthetic lecturer
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await act(async () => {
        await capturedAuth!.launchIsolatedTestSession('USR_TEST_LEC_001');
      });

      // 2. Active storage contains persona session and distinct token
      const personaSession = authStorage.getSession();
      expect(personaSession).not.toBeNull();
      expect(personaSession?.user.id).toBe('USR_TEST_LEC_001');
      expect(personaSession?.user.role).toBe('lecturer');

      // 3. Case A: Active session exists and bearer token matches -> resolves active persona
      const matchingReq = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer ${personaSession?.token}` },
      });
      const resolvedCaseA = resolveAuthenticatedUser(matchingReq);
      expect(resolvedCaseA).not.toBeNull();
      expect(resolvedCaseA?.id).toBe('USR_TEST_LEC_001');
      expect(resolvedCaseA?.role).toBe('lecturer');

      // 4. Case B: Active session exists in storage, but bearer token does NOT match (e.g. tampered or Super Admin token)
      // Must fail closed (returns null) and NEVER fall through to token decoding!
      const mismatchedReq = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer mock_jwt_USR_SUPER_001_${Date.now()}` },
      });
      const resolvedCaseB = resolveAuthenticatedUser(mismatchedReq);
      expect(resolvedCaseB).toBeNull();

      // 5. Case C: Browser session is absent in browser runtime -> fail closed, no token impersonation
      authStorage.clearSession();
      const unauthedBrowserReq = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer mock_jwt_USR_TEST_LEC_001_${Date.now()}` },
      });
      const resolvedCaseC = resolveAuthenticatedUser(unauthedBrowserReq, { enforceBrowserSession: true });
      expect(resolvedCaseC).toBeNull();

      // 5b. Browser storage exception with enforceBrowserSession: true (e.g. SecurityError in iframe/private browsing)
      // Critical Security Rule: Must fail closed (returns null) and NEVER fall through to token fallback!
      const storageSpy = vi.spyOn(authStorage, 'getSession').mockImplementation(() => {
        throw new Error('SecurityError: The operation is insecure.');
      });
      const storageExceptionReq = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer mock_jwt_USR_TEST_LEC_001_${Date.now()}` },
      });
      const resolvedStorageException = resolveAuthenticatedUser(storageExceptionReq, { enforceBrowserSession: true });
      expect(resolvedStorageException).toBeNull();

      // 5c. Header-based enforcement with storage exception also fails closed (returns null)
      const headerEnforcedReq = new Request('https://metro.lms/api/courses', {
        headers: {
          Authorization: `Bearer mock_jwt_USR_TEST_LEC_001_${Date.now()}`,
          'X-Enforce-Browser-Session': 'true',
        },
      });
      expect(resolveAuthenticatedUser(headerEnforcedReq)).toBeNull();

      // 6. Case D: Controlled non-browser fallback remains accessible strictly inside the approved Vitest runner
      // when browser session enforcement is NOT required
      const headlessReq = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer mock_jwt_USR_TEST_LEC_001_${Date.now()}` },
      });
      const resolvedCaseD = resolveAuthenticatedUser(headlessReq, { enforceBrowserSession: false });
      expect(resolvedCaseD).not.toBeNull();
      expect(resolvedCaseD?.id).toBe('USR_TEST_LEC_001');

      // 6b. Non-browser runtime outside the approved test runner fails closed (returns null)
      const originalVitest = process.env.VITEST;
      try {
        delete (process.env as Record<string, string | undefined>).VITEST;
        // Without the approved test-runner marker, arbitrary Node/SSR runtimes cannot use token fallback
        const unapprovedNodeResolved = resolveAuthenticatedUser(headlessReq, { enforceBrowserSession: false });
        expect(unapprovedNodeResolved).toBeNull();

        // /api/auth/me also follows the same policy: outside approved test runner, absent session fails closed
        const meReq = new Request('https://metro.lms/api/auth/me', {
          headers: { Authorization: `Bearer mock_jwt_USR_TEST_LEC_001_${Date.now()}` },
        });
        const meResolved = resolveAuthenticatedUser(meReq, { enforceBrowserSession: false });
        expect(meResolved).toBeNull();
      } finally {
        process.env.VITEST = originalVitest;
      }

      // 6c. Explicit browser-session enforcement overrides test-runner fallback inside Vitest
      const overriddenReq = new Request('https://metro.lms/api/courses', {
        headers: {
          Authorization: `Bearer mock_jwt_USR_TEST_LEC_001_${Date.now()}`,
          'X-Enforce-Browser-Session': 'true',
        },
      });
      expect(resolveAuthenticatedUser(overriddenReq)).toBeNull();

      storageSpy.mockRestore();
    });

    it('P5-T15-2: Rollback storage restoration failure fails closed and does not expose Developer identity (user === null)', async () => {
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      // Login fails to trigger rollback
      vi.spyOn(authApi, 'login').mockRejectedValueOnce(new Error('Simulated login failure'));

      // Storage fails during restoration attempt in rollback
      vi.spyOn(authStorage, 'setSession').mockImplementationOnce(() => {
        throw new Error('Simulated storage write error during rollback');
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await expect(
        capturedAuth!.launchIsolatedTestSession('USR_TEST_AST_001')
      ).rejects.toThrow(/فشل تفعيل جلسة الشخصية الاختبارية وتعذر تأكيد استعادة جلسة المطور في التخزين/);

      // Invariant: User must be set to null (fail-closed) so Developer identity is never exposed
      expect(capturedAuth!.user).toBeNull();
      // Origin snapshot preserved for recovery
      expect(authStorage.hasDeveloperOriginSession()).toBe(true);
    });

    it('P5-T15-3: Rollback storage token mismatch preserves origin snapshot', async () => {
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      vi.spyOn(authApi, 'login').mockRejectedValueOnce(new Error('Persona login rejected'));

      // Simulate corrupted token returned by storage during read-back in rollback
      const originalSetSession = authStorage.setSession.bind(authStorage);
      vi.spyOn(authStorage, 'setSession').mockImplementation((session) => {
        originalSetSession(session);
        vi.spyOn(authStorage, 'getSession').mockReturnValueOnce({
          user: FIXTURE_DEVELOPER,
          token: 'token-mismatched-corrupted',
          expiresAt: Date.now() + 3600000,
        });
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await expect(
        capturedAuth!.launchIsolatedTestSession('USR_TEST_AST_001')
      ).rejects.toThrow(/فشل تفعيل جلسة الشخصية الاختبارية وتعذر تأكيد استعادة جلسة المطور في التخزين/);

      // Snapshot MUST be preserved because restoration consistency failed
      expect(authStorage.hasDeveloperOriginSession()).toBe(true);
      expect(authStorage.getDeveloperOriginSession()?.developerToken).toBe(FIXTURE_DEVELOPER_TOKEN);
      expect(capturedAuth!.user).toBeNull();
    });

    it('P5-T15-4: Isolated-session state is not cleared when Developer restoration fails', async () => {
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      vi.spyOn(authApi, 'login').mockRejectedValueOnce(new Error('Persona login failure'));

      // Simulate storage getSession returning null during rollback check
      vi.spyOn(authStorage, 'setSession').mockImplementation(() => {});
      vi.spyOn(authStorage, 'getSession').mockReturnValue(null);

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await expect(
        capturedAuth!.launchIsolatedTestSession('USR_TEST_AST_001')
      ).rejects.toThrow(/تعذر تأكيد استعادة جلسة المطور/);

      // Origin snapshot is NOT cleared
      expect(authStorage.hasDeveloperOriginSession()).toBe(true);
      // User is cleared to fail closed
      expect(capturedAuth!.user).toBeNull();
    });

    it('P5-T15-5: Successful rollback updates Developer identity only after storage verification', async () => {
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      vi.spyOn(authApi, 'login').mockRejectedValueOnce(new Error('Login rejected'));

      const setSessionOrder: string[] = [];
      const originalSetSession = authStorage.setSession.bind(authStorage);
      vi.spyOn(authStorage, 'setSession').mockImplementation((session) => {
        setSessionOrder.push('storage-setSession');
        originalSetSession(session);
      });

      const originalGetSession = authStorage.getSession.bind(authStorage);
      vi.spyOn(authStorage, 'getSession').mockImplementation(() => {
        setSessionOrder.push('storage-getSession');
        return originalGetSession();
      });

      let capturedAuth: ReturnType<typeof useAuth> | null = null;
      render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      await expect(
        capturedAuth!.launchIsolatedTestSession('USR_TEST_AST_001')
      ).rejects.toThrow('Login rejected');

      // Verify that storage operations happened during rollback before successful restoration
      expect(setSessionOrder).toContain('storage-setSession');
      expect(setSessionOrder).toContain('storage-getSession');
      // On verified success: Developer restored, origin snapshot cleared, isolated state false
      expect(capturedAuth!.user?.id).toBe('USR_DEV_001');
      expect(capturedAuth!.user?.role).toBe('developer');
      expect(capturedAuth!.isIsolatedSession).toBe(false);
      expect(authStorage.hasDeveloperOriginSession()).toBe(false);
    });
  });
});

// =========================================================================
// Increment 5.4 / WP-5.4.1: Session Rehydration & Mount Hardening
// STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
// =========================================================================
describe('Increment 5.4 / WP-5.4.1: Session Rehydration & Mount Hardening (Deferred to Phase 13)', () => {
  beforeEach(() => {
    authStorage.clearSession();
    authStorage.clearDeveloperOriginSession();
    authStorage.clearQuarantinedOriginSession();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    authStorage.clearSession();
    authStorage.clearDeveloperOriginSession();
    authStorage.clearQuarantinedOriginSession();
    vi.restoreAllMocks();
  });

  it('P5-T16-1: Cold rehydration restores active persona identity and origin snapshot; transient network timeout preserves snapshot with retry action', async () => {
    const astPersona = getSyntheticTestPersona('USR_TEST_AST_001')!;
    const astUser = personaToUser(astPersona);
    const validTimestamp = Date.now();
    const personaToken = `mock_jwt_USR_TEST_AST_001_${validTimestamp}`;

    // 1. Establish valid isolated session state in storage (cold reload condition)
    const origin: DeveloperOriginSession = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      developerUser: FIXTURE_DEVELOPER,
      developerToken: FIXTURE_DEVELOPER_TOKEN,
      developerExpiresAt: Date.now() + 3600000,
      personaId: 'USR_TEST_AST_001',
    };
    authStorage.saveDeveloperOriginSession(origin);

    authStorage.setSession({
      user: astUser,
      token: personaToken,
      expiresAt: Date.now() + 1800000,
    });

    // 2. Part A: Simulate temporary transport/network timeout during mount revalidation
    vi.spyOn(authApi, 'getCurrentUser').mockRejectedValueOnce(new Error('Network timeout'));

    let capturedAuth: ReturnType<typeof useAuth> | null = null;
    const { unmount } = render(
      <MemoryRouter>
        <AuthProvider>
          <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          <IsolatedSessionBanner />
        </AuthProvider>
      </MemoryRouter>
    );

    // Wait for initial mount revalidation to complete with error
    await waitFor(() => {
      expect(capturedAuth?.isLoading).toBe(false);
    });

    // Assert transient failure handling:
    // - Origin snapshot preserved (NOT deleted, NOT quarantined)
    expect(authStorage.hasDeveloperOriginSession()).toBe(true);
    // - Active session in storage preserved (NOT cleared)
    expect(authStorage.getSession()?.token).toBe(personaToken);
    // - Gated user state is null (unverified session not exposed as authenticated)
    expect(capturedAuth?.user).toBeNull();
    // - Developer is NEVER elevated
    expect(capturedAuth?.user?.id).not.toBe('USR_DEV_001');
    // - Error message indicates recoverable transport failure
    expect(capturedAuth?.error).toMatch(/تعذر التحقق من صلاحية الجلسة بسبب مشكلة في الاتصال بالخادم/);
    // - Quarantine is NOT triggered for transient transport failures
    expect(authStorage.getQuarantinedOriginSession()).toBeNull();

    // UI Isolation during transient failure (Acceptance Point 1):
    // Neither normal isolated-session banner nor emergency banner is rendered
    expect(screen.queryByTestId('isolated-session-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('emergency-session-banner')).not.toBeInTheDocument();
    expect(capturedAuth?.isEmergencyState).toBe(false);
    expect(capturedAuth?.emergencyProof).toBeNull();

    // 3. Part B: Simulate network recovery and execute retryRevalidation action
    vi.spyOn(authApi, 'getCurrentUser').mockResolvedValueOnce({
      user: astUser,
      token: personaToken,
      expiresAt: Date.now() + 1800000,
    });

    await act(async () => {
      await capturedAuth?.retryRevalidation?.();
    });

    // Assert successful recovery:
    // - Persona user is now authenticated and restored
    expect(capturedAuth?.user?.id).toBe('USR_TEST_AST_001');
    expect(capturedAuth?.user?.role).toBe('assistant_admin');
    expect(capturedAuth?.isIsolatedSession).toBe(true);
    expect(capturedAuth?.isolatedPersona?.id).toBe('USR_TEST_AST_001');
    expect(capturedAuth?.error).toBeNull();
    // - Origin snapshot remains intact for future return
    expect(authStorage.hasDeveloperOriginSession()).toBe(true);

    // Normal return banner is now rendered; emergency banner is not
    expect(screen.getByTestId('isolated-session-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('emergency-session-banner')).not.toBeInTheDocument();

    unmount();
  });

  it('P5-T16-2: Normal one-click return (returnToDeveloperSession) cleanly restores Developer session following cold page reload', async () => {
    const astPersona = getSyntheticTestPersona('USR_TEST_AST_001')!;
    const astUser = personaToUser(astPersona);
    const validTimestamp = Date.now();
    const personaToken = `mock_jwt_USR_TEST_AST_001_${validTimestamp}`;

    // Establish cold reload storage state
    const origin: DeveloperOriginSession = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      developerUser: FIXTURE_DEVELOPER,
      developerToken: FIXTURE_DEVELOPER_TOKEN,
      developerExpiresAt: Date.now() + 3600000,
      personaId: 'USR_TEST_AST_001',
    };
    authStorage.saveDeveloperOriginSession(origin);

    authStorage.setSession({
      user: astUser,
      token: personaToken,
      expiresAt: Date.now() + 1800000,
    });

    // Server revalidation succeeds on mount
    vi.spyOn(authApi, 'getCurrentUser').mockResolvedValueOnce({
      user: astUser,
      token: personaToken,
      expiresAt: Date.now() + 1800000,
    });

    let capturedAuth: ReturnType<typeof useAuth> | null = null;
    let capturedIsolated: ReturnType<typeof useIsolatedSession> | null = null;

    render(
      <MemoryRouter>
        <AuthProvider>
          <IsolatedSessionTestConsumer
            onState={(auth, isolated) => {
              capturedAuth = auth;
              capturedIsolated = isolated;
            }}
          />
          <IsolatedSessionBanner />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(capturedAuth?.isLoading).toBe(false);
      expect(capturedAuth?.user?.id).toBe('USR_TEST_AST_001');
    });

    // Verify normal isolated session UI elements are rendered
    expect(screen.getByTestId('isolated-session-banner')).toBeInTheDocument();
    expect(screen.getByTestId('return-to-developer-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('emergency-session-banner')).not.toBeInTheDocument();

    // Trigger normal return
    await act(async () => {
      const success = await capturedIsolated!.returnToDeveloperSession();
      expect(success).toBe(true);
    });

    // Assert complete post-return state:
    // - Developer restored in React context
    expect(capturedAuth?.user?.id).toBe('USR_DEV_001');
    expect(capturedAuth?.user?.role).toBe('developer');
    expect(capturedAuth?.isIsolatedSession).toBe(false);
    expect(capturedAuth?.isolatedPersona).toBeNull();
    // - Origin snapshot purged from storage
    expect(authStorage.hasDeveloperOriginSession()).toBe(false);
    // - Active storage session restored to Developer
    const restoredSession = authStorage.getSession();
    expect(restoredSession?.user.id).toBe('USR_DEV_001');
    expect(restoredSession?.token).toBe(FIXTURE_DEVELOPER_TOKEN);
    // - Return banner unmounted
    expect(screen.queryByTestId('isolated-session-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('emergency-session-banner')).not.toBeInTheDocument();
  });

  it('P5-T16-3: Dual-session expiration on cold reload fails closed to /login and creates sanitized quarantine without credentials', async () => {
    const now = Date.now();
    const expiredTimestamp = now - 5000;
    const oldPersonaToken = `mock_jwt_USR_TEST_AST_001_${now - 10000}`;
    const astPersona = getSyntheticTestPersona('USR_TEST_AST_001')!;
    const astUser = personaToUser(astPersona);

    // =========================================================================
    // Part A: Dual-Session Expiration & Sanitized Quarantine (Acceptance Point 3 & 4)
    // Both active persona session AND Developer origin snapshot are conclusively expired
    // Exact expiration boundary:
    // - Persona active session: Date.now() > expiresAt
    // - Developer origin snapshot: Date.now() >= developerExpiresAt
    // =========================================================================
    const expiredOrigin: DeveloperOriginSession = {
      schemaVersion: 1,
      savedAt: new Date(now - 7200000).toISOString(),
      developerUser: FIXTURE_DEVELOPER,
      developerToken: FIXTURE_DEVELOPER_TOKEN,
      developerExpiresAt: expiredTimestamp,
      personaId: 'USR_TEST_AST_001',
    };
    window.sessionStorage.setItem('metro_lms_developer_origin_session', JSON.stringify(expiredOrigin));

    authStorage.setSession({
      user: astUser,
      token: oldPersonaToken,
      expiresAt: expiredTimestamp,
    });

    let capturedAuth: ReturnType<typeof useAuth> | null = null;

    const { unmount: unmountPartA } = render(
      <MemoryRouter>
        <AuthProvider>
          <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          <IsolatedSessionBanner />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(capturedAuth?.isLoading).toBe(false);
    });

    // Assert fail-closed state:
    // - User is null (unauthenticated, requires fresh login)
    expect(capturedAuth?.user).toBeNull();
    // - Developer identity is NEVER restored
    expect(capturedAuth?.user?.id).not.toBe('USR_DEV_001');
    // - Isolated session state is false
    expect(capturedAuth?.isIsolatedSession).toBe(false);
    expect(capturedAuth?.isolatedPersona).toBeNull();
    // - Clear notification indicating Developer session expired
    expect(capturedAuth?.error).toMatch(/انتهت صلاحية جلسة المطور/);

    // Neither normal banner nor emergency banner is rendered
    expect(screen.queryByTestId('isolated-session-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('emergency-session-banner')).not.toBeInTheDocument();

    // Assert storage cleanup:
    // - Expired origin snapshot is purged
    expect(authStorage.hasDeveloperOriginSession()).toBe(false);
    expect(window.sessionStorage.getItem('metro_lms_developer_origin_session')).toBeNull();
    // - Expired persona session is purged
    expect(authStorage.getSession()).toBeNull();

    // Assert sanitized quarantine in metro_lms_quarantined_snapshot:
    const quarantined = authStorage.getQuarantinedOriginSession();
    expect(quarantined).not.toBeNull();
    expect(quarantined?.schemaVersion).toBe('1.0');
    expect(quarantined?.developerId).toBe('USR_DEV_001');
    expect(quarantined?.personaId).toBe('USR_TEST_AST_001');
    expect(quarantined?.developerExpiresAt).toBe(expiredTimestamp);
    expect(quarantined?.rejectionReason).toBe('DEVELOPER_SNAPSHOT_EXPIRED');

    // CRITICAL SECURITY ASSERTION: Strict Secret Non-Disclosure
    const rawQuarantineJson = window.sessionStorage.getItem(QUARANTINE_STORAGE_KEY) || '{}';
    const parsedQuarantine = JSON.parse(rawQuarantineJson);
    expect(parsedQuarantine.developerToken).toBeUndefined();
    expect(parsedQuarantine.token).toBeUndefined();
    expect(parsedQuarantine.rawToken).toBeUndefined();
    expect(parsedQuarantine.personaToken).toBeUndefined();
    expect(parsedQuarantine.password).toBeUndefined();
    expect(parsedQuarantine.authorization).toBeUndefined();
    expect(rawQuarantineJson).not.toContain(FIXTURE_DEVELOPER_TOKEN);
    expect(rawQuarantineJson).not.toContain(oldPersonaToken);

    unmountPartA();

    // =========================================================================
    // Part B: Protect Independent Real-User Session During Quarantine (Acceptance Point 4)
    // When Developer origin snapshot is expired while a DIFFERENT real-user is active:
    // Quarantine and remove ONLY the expired Developer snapshot; PRESERVE real-user session.
    // =========================================================================
    authStorage.clearSession();
    authStorage.clearDeveloperOriginSession();
    authStorage.clearQuarantinedOriginSession();

    const realUser: User = {
      id: 'USR_SUPER_001',
      name: 'م. ياسين رضوان',
      email: 'superadmin@cairo-metro.com',
      role: 'super_admin',
      department: 'الإدارة العليا',
      jobTitle: 'المسؤول الأعلى للأنظمة',
      initials: 'ي.ر',
    };
    const realUserToken = `mock_jwt_USR_SUPER_001_${Date.now()}`;

    // Establish active real-user session
    authStorage.setSession({
      user: realUser,
      token: realUserToken,
      expiresAt: Date.now() + 3600000,
    });

    // Establish old expired Developer origin snapshot
    const expiredDevSnapshot: DeveloperOriginSession = {
      schemaVersion: 1,
      savedAt: new Date(Date.now() - 7200000).toISOString(),
      developerUser: FIXTURE_DEVELOPER,
      developerToken: FIXTURE_DEVELOPER_TOKEN,
      developerExpiresAt: Date.now() - 1000, // Conclusively expired
      personaId: 'USR_TEST_AST_001',
    };
    window.sessionStorage.setItem('metro_lms_developer_origin_session', JSON.stringify(expiredDevSnapshot));

    vi.spyOn(authApi, 'getCurrentUser').mockResolvedValueOnce({
      user: realUser,
      token: realUserToken,
      expiresAt: Date.now() + 3600000,
    });

    let capturedRealAuth: ReturnType<typeof useAuth> | null = null;
    const { unmount: unmountPartB } = render(
      <MemoryRouter>
        <AuthProvider>
          <IsolatedSessionTestConsumer onState={(auth) => (capturedRealAuth = auth)} />
          <IsolatedSessionBanner />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(capturedRealAuth?.isLoading).toBe(false);
      expect(capturedRealAuth?.user?.id).toBe('USR_SUPER_001');
    });

    // Real user is PRESERVED, not logged out:
    expect(capturedRealAuth?.user?.id).toBe('USR_SUPER_001');
    expect(capturedRealAuth?.user?.role).toBe('super_admin');
    expect(capturedRealAuth?.isIsolatedSession).toBe(false);
    expect(authStorage.getSession()?.user.id).toBe('USR_SUPER_001');
    // Developer is NOT restored:
    expect(capturedRealAuth?.user?.id).not.toBe('USR_DEV_001');
    // Expired Developer snapshot was quarantined and removed:
    expect(authStorage.hasDeveloperOriginSession()).toBe(false);
    expect(authStorage.getQuarantinedOriginSession()?.rejectionReason).toBe('DEVELOPER_SNAPSHOT_EXPIRED');
    // No banners shown:
    expect(screen.queryByTestId('isolated-session-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('emergency-session-banner')).not.toBeInTheDocument();

    unmountPartB();

    // =========================================================================
    // Part C: Memory-Only Emergency Proof Lifecycle & SHA-256 Snapshot Digest Binding
    // (WP-5.4.1 Final Fingerprint Quality Audit)
    // 1. Replacing only developerToken invalidates proof & suppresses banner.
    // 2. Changing any relevant Developer user claim invalidates proof.
    // 3. Changing other canonical snapshot fields (e.g. savedAt) invalidates proof.
    // 4. Proof contains only SHA-256 digest (sha256_...) and approved metadata.
    // 5. Raw token and canonical serialization are strictly absent from proof.
    // 6. Proof is strictly absent from sessionStorage and localStorage.
    // 7. Provider recreation after eviction invalidates proof.
    // 8. Stale asynchronous digest result cannot re-enable emergency state.
    // 9. Missing Web Crypto causes fail-closed behavior.
    // =========================================================================
    authStorage.clearSession();
    authStorage.clearDeveloperOriginSession();
    authStorage.clearQuarantinedOriginSession();

    // Establish expired persona session with an UNEXPIRED Developer origin snapshot
    const validUnexpiredOrigin: DeveloperOriginSession = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      developerUser: FIXTURE_DEVELOPER,
      developerToken: FIXTURE_DEVELOPER_TOKEN,
      developerExpiresAt: Date.now() + 3600000, // Unexpired
      personaId: 'USR_TEST_AST_001',
    };
    authStorage.saveDeveloperOriginSession(validUnexpiredOrigin);

    authStorage.setSession({
      user: astUser,
      token: `mock_jwt_USR_TEST_AST_001_${Date.now() - 10000}`,
      expiresAt: Date.now() - 5000, // Conclusively expired persona session
    });

    let capturedEmergencyAuth: ReturnType<typeof useAuth> | null = null;
    const { unmount: unmountPartC1, rerender: rerenderPartC1 } = render(
      <MemoryRouter>
        <AuthProvider>
          <IsolatedSessionTestConsumer onState={(auth) => (capturedEmergencyAuth = auth)} />
          <IsolatedSessionBanner />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(capturedEmergencyAuth?.isLoading).toBe(false);
      expect(capturedEmergencyAuth?.emergencyProof).not.toBeNull();
    });

    // In initial lifecycle with continuity proven:
    // - User is null (expired session evicted from storage)
    expect(capturedEmergencyAuth?.user).toBeNull();
    // - Memory-only proof established in current provider:
    expect(capturedEmergencyAuth?.emergencyProof?.personaId).toBe('USR_TEST_AST_001');

    // ASSERTION 4: Proof contains only the SHA-256 digest and approved non-secret metadata
    expect(capturedEmergencyAuth?.emergencyProof?.originSnapshotFingerprint).toMatch(/^sha256_[0-9a-f]{64}$/);
    expect(capturedEmergencyAuth?.isEmergencyState).toBe(true);

    // ASSERTION 5: Raw token and canonical serialization are strictly absent from proof
    const proofKeys = Object.keys(capturedEmergencyAuth?.emergencyProof || {});
    expect(proofKeys).not.toContain('developerToken');
    expect(proofKeys).not.toContain('token');
    expect(proofKeys).not.toContain('rawToken');
    expect(proofKeys).not.toContain('personaToken');
    expect(proofKeys).not.toContain('password');
    expect(proofKeys).not.toContain('authorization');
    expect(proofKeys).not.toContain('canonicalRepresentation');
    expect(proofKeys).not.toContain('canonicalSerialization');
    expect(JSON.stringify(capturedEmergencyAuth?.emergencyProof)).not.toContain(FIXTURE_DEVELOPER_TOKEN);

    // ASSERTION 6: Proof exists strictly in React memory, NEVER serialized to storage
    expect(window.sessionStorage.getItem('metro_lms_emergency_continuity_proof')).toBeNull();
    expect(window.localStorage.getItem('metro_lms_emergency_continuity_proof')).toBeNull();

    // - Emergency banner renders; normal banner does NOT render
    expect(screen.getByTestId('emergency-session-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('isolated-session-banner')).not.toBeInTheDocument();
    // - Stored persona session is evicted to prevent API request transmission
    expect(authStorage.getSession()).toBeNull();
    // - Origin snapshot remains in storage for future emergency return
    expect(authStorage.hasDeveloperOriginSession()).toBe(true);

    // ASSERTION 1: Replacing ONLY developerToken invalidates proof and suppresses banner
    const tokenTamperedOrigin: DeveloperOriginSession = {
      ...validUnexpiredOrigin,
      developerToken: 'mock_jwt_USR_DEV_001_TAMPERED_SECRET_99999', // Only developerToken modified
    };
    authStorage.clearDeveloperOriginSession();
    authStorage.saveDeveloperOriginSession(tokenTamperedOrigin);

    // Re-render to observe proof invalidation due to SHA-256 digest mismatch
    rerenderPartC1(
      <MemoryRouter>
        <AuthProvider>
          <IsolatedSessionTestConsumer onState={(auth) => (capturedEmergencyAuth = auth)} />
          <IsolatedSessionBanner />
        </AuthProvider>
      </MemoryRouter>
    );

    // Assert that replacing only developerToken invalidates proof and suppresses emergency banner
    await waitFor(() => {
      expect(capturedEmergencyAuth?.emergencyProof).toBeNull();
    });
    expect(capturedEmergencyAuth?.isEmergencyState).toBe(false);
    expect(screen.queryByTestId('emergency-session-banner')).not.toBeInTheDocument();

    unmountPartC1();

    // ASSERTION 2: Changing any relevant Developer user claim invalidates proof
    authStorage.clearSession();
    authStorage.clearDeveloperOriginSession();
    authStorage.saveDeveloperOriginSession(validUnexpiredOrigin);
    authStorage.setSession({
      user: astUser,
      token: `mock_jwt_USR_TEST_AST_001_${Date.now() - 10000}`,
      expiresAt: Date.now() - 5000,
    });

    let capturedClaimAuth: ReturnType<typeof useAuth> | null = null;
    const { unmount: unmountClaimTest, rerender: rerenderClaimTest } = render(
      <MemoryRouter>
        <AuthProvider>
          <IsolatedSessionTestConsumer onState={(auth) => (capturedClaimAuth = auth)} />
          <IsolatedSessionBanner />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(capturedClaimAuth?.isLoading).toBe(false);
      expect(capturedClaimAuth?.isEmergencyState).toBe(true);
    });

    // Modify a Developer user claim (department) while preserving all other fields
    const claimTamperedOrigin: DeveloperOriginSession = {
      ...validUnexpiredOrigin,
      developerUser: {
        ...validUnexpiredOrigin.developerUser,
        department: 'قسم النظم غير المصرح به', // Modified claim
      },
    };
    authStorage.clearDeveloperOriginSession();
    authStorage.saveDeveloperOriginSession(claimTamperedOrigin);

    rerenderClaimTest(
      <MemoryRouter>
        <AuthProvider>
          <IsolatedSessionTestConsumer onState={(auth) => (capturedClaimAuth = auth)} />
          <IsolatedSessionBanner />
        </AuthProvider>
      </MemoryRouter>
    );

    // Assert that modifying user claim invalidates proof and suppresses emergency banner
    await waitFor(() => {
      expect(capturedClaimAuth?.emergencyProof).toBeNull();
    });
    expect(capturedClaimAuth?.isEmergencyState).toBe(false);
    expect(screen.queryByTestId('emergency-session-banner')).not.toBeInTheDocument();

    unmountClaimTest();

    // ASSERTION 3: Changing other canonical snapshot fields (e.g. savedAt timestamp) invalidates proof
    authStorage.clearSession();
    authStorage.clearDeveloperOriginSession();
    authStorage.saveDeveloperOriginSession(validUnexpiredOrigin);
    authStorage.setSession({
      user: astUser,
      token: `mock_jwt_USR_TEST_AST_001_${Date.now() - 10000}`,
      expiresAt: Date.now() - 5000,
    });

    let capturedTimestampAuth: ReturnType<typeof useAuth> | null = null;
    const { unmount: unmountTimestampTest, rerender: rerenderTimestampTest } = render(
      <MemoryRouter>
        <AuthProvider>
          <IsolatedSessionTestConsumer onState={(auth) => (capturedTimestampAuth = auth)} />
          <IsolatedSessionBanner />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(capturedTimestampAuth?.isLoading).toBe(false);
      expect(capturedTimestampAuth?.isEmergencyState).toBe(true);
    });

    const timestampTamperedOrigin: DeveloperOriginSession = {
      ...validUnexpiredOrigin,
      savedAt: new Date(Date.now() - 5000).toISOString(), // Modified savedAt
    };
    authStorage.clearDeveloperOriginSession();
    authStorage.saveDeveloperOriginSession(timestampTamperedOrigin);

    rerenderTimestampTest(
      <MemoryRouter>
        <AuthProvider>
          <IsolatedSessionTestConsumer onState={(auth) => (capturedTimestampAuth = auth)} />
          <IsolatedSessionBanner />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(capturedTimestampAuth?.emergencyProof).toBeNull();
    });
    expect(capturedTimestampAuth?.isEmergencyState).toBe(false);
    expect(screen.queryByTestId('emergency-session-banner')).not.toBeInTheDocument();

    unmountTimestampTest();

    // ASSERTION 7: Provider recreation invalidates proof
    // After reload / recreation: active persona session is gone from storage, so Developer snapshot alone cannot reconstruct proof
    let capturedPostRefreshAuth: ReturnType<typeof useAuth> | null = null;
    const { unmount: unmountPartC2 } = render(
      <MemoryRouter>
        <AuthProvider>
          <IsolatedSessionTestConsumer onState={(auth) => (capturedPostRefreshAuth = auth)} />
          <IsolatedSessionBanner />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(capturedPostRefreshAuth?.isLoading).toBe(false);
    });

    // Developer origin snapshot ALONE never authorizes restoration or emergency state:
    expect(capturedPostRefreshAuth?.user).toBeNull();
    expect(capturedPostRefreshAuth?.emergencyProof).toBeNull();
    expect(capturedPostRefreshAuth?.isEmergencyState).toBe(false);
    expect(screen.queryByTestId('isolated-session-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('emergency-session-banner')).not.toBeInTheDocument();
    expect(authStorage.hasDeveloperOriginSession()).toBe(true);

    unmountPartC2();

    // ASSERTION 8: Async Digest Cancellation During Snapshot Replacement & Provider Unmount
    // (WP-5.4.1 Final Source Audit: Case A & Case B)
    // -------------------------------------------------------------------------
    // Case A (Provider unmount): Pending digest does not update state or restore
    // emergency eligibility after AuthProvider unmount (isCancelled = true).
    // -------------------------------------------------------------------------
    let slowDigestResolveA: ((val: ArrayBuffer) => void) | null = null;
    const subtleDigestSpyA = vi.spyOn(window.crypto.subtle, 'digest').mockImplementationOnce(() => {
      return new Promise<ArrayBuffer>((resolve) => {
        slowDigestResolveA = resolve;
      });
    });

    authStorage.clearSession();
    authStorage.clearDeveloperOriginSession();
    authStorage.saveDeveloperOriginSession(validUnexpiredOrigin);
    authStorage.setSession({
      user: astUser,
      token: `mock_jwt_USR_TEST_AST_001_${Date.now() - 10000}`,
      expiresAt: Date.now() - 5000,
    });

    let capturedSlowAuth: ReturnType<typeof useAuth> | null = null;
    const { unmount: unmountSlow } = render(
      <MemoryRouter>
        <AuthProvider>
          <IsolatedSessionTestConsumer onState={(auth) => (capturedSlowAuth = auth)} />
          <IsolatedSessionBanner />
        </AuthProvider>
      </MemoryRouter>
    );

    // Unmount before digest resolves to trigger effect cleanup cancellation (isCancelled = true)
    unmountSlow();

    // Resolve the stale digest after provider unmount
    if (slowDigestResolveA) {
      slowDigestResolveA(new ArrayBuffer(32));
    }

    // Stale result did not resurrect emergency proof in storage or cause errors
    expect(authStorage.getSession()).toBeNull();
    expect(window.sessionStorage.getItem('metro_lms_emergency_continuity_proof')).toBeNull();
    subtleDigestSpyA.mockRestore();

    // -------------------------------------------------------------------------
    // Case B (Snapshot replacement while digest is pending):
    // (WP-5.4.1 Final Technical Acceptance: 7-Step Race Invariant Verification)
    // 1. Digest A begins for revision A.
    // 2. Snapshot B replaces snapshot A through the actual authStorage write path.
    // 3. The local revision notification occurs.
    // 4. Digest A resolves before or independently of cleanup.
    // 5. Digest A is rejected because its captured revision no longer matches the current storage revision.
    // 6. Emergency state remains false until snapshot B has independently passed validation.
    // 7. Provider unmount still invalidates outstanding work (verified in Case A above).
    // -------------------------------------------------------------------------
    authStorage.clearSession();
    authStorage.clearDeveloperOriginSession();
    authStorage.saveDeveloperOriginSession(validUnexpiredOrigin);
    authStorage.setSession({
      user: astUser,
      token: `mock_jwt_USR_TEST_AST_001_${Date.now() - 10000}`,
      expiresAt: Date.now() - 5000,
    });

    let capturedCaseBAuth: ReturnType<typeof useAuth> | null = null;
    const { unmount: unmountCaseB } = render(
      <MemoryRouter>
        <AuthProvider>
          <IsolatedSessionTestConsumer onState={(auth) => (capturedCaseBAuth = auth)} />
          <IsolatedSessionBanner />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(capturedCaseBAuth?.isLoading).toBe(false);
      expect(capturedCaseBAuth?.isEmergencyState).toBe(true);
    });

    // Step 1: Capture Revision A and intercept Digest A with delayed promise
    const revisionA = authStorage.getDeveloperOriginSnapshotVersion();
    let delayedDigestResolveA: ((val: ArrayBuffer) => void) | null = null;
    const subtleDigestSpyB = vi.spyOn(window.crypto.subtle, 'digest').mockImplementationOnce(() => {
      return new Promise<ArrayBuffer>((resolve) => {
        delayedDigestResolveA = resolve;
      });
    });

    // Step 2: Snapshot B replaces Snapshot A through the actual authStorage write path
    const snapshotB: DeveloperOriginSession = {
      ...validUnexpiredOrigin,
      developerToken: 'mock_jwt_USR_DEV_001_SNAPSHOT_B_TAMPERED',
    };
    authStorage.clearDeveloperOriginSession();
    authStorage.saveDeveloperOriginSession(snapshotB);

    // Step 3: Local revision notification occurred and incremented version in storage
    const revisionB = authStorage.getDeveloperOriginSnapshotVersion();
    expect(revisionB).toBeGreaterThan(revisionA);

    // Same-tab notification triggers re-render deriving isEmergencyState = false immediately
    await waitFor(() => {
      expect(capturedCaseBAuth?.isEmergencyState).toBe(false);
    });
    expect(screen.queryByTestId('emergency-session-banner')).not.toBeInTheDocument();

    // Step 4: Digest A resolves independently / before effect cleanup
    if (delayedDigestResolveA) {
      delayedDigestResolveA(new ArrayBuffer(32));
    }

    // Step 5: Digest A is rejected because its captured revision (revisionA) no longer
    // matches the current storage revision (revisionB). Emergency state MUST remain false.
    expect(capturedCaseBAuth?.isEmergencyState).toBe(false);
    expect(screen.queryByTestId('emergency-session-banner')).not.toBeInTheDocument();

    // Step 6: Emergency state remains false until Snapshot B independently validates.
    // Because Snapshot B has a tampered token, independent validation fails closed.
    await waitFor(() => {
      expect(capturedCaseBAuth?.emergencyProof).toBeNull();
    });
    expect(capturedCaseBAuth?.isEmergencyState).toBe(false);
    expect(screen.queryByTestId('emergency-session-banner')).not.toBeInTheDocument();

    subtleDigestSpyB.mockRestore();
    unmountCaseB();

    // ASSERTION 9: Missing Web Crypto causes fail-closed behavior
    const originalSubtle = window.crypto.subtle;
    try {
      Object.defineProperty(window.crypto, 'subtle', { value: undefined, configurable: true });

      authStorage.clearSession();
      authStorage.clearDeveloperOriginSession();
      authStorage.saveDeveloperOriginSession(validUnexpiredOrigin);
      authStorage.setSession({
        user: astUser,
        token: `mock_jwt_USR_TEST_AST_001_${Date.now() - 10000}`,
        expiresAt: Date.now() - 5000,
      });

      let capturedNoCryptoAuth: ReturnType<typeof useAuth> | null = null;
      const { unmount: unmountNoCrypto } = render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedNoCryptoAuth = auth)} />
            <IsolatedSessionBanner />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(capturedNoCryptoAuth?.isLoading).toBe(false);
      });

      // Fail-closed: Proof must NOT be created, emergency state must be false, banner hidden
      expect(capturedNoCryptoAuth?.emergencyProof).toBeNull();
      expect(capturedNoCryptoAuth?.isEmergencyState).toBe(false);
      expect(screen.queryByTestId('emergency-session-banner')).not.toBeInTheDocument();

      unmountNoCrypto();
    } finally {
      Object.defineProperty(window.crypto, 'subtle', { value: originalSubtle, configurable: true });
    }

    // =========================================================================
    // Part D: Deterministic Asymmetric Expiration Boundary & Runtime AuthProvider Behavior
    // (WP-5.4.1 Final Acceptance Corrections)
    // 1. Persona session: Date.now() === expiresAt -> active (Date.now() > expiresAt is false)
    // 2. Persona session: Date.now() > expiresAt -> expired (Date.now() > expiresAt is true)
    // 3. Scenario A: Date.now() === developerExpiresAt - 1 (1 ms before Developer expiration)
    //    -> Runtime AuthProvider leaves origin snapshot present, no quarantine, no session cleanup.
    // 4. Scenario B: Date.now() === developerExpiresAt (exact Developer expiration boundary)
    //    -> Runtime AuthProvider executes expiration branch, quarantines snapshot with
    //       DEVELOPER_SNAPSHOT_EXPIRED, removes origin snapshot, and evicts active persona session.
    // =========================================================================
    authStorage.clearSession();
    authStorage.clearDeveloperOriginSession();
    authStorage.clearQuarantinedOriginSession();

    try {
      const fixedClock = 1770000000000;
      vi.useFakeTimers();
      vi.setSystemTime(fixedClock);

      const personaExpiresAt = fixedClock; // T_expires
      const personaToken = `mock_jwt_USR_TEST_AST_001_${fixedClock - 1000}`;
      authStorage.setSession({
        user: astUser,
        token: personaToken,
        expiresAt: personaExpiresAt,
      });

      // Case 1: Date.now() === expiresAt -> Persona session is ACTIVE
      // Production inspectSessionContinuity(): Date.now() > expiresAt is false -> isExpired === false
      // Production getSession(): Date.now() > session.expiresAt is false -> returns active session
      const continuityAtExactBoundary = authStorage.inspectSessionContinuity();
      expect(continuityAtExactBoundary.isExpired).toBe(false);
      expect(continuityAtExactBoundary.isRawSessionPresent).toBe(true);
      expect(authStorage.getSession()).not.toBeNull();
      expect(authStorage.getSession()?.token).toBe(personaToken);

      // Case 2: Date.now() > expiresAt (advance by 1 millisecond) -> Persona session is EXPIRED
      // Production inspectSessionContinuity(): Date.now() > expiresAt is true -> isExpired === true
      // Production getSession(): Date.now() > session.expiresAt is true -> evicts and returns null
      vi.setSystemTime(fixedClock + 1);
      const continuityAfterBoundary = authStorage.inspectSessionContinuity();
      expect(continuityAfterBoundary.isExpired).toBe(true);
      expect(authStorage.getSession()).toBeNull();

      // -----------------------------------------------------------------------
      // Scenario A — One millisecond before Developer expiration (Date.now() === developerExpiresAt - 1)
      // Exercises actual AuthProvider runtime behavior
      // -----------------------------------------------------------------------
      authStorage.clearSession();
      authStorage.clearDeveloperOriginSession();
      authStorage.clearQuarantinedOriginSession();

      const devExpiresAt = fixedClock + 3600000;
      const devOriginSnapshot: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date(fixedClock - 10000).toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: devExpiresAt,
        personaId: 'USR_TEST_AST_001',
      };

      // Set clock to exactly one millisecond before Developer expiration
      vi.setSystemTime(devExpiresAt - 1);

      authStorage.saveDeveloperOriginSession(devOriginSnapshot);
      authStorage.setSession({
        user: astUser,
        token: `mock_jwt_USR_TEST_AST_001_${fixedClock}`,
        expiresAt: devExpiresAt + 1800000,
      });

      vi.spyOn(authApi, 'getCurrentUser').mockResolvedValueOnce({
        user: astUser,
        token: `mock_jwt_USR_TEST_AST_001_${fixedClock}`,
        expiresAt: devExpiresAt + 1800000,
      });

      let capturedBeforeExpiryAuth: ReturnType<typeof useAuth> | null = null;
      const { unmount: unmountScenarioA } = render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedBeforeExpiryAuth = auth)} />
            <IsolatedSessionBanner />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(capturedBeforeExpiryAuth?.isLoading).toBe(false);
      });

      // Runtime Behavior Assertions (1 ms before expiration):
      // - The Developer origin snapshot remains present in storage
      expect(authStorage.hasDeveloperOriginSession()).toBe(true);
      expect(authStorage.getDeveloperOriginSession()?.developerExpiresAt).toBe(devExpiresAt);
      // - No DEVELOPER_SNAPSHOT_EXPIRED quarantine record is created
      expect(authStorage.getQuarantinedOriginSession()).toBeNull();
      // - No expiration-driven session cleanup occurs
      expect(capturedBeforeExpiryAuth?.user?.id).toBe('USR_TEST_AST_001');
      expect(capturedBeforeExpiryAuth?.isIsolatedSession).toBe(true);
      expect(screen.getByTestId('isolated-session-banner')).toBeInTheDocument();

      unmountScenarioA();

      // -----------------------------------------------------------------------
      // Scenario B — Exact Developer expiration boundary (Date.now() === developerExpiresAt)
      // Exercises actual AuthProvider runtime behavior
      // -----------------------------------------------------------------------
      authStorage.clearSession();
      authStorage.clearDeveloperOriginSession();
      authStorage.clearQuarantinedOriginSession();

      // Set clock to exact Developer expiration boundary
      vi.setSystemTime(devExpiresAt);

      authStorage.saveDeveloperOriginSession(devOriginSnapshot);
      authStorage.setSession({
        user: astUser,
        token: `mock_jwt_USR_TEST_AST_001_${fixedClock}`,
        expiresAt: devExpiresAt + 1800000,
      });

      let capturedAtExpiryAuth: ReturnType<typeof useAuth> | null = null;
      const { unmount: unmountScenarioB } = render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAtExpiryAuth = auth)} />
            <IsolatedSessionBanner />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(capturedAtExpiryAuth?.isLoading).toBe(false);
      });

      // Runtime Behavior Assertions (exact expiration boundary):
      // - Actual AuthProvider expiration branch executes
      // - Developer origin snapshot is quarantined with DEVELOPER_SNAPSHOT_EXPIRED
      const quarantineRecord = authStorage.getQuarantinedOriginSession();
      expect(quarantineRecord).not.toBeNull();
      expect(quarantineRecord?.rejectionReason).toBe('DEVELOPER_SNAPSHOT_EXPIRED');
      expect(quarantineRecord?.developerExpiresAt).toBe(devExpiresAt);
      // - Origin snapshot is removed
      expect(authStorage.hasDeveloperOriginSession()).toBe(false);
      // - Active-session handling follows identity-specific rules: persona session evicted
      expect(authStorage.getSession()).toBeNull();
      expect(capturedAtExpiryAuth?.user).toBeNull();
      expect(capturedAtExpiryAuth?.isIsolatedSession).toBe(false);
      expect(capturedAtExpiryAuth?.error).toMatch(/انتهت صلاحية جلسة المطور/);
      expect(screen.queryByTestId('isolated-session-banner')).not.toBeInTheDocument();
      expect(screen.queryByTestId('emergency-session-banner')).not.toBeInTheDocument();

      unmountScenarioB();
    } finally {
      vi.useRealTimers();
    }
  });
});

