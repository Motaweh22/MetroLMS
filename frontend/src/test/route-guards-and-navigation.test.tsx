/**
 * MetroLMS — Increment 3.4 Integration & Component Tests
 *
 * Route Guards, Role-Based Navigation & Canonical Arabic Labels
 * Finding References: MFR-17, MFR-08, MFR-05, MFR-16, MFR-21, MFR-30, D-14
 *
 * TEST SUITE STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
 * Per project instructions and owner directive Part A, automated test runners
 * (vitest, tsc, eslint) are NOT executed during this turn.
 */

import React from 'react';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AppRouter } from '@/app/router';
import { Sidebar } from '@/shared/ui/Sidebar';
import { MobileDrawer } from '@/shared/ui/MobileDrawer';
import {
  NAVIGATION_SECTIONS,
  isNavItemVisibleForRole,
  getAllNavItems,
} from '@/shared/config/navigation';
import {
  ROLE_CANONICAL_LABELS_AR,
  ROLE_DISPLAY_LABELS,
} from '@/core/permissions/types';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type { User, UserRole } from '@/core/auth/types';

// Fixture Users representing all 6 canonical roles
const devUser: User = {
  id: 'USR_DEV_001',
  name: 'مطور النظام',
  email: 'developer@cairo-metro.com',
  role: 'developer',
  department: 'هندسة البرمجيات والأنظمة الذكية',
  jobTitle: 'كبير مهندسي النظام',
  initials: 'م.ن',
};

const superAdminUser: User = {
  id: 'USR_SUPER_001',
  name: 'م. ياسين رضوان',
  email: 'superadmin@cairo-metro.com',
  role: 'super_admin',
  department: 'الإدارة العليا',
  jobTitle: 'المسؤول الأعلى للأنظمة',
  initials: 'ي.ر',
};

const adminUser: User = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
const assistantAdminUser: User = SYNTHETIC_DEMO_ACCOUNTS.assistant_admin.user;
const lecturerUser: User = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;
const traineeUser: User = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset();
});
afterAll(() => server.close());

function renderWithApp(initialRoute: string, user?: User) {
  if (user) {
    authStorage.setSession({
      token: `mock_jwt_${user.id}_increment34`,
      user,
      expiresAt: Date.now() + 3600000,
    });
  } else {
    authStorage.clearSession();
  }

  return render(<AppRouter initialEntries={[initialRoute]} />);
}

