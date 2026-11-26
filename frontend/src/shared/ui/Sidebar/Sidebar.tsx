import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { SidebarItem } from './SidebarItem';
import {
  NAVIGATION_SECTIONS,
  type NavItem,
  resolveNavItemVisibility,
} from '@/shared/config/navigation';
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
  const location = useLocation();
  const effectiveRole = userRole ?? user?.role;
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const activeSection = NAVIGATION_SECTIONS.find((sec) =>
      sec.items.some((it) => location.pathname === it.path || location.pathname.startsWith(`${it.path}/`))
    );
    if (activeSection) {
      setCollapsedSections((prev) =>
        prev[activeSection.id] ? { ...prev, [activeSection.id]: false } : prev
      );
    }
  }, [location.pathname]);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  return (
    <aside
      aria-label="شريط التنقل الجانبي"
      className={`hidden lg:flex flex-col shrink-0 bg-surface border-l border-border transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {NAVIGATION_SECTIONS.map((section, sectionIndex) => {
          const visibleItems = section.items.filter((item) =>
            resolveNavItemVisibility(item, {
              role: effectiveRole,
              actualUserRole: user?.role,
              isPreviewing,
              previewRole,
            })
          );
          if (visibleItems.length === 0) return null;

          const isSectionCollapsed = Boolean(section.collapsible && collapsedSections[section.id]);

          return (
            <div key={section.id} className="space-y-1">
              {/* Section Header */}
              {!isCollapsed ? (
                section.collapsible ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={!isSectionCollapsed}
                    data-testid={`sidebar-section-toggle-${section.id}`}
                    className="w-full flex items-center justify-between px-2.5 py-1 rounded-md text-[11px] font-bold text-text-muted/85 hover:text-text hover:bg-neutral-light/60 transition-colors cursor-pointer"
                  >
                    <span>{section.titleAr}</span>
                    <span className="flex items-center gap-1.5 text-text-muted/70">
                      {isSectionCollapsed && (
                        <span className="text-[10px] font-mono bg-neutral-light px-1.5 rounded">
                          {visibleItems.length}
                        </span>
                      )}
                      <Icon
                        name={isSectionCollapsed ? 'chevronLeft' : 'chevronDown'}
                        size="sm"
                      />
                    </span>
                  </button>
                ) : (
                  <h3 className="px-2.5 text-[11px] font-bold text-text-muted/80 uppercase tracking-wider mb-1">
                    {section.titleAr}
                  </h3>
                )
              ) : (
                sectionIndex > 0 && <div className="my-2 border-t border-border/60" aria-hidden="true" />
              )}

              {/* Section Items */}
              {(!isSectionCollapsed || isCollapsed) && (
                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <SidebarItem
                      key={item.id}
                      item={item}
                      isCollapsed={isCollapsed}
                      onItemClick={onItemSelect}
                    />
                  ))}
                </div>
              )}
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
