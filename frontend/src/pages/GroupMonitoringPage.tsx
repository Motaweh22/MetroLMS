import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { groupsApi } from '@/features/groups/services/groupsApi';
import type {
  GroupMetrics,
  TraineeGroupMetrics,
  AssignedCourseProgressMetric,
  GroupJoinRequest,
} from '@/core/groups/types';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { Modal } from '@/shared/ui/Modal';
import {
  AttentionBadge,
  TraineeProgressModal,
  ManageGroupAssistantsModal,
} from '@/features/groups/components';
import { formatMaterialDate } from '@/features/groups/utils/materialUtils';

export const GroupMonitoringPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const cycleIdParam = searchParams.get('cycleId') || undefined;
  const tabParam = searchParams.get('tab');
  const [selectedCycleId, setSelectedCycleId] = useState<string | undefined>(cycleIdParam);

  const [metrics, setMetrics] = useState<GroupMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState<boolean>(false);

  // Tab & Filters State
  const [activeTab, setActiveTab] = useState<'trainees' | 'courses' | 'requests'>(
    tabParam === 'requests' ? 'requests' : tabParam === 'courses' ? 'courses' : 'trainees'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTrainee, setSelectedTrainee] = useState<TraineeGroupMetrics | null>(null);
  const [isManageAssistantsOpen, setIsManageAssistantsOpen] = useState<boolean>(false);

  // Enrollment Requests State
  const [requests, setRequests] = useState<GroupJoinRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState<boolean>(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [rejectingRequest, setRejectingRequest] = useState<GroupJoinRequest | null>(null);
  const [rejectNote, setRejectNote] = useState<string>('');
  const [isReviewing, setIsReviewing] = useState<boolean>(false);
  const [requestsFeedback, setRequestsFeedback] = useState<string | null>(null);

  // Sync selectedCycleId when param changes
  useEffect(() => {
    if (cycleIdParam && cycleIdParam !== selectedCycleId) {
      setSelectedCycleId(cycleIdParam);
    }
  }, [cycleIdParam, selectedCycleId]);

  useEffect(() => {
    if (tabParam === 'requests' || tabParam === 'courses' || tabParam === 'trainees') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Load join requests
  const loadRequests = useCallback(async () => {
    if (!groupId) return;
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const data = await groupsApi.getJoinRequests(groupId);
      setRequests(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تحميل طلبات الانضمام للمجموعة.';
      setRequestsError(msg);
    } finally {
      setRequestsLoading(false);
    }
  }, [groupId]);

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
    loadRequests();
  }, [loadData, loadRequests, selectedCycleId]);

  // Authorization check
  const isAuthorized = useMemo(() => {
    if (!user) return false;
    if (
      user.role === 'admin' ||
      user.role === 'super_admin' ||
      user.role === 'developer' ||
      user.role === 'assistant_admin'
    ) return true;
    if (metrics?.group && user.role === 'lecturer') {
      const uid = user.id.toLowerCase();
      return Boolean(
        metrics.group.primaryInstructorId?.toLowerCase() === uid ||
        metrics.group.assistantLecturerIds?.some((id) => id.toLowerCase() === uid) ||
        metrics.group.supervisorIds?.some((id) => id.toLowerCase() === uid)
      );
    }
    return false;
  }, [user, metrics?.group]);

  const canManageAssistants = useMemo(() => {
    if (!user || !metrics?.group) return false;
    if (
      user.role === 'admin' ||
      user.role === 'super_admin' ||
      user.role === 'developer'
    ) return true;
    if (user.role === 'lecturer') {
      const uid = user.id.toLowerCase();
      if (metrics.group.primaryInstructorId !== undefined) {
        return Boolean(
          metrics.group.primaryInstructorId &&
          metrics.group.primaryInstructorId.toLowerCase() === uid
        );
      }
      return Boolean(metrics.group.supervisorIds?.[0]?.toLowerCase() === uid);
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

  const pendingRequestsCount = useMemo(
    () => requests.filter((r) => r.status === 'pending').length,
    [requests]
  );

  const filteredRequests = useMemo(() => {
    if (requestFilter === 'all') return requests;
    return requests.filter((r) => r.status === requestFilter);
  }, [requests, requestFilter]);

  const handleApproveRequest = async (req: GroupJoinRequest) => {
    if (!groupId) return;
    setIsReviewing(true);
    setRequestsError(null);
    try {
      await groupsApi.reviewJoinRequest(groupId, req.id, 'approved');
      await Promise.all([loadData(selectedCycleId), loadRequests()]);
      setRequestsFeedback(
        `تم قبول انضمام «${req.userName}» وتسجيله في المقررات التدريبية بنجاح.`
      );
      setTimeout(() => setRequestsFeedback(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر قبول طلب الانضمام.';
      setRequestsError(msg);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleOpenRejectModal = (req: GroupJoinRequest) => {
    setRejectingRequest(req);
    setRejectNote('');
  };

  const handleConfirmReject = async () => {
    if (!groupId || !rejectingRequest) return;
    setIsReviewing(true);
    setRequestsError(null);
    try {
      await groupsApi.reviewJoinRequest(
        groupId,
        rejectingRequest.id,
        'rejected',
        rejectNote.trim() || undefined
      );
      const rejectedName = rejectingRequest.userName;
      setRejectingRequest(null);
      setRejectNote('');
      await Promise.all([loadData(selectedCycleId), loadRequests()]);
      setRequestsFeedback(`تم رفض طلب انضمام «${rejectedName}».`);
      setTimeout(() => setRequestsFeedback(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر رفض طلب الانضمام.';
      setRequestsError(msg);
    } finally {
      setIsReviewing(false);
    }
  };

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
  const totalEnrolledTrainees = cohort?.totalMembers ?? group.traineeIds.length;
  const isArchived = group.adminStatus === 'archived';
  const isDraft = group.adminStatus === 'draft';
  const lifecycleStatusLabel = isArchived ? 'مؤرشفة' : isDraft ? 'مسودة' : 'نشطة';
  const lifecycleBadgeVariant = isArchived ? 'neutral' : isDraft ? 'warning' : 'success';
  const isEnrollmentCurrentlyOpen = group.isEnrollmentOpen !== false && !isArchived;
  const enrollmentPolicyLabel =
    group.enrollmentPolicy === 'open'
      ? 'انضمام تلقائي'
      : group.enrollmentPolicy === 'approval_required'
        ? 'بموافقة المشرف'
        : 'انضمام مغلق';
  const isAtCapacity = Boolean(group.maxTrainees && totalEnrolledTrainees >= group.maxTrainees);
  const effectiveStartDate = currentCycle?.startDateTime || group.startDateTime;
  const effectiveDeadlineDate = currentCycle?.deadlineDateTime || group.deadlineDateTime;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 max-w-7xl" dir="rtl">
      {/* Compact Group Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
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
              onClick={() => navigate(`/admin/groups/${encodeURIComponent(group.id)}/edit`)}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              {group.name}
            </button>
            <span>/</span>
            <span className="text-text-heading font-medium">متابعة المجموعة</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-text-heading">{group.name}</h1>
            <Badge variant="neutral" size="sm">
              {group.id}
            </Badge>
            <Badge variant={lifecycleBadgeVariant} size="sm">
              {lifecycleStatusLabel}
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
          {canManageAssistants && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsManageAssistantsOpen(true)}
              data-testid="manage-group-assistants-btn"
            >
              <Icon name="user" size="sm" className="ml-1" />
              <span>إدارة المحاضرين المساعدين</span>
            </Button>
          )}
          {(user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'developer') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/admin/groups/${encodeURIComponent(group.id)}/edit`)}
              data-testid="edit-group-settings-btn"
            >
              <Icon name="settings" size="sm" className="ml-1" />
              <span>إعدادات المجموعة</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadData(selectedCycleId);
              loadRequests();
            }}
            data-testid="refresh-monitoring-btn"
            title="تحديث مؤشرات المتابعة"
          >
            <Icon name="refreshCw" size="sm" />
          </Button>
        </div>
      </div>

      {/* Unified Compact Group Summary & Consolidated Schedule Card */}
      <Card
        className="p-3.5 sm:p-4 bg-surface border border-border shadow-xs space-y-3"
        data-testid="group-monitoring-status-overview"
      >
        {/* Top Row: Lifecycle, Enrollment Status & Consolidated Schedule Strip */}
        <div
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-3 border-b border-border/60 text-xs"
          data-testid="group-countdown-strip"
        >
          <div className="flex flex-wrap items-center gap-3">
            {/* Lifecycle Status (distinct from enrollment status) */}
            <div className="flex items-center gap-1.5" data-testid="overview-lifecycle-status">
              <span className="text-text-muted font-medium">حالة المجموعة:</span>
              <Badge variant={lifecycleBadgeVariant} size="sm">
                {lifecycleStatusLabel}
              </Badge>
            </div>

            <span className="text-border hidden sm:inline">|</span>

            {/* Enrollment Status (open vs closed, distinct from lifecycle status) */}
            <div className="flex items-center gap-1.5" data-testid="overview-enrollment-status">
              <span className="text-text-muted font-medium">التسجيل:</span>
              <Badge variant={isEnrollmentCurrentlyOpen ? 'success' : 'neutral'} size="sm">
                {isEnrollmentCurrentlyOpen ? 'التسجيل مفتوح' : 'التسجيل مغلق'}
              </Badge>
              <span className="text-[11px] text-text-muted">({enrollmentPolicyLabel})</span>
            </div>
          </div>

          {/* Consolidated Schedule & Deadline Summary */}
          <div
            className="flex flex-wrap items-center gap-3 bg-bg px-3 py-1.5 rounded-lg border border-border/60"
            data-testid="overview-schedule-summary"
          >
            <div className="flex items-center gap-1">
              <Icon name="calendar" size="sm" className="text-primary" />
              <span className="text-text-muted">البدء:</span>
              <strong className="text-text-heading font-semibold">
                {formatMaterialDate(effectiveStartDate)}
              </strong>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1">
              <Icon name="clock" size="sm" className="text-danger" />
              <span className="text-text-muted">الموعد النهائي:</span>
              <strong className="text-text-heading font-semibold">
                {formatMaterialDate(effectiveDeadlineDate)}
              </strong>
            </div>
            <Badge
              variant={
                metrics.status === 'expired'
                  ? 'danger'
                  : metrics.status === 'scheduled'
                    ? 'neutral'
                    : 'primary'
              }
              size="sm"
              data-testid="temporal-status-badge"
            >
              {metrics.timeRemainingText || metrics.statusLabelAr}
            </Badge>
          </div>
        </div>

        {/* Bottom Row: Compact Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          {/* 1. Enrolled Trainees & Capacity */}
          <div
            className="p-2.5 rounded-lg bg-bg border border-border/60 space-y-0.5"
            data-testid="cohort-metric-total-members"
          >
            <span className="text-[11px] text-text-muted block">المتدربون المسجلون</span>
            <div className="text-base font-bold text-text-heading">
              {totalEnrolledTrainees}
              {group.maxTrainees ? (
                <span className="text-xs font-normal text-text-muted"> / {group.maxTrainees}</span>
              ) : null}
            </div>
            <span
              className="text-[10px] text-text-muted block"
              data-testid="overview-capacity-requests"
            >
              {group.maxTrainees ? `الحد الأقصى: ${group.maxTrainees}` : 'السعة: مفتوحة'}
            </span>
          </div>

          {/* 2. Pending Enrollment Requests */}
          <div className="p-2.5 rounded-lg bg-bg border border-border/60 space-y-0.5">
            <span className="text-[11px] text-text-muted block">طلبات الانضمام المعلقة</span>
            <div
              className={`text-base font-bold ${pendingRequestsCount > 0 ? 'text-warning-dark' : 'text-text-heading'
                }`}
              data-testid="overview-pending-requests-count"
            >
              {pendingRequestsCount}
            </div>
            <span className="text-[10px] text-text-muted block">
              {pendingRequestsCount > 0 ? 'بانتظار مراجعة المشرف' : 'لا توجد طلبات معلقة'}
            </span>
          </div>

          {/* 3. Assigned Courses */}
          <div
            className="p-2.5 rounded-lg bg-bg border border-border/60 space-y-0.5"
            data-testid="cohort-metric-assigned-courses"
          >
            <span className="text-[11px] text-text-muted block">المقررات المعتمدة</span>
            <div className="text-base font-bold text-text-heading">
              {cohort?.totalCourses ?? 0}
            </div>
            <span className="text-[10px] text-text-muted block">
              {cohort?.coreCoursesCount ?? 0} أساسي • {cohort?.reminderCoursesCount ?? 0} تذكيري
            </span>
          </div>

          {/* 4. Trainees Started */}
          <div
            className="p-2.5 rounded-lg bg-bg border border-border/60 space-y-0.5"
            data-testid="cohort-metric-started-trainees"
          >
            <span className="text-[11px] text-text-muted block">بدأوا التدريب</span>
            <div className="text-base font-bold text-text-heading">
              {cohort?.traineesStarted ?? 0} / {totalEnrolledTrainees}
            </div>
            <span className="text-[10px] text-text-muted block">
              {totalEnrolledTrainees
                ? `${Math.round(((cohort?.traineesStarted ?? 0) / totalEnrolledTrainees) * 100)}% من المسجلين`
                : '0%'}
            </span>
          </div>

          {/* 5. Completed Core & Attempts */}
          <div
            className="p-2.5 rounded-lg bg-bg border border-border/60 space-y-0.5"
            data-testid="cohort-metric-completed-core"
          >
            <span className="text-[11px] text-text-muted block">أتموا الأساسي</span>
            <div className="text-base font-bold text-success">
              {cohort?.traineesCompletedAllCore ?? 0} / {totalEnrolledTrainees}
            </div>
            <span
              className="text-[10px] text-text-muted block"
              data-testid="cohort-metric-attempts"
            >
              {cohort?.completedAttempts ?? 0} محاولة منجزة
            </span>
          </div>

          {/* 6. Average Progress */}
          <div
            className="p-2.5 rounded-lg bg-bg border border-border/60 space-y-0.5"
            data-testid="cohort-metric-avg-progress"
          >
            <span className="text-[11px] text-text-muted block">متوسط الإنجاز</span>
            <div className="text-base font-bold text-primary">
              {cohort?.averageProgressPercent ?? 0}%
            </div>
            <span className="text-[10px] text-text-muted block">تقدم المتدربين العام</span>
          </div>
        </div>
      </Card>

      {/* Cohort Attention Alerts (if any) */}
      {cohort && (cohort.warningAlertsCount > 0 || cohort.dangerAlertsCount > 0) && (
        <div
          className="bg-warning/10 border border-warning/30 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
          data-testid="cohort-metric-attention"
        >
          <div className="flex items-center gap-2">
            <Icon name="alert" size="sm" className="text-warning-dark shrink-0" />
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
      <div className="border-b border-border flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('trainees')}
          className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${activeTab === 'trainees'
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
          className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${activeTab === 'courses'
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

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${activeTab === 'requests'
            ? 'border-primary text-primary'
            : 'border-transparent text-text-muted hover:text-text-heading'
            }`}
          data-testid="tab-join-requests-view"
        >
          <Icon name="checkCircle" size="sm" />
          <span>طلبات الانضمام</span>
          <Badge variant={pendingRequestsCount > 0 ? 'warning' : 'neutral'} size="sm">
            {pendingRequestsCount > 0 ? `${pendingRequestsCount} معلق` : requests.length}
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
                                  className={`h-full rounded-full transition-all duration-300 ${trainee.isAllCoreCompleted ? 'bg-success' : 'bg-primary'
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

      {/* ── Tab 3: Join Requests View ───────────────────────────────────── */}
      {activeTab === 'requests' && (
        <div className="space-y-4" data-testid="join-requests-view">
          {/* Feedback Banner */}
          {requestsFeedback && (
            <div data-testid="requests-feedback-banner">
              <Alert variant="success" title="تم تحديث طلبات الانضمام">
                {requestsFeedback}
              </Alert>
            </div>
          )}

          {/* Archived or Capacity Warning */}
          {isArchived && (
            <Alert variant="warning" icon="archive">
              هذه المجموعة مؤرشفة حالياً؛ لا يمكن قبول طلبات انضمام جديدة فيها.
            </Alert>
          )}
          {!isArchived && isAtCapacity && (
            <Alert variant="warning" icon="alert">
              وصلت المجموعة للحد الأقصى للسعة الاستيعابية ({group.maxTrainees} متدرب). لا يمكن قبول
              طلبات إضافية قبل زيادة الحد الأقصى للسعة أو إخلاء مقعد.
            </Alert>
          )}

          {/* Requests Status Filter Pills & Refresh */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 bg-surface p-1 rounded-xl border border-border">
              {(
                [
                  { key: 'all', label: `الكل (${requests.length})` },
                  { key: 'pending', label: `بانتظار المراجعة (${pendingRequestsCount})` },
                  {
                    key: 'approved',
                    label: `المقبولة (${requests.filter((r) => r.status === 'approved').length})`,
                  },
                  {
                    key: 'rejected',
                    label: `المرفوضة (${requests.filter((r) => r.status === 'rejected').length})`,
                  },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRequestFilter(key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${requestFilter === key
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-text-muted hover:text-text'
                    }`}
                  data-testid={`request-filter-${key}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadRequests}
              disabled={requestsLoading}
              className="flex items-center gap-1.5 shrink-0"
              data-testid="refresh-requests-btn"
            >
              <Icon name="refreshCw" size="sm" className={requestsLoading ? 'animate-spin' : ''} />
              <span>تحديث الطلبات</span>
            </Button>
          </div>

          {/* Requests Error Banner */}
          {requestsError && (
            <div data-testid="requests-load-error">
              <Alert variant="danger" title="خطأ في معالجة طلبات الانضمام">
                {requestsError}
              </Alert>
            </div>
          )}

          {/* Requests List */}
          {requestsLoading ? (
            <div className="bg-surface rounded-2xl p-12 border border-border flex flex-col items-center justify-center space-y-3">
              <Icon name="clock" size="lg" className="animate-spin text-primary" />
              <p className="text-xs text-text-muted">جارٍ تحميل طلبات الانضمام...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div
              className="bg-surface rounded-2xl p-12 border border-border text-center space-y-3"
              data-testid="no-requests-state"
            >
              <Icon name="checkCircle" size="lg" className="mx-auto text-success/60" />
              <h4 className="text-sm font-bold text-text">
                {requestFilter === 'pending'
                  ? 'لا توجد طلبات انضمام معلقة حالياً'
                  : 'لا توجد طلبات انضمام مطابقة للفلتر المحدد'}
              </h4>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                عند قيام المتدربين بمسح رمز الاستجابة السريعة لمجموعة تتطلب الموافقة، ستظهر طلباتهم
                هنا للمراجعة والاعتماد.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-surface rounded-xl p-4 border border-border shadow-xs hover:border-primary/40 transition-colors space-y-3"
                  data-testid={`request-card-${req.id}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                        {req.userName.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-text">{req.userName}</h4>
                          <span className="text-[11px] font-mono text-primary font-normal">
                            {req.userId}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-muted flex flex-wrap items-center gap-2 mt-0.5">
                          <span>{req.userEmail}</span>
                          {req.jobTitle && (
                            <>
                              <span>•</span>
                              <span>{req.jobTitle}</span>
                            </>
                          )}
                          {req.department && (
                            <>
                              <span>•</span>
                              <span>{req.department}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <Badge
                        variant={
                          req.status === 'pending'
                            ? 'warning'
                            : req.status === 'approved'
                              ? 'success'
                              : 'neutral'
                        }
                        size="sm"
                        data-testid={`request-status-badge-${req.id}`}
                      >
                        {req.status === 'pending'
                          ? 'بانتظار المراجعة'
                          : req.status === 'approved'
                            ? 'تم القبول'
                            : 'مرفوض'}
                      </Badge>
                      <span className="text-[11px] text-text-muted">
                        {formatMaterialDate(req.requestedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Applicant Note / Review Note if available */}
                  {req.reviewNote || (req as unknown as { note?: string }).note ? (
                    <div className="bg-bg rounded-lg p-2.5 border border-border/60 text-xs text-text-muted flex items-start gap-2">
                      <Icon name="info" size="sm" className="text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-text">
                          {req.status === 'rejected' ? 'ملاحظة المراجعة / الرفض: ' : 'ملاحظة مقدم الطلب: '}
                        </span>
                        <span>{(req as unknown as { note?: string }).note || req.reviewNote}</span>
                      </div>
                    </div>
                  ) : null}

                  {/* Review Audit Details if already processed */}
                  {req.status !== 'pending' && req.reviewedAt && (
                    <div className="text-[11px] text-text-muted bg-neutral-light/50 px-3 py-1.5 rounded-lg border border-border/40 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        تمت المراجعة بواسطة:{' '}
                        <strong className="text-text">{req.reviewedByName || 'مشرف النظام'}</strong>
                      </span>
                      <span>تاريخ المراجعة: {formatMaterialDate(req.reviewedAt)}</span>
                    </div>
                  )}

                  {/* Action Buttons for Pending Requests */}
                  {req.status === 'pending' && (
                    <div className="pt-2 border-t border-border/60 flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenRejectModal(req)}
                        disabled={isReviewing}
                        className="text-danger hover:bg-danger/10 border-danger/30 text-xs"
                        data-testid={`reject-request-btn-${req.id}`}
                      >
                        <Icon name="xCircle" size="sm" />
                        <span>رفض الطلب</span>
                      </Button>

                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleApproveRequest(req)}
                        disabled={isReviewing || isArchived}
                        className="text-xs"
                        data-testid={`approve-request-btn-${req.id}`}
                      >
                        <Icon name="checkCircle" size="sm" />
                        <span>قبول الطلب والتسجيل بالمقررات</span>
                      </Button>
                    </div>
                  )}
                </div>
              ))}
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

      {/* Manage Group Assistants Modal (Primary Instructor or Admin) */}
      {canManageAssistants && (
        <ManageGroupAssistantsModal
          isOpen={isManageAssistantsOpen}
          onClose={() => setIsManageAssistantsOpen(false)}
          group={group}
          onAssistantsUpdated={(updatedGroup) => {
            setMetrics((prev) => (prev ? { ...prev, group: updatedGroup } : prev));
          }}
        />
      )}

      {/* Join Request Rejection Modal with Note */}
      <Modal
        isOpen={Boolean(rejectingRequest)}
        onClose={() => setRejectingRequest(null)}
        title="رفض طلب الانضمام"
        size="md"
        dataTestId="reject-request-modal"
      >
        <div className="space-y-4" dir="rtl">
          <p className="text-xs text-text-muted">
            هل أنت متأكد من رفض طلب الانضمام المقدم من{' '}
            <strong className="text-text">{rejectingRequest?.userName}</strong>؟ يمكنك إرفاق سبب أو
            ملاحظة توضيحية.
          </p>

          <div>
            <label className="block text-xs font-bold text-text mb-1">
              سبب الرفض أو ملاحظة المشرف (اختياري):
            </label>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="مثال: المجموعة مخصصة لقطاع الصيانة فقط، أو اكتمل العدد في هذا المسار..."
              rows={3}
              className="w-full text-xs p-3 rounded-xl bg-surface border border-border text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
              data-testid="reject-note-input"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectingRequest(null)}
              disabled={isReviewing}
            >
              إلغاء
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmReject}
              isLoading={isReviewing}
              className="bg-danger hover:bg-danger-dark border-danger text-white"
              data-testid="confirm-reject-request-btn"
            >
              تأكيد رفض الطلب
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default GroupMonitoringPage;
