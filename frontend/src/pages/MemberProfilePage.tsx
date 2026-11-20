import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  profileApi,
  type PublicUserOverviewResponse,
} from '@/features/profile/services/profileApi';
import { UserCoursesAndGroupsPanel } from '@/features/user-management/components/UserCoursesAndGroupsPanel';
import { Card, CardContent } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Alert } from '@/shared/ui/Alert';
import { Icon } from '@/shared/ui/Icon';
import { ROLE_CANONICAL_LABELS_AR } from '@/core/permissions/types';
import type { UserRole } from '@/core/auth/types';

export const MemberProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [data, setData] = useState<PublicUserOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    profileApi
      .getPublicUserOverview(userId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'تعذر تحميل ملف العضو');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-3" data-testid="member-profile-loading">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-text-muted">جاري تحميل ملف العضو...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto py-10 px-4 space-y-4" data-testid="member-profile-error">
        <Alert variant="danger" title="تعذر عرض الملف الشخصي">
          {error || 'العضو غير موجود.'}
        </Alert>
        <Button type="button" variant="outline" size="sm" onClick={() => navigate(-1)}>
          رجوع
        </Button>
      </div>
    );
  }

  const { user, overview } = data;
  const roleLabel = ROLE_CANONICAL_LABELS_AR[user.role as UserRole] || user.role;
  const canViewFullAdminProfile =
    currentUser?.role === 'developer' ||
    currentUser?.role === 'super_admin' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'assistant_admin';

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto" data-testid="member-profile-page">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="hover:text-primary transition-colors font-semibold"
          >
            ← رجوع
          </button>
          <span>/</span>
          <span className="text-text-heading font-bold">الملف العام للعضو</span>
        </div>

        {canViewFullAdminProfile && (
          <Link
            to={`/admin/users/${encodeURIComponent(user.id)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/40 bg-primary/5 text-primary text-xs font-bold hover:bg-primary/10 transition-colors"
            data-testid="open-full-admin-profile-btn"
          >
            <Icon name="shield" size="sm" />
            <span>عرض الملف الإداري الكامل</span>
          </Link>
        )}
      </div>

      {/* Non-Sensitive Public Identity Card */}
      <Card variant="elevated" className="overflow-hidden border border-border/80">
        <div className="h-20 bg-gradient-to-l from-primary via-primary/90 to-primary-dark" />
        <CardContent className="p-6 -mt-10 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="w-18 h-18 rounded-2xl bg-surface border-4 border-surface shadow-md flex items-center justify-center text-primary font-black text-2xl">
              {user.initials}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-text-heading">{user.name}</h1>
                <Badge variant="primary" size="sm">
                  {roleLabel}
                </Badge>
                <Badge variant={user.status === 'suspended' ? 'warning' : 'success'} size="sm">
                  {user.status === 'suspended' ? 'معطل' : 'نشط'}
                </Badge>
              </div>
              <p className="text-xs text-text-muted">
                {user.jobTitle || 'عضو بالمنظومة'}
                {user.department ? ` • ${user.department}` : ''}
                {user.metroLine ? ` • ${user.metroLine}` : ''}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/60 text-xs">
            <div className="bg-surface-alt/50 p-3 rounded-xl border border-border/60">
              <span className="text-text-muted block mb-0.5">الإدارة / القطاع</span>
              <span className="font-bold text-text-heading">{user.department || 'غير محدد'}</span>
            </div>
            <div className="bg-surface-alt/50 p-3 rounded-xl border border-border/60">
              <span className="text-text-muted block mb-0.5">المسمى الوظيفي</span>
              <span className="font-bold text-text-heading">{user.jobTitle || 'غير محدد'}</span>
            </div>
            <div className="bg-surface-alt/50 p-3 rounded-xl border border-border/60">
              <span className="text-text-muted block mb-0.5">خط المترو</span>
              <span className="font-bold text-text-heading">{user.metroLine || 'غير محدد'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Anti-clutter Courses & Groups Overview + Searchable Modal */}
      <UserCoursesAndGroupsPanel overview={overview} memberName={user.name} />

      <div className="p-3.5 rounded-xl bg-neutral-light/60 border border-border text-xs text-text-muted flex items-center gap-2">
        <Icon name="shield" size="sm" className="text-primary shrink-0" />
        <span>
          للحفاظ على الخصوصية، يتم عرض بيانات التدريب والإشراف والمقررات فقط دون أي بيانات شخصية أو وظيفية حساسة.
        </span>
      </div>
    </div>
  );
};

export default MemberProfilePage;
