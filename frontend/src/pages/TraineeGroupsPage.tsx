import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { groupsApi, type EnrichedTrainingGroup } from '@/features/groups/services/groupsApi';
import { useAuth } from '@/features/auth';
import { Card, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { Alert } from '@/shared/ui/Alert';

export const TraineeGroupsPage: React.FC = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<EnrichedTrainingGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await groupsApi.getMyGroups();
      setGroups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل المجموعات التدريبية');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto" data-testid="trainee-groups-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-heading flex items-center gap-3">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Icon name="trainingGroups" size="lg" />
            </span>
            <span>مجموعاتي والبرامج التدريبية</span>
          </h1>
          <p className="text-sm text-text-muted mt-1">
            المجموعات والدفعات الميدانية المخصصة لك ومتابعة المهل الزمنية والمحاضرات التفاعلية.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-text-heading">
          <Icon name="trainingGroups" size="sm" className="text-primary" />
          <span>إجمالي المجموعات:</span>
          <span className="text-primary font-extrabold">{groups.length}</span>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" title="خطأ في تحميل المجموعات">
          <div className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={loadGroups}>
              إعادة المحاولة
            </Button>
          </div>
        </Alert>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" aria-busy="true">
          {[1, 2].map((n) => (
            <Card key={n} variant="elevated" className="animate-pulse p-6 space-y-4">
              <div className="h-6 bg-neutral-light rounded-sm w-3/4" />
              <div className="h-4 bg-neutral-light rounded-sm w-1/2" />
              <div className="h-16 bg-neutral-light rounded-sm w-full" />
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && groups.length === 0 && (
        <Card variant="default" className="text-center py-12 px-4 sm:px-8 border-dashed">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
              <Icon name="trainingGroups" size="xl" />
            </div>
            <h2 className="text-xl font-bold text-text-heading">لا توجد مجموعات تدريبية مخصصة لك حالياً</h2>
            <p className="text-sm text-text-muted leading-relaxed">
              أنت غير مدرج في أي مجموعة تدريبية حالياً. سيتم إدراجك من خلال إدارة التدريب عند بدء البرامج الميدانية والدفعات المشتركة.
            </p>
            <div className="pt-2">
              <Link to="/courses">
                <Button variant="primary" size="md" leftIcon="courses">
                  تصفح دليل الكورسات
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Groups List */}
      {!isLoading && !error && groups.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {groups.map((grp) => {
            const metrics = grp.metrics;
            const statusKey = metrics?.status || 'active';

            const statusBadgeVariant =
              statusKey === 'active' ? 'primary' : statusKey === 'scheduled' ? 'neutral' : 'danger';

            const statusLabel =
              statusKey === 'active'
                ? 'نشطة — قيد التدريب'
                : statusKey === 'scheduled'
                ? 'مجدولة'
                : 'منتهية الصلاحية';

            const statusIcon =
              statusKey === 'active' ? 'activity' : statusKey === 'scheduled' ? 'calendar' : 'clock';

            // Find current trainee's metrics in this group
            const myMetrics = metrics?.traineeMetricsList.find(
              (tm) => tm.userId.toLowerCase() === (user?.id || '').toLowerCase()
            );

            const programPercent = myMetrics?.programPercent ?? 0;
            const attention = myMetrics?.worstAttention;

            return (
              <Card
                key={grp.id}
                variant="elevated"
                className="flex flex-col justify-between border-border hover:shadow-md transition-shadow"
              >
                <div className="p-5 space-y-4">
                  {/* Top Meta Row */}
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant={statusBadgeVariant} className="text-xs font-bold gap-1 px-2.5 py-1">
                      <Icon name={statusIcon} size="sm" />
                      <span>{statusLabel}</span>
                    </Badge>

                    {metrics && (
                      <span className="text-xs text-text-muted font-bold flex items-center gap-1 bg-neutral-light px-2.5 py-1 rounded-md">
                        <Icon name="clock" size="sm" />
                        <span>{metrics.timeRemainingText}</span>
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <CardHeader className="p-0">
                    <CardTitle className="text-lg sm:text-xl font-bold text-text-heading leading-snug">
                      {grp.name}
                    </CardTitle>
                    <p className="text-xs sm:text-sm text-text-muted line-clamp-2 mt-1 leading-relaxed">
                      {grp.description}
                    </p>
                  </CardHeader>

                  {/* Assigned Courses Counter */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted bg-surface-alt/60 p-2.5 rounded-lg border border-border/70">
                    <span className="font-bold text-text-heading flex items-center gap-1">
                      <Icon name="courses" size="sm" className="text-primary" />
                      <span>المقررات المخصصة ({grp.courses.length}):</span>
                    </span>
                    {grp.courses.map((c) => (
                      <Badge key={c.courseId} variant="neutral" className="text-[11px] font-medium">
                        {c.courseId}
                      </Badge>
                    ))}
                  </div>

                  {/* Program Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs text-text-muted">
                      <span className="font-medium">إنجازك في البرنامج</span>
                      <span className="font-bold text-text-heading">{programPercent}%</span>
                    </div>
                    <ProgressBar
                      value={programPercent}
                      variant={programPercent === 100 ? 'success' : 'primary'}
                      size="md"
                    />
                  </div>

                  {/* Attention Notice if applicable */}
                  {attention && attention.needsAttention && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-danger-light/50 border border-danger/30 text-danger-dark text-xs font-semibold">
                      <Icon name="alert" size="sm" className="shrink-0" />
                      <span>{attention.reason}</span>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="p-4 bg-neutral-light/40 border-t border-border flex items-center justify-end">
                  <Link to={`/my-groups/${grp.id}`}>
                    <Button variant="primary" size="sm" rightIcon="arrowLeft" className="font-bold text-xs">
                      عرض تفاصيل المجموعة والمحتوى
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TraineeGroupsPage;
