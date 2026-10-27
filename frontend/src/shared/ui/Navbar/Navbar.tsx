import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandLogo } from '@/shared/ui/BrandLogo';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';

export interface NavbarUser {
  name: string;
  role: string;
  roleLabelAr?: string;
  initials: string;
}

export interface NavbarProps {
  /** Callback to trigger mobile drawer visibility */
  onOpenMobileDrawer: () => void;
  /** Current collapsed state of the desktop sidebar */
  isSidebarCollapsed: boolean;
  /** Callback to toggle desktop sidebar collapse */
  onToggleSidebar: () => void;
  /** Optional custom title or section name */
  title?: string;
  /** Currently authenticated user profile */
  user?: NavbarUser | null;
  /** Callback when user clicks logout */
  onLogout?: () => void;
  /** Unread notifications count */
  unreadCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenMobileDrawer,
  isSidebarCollapsed,
  onToggleSidebar,
  title,
  user,
  onLogout,
  unreadCount = 0,
}) => {
  const location = useLocation();
  const isDesignSystemActive = location.pathname.startsWith('/design-system');

  return (
    <header className="sticky top-0 z-30 h-16 w-full border-b border-border bg-surface/95 backdrop-blur-md">
      <div className="flex h-full items-center justify-between px-3 sm:px-6">
        {/* Right Section in RTL: Menu toggles & Branding */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Mobile Drawer Trigger (visible on viewports < lg) */}
          <Button
            variant="ghost"
            size="sm"
            leftIcon="menu"
            aria-label="فتح قائمة التنقل الرئيسية"
            className="lg:hidden text-text hover:bg-neutral-light focus-visible:ring-2 focus-visible:ring-primary"
            onClick={onOpenMobileDrawer}
          />

          {/* Desktop Sidebar Collapse Toggle (visible on viewports >= lg) */}
          <Button
            variant="ghost"
            size="sm"
            leftIcon={isSidebarCollapsed ? 'panelOpen' : 'panelClose'}
            aria-label={isSidebarCollapsed ? 'توسيع الشريط الجانبي' : 'طي الشريط الجانبي'}
            className="hidden lg:inline-flex text-text-muted hover:text-text hover:bg-neutral-light"
            onClick={onToggleSidebar}
          />

          {/* Brand Logo */}
          <Link
            to="/dashboard"
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md p-1"
            aria-label="الانتقال إلى لوحة المتابعة الرئيسية"
          >
            {/* Horizontal logo on larger screens, compact logo on mobile */}
            <div className="hidden sm:block">
              <BrandLogo variant="navbar" size="sm" showSubtitle={false} />
            </div>
            <div className="sm:hidden">
              <BrandLogo variant="icon-only" logoAsset="emblem" size="sm" />
            </div>
          </Link>

          {/* Optional breadcrumb / current section title */}
          {title && (
            <div className="hidden md:flex items-center gap-2 border-r border-border pr-3">
              <span className="text-sm font-bold text-text-heading">{title}</span>
            </div>
          )}
        </div>

        {/* Left Section in RTL: Actions, Notifications, & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick link to Design System Laboratory */}
          <Link to="/design-system" tabIndex={-1}>
            <Button
              variant={isDesignSystemActive ? 'primary' : 'outline'}
              size="sm"
              leftIcon="palette"
              className="text-xs sm:text-sm font-semibold"
            >
              <span className="hidden xs:inline">معمل التصميم</span>
              <span className="xs:hidden">المعمل</span>
            </Button>
          </Link>

          {/* Notifications Button with dynamic unread badge */}
          <div className="relative">
            <Link
              to="/notifications"
              className="relative p-2 text-text-muted hover:text-text hover:bg-neutral-light rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary inline-flex items-center justify-center"
              aria-label={
                unreadCount > 0
                  ? `عرض التنبيهات (${unreadCount} تنبيه غير مقروء)`
                  : 'عرض التنبيهات'
              }
              data-testid="navbar-notifications-link"
            >
              <Icon name="notifications" size="md" />
              {unreadCount > 0 && (
                <span
                  data-testid="navbar-unread-badge"
                  className="absolute top-1 right-1 min-w-[1.125rem] h-4.5 px-1 rounded-full bg-accent-coral text-white text-[10px] font-black flex items-center justify-center ring-2 ring-surface shadow-xs"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          </div>

          {/* User Persona Chip / Actions */}
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                className="flex items-center gap-2.5 p-1 sm:ps-2 sm:pe-3 rounded-full sm:rounded-lg bg-neutral-light/70 hover:bg-neutral-light border border-border text-start select-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={`ملف المستخدم: ${user.name} — ${user.roleLabelAr || user.role}`}
                data-testid="navbar-user-chip"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-dark text-white font-bold text-xs shrink-0 shadow-xs">
                  {user.initials}
                </div>
                <div className="hidden sm:flex flex-col leading-none">
                  <span className="text-xs font-bold text-text-heading">{user.name}</span>
                  <span className="text-[10px] text-text-muted font-medium mt-0.5">
                    {user.roleLabelAr || user.role}
                  </span>
                </div>
                {user.roleLabelAr && (
                  <Badge variant="primary" className="hidden xl:inline-flex text-[10px] px-1.5 py-0">
                    {user.roleLabelAr}
                  </Badge>
                )}
              </Link>

              {onLogout && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon="logout"
                  onClick={onLogout}
                  aria-label="تسجيل الخروج من المنظومة"
                  title="تسجيل الخروج"
                  className="text-text-muted hover:text-danger-dark hover:bg-danger-light/50 px-2 text-xs"
                >
                  <span className="hidden md:inline">خروج</span>
                </Button>
              )}
            </div>
          ) : (
            <Link to="/login">
              <Button variant="primary" size="sm" leftIcon="user" className="text-xs">
                تسجيل الدخول
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

