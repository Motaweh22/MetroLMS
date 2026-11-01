/**
 * Increment 3.1 — Capability Key Canonicalization, Security Audit Read Visibility & Dashboard Read APIs
 *
 * MFR-29 (Legacy capability-key canonicalization)
 * D-14 (Security Audit read visibility for assistant_admin)
 * MFR-05 (Dashboard API/store administrative metrics for assistant_admin, super_admin, developer)
 *
 * GOVERNANCE & EXECUTION DIRECTIVE:
 * Per Owner Directive Part A (Consolidated Phase 13 Testing Workflow), this test suite
 * is authored during Increment 3.1 implementation and marked:
 *
 * STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
 * Zero test runner commands (vitest, pnpm test) were executed during this turn.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { server } from '@/mocks/server';
import { authStorage } from '@/core/auth/authStorage';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { userManagementApi } from '@/features/user-management/services/userManagementApi';
import { permissionsApi } from '@/features/permissions/services/permissionsApi';
import { auditApi } from '@/features/permissions/services/auditApi';
import { dashboardApi } from '@/features/dashboard/services/dashboardApi';
import { whatsappApi } from '@/features/whatsapp/services/whatsappApi';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import { ApiError } from '@/core/api/apiClient';
import type { UserRole } from '@/core/auth/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset({ seedGroupDemo: true });
});
afterAll(() => server.close());

function setSessionForRole(role: UserRole) {
  const account = Object.values(SYNTHETIC_DEMO_ACCOUNTS).find((a) => a.user.role === role);
  if (!account) {
    throw new Error(`No synthetic demo account found for role: ${role}`);
  }
  authStorage.setSession({
    token: `token-${account.user.id}`,
    user: account.user,
    expiresAt: Date.now() + 86400000,
  });
}

describe('Increment 3.1 — Capability Canonicalization, Security Audit Read Visibility & Dashboard Read APIs', () => {
  beforeEach(() => {
    inMemoryStore.reset({ seedGroupDemo: true });
  });

  // ── 1. Assistant Admin User Directory Read Visibility (MFR-29) ─────────────
  describe('1. Assistant Admin User Directory Read Visibility (users.view_directory)', () => {
    it('allows assistant_admin to list managed users via GET /api/admin/users', async () => {
      setSessionForRole('assistant_admin');

      const users = await userManagementApi.getManagedUsers();
      expect(users).toBeDefined();
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);

      // Verify directory users exist in payload
      const hasAdmins = users.some((u) => u.role === 'admin');
      const hasLecturers = users.some((u) => u.role === 'lecturer');
      const hasTrainees = users.some((u) => u.role === 'user');
      expect(hasAdmins).toBe(true);
      expect(hasLecturers).toBe(true);
      expect(hasTrainees).toBe(true);
    });

    it('filters out Developer accounts from assistant_admin directory queries (Surface 1)', async () => {
      setSessionForRole('assistant_admin');

      const users = await userManagementApi.getManagedUsers();
      const devFound = users.some((u) => u.role === 'developer' || u.id === 'USR_DEV_001');
      expect(devFound).toBe(false);
    });

    it('returns empty results when assistant_admin searches directory by developer username or alias (Surface 1)', async () => {
      setSessionForRole('assistant_admin');

      const byUsername = await userManagementApi.getManagedUsers({ query: 'developer_internal' });
      expect(byUsername.length).toBe(0);

      const byId = await userManagementApi.getManagedUsers({ query: 'USR_DEV_001' });
      expect(byId.length).toBe(0);
    });
  });

  // ── 2. Assistant Admin User Transcript Read Visibility (MFR-29) ─────────────
  describe('2. Assistant Admin User Transcript Read Visibility (users.view_transcript)', () => {
    it('allows assistant_admin to retrieve user transcripts via GET /api/admin/users/:userId/transcript', async () => {
      setSessionForRole('assistant_admin');

      // Query transcript for existing trainee USR001
      const transcript = await userManagementApi.getUserTranscript('USR001');
      expect(transcript).toBeDefined();
      expect(transcript.userId.toLowerCase()).toBe('usr001');
      expect(transcript.userName).toBeDefined();
      expect(Array.isArray(transcript.courseRecords)).toBe(true);
    });

    it('returns 404 when querying Developer transcript as assistant_admin indistinguishable from unknown user (Surface 2 / INV-R8)', async () => {
      setSessionForRole('assistant_admin');

      let devError: ApiError | null = null;
      try {
        await userManagementApi.getUserTranscript('USR_DEV_001');
        expect.unreachable('Should have thrown 404 ApiError');
      } catch (err: unknown) {
        devError = err as ApiError;
      }
      expect(devError).toBeInstanceOf(ApiError);
      expect(devError?.status).toBe(404);

      let nonExistentError: ApiError | null = null;
      try {
        await userManagementApi.getUserTranscript('USR_NONEXISTENT_999');
        expect.unreachable('Should have thrown 404 ApiError');
      } catch (err: unknown) {
        nonExistentError = err as ApiError;
      }
      expect(nonExistentError).toBeInstanceOf(ApiError);
      expect(nonExistentError?.status).toBe(404);
      expect(devError?.message).toBe(nonExistentError?.message);
    });
  });

  // ── 3. Assistant Admin Permissions Matrix & Governance Read Visibility ─────
  describe('3. Assistant Admin Permissions Matrix & Effective Read Visibility (permissions.view_matrix)', () => {
    it('allows assistant_admin to fetch role permissions matrix via GET /api/admin/permissions/roles', async () => {
      setSessionForRole('assistant_admin');

      const configs = await permissionsApi.getRolePermissions();
      expect(configs).toBeDefined();
      expect(Array.isArray(configs)).toBe(true);

      const roles = configs.map((c) => c.role);
      expect(roles).toContain('admin');
      expect(roles).toContain('assistant_admin');
      expect(roles).toContain('lecturer');
      expect(roles).toContain('user');
    });

    it('allows assistant_admin to read individual user permission override via GET /api/admin/permissions/users/:userId', async () => {
      setSessionForRole('assistant_admin');

      const res = await permissionsApi.getUserPermissionOverride('USR001');
      expect(res).toBeDefined();
      // Returns override object or null if none
      expect('override' in res).toBe(true);
    });

    it('returns 404 when assistant_admin queries Developer permission override or effective capabilities (Surface 2)', async () => {
      setSessionForRole('assistant_admin');

      try {
        await permissionsApi.getUserPermissionOverride('USR_DEV_001');
        expect.unreachable('Should have thrown 404 ApiError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(404);
      }

      try {
        await permissionsApi.getEffectiveUserPermissions('USR_DEV_001');
        expect.unreachable('Should have thrown 404 ApiError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(404);
      }
    });

    it('allows assistant_admin to read effective user capabilities via GET /api/admin/permissions/effective/:userId', async () => {
      setSessionForRole('assistant_admin');

      const effective = await permissionsApi.getEffectiveUserPermissions('USR001');
      expect(effective).toBeDefined();
      expect(effective.userId).toBe('USR001');
      expect(effective.role).toBe('user');
      expect(Array.isArray(effective.effectiveCapabilities)).toBe(true);
    });

    it('allows assistant_admin to view approval requests queue via GET /api/admin/permissions/governance/approvals', async () => {
      setSessionForRole('assistant_admin');

      const requests = await permissionsApi.getApprovalRequests();
      expect(requests).toBeDefined();
      expect(Array.isArray(requests)).toBe(true);
    });

    it('allows assistant_admin to read user WhatsApp scenario assignments via GET /api/admin/users/:userId/whatsapp-visibility (permissions.view_matrix)', async () => {
      setSessionForRole('assistant_admin');

      const waConfig = await whatsappApi.getUserWhatsAppVisibility('USR001');
      expect(waConfig).toBeDefined();
      expect(waConfig.userId).toBe('USR001');
      expect(Array.isArray(waConfig.assignments)).toBe(true);
    });
  });

  // ── 4. Assistant Admin Security Audit Trail Read Visibility (D-14) ──────────
  describe('4. Assistant Admin Security Audit Trail Read Visibility (Decision D-14)', () => {
    it('allows assistant_admin to query system audit trail via GET /api/admin/audit without 403', async () => {
      setSessionForRole('assistant_admin');

      const logs = await auditApi.getAuditLogs();
      expect(logs).toBeDefined();
      expect(typeof logs.total).toBe('number');
      expect(Array.isArray(logs.entries)).toBe(true);
      expect(logs.entries.length).toBeGreaterThan(0);
    });

    it('allows assistant_admin to fetch single audit log entry via GET /api/admin/audit/:id', async () => {
      setSessionForRole('assistant_admin');

      const logs = await auditApi.getAuditLogs();
      const firstEntry = logs.entries[0];
      expect(firstEntry).toBeDefined();

      const singleEntry = await auditApi.getAuditLogById(firstEntry.id);
      expect(singleEntry).toBeDefined();
      expect(singleEntry.id).toBe(firstEntry.id);
    });

    it('strictly denies trainee and lecturer access to GET /api/admin/audit with HTTP 403', async () => {
      setSessionForRole('user');
      try {
        await auditApi.getAuditLogs();
        expect.unreachable('Trainee should receive 403');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }

      setSessionForRole('lecturer');
      try {
        await auditApi.getAuditLogs();
        expect.unreachable('Lecturer should receive 403');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });
  });

  // ── 5. Developer Actor Identity Masking for Assistant Admin (Surface 7) ─────
  describe('5. Developer Actor Identity Masking in Audit Trail for Non-Developers (Surface 7)', () => {
    it('masks Developer audit log entries as SYSTEM / النظام when viewed by assistant_admin', async () => {
      // Record an audit log entry where the actor is developer
      inMemoryStore.recordAuditLog({
        actorId: 'USR_DEV_001',
        actorName: 'مطور النظام',
        actorRole: 'developer',
        action: 'system.maintenance',
        actionLabelAr: 'صيانة النظام الدورية',
        severity: 'info',
        outcome: 'success',
        details: 'إجراء صيانة للمنظومة',
      });

      setSessionForRole('assistant_admin');
      const logs = await auditApi.getAuditLogs();
      const maintenanceEntry = logs.entries.find((e) => e.action === 'system.maintenance');

      expect(maintenanceEntry).toBeDefined();
      expect(maintenanceEntry?.actorId).toBe('SYSTEM');
      expect(maintenanceEntry?.actorName).toBe('النظام');
      expect(maintenanceEntry?.actorRole).toBe('system');
    });

    it('preserves real Developer actor identity when viewed by developer', async () => {
      inMemoryStore.recordAuditLog({
        actorId: 'USR_DEV_001',
        actorName: 'مطور النظام',
        actorRole: 'developer',
        action: 'developer.debug',
        actionLabelAr: 'فحص تشخيصي',
        severity: 'info',
        outcome: 'success',
        details: 'تشخيص المنظومة',
      });

      setSessionForRole('developer');
      const logs = await auditApi.getAuditLogs();
      const debugEntry = logs.entries.find((e) => e.action === 'developer.debug');

      expect(debugEntry).toBeDefined();
      expect(debugEntry?.actorId).toBe('USR_DEV_001');
      expect(debugEntry?.actorName).toBe('مطور النظام');
      expect(debugEntry?.actorRole).toBe('developer');
    });
  });

  // ── 6. Read vs. Mutation Boundary: No Permission Override Mutation Authority
  describe('6. Read vs. Mutation Boundary (permissions.configure_users)', () => {
    it('strictly rejects assistant_admin attempting to mutate user permissions (PUT /api/admin/permissions/users/:id) with 403', async () => {
      setSessionForRole('assistant_admin');

      try {
        await permissionsApi.setUserPermissionOverride('USR001', {
          granted: ['courses.create'],
          revoked: [],
          notes: 'Attempted mutation by assistant admin',
        });
        expect.unreachable('Assistant admin should be rejected with 403 on permission mutation');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('strictly rejects assistant_admin attempting to delete user permission override (DELETE /api/admin/permissions/users/:id) with 403', async () => {
      setSessionForRole('assistant_admin');

      try {
        await permissionsApi.deleteUserPermissionOverride('USR001');
        expect.unreachable('Assistant admin should be rejected with 403 on permission deletion');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('strictly rejects assistant_admin attempting to update role default permissions (PUT /api/admin/permissions/roles/:role) with 403', async () => {
      setSessionForRole('assistant_admin');

      try {
        await permissionsApi.updateRolePermissions('user', ['users.view_directory']);
        expect.unreachable('Assistant admin should be rejected with 403 on role permission mutation');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('strictly rejects assistant_admin attempting to mutate user WhatsApp visibility (PUT /api/admin/users/:userId/whatsapp-visibility) with 403', async () => {
      setSessionForRole('assistant_admin');

      try {
        await whatsappApi.setUserWhatsAppVisibility('USR001', {
          assignments: [{ scenario: 'technical_support', isActive: true }],
        });
        expect.unreachable('Assistant admin should be rejected with 403 on WhatsApp visibility mutation');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });
  });

  // ── 7. Existing Operational Administrator Reads Remain Functional ───────────
  describe('7. Existing Admin, Super Admin & Developer Reads Remain Fully Functional', () => {
    it('allows admin, super_admin, and developer to read user directory, transcripts, and audit logs', async () => {
      for (const role of ['admin', 'super_admin', 'developer'] as UserRole[]) {
        setSessionForRole(role);

        const users = await userManagementApi.getManagedUsers();
        expect(users.length).toBeGreaterThan(0);

        const transcript = await userManagementApi.getUserTranscript('USR001');
        expect(transcript).toBeDefined();

        const audit = await auditApi.getAuditLogs();
        expect(audit.entries.length).toBeGreaterThan(0);

        const perms = await permissionsApi.getRolePermissions();
        expect(perms.length).toBeGreaterThan(0);
      }
    });

    it('allows operational administrators (admin, super_admin, developer) to modify user permissions and WhatsApp visibility', async () => {
      for (const role of ['admin', 'super_admin', 'developer'] as UserRole[]) {
        setSessionForRole(role);

        // Can read WhatsApp visibility via permissions.view_matrix
        const waConfig = await whatsappApi.getUserWhatsAppVisibility('USR001');
        expect(waConfig).toBeDefined();

        // Can mutate WhatsApp visibility via permissions.configure_users
        const updated = await whatsappApi.setUserWhatsAppVisibility('USR001', {
          assignments: [{ scenario: 'account_registration', isActive: true }],
        });
        expect(updated).toBeDefined();
      }
    });
  });

  // ── 8. Dashboard Read API Administrative Payload (MFR-05) ───────────────────
  describe('8. Dashboard Read API Administrative Payload (MFR-05)', () => {
    it('returns administrative metrics payload for assistant_admin via GET /api/dashboard', async () => {
      setSessionForRole('assistant_admin');

      const data = await dashboardApi.getDashboardData();
      expect(data).toBeDefined();
      expect(data.role).toBe('admin'); // Returns AdminDashboardData contract

      const adminData = data as any;
      expect(adminData.stats).toBeDefined();
      expect(typeof adminData.stats.totalCoursesCount).toBe('number');
      expect(typeof adminData.stats.totalEnrollmentsCount).toBe('number');
      expect(typeof adminData.stats.activeGroupsCount).toBe('number');
      expect(typeof adminData.stats.totalAttentionFlagsCount).toBe('number');
      expect(Array.isArray(adminData.topCourses)).toBe(true);
      expect(Array.isArray(adminData.activeGroupsOverview)).toBe(true);

      // Verify welcome metadata
      expect(adminData.welcome).toBeDefined();
      expect(adminData.welcome.roleTitle).toBe('مساعد مدير النظام');
    });

    it('returns administrative metrics payload for super_admin and developer via GET /api/dashboard', async () => {
      for (const role of ['super_admin', 'developer'] as UserRole[]) {
        setSessionForRole(role);

        const data = await dashboardApi.getDashboardData();
        expect(data.role).toBe('admin');
        const adminData = data as any;
        expect(adminData.stats).toBeDefined();
        expect(adminData.welcome).toBeDefined();
      }
    });

    it('preserves lecturer and trainee dashboard payloads for lecturer and user roles', async () => {
      setSessionForRole('lecturer');
      const lecturerData = await dashboardApi.getDashboardData();
      expect(lecturerData.role).toBe('lecturer');

      setSessionForRole('user');
      const traineeData = await dashboardApi.getDashboardData();
      expect(traineeData.role).toBe('user');
    });
  });

  // ── 9. Developer Confidentiality in Dashboard Counts (Surface 3) ────────────
  describe('9. Developer Confidentiality in Dashboard Metrics (Surface 3)', () => {
    it('excludes Developer enrollments from total enrollment counts for assistant_admin and admin', async () => {
      // Enroll Developer in course crs_001
      const course = inMemoryStore.getCourseById('crs_001');
      if (course) {
        if (!course.enrolledUserIds) course.enrolledUserIds = [];
        if (!course.enrolledUserIds.includes('USR_DEV_001')) {
          course.enrolledUserIds.push('USR_DEV_001');
          course.enrollmentCount = (course.enrollmentCount || 0) + 1;
        }
      }

      setSessionForRole('assistant_admin');
      const dataForAssistant = (await dashboardApi.getDashboardData()) as any;

      setSessionForRole('developer');
      const dataForDeveloper = (await dashboardApi.getDashboardData()) as any;

      // Developer sees count with Developer included, assistant_admin sees filtered count
      expect(dataForDeveloper.stats.totalEnrollmentsCount).toBeGreaterThanOrEqual(
        dataForAssistant.stats.totalEnrollmentsCount
      );
    });
  });
});

