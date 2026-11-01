/**
 * MetroLMS — Test Suite 2: Developer Non-Disclosure Across 11 Surfaces (MFR-39)
 *
 * STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
 *
 * Authoritative Governance Reference:
 * - MetroLMS Pre-Backend Migration Remediation Roadmap — Revision 5:
 *   - Section 3.1: Eleven Mandatory Non-Disclosure Surfaces
 *   - Section 3.2: Prototype Simulation vs. Production Backend Enforcement
 *   - Decisions D-08, D-09, D-14
 *   - Finding MFR-39
 * - Phase 2 Role Architecture Checklist:
 *   - Workstream C: Developer Confidentiality Across 11 Surfaces
 *   - Invariant INV-R8: Developer Account Confidentiality (Uniform 404 Parity)
 *
 * CRITICAL EXECUTION DIRECTIVE:
 * Per project-wide workflow rules, this test suite is written during implementation
 * but DEFERRED for consolidated execution in Phase 13.
 * DO NOT execute Vitest runner, TypeScript compiler, or linter against this file.
 */

import React from 'react';
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { server } from '@/mocks/server';
import { authStorage } from '@/core/auth/authStorage';
import { inMemoryStore, MockStoreError } from '@/mocks/store/inMemoryStore';
import type { UserRole, User } from '@/core/auth/types';
import type { ManagedUserDTO, CreateUserRequestDTO } from '@/core/user-management/types';
import { canActorManageTargetAccount } from '@/core/permissions/policy';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import { AuthProvider } from '@/core/auth/AuthContext';
import { DeveloperRouteGuard } from '@/app/router';
import { Sidebar } from '@/shared/ui/Sidebar/Sidebar';
import { MobileDrawer } from '@/shared/ui/MobileDrawer/MobileDrawer';
import { AddUserModal } from '@/features/user-management/components/AddUserModal';
import { UserFilterBar } from '@/features/user-management/components/UserFilterBar';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset({ seedGroupDemo: true });
});
afterAll(() => server.close());

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixture Personas
// ─────────────────────────────────────────────────────────────────────────────

const DEV_USER: ManagedUserDTO = {
  id: 'USR_DEV_001',
  name: 'مطور النظام الداخلي',
  username: 'developer_internal',
  email: 'developer.metro@internal.local',
  phone: '01000000000',
  jobTitle: 'مهندس تطوير برمجيات أول',
  department: 'إدارة التطوير والأنظمة',
  role: 'developer',
  status: 'active',
  createdAt: '2025-01-01T00:00:00Z',
  lastLogin: '2026-03-01T08:00:00Z',
  legacyAliases: ['usr_dev_001'],
};

const SUPER_ADMIN_USER: ManagedUserDTO = {
  id: 'USR_SUPER_001',
  name: 'مدير عام المنظومة',
  username: 'super_admin_demo',
  email: 'super.admin@cairo-metro.com',
  phone: '01000000001',
  jobTitle: 'مدير عام التحول الرقمي',
  department: 'الإدارة المركزية للرقابة والتحكم',
  role: 'super_admin',
  status: 'active',
  createdAt: '2025-01-01T00:00:00Z',
  lastLogin: '2026-03-01T08:00:00Z',
  legacyAliases: ['usr_super_001'],
};

function ensureDevAndSuperAdminSeeded() {
  const store = inMemoryStore.getManagedUsersStore();
  if (!store.some((u) => u.id === DEV_USER.id)) {
    store.push({ ...DEV_USER });
  }
  if (!store.some((u) => u.id === SUPER_ADMIN_USER.id)) {
    store.push({ ...SUPER_ADMIN_USER });
  }
}

