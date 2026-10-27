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
  inMemoryStore.reset({ seedReviewDemo: false });
});
afterAll(() => server.close());

const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
const supervisorUser = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;
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

describe('Fix: Enable the Training Groups Navigation Tab', () => {
  describe('1. Authoritative Navigation Registry & State', () => {
    it('registers training-groups as an implemented, functional route pointing to /admin/groups', () => {
      const managementSection = NAVIGATION_SECTIONS.find((s) => s.id === 'management');
      expect(managementSection).toBeDefined();

      const item = managementSection?.items.find((i) => i.id === 'training-groups');
      expect(item).toBeDefined();
      expect(item?.status).toBe('implemented');
      expect(item?.path).toBe('/admin/groups');
      expect(item?.titleAr).toBe('المجموعات ومواعيد الاستحقاق');
      expect(item?.icon).toBe('trainingGroups');
      expect(item?.badge).toBe('مفعل');
      expect(item?.badgeVariant).toBe('primary');
      expect(item?.plannedIncrement).toBeUndefined();

      expect(isRouteImplemented('/admin/groups')).toBe(true);
    });
  });

  describe('2. Authorized User Navigation via Desktop Sidebar', () => {
    it('allows administrator to navigate from /dashboard to /admin/groups by clicking the navigation tab', async () => {
      renderWithApp('/dashboard', adminUser);

      // Verify dashboard loaded
      await waitFor(() => {
        expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
      });

      // Find the Training Groups navigation link in the sidebar
      const navLinks = screen.getAllByRole('link', { name: /المجموعات ومواعيد الاستحقاق/i });
      expect(navLinks.length).toBeGreaterThanOrEqual(1);

      const sidebarLink = navLinks[0];
      expect(sidebarLink).toHaveAttribute('href', '/admin/groups');
      expect(sidebarLink).not.toHaveAttribute('aria-disabled', 'true');

      // Click the tab
      fireEvent.click(sidebarLink);

      // Verify navigation to /admin/groups succeeds
      await waitFor(() => {
        expect(screen.getByTestId('admin-groups-page')).toBeInTheDocument();
      });

      expect(screen.getByRole('heading', { name: /إدارة المجموعات التدريبية/i })).toBeInTheDocument();
      expect(screen.getByTestId('create-group-btn')).toBeInTheDocument();

      // Verify active navigation styling
      expect(sidebarLink.className).toContain('bg-primary-dark');
      expect(sidebarLink.className).toContain('text-white');
    });

    it('allows supervisor (lecturer) to navigate to /admin/groups by clicking the navigation tab', async () => {
      renderWithApp('/dashboard', supervisorUser);

      // Wait for lecturer dashboard
      await waitFor(() => {
        expect(screen.getByTestId('lecturer-dashboard')).toBeInTheDocument();
      });

      const navLinks = screen.getAllByRole('link', { name: /المجموعات ومواعيد الاستحقاق/i });
      const sidebarLink = navLinks[0];
      expect(sidebarLink).toHaveAttribute('href', '/admin/groups');

      // Click the tab
      fireEvent.click(sidebarLink);

      // Verify supervisor accesses /admin/groups overview
      await waitFor(() => {
        expect(screen.getByTestId('admin-groups-page')).toBeInTheDocument();
      });

      // Supervisor sees their assigned group without admin create action
      expect(screen.getByTestId('group-row-GRP-101')).toBeInTheDocument();
      expect(screen.queryByTestId('create-group-btn')).not.toBeInTheDocument();
    });
  });

  describe('3. Mobile Drawer Navigation', () => {
    it('allows navigation to /admin/groups via mobile drawer and automatically closes drawer', async () => {
      renderWithApp('/dashboard', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
      });

      // Open mobile drawer
      const openDrawerBtn = screen.getByLabelText(/فتح قائمة التنقل الرئيسية/i);
      fireEvent.click(openDrawerBtn);

      const drawer = screen.getByRole('dialog', { name: /قائمة التنقل للأجهزة الذكية/i });
      expect(drawer).toBeInTheDocument();

      // Find the Training Groups item inside the drawer
      const drawerLink = drawer.querySelector('a[href="/admin/groups"]');
      expect(drawerLink).toBeInTheDocument();

      if (drawerLink) {
        fireEvent.click(drawerLink);
      }

      // Drawer should close upon clicking implemented item
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /قائمة التنقل للأجهزة الذكية/i })).not.toBeInTheDocument();
      });

      // Verify navigated to /admin/groups
      await waitFor(() => {
        expect(screen.getByTestId('admin-groups-page')).toBeInTheDocument();
      });
    });
  });

  describe('4. Route Guard & Authorization Protection', () => {
    it('enforces route guard rejecting unauthorized trainee when navigating to /admin/groups', async () => {
      renderWithApp('/dashboard', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('trainee-dashboard')).toBeInTheDocument();
      });

      const navLinks = screen.getAllByRole('link', { name: /المجموعات ومواعيد الاستحقاق/i });
      const link = navLinks[0];
      fireEvent.click(link);

      // Trainee is blocked by the route authorization guard
      await waitFor(() => {
        expect(screen.getByTestId('admin-groups-unauthorized')).toBeInTheDocument();
      });

      expect(screen.getByText(/غير مصرح بالوصول/i)).toBeInTheDocument();
      expect(screen.getByText(/هذه الصفحة مخصصة لمديري النظام ومشرفي التدريب/i)).toBeInTheDocument();
    });

    it('direct navigation to /admin/groups continues to enforce authorization guard', async () => {
      renderWithApp('/admin/groups', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('admin-groups-unauthorized')).toBeInTheDocument();
      });

      expect(screen.getByText(/غير مصرح بالوصول/i)).toBeInTheDocument();
    });

    it('unauthenticated visitors are redirected to /login by ProtectedRoute', async () => {
      renderWithApp('/admin/groups');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /تسجيل الدخول إلى المنظومة/i })).toBeInTheDocument();
      });
    });
  });
});
