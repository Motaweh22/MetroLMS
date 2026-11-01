import React from 'react';
import { BrandLogo } from '@/shared/ui/BrandLogo';
import { Button } from '@/shared/ui/Button';
import { SidebarItem } from './SidebarItem';
import { NAVIGATION_SECTIONS, type NavItem, isNavItemVisibleForRole } from '@/shared/config/navigation';
import { useAuth } from '@/features/auth';

export interface SidebarProps {
  /** Whether the desktop sidebar is collapsed to icon-only width */
  isCollapsed: boolean;
  /** Callback to toggle collapse state */
  onToggleCollapse: () => void;
  /** Optional callback when any navigation item is selected */
  onItemSelect?: (item: NavItem) => void;
  /** Optional explicit role for testing or overrides */
  userRole?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  onItemSelect,
  userRole,
}) => {
  const { user } = useAuth();
  const effectiveRole = userRole ?? user?.role;

  const isItemVisible = (item: NavItem) => isNavItemVisibleForRole(item, effectiveRole);

  return (
    <aside
      aria-label="شريط التنقل الجانبي"
      className={`hidden lg:flex flex-col shrink-0 bg-surface border-l border-border transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'
        }`}
    >
      {/* Sidebar Header with Brand Identity */}
      <div className={`h-16 flex items-center border-b border-border px-4 ${isCollapsed ? 'justify-center' : 'justify-between'
        }`}>
        <div className="overflow-hidden">
          {isCollapsed ? (
            <BrandLogo variant="icon-only" size="sm" />
          ) : (
            <BrandLogo variant="horizontal" size="sm" />
          )}
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {NAVIGATION_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(isItemVisible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.id} className="space-y-1">
              {/* Section Header */}
              {!isCollapsed ? (
                <h3 className="px-3 text-[11px] font-bold text-text-muted/80 uppercase tracking-wider mb-2">
                  {section.titleAr}
                </h3>
              ) : (
                <div className="my-2 border-t border-border/60" aria-hidden="true" />
              )}

              {/* Section Items */}
              <div className="space-y-1">
                {visibleItems.map((item) => (
                  <SidebarItem
                    key={item.id}
                    item={item}
                    isCollapsed={isCollapsed}
                    onItemClick={onItemSelect}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Sidebar Bottom Footer: Collapse Toggle & Version */}
      <div className="p-3 border-t border-border bg-neutral-light/40 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-text-muted hover:text-text hover:bg-neutral-light text-xs"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
          leftIcon={isCollapsed ? 'chevronLeft' : 'chevronRight'}
        >
          {!isCollapsed && 'طي القائمة الجانبية'}
        </Button>

        {!isCollapsed && (
          <div className="text-center pt-1 border-t border-border/40">
            <span className="text-[10px] text-text-muted font-medium">
              مترو القاهرة LMS • مرحلة 2
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};