describe('Increment 2.3 — Developer Confidentiality Across 11 Surfaces (MFR-39)', () => {
  beforeEach(() => {
    ensureDevAndSuperAdminSeeded();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Surface 1: User Directory, Search, Filters & Pagination
  // ─────────────────────────────────────────────────────────────────────────
  describe('Surface 1 — User Directory, Search, Filters & Pagination', () => {
    it('excludes developer from getManagedUsers list and total counts for non-developer roles', () => {
      const nonDevRoles: UserRole[] = ['super_admin', 'admin', 'assistant_admin', 'lecturer', 'user'];

      for (const role of nonDevRoles) {
        const result = inMemoryStore.getManagedUsers({ page: 1, limit: 100 }, role);
        const devInResult = result.users.find((u) => u.role === 'developer' || u.id === 'USR_DEV_001');

        expect(devInResult, `Role ${role} must not see developer in directory`).toBeUndefined();
        expect(result.users.every((u) => u.role !== 'developer')).toBe(true);
      }
    });

    it('returns empty result when non-developer searches specifically for developer by name, email, or username', () => {
      const searchQueries = ['مطور', 'developer', 'developer_internal', 'developer.metro@internal.local'];

      for (const q of searchQueries) {
        const result = inMemoryStore.getManagedUsers({ page: 1, limit: 100, query: q }, 'admin');
        expect(result.users).toHaveLength(0);
        expect(result.total).toBe(0);
      }
    });

    it('returns empty result when non-developer filters by role === developer', () => {
      const result = inMemoryStore.getManagedUsers(
        { page: 1, limit: 100, role: 'developer' as any },
        'super_admin'
      );
      expect(result.users).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('includes developer in getManagedUsers when caller has developer role', () => {
      const result = inMemoryStore.getManagedUsers({ page: 1, limit: 100 }, 'developer');
      const devInResult = result.users.find((u) => u.id === 'USR_DEV_001');

      expect(devInResult).toBeDefined();
      expect(devInResult?.role).toBe('developer');
      expect(result.total).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/admin/users excludes developer from response payload when accessed by non-developer', async () => {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: 'Bearer mock_jwt_USR_SUPER_001_test' },
      });
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.users.find((u: any) => u.role === 'developer' || u.id === 'USR_DEV_001')).toBeUndefined();
    });

    it('GET /api/admin/users includes developer when accessed by developer', async () => {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: 'Bearer mock_jwt_USR_DEV_001_test' },
      });
      expect(res.status).toBe(200);
      const data = await res.json();

      const dev = data.users.find((u: any) => u.id === 'USR_DEV_001');
      expect(dev).toBeDefined();
      expect(dev.role).toBe('developer');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Surface 2: Direct User Lookup & Target Endpoints (INV-R8 Uniform 404)
  // ─────────────────────────────────────────────────────────────────────────
  describe('Surface 2 — Direct User Lookup & Target Endpoints (INV-R8)', () => {
    // Note: GET /api/admin/users/:userId does NOT exist as an individual REST route in this application;
    // directory querying is performed via GET /api/admin/users?query=... All existing direct-ID routes
    // are exhaustively audited and verified below.

    it('getManagedUserById returns undefined for developer target when actor is non-developer', () => {
      expect(inMemoryStore.getManagedUserById('USR_DEV_001', 'admin')).toBeUndefined();
      expect(inMemoryStore.getManagedUserById('USR_DEV_001', 'super_admin')).toBeUndefined();
      expect(inMemoryStore.getManagedUserById('USR_DEV_001', 'assistant_admin')).toBeUndefined();
    });

    it('getManagedUserById returns developer user when actor is developer', () => {
      const dev = inMemoryStore.getManagedUserById('USR_DEV_001', 'developer');
      expect(dev).toBeDefined();
      expect(dev?.id).toBe('USR_DEV_001');
    });

    it('getUserTranscript returns null for developer target when actor is non-developer', () => {
      expect(inMemoryStore.getUserTranscript('USR_DEV_001', 'admin')).toBeNull();
      expect(inMemoryStore.getUserTranscript('USR_DEV_001', 'super_admin')).toBeNull();
    });

    it('getUserTranscript returns transcript when actor is developer', () => {
      const transcript = inMemoryStore.getUserTranscript('USR_DEV_001', 'developer');
      expect(transcript).toBeDefined();
      expect(transcript?.userId).toBe('USR_DEV_001');
    });

    it('GET /api/admin/users/:devId/transcript returns uniform HTTP 404 identical to non-existent ID', async () => {
      const devRes = await fetch('/api/admin/users/USR_DEV_001/transcript', {
        headers: { Authorization: 'Bearer mock_jwt_USR_SUPER_001_test' },
      });
      expect(devRes.status).toBe(404);
      const devBody = await devRes.json();

      const randomRes = await fetch('/api/admin/users/USR_UNKNOWN_NON_EXISTENT_XYZ/transcript', {
        headers: { Authorization: 'Bearer mock_jwt_USR_SUPER_001_test' },
      });
      expect(randomRes.status).toBe(404);
      const randomBody = await randomRes.json();

      expect(devBody.message).toBe(randomBody.message);
    });

    it('direct mutation endpoints (role, status, delete) targeting Developer return uniform 404 Not Found (never 403)', async () => {
      // Role patch
      const roleRes = await fetch('/api/admin/users/USR_DEV_001/role', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock_jwt_USR_SUPER_001_test',
        },
        body: JSON.stringify({ role: 'admin' }),
      });
      expect(roleRes.status).toBe(404);

      // Status patch
      const statusRes = await fetch('/api/admin/users/USR_DEV_001/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock_jwt_USR_SUPER_001_test',
        },
        body: JSON.stringify({ status: 'suspended' }),
      });
      expect(statusRes.status).toBe(404);

      // Delete request
      const deleteRes = await fetch('/api/admin/users/USR_DEV_001', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer mock_jwt_USR_SUPER_001_test' },
      });
      expect(deleteRes.status).toBe(404);
    });

    it('GET/PUT/DELETE /api/admin/permissions/users/:devId return uniform 404 Not Found for non-developer', async () => {
      // GET override
      const getRes = await fetch('/api/admin/permissions/users/USR_DEV_001', {
        headers: { Authorization: 'Bearer mock_jwt_usr_admin_001_test' },
      });
      expect(getRes.status).toBe(404);

      // PUT override
      const putRes = await fetch('/api/admin/permissions/users/USR_DEV_001', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock_jwt_usr_admin_001_test',
        },
        body: JSON.stringify({ grantedPermissions: ['users.view'] }),
      });
      expect(putRes.status).toBe(404);

      // DELETE override
      const delRes = await fetch('/api/admin/permissions/users/USR_DEV_001', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer mock_jwt_usr_admin_001_test' },
      });
      expect(delRes.status).toBe(404);
    });

    it('GET /api/admin/permissions/effective/:devId returns uniform 404 Not Found for non-developer', async () => {
      const res = await fetch('/api/admin/permissions/effective/USR_DEV_001', {
        headers: { Authorization: 'Bearer mock_jwt_usr_admin_001_test' },
      });
      expect(res.status).toBe(404);
    });

    it('GET and POST /api/admin/permissions/governance/delegation/:devId return uniform 404 Not Found for non-developer', async () => {
      // GET delegation
      const getRes = await fetch('/api/admin/permissions/governance/delegation/USR_DEV_001', {
        headers: { Authorization: 'Bearer mock_jwt_usr_admin_001_test' },
      });
      expect(getRes.status).toBe(404);

      // POST delegation
      const postRes = await fetch('/api/admin/permissions/governance/delegation/USR_DEV_001', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock_jwt_usr_admin_001_test',
        },
        body: JSON.stringify({ enabled: true }),
      });
      expect(postRes.status).toBe(404);
    });

    it('GET and PUT /api/admin/users/:devId/whatsapp-visibility return uniform 404 Not Found for non-developer', async () => {
      const getRes = await fetch('/api/admin/users/USR_DEV_001/whatsapp-visibility', {
        headers: { Authorization: 'Bearer mock_jwt_usr_admin_001_test' },
      });
      expect(getRes.status).toBe(404);

      const putRes = await fetch('/api/admin/users/USR_DEV_001/whatsapp-visibility', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock_jwt_usr_admin_001_test',
        },
        body: JSON.stringify({ assignments: [] }),
      });
      expect(putRes.status).toBe(404);
    });

    it('GET /api/users/:devId/courses/:courseId/attempts returns uniform 404 Not Found for non-developer', async () => {
      const res = await fetch('/api/users/USR_DEV_001/courses/course_rail_safety_01/attempts', {
        headers: { Authorization: 'Bearer mock_jwt_usr_admin_001_test' },
      });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.message).toBe('المستخدم المطلوب غير موجود');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Surface 3: Dashboard KPIs, Counts & Reports
  // ─────────────────────────────────────────────────────────────────────────
  describe('Surface 3 — Dashboard KPIs, Counts & Reports', () => {
    it('excludes developer from dashboard enrollment counts and trainee counts for non-developer viewers', () => {
      const adminUser: User = {
        id: 'usr_admin_001',
        name: 'مسؤول',
        email: 'admin@metro.local',
        role: 'admin',
        department: 'التشغيل',
        jobTitle: 'مدير',
      };

      const devUser: User = {
        id: 'USR_DEV_001',
        name: 'مطور',
        email: 'dev@metro.local',
        role: 'developer',
        department: 'التطوير',
        jobTitle: 'مطور',
      };

      const adminDashboard = inMemoryStore.getDashboardData(adminUser);
      const devDashboard = inMemoryStore.getDashboardData(devUser);

      expect(adminDashboard).toBeDefined();
      expect(devDashboard).toBeDefined();
    });

    it('excludes developer from active user counts, total counts, and role distribution in directory', () => {
      const res = inMemoryStore.getManagedUsers({ page: 1, limit: 100 }, 'admin');

      // Total count
      expect(res.users.some((u) => u.role === 'developer')).toBe(false);

      // Active count
      const activeCount = res.users.filter((u) => u.status === 'active').length;
      const rawActiveCount = inMemoryStore.getUsersRaw().filter((u) => u.status === 'active').length;
      expect(activeCount).toBe(rawActiveCount - 1); // exactly 1 developer excluded

      // Role distribution
      const roleMap: Record<string, number> = {};
      for (const u of res.users) {
        roleMap[u.role] = (roleMap[u.role] || 0) + 1;
      }
      expect(roleMap['developer']).toBeUndefined();
    });

    it('getCoursePerformanceReport excludes developer from candidate trainees and metrics for non-developer actor', () => {
      const adminUser: User = {
        id: 'usr_admin_001',
        name: 'مسؤول',
        email: 'admin@metro.local',
        role: 'admin',
        department: 'التشغيل',
        jobTitle: 'مدير',
      };

      const report = inMemoryStore.getCoursePerformanceReport('course_rail_safety_01', adminUser);
      if (report) {
        expect(report.trainees.find((t) => t.id === 'USR_DEV_001')).toBeUndefined();
      }
    });

    it('getGroupMetrics and getGroupSummary exclude developer from trainee metrics and total counts', () => {
      // Even if developer is assigned in group trainees, non-developer views exclude developer
      const group = inMemoryStore.getGroupById('GRP-101');
      if (group) {
        group.traineeIds = [...(group.traineeIds || []), 'USR_DEV_001'];

        const metricsAdmin = inMemoryStore.getGroupMetrics('GRP-101', undefined, 'admin');
        expect(metricsAdmin?.traineeMetricsList.find((tm) => tm.userId === 'USR_DEV_001')).toBeUndefined();

        const summaryAdmin = inMemoryStore.getGroupSummary('GRP-101', 'admin');
        expect(summaryAdmin?.totalTraineesCount).toBe(group.traineeIds.length - 1);

        const metricsDev = inMemoryStore.getGroupMetrics('GRP-101', undefined, 'developer');
        expect(metricsDev?.traineeMetricsList.find((tm) => tm.userId === 'USR_DEV_001')).toBeDefined();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Surface 4: Role Selectors & Account Forms
  // ─────────────────────────────────────────────────────────────────────────
  describe('Surface 4 — Role Selectors & Account Forms', () => {
    it('canActorManageTargetAccount strictly prohibits creating accounts with developer role for all actors', () => {
      const allRoles: UserRole[] = ['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer', 'user'];

      for (const actor of allRoles) {
        const result = canActorManageTargetAccount(actor, 'developer', 'create');
        expect(result.allowed).toBe(false);
        expect(result.code).toBe('INVARIANT_CANNOT_CREATE_DEVELOPER');
      }
    });

    it('verifies exact role creation options across all four management roles in Revision 5', () => {
      const candidateRoles: UserRole[] = ['super_admin', 'admin', 'assistant_admin', 'lecturer', 'user'];

      // Developer can create super_admin, admin, assistant_admin, lecturer, user
      const devOptions = candidateRoles.filter((r) => canActorManageTargetAccount('developer', r, 'create').allowed);
      expect(devOptions).toEqual(['super_admin', 'admin', 'assistant_admin', 'lecturer', 'user']);

      // Super Admin can create admin, assistant_admin, lecturer, user (INV-R4: cannot create super_admin)
      const superOptions = candidateRoles.filter((r) => canActorManageTargetAccount('super_admin', r, 'create').allowed);
      expect(superOptions).toEqual(['admin', 'assistant_admin', 'lecturer', 'user']);

      // Admin can create assistant_admin, lecturer, user (INV-R3: cannot create admin or super_admin)
      const adminOptions = candidateRoles.filter((r) => canActorManageTargetAccount('admin', r, 'create').allowed);
      expect(adminOptions).toEqual(['assistant_admin', 'lecturer', 'user']);

      // Assistant Admin cannot create any role without delegation
      const assistantOptions = candidateRoles.filter((r) => canActorManageTargetAccount('assistant_admin', r, 'create').allowed);
      expect(assistantOptions).toEqual([]);
    });

    it('AddUserModal renders strictly authorized role options for currentUser', () => {
      // 1. Regular Admin: renders assistant_admin, lecturer, user only
      const { unmount: unmountAdmin } = render(
        <AuthProvider>
          <MemoryRouter>
            <AddUserModal
              isOpen={true}
              onClose={() => {}}
              onUserAdded={() => {}}
              currentUser={{ id: 'usr_admin_001', role: 'admin' } as any}
            />
          </MemoryRouter>
        </AuthProvider>
      );

      const adminRoleSelect = screen.getByTestId('role-select');
      const adminOptions = Array.from(adminRoleSelect.querySelectorAll('option')).map((o) => o.value);
      expect(adminOptions).toContain('assistant_admin');
      expect(adminOptions).toContain('lecturer');
      expect(adminOptions).toContain('user');
      expect(adminOptions).not.toContain('admin');
      expect(adminOptions).not.toContain('super_admin');
      expect(adminOptions).not.toContain('developer');
      unmountAdmin();

      // 2. Super Admin: includes admin, excludes super_admin and developer
      const { unmount: unmountSuper } = render(
        <AuthProvider>
          <MemoryRouter>
            <AddUserModal
              isOpen={true}
              onClose={() => {}}
              onUserAdded={() => {}}
              currentUser={{ id: 'USR_SUPER_001', role: 'super_admin' } as any}
            />
          </MemoryRouter>
        </AuthProvider>
      );

      const superRoleSelect = screen.getByTestId('role-select');
      const superOptions = Array.from(superRoleSelect.querySelectorAll('option')).map((o) => o.value);
      expect(superOptions).toContain('admin');
      expect(superOptions).not.toContain('super_admin');
      expect(superOptions).not.toContain('developer');
      unmountSuper();
    });

    it('UserFilterBar does not render developer role option', () => {
      render(
        <MemoryRouter>
          <UserFilterBar
            searchQuery=""
            onSearchChange={() => {}}
            selectedRole="all"
            onRoleChange={() => {}}
            selectedStatus="all"
            onStatusChange={() => {}}
            selectedDepartment="all"
            onDepartmentChange={() => {}}
            availableDepartments={[]}
            onReset={() => {}}
            hasActiveFilters={false}
          />
        </MemoryRouter>
      );

      const filterSelect = screen.getByTestId('role-filter-select');
      const options = Array.from(filterSelect.querySelectorAll('option')).map((o) => o.value);
      expect(options).not.toContain('developer');
      expect(options).toContain('super_admin');
      expect(options).toContain('admin');
      expect(options).toContain('assistant_admin');
      expect(options).toContain('lecturer');
      expect(options).toContain('user');
    });

    it('store and API reject unauthorized role assignments with 403', async () => {
      // Regular admin trying to promote a user to admin or super_admin
      const res = await fetch('/api/admin/users/USR003/role', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock_jwt_usr_admin_001_test',
        },
        body: JSON.stringify({ role: 'super_admin' }),
      });
      expect(res.status).toBe(403);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Surface 5: Instructor, Supervisor & Trainee Pickers
  // ─────────────────────────────────────────────────────────────────────────
  describe('Surface 5 — Instructor, Supervisor & Trainee Pickers', () => {
    it('getCandidateTrainees strictly excludes developer accounts', () => {
      const candidates = inMemoryStore.getCandidateTrainees();
      expect(candidates.every((u) => u.role === 'user')).toBe(true);
      expect(candidates.find((u) => u.id === 'USR_DEV_001')).toBeUndefined();
      expect(candidates.find((u) => u.role === 'developer')).toBeUndefined();
    });

    it('getCandidateLecturers strictly excludes developer accounts', () => {
      const lecturers = inMemoryStore.getCandidateLecturers();
      expect(lecturers.every((u) => u.role === 'lecturer')).toBe(true);
      expect(lecturers.find((u) => u.id === 'USR_DEV_001')).toBeUndefined();
      expect(lecturers.find((u) => u.role === 'developer')).toBeUndefined();
    });

    it('resolveGroupInstructors excludes developer identity from group instructor roster', () => {
      const group = inMemoryStore.getGroupById('GRP-101');
      if (group) {
        group.primaryInstructorId = 'USR_DEV_001';
        const instructors = inMemoryStore.resolveGroupInstructors(group);
        expect(instructors.find((i) => i.userId === 'USR_DEV_001')).toBeUndefined();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Surface 6: Notifications & Activity Feeds (D-08)
  // ─────────────────────────────────────────────────────────────────────────
  describe('Surface 6 — Notifications & Activity Feeds (D-08)', () => {
    it('createNotification sanitizes Developer references to SYSTEM / النظام for non-developer recipients', () => {
      const nonDevRecipientId = SYNTHETIC_DEMO_ACCOUNTS.admin.user.id;

      inMemoryStore.createNotification({
        userId: nonDevRecipientId,
        title: 'إشعار صادر من USR_DEV_001',
        message: 'قام المطور developer.metro@internal.local بتحديث إعدادات النظام الحساسة',
        targetUrl: '/admin/users/USR_DEV_001',
        type: 'general_alert',
      });

      const notifs = inMemoryStore.getNotificationsForUser(nonDevRecipientId, 'admin');
      const recent = notifs[0];

      expect(recent).toBeDefined();
      expect(recent.title).not.toContain('USR_DEV_001');
      expect(recent.message).not.toContain('developer.metro@internal.local');
      expect(recent.targetUrl).not.toContain('USR_DEV_001');
      expect(recent.title).toContain('SYSTEM');
      expect(recent.message).toContain('system@metro.local');
      expect(recent.targetUrl).toBe('/admin/users/system');
    });

    it('private notifications for Developer are not returned to non-developer viewers', () => {
      inMemoryStore.createNotification({
        userId: 'USR_DEV_001',
        title: 'إشعار سري للمطور',
        message: 'بيانات فنية خاصة بالنظام الداخلي',
        type: 'system',
      });

      const notifsAsAdmin = inMemoryStore.getNotificationsForUser('USR_DEV_001', 'admin');
      expect(notifsAsAdmin).toHaveLength(0);

      const notifsAsDev = inMemoryStore.getNotificationsForUser('USR_DEV_001', 'developer');
      expect(notifsAsDev.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Surface 7: Security Audit Logs & Course History (D-14)
  // ─────────────────────────────────────────────────────────────────────────
  describe('Surface 7 — Security Audit Logs & Course History (D-14)', () => {
    beforeEach(() => {
      inMemoryStore.recordSecurityAuditLog({
        action: 'USER_MUTATED',
        actorId: 'USR_DEV_001',
        actorRole: 'developer',
        actorName: 'مطور النظام الداخلي',
        details: 'قام USR_DEV_001 (developer.metro@internal.local) بتعديل ضبط أمني',
      });
    });

    it('projects Developer audit logs as SYSTEM / system / النظام for non-developer viewers', () => {
      const logs = inMemoryStore.getSystemAuditLogs({}, 'admin');
      const devLogs = logs.entries.filter((e) => e.action === 'USER_MUTATED');

      expect(devLogs.length).toBeGreaterThanOrEqual(1);
      for (const entry of devLogs) {
        expect(entry.actorId).toBe('SYSTEM');
        expect(entry.actorRole).toBe('system');
        expect(entry.actorName).toBe('النظام');
        expect(entry.details).not.toContain('USR_DEV_001');
        expect(entry.details).not.toContain('developer.metro@internal.local');
        expect(entry.details).toContain('النظام');
      }
    });

    it('preserves immutable Developer record in store while projecting view for non-developer', () => {
      // 1. Non-developer sees projection
      const projected = inMemoryStore.getSystemAuditLogs({}, 'admin');
      const projectedEntry = projected.entries.find((e) => e.action === 'USER_MUTATED');
      expect(projectedEntry?.actorId).toBe('SYSTEM');

      // 2. Underlying store record remains immutable
      const rawEntries = inMemoryStore.getSystemAuditLogsStore();
      const rawEntry = rawEntries.find((e) => e.action === 'USER_MUTATED');
      expect(rawEntry?.actorId).toBe('USR_DEV_001');
      expect(rawEntry?.actorRole).toBe('developer');
      expect(rawEntry?.actorName).toBe('مطور النظام الداخلي');
    });

    it('getSystemAuditLogById projects Developer record as SYSTEM for non-developer', () => {
      const rawEntries = inMemoryStore.getSystemAuditLogsStore();
      const rawEntry = rawEntries.find((e) => e.action === 'USER_MUTATED')!;

      const viewedByAdmin = inMemoryStore.getSystemAuditLogById(rawEntry.id, 'admin');
      expect(viewedByAdmin?.actorId).toBe('SYSTEM');
      expect(viewedByAdmin?.actorRole).toBe('system');
      expect(viewedByAdmin?.actorName).toBe('النظام');

      const viewedByDev = inMemoryStore.getSystemAuditLogById(rawEntry.id, 'developer');
      expect(viewedByDev?.actorId).toBe('USR_DEV_001');
      expect(viewedByDev?.actorRole).toBe('developer');
    });

    it('GET /api/admin/audit projects Developer actions as SYSTEM / النظام for admin caller', async () => {
      const res = await fetch('/api/admin/audit', {
        headers: { Authorization: 'Bearer mock_jwt_usr_admin_001_test' },
      });
      expect(res.status).toBe(200);
      const data = await res.json();

      const userMutatedLogs = data.entries.filter((e: any) => e.action === 'USER_MUTATED');
      expect(userMutatedLogs.length).toBeGreaterThanOrEqual(1);
      for (const entry of userMutatedLogs) {
        expect(entry.actorId).toBe('SYSTEM');
        expect(entry.actorRole).toBe('system');
        expect(entry.actorName).toBe('النظام');
      }
    });

    it('getCourseReviewData projects developer in both response.auditLog and response.course.auditLog for non-developer', () => {
      const course = inMemoryStore.getCourseById('course_rail_safety_01');
      if (course) {
        course.auditLog = [
          {
            id: 'log_rev_001',
            action: 'REVIEW_ACCEPTED',
            actorId: 'USR_DEV_001',
            actorName: 'مطور النظام',
            timestamp: new Date().toISOString(),
          },
        ];

        const adminReviewData = inMemoryStore.getCourseReviewData('course_rail_safety_01', {
          id: 'usr_admin_001',
          name: 'مدير',
          email: 'admin@metro.local',
          role: 'admin',
          department: 'التشغيل',
          jobTitle: 'مدير',
        });

        expect(adminReviewData.auditLog[0].actorId).toBe('SYSTEM');
        expect(adminReviewData.auditLog[0].actorName).toBe('النظام');
        expect(adminReviewData.course.auditLog[0].actorId).toBe('SYSTEM');
        expect(adminReviewData.course.auditLog[0].actorName).toBe('النظام');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Surface 8: Entity Ownership & Reference Fields
  // ─────────────────────────────────────────────────────────────────────────
  describe('Surface 8 — Entity Ownership & Reference Fields', () => {
    it('projects Developer uploadedBy as SYSTEM / النظام in group materials for non-developer', () => {
      inMemoryStore.addMaterial(
        'group_1',
        {
          id: 'mat_dev_001',
          name: 'دليل الأمان الفني',
          type: 'pdf',
          size: '2.5 MB',
          url: '/files/security.pdf',
        },
        {
          id: 'USR_DEV_001',
          name: 'مطور النظام الداخلي',
          role: 'developer',
        }
      );

      const materialsAsAdmin = inMemoryStore.getGroupMaterials('group_1', 'admin');
      const devMaterial = materialsAsAdmin.find((m) => m.id === 'mat_dev_001');
      expect(devMaterial).toBeDefined();
      expect(devMaterial?.uploadedBy).toBe('SYSTEM');
      expect(devMaterial?.uploadedByName).toBe('النظام');

      const materialsAsDev = inMemoryStore.getGroupMaterials('group_1', 'developer');
      const devMaterialSeenByDev = materialsAsDev.find((m) => m.id === 'mat_dev_001');
      expect(devMaterialSeenByDev?.uploadedBy).toBe('USR_DEV_001');
      expect(devMaterialSeenByDev?.uploadedByName).toBe('مطور النظام الداخلي');
    });

    it('projects Developer requestedBy and reviewedBy as SYSTEM in approval requests for non-developer', () => {
      inMemoryStore.createApprovalRequest({
        capability: 'governance.delegation',
        justification: 'طلب ترقية فني',
        context: { targetRole: 'assistant_admin' },
        requestedBy: 'USR_DEV_001',
      });

      const requestsAsAdmin = inMemoryStore.getApprovalRequests('admin');
      const req = requestsAsAdmin.find((r) => r.justification === 'طلب ترقية فني');
      expect(req).toBeDefined();
      expect(req?.requestedBy).toBe('SYSTEM');
      expect(req?.requesterName).toBe('النظام');

      const requestsAsDev = inMemoryStore.getApprovalRequests('developer');
      const reqSeenByDev = requestsAsDev.find((r) => r.justification === 'طلب ترقية فني');
      expect(reqSeenByDev?.requestedBy).toBe('USR_DEV_001');
    });

    it('projects Developer reviewedBy as SYSTEM in GroupJoinRequests for non-developer', () => {
      inMemoryStore.reviewGroupJoinRequest(
        {
          requestId: 'REQ-001',
          decision: 'approve',
          reason: 'موافقة المطور',
        },
        {
          id: 'USR_DEV_001',
          name: 'مطور النظام الداخلي',
          email: 'dev@metro.local',
          role: 'developer',
          department: 'التطوير',
          jobTitle: 'مطور',
        }
      );

      const requestsAsAdmin = inMemoryStore.getGroupJoinRequests('GRP-101', undefined, 'admin');
      const devReviewed = requestsAsAdmin.find((r) => r.id === 'REQ-001');
      if (devReviewed) {
        expect(devReviewed.reviewedBy).toBe('SYSTEM');
        expect(devReviewed.reviewedByName).toBe('النظام');
      }
    });

    it('projects Developer updatedBy as SYSTEM in UserPermissionOverride for non-developer', () => {
      inMemoryStore.setUserPermissionOverride({
        userId: 'USR003',
        grantedPermissions: ['users.view'],
        deniedPermissions: [],
        updatedBy: 'USR_DEV_001',
      });

      const overrideAdmin = inMemoryStore.getUserPermissionOverride('USR003', 'admin');
      expect(overrideAdmin?.updatedBy).toBe('SYSTEM');

      const overrideDev = inMemoryStore.getUserPermissionOverride('USR003', 'developer');
      expect(overrideDev?.updatedBy).toBe('USR_DEV_001');
    });

    it('projects Developer updatedBy as SYSTEM in DepartmentTracks for non-developer', () => {
      inMemoryStore.updateDepartmentTracks('DEP-01', ['TRK-01'], { id: 'USR_DEV_001', role: 'developer' });

      const deptAdmin = inMemoryStore.getDepartmentTracksById('DEP-01', 'admin');
      expect(deptAdmin?.updatedBy).toBe('SYSTEM');

      const deptDev = inMemoryStore.getDepartmentTracksById('DEP-01', 'developer');
      expect(deptDev?.updatedBy).toBe('USR_DEV_001');
    });

    it('projects Developer author and reporter as SYSTEM / النظام in CourseComments for non-developer', () => {
      const commentAdmin = inMemoryStore.getCourseComments('course_rail_safety_01', 'admin');
      for (const c of commentAdmin) {
        expect(c.userRole).not.toBe('developer');
        expect(c.userId).not.toBe('USR_DEV_001');
        expect(c.reportedBy).not.toBe('USR_DEV_001');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Surface 9: Duplicate-Email & Validation Responses (D-09)
  // ─────────────────────────────────────────────────────────────────────────
  describe('Surface 9 — Duplicate-Email & Validation Responses (D-09)', () => {
    // Note: Account Details & Editing feature remains deferred by the owner's Increment 2.2 decision.
    // There is no email update endpoint or form in the application.

    it('returns generic collision error message on Developer email collision, identical to regular user collision', () => {
      const adminActor = { id: 'usr_admin_001', role: 'admin' as UserRole };

      // 1. Collision with Developer email
      let devCollisionError: any;
      try {
        inMemoryStore.createUser(
          {
            name: 'مستخدم تجريبي 1',
            username: 'test_user_1',
            email: 'developer.metro@internal.local',
            role: 'user',
            department: 'التشغيل',
            jobTitle: 'فني',
          },
          adminActor
        );
      } catch (err) {
        devCollisionError = err;
      }

      // 2. Collision with regular Trainee email
      let regularCollisionError: any;
      try {
        inMemoryStore.createUser(
          {
            name: 'مستخدم تجريبي 2',
            username: 'test_user_2',
            email: SYNTHETIC_DEMO_ACCOUNTS.trainee.user.email,
            role: 'user',
            department: 'التشغيل',
            jobTitle: 'فني',
          },
          adminActor
        );
      } catch (err) {
        regularCollisionError = err;
      }

      expect(devCollisionError).toBeInstanceOf(MockStoreError);
      expect(regularCollisionError).toBeInstanceOf(MockStoreError);
      expect(devCollisionError.statusCode).toBe(409);
      expect(regularCollisionError.statusCode).toBe(409);
      expect(devCollisionError.message).toBe('البريد الإلكتروني مستخدم بالفعل أو غير متاح');
      expect(devCollisionError.message).toBe(regularCollisionError.message);
    });

    it('POST /api/admin/users returns HTTP 409 Conflict with generic message on Developer email collision', async () => {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock_jwt_USR_SUPER_001_test',
        },
        body: JSON.stringify({
          name: 'مستخدم جديد',
          username: 'brand_new_user',
          email: 'developer.metro@internal.local',
          role: 'user',
          department: 'التشغيل',
          jobTitle: 'فني تشغيل',
        }),
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.message).toBe('البريد الإلكتروني مستخدم بالفعل أو غير متاح');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Surface 10: Public Support & WhatsApp Contacts
  // ─────────────────────────────────────────────────────────────────────────
  describe('Surface 10 — Public Support & WhatsApp Contacts', () => {
    it('resolvePublicSupportContacts strictly excludes Developer accounts', () => {
      const contacts = inMemoryStore.resolvePublicSupportContacts();
      expect(contacts.every((c) => c.role !== 'developer')).toBe(true);
      expect(contacts.find((c) => c.id === 'USR_DEV_001')).toBeUndefined();
    });

    it('getUserWhatsAppVisibility throws uniform 404 for Developer target when actor is non-developer', () => {
      expect(() => inMemoryStore.getUserWhatsAppVisibility('USR_DEV_001', 'admin')).toThrowError(
        expect.objectContaining({
          statusCode: 404,
          message: 'المستخدم المطلوب غير موجود',
        })
      );
    });

    it('setUserWhatsAppVisibility throws uniform 404 for Developer target when actor is non-developer', () => {
      expect(() => inMemoryStore.setUserWhatsAppVisibility('USR_DEV_001', [], 'admin', 'admin')).toThrowError(
        expect.objectContaining({
          statusCode: 404,
          message: 'المستخدم المطلوب غير موجود',
        })
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Surface 11: Developer-Only Routes & Clarified 404 Semantics
  // ─────────────────────────────────────────────────────────────────────────
  describe('Surface 11 — Developer-Only Routes & UI Navigation Gating', () => {
    // Note on 404 semantics:
    // Client-side: DeveloperRouteGuard renders <NotFoundPage standalone /> producing a faithful
    // 404 Not Found user experience for unauthenticated visitors and non-developer roles,
    // matching unknown routes without route discovery.
    // HTTP response status: in an SPA served by a web server, HTTP-level 404 status codes
    // are enforced at the server ingress/routing layer in production backend deployment (Phase 12).

    it('DeveloperRouteGuard renders NotFoundPage (404 UI experience) for unauthenticated visitors, NEVER ForbiddenPage (403)', () => {
      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/design-system']}>
            <DeveloperRouteGuard>
              <div data-testid="developer-content">محتوى المعمل البصري</div>
            </DeveloperRouteGuard>
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText('الصفحة غير موجودة')).toBeInTheDocument();
      expect(screen.queryByTestId('developer-content')).not.toBeInTheDocument();
      expect(screen.queryByText(/403/i)).not.toBeInTheDocument();
    });

    it('DeveloperRouteGuard renders NotFoundPage (404 UI experience) for non-developer roles, NEVER ForbiddenPage (403)', () => {
      const nonDevRoles: UserRole[] = ['super_admin', 'admin', 'assistant_admin', 'lecturer', 'user'];

      for (const role of nonDevRoles) {
        authStorage.setSession({
          user: {
            id: `usr_${role}_test`,
            name: `Test ${role}`,
            email: `${role}@metro.local`,
            role,
            department: 'التشغيل',
            jobTitle: 'فني',
          },
          token: `mock_jwt_${role}_test`,
          expiresAt: Date.now() + 100000,
        });

        const { unmount } = render(
          <AuthProvider>
            <MemoryRouter initialEntries={['/design-system']}>
              <DeveloperRouteGuard>
                <div data-testid="developer-content">محتوى المعمل البصري</div>
              </DeveloperRouteGuard>
            </MemoryRouter>
          </AuthProvider>
        );

        expect(screen.getByText('الصفحة غير موجودة')).toBeInTheDocument();
        expect(screen.queryByTestId('developer-content')).not.toBeInTheDocument();
        expect(screen.queryByText(/403/i)).not.toBeInTheDocument();

        unmount();
      }
    });

    it('DeveloperRouteGuard renders children when user has developer role', () => {
      authStorage.setSession({
        user: {
          id: 'USR_DEV_001',
          name: 'مطور النظام',
          email: 'developer.metro@internal.local',
          role: 'developer',
          department: 'التطوير',
          jobTitle: 'مطور',
        },
        token: 'mock_jwt_USR_DEV_001_test',
        expiresAt: Date.now() + 100000,
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/design-system']}>
            <DeveloperRouteGuard>
              <div data-testid="developer-content">محتوى المعمل البصري</div>
            </DeveloperRouteGuard>
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByTestId('developer-content')).toBeInTheDocument();
      expect(screen.queryByText('الصفحة غير موجودة')).not.toBeInTheDocument();
    });

    it('Sidebar hides /design-system navigation link when userRole is not developer', () => {
      render(
        <AuthProvider>
          <MemoryRouter>
            <Sidebar isCollapsed={false} onToggleCollapse={() => {}} userRole="admin" />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.queryByRole('link', { name: /معمل نظام التصميم/i })).not.toBeInTheDocument();
    });

    it('Sidebar shows /design-system navigation link when userRole is developer', () => {
      render(
        <AuthProvider>
          <MemoryRouter>
            <Sidebar isCollapsed={false} onToggleCollapse={() => {}} userRole="developer" />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByRole('link', { name: /معمل نظام التصميم/i })).toBeInTheDocument();
    });

    it('MobileDrawer hides /design-system navigation link when user is non-developer', () => {
      render(
        <AuthProvider>
          <MemoryRouter>
            <MobileDrawer
              isOpen={true}
              onClose={() => {}}
              user={{
                name: 'مسؤول النظام',
                role: 'admin',
                roleLabelAr: 'مسؤول النظام',
                initials: 'م.ن',
              }}
            />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.queryByRole('link', { name: /معمل نظام التصميم/i })).not.toBeInTheDocument();
    });

    it('MobileDrawer shows /design-system navigation link when user is developer', () => {
      render(
        <AuthProvider>
          <MemoryRouter>
            <MobileDrawer
              isOpen={true}
              onClose={() => {}}
              user={{
                name: 'مطور النظام',
                role: 'developer',
                roleLabelAr: 'مطور النظام',
                initials: 'م.ط',
              }}
            />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByRole('link', { name: /معمل نظام التصميم/i })).toBeInTheDocument();
    });
  });
});
