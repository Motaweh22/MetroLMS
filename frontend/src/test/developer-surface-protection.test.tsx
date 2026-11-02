/**
 * MetroLMS — Increment 5.1 Test Suite: Developer Surface Protection (MFR-25)
 *
 * STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
 *
 * Authoritative Governance Reference:
 * - MetroLMS Pre-Backend Migration Remediation Roadmap — Revision 5:
 *   - Section 3: Developer Confidentiality and Secure Provisioning
 *   - Section 4: Developer Preview and Isolated Role Testing
 *   - Stable Finding MFR-25 (F-25): Developer Surfaces & Prototype Chrome Protection
 *   - Invariant INV-R8: Uniform 404 Non-Disclosure for Developer Assets
 * - Phase 5 Planning Documents:
 *   - docs/frontend/checklists/phase-05-developer-preview-and-isolated-testing-checklist.md
 *   - docs/frontend/reports/phase-05-planning-report.md
 *
 * CRITICAL EXECUTION DIRECTIVE:
 * Per project-wide governance, this test suite is written during Increment 5.1 implementation
 * but DEFERRED for consolidated execution in Phase 13 (Gate B).
 * DO NOT execute Vitest runner, TypeScript compiler (tsc), or linter against this file.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { authStorage } from '@/core/auth/authStorage';
import { AuthProvider } from '@/core/auth/AuthContext';
import type { UserRole } from '@/core/auth/types';
import { DeveloperRouteGuard } from '@/app/router';
import { Navbar } from '@/shared/ui/Navbar/Navbar';
import { Sidebar } from '@/shared/ui/Sidebar/Sidebar';
import { MobileDrawer } from '@/shared/ui/MobileDrawer/MobileDrawer';
import { Footer } from '@/shared/ui/Footer/Footer';
import { LoginPage } from '@/pages/LoginPage';
import { getAllNavItems, isNavItemVisibleForRole } from '@/shared/config/navigation';

describe('Increment 5.1: Developer Surface Protection (MFR-25)', () => {
  beforeEach(() => {
    authStorage.clearSession();
  });

  // =========================================================================
  // Part 1: Route Protection (/design-system) — Tests 1 to 8
  // =========================================================================
  describe('Part 1: Route Protection (/design-system)', () => {
    it('1. Authenticated Developer can access /design-system', () => {
      authStorage.setSession({
        user: {
          id: 'USR_DEV_001',
          name: 'مطور النظام',
          email: 'developer.metro@internal.local',
          role: 'developer',
          department: 'التطوير البرمجي',
          jobTitle: 'مطور نظم',
          initials: 'م.ن',
        },
        token: 'mock_jwt_USR_DEV_001_test',
        expiresAt: Date.now() + 100000,
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/design-system']}>
            <DeveloperRouteGuard>
              <div data-testid="developer-design-system-content">محتوى معمل نظام التصميم</div>
            </DeveloperRouteGuard>
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByTestId('developer-design-system-content')).toBeInTheDocument();
      expect(screen.queryByText('الصفحة غير موجودة')).not.toBeInTheDocument();
    });

    it('2. Super Admin receives 404 (NotFoundPage) on /design-system', () => {
      authStorage.setSession({
        user: {
          id: 'USR_SUPER_001',
          name: 'المدير العام',
          email: 'super_admin@metro.local',
          role: 'super_admin',
          department: 'الإدارة العليا',
          jobTitle: 'المدير العام',
          initials: 'م.ع',
        },
        token: 'mock_jwt_USR_SUPER_001_test',
        expiresAt: Date.now() + 100000,
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/design-system']}>
            <DeveloperRouteGuard>
              <div data-testid="developer-design-system-content">محتوى معمل نظام التصميم</div>
            </DeveloperRouteGuard>
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText('الصفحة غير موجودة')).toBeInTheDocument();
      expect(screen.queryByTestId('developer-design-system-content')).not.toBeInTheDocument();
      expect(screen.queryByText(/403/i)).not.toBeInTheDocument();
    });

    it('3. Admin receives 404 (NotFoundPage) on /design-system', () => {
      authStorage.setSession({
        user: {
          id: 'usr_admin_001',
          name: 'مسؤول النظام',
          email: 'admin@metro.local',
          role: 'admin',
          department: 'التشغيل',
          jobTitle: 'مسؤول نظام',
          initials: 'م.ن',
        },
        token: 'mock_jwt_admin_test',
        expiresAt: Date.now() + 100000,
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/design-system']}>
            <DeveloperRouteGuard>
              <div data-testid="developer-design-system-content">محتوى معمل نظام التصميم</div>
            </DeveloperRouteGuard>
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText('الصفحة غير موجودة')).toBeInTheDocument();
      expect(screen.queryByTestId('developer-design-system-content')).not.toBeInTheDocument();
      expect(screen.queryByText(/403/i)).not.toBeInTheDocument();
    });

    it('4. Assistant Admin receives 404 (NotFoundPage) on /design-system', () => {
      authStorage.setSession({
        user: {
          id: 'usr_ast_001',
          name: 'مساعد الإدارة',
          email: 'assistant@metro.local',
          role: 'assistant_admin',
          department: 'التشغيل',
          jobTitle: 'مساعد إداري',
          initials: 'م.إ',
        },
        token: 'mock_jwt_ast_test',
        expiresAt: Date.now() + 100000,
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/design-system']}>
            <DeveloperRouteGuard>
              <div data-testid="developer-design-system-content">محتوى معمل نظام التصميم</div>
            </DeveloperRouteGuard>
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText('الصفحة غير موجودة')).toBeInTheDocument();
      expect(screen.queryByTestId('developer-design-system-content')).not.toBeInTheDocument();
      expect(screen.queryByText(/403/i)).not.toBeInTheDocument();
    });

    it('5. Lecturer receives 404 (NotFoundPage) on /design-system', () => {
      authStorage.setSession({
        user: {
          id: 'usr_lec_001',
          name: 'محاضر معتمد',
          email: 'lecturer@metro.local',
          role: 'lecturer',
          department: 'التدريب الفني',
          jobTitle: 'مدرب معتمد',
          initials: 'م.م',
        },
        token: 'mock_jwt_lec_test',
        expiresAt: Date.now() + 100000,
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/design-system']}>
            <DeveloperRouteGuard>
              <div data-testid="developer-design-system-content">محتوى معمل نظام التصميم</div>
            </DeveloperRouteGuard>
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText('الصفحة غير موجودة')).toBeInTheDocument();
      expect(screen.queryByTestId('developer-design-system-content')).not.toBeInTheDocument();
      expect(screen.queryByText(/403/i)).not.toBeInTheDocument();
    });

    it('6. User (Trainee) receives 404 (NotFoundPage) on /design-system', () => {
      authStorage.setSession({
        user: {
          id: 'usr_trn_001',
          name: 'متدرب فني',
          email: 'trainee@metro.local',
          role: 'user',
          department: 'الصيانة الميدانية',
          jobTitle: 'فني صيانة',
          initials: 'م.ف',
        },
        token: 'mock_jwt_trn_test',
        expiresAt: Date.now() + 100000,
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/design-system']}>
            <DeveloperRouteGuard>
              <div data-testid="developer-design-system-content">محتوى معمل نظام التصميم</div>
            </DeveloperRouteGuard>
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText('الصفحة غير موجودة')).toBeInTheDocument();
      expect(screen.queryByTestId('developer-design-system-content')).not.toBeInTheDocument();
      expect(screen.queryByText(/403/i)).not.toBeInTheDocument();
    });

    it('7. Unauthenticated access follows the existing authentication redirect', () => {
      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/design-system']}>
            <Routes>
              <Route
                path="/design-system"
                element={
                  <DeveloperRouteGuard redirectUnauthenticated={true}>
                    <div data-testid="developer-design-system-content">محتوى معمل نظام التصميم</div>
                  </DeveloperRouteGuard>
                }
              />
              <Route path="/login" element={<div data-testid="login-redirect-screen">شاشة تسجيل الدخول</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByTestId('login-redirect-screen')).toBeInTheDocument();
      expect(screen.queryByTestId('developer-design-system-content')).not.toBeInTheDocument();
      expect(screen.queryByText('الصفحة غير موجودة')).not.toBeInTheDocument();
    });

    it('8. A preview or display-role value cannot bypass the actual authenticated-role check', () => {
      // User is authenticated as trainee, attempting to pass a display/preview role
      authStorage.setSession({
        user: {
          id: 'usr_trn_002',
          name: 'متدرب يحاول انتحال دور',
          email: 'trainee.bypass@metro.local',
          role: 'user',
          department: 'الصيانة',
          jobTitle: 'متدرب',
          initials: 'م.ت',
        },
        token: 'mock_jwt_trn_bypass',
        expiresAt: Date.now() + 100000,
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/design-system']}>
            <DeveloperRouteGuard>
              <div data-testid="developer-design-system-content">محتوى معمل نظام التصميم</div>
            </DeveloperRouteGuard>
          </MemoryRouter>
        </AuthProvider>
      );

      // Must strictly evaluate authentic user.role ('user'), resulting in 404
      expect(screen.getByText('الصفحة غير موجودة')).toBeInTheDocument();
      expect(screen.queryByTestId('developer-design-system-content')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Part 2: Navigation and Prototype Chrome — Tests 9 to 16
  // =========================================================================
  describe('Part 2: Navigation and Prototype Chrome Protection', () => {
    it('9. Developer retains the intended Design System link in Navbar, Sidebar, and MobileDrawer', () => {
      authStorage.setSession({
        user: {
          id: 'USR_DEV_001',
          name: 'مطور النظام',
          email: 'developer.metro@internal.local',
          role: 'developer',
          department: 'التطوير البرمجي',
          jobTitle: 'مطور نظم',
          initials: 'م.ن',
        },
        token: 'mock_jwt_USR_DEV_001_test',
        expiresAt: Date.now() + 100000,
      });

      const devUser = {
        name: 'مطور النظام',
        role: 'developer' as UserRole,
        roleLabelAr: 'مطور النظام',
        initials: 'م.ن',
      };

      // 9a. Navbar renders design-system link for developer
      const { unmount: unmountNav } = render(
        <MemoryRouter>
          <Navbar
            onOpenMobileDrawer={() => {}}
            isSidebarCollapsed={false}
            onToggleSidebar={() => {}}
            user={devUser}
          />
        </MemoryRouter>
      );
      expect(screen.getByTestId('navbar-design-system-link')).toBeInTheDocument();
      expect(screen.getByText('معمل التصميم')).toBeInTheDocument();
      unmountNav();

      // 9b. Sidebar renders design-system item for developer
      const { unmount: unmountSidebar } = render(
        <AuthProvider>
          <MemoryRouter>
            <Sidebar isCollapsed={false} onToggleCollapse={() => {}} />
          </MemoryRouter>
        </AuthProvider>
      );
      expect(screen.getByRole('link', { name: /معمل نظام التصميم/i })).toBeInTheDocument();
      unmountSidebar();

      // 9c. MobileDrawer renders design-system item for developer
      render(
        <AuthProvider>
          <MemoryRouter>
            <MobileDrawer isOpen={true} onClose={() => {}} user={devUser} />
          </MemoryRouter>
        </AuthProvider>
      );
      expect(screen.getByRole('link', { name: /معمل نظام التصميم/i })).toBeInTheDocument();
    });

    it('10. All non-Developer roles do not see the Design System link across Navbar, Sidebar, and MobileDrawer', () => {
      const nonDevRoles: UserRole[] = ['super_admin', 'admin', 'assistant_admin', 'lecturer', 'user'];

      for (const role of nonDevRoles) {
        const testUser = {
          name: `مستخدم تجريبي ${role}`,
          role,
          roleLabelAr: `دور ${role}`,
          initials: 'م.ت',
        };

        // 10a. Navbar hides design-system link
        const { unmount: unmountNav } = render(
          <MemoryRouter>
            <Navbar
              onOpenMobileDrawer={() => {}}
              isSidebarCollapsed={false}
              onToggleSidebar={() => {}}
              user={testUser}
            />
          </MemoryRouter>
        );
        expect(screen.queryByTestId('navbar-design-system-link')).not.toBeInTheDocument();
        expect(screen.queryByText('معمل التصميم')).not.toBeInTheDocument();
        unmountNav();

        // 10b. Sidebar hides design-system link
        const { unmount: unmountSidebar } = render(
          <AuthProvider>
            <MemoryRouter>
              <Sidebar isCollapsed={false} onToggleCollapse={() => {}} userRole={role} />
            </MemoryRouter>
          </AuthProvider>
        );
        expect(screen.queryByRole('link', { name: /معمل نظام التصميم/i })).not.toBeInTheDocument();
        unmountSidebar();

        // 10c. MobileDrawer hides design-system link
        const { unmount: unmountDrawer } = render(
          <AuthProvider>
            <MemoryRouter>
              <MobileDrawer isOpen={true} onClose={() => {}} user={testUser} />
            </MemoryRouter>
          </AuthProvider>
        );
        expect(screen.queryByRole('link', { name: /معمل نظام التصميم/i })).not.toBeInTheDocument();
        unmountDrawer();
      }
    });

    it('11. Prototype phase badges are hidden from non-Developer Navbar views', () => {
      const adminUser = {
        name: 'مسؤول النظام',
        role: 'admin' as UserRole,
        roleLabelAr: 'مسؤول النظام',
        initials: 'م.ن',
      };

      render(
        <MemoryRouter>
          <Navbar
            onOpenMobileDrawer={() => {}}
            isSidebarCollapsed={false}
            onToggleSidebar={() => {}}
            user={adminUser}
          />
        </MemoryRouter>
      );

      // Verify no prototype milestone badges or developer badges exist in Navbar
      expect(screen.queryByText(/المرحلة/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/v0\./i)).not.toBeInTheDocument();
    });

    it('12. Prototype phase labels are hidden from non-Developer Sidebar views', () => {
      // For non-developer (admin), sidebar renders clean branding without milestone label
      render(
        <AuthProvider>
          <MemoryRouter>
            <Sidebar isCollapsed={false} onToggleCollapse={() => {}} userRole="admin" />
          </MemoryRouter>
        </AuthProvider>
      );

      const brandVersion = screen.getByTestId('sidebar-brand-version');
      expect(brandVersion).toHaveTextContent('مترو القاهرة LMS');
      expect(brandVersion).not.toHaveTextContent('مرحلة 2');
    });

    it('13. Prototype labels are hidden from non-Developer MobileDrawer views', () => {
      const traineeUser = {
        name: 'متدرب فني',
        role: 'user' as UserRole,
        roleLabelAr: 'متدرب',
        initials: 'م.ف',
      };

      render(
        <AuthProvider>
          <MemoryRouter>
            <MobileDrawer isOpen={true} onClose={() => {}} user={traineeUser} />
          </MemoryRouter>
        </AuthProvider>
      );

      const mobileBrand = screen.getByTestId('mobile-drawer-brand-version');
      expect(mobileBrand).toHaveTextContent('المنظومة التدريبية الذكية لمترو القاهرة');
      expect(mobileBrand).not.toHaveTextContent('المرحلة 3');
    });

    it('14. Prototype badges and Design System links are hidden from non-Developer Footer views', () => {
      // Authenticated non-developer session (user role) with standard <Footer /> without props
      authStorage.setSession({
        user: {
          id: 'usr_trn_001',
          name: 'متدرب فني',
          email: 'trainee@metro.local',
          role: 'user',
          department: 'الصيانة الميدانية',
          jobTitle: 'فني صيانة',
          initials: 'م.ف',
        },
        token: 'mock_jwt_trn_test',
        expiresAt: Date.now() + 100000,
      });

      render(
        <AuthProvider>
          <MemoryRouter>
            <Footer />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.queryByTestId('footer-prototype-badge')).not.toBeInTheDocument();
      expect(screen.queryByTestId('footer-design-system-link')).not.toBeInTheDocument();
      expect(screen.queryByText(/المرحلة 2: هيكل التطبيق/i)).not.toBeInTheDocument();
      expect(screen.getByText('الشركة المصرية لإدارة وتشغيل المترو')).toBeInTheDocument();
      expect(screen.getByText(/جميع الحقوق محفوظة © 2026/i)).toBeInTheDocument();
    });

    it('15. Authenticated Developer retains Footer prototype badge and Design System link', () => {
      // Authentic Developer session with standard <Footer />
      authStorage.setSession({
        user: {
          id: 'USR_DEV_001',
          name: 'مطور النظام',
          email: 'developer.metro@internal.local',
          role: 'developer',
          department: 'التطوير البرمجي',
          jobTitle: 'مطور نظم',
          initials: 'م.ن',
        },
        token: 'mock_jwt_USR_DEV_001_test',
        expiresAt: Date.now() + 100000,
      });

      render(
        <AuthProvider>
          <MemoryRouter>
            <Footer />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByTestId('footer-prototype-badge')).toBeInTheDocument();
      expect(screen.getByTestId('footer-design-system-link')).toBeInTheDocument();
      expect(screen.getByText(/المرحلة 2: هيكل التطبيق/i)).toBeInTheDocument();
      expect(screen.getByText('الشركة المصرية لإدارة وتشغيل المترو')).toBeInTheDocument();
      expect(screen.getByText(/جميع الحقوق محفوظة © 2026/i)).toBeInTheDocument();
    });

    it('16. Negative Regression: Authenticated Admin does not see Developer-only Footer elements even when Footer receives userRole="developer"', () => {
      // Authenticated as Admin
      authStorage.setSession({
        user: {
          id: 'usr_admin_001',
          name: 'مسؤول النظام',
          email: 'admin@metro.local',
          role: 'admin',
          department: 'التشغيل',
          jobTitle: 'مسؤول نظام',
          initials: 'م.ن',
        },
        token: 'mock_jwt_admin_test',
        expiresAt: Date.now() + 100000,
      });

      render(
        <AuthProvider>
          <MemoryRouter>
            <Footer userRole="developer" />
          </MemoryRouter>
        </AuthProvider>
      );

      // Must strictly use authentic user.role ('admin'), ignoring userRole="developer" prop
      expect(screen.queryByTestId('footer-prototype-badge')).not.toBeInTheDocument();
      expect(screen.queryByTestId('footer-design-system-link')).not.toBeInTheDocument();
      expect(screen.queryByText(/المرحلة 2: هيكل التطبيق/i)).not.toBeInTheDocument();
      expect(screen.queryByText('معمل التصميم')).not.toBeInTheDocument();
      // Ordinary institutional branding remains intact
      expect(screen.getByText('الشركة المصرية لإدارة وتشغيل المترو')).toBeInTheDocument();
      expect(screen.getByText(/جميع الحقوق محفوظة © 2026/i)).toBeInTheDocument();
    });

    it('17. Negative Regression: Authenticated Admin does not see Developer-only Sidebar badge or Design System link even when Sidebar receives userRole="developer"', () => {
      // Authenticated as Admin
      authStorage.setSession({
        user: {
          id: 'usr_admin_001',
          name: 'مسؤول النظام',
          email: 'admin@metro.local',
          role: 'admin',
          department: 'التشغيل',
          jobTitle: 'مسؤول نظام',
          initials: 'م.ن',
        },
        token: 'mock_jwt_admin_test',
        expiresAt: Date.now() + 100000,
      });

      render(
        <AuthProvider>
          <MemoryRouter>
            <Sidebar isCollapsed={false} onToggleCollapse={() => {}} userRole="developer" />
          </MemoryRouter>
        </AuthProvider>
      );

      // Must strictly use authentic user.role ('admin') for developer-only elements
      expect(screen.queryByRole('link', { name: /معمل نظام التصميم/i })).not.toBeInTheDocument();
      const brandVersion = screen.getByTestId('sidebar-brand-version');
      expect(brandVersion).toHaveTextContent('مترو القاهرة LMS');
      expect(brandVersion).not.toHaveTextContent('مرحلة 2');
    });

    it('18. LoginPage does not expose Developer-only design resources or prototype chrome', () => {
      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/login']}>
            <LoginPage />
          </MemoryRouter>
        </AuthProvider>
      );

      // Verify absence of /design-system links or developer-only lab resources on login surface
      expect(screen.queryByText('معمل التصميم')).not.toBeInTheDocument();
      expect(screen.queryByText(/معمل نظام التصميم/i)).not.toBeInTheDocument();
      expect(screen.queryByTestId('footer-prototype-badge')).not.toBeInTheDocument();
      expect(screen.queryByText(/المرحلة 2/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/المرحلة 3/i)).not.toBeInTheDocument();
    });

    it('19. Existing normal role navigation remains intact for all standard roles', () => {
      const allItems = getAllNavItems();
      const catalogItem = allItems.find((i) => i.id === 'courses')!;
      const dashboardItem = allItems.find((i) => i.id === 'dashboard')!;
      const designSystemItem = allItems.find((i) => i.id === 'design-system')!;

      // Normal navigation visible across roles
      expect(isNavItemVisibleForRole(catalogItem, 'user')).toBe(true);
      expect(isNavItemVisibleForRole(catalogItem, 'lecturer')).toBe(true);
      expect(isNavItemVisibleForRole(catalogItem, 'admin')).toBe(true);
      expect(isNavItemVisibleForRole(dashboardItem, 'user')).toBe(true);
      expect(isNavItemVisibleForRole(dashboardItem, 'admin')).toBe(true);

      // Design system item is exclusively restricted to developer role
      expect(isNavItemVisibleForRole(designSystemItem, 'developer')).toBe(true);
      expect(isNavItemVisibleForRole(designSystemItem, 'super_admin')).toBe(false);
      expect(isNavItemVisibleForRole(designSystemItem, 'admin')).toBe(false);
      expect(isNavItemVisibleForRole(designSystemItem, 'assistant_admin')).toBe(false);
      expect(isNavItemVisibleForRole(designSystemItem, 'lecturer')).toBe(false);
      expect(isNavItemVisibleForRole(designSystemItem, 'user')).toBe(false);
    });
  });
});

