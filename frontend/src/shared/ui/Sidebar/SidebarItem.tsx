import React from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '@/shared/ui/Icon';
import { Badge } from '@/shared/ui/Badge';
import type { NavItem } from '@/shared/config/navigation';

export interface SidebarItemProps {
  item: NavItem;
  isCollapsed: boolean;
  onItemClick?: (item: NavItem) => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  item,
  isCollapsed,
  onItemClick,
}) => {
  const isPlanned = item.status === 'planned';

  // Planned items are rendered non-functionally with disabled indicators
  if (isPlanned) {
    return (
      <div
        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-muted/60 cursor-not-allowed select-none transition-colors ${
          isCollapsed ? 'justify-center' : 'justify-between'
        }`}
        title={`${item.titleAr} (${item.plannedIncrement || 'قيد التطوير'})`}
        aria-disabled="true"
        role="presentation"
        onClick={() => onItemClick?.(item)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon
            name={item.icon}
            size="md"
            className="text-text-muted/50 shrink-0"
          />
          {!isCollapsed && (
            <span className="text-sm font-medium truncate text-text-muted/70">
              {item.titleAr}
            </span>
          )}
        </div>

        {!isCollapsed && (
          <Badge
            variant={item.badgeVariant || 'neutral'}
            className="text-[10px] px-1.5 py-0 font-normal shrink-0 opacity-80"
          >
            {item.badge || 'قريباً'}
          </Badge>
        )}

        {/* Hover tooltip for collapsed state */}
        {isCollapsed && (
          <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 hidden group-hover:flex items-center z-50 whitespace-nowrap rounded-md bg-neutral-900 px-2.5 py-1 text-xs text-white shadow-lg pointer-events-none">
            <span>{item.titleAr} — {item.plannedIncrement || 'قيد التطوير'}</span>
          </div>
        )}
      </div>
    );
  }

  // Implemented & functional navigation links
  return (
    <NavLink
      to={item.path}
      onClick={() => onItemClick?.(item)}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          isCollapsed ? 'justify-center' : 'justify-between'
        } ${
          isActive
            ? 'bg-primary-dark text-white shadow-xs'
            : 'text-text-muted hover:text-text hover:bg-neutral-light'
        }`
      }
      title={isCollapsed ? item.titleAr : undefined}
    >
      {({ isActive }) => (
        <>
          <div className="flex items-center gap-3 min-w-0">
            <Icon
              name={item.icon}
              size="md"
              className={isActive ? 'text-accent-cyan shrink-0' : 'text-text-muted group-hover:text-primary shrink-0'}
            />
            {!isCollapsed && (
              <span className="truncate">{item.titleAr}</span>
            )}
          </div>

          {!isCollapsed && item.badge && (
            <Badge
              variant={isActive ? 'neutral' : (item.badgeVariant || 'primary')}
              className={`text-[10px] px-1.5 py-0 shrink-0 font-semibold ${
                isActive ? 'bg-white/20 text-white border-transparent' : ''
              }`}
            >
              {item.badge}
            </Badge>
          )}

          {/* Hover tooltip for collapsed state */}
          {isCollapsed && (
            <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 hidden group-hover:flex items-center z-50 whitespace-nowrap rounded-md bg-neutral-900 px-2.5 py-1 text-xs text-white shadow-lg pointer-events-none">
              <span>{item.titleAr}</span>
            </div>
          )}
        </>
      )}
    </NavLink>
  );
};
