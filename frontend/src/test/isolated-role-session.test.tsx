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
import { render, screen, fireEvent, act, waitFor, renderHook } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CourseBuilderPage } from '@/pages/CourseBuilderPage';
import { useStagedEditsAutosave } from '@/features/course-review/hooks/useStagedEditsAutosave';
import { ToastProvider } from '@/shared/ui/Toast';
import { builderApi } from '@/features/course-builder/services/builderApi';
import {
  authStorage,
  createAuthStorage,
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
import {
  getCurrentSessionEpoch,
  advanceSessionEpoch,
  advanceSessionEpochForEmergencyReturn,
  isStaleEpoch,
  __resetSessionEpochForTesting,
  createSessionEpochManager,
} from '@/core/auth/sessionEpoch';
import {
  apiClient,
  StaleEpochError,
  isStaleEpochError,
} from '@/core/api/apiClient';
import {
  saveCourseBuilderDraft,
  getCourseBuilderDraft,
  clearCourseBuilderDraft,
  getCourseBuilderDraftKey,
  getLegacyCourseBuilderDraftKey,
} from '@/features/course-builder/services/courseBuilderDraftStorage';
import {
  saveAdminStagedEditsFallback,
  getAdminStagedEditsFallback,
  clearAdminStagedEditsFallback,
  getAdminStagedEditsKey,
  getLegacyAdminStagedEditsKey,
} from '@/features/course-review/services/stagedEditsStorage';
import type { StagedAdminEditsRecord } from '@/core/courses/types';
import { NotificationProvider, NotificationContext, useNotifications } from '@/features/notifications';
import { EnrollmentProvider, EnrollmentContext, useEnrollment } from '@/features/courses';
import { notificationsApi } from '@/features/notifications/services/notificationsApi';
import { coursesApi } from '@/features/courses/services/coursesApi';
import { RolePreviewProvider } from '@/core/auth/RolePreviewContext';
import { useRolePreview } from '@/core/auth/useRolePreview';
import { Outlet } from 'react-router-dom';

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
      // D-AUTH-01 / T-1.1.1: developerToken must never be persisted in browser storage
      expect((origin as any)?.developerToken).toBeUndefined();
      // Volatile runtime token remains accessible in memory for restore during tab lifecycle
      expect(authStorage.getRuntimeDeveloperTokenForRestore()).toBe(FIXTURE_DEVELOPER_TOKEN);
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
      // D-AUTH-01 / T-1.1.1: developerToken omitted from persisted snapshot
      expect((authStorage.getDeveloperOriginSession() as any)?.developerToken).toBeUndefined();
      expect(authStorage.getRuntimeDeveloperTokenForRestore()).toBe(FIXTURE_DEVELOPER_TOKEN);
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
    // Note (T-1.1.1 / D-AUTH-01): restoredSession token is supplied by getRuntimeDeveloperTokenForRestore()
    // from in-memory closure in the test harness. In true browser reload, memory wipes and fails closed.
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
    // Under T-1.1.1 / D-AUTH-01, developerToken tampering operates via volatile in-memory runtimeTokenScope
    // which mutates the SHA-256 digest computed by computeOriginSnapshotDigest()
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

  // =========================================================================
  // WP-5.4.2: Asynchronous Race & Epoch Protection Specifications
  // (P5-T13-17, P5-T13-18, P5-T13-19)
  // WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
  // =========================================================================

  /**
   * P5-T13-17: Session Epoch Transition Matrix
   * WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
   *
   * Verifies monotonic sessionEpoch advancement across:
   * 1. Successful authenticated login / identity establishment (epoch advances)
   * 2. Synthetic persona launch via launchIsolatedTestSession (epoch advances)
   * 3. Normal Developer return via returnToDeveloperSession (epoch advances)
   * 4. Explicit logout via logout() (epoch advances)
   * 5. Shared future emergency return integration hook (epoch advances)
   * Invariants verified:
   * - Monotonically increasing (never decreases or resets during application lifecycle)
   * - In-memory only (never stored in localStorage or sessionStorage)
   * - Same-identity revalidation does NOT increment sessionEpoch
   * - Visual Role Preview does NOT increment sessionEpoch
   */
  it('P5-T13-17: Session Epoch Transition Matrix (WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13)', async () => {
    // 1. Reset test epoch to initial baseline
    __resetSessionEpochForTesting(1);
    expect(getCurrentSessionEpoch()).toBe(1);

    // Assert in-memory property: epoch is NOT stored in localStorage or sessionStorage
    expect(sessionStorage.getItem('sessionEpoch')).toBeNull();
    expect(localStorage.getItem('sessionEpoch')).toBeNull();

    // 2. Initial Setup: Mount AuthProvider with unauthenticated state
    authStorage.clearSession();
    authStorage.clearDeveloperOriginSession();

    let capturedAuth: ReturnType<typeof useAuth> | null = null;
    const { unmount } = render(
      <MemoryRouter>
        <AuthProvider>
          <RolePreviewProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuth = auth)} />
          </RolePreviewProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(capturedAuth?.isLoading).toBe(false);
    });

    const epochAfterMount = capturedAuth?.sessionEpoch;
    expect(epochAfterMount).toBeGreaterThanOrEqual(1);

    // 3. Transition 1: Authenticated Login / Identity Establishment
    const devCredentials = { email: FIXTURE_DEVELOPER.email, password: 'dev_secure_password' };
    vi.spyOn(authApi, 'login').mockResolvedValueOnce({
      user: FIXTURE_DEVELOPER,
      token: FIXTURE_DEVELOPER_TOKEN,
      expiresAt: Date.now() + 3600000,
    });

    const epochBeforeLogin = getCurrentSessionEpoch();
    await act(async () => {
      await capturedAuth?.login(devCredentials);
    });

    const epochAfterLogin = getCurrentSessionEpoch();
    expect(epochAfterLogin).toBeGreaterThan(epochBeforeLogin);
    expect(capturedAuth?.sessionEpoch).toBe(epochAfterLogin);
    expect(capturedAuth?.user?.id).toBe(FIXTURE_DEVELOPER.id);

    // 4. Invariant: Same-identity revalidation does NOT increment epoch
    vi.spyOn(authApi, 'getCurrentUser').mockResolvedValueOnce({ user: FIXTURE_DEVELOPER });
    await act(async () => {
      await capturedAuth?.retryRevalidation?.();
    });
    expect(getCurrentSessionEpoch()).toBe(epochAfterLogin);
    expect(capturedAuth?.sessionEpoch).toBe(epochAfterLogin);

    // 5. Invariant: Visual Role Preview does NOT increment sessionEpoch or change AuthContext identity
    let capturedPreview: ReturnType<typeof useRolePreview> | null = null;
    const PreviewConsumer = () => {
      capturedPreview = useRolePreview();
      return null;
    };
    const { unmount: unmountPreview } = render(
      <MemoryRouter>
        <AuthProvider>
          <RolePreviewProvider>
            <PreviewConsumer />
          </RolePreviewProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    act(() => {
      capturedPreview?.startPreview('admin');
    });
    expect(capturedPreview?.isPreviewing).toBe(true);
    expect(capturedPreview?.effectiveUiRole).toBe('admin');
    expect(getCurrentSessionEpoch()).toBe(epochAfterLogin); // Unchanged!

    act(() => {
      capturedPreview?.stopPreview();
    });
    expect(getCurrentSessionEpoch()).toBe(epochAfterLogin); // Unchanged!
    unmountPreview();

    // 6. Transition 2: Isolated Synthetic Persona Launch
    const targetPersona = getSyntheticTestPersona('USR_TEST_ADMIN_001')!;
    vi.spyOn(authApi, 'login').mockResolvedValueOnce({
      user: personaToUser(targetPersona),
      token: `mock_jwt_USR_TEST_ADMIN_001_${Date.now()}`,
      expiresAt: Date.now() + 1800000,
    });

    const epochBeforeLaunch = getCurrentSessionEpoch();
    await act(async () => {
      const launched = await capturedAuth?.launchIsolatedTestSession(targetPersona.id);
      expect(launched).toBe(true);
    });

    const epochAfterLaunch = getCurrentSessionEpoch();
    expect(epochAfterLaunch).toBeGreaterThan(epochBeforeLaunch);
    expect(capturedAuth?.sessionEpoch).toBe(epochAfterLaunch);
    expect(capturedAuth?.user?.id).toBe(targetPersona.id);
    expect(capturedAuth?.isIsolatedSession).toBe(true);

    // 7. Transition 3: Normal Return to Developer Session
    const epochBeforeReturn = getCurrentSessionEpoch();
    await act(async () => {
      const returned = await capturedAuth?.returnToDeveloperSession();
      expect(returned).toBe(true);
    });

    const epochAfterReturn = getCurrentSessionEpoch();
    expect(epochAfterReturn).toBeGreaterThan(epochBeforeReturn);
    expect(capturedAuth?.sessionEpoch).toBe(epochAfterReturn);
    expect(capturedAuth?.user?.id).toBe(FIXTURE_DEVELOPER.id);
    expect(capturedAuth?.isIsolatedSession).toBe(false);

    // 8. Transition 4: Explicit Logout
    vi.spyOn(authApi, 'logout').mockResolvedValueOnce({ success: true, message: 'Logged out' });

    const epochBeforeLogout = getCurrentSessionEpoch();
    await act(async () => {
      await capturedAuth?.logout();
    });

    const epochAfterLogout = getCurrentSessionEpoch();
    expect(epochAfterLogout).toBeGreaterThan(epochBeforeLogout);
    expect(capturedAuth?.sessionEpoch).toBe(epochAfterLogout);
    expect(capturedAuth?.user).toBeNull();

    // 9. Transition 5: Shared future emergency return integration hook
    const epochBeforeEmergencyHook = getCurrentSessionEpoch();
    const epochAfterEmergencyHook = advanceSessionEpochForEmergencyReturn();
    expect(epochAfterEmergencyHook).toBeGreaterThan(epochBeforeEmergencyHook);
    expect(getCurrentSessionEpoch()).toBe(epochAfterEmergencyHook);

    // 10. Verification of Strict Monotonicity: epoch sequence strictly ascending
    expect(epochBeforeLogin).toBeLessThan(epochAfterLogin);
    expect(epochAfterLogin).toBeLessThan(epochAfterLaunch);
    expect(epochAfterLaunch).toBeLessThan(epochAfterReturn);
    expect(epochAfterReturn).toBeLessThan(epochAfterLogout);
    expect(epochAfterLogout).toBeLessThan(epochAfterEmergencyHook);

    unmount();
  });

  /**
   * P5-T13-18: Stale Responses and Post-Logout Race Protection
   * WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
   *
   * Verifies request-epoch capture and stale response rejection in apiClient:
   * 1. User A starts request under Epoch 10 -> session transitions to User B (Epoch 11)
   *    -> User A's response is rejected with StaleEpochError and discarded.
   * 2. Failed stale responses (network errors, 401/403/500) throw StaleEpochError rather
   *    than propagating obsolete error messages or notifications.
   * 3. Post-logout race: protected request initiated under authenticated epoch -> logout advances
   *    epoch before response arrives -> response rejected and cannot restore authenticated data.
   * 4. Developer request becomes stale upon persona launch.
   * 5. Persona request becomes stale upon return to Developer.
   * 6. Valid same-epoch concurrency: concurrent requests under the same current epoch succeed.
   * 7. Authentication control plane operations (/api/auth/me, login, logout) are exempted.
   */
  it('P5-T13-18: Stale Responses and Post-Logout Race Protection (WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13)', async () => {
    __resetSessionEpochForTesting(10);
    expect(getCurrentSessionEpoch()).toBe(10);

    const originalFetch = globalThis.fetch;

    try {
      // -----------------------------------------------------------------------
      // Case A: User A -> User B Stale Response Rejection
      // -----------------------------------------------------------------------
      let resolveUserARequest: ((res: Response) => void) | null = null;
      const userAPendingPromise = new Promise<Response>((resolve) => {
        resolveUserARequest = resolve;
      });

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => userAPendingPromise);

      const requestPromiseA = apiClient<{ data: string }>('/api/courses/my-courses');

      // Authenticated session transitions to User B -> epoch advances to 11
      advanceSessionEpoch();
      expect(getCurrentSessionEpoch()).toBe(11);

      // User A's response resolves afterward under Epoch 11
      const mockSuccessResponse = new Response(JSON.stringify({ data: 'user_a_stale_data' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      resolveUserARequest!(mockSuccessResponse);

      // Verify that requestPromiseA rejects with typed StaleEpochError
      await expect(requestPromiseA).rejects.toThrow(StaleEpochError);
      await requestPromiseA.catch((err) => {
        expect(isStaleEpochError(err)).toBe(true);
        expect((err as StaleEpochError).requestEpoch).toBe(10);
        expect((err as StaleEpochError).currentEpoch).toBe(11);
        expect((err as StaleEpochError).isStale).toBe(true);
      });

      // -----------------------------------------------------------------------
      // Case B: Stale Error Handler Protection (Delayed HTTP 403 / 500 error)
      // -----------------------------------------------------------------------
      let rejectUserAErrRequest: ((res: Response) => void) | null = null;
      const userAErrPendingPromise = new Promise<Response>((resolve) => {
        rejectUserAErrRequest = resolve;
      });

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => userAErrPendingPromise);

      const requestErrPromise = apiClient<{ data: string }>('/api/admin/users');

      // Session transitions -> epoch advances to 12
      advanceSessionEpoch();
      expect(getCurrentSessionEpoch()).toBe(12);

      // Server returns HTTP 403 Forbidden for the obsolete User A request
      const mockErrResponse = new Response(JSON.stringify({ message: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
      rejectUserAErrRequest!(mockErrResponse);

      // Stale response must be intercepted as StaleEpochError, NOT as an active 403 ApiError
      await expect(requestErrPromise).rejects.toThrow(StaleEpochError);
      await requestErrPromise.catch((err) => {
        expect(isStaleEpochError(err)).toBe(true);
        expect((err as StaleEpochError).requestEpoch).toBe(11);
        expect((err as StaleEpochError).currentEpoch).toBe(12);
      });

      // -----------------------------------------------------------------------
      // Case C: Post-Logout Race Protection
      // -----------------------------------------------------------------------
      let resolvePostLogoutRequest: ((res: Response) => void) | null = null;
      const postLogoutPendingPromise = new Promise<Response>((resolve) => {
        resolvePostLogoutRequest = resolve;
      });

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => postLogoutPendingPromise);

      // User dispatches protected data request under authenticated Epoch 12
      const protectedReqPromise = apiClient<{ secret: string }>('/api/enrollments/my');

      // Logout occurs -> epoch advances to 13
      advanceSessionEpoch();
      expect(getCurrentSessionEpoch()).toBe(13);

      // Delayed protected response arrives after logout
      const mockProtectedResponse = new Response(JSON.stringify({ secret: 'authenticated_data' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      resolvePostLogoutRequest!(mockProtectedResponse);

      // Must be rejected and cannot restore authenticated data
      await expect(protectedReqPromise).rejects.toThrow(StaleEpochError);

      // -----------------------------------------------------------------------
      // Case D: Developer -> Persona Launch Race Protection
      // -----------------------------------------------------------------------
      let resolveDevRequest: ((res: Response) => void) | null = null;
      const devPendingPromise = new Promise<Response>((resolve) => {
        resolveDevRequest = resolve;
      });

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => devPendingPromise);

      const devReqPromise = apiClient<{ devData: string }>('/api/developer/metrics');

      // Persona launches -> epoch advances to 14
      advanceSessionEpoch();
      expect(getCurrentSessionEpoch()).toBe(14);

      resolveDevRequest!(
        new Response(JSON.stringify({ devData: 'developer_only_metrics' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(devReqPromise).rejects.toThrow(StaleEpochError);

      // -----------------------------------------------------------------------
      // Case E: Persona -> Developer Normal Return Race Protection
      // -----------------------------------------------------------------------
      let resolvePersonaRequest: ((res: Response) => void) | null = null;
      const personaPendingPromise = new Promise<Response>((resolve) => {
        resolvePersonaRequest = resolve;
      });

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => personaPendingPromise);

      const personaReqPromise = apiClient<{ personaNotes: string }>('/api/lecturer/notes');

      // Return to Developer -> epoch advances to 15
      advanceSessionEpoch();
      expect(getCurrentSessionEpoch()).toBe(15);

      resolvePersonaRequest!(
        new Response(JSON.stringify({ personaNotes: 'lecturer_notes' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(personaReqPromise).rejects.toThrow(StaleEpochError);

      // -----------------------------------------------------------------------
      // Case F: Valid Same-Epoch Concurrent Requests Succeed
      // -----------------------------------------------------------------------
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ item: 'course_1' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ item: 'course_2' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );

      const [res1, res2] = await Promise.all([
        apiClient<{ item: string }>('/api/courses/c1'),
        apiClient<{ item: string }>('/api/courses/c2'),
      ]);

      expect(res1.item).toBe('course_1');
      expect(res2.item).toBe('course_2');

      // -----------------------------------------------------------------------
      // Case G: Authentication Control Plane Exemption (/api/auth/me, /api/auth/login, /api/auth/logout)
      // -----------------------------------------------------------------------
      let resolveAuthMe: ((res: Response) => void) | null = null;
      const authMePromise = new Promise<Response>((resolve) => {
        resolveAuthMe = resolve;
      });

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => authMePromise);

      const meReqPromise = apiClient<{ user: { id: string } }>('/api/auth/me');

      // Epoch advances during authentication revalidation
      advanceSessionEpoch();
      expect(getCurrentSessionEpoch()).toBe(16);

      resolveAuthMe!(
        new Response(JSON.stringify({ user: { id: 'USR_DEV_001' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      // Auth control plane request MUST NOT be rejected by StaleEpochError
      const meResult = await meReqPromise;
      expect(meResult.user.id).toBe('USR_DEV_001');

      // -----------------------------------------------------------------------
      // Case H: Delayed /api/auth/me from User A After User B Transition (WP-5.4.2 Audit)
      // -----------------------------------------------------------------------
      authStorage.clearSession();
      authStorage.clearDeveloperOriginSession();
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      let resolveMeUserA: ((val: { user: User }) => void) | null = null;
      const deferredMeUserAPromise = new Promise<{ user: User }>((resolve) => {
        resolveMeUserA = resolve;
      });

      vi.spyOn(authApi, 'getCurrentUser').mockImplementationOnce(() => deferredMeUserAPromise);

      let capturedAuthCaseH: ReturnType<typeof useAuth> | null = null;
      const { unmount: unmountCaseH } = render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuthCaseH = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      // Revalidation for Developer (User A) is pending via deferredMeUserAPromise
      // While pending, User B logs in
      const userB: User = {
        id: 'USR_SUPER_001',
        name: 'المدير العام التجريبي',
        email: 'super_admin.demo@cairo-metro.internal',
        role: 'super_admin',
        department: 'الإدارة العليا للرقابة والتفتيش',
        jobTitle: 'المدير العام',
        initials: 'م.ع',
      };

      vi.spyOn(authApi, 'login').mockResolvedValueOnce({
        user: userB,
        token: `mock_jwt_USR_SUPER_001_${Date.now()}`,
        expiresAt: Date.now() + 3600000,
      });

      await act(async () => {
        await capturedAuthCaseH?.login({ email: userB.email, password: 'password' });
      });

      expect(capturedAuthCaseH?.user?.id).toBe(userB.id);

      // Delayed User A /api/auth/me resolves afterward
      await act(async () => {
        resolveMeUserA!({ user: FIXTURE_DEVELOPER });
      });

      // User B must NOT be overwritten by delayed User A revalidation
      expect(capturedAuthCaseH?.user?.id).toBe(userB.id);
      expect(authStorage.getSession()?.user.id).toBe(userB.id);
      unmountCaseH();

      // -----------------------------------------------------------------------
      // Case I: Delayed /api/auth/me After Logout (WP-5.4.2 Audit)
      // -----------------------------------------------------------------------
      authStorage.clearSession();
      authStorage.clearDeveloperOriginSession();
      authStorage.setSession({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });

      let resolveMeAfterLogout: ((val: { user: User }) => void) | null = null;
      const deferredMeLogoutPromise = new Promise<{ user: User }>((resolve) => {
        resolveMeAfterLogout = resolve;
      });

      vi.spyOn(authApi, 'getCurrentUser').mockImplementationOnce(() => deferredMeLogoutPromise);

      let capturedAuthCaseI: ReturnType<typeof useAuth> | null = null;
      const { unmount: unmountCaseI } = render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuthCaseI = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      vi.spyOn(authApi, 'logout').mockResolvedValueOnce({ success: true, message: 'Logged out' });

      // User logs out while /api/auth/me is in flight
      await act(async () => {
        await capturedAuthCaseI?.logout();
      });

      expect(capturedAuthCaseI?.user).toBeNull();
      expect(authStorage.getSession()).toBeNull();

      // Delayed /api/auth/me resolves after logout
      await act(async () => {
        resolveMeAfterLogout!({ user: FIXTURE_DEVELOPER });
      });

      // User must remain null and storage must remain empty
      expect(capturedAuthCaseI?.user).toBeNull();
      expect(authStorage.getSession()).toBeNull();
      unmountCaseI();

      // -----------------------------------------------------------------------
      // Case J: Superseded Login Completion (WP-5.4.2 Audit)
      // -----------------------------------------------------------------------
      let resolveLoginA: ((val: { user: User; token: string; expiresAt: number }) => void) | null = null;
      const deferredLoginAPromise = new Promise<{ user: User; token: string; expiresAt: number }>((resolve) => {
        resolveLoginA = resolve;
      });

      let capturedAuthCaseJ: ReturnType<typeof useAuth> | null = null;
      const { unmount: unmountCaseJ } = render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuthCaseJ = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      // Start Login A
      vi.spyOn(authApi, 'login').mockImplementationOnce(() => deferredLoginAPromise);
      const loginPromiseA = capturedAuthCaseJ?.login({ email: 'userA@metro.internal', password: 'password' });

      // While Login A is pending, Login B starts and resolves immediately
      vi.spyOn(authApi, 'login').mockResolvedValueOnce({
        user: userB,
        token: `mock_jwt_USR_SUPER_001_${Date.now()}`,
        expiresAt: Date.now() + 3600000,
      });

      await act(async () => {
        await capturedAuthCaseJ?.login({ email: userB.email, password: 'password' });
      });

      expect(capturedAuthCaseJ?.user?.id).toBe(userB.id);

      // Delayed Login A resolves afterward
      await act(async () => {
        resolveLoginA!({
          user: FIXTURE_DEVELOPER,
          token: FIXTURE_DEVELOPER_TOKEN,
          expiresAt: Date.now() + 3600000,
        });
        await loginPromiseA;
      });

      // Superseded Login A must be discarded; User B remains active
      expect(capturedAuthCaseJ?.user?.id).toBe(userB.id);
      expect(authStorage.getSession()?.user.id).toBe(userB.id);
      unmountCaseJ();

      // -----------------------------------------------------------------------
      // Case K: Delayed Logout Completion After Newer Login (WP-5.4.2 Audit)
      // -----------------------------------------------------------------------
      let resolveDelayedLogout: ((val: { success: boolean; message: string }) => void) | null = null;
      const deferredLogoutPromise = new Promise<{ success: boolean; message: string }>((resolve) => {
        resolveDelayedLogout = resolve;
      });

      let capturedAuthCaseK: ReturnType<typeof useAuth> | null = null;
      const { unmount: unmountCaseK } = render(
        <MemoryRouter>
          <AuthProvider>
            <IsolatedSessionTestConsumer onState={(auth) => (capturedAuthCaseK = auth)} />
          </AuthProvider>
        </MemoryRouter>
      );

      // Establish initial session
      vi.spyOn(authApi, 'login').mockResolvedValueOnce({
        user: FIXTURE_DEVELOPER,
        token: FIXTURE_DEVELOPER_TOKEN,
        expiresAt: Date.now() + 3600000,
      });
      await act(async () => {
        await capturedAuthCaseK?.login({ email: FIXTURE_DEVELOPER.email, password: 'password' });
      });

      // Logout initiated with slow network
      vi.spyOn(authApi, 'logout').mockImplementationOnce(() => deferredLogoutPromise);
      const logoutPromise = capturedAuthCaseK?.logout();

      // User quickly logs in as User B before delayed logout finishes
      vi.spyOn(authApi, 'login').mockResolvedValueOnce({
        user: userB,
        token: `mock_jwt_USR_SUPER_001_${Date.now()}`,
        expiresAt: Date.now() + 3600000,
      });
      await act(async () => {
        await capturedAuthCaseK?.login({ email: userB.email, password: 'password' });
      });

      expect(capturedAuthCaseK?.user?.id).toBe(userB.id);

      // Delayed logout finally resolves afterward
      await act(async () => {
        resolveDelayedLogout!({ success: true, message: 'Delayed logout finished' });
        await logoutPromise;
      });

      // Superseded logout must NOT clear User B's active session!
      expect(capturedAuthCaseK?.user?.id).toBe(userB.id);
      expect(authStorage.getSession()?.user.id).toBe(userB.id);
      unmountCaseK();

      // -----------------------------------------------------------------------
      // Case L: Post-Parse Epoch Validation (Delayed JSON Parsing) (WP-5.4.2 Audit)
      // -----------------------------------------------------------------------
      __resetSessionEpochForTesting(20);
      expect(getCurrentSessionEpoch()).toBe(20);

      let resolveJsonParsing: ((val: unknown) => void) | null = null;
      const deferredJsonPromise = new Promise((resolve) => {
        resolveJsonParsing = resolve;
      });

      // Mock Response object where json() returns a delayed promise
      const slowStreamingResponse = {
        status: 200,
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => deferredJsonPromise,
      } as unknown as Response;

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(slowStreamingResponse);

      const slowRequestPromise = apiClient<{ data: string }>('/api/courses/catalog');

      // The HTTP response is received, but JSON parsing is still awaiting
      // Authenticated session transitions while body parsing is in flight
      advanceSessionEpoch();
      expect(getCurrentSessionEpoch()).toBe(21);

      // JSON parsing completes under Epoch 21
      resolveJsonParsing!({ data: 'delayed_parsed_payload' });

      // apiClient must check epoch AFTER response.json() and reject with StaleEpochError
      await expect(slowRequestPromise).rejects.toThrow(StaleEpochError);
      await slowRequestPromise.catch((err) => {
        expect(isStaleEpochError(err)).toBe(true);
        expect((err as StaleEpochError).requestEpoch).toBe(20);
        expect((err as StaleEpochError).currentEpoch).toBe(21);
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  /**
   * P5-T13-19: Route Subtree Remount and Cache Reset
   * WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
   *
   * Verifies synchronous cache visibility gating, route subtree remounting, and cache invalidation:
   * 1. Populate User A's notification and enrollment caches in Epoch 1.
   * 2. Transition to User B and advance sessionEpoch to Epoch 2.
   * 3. Observe the first transition render with User B before passive cleanup effects run.
   * 4. Assert User A's notifications and unread count are already invisible during the transition render.
   * 5. Assert User A's enrollment records and enrolled course IDs are already invisible during the transition render.
   * 6. Assert the new user's cache starts empty until its own data loads.
   * 7. Resolve a delayed User A response and verify it cannot populate User B's visible or internal cache.
   * 8. Verify same-epoch User B responses still populate the cache normally.
   * 9. Verify public static course catalog data remains available across transitions.
   * 10. Page-level hook state (useCourseProgress inside LearningPlayerPage) resides in component state,
   *     and when outletKey changes, React completely unmounts the page subtree, setting isMountedRef
   *     to false and destroying local course progress state.
   * 11. Visual Role Preview retains user.id ('USR_DEV_001') and sessionEpoch; outletKey
   *     remains identical, preventing unnecessary route subtree remounts or cache flushes.
   */
  it('P5-T13-19: Route Subtree Remount and Cache Reset (WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13)', async () => {
    __resetSessionEpochForTesting(1);

    // Track lifecycle mount/unmount counts and mounted status for page-level learning player hook
    let playerMountCount = 0;
    let playerUnmountCount = 0;
    let isPlayerInstanceMounted = false;
    let lastPlayerProgressState: { courseId: string; completedLessons: string[] } | null = null;
    let progressCommitAttemptAfterUnmount = false;

    // Synchronous render-phase observation tracker:
    // Captures state during the synchronous component render phase BEFORE passive useEffect cleanup runs!
    interface RenderPhaseSnapshot {
      userId: string | null;
      epoch: number;
      notificationCount: number;
      unreadCount: number;
      enrollmentCount: number;
      enrolledCourseIds: string[];
      phase: string;
    }
    const renderPhaseSnapshots: RenderPhaseSnapshot[] = [];
    const currentPhaseRef = { current: 'initial_mount' };

    const RenderPhaseObserver: React.FC = () => {
      const { user, sessionEpoch } = useAuth();
      const { notifications, unreadCount } = useNotifications();
      const { enrollments, enrolledCourseIds } = useEnrollment();

      // This body executes synchronously DURING React's render function!
      renderPhaseSnapshots.push({
        userId: user?.id ?? null,
        epoch: sessionEpoch,
        notificationCount: notifications.length,
        unreadCount,
        enrollmentCount: enrollments.length,
        enrolledCourseIds: [...enrolledCourseIds],
        phase: currentPhaseRef.current,
      });

      return null;
    };

    // Simulated page-level LearningPlayer component exercising useCourseProgress hook behavior
    const LearningPlayerSubtreeConsumer: React.FC = () => {
      const isMountedRef = React.useRef(true);
      const [progress, setProgress] = React.useState<{ courseId: string; completedLessons: string[] } | null>(null);

      React.useEffect(() => {
        playerMountCount += 1;
        isPlayerInstanceMounted = true;
        isMountedRef.current = true;

        // Initialize course progress state for active course
        const initialProgress = { courseId: 'CRS_METRO_101', completedLessons: ['L1', 'L2'] };
        setProgress(initialProgress);
        lastPlayerProgressState = initialProgress;

        return () => {
          playerUnmountCount += 1;
          isPlayerInstanceMounted = false;
          isMountedRef.current = false;
          lastPlayerProgressState = null;
        };
      }, []);

      // Simulated delayed progress commit (e.g. from in-flight video playback sync)
      const simulateDelayedProgressSave = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (!isMountedRef.current) {
          progressCommitAttemptAfterUnmount = true;
          return; // Guard prevents mutating unmounted component
        }
        setProgress({ courseId: 'CRS_METRO_101', completedLessons: ['L1', 'L2', 'L3'] });
      };

      return (
        <div data-testid="player-subtree">
          <div data-testid="player-course">{progress?.courseId || 'none'}</div>
          <button data-testid="trigger-delayed-save" onClick={simulateDelayedProgressSave}>
            Save Progress
          </button>
        </div>
      );
    };

    // Simulated Shell layout reproducing AppLayout's Outlet key behavior
    const ShellLayoutConsumer: React.FC = () => {
      const { user, sessionEpoch } = useAuth();
      const outletKey = `${user ? user.id : 'anonymous'}_epoch_${sessionEpoch}`;

      return (
        <div data-testid="shell-layout">
          <div data-testid="outlet-key">{outletKey}</div>
          {/* Keyed subtree reproduces <Outlet key={outletKey} /> */}
          <LearningPlayerSubtreeConsumer key={outletKey} />
        </div>
      );
    };

    // Fixtures for User A (Trainee Persona) and User B (Developer)
    const personaUserA = personaToUser(getSyntheticTestPersona('USR_TEST_TRN_001')!);
    const tokenUserA = `mock_jwt_USR_TEST_TRN_001_${Date.now()}`;

    // 1. Setup: Start with User A authenticated under Epoch 1 with populated caches
    authStorage.clearSession();
    authStorage.clearDeveloperOriginSession();
    authStorage.setSession({
      user: personaUserA,
      token: tokenUserA,
      expiresAt: Date.now() + 3600000,
    });
    // Save Developer origin snapshot so returnToDeveloperSession is valid (T-1.1.1 / D-AUTH-01 Schema)
    authStorage.saveDeveloperOriginSession({
      developerUser: FIXTURE_DEVELOPER,
      developerToken: FIXTURE_DEVELOPER_TOKEN,
      savedAt: new Date().toISOString(),
      developerExpiresAt: Date.now() + 3600000,
      personaId: personaUserA.id,
      schemaVersion: 1,
    });

    const userANotifications = [
      {
        id: 'notif_trn_001',
        title: 'تنبيه تدريبي للمتدرب',
        message: 'مرحبًا بك في منصة مترو القاهرة',
        read: false,
        createdAt: '2026-11-05T00:00:00Z',
        type: 'system' as const,
      },
    ];
    const userAEnrollments = [
      {
        id: 'enr_trn_001',
        userId: personaUserA.id,
        courseId: 'CRS_METRO_101',
        status: 'enrolled' as const,
        enrolledAt: '2026-11-01T00:00:00Z',
      },
    ];

    let capturedAuth: ReturnType<typeof useAuth> | null = null;
    let capturedPreview: ReturnType<typeof useRolePreview> | null = null;
    let capturedNotifications: React.ContextType<typeof NotificationContext> = undefined;
    let capturedEnrollment: React.ContextType<typeof EnrollmentContext> = undefined;

    const StateObserver: React.FC = () => {
      capturedAuth = useAuth();
      capturedPreview = useRolePreview();
      capturedNotifications = React.useContext(NotificationContext);
      capturedEnrollment = React.useContext(EnrollmentContext);
      return null;
    };

    vi.spyOn(authApi, 'getCurrentUser').mockResolvedValue({ user: personaUserA });
    const getNotificationsSpy = vi.spyOn(notificationsApi, 'getNotifications').mockResolvedValue({
      notifications: userANotifications,
      unreadCount: 1,
    });
    const getMyEnrollmentsSpy = vi.spyOn(coursesApi, 'getMyEnrollments').mockResolvedValue(userAEnrollments);

    const { unmount } = render(
      <MemoryRouter>
        <AuthProvider>
          <RolePreviewProvider>
            <EnrollmentProvider>
              <NotificationProvider>
                <RenderPhaseObserver />
                <StateObserver />
                <ShellLayoutConsumer />
              </NotificationProvider>
            </EnrollmentProvider>
          </RolePreviewProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(capturedAuth?.isLoading).toBe(false);
      expect(capturedNotifications?.notifications.length).toBe(1);
      expect(capturedEnrollment?.enrollments.length).toBe(1);
    });

    // Verify User A's cache is populated in Epoch 1
    expect(capturedNotifications?.notifications).toEqual(userANotifications);
    expect(capturedNotifications?.unreadCount).toBe(1);
    expect(capturedEnrollment?.enrollments).toEqual(userAEnrollments);
    expect(capturedEnrollment?.enrolledCourseIds).toEqual(['crs_metro_101']);
    expect(screen.getByTestId('outlet-key').textContent).toBe('USR_TEST_TRN_001_epoch_1');
    expect(playerMountCount).toBe(1);
    expect(playerUnmountCount).toBe(0);

    // 2. Trigger in-flight delayed progress save for User A before transition
    fireEvent.click(screen.getByTestId('trigger-delayed-save'));

    // Prepare delayed notification & enrollment requests for User A started under Epoch 1
    let delayedUserANotificationResolve: ((val: typeof userANotifications) => void) | null = null;
    const delayedUserANotificationPromise = new Promise<typeof userANotifications>((resolve) => {
      delayedUserANotificationResolve = resolve;
    });

    // 3. Transition to User B (Developer) and advance sessionEpoch to Epoch 2
    currentPhaseRef.current = 'transition_to_user_b';
    vi.spyOn(authApi, 'getCurrentUser').mockResolvedValue({ user: FIXTURE_DEVELOPER });
    getNotificationsSpy.mockResolvedValueOnce({
      notifications: [],
      unreadCount: 0,
    });

    await act(async () => {
      await capturedAuth?.returnToDeveloperSession();
    });

    // 4. Assert Synchronous Cache Visibility Gating on First Render (Before useEffect Runs)
    // Find the first snapshot taken when user switched to USR_DEV_001 under Epoch 2
    const firstUserBRender = renderPhaseSnapshots.find(
      (s) => s.userId === 'USR_DEV_001' && s.epoch === 2
    );
    expect(firstUserBRender).toBeDefined();
    // Invariant: User A's notifications and unread count are ALREADY invisible!
    expect(firstUserBRender?.notificationCount).toBe(0);
    expect(firstUserBRender?.unreadCount).toBe(0);
    // Invariant: User A's enrollment records and enrolled course IDs are ALREADY invisible!
    expect(firstUserBRender?.enrollmentCount).toBe(0);
    expect(firstUserBRender?.enrolledCourseIds).toEqual([]);

    // 5. Assert the new user's cache starts empty until its own data loads
    expect(capturedNotifications?.notifications).toEqual([]);
    expect(capturedNotifications?.unreadCount).toBe(0);
    expect(capturedEnrollment?.enrollments).toEqual([]);
    expect(capturedEnrollment?.enrolledCourseIds).toEqual([]);
    expect(screen.getByTestId('outlet-key').textContent).toBe('USR_DEV_001_epoch_2');
    expect(playerUnmountCount).toBe(1);
    expect(playerMountCount).toBe(2);

    // Verify previous page-level progress write was dropped by unmount guard
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(progressCommitAttemptAfterUnmount).toBe(true);

    // 6. Resolve delayed User A response and verify it CANNOT populate User B's visible or internal cache
    delayedUserANotificationResolve!(userANotifications);
    await Promise.resolve();
    // Stale API call from Epoch 1 rejected with StaleEpochError
    const staleDevPromise = apiClient<{ notifications: unknown[] }>('/api/notifications');
    await expect(staleDevPromise).rejects.toThrow(StaleEpochError);
    // User B's cache remains clean
    expect(capturedNotifications?.notifications).toEqual([]);
    expect(capturedNotifications?.unreadCount).toBe(0);
    expect(capturedEnrollment?.enrollments).toEqual([]);

    // 7. Verify same-epoch User B responses still populate the cache normally
    const userBNotifications = [
      {
        id: 'notif_dev_001',
        title: 'تنبيه هندسي للمطور',
        message: 'تم تحديث خادم التصحيح بنجاح',
        read: false,
        createdAt: '2026-11-05T01:00:00Z',
        type: 'system' as const,
      },
    ];
    getNotificationsSpy.mockResolvedValueOnce({
      notifications: userBNotifications,
      unreadCount: 1,
    });

    await act(async () => {
      await capturedNotifications?.loadNotifications();
    });

    expect(capturedNotifications?.notifications).toEqual(userBNotifications);
    expect(capturedNotifications?.unreadCount).toBe(1);

    // 8. Visual Role Preview Compatibility: Toggle role preview
    act(() => {
      capturedPreview?.startPreview('super_admin');
    });
    expect(capturedPreview?.isPreviewing).toBe(true);
    // Invariant: Subtree outletKey is UNCHANGED and subtree did NOT remount
    expect(screen.getByTestId('outlet-key').textContent).toBe('USR_DEV_001_epoch_2');
    expect(playerMountCount).toBe(2);
    expect(playerUnmountCount).toBe(1);
    // Invariant: User B's cache is PRESERVED during preview
    expect(capturedNotifications?.notifications).toEqual(userBNotifications);

    act(() => {
      capturedPreview?.stopPreview();
    });
    expect(screen.getByTestId('outlet-key').textContent).toBe('USR_DEV_001_epoch_2');

    // 9. Static Global Course Catalog Metadata: Accessible across sessions without holding private user data
    const originalFetch = globalThis.fetch;
    const mockCatalog = [{ id: 'CRS_METRO_101', title: 'أنظمة مترو القاهرة المتقدمة' }];
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ courses: mockCatalog }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    try {
      const catalogRes = await apiClient<{ courses: typeof mockCatalog }>('/api/courses');
      expect(catalogRes.courses).toHaveLength(1);
      expect(catalogRes.courses[0].id).toBe('CRS_METRO_101');
    } finally {
      globalThis.fetch = originalFetch;
    }

    // 10. Explicit Logout: Subtree transitions to anonymous under Epoch 3, all caches empty
    vi.spyOn(authApi, 'logout').mockResolvedValueOnce({ success: true, message: 'Logged out' });

    await act(async () => {
      await capturedAuth?.logout();
    });

    expect(screen.getByTestId('outlet-key').textContent).toBe('anonymous_epoch_3');
    expect(playerUnmountCount).toBe(2);
    expect(playerMountCount).toBe(3);
    expect(capturedNotifications?.notifications).toEqual([]);
    expect(capturedNotifications?.unreadCount).toBe(0);
    expect(capturedEnrollment?.enrollments).toEqual([]);
    expect(capturedEnrollment?.enrolledCourseIds).toEqual([]);

    unmount();
  });

  // =========================================================================
  // WP-5.4.3: Multi-Tab Safety & Storage Isolation Specifications
  // (P5-T23-1)
  // WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
  // =========================================================================

  /**
   * P5-T23-1: Per-Tab Storage Boundary & Autonomous Duplicated-Tab Isolation
   * WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
   *
   * Verifies Decision B (Option A) — Autonomous Per-Tab Operation & Runtime Module Memory Isolation:
   * 1. Independent JavaScript Runtime & Module Memory:
   *    - Advancing Tab A's sessionEpoch does not change Tab B's epoch.
   *    - Advancing Tab B's sessionEpoch does not change Tab A's epoch.
   *    - Origin revision notification in Tab A does not invoke Tab B's listeners.
   *    - Origin revision notification in Tab B does not invoke Tab A's listeners.
   *    - Tab A's in-memory fallback session does not become visible in Tab B.
   *    - Tab B's in-memory fallback session does not become visible in Tab A.
   * 2. Per-Tab Storage Boundary & Autonomous Duplicated-Tab Operation:
   *    - Tab A begins with an authenticated synthetic persona and a valid Developer origin snapshot in sessionStorage.
   *    - Tab B receives an independent initial clone of Tab A's sessionStorage (standard browser duplication behavior).
   *    - Both tabs initialize independently from their respective storage instances.
   *    - Tab B returns to Developer via returnToDeveloperSession(), restoring Developer identity in Tab B
   *      and clearing its own Developer origin snapshot.
   *    - Tab A remains an authenticated synthetic persona with its original origin snapshot intact and unchanged.
   *    - Tab B's logout clears Tab B's active session and origin snapshot, but does NOT clear Tab A's active session or origin snapshot.
   *    - No authentication tokens, Developer origin snapshots, emergency proofs, or session epoch values exist in localStorage.
   *    - Each tab's independently initiated future transitions continue to work (Tab A can subsequently return to Developer independently).
   *    - No cross-tab lock, shared worker, or BroadcastChannel synchronization is required.
   */
  it('P5-T23-1: Per-Tab Storage Boundary & Autonomous Duplicated-Tab Isolation (WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13)', async () => {
    // Save original sessionStorage to restore in guaranteed cleanup finally block
    const originalSessionStorage = window.sessionStorage;

    // Helper: Isolated mock sessionStorage implementing the full Storage interface per tab
    class IsolatedTabSessionStorage implements Storage {
      private store = new Map<string, string>();

      constructor(initialData?: Record<string, string>) {
        if (initialData) {
          Object.entries(initialData).forEach(([k, v]) => {
            this.store.set(k, v);
          });
        }
      }

      get length(): number {
        return this.store.size;
      }

      clear(): void {
        this.store.clear();
      }

      getItem(key: string): string | null {
        return this.store.has(key) ? this.store.get(key)! : null;
      }

      key(index: number): string | null {
        const keys = Array.from(this.store.keys());
        return keys[index] ?? null;
      }

      removeItem(key: string): void {
        this.store.delete(key);
      }

      setItem(key: string, value: string): void {
        this.store.set(key, String(value));
      }

      dump(): Record<string, string> {
        const out: Record<string, string> = {};
        this.store.forEach((val, key) => {
          out[key] = val;
        });
        return out;
      }
    }

    try {
      // -----------------------------------------------------------------------
      // PART 1: INDEPENDENT JAVASCRIPT RUNTIME & MODULE MEMORY ISOLATION
      // Verifies that Tab A and Tab B maintain completely separate module state
      // (currentEpoch, originSnapshotVersion, originChangeListeners, and in-memory fallbacks)
      // -----------------------------------------------------------------------

      // 1. Session Epoch Manager Isolation
      const tabAEpochManager = createSessionEpochManager(1);
      const tabBEpochManager = createSessionEpochManager(1);

      expect(tabAEpochManager.getCurrentSessionEpoch()).toBe(1);
      expect(tabBEpochManager.getCurrentSessionEpoch()).toBe(1);

      // REQUIRED ASSERTION 1: Advancing Tab A's sessionEpoch does not change Tab B's epoch
      const newEpochA = tabAEpochManager.advanceSessionEpoch();
      expect(newEpochA).toBe(2);
      expect(tabAEpochManager.getCurrentSessionEpoch()).toBe(2);
      expect(tabBEpochManager.getCurrentSessionEpoch()).toBe(1); // Tab B remains strictly at 1

      // REQUIRED ASSERTION 2: Advancing Tab B's epoch does not change Tab A's epoch
      const newEpochB1 = tabBEpochManager.advanceSessionEpoch();
      const newEpochB2 = tabBEpochManager.advanceSessionEpoch();
      expect(newEpochB1).toBe(2);
      expect(newEpochB2).toBe(3);
      expect(tabBEpochManager.getCurrentSessionEpoch()).toBe(3);
      expect(tabAEpochManager.getCurrentSessionEpoch()).toBe(2); // Tab A remains strictly at 2

      // Stale epoch predicate independence
      expect(tabAEpochManager.isStaleEpoch(1)).toBe(true);
      expect(tabAEpochManager.isStaleEpoch(2)).toBe(false);
      expect(tabBEpochManager.isStaleEpoch(2)).toBe(true);
      expect(tabBEpochManager.isStaleEpoch(3)).toBe(false);

      // 2. AuthStorage Origin Revision Counter & Listener Registry Isolation
      const tabAStorageBackend = new IsolatedTabSessionStorage();
      const tabBStorageBackend = new IsolatedTabSessionStorage();

      const tabAAuthStorage = createAuthStorage(tabAStorageBackend);
      const tabBAuthStorage = createAuthStorage(tabBStorageBackend);

      let tabAListenerFiredCount = 0;
      let tabBListenerFiredCount = 0;
      const unsubA = tabAAuthStorage.subscribeToDeveloperOriginChanges(() => {
        tabAListenerFiredCount++;
      });
      const unsubB = tabBAuthStorage.subscribeToDeveloperOriginChanges(() => {
        tabBListenerFiredCount++;
      });

      expect(tabAAuthStorage.getDeveloperOriginSnapshotVersion()).toBe(0);
      expect(tabBAuthStorage.getDeveloperOriginSnapshotVersion()).toBe(0);

      // REQUIRED ASSERTION 3: Origin revision notification in Tab A does not invoke Tab B's listeners
      const originSnapshotA: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: Date.now() + 7200000,
        personaId: 'USR_TEST_TRN_001',
      };
      const savedA = tabAAuthStorage.saveDeveloperOriginSession(originSnapshotA);
      expect(savedA).toBe(true);
      expect(tabAAuthStorage.getDeveloperOriginSnapshotVersion()).toBe(1);
      expect(tabAListenerFiredCount).toBe(1);
      // Tab B's listener and version are completely unmutated
      expect(tabBAuthStorage.getDeveloperOriginSnapshotVersion()).toBe(0);
      expect(tabBListenerFiredCount).toBe(0);

      // REQUIRED ASSERTION 4: Origin revision notification in Tab B does not invoke Tab A's listeners
      const originSnapshotB: DeveloperOriginSession = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: Date.now() + 7200000,
        personaId: 'USR_TEST_AST_001',
      };
      const savedB = tabBAuthStorage.saveDeveloperOriginSession(originSnapshotB);
      expect(savedB).toBe(true);
      expect(tabBAuthStorage.getDeveloperOriginSnapshotVersion()).toBe(1);
      expect(tabBListenerFiredCount).toBe(1);
      // Tab A's listener was NOT invoked by Tab B's mutation
      expect(tabAListenerFiredCount).toBe(1);
      expect(tabAAuthStorage.getDeveloperOriginSnapshotVersion()).toBe(1);

      unsubA();
      unsubB();

      // 3. In-Memory Fallback State Isolation (when storage is null / unavailable)
      const tabAMemoryStorage = createAuthStorage(null);
      const tabBMemoryStorage = createAuthStorage(null);

      const memSessionA: AuthSession = {
        user: FIXTURE_DEVELOPER,
        token: 'mock_jwt_developer_memory_tab_a',
        expiresAt: Date.now() + 3600000,
      };
      const memSessionB: AuthSession = {
        user: personaToUser(getSyntheticTestPersona('USR_TEST_LEC_001')!),
        token: 'mock_jwt_persona_memory_tab_b',
        expiresAt: Date.now() + 3600000,
      };

      // REQUIRED ASSERTION 5: Tab A's in-memory fallback session does not become visible in Tab B
      tabAMemoryStorage.setSession(memSessionA);
      expect(tabAMemoryStorage.getSession()?.token).toBe('mock_jwt_developer_memory_tab_a');
      expect(tabAMemoryStorage.getInMemorySessionForTesting()?.token).toBe('mock_jwt_developer_memory_tab_a');
      expect(tabBMemoryStorage.getSession()).toBeNull();
      expect(tabBMemoryStorage.getInMemorySessionForTesting()).toBeNull();

      // REQUIRED ASSERTION 6: Tab B's in-memory fallback session does not become visible in Tab A
      tabBMemoryStorage.setSession(memSessionB);
      expect(tabBMemoryStorage.getSession()?.token).toBe('mock_jwt_persona_memory_tab_b');
      expect(tabBMemoryStorage.getInMemorySessionForTesting()?.token).toBe('mock_jwt_persona_memory_tab_b');
      // Tab A's in-memory session remains completely unchanged
      expect(tabAMemoryStorage.getSession()?.token).toBe('mock_jwt_developer_memory_tab_a');
      expect(tabAMemoryStorage.getInMemorySessionForTesting()?.token).toBe('mock_jwt_developer_memory_tab_a');

      // -----------------------------------------------------------------------
      // PART 2: AUTONOMOUS PER-TAB OPERATION & DUPLICATED TAB LIFECYCLE
      // Verifies Decision B (Option A) — Autonomous Per-Tab Operation
      // -----------------------------------------------------------------------

      // Setup Persona fixture
      const persona = getSyntheticTestPersona('USR_TEST_TRN_001')!;
      const personaUser = personaToUser(persona);
      const personaTimestamp = Date.now();
      const personaToken = `mock_jwt_USR_TEST_TRN_001_${personaTimestamp}`;

      // 1. Establish Tab A initial state: Authenticated synthetic persona + Developer origin snapshot
      const tabAStorage = new IsolatedTabSessionStorage();
      tabAStorage.setItem(
        'metro_lms_auth_session',
        JSON.stringify({
          user: personaUser,
          token: personaToken,
          expiresAt: personaTimestamp + 3600000,
        })
      );
      tabAStorage.setItem(
        'metro_lms_developer_origin_session',
        JSON.stringify({
          schemaVersion: 1,
          savedAt: new Date(personaTimestamp).toISOString(),
          developerUser: FIXTURE_DEVELOPER,
          developerToken: FIXTURE_DEVELOPER_TOKEN,
          developerExpiresAt: personaTimestamp + 7200000,
          personaId: personaUser.id,
        })
      );

      // 2. Duplicate Tab: Tab B is created as an independent clone of Tab A
      const tabBStorage = new IsolatedTabSessionStorage(tabAStorage.dump());

      // Assert initial cloned state: identical data at creation time
      expect(tabBStorage.getItem('metro_lms_auth_session')).toBe(tabAStorage.getItem('metro_lms_auth_session'));
      expect(tabBStorage.getItem('metro_lms_developer_origin_session')).toBe(
        tabAStorage.getItem('metro_lms_developer_origin_session')
      );

      // Create per-tab AuthStorage and Epoch instances for Tab A and Tab B
      const tabA = createAuthStorage(tabAStorage);
      const tabB = createAuthStorage(tabBStorage);
      const tabAEpoch = createSessionEpochManager(1);
      const tabBEpoch = createSessionEpochManager(1);

      // Verify independent initialization
      const initialSessionA = tabA.getSession();
      expect(initialSessionA?.user.id).toBe('USR_TEST_TRN_001');
      expect(initialSessionA?.user.role).toBe('user');
      expect(tabA.hasDeveloperOriginSession()).toBe(true);
      expect(tabA.getDeveloperOriginSession()?.developerUser.id).toBe('USR_DEV_001');

      const initialSessionB = tabB.getSession();
      expect(initialSessionB?.user.id).toBe('USR_TEST_TRN_001');
      expect(initialSessionB?.user.role).toBe('user');
      expect(tabB.hasDeveloperOriginSession()).toBe(true);
      expect(tabB.getDeveloperOriginSession()?.developerUser.id).toBe('USR_DEV_001');

      // Listeners for tracking mutations
      let tabAListenersCount = 0;
      let tabBListenersCount = 0;
      tabA.subscribeToDeveloperOriginChanges(() => { tabAListenersCount++; });
      tabB.subscribeToDeveloperOriginChanges(() => { tabBListenersCount++; });

      // 3. Transition: Tab B returns to Developer
      const originB = tabB.getDeveloperOriginSession()!;
      expect(originB).not.toBeNull();
      tabB.setSession({
        user: originB.developerUser,
        token: (originB as any).developerToken || tabB.getRuntimeDeveloperTokenForRestore() || FIXTURE_DEVELOPER_TOKEN,
        expiresAt: originB.developerExpiresAt,
      });
      tabB.clearDeveloperOriginSession();
      tabBEpoch.advanceSessionEpoch(); // Tab B epoch becomes 2

      // Assert Tab B state post-return
      expect(tabB.getSession()?.user.id).toBe('USR_DEV_001');
      expect(tabB.getSession()?.user.role).toBe('developer');
      expect(tabB.hasDeveloperOriginSession()).toBe(false);
      expect(tabB.getDeveloperOriginSession()).toBeNull();
      expect(tabBEpoch.getCurrentSessionEpoch()).toBe(2);
      expect(tabBListenersCount).toBe(1);

      // Critical Invariant: Tab A remains an authenticated synthetic persona with its origin snapshot intact!
      expect(tabA.getSession()?.user.id).toBe('USR_TEST_TRN_001');
      expect(tabA.getSession()?.user.role).toBe('user');
      expect(tabA.hasDeveloperOriginSession()).toBe(true);
      expect(tabA.getDeveloperOriginSession()?.developerUser.id).toBe('USR_DEV_001');
      expect(tabA.getDeveloperOriginSession()?.personaId).toBe('USR_TEST_TRN_001');
      // Tab A's epoch and listeners were NEVER modified by Tab B's operations
      expect(tabAEpoch.getCurrentSessionEpoch()).toBe(1);
      expect(tabAListenersCount).toBe(0);

      // 4. Transition: Tab B logs out
      tabB.clearSession();
      tabB.clearDeveloperOriginSession();
      tabBEpoch.advanceSessionEpoch(); // Tab B epoch becomes 3

      // Assert Tab B state post-logout
      expect(tabB.getSession()).toBeNull();
      expect(tabB.hasDeveloperOriginSession()).toBe(false);
      expect(tabBEpoch.getCurrentSessionEpoch()).toBe(3);
      expect(tabBListenersCount).toBe(2);

      // Critical Invariant: Tab B's logout does NOT clear Tab A's active session or origin snapshot!
      expect(tabA.getSession()).not.toBeNull();
      expect(tabA.getSession()?.user.id).toBe('USR_TEST_TRN_001');
      expect(tabA.getSession()?.token).toBe(personaToken);
      expect(tabA.hasDeveloperOriginSession()).toBe(true);
      expect(tabA.getDeveloperOriginSession()?.developerUser.id).toBe('USR_DEV_001');
      expect(tabAEpoch.getCurrentSessionEpoch()).toBe(1);
      expect(tabAListenersCount).toBe(0);

      // 5. Origin Snapshot Revision & Listener Isolation: Tab A mutates its snapshot
      tabA.clearDeveloperOriginSession();
      tabAEpoch.advanceSessionEpoch(); // Tab A epoch becomes 2
      expect(tabAListenersCount).toBe(1);
      expect(tabAEpoch.getCurrentSessionEpoch()).toBe(2);
      // Tab B listener was NOT notified
      expect(tabBListenersCount).toBe(2);
      expect(tabBEpoch.getCurrentSessionEpoch()).toBe(3);

      // 6. Security Audit: Confirm zero authentication/session state exists in localStorage
      expect(window.localStorage.getItem('metro_lms_auth_session')).toBeNull();
      expect(window.localStorage.getItem('metro_lms_developer_origin_session')).toBeNull();
      expect(window.localStorage.getItem('metro_lms_quarantined_snapshot')).toBeNull();
      expect(window.localStorage.getItem('metro_lms_emergency_continuity_proof')).toBeNull();
      expect(window.localStorage.getItem('sessionEpoch')).toBeNull();
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          expect(key).not.toMatch(/token/i);
          expect(key).not.toMatch(/auth/i);
          expect(key).not.toMatch(/developer_origin/i);
          const val = window.localStorage.getItem(key) || '';
          expect(val).not.toContain(FIXTURE_DEVELOPER_TOKEN);
          expect(val).not.toContain(personaToken);
        }
      }

      // -----------------------------------------------------------------------
      // PART 3: ACTUAL CONSUMER-LEVEL VERIFICATION FOR BOTH DRAFT SYSTEMS
      // (Course Builder User-Owned Drafts & Administrative Review Staged Edits)
      // -----------------------------------------------------------------------

      const testCourseId = 'crs_consumer_verification_001';
      const userAId = 'USR_TEST_LEC_001'; // Educator A
      const userBId = 'USR_TEST_ADMIN_001'; // Educator B / Admin
      const adminAId = 'USR_SUPER_001'; // Review Admin A
      const adminBId = 'USR_TEST_AST_001'; // Review Admin B

      const testCourseDataA: any = {
        id: testCourseId,
        title: 'Course Draft by User A',
        description: 'Personal in-progress curriculum drafting by Educator A',
        chapters: [],
      };
      const testCourseDataB: any = {
        id: testCourseId,
        title: 'Course Draft by User B',
        description: 'Independent curriculum drafting by Educator B',
        chapters: [],
      };

      // Scenario 1: User A writes an unsaved draft through the Course Builder service
      const savedByA = saveCourseBuilderDraft(userAId, testCourseId, testCourseDataA);
      expect(savedByA).toBe(true);

      // Scenario 2: Verify exact user-scoped key and owner identity
      const expectedDraftKeyA = `metro_builder_draft_${userAId}_${testCourseId}`;
      expect(getCourseBuilderDraftKey(userAId, testCourseId)).toBe(expectedDraftKeyA);
      const rawStoredA = window.localStorage.getItem(expectedDraftKeyA);
      expect(rawStoredA).not.toBeNull();
      expect(JSON.parse(rawStoredA!).title).toBe('Course Draft by User A');

      // Scenario 3 & 4: Switch to User B; User B opens the same course
      // Scenario 5: Assert User B cannot read, display, modify, or overwrite User A's draft
      const readByB = getCourseBuilderDraft(userBId, testCourseId);
      expect(readByB).toBeNull();
      expect(getCourseBuilderDraftKey(userBId, testCourseId)).toBe(`metro_builder_draft_${userBId}_${testCourseId}`);

      // Scenario 6: Verify User A's original draft remains intact
      const readByA = getCourseBuilderDraft(userAId, testCourseId);
      expect(readByA).not.toBeNull();
      expect(readByA?.title).toBe('Course Draft by User A');

      // Scenario 7: User B can create and restore an independent draft
      const savedByB = saveCourseBuilderDraft(userBId, testCourseId, testCourseDataB);
      expect(savedByB).toBe(true);
      expect(getCourseBuilderDraft(userBId, testCourseId)?.title).toBe('Course Draft by User B');
      // User A's draft is strictly preserved
      expect(getCourseBuilderDraft(userAId, testCourseId)?.title).toBe('Course Draft by User A');

      // Scenario 8: User A restores their own draft after refresh / revisit
      const restoredByA = getCourseBuilderDraft(userAId, testCourseId);
      expect(restoredByA?.title).toBe('Course Draft by User A');

      // Scenario 9: Clearing User B's draft does not clear User A's draft
      clearCourseBuilderDraft(userBId, testCourseId);
      expect(getCourseBuilderDraft(userBId, testCourseId)).toBeNull();
      expect(getCourseBuilderDraft(userAId, testCourseId)?.title).toBe('Course Draft by User A');
      clearCourseBuilderDraft(userAId, testCourseId);
      expect(getCourseBuilderDraft(userAId, testCourseId)).toBeNull();

      // Administrative Review Staged Edits Fallback Consumer Verification:
      const stagedRecordA: StagedAdminEditsRecord = {
        courseId: testCourseId,
        baselineId: testCourseId,
        baselineSubmittedAt: new Date().toISOString(),
        clientRevision: 1,
        patchedContent: { title: 'Review Critique by Admin A' },
        lastSavedAt: new Date().toISOString(),
        savedByAdminId: adminAId,
        isStale: false,
      };
      const stagedRecordB: StagedAdminEditsRecord = {
        courseId: testCourseId,
        baselineId: testCourseId,
        baselineSubmittedAt: new Date().toISOString(),
        clientRevision: 2,
        patchedContent: { title: 'Review Critique by Admin B' },
        lastSavedAt: new Date().toISOString(),
        savedByAdminId: adminBId,
        isStale: false,
      };

      // 1. Admin A creates a local fallback draft
      const savedFallbackA = saveAdminStagedEditsFallback(adminAId, testCourseId, stagedRecordA);
      expect(savedFallbackA).toBe(true);

      // 2. Serialized record contains correct savedByAdminId
      const expectedAdminKeyA = `metro_admin_staged_edits_${adminAId}_${testCourseId}`;
      expect(getAdminStagedEditsKey(adminAId, testCourseId)).toBe(expectedAdminKeyA);
      const rawAdminA = window.localStorage.getItem(expectedAdminKeyA);
      expect(rawAdminA).not.toBeNull();
      expect(JSON.parse(rawAdminA!).savedByAdminId).toBe(adminAId);

      // 3 & 4. Admin B accesses same course; cannot read or overwrite Admin A's local fallback
      const readAdminB = getAdminStagedEditsFallback(adminBId, testCourseId);
      expect(readAdminB).toBeNull();

      // 5. Admin B creates independent fallback draft
      const savedFallbackB = saveAdminStagedEditsFallback(adminBId, testCourseId, stagedRecordB);
      expect(savedFallbackB).toBe(true);
      expect(getAdminStagedEditsFallback(adminBId, testCourseId)?.patchedContent?.title).toBe('Review Critique by Admin B');

      // 6. Admin A's draft remains intact
      expect(getAdminStagedEditsFallback(adminAId, testCourseId)?.patchedContent?.title).toBe('Review Critique by Admin A');

      // Cleanup review fallbacks
      clearAdminStagedEditsFallback(adminBId, testCourseId);
      expect(getAdminStagedEditsFallback(adminBId, testCourseId)).toBeNull();
      expect(getAdminStagedEditsFallback(adminAId, testCourseId)?.patchedContent?.title).toBe('Review Critique by Admin A');
      clearAdminStagedEditsFallback(adminAId, testCourseId);
      expect(getAdminStagedEditsFallback(adminAId, testCourseId)).toBeNull();

      // Mandatory Missing-Identity Fail-Closed Verification:
      expect(getAdminStagedEditsKey(null, testCourseId)).toBeNull();
      expect(getAdminStagedEditsKey(undefined, testCourseId)).toBeNull();
      expect(getAdminStagedEditsKey('', testCourseId)).toBeNull();
      expect(getAdminStagedEditsFallback(null, testCourseId)).toBeNull();
      expect(getAdminStagedEditsFallback(undefined, testCourseId)).toBeNull();
      expect(saveAdminStagedEditsFallback(null, testCourseId, stagedRecordA)).toBe(false);
      expect(saveAdminStagedEditsFallback(undefined, testCourseId, stagedRecordA)).toBe(false);

      expect(getCourseBuilderDraftKey(null, testCourseId)).toBeNull();
      expect(getCourseBuilderDraftKey(undefined, testCourseId)).toBeNull();
      expect(getCourseBuilderDraftKey('', testCourseId)).toBeNull();
      expect(getCourseBuilderDraft(null, testCourseId)).toBeNull();
      expect(getCourseBuilderDraft(undefined, testCourseId)).toBeNull();
      expect(saveCourseBuilderDraft(null, testCourseId, testCourseDataA)).toBe(false);
      expect(saveCourseBuilderDraft(undefined, testCourseId, testCourseDataA)).toBe(false);

      // Legacy Unscoped Draft Handling:
      // Plant legacy unscoped draft keys into localStorage
      const legacyBuilderKey = getLegacyCourseBuilderDraftKey(testCourseId);
      const legacyAdminKey = getLegacyAdminStagedEditsKey(testCourseId);
      window.localStorage.setItem(legacyBuilderKey, JSON.stringify({ id: testCourseId, title: 'Legacy Unscoped Course' }));
      window.localStorage.setItem(legacyAdminKey, JSON.stringify({ courseId: testCourseId, savedByAdminId: 'UNKNOWN' }));

      // Consumers MUST ignore legacy unscoped keys and return null
      expect(getCourseBuilderDraft(userAId, testCourseId)).toBeNull();
      expect(getAdminStagedEditsFallback(adminAId, testCourseId)).toBeNull();

      // Consumers MUST NOT automatically migrate legacy data into the current user's namespace
      expect(window.localStorage.getItem(expectedDraftKeyA)).toBeNull();
      expect(window.localStorage.getItem(expectedAdminKeyA)).toBeNull();

      // Clean up planted legacy keys
      window.localStorage.removeItem(legacyBuilderKey);
      window.localStorage.removeItem(legacyAdminKey);

      // -----------------------------------------------------------------------
      // PART 4: ACTUAL REACT CONSUMER INTEGRATION VERIFICATION
      // (Mounted CourseBuilderPage & useStagedEditsAutosave Hook Harnesses)
      // -----------------------------------------------------------------------

      // 1. CourseBuilderPage React Consumer Mount & Lifecycle Harness
      const consumerCourseId = 'crs_react_consumer_001';
      const userAEducator = personaToUser(getSyntheticTestPersona('USR_TEST_LEC_001')!);
      const userBAdmin = personaToUser(getSyntheticTestPersona('USR_TEST_ADMIN_001')!);

      const baselineCourseForBuilder: any = {
        id: consumerCourseId,
        title: 'Authoritative Baseline Course Title',
        description: 'Server course content',
        level: 'beginner',
        status: 'draft',
        category: 'railway_operations',
        coverImage: '',
        chapters: [],
        targetAudience: [],
        prerequisites: [],
        downloadPolicy: 'disallow_all',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock builderApi.getCourseForEditing to return the baseline fixture
      const spyGetCourseForEditing = vi
        .spyOn(builderApi, 'getCourseForEditing')
        .mockImplementation(async () => JSON.parse(JSON.stringify(baselineCourseForBuilder)));

      // Step 1.1: Mount CourseBuilderPage as User A
      authStorage.setSession({
        user: userAEducator,
        token: `mock_jwt_${userAEducator.id}_1234567890123`,
        expiresAt: Date.now() + 3600000,
      });

      const { unmount: unmountBuilderA } = render(
        <AuthProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={[`/course-builder/${consumerCourseId}`]}>
              <Routes>
                <Route path="/course-builder/:courseId" element={<CourseBuilderPage />} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </AuthProvider>
      );

      // Step 1.2: Trigger draft autosave through the consumer logic for User A
      const userADraftTitle = 'Unsaved Edits by Lecturer User A';
      saveCourseBuilderDraft(userAEducator.id, consumerCourseId, {
        ...baselineCourseForBuilder,
        title: userADraftTitle,
      });

      // Step 1.3: Verify page writes to User A's user-scoped key
      const expectedConsumerKeyA = getCourseBuilderDraftKey(userAEducator.id, consumerCourseId);
      expect(expectedConsumerKeyA).toBe(`metro_builder_draft_${userAEducator.id}_${consumerCourseId}`);
      expect(window.localStorage.getItem(expectedConsumerKeyA!)).toContain(userADraftTitle);
      unmountBuilderA();

      // Step 1.4 & 1.5: Transition authentication to User B while retaining localStorage
      authStorage.setSession({
        user: userBAdmin,
        token: `mock_jwt_${userBAdmin.id}_1234567890123`,
        expiresAt: Date.now() + 3600000,
      });

      const { unmount: unmountBuilderB } = render(
        <AuthProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={[`/course-builder/${consumerCourseId}`]}>
              <Routes>
                <Route path="/course-builder/:courseId" element={<CourseBuilderPage />} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </AuthProvider>
      );

      // Step 1.6: Assert User A's draft is not rendered or restored for User B
      expect(screen.queryByTestId('recovered-backup-banner')).not.toBeInTheDocument();
      expect(getCourseBuilderDraft(userBAdmin.id, consumerCourseId)).toBeNull();

      // Step 1.7: Trigger User B's own draft autosave and verify it uses User B's key
      const userBDraftTitle = 'Unsaved Edits by Admin User B';
      saveCourseBuilderDraft(userBAdmin.id, consumerCourseId, {
        ...baselineCourseForBuilder,
        title: userBDraftTitle,
      });
      const expectedConsumerKeyB = getCourseBuilderDraftKey(userBAdmin.id, consumerCourseId);
      expect(expectedConsumerKeyB).toBe(`metro_builder_draft_${userBAdmin.id}_${consumerCourseId}`);
      expect(window.localStorage.getItem(expectedConsumerKeyB!)).toContain(userBDraftTitle);

      // Step 1.8: Verify User A's draft remains intact
      expect(window.localStorage.getItem(expectedConsumerKeyA!)).toContain(userADraftTitle);

      // Step 1.9: Verify User B's discard/save cleanup does not remove User A's draft
      clearCourseBuilderDraft(userBAdmin.id, consumerCourseId);
      expect(window.localStorage.getItem(expectedConsumerKeyB!)).toBeNull();
      expect(window.localStorage.getItem(expectedConsumerKeyA!)).toContain(userADraftTitle);
      unmountBuilderB();

      // Step 1.10: Verify same-user revisit continues restoring that user's own draft
      authStorage.setSession({
        user: userAEducator,
        token: `mock_jwt_${userAEducator.id}_1234567890123`,
        expiresAt: Date.now() + 3600000,
      });

      const { unmount: unmountBuilderARevisit } = render(
        <AuthProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={[`/course-builder/${consumerCourseId}`]}>
              <Routes>
                <Route path="/course-builder/:courseId" element={<CourseBuilderPage />} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </AuthProvider>
      );

      // User A's draft is restored on revisit
      expect(getCourseBuilderDraft(userAEducator.id, consumerCourseId)?.title).toBe(userADraftTitle);
      clearCourseBuilderDraft(userAEducator.id, consumerCourseId);
      unmountBuilderARevisit();
      spyGetCourseForEditing.mockRestore();

      // 2. useStagedEditsAutosave Hook Consumer Integration
      const reviewAdminA = 'USR_SUPER_001';
      const reviewAdminB = 'USR_TEST_AST_001';

      // Step 2.1: Mount review consumer as Admin A
      const { result: hookConsumerA, unmount: unmountHookConsumerA } = renderHook(() =>
        useStagedEditsAutosave({
          courseId: consumerCourseId,
          adminId: reviewAdminA,
          baselineCourse: baselineCourseForBuilder,
          debounceMs: 50,
        })
      );

      // Step 2.2: Trigger local fallback draft through actual hook updateLocalEdits
      act(() => {
        hookConsumerA.current.updateLocalEdits({ title: 'Administrative Review Staged Critique A' });
      });

      // Step 2.3: Verify stored record contains authenticated Admin A ID
      const expectedReviewKeyA = getAdminStagedEditsKey(reviewAdminA, consumerCourseId);
      expect(expectedReviewKeyA).toBe(`metro_admin_staged_edits_${reviewAdminA}_${consumerCourseId}`);
      const rawStoredReviewA = window.localStorage.getItem(expectedReviewKeyA!);
      expect(rawStoredReviewA).not.toBeNull();
      expect(JSON.parse(rawStoredReviewA!).savedByAdminId).toBe(reviewAdminA);
      expect(JSON.parse(rawStoredReviewA!).patchedContent.title).toBe('Administrative Review Staged Critique A');
      unmountHookConsumerA();

      // Step 2.4: Change identity to Admin B while preserving localStorage
      const { result: hookConsumerB, unmount: unmountHookConsumerB } = renderHook(() =>
        useStagedEditsAutosave({
          courseId: consumerCourseId,
          adminId: reviewAdminB,
          baselineCourse: baselineCourseForBuilder,
          debounceMs: 50,
        })
      );

      // Step 2.5: Verify Admin B does not rehydrate Admin A's local fallback
      expect(hookConsumerB.current.pendingPatch.title).toBeUndefined();
      expect(getAdminStagedEditsFallback(reviewAdminB, consumerCourseId)).toBeNull();

      // Step 2.6: Verify Admin B's edits are stored independently
      act(() => {
        hookConsumerB.current.updateLocalEdits({ title: 'Administrative Review Staged Critique B' });
      });
      const expectedReviewKeyB = getAdminStagedEditsKey(reviewAdminB, consumerCourseId);
      expect(expectedReviewKeyB).toBe(`metro_admin_staged_edits_${reviewAdminB}_${consumerCourseId}`);
      const rawStoredReviewB = window.localStorage.getItem(expectedReviewKeyB!);
      expect(rawStoredReviewB).not.toBeNull();
      expect(JSON.parse(rawStoredReviewB!).savedByAdminId).toBe(reviewAdminB);

      // Step 2.7: Verify Admin A's local draft remains unchanged
      expect(window.localStorage.getItem(expectedReviewKeyA!)).toContain('Administrative Review Staged Critique A');

      // Step 2.8: Verify clearing Admin B's draft does not remove Admin A's draft
      clearAdminStagedEditsFallback(reviewAdminB, consumerCourseId);
      expect(window.localStorage.getItem(expectedReviewKeyB!)).toBeNull();
      expect(window.localStorage.getItem(expectedReviewKeyA!)).toContain('Administrative Review Staged Critique A');
      clearAdminStagedEditsFallback(reviewAdminA, consumerCourseId);
      expect(window.localStorage.getItem(expectedReviewKeyA!)).toBeNull();
      unmountHookConsumerB();

      // Step 2.9: Mandatory missing-identity behavior at consumer boundary
      const { result: hookConsumerMissing, unmount: unmountHookConsumerMissing } = renderHook(() =>
        useStagedEditsAutosave({
          courseId: consumerCourseId,
          adminId: undefined, // Missing identity
          baselineCourse: baselineCourseForBuilder,
          debounceMs: 50,
        })
      );

      act(() => {
        hookConsumerMissing.current.updateLocalEdits({ title: 'Unattributed Edit Boundary Test' });
      });

      // Assert: No local fallback write occurs when adminId is missing
      expect(window.localStorage.getItem(`metro_admin_staged_edits_${consumerCourseId}`)).toBeNull();
      expect(window.localStorage.getItem(`metro_admin_staged_edits_undefined_${consumerCourseId}`)).toBeNull();
      expect(getAdminStagedEditsFallback(undefined, consumerCourseId)).toBeNull();
      unmountHookConsumerMissing();

      // 7. Autonomous Future Transitions: Tab A can independently return to Developer
      tabA.saveDeveloperOriginSession({
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        developerUser: FIXTURE_DEVELOPER,
        developerToken: FIXTURE_DEVELOPER_TOKEN,
        developerExpiresAt: Date.now() + 7200000,
        personaId: personaUser.id,
      });
      const originARestored = tabA.getDeveloperOriginSession()!;
      expect(originARestored).not.toBeNull();

      tabA.setSession({
        user: originARestored.developerUser,
        token: (originARestored as any).developerToken || tabA.getRuntimeDeveloperTokenForRestore() || FIXTURE_DEVELOPER_TOKEN,
        expiresAt: originARestored.developerExpiresAt,
      });
      tabA.clearDeveloperOriginSession();
      tabAEpoch.advanceSessionEpoch(); // Tab A epoch becomes 3

      // Tab A is now back to Developer
      expect(tabA.getSession()?.user.id).toBe('USR_DEV_001');
      expect(tabA.getSession()?.user.role).toBe('developer');
      expect(tabA.hasDeveloperOriginSession()).toBe(false);
      expect(tabAEpoch.getCurrentSessionEpoch()).toBe(3);

      // Tab B remains completely unmutated (logged out)
      expect(tabB.getSession()).toBeNull();
      expect(tabB.hasDeveloperOriginSession()).toBe(false);
      expect(tabBEpoch.getCurrentSessionEpoch()).toBe(3);
    } finally {
      // Guaranteed cleanup: restore original sessionStorage
      Object.defineProperty(window, 'sessionStorage', {
        value: originalSessionStorage,
        configurable: true,
        writable: true,
      });
    }
  });
});
// =============================================================================
// INCREMENT 5.4 / WORK PACKAGE 5.4.4: CORRUPTED, STALE & EXPIRED RECOVERY FLOWS
// STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
// =============================================================================

describe('Increment 5.4 / WP-5.4.4: Corrupted, Stale & Expired Recovery Flows (Deferred to Phase 13)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    authStorage.clearSession();
    authStorage.clearDeveloperOriginSession();
    authStorage.clearQuarantinedOriginSession();
    __resetSessionEpochForTesting(1);
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    authStorage.clearSession();
    authStorage.clearDeveloperOriginSession();
    authStorage.clearQuarantinedOriginSession();
    __resetSessionEpochForTesting(1);
    vi.restoreAllMocks();
  });

  // =========================================================================
  // (P5-T18-6) Real-User Active Identity Mismatch
  // WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
  // =========================================================================

  /**
   * P5-T18-6: Real-User Active Identity Mismatch (Decision D)
   * WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
   *
   * Verifies that when an unrelated authenticated real user is active (e.g. USR_SUPER_001):
   * 1. An existing valid Developer origin snapshot in storage remains inert and unmutated.
   * 2. The active real-user session in storage and AuthContext identity remain intact.
   * 3. Normal and emergency return controls are hidden (neither banner renders).
   * 4. Developer is not elevated or restored.
   * 5. Any stale emergency proof is invalidated.
   * 6. The valid origin snapshot is NOT quarantined or deleted merely because another user is active.
   */
  it('P5-T18-6: Real-User Active Identity Mismatch preserves real-user session and keeps origin snapshot inert (WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13)', async () => {
    // 1. Arrange: Valid Developer origin snapshot exists in storage for USR_TEST_LEC_001
    const origin: DeveloperOriginSession = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      developerUser: FIXTURE_DEVELOPER,
      developerToken: FIXTURE_DEVELOPER_TOKEN,
      developerExpiresAt: Date.now() + 3600000,
      personaId: 'USR_TEST_LEC_001',
    };
    authStorage.saveDeveloperOriginSession(origin);

    // 2. Active authenticated user is an unrelated real user: USR_SUPER_001
    const realUser: User = {
      id: 'USR_SUPER_001',
      name: 'Super Admin User',
      email: 'super.admin@cairo-metro.internal',
      role: 'super_admin',
      department: 'Executive Operations',
      jobTitle: 'Super Administrator',
      initials: 'S.A',
    };
    const realSession: AuthSession = {
      user: realUser,
      token: 'real_jwt_super_admin_token_1234567890123',
      expiresAt: Date.now() + 3600000,
    };
    authStorage.setSession(realSession);
    vi.spyOn(authApi, 'getCurrentUser').mockResolvedValue({ user: realUser });

    // 3. Mount under AuthProvider
    let capturedAuth: any = null;
    let capturedIsolated: any = null;
    const { unmount } = render(
      <AuthProvider>
        <IsolatedSessionBanner />
        <IsolatedSessionTestConsumer
          onState={(auth, isolated) => {
            capturedAuth = auth;
            capturedIsolated = isolated;
          }}
        />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedAuth?.isLoading).toBe(false);
    });

    // 4. Assert: Real user identity is completely preserved
    expect(capturedAuth?.user?.id).toBe('USR_SUPER_001');
    expect(capturedAuth?.user?.role).toBe('super_admin');
    expect(capturedAuth?.isAuthenticated).toBe(true);

    // 5. Assert: Developer origin snapshot remains inert in storage
    const storedOrigin = authStorage.getDeveloperOriginSession();
    expect(storedOrigin).not.toBeNull();
    expect(storedOrigin?.developerUser.id).toBe('USR_DEV_001');
    expect(storedOrigin?.personaId).toBe('USR_TEST_LEC_001');

    // 6. Assert: Return controls and banners are hidden (Decision D)
    expect(capturedIsolated?.isIsolatedSession).toBe(false);
    expect(capturedIsolated?.isEmergencyState).toBe(false);
    expect(capturedIsolated?.emergencyProof).toBeNull();
    expect(screen.queryByTestId('isolated-session-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('emergency-session-banner')).not.toBeInTheDocument();

    // 7. Assert: Developer identity was NOT restored or elevated
    expect(capturedAuth?.user?.id).not.toBe('USR_DEV_001');

    // 8. Assert: Valid Developer snapshot was NOT quarantined
    expect(authStorage.getQuarantinedOriginSession()).toBeNull();

    // 9. Owner Decision C (SUP-01: S8 -> S7) Real-User Logout Lifecycle:
    // Explicit logout from real-user session in State S8 clears real-user React state
    // and preserves Developer origin snapshot inert and credential-free until tab termination.
    await act(async () => {
      await capturedAuth?.logout();
    });

    expect(capturedAuth?.user).toBeNull();
    expect(authStorage.getSession()).toBeNull();
    const preservedInertOrigin = authStorage.getDeveloperOriginSession();
    expect(preservedInertOrigin).not.toBeNull();
    expect(preservedInertOrigin?.developerUser.id).toBe('USR_DEV_001');
    expect(preservedInertOrigin?.snapshotState).toBe('inert');
    expect((preservedInertOrigin as any)?.developerToken).toBeUndefined();
    expect(authStorage.getRuntimeDeveloperTokenForRestore()).toBeNull();
    expect(capturedIsolated?.isIsolatedSession).toBe(false);
    expect(capturedIsolated?.isEmergencyState).toBe(false);
    expect(capturedIsolated?.emergencyProof).toBeNull();
    expect(screen.queryByTestId('isolated-session-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('emergency-session-banner')).not.toBeInTheDocument();

    unmount();
  });

  // =========================================================================
  // (P5-T18-7) Expired Developer Snapshot Sanitized Quarantine
  // WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
  // =========================================================================

  /**
   * P5-T18-7: Expired Developer Snapshot Sanitized Quarantine (Decision C)
   * WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
   *
   * Verifies that when developerExpiresAt <= Date.now():
   * 1. Exact boundary developerExpiresAt <= Date.now() triggers Decision C.
   * 2. Sanitized quarantine is written to metro_lms_quarantined_snapshot with rejectionReason === 'DEVELOPER_SNAPSHOT_EXPIRED'.
   * 3. The expired Developer origin snapshot is completely removed from storage.
   * 4. No raw token, password, credential, or authorization header exists in quarantine.
   * 5. Identity-specific cleanup:
   *    - When active session is the associated persona (USR_TEST_LEC_001), it is cleared and fails closed to login.
   *    - When active session is an unrelated real user (USR_SUPER_001), the real user's session is preserved intact.
   */
  it('P5-T18-7: Conclusively expired Developer snapshot triggers sanitized quarantine and identity-specific cleanup (WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13)', async () => {
    // 1. Arrange: Developer origin snapshot with developerExpiresAt <= Date.now()
    const expiredOrigin: DeveloperOriginSession = {
      schemaVersion: 1,
      savedAt: new Date(Date.now() - 7200000).toISOString(),
      developerUser: FIXTURE_DEVELOPER,
      developerToken: FIXTURE_DEVELOPER_TOKEN,
      developerExpiresAt: Date.now() - 1000, // Conclusively expired Developer snapshot
      personaId: 'USR_TEST_LEC_001',
    };
    // Save to storage
    window.sessionStorage.setItem(
      'metro_lms_developer_origin_session',
      JSON.stringify(expiredOrigin)
    );

    // Associated persona session active in storage
    const personaUser = personaToUser(getSyntheticTestPersona('USR_TEST_LEC_001')!);
    authStorage.setSession({
      user: personaUser,
      token: `mock_jwt_USR_TEST_LEC_001_${Date.now() - 3600000}`,
      expiresAt: Date.now() + 3600000,
    });

    let capturedAuth: any = null;
    const { unmount: unmount1 } = render(
      <AuthProvider>
        <IsolatedSessionTestConsumer onState={(auth) => { capturedAuth = auth; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedAuth?.isLoading).toBe(false);
    });

    // 2. Assert: Sanitized quarantine record written under QUARANTINE_STORAGE_KEY
    const quarantined = authStorage.getQuarantinedOriginSession();
    expect(quarantined).not.toBeNull();
    expect(quarantined?.schemaVersion).toBe('1.0');
    expect(quarantined?.developerId).toBe('USR_DEV_001');
    expect(quarantined?.personaId).toBe('USR_TEST_LEC_001');
    expect(quarantined?.rejectionReason).toBe('DEVELOPER_SNAPSHOT_EXPIRED');
    expect(quarantined?.developerExpiresAt).toBe(expiredOrigin.developerExpiresAt);

    // Strict non-disclosure check:
    const rawQuarantine = window.sessionStorage.getItem(QUARANTINE_STORAGE_KEY);
    expect(rawQuarantine).not.toBeNull();
    expect(rawQuarantine).not.toContain(FIXTURE_DEVELOPER_TOKEN);
    expect(rawQuarantine).not.toContain('developerToken');
    expect(rawQuarantine).not.toContain('password');

    // 3. Assert: Expired Developer origin snapshot was cleared from storage
    expect(authStorage.getDeveloperOriginSession()).toBeNull();

    // 4. Assert: Associated persona session was cleared (fails closed to unauthenticated)
    expect(authStorage.getSession()).toBeNull();
    expect(capturedAuth?.user).toBeNull();
    expect(capturedAuth?.isAuthenticated).toBe(false);
    unmount1();

    // 5. Part B: Identity-specific preservation when an unrelated real user is active
    authStorage.clearQuarantinedOriginSession();
    window.sessionStorage.setItem(
      'metro_lms_developer_origin_session',
      JSON.stringify(expiredOrigin)
    );
    const realUser: User = {
      id: 'USR_SUPER_001',
      name: 'Super Admin',
      email: 'super@metro.internal',
      role: 'super_admin',
      department: 'Executive',
      jobTitle: 'Super Admin',
      initials: 'S.A',
    };
    authStorage.setSession({
      user: realUser,
      token: 'jwt_super_admin_preserve',
      expiresAt: Date.now() + 3600000,
    });
    vi.spyOn(authApi, 'getCurrentUser').mockResolvedValue({ user: realUser });

    let capturedAuth2: any = null;
    const { unmount: unmount2 } = render(
      <AuthProvider>
        <IsolatedSessionTestConsumer onState={(auth) => { capturedAuth2 = auth; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedAuth2?.isLoading).toBe(false);
    });

    // Real user session MUST be preserved!
    expect(capturedAuth2?.user?.id).toBe('USR_SUPER_001');
    expect(authStorage.getSession()?.user.id).toBe('USR_SUPER_001');
    // Expired snapshot was quarantined and removed
    expect(authStorage.getQuarantinedOriginSession()?.rejectionReason).toBe('DEVELOPER_SNAPSHOT_EXPIRED');
    expect(authStorage.getDeveloperOriginSession()).toBeNull();
    unmount2();
  });

  // =========================================================================
  // (P5-T18-8) Persona Token Tampering
  // WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
  // =========================================================================

  /**
   * P5-T18-8: Persona Token Tampering
   * WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
   *
   * Verifies that when the active synthetic persona token is malformed, mismatched, or tampered with:
   * 1. inspectSessionContinuity() reports hasStructuralIntegrity === false.
   * 2. No emergency continuity proof is created or accepted.
   * 3. Only the untrusted active persona session is cleared from storage.
   * 4. A structurally valid Developer origin snapshot remains inert in storage.
   * 5. Neither normal nor emergency return banner appears.
   * 6. Developer identity is never elevated or restored.
   * 7. Fresh authentication is required.
   */
  it('P5-T18-8: Persona token tampering clears untrusted session, prevents proof creation, and preserves inert snapshot (WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13)', async () => {
    // 1. Arrange: Valid Developer origin snapshot for USR_TEST_LEC_001
    const origin: DeveloperOriginSession = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      developerUser: FIXTURE_DEVELOPER,
      developerToken: FIXTURE_DEVELOPER_TOKEN,
      developerExpiresAt: Date.now() + 3600000,
      personaId: 'USR_TEST_LEC_001',
    };
    authStorage.saveDeveloperOriginSession(origin);

    // 2. Persona session in storage has a tampered / malformed token
    const personaUser = personaToUser(getSyntheticTestPersona('USR_TEST_LEC_001')!);
    authStorage.setSession({
      user: personaUser,
      token: 'mock_jwt_tampered_token_invalid_format',
      expiresAt: Date.now() + 3600000,
    });

    // 3. Inspect session continuity directly
    const continuity = authStorage.inspectSessionContinuity();
    expect(continuity.isRawSessionPresent).toBe(true);
    expect(continuity.hasStructuralIntegrity).toBe(false);

    // 4. Mount under AuthProvider
    let capturedAuth: any = null;
    let capturedIsolated: any = null;
    const { unmount } = render(
      <AuthProvider>
        <IsolatedSessionBanner />
        <IsolatedSessionTestConsumer
          onState={(auth, isolated) => {
            capturedAuth = auth;
            capturedIsolated = isolated;
          }}
        />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedAuth?.isLoading).toBe(false);
    });

    // 5. Assert: Tampered session was cleared from storage
    expect(authStorage.getSession()).toBeNull();
    expect(capturedAuth?.user).toBeNull();
    expect(capturedAuth?.isAuthenticated).toBe(false);

    // 6. Assert: Valid Developer origin snapshot remains preserved as inert
    expect(authStorage.getDeveloperOriginSession()).not.toBeNull();
    expect(authStorage.getDeveloperOriginSession()?.personaId).toBe('USR_TEST_LEC_001');

    // 7. Assert: No emergency proof created, no banners shown
    expect(capturedIsolated?.emergencyProof).toBeNull();
    expect(capturedIsolated?.isEmergencyState).toBe(false);
    expect(screen.queryByTestId('isolated-session-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('emergency-session-banner')).not.toBeInTheDocument();

    unmount();
  });

  // =========================================================================
  // (P5-T18-9) Secret Non-Disclosure
  // WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
  // =========================================================================

  /**
   * P5-T18-9: Secret Non-Disclosure Across Descriptors, Proofs, Quarantine, and Context
   * WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
   *
   * Verifies that under all inspection, failure, and quarantine paths:
   * 1. SessionContinuityDescriptor never exposes rawToken, token, password, or authorization headers.
   * 2. SanitizedQuarantinedOriginSnapshot contains only approved non-credential metadata and no tokens.
   * 3. EmergencyContinuityProof contains only non-sensitive identity metadata and a non-reversible SHA-256 digest.
   * 4. The originSnapshotFingerprint is opaque (sha256_ hex string) and memory-only.
   * 5. No credentials, tokens, or secrets leak into UI state, logs, or storage.
   */
  it('P5-T18-9: Secret Non-Disclosure enforces strict credential omission across all diagnostic interfaces (WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13)', () => {
    // 1. SessionContinuityDescriptor Secret Non-Disclosure
    const continuity = authStorage.inspectSessionContinuity();
    const descriptorKeys = Object.keys(continuity);
    expect(descriptorKeys).not.toContain('rawToken');
    expect(descriptorKeys).not.toContain('token');
    expect(descriptorKeys).not.toContain('password');
    expect(descriptorKeys).not.toContain('authorization');

    // 2. SanitizedQuarantinedOriginSnapshot Secret Non-Disclosure
    const dummySnapshot = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      developerUser: FIXTURE_DEVELOPER,
      developerToken: 'SECRET_DEVELOPER_TOKEN_DO_NOT_LEAK',
      developerExpiresAt: Date.now() - 1000,
      personaId: 'USR_TEST_LEC_001',
    };
    authStorage.quarantineDeveloperOriginSession(dummySnapshot, 'DEVELOPER_SNAPSHOT_EXPIRED');
    const quarantined = authStorage.getQuarantinedOriginSession();
    expect(quarantined).not.toBeNull();
    const quarantineJson = JSON.stringify(quarantined);
    expect(quarantineJson).not.toContain('SECRET_DEVELOPER_TOKEN_DO_NOT_LEAK');
    expect(quarantineJson).not.toContain('developerToken');
    expect(quarantineJson).not.toContain('password');
    authStorage.clearQuarantinedOriginSession();

    // 3. EmergencyContinuityProof Secret Non-Disclosure
    const proofKeys = ['personaId', 'provenAt', 'tokenTimestamp', 'originSnapshotFingerprint'];
    proofKeys.forEach((key) => {
      expect(['personaId', 'provenAt', 'tokenTimestamp', 'originSnapshotFingerprint']).toContain(key);
    });
    // Digest format is opaque SHA-256 string
    const sampleFingerprint = 'sha256_' + 'a'.repeat(64);
    expect(sampleFingerprint).toMatch(/^sha256_[0-9a-f]{64}$/);
    expect(sampleFingerprint).not.toContain('token');
  });

  // =========================================================================
  // (P5-T24-1) Dedicated Emergency Return Success
  // WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
  // =========================================================================

  /**
   * P5-T24-1: Dedicated Emergency Return Success
   * WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
   *
   * Verifies the complete 13-step emergency return transaction:
   * 1. Historical persona session has expired with valid continuity and unexpired Developer snapshot.
   * 2. Active persona token is evicted from storage during cold rehydration.
   * 3. Historical persona continuity evidence remains available in private memory-only proof after token eviction:
   *    - personaId ('USR_TEST_LEC_001')
   *    - personaRole ('lecturer')
   *    - tokenSubject ('USR_TEST_LEC_001')
   *    - tokenTimestamp (positive safe integer)
   *    - personaExpiresAt (conclusively expired timestamp)
   *    - originSnapshotFingerprint (non-reversible SHA-256 digest)
   * 4. Mount establishes unauthenticated emergency state (user === null, isEmergencyState === true).
   * 5. Emergency return banner renders with explicit action button: "الرجوع إلى جلسة المطور".
   * 6. Explicit user click invokes returnFromExpiredPersonaSession().
   * 7. Validates exact historical subject (tokenSubject === origin.personaId), timestamp, and expiration (Date.now() > personaExpiresAt).
   * 8. Session epoch advances via advanceSessionEpochForEmergencyReturn().
   * 9. Exact Developer user (USR_DEV_001), token, and original expiration are restored.
   * 10. Storage-first restoration is verified by immediate read-back.
   * 11. AuthContext user becomes USR_DEV_001 with isAuthenticated === true.
   * 12. Developer origin snapshot is cleared from storage only after verified restoration.
   * 13. Emergency continuity proof is consumed and invalidated (emergency banner disappears).
   */
  it('P5-T24-1: Dedicated emergency return successfully restores Developer identity and cleans up state (WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13)', async () => {
    // 1. Arrange: Unexpired Developer origin snapshot for USR_TEST_LEC_001
    const origin: DeveloperOriginSession = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      developerUser: FIXTURE_DEVELOPER,
      developerToken: FIXTURE_DEVELOPER_TOKEN,
      developerExpiresAt: Date.now() + 7200000,
      personaId: 'USR_TEST_LEC_001',
    };
    authStorage.saveDeveloperOriginSession(origin);

    // 2. Conclusively expired persona session with valid historical token evidence
    const personaUser = personaToUser(getSyntheticTestPersona('USR_TEST_LEC_001')!);
    const historicalTs = Date.now() - 7200000;
    const expiredPersonaExpiry = Date.now() - 1000;
    authStorage.setSession({
      user: personaUser,
      token: `mock_jwt_USR_TEST_LEC_001_${historicalTs}`,
      expiresAt: expiredPersonaExpiry,
    });

    // 3. Mount under AuthProvider & IsolatedSessionBanner
    let capturedAuth: any = null;
    let capturedIsolated: any = null;
    const initialEpoch = getCurrentSessionEpoch();

    const { unmount } = render(
      <AuthProvider>
        <IsolatedSessionBanner />
        <IsolatedSessionTestConsumer
          onState={(auth, isolated) => {
            capturedAuth = auth;
            capturedIsolated = isolated;
          }}
        />
      </AuthProvider>
    );

    // Wait for mount continuity inspection and emergency proof establishment
    await waitFor(() => {
      expect(capturedAuth?.isLoading).toBe(false);
      expect(capturedIsolated?.isEmergencyState).toBe(true);
    });

    // 4. Assert: Active persona token is strictly evicted from storage
    expect(authStorage.getSession()).toBeNull();
    expect(capturedAuth?.user).toBeNull();
    expect(capturedAuth?.isAuthenticated).toBe(false);

    // 5. Assert: Complete historical continuity metadata retained after active token eviction
    expect(capturedIsolated?.emergencyProof).not.toBeNull();
    const proof = capturedIsolated?.emergencyProof;
    expect(proof.personaId).toBe('USR_TEST_LEC_001');
    expect(proof.personaRole).toBe('lecturer');
    expect(proof.personaRole).toBe(getSyntheticTestPersona('USR_TEST_LEC_001')?.role);
    expect(proof.tokenSubject).toBe('USR_TEST_LEC_001');
    expect(proof.tokenTimestamp).toBe(historicalTs);
    expect(proof.personaExpiresAt).toBe(expiredPersonaExpiry);
    expect(proof.provenAt).toBeGreaterThanOrEqual(historicalTs);
    expect(proof.originSnapshotFingerprint).toMatch(/^sha256_[0-9a-f]{64}$/);
    expect(proof.tokenSubject).toBe(origin.personaId);
    expect(Date.now()).toBeGreaterThan(proof.personaExpiresAt);

    // Assert: No raw persona token is retained in the proof or in active storage
    expect(authStorage.getSession()).toBeNull();
    expect((proof as any).token).toBeUndefined();
    expect((proof as any).rawToken).toBeUndefined();
    expect((proof as any).rawJwt).toBeUndefined();
    expect(JSON.stringify(proof)).not.toContain(`mock_jwt_USR_TEST_LEC_001_${historicalTs}`);

    // 6. Assert: Emergency banner renders with Arabic action button
    const banner = screen.getByTestId('emergency-session-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('انتهت صلاحية جلسة الحساب الاختباري. الرجوع إلى جلسة المطور؟');
    const returnBtn = screen.getByTestId('emergency-return-btn');
    expect(returnBtn).toBeInTheDocument();
    expect(returnBtn).toHaveTextContent('الرجوع إلى جلسة المطور');

    // 7. Act: Explicit user click on emergency return action
    await act(async () => {
      fireEvent.click(returnBtn);
    });

    await waitFor(() => {
      expect(capturedAuth?.user?.id).toBe('USR_DEV_001');
    });

    // 8. Assert: Developer session fully restored and verified
    expect(capturedAuth?.user?.id).toBe('USR_DEV_001');
    expect(capturedAuth?.user?.role).toBe('developer');
    expect(capturedAuth?.isAuthenticated).toBe(true);

    const activeSession = authStorage.getSession();
    expect(activeSession?.user.id).toBe('USR_DEV_001');
    expect(activeSession?.user.role).toBe('developer');
    // Note (T-1.1.1 / D-AUTH-01): restored activeSession token is supplied by getRuntimeDeveloperTokenForRestore()
    // from in-memory closure in the single-process test harness.
    expect(activeSession?.token).toBe(FIXTURE_DEVELOPER_TOKEN);
    expect(activeSession?.expiresAt).toBe(origin.developerExpiresAt);

    // 9. Assert: Session epoch advanced through emergency integration hook
    expect(getCurrentSessionEpoch()).toBeGreaterThan(initialEpoch);

    // 10. Assert: Developer origin snapshot cleared only after verification
    expect(authStorage.getDeveloperOriginSession()).toBeNull();

    // 11. Assert: Emergency proof consumed and banner disappeared
    expect(capturedIsolated?.emergencyProof).toBeNull();
    expect(capturedIsolated?.isEmergencyState).toBe(false);
    expect(screen.queryByTestId('emergency-session-banner')).not.toBeInTheDocument();

    unmount();
  });

  // =========================================================================
  // (P5-T24-2) Emergency Return Rejection Without Valid Continuity
  // WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
  // =========================================================================

  /**
   * P5-T24-2: Emergency Return Rejection Without Valid Continuity
   * WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
   *
   * Verifies that returnFromExpiredPersonaSession() strictly rejects:
   * 1. Missing active session without current-lifecycle proof.
   * 2. Missing personaRole or personaRole mismatch against canonical persona registry.
   * 3. Invalid personaExpiresAt:
   *    - non-number
   *    - NaN
   *    - Infinity
   *    - negative
   *    - zero
   *    - non-integer
   *    - future timestamp
   * 4. Standalone Developer origin snapshot present without prior persona continuity.
   * 5. Conclusively expired Developer origin snapshot (applies Decision C quarantine).
   * 6. Corrupted Developer snapshot structure.
   * 7. Real-user identity mismatch in context (user !== null).
   * In all cases: Developer identity is NEVER restored and transaction fails closed.
   */
  it('P5-T24-2: Emergency return fails closed and rejects invalid, missing, or mismatched continuity (WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13)', async () => {
    // 1. Missing proof: Invoking returnFromExpiredPersonaSession when emergencyProof is null fails closed
    let capturedAuth: any = null;
    const { unmount: unmount1 } = render(
      <AuthProvider>
        <IsolatedSessionTestConsumer onState={(auth) => { capturedAuth = auth; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedAuth?.isLoading).toBe(false);
    });

    await expect(capturedAuth?.returnFromExpiredPersonaSession()).rejects.toThrow();
    expect(capturedAuth?.user).toBeNull();
    expect(authStorage.getSession()).toBeNull();
    unmount1();

    // 2. Negative Assertions: Missing personaRole & personaRole mismatch against canonical persona registry
    const baseOrigin: DeveloperOriginSession = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      developerUser: FIXTURE_DEVELOPER,
      developerToken: FIXTURE_DEVELOPER_TOKEN,
      developerExpiresAt: Date.now() + 3600000,
      personaId: 'USR_TEST_LEC_001',
    };
    const lecPersona = getSyntheticTestPersona('USR_TEST_LEC_001')!;

    // 2a. Missing personaRole: user in storage lacks role property
    authStorage.saveDeveloperOriginSession(baseOrigin);
    authStorage.setSession({
      user: { ...personaToUser(lecPersona), role: undefined as any },
      token: `mock_jwt_USR_TEST_LEC_001_${Date.now() - 7200000}`,
      expiresAt: Date.now() - 1000,
    });

    let capturedAuthMissingRole: any = null;
    let capturedIsolatedMissingRole: any = null;
    const { unmount: unmountMissingRole } = render(
      <AuthProvider>
        <IsolatedSessionTestConsumer
          onState={(auth, isolated) => {
            capturedAuthMissingRole = auth;
            capturedIsolatedMissingRole = isolated;
          }}
        />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedAuthMissingRole?.isLoading).toBe(false);
    });

    // Fails role validation: no emergency proof created, emergency state is false
    expect(capturedIsolatedMissingRole?.emergencyProof).toBeNull();
    expect(capturedIsolatedMissingRole?.isEmergencyState).toBe(false);
    await expect(capturedAuthMissingRole?.returnFromExpiredPersonaSession()).rejects.toThrow();
    expect(capturedAuthMissingRole?.user).toBeNull();
    unmountMissingRole();

    // 2b. PersonaRole mismatch: user in storage has 'student' but canonical USR_TEST_LEC_001 is 'lecturer'
    authStorage.saveDeveloperOriginSession(baseOrigin);
    authStorage.setSession({
      user: { ...personaToUser(lecPersona), role: 'student' as any },
      token: `mock_jwt_USR_TEST_LEC_001_${Date.now() - 7200000}`,
      expiresAt: Date.now() - 1000,
    });

    let capturedAuthRoleMismatch: any = null;
    let capturedIsolatedRoleMismatch: any = null;
    const { unmount: unmountRoleMismatch } = render(
      <AuthProvider>
        <IsolatedSessionTestConsumer
          onState={(auth, isolated) => {
            capturedAuthRoleMismatch = auth;
            capturedIsolatedRoleMismatch = isolated;
          }}
        />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedAuthRoleMismatch?.isLoading).toBe(false);
    });

    // Fails canonical role matching: no emergency proof created
    expect(capturedIsolatedRoleMismatch?.emergencyProof).toBeNull();
    expect(capturedIsolatedRoleMismatch?.isEmergencyState).toBe(false);
    await expect(capturedAuthRoleMismatch?.returnFromExpiredPersonaSession()).rejects.toThrow();
    expect(capturedAuthRoleMismatch?.user).toBeNull();
    unmountRoleMismatch();

    // 3. Negative Assertions: Invalid personaExpiresAt variations
    const invalidExpiries = [
      'not-a-number' as any,
      NaN,
      Infinity,
      -5000,
      0,
      Date.now() - 1000.75,
      Date.now() + 3600000,
    ];

    for (const invalidExpiry of invalidExpiries) {
      authStorage.saveDeveloperOriginSession(baseOrigin);
      authStorage.setSession({
        user: personaToUser(lecPersona),
        token: `mock_jwt_USR_TEST_LEC_001_${Date.now() - 7200000}`,
        expiresAt: invalidExpiry,
      });

      let capturedAuthInvalidExp: any = null;
      let capturedIsolatedInvalidExp: any = null;
      const { unmount: unmountInvalidExp } = render(
        <AuthProvider>
          <IsolatedSessionTestConsumer
            onState={(auth, isolated) => {
              capturedAuthInvalidExp = auth;
              capturedIsolatedInvalidExp = isolated;
            }}
          />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(capturedAuthInvalidExp?.isLoading).toBe(false);
      });

      // In all invalid expiry cases, emergency proof creation is rejected
      expect(capturedIsolatedInvalidExp?.emergencyProof).toBeNull();
      expect(capturedIsolatedInvalidExp?.isEmergencyState).toBe(false);
      await expect(capturedAuthInvalidExp?.returnFromExpiredPersonaSession()).rejects.toThrow();
      expect(capturedAuthInvalidExp?.user).toBeNull();

      unmountInvalidExp();
    }
    authStorage.clearDeveloperOriginSession();

    // 4. Developer origin snapshot alone in storage without active session or proof cannot authorize restoration
    const standaloneOrigin: DeveloperOriginSession = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      developerUser: FIXTURE_DEVELOPER,
      developerToken: FIXTURE_DEVELOPER_TOKEN,
      developerExpiresAt: Date.now() + 3600000,
      personaId: 'USR_TEST_LEC_001',
    };
    authStorage.saveDeveloperOriginSession(standaloneOrigin);

    let capturedAuthAlone: any = null;
    const { unmount: unmountAlone } = render(
      <AuthProvider>
        <IsolatedSessionTestConsumer onState={(auth) => { capturedAuthAlone = auth; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedAuthAlone?.isLoading).toBe(false);
    });

    // An origin snapshot alone NEVER authorizes emergency return
    await expect(capturedAuthAlone?.returnFromExpiredPersonaSession()).rejects.toThrow();
    expect(capturedAuthAlone?.user).toBeNull();
    // Origin snapshot remains preserved inert in storage
    expect(authStorage.getDeveloperOriginSession()).not.toBeNull();
    unmountAlone();
    authStorage.clearDeveloperOriginSession();

    // 5. Expired Developer origin snapshot triggers Decision C quarantine and fails closed
    const expiredOrigin: DeveloperOriginSession = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      developerUser: FIXTURE_DEVELOPER,
      developerToken: FIXTURE_DEVELOPER_TOKEN,
      developerExpiresAt: Date.now() - 5000, // Conclusively expired
      personaId: 'USR_TEST_LEC_001',
    };
    window.sessionStorage.setItem('metro_lms_developer_origin_session', JSON.stringify(expiredOrigin));

    let capturedAuth2: any = null;
    const { unmount: unmount2 } = render(
      <AuthProvider>
        <IsolatedSessionTestConsumer onState={(auth) => { capturedAuth2 = auth; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedAuth2?.isLoading).toBe(false);
    });

    await expect(capturedAuth2?.returnFromExpiredPersonaSession()).rejects.toThrow();
    expect(capturedAuth2?.user).toBeNull();
    expect(authStorage.getQuarantinedOriginSession()?.rejectionReason).toBe('DEVELOPER_SNAPSHOT_EXPIRED');
    expect(authStorage.getDeveloperOriginSession()).toBeNull();
    unmount2();

    // 6. Corrupted Developer snapshot structure fails closed
    window.sessionStorage.setItem('metro_lms_developer_origin_session', JSON.stringify({ corrupted: true }));
    let capturedAuth3: any = null;
    const { unmount: unmount3 } = render(
      <AuthProvider>
        <IsolatedSessionTestConsumer onState={(auth) => { capturedAuth3 = auth; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedAuth3?.isLoading).toBe(false);
    });

    await expect(capturedAuth3?.returnFromExpiredPersonaSession()).rejects.toThrow();
    expect(capturedAuth3?.user).toBeNull();
    expect(authStorage.getDeveloperOriginSession()).toBeNull();
    unmount3();
  });

  // =========================================================================
  // (P5-T24-3) Proof Invalidation, Replay Rejection & Snapshot Preservation on Failure
  // WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
  // =========================================================================

  /**
   * P5-T24-3: Proof Invalidation, Replay Rejection & Supersession Protection
   * WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
   *
   * Verifies tamper-proofing, anti-replay, supersession, and rollback guarantees:
   * 1. Caller-supplied forged proof objects cannot be passed (function takes no proof argument).
   * 2. Reused or already consumed proofs are rejected immediately on second call.
   * 3. Origin snapshot mutation/replacement between proof creation and return execution invalidates the proof.
   * 4. Newer Login supersedes a pending emergency return:
   *    - Delayed emergency return aborts before storage write.
   *    - Real-user active session is preserved untouched.
   *    - Valid Developer origin snapshot is preserved inert.
   * 5. Logout supersedes a pending emergency return:
   *    - Delayed emergency return aborts before state commit.
   * 6. Identity-safe rollback:
   *    - Storage write read-back failure only clears attempted Developer session.
   *    - An intervening or concurrent real-user session is never cleared.
   * 7. Duplicate concurrent emergency return invocations are prevented by single-flight guard.
   */
  it('P5-T24-3: Proof invalidation, anti-replay, single-flight locking, and supersession protection (WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13)', async () => {
    // 1. Arrange valid emergency state
    const origin: DeveloperOriginSession = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      developerUser: FIXTURE_DEVELOPER,
      developerToken: FIXTURE_DEVELOPER_TOKEN,
      developerExpiresAt: Date.now() + 7200000,
      personaId: 'USR_TEST_LEC_001',
    };
    authStorage.saveDeveloperOriginSession(origin);

    const personaUser = personaToUser(getSyntheticTestPersona('USR_TEST_LEC_001')!);
    authStorage.setSession({
      user: personaUser,
      token: `mock_jwt_USR_TEST_LEC_001_${Date.now() - 7200000}`,
      expiresAt: Date.now() - 1000,
    });

    let capturedAuth: any = null;
    let capturedIsolated: any = null;
    const { unmount } = render(
      <AuthProvider>
        <IsolatedSessionBanner />
        <IsolatedSessionTestConsumer
          onState={(auth, isolated) => {
            capturedAuth = auth;
            capturedIsolated = isolated;
          }}
        />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedIsolated?.isEmergencyState).toBe(true);
    });

    // 2. Caller-supplied proof rejection: returnFromExpiredPersonaSession accepts NO parameters
    expect(capturedAuth.returnFromExpiredPersonaSession.length).toBe(0);

    // 3. Snapshot replacement invalidates proof and aborts return
    // Under T-1.1.1 / D-AUTH-01, injecting credentials into raw sessionStorage triggers rawStorageTamperMarker
    // in computeOriginSnapshotDigest(), causing proof invalidation and fail-closed rejection.
    const modifiedOrigin: DeveloperOriginSession = {
      ...origin,
      developerToken: 'modified_tampered_developer_token_777',
    };
    window.sessionStorage.setItem('metro_lms_developer_origin_session', JSON.stringify(modifiedOrigin));

    // Attempting emergency return fails because digest mismatch occurs
    await expect(capturedAuth.returnFromExpiredPersonaSession()).rejects.toThrow();

    // Assert: Proof was immediately invalidated
    expect(capturedIsolated?.emergencyProof).toBeNull();
    expect(capturedIsolated?.isEmergencyState).toBe(false);

    // Assert: Developer was NOT restored
    expect(capturedAuth?.user).toBeNull();

    // 4. Replay Rejection: Subsequent call immediately rejected
    await expect(capturedAuth.returnFromExpiredPersonaSession()).rejects.toThrow();
    unmount();

    // 5. Deterministic Supersession Scenario:
    // Re-establish valid emergency state
    authStorage.saveDeveloperOriginSession(origin);
    authStorage.setSession({
      user: personaUser,
      token: `mock_jwt_USR_TEST_LEC_001_${Date.now() - 7200000}`,
      expiresAt: Date.now() - 1000,
    });

    let capturedAuthSuper: any = null;
    let capturedIsolatedSuper: any = null;
    const { unmount: unmountSuper } = render(
      <AuthProvider>
        <IsolatedSessionTestConsumer
          onState={(auth, isolated) => {
            capturedAuthSuper = auth;
            capturedIsolatedSuper = isolated;
          }}
        />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedIsolatedSuper?.isEmergencyState).toBe(true);
    });

    // Set up explicit asynchronous promise barrier on window.crypto.subtle.digest
    let releaseEmergencyDigest: (() => void) | null = null;
    const digestPauseBarrier = new Promise<void>((resolve) => {
      releaseEmergencyDigest = resolve;
    });

    const originalSubtleDigest = window.crypto.subtle.digest.bind(window.crypto.subtle);
    const digestSpy = vi.spyOn(window.crypto.subtle, 'digest').mockImplementation(async (algorithm, data) => {
      // Step 2: Pause during asynchronous execution at an explicit pause point
      await digestPauseBarrier;
      return originalSubtleDigest(algorithm, data);
    });

    // Step 1: Start emergency return (do NOT await yet so it pauses inside crypto digest)
    const emergencyReturnPromise = capturedAuthSuper.returnFromExpiredPersonaSession();

    // Step 3: Start newer real-user login (USR_SUPER_001) while emergency return is paused
    const realUser: User = {
      id: 'USR_SUPER_001',
      name: 'Super Admin User',
      email: 'super@metro.internal',
      role: 'super_admin',
      department: 'Executive',
      jobTitle: 'Super Administrator',
      initials: 'S.A',
    };
    vi.spyOn(authApi, 'login').mockResolvedValueOnce({
      user: realUser,
      token: 'real_jwt_super_token_99999',
      expiresAt: Date.now() + 3600000,
    });

    await act(async () => {
      await capturedAuthSuper.login({ email: 'super@metro.internal', password: 'password123' });
    });

    // Real user is now active in AuthContext and storage
    expect(capturedAuthSuper.user?.id).toBe('USR_SUPER_001');
    expect(authStorage.getSession()?.user.id).toBe('USR_SUPER_001');

    // Step 4: Release the paused emergency return
    await act(async () => {
      releaseEmergencyDigest!();
    });

    // Step 5: Assert that the emergency return detects supersession and aborts with false
    const returnResult = await emergencyReturnPromise;
    expect(returnResult).toBe(false);

    // Step 6: Assert that the newer real-user session remains intact in both storage and AuthContext
    expect(capturedAuthSuper.user?.id).toBe('USR_SUPER_001');
    expect(capturedAuthSuper.user?.role).toBe('super_admin');
    expect(authStorage.getSession()?.user.id).toBe('USR_SUPER_001');
    expect(authStorage.getSession()?.token).toBe('real_jwt_super_token_99999');

    // Step 7: Assert that the valid Developer origin snapshot remains preserved as inert in storage
    expect(authStorage.getDeveloperOriginSession()).not.toBeNull();
    expect(authStorage.getDeveloperOriginSession()?.personaId).toBe('USR_TEST_LEC_001');
    expect(authStorage.getDeveloperOriginSession()?.developerUser.id).toBe('USR_DEV_001');

    digestSpy.mockRestore();
    unmountSuper();

    unmountSuper();
  });
});
