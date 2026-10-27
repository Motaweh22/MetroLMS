import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AppRouter } from '@/app/router';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import {
  INITIAL_MANAGED_USERS,
  resolveCanonicalUserId,
  USER_ALIAS_MAP,
} from '@/mocks/fixtures/userDirectoryFixtures';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset();
});
afterAll(() => server.close());

const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;

function renderUserDirectory() {
  authStorage.setSession({
    token: `mock_jwt_${adminUser.id}_test`,
    user: adminUser,
    expiresAt: Date.now() + 3600000,
  });

  return render(<AppRouter initialEntries={['/admin/users']} />);
}

describe('Increment 11 — Phase 1: Central User Directory Foundation & Seed Data Unification', () => {
  describe('1. Canonical Identity Model & Seed Deduplication', () => {
    it('seeds exactly 15 unique canonical user records', () => {
      const users = inMemoryStore.getManagedUsers();
      expect(users).toHaveLength(15);
      expect(INITIAL_MANAGED_USERS).toHaveLength(15);

      const uniqueIds = new Set(users.map((u) => u.id));
      expect(uniqueIds.size).toBe(15);
    });

    it('contains 3 synthetic demo personas and 12 legacy employee records with correct roles and departments', () => {
      const users = inMemoryStore.getManagedUsers();

      // 3 Synthetic demo personas
      expect(users.some((u) => u.id === 'usr_admin_001' && u.role === 'admin')).toBe(true);
      expect(users.some((u) => u.id === 'usr_lect_002' && u.role === 'lecturer')).toBe(true);
      expect(users.some((u) => u.id === 'usr_trainee_003' && u.role === 'user')).toBe(true);

      // 12 Legacy employees
      expect(users.some((u) => u.id === 'USR001' && u.department === 'إدارة تكنولوجيا المعلومات')).toBe(true);
      expect(users.some((u) => u.id === 'USR002' && u.department === 'إدارة التدريب')).toBe(true);
      expect(users.some((u) => u.id === 'USR003' && u.department === 'قطاع التشغيل')).toBe(true);
      expect(users.some((u) => u.id === 'USR004' && u.department === 'قطاع الصيانة')).toBe(true);
      expect(users.some((u) => u.id === 'USR005' && u.jobTitle === 'سائق قطار')).toBe(true);
      expect(users.some((u) => u.id === 'USR011' && u.status === 'suspended')).toBe(true);
      expect(users.some((u) => u.id === 'USR012' && u.name === 'فاطمة حسين أحمد')).toBe(true);
    });

    it('does NOT contain plaintext passwords in ManagedUserDTO records', () => {
      const users = inMemoryStore.getManagedUsers();
      for (const u of users) {
        expect((u as unknown as Record<string, unknown>).password).toBeUndefined();
      }
    });

    it('resets to deterministic seed data upon inMemoryStore.reset()', () => {
      inMemoryStore.reset();
      const users1 = inMemoryStore.getManagedUsers();
      inMemoryStore.reset();
      const users2 = inMemoryStore.getManagedUsers();
      expect(users1).toEqual(users2);
      expect(users1).toHaveLength(15);
    });
  });

  describe('2. Stable Canonical ID & Legacy Alias Resolution', () => {
    it('resolves lowercased legacy IDs to canonical uppercase IDs', () => {
      expect(resolveCanonicalUserId('usr001')).toBe('USR001');
      expect(resolveCanonicalUserId('usr004')).toBe('USR004');
      expect(resolveCanonicalUserId('usr011')).toBe('USR011');
      expect(resolveCanonicalUserId('usr012')).toBe('USR012');
    });

    it('resolves uppercase canonical IDs to themselves', () => {
      expect(resolveCanonicalUserId('USR001')).toBe('USR001');
      expect(resolveCanonicalUserId('USR006')).toBe('USR006');
    });

    it('resolves demo personas to their canonical IDs', () => {
      expect(resolveCanonicalUserId('usr_admin_001')).toBe('usr_admin_001');
      expect(resolveCanonicalUserId('usr_lect_002')).toBe('usr_lect_002');
      expect(resolveCanonicalUserId('usr_trainee_003')).toBe('usr_trainee_003');
    });

    it('retrieves user records by alias or canonical ID via inMemoryStore.getManagedUserById', () => {
      const userByAlias = inMemoryStore.getManagedUserById('usr004');
      const userByCanonical = inMemoryStore.getManagedUserById('USR004');

      expect(userByAlias).toBeDefined();
      expect(userByCanonical).toBeDefined();
      expect(userByAlias?.id).toBe('USR004');
      expect(userByCanonical?.id).toBe('USR004');
      expect(userByAlias?.name).toBe('عبدالرحمن حسن محمود');
    });

    it('returns undefined for non-existent or unresolvable IDs', () => {
      expect(inMemoryStore.getManagedUserById('non_existent_user_999')).toBeUndefined();
    });

    it('detects alias collisions and maps each alias uniquely', () => {
      const aliases = Object.keys(USER_ALIAS_MAP);
      expect(aliases.length).toBeGreaterThan(0);
      for (const [alias, target] of Object.entries(USER_ALIAS_MAP)) {
        expect(typeof target).toBe('string');
        expect(target.length).toBeGreaterThan(0);
        expect(resolveCanonicalUserId(alias)).toBe(target);
      }
    });
  });

  describe('3. Directory Table UI Presentation & Metadata', () => {
    it('renders the administrator directory table with all 15 users', async () => {
      renderUserDirectory();

      await waitFor(() => {
        expect(screen.getByTestId('user-management-page')).toBeInTheDocument();
      });

      expect(screen.getByText('دليل المستخدمين الموحد')).toBeInTheDocument();
      expect(screen.getByTestId('user-count-badge')).toHaveTextContent('15 مستخدم');

      // Verify specific user rows
      await waitFor(() => {
        expect(screen.getByTestId('user-row-USR001')).toBeInTheDocument();
        expect(screen.getByTestId('user-row-USR011')).toBeInTheDocument();
        expect(screen.getByTestId('user-row-usr_admin_001')).toBeInTheDocument();
      });

      // Role badges in Arabic
      expect(screen.getAllByText('مدير').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('محاضر').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('متدرب').length).toBeGreaterThanOrEqual(10);

      // Status badges in Arabic (14 active row badges + 1 dropdown option)
      expect(screen.getAllByText('نشط').length).toBeGreaterThanOrEqual(14);
      expect(screen.getAllByText('موقوف').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('4. Search Across Identity Fields & Legacy Aliases', () => {
    it('searches users by name', async () => {
      renderUserDirectory();

      await waitFor(() => {
        expect(screen.getByTestId('user-row-USR001')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('user-search-input');
      fireEvent.change(searchInput, { target: { value: 'أحمد محمود علي' } });

      await waitFor(() => {
        expect(screen.getByTestId('user-row-USR001')).toBeInTheDocument();
        expect(screen.queryByTestId('user-row-USR002')).not.toBeInTheDocument();
      });
    });

    it('searches users by username', async () => {
      renderUserDirectory();

      await waitFor(() => {
        expect(screen.getByTestId('user-row-USR012')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('user-search-input');
      fireEvent.change(searchInput, { target: { value: 'fatma' } });

      await waitFor(() => {
        expect(screen.getByTestId('user-row-USR012')).toBeInTheDocument();
        expect(screen.queryByTestId('user-row-USR001')).not.toBeInTheDocument();
      });
    });

    it('searches users by verified legacy alias without creating duplicates', async () => {
      renderUserDirectory();

      await waitFor(() => {
        expect(screen.getByTestId('user-row-USR004')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('user-search-input');
      fireEvent.change(searchInput, { target: { value: 'usr004' } });

      await waitFor(() => {
        expect(screen.getByTestId('user-row-USR004')).toBeInTheDocument();
        expect(screen.queryByTestId('user-row-USR001')).not.toBeInTheDocument();
      });
    });

    it('searches users by job title', async () => {
      renderUserDirectory();

      await waitFor(() => {
        expect(screen.getByTestId('user-row-USR005')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('user-search-input');
      fireEvent.change(searchInput, { target: { value: 'سائق قطار' } });

      await waitFor(() => {
        expect(screen.getByTestId('user-row-USR005')).toBeInTheDocument();
        expect(screen.queryByTestId('user-row-USR001')).not.toBeInTheDocument();
      });
    });
  });

  describe('5. Role, Status, and Department Filters', () => {
    it('filters users by role (admin)', async () => {
      renderUserDirectory();

      await waitFor(() => {
        expect(screen.getByTestId('user-row-USR001')).toBeInTheDocument();
      });

      const roleSelect = screen.getByTestId('role-filter-select');
      fireEvent.change(roleSelect, { target: { value: 'admin' } });

      await waitFor(() => {
        expect(screen.getByTestId('user-row-usr_admin_001')).toBeInTheDocument();
        expect(screen.getByTestId('user-row-USR001')).toBeInTheDocument();
        expect(screen.queryByTestId('user-row-USR002')).not.toBeInTheDocument();
        expect(screen.queryByTestId('user-row-USR003')).not.toBeInTheDocument();
      });
    });

    it('filters users by status (suspended)', async () => {
      renderUserDirectory();

      await waitFor(() => {
        expect(screen.getByTestId('user-row-USR011')).toBeInTheDocument();
      });

      const statusSelect = screen.getByTestId('status-filter-select');
      fireEvent.change(statusSelect, { target: { value: 'suspended' } });

      await waitFor(() => {
        expect(screen.getByTestId('user-row-USR011')).toBeInTheDocument();
        expect(screen.queryByTestId('user-row-USR001')).not.toBeInTheDocument();
      });
    });

    it('combines role, department, and search filters accurately', async () => {
      renderUserDirectory();

      await waitFor(() => {
        expect(screen.getByTestId('user-row-USR003')).toBeInTheDocument();
      });

      const roleSelect = screen.getByTestId('role-filter-select');
      fireEvent.change(roleSelect, { target: { value: 'user' } });

      const deptSelect = screen.getByTestId('dept-filter-select');
      fireEvent.change(deptSelect, { target: { value: 'قطاع التشغيل' } });

      await waitFor(() => {
        // Users in Operating Sector with role user: USR003, USR005, USR006
        expect(screen.getByTestId('user-row-USR003')).toBeInTheDocument();
        expect(screen.getByTestId('user-row-USR005')).toBeInTheDocument();
        expect(screen.getByTestId('user-row-USR006')).toBeInTheDocument();
        expect(screen.queryByTestId('user-row-USR004')).not.toBeInTheDocument();
      });

      // Refine further with search query
      const searchInput = screen.getByTestId('user-search-input');
      fireEvent.change(searchInput, { target: { value: 'حسام' } });

      await waitFor(() => {
        expect(screen.getByTestId('user-row-USR005')).toBeInTheDocument();
        expect(screen.queryByTestId('user-row-USR003')).not.toBeInTheDocument();
        expect(screen.queryByTestId('user-row-USR006')).not.toBeInTheDocument();
      });
    });

    it('resets all filters when clicking the reset button', async () => {
      renderUserDirectory();

      await waitFor(() => {
        expect(screen.getByTestId('user-row-USR001')).toBeInTheDocument();
      });

      const roleSelect = screen.getByTestId('role-filter-select');
      fireEvent.change(roleSelect, { target: { value: 'admin' } });

      const resetBtn = screen.getByTestId('reset-filters-btn');
      expect(resetBtn).not.toBeDisabled();
      fireEvent.click(resetBtn);

      await waitFor(() => {
        // Full list is restored
        expect(screen.getByTestId('user-row-USR001')).toBeInTheDocument();
        expect(screen.getByTestId('user-row-USR002')).toBeInTheDocument();
        expect(screen.getByTestId('user-row-USR003')).toBeInTheDocument();
      });
    });
  });

  describe('6. Empty and Error State Handling', () => {
    it('displays empty state when search matches no users and allows resetting', async () => {
      renderUserDirectory();

      await waitFor(() => {
        expect(screen.getByTestId('user-row-USR001')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('user-search-input');
      fireEvent.change(searchInput, { target: { value: 'اسم_مستحيل_غير_موجود' } });

      await waitFor(() => {
        expect(screen.getByTestId('empty-users-state')).toBeInTheDocument();
        expect(screen.getByText('لا توجد نتائج مطابقة لبحثك')).toBeInTheDocument();
      });

      const emptyResetBtn = screen.getByTestId('empty-state-reset-btn');
      fireEvent.click(emptyResetBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('empty-users-state')).not.toBeInTheDocument();
        expect(screen.getByTestId('user-row-USR001')).toBeInTheDocument();
      });
    });

    it('displays error alert when API fetch fails and allows retry', async () => {
      server.use(
        http.get('/api/admin/users', () => {
          return HttpResponse.json(
            { message: 'خطأ داخلي في الخادم أثناء جلب المستخدمين' },
            { status: 500 }
          );
        })
      );

      renderUserDirectory();

      await waitFor(() => {
        expect(screen.getByTestId('user-directory-error')).toBeInTheDocument();
        expect(screen.getByText(/خطأ داخلي في الخادم/i)).toBeInTheDocument();
      });

      // Restore working handler
      server.resetHandlers();

      const retryBtn = screen.getByTestId('retry-fetch-btn');
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('user-directory-error')).not.toBeInTheDocument();
        expect(screen.getByTestId('user-row-USR001')).toBeInTheDocument();
      });
    });
  });
});
