import React from 'react';
import type { UserRole, UserStatus } from '@/core/user-management/types';
import { USER_ROLE_LABELS_AR, USER_STATUS_LABELS_AR } from '@/core/user-management/types';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';

export interface UserFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedRole: UserRole | 'all';
  onRoleChange: (r: UserRole | 'all') => void;
  selectedStatus: UserStatus | 'all';
  onStatusChange: (s: UserStatus | 'all') => void;
  selectedDepartment: string | 'all';
  onDepartmentChange: (d: string | 'all') => void;
  availableDepartments: string[];
  onReset: () => void;
  hasActiveFilters: boolean;
}

export const UserFilterBar: React.FC<UserFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedRole,
  onRoleChange,
  selectedStatus,
  onStatusChange,
  selectedDepartment,
  onDepartmentChange,
  availableDepartments,
  onReset,
  hasActiveFilters,
}) => {
  return (
    <div
      data-testid="user-filter-bar"
      className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4"
    >
      {/* Search Input Row */}
      <div className="relative">
        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-text-muted">
          <Icon name="search" size="md" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="ابحث بالاسم، المعرف، اسم المستخدم، المسمى الوظيفي، أو القطاع..."
          aria-label="البحث في دليل المستخدمين"
          data-testid="user-search-input"
          className="w-full pr-10 pl-10 py-2.5 text-sm bg-bg-alt/50 border border-border rounded-xl text-text placeholder:text-text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="مسح نص البحث"
            data-testid="clear-search-btn"
            className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted hover:text-text transition-colors"
          >
            <Icon name="close" size="sm" />
          </button>
        )}
      </div>

      {/* Filter Selects & Controls Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        {/* Role Filter */}
        <div>
          <label
            htmlFor="user-role-filter"
            className="block text-xs font-semibold text-text-muted mb-1.5"
          >
            الدور الوظيفي
          </label>
          <select
            id="user-role-filter"
            value={selectedRole}
            onChange={(e) => onRoleChange(e.target.value as UserRole | 'all')}
            data-testid="role-filter-select"
            className="w-full py-2 px-3 text-xs bg-bg-alt/50 border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all cursor-pointer"
          >
            <option value="all">كافة الأدوار (الكل)</option>
            <option value="admin">{USER_ROLE_LABELS_AR.admin}</option>
            <option value="lecturer">{USER_ROLE_LABELS_AR.lecturer}</option>
            <option value="user">{USER_ROLE_LABELS_AR.user}</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label
            htmlFor="user-status-filter"
            className="block text-xs font-semibold text-text-muted mb-1.5"
          >
            حالة الحساب
          </label>
          <select
            id="user-status-filter"
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value as UserStatus | 'all')}
            data-testid="status-filter-select"
            className="w-full py-2 px-3 text-xs bg-bg-alt/50 border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all cursor-pointer"
          >
            <option value="all">كافة الحالات (الكل)</option>
            <option value="active">{USER_STATUS_LABELS_AR.active}</option>
            <option value="suspended">{USER_STATUS_LABELS_AR.suspended}</option>
          </select>
        </div>

        {/* Department Filter */}
        <div>
          <label
            htmlFor="user-dept-filter"
            className="block text-xs font-semibold text-text-muted mb-1.5"
          >
            الإدارة / القطاع
          </label>
          <select
            id="user-dept-filter"
            value={selectedDepartment}
            onChange={(e) => onDepartmentChange(e.target.value)}
            data-testid="dept-filter-select"
            className="w-full py-2 px-3 text-xs bg-bg-alt/50 border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all cursor-pointer"
          >
            <option value="all">كافة الإدارات والقطاعات</option>
            {availableDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        {/* Reset Filters Action */}
        <div className="flex items-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={!hasActiveFilters}
            data-testid="reset-filters-btn"
            className="w-full justify-center text-xs text-text-muted hover:text-text hover:bg-neutral-light border border-dashed border-border"
          >
            <Icon name="refresh" size="sm" className="ml-1.5" />
            إعادة تعيين الفلاتر
          </Button>
        </div>
      </div>
    </div>
  );
};
