import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar, type NavbarUser } from '@/shared/ui/Navbar';
import { Sidebar } from '@/shared/ui/Sidebar';
import { MobileDrawer } from '@/shared/ui/MobileDrawer';
import { Footer } from '@/shared/ui/Footer';
import { useAuth } from '@/features/auth';
import { EnrollmentProvider } from '@/features/courses';
import { NotificationProvider, useNotifications } from '@/features/notifications';

const roleLabelsAr: Record<string, string> = {
  admin: 'مسؤول النظام',
  lecturer: 'محاضر معتمد',
  user: 'متدرب فني',
};

const AppLayoutInner: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();

  const navbarUser: NavbarUser | null = user
    ? {
        name: user.name,
        role: user.role,
        roleLabelAr: roleLabelsAr[user.role] || user.role,
        initials: user.initials,
      }
    : null;

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col antialiased selection:bg-primary/20">
      {/* Skip to Main Content Link for Keyboard Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:right-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-dark focus:text-white focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent-cyan text-sm font-bold"
      >
        الانتقال إلى المحتوى الرئيسي
      </a>

      {/* Top Navbar with dynamic unread notifications count */}
      <Navbar
        onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        user={navbarUser}
        onLogout={logout}
        unreadCount={unreadCount}
      />

      {/* Primary Shell Container */}
      <div className="flex flex-1 min-h-[calc(100vh-4rem)]">
        {/* Desktop Sidebar (Anchored to the right in RTL) */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Scrollable Main Viewport + Footer */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
            <Outlet />
          </main>

          <Footer />
        </div>
      </div>

      {/* Mobile Drawer (Visible on viewports < lg) */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        user={navbarUser}
        onLogout={logout}
      />
    </div>
  );
};

export const AppLayout: React.FC = () => {
  const location = useLocation();

  // Immersive Learning Mode: Hide light application navbar, sidebar, and footer on player routes
  const isLearningRoute = Boolean(location.pathname.match(/^\/courses\/[^/]+\/learn(\/.*)?$/));

  // Immersive Learning Environment: Dedicated full-viewport dark container
  if (isLearningRoute) {
    return (
      <EnrollmentProvider>
        <div
          className="min-h-screen bg-[#070B14] text-text-light flex flex-col antialiased selection:bg-accent-cyan/20"
          data-testid="immersive-learning-mode"
        >
          {/* Skip to Main Content Link for Keyboard Accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:right-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-dark focus:text-white focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent-cyan text-sm font-bold"
          >
            الانتقال إلى المحتوى الرئيسي
          </a>

          {/* Dedicated Learning Main Content (Navbar and Sidebar hidden for focused study) */}
          <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col focus:outline-none">
            <Outlet />
          </main>
        </div>
      </EnrollmentProvider>
    );
  }

  return (
    <EnrollmentProvider>
      <NotificationProvider>
        <AppLayoutInner />
      </NotificationProvider>
    </EnrollmentProvider>
  );
};

export default AppLayout;
