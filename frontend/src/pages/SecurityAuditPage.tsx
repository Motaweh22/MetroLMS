import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import type {
  SystemAuditLogEntryDTO,
  AuditEventOutcome,
  AuditEventSeverity,
  AuditFilterParams,
} from '@/core/permissions/types';
import { ROLE_CANONICAL_LABELS_AR } from '@/core/permissions/types';
import { auditApi } from '@/features/permissions/services/auditApi';

export const SecurityAuditPage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data & Pagination
  const [entries, setEntries] = useState<SystemAuditLogEntryDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOutcome, setSelectedOutcome] = useState<AuditEventOutcome | 'all'>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<AuditEventSeverity | 'all'>('all');
  const [selectedActionCategory, setSelectedActionCategory] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected entry for modal view
  const [selectedEntry, setSelectedEntry] = useState<SystemAuditLogEntryDTO | null>(null);

  // Expanded inline row IDs
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  const toggleRowExpanded = (id: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const loadAuditLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filterParams: AuditFilterParams = {
        page,
        pageSize,
        search: searchTerm.trim() || undefined,
        outcome: selectedOutcome,
        severity: selectedSeverity,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };

      if (selectedActionCategory !== 'all') {
        filterParams.action = selectedActionCategory;
      }

      const res = await auditApi.getAuditLogs(filterParams);
      setEntries(res.entries);
      setTotal(res.total);
      setTotalPages(res.totalPages || 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تحميل سجل الرقابة الأمنية';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, searchTerm, selectedOutcome, selectedSeverity, selectedActionCategory, startDate, endDate, toast]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  // Reset page to 1 when filters change
  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setPage(1);
  };

  const handleOutcomeChange = (outcome: AuditEventOutcome | 'all') => {
    setSelectedOutcome(outcome);
    setPage(1);
  };

  const handleSeverityChange = (severity: AuditEventSeverity | 'all') => {
    setSelectedSeverity(severity);
    setPage(1);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedActionCategory(category);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedOutcome('all');
    setSelectedSeverity('all');
    setSelectedActionCategory('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleExportJson = () => {
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        exportedBy: user?.name || user?.id || 'admin',
        totalRecords: entries.length,
        filterApplied: {
          search: searchTerm,
          outcome: selectedOutcome,
          severity: selectedSeverity,
          category: selectedActionCategory,
        },
        records: entries,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `metro-security-audit-trail-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('تم تصدير سجل الرقابة الأمنية بنجاح.');
    } catch {
      toast.error('فشل تصدير سجل الرقابة الأمنية.');
    }
  };

  // Sovereign Administrator Authorization Check
  if (!user || user.role !== 'admin') {
    return (
      <div className="container mx-auto p-6 max-w-4xl text-right" data-testid="unauthorized-audit-view">
        <Alert
          variant="danger"
          title="غير مصرح: سياسة السيادة الإدارية"
          message="استعراض سجل الرقابة والأمان مخصص لمدير النظام الرئيسي فقط. لا يمكن للمساعدين الإداريين أو المحاضرين أو المتدربين الوصول إلى هذه البيانات بموجب محددات الحوكمة الأساسية."
        />
      </div>
    );
  }

  // Quick stats derived from loaded sample
  const successfulCount = entries.filter((e) => e.outcome === 'success').length;
  const deniedCount = entries.filter((e) => e.outcome === 'denied').length;
  const pendingCount = entries.filter((e) => e.outcome === 'pending_approval').length;
  const criticalCount = entries.filter((e) => e.severity === 'critical').length;

  const renderOutcomeBadge = (outcome: AuditEventOutcome) => {
    switch (outcome) {
      case 'success':
        return (
          <Badge variant="success" size="sm" icon="check">
            ناجحة
          </Badge>
        );
      case 'denied':
        return (
          <Badge variant="danger" size="sm" icon="lock">
            محظورة أمنياً
          </Badge>
        );
      case 'pending_approval':
        return (
          <Badge variant="warning" size="sm" icon="pending">
            بانتظار الاعتماد
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="danger" size="sm" icon="close">
            مرفوضة
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="danger" size="sm" icon="alert">
            فشل التنفيذ
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" size="sm">
            {outcome}
          </Badge>
        );
    }
  };

  const renderSeverityBadge = (severity: AuditEventSeverity) => {
    switch (severity) {
      case 'critical':
        return (
          <Badge variant="danger" size="sm" dot>
            حرج
          </Badge>
        );
      case 'warning':
        return (
          <Badge variant="warning" size="sm" dot>
            تحذير
          </Badge>
        );
      case 'info':
      default:
        return (
          <Badge variant="info" size="sm" dot>
            معلومات
          </Badge>
        );
    }
  };

  return (
    <div
      role="main"
      data-testid="security-audit-page"
      className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl space-y-6 text-right"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-text flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary-dark flex items-center justify-center shrink-0">
                <Icon name="shield" size="lg" />
              </span>
              سجل الرقابة والأمان للمنظومة
            </h1>
            <Badge variant="primary" size="sm">
              قراءة فقط (غير قابل للتعديل)
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-muted">
            سجل تدقيق مركزي يوثق كافة العمليات الإدارية الحساسة، التغييرات في الأدوار والصلاحيات، وقرارات الحوكمة والاعتماد
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportJson}
            data-testid="audit-export-btn"
            disabled={isLoading || entries.length === 0}
          >
            <Icon name="download" size="sm" className="ml-1.5" />
            تصدير السجل (JSON)
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadAuditLogs}
            isLoading={isLoading}
            data-testid="audit-refresh-btn"
          >
            <Icon name="rotateCcw" size="sm" className="ml-1.5" />
            تحديث
          </Button>
        </div>
      </div>

      {/* In-Memory Persistence Limitation Disclaimer Banner */}
      <div className="bg-info-light/40 border border-info-dark/20 rounded-2xl p-4 flex items-start gap-3 text-xs sm:text-sm text-info-dark">
        <span className="shrink-0 mt-0.5">
          <Icon name="info" size="md" />
        </span>
        <div className="space-y-1 leading-relaxed">
          <span className="font-bold">تنويه حفظ السجلات في بيئة المحاكاة:</span>
          <p className="text-text-muted text-xs">
            سجلات الرقابة الأمنية الحالية مخزنة بالكامل في ذاكرة المتصفح/الخادم المحاكي (In-Memory Ledger) لأغراض العرض التوضيحي واختبارات الجودة المؤتمتة، ولا يتم ترحيلها إلى قاعدة بيانات إنتاجية دائمة. يتم الحفاظ على تسلسل المعرفات وترتيب الأحداث بدقة خلال الجلسة.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-text-muted">إجمالي أحداث التدقيق</div>
          <div className="text-2xl font-bold text-text-heading" data-testid="kpi-total-audit-events">
            {total} حدث
          </div>
          <div className="text-[11px] text-text-muted">موزعة على كافة الإجراءات الإدارية</div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-text-muted">العمليات الناجحة</div>
          <div className="text-2xl font-bold text-success">
            {successfulCount}
          </div>
          <div className="text-[11px] text-text-muted">إجراءات تم اعتمادها وتنفيذها بنجاح</div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-text-muted">العمليات المحظورة أمنياً</div>
          <div className="text-2xl font-bold text-danger-dark">
            {deniedCount}
          </div>
          <div className="text-[11px] text-text-muted">محاولات حُظرت بمحددات الأمان وسقوف الأدوار</div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-text-muted">طلبات معلقة / أحداث حرجة</div>
          <div className="text-2xl font-bold text-warning-dark">
            {pendingCount} معلق / {criticalCount} حرج
          </div>
          <div className="text-[11px] text-text-muted">تتطلب انتباه مديري النظام</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="col-span-1 md:col-span-2 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="بحث بالمعرف (AUD-...)، الفاعل، الإجراء، أو التفاصيل..."
              data-testid="audit-search-input"
              className="w-full pl-4 pr-10 py-2 rounded-xl text-sm bg-bg border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
            <span className="absolute right-3.5 top-2.5 text-text-muted pointer-events-none">
              <Icon name="search" size="sm" />
            </span>
          </div>

          {/* Action Category Selector */}
          <div>
            <select
              value={selectedActionCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              data-testid="audit-action-filter"
              className="w-full px-3 py-2 rounded-xl text-sm bg-bg border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 text-text"
            >
              <option value="all">كافة مجالات العمليات</option>
              <option value="users.create">إنشاء حسابات المستخدمين</option>
              <option value="users.change_role">تعديل الأدوار الوظيفية</option>
              <option value="users.change_status">إيقاف / تنشيط الحسابات</option>
              <option value="users.delete">حذف حسابات المستخدمين</option>
              <option value="permissions.configure_roles">تعديل الصلاحيات الافتراضية</option>
              <option value="permissions.configure_users">تخصيص الصلاحيات الفردية</option>
              <option value="governance.delegation">إدارة التفويض التشغيلي</option>
              <option value="approvals.submit_request">تقديم طلبات الاعتماد</option>
              <option value="approvals.decide_request">قرارات الاعتماد والرفض</option>
              <option value="groups.create">إنشاء المجموعات التدريبية</option>
              <option value="groups.edit_config">تعديل إعدادات المجموعات</option>
              <option value="groups.archive">أرشفة المجموعات التدريبية</option>
              <option value="courses.publish">نشر المقررات التدريبية</option>
              <option value="audit.view_system_logs">الاستعلام عن سجل الرقابة</option>
            </select>
          </div>

          {/* Severity Selector */}
          <div>
            <select
              value={selectedSeverity}
              onChange={(e) => handleSeverityChange(e.target.value as AuditEventSeverity | 'all')}
              data-testid="audit-severity-filter"
              className="w-full px-3 py-2 rounded-xl text-sm bg-bg border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 text-text"
            >
              <option value="all">كافة درجات الخطورة</option>
              <option value="info">معلومات (Info)</option>
              <option value="warning">تحذير (Warning)</option>
              <option value="critical">حرج (Critical)</option>
            </select>
          </div>
        </div>

        {/* Outcome Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/70">
          <div className="flex items-center gap-1.5 flex-wrap" data-testid="audit-outcome-filter">
            <span className="text-xs font-semibold text-text-muted ml-2">نتيجة الإجراء:</span>
            {(
              [
                { key: 'all', label: 'الكل' },
                { key: 'success', label: 'ناجحة' },
                { key: 'denied', label: 'محظورة أمنياً' },
                { key: 'pending_approval', label: 'بانتظار الاعتماد' },
                { key: 'rejected', label: 'مرفوضة' },
                { key: 'failed', label: 'فشل التنفيذ' },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleOutcomeChange(item.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedOutcome === item.key
                    ? 'bg-primary-dark text-white shadow-sm'
                    : 'bg-bg-alt/70 text-text-muted hover:text-text hover:bg-bg-alt'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              data-testid="audit-reset-filters-btn"
            >
              إعادة ضبط الفلاتر
            </Button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert
          variant="danger"
          title="خطأ أثناء جلب السجلات"
          message={error}
        />
      )}

      {/* Audit Log Table */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden" data-testid="audit-table">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-sm">
            <thead>
              <tr className="bg-bg-alt/70 border-b border-border text-xs font-semibold text-text-muted select-none">
                <th scope="col" className="py-3.5 px-4 font-bold w-12 text-center">#</th>
                <th scope="col" className="py-3.5 px-4 font-bold">رقم الحدث</th>
                <th scope="col" className="py-3.5 px-4 font-bold">التاريخ والتوقيت</th>
                <th scope="col" className="py-3.5 px-4 font-bold">الفاعل والرتبة</th>
                <th scope="col" className="py-3.5 px-4 font-bold">نوع العملية</th>
                <th scope="col" className="py-3.5 px-4 font-bold">المستهدف</th>
                <th scope="col" className="py-3.5 px-4 font-bold text-center">الخطورة</th>
                <th scope="col" className="py-3.5 px-4 font-bold text-center">النتيجة</th>
                <th scope="col" className="py-3.5 px-4 font-bold text-center">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span>جارٍ تحميل سجل الرقابة الأمنية...</span>
                    </div>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Icon name="search" size="lg" className="text-text-muted/60" />
                      <span className="text-sm font-semibold">لا توجد أحداث مطابقة لشروط البحث والفلاتر المحددة</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResetFilters}
                        className="mt-2"
                      >
                        إلغاء الفلاتر وعرض كافة السجلات
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const isExpanded = expandedRowIds.has(entry.id);
                  const formattedDate = new Date(entry.timestamp).toLocaleString('ar-EG', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <React.Fragment key={entry.id}>
                      <tr
                        className={`hover:bg-bg/60 transition-colors ${
                          entry.outcome === 'denied' ? 'bg-danger-light/10' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleRowExpanded(entry.id)}
                            className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-bg-alt transition-colors"
                            title={isExpanded ? 'طي التفاصيل' : 'عرض التفاصيل'}
                          >
                            <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} size="sm" />
                          </button>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-xs text-text-muted font-bold">
                          {entry.id}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-text-muted whitespace-nowrap">
                          {formattedDate}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <div className="font-semibold text-text text-xs flex items-center gap-1.5">
                              <span>{entry.actorName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                              <span className="font-mono">{entry.actorId}</span>
                              <span>•</span>
                              <Badge variant="neutral" size="sm">
                                {ROLE_CANONICAL_LABELS_AR[entry.actorRole] || entry.actorRole}
                              </Badge>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-text text-xs block">
                              {entry.actionLabelAr}
                            </span>
                            <span className="font-mono text-[11px] text-text-muted block">
                              {entry.action}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {entry.targetResourceName || entry.targetResourceId ? (
                            <div className="space-y-0.5">
                              {entry.targetResourceName && (
                                <span className="text-xs text-text block truncate max-w-xs font-medium">
                                  {entry.targetResourceName}
                                </span>
                              )}
                              {entry.targetResourceId && (
                                <span className="font-mono text-[11px] text-text-muted block">
                                  {entry.targetResourceId}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-text-muted text-xs">-</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {renderSeverityBadge(entry.severity)}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {renderOutcomeBadge(entry.outcome)}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedEntry(entry)}
                            className="px-2.5 py-1 text-xs"
                          >
                            معاينة
                          </Button>
                        </td>
                      </tr>

                      {/* Expandable Accordion Row for Contextual Metadata */}
                      {isExpanded && (
                        <tr className="bg-bg-alt/30 border-b border-border/70">
                          <td colSpan={9} className="p-4 space-y-3">
                            <div className="bg-surface border border-border rounded-xl p-4 space-y-2.5">
                              <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                                <span className="font-bold text-xs text-text">تفاصيل العملية الإدارية:</span>
                                {entry.requestId && (
                                  <span className="text-xs text-text-muted font-mono">
                                    معرف طلب الاعتماد: {entry.requestId}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-text leading-relaxed">
                                {entry.details}
                              </p>

                              {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                                <div className="space-y-1.5 pt-2 border-t border-border/70">
                                  <span className="text-[11px] font-bold text-text-muted block">
                                    البيانات الوصفية للعملية (Context Metadata):
                                  </span>
                                  <pre className="bg-bg p-2.5 rounded-lg text-xs font-mono text-text overflow-x-auto whitespace-pre-wrap max-h-40">
                                    {JSON.stringify(entry.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="bg-bg-alt/40 border-t border-border px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted select-none">
          <div className="flex items-center gap-2">
            <span>
              عرض الصفحة <strong className="text-text">{page}</strong> من إجمالي{' '}
              <strong className="text-text">{totalPages}</strong> (إجمالي السجلات: {total})
            </span>
            <span className="mx-2">|</span>
            <label className="flex items-center gap-1.5">
              <span>عدد السجلات:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value, 10));
                  setPage(1);
                }}
                className="bg-surface border border-border rounded-lg px-2 py-1 text-xs text-text"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              data-testid="audit-prev-page-btn"
            >
              <Icon name="arrowRight" size="sm" className="ml-1" />
              السابق
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              data-testid="audit-next-page-btn"
            >
              التالي
              <Icon name="arrowLeft" size="sm" className="mr-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Audit Log Entry Detail Inspection Modal */}
      {selectedEntry && (
        <Modal
          isOpen={!!selectedEntry}
          onClose={() => setSelectedEntry(null)}
          title={`تفاصيل حدث التدقيق: ${selectedEntry.id}`}
          size="lg"
          data-testid="audit-detail-modal"
          footer={
            <Button type="button" variant="primary" onClick={() => setSelectedEntry(null)}>
              إغلاق النافذة
            </Button>
          }
        >
          <div className="space-y-4 text-right">
            <div className="grid grid-cols-2 gap-3 bg-bg-alt/50 p-3.5 rounded-xl text-xs">
              <div>
                <span className="text-text-muted block">معرف الحدث:</span>
                <span className="font-mono font-bold text-text">{selectedEntry.id}</span>
              </div>
              <div>
                <span className="text-text-muted block">التاريخ والتوقيت:</span>
                <span className="text-text">
                  {new Date(selectedEntry.timestamp).toLocaleString('ar-EG')}
                </span>
              </div>
              <div>
                <span className="text-text-muted block">الفاعل:</span>
                <span className="text-text font-bold">
                  {selectedEntry.actorName} ({selectedEntry.actorId})
                </span>
              </div>
              <div>
                <span className="text-text-muted block">رتبة الفاعل:</span>
                <span className="text-text">
                  {ROLE_CANONICAL_LABELS_AR[selectedEntry.actorRole] || selectedEntry.actorRole}
                </span>
              </div>
              <div>
                <span className="text-text-muted block">نوع العملية:</span>
                <span className="text-text font-bold">{selectedEntry.actionLabelAr}</span>
              </div>
              <div>
                <span className="text-text-muted block">رمز العملية البرمجي:</span>
                <span className="font-mono text-text">{selectedEntry.action}</span>
              </div>
              <div>
                <span className="text-text-muted block">درجة الخطورة:</span>
                <div>{renderSeverityBadge(selectedEntry.severity)}</div>
              </div>
              <div>
                <span className="text-text-muted block">نتيجة الإجراء:</span>
                <div>{renderOutcomeBadge(selectedEntry.outcome)}</div>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-text-muted block">وصف الإجراء:</span>
              <p className="bg-surface border border-border p-3 rounded-xl text-xs text-text leading-relaxed">
                {selectedEntry.details}
              </p>
            </div>

            {selectedEntry.targetResourceId && (
              <div className="space-y-1">
                <span className="text-xs font-bold text-text-muted block">المورد المستهدف:</span>
                <div className="bg-surface border border-border p-3 rounded-xl text-xs flex justify-between">
                  <span>الاسم: {selectedEntry.targetResourceName || '-'}</span>
                  <span className="font-mono">المعرف: {selectedEntry.targetResourceId}</span>
                </div>
              </div>
            )}

            {selectedEntry.requestId && (
              <div className="space-y-1">
                <span className="text-xs font-bold text-text-muted block">معرف طلب الاعتماد المرتبط:</span>
                <div className="bg-surface border border-border p-3 rounded-xl text-xs font-mono">
                  {selectedEntry.requestId}
                </div>
              </div>
            )}

            {selectedEntry.metadata && Object.keys(selectedEntry.metadata).length > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-bold text-text-muted block">البيانات الوصفية المرفقة (Metadata):</span>
                <pre className="bg-bg p-3 rounded-xl text-xs font-mono text-text overflow-x-auto whitespace-pre-wrap max-h-48 border border-border">
                  {JSON.stringify(selectedEntry.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
