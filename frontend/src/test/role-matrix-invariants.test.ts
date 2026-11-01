import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { server } from '@/mocks/server';
import { authStorage } from '@/core/auth/authStorage';
import { inMemoryStore, MockStoreError } from '@/mocks/store/inMemoryStore';
import { userManagementApi } from '@/features/user-management/services/userManagementApi';
import { ApiError } from '@/core/api/apiClient';
import type { UserRole } from '@/core/auth/types';
import {
  canActorManageTargetAccount,
  evaluateProtectedInvariant,
  mapActionToSystemCapability,
} from '@/core/permissions/policy';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type { CreateUserRequestDTO } from '@/core/user-management/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset({ seedGroupDemo: true });
});
afterAll(() => server.close());

const ALL_SIX_ROLES: UserRole[] = [
  'developer',
  'super_admin',
  'admin',
  'assistant_admin',
  'lecturer',
  'user',
];

describe('Increment 2.2 — Protected Account Authorization Matrix (MFR-38, INV-R1..INV-R8)', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 1: Exhaustive 6×6 canActorManageTargetAccount Unit Tests
  // ─────────────────────────────────────────────────────────────────────────
  describe('1. Exhaustive 6×6 canActorManageTargetAccount Matrix', () => {
    describe('1.1 View Action Matrix', () => {
      it('enforces view permissions across all 36 combinations', () => {
        for (const actor of ALL_SIX_ROLES) {
          for (const target of ALL_SIX_ROLES) {
            const result = canActorManageTargetAccount(actor, target, 'view');

            if (target === 'developer') {
              // Developer target is visible ONLY to developer (INV-R1, INV-R8)
              if (actor === 'developer') {
                expect(result.allowed, `Actor ${actor} should view developer`).toBe(true);
              } else {
                expect(result.allowed, `Actor ${actor} must NOT view developer`).toBe(false);
                expect(result.code).toBe('INVARIANT_DEVELOPER_IMMUTABLE');
              }
            } else if (target === 'super_admin') {
              // Super admin target is visible to admin tiers (developer, super_admin [OD-01], admin, assistant_admin)
              if (['developer', 'super_admin', 'admin', 'assistant_admin'].includes(actor)) {
                expect(result.allowed, `Actor ${actor} should view super_admin`).toBe(true);
              } else {
                expect(result.allowed, `Actor ${actor} must NOT view super_admin`).toBe(false);
              }
            } else if (target === 'admin' || target === 'assistant_admin') {
              // Visible to admin tiers
              if (['developer', 'super_admin', 'admin', 'assistant_admin'].includes(actor)) {
                expect(result.allowed, `Actor ${actor} should view ${target}`).toBe(true);
              } else {
                expect(result.allowed, `Actor ${actor} must NOT view ${target}`).toBe(false);
              }
            } else if (target === 'lecturer') {
              // Lecturer is visible to all (public bio)
              expect(result.allowed, `Actor ${actor} should view lecturer`).toBe(true);
            } else if (target === 'user') {
              // User visible to admin tiers and lecturer; user can view self
              if (['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer'].includes(actor)) {
                expect(result.allowed, `Actor ${actor} should view user`).toBe(true);
              } else {
                // user viewing non-self user is false
                expect(result.allowed).toBe(false);
                // user viewing self is true
                const selfView = canActorManageTargetAccount(actor, target, 'view', { isSelf: true });
                expect(selfView.allowed).toBe(true);
              }
            }
          }
        }
      });
    });

    describe('1.2 Create Action Matrix (INV-R1, INV-R2, INV-R3, INV-R4, INV-R5)', () => {
      it('enforces creation authority boundaries across all 36 combinations', () => {
        // Developer can create: super_admin, admin, assistant_admin, lecturer, user (INV-R1: cannot create developer)
        expect(canActorManageTargetAccount('developer', 'developer', 'create').allowed).toBe(false);
        expect(canActorManageTargetAccount('developer', 'developer', 'create').code).toBe('INVARIANT_DEVELOPER_IMMUTABLE');
        expect(canActorManageTargetAccount('developer', 'super_admin', 'create').allowed).toBe(true);
        expect(canActorManageTargetAccount('developer', 'admin', 'create').allowed).toBe(true);
        expect(canActorManageTargetAccount('developer', 'assistant_admin', 'create').allowed).toBe(true);
        expect(canActorManageTargetAccount('developer', 'lecturer', 'create').allowed).toBe(true);
        expect(canActorManageTargetAccount('developer', 'user', 'create').allowed).toBe(true);

        // Super Admin can create: admin, assistant_admin, lecturer, user (INV-R1: no dev, INV-R2: no super_admin)
        expect(canActorManageTargetAccount('super_admin', 'developer', 'create').allowed).toBe(false);
        expect(canActorManageTargetAccount('super_admin', 'developer', 'create').code).toBe('INVARIANT_DEVELOPER_IMMUTABLE');
        expect(canActorManageTargetAccount('super_admin', 'super_admin', 'create').allowed).toBe(false);
        expect(canActorManageTargetAccount('super_admin', 'super_admin', 'create').code).toBe('INVARIANT_SUPER_ADMIN_EXCLUSIVITY');
        expect(canActorManageTargetAccount('super_admin', 'admin', 'create').allowed).toBe(true);
        expect(canActorManageTargetAccount('super_admin', 'assistant_admin', 'create').allowed).toBe(true);
        expect(canActorManageTargetAccount('super_admin', 'lecturer', 'create').allowed).toBe(true);
        expect(canActorManageTargetAccount('super_admin', 'user', 'create').allowed).toBe(true);

        // Regular Admin can create: assistant_admin (D-05), lecturer, user (INV-R1: no dev, INV-R2: no super_admin, INV-R3: no admin)
        expect(canActorManageTargetAccount('admin', 'developer', 'create').allowed).toBe(false);
        expect(canActorManageTargetAccount('admin', 'developer', 'create').code).toBe('INVARIANT_DEVELOPER_IMMUTABLE');
        expect(canActorManageTargetAccount('admin', 'super_admin', 'create').allowed).toBe(false);
        expect(canActorManageTargetAccount('admin', 'super_admin', 'create').code).toBe('INVARIANT_SUPER_ADMIN_EXCLUSIVITY');
        expect(canActorManageTargetAccount('admin', 'admin', 'create').allowed).toBe(false);
        expect(canActorManageTargetAccount('admin', 'admin', 'create').code).toBe('INVARIANT_ADMIN_PROTECTED');
        expect(canActorManageTargetAccount('admin', 'assistant_admin', 'create').allowed).toBe(true);
        expect(canActorManageTargetAccount('admin', 'lecturer', 'create').allowed).toBe(true);
        expect(canActorManageTargetAccount('admin', 'user', 'create').allowed).toBe(true);

        // Assistant Admin cannot create developer, super_admin, admin, or assistant_admin (INV-R5)
        expect(canActorManageTargetAccount('assistant_admin', 'developer', 'create').allowed).toBe(false);
        expect(canActorManageTargetAccount('assistant_admin', 'super_admin', 'create').allowed).toBe(false);
        expect(canActorManageTargetAccount('assistant_admin', 'admin', 'create').allowed).toBe(false);
        expect(canActorManageTargetAccount('assistant_admin', 'assistant_admin', 'create').allowed).toBe(false);
        expect(canActorManageTargetAccount('assistant_admin', 'assistant_admin', 'create').code).toBe('INVARIANT_ASSISTANT_ADMIN_CEILING');
        // Assistant Admin can target lecturer/user in matrix (mode A handles approval/delegation)
        expect(canActorManageTargetAccount('assistant_admin', 'lecturer', 'create').allowed).toBe(true);
        expect(canActorManageTargetAccount('assistant_admin', 'user', 'create').allowed).toBe(true);

        // Lecturer and User cannot create any account
        for (const target of ALL_SIX_ROLES) {
          expect(canActorManageTargetAccount('lecturer', target, 'create').allowed).toBe(false);
          expect(canActorManageTargetAccount('user', target, 'create').allowed).toBe(false);
        }
      });
    });

    describe('1.3 Edit Action Policy Matrix (Future Feature Authorization Foundation)', () => {
      it('enforces policy authorization rules for account editing and permits self-profile metadata updates across all roles', () => {
        // Target: developer (Non-self blocked; self-profile permitted under policy)
        expect(canActorManageTargetAccount('developer', 'developer', 'edit', { isSelf: false }).allowed).toBe(false);
        expect(canActorManageTargetAccount('developer', 'developer', 'edit', { isSelf: true }).allowed).toBe(true);
        expect(canActorManageTargetAccount('super_admin', 'developer', 'edit').allowed).toBe(false);
        expect(canActorManageTargetAccount('admin', 'developer', 'edit').allowed).toBe(false);

        // Target: super_admin (OD-01: peer super_admin read-only)
        expect(canActorManageTargetAccount('developer', 'super_admin', 'edit').allowed).toBe(true);
        expect(canActorManageTargetAccount('super_admin', 'super_admin', 'edit', { isSelf: false }).allowed).toBe(false);
        expect(canActorManageTargetAccount('super_admin', 'super_admin', 'edit', { isSelf: false }).code).toBe('INVARIANT_SUPER_ADMIN_EXCLUSIVITY');
        expect(canActorManageTargetAccount('super_admin', 'super_admin', 'edit', { isSelf: true }).allowed).toBe(true); // self profile
        expect(canActorManageTargetAccount('admin', 'super_admin', 'edit').allowed).toBe(false);

        // Target: admin (INV-R3: peer admin read-only for regular admin)
        expect(canActorManageTargetAccount('developer', 'admin', 'edit').allowed).toBe(true);
        expect(canActorManageTargetAccount('super_admin', 'admin', 'edit').allowed).toBe(true);
        expect(canActorManageTargetAccount('admin', 'admin', 'edit', { isSelf: false }).allowed).toBe(false);
        expect(canActorManageTargetAccount('admin', 'admin', 'edit', { isSelf: false }).code).toBe('INVARIANT_ADMIN_PROTECTED');
        expect(canActorManageTargetAccount('admin', 'admin', 'edit', { isSelf: true }).allowed).toBe(true); // self profile
        expect(canActorManageTargetAccount('assistant_admin', 'admin', 'edit').allowed).toBe(false);
        expect(canActorManageTargetAccount('assistant_admin', 'admin', 'edit').code).toBe('INVARIANT_ASSISTANT_ADMIN_CEILING');

        // Target: assistant_admin (D-05)
        expect(canActorManageTargetAccount('developer', 'assistant_admin', 'edit').allowed).toBe(true);
        expect(canActorManageTargetAccount('super_admin', 'assistant_admin', 'edit').allowed).toBe(true);
        expect(canActorManageTargetAccount('admin', 'assistant_admin', 'edit').allowed).toBe(true);
        expect(canActorManageTargetAccount('assistant_admin', 'assistant_admin', 'edit', { isSelf: false }).allowed).toBe(false);
        expect(canActorManageTargetAccount('assistant_admin', 'assistant_admin', 'edit', { isSelf: true }).allowed).toBe(true); // self profile

        // Target: lecturer & user
        expect(canActorManageTargetAccount('admin', 'lecturer', 'edit').allowed).toBe(true);
        expect(canActorManageTargetAccount('admin', 'user', 'edit').allowed).toBe(true);
        expect(canActorManageTargetAccount('assistant_admin', 'lecturer', 'edit').allowed).toBe(true);
        expect(canActorManageTargetAccount('assistant_admin', 'user', 'edit').allowed).toBe(true);
        expect(canActorManageTargetAccount('lecturer', 'lecturer', 'edit', { isSelf: false }).allowed).toBe(false);
        expect(canActorManageTargetAccount('lecturer', 'lecturer', 'edit', { isSelf: true }).allowed).toBe(true);
        expect(canActorManageTargetAccount('user', 'user', 'edit', { isSelf: false }).allowed).toBe(false);
        expect(canActorManageTargetAccount('user', 'user', 'edit', { isSelf: true }).allowed).toBe(true);
      });
    });

    describe('1.4 Suspend & Delete Actions Matrix (OD-01, OD-02)', () => {
      it('enforces OD-01 peer super_admin immutability for suspend and delete', () => {
        expect(canActorManageTargetAccount('developer', 'super_admin', 'suspend').allowed).toBe(true);
        expect(canActorManageTargetAccount('developer', 'super_admin', 'delete').allowed).toBe(true);

        expect(canActorManageTargetAccount('super_admin', 'super_admin', 'suspend', { isSelf: false }).allowed).toBe(false);
        expect(canActorManageTargetAccount('super_admin', 'super_admin', 'suspend', { isSelf: false }).code).toBe('INVARIANT_SUPER_ADMIN_EXCLUSIVITY');
        expect(canActorManageTargetAccount('super_admin', 'super_admin', 'delete', { isSelf: false }).allowed).toBe(false);
        expect(canActorManageTargetAccount('super_admin', 'super_admin', 'delete', { isSelf: false }).code).toBe('INVARIANT_SUPER_ADMIN_EXCLUSIVITY');
      });

      it('enforces OD-02: regular admin can permanently delete assistant_admin, but not peer admin', () => {
        // Regular admin deleting peer admin is rejected (INV-R3)
        const deleteAdmin = canActorManageTargetAccount('admin', 'admin', 'delete', { isSelf: false });
        expect(deleteAdmin.allowed).toBe(false);
        expect(deleteAdmin.code).toBe('INVARIANT_ADMIN_PROTECTED');

        // Regular admin deleting assistant_admin is explicitly permitted (OD-02)
        const deleteAssistant = canActorManageTargetAccount('admin', 'assistant_admin', 'delete', { isSelf: false });
        expect(deleteAssistant.allowed).toBe(true);

        // Super Admin and Developer can delete both
        expect(canActorManageTargetAccount('super_admin', 'admin', 'delete').allowed).toBe(true);
        expect(canActorManageTargetAccount('super_admin', 'assistant_admin', 'delete').allowed).toBe(true);
        expect(canActorManageTargetAccount('developer', 'admin', 'delete').allowed).toBe(true);
        expect(canActorManageTargetAccount('developer', 'assistant_admin', 'delete').allowed).toBe(true);
      });
    });

    describe('1.5 Invariant INV-R6: Anti-Self-Dealing Across All Roles', () => {
      it('strictly forbids self-delete, self-suspend, self-role-change, and self-permission-granting', () => {
        const forbiddenSelfActions = ['delete', 'suspend', 'change_role', 'manage_permissions'] as const;

        for (const role of ALL_SIX_ROLES) {
          for (const action of forbiddenSelfActions) {
            const result = canActorManageTargetAccount(role, role, action, { isSelf: true });
            expect(result.allowed, `${role} attempting self ${action} must be rejected`).toBe(false);
            expect(result.code).toBe('INVARIANT_SELF_MUTATION_PROHIBITED');
          }
        }
      });
    });

    describe('1.6 Invariant INV-R7: Dual-State Role Transition Checks', () => {
      it('rejects promotion to developer for ALL roles and actors', () => {
        for (const actor of ALL_SIX_ROLES) {
          for (const target of ALL_SIX_ROLES) {
            const result = canActorManageTargetAccount(actor, target, 'change_role', {
              requestedNewRole: 'developer',
            });
            expect(result.allowed, `Actor ${actor} promoting ${target} to developer must fail`).toBe(false);
            expect(result.code).toBe('INVARIANT_DEVELOPER_IMMUTABLE');
          }
        }
      });

      it('enforces dual-state check: actor must have authority over BOTH current role and requested role', () => {
        // Admin actor:
        // user -> assistant_admin: allowed (admin can manage user and create assistant_admin)
        expect(canActorManageTargetAccount('admin', 'user', 'change_role', {
          requestedNewRole: 'assistant_admin',
        }).allowed).toBe(true);

        // user -> admin: rejected (admin cannot create admin)
        const adminToAdmin = canActorManageTargetAccount('admin', 'user', 'change_role', {
          requestedNewRole: 'admin',
        });
        expect(adminToAdmin.allowed).toBe(false);
        expect(adminToAdmin.code).toBe('INVARIANT_ROLE_TRANSITION_UNAUTHORIZED');

        // user -> super_admin: rejected (admin cannot create super_admin)
        const adminToSuper = canActorManageTargetAccount('admin', 'user', 'change_role', {
          requestedNewRole: 'super_admin',
        });
        expect(adminToSuper.allowed).toBe(false);
        expect(adminToSuper.code).toBe('INVARIANT_ROLE_TRANSITION_UNAUTHORIZED');

        // Super Admin actor:
        // user -> admin: allowed (super_admin can create admin)
        expect(canActorManageTargetAccount('super_admin', 'user', 'change_role', {
          requestedNewRole: 'admin',
        }).allowed).toBe(true);

        // user -> super_admin: rejected (super_admin cannot create super_admin)
        const superToSuper = canActorManageTargetAccount('super_admin', 'user', 'change_role', {
          requestedNewRole: 'super_admin',
        });
        expect(superToSuper.allowed).toBe(false);
        expect(superToSuper.code).toBe('INVARIANT_ROLE_TRANSITION_UNAUTHORIZED');

        // Developer actor:
        // user -> super_admin: allowed (developer can create super_admin)
        expect(canActorManageTargetAccount('developer', 'user', 'change_role', {
          requestedNewRole: 'super_admin',
        }).allowed).toBe(true);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 2: Domain Policy Evaluator & Invariant Engine
  // ─────────────────────────────────────────────────────────────────────────
  describe('2. evaluateProtectedInvariant Domain Engine', () => {
    it('enforces context-missing fail-safe guardrail on sensitive mutations', () => {
      const actor = { id: 'usr_admin_001', role: 'admin' as UserRole };
      const sensitiveCaps = ['users.change_role', 'users.change_status', 'users.delete'] as const;

      for (const cap of sensitiveCaps) {
        const result = evaluateProtectedInvariant(actor, cap, undefined);
        expect(result.allowed).toBe(false);
        expect(result.code).toBe('INVARIANT_CONTEXT_MISSING');
      }
    });

    it('returns backward-compatible error codes for assistant admin targeting admin', () => {
      const assistantActor = { id: 'USR016', role: 'assistant_admin' as UserRole };
      const targetAdmin = { id: 'USR001', role: 'admin' as UserRole };

      // users.create
      const createRes = evaluateProtectedInvariant(assistantActor, 'users.create', {
        targetRole: 'admin',
      });
      expect(createRes.allowed).toBe(false);
      expect(createRes.code).toBe('INVARIANT_ASSISTANT_CANNOT_CREATE_ADMIN');

      // users.change_role
      const roleRes = evaluateProtectedInvariant(assistantActor, 'users.change_role', {
        targetUser: targetAdmin,
        targetRole: 'user',
      });
      expect(roleRes.allowed).toBe(false);
      expect(roleRes.code).toBe('INVARIANT_ASSISTANT_CANNOT_MUTATE_ADMIN');

      // users.change_status
      const statusRes = evaluateProtectedInvariant(assistantActor, 'users.change_status', {
        targetUser: targetAdmin,
        targetStatus: 'suspended',
      });
      expect(statusRes.allowed).toBe(false);
      expect(statusRes.code).toBe('INVARIANT_ASSISTANT_CANNOT_MUTATE_ADMIN');

      // users.delete
      const deleteRes = evaluateProtectedInvariant(assistantActor, 'users.delete', {
        targetUser: targetAdmin,
      });
      expect(deleteRes.allowed).toBe(false);
      expect(deleteRes.code).toBe('INVARIANT_ASSISTANT_CANNOT_MUTATE_ADMIN');
    });

    it('preserves INVARIANT_ZERO_ADMIN_LOCKOUT as a regression safety guardrail', () => {
      const superActor = { id: 'USR_SUPER_001', role: 'super_admin' as UserRole };
      const singleAdmin = [{ id: 'usr_sole_admin', role: 'admin' as UserRole, status: 'active' }];

      // Attempting to delete the sole active admin
      const deleteCheck = evaluateProtectedInvariant(
        superActor,
        'users.delete',
        { targetUser: singleAdmin[0] },
        singleAdmin
      );
      expect(deleteCheck.allowed).toBe(false);
      expect(deleteCheck.code).toBe('INVARIANT_ZERO_ADMIN_LOCKOUT');

      // Attempting to suspend the sole active admin
      const suspendCheck = evaluateProtectedInvariant(
        superActor,
        'users.change_status',
        { targetUser: singleAdmin[0], targetStatus: 'suspended' },
        singleAdmin
      );
      expect(suspendCheck.allowed).toBe(false);
      expect(suspendCheck.code).toBe('INVARIANT_ZERO_ADMIN_LOCKOUT');

      // Attempting to demote the sole active admin
      const demoteCheck = evaluateProtectedInvariant(
        superActor,
        'users.change_role',
        { targetUser: singleAdmin[0], targetRole: 'user' },
        singleAdmin
      );
      expect(demoteCheck.allowed).toBe(false);
      expect(demoteCheck.code).toBe('INVARIANT_ZERO_ADMIN_LOCKOUT');
    });

    it('evaluates AccountManagementAction edit policy rules directly via 6×6 matrix (deferred feature authorization foundation)', () => {
      // 1. Policy authorization rules for direct account editing permitted by the role matrix
      const devActor = { id: 'USR_DEV_001', role: 'developer' as UserRole };
      const superActor = { id: 'USR_SUPER_001', role: 'super_admin' as UserRole };
      const adminActor = { id: 'usr_admin_001', role: 'admin' as UserRole };
      const assistantActor = { id: 'USR016', role: 'assistant_admin' as UserRole };
      const lecturerActor = { id: 'USR003', role: 'lecturer' as UserRole };
      const userActor = { id: 'USR004', role: 'user' as UserRole };

      // Developer editing Super Admin (policy authorization rule)
      expect(evaluateProtectedInvariant(devActor, 'edit', { targetUser: { id: 'USR_SUPER_001', role: 'super_admin' } }).allowed).toBe(true);

      // Super Admin editing Admin (policy authorization rule)
      expect(evaluateProtectedInvariant(superActor, 'edit', { targetUser: { id: 'usr_admin_001', role: 'admin' } }).allowed).toBe(true);

      // Admin editing Assistant Admin, Lecturer, User (policy authorization rule)
      expect(evaluateProtectedInvariant(adminActor, 'edit', { targetUser: { id: 'USR016', role: 'assistant_admin' } }).allowed).toBe(true);
      expect(evaluateProtectedInvariant(adminActor, 'edit', { targetUser: { id: 'USR003', role: 'lecturer' } }).allowed).toBe(true);
      expect(evaluateProtectedInvariant(adminActor, 'edit', { targetUser: { id: 'USR004', role: 'user' } }).allowed).toBe(true);

      // 2. Self-profile metadata editing policy rules (permitted across all 6 roles)
      expect(evaluateProtectedInvariant(devActor, 'edit', { targetUser: { id: 'USR_DEV_001', role: 'developer' } }).allowed).toBe(true);
      expect(evaluateProtectedInvariant(superActor, 'edit', { targetUser: { id: 'USR_SUPER_001', role: 'super_admin' } }).allowed).toBe(true);
      expect(evaluateProtectedInvariant(adminActor, 'edit', { targetUser: { id: 'usr_admin_001', role: 'admin' } }).allowed).toBe(true);
      expect(evaluateProtectedInvariant(assistantActor, 'edit', { targetUser: { id: 'USR016', role: 'assistant_admin' } }).allowed).toBe(true);
      expect(evaluateProtectedInvariant(lecturerActor, 'edit', { targetUser: { id: 'USR003', role: 'lecturer' } }).allowed).toBe(true);
      expect(evaluateProtectedInvariant(userActor, 'edit', { targetUser: { id: 'USR004', role: 'user' } }).allowed).toBe(true);

      // 3. Protected-target edit policy rejection
      // Super Admin peer edit rejected (INV-R2, OD-01)
      const peerSuperRes = evaluateProtectedInvariant(superActor, 'edit', { targetUser: { id: 'USR_SUPER_002', role: 'super_admin' } });
      expect(peerSuperRes.allowed).toBe(false);
      expect(peerSuperRes.code).toBe('INVARIANT_SUPER_ADMIN_EXCLUSIVITY');

      // Admin peer edit rejected (INV-R3)
      const peerAdminRes = evaluateProtectedInvariant(adminActor, 'edit', { targetUser: { id: 'usr_admin_002', role: 'admin' } });
      expect(peerAdminRes.allowed).toBe(false);
      expect(peerAdminRes.code).toBe('INVARIANT_ADMIN_PROTECTED');

      // Non-developer targeting developer rejected (INV-R1, INV-R8)
      const devTargetRes = evaluateProtectedInvariant(adminActor, 'edit', { targetUser: { id: 'USR_DEV_001', role: 'developer' } });
      expect(devTargetRes.allowed).toBe(false);
      expect(devTargetRes.code).toBe('INVARIANT_DEVELOPER_IMMUTABLE');

      // Assistant Admin targeting admin or assistant_admin rejected (INV-R5)
      const assistantToAdminRes = evaluateProtectedInvariant(assistantActor, 'edit', { targetUser: { id: 'usr_admin_001', role: 'admin' } });
      expect(assistantToAdminRes.allowed).toBe(false);
      expect(assistantToAdminRes.code).toBe('INVARIANT_ASSISTANT_ADMIN_CEILING');

      const assistantToAssistantRes = evaluateProtectedInvariant(assistantActor, 'edit', { targetUser: { id: 'USR017', role: 'assistant_admin' } });
      expect(assistantToAssistantRes.allowed).toBe(false);
      expect(assistantToAssistantRes.code).toBe('INVARIANT_ASSISTANT_ADMIN_CEILING');

      // 4. Assistant Admin edit on subordinate accounts
      // Within matrix target scope (Mode A: requires approval by default in future workflow)
      expect(canActorManageTargetAccount('assistant_admin', 'user', 'edit').allowed).toBe(true);
      expect(canActorManageTargetAccount('assistant_admin', 'lecturer', 'edit').allowed).toBe(true);

      // In delegation layer, no exact delegable capability exists for account editing (deferred scope)
      expect(inMemoryStore.hasDelegatedCapability('USR016', 'edit')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 3: In-Memory Store Invariant Enforcement (inMemoryStore)
  // ─────────────────────────────────────────────────────────────────────────
  describe('3. In-Memory Store Invariant Enforcement', () => {
    describe('3.1 createUser Store Invariants', () => {
      it('rejects in-app creation of developer account with 403 (INV-R1)', () => {
        const devActor = { id: 'USR_DEV_001', role: 'developer' as UserRole };
        const payload: CreateUserRequestDTO = {
          name: 'مطور جديد',
          username: 'new_dev',
          email: 'new.dev@metro.gov.eg',
          jobTitle: 'كبير مهندسين',
          department: 'قطاع التكنولوجيا',
          role: 'developer',
          status: 'active',
          password: 'Password123!',
        };

        expect(() => {
          inMemoryStore.createUser(payload, devActor);
        }).toThrow(MockStoreError);

        try {
          inMemoryStore.createUser(payload, devActor);
        } catch (err) {
          expect((err as MockStoreError).status).toBe(403);
          expect((err as MockStoreError).message).toContain('المطورين');
        }
      });

      it('rejects creation of super_admin by super_admin with 403 (INV-R2)', () => {
        const superActor = { id: 'USR_SUPER_001', role: 'super_admin' as UserRole };
        const payload: CreateUserRequestDTO = {
          name: 'مسؤول أعلى جديد',
          username: 'new_super',
          email: 'new.super@metro.gov.eg',
          jobTitle: 'مسؤول أعلى',
          department: 'الإدارة العليا',
          role: 'super_admin',
          status: 'active',
          password: 'Password123!',
        };

        expect(() => {
          inMemoryStore.createUser(payload, superActor);
        }).toThrow(MockStoreError);

        try {
          inMemoryStore.createUser(payload, superActor);
        } catch (err) {
          expect((err as MockStoreError).status).toBe(403);
        }
      });

      it('allows developer to create super_admin and super_admin to create admin', () => {
        const devActor = { id: 'USR_DEV_001', role: 'developer' as UserRole };
        const superPayload: CreateUserRequestDTO = {
          name: 'مسؤول أعلى جديد',
          username: 'new_super_by_dev',
          email: 'super.by.dev@metro.gov.eg',
          jobTitle: 'مسؤول أعلى',
          department: 'الإدارة العليا',
          role: 'super_admin',
          status: 'active',
          password: 'Password123!',
        };
        const createdSuper = inMemoryStore.createUser(superPayload, devActor);
        expect(createdSuper.role).toBe('super_admin');

        const superActor = { id: 'USR_SUPER_001', role: 'super_admin' as UserRole };
        const adminPayload: CreateUserRequestDTO = {
          name: 'مدير نظام جديد',
          username: 'new_admin_by_super',
          email: 'admin.by.super@metro.gov.eg',
          jobTitle: 'مدير نظام',
          department: 'إدارة تكنولوجيا المعلومات',
          role: 'admin',
          status: 'active',
          password: 'Password123!',
        };
        const createdAdmin = inMemoryStore.createUser(adminPayload, superActor);
        expect(createdAdmin.role).toBe('admin');
      });

      it('rejects regular admin creating admin with 403 (INV-R3)', () => {
        const adminActor = { id: 'usr_admin_001', role: 'admin' as UserRole };
        const payload: CreateUserRequestDTO = {
          name: 'مدير نظام آخر',
          username: 'peer_admin',
          email: 'peer.admin@metro.gov.eg',
          jobTitle: 'مدير نظام',
          department: 'إدارة تكنولوجيا المعلومات',
          role: 'admin',
          status: 'active',
          password: 'Password123!',
        };

        expect(() => {
          inMemoryStore.createUser(payload, adminActor);
        }).toThrow(MockStoreError);

        try {
          inMemoryStore.createUser(payload, adminActor);
        } catch (err) {
          expect((err as MockStoreError).status).toBe(403);
        }
      });

      it('allows regular admin to create assistant_admin (D-05)', () => {
        const adminActor = { id: 'usr_admin_001', role: 'admin' as UserRole };
        const payload: CreateUserRequestDTO = {
          name: 'مساعد مدير جديد',
          username: 'new_asst_admin',
          email: 'new.asst@metro.gov.eg',
          jobTitle: 'مساعد مدير',
          department: 'إدارة تكنولوجيا المعلومات',
          role: 'assistant_admin',
          status: 'active',
          password: 'Password123!',
        };

        const created = inMemoryStore.createUser(payload, adminActor);
        expect(created.role).toBe('assistant_admin');
      });
    });

    describe('3.2 updateUserRole Store Invariants (INV-R7 Dual-State)', () => {
      it('rejects regular admin promoting user to admin with 403', () => {
        const adminActor = { id: 'usr_admin_001', role: 'admin' as UserRole };
        expect(() => {
          inMemoryStore.updateUserRole('USR003', 'admin', adminActor);
        }).toThrow(MockStoreError);

        try {
          inMemoryStore.updateUserRole('USR003', 'admin', adminActor);
        } catch (err) {
          expect((err as MockStoreError).status).toBe(403);
        }
      });

      it('allows super admin to promote user to admin', () => {
        const superActor = { id: 'USR_SUPER_001', role: 'super_admin' as UserRole };
        const updated = inMemoryStore.updateUserRole('USR003', 'admin', superActor);
        expect(updated.role).toBe('admin');
      });

      it('rejects any promotion to developer with 403 (INV-R1)', () => {
        const superActor = { id: 'USR_SUPER_001', role: 'super_admin' as UserRole };
        expect(() => {
          inMemoryStore.updateUserRole('USR003', 'developer', superActor);
        }).toThrow(MockStoreError);

        try {
          inMemoryStore.updateUserRole('USR003', 'developer', superActor);
        } catch (err) {
          expect((err as MockStoreError).status).toBe(403);
          expect((err as MockStoreError).message).toContain('المطورين');
        }
      });

      it('rejects self role change with 403 (INV-R6 Anti-Self-Dealing)', () => {
        const adminActor = { id: 'usr_admin_001', role: 'admin' as UserRole };
        expect(() => {
          inMemoryStore.updateUserRole('usr_admin_001', 'user', adminActor);
        }).toThrow(MockStoreError);

        try {
          inMemoryStore.updateUserRole('usr_admin_001', 'user', adminActor);
        } catch (err) {
          expect((err as MockStoreError).status).toBe(403);
        }
      });
    });

    describe('3.3 updateUserStatus Store Invariants (INV-R2, INV-R3, INV-R6)', () => {
      it('rejects regular admin suspending peer admin with 403 (INV-R3)', () => {
        const adminActor = { id: 'usr_admin_001', role: 'admin' as UserRole };
        expect(() => {
          inMemoryStore.updateUserStatus('USR001', 'suspended', 'اختبار إيقاف النظير', adminActor);
        }).toThrow(MockStoreError);

        try {
          inMemoryStore.updateUserStatus('USR001', 'suspended', 'اختبار إيقاف النظير', adminActor);
        } catch (err) {
          expect((err as MockStoreError).status).toBe(403);
        }
      });

      it('allows super admin to suspend regular admin when multiple admins exist', () => {
        const superActor = { id: 'USR_SUPER_001', role: 'super_admin' as UserRole };
        const updated = inMemoryStore.updateUserStatus('USR001', 'suspended', 'إيقاف إداري', superActor);
        expect(updated.status).toBe('suspended');
      });

      it('rejects super admin suspending peer super admin with 403 (OD-01)', () => {
        // Seed peer super admin
        inMemoryStore.getManagedUsersStore().push({
          id: 'USR_SUPER_002',
          name: 'مسؤول أعلى نظير',
          username: 'super_peer',
          email: 'super.peer@metro.gov.eg',
          phone: '01000000001',
          jobTitle: 'مسؤول أعلى',
          department: 'الإدارة العليا',
          role: 'super_admin',
          status: 'active',
          createdAt: '2025-01-01',
          lastLogin: '2026-03-01',
        });

        const superActor = { id: 'USR_SUPER_001', role: 'super_admin' as UserRole };
        expect(() => {
          inMemoryStore.updateUserStatus('USR_SUPER_002', 'suspended', 'إيقاف نظير', superActor);
        }).toThrow(MockStoreError);

        try {
          inMemoryStore.updateUserStatus('USR_SUPER_002', 'suspended', 'إيقاف نظير', superActor);
        } catch (err) {
          expect((err as MockStoreError).status).toBe(403);
        }
      });

      it('rejects self-suspension with 403 (INV-R6 Anti-Self-Dealing)', () => {
        const adminActor = { id: 'usr_admin_001', role: 'admin' as UserRole };
        expect(() => {
          inMemoryStore.updateUserStatus('usr_admin_001', 'suspended', 'إيقاف ذاتي', adminActor);
        }).toThrow(MockStoreError);

        try {
          inMemoryStore.updateUserStatus('usr_admin_001', 'suspended', 'إيقاف ذاتي', adminActor);
        } catch (err) {
          expect((err as MockStoreError).status).toBe(403);
        }
      });
    });

    describe('3.4 deleteUser Store Invariants (OD-01, OD-02, INV-R6)', () => {
      it('rejects regular admin deleting peer admin with 403 (INV-R3)', () => {
        const adminActor = { id: 'usr_admin_001', role: 'admin' as UserRole };
        expect(() => {
          inMemoryStore.deleteUser('USR001', adminActor);
        }).toThrow(MockStoreError);

        try {
          inMemoryStore.deleteUser('USR001', adminActor);
        } catch (err) {
          expect((err as MockStoreError).status).toBe(403);
        }
      });

      it('allows regular admin to permanently delete assistant_admin (OD-02)', () => {
        // Seed assistant admin
        inMemoryStore.getManagedUsersStore().push({
          id: 'USR_ASST_TARGET',
          name: 'مساعد مدير مستهدف',
          username: 'asst_target',
          email: 'asst.target@metro.gov.eg',
          phone: '01000000002',
          jobTitle: 'مساعد مدير',
          department: 'إدارة تكنولوجيا المعلومات',
          role: 'assistant_admin',
          status: 'active',
          createdAt: '2025-01-01',
          lastLogin: '2026-03-01',
        });

        const adminActor = { id: 'usr_admin_001', role: 'admin' as UserRole };
        const result = inMemoryStore.deleteUser('USR_ASST_TARGET', adminActor);
        expect(result).toBe(true);

        // Verify tombstoned and removed from active users
        expect(inMemoryStore.isUserTombstoned('USR_ASST_TARGET')).toBe(true);
        expect(inMemoryStore.getManagedUsersStore().some((u) => u.id === 'USR_ASST_TARGET')).toBe(false);
      });

      it('allows super admin to delete regular admin when multiple admins exist', () => {
        const superActor = { id: 'USR_SUPER_001', role: 'super_admin' as UserRole };
        const result = inMemoryStore.deleteUser('USR001', superActor);
        expect(result).toBe(true);
        expect(inMemoryStore.isUserTombstoned('USR001')).toBe(true);
      });

      it('rejects super admin deleting peer super admin with 403 (OD-01)', () => {
        inMemoryStore.getManagedUsersStore().push({
          id: 'USR_SUPER_PEER_DEL',
          name: 'مسؤول أعلى نظير للحذف',
          username: 'super_peer_del',
          email: 'super.peer.del@metro.gov.eg',
          phone: '01000000003',
          jobTitle: 'مسؤول أعلى',
          department: 'الإدارة العليا',
          role: 'super_admin',
          status: 'active',
          createdAt: '2025-01-01',
          lastLogin: '2026-03-01',
        });

        const superActor = { id: 'USR_SUPER_001', role: 'super_admin' as UserRole };
        expect(() => {
          inMemoryStore.deleteUser('USR_SUPER_PEER_DEL', superActor);
        }).toThrow(MockStoreError);

        try {
          inMemoryStore.deleteUser('USR_SUPER_PEER_DEL', superActor);
        } catch (err) {
          expect((err as MockStoreError).status).toBe(403);
        }
      });

      it('rejects self-deletion with 403 (INV-R6 Anti-Self-Dealing)', () => {
        const adminActor = { id: 'usr_admin_001', role: 'admin' as UserRole };
        expect(() => {
          inMemoryStore.deleteUser('usr_admin_001', adminActor);
        }).toThrow(MockStoreError);

        try {
          inMemoryStore.deleteUser('usr_admin_001', adminActor);
        } catch (err) {
          expect((err as MockStoreError).status).toBe(403);
        }
      });
    });

    describe('3.5 Permissions & Delegation Anti-Self-Dealing (INV-R6)', () => {
      it('rejects self-granting permission overrides with 403', () => {
        const adminActor = { id: 'usr_admin_001', role: 'admin' as UserRole };
        expect(() => {
          inMemoryStore.setUserPermissionOverride({
            userId: 'usr_admin_001',
            grantedPermissions: ['permissions.configure_roles'],
            revokedPermissions: [],
            updatedBy: adminActor.id,
          });
        }).toThrow(MockStoreError);

        try {
          inMemoryStore.setUserPermissionOverride({
            userId: 'usr_admin_001',
            grantedPermissions: ['permissions.configure_roles'],
            revokedPermissions: [],
            updatedBy: adminActor.id,
          });
        } catch (err) {
          expect((err as MockStoreError).status).toBe(403);
        }
      });

      it('rejects self-delegation with 403', () => {
        const adminActor = { id: 'usr_admin_001', role: 'admin' as UserRole };
        expect(() => {
          inMemoryStore.setDelegatedAuthority('usr_admin_001', true, adminActor);
        }).toThrow(MockStoreError);

        try {
          inMemoryStore.setDelegatedAuthority('usr_admin_001', true, adminActor);
        } catch (err) {
          expect((err as MockStoreError).status).toBe(403);
        }
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 4: Developer Concealment (INV-R8) Direct Lookup Parity & MSW API
  // ─────────────────────────────────────────────────────────────────────────
  describe('4. Developer Direct Lookup Concealment (INV-R8)', () => {
    beforeEach(() => {
      // Ensure Developer account is seeded in store for testing direct lookup concealment
      if (!inMemoryStore.getManagedUsersStore().some((u) => u.id === 'USR_DEV_001')) {
        inMemoryStore.getManagedUsersStore().push({
          id: 'USR_DEV_001',
          name: 'مطور النظام',
          username: 'developer_demo',
          email: 'developer.metro@internal.local',
          phone: '01000000000',
          jobTitle: 'كبير مهندسي النظام',
          department: 'هندسة البرمجيات والتطوير',
          role: 'developer',
          status: 'active',
          createdAt: '2025-01-01',
          lastLogin: '2026-03-01',
        });
      }
    });

    it('returns undefined from store getManagedUserById for non-developer actor', () => {
      // Admin looking up Developer -> returns undefined
      expect(inMemoryStore.getManagedUserById('USR_DEV_001', 'admin')).toBeUndefined();
      // Super Admin looking up Developer -> returns undefined
      expect(inMemoryStore.getManagedUserById('USR_DEV_001', 'super_admin')).toBeUndefined();
      // Assistant Admin looking up Developer -> returns undefined
      expect(inMemoryStore.getManagedUserById('USR_DEV_001', 'assistant_admin')).toBeUndefined();

      // Developer looking up Developer -> returns the user record
      const devUser = inMemoryStore.getManagedUserById('USR_DEV_001', 'developer');
      expect(devUser).toBeDefined();
      expect(devUser?.id).toBe('USR_DEV_001');
      expect(devUser?.role).toBe('developer');
    });

    it('returns null/404 from store getUserTranscript for non-developer actor', () => {
      expect(inMemoryStore.getUserTranscript('USR_DEV_001', 'admin')).toBeNull();
      expect(inMemoryStore.getUserTranscript('USR_DEV_001', 'super_admin')).toBeNull();
      expect(inMemoryStore.getUserTranscript('USR_DEV_001', 'developer')).toBeDefined();
    });

    it('enforces exact uniform 404 parity on MSW API endpoints when targeting Developer ID', async () => {
      const adminSessionUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
      authStorage.setSession({
        token: `mock_jwt_${adminSessionUser.id}_test`,
        user: adminSessionUser,
        expiresAt: Date.now() + 3600000,
      });

      // 1. PATCH /api/admin/users/:id/role targeting Developer returns 404
      let devRoleError: ApiError | null = null;
      try {
        await userManagementApi.updateUserRole('USR_DEV_001', 'admin');
      } catch (err) {
        devRoleError = err as ApiError;
      }
      expect(devRoleError).not.toBeNull();
      expect(devRoleError?.status).toBe(404);

      // 2. PATCH /api/admin/users/:id/role targeting completely non-existent user returns identical 404
      let nonExistentRoleError: ApiError | null = null;
      try {
        await userManagementApi.updateUserRole('USR_NON_EXISTENT_999', 'admin');
      } catch (err) {
        nonExistentRoleError = err as ApiError;
      }
      expect(nonExistentRoleError).not.toBeNull();
      expect(nonExistentRoleError?.status).toBe(404);
      expect(devRoleError?.message).toBe(nonExistentRoleError?.message);

      // 3. PATCH /api/admin/users/:id/status targeting Developer returns 404
      let devStatusError: ApiError | null = null;
      try {
        await userManagementApi.updateUserStatus('USR_DEV_001', 'suspended');
      } catch (err) {
        devStatusError = err as ApiError;
      }
      expect(devStatusError?.status).toBe(404);

      // 4. DELETE /api/admin/users/:id targeting Developer returns 404
      let devDeleteError: ApiError | null = null;
      try {
        await userManagementApi.deleteUser('USR_DEV_001');
      } catch (err) {
        devDeleteError = err as ApiError;
      }
      expect(devDeleteError?.status).toBe(404);

      // 5. GET /api/admin/users/:id/transcript targeting Developer returns 404
      let devTranscriptError: ApiError | null = null;
      try {
        await userManagementApi.getUserTranscript('USR_DEV_001');
      } catch (err) {
        devTranscriptError = err as ApiError;
      }
      expect(devTranscriptError?.status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 6: Assistant Admin Mode A & Exact Capability Delegation
  // [STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13]
  // ─────────────────────────────────────────────────────────────────────────
  describe('6. Assistant Admin Mode A & Exact Capability Delegation (Phase 2)', () => {
    const assistantActor = { id: 'USR016', role: 'assistant_admin' as UserRole };

    beforeEach(() => {
      authStorage.setSession({
        token: 'mock_jwt_USR016_test',
        user: {
          id: 'USR016',
          username: 'assistant_admin_demo',
          email: 'assistant.admin@cairo-metro.com',
          name: 'مساعد مدير النظام التجريبي',
          role: 'assistant_admin',
        },
        expiresAt: Date.now() + 3600000,
      });
    });

    describe('6.1 Undelegated Assistant Admin Requests Return HTTP 403 and Create Zero Approval Requests', () => {
      it('rejects undelegated POST /api/admin/users with 403 and creates NO ApprovalRequest', async () => {
        inMemoryStore.setDelegatedAuthority('USR016', false);
        const initialApprovalCount = inMemoryStore.getApprovalRequests().length;

        const payload: CreateUserRequestDTO = {
          name: 'متدرب تجريبي جديد',
          username: 'new_trainee_test',
          email: 'new.trainee@cairo-metro.com',
          jobTitle: 'مهندس اتصالات',
          department: 'قطاع الصيانة الكهربائية',
          role: 'user',
        };

        let apiError: ApiError | null = null;
        try {
          await userManagementApi.createUser(payload);
        } catch (err) {
          apiError = err as ApiError;
        }

        expect(apiError).not.toBeNull();
        expect(apiError?.status).toBe(403);
        expect(apiError?.code).toBe('INVARIANT_ASSISTANT_ADMIN_CEILING');

        // Zero ApprovalRequests created in Phase 2
        expect(inMemoryStore.getApprovalRequests().length).toBe(initialApprovalCount);
        // User not created in store
        expect(inMemoryStore.getManagedUsers().some((u) => u.username === 'new_trainee_test')).toBe(false);
      });

      it('rejects undelegated PATCH /api/admin/users/:id/role with 403 and creates NO ApprovalRequest', async () => {
        inMemoryStore.setDelegatedAuthority('USR016', false);
        const initialApprovalCount = inMemoryStore.getApprovalRequests().length;
        const initialRole = inMemoryStore.getManagedUserById('USR003')?.role;

        let apiError: ApiError | null = null;
        try {
          await userManagementApi.updateUserRole('USR003', 'lecturer');
        } catch (err) {
          apiError = err as ApiError;
        }

        expect(apiError).not.toBeNull();
        expect(apiError?.status).toBe(403);
        expect(apiError?.code).toBe('INVARIANT_ASSISTANT_ADMIN_CEILING');

        // Zero ApprovalRequests created
        expect(inMemoryStore.getApprovalRequests().length).toBe(initialApprovalCount);
        // Target role unchanged
        expect(inMemoryStore.getManagedUserById('USR003')?.role).toBe(initialRole);
      });

      it('rejects undelegated PATCH /api/admin/users/:id/status with 403 and creates NO ApprovalRequest', async () => {
        inMemoryStore.setDelegatedAuthority('USR016', false);
        const initialApprovalCount = inMemoryStore.getApprovalRequests().length;
        const initialStatus = inMemoryStore.getManagedUserById('USR003')?.status;

        let apiError: ApiError | null = null;
        try {
          await userManagementApi.updateUserStatus('USR003', 'suspended');
        } catch (err) {
          apiError = err as ApiError;
        }

        expect(apiError).not.toBeNull();
        expect(apiError?.status).toBe(403);
        expect(apiError?.code).toBe('INVARIANT_ASSISTANT_ADMIN_CEILING');

        // Zero ApprovalRequests created
        expect(inMemoryStore.getApprovalRequests().length).toBe(initialApprovalCount);
        // Target status unchanged
        expect(inMemoryStore.getManagedUserById('USR003')?.status).toBe(initialStatus);
      });

      it('rejects undelegated DELETE /api/admin/users/:id with 403 and creates NO ApprovalRequest', async () => {
        inMemoryStore.setDelegatedAuthority('USR016', false);
        const initialApprovalCount = inMemoryStore.getApprovalRequests().length;

        let apiError: ApiError | null = null;
        try {
          await userManagementApi.deleteUser('USR003');
        } catch (err) {
          apiError = err as ApiError;
        }

        expect(apiError).not.toBeNull();
        expect(apiError?.status).toBe(403);
        expect(apiError?.code).toBe('INVARIANT_ASSISTANT_ADMIN_CEILING');

        // Zero ApprovalRequests created
        expect(inMemoryStore.getApprovalRequests().length).toBe(initialApprovalCount);
        // Target user still exists
        expect(inMemoryStore.getManagedUserById('USR003')).toBeDefined();
      });
    });

    describe('6.2 Exact-Capability Delegation Matching', () => {
      it('permits operation matching the exact delegated capability, while blocking non-delegated capabilities', async () => {
        // Grant delegation specifically for 'users.create' ONLY
        inMemoryStore.setDelegatedAuthority('USR016', {
          capabilities: ['users.create'],
          active: true,
        });

        // 1. users.create succeeds directly
        const payload: CreateUserRequestDTO = {
          name: 'متدرب مفوض تجريبي',
          username: 'delegated_user_01',
          email: 'delegated.user01@cairo-metro.com',
          jobTitle: 'فني تشغيل',
          department: 'قطاع التشغيل',
          role: 'user',
        };
        const created = await userManagementApi.createUser(payload);
        expect(created.id).toBeDefined();
        expect(created.username).toBe('delegated_user_01');

        // 2. users.delete is NOT in delegation: rejected with 403
        let deleteError: ApiError | null = null;
        try {
          await userManagementApi.deleteUser('USR003');
        } catch (err) {
          deleteError = err as ApiError;
        }
        expect(deleteError?.status).toBe(403);
        expect(deleteError?.code).toBe('INVARIANT_ASSISTANT_ADMIN_CEILING');

        // 3. users.change_role is NOT in delegation: rejected with 403
        let roleError: ApiError | null = null;
        try {
          await userManagementApi.updateUserRole('USR003', 'lecturer');
        } catch (err) {
          roleError = err as ApiError;
        }
        expect(roleError?.status).toBe(403);
        expect(roleError?.code).toBe('INVARIANT_ASSISTANT_ADMIN_CEILING');
      });

      it('permits status change when specifically delegated for users.change_status, blocking role change', async () => {
        inMemoryStore.setDelegatedAuthority('USR016', {
          capabilities: ['users.change_status'],
          active: true,
        });

        // 1. users.change_status succeeds directly
        const updated = await userManagementApi.updateUserStatus('USR003', 'suspended');
        expect(updated.status).toBe('suspended');

        // 2. users.change_role is blocked with 403
        let roleError: ApiError | null = null;
        try {
          await userManagementApi.updateUserRole('USR003', 'lecturer');
        } catch (err) {
          roleError = err as ApiError;
        }
        expect(roleError?.status).toBe(403);
        expect(roleError?.code).toBe('INVARIANT_ASSISTANT_ADMIN_CEILING');
      });
    });

    describe('6.3 Inactive & Expired Delegation Grants Rejected', () => {
      it('rejects operation when delegation grant is inactive (active: false)', async () => {
        inMemoryStore.setDelegatedAuthority('USR016', {
          capabilities: ['users.create'],
          active: false,
        });

        let apiError: ApiError | null = null;
        try {
          await userManagementApi.createUser({
            name: 'مستخدم غير نشط',
            username: 'inactive_grant_user',
            email: 'inactive@cairo-metro.com',
            jobTitle: 'مهندس',
            department: 'التشغيل',
            role: 'user',
          });
        } catch (err) {
          apiError = err as ApiError;
        }
        expect(apiError?.status).toBe(403);
        expect(apiError?.code).toBe('INVARIANT_ASSISTANT_ADMIN_CEILING');
      });

      it('rejects operation when delegation grant is expired (expiresAt < now)', async () => {
        inMemoryStore.setDelegatedAuthority('USR016', {
          capabilities: ['users.create'],
          active: true,
          expiresAt: Date.now() - 5000, // Expired 5 seconds ago
        });

        let apiError: ApiError | null = null;
        try {
          await userManagementApi.createUser({
            name: 'مستخدم منتهي الصلاحية',
            username: 'expired_grant_user',
            email: 'expired@cairo-metro.com',
            jobTitle: 'مهندس',
            department: 'التشغيل',
            role: 'user',
          });
        } catch (err) {
          apiError = err as ApiError;
        }
        expect(apiError?.status).toBe(403);
        expect(apiError?.code).toBe('INVARIANT_ASSISTANT_ADMIN_CEILING');
      });

      it('permits operation when delegation grant is active and not expired (expiresAt > now)', async () => {
        inMemoryStore.setDelegatedAuthority('USR016', {
          capabilities: ['users.create'],
          active: true,
          expiresAt: Date.now() + 60000, // Valid for 60 seconds
        });

        const created = await userManagementApi.createUser({
          name: 'مستخدم تفويض ساري',
          username: 'valid_unexpired_user',
          email: 'valid.unexpired@cairo-metro.com',
          jobTitle: 'مهندس',
          department: 'التشغيل',
          role: 'user',
        });
        expect(created.id).toBeDefined();
        expect(created.username).toBe('valid_unexpired_user');
      });
    });

    describe('6.4 Resource Scope Enforcement on Delegation Grants', () => {
      it('respects resourceScope.groupId in hasDelegatedCapability', () => {
        inMemoryStore.setDelegatedAuthority('USR016', {
          capabilities: ['groups.edit_config'],
          active: true,
          resourceScope: { groupId: 'GRP001' },
        });

        // Matching group scope: authorized
        expect(
          inMemoryStore.hasDelegatedCapability('USR016', 'groups.edit_config', {
            targetGroupId: 'GRP001',
          })
        ).toBe(true);

        // Different group scope: blocked
        expect(
          inMemoryStore.hasDelegatedCapability('USR016', 'groups.edit_config', {
            targetGroupId: 'GRP002',
          })
        ).toBe(false);

        // Different capability within matching group: blocked
        expect(
          inMemoryStore.hasDelegatedCapability('USR016', 'groups.archive', {
            targetGroupId: 'GRP001',
          })
        ).toBe(false);
      });
    });

    describe('6.5 Direct Store Method Guardrails', () => {
      it('throws 403 on store mutation methods when assistant admin lacks delegation', () => {
        inMemoryStore.setDelegatedAuthority('USR016', false);

        // 1. createUser
        expect(() => {
          inMemoryStore.createUser(
            {
              name: 'مستخدم متجر',
              username: 'store_user_test',
              email: 'store.user@cairo-metro.com',
              jobTitle: 'مهندس',
              department: 'التشغيل',
              role: 'user',
            },
            assistantActor
          );
        }).toThrowError(/غير مصرح/);

        // 2. updateUserRole
        expect(() => {
          inMemoryStore.updateUserRole('USR003', 'lecturer', assistantActor);
        }).toThrowError(/غير مصرح/);

        // 3. updateUserStatus
        expect(() => {
          inMemoryStore.updateUserStatus('USR003', 'suspended', 'اختبار', assistantActor);
        }).toThrowError(/غير مصرح/);

        // 4. deleteUser
        expect(() => {
          inMemoryStore.deleteUser('USR003', assistantActor);
        }).toThrowError(/غير مصرح/);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 7: Final Delegation Hardening, Canonical Mapping & INV-R8 Parity
  // [STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13]
  // ─────────────────────────────────────────────────────────────────────────
  describe('7. Final Delegation Hardening, Canonical Mapping & INV-R8 Parity', () => {
    describe('7.1 Action-to-Capability Canonical Mapping & Context-Aware Resolution', () => {
      it('correctly maps standard operations to valid canonical SystemCapability keys', () => {
        expect(mapActionToSystemCapability('create')).toBe('users.create');
        expect(mapActionToSystemCapability('change_role')).toBe('users.change_role');
        expect(mapActionToSystemCapability('suspend')).toBe('users.change_status');
        expect(mapActionToSystemCapability('activate')).toBe('users.change_status');
        expect(mapActionToSystemCapability('delete')).toBe('users.delete');
        // Authoritative canonical capabilities pass through safely
        expect(mapActionToSystemCapability('courses.publish')).toBe('courses.publish');
        expect(mapActionToSystemCapability('learning.access_assigned')).toBe('learning.access_assigned');
        expect(mapActionToSystemCapability('materials.manage_folders')).toBe('materials.manage_folders');
      });

      it('fails closed on invented, ambiguous, or non-canonical strings', () => {
        // 'edit' and 'users.edit' are not canonical operational capabilities
        expect(mapActionToSystemCapability('edit')).toBeNull();
        expect(mapActionToSystemCapability('users.edit')).toBeNull();

        // 'governance.delegation' is an audit event, not a SystemCapability
        expect(mapActionToSystemCapability('governance.delegation')).toBeNull();

        // Generic 'users.view' is not in the canonical role capability inventory
        expect(mapActionToSystemCapability('users.view')).toBeNull();

        // Arbitrary unknown strings must fail closed
        expect(mapActionToSystemCapability('arbitrary.invented.key')).toBeNull();
        expect(mapActionToSystemCapability('')).toBeNull();
      });

      it('resolves manage_permissions contextually to configure_users vs manage_delegation', () => {
        // Default context maps to user permission overrides
        expect(mapActionToSystemCapability('manage_permissions')).toBe('permissions.configure_users');
        expect(mapActionToSystemCapability('manage_permissions', { subsystem: 'permissions' })).toBe('permissions.configure_users');

        // Delegation context maps to operational delegation management
        expect(mapActionToSystemCapability('manage_permissions', { isDelegation: true })).toBe('permissions.manage_delegation');
        expect(mapActionToSystemCapability('manage_permissions', { subsystem: 'delegation' })).toBe('permissions.manage_delegation');
      });

      it('resolves view contextually to directory vs transcript', () => {
        // Default scope maps to user directory view
        expect(mapActionToSystemCapability('view')).toBe('users.view_directory');
        expect(mapActionToSystemCapability('view', { scope: 'directory' })).toBe('users.view_directory');

        // Transcript scope maps to user transcript view
        expect(mapActionToSystemCapability('view', { isTranscript: true })).toBe('users.view_transcript');
        expect(mapActionToSystemCapability('view', { scope: 'transcript' })).toBe('users.view_transcript');
      });
    });

    describe('7.2 Exact-Capability Delegation Resolution & Store Hardening', () => {
      it('resolves operation names to canonical capability keys in hasDelegatedCapability and fails closed on invalid keys', () => {
        inMemoryStore.setDelegatedAuthority('USR016', {
          capabilities: ['users.create'],
          active: true,
        });

        // 'create' resolves to 'users.create' -> matches grant
        expect(inMemoryStore.hasDelegatedCapability('USR016', 'create')).toBe(true);
        expect(inMemoryStore.hasDelegatedCapability('USR016', 'users.create')).toBe(true);

        // 'delete' resolves to 'users.delete' -> does NOT match grant
        expect(inMemoryStore.hasDelegatedCapability('USR016', 'delete')).toBe(false);
        expect(inMemoryStore.hasDelegatedCapability('USR016', 'users.delete')).toBe(false);

        // Invented keys fail closed
        expect(inMemoryStore.hasDelegatedCapability('USR016', 'edit')).toBe(false);
        expect(inMemoryStore.hasDelegatedCapability('USR016', 'users.edit')).toBe(false);
        expect(inMemoryStore.hasDelegatedCapability('USR016', 'governance.delegation')).toBe(false);
        expect(inMemoryStore.hasDelegatedCapability('USR016', 'nonexistent.capability')).toBe(false);
      });

      it('rejects invalid externally supplied delegation capability keys with HTTP 400', () => {
        expect(() => {
          inMemoryStore.setDelegatedAuthority('USR016', {
            capabilities: ['invalid.unknown.cap' as unknown as SystemCapability],
          });
        }).toThrowError(/الصلاحية المطلوبة غير معرفة في النظام/);

        expect(() => {
          inMemoryStore.setDelegatedAuthority('USR016', {
            capabilities: ['users.edit' as unknown as SystemCapability],
          });
        }).toThrowError(/الصلاحية المطلوبة غير معرفة في النظام/);

        expect(() => {
          inMemoryStore.setDelegatedAuthority('USR016', {
            capabilities: ['governance.delegation' as unknown as SystemCapability],
          });
        }).toThrowError(/الصلاحية المطلوبة غير معرفة في النظام/);
      });

      it('strictly prevents Assistant Admin from receiving sovereign permission capabilities via delegation (INV-R5)', () => {
        // permissions.configure_users is sovereign
        expect(() => {
          inMemoryStore.setDelegatedAuthority('USR016', {
            capabilities: ['permissions.configure_users'],
          });
        }).toThrowError(/غير مصرح: لا يمكن تفويض صلاحيات سيادية/);

        // permissions.manage_delegation is sovereign
        expect(() => {
          inMemoryStore.setDelegatedAuthority('USR016', {
            capabilities: ['permissions.manage_delegation'],
          });
        }).toThrowError(/غير مصرح: لا يمكن تفويض صلاحيات سيادية/);

        // permissions.configure_roles is sovereign
        expect(() => {
          inMemoryStore.setDelegatedAuthority('USR016', {
            capabilities: ['permissions.configure_roles'],
          });
        }).toThrowError(/غير مصرح: لا يمكن تفويض صلاحيات سيادية/);

        // reviews.decide_course is sovereign
        expect(() => {
          inMemoryStore.setDelegatedAuthority('USR016', {
            capabilities: ['reviews.decide_course'],
          });
        }).toThrowError(/غير مصرح: لا يمكن تفويض صلاحيات سيادية/);
      });

      it('preserves boolean delegation compatibility by expanding strictly into approved non-sovereign set (no wildcard)', () => {
        inMemoryStore.setDelegatedAuthority('USR016', true);

        // Non-sovereign approval-required operations are authorized
        expect(inMemoryStore.hasDelegatedCapability('USR016', 'users.create')).toBe(true);
        expect(inMemoryStore.hasDelegatedCapability('USR016', 'users.change_status')).toBe(true);
        expect(inMemoryStore.hasDelegatedCapability('USR016', 'courses.publish')).toBe(true);

        // Sovereign capabilities are NEVER authorized by delegation
        expect(inMemoryStore.hasDelegatedCapability('USR016', 'permissions.configure_users')).toBe(false);
        expect(inMemoryStore.hasDelegatedCapability('USR016', 'permissions.manage_delegation')).toBe(false);
        expect(inMemoryStore.hasDelegatedCapability('USR016', 'permissions.configure_roles')).toBe(false);
        expect(inMemoryStore.hasDelegatedCapability('USR016', 'reviews.decide_course')).toBe(false);
      });

      it('validates delegation grants via API endpoint POST /api/admin/permissions/governance/delegation/:userId', async () => {
        authStorage.setSession({
          token: 'mock_jwt_usr_admin_001_test',
          user: {
            id: 'usr_admin_001',
            username: 'admin',
            email: 'admin@cairo-metro.com',
            name: 'مدير المنظومة',
            role: 'admin',
          },
          expiresAt: Date.now() + 3600000,
        });

        // 1. Valid exact capability grant returns HTTP 200
        const validRes = await fetch('/api/admin/permissions/governance/delegation/USR016', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer mock_jwt_usr_admin_001_test',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            enabled: true,
            capabilities: ['users.create', 'users.change_status'],
          }),
        });
        expect(validRes.status).toBe(200);

        // 2. Invalid unknown capability returns HTTP 400
        const invalidRes = await fetch('/api/admin/permissions/governance/delegation/USR016', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer mock_jwt_usr_admin_001_test',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            enabled: true,
            capabilities: ['invented.cap.key'],
          }),
        });
        expect(invalidRes.status).toBe(400);
        const invalidData = await invalidRes.json();
        expect(invalidData.code).toBe('INVARIANT_UNKNOWN_CAPABILITY');

        // 3. Sovereign capability for assistant_admin returns HTTP 403
        const sovereignRes = await fetch('/api/admin/permissions/governance/delegation/USR016', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer mock_jwt_usr_admin_001_test',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            enabled: true,
            capabilities: ['permissions.configure_roles'],
          }),
        });
        expect(sovereignRes.status).toBe(403);
        const sovereignData = await sovereignRes.json();
        expect(sovereignData.code).toBe('INVARIANT_ASSISTANT_ADMIN_CEILING');
      });
    });

    describe('7.3 hasDelegationBypass Cannot Be Forged via Context (Anti-Forgery Boundary)', () => {
      it('ignores caller-supplied hasDelegationBypass in context when no active grant exists in store', () => {
        inMemoryStore.setDelegatedAuthority('USR016', false);

        // Untrusted caller attempts to spoof delegation bypass
        const check = inMemoryStore.hasPermission('USR016', 'users.create', {
          hasDelegationBypass: true,
        } as unknown as Record<string, unknown>);

        // Trust boundary enforcement: must NOT execute directly
        expect(check.executionMode).toBe('requires_approval');
      });
    });

    describe('7.4 Delegation Management Boundaries & Self-Delegation Protection (INV-R6, INV-R4)', () => {
      it('blocks non-admin from configuring delegation', () => {
        const assistantActor = { id: 'USR016', role: 'assistant_admin' as UserRole };
        expect(() => {
          inMemoryStore.setDelegatedAuthority('USR003', true, assistantActor);
        }).toThrowError(/غير مصرح/);
      });

      it('strictly forbids self-delegation across all roles (INV-R6)', () => {
        const adminActor = { id: 'usr_admin_001', role: 'admin' as UserRole };
        expect(() => {
          inMemoryStore.setDelegatedAuthority('usr_admin_001', true, adminActor);
        }).toThrowError(/غير مصرح.*نفسه/);
      });

      it('blocks regular admin from delegating authority for super_admin', () => {
        const adminActor = { id: 'usr_admin_001', role: 'admin' as UserRole };
        expect(() => {
          inMemoryStore.setDelegatedAuthority('USR_SUPER_001', true, adminActor);
        }).toThrowError(/غير مصرح/);
      });
    });

    describe('7.5 INV-R8 Uniform 404 Parity Across Permission & Delegation Endpoints', () => {
      beforeEach(() => {
        // Authenticated as regular admin (non-developer)
        authStorage.setSession({
          token: 'mock_jwt_usr_admin_001_test',
          user: {
            id: 'usr_admin_001',
            username: 'admin',
            email: 'admin@cairo-metro.com',
            name: 'مدير المنظومة',
            role: 'admin',
          },
          expiresAt: Date.now() + 3600000,
        });
      });

      it('returns HTTP 404 on GET /api/admin/permissions/users/:userId targeting Developer', async () => {
        const res = await fetch('/api/admin/permissions/users/USR_DEV_001', {
          headers: { Authorization: 'Bearer mock_jwt_usr_admin_001_test' },
        });
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.message).toBe('المستخدم المطلوب غير موجود في دليل النظام');
      });

      it('returns HTTP 404 on PUT /api/admin/permissions/users/:userId targeting Developer', async () => {
        const res = await fetch('/api/admin/permissions/users/USR_DEV_001', {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer mock_jwt_usr_admin_001_test',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ grantedPermissions: ['users.view'] }),
        });
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.message).toBe('المستخدم المطلوب غير موجود في دليل النظام');
      });

      it('returns HTTP 404 on DELETE /api/admin/permissions/users/:userId targeting Developer', async () => {
        const res = await fetch('/api/admin/permissions/users/USR_DEV_001', {
          method: 'DELETE',
          headers: { Authorization: 'Bearer mock_jwt_usr_admin_001_test' },
        });
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.message).toBe('المستخدم المطلوب غير موجود في دليل النظام');
      });

      it('returns HTTP 404 on GET /api/admin/permissions/effective/:userId targeting Developer', async () => {
        const res = await fetch('/api/admin/permissions/effective/USR_DEV_001', {
          headers: { Authorization: 'Bearer mock_jwt_usr_admin_001_test' },
        });
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.message).toBe('المستخدم المطلوب غير موجود في دليل النظام');
      });

      it('returns HTTP 404 on GET /api/admin/permissions/governance/delegation/:userId targeting Developer', async () => {
        const res = await fetch('/api/admin/permissions/governance/delegation/USR_DEV_001', {
          headers: { Authorization: 'Bearer mock_jwt_usr_admin_001_test' },
        });
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.message).toBe('المستخدم المطلوب غير موجود في دليل النظام');
      });

      it('returns HTTP 404 on POST /api/admin/permissions/governance/delegation/:userId targeting Developer', async () => {
        const res = await fetch('/api/admin/permissions/governance/delegation/USR_DEV_001', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer mock_jwt_usr_admin_001_test',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ enabled: true }),
        });
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.message).toBe('المستخدم المطلوب غير موجود في دليل النظام');
      });

      it('permits Developer querying own effective permissions with HTTP 200', async () => {
        authStorage.setSession({
          token: 'mock_jwt_USR_DEV_001_test',
          user: {
            id: 'USR_DEV_001',
            username: 'developer',
            email: 'dev@cairo-metro.com',
            name: 'مطور النظام',
            role: 'developer',
          },
          expiresAt: Date.now() + 3600000,
        });

        const res = await fetch('/api/admin/permissions/effective/USR_DEV_001', {
          headers: { Authorization: 'Bearer mock_jwt_USR_DEV_001_test' },
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.role).toBe('developer');
      });
    });
  });
});
