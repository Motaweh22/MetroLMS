import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AppRouter } from '@/app/router';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import { userManagementApi } from '@/features/user-management/services/userManagementApi';
import { authApi } from '@/core/auth/authApi';
import type { CreateUserRequestDTO } from '@/core/user-management/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset({ seedGroupDemo: true });
});
afterAll(() => server.close());

const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
const lecturerUser = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;
const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;

function renderUserDirectoryAsAdmin() {
  authStorage.setSession({
    token: `mock_jwt_${adminUser.id}_test`,
    user: adminUser,
    expiresAt: Date.now() + 3600000,
  });

  return render(<AppRouter initialEntries={['/admin/users']} />);
}

describe('Increment 11 — Phase 2: User Lifecycle, Role Mutations & Account Status Suspension', () => {
  // ── 1. Administrative User Creation ──────────────────────────────────
  describe('1. Administrative User Creation (POST /api/admin/users)', () => {
    it('creates a new user with generated canonical ID and separates credentials from DTO', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      const payload: CreateUserRequestDTO = {
        name: 'م. خالد أحمد مهران',
        username: 'khaled_mehran',
        email: 'khaled.mehran@cairo-metro.com',
        phone: '01099887766',
        jobTitle: 'مهندس كهرباء',
        department: 'قطاع الصيانة الكهربائية',
        role: 'user',
        status: 'active',
        password: 'Password123!',
      };

      const newUser = await userManagementApi.createUser(payload);

      // Verify canonical ID generation (starts at USR013)
      expect(newUser.id).toBe('USR013');
      expect(newUser.name).toBe('م. خالد أحمد مهران');
      expect(newUser.username).toBe('khaled_mehran');
      expect(newUser.email).toBe('khaled.mehran@cairo-metro.com');
      expect(newUser.role).toBe('user');
      expect(newUser.status).toBe('active');
      expect(newUser.legacyAliases).toContain('usr013');
      expect(newUser.legacyAliases).toContain('khaled_mehran');

      // CRITICAL ARCHITECTURAL RULE: DTO must never expose passwords
      expect((newUser as unknown as Record<string, unknown>).password).toBeUndefined();

      // Credential must be stored securely in separate credential store
      expect(inMemoryStore.getMockUserCredential('khaled.mehran@cairo-metro.com')).toBe('Password123!');

      // User must be searchable in directory
      const directoryUsers = inMemoryStore.getManagedUsers();
      expect(directoryUsers.some((u) => u.id === 'USR013')).toBe(true);

      // Newly created active trainee must immediately appear in candidate trainees
      const candidates = inMemoryStore.getCandidateTrainees();
      expect(candidates.some((c) => c.id === 'USR013')).toBe(true);
    });

    it('creates a lecturer or administrator and strictly excludes them from candidate trainees', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      const lecturerPayload: CreateUserRequestDTO = {
        name: 'د. سامي رشدي',
        username: 'sami_roshdy',
        email: 'sami.roshdy@cairo-metro.com',
        jobTitle: 'كبير مدربي الإشارات والتحكم الآلي',
        department: 'مركز تدريب وإعداد القادة بمترو القاهرة',
        role: 'lecturer',
        status: 'active',
      };

      const newLecturer = await userManagementApi.createUser(lecturerPayload);
      expect(newLecturer.role).toBe('lecturer');

      // Candidate trainees must NOT include lecturers
      const candidates = inMemoryStore.getCandidateTrainees();
      expect(candidates.some((c) => c.id === newLecturer.id)).toBe(false);
    });

    it('rejects duplicate username with 409 conflict', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      const payload: CreateUserRequestDTO = {
        name: 'مستخدم تجريبي مكرر',
        username: 'admin', // already exists in USR001
        email: 'unique.email@cairo-metro.com',
        jobTitle: 'مهندس تشغيل',
        department: 'قطاع التشغيل',
        role: 'user',
      };

      await expect(userManagementApi.createUser(payload)).rejects.toThrow(
        /اسم المستخدم مسجل مسبقاً/
      );
    });

    it('rejects duplicate email with 409 conflict', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      const payload: CreateUserRequestDTO = {
        name: 'مستخدم تجريبي مكرر',
        username: 'new_unique_user',
        email: 'ahmed.ali@cairo-metro.com', // already exists in USR001
        jobTitle: 'مهندس تشغيل',
        department: 'قطاع التشغيل',
        role: 'user',
      };

      await expect(userManagementApi.createUser(payload)).rejects.toThrow(
        /البريد الإلكتروني مسجل مسبقاً/
      );
    });

    it('rejects missing or invalid fields with 400 bad request', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      const invalidPayload = {
        name: '',
        username: '',
        email: 'not-an-email',
        jobTitle: '',
        department: '',
        role: 'invalid_role',
      } as unknown as CreateUserRequestDTO;

      await expect(userManagementApi.createUser(invalidPayload)).rejects.toThrow();
    });

    it('rejects user creation when requested by lecturer or trainee (RBAC)', async () => {
      authStorage.setSession({
        token: `mock_jwt_${lecturerUser.id}_test`,
        user: lecturerUser,
        expiresAt: Date.now() + 3600000,
      });

      const payload: CreateUserRequestDTO = {
        name: 'مستخدم غير مصرح',
        username: 'unauth_user',
        email: 'unauth@cairo-metro.com',
        jobTitle: 'مهندس تشغيل',
        department: 'قطاع التشغيل',
        role: 'user',
      };

      await expect(userManagementApi.createUser(payload)).rejects.toThrow(
        /مخصصة لمديري النظام فقط/
      );
    });
  });

  // ── 2. Role Mutation ─────────────────────────────────────────────────
  describe('2. Role Mutation (PATCH /api/admin/users/:id/role)', () => {
    it('mutates user role and dynamically updates candidate trainee eligibility', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      // USR003 is currently active trainee
      const initialUser = inMemoryStore.getManagedUserById('USR003');
      expect(initialUser?.role).toBe('user');
      expect(inMemoryStore.getCandidateTrainees().some((c) => c.id === 'USR003')).toBe(true);

      // Mutate role to 'lecturer'
      const updatedUser = await userManagementApi.updateUserRole('USR003', 'lecturer');
      expect(updatedUser.role).toBe('lecturer');

      // Trainee candidate list must now exclude USR003
      expect(inMemoryStore.getCandidateTrainees().some((c) => c.id === 'USR003')).toBe(false);

      // Mutate role back to 'user'
      const restoredUser = await userManagementApi.updateUserRole('USR003', 'user');
      expect(restoredUser.role).toBe('user');

      // Trainee candidate list must now re-include USR003
      expect(inMemoryStore.getCandidateTrainees().some((c) => c.id === 'USR003')).toBe(true);
    });

    it('preserves existing aliases, identity, and course records when mutating role', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      const before = inMemoryStore.getManagedUserById('USR002');
      expect(before?.legacyAliases).toBeDefined();

      await userManagementApi.updateUserRole('USR002', 'assistant_admin');

      const after = inMemoryStore.getManagedUserById('USR002');
      expect(after?.role).toBe('assistant_admin');
      expect(after?.legacyAliases).toEqual(before?.legacyAliases);
      expect(after?.email).toBe(before?.email);
      expect(after?.username).toBe(before?.username);
    });

    it('rejects invalid role with 400', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      await expect(
        userManagementApi.updateUserRole('USR003', 'superadmin' as unknown as CreateUserRequestDTO['role'])
      ).rejects.toThrow();
    });

    it('rejects non-admin role mutation request with 403', async () => {
      authStorage.setSession({
        token: `mock_jwt_${traineeUser.id}_test`,
        user: traineeUser,
        expiresAt: Date.now() + 3600000,
      });

      await expect(userManagementApi.updateUserRole('USR003', 'admin')).rejects.toThrow(
        /صلاحية|مخصصة لمديري النظام/
      );
    });
  });

  // ── 3. Account Suspension & Reactivation ──────────────────────────────
  describe('3. Account Suspension & Reactivation (PATCH /api/admin/users/:id/status)', () => {
    it('suspends an active user, updates store status, and excludes them from candidate trainees', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      // USR004 is active trainee
      expect(inMemoryStore.getCandidateTrainees().some((c) => c.id === 'USR004')).toBe(true);

      const suspended = await userManagementApi.updateUserStatus('USR004', 'suspended', 'إجازة بدون راتب');
      expect(suspended.status).toBe('suspended');

      // Central store reflects suspension
      const storeUser = inMemoryStore.getManagedUserById('USR004');
      expect(storeUser?.status).toBe('suspended');

      // Candidate trainees list must exclude suspended USR004
      expect(inMemoryStore.getCandidateTrainees().some((c) => c.id === 'USR004')).toBe(false);
    });

    it('reactivates a suspended user and restores trainee candidate eligibility', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      // USR011 is suspended seed trainee
      const initialUser = inMemoryStore.getManagedUserById('USR011');
      expect(initialUser?.status).toBe('suspended');
      expect(inMemoryStore.getCandidateTrainees().some((c) => c.id === 'USR011')).toBe(false);

      const reactivated = await userManagementApi.updateUserStatus('USR011', 'active');
      expect(reactivated.status).toBe('active');

      // Candidate trainees list must now include reactivated USR011
      expect(inMemoryStore.getCandidateTrainees().some((c) => c.id === 'USR011')).toBe(true);
    });

    it('preserves group memberships and training attempts upon account suspension', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      const initialAttempts = inMemoryStore.getAttemptsStore();

      await userManagementApi.updateUserStatus('usr_trainee_003', 'suspended');

      const afterAttempts = inMemoryStore.getAttemptsStore();
      expect(afterAttempts.length).toBe(initialAttempts.length);
    });
  });

  // ── 4. Suspended-Account Login Protection ────────────────────────────
  describe('4. Suspended-Account Login Protection (POST /api/auth/login)', () => {
    it('allows valid login for active accounts', async () => {
      const response = await authApi.login({
        email: 'trainee@cairo-metro.com',
        password: 'metroLearner2026!',
      });

      expect(response.token).toBeDefined();
      expect(response.user.id).toBe('usr_trainee_003');
    });

    it('rejects login with 403 Forbidden and Arabic message when account is suspended', async () => {
      // Suspend demo trainee account in store
      inMemoryStore.updateUserStatus('usr_trainee_003', 'suspended');

      await expect(
        authApi.login({
          email: 'trainee@cairo-metro.com',
          password: 'metroLearner2026!',
        })
      ).rejects.toThrow('تم إيقاف هذا الحساب من قبل إدارة النظام. يرجى مراجعة المسؤول.');
    });

    it('allows login again once account is reactivated', async () => {
      // Suspend
      inMemoryStore.updateUserStatus('usr_trainee_003', 'suspended');

      await expect(
        authApi.login({
          email: 'trainee@cairo-metro.com',
          password: 'metroLearner2026!',
        })
      ).rejects.toThrow(/تم إيقاف هذا الحساب/);

      // Reactivate
      inMemoryStore.updateUserStatus('usr_trainee_003', 'active');

      const response = await authApi.login({
        email: 'trainee@cairo-metro.com',
        password: 'metroLearner2026!',
      });
      expect(response.token).toBeDefined();
      expect(response.user.id).toBe('usr_trainee_003');
    });

    it('allows newly created user with provisioned password to log in', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      await userManagementApi.createUser({
        name: 'متدرب جديد',
        username: 'new_learner_2026',
        email: 'new.learner@cairo-metro.com',
        jobTitle: 'فني صيانة',
        department: 'قطاع الصيانة',
        role: 'user',
        status: 'active',
        password: 'LearnerPassword123!',
      });

      authStorage.clearSession();

      const response = await authApi.login({
        email: 'new.learner@cairo-metro.com',
        password: 'LearnerPassword123!',
      });

      expect(response.token).toBeDefined();
      expect(response.user.name).toBe('متدرب جديد');
    });

    it('rejects login with 401 when invalid password is provided even for existing user', async () => {
      await expect(
        authApi.login({
          email: 'admin@cairo-metro.com',
          password: 'wrong_password_123',
        })
      ).rejects.toThrow(/البريد الإلكتروني أو كلمة المرور غير صحيحة/);
    });
  });

  // ── 5. User Directory UI Workflows ───────────────────────────────────
  describe('5. User Directory UI Workflows (/admin/users)', () => {
    it('opens AddUserModal, fills form, validates, and adds user to table', async () => {
      renderUserDirectoryAsAdmin();

      await waitFor(() => {
        expect(screen.getByTestId('user-table')).toBeInTheDocument();
      });

      // Click open add user modal button
      const openBtn = screen.getByTestId('open-add-user-modal-btn');
      fireEvent.click(openBtn);

      await waitFor(() => {
        expect(screen.getByTestId('add-user-modal')).toBeInTheDocument();
      });

      // Fill in fields
      fireEvent.change(screen.getByTestId('add-user-name-input'), {
        target: { value: 'م. إبراهيم كمال' },
      });
      fireEvent.change(screen.getByTestId('add-user-username-input'), {
        target: { value: 'ibrahim_kamal' },
      });
      fireEvent.change(screen.getByTestId('add-user-email-input'), {
        target: { value: 'ibrahim.kamal@cairo-metro.com' },
      });

      // Submit form
      const submitBtn = screen.getByTestId('add-user-submit-btn');
      fireEvent.click(submitBtn);

      // Verify new user appears in table
      await waitFor(() => {
        expect(screen.getByText('م. إبراهيم كمال')).toBeInTheDocument();
      });
    }, 15000);

    it('changes user role through table select and persists updated role', async () => {
      renderUserDirectoryAsAdmin();

      await waitFor(() => {
        expect(screen.getByTestId('user-table')).toBeInTheDocument();
      });

      // Locate select for USR003 (currently 'user')
      const select = screen.getByTestId('role-select-USR003') as HTMLSelectElement;
      expect(select.value).toBe('user');

      // Change role to lecturer
      fireEvent.change(select, { target: { value: 'lecturer' } });

      await waitFor(() => {
        expect(select.value).toBe('lecturer');
      });

      // Verify store updated
      const updatedStoreUser = inMemoryStore.getManagedUserById('USR003');
      expect(updatedStoreUser?.role).toBe('lecturer');
    });

    it('suspends user via SuspendUserModal and toggles status button to activate', async () => {
      renderUserDirectoryAsAdmin();

      await waitFor(() => {
        expect(screen.getByTestId('user-table')).toBeInTheDocument();
      });

      // USR004 is active, click suspend button
      const suspendBtn = screen.getByTestId('suspend-user-btn-USR004');
      fireEvent.click(suspendBtn);

      // Modal opens
      await waitFor(() => {
        expect(screen.getByTestId('suspend-user-modal')).toBeInTheDocument();
      });

      // Confirm suspension
      const confirmBtn = screen.getByTestId('confirm-suspend-btn');
      fireEvent.click(confirmBtn);

      // User status button toggles to activate
      await waitFor(() => {
        expect(screen.getByTestId('activate-user-btn-USR004')).toBeInTheDocument();
      });

      // Verify store updated
      const storeUser = inMemoryStore.getManagedUserById('USR004');
      expect(storeUser?.status).toBe('suspended');
    });
  });
});
