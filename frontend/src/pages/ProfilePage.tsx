import React, { useState, useEffect, useCallback } from 'react';
import { profileApi, type UserProfileResponse } from '@/features/profile/services/profileApi';
import { Card, CardContent } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { ROLE_CANONICAL_LABELS_AR } from '@/core/permissions/types';
import type { UserRole } from '@/core/auth/types';

export const ProfilePage: React.FC = () => {
  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await profileApi.getProfile();
      setProfileData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل بيانات الملف الشخصي');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const getRoleLabel = (role: string) => {
    return ROLE_CANONICAL_LABELS_AR[role as UserRole] || role;
  };

  const getRoleBadgeVariant = (role: string): 'primary' | 'warning' | 'neutral' => {
    switch (role) {
      case 'developer':
      case 'super_admin':
      case 'admin':
      case 'assistant_admin':
        return 'warning';
      case 'lecturer':
        return 'neutral';
      case 'user':
      default:
        return 'primary';
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto" data-testid="profile-page">
      {/* Page Header */}
      <div className="pb-2 border-b border-border">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-text-heading flex items-center gap-3">
          <span className="p-2 rounded-xl bg-primary/10 text-primary">
            <Icon name="user" size="lg" />
          </span>
          <span>الملف التعريفي والبيانات الوظيفية</span>
        </h1>
        <p className="text-sm text-text-muted mt-1">
          بيانات الحساب المهني في الشركة المصرية لإدارة وتشغيل المترو وإحصائيات التدريب الميداني.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" title="خطأ في تحميل الملف الشخصي">
          <div className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={loadProfile}>
              إعادة المحاولة
            </Button>
          </div>
        </Alert>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-6" aria-busy="true">
          <Card variant="elevated" className="p-6 animate-pulse space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-neutral-light rounded-full" />
              <div className="space-y-2 flex-1">
                <div className="h-6 bg-neutral-light rounded w-1/3" />
                <div className="h-4 bg-neutral-light rounded w-1/4" />
              </div>
            </div>
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-24 bg-neutral-light rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* Profile Card */}
      {!isLoading && !error && profileData && (
        <div className="space-y-6">
          <Card variant="elevated" className="border-border overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-primary/80 to-primary/40 relative" />
            <CardContent className="px-6 pb-6 pt-0 relative">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 mb-6">
                <div className="flex items-end gap-4">
                  <div className="w-24 h-24 rounded-2xl bg-surface border-4 border-surface shadow-md flex items-center justify-center text-primary font-black text-2xl select-none">
                    {profileData.user.initials || profileData.user.name.slice(0, 2)}
                  </div>
                  <div className="mb-1">
                    <h2 className="text-xl sm:text-2xl font-extrabold text-text-heading">
                      {profileData.user.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-text-muted font-medium">
                      {profileData.user.jobTitle || 'فني صيانة قطارات'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={getRoleBadgeVariant(profileData.user.role)} className="text-xs font-bold px-3 py-1">
                    {getRoleLabel(profileData.user.role)}
                  </Badge>
                  <Badge variant="neutral" className="text-xs font-mono">
                    {profileData.user.id}
                  </Badge>
                </div>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-border">
                <div className="bg-surface-alt/50 p-3.5 rounded-xl border border-border/60">
                  <span className="text-xs text-text-muted font-medium block mb-1">
                    البريد الإلكتروني المهني
                  </span>
                  <span className="text-sm font-semibold text-text-heading dir-ltr text-right block">
                    {profileData.user.email}
                  </span>
                </div>

                <div className="bg-surface-alt/50 p-3.5 rounded-xl border border-border/60">
                  <span className="text-xs text-text-muted font-medium block mb-1">
                    القطاع / الإدارة التابع لها
                  </span>
                  <span className="text-sm font-semibold text-text-heading">
                    {profileData.user.department || 'قطاع التشغيل والصيانة'}
                  </span>
                </div>

                <div className="bg-surface-alt/50 p-3.5 rounded-xl border border-border/60">
                  <span className="text-xs text-text-muted font-medium block mb-1">
                    المسمى الوظيفي
                  </span>
                  <span className="text-sm font-semibold text-text-heading">
                    {profileData.user.jobTitle || 'فني تشغيل وصيانة'}
                  </span>
                </div>

                <div className="bg-surface-alt/50 p-3.5 rounded-xl border border-border/60">
                  <span className="text-xs text-text-muted font-medium block mb-1">
                    حالة الحساب
                  </span>
                  <span className="text-sm font-bold text-success flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-success" />
                    <span>نشط ومفعل بالمنصة</span>
                  </span>
                </div>

                <div className="bg-surface-alt/50 p-3.5 rounded-xl border border-border/60">
                  <span className="text-xs text-text-muted font-medium block mb-1">
                    جهة العمل الرسمية
                  </span>
                  <span className="text-sm font-semibold text-text-heading">
                    الشركة المصرية لإدارة وتشغيل المترو
                  </span>
                </div>

                <div className="bg-surface-alt/50 p-3.5 rounded-xl border border-border/60">
                  <span className="text-xs text-text-muted font-medium block mb-1">
                    نوع الصلاحية
                  </span>
                  <span className="text-sm font-semibold text-text-heading">
                    {getRoleLabel(profileData.user.role)} (قراءة ومتابعة)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Learning Statistics Grid */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-text-heading flex items-center gap-2">
              <Icon name="activity" size="sm" className="text-primary" />
              <span>إحصائيات التدريب والنشاط التعليمي</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card variant="default" className="p-4 bg-surface text-center space-y-1">
                <span className="text-xs text-text-muted font-medium">الكورسات المسجلة</span>
                <p className="text-2xl font-black text-primary">
                  {profileData.stats.enrolledCoursesCount}
                </p>
                <span className="text-[11px] text-text-muted">مقررات قيد الدراسة والمتابعة</span>
              </Card>

              <Card variant="default" className="p-4 bg-surface text-center space-y-1">
                <span className="text-xs text-text-muted font-medium">الكورسات المكتملة</span>
                <p className="text-2xl font-black text-success">
                  {profileData.stats.completedCoursesCount}
                </p>
                <span className="text-[11px] text-text-muted">تم إنجازها بنجاح 100%</span>
              </Card>

              <Card variant="default" className="p-4 bg-surface text-center space-y-1">
                <span className="text-xs text-text-muted font-medium">ساعات التدريب الإجمالية</span>
                <p className="text-2xl font-black text-warning-dark">
                  {profileData.stats.totalLearningHours}
                </p>
                <span className="text-[11px] text-text-muted">ساعة تدريب ميداني ورقمي</span>
              </Card>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="p-4 rounded-xl bg-neutral-light/60 border border-border text-xs text-text-muted flex items-start gap-3">
            <Icon name="check" size="sm" className="text-primary mt-0.5 shrink-0" />
            <p className="leading-relaxed">
              هذا الملف التعريفي للقراءة فقط ومستند إلى بيانات شؤون العاملين وإدارة التدريب بالشركة. لا يمكن تعديل بيانات الهوية أو كلمة المرور من خلال هذه الواجهة لأسباب تنظيمية وأمنية.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
