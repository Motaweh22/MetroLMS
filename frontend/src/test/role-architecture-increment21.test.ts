import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ToastProvider } from '@/shared/ui/Toast';
import type { UserRole } from '@/core/auth/types';
import {
  ROLE_CANONICAL_LABELS_AR,
  ROLE_DISPLAY_LABELS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_DEFINITIONS,
  PERMISSION_CATEGORIES,
  type SystemCapability,
  type GroupAssistantAssignment,
} from '@/core/permissions/types';
import { USER_ROLE_LABELS_AR } from '@/core/user-management/types';
import {
  ROLE_DEFAULT_CAPABILITIES,
  ROLE_CAPABILITY_CEILINGS,
  validatePermissionOverride,
  evaluatePermission,
} from '@/core/permissions/policy';
import {
  RolePermissionsMatrix,
  buildBaselineRoleState,
} from '@/features/permissions/components/RolePermissionsMatrix';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { resolveCanonicalUserId } from '@/core/auth/canonicalIdentity';
import { resolveAuthenticatedUser } from '@/mocks/handlers/resolveUser';

describe('Increment 2.1 — Canonical Role Model & Capability Foundation (MFR-37)', () => {
  const ALL_SIX_ROLES: UserRole[] = [
    'developer',
    'super_admin',
    'admin',
    'assistant_admin',
    'lecturer',
    'user',
  ];

  describe('1. Canonical Role Type Representation', () => {
    it('accurately represents all six canonical roles in the type system', () => {
      expect(ALL_SIX_ROLES).toHaveLength(6);
      expect(ALL_SIX_ROLES).toEqual([
        'developer',
        'super_admin',
        'admin',
        'assistant_admin',
        'lecturer',
        'user',
      ]);
    });

    it('confirms assistant_lecturer is NOT a global UserRole', () => {
      // Type assertion: assistant_lecturer cannot be assigned to UserRole
      // At runtime, verify it is absent from all role dictionaries and ceiling maps
      expect((ROLE_CANONICAL_LABELS_AR as Record<string, string>).assistant_lecturer).toBeUndefined();
      expect((USER_ROLE_LABELS_AR as Record<string, string>).assistant_lecturer).toBeUndefined();
      expect((DEFAULT_ROLE_PERMISSIONS as Record<string, unknown>).assistant_lecturer).toBeUndefined();
      expect((ROLE_DEFAULT_CAPABILITIES as Record<string, unknown>).assistant_lecturer).toBeUndefined();
      expect((ROLE_CAPABILITY_CEILINGS as Record<string, unknown>).assistant_lecturer).toBeUndefined();
    });

    it('preserves GroupAssistantAssignment as a scoped group assignment for lecturers', () => {
      const assignment: GroupAssistantAssignment = {
        groupId: 'GRP-101',
        assistantLecturerId: 'USR003',
        assignedByLecturerId: 'USR002',
        status: 'active',
        assignedAt: new Date().toISOString(),
      };
      expect(assignment.groupId).toBe('GRP-101');
      expect(assignment.assistantLecturerId).toBe('USR003');
      expect(assignment.status).toBe('active');
    });
  });

  describe('2. Canonical Arabic Role Labels', () => {
    it('defines authoritative canonical Arabic display labels for all six roles', () => {
      expect(ROLE_CANONICAL_LABELS_AR.developer).toBe('المطور');
      expect(ROLE_CANONICAL_LABELS_AR.super_admin).toBe('المسؤول الأعلى');
      expect(ROLE_CANONICAL_LABELS_AR.admin).toBe('مدير النظام');
      expect(ROLE_CANONICAL_LABELS_AR.assistant_admin).toBe('مدير النظام المساعد');
      expect(ROLE_CANONICAL_LABELS_AR.lecturer).toBe('المحاضر');
      expect(ROLE_CANONICAL_LABELS_AR.user).toBe('المتدرب');

      // ROLE_DISPLAY_LABELS is an alias of ROLE_CANONICAL_LABELS_AR
      expect(ROLE_DISPLAY_LABELS).toBe(ROLE_CANONICAL_LABELS_AR);
    });

    it('defines user management directory display labels for all six roles', () => {
      expect(USER_ROLE_LABELS_AR.developer).toBe('مطور');
      expect(USER_ROLE_LABELS_AR.super_admin).toBe('مسؤول أعلى');
      expect(USER_ROLE_LABELS_AR.admin).toBe('مدير');
      expect(USER_ROLE_LABELS_AR.assistant_admin).toBe('مساعد مدير');
      expect(USER_ROLE_LABELS_AR.lecturer).toBe('محاضر');
      expect(USER_ROLE_LABELS_AR.user).toBe('متدرب');
    });
  });

  describe('3. Role Default Capabilities & Capability Ceilings', () => {
    it('defines default capabilities and ceilings for all six canonical roles without holes', () => {
      for (const role of ALL_SIX_ROLES) {
        expect(ROLE_DEFAULT_CAPABILITIES[role]).toBeDefined();
        expect(Object.keys(ROLE_DEFAULT_CAPABILITIES[role])).not.toHaveLength(0);

        expect(ROLE_CAPABILITY_CEILINGS[role]).toBeDefined();
        expect(ROLE_CAPABILITY_CEILINGS[role].size).toBeGreaterThan(0);

        expect(DEFAULT_ROLE_PERMISSIONS[role]).toBeDefined();
        expect(DEFAULT_ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
      }
    });

    it('provisions super_admin with full sovereign administrative baseline and ceiling', () => {
      const superAdminCeiling = ROLE_CAPABILITY_CEILINGS.super_admin;
      const superAdminDefaults = ROLE_DEFAULT_CAPABILITIES.super_admin;

      // Verify all 34 system capability keys are present in super_admin ceiling
      for (const def of PERMISSION_DEFINITIONS) {
        expect(superAdminCeiling.has(def.key)).toBe(true);
      }

      // Verify essential admin operations are granted in defaults
      expect(superAdminDefaults['users.create']).toBe(true);
      expect(superAdminDefaults['users.delete']).toBe(true);
      expect(superAdminDefaults['users.change_role']).toBe(true);
      expect(superAdminDefaults['permissions.manage_delegation']).toBe(true);
      expect(superAdminDefaults['audit.view_system_logs']).toBe(true);
      expect(superAdminDefaults['approvals.decide_request']).toBe(true);
    });

    it('provisions developer with full ceiling across all currently defined SystemCapability values', () => {
      const developerCeiling = ROLE_CAPABILITY_CEILINGS.developer;
      const developerDefaults = ROLE_DEFAULT_CAPABILITIES.developer;

      // Verify all system capability keys are present in developer ceiling
      for (const def of PERMISSION_DEFINITIONS) {
        expect(developerCeiling.has(def.key)).toBe(true);
      }

      // Verify essential operations are granted in defaults
      expect(developerDefaults['users.view_directory']).toBe(true);
      expect(developerDefaults['users.delete']).toBe(true);
      expect(developerDefaults['courses.publish']).toBe(true);
      expect(developerDefaults['audit.view_system_logs']).toBe(true);
      expect(developerDefaults['permissions.configure_roles']).toBe(true);
    });
  });

  describe('4. Legacy Four-Role Invariant & Ceiling Preservation', () => {
    it('preserves strict trainee (user) ceiling: learning and transcript only', () => {
      const userCeiling = ROLE_CAPABILITY_CEILINGS.user;
      expect(userCeiling.has('learning.access_assigned')).toBe(true);
      expect(userCeiling.has('learning.self_enroll')).toBe(true);
      expect(userCeiling.has('users.view_transcript')).toBe(true);

      // Trainee must NOT have administrative capabilities in ceiling
      expect(userCeiling.has('users.create')).toBe(false);
      expect(userCeiling.has('users.delete')).toBe(false);
      expect(userCeiling.has('courses.publish')).toBe(false);
      expect(userCeiling.has('permissions.manage_delegation')).toBe(false);
      expect(userCeiling.has('audit.view_system_logs')).toBe(false);

      // validatePermissionOverride must reject trainee elevation beyond ceiling
      const result = validatePermissionOverride('user', 'users.create');
      expect(result.valid).toBe(false);
      expect(result.reasonAr).toContain('تتجاوز السقف الأقصى');
    });

    it('preserves lecturer ceiling: teaching and assigned group operations only', () => {
      const lecturerCeiling = ROLE_CAPABILITY_CEILINGS.lecturer;
      expect(lecturerCeiling.has('courses.create')).toBe(true);
      expect(lecturerCeiling.has('groups.manage_members')).toBe(true);
      expect(lecturerCeiling.has('materials.upload_files')).toBe(true);

      // Lecturer must NOT have platform governance capabilities in ceiling
      expect(lecturerCeiling.has('users.create')).toBe(false);
      expect(lecturerCeiling.has('users.delete')).toBe(false);
      expect(lecturerCeiling.has('permissions.configure_roles')).toBe(false);
      expect(lecturerCeiling.has('approvals.decide_request')).toBe(false);

      const result = validatePermissionOverride('lecturer', 'users.delete');
      expect(result.valid).toBe(false);
    });

    it('preserves assistant_admin ceiling: delegated operations only, sovereign admin blocked', () => {
      const assistantCeiling = ROLE_CAPABILITY_CEILINGS.assistant_admin;
      expect(assistantCeiling.has('users.create')).toBe(true);
      expect(assistantCeiling.has('groups.create')).toBe(true);
      expect(assistantCeiling.has('courses.create')).toBe(true);
      expect(assistantCeiling.has('approvals.submit_request')).toBe(true);

      // Sovereign admin capabilities are excluded from ceiling
      expect(assistantCeiling.has('reviews.decide_course')).toBe(false);
      expect(assistantCeiling.has('permissions.configure_roles')).toBe(false);
      expect(assistantCeiling.has('permissions.configure_users')).toBe(false);
      expect(assistantCeiling.has('permissions.manage_delegation')).toBe(false);
      expect(assistantCeiling.has('audit.view_system_logs')).toBe(false);
      expect(assistantCeiling.has('approvals.decide_request')).toBe(false);
    });
  });

  describe('5. Exhaustive Role Mapping & In-Memory Store Integration', () => {
    it('ensures inMemoryStore.getEffectiveRoleDefaults() returns configurations for all six roles', () => {
      const effectiveDefaults = inMemoryStore.getEffectiveRoleDefaults();
      for (const role of ALL_SIX_ROLES) {
        expect(effectiveDefaults[role]).toBeDefined();
      }
      expect(effectiveDefaults.developer['users.view_directory']).toBe(true);
      expect(effectiveDefaults.super_admin['users.view_directory']).toBe(true);
      expect(effectiveDefaults.admin['users.view_directory']).toBe(true);
      expect(effectiveDefaults.assistant_admin['users.view_directory']).toBe(true);
      expect(effectiveDefaults.lecturer['users.view_directory']).toBe(true);
      expect(effectiveDefaults.user['users.view_directory']).toBe(false);
    });
  });

  describe('6. Anti-Escalation & Safety Guardrails', () => {
    it('denies permissions when actor role is undefined or unrecognized', () => {
      const invalidActor = { id: 'anon_1', role: 'guest' as unknown as UserRole };
      const check = evaluatePermission(invalidActor, 'users.view_directory');
      expect(check.granted).toBe(false);
      expect(check.executionMode).toBe('denied');
      expect(check.reason).toBe('ROLE_CEILING_EXCEEDED');
    });

    it('prohibits granting capabilities above ceiling via individual overrides for trainee and lecturer', () => {
      const traineeCheck = evaluatePermission(
        { id: 'usr_trainee_001', role: 'user' },
        'users.create',
        {
          userOverrides: {
            usr_trainee_001: {
              userId: 'usr_trainee_001',
              granted: ['users.create'],
            },
          },
        }
      );
      // Even with an explicit granted override, the ceiling check rejects it
      expect(traineeCheck.granted).toBe(false);
      expect(traineeCheck.reason).toBe('ROLE_CEILING_EXCEEDED');

      const lecturerCheck = evaluatePermission(
        { id: 'usr_lect_001', role: 'lecturer' },
        'permissions.manage_delegation',
        {
          userOverrides: {
            usr_lect_001: {
              userId: 'usr_lect_001',
              granted: ['permissions.manage_delegation'],
            },
          },
        }
      );
      expect(lecturerCheck.granted).toBe(false);
      expect(lecturerCheck.reason).toBe('ROLE_CEILING_EXCEEDED');
    });
  });

  describe('7. Phase 1 Canonical Identity Compatibility Verification', () => {
    it('preserves resolveCanonicalUserId as the canonical user ID normalization function', () => {
      expect(typeof resolveCanonicalUserId).toBe('function');
      expect(resolveCanonicalUserId('usr001')).toBe('USR001');
      expect(resolveCanonicalUserId('usr016')).toBe('USR016');
      expect(resolveCanonicalUserId('usr_admin_001')).toBe('usr_admin_001');
      expect(resolveCanonicalUserId('assistant.admin@metro.gov.eg')).toBe('USR016');
    });

    it('preserves resolveAuthenticatedUser as the authenticated request identity resolver', () => {
      expect(typeof resolveAuthenticatedUser).toBe('function');
      // Unauthenticated request returns null
      const unauthReq = new Request('http://localhost:3000/api/auth/me');
      expect(resolveAuthenticatedUser(unauthReq)).toBeNull();
    });
  });

  describe('8. Exhaustive PermissionKey vs. SystemCapability Counts & Ceiling Reconciliation', () => {
    it('verifies exact counts and structure of UI PermissionKey definitions', () => {
      // PERMISSION_DEFINITIONS has exactly 35 entries across 5 UI categories
      expect(PERMISSION_DEFINITIONS).toHaveLength(35);
      expect(PERMISSION_CATEGORIES).toHaveLength(5);

      const categoryIds = new Set(PERMISSION_CATEGORIES.map((c) => c.id));
      expect(categoryIds).toEqual(new Set(['users', 'groups', 'courses', 'learning', 'governance']));

      // Every definition key is non-empty and belongs to a declared category
      for (const def of PERMISSION_DEFINITIONS) {
        expect(def.key).toBeDefined();
        expect(categoryIds.has(def.category)).toBe(true);
      }

      // DEFAULT_ROLE_PERMISSIONS covers all 6 canonical roles
      for (const role of ALL_SIX_ROLES) {
        expect(DEFAULT_ROLE_PERMISSIONS[role]).toBeDefined();
      }

      // Sovereign admin roles map all 35 definitions
      expect(DEFAULT_ROLE_PERMISSIONS.developer).toHaveLength(35);
      expect(DEFAULT_ROLE_PERMISSIONS.super_admin).toHaveLength(35);
      expect(DEFAULT_ROLE_PERMISSIONS.admin).toHaveLength(35);
      expect(DEFAULT_ROLE_PERMISSIONS.assistant_admin).toHaveLength(28);
      expect(DEFAULT_ROLE_PERMISSIONS.lecturer).toHaveLength(9);
      expect(DEFAULT_ROLE_PERMISSIONS.user).toHaveLength(2);
    });

    it('verifies exact counts and exhaustiveness of SystemCapability ceilings and defaults', () => {
      // ROLE_CAPABILITY_CEILINGS exact sizes
      expect(ROLE_CAPABILITY_CEILINGS.developer.size).toBe(39);
      expect(ROLE_CAPABILITY_CEILINGS.super_admin.size).toBe(39);
      expect(ROLE_CAPABILITY_CEILINGS.admin.size).toBe(39);
      expect(ROLE_CAPABILITY_CEILINGS.assistant_admin.size).toBe(32);
      expect(ROLE_CAPABILITY_CEILINGS.lecturer.size).toBe(16);
      expect(ROLE_CAPABILITY_CEILINGS.user.size).toBe(3);

      // Verify admin ceiling is identical to developer and super_admin ceilings
      const adminCeiling = ROLE_CAPABILITY_CEILINGS.admin;
      for (const cap of adminCeiling) {
        expect(ROLE_CAPABILITY_CEILINGS.developer.has(cap)).toBe(true);
        expect(ROLE_CAPABILITY_CEILINGS.super_admin.has(cap)).toBe(true);
      }

      // Verify assistant_admin strictly excludes sovereign admin capabilities
      const sovereignCaps: SystemCapability[] = [
        'reviews.decide_course',
        'permissions.configure_roles',
        'permissions.configure_users',
        'permissions.manage_delegation',
        'audit.view_system_logs',
        'approvals.decide_request',
        'learning.self_enroll',
      ];
      for (const cap of sovereignCaps) {
        expect(ROLE_CAPABILITY_CEILINGS.assistant_admin.has(cap)).toBe(false);
      }

      // Verify all 39 active capabilities are explicitly mapped in ROLE_DEFAULT_CAPABILITIES for all 6 roles
      for (const role of ALL_SIX_ROLES) {
        const defaults = ROLE_DEFAULT_CAPABILITIES[role];
        const keys = Object.keys(defaults);
        expect(keys).toHaveLength(39);
        for (const cap of adminCeiling) {
          expect(defaults[cap]).toBeDefined();
        }
      }
    });
  });

  describe('9. Capability Defaults vs. Capability Ceilings Evaluation Invariants', () => {
    it('verifies learning.self_enroll and approvals.submit_request are false in defaults but in ceiling', () => {
      // Developer and Super Admin: false in defaults
      expect(ROLE_DEFAULT_CAPABILITIES.developer['learning.self_enroll']).toBe(false);
      expect(ROLE_DEFAULT_CAPABILITIES.developer['approvals.submit_request']).toBe(false);
      expect(ROLE_DEFAULT_CAPABILITIES.super_admin['learning.self_enroll']).toBe(false);
      expect(ROLE_DEFAULT_CAPABILITIES.super_admin['approvals.submit_request']).toBe(false);

      // But present in ceilings
      expect(ROLE_CAPABILITY_CEILINGS.developer.has('learning.self_enroll')).toBe(true);
      expect(ROLE_CAPABILITY_CEILINGS.developer.has('approvals.submit_request')).toBe(true);
      expect(ROLE_CAPABILITY_CEILINGS.super_admin.has('learning.self_enroll')).toBe(true);
      expect(ROLE_CAPABILITY_CEILINGS.super_admin.has('approvals.submit_request')).toBe(true);
    });

    it('denies capability evaluation when default is false and no override is present', () => {
      // Developer actor without user override evaluating approvals.submit_request
      const devCheck = evaluatePermission(
        { id: 'usr_dev_001', role: 'developer' },
        'approvals.submit_request'
      );
      expect(devCheck.granted).toBe(false);
      expect(devCheck.executionMode).toBe('denied');
      expect(devCheck.source).toBe('role_default');

      // Super Admin actor without user override evaluating learning.self_enroll
      const superCheck = evaluatePermission(
        { id: 'usr_super_001', role: 'super_admin' },
        'learning.self_enroll'
      );
      expect(superCheck.granted).toBe(false);
      expect(superCheck.executionMode).toBe('denied');
      expect(superCheck.source).toBe('role_default');
    });

    it('grants capability when explicit user override is provided within role ceiling', () => {
      // Developer actor with granted user override for approvals.submit_request
      const devCheckWithOverride = evaluatePermission(
        { id: 'usr_dev_001', role: 'developer' },
        'approvals.submit_request',
        {
          userOverrides: {
            usr_dev_001: {
              userId: 'usr_dev_001',
              granted: ['approvals.submit_request'],
            },
          },
        }
      );
      expect(devCheckWithOverride.granted).toBe(true);
      expect(devCheckWithOverride.executionMode).toBe('direct');
      expect(devCheckWithOverride.source).toBe('user_override');
    });

    it('strictly denies user override when capability is outside role ceiling', () => {
      // Trainee (user) role attempting override for approvals.submit_request
      const userCheckWithOverride = evaluatePermission(
        { id: 'usr_trainee_001', role: 'user' },
        'approvals.submit_request',
        {
          userOverrides: {
            usr_trainee_001: {
              userId: 'usr_trainee_001',
              granted: ['approvals.submit_request'],
            },
          },
        }
      );
      expect(userCheckWithOverride.granted).toBe(false);
      expect(userCheckWithOverride.reason).toBe('ROLE_CEILING_EXCEEDED');
    });
  });

  describe('10. RolePermissionsMatrix Baseline & Working State Population', () => {
    it('populates non-empty default capabilities for developer and super_admin in buildBaselineRoleState', () => {
      const baseline = buildBaselineRoleState();

      // Developer and Super Admin baseline sets must be populated with 37 active capabilities each
      expect(baseline.developer.size).toBe(37);
      expect(baseline.super_admin.size).toBe(37);
      expect(baseline.admin.size).toBe(37);
      expect(baseline.assistant_admin.size).toBe(32);
      expect(baseline.lecturer.size).toBe(10);
      expect(baseline.user.size).toBe(3);

      // Verify specific essential capabilities are in developer and super_admin baseline sets
      expect(baseline.developer.has('users.view_directory')).toBe(true);
      expect(baseline.developer.has('courses.publish')).toBe(true);
      expect(baseline.developer.has('permissions.configure_roles')).toBe(true);

      expect(baseline.super_admin.has('users.view_directory')).toBe(true);
      expect(baseline.super_admin.has('courses.publish')).toBe(true);
      expect(baseline.super_admin.has('audit.view_system_logs')).toBe(true);
    });

    it('falls back to default capabilities for developer and super_admin when configs omit them', () => {
      // Configs only specifying custom capabilities for assistant_admin
      const partialConfigs = [
        {
          role: 'assistant_admin' as UserRole,
          capabilities: {
            'users.view_directory': true,
            'courses.create': true,
          } as Partial<Record<SystemCapability, boolean>>,
        },
      ];

      const baseline = buildBaselineRoleState(partialConfigs);
      // assistant_admin receives custom config
      expect(baseline.assistant_admin.size).toBe(2);
      expect(baseline.assistant_admin.has('users.view_directory')).toBe(true);

      // developer and super_admin still properly fallback to ROLE_DEFAULT_CAPABILITIES (37)
      expect(baseline.developer.size).toBe(37);
      expect(baseline.super_admin.size).toBe(37);
      expect(baseline.admin.size).toBe(37);
    });

    it('renders RolePermissionsMatrix component successfully with standard headers and policy notice', () => {
      render(
        React.createElement(
          ToastProvider,
          null,
          React.createElement(RolePermissionsMatrix, { readOnly: true })
        )
      );

      // Verify the matrix container is mounted
      expect(screen.getByTestId('role-permissions-matrix-container')).toBeDefined();

      // Verify the fixed baseline policy notice is rendered
      expect(screen.getByTestId('fixed-policy-notice')).toBeDefined();

      // Verify column headers for the visible operational roles are rendered
      expect(screen.getAllByText('مدير النظام').length).toBeGreaterThan(0);
      expect(screen.getAllByText('مدير النظام المساعد').length).toBeGreaterThan(0);
      expect(screen.getAllByText('المحاضر').length).toBeGreaterThan(0);
      expect(screen.getAllByText('المتدرب').length).toBeGreaterThan(0);
    });

    it('confirms RolePermissionsMatrix visible column scope intentionally excludes developer and super_admin', () => {
      render(
        React.createElement(
          ToastProvider,
          null,
          React.createElement(RolePermissionsMatrix, { readOnly: false })
        )
      );

      // Verify the 4 manageable operational roles are rendered
      expect(screen.getAllByText('مدير النظام').length).toBeGreaterThan(0);
      expect(screen.getAllByText('مدير النظام المساعد').length).toBeGreaterThan(0);
      expect(screen.getAllByText('المحاضر').length).toBeGreaterThan(0);
      expect(screen.getAllByText('المتدرب').length).toBeGreaterThan(0);

      // Verify developer and super_admin are NEVER rendered as table column headers (Surface 4 Non-Disclosure & Top-tier Admin Scope)
      expect(screen.queryByText('المطور')).toBeNull();
      expect(screen.queryByText('المسؤول الأعلى')).toBeNull();
    });

    it('enforces runtime ceiling validation against untrusted override payloads in inMemoryStore', () => {
      // Attempting to grant above-ceiling capability to a trainee via setUserPermissionOverride
      expect(() => {
        inMemoryStore.setUserPermissionOverride({
          userId: 'USR003',
          granted: ['users.create' as SystemCapability],
          reason: 'Attempted untrusted escalation',
        });
      }).toThrowError(/تتجاوز السقف الأقصى/);

      // Attempting to update role default above ceiling for assistant_admin
      expect(() => {
        inMemoryStore.updateRolePermissions(
          'assistant_admin',
          ['audit.view_system_logs' as SystemCapability],
          'usr_admin_001'
        );
      }).toThrowError(/تتجاوز السقف الأقصى/);
    });
  });
});
