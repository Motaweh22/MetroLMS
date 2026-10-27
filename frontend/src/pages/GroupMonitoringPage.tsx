import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { groupsApi } from '@/features/groups/services/groupsApi';
import type {
  GroupMetrics,
  TraineeGroupMetrics,
  AssignedCourseProgressMetric,
  GroupRenewalCycle,
} from '@/core/groups/types';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { AttentionBadge, CountdownStrip, TraineeProgressModal } from '@/features/groups/components';
import { formatMaterialDate } from '@/features/groups/utils/materialUtils';

export const GroupMonitoringPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const cycleIdParam = searchParams.get('cycleId') || undefined;
  const [selectedCycleId, setSelectedCycleId] = useState<string | undefined>(cycleIdParam);

  const [metrics, setMetrics] = useState<GroupMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState<boolean>(false);

  // Tab & Filters State
  const [activeTab, setActiveTab] = useState<'trainees' | 'courses'>('trainees');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTrainee, setSelectedTrainee] = useState<TraineeGroupMetrics | null>(null);

  // Sync selectedCycleId when param changes
  useEffect(() => {
    if (cycleIdParam && cycleIdParam !== selectedCycleId) {
      setSelectedCycleId(cycleIdParam);
    }
  }, [cycleIdParam, selectedCycleId]);

  // Load monitoring data
  const loadData = useCallback(async (cId?: string) => {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    setIsForbidden(false);

    try {
      const data = await groupsApi.getGroupMonitoringData(groupId, cId);
      setMetrics(data);
      if (data.selectedCycle) {
        setSelectedCycleId((prev) =>
          data.selectedCycle && data.selectedCycle.id !== prev ? data.selectedCycle.id : prev
        );
      }
    } catch (err: unknown) {
      console.error('Failed to load group monitoring metrics:', err);
      const is403 =
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        (err as { status?: number }).status === 403;
      const msg = err instanceof Error ? err.message : 'تعذر تحميل مؤشرات متابعة المجموعة';
      if (is403 || msg.includes('غير مصرح')) {
        setIsForbidden(true);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadData(selectedCycleId);
  }, [loadData, selectedCycleId]);

  // Handle cycle switch
  const handleCycleChange = (newCycleId: string) => {
    setSelectedCycleId(newCycleId);
    setSearchParams(newCycleId ? { cycleId: newCycleId } : {});
  };

  // Authorization check
  const isAuthorized = useMemo(() => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (metrics?.group && user.role === 'lecturer') {
      return Boolean(metrics.group.supervisorIds?.includes(user.id));
    }
    return false;
  }, [user, metrics?.group]);

  // Filtered trainees
  const filteredTrainees = useMemo(() => {
    if (!metrics?.traineeMetricsList) return [];

    return metrics.traineeMetricsList.filter((trainee) => {
      // Search query filter (name, email, department, job title)
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchesName = trainee.userName.toLowerCase().includes(q);
        const matchesEmail = (trainee.email || '').toLowerCase().includes(q);
        const matchesDept = (trainee.department || '').toLowerCase().includes(q);
        const matchesJob = (trainee.jobTitle || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesDept && !matchesJob) {
          return false;
        }
      }

      // Status filter
      if (statusFilter === 'completed_core') {
        return trainee.isAllCoreCompleted;
      }
      if (statusFilter === 'in_progress') {
        return (trainee.startedCoursesCount ?? 0) > 0 && !trainee.isAllCoreCompleted;
      }
      if (statusFilter === 'not_started') {
        return (trainee.startedCoursesCount ?? 0) === 0;
      }
      if (statusFilter === 'needs_attention') {
        return trainee.worstAttention?.needsAttention;
      }

      return true;
    });
  }, [metrics?.traineeMetricsList, searchQuery, statusFilter]);

  if (authLoading || (loading && !metrics)) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3" data-testid="monitoring-loading-spinner">
        <Icon name="clock" size="lg" className="animate-spin text-primary mb-2" />
        <span className="text-sm text-text-muted">جاري تحميل لوحة المتابعة والمؤشرات...</span>
      </div>
    );
  }

  // Unauthorized state
  if (isForbidden || (!authLoading && user && user.role !== 'admin' && !isAuthorized && metrics)) {
    return (
      <div className="container mx-auto p-6 max-w-5xl" dir="rtl">
        <div data-testid="admin-monitoring-unauthorized">
          <Alert variant="danger" icon="lock">
            غير مصرح لك بالوصول إلى لوحة متابعة هذه المجموعة التدريبية. هذه الصفحة مخصصة لمدير النظام
            والمشرفين المعتمدين للمجموعة فقط.
          </Alert>
          <div className="mt-4">
            <Button variant="outline" onClick={() => navigate('/admin/groups')}>
              العودة لقائمة المجموعات
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !metrics) {
    return (
      <div className="container mx-auto p-6 max-w-5xl" dir="rtl">
        <Alert variant="danger" icon="alert">
          {error || 'لم يتم العثور على المجموعة المطلوبة أو تعذر استخراج مؤشراتها'}
        </Alert>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/groups')} data-testid="back-to-group-btn">
            العودة للمجموعات
          </Button>
          <Button variant="primary" onClick={() => loadData(selectedCycleId)}>
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  const group = metrics.group;
  const currentCycle = metrics.selectedCycle;
  const isHistorical =
    Boolean(currentCycle?.status === 'completed' || currentCycle?.status === 'archived') ||
    (Boolean(group.currentCycleId) && Boolean(currentCycle) && group.currentCycleId !== currentCycle?.id);

  const cohort = metrics.cohortSummary;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-7xl" dir="rtl">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <button
              onClick={() => navigate('/admin/groups')}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              المجموعات التدريبية
            </button>
            <span>/</span>
            <button
              onClick={() => navigate(`/admin/groups/${group.id}`)}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              {group.name}
            </button>
            <span>/</span>
            <span className="text-text-heading font-medium">لوحة المتابعة الميدانية</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-text-heading">{group.name}</h1>
            <Badge variant="neutral" size="sm">
              {group.id}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/groups')}
            data-testid="back-to-group-btn"
          >
            <Icon name="arrowRight" size="sm" className="ml-1" />
            <span>قائمة المجموعات</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/admin/groups/${group.id}`)}
            data-testid="edit-group-settings-btn"
          >
            <Icon name="settings" size="sm" className="ml-1" />
            <span>إعدادات المجموعة</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(selectedCycleId)}
            data-testid="refresh-monitoring-btn"
          >
            <Icon name="refreshCw" size="sm" />
          </Button>
        </div>
      </div>

      {/* Cycle Selector Bar */}
      <div className="bg-surface p-4 rounded-xl border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
            <Icon name="clock" size="md" />
          </div>
          <div>
            <label
              htmlFor="cycle-select"
              className="block text-xs font-semibold text-text-muted mb-1"
            >
              دورة التجديد المعروضة:
            </label>
            <div className="flex items-center gap-2">
              <select
                id="cycle-select"
                value={currentCycle?.id || selectedCycleId || ''}
                onChange={(e) => handleCycleChange(e.target.value)}
                className="bg-background text-text-heading border border-border rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                data-testid="cycle-selector"
              >
                {metrics.cycles && metrics.cycles.length > 0 ? (
                  metrics.cycles.map((c: GroupRenewalCycle) => {
                    const isCycleActive = c.status === 'active' || c.id === group.currentCycleId;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.title || c.id} {isCycleActive ? '— (الدورة الحالية النشطة)' : '— (دورة تاريخية سابقة)'}
                      </option>
                    );
                  })
                ) : (
                  <option value={currentCycle?.id || 'default'}>
                    {currentCycle?.title || currentCycle?.id || 'الدورة الافتراضية'}
                  </option>
                )}
              </select>
              {isHistorical ? (
                <Badge variant="warning" size="sm">
                  أرشيف تاريخي
                </Badge>
              ) : (
                <Badge variant="primary" size="sm">
                  دورة حالية نشطة
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Selected Cycle Metadata */}
        {currentCycle && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <span className="font-medium">بداية الدورة:</span>
              <strong className="text-text-heading font-semibold">
                {formatMaterialDate(currentCycle.startDateTime)}
              </strong>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5">
              <span className="font-medium">الموعد النهائي:</span>
              <strong className="text-text-heading font-semibold">
                {formatMaterialDate(currentCycle.deadlineDateTime)}
              </strong>
            </div>
          </div>
        )}
      </div>

      {/* Historical Cycle Banner */}
      {isHistorical && (
        <div data-testid="historical-cycle-banner">
          <Alert variant="warning" icon="clock">
            أنت تستعرض دورة تجديد تاريخية سابقة ({currentCycle?.title || currentCycle?.id}). البيانات
            والمؤشرات المعروضة تمثل سجلاً تاريخياً موثقاً لنتائج المتدربين في تلك الفترة، وهي مفصولة
            تماماً عن تقدم الدورة الحالية.
          </Alert>
        </div>
      )}

      {/* Countdown & Temporal Progress Strip */}
      {currentCycle && (
        <CountdownStrip
          startDateTime={currentCycle.startDateTime}
          deadlineDateTime={currentCycle.deadlineDateTime}
          status={metrics.status}
          timeRemainingText={metrics.timeRemainingText}
          isHistorical={isHistorical}
          testId="group-countdown-strip"
        />
      )}

      {/* Cohort Summary Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Metric 1: Total Members */}
        <Card className="p-3.5 space-y-1" data-testid="cohort-metric-total-members">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-semibold">إجمالي المتدربين</span>
            <Icon name="users" size="sm" className="text-primary" />
          </div>
          <div className="text-2xl font-bold text-text-heading">
            {cohort?.totalMembers ?? 0}
          </div>
          <span className="text-[11px] text-text-muted block">مسجلين في المجموعة</span>
        </Card>

        {/* Metric 2: Assigned Courses */}
        <Card className="p-3.5 space-y-1" data-testid="cohort-metric-assigned-courses">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-semibold">المقررات المعتمدة</span>
            <Icon name="bookOpen" size="sm" className="text-primary" />
          </div>
          <div className="text-2xl font-bold text-text-heading">
            {cohort?.totalCourses ?? 0}
          </div>
          <span className="text-[11px] text-text-muted block">
            {cohort?.coreCoursesCount ?? 0} أساسي • {cohort?.reminderCoursesCount ?? 0} تذكيري
          </span>
        </Card>

        {/* Metric 3: Started Trainees */}
        <Card className="p-3.5 space-y-1" data-testid="cohort-metric-started-trainees">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-semibold">بدأوا التدريب</span>
            <Icon name="award" size="sm" className="text-primary" />
          </div>
          <div className="text-2xl font-bold text-text-heading">
            {cohort?.traineesStarted ?? 0} / {cohort?.totalMembers ?? 0}
          </div>
          <span className="text-[11px] text-text-muted block">
            {cohort?.totalMembers
              ? `${Math.round(((cohort.traineesStarted ?? 0) / cohort.totalMembers) * 100)}% من الأعضاء`
              : '0%'}
          </span>
        </Card>

        {/* Metric 4: Completed All Core */}
        <Card className="p-3.5 space-y-1" data-testid="cohort-metric-completed-core">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-semibold">أتموا كل الأساسي</span>
            <Icon name="checkCircle" size="sm" className="text-success" />
          </div>
          <div className="text-2xl font-bold text-success">
            {cohort?.traineesCompletedAllCore ?? 0} / {cohort?.totalMembers ?? 0}
          </div>
          <span className="text-[11px] text-text-muted block">
            {cohort?.totalMembers
              ? `${Math.round(((cohort.traineesCompletedAllCore ?? 0) / cohort.totalMembers) * 100)}% أكملوا الأساسي`
              : '0%'}
          </span>
        </Card>

        {/* Metric 5: Course Attempts */}
        <Card className="p-3.5 space-y-1" data-testid="cohort-metric-attempts">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-semibold">المحاولات المنجزة</span>
            <Icon name="award" size="sm" className="text-primary" />
          </div>
          <div className="text-2xl font-bold text-text-heading">
            {cohort?.completedAttempts ?? 0}
          </div>
          <span className="text-[11px] text-text-muted block">
            {cohort?.inProgressAttempts ?? 0} جارية • {cohort?.notStartedAttempts ?? 0} لم تبدأ
          </span>
        </Card>

        {/* Metric 6: Average Cohort Progress */}
        <Card className="p-3.5 space-y-1" data-testid="cohort-metric-avg-progress">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-semibold">متوسط الإنجاز</span>
            <Icon name="barChart" size="sm" className="text-primary" />
          </div>
          <div className="text-2xl font-bold text-primary">
            {cohort?.averageProgressPercent ?? 0}%
          </div>
          <span className="text-[11px] text-text-muted block">متوسط تقدم المتدربين</span>
        </Card>
      </div>

      {/* Cohort Attention Alerts (if any) */}
      {cohort && (cohort.warningAlertsCount > 0 || cohort.dangerAlertsCount > 0) && (
        <div
          className="bg-warning/10 border border-warning/30 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs"
          data-testid="cohort-metric-attention"
        >
          <div className="flex items-center gap-2">
            <Icon name="alert" size="md" className="text-warning-dark shrink-0" />
            <span className="text-text-heading font-semibold">
              يوجد {cohort.totalAttentionCount} حالة تحتاج للمتابعة الميدانية
            </span>
            <span className="text-text-muted">
              ({cohort.dangerAlertsCount} تنبيه عاجل • {cohort.warningAlertsCount} يحتاج متابعة)
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveTab('trainees');
              setStatusFilter('needs_attention');
            }}
          >
            تصفية المتدربين المتأخرين
          </Button>
        </div>
      )}

      {/* View Tabs Switcher */}
      <div className="border-b border-border flex items-center gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('trainees')}
          className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'trainees'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-heading'
          }`}
          data-testid="tab-trainees-view"
        >
          <Icon name="users" size="sm" />
          <span>متابعة المتدربين</span>
          <Badge variant="neutral" size="sm">
            {metrics.traineeMetricsList.length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('courses')}
          className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'courses'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-heading'
          }`}
          data-testid="tab-courses-view"
        >
          <Icon name="bookOpen" size="sm" />
          <span>متابعة المقررات</span>
          <Badge variant="neutral" size="sm">
            {metrics.assignedCoursesMetrics.length}
          </Badge>
        </button>
      </div>

      {/* ── Tab 1: Trainees View ───────────────────────────────────────── */}
      {activeTab === 'trainees' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-3.5 rounded-xl border border-border shadow-xs">
            <div className="w-full sm:w-72 relative">
              <input
                type="text"
                placeholder="بحث بالاسم أو القسم أو الوظيفة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-border rounded-lg pl-3 pr-9 py-2 text-xs text-text-heading placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
                data-testid="trainee-search-input"
              />
              <Icon
                name="search"
                size="sm"
                className="absolute right-3 top-2.5 text-text-muted pointer-events-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label htmlFor="status-filter" className="text-xs text-text-muted whitespace-nowrap">
                تصفية الحالة:
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-text-heading focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                data-testid="trainee-status-filter"
              >
                <option value="all">جميع الحالات ({metrics.traineeMetricsList.length})</option>
                <option value="completed_core">أتموا الأساسي بالكامل</option>
                <option value="in_progress">قيد التدريب والإنجاز</option>
                <option value="not_started">لم يبدأوا بعد</option>
                <option value="needs_attention">بحاجة لمتابعة وتنبيه</option>
              </select>
            </div>
          </div>

          {/* Trainees Table */}
          {filteredTrainees.length === 0 ? (
            <div
              className="text-center py-12 bg-surface rounded-xl border border-dashed border-border space-y-2"
              data-testid="empty-trainees-state"
            >
              <Icon name="users" size="lg" className="mx-auto text-text-muted" />
              <p className="text-sm font-semibold text-text-heading">
                لا يوجد متدربون يطابقون خيارات البحث أو التصفية
              </p>
              <p className="text-xs text-text-muted">
                جرّب إزالة شروط التصفية أو تغيير عبارة البحث
              </p>
            </div>
          ) : (
            <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs" data-testid="trainees-table">
                  <thead className="bg-neutral-light/60 border-b border-border text-text-muted uppercase font-semibold">
                    <tr>
                      <th className="p-3.5">المتدرب</th>
                      <th className="p-3.5">القسم والوظيفة</th>
                      <th className="p-3.5">المقررات الأساسية</th>
                      <th className="p-3.5">المقررات المبدأة</th>
                      <th className="p-3.5">نسبة الإنجاز</th>
                      <th className="p-3.5">حالة التقدم</th>
                      <th className="p-3.5">آخر نشاط</th>
                      <th className="p-3.5 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredTrainees.map((trainee) => {
                      return (
                        <tr
                          key={trainee.userId}
                          className="hover:bg-neutral-light/30 transition-colors"
                          data-testid={`trainee-row-${trainee.userId}`}
                        >
                          {/* Name & Email */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                {trainee.userName.slice(0, 1)}
                              </div>
                              <div>
                                <span className="font-bold text-text-heading block">
                                  {trainee.userName}
                                </span>
                                <span className="text-[11px] text-text-muted block">
                                  {trainee.email || '—'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Department & Job Title */}
                          <td className="p-3.5">
                            <span className="text-text-heading font-medium block">
                              {trainee.department || '—'}
                            </span>
                            <span className="text-[11px] text-text-muted block">
                              {trainee.jobTitle || '—'}
                            </span>
                          </td>

                          {/* Core Courses */}
                          <td className="p-3.5">
                            {trainee.isAllCoreCompleted ? (
                              <Badge variant="success" size="sm">
                                أتم الأساسي ({trainee.completedCoreCoursesCount}/{trainee.totalCoreCoursesCount})
                              </Badge>
                            ) : (
                              <span className="font-semibold text-text-heading">
                                {trainee.completedCoreCoursesCount ?? 0} / {trainee.totalCoreCoursesCount ?? 0}
                              </span>
                            )}
                          </td>

                          {/* Started Courses */}
                          <td className="p-3.5 font-semibold text-text-heading">
                            {trainee.startedCoursesCount ?? 0} / {trainee.totalAssignedCourses}
                          </td>

                          {/* Overall Progress */}
                          <td className="p-3.5">
                            <div className="w-28 space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-primary">
                                  {trainee.programPercent}%
                                </span>
                              </div>
                              <div className="w-full bg-neutral-light rounded-full h-1.5 overflow-hidden border border-border/40">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    trainee.isAllCoreCompleted ? 'bg-success' : 'bg-primary'
                                  }`}
                                  style={{ width: `${trainee.programPercent}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Attention Badge */}
                          <td className="p-3.5">
                            <AttentionBadge
                              attention={trainee.worstAttention}
                              isCompleted={trainee.isAllCoreCompleted}
                              testId={`trainee-attention-badge-${trainee.userId}`}
                            />
                          </td>

                          {/* Last Activity */}
                          <td className="p-3.5 text-text-muted whitespace-nowrap">
                            {trainee.lastActivityAt
                              ? formatMaterialDate(trainee.lastActivityAt)
                              : 'لا يوجد'}
                          </td>

                          {/* Action */}
                          <td className="p-3.5 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedTrainee(trainee)}
                              data-testid={`view-trainee-progress-btn-${trainee.userId}`}
                            >
                              عرض التفاصيل
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Courses View ─────────────────────────────────────────── */}
      {activeTab === 'courses' && (
        <div className="space-y-4">
          {metrics.assignedCoursesMetrics.length === 0 ? (
            <div
              className="text-center py-12 bg-surface rounded-xl border border-dashed border-border space-y-2"
              data-testid="empty-courses-state"
            >
              <Icon name="bookOpen" size="lg" className="mx-auto text-text-muted" />
              <p className="text-sm font-semibold text-text-heading">
                لم يتم إسناد أي مقررات تدريبية في هذه الدورة
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {metrics.assignedCoursesMetrics.map((c: AssignedCourseProgressMetric) => {
                const isCore = c.courseRole === 'core';

                return (
                  <Card
                    key={c.courseId}
                    className="p-4 space-y-3"
                    data-testid={`course-progress-card-${c.courseId}`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-text-heading">{c.courseTitle}</h3>
                        <span className="text-[11px] text-text-muted">{c.courseId}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isCore ? (
                          <Badge variant="primary" size="sm">
                            مقرر أساسي
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">
                            مقرر تذكيري
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Effective Dates & Precedence */}
                    <div className="bg-neutral-light/50 p-2.5 rounded-lg border border-border/60 text-[11px] space-y-1">
                      <div className="flex items-center justify-between text-text-muted">
                        <span>تاريخ البدء:</span>
                        <strong className="text-text font-semibold">
                          {formatMaterialDate(c.effective.effectiveStartDateTime)}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-text-muted">
                        <span>الموعد النهائي:</span>
                        <strong className="text-text font-semibold">
                          {formatMaterialDate(c.effective.effectiveDeadlineDateTime)}
                        </strong>
                      </div>
                      {c.effective.hasAnyOverride && (
                        <div className="pt-1 text-[10px] text-primary font-medium border-t border-border/40">
                          * يتضمن تخصيصاً فردياً للمقرر
                        </div>
                      )}
                    </div>

                    {/* Numbers Breakdown */}
                    <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                      <div className="bg-surface p-2 rounded border border-border/50">
                        <span className="text-text-muted block">مسجلين</span>
                        <strong className="text-sm font-bold text-text-heading">
                          {c.enrolledCount ?? 0}
                        </strong>
                      </div>
                      <div className="bg-surface p-2 rounded border border-border/50">
                        <span className="text-text-muted block">بدأوا</span>
                        <strong className="text-sm font-bold text-primary">
                          {c.startedCount ?? 0}
                        </strong>
                      </div>
                      <div className="bg-surface p-2 rounded border border-border/50">
                        <span className="text-text-muted block">أكملوا</span>
                        <strong className="text-sm font-bold text-success">
                          {c.completedCount ?? 0}
                        </strong>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-text-muted">متوسط إنجاز المقرر</span>
                        <span className="font-bold text-primary">
                          {c.averageProgressPercent ?? 0}%
                        </span>
                      </div>
                      <div className="w-full bg-neutral-light rounded-full h-2 overflow-hidden border border-border/40">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-300"
                          style={{ width: `${c.averageProgressPercent ?? 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Overdue alert if applicable */}
                    {(c.overdueCount ?? 0) > 0 && (
                      <div className="text-[11px] text-danger font-semibold flex items-center gap-1">
                        <Icon name="alert" size="sm" className="text-danger" />
                        <span>{c.overdueCount} متدرب لم يكملوا المقرر وتجاوزوا الموعد</span>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Trainee Progress Breakdown Modal */}
      {selectedTrainee && (
        <TraineeProgressModal
          isOpen={!!selectedTrainee}
          onClose={() => setSelectedTrainee(null)}
          trainee={selectedTrainee}
          cycleId={currentCycle?.id || selectedCycleId || 'current'}
          cycleLabel={currentCycle?.title}
          isHistorical={isHistorical}
        />
      )}
    </div>
  );
};

export default GroupMonitoringPage;
