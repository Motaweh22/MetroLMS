import React from 'react';
import { Button } from '@/shared/ui/Button';
import { SidebarItem } from './SidebarItem';
import { NAVIGATION_SECTIONS, type NavItem, isNavItemVisibleForRole } from '@/shared/config/navigation';
import { useAuthContext } from '@/core/auth/useAuthContext';
import { useRolePreview } from '@/core/auth/useRolePreview';

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
  const { user } = useAuthContext();
  const { isPreviewing, previewRole } = useRolePreview();
  const effectiveRole = userRole ?? user?.role;

  const isItemVisible = (item: NavItem) => {
    // Surface 11 & MFR-25: Design System link depends EXCLUSIVELY on actual authenticated Developer identity
    // During active visual preview, suppress developer link to make preview authentic
    if (item.id === 'design-system') {
      return user?.role === 'developer' && !isPreviewing;
    }
    // Group-scoped Assistant Lecturer: scoped strictly to assigned group, does not expose full course-builder or trainee personal courses
    if (previewRole === 'assistant_lecturer' && (item.id === 'course-builder' || item.id === 'my-courses')) {
      return false;
    }
    return isNavItemVisibleForRole(item, effectiveRole);
  };

  return (
    <aside
      aria-label="شريط التنقل الجانبي"
      className={`hidden lg:flex flex-col shrink-0 bg-surface border-l border-border transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'
        }`}
    >
      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {NAVIGATION_SECTIONS.map((section, sectionIndex) => {
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
                sectionIndex > 0 && <div className="my-2 border-t border-border/60" aria-hidden="true" />
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
            <span
              className="text-[10px] text-text-muted font-medium"
              data-testid="sidebar-brand-version"
            >
              {user?.role === 'developer' && !isPreviewing
                ? 'مترو القاهرة LMS • مرحلة 2'
                : 'مترو القاهرة LMS'}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};
