import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { UserTranscriptDTO, ManagedUserDTO, UserStatus } from '@/core/user-management/types';
import { USER_ROLE_LABELS_AR, USER_STATUS_LABELS_AR } from '@/core/user-management/types';
import { userManagementApi } from '@/features/user-management/services/userManagementApi';
import { UserTranscriptCard } from '@/features/user-management/components/UserTranscriptCard';
import { UserCoursesHistoryList } from '@/features/user-management/components/UserCoursesHistoryList';
import { SuspendUserModal } from '@/features/user-management/components/SuspendUserModal';
import { Badge, type BadgeVariant } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { SectionSkeleton } from '@/shared/ui/Loading';

function getRoleBadgeVariant(role: string): BadgeVariant {
  switch (role) {
    case 'admin':
      return 'danger';
    case 'lecturer':
      return 'primary';
    case 'user':
    default:
      return 'neutral';
  }
}

function getStatusBadgeVariant(status: UserStatus): BadgeVariant {
  return status === 'active' ? 'success' : 'danger';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0] || ''}.${parts[1][0] || ''}`;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) return '—';
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

export const UserDetailsPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();

  const [transcript, setTranscript] = useState<UserTranscriptDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);

  // Quick Account-Status Action state
  const [statusModalUser, setStatusModalUser] = useState<ManagedUserDTO | null>(null);
  const [statusModalTarget, setStatusModalTarget] = useState<UserStatus>('suspended');

  const fetchTranscript = useCallback(async () => {
    if (!userId) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const data = await userManagementApi.getUserTranscript(userId);
      setTranscript(data);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 404) {
        setNotFound(true);
      } else {
        const msg = err instanceof Error ? err.message : 'تعذر تحميل السجل التدريبي للمستخدم';
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchTranscript();
  }, [fetchTranscript]);

  const handleOpenStatusModal = (user: ManagedUserDTO, targetStatus: UserStatus) => {
    setStatusModalUser(user);
    setStatusModalTarget(targetStatus);
  };

  const handleStatusSuccess = (updatedUser: ManagedUserDTO) => {
    setTranscript((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        user: updatedUser,
      };
    });
  };

  // 1. Loading State
  if (isLoading) {
    return (
      <div
        role="main"
        data-testid="transcript-loading"
        className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl space-y-6"
      >
        <SectionSkeleton variant="card" count={1} ariaLabel="جارٍ تحميل السجل التدريبي للمستخدم..." />
        <SectionSkeleton variant="metric" count={4} ariaLabel="جارٍ تحميل مؤشرات السجل التدريبي..." />
        <SectionSkeleton variant="card" count={2} ariaLabel="جارٍ تحميل قائمة المقررات والمحاولات..." />
      </div>
    );
  }

  // 2. 404 Not Found State
  if (notFound || !transcript) {
    return (
      <div
        role="main"
        data-testid="user-not-found-state"
        className="container mx-auto px-4 py-12 max-w-3xl text-center space-y-6"
      >
        <div className="w-16 h-16 rounded-2xl bg-danger/10 text-danger mx-auto flex items-center justify-center">
          <Icon name="alertCircle" size="xl" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold text-text-heading">
            المستخدم المطلوب غير موجود
          </h1>
          <p className="text-xs sm:text-sm text-text-muted max-w-md mx-auto">
            لم نتمكن من العثور على أي حساب يطابق المعرف ({userId}). ربما تم حذفه أو أن المعرف المدخل غير صحيح.
          </p>
        </div>
        <div>
          <Link to="/admin/users">
            <Button variant="primary" size="sm" data-testid="back-to-users-btn">
              <Icon name="arrowRight" size="sm" className="ml-1.5" />
              العودة إلى دليل المستخدمين
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { user, metrics, courses } = transcript;
  const isSuspended = user.status === 'suspended';

  return (
    <div
      role="main"
      data-testid="user-details-page"
      className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl space-y-6"
    >
      {/* Breadcrumbs Navigation */}
      <nav aria-label="مسار التنقل" className="flex items-center gap-2 text-xs text-text-muted">
        <Link
          to="/admin/users"
          data-testid="back-to-users-btn"
          className="hover:text-primary transition-colors flex items-center gap-1 font-medium"
        >
          <Icon name="users" size="sm" />
          <span>إدارة دليل المستخدمين</span>
        </Link>
        <span className="text-text-muted/60">←</span>
        <span className="text-text font-bold">تفاصيل المستخدم والسجل التدريبي</span>
      </nav>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" title="خطأ أثناء جلب البيانات" data-testid="transcript-error">
          <div className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchTranscript}
              data-testid="retry-transcript-btn"
            >
              <Icon name="refresh" size="sm" className="ml-1" />
              إعادة المحاولة
            </Button>
          </div>
        </Alert>
      )}

      {/* User Profile Header Card */}
      <div
        data-testid="user-profile-header"
        className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 text-primary font-bold text-base sm:text-lg flex items-center justify-center shrink-0 border border-primary/20">
              {getInitials(user.name)}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-extrabold text-text-heading">
                  {user.name}
                </h1>
                <span className="font-mono text-xs bg-bg-alt text-text-muted px-2 py-0.5 rounded border border-border">
                  {user.id}
                </span>
                <span className="text-xs text-text-muted">@{user.username}</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-text-muted flex-wrap">
                <span className="font-semibold text-text">{user.jobTitle || 'غير محدد'}</span>
                <span>•</span>
                <span>{user.department || 'غير محدد'}</span>
              </div>
            </div>
          </div>

          {/* Role, Status & Quick Action Button */}
          <div className="flex items-center gap-2.5 sm:self-center shrink-0 flex-wrap">
            <Badge variant={getRoleBadgeVariant(user.role)} size="md">
              {USER_ROLE_LABELS_AR[user.role] || user.role}
            </Badge>
            <Badge variant={getStatusBadgeVariant(user.status)} size="md" dot>
              {USER_STATUS_LABELS_AR[user.status] || user.status}
            </Badge>

            {/* Quick Status Toggle Button (reusing Phase 2 SuspendUserModal) */}
            {isSuspended ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenStatusModal(user, 'active')}
                data-testid="header-activate-user-btn"
                className="text-xs text-success hover:text-success-dark border-success/30 hover:border-success/60 hover:bg-success/5"
              >
                <Icon name="check" size="sm" className="ml-1" />
                إعادة التنشيط
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenStatusModal(user, 'suspended')}
                data-testid="header-suspend-user-btn"
                className="text-xs text-danger hover:text-danger-dark border-danger/30 hover:border-danger/60 hover:bg-danger/5"
              >
                <Icon name="alertCircle" size="sm" className="ml-1" />
                إيقاف الحساب
              </Button>
            )}
          </div>
        </div>

        {/* Detailed Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border/60 text-xs">
          <div>
            <span className="text-text-muted block text-[11px] mb-0.5">البريد الإلكتروني الوظيفي</span>
            <span className="font-medium text-text font-mono" dir="ltr">
              {user.email}
            </span>
          </div>
          <div>
            <span className="text-text-muted block text-[11px] mb-0.5">رقم الهاتف</span>
            <span className="font-medium text-text" dir="ltr">
              {user.phone || '—'}
            </span>
          </div>
          <div>
            <span className="text-text-muted block text-[11px] mb-0.5">تاريخ التسجيل بالمنظومة</span>
            <span className="font-medium text-text">{formatDate(user.createdAt)}</span>
          </div>
          <div>
            <span className="text-text-muted block text-[11px] mb-0.5">آخر تسجيل دخول</span>
            <span className="font-medium text-text">{formatDate(user.lastLogin)}</span>
          </div>
        </div>

        {/* Aliases Note if present */}
        {user.legacyAliases && user.legacyAliases.length > 0 && (
          <div className="pt-2 text-[11px] text-text-muted flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-text">المعرفات والأسماء المستعارة المعتمدة:</span>
            <span className="font-mono bg-bg-alt px-1.5 py-0.5 rounded border border-border text-text-muted">
              {user.legacyAliases.join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* Transcript Key Metric Summary Cards */}
      <UserTranscriptCard metrics={metrics} />

      {/* Course History List with expandable attempts */}
      <UserCoursesHistoryList courses={courses} />

      {/* Reused Phase 2 SuspendUserModal */}
      <SuspendUserModal
        isOpen={Boolean(statusModalUser)}
        user={statusModalUser}
        targetStatus={statusModalTarget}
        onClose={() => setStatusModalUser(null)}
        onSuccess={handleStatusSuccess}
      />
    </div>
  );
};

export default UserDetailsPage;
