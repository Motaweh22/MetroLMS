import React, { useEffect, useRef } from 'react';
import { BrandLogo } from '@/shared/ui/BrandLogo';
import { Button } from '@/shared/ui/Button';
import { SidebarItem } from '@/shared/ui/Sidebar/SidebarItem';
import { NAVIGATION_SECTIONS, type NavItem, isNavItemVisibleForRole } from '@/shared/config/navigation';
import { useLockBodyScroll } from '@/shared/hooks/useLockBodyScroll';

import type { NavbarUser } from '@/shared/ui/Navbar';

export interface MobileDrawerProps {
  /** Visibility state of the mobile drawer */
  isOpen: boolean;
  /** Callback to close the mobile drawer */
  onClose: () => void;
  /** Optional callback when an item is selected */
  onItemSelect?: (item: NavItem) => void;
  /** Currently authenticated user */
  user?: NavbarUser | null;
  /** Callback when user clicks logout */
  onLogout?: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  onItemSelect,
  user,
  onLogout,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Prevent background scroll while mobile drawer is open
  useLockBodyScroll(isOpen);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleItemClick = (item: NavItem) => {
    onItemSelect?.(item);
    if (item.status === 'implemented') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const isItemVisible = (item: NavItem) => isNavItemVisibleForRole(item, user?.role);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="قائمة التنقل للأجهزة الذكية"
      className="fixed inset-0 z-50 lg:hidden overflow-hidden"
    >
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs transition-opacity duration-300"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Drawer panel sliding in from the right edge in RTL */}
      <div
        ref={drawerRef}
        className="fixed inset-y-0 right-0 w-80 max-w-[85vw] bg-surface shadow-2xl flex flex-col z-50 transform transition-transform duration-300 ease-out"
      >
        {/* Drawer Header */}
        <div className="h-16 flex items-center justify-between border-b border-border px-4 bg-surface">
          <BrandLogo variant="horizontal" size="sm" showSubtitle={false} />
          <Button
            variant="ghost"
            size="sm"
            leftIcon="close"
            aria-label="إغلاق قائمة التنقل"
            className="text-text-muted hover:text-text hover:bg-neutral-light"
            onClick={onClose}
          />
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {NAVIGATION_SECTIONS.map((section) => {
            const visibleItems = section.items.filter(isItemVisible);
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.id} className="space-y-1">
                <h3 className="px-3 text-xs font-bold text-text-muted/80 uppercase tracking-wider mb-2">
                  {section.titleAr}
                </h3>
                <div className="space-y-1">
                  {visibleItems.map((item) => (
                    <SidebarItem
                      key={item.id}
                      item={item}
                      isCollapsed={false}
                      onItemClick={handleItemClick}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Drawer Footer with Persona & System Info */}
        <div className="p-4 border-t border-border bg-neutral-light/50 space-y-3">
          {user ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-dark text-white font-bold text-xs shrink-0">
                    {user.initials}
                  </div>
                  <div className="flex flex-col text-start">
                    <span className="text-xs font-bold text-text-heading">{user.name}</span>
                    <span className="text-[10px] text-text-muted">{user.roleLabelAr || user.role}</span>
                  </div>
                </div>
              </div>

              {onLogout && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon="logout"
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="w-full justify-center text-xs text-danger-dark border-danger/30 hover:bg-danger-light/50"
                >
                  تسجيل الخروج من المنظومة
                </Button>
              )}
            </>
          ) : (
            <div className="text-center">
              <span className="text-xs text-text-muted">لم يتم تسجيل الدخول</span>
            </div>
          )}

          <div className="text-center pt-2 border-t border-border/40">
            <span className="text-[11px] text-text-muted font-medium">
              المنظومة التدريبية الذكية لمترو القاهرة (المرحلة 3)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
