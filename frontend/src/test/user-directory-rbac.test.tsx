import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AppRouter } from '@/app/router';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type { User } from '@/core/auth/types';
import { NAVIGATION_SECTIONS, isRouteImplemented } from '@/shared/config/navigation';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset();
});
afterAll(() => server.close());

const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
const lecturerUser = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;
const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;

function renderWithApp(initialRoute: string, user?: User) {
  if (user) {
    authStorage.setSession({
      token: `mock_jwt_${user.id}_test`,
      user,
      expiresAt: Date.now() + 3600000,
    });
  } else {
    authStorage.clearSession();
  }

  return render(<AppRouter initialEntries={[initialRoute]} />);
}

describe('Increment 11 — Phase 1: User Directory RBAC & Navigation Integration', () => {
  describe('1. Route Guarding & Role-Based Access Control', () => {
    it('allows authenticated administrator to access /admin/users', async () => {
      renderWithApp('/admin/users', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('user-management-page')).toBeInTheDocument();
      });

      expect(screen.getByText('دليل المستخدمين الموحد')).toBeInTheDocument();
    });

    it('denies access to authenticated lecturer and redirects to /403', async () => {
      renderWithApp('/admin/users', lecturerUser);

      await waitFor(() => {
        expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('user-management-page')).not.toBeInTheDocument();
      expect(screen.getByText(/غير مصرح بالوصول/i)).toBeInTheDocument();
    });

    it('denies access to authenticated trainee and redirects to /403', async () => {
      renderWithApp('/admin/users', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('user-management-page')).not.toBeInTheDocument();
      expect(screen.getByText(/غير مصرح بالوصول/i)).toBeInTheDocument();
    });

    it('redirects unauthenticated visitor to /login', async () => {
      renderWithApp('/admin/users');

      await waitFor(() => {
        expect(screen.getByText('منصة التدريب الإلكتروني')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /تسجيل الدخول إلى المنظومة/i })).toBeInTheDocument();
      });

      expect(screen.queryByTestId('user-management-page')).not.toBeInTheDocument();
    });
  });

  describe('2. Navigation Registry & Shell Integration', () => {
    it('registers user-management as an implemented route in navigation registry', () => {
      const managementSection = NAVIGATION_SECTIONS.find((s) => s.id === 'management');
      expect(managementSection).toBeDefined();

      const userNav = managementSection?.items.find((i) => i.id === 'user-management');
      expect(userNav).toBeDefined();
      expect(userNav?.status).toBe('implemented');
      expect(userNav?.path).toBe('/admin/users');
      expect(userNav?.titleAr).toBe('إدارة المستخدمين');
      expect(userNav?.badge).toBe('مفعل');

      expect(isRouteImplemented('/admin/users')).toBe(true);
    });

    it('allows administrator to navigate to /admin/users via desktop sidebar', async () => {
      renderWithApp('/dashboard', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
      });

      const userNavLinks = screen.getAllByRole('link', { name: /إدارة المستخدمين/i });
      expect(userNavLinks.length).toBeGreaterThan(0);
      const sidebarLink = userNavLinks[0];
      expect(sidebarLink).toHaveAttribute('href', '/admin/users');

      fireEvent.click(sidebarLink);

      await waitFor(() => {
        expect(screen.getByTestId('user-management-page')).toBeInTheDocument();
      });
    });

    it('allows navigation to /admin/users via mobile drawer and automatically closes drawer', async () => {
      renderWithApp('/dashboard', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
      });

      // Open mobile drawer
      const openDrawerBtn = screen.getByLabelText(/فتح قائمة التنقل الرئيسية/i);
      fireEvent.click(openDrawerBtn);

      const drawer = screen.getByRole('dialog', { name: /قائمة التنقل للأجهزة الذكية/i });
      expect(drawer).toBeInTheDocument();

      const drawerLink = drawer.querySelector('a[href="/admin/users"]');
      expect(drawerLink).toBeInTheDocument();

      if (drawerLink) {
        fireEvent.click(drawerLink);
      }

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /قائمة التنقل للأجهزة الذكية/i })).not.toBeInTheDocument();
        expect(screen.getByTestId('user-management-page')).toBeInTheDocument();
      });
    });
  });

  describe('3. API Endpoint Authorization Guard', () => {
    it('rejects unauthenticated GET /api/admin/users request with 401', async () => {
      const res = await fetch('/api/admin/users');
      expect(res.status).toBe(401);
    });

    it('rejects lecturer GET /api/admin/users request with 403', async () => {
      const res = await fetch('/api/admin/users', {
        headers: {
          Authorization: `Bearer mock_jwt_${lecturerUser.id}_test`,
        },
      });
      expect(res.status).toBe(403);
    });

    it('allows administrator GET /api/admin/users request with 200', async () => {
      const res = await fetch('/api/admin/users', {
        headers: {
          Authorization: `Bearer mock_jwt_${adminUser.id}_test`,
        },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(15);
    });
  });
});
