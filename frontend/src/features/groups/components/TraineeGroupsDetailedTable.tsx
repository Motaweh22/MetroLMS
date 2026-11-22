import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { TraineeGroupItemDTO } from '@/core/groups/dtos';
import { formatGroupTimeInfoAr } from '@/core/groups/resolvers';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { StyledSelect } from '@/shared/ui/StyledSelect';

export interface TraineeGroupsDetailedTableProps {
  groups: TraineeGroupItemDTO[];
}

export const TraineeGroupsDetailedTable: React.FC<TraineeGroupsDetailedTableProps> = ({
  groups,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'regular' | 'reminder'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'scheduled' | 'expired'>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');

  // Extract unique courses for optional course filter
  const availableCourses = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) {
      for (const c of g.courses || []) {
        if (!map.has(c.courseId)) {
          map.set(c.courseId, c.courseTitle || c.courseId);
        }
      }
    }
    return Array.from(map.entries()).map(([courseId, title]) => ({
      courseId,
      title,
    }));
  }, [groups]);

  // Filtered groups calculation (applies only to the detailed table)
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      // 1. Search by name or code
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = (g.name || '').toLowerCase().includes(query);
        const matchesCode = (g.enrollmentCode || g.id || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCode) {
          return false;
        }
      }

      // 2. Group type filter
      if (typeFilter !== 'all') {
        if (g.groupType !== typeFilter) {
          return false;
        }
      }

      // 3. Operational status filter
      if (statusFilter !== 'all') {
        if (g.operationalStatus !== statusFilter) {
          return false;
        }
      }

      // 4. Course filter
      if (courseFilter !== 'all') {
        const hasCourse = (g.courses || []).some((c) => c.courseId === courseFilter);
        if (!hasCourse) {
          return false;
        }
      }

      return true;
    });
  }, [groups, searchQuery, typeFilter, statusFilter, courseFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    typeFilter !== 'all' ||
    statusFilter !== 'all' ||
    courseFilter !== 'all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
    setCourseFilter('all');
  };

  return (
    <div
      className="space-y-4"
      data-testid="trainee-groups-detailed-table"
      role="region"
      aria-label="قائمة المجموعات والبرامج التدريبية التفصيلية"
    >
      {/* Search and Filters Bar */}
      <Card
        variant="default"
        className="p-4 bg-surface border border-border space-y-3.5"
      >
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <div className="absolute start-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
              <Icon name="search" size="md" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث باسم المجموعة أو كود الانضمام..."
              className="w-full ps-9 pe-4 py-2 text-sm bg-bg border border-border rounded-xl text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              data-testid="table-search-input"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Group Type Filter */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="trainee-type-filter" className="text-xs text-text-muted font-medium whitespace-nowrap">
                النوع:
              </label>
              <StyledSelect
                id="trainee-type-filter"
                dataTestId="table-type-filter"
                size="sm"
                className="min-w-[145px]"
                value={typeFilter}
                onChange={(val) => setTypeFilter(val as 'all' | 'regular' | 'reminder')}
                options={[
                  { value: 'all', label: 'جميع الأنواع' },
                  { value: 'regular', label: 'مجموعات أساسية' },
                  { value: 'reminder', label: 'برامج تذكيرية' },
                ]}
              />
            </div>

            {/* Operational Status Filter */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="trainee-status-filter" className="text-xs text-text-muted font-medium whitespace-nowrap">
                الحالة:
              </label>
              <StyledSelect
                id="trainee-status-filter"
                dataTestId="table-status-filter"
                size="sm"
                className="min-w-[165px]"
                value={statusFilter}
                onChange={(val) => setStatusFilter(val as 'all' | 'active' | 'scheduled' | 'expired')}
                options={[
                  { value: 'all', label: 'جميع الحالات' },
                  { value: 'active', label: 'نشطة — قيد التدريب' },
                  { value: 'scheduled', label: 'مجدولة' },
                  { value: 'expired', label: 'منتهية الصلاحية' },
                ]}
              />
            </div>

            {/* Course Filter (optional) */}
            {availableCourses.length > 0 && (
              <div className="flex items-center gap-1.5">
                <label htmlFor="trainee-course-filter" className="text-xs text-text-muted font-medium whitespace-nowrap">
                  المقرر:
                </label>
                <StyledSelect
                  id="trainee-course-filter"
                  dataTestId="table-course-filter"
                  size="sm"
                  className="min-w-[155px] max-w-[200px]"
                  value={courseFilter}
                  onChange={(val) => setCourseFilter(val)}
                  options={[
                    { value: 'all', label: 'جميع المقررات' },
                    ...availableCourses.map((c) => ({
                      value: c.courseId,
                      label: c.title,
                    })),
                  ]}
                />
              </div>
            )}

            {/* Active Filter Indication & Reset Action */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">
                  تصفية مفعّلة
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="text-xs text-text-muted hover:text-text bg-bg border border-border rounded-lg shadow-2xs"
                  data-testid="table-reset-filters-btn"
                >
                  إعادة ضبط التصفية
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Counter of matching results */}
        <div className="text-xs text-text-muted pt-2 border-t border-border/60 flex items-center justify-between">
          <span>
            عرض <strong className="text-text-heading font-bold">{filteredGroups.length}</strong> من أصل{' '}
            <strong className="text-text-heading font-bold">{groups.length}</strong> مجموعة تدريبية
          </span>
        </div>
      </Card>

      {/* Empty Filter State */}
      {filteredGroups.length === 0 && (
        <Card
          variant="default"
          className="text-center py-10 px-4 border-dashed"
          data-testid="table-empty-filters"
        >
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-neutral-light text-text-muted flex items-center justify-center mx-auto">
              <Icon name="search" size="md" />
            </div>
            <h3 className="text-base font-bold text-text-heading">
              لا توجد مجموعات مطابقة لمعايير البحث والتصفية
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              جرّب تغيير كلمات البحث أو إعادة ضبط خيارات التصفية لعرض جميع مجموعاتك التدريبية.
            </p>
            {hasActiveFilters && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  leftIcon="refresh"
                >
                  إعادة ضبط جميع خيارات التصفية
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Spacious, Highly Readable Structured Group Rows (Owner Priority) */}
      {filteredGroups.length > 0 && (
        <div className="space-y-4" role="list" aria-label="المجموعات التدريبية المتاحة">
          {filteredGroups.map((grp) => {
            const statusConfig = {
              active: {
                variant: 'primary' as const,
                label: 'نشطة — قيد التدريب',
                icon: 'activity' as const,
                iconColor: 'text-primary',
              },
              scheduled: {
                variant: 'warning' as const,
                label: 'مجدولة',
                icon: 'calendar' as const,
                iconColor: 'text-warning-dark',
              },
              expired: {
                variant: 'danger' as const,
                label: 'منتهية الصلاحية',
                icon: 'clock' as const,
                iconColor: 'text-danger-dark',
              },
            }[grp.operationalStatus] || {
              variant: 'neutral' as const,
              label: grp.operationalStatus,
              icon: 'clock' as const,
              iconColor: 'text-text-muted',
            };

            const isReminderGroup = grp.groupType === 'reminder';
            const timeText = formatGroupTimeInfoAr(grp.timeInfo);

            return (
              <Card
                key={grp.id}
                variant="default"
                className="p-5 bg-surface border border-border shadow-sm hover:border-primary/40 hover:shadow-md transition-shadow space-y-4 rounded-xl"
                data-testid={`detailed-group-item-${grp.id}`}
              >
                {/* 1. Primary Header Line: Dominant Group Name alongside Code & Badges */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-border/70">
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Dominant Group Name */}
                      <Link
                        to={grp.navigationUrl || `/my-groups/${encodeURIComponent(grp.id)}`}
                        className="text-base sm:text-lg font-bold text-text-heading hover:text-primary transition-colors focus-visible:outline-none focus-visible:underline"
                        data-testid={`detailed-group-name-${grp.id}`}
                      >
                        {grp.name}
                      </Link>

                      {/* Enrollment / Group Code */}
                      <Badge
                        variant="neutral"
                        size="sm"
                        className="font-mono text-xs bg-bg border-border"
                      >
                        {grp.enrollmentCode || grp.id}
                      </Badge>
                    </div>

                    {/* Group Description */}
                    {grp.description && (
                      <p className="text-xs sm:text-sm text-text-muted line-clamp-2 leading-relaxed">
                        {grp.description}
                      </p>
                    )}
                  </div>

                  {/* Badges Cluster: Type & Status Kept Visually Distinct */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Group-Level Type Badge (D-GRP-03, D-GRP-05, D-GRP-06) */}
                    {isReminderGroup ? (
                      <Badge
                        variant="warning"
                        size="md"
                        icon="refresh"
                        className="text-xs font-bold"
                        data-testid={`detailed-group-type-badge-${grp.id}`}
                      >
                        برنامج تذكيري
                      </Badge>
                    ) : (
                      <Badge
                        variant="neutral"
                        size="md"
                        className="text-xs bg-bg border-border"
                        data-testid={`detailed-group-type-badge-${grp.id}`}
                      >
                        مجموعة أساسية
                      </Badge>
                    )}

                    {/* Operational Status Badge */}
                    <Badge
                      variant={statusConfig.variant}
                      size="md"
                      icon={statusConfig.icon}
                      className="text-xs font-bold"
                      data-testid={`detailed-group-status-badge-${grp.id}`}
                    >
                      {statusConfig.label}
                    </Badge>
                  </div>
                </div>

                {/* 2. Middle Row: Clearly Separated Key Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-1 items-center">
                  {/* Column A: Remaining Time Semantics */}
                  <div
                    className="space-y-0.5"
                    data-testid={`detailed-group-time-${grp.id}`}
                  >
                    <span className="text-text-muted font-medium flex items-center gap-1.5">
                      <Icon name={statusConfig.icon} size="sm" className={statusConfig.iconColor} />
                      <span>الجدول والمهلة:</span>
                    </span>
                    <span className="text-text-heading font-bold text-sm block">
                      {timeText}
                    </span>
                  </div>

                  {/* Column B: Authoritative Enrolled Trainee Count */}
                  <div
                    className="space-y-0.5"
                    data-testid={`detailed-group-trainee-count-${grp.id}`}
                  >
                    <span className="text-text-muted font-medium flex items-center gap-1.5">
                      <Icon name="users" size="sm" className="text-primary" />
                      <span>المتدربون المسجلون:</span>
                    </span>
                    <span className="text-text-heading font-bold text-sm block">
                      {grp.traineeCount} متدرب في هذه الدفعة
                    </span>
                  </div>

                  {/* Column C: Action Affordance */}
                  <div className="flex items-center justify-start md:justify-end">
                    <Link
                      to={grp.navigationUrl || `/my-groups/${encodeURIComponent(grp.id)}`}
                      className="w-full md:w-auto"
                      data-testid={`detailed-group-action-${grp.id}`}
                    >
                      <Button
                        variant="primary"
                        size="sm"
                        rightIcon="arrowLeft"
                        className="w-full md:w-auto font-bold text-xs"
                      >
                        عرض تفاصيل المجموعة
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* 3. Bottom Row: Assigned Courses with Full Titles and Dual Badges (D-GRP-05, D-GRP-08) */}
                {grp.courses && grp.courses.length > 0 && (
                  <div
                    className="pt-3 border-t border-border/70 space-y-2"
                    data-testid={`detailed-group-courses-${grp.id}`}
                  >
                    <div className="text-xs font-semibold text-text-heading flex items-center gap-1.5">
                      <Icon name="courses" size="sm" className="text-primary" />
                      <span>المقررات المخصصة ({grp.courses.length}):</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {grp.courses.map((c) => {
                        const isReminderCourse = c.courseRole === 'reminder';
                        return (
                          <div
                            key={c.courseId}
                            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border shadow-2xs ${
                              isReminderCourse
                                ? 'bg-warning-light text-warning-dark border-warning-dark/20'
                                : 'bg-bg text-text-heading border-border'
                            }`}
                          >
                            <span className="font-medium">{c.courseTitle || c.courseId}</span>
                            <span
                              className={`text-[11px] font-mono ${
                                isReminderCourse ? 'text-warning-dark' : 'text-text-muted'
                              }`}
                            >
                              ({c.courseCode || c.courseId})
                            </span>
                            <Badge
                              variant={isReminderCourse ? 'warning' : 'neutral'}
                              size="sm"
                              className={isReminderCourse ? '' : 'bg-surface'}
                            >
                              {isReminderCourse ? 'مقرر تذكيري' : 'دورة أساسية'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TraineeGroupsDetailedTable;

