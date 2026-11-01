import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { reviewApi } from '@/features/course-review/api/reviewApi';
import type {
  ReviewQueueItemDTO,
  LecturerSubmissionsResponseDTO,
} from '@/core/courses/types';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';

/**
 * Format timestamp in Arabic or return the neutral label "غير متوفر"
 */
function formatSubmissionDate(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) {
    return 'غير متوفر';
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return 'غير متوفر';
    }
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'غير متوفر';
  }
}

export const ApprovalsPage: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Admin Queue state
  const [adminQueue, setAdminQueue] = useState<ReviewQueueItemDTO[]>([]);
  // Lecturer Submissions state
  const [lecturerData, setLecturerData] = useState<LecturerSubmissionsResponseDTO | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Admin filter and search
  const [adminFilter, setAdminFilter] = useState<'all' | 'new' | 'update'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Lecturer filter tab
  const [lecturerTab, setLecturerTab] = useState<'all' | 'pending' | 'needs_revision' | 'approved'>('all');

  const isAdmin =
    user?.role === 'admin' ||
    user?.role === 'super_admin' ||
    user?.role === 'developer' ||
    user?.role === 'assistant_admin';
  const isLecturer = user?.role === 'lecturer';
  const isAuthorized = isAdmin || isLecturer;

  const loadData = useCallback(async () => {
    if (!isAuthenticated || !isAuthorized) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (isAdmin) {
        const response = await reviewApi.getReviewQueue();
        setAdminQueue(response.items);
      } else if (isLecturer) {
        const response = await reviewApi.getLecturerSubmissions();
        setLecturerData(response);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'تعذر تحميل بيانات الاعتماد والمراجعة';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isAuthorized, isAdmin, isLecturer]);

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [authLoading, loadData]);

  // Admin filtered items
  const filteredAdminQueue = useMemo(() => {
    return adminQueue.filter((item) => {
      if (adminFilter === 'new' && item.submissionType !== 'new') return false;
      if (adminFilter === 'update' && item.submissionType !== 'update') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchLecturer = item.lecturerName.toLowerCase().includes(q);
        const matchId = item.id.toLowerCase().includes(q);
        return matchTitle || matchLecturer || matchId;
      }
      return true;
    });
  }, [adminQueue, adminFilter, searchQuery]);

  // Lecturer filtered items
  const filteredLecturerSubmissions = useMemo(() => {
    if (!lecturerData) return [];
    return lecturerData.items.filter((item) => {
      if (lecturerTab === 'pending' && item.reviewState !== 'pending') return false;
      if (lecturerTab === 'needs_revision' && item.reviewState !== 'needs_revision') return false;
      if (lecturerTab === 'approved' && item.reviewState !== 'approved') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchId = item.id.toLowerCase().includes(q);
        return matchTitle || matchId;
      }
      return true;
    });
  }, [lecturerData, lecturerTab, searchQuery]);

  // Loading state
  if (authLoading || (loading && !error && (adminQueue.length === 0 && !lecturerData))) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-7xl" data-testid="approvals-loading" dir="rtl">
        <div className="flex flex-col items-center justify-center p-12 bg-surface rounded-xl border border-border">
          <Icon name="clock" size="lg" className="animate-spin text-primary mb-4" />
          <p className="text-text-muted text-base font-medium">جاري تحميل لوحة الاعتمادات والمراجعة...</p>
        </div>
      </div>
    );
  }

  // Unauthorized state (trainee or guest)
  if (!isAuthenticated || !isAuthorized) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl" data-testid="approvals-unauthorized" dir="rtl">
        <Alert variant="warning" title="غير مصرح بالوصول">
          <p className="text-sm mb-4">
            هذه الصفحة مخصصة لمديري النظام ومحاضري التدريب لمراجعة واعتماد البرامج التدريبية.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
            العودة إلى لوحة المتابعة
          </Button>
        </Alert>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl" data-testid="approvals-error" dir="rtl">
        <Alert variant="danger" title="خطأ أثناء جلب البيانات">
          <p className="text-sm mb-4">{error}</p>
          <Button variant="primary" size="sm" onClick={loadData}>
            إعادة المحاولة
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl" data-testid="approvals-page" dir="rtl">
      {/* -------------------- ADMINISTRATOR VIEW -------------------- */}
      {isAdmin && (
        <div className="space-y-6" data-testid="admin-approvals-view">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Icon name="shield" size="md" className="text-primary" />
                <h1 className="text-2xl font-bold text-text">لوحة التدقيق واعتماد الجودة</h1>
              </div>
              <p className="text-text-muted text-sm">
                إدارة قائمة انتظار مراجعة واعتماد المقررات وفق الترتيب الزمني الصارم (FIFO).
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                data-testid="admin-refresh-btn"
                className="gap-2"
              >
                <Icon name="refresh" size="sm" />
                تحديث القائمة
              </Button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5" data-testid="admin-stat-total">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-1">
                    إجمالي قائمة الانتظار
                  </p>
                  <p className="text-2xl font-bold text-text">{adminQueue.length}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center text-primary-dark">
                  <Icon name="clock" size="md" />
                </div>
              </div>
            </Card>

            <Card className="p-5" data-testid="admin-stat-new">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-1">
                    مقررات جديدة
                  </p>
                  <p className="text-2xl font-bold text-text">
                    {adminQueue.filter((i) => i.submissionType === 'new').length}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-info-light flex items-center justify-center text-info-dark">
                  <Icon name="bookOpen" size="md" />
                </div>
              </div>
            </Card>

            <Card className="p-5" data-testid="admin-stat-update">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-1">
                    تحديثات مقررات منشورة
                  </p>
                  <p className="text-2xl font-bold text-text">
                    {adminQueue.filter((i) => i.submissionType === 'update').length}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-warning-light flex items-center justify-center text-warning-dark">
                  <Icon name="edit" size="md" />
                </div>
              </div>
            </Card>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-4 rounded-lg border border-border">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setAdminFilter('all')}
                data-testid="admin-filter-all"
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  adminFilter === 'all'
                    ? 'bg-primary text-surface font-semibold shadow-sm'
                    : 'bg-surface-muted text-text hover:bg-border/60'
                }`}
              >
                الكل ({adminQueue.length})
              </button>
              <button
                type="button"
                onClick={() => setAdminFilter('new')}
                data-testid="admin-filter-new"
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  adminFilter === 'new'
                    ? 'bg-primary text-surface font-semibold shadow-sm'
                    : 'bg-surface-muted text-text hover:bg-border/60'
                }`}
              >
                جديد ({adminQueue.filter((i) => i.submissionType === 'new').length})
              </button>
              <button
                type="button"
                onClick={() => setAdminFilter('update')}
                data-testid="admin-filter-update"
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  adminFilter === 'update'
                    ? 'bg-primary text-surface font-semibold shadow-sm'
                    : 'bg-surface-muted text-text hover:bg-border/60'
                }`}
              >
                تحديثات ({adminQueue.filter((i) => i.submissionType === 'update').length})
              </button>
            </div>

            <div className="w-full sm:w-72 relative">
              <input
                type="text"
                placeholder="بحث باسم المقرر أو المحاضر..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="admin-search-input"
                className="w-full pl-3 pr-8 py-1.5 text-xs bg-bg border border-border rounded-md text-text focus:outline-none focus:border-primary"
              />
              <Icon
                name="search"
                size="sm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
              />
            </div>
          </div>

          {/* Queue Table */}
          {filteredAdminQueue.length === 0 ? (
            <Card className="p-12 text-center" data-testid="admin-empty-state">
              <Icon name="checkCircle" size="lg" className="mx-auto text-success mb-3" />
              <h3 className="text-base font-semibold text-text mb-1">
                لا توجد مقررات بانتظار المراجعة والاعتماد حالياً
              </h3>
              <p className="text-text-muted text-xs max-w-sm mx-auto">
                جميع طلبات الاعتماد المقدمة تمت معالجتها بالكامل أو لا توجد نتائج مطابقة للبحث المحدد.
              </p>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
              <table className="w-full text-right text-xs" data-testid="admin-queue-table">
                <thead className="bg-surface-muted text-text-muted font-semibold border-b border-border">
                  <tr>
                    <th className="px-4 py-3">المقرر التدريبي</th>
                    <th className="px-4 py-3">المحاضر</th>
                    <th className="px-4 py-3">نوع التقديم</th>
                    <th className="px-4 py-3">تاريخ التقديم</th>
                    <th className="px-4 py-3">حالة التعديلات</th>
                    <th className="px-4 py-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAdminQueue.map((item) => (
                    <tr
                      key={item.id}
                      data-testid={`queue-row-${item.id}`}
                      className="hover:bg-surface-muted/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-text text-sm mb-0.5">{item.title}</div>
                        <div className="text-text-muted text-[11px] flex items-center gap-2">
                          <span>معرف: {item.id}</span>
                          <span>•</span>
                          <span>{item.chapterCount} فصول</span>
                          <span>•</span>
                          <span>{item.lessonCount} دروس</span>
                          <span>•</span>
                          <span>{item.estimatedHours} ساعة</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-text">{item.lecturerName}</span>
                      </td>
                      <td className="px-4 py-3">
                        {item.submissionType === 'new' ? (
                          <Badge
                            variant="primary"
                            size="sm"
                            data-testid={`badge-type-${item.id}`}
                          >
                            جديد
                          </Badge>
                        ) : (
                          <Badge
                            variant="info"
                            size="sm"
                            data-testid={`badge-type-${item.id}`}
                          >
                            تحديث لمقرر منشور
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-muted" data-testid={`date-${item.id}`}>
                        {formatSubmissionDate(item.submittedAt)}
                      </td>
                      <td className="px-4 py-3">
                        {item.hasStagedEdits ? (
                          <Badge
                            variant="warning"
                            size="sm"
                            dot
                            data-testid={`badge-staged-${item.id}`}
                          >
                            مسودة تعديلات الإدارة
                          </Badge>
                        ) : (
                          <span className="text-text-muted">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="primary"
                          size="sm"
                          data-testid={`review-btn-${item.id}`}
                          onClick={() => navigate(`/admin/review/${item.id}`)}
                          className="gap-1.5"
                        >
                          <Icon name="shield" size="sm" />
                          مراجعة المقرر
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* -------------------- LECTURER VIEW -------------------- */}
      {isLecturer && lecturerData && (
        <div className="space-y-6" data-testid="lecturer-approvals-view">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Icon name="shield" size="md" className="text-primary" />
                <h1 className="text-2xl font-bold text-text">متابعة طلبات اعتماد المقررات</h1>
              </div>
              <p className="text-text-muted text-sm">
                متابعة حالة المقررات المقدمة للاعتماد والتغذية الراجعة من إدارة التدريب.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/lecturer/courses')}
                data-testid="go-to-courses-btn"
                className="gap-1.5"
              >
                <Icon name="bookOpen" size="sm" />
                منشئ المقررات
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                data-testid="lecturer-refresh-btn"
                className="gap-1.5"
              >
                <Icon name="refresh" size="sm" />
                تحديث
              </Button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5" data-testid="lecturer-stat-pending">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-1">
                    قيد المراجعة
                  </p>
                  <p className="text-2xl font-bold text-warning-dark">
                    {lecturerData.counts.pending}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-warning-light flex items-center justify-center text-warning-dark">
                  <Icon name="clock" size="md" />
                </div>
              </div>
            </Card>

            <Card className="p-5" data-testid="lecturer-stat-needs-revision">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-1">
                    تتطلب تعديلات
                  </p>
                  <p className="text-2xl font-bold text-danger-dark">
                    {lecturerData.counts.needsRevision}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-danger-light flex items-center justify-center text-danger-dark">
                  <Icon name="alert" size="md" />
                </div>
              </div>
            </Card>

            <Card className="p-5" data-testid="lecturer-stat-approved">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-1">
                    معتمدة ومنشورة
                  </p>
                  <p className="text-2xl font-bold text-success">
                    {lecturerData.counts.approved}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-success-light flex items-center justify-center text-success">
                  <Icon name="checkCircle" size="md" />
                </div>
              </div>
            </Card>
          </div>

          {/* Filter Tabs & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-4 rounded-lg border border-border">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setLecturerTab('all')}
                data-testid="lecturer-filter-all"
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  lecturerTab === 'all'
                    ? 'bg-primary text-surface font-semibold shadow-sm'
                    : 'bg-surface-muted text-text hover:bg-border/60'
                }`}
              >
                الكل ({lecturerData.totalCount})
              </button>
              <button
                type="button"
                onClick={() => setLecturerTab('pending')}
                data-testid="lecturer-filter-pending"
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  lecturerTab === 'pending'
                    ? 'bg-primary text-surface font-semibold shadow-sm'
                    : 'bg-surface-muted text-text hover:bg-border/60'
                }`}
              >
                قيد المراجعة ({lecturerData.counts.pending})
              </button>
              <button
                type="button"
                onClick={() => setLecturerTab('needs_revision')}
                data-testid="lecturer-filter-needs-revision"
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  lecturerTab === 'needs_revision'
                    ? 'bg-primary text-surface font-semibold shadow-sm'
                    : 'bg-surface-muted text-text hover:bg-border/60'
                }`}
              >
                تتطلب تعديلات ({lecturerData.counts.needsRevision})
              </button>
              <button
                type="button"
                onClick={() => setLecturerTab('approved')}
                data-testid="lecturer-filter-approved"
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  lecturerTab === 'approved'
                    ? 'bg-primary text-surface font-semibold shadow-sm'
                    : 'bg-surface-muted text-text hover:bg-border/60'
                }`}
              >
                معتمدة ({lecturerData.counts.approved})
              </button>
            </div>

            <div className="w-full sm:w-72 relative">
              <input
                type="text"
                placeholder="بحث باسم المقرر..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="lecturer-search-input"
                className="w-full pl-3 pr-8 py-1.5 text-xs bg-bg border border-border rounded-md text-text focus:outline-none focus:border-primary"
              />
              <Icon
                name="search"
                size="sm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
              />
            </div>
          </div>

          {/* Submissions Table */}
          {filteredLecturerSubmissions.length === 0 ? (
            <Card className="p-12 text-center" data-testid="lecturer-empty-state">
              <Icon name="bookOpen" size="lg" className="mx-auto text-primary mb-3" />
              <h3 className="text-base font-semibold text-text mb-1">
                لم تقم بتقديم أي مقررات للاعتماد بعد
              </h3>
              <p className="text-text-muted text-xs max-w-sm mx-auto mb-4">
                يمكنك إنشاء مقررات جديدة وتقديمها للمراجعة والاعتماد من خلال منشئ المحتوى.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/lecturer/courses')}
              >
                الانتقال إلى منشئ المحتوى
              </Button>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
              <table className="w-full text-right text-xs" data-testid="lecturer-submissions-table">
                <thead className="bg-surface-muted text-text-muted font-semibold border-b border-border">
                  <tr>
                    <th className="px-4 py-3">المقرر التدريبي</th>
                    <th className="px-4 py-3">تاريخ التقديم</th>
                    <th className="px-4 py-3">حالة المراجعة</th>
                    <th className="px-4 py-3">التغذية الراجعة</th>
                    <th className="px-4 py-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLecturerSubmissions.map((item) => (
                    <tr
                      key={item.id}
                      data-testid={`submission-row-${item.id}`}
                      className="hover:bg-surface-muted/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-text text-sm mb-0.5">{item.title}</div>
                        <div className="text-text-muted text-[11px] flex items-center gap-2">
                          <span>معرف: {item.id}</span>
                          <span>•</span>
                          <span>{item.chapterCount} فصول</span>
                          <span>•</span>
                          <span>{item.lessonCount} دروس</span>
                          {item.isUpdatePendingApproval && (
                            <>
                              <span>•</span>
                              <span className="text-info font-medium">تحديث قيد الاعتماد</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-muted" data-testid={`date-${item.id}`}>
                        {formatSubmissionDate(item.submittedAt)}
                      </td>
                      <td className="px-4 py-3">
                        {item.reviewState === 'pending' && (
                          <Badge
                            variant="warning"
                            size="sm"
                            icon="clock"
                            data-testid={`status-badge-${item.id}`}
                          >
                            قيد المراجعة
                          </Badge>
                        )}
                        {item.reviewState === 'needs_revision' && (
                          <Badge
                            variant="danger"
                            size="sm"
                            icon="alert"
                            data-testid={`status-badge-${item.id}`}
                          >
                            تتطلب تعديلات
                          </Badge>
                        )}
                        {item.reviewState === 'approved' && (
                          <Badge
                            variant="success"
                            size="sm"
                            icon="checkCircle"
                            data-testid={`status-badge-${item.id}`}
                          >
                            معتمد ومنشور
                          </Badge>
                        )}
                        {item.reviewState === 'draft' && (
                          <Badge
                            variant="neutral"
                            size="sm"
                            data-testid={`status-badge-${item.id}`}
                          >
                            مسودة
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.activeReviewFeedback ? (
                          <div
                            className="bg-warning-light/50 border border-warning-dark/20 p-2 rounded text-xs text-text max-w-xs space-y-0.5"
                            data-testid={`feedback-summary-${item.id}`}
                          >
                            <div className="flex items-center justify-between gap-1 flex-wrap font-semibold text-[11px] text-warning-dark">
                              <span>{item.activeReviewFeedback.reviewerName || 'غير متوفر'}</span>
                              {item.activeReviewFeedback.reviewedAt && (
                                <span className="text-[10px] text-text-muted font-normal font-mono" data-testid={`feedback-date-${item.id}`}>
                                  {formatSubmissionDate(item.activeReviewFeedback.reviewedAt)}
                                </span>
                              )}
                            </div>
                            <div className="truncate text-text-muted">
                              {item.activeReviewFeedback.summaryMessage || 'لا توجد رسالة ملاحظات'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-text-muted">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`builder-btn-${item.id}`}
                          onClick={() => navigate(`/lecturer/builder/${item.id}`)}
                          className="gap-1.5"
                        >
                          <Icon name="edit" size="sm" />
                          فتح في منشئ المحتوى
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
