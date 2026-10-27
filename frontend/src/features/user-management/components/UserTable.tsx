import React from 'react';
import { Link } from 'react-router-dom';
import type { ManagedUserDTO, UserRole, UserStatus } from '@/core/user-management/types';
import { USER_STATUS_LABELS_AR } from '@/core/user-management/types';
import { Badge, type BadgeVariant } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { SectionSkeleton } from '@/shared/ui/Loading';

export interface UserTableProps {
  users: ManagedUserDTO[];
  isLoading: boolean;
  emptyStateMessage?: string;
  onResetFilters?: () => void;
  onRoleChange?: (user: ManagedUserDTO, newRole: UserRole) => Promise<void>;
  onOpenStatusModal?: (user: ManagedUserDTO, targetStatus: UserStatus) => void;
  onManagePermissions?: (user: ManagedUserDTO) => void;
  updatingUserId?: string | null;
}

function getStatusBadgeVariant(status: UserStatus): BadgeVariant {
  return status === 'active' ? 'success' : 'danger';
}

function formatLastLogin(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) return 'لم يسجل الدخول';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0] || ''}.${parts[1][0] || ''}`;
}

export const UserTable: React.FC<UserTableProps> = ({
  users,
  isLoading,
  emptyStateMessage = 'لا توجد نتائج مطابقة لبحثك',
  onResetFilters,
  onRoleChange,
  onOpenStatusModal,
  onManagePermissions,
  updatingUserId,
}) => {
  if (isLoading) {
    return <SectionSkeleton variant="table" count={6} ariaLabel="جارٍ تحميل دليل المستخدمين..." />;
  }

  if (users.length === 0) {
    return (
      <div
        data-testid="empty-users-state"
        className="bg-surface border border-dashed border-border rounded-2xl p-10 sm:p-14 text-center space-y-4"
      >
        <div className="w-14 h-14 rounded-2xl bg-neutral-light text-text-muted mx-auto flex items-center justify-center">
          <Icon name="search" size="xl" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-text-heading">
            {emptyStateMessage}
          </h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            لم نتمكن من العثور على أي مستخدم يطابق معايير البحث والتصفية المحددة. يرجى تجربة كلمات بحث أخرى أو إعادة تعيين الفلاتر.
          </p>
        </div>
        {onResetFilters && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResetFilters}
            data-testid="empty-state-reset-btn"
            className="text-xs"
          >
            <Icon name="refresh" size="sm" className="ml-1.5" />
            إعادة تعيين الفلاتر
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="user-table-container"
      className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm"
    >
      <div className="overflow-x-auto">
        <table data-testid="user-table" className="w-full text-right text-sm">
          <thead>
            <tr className="bg-bg-alt/70 border-b border-border text-xs font-semibold text-text-muted select-none">
              <th scope="col" className="py-3.5 px-4 font-bold">
                المستخدم والهوية
              </th>
              <th scope="col" className="py-3.5 px-4 font-bold">
                المسمى والقطاع
              </th>
              <th scope="col" className="py-3.5 px-4 font-bold">
                الدور الوظيفي
              </th>
              <th scope="col" className="py-3.5 px-4 font-bold">
                حالة الحساب
              </th>
              <th scope="col" className="py-3.5 px-4 font-bold">
                بيانات الاتصال
              </th>
              <th scope="col" className="py-3.5 px-4 font-bold">
                آخر تسجيل دخول
              </th>
              <th scope="col" className="py-3.5 px-4 font-bold text-center">
                الإجراءات
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {users.map((u) => {
              const statusVariant = getStatusBadgeVariant(u.status);
              const initials = getInitials(u.name);
              const isUpdating = updatingUserId === u.id;

              return (
                <tr
                  key={u.id}
                  data-testid={`user-row-${u.id}`}
                  className="hover:bg-neutral-light/50 transition-colors"
                >
                  {/* Name and Canonical Identifier */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                        {initials}
                      </div>
                      <div className="space-y-0.5">
                        <div className="font-bold text-text-heading text-sm">
                          <Link
                            to={`/admin/users/${u.id}`}
                            data-testid={`view-transcript-link-${u.id}`}
                            className="hover:text-primary transition-colors hover:underline cursor-pointer"
                            title="عرض السجل التدريبي للمستخدم"
                          >
                            {u.name}
                          </Link>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-text-muted flex-wrap">
                          <span className="font-mono bg-bg-alt px-1.5 py-0.5 rounded text-[11px] text-text-muted border border-border">
                            {u.id}
                          </span>
                          <span className="text-text-muted/60">•</span>
                          <span>@{u.username}</span>
                          {u.legacyAliases && u.legacyAliases.length > 0 && (
                            <span
                              className="text-[11px] text-text-muted/80 bg-neutral-light px-1 py-0.2 rounded"
                              title={`الأسماء المستعارة المعتمدة: ${u.legacyAliases.join(', ')}`}
                            >
                              ({u.legacyAliases.join(', ')})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Job Title and Department */}
                  <td className="py-3.5 px-4">
                    <div className="space-y-0.5">
                      <div className="font-medium text-text text-xs sm:text-sm">
                        {u.jobTitle || 'غير محدد'}
                      </div>
                      <div className="text-xs text-text-muted">
                        {u.department || 'غير محدد'}
                      </div>
                    </div>
                  </td>

                  {/* Role Selector */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`تعديل دور ${u.name}`}
                        data-testid={`role-select-${u.id}`}
                        value={u.role}
                        disabled={isUpdating}
                        onChange={(e) => onRoleChange?.(u, e.target.value as UserRole)}
                        className="bg-bg text-text text-xs rounded-lg border border-border py-1.5 px-2.5 font-medium focus:border-primary outline-none transition-colors"
                      >
                        <option value="user">متدرب</option>
                        <option value="lecturer">محاضر</option>
                        <option value="assistant_admin">مساعد مدير</option>
                        <option value="admin">مدير</option>
                      </select>
                      {isUpdating && (
                        <span className="text-text-muted text-[11px] animate-pulse">
                          جارٍ الحفظ...
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <Badge variant={statusVariant} size="sm" dot>
                      {USER_STATUS_LABELS_AR[u.status] || u.status}
                    </Badge>
                  </td>

                  {/* Contact Info */}
                  <td className="py-3.5 px-4">
                    <div className="space-y-0.5 text-xs">
                      <div className="text-text truncate max-w-[200px]" dir="ltr">
                        {u.email}
                      </div>
                      <div className="text-text-muted" dir="ltr">
                        {u.phone || '—'}
                      </div>
                    </div>
                  </td>

                  {/* Last Login */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-xs text-text-muted">
                    {formatLastLogin(u.lastLogin)}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Link
                        to={`/admin/users/${u.id}`}
                        data-testid={`user-transcript-btn-${u.id}`}
                        className="inline-block"
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isUpdating}
                          className="text-xs text-text-muted hover:text-primary px-2"
                          title="عرض تفاصيل السجل التدريبي"
                        >
                          <Icon name="bookOpen" size="sm" className="ml-1" />
                          السجل
                        </Button>
                      </Link>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onManagePermissions?.(u)}
                        disabled={isUpdating}
                        data-testid={`manage-permissions-btn-${u.id}`}
                        className="text-xs text-primary hover:text-primary-dark border-primary/30 hover:border-primary/60 hover:bg-primary/5 px-2.5 font-medium"
                        title="تحديد الصلاحيات الفردية للمستخدم"
                      >
                        <Icon name="shield" size="sm" className="ml-1" />
                        تحديد الصلاحيات
                      </Button>

                      {u.status === 'active' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenStatusModal?.(u, 'suspended')}
                          disabled={isUpdating}
                          data-testid={`suspend-user-btn-${u.id}`}
                          className="text-xs text-danger hover:text-danger-dark border-danger/30 hover:border-danger/60 hover:bg-danger/5 px-2"
                        >
                          <Icon name="alertCircle" size="sm" className="ml-1" />
                          إيقاف
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenStatusModal?.(u, 'active')}
                          disabled={isUpdating}
                          data-testid={`activate-user-btn-${u.id}`}
                          className="text-xs text-success hover:text-success-dark border-success/30 hover:border-success/60 hover:bg-success/5 px-2"
                        >
                          <Icon name="check" size="sm" className="ml-1" />
                          تنشيط
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
