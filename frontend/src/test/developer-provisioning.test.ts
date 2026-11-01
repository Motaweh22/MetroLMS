/**
 * Increment 2.4 — Secure Developer Provisioning & Fixture Gating Tests (MFR-45)
 *
 * GOVERNANCE & EXECUTION DIRECTIVE:
 * Per Owner Directive Part A (Consolidated Phase 13 Testing Workflow), this test suite
 * is authored and committed during Increment 2.4 implementation.
 *
 * STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
 * Zero test runner commands (vitest, tsc, lint, build) were executed during this turn.
 *
 * COVERAGE SPECIFICATION:
 * 1. Developer fixture inclusion in Development mode.
 * 2. Developer fixture absence in Production mode.
 * 3. Super Admin synthetic test persona availability in dev/test vs production boundary.
 * 4. Production fixture initialization excludes prohibited credential data.
 * 5. In-app / API user creation strictly rejects Developer role creation.
 * 6. Domain policy and store enforce INV-R1 against Developer creation across all actors.
 * 7. Role mutation cannot promote any user into the Developer role.
 * 8. Repeated fixture initialization is idempotent and never creates duplicate identities.
 * 9. Post-build artifact scanner accurately identifies prohibited fingerprints in test artifacts.
 * 10. Compatibility with Phase 1 canonical identity resolution and Increments 2.1–2.3 invariants.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  BASE_MANAGED_USERS,
  SYNTHETIC_DEVELOPER_USER,
  SYNTHETIC_SUPER_ADMIN_USER,
  INITIAL_MANAGED_USERS,
  getManagedUsersFixture,
} from '@/mocks/fixtures/userDirectoryFixtures';
import { CONTROLLED_TEST_FIXTURE_USERS } from '@/mocks/handlers/resolveUser';
import { inMemoryStore, MockStoreError } from '@/mocks/store/inMemoryStore';
import { canActorManageTargetAccount, evaluateProtectedInvariant } from '@/core/permissions/policy';
import { resolveCanonicalUserId } from '@/core/auth/canonicalIdentity';
import type { UserRole } from '@/core/auth/types';
import { scanDirectory } from '../../../scripts/verify-production-cleanliness.mjs';

describe('Increment 2.4 — Secure Developer Provisioning & Fixture Gating (MFR-45)', () => {
  let tempScanDir: string | null = null;

  beforeEach(() => {
    inMemoryStore.reset();
  });

  afterEach(() => {
    if (tempScanDir && fs.existsSync(tempScanDir)) {
      fs.rmSync(tempScanDir, { recursive: true, force: true });
      tempScanDir = null;
    }
  });

  // ── 1. Developer Fixture Inclusion in Development Mode ─────────────────────
  it('1. includes synthetic Developer fixture when running in Development mode', () => {
    // In Vite / Vitest development test environment, import.meta.env.DEV is true
    expect(import.meta.env.DEV).toBe(true);

    const devFixtures = getManagedUsersFixture('development');
    const devUser = devFixtures.find((u) => u.role === 'developer');

    expect(devUser).toBeDefined();
    expect(devUser?.id).toBe('USR_DEV_001');
    expect(devUser?.email).toBe('developer.metro@internal.local');
    expect(devUser?.name).toBe('مطور النظام');
    expect(devUser?.role).toBe('developer');
  });

  // ── 2. Developer Fixture Absence in Production Mode ────────────────────────
  it('2. strictly excludes Developer fixture when simulating Production mode', () => {
    const prodFixtures = getManagedUsersFixture('production');
    const devUser = prodFixtures.find((u) => u.role === 'developer');

    expect(devUser).toBeUndefined();
    expect(prodFixtures.some((u) => u.id === 'USR_DEV_001')).toBe(false);
    expect(prodFixtures.some((u) => u.email === 'developer.metro@internal.local')).toBe(false);
    expect(prodFixtures.length).toBe(BASE_MANAGED_USERS.length);
  });

  // ── 3. Super Admin Synthetic Test Fixture Boundary ─────────────────────────
  it('3. provides Super Admin synthetic persona in dev/test but excludes from production fixtures', () => {
    const devFixtures = getManagedUsersFixture('development');
    const superAdminInDev = devFixtures.find((u) => u.role === 'super_admin');
    expect(superAdminInDev).toBeDefined();
    expect(superAdminInDev?.id).toBe('USR_SUPER_001');
    expect(superAdminInDev?.email).toBe('superadmin@cairo-metro.com');

    const prodFixtures = getManagedUsersFixture('production');
    const superAdminInProd = prodFixtures.find((u) => u.role === 'super_admin');
    expect(superAdminInProd).toBeUndefined();
    expect(prodFixtures.some((u) => u.id === 'USR_SUPER_001')).toBe(false);
  });

  // ── 4. Production Fixture Cleanliness & Zero Credential Exposure ───────────
  it('4. ensures baseline production fixtures contain zero synthetic Developer/SuperAdmin credentials or records', () => {
    for (const user of BASE_MANAGED_USERS) {
      expect(user.id).not.toBe('USR_DEV_001');
      expect(user.id).not.toBe('USR_SUPER_001');
      expect(user.email).not.toBe('developer.metro@internal.local');
      expect(user.email).not.toBe('superadmin@cairo-metro.com');
      expect(user.name).not.toBe('مطور النظام');
      expect(user.role).not.toBe('developer');
      expect(user.role).not.toBe('super_admin');
    }
  });

  // ── 5. In-App / API User Creation Rejects Developer Role (INV-R1) ───────────
  it('5. rejects POST /api/admin/users requests attempting to create Developer accounts with HTTP 403', async () => {
    const adminToken = 'mock_jwt_usr_admin_001';

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'مطور برمجيات دخيل',
        username: 'unauthorized_dev',
        email: 'unauthorized.dev@metro.local',
        role: 'developer',
      }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.message).toContain('غير مصرح');
  });

  // ── 6. Domain Policy & Store Enforce INV-R1 Across All Actors ──────────────
  it('6. canActorManageTargetAccount strictly blocks developer creation for all roles', () => {
    const roles: UserRole[] = ['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer', 'user'];

    for (const actorRole of roles) {
      const result = canActorManageTargetAccount(actorRole, 'developer', 'create');
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('INVARIANT_DEVELOPER_IMMUTABLE');

      const invCheck = evaluateProtectedInvariant(
        { id: 'actor_test', role: actorRole },
        'create',
        { targetRole: 'developer' }
      );
      expect(invCheck.allowed).toBe(false);
      expect(invCheck.code).toBe('INVARIANT_DEVELOPER_IMMUTABLE');
    }

    // Direct store mutation attempt must throw MockStoreError(403)
    expect(() => {
      inMemoryStore.createUser(
        {
          name: 'محاولة إنشاء مطور',
          username: 'rogue_dev',
          email: 'rogue.dev@metro.local',
          role: 'developer',
        },
        { id: 'usr_admin_001', role: 'admin' }
      );
    }).toThrow(MockStoreError);
  });

  // ── 7. Role Mutation Cannot Promote Any Account to Developer (INV-R1) ───────
  it('7. rejects PATCH /api/admin/users/:id/role attempts promoting to Developer role with HTTP 403', async () => {
    const adminToken = 'mock_jwt_usr_admin_001';

    const res = await fetch('/api/admin/users/USR001/role', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        role: 'developer',
      }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.message).toContain('غير مصرح');

    // Direct store mutation attempt must also throw
    expect(() => {
      inMemoryStore.updateUserRole('USR001', 'developer', { id: 'usr_admin_001', role: 'admin' });
    }).toThrow(MockStoreError);
  });

  // ── 8. Repeated Fixture Initialization Idempotency ─────────────────────────
  it('8. ensures repeated inMemoryStore resets are idempotent with zero duplicate synthetic identities', () => {
    // Perform multiple resets
    inMemoryStore.reset();
    inMemoryStore.reset();
    inMemoryStore.reset();

    const allUsers = inMemoryStore.getUsersRaw();
    const ids = allUsers.map((u) => u.id.toLowerCase());
    const uniqueIds = new Set(ids);

    expect(ids.length).toBe(uniqueIds.size);

    const devMatches = allUsers.filter((u) => u.role === 'developer');
    if (import.meta.env.DEV) {
      expect(devMatches.length).toBeLessThanOrEqual(1);
    } else {
      expect(devMatches.length).toBe(0);
    }
  });

  // ── 9. Post-Build Artifact Scanner Verification ────────────────────────────
  it('9. post-build artifact scanner detects each prohibited fixture fingerprint and ignores benign generic strings', () => {
    // Create an isolated temporary test directory
    tempScanDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metrolms-artifact-scan-test-'));

    // Subcase A: Clean bundle containing legitimate domain role strings
    const cleanBundleFile = path.join(tempScanDir, 'clean-bundle.js');
    fs.writeFileSync(
      cleanBundleFile,
      `
      // Legitimate production domain code
      const validRoles = ['developer', 'super_admin', 'admin', 'lecturer', 'user'];
      function checkRole(r) { return r === 'developer'; }
      export const capabilities = ['users.create', 'audit.view_system_logs'];
      `,
      'utf8'
    );

    const cleanResult = scanDirectory(tempScanDir);
    expect(cleanResult.clean).toBe(true);
    expect(cleanResult.violations).toHaveLength(0);

    // Subcase B: Injecting USR_DEV_001 fingerprint
    const taintedDevIdFile = path.join(tempScanDir, 'tainted-dev-id.js');
    fs.writeFileSync(taintedDevIdFile, `const fallbackId = "USR_DEV_001";`, 'utf8');

    const resultAfterDevId = scanDirectory(tempScanDir);
    expect(resultAfterDevId.clean).toBe(false);
    expect(resultAfterDevId.violations.some((v) => v.rule.includes('USR_DEV_001'))).toBe(true);
    fs.unlinkSync(taintedDevIdFile);

    // Subcase C: Injecting Developer email fingerprint
    const taintedEmailFile = path.join(tempScanDir, 'tainted-email.js');
    fs.writeFileSync(taintedEmailFile, `const email = "developer.metro@internal.local";`, 'utf8');

    const resultAfterEmail = scanDirectory(tempScanDir);
    expect(resultAfterEmail.clean).toBe(false);
    expect(resultAfterEmail.violations.some((v) => v.rule.includes('developer.metro@internal.local'))).toBe(true);
    fs.unlinkSync(taintedEmailFile);

    // Subcase D: Injecting Developer Arabic name fingerprint
    const taintedNameFile = path.join(tempScanDir, 'tainted-name.js');
    fs.writeFileSync(taintedNameFile, `const author = "مطور النظام";`, 'utf8');

    const resultAfterName = scanDirectory(tempScanDir);
    expect(resultAfterName.clean).toBe(false);
    expect(resultAfterName.violations.some((v) => v.rule.includes('مطور النظام'))).toBe(true);
    fs.unlinkSync(taintedNameFile);

    // Subcase E: Injecting USR_SUPER_001 fingerprint
    const taintedSuperFile = path.join(tempScanDir, 'tainted-super.js');
    fs.writeFileSync(taintedSuperFile, `const adminId = "USR_SUPER_001";`, 'utf8');

    const resultAfterSuper = scanDirectory(tempScanDir);
    expect(resultAfterSuper.clean).toBe(false);
    expect(resultAfterSuper.violations.some((v) => v.rule.includes('USR_SUPER_001'))).toBe(true);
    fs.unlinkSync(taintedSuperFile);

    // Subcase F: Injecting Super Admin email fingerprint
    const taintedSuperEmailFile = path.join(tempScanDir, 'tainted-super-email.js');
    fs.writeFileSync(taintedSuperEmailFile, `const superEmail = "superadmin@cairo-metro.com";`, 'utf8');

    const resultAfterSuperEmail = scanDirectory(tempScanDir);
    expect(resultAfterSuperEmail.clean).toBe(false);
    expect(resultAfterSuperEmail.violations.some((v) => v.rule.includes('superadmin@cairo-metro.com'))).toBe(true);
    fs.unlinkSync(taintedSuperEmailFile);

    // Subcase G: Injecting Developer username fingerprint
    const taintedUsernameFile = path.join(tempScanDir, 'tainted-dev-username.js');
    fs.writeFileSync(taintedUsernameFile, `const user = { username: "developer_internal" };`, 'utf8');
    const resultAfterUsername = scanDirectory(tempScanDir);
    expect(resultAfterUsername.clean).toBe(false);
    expect(resultAfterUsername.violations.some((v) => v.rule.includes('developer_internal'))).toBe(true);
    fs.unlinkSync(taintedUsernameFile);

    // Subcase H: Injecting Developer phone number fingerprint
    const taintedPhoneFile = path.join(tempScanDir, 'tainted-dev-phone.js');
    fs.writeFileSync(taintedPhoneFile, `const phone = "01000000000";`, 'utf8');
    const resultAfterPhone = scanDirectory(tempScanDir);
    expect(resultAfterPhone.clean).toBe(false);
    expect(resultAfterPhone.violations.some((v) => v.rule.includes('01000000000'))).toBe(true);
    fs.unlinkSync(taintedPhoneFile);

    // Subcase I: Injecting Developer job title fingerprint
    const taintedJobTitleFile = path.join(tempScanDir, 'tainted-dev-title.js');
    fs.writeFileSync(taintedJobTitleFile, `const title = "كبير مهندسي النظام";`, 'utf8');
    const resultAfterJobTitle = scanDirectory(tempScanDir);
    expect(resultAfterJobTitle.clean).toBe(false);
    expect(resultAfterJobTitle.violations.some((v) => v.rule.includes('كبير مهندسي النظام'))).toBe(true);
    fs.unlinkSync(taintedJobTitleFile);

    // Subcase J: Injecting Developer department fingerprint
    const taintedDeptFile = path.join(tempScanDir, 'tainted-dev-dept.js');
    fs.writeFileSync(taintedDeptFile, `const dept = "هندسة البرمجيات والتطوير";`, 'utf8');
    const resultAfterDept = scanDirectory(tempScanDir);
    expect(resultAfterDept.clean).toBe(false);
    expect(resultAfterDept.violations.some((v) => v.rule.includes('هندسة البرمجيات والتطوير'))).toBe(true);
    fs.unlinkSync(taintedDeptFile);

    // Subcase K: Injecting Super Admin username fingerprint
    const taintedSuperUserFile = path.join(tempScanDir, 'tainted-super-username.js');
    fs.writeFileSync(taintedSuperUserFile, `const username = "super_admin_demo";`, 'utf8');
    const resultAfterSuperUser = scanDirectory(tempScanDir);
    expect(resultAfterSuperUser.clean).toBe(false);
    expect(resultAfterSuperUser.violations.some((v) => v.rule.includes('super_admin_demo'))).toBe(true);
    fs.unlinkSync(taintedSuperUserFile);

    // Subcase L: Injecting Super Admin persona name fingerprint
    const taintedSuperNameFile = path.join(tempScanDir, 'tainted-super-name.js');
    fs.writeFileSync(taintedSuperNameFile, `const adminName = "م. ياسين رضوان";`, 'utf8');
    const resultAfterSuperName = scanDirectory(tempScanDir);
    expect(resultAfterSuperName.clean).toBe(false);
    expect(resultAfterSuperName.violations.some((v) => v.rule.includes('ياسين رضوان'))).toBe(true);
    fs.unlinkSync(taintedSuperNameFile);

    // Subcase M: Injecting Super Admin phone number fingerprint
    const taintedSuperPhoneFile = path.join(tempScanDir, 'tainted-super-phone.js');
    fs.writeFileSync(taintedSuperPhoneFile, `const supPhone = "01000000001";`, 'utf8');
    const resultAfterSuperPhone = scanDirectory(tempScanDir);
    expect(resultAfterSuperPhone.clean).toBe(false);
    expect(resultAfterSuperPhone.violations.some((v) => v.rule.includes('01000000001'))).toBe(true);
    fs.unlinkSync(taintedSuperPhoneFile);

    // Subcase N: Injecting Super Admin job title fingerprint
    const taintedSuperTitleFile = path.join(tempScanDir, 'tainted-super-title.js');
    fs.writeFileSync(taintedSuperTitleFile, `const supTitle = "المسؤول الأعلى للأنظمة";`, 'utf8');
    const resultAfterSuperTitle = scanDirectory(tempScanDir);
    expect(resultAfterSuperTitle.clean).toBe(false);
    expect(resultAfterSuperTitle.violations.some((v) => v.rule.includes('المسؤول الأعلى للأنظمة'))).toBe(true);
    fs.unlinkSync(taintedSuperTitleFile);

    // Subcase O: Non-false-positive tolerance verification
    // 1. Legitimate public WhatsApp number (201000000000) must NOT trigger
    // 2. Legitimate canonical role label (المسؤول الأعلى) must NOT trigger
    // 3. Legitimate role strings ("developer", "super_admin") must NOT trigger
    const benignFile = path.join(tempScanDir, 'benign-domain-code.js');
    fs.writeFileSync(
      benignFile,
      `
      export const supportNumber = '201000000000';
      export const roleLabel = 'المسؤول الأعلى';
      export const developerRole = 'developer';
      export const superAdminRole = 'super_admin';
      export const supportLink = 'https://wa.me/201000000000';
      `,
      'utf8'
    );
    const benignResult = scanDirectory(tempScanDir);
    expect(benignResult.clean).toBe(true);
    expect(benignResult.violations).toHaveLength(0);
    fs.unlinkSync(benignFile);

    // Subcase P: Inject lowercase Developer legacy alias (usr_dev_001)
    const taintedLowerDevFile = path.join(tempScanDir, 'tainted-lower-dev.js');
    fs.writeFileSync(taintedLowerDevFile, `const legacyDevId = "usr_dev_001";`, 'utf8');
    const resultAfterLowerDev = scanDirectory(tempScanDir);
    expect(resultAfterLowerDev.clean).toBe(false);
    expect(resultAfterLowerDev.violations.some((v) => v.rule.includes('USR_DEV_001'))).toBe(true);
    fs.unlinkSync(taintedLowerDevFile);

    // Subcase Q: Inject lowercase Super Admin legacy alias (usr_super_001)
    const taintedLowerSuperFile = path.join(tempScanDir, 'tainted-lower-super.js');
    fs.writeFileSync(taintedLowerSuperFile, `const legacySuperId = "usr_super_001";`, 'utf8');
    const resultAfterLowerSuper = scanDirectory(tempScanDir);
    expect(resultAfterLowerSuper.clean).toBe(false);
    expect(resultAfterLowerSuper.violations.some((v) => v.rule.includes('USR_SUPER_001'))).toBe(true);
    fs.unlinkSync(taintedLowerSuperFile);

    // Subcase R: Verify exact email matching & rejection of loose wildcard matches
    // 1. Loose variants where dots are replaced by arbitrary characters must NOT trigger (proves literal dot escaping)
    const looseEmailFile = path.join(tempScanDir, 'loose-email-test.js');
    fs.writeFileSync(
      looseEmailFile,
      `
      // Loose variations must NOT trigger because '.' is escaped as literal dot '\\.'
      const fakeDevEmail = "developerXmetro@internalXlocal";
      const fakeSuperEmail = "superadmin@cairoXmetroXcom";
      `,
      'utf8'
    );
    const resultAfterLoose = scanDirectory(tempScanDir);
    expect(resultAfterLoose.clean).toBe(true);
    expect(resultAfterLoose.violations).toHaveLength(0);
    fs.unlinkSync(looseEmailFile);

    // 2. Exact synthetic emails MUST trigger violations
    const exactEmailsFile = path.join(tempScanDir, 'exact-emails-test.js');
    fs.writeFileSync(
      exactEmailsFile,
      `
      const devEmail = "developer.metro@internal.local";
      const supEmail = "superadmin@cairo-metro.com";
      `,
      'utf8'
    );
    const resultAfterExactEmails = scanDirectory(tempScanDir);
    expect(resultAfterExactEmails.clean).toBe(false);
    expect(resultAfterExactEmails.violations.some((v) => v.rule.includes('developer.metro@internal.local'))).toBe(true);
    expect(resultAfterExactEmails.violations.some((v) => v.rule.includes('superadmin@cairo-metro.com'))).toBe(true);
    fs.unlinkSync(exactEmailsFile);

    // Verify returning to clean state
    const finalClean = scanDirectory(tempScanDir);
    expect(finalClean.clean).toBe(true);
  });

  // ── 10. Compatibility with Phase 1 & Increments 2.1–2.3 Protections ─────────
  it('10. preserves Phase 1 canonical identity resolution and Increments 2.1–2.3 authorization invariants', () => {
    // Canonical resolution for Developer and Super Admin aliases
    expect(resolveCanonicalUserId('usr_dev_001')).toBe('USR_DEV_001');
    expect(resolveCanonicalUserId('usr_super_001')).toBe('USR_SUPER_001');

    // Controlled test fixture allowlist has gated Super Admin & Developer
    expect(CONTROLLED_TEST_FIXTURE_USERS['USR_DEV_001']).toBeDefined();
    expect(CONTROLLED_TEST_FIXTURE_USERS['USR_SUPER_001']).toBeDefined();

    // Increment 2.1 roles exist
    const devManaged = inMemoryStore.getManagedUserById('USR_DEV_001', 'developer');
    expect(devManaged?.role).toBe('developer');

    // Increment 2.2 protected account invariants intact
    const adminActor = { id: 'usr_admin_001', role: 'admin' as UserRole };
    const superTarget = { id: 'USR_SUPER_001', role: 'super_admin' as UserRole };
    const superMutateCheck = evaluateProtectedInvariant(adminActor, 'suspend', { targetUser: superTarget });
    expect(superMutateCheck.allowed).toBe(false);
    expect(superMutateCheck.code).toBe('INVARIANT_SUPER_ADMIN_EXCLUSIVITY');

    // Increment 2.3 non-disclosure intact (INV-R8 404 parity for non-developer)
    expect(inMemoryStore.getManagedUserById('USR_DEV_001', 'admin')).toBeUndefined();
    expect(inMemoryStore.getUserTranscript('USR_DEV_001', 'admin')).toBeNull();
  });
});

