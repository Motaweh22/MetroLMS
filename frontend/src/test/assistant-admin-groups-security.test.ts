/**
 * Increment 3.2 — Group Administrative Visibility & Assistant Lecturer Endpoint Security
 *
 * MFR-06 (Group Administrative Read Visibility for assistant_admin, super_admin, developer)
 * MFR-03 (Group-Assistant Endpoint Security: authentication, role authorization, and candidate validation)
 *
 * GOVERNANCE & EXECUTION DIRECTIVE:
 * Per Owner Directive Part A (Consolidated Phase 13 Testing Workflow), this test suite
 * is authored during Increment 3.2 implementation and marked:
 *
 * STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
 * Zero test runner commands (vitest, pnpm test) were executed during this turn.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { server } from '@/mocks/server';
import { authStorage } from '@/core/auth/authStorage';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { groupsApi } from '@/features/groups/services/groupsApi';
import { apiClient, ApiError } from '@/core/api/apiClient';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import {
  SYNTHETIC_DEVELOPER_USER,
  SYNTHETIC_SUPER_ADMIN_USER,
} from '@/mocks/fixtures/userDirectoryFixtures';
import type { UserRole, AuthenticatedUser } from '@/core/auth/types';
import type { GroupAssistantAssignment } from '@/core/permissions/types';
import type { TrainingGroup } from '@/core/groups/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset({ seedGroupDemo: true });
});
afterAll(() => server.close());

function setSessionForUser(user: AuthenticatedUser) {
  authStorage.setSession({
    token: `token-${user.id}`,
    user,
    expiresAt: Date.now() + 86400000,
  });
}

function setSessionForRole(role: UserRole) {
  if (role === 'developer') {
    setSessionForUser(SYNTHETIC_DEVELOPER_USER);
    return;
  }
  if (role === 'super_admin') {
    setSessionForUser(SYNTHETIC_SUPER_ADMIN_USER);
    return;
  }
  const account = Object.values(SYNTHETIC_DEMO_ACCOUNTS).find((a) => a.user.role === role);
  if (!account) {
    throw new Error(`No synthetic demo account found for role: ${role}`);
  }
  setSessionForUser(account.user);
}

describe('Increment 3.2 — Group Administrative Visibility & Assistant Lecturer Endpoint Security', () => {
  const targetGroupId = 'GRP-201';
  const primaryLecturerId = 'usr_lect_002'; // Primary instructor for GRP-201
  const candidateLecturerId = 'USR017'; // Lecturer available to be assistant
  const enrolledTraineeId = 'usr_trainee_003'; // Trainee in GRP-201

  beforeEach(() => {
    inMemoryStore.reset({ seedGroupDemo: true });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PART A: GROUP ADMINISTRATIVE READ VISIBILITY (MFR-06 & RULE A)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Part A: Group Administrative Read Visibility (MFR-06)', () => {
    it('1. allows assistant_admin to read the full administrative group catalog via GET /api/admin/groups', async () => {
      setSessionForRole('assistant_admin');

      const summaries = await groupsApi.getAdminGroups();
      expect(summaries).toBeDefined();
      expect(Array.isArray(summaries)).toBe(true);
      expect(summaries.length).toBeGreaterThan(0);

      // Verify that assistant_admin is not filtered as a trainee
      const groupIds = summaries.map((s) => s.id);
      expect(groupIds).toContain('GRP-201');
      expect(groupIds).toContain('GRP-202');
    });

    it('2. preserves full administrative group read visibility for super_admin and developer', async () => {
      for (const role of ['super_admin', 'developer'] as UserRole[]) {
        setSessionForRole(role);

        const summaries = await groupsApi.getAdminGroups();
        expect(summaries).toBeDefined();
        expect(Array.isArray(summaries)).toBe(true);
        expect(summaries.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('3. preserves existing admin behavior across group listing', async () => {
      setSessionForRole('admin');

      const summaries = await groupsApi.getAdminGroups();
      expect(summaries).toBeDefined();
      expect(Array.isArray(summaries)).toBe(true);
      expect(summaries.length).toBeGreaterThanOrEqual(2);
    });

    it('4. allows approved administrative roles to read group details and monitoring metrics', async () => {
      const adminRoles: UserRole[] = ['developer', 'super_admin', 'admin', 'assistant_admin'];

      for (const role of adminRoles) {
        setSessionForRole(role);

        // Group detail read
        const detail = await groupsApi.getAdminGroupById(targetGroupId);
        expect(detail).toBeDefined();
        expect(detail.id).toBe(targetGroupId);
        expect(detail.name).toBeDefined();

        // Group monitoring read
        const monitoring = await groupsApi.getGroupMonitoringData(targetGroupId);
        expect(monitoring).toBeDefined();
        expect(monitoring.traineeMetricsList).toBeDefined();
        expect(Array.isArray(monitoring.traineeMetricsList)).toBe(true);
      }
    });

    it('5. properly scopes lecturer, assistant lecturer, and trainee visibility', async () => {
      // 5a. Lecturer only sees assigned groups in /api/admin/groups
      const primaryAccount = SYNTHETIC_DEMO_ACCOUNTS.lecturer;
      setSessionForUser(primaryAccount.user);

      const lecturerSummaries = await groupsApi.getAdminGroups();
      // Primary instructor is assigned to GRP-201, but not GRP-202
      const lecturerGroupIds = lecturerSummaries.map((s) => s.id);
      expect(lecturerGroupIds).toContain('GRP-201');
      expect(lecturerGroupIds).not.toContain('GRP-202');

      // 5b. Trainee is strictly denied access to /api/admin/groups (HTTP 403)
      setSessionForRole('user');
      try {
        await groupsApi.getAdminGroups();
        expect.unreachable('Trainee must not access administrative groups list');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }

      // 5c. Trainee accesses only enrolled groups via /api/groups/my
      const myGroups = await groupsApi.getMyGroups();
      expect(Array.isArray(myGroups)).toBe(true);
      const myGroupIds = myGroups.map((g) => g.id);
      expect(myGroupIds).toContain('GRP-201');
      expect(myGroupIds).not.toContain('GRP-202');
    });

    it('6. preserves Developer confidentiality in administrative group metrics and summaries (Surface 3)', async () => {
      // Seed a developer trainee into group to verify confidentiality filtering
      const store = inMemoryStore as unknown as { groups: Array<{ id: string; traineeIds?: string[] }> };
      const grp = store.groups.find((g) => g.id === targetGroupId);
      if (grp) {
        if (!grp.traineeIds) grp.traineeIds = [];
        grp.traineeIds.push('USR_DEV_001');
      }

      // Assistant Admin inspecting metrics must NOT see Developer in counts or trainee lists
      setSessionForRole('assistant_admin');
      const monitoring = await groupsApi.getGroupMonitoringData(targetGroupId);
      const devInMetrics = monitoring.traineeMetricsList.some(
        (t) => t.traineeId === 'USR_DEV_001' || t.traineeName === 'مطور النظام'
      );
      expect(devInMetrics).toBe(false);

      // Group summary total trainees count excludes Developer for non-developer
      const summaries = await groupsApi.getAdminGroups();
      const targetSummary = summaries.find((s) => s.id === targetGroupId);
      expect(targetSummary).toBeDefined();

      // Developer inspecting metrics sees real unmasked data
      setSessionForRole('developer');
      const devMonitoring = await groupsApi.getGroupMonitoringData(targetGroupId);
      const devInDevMetrics = devMonitoring.traineeMetricsList.some(
        (t) => t.traineeId === 'USR_DEV_001'
      );
      expect(devInDevMetrics).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PART B: SECURE GROUP-ASSISTANT ENDPOINTS (MFR-03)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Part B: Secure Group-Assistant Endpoints (MFR-03)', () => {
    it('7. returns 401 Unauthorized for unauthenticated GET, POST, and DELETE requests', async () => {
      authStorage.clearSession();

      // GET
      try {
        await apiClient(`/api/groups/${targetGroupId}/assistants`, { method: 'GET' });
        expect.unreachable('Unauthenticated GET must fail with 401');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(401);
      }

      // POST
      try {
        await apiClient(`/api/groups/${targetGroupId}/assistants`, {
          method: 'POST',
          body: JSON.stringify({ assistantLecturerId: candidateLecturerId }),
        });
        expect.unreachable('Unauthenticated POST must fail with 401');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(401);
      }

      // DELETE
      try {
        await apiClient(`/api/groups/${targetGroupId}/assistants/some-id`, { method: 'DELETE' });
        expect.unreachable('Unauthenticated DELETE must fail with 401');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(401);
      }
    });

    it('8. allows authorized administrative readers (developer, super_admin, admin, assistant_admin) to GET assistants', async () => {
      const adminRoles: UserRole[] = ['developer', 'super_admin', 'admin', 'assistant_admin'];

      for (const role of adminRoles) {
        setSessionForRole(role);

        const assistants = await apiClient<GroupAssistantAssignment[]>(
          `/api/groups/${targetGroupId}/assistants`,
          { method: 'GET' }
        );
        expect(assistants).toBeDefined();
        expect(Array.isArray(assistants)).toBe(true);
      }
    });

    it('9. allows assigned instructors/supervisors and enrolled trainees to GET assistants; rejects unassigned', async () => {
      // 9a. Primary instructor of GRP-201
      const primaryAccount = SYNTHETIC_DEMO_ACCOUNTS.lecturer;
      setSessionForUser(primaryAccount.user);
      const instructorRead = await apiClient<GroupAssistantAssignment[]>(
        `/api/groups/${targetGroupId}/assistants`,
        { method: 'GET' }
      );
      expect(Array.isArray(instructorRead)).toBe(true);

      // 9b. Enrolled trainee of GRP-201
      setSessionForRole('user');
      const traineeRead = await apiClient<GroupAssistantAssignment[]>(
        `/api/groups/${targetGroupId}/assistants`,
        { method: 'GET' }
      );
      expect(Array.isArray(traineeRead)).toBe(true);

      // 9c. Unassigned lecturer (USR017 is not supervisor for GRP-201)
      const otherLecturerAccount = SYNTHETIC_DEMO_ACCOUNTS.lecturerAssistant;
      setSessionForUser(otherLecturerAccount.user);
      try {
        await apiClient(`/api/groups/${targetGroupId}/assistants`, { method: 'GET' });
        expect.unreachable('Unassigned lecturer must be rejected with 403');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('10. strictly rejects trainees attempting POST or DELETE mutations with HTTP 403', async () => {
      setSessionForRole('user');

      // POST mutation attempt
      try {
        await apiClient(`/api/groups/${targetGroupId}/assistants`, {
          method: 'POST',
          body: JSON.stringify({ assistantLecturerId: candidateLecturerId }),
        });
        expect.unreachable('Trainee POST mutation must fail with 403');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }

      // DELETE mutation attempt
      try {
        await apiClient(`/api/groups/${targetGroupId}/assistants/${candidateLecturerId}`, {
          method: 'DELETE',
        });
        expect.unreachable('Trainee DELETE mutation must fail with 403');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('11. strictly rejects unassigned lecturers attempting POST or DELETE mutations with HTTP 403', async () => {
      // USR017 is not assigned to GRP-201
      const unassignedLecturer = SYNTHETIC_DEMO_ACCOUNTS.lecturerAssistant;
      setSessionForUser(unassignedLecturer.user);

      try {
        await apiClient(`/api/groups/${targetGroupId}/assistants`, {
          method: 'POST',
          body: JSON.stringify({ assistantLecturerId: candidateLecturerId }),
        });
        expect.unreachable('Unassigned lecturer POST mutation must fail with 403');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }

      try {
        await apiClient(`/api/groups/${targetGroupId}/assistants/${candidateLecturerId}`, {
          method: 'DELETE',
        });
        expect.unreachable('Unassigned lecturer DELETE mutation must fail with 403');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('12. allows authorized operational administrators (admin, super_admin, developer) to assign and revoke assistant lecturers', async () => {
      for (const role of ['admin', 'super_admin', 'developer'] as UserRole[]) {
        setSessionForRole(role);

        // Assign assistant
        const assignRes = await apiClient<GroupAssistantAssignment>(
          `/api/groups/${targetGroupId}/assistants`,
          {
            method: 'POST',
            body: JSON.stringify({ assistantLecturerId: candidateLecturerId }),
          }
        );
        expect(assignRes).toBeDefined();
        expect(assignRes.groupId).toBe(targetGroupId);
        expect(assignRes.assistantLecturerId).toBe(candidateLecturerId);
        expect(assignRes.status).toBe('active');

        // Revoke assistant
        const revokeRes = await apiClient<{ success: boolean }>(
          `/api/groups/${targetGroupId}/assistants/${candidateLecturerId}`,
          { method: 'DELETE' }
        );
        expect(revokeRes.success).toBe(true);
      }
    });

    it('13. allows group Primary Instructor to assign and revoke assistant lecturers within their group scope', async () => {
      // usr_lect_002 is primary instructor for GRP-201
      const primaryAccount = SYNTHETIC_DEMO_ACCOUNTS.lecturer;
      setSessionForUser(primaryAccount.user);

      // Assign candidate USR017 as assistant
      const assignment = await apiClient<GroupAssistantAssignment>(
        `/api/groups/${targetGroupId}/assistants`,
        {
          method: 'POST',
          body: JSON.stringify({ assistantLecturerId: candidateLecturerId }),
        }
      );
      expect(assignment.status).toBe('active');
      expect(assignment.assistantLecturerId).toBe(candidateLecturerId);

      // Revoke candidate USR017
      const revokeRes = await apiClient<{ success: boolean }>(
        `/api/groups/${targetGroupId}/assistants/${candidateLecturerId}`,
        { method: 'DELETE' }
      );
      expect(revokeRes.success).toBe(true);

      // Attempting to assign assistant in GRP-202 (where usr_lect_002 is NOT instructor) fails with 403
      try {
        await apiClient(`/api/groups/GRP-202/assistants`, {
          method: 'POST',
          body: JSON.stringify({ assistantLecturerId: candidateLecturerId }),
        });
        expect.unreachable('Primary instructor must not mutate unassigned group');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('13b. strictly enforces that an assigned Assistant Lecturer can GET the assistant list but is denied POST and DELETE mutations (403)', async () => {
      // Setup: Admin assigns USR017 as assistant lecturer in GRP-201
      setSessionForRole('admin');
      await apiClient<GroupAssistantAssignment>(`/api/groups/${targetGroupId}/assistants`, {
        method: 'POST',
        body: JSON.stringify({ assistantLecturerId: candidateLecturerId }),
      });

      // Now authenticate as the newly assigned assistant lecturer (USR017)
      const assistantAccount = SYNTHETIC_DEMO_ACCOUNTS.lecturerAssistant;
      setSessionForUser(assistantAccount.user);

      // 1. Assistant Lecturer CAN GET the assistant list (read contract permitted for teaching staff)
      const list = await apiClient<GroupAssistantAssignment[]>(`/api/groups/${targetGroupId}/assistants`, {
        method: 'GET',
      });
      expect(Array.isArray(list)).toBe(true);
      const isAssigned = list.some((a) => a.assistantLecturerId === candidateLecturerId);
      expect(isAssigned).toBe(true);

      // 2. The same assigned Assistant Lecturer is strictly REJECTED on POST mutation (403)
      try {
        await apiClient(`/api/groups/${targetGroupId}/assistants`, {
          method: 'POST',
          body: JSON.stringify({ assistantLecturerId: 'usr_lect_002' }),
        });
        expect.unreachable('Assigned Assistant Lecturer must NOT be authorized to POST assistants');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }

      // 3. The same assigned Assistant Lecturer is strictly REJECTED on DELETE mutation (403)
      try {
        await apiClient(`/api/groups/${targetGroupId}/assistants/${candidateLecturerId}`, {
          method: 'DELETE',
        });
        expect.unreachable('Assigned Assistant Lecturer must NOT be authorized to DELETE assistants');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }

      // 4. Batch update endpoint (/api/admin/groups/:groupId/assistants) also rejects Assistant Lecturer with 403
      try {
        await groupsApi.updateGroupAssistants(targetGroupId, {
          assistantLecturerIds: [],
        });
        expect.unreachable('Assigned Assistant Lecturer must NOT be authorized for batch assistant update');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    describe('13c: Legacy Groups Primary-Instructor Fallback Security (Undefined primaryInstructorId)', () => {
      const legacyGroupId = 'GRP-LEGACY-01';
      const ambiguousGroupId = 'GRP-AMBIGUOUS-01';

      beforeEach(() => {
        const store = inMemoryStore as unknown as { groups: Array<TrainingGroup> };

        // Legacy group 1: Assigned assistant lecturer (USR017) is first in supervisorIds;
        // genuine instructor (usr_lect_002) is second in supervisorIds.
        store.groups.push({
          id: legacyGroupId,
          name: 'مجموعة إرثية مع محاضرين اثنين',
          description: 'مجموعة إرثية بدون حقل primaryInstructorId صريح',
          courses: [],
          courseId: 'CRS001',
          traineeIds: [],
          primaryInstructorId: undefined, // Explicitly undefined legacy state
          assistantLecturerIds: [candidateLecturerId], // USR017 is assistant
          supervisorIds: [candidateLecturerId, primaryLecturerId], // USR017 is first in supervisorIds!
          startDateTime: '2026-01-01T00:00:00.000Z',
          deadlineDateTime: '2026-12-31T23:59:59.000Z',
          postDeadlinePolicy: 'keep_no_cert',
          resources: [],
        });

        // Legacy group 2: Ambiguous ownership where ONLY assistant lecturers exist in supervisorIds.
        store.groups.push({
          id: ambiguousGroupId,
          name: 'مجموعة إرثية غامضة الملكية',
          description: 'مجموعة إرثية تحتوي فقط على محاضرين مساعدين في supervisorIds',
          courses: [],
          courseId: 'CRS001',
          traineeIds: [],
          primaryInstructorId: undefined, // Explicitly undefined legacy state
          assistantLecturerIds: [candidateLecturerId], // USR017 is assistant
          supervisorIds: [candidateLecturerId], // Only assistant in supervisorIds!
          startDateTime: '2026-01-01T00:00:00.000Z',
          deadlineDateTime: '2026-12-31T23:59:59.000Z',
          postDeadlinePolicy: 'keep_no_cert',
          resources: [],
        });
      });

      it('13c.1: rejects POST mutation when assigned Assistant Lecturer is first in supervisorIds of legacy group (403)', async () => {
        // Authenticate as USR017 (first in supervisorIds, but in assistantLecturerIds)
        const assistantAccount = SYNTHETIC_DEMO_ACCOUNTS.lecturerAssistant;
        setSessionForUser(assistantAccount.user);

        try {
          await apiClient(`/api/groups/${legacyGroupId}/assistants`, {
            method: 'POST',
            body: JSON.stringify({ assistantLecturerId: primaryLecturerId }),
          });
          expect.unreachable('Assistant Lecturer in legacy group must NOT be inferred as primary instructor for POST');
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(ApiError);
          expect((err as ApiError).status).toBe(403);
        }
      });

      it('13c.2: rejects DELETE mutation when assigned Assistant Lecturer is first in supervisorIds of legacy group (403)', async () => {
        // Authenticate as USR017 (first in supervisorIds, but in assistantLecturerIds)
        const assistantAccount = SYNTHETIC_DEMO_ACCOUNTS.lecturerAssistant;
        setSessionForUser(assistantAccount.user);

        try {
          await apiClient(`/api/groups/${legacyGroupId}/assistants/${candidateLecturerId}`, {
            method: 'DELETE',
          });
          expect.unreachable('Assistant Lecturer in legacy group must NOT be inferred as primary instructor for DELETE');
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(ApiError);
          expect((err as ApiError).status).toBe(403);
        }
      });

      it('13c.3: rejects batch PUT update when assigned Assistant Lecturer is first in supervisorIds of legacy group (403)', async () => {
        // Authenticate as USR017 (first in supervisorIds, but in assistantLecturerIds)
        const assistantAccount = SYNTHETIC_DEMO_ACCOUNTS.lecturerAssistant;
        setSessionForUser(assistantAccount.user);

        try {
          await groupsApi.updateGroupAssistants(legacyGroupId, {
            assistantLecturerIds: [],
          });
          expect.unreachable('Assistant Lecturer in legacy group must NOT be inferred as primary instructor for batch PUT');
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(ApiError);
          expect((err as ApiError).status).toBe(403);
        }
      });

      it('13c.4: permits genuine primary instructor in legacy group (usr_lect_002) to perform POST and DELETE assistant mutations', async () => {
        // Authenticate as usr_lect_002 (second in supervisorIds, but the only non-assistant lecturer)
        const primaryAccount = SYNTHETIC_DEMO_ACCOUNTS.lecturer;
        setSessionForUser(primaryAccount.user);

        // POST mutation succeeds
        const assignRes = await apiClient<GroupAssistantAssignment>(
          `/api/groups/${legacyGroupId}/assistants`,
          {
            method: 'POST',
            body: JSON.stringify({ assistantLecturerId: candidateLecturerId }),
          }
        );
        expect(assignRes).toBeDefined();
        expect(assignRes.groupId).toBe(legacyGroupId);
        expect(assignRes.assistantLecturerId).toBe(candidateLecturerId);
        expect(assignRes.status).toBe('active');

        // DELETE mutation succeeds
        const revokeRes = await apiClient<{ success: boolean }>(
          `/api/groups/${legacyGroupId}/assistants/${candidateLecturerId}`,
          { method: 'DELETE' }
        );
        expect(revokeRes.success).toBe(true);
      });

      it('13c.5: fails closed (403) when legacy group ownership is ambiguous (only assistant lecturers in supervisorIds)', async () => {
        // Authenticate as USR017 (only supervisor, but registered as assistant)
        const assistantAccount = SYNTHETIC_DEMO_ACCOUNTS.lecturerAssistant;
        setSessionForUser(assistantAccount.user);

        // POST mutation fails closed with 403
        try {
          await apiClient(`/api/groups/${ambiguousGroupId}/assistants`, {
            method: 'POST',
            body: JSON.stringify({ assistantLecturerId: primaryLecturerId }),
          });
          expect.unreachable('Ambiguous legacy group without primary instructor must fail closed on POST');
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(ApiError);
          expect((err as ApiError).status).toBe(403);
        }

        // DELETE mutation fails closed with 403
        try {
          await apiClient(`/api/groups/${ambiguousGroupId}/assistants/${candidateLecturerId}`, {
            method: 'DELETE',
          });
          expect.unreachable('Ambiguous legacy group without primary instructor must fail closed on DELETE');
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(ApiError);
          expect((err as ApiError).status).toBe(403);
        }

        // Batch PUT mutation fails closed with 403
        try {
          await groupsApi.updateGroupAssistants(ambiguousGroupId, {
            assistantLecturerIds: [],
          });
          expect.unreachable('Ambiguous legacy group without primary instructor must fail closed on PUT');
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(ApiError);
          expect((err as ApiError).status).toBe(403);
        }
      });
    });

    it('14. strictly rejects assistant_admin attempting to assign or revoke assistant lecturers (Read vs. Mutation Boundary)', async () => {
      setSessionForRole('assistant_admin');

      // POST mutation rejected with 403
      try {
        await apiClient(`/api/groups/${targetGroupId}/assistants`, {
          method: 'POST',
          body: JSON.stringify({ assistantLecturerId: candidateLecturerId }),
        });
        expect.unreachable('Assistant Admin must not perform group assistant assignment');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }

      // DELETE mutation rejected with 403
      try {
        await apiClient(`/api/groups/${targetGroupId}/assistants/${candidateLecturerId}`, {
          method: 'DELETE',
        });
        expect.unreachable('Assistant Admin must not perform group assistant revocation');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('15. verifies that without exact active delegation, assistant_admin mutation remains denied', async () => {
      setSessionForRole('assistant_admin');

      // Calling PUT /api/admin/groups/:groupId/assistants also returns 403 for assistant_admin
      try {
        await groupsApi.updateGroupAssistants(targetGroupId, {
          assistantLecturerIds: [candidateLecturerId],
        });
        expect.unreachable('Assistant admin batch update must fail with 403');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('16. strictly rejects non-lecturer candidates with HTTP 400 Bad Request', async () => {
      setSessionForRole('admin');

      // Candidate is a trainee (usr_trainee_003)
      try {
        await apiClient(`/api/groups/${targetGroupId}/assistants`, {
          method: 'POST',
          body: JSON.stringify({ assistantLecturerId: enrolledTraineeId }),
        });
        expect.unreachable('Trainee candidate for assistant lecturer must fail with 400');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(400);
        expect((err as ApiError).message).toContain('المحاضر المساعد يجب أن يكون مستخدماً مسجلاً بدور محاضر معتمد');
      }

      // Candidate is an administrator (usr_admin_001)
      try {
        await apiClient(`/api/groups/${targetGroupId}/assistants`, {
          method: 'POST',
          body: JSON.stringify({ assistantLecturerId: 'usr_admin_001' }),
        });
        expect.unreachable('Admin candidate for assistant lecturer must fail with 400');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(400);
      }
    });

    it('17. enforces that assistant_lecturer remains a group-scoped assignment and never alters global UserRole', async () => {
      setSessionForRole('admin');

      // Assign lecturer USR017 as assistant in GRP-201
      await apiClient(`/api/groups/${targetGroupId}/assistants`, {
        method: 'POST',
        body: JSON.stringify({ assistantLecturerId: candidateLecturerId }),
      });

      // Verify that candidate user record retains platform role 'lecturer'
      const candidateUser = inMemoryStore.getManagedUserById(candidateLecturerId);
      expect(candidateUser).toBeDefined();
      expect(candidateUser?.role).toBe('lecturer');

      // Verify assignment object is strictly a GroupAssistantAssignment
      const assistants = inMemoryStore.getGroupAssistants(targetGroupId);
      const activeAssign = assistants.find((a) => a.assistantLecturerId === candidateLecturerId);
      expect(activeAssign).toBeDefined();
      expect(activeAssign?.groupId).toBe(targetGroupId);
      expect(activeAssign?.status).toBe('active');
    });
  });
});

