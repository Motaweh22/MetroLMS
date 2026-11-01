import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { groupsApi } from '@/features/groups/services/groupsApi';
import type { GroupSummaryDTO } from '@/core/groups/dtos';
import type { GroupAdminStatus, GroupEnrollmentPolicy, GroupStatus } from '@/core/groups/types';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge, type BadgeVariant } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { useToast } from '@/shared/ui/Toast';
import { ManageGroupAssistantsModal } from '@/features/groups/components';

/**
 * Format timestamp in Arabic or return a fallback
 */
function formatDateAr(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) return 'غير محدد';
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

/**
 * Resolve status badge configuration
 */
function getStatusBadgeConfig(timeStatus: GroupStatus, adminStatus: GroupAdminStatus): {
  label: string;
  variant: BadgeVariant;
} {
  if (adminStatus === 'archived') {
    return { label: 'مؤرشفة', variant: 'neutral' };
  }
  if (adminStatus === 'draft') {
    return { label: 'مسودة', variant: 'warning' };
  }
  switch (timeStatus) {
    case 'active':
      return { label: 'نشطة', variant: 'primary' };
    case 'scheduled':
      return { label: 'مجدولة', variant: 'warning' };
    case 'expired':
      return { label: 'منتهية', variant: 'neutral' };
    default:
      return { label: 'نشطة', variant: 'primary' };
  }
}

/**
 * Resolve policy label
 */
function getPolicyLabel(policy: GroupEnrollmentPolicy): string {
  switch (policy) {
    case 'open':
      return 'انضمام تلقائي';
    case 'approval_required':
      return 'موافقة المشرف';
    case 'closed':
      return 'انضمام مغلق';
    default:
      return policy;
  }
}

