import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/core/auth/AuthContext';
import { Navbar, type NavbarUser } from '@/shared/ui/Navbar';
import { Sidebar } from '@/shared/ui/Sidebar';
import { MobileDrawer } from '@/shared/ui/MobileDrawer';
import { Footer } from '@/shared/ui/Footer';
import { AppLayout } from '@/app/layouts/AppLayout';
import { DashboardPreviewPage } from '@/pages/DashboardPreviewPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { NAVIGATION_SECTIONS, isRouteImplemented } from '@/shared/config/navigation';

describe('Increment 2: Application Shell & Responsive Layout Verification', () => {
  describe('Central Navigation Configuration', () => {
    it('defines authoritative navigation sections with strict status gating', () => {
      expect(NAVIGATION_SECTIONS.length).toBeGreaterThanOrEqual(3);
      
      // Implemented routes (Increment 2-10)
      expect(isRouteImplemented('/dashboard')).toBe(true);
      expect(isRouteImplemented('/design-system')).toBe(true);
      expect(isRouteImplemented('/courses')).toBe(true);
      expect(isRouteImplemented('/admin/groups')).toBe(true);

      // Planned routes must return false to prevent unauthorized navigation
      expect(isRouteImplemented('/admin')).toBe(false);
    });
  });

  describe('Navbar Component', () => {
    it('renders official brand logo, user chip, and notifications trigger', () => {
      const handleOpenDrawer = vi.fn();
      const handleToggleSidebar = vi.fn();
      const mockUser: NavbarUser = {
        name: 'م. أحمد ممدوح',
        role: 'admin',
        roleLabelAr: 'مسؤول التدريب والتشغيل',
        initials: 'أم',
      };

      render(
        <MemoryRouter>
          <Navbar
            onOpenMobileDrawer={handleOpenDrawer}
            isSidebarCollapsed={false}
            onToggleSidebar={handleToggleSidebar}
            title="لوحة المتابعة"
            user={mockUser}
          />
        </MemoryRouter>
      );

      // Verify brand presence
      expect(screen.getAllByText(/مترو القاهرة/i).length).toBeGreaterThan(0);

      // Verify user persona chip
      expect(screen.getByText('م. أحمد ممدوح')).toBeInTheDocument();
      expect(screen.getAllByText('مسؤول التدريب والتشغيل').length).toBeGreaterThan(0);

      // Verify quick action link to design system
      expect(screen.getByRole('button', { name: /معمل التصميم/i })).toBeInTheDocument();

      // Verify notifications trigger
      expect(screen.getByLabelText(/عرض التنبيهات/i)).toBeInTheDocument();

      // Verify mobile drawer trigger
      const mobileBtn = screen.getByLabelText(/فتح قائمة التنقل الرئيسية/i);
      fireEvent.click(mobileBtn);
      expect(handleOpenDrawer).toHaveBeenCalledTimes(1);

      // Verify desktop collapse trigger
      const collapseBtn = screen.getByLabelText(/طي الشريط الجانبي/i);
      fireEvent.click(collapseBtn);
      expect(handleToggleSidebar).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sidebar Component', () => {
    it('renders all sections and distinguishes implemented vs planned items', () => {
      const handleToggle = vi.fn();
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Sidebar isCollapsed={false} onToggleCollapse={handleToggle} />
        </MemoryRouter>
      );

      // Active implemented link
      const dashboardLink = screen.getByRole('link', { name: /لوحة المتابعة الرئيسية/i });
      expect(dashboardLink).toBeInTheDocument();
      expect(dashboardLink).toHaveClass('bg-primary-dark', 'text-white');

      // Implemented course link is functional
      expect(screen.getByRole('link', { name: /دليل الدورات التدريبية/i })).toBeInTheDocument();

      // Implemented groups link is functional and points to /admin/groups
      const groupsLink = screen.getByRole('link', { name: /المجموعات ومواعيد الاستحقاق/i });
      expect(groupsLink).toBeInTheDocument();
      expect(groupsLink).toHaveAttribute('href', '/admin/groups');

      // Planned route (Increment 11 Administration) is rendered as disabled presentation
      expect(screen.getByText(/إدارة النظام والتكامل/i)).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /إدارة النظام والتكامل/i })).not.toBeInTheDocument();
    });

    it('toggles between expanded and collapsed states', () => {
      const handleToggle = vi.fn();
      const { rerender } = render(
        <MemoryRouter>
          <Sidebar isCollapsed={false} onToggleCollapse={handleToggle} />
        </MemoryRouter>
      );

      // In expanded state, collapse toggle text is visible
      expect(screen.getByText('طي القائمة الجانبية')).toBeInTheDocument();
      
      const toggleBtn = screen.getByRole('button', { name: /طي القائمة الجانبية/i });
      fireEvent.click(toggleBtn);
      expect(handleToggle).toHaveBeenCalledTimes(1);

      // Rerender as collapsed
      rerender(
        <MemoryRouter>
          <Sidebar isCollapsed={true} onToggleCollapse={handleToggle} />
        </MemoryRouter>
      );

      // In collapsed state, text is hidden from layout
      expect(screen.queryByText('طي القائمة الجانبية')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /توسيع القائمة الجانبية/i })).toBeInTheDocument();
    });
  });

  describe('MobileDrawer Component', () => {
    it('does not render when isOpen is false', () => {
      render(
        <MemoryRouter>
          <MobileDrawer isOpen={false} onClose={() => {}} />
        </MemoryRouter>
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders when isOpen is true and closes via close button, Escape key, and backdrop', () => {
      const handleClose = vi.fn();
      render(
        <MemoryRouter>
          <MobileDrawer isOpen={true} onClose={handleClose} />
        </MemoryRouter>
      );

      const dialog = screen.getByRole('dialog', { name: /قائمة التنقل للأجهزة الذكية/i });
      expect(dialog).toBeInTheDocument();

      // Closes on X button click
      const closeBtn = screen.getByLabelText(/إغلاق قائمة التنقل/i);
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);

      // Closes on Escape key press
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(2);

      // Closes on backdrop click
      const backdrop = dialog.querySelector('.bg-neutral-900\\/60');
      expect(backdrop).toBeInTheDocument();
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(handleClose).toHaveBeenCalledTimes(3);
      }
    });

    it('locks body scroll when open and restores it when closed', () => {
      const { rerender, unmount } = render(
        <MemoryRouter>
          <MobileDrawer isOpen={true} onClose={() => {}} />
        </MemoryRouter>
      );

      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        <MemoryRouter>
          <MobileDrawer isOpen={false} onClose={() => {}} />
        </MemoryRouter>
      );
      expect(document.body.style.overflow).toBe('');

      unmount();
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Footer Component', () => {
    it('renders institutional branding, copyright, and Increment 2 status badge', () => {
      render(
        <MemoryRouter>
          <Footer />
        </MemoryRouter>
      );

      expect(screen.getByText('الشركة المصرية لإدارة وتشغيل المترو')).toBeInTheDocument();
      expect(screen.getByText(/المرحلة 2: هيكل التطبيق/i)).toBeInTheDocument();
      expect(screen.getByText(/جميع الحقوق محفوظة © 2026/i)).toBeInTheDocument();
    });
  });

  describe('Integrated Shell & Routing', () => {
    it('renders AppLayout with main content outlet and skip link', () => {
      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route path="dashboard" element={<DashboardPreviewPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      // Skip link
      const skipLink = screen.getByText('الانتقال إلى المحتوى الرئيسي');
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');

      // Main content
      expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
      expect(screen.getByText(/هيكل المنظومة التدريبية الذكية لمترو القاهرة/i)).toBeInTheDocument();
    });

    it('renders NotFoundPage for unknown routes with return button', () => {
      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/unknown-route']}>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route path="dashboard" element={<DashboardPreviewPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText(/الصفحة غير موجودة \(404\)/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /العودة إلى لوحة المتابعة/i })).toBeInTheDocument();
    });

    it('adapts to dedicated immersive learning mode on /courses/:courseId/learn routes by hiding normal light navbar and sidebar', () => {
      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/courses/CRS001/learn']}>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route path="courses/:courseId/learn" element={<div data-testid="player-content">مشغل التعلم</div>} />
                <Route path="courses/:courseId" element={<div>تفاصيل الدورة</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      // Dedicated immersive container is rendered
      expect(screen.getByTestId('immersive-learning-mode')).toBeInTheDocument();
      expect(screen.getByTestId('player-content')).toBeInTheDocument();

      // Normal application light navbar, sidebar, and footer are hidden
      expect(screen.queryByLabelText(/فتح قائمة التنقل الرئيسية/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/جميع الحقوق محفوظة © 2026/i)).not.toBeInTheDocument();
    });

    it('restores normal application shell with navbar and sidebar when exiting learning player', () => {
      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/courses/CRS001']}>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route path="courses/:courseId" element={<div>تفاصيل الدورة</div>} />
                <Route path="courses/:courseId/learn" element={<div>مشغل التعلم</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      // Normal shell components are present
      expect(screen.queryByTestId('immersive-learning-mode')).not.toBeInTheDocument();
      expect(screen.getByText('تفاصيل الدورة')).toBeInTheDocument();
      expect(screen.getByText(/جميع الحقوق محفوظة © 2026/i)).toBeInTheDocument();
    });
  });
});