describe('Increment 3.4 — Route Guards, Role Navigation & Canonical Arabic Labels', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Part 1: MFR-17 Protected Route Guards
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. MFR-17: Protected Route Guards & Access Control Enforcement', () => {
    it('redirects unauthenticated visitor to /login when navigating to protected route', async () => {
      renderWithApp('/dashboard');

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });
      expect(screen.getByText(/تسجيل الدخول إلى المنظومة/i)).toBeInTheDocument();
    });

    describe('Trainee (role: user) Route Protection', () => {
      it('allows trainee to access overview and learning routes', async () => {
        renderWithApp('/dashboard', traineeUser);

        await waitFor(() => {
          expect(screen.getByTestId('trainee-dashboard')).toBeInTheDocument();
        });
      });

      it('denies trainee access to /admin/groups and redirects to /403', async () => {
        renderWithApp('/admin/groups', traineeUser);

        await waitFor(() => {
          expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
        });
        expect(screen.getByText(/غير مصرح بالوصول/i)).toBeInTheDocument();
      });

      it('denies trainee access to /admin/users and redirects to /403', async () => {
        renderWithApp('/admin/users', traineeUser);

        await waitFor(() => {
          expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
        });
      });

      it('denies trainee access to /admin/audit and redirects to /403', async () => {
        renderWithApp('/admin/audit', traineeUser);

        await waitFor(() => {
          expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
        });
      });

      it('denies trainee access to /admin/permissions and redirects to /403', async () => {
        renderWithApp('/admin/permissions', traineeUser);

        await waitFor(() => {
          expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
        });
      });

      it('denies trainee access to /lecturer/courses and redirects to /403', async () => {
        renderWithApp('/lecturer/courses', traineeUser);

        await waitFor(() => {
          expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
        });
      });

      it('denies trainee access to /approvals and redirects to /403', async () => {
        renderWithApp('/approvals', traineeUser);

        await waitFor(() => {
          expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
        });
      });

      it('denies trainee access to /admin/review/CRS001 and redirects to /403', async () => {
        renderWithApp('/admin/review/CRS001', traineeUser);

        await waitFor(() => {
          expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
        });
      });
    });

    describe('Assistant Admin (role: assistant_admin) Read vs Mutation Protection', () => {
      it('allows assistant_admin to access /admin/groups (read directory)', async () => {
        renderWithApp('/admin/groups', assistantAdminUser);

        await waitFor(() => {
          expect(screen.getByTestId('admin-groups-page')).toBeInTheDocument();
        });
      });

      it('allows assistant_admin to access /admin/users (read directory)', async () => {
        renderWithApp('/admin/users', assistantAdminUser);

        await waitFor(() => {
          expect(screen.getByTestId('user-management-page')).toBeInTheDocument();
        });
      });

      it('allows assistant_admin to access /admin/audit (read security audit trail under D-14)', async () => {
        renderWithApp('/admin/audit', assistantAdminUser);

        await waitFor(() => {
          expect(screen.getByTestId('security-audit-page')).toBeInTheDocument();
        });
      });

      it('allows assistant_admin to access /admin/permissions (read matrix under Rule A)', async () => {
        renderWithApp('/admin/permissions', assistantAdminUser);

        await waitFor(() => {
          expect(screen.getByTestId('permissions-matrix-page')).toBeInTheDocument();
        });
      });

      it('allows assistant_admin to access /approvals (read review queue)', async () => {
        renderWithApp('/approvals', assistantAdminUser);

        await waitFor(() => {
          expect(screen.getByTestId('admin-approvals-view')).toBeInTheDocument();
        });
      });

      it('allows assistant_admin to access /admin/review/CRS001 (read review data)', async () => {
        renderWithApp('/admin/review/CRS001', assistantAdminUser);

        await waitFor(() => {
          expect(screen.getByTestId('course-review-page')).toBeInTheDocument();
        });
      });

      it('denies assistant_admin mutation access to /admin/groups/new and redirects to /403', async () => {
        renderWithApp('/admin/groups/new', assistantAdminUser);

        await waitFor(() => {
          expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
        });
      });

      it('denies assistant_admin mutation access to /admin/groups/GRP-101/edit and redirects to /403', async () => {
        renderWithApp('/admin/groups/GRP-101/edit', assistantAdminUser);

        await waitFor(() => {
          expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
        });
      });

      it('denies assistant_admin mutation access to /lecturer/builder/CRS001 and redirects to /403', async () => {
        renderWithApp('/lecturer/builder/CRS001', assistantAdminUser);

        await waitFor(() => {
          expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
        });
      });
    });

    describe('Lecturer (role: lecturer) Route Protection', () => {
      it('allows lecturer to access /lecturer/courses', async () => {
        renderWithApp('/lecturer/courses', lecturerUser);

        await waitFor(() => {
          expect(screen.getByTestId('lecturer-workspace-page')).toBeInTheDocument();
        });
      });

      it('allows lecturer to access /lecturer/builder/CRS001', async () => {
        renderWithApp('/lecturer/builder/CRS001', lecturerUser);

        await waitFor(() => {
          expect(screen.getByTestId('course-builder-page')).toBeInTheDocument();
        });
      });

      it('allows lecturer to access /approvals (to view owned submissions)', async () => {
        renderWithApp('/approvals', lecturerUser);

        await waitFor(() => {
          expect(screen.getByTestId('lecturer-approvals-view')).toBeInTheDocument();
        });
      });

      it('denies lecturer access to /admin/groups and redirects to /403', async () => {
        renderWithApp('/admin/groups', lecturerUser);

        await waitFor(() => {
          expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
        });
      });

      it('denies lecturer access to /admin/users and redirects to /403', async () => {
        renderWithApp('/admin/users', lecturerUser);

        await waitFor(() => {
          expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
        });
      });

      it('denies lecturer access to /admin/audit and redirects to /403', async () => {
        renderWithApp('/admin/audit', lecturerUser);

        await waitFor(() => {
          expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
        });
      });
    });

    describe('Operational Admins (admin, super_admin, developer) Route Protection', () => {
      it('allows admin full access to group creation at /admin/groups/new', async () => {
        renderWithApp('/admin/groups/new', adminUser);

        await waitFor(() => {
          expect(screen.getByTestId('group-editor-page')).toBeInTheDocument();
        });
      });

      it('allows super_admin full access to group creation at /admin/groups/new', async () => {
        renderWithApp('/admin/groups/new', superAdminUser);

        await waitFor(() => {
          expect(screen.getByTestId('group-editor-page')).toBeInTheDocument();
        });
      });

      it('allows developer full access to /design-system', async () => {
        renderWithApp('/design-system', devUser);

        await waitFor(() => {
          expect(screen.getByTestId('design-system-preview')).toBeInTheDocument();
        });
      });

      it('returns 404 parity for non-developer navigating to /design-system', async () => {
        renderWithApp('/design-system', adminUser);

        await waitFor(() => {
          expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
        });
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Part 2: MFR-08 Role-Based Navigation Filtering
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. MFR-08: Role-Based Navigation Filtering in Sidebar & Mobile Drawer', () => {
    describe('Central Navigation Registry Predicate (isNavItemVisibleForRole)', () => {
      it('filters navigation items strictly according to the 6-tier matrix', () => {
        const allItems = getAllNavItems();
        const designSystemItem = allItems.find((i) => i.id === 'design-system')!;
        const adminGroupsItem = allItems.find((i) => i.id === 'training-groups')!;
        const courseBuilderItem = allItems.find((i) => i.id === 'course-builder')!;
        const auditItem = allItems.find((i) => i.id === 'system-security-audit')!;
        const coursesItem = allItems.find((i) => i.id === 'courses')!;

        // 1. Trainee (role: user)
        expect(isNavItemVisibleForRole(coursesItem, 'user')).toBe(true);
        expect(isNavItemVisibleForRole(designSystemItem, 'user')).toBe(false);
        expect(isNavItemVisibleForRole(adminGroupsItem, 'user')).toBe(false);
        expect(isNavItemVisibleForRole(courseBuilderItem, 'user')).toBe(false);
        expect(isNavItemVisibleForRole(auditItem, 'user')).toBe(false);

        // 2. Lecturer (role: lecturer)
        expect(isNavItemVisibleForRole(coursesItem, 'lecturer')).toBe(true);
        expect(isNavItemVisibleForRole(courseBuilderItem, 'lecturer')).toBe(true);
        expect(isNavItemVisibleForRole(designSystemItem, 'lecturer')).toBe(false);
        expect(isNavItemVisibleForRole(adminGroupsItem, 'lecturer')).toBe(false);
        expect(isNavItemVisibleForRole(auditItem, 'lecturer')).toBe(false);

        // 3. Assistant Admin (role: assistant_admin)
        expect(isNavItemVisibleForRole(coursesItem, 'assistant_admin')).toBe(true);
        expect(isNavItemVisibleForRole(adminGroupsItem, 'assistant_admin')).toBe(true);
        expect(isNavItemVisibleForRole(courseBuilderItem, 'assistant_admin')).toBe(true);
        expect(isNavItemVisibleForRole(auditItem, 'assistant_admin')).toBe(true);
        expect(isNavItemVisibleForRole(designSystemItem, 'assistant_admin')).toBe(false);

        // 4. Developer (role: developer)
        expect(isNavItemVisibleForRole(designSystemItem, 'developer')).toBe(true);
        expect(isNavItemVisibleForRole(adminGroupsItem, 'developer')).toBe(true);
        expect(isNavItemVisibleForRole(auditItem, 'developer')).toBe(true);
      });
    });

    describe('Desktop Sidebar Component', () => {
      it('renders zero administrative links for trainee and hides management section', () => {
        render(
          <MemoryRouter>
            <Sidebar isCollapsed={false} onToggleCollapse={() => {}} userRole="user" />
          </MemoryRouter>
        );

        // Overview and Learning items visible
        expect(screen.getByText('لوحة المتابعة الرئيسية')).toBeInTheDocument();
        expect(screen.getByText('دليل الدورات التدريبية')).toBeInTheDocument();
        expect(screen.getByText('دوراتي ومسار التعلم')).toBeInTheDocument();
        expect(screen.getByText('مجموعاتي التدريبية')).toBeInTheDocument();

        // Administrative items must be completely absent
        expect(screen.queryByText('المجموعات ومواعيد الاستحقاق')).not.toBeInTheDocument();
        expect(screen.queryByText('منشئ المحتوى للمحاضرين')).not.toBeInTheDocument();
        expect(screen.queryByText('التدقيق واعتماد الجودة')).not.toBeInTheDocument();
        expect(screen.queryByText('إدارة المستخدمين')).not.toBeInTheDocument();
        expect(screen.queryByText('مصفوفة الصلاحيات والحوكمة')).not.toBeInTheDocument();
        expect(screen.queryByText('سجل الرقابة والأمان')).not.toBeInTheDocument();
        expect(screen.queryByText('معمل نظام التصميم')).not.toBeInTheDocument();
      });

      it('renders Course Builder for lecturer but zero admin links', () => {
        render(
          <MemoryRouter>
            <Sidebar isCollapsed={false} onToggleCollapse={() => {}} userRole="lecturer" />
          </MemoryRouter>
        );

        expect(screen.getByText('منشئ المحتوى للمحاضرين')).toBeInTheDocument();
        expect(screen.queryByText('المجموعات ومواعيد الاستحقاق')).not.toBeInTheDocument();
        expect(screen.queryByText('إدارة المستخدمين')).not.toBeInTheDocument();
        expect(screen.queryByText('سجل الرقابة والأمان')).not.toBeInTheDocument();
      });

      it('renders administrative navigation links for assistant_admin', () => {
        render(
          <MemoryRouter>
            <Sidebar isCollapsed={false} onToggleCollapse={() => {}} userRole="assistant_admin" />
          </MemoryRouter>
        );

        expect(screen.getByText('المجموعات ومواعيد الاستحقاق')).toBeInTheDocument();
        expect(screen.getByText('إدارة المستخدمين')).toBeInTheDocument();
        expect(screen.getByText('سجل الرقابة والأمان')).toBeInTheDocument();
        expect(screen.getByText('مصفوفة الصلاحيات والحوكمة')).toBeInTheDocument();
        expect(screen.getByText('التدقيق واعتماد الجودة')).toBeInTheDocument();
        expect(screen.queryByText('معمل نظام التصميم')).not.toBeInTheDocument();
      });

      it('renders design system lab exclusively for developer', () => {
        render(
          <MemoryRouter>
            <Sidebar isCollapsed={false} onToggleCollapse={() => {}} userRole="developer" />
          </MemoryRouter>
        );

        expect(screen.getByText('معمل نظام التصميم')).toBeInTheDocument();
      });
    });

    describe('Mobile Drawer Component', () => {
      it('filters mobile drawer navigation consistently with desktop sidebar for trainee', () => {
        render(
          <MemoryRouter>
            <MobileDrawer
              isOpen={true}
              onClose={() => {}}
              user={{
                name: traineeUser.name,
                role: traineeUser.role,
                initials: traineeUser.initials,
                roleLabelAr: ROLE_CANONICAL_LABELS_AR.user,
              }}
            />
          </MemoryRouter>
        );

        expect(screen.getByText('لوحة المتابعة الرئيسية')).toBeInTheDocument();
        expect(screen.getByText('دليل الدورات التدريبية')).toBeInTheDocument();
        expect(screen.queryByText('المجموعات ومواعيد الاستحقاق')).not.toBeInTheDocument();
        expect(screen.queryByText('إدارة المستخدمين')).not.toBeInTheDocument();
        expect(screen.queryByText('سجل الرقابة والأمان')).not.toBeInTheDocument();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Part 3: MFR-05 Dashboard UI Routing & Role Resolution
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. MFR-05: Dashboard UI Routing & Role Resolution', () => {
    it('routes trainee to TraineeDashboard on /dashboard', async () => {
      renderWithApp('/dashboard', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('trainee-dashboard')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('admin-dashboard')).not.toBeInTheDocument();
      expect(screen.queryByTestId('lecturer-dashboard')).not.toBeInTheDocument();
    });

    it('routes lecturer to LecturerDashboard on /dashboard', async () => {
      renderWithApp('/dashboard', lecturerUser);

      await waitFor(() => {
        expect(screen.getByTestId('lecturer-dashboard')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('admin-dashboard')).not.toBeInTheDocument();
      expect(screen.queryByTestId('trainee-dashboard')).not.toBeInTheDocument();
    });

    it('routes assistant_admin to AdminDashboard on /dashboard (never trainee dashboard)', async () => {
      renderWithApp('/dashboard', assistantAdminUser);

      await waitFor(() => {
        expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('trainee-dashboard')).not.toBeInTheDocument();
      expect(screen.queryByTestId('lecturer-dashboard')).not.toBeInTheDocument();
    });

    it('routes admin to AdminDashboard on /dashboard', async () => {
      renderWithApp('/dashboard', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
      });
    });

    it('routes super_admin to AdminDashboard on /dashboard', async () => {
      renderWithApp('/dashboard', superAdminUser);

      await waitFor(() => {
        expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
      });
    });

    it('routes developer to AdminDashboard on /dashboard', async () => {
      renderWithApp('/dashboard', devUser);

      await waitFor(() => {
        expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Part 4: MFR-16 Canonical Arabic Role Labels Single Source of Truth
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. MFR-16: Canonical Arabic Role Labels Single Source of Truth', () => {
    it('defines authoritative canonical display labels for all six roles', () => {
      expect(ROLE_CANONICAL_LABELS_AR.developer).toBe('المطور');
      expect(ROLE_CANONICAL_LABELS_AR.super_admin).toBe('المسؤول الأعلى');
      expect(ROLE_CANONICAL_LABELS_AR.admin).toBe('مدير النظام');
      expect(ROLE_CANONICAL_LABELS_AR.assistant_admin).toBe('مدير النظام المساعد');
      expect(ROLE_CANONICAL_LABELS_AR.lecturer).toBe('المحاضر');
      expect(ROLE_CANONICAL_LABELS_AR.user).toBe('المتدرب');

      expect(ROLE_DISPLAY_LABELS).toBe(ROLE_CANONICAL_LABELS_AR);
      expect((ROLE_CANONICAL_LABELS_AR as Record<string, string>).assistant_lecturer).toBeUndefined();
    });

    it('renders canonical Arabic role label in ForbiddenPage and never raw or legacy label', async () => {
      renderWithApp('/admin/groups', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
      });

      expect(screen.getByText('المتدرب')).toBeInTheDocument();
      expect(screen.queryByText('متدرب فني')).not.toBeInTheDocument();
    });

    it('renders canonical Arabic role label in ProfilePage and never raw or legacy label', async () => {
      renderWithApp('/profile', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('profile-page')).toBeInTheDocument();
      });

      expect(screen.getByText('المتدرب')).toBeInTheDocument();
      expect(screen.queryByText('متدرب فني')).not.toBeInTheDocument();
    });

    it('renders canonical Arabic role label in CourseDetailPage for non-trainee preview', async () => {
      renderWithApp('/courses/CRS001', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('course-detail-page')).toBeInTheDocument();
      });

      expect(screen.getByText(/صلاحيات مدير النظام/i)).toBeInTheDocument();
      expect(screen.queryByText('صلاحيات محاضر معتمد')).not.toBeInTheDocument();
    });
  });
});