export const AdminGroupsPage: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [groups, setGroups] = useState<GroupSummaryDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [policyFilter, setPolicyFilter] = useState<string>('all');

  // Archive modal state
  const [archiveTarget, setArchiveTarget] = useState<GroupSummaryDTO | null>(null);
  const [isArchiving, setIsArchiving] = useState<boolean>(false);
  const [manageAssistantsGroup, setManageAssistantsGroup] = useState<GroupSummaryDTO | null>(null);

  const isAdministrativeViewer =
    user?.role === 'admin' ||
    user?.role === 'super_admin' ||
    user?.role === 'developer' ||
    user?.role === 'assistant_admin';
  const isOperationalAdmin =
    user?.role === 'admin' ||
    user?.role === 'super_admin' ||
    user?.role === 'developer';
  const isSupervisor = user?.role === 'lecturer';
  const isAuthorized = isAdministrativeViewer || isSupervisor;

  // Load group summaries
  const loadGroups = useCallback(async () => {
    if (!isAuthenticated || !isAuthorized) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await groupsApi.getAdminGroups();
      setGroups(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'تعذر تحميل بيانات المجموعات التدريبية';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isAuthorized]);

  useEffect(() => {
    if (!authLoading) {
      loadGroups();
    }
  }, [authLoading, loadGroups]);

  // Handle Archive Confirmation
  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;

    setIsArchiving(true);
    try {
      const result = await groupsApi.deleteGroup(archiveTarget.id);
      toast.success(result.message || 'تمت أرشفة المجموعة التدريبية بنجاح');
      setArchiveTarget(null);
      // Reload list to reflect updated status
      await loadGroups();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'تعذر تنفيذ عملية الأرشفة';
      toast.error(message);
    } finally {
      setIsArchiving(false);
    }
  };

  // Filtered groups
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'archived' && g.adminStatus !== 'archived') return false;
        if (statusFilter === 'draft' && g.adminStatus !== 'draft') return false;
        if (statusFilter === 'active' && (g.adminStatus !== 'active' || g.timeStatus !== 'active'))
          return false;
        if (statusFilter === 'scheduled' && g.timeStatus !== 'scheduled') return false;
        if (statusFilter === 'expired' && g.timeStatus !== 'expired') return false;
      }

      // Policy filter
      if (policyFilter !== 'all' && g.enrollmentPolicy !== policyFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = g.name.toLowerCase().includes(q);
        const matchId = g.id.toLowerCase().includes(q);
        const matchDesc = g.description.toLowerCase().includes(q);
        return matchName || matchId || matchDesc;
      }

      return true;
    });
  }, [groups, statusFilter, policyFilter, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = groups.length;
    const active = groups.filter(
      (g) => g.adminStatus === 'active' && g.timeStatus === 'active'
    ).length;
    const totalTrainees = groups.reduce((sum, g) => sum + g.totalTraineesCount, 0);
    const attention = groups.reduce((sum, g) => sum + g.attentionTraineesCount, 0);
    return { total, active, totalTrainees, attention };
  }, [groups]);

  // Loading state
  if (authLoading || (loading && groups.length === 0)) {
    return (
      <div
        className="container mx-auto px-4 py-12 max-w-7xl"
        data-testid="admin-groups-loading"
        dir="rtl"
      >
        <div className="flex flex-col items-center justify-center p-12 bg-surface rounded-xl border border-border">
          <Icon name="clock" size="lg" className="animate-spin text-primary mb-4" />
          <p className="text-text-muted text-base font-medium">
            جارٍ تحميل لوحة المجموعات التدريبية...
          </p>
        </div>
      </div>
    );
  }

  // Unauthorized state
  if (!isAuthenticated || !isAuthorized) {
    return (
      <div
        className="container mx-auto px-4 py-12 max-w-3xl"
        data-testid="admin-groups-unauthorized"
        dir="rtl"
      >
        <Alert variant="warning" title="غير مصرح بالوصول">
          <p className="text-sm mb-4">
            هذه الصفحة مخصصة لمديري النظام ومشرفي التدريب لإدارة ومتابعة المجموعات التدريبية.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
            العودة إلى لوحة المتابعة
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div
      className="container mx-auto px-4 py-8 max-w-7xl space-y-6"
      data-testid="admin-groups-page"
      dir="rtl"
    >
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
            <span>الإدارة والتشغيل</span>
            <span>/</span>
            <span className="text-primary font-medium">المجموعات التدريبية</span>
          </div>
          <h1 className="text-2xl font-bold text-text-heading flex items-center gap-2">
            <Icon name="trainingGroups" size="lg" className="text-primary" />
            <span>إدارة المجموعات التدريبية</span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            استعراض ومتابعة الدفعات التدريبية وتكوين إعدادات المجموعات
          </p>
        </div>

        {isOperationalAdmin && (
          <Button
            variant="primary"
            size="md"
            leftIcon="plus"
            onClick={() => navigate('/admin/groups/new')}
            data-testid="create-group-btn"
          >
            إنشاء مجموعة تدريبية جديدة
          </Button>
        )}
      </div>

      {/* Global Error Banner */}
      {error && (
        <div data-testid="admin-groups-error">
          <Alert variant="danger" title="تعذر تحميل المجموعات">
            <p className="text-sm mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={loadGroups}>
              إعادة المحاولة
            </Button>
          </Alert>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-surface border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Icon name="trainingGroups" size="md" />
            </div>
            <div>
              <div className="text-xs text-text-muted">إجمالي المجموعات</div>
              <div className="text-xl font-bold text-text-heading">{stats.total}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-info/10 text-info flex items-center justify-center font-bold">
              <Icon name="clock" size="md" />
            </div>
            <div>
              <div className="text-xs text-text-muted">دفعات نشطة</div>
              <div className="text-xl font-bold text-text-heading">{stats.active}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-dark/10 text-primary-dark flex items-center justify-center font-bold">
              <Icon name="user" size="md" />
            </div>
            <div>
              <div className="text-xs text-text-muted">إجمالي المتدربين</div>
              <div className="text-xl font-bold text-text-heading">{stats.totalTrainees}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning/10 text-warning-dark flex items-center justify-center font-bold">
              <Icon name="alertCircle" size="md" />
            </div>
            <div>
              <div className="text-xs text-text-muted">تنبيهات المتابعة</div>
              <div className="text-xl font-bold text-text-heading">{stats.attention}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filters Bar */}
      <Card className="p-4 bg-surface border border-border space-y-4">
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
              placeholder="بحث باسم المجموعة أو المعرف..."
              className="w-full ps-9 pe-4 py-2 text-sm bg-bg border border-border rounded-xl text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              data-testid="admin-groups-search"
            />
          </div>

          {/* Enrollment Policy Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="policy-filter" className="text-xs text-text-muted font-medium whitespace-nowrap">
              السياسة:
            </label>
            <select
              id="policy-filter"
              value={policyFilter}
              onChange={(e) => setPolicyFilter(e.target.value)}
              className="text-xs bg-bg border border-border rounded-xl px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              data-testid="policy-filter-select"
            >
              <option value="all">كافة سياسات الانضمام</option>
              <option value="open">انضمام تلقائي (مفتوح)</option>
              <option value="approval_required">موافقة المشرف مطلوبة</option>
              <option value="closed">انضمام مغلق / تعيين مباشر</option>
            </select>
          </div>
        </div>

        {/* Lifecycle Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-border/60">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'active', label: 'نشطة' },
            { id: 'scheduled', label: 'مجدولة' },
            { id: 'expired', label: 'منتهية' },
            { id: 'draft', label: 'مسودة' },
            { id: 'archived', label: 'مؤرشفة' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-bg text-text-muted hover:bg-neutral-light hover:text-text'
              }`}
              data-testid={`status-filter-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Groups Table / List */}
      {filteredGroups.length === 0 ? (
        <Card
          className="p-12 text-center bg-surface border border-border"
          data-testid="admin-groups-empty"
        >
          <div className="w-16 h-16 rounded-full bg-neutral-light flex items-center justify-center mx-auto mb-4 text-text-muted">
            <Icon name="trainingGroups" size="lg" />
          </div>
          <h3 className="text-base font-bold text-text-heading mb-1">
            لم يتم العثور على مجموعات تدريبية
          </h3>
          <p className="text-xs text-text-muted max-w-md mx-auto mb-4">
            {searchQuery || statusFilter !== 'all' || policyFilter !== 'all'
              ? 'لا توجد نتائج مطابقة لمعايير البحث والتصفية المحددة. جرب تغيير خيارات التصفية.'
              : 'لم يتم إنشاء أي مجموعات تدريبية بعد. يمكنك البدء بإنشاء المجموعة الأولى الآن.'}
          </p>
          {isOperationalAdmin && (
            <Button
              variant="outline"
              size="sm"
              leftIcon="plus"
              onClick={() => navigate('/admin/groups/new')}
            >
              إنشاء مجموعة جديدة
            </Button>
          )}
        </Card>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right" data-testid="admin-groups-table">
              <thead className="bg-bg text-text-muted text-[11px] font-bold border-b border-border">
                <tr>
                  <th className="py-3.5 px-4">المجموعة التدريبية</th>
                  <th className="py-3.5 px-3">الحالة</th>
                  <th className="py-3.5 px-3">دورة التجديد</th>
                  <th className="py-3.5 px-3">المتدربون</th>
                  <th className="py-3.5 px-3">المقررات</th>
                  <th className="py-3.5 px-3">المهلة الزمنية</th>
                  <th className="py-3.5 px-3">متوسط الإنجاز</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filteredGroups.map((g) => {
                  const statusBadge = getStatusBadgeConfig(g.timeStatus, g.adminStatus);
                  const isArchived = g.adminStatus === 'archived';

                  return (
                    <tr
                      key={g.id}
                      className="hover:bg-bg/50 transition-colors"
                      data-testid={`group-row-${g.id}`}
                    >
                      {/* Name & ID */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-text-heading text-sm line-clamp-1">
                          {g.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-mono bg-bg px-1.5 py-0.5 rounded text-text-muted border border-border">
                            {g.id}
                          </span>
                          <span className="text-[11px] text-text-muted/80">
                            {getPolicyLabel(g.enrollmentPolicy)}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <Badge variant={statusBadge.variant} size="sm">
                          {statusBadge.label}
                        </Badge>
                      </td>

                      {/* Current Cycle */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {g.currentCycleNumber ? (
                          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                            الدورة {g.currentCycleNumber}
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </td>

                      {/* Trainees count */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="text-xs font-semibold text-text">
                          {g.totalTraineesCount}
                          {g.totalTraineesCount > 0 && (
                            <span className="text-text-muted font-normal text-[11px] ms-1">
                              متدرب
                            </span>
                          )}
                        </div>
                        {g.attentionTraineesCount > 0 && (
                          <div className="text-[10px] text-warning-dark font-medium mt-0.5">
                            {g.attentionTraineesCount} بحاجة لمتابعة
                          </div>
                        )}
                        {(g.pendingJoinRequestsCount ?? 0) > 0 && (
                          <div className="text-[10px] text-primary font-semibold mt-0.5">
                            {g.pendingJoinRequestsCount} طلب انضمام معلق
                          </div>
                        )}
                      </td>

                      {/* Courses count */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-xs text-text font-medium">
                        {g.totalCoursesCount} مقرر
                      </td>

                      {/* Dates */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-xs text-text-muted">
                        <div>إلى {formatDateAr(g.deadlineDateTime)}</div>
                        <div className="text-[10px] text-text-muted/80">{g.timeRemainingText}</div>
                      </td>

                      {/* Average Progress */}
                      <td className="py-3.5 px-3 min-w-[120px]">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-text-muted text-[10px]">التقدم</span>
                          <span className="font-bold text-text-heading">
                            {g.averageProgressPercent}%
                          </span>
                        </div>
                        <ProgressBar value={g.averageProgressPercent} size="sm" />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon="activity"
                            onClick={() => navigate(`/admin/groups/${encodeURIComponent(g.id)}/monitoring`)}
                            data-testid={`monitor-group-btn-${g.id}`}
                            title="متابعة المجموعة"
                          >
                            متابعة المجموعة
                          </Button>

                          {(isOperationalAdmin ||
                            Boolean(
                              isSupervisor &&
                                user &&
                                g.primaryInstructorId &&
                                g.primaryInstructorId.toLowerCase() === user.id.toLowerCase()
                            )) && (
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon="user"
                              onClick={() => setManageAssistantsGroup(g)}
                              data-testid={`manage-assistants-btn-${g.id}`}
                              title="إدارة المحاضرين المساعدين"
                            >
                              إدارة المحاضرين المساعدين
                            </Button>
                          )}

                          {isOperationalAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon="edit"
                              onClick={() => navigate(`/admin/groups/${encodeURIComponent(g.id)}/edit`)}
                              data-testid={`edit-group-btn-${g.id}`}
                              title="تعديل إعدادات المجموعة"
                            >
                              تعديل
                            </Button>
                          )}

                          {isOperationalAdmin && !isArchived && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-text-muted hover:text-danger hover:bg-danger/10 p-1.5"
                              onClick={() => setArchiveTarget(g)}
                              data-testid={`archive-group-btn-${g.id}`}
                              aria-label={`أرشفة المجموعة ${g.name}`}
                              title="أرشفة المجموعة"
                            >
                              <Icon name="archive" size="md" />
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
      )}

      {/* Safe Archive Confirmation Modal */}
      {archiveTarget && (
        <ConfirmDialog
          isOpen={Boolean(archiveTarget)}
          title="تأكيد أرشفة المجموعة التدريبية"
          variant="warning"
          isConfirming={isArchiving}
          confirmLabel="تأكيد الأرشفة"
          cancelLabel="إلغاء"
          onConfirm={handleConfirmArchive}
          onCancel={() => setArchiveTarget(null)}
          testId="archive-confirm-dialog"
          confirmTestId="confirm-archive-btn"
          cancelTestId="cancel-archive-btn"
          message={
            <div className="space-y-2">
              <p>
                هل أنت متأكد من رغبتك في أرشفة المجموعة التدريبية{' '}
                <strong className="text-text-heading font-bold">
                  «{archiveTarget.name}»
                </strong>
                ؟
              </p>
              <div className="p-3 bg-neutral-light rounded-lg text-[11px] text-text-muted space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-text">
                  <Icon name="shield" size="sm" className="text-primary" />
                  <span>ضمانات حماية البيانات التاريخية:</span>
                </div>
                <p>
                  • لن يتم حذف سجلات أو محاولات أو إكمالات المتدربين السابقة وستظل محفوظة بالكامل في
                  سجل الاعتماد.
                </p>
                <p>• سيتم إغلاق رمز الاستجابة السريعة فوراً ومنع تسجيل متدربين جدد.</p>
                <p>• ستنتقل المجموعة إلى تبويب «مؤرشفة» مع استمرار إمكانية الاطلاع والتدقيق.</p>
              </div>
            </div>
          }
        />
      )}

      {/* Manage Group Assistants Modal (Primary Instructor or Admin) */}
      {manageAssistantsGroup && (
        <ManageGroupAssistantsModal
          isOpen={Boolean(manageAssistantsGroup)}
          onClose={() => setManageAssistantsGroup(null)}
          group={{
            ...manageAssistantsGroup,
            supervisorIds: [
              ...(manageAssistantsGroup.primaryInstructorId
                ? [manageAssistantsGroup.primaryInstructorId]
                : []),
              ...(manageAssistantsGroup.assistantLecturerIds || []),
            ],
          }}
          onAssistantsUpdated={() => {
            loadGroups();
          }}
        />
      )}
    </div>
  );
};

export default AdminGroupsPage;
