import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { groupsApi } from '@/features/groups/services/groupsApi';
import type { TraineeGroupItemDTO } from '@/core/groups/dtos';
import { useRolePreview } from '@/core/auth/useRolePreview';
import {
  TraineeGroupsCarousel,
  TraineeGroupsSummaryCards,
  TraineeGroupsDetailedTable,
} from '@/features/groups/components';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';

export const TraineeGroupsPage: React.FC = () => {
  const { previewRole, scopedAssignmentPreview } = useRolePreview();
  const [groups, setGroups] = useState<TraineeGroupItemDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scoped Assistant Lecturer: limit visible groups strictly to the assigned group
  const visibleGroups = React.useMemo(() => {
    if (previewRole === 'assistant_lecturer' && scopedAssignmentPreview?.groupId) {
      return groups.filter(
        (g) => g.id.toLowerCase() === scopedAssignmentPreview.groupId.toLowerCase()
      );
    }
    return groups;
  }, [groups, previewRole, scopedAssignmentPreview]);

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
    <div
      className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto"
      data-testid="trainee-groups-page"
      dir="rtl"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-heading flex items-center gap-3">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Icon name="trainingGroups" size="lg" />
            </span>
            <span>المجموعات التدريبية والبرامج التذكيرية</span>
          </h1>
          <p className="text-sm text-text-muted mt-1 leading-relaxed">
            المجموعات والدفعات الميدانية والبرامج التذكيرية الدورية المخصصة لك ومتابعة المهل الزمنية والجداول.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-text-heading shrink-0">
          <Icon name="trainingGroups" size="sm" className="text-primary" />
          <span>المجموعات المتاحة:</span>
          <span
            className="text-primary font-extrabold"
            data-testid="page-groups-count"
          >
            {visibleGroups.length}
          </span>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" title="خطأ في تحميل المجموعات التدريبية">
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
        <div className="space-y-6" aria-busy="true" data-testid="trainee-groups-loading">
          {/* Carousel Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((n) => (
              <Card key={n} variant="elevated" className="animate-pulse p-5 space-y-3">
                <div className="h-5 bg-neutral-light rounded w-1/3" />
                <div className="h-6 bg-neutral-light rounded w-3/4" />
                <div className="h-10 bg-neutral-light rounded w-full" />
              </Card>
            ))}
          </div>

          {/* Summary Cards Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <Card key={n} className="animate-pulse p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-light shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 bg-neutral-light rounded w-1/2" />
                  <div className="h-6 bg-neutral-light rounded w-1/3" />
                </div>
              </Card>
            ))}
          </div>

          {/* Table Skeleton */}
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <Card key={n} className="animate-pulse p-5 space-y-3">
                <div className="h-5 bg-neutral-light rounded w-1/2" />
                <div className="h-4 bg-neutral-light rounded w-1/3" />
                <div className="h-12 bg-neutral-light rounded w-full" />
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State (when trainee is enrolled in 0 groups) */}
      {!isLoading && !error && visibleGroups.length === 0 && (
        <Card
          variant="default"
          className="text-center py-12 px-4 sm:px-8 border-dashed"
          data-testid="trainee-groups-empty-state"
        >
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
              <Icon name="trainingGroups" size="xl" />
            </div>
            <h2 className="text-xl font-bold text-text-heading">
              {previewRole === 'assistant_lecturer'
                ? 'المجموعة التدريبية المخصصة للمعاينة غير متوفرة'
                : 'لا توجد مجموعات أو برامج تذكيرية مخصصة لك حالياً'}
            </h2>
            <p className="text-sm text-text-muted leading-relaxed">
              {previewRole === 'assistant_lecturer'
                ? 'لم يتم العثور على المجموعة المحددة لتكليف المحاضر المساعد في السجل الحالي.'
                : 'أنت غير مدرج في أي مجموعة تدريبية أو برنامج تذكيري حالياً. سيتم إدراجك من خلال إدارة التدريب عند بدء البرامج الميدانية والدفعات المشتركة.'}
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

      {/* Primary Content: 3 Sections in Canonical Order */}
      {!isLoading && !error && visibleGroups.length > 0 && (
        <div className="space-y-8" data-testid="trainee-groups-content">
          {/* Section 1: Persistent Groups Carousel */}
          <section aria-label="شريط المجموعات التدريبية" data-testid="section-carousel">
            <TraineeGroupsCarousel groups={visibleGroups} />
          </section>

          {/* Section 2: Three Summary Cards */}
          <section aria-label="إحصائيات المجموعات" data-testid="section-summary-cards">
            <TraineeGroupsSummaryCards groups={visibleGroups} />
          </section>

          {/* Section 3: Detailed Groups Table with Self-Contained Filters */}
          <section aria-label="جدول المجموعات والبرامج التفصيلي" data-testid="section-detailed-table" className="space-y-4">
            <div className="flex items-center justify-between gap-4 pb-2 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-text-heading flex items-center gap-2">
                  <Icon name="list" size="sm" className="text-primary" />
                  <span>دليل المجموعات والبرامج التدريبية المخصصة</span>
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  استعرض تفاصيل المقررات والجداول والمهل الزمنية لكل مجموعة تدريبية وبرنامج تذكيري.
                </p>
              </div>
            </div>
            <TraineeGroupsDetailedTable groups={visibleGroups} />
          </section>
        </div>
      )}
    </div>
  );
};

export default TraineeGroupsPage;
