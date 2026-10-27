import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useToast } from '@/shared/ui/Toast';
import { commentsApi } from '../services/commentsApi';
import { coursesApi } from '@/features/courses/services/coursesApi';
import type {
  CourseComment,
  CommentModerationSummaryDTO,
} from '@/core/comments/types';
import type { Course } from '@/core/courses/types';
import { ReportedCommentsQueue } from '../components/ReportedCommentsQueue';
import { AllCommentsTable } from '../components/AllCommentsTable';

export const CommentModerationPage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'reported' | 'all'>('reported');
  const [isLoading, setIsLoading] = useState(true);
  const [isActionInProgress, setIsActionInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data collections
  const [reportedComments, setReportedComments] = useState<CourseComment[]>([]);
  const [allComments, setAllComments] = useState<CourseComment[]>([]);
  const [summary, setSummary] = useState<CommentModerationSummaryDTO | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);

  // Search and Filters for Tab 2
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('all');

  // Deletion Confirmation Dialog State
  const [commentToDelete, setCommentToDelete] = useState<CourseComment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Discussion Policy Toggle Dialog State
  const [courseToToggle, setCourseToToggle] = useState<{
    courseId: string;
    courseTitle: string;
    currentEnabled: boolean;
  } | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  // Pending Approval Notification Banner State
  const [pendingApprovalNotice, setPendingApprovalNotice] = useState<{
    requestId: string;
    message: string;
    actionLabel: string;
  } | null>(null);

  const isAuthorized = user?.role === 'admin' || user?.role === 'assistant_admin';
  const isAssistantAdmin = user?.role === 'assistant_admin';

  // Load All Moderation Data
  const loadModerationData = useCallback(async () => {
    if (!isAuthorized) return;
    setIsLoading(true);
    setError(null);
    try {
      const [reportedRes, allRes, summaryRes, coursesRes] = await Promise.all([
        commentsApi.getReportedComments(),
        commentsApi.getAllComments({
          query: searchQuery.trim() || undefined,
          courseId: selectedCourseFilter !== 'all' ? selectedCourseFilter : undefined,
        }),
        commentsApi.getCommentModerationSummary(),
        coursesApi.getCourses().catch(() => [] as Course[]),
      ]);

      setReportedComments(reportedRes);
      setAllComments(allRes);
      setSummary(summaryRes);
      setCourses(coursesRes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تحميل بيانات إدارة ومراقبة التعليقات';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthorized, searchQuery, selectedCourseFilter, toast]);

  useEffect(() => {
    loadModerationData();
  }, [loadModerationData]);

  // Handle Permanent Comment Deletion
  const handleOpenDeleteDialog = (comment: CourseComment) => {
    setCommentToDelete(comment);
  };

  const handleCloseDeleteDialog = () => {
    if (isDeleting) return;
    setCommentToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!commentToDelete) return;
    setIsDeleting(true);
    setIsActionInProgress(true);
    try {
      const res = await commentsApi.deleteComment(commentToDelete.id);

      if (res.approvalRequired) {
        // Dual-control approval required: Do NOT optimistically remove comment
        setPendingApprovalNotice({
          requestId: res.requestId || 'REQ-UNKNOWN',
          message:
            res.message ||
            'تم إرسال طلب حذف التعليق للاعتماد بنجاح؛ العملية بانتظار موافقة مدير النظام.',
          actionLabel: `طلب حذف تعليق (${commentToDelete.id})`,
        });
        toast.info(
          `تم إرسال طلب حذف التعليق للاعتماد (رقم الطلب: ${res.requestId})؛ التعليق يظل سارياً حتى الاعتماد.`
        );
      } else {
        // Direct execution succeeded
        toast.success('تم حذف التعليق نهائياً وتحديث سجل الرقابة والأمان بنجاح.');
        setPendingApprovalNotice(null);
        await loadModerationData();
      }
      handleCloseDeleteDialog();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشلت معالجة حذف التعليق';
      toast.error(msg);
    } finally {
      setIsDeleting(false);
      setIsActionInProgress(false);
    }
  };

  // Handle Ignoring Comment Report (Non-destructive triage)
  const handleIgnoreReport = async (comment: CourseComment) => {
    setIsActionInProgress(true);
    try {
      await commentsApi.ignoreCommentReport(comment.id);
      toast.success('تم تجاهل البلاغ بنجاح وحفظ التعليق ضمن نقاشات المقرر.');
      await loadModerationData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشلت معالجة تجاهل البلاغ';
      toast.error(msg);
    } finally {
      setIsActionInProgress(false);
    }
  };

  // Handle Course Discussion Policy Toggle
  const handleOpenToggleDialog = (courseId: string, currentEnabled: boolean) => {
    const courseObj = courses.find((c) => c.id.toLowerCase() === courseId.toLowerCase());
    setCourseToToggle({
      courseId,
      courseTitle: courseObj?.title || courseId,
      currentEnabled,
    });
  };

  const handleCloseToggleDialog = () => {
    if (isToggling) return;
    setCourseToToggle(null);
  };

  const handleConfirmToggle = async () => {
    if (!courseToToggle) return;
    setIsToggling(true);
    setIsActionInProgress(true);
    try {
      const nextStatus = !courseToToggle.currentEnabled;
      const res = await commentsApi.toggleCourseComments(courseToToggle.courseId, nextStatus);

      if (res.approvalRequired) {
        setPendingApprovalNotice({
          requestId: res.requestId || 'REQ-UNKNOWN',
          message:
            'تم إرسال طلب تعديل سياسة النقاشات للاعتماد بنجاح؛ العملية بانتظار موافقة مدير النظام.',
          actionLabel: `طلب تعديل سياسة نقاشات مقرر (${courseToToggle.courseTitle})`,
        });
        toast.info(
          `تم إرسال طلب تعديل السياسة للاعتماد (رقم الطلب: ${res.requestId})؛ تظل الحالة الحالية سارية حتى الاعتماد.`
        );
      } else {
        toast.success(
          `تم ${res.commentsEnabled ? 'تفعيل' : 'إغلاق'} نقاشات المقرر التدريبي بنجاح.`
        );
        setPendingApprovalNotice(null);
        await loadModerationData();
      }
      handleCloseToggleDialog();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشلت معالجة تعديل سياسة النقاشات';
      toast.error(msg);
    } finally {
      setIsToggling(false);
      setIsActionInProgress(false);
    }
  };

  // Unauthorized Access View
  if (!isAuthorized) {
    return (
      <div className="container mx-auto p-6 max-w-4xl text-right" data-testid="unauthorized-moderation-view">
        <Alert
          variant="danger"
          title="غير مصرح: لوحة الإدارة الرقابية"
          message="صفحة إدارة ومراقبة التعليقات المركزية مخصصة لمديري النظام والمديرين المساعدين فقط. لا يمتلك المحاضرون أو المتدربون صلاحية الوصول الإداري الشامل لنقاشات المنظومة."
        />
      </div>
    );
  }

  return (
    <div
      role="main"
      data-testid="comment-moderation-page"
      className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl space-y-6 text-right"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-text flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary-dark flex items-center justify-center shrink-0">
                <Icon name="messageSquare" size="lg" />
              </span>
              إدارة ومراقبة التعليقات
            </h1>
            <Badge variant="primary" size="sm">
              لوحة الإدارة الرقابية
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-muted">
            متابعة طابور البلاغات على النقاشات، معالجة التعليقات المخالفة، والتحكم بسياسات فتح وإغلاق التعليقات في المقررات التدريبية
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadModerationData}
            isLoading={isLoading}
            data-testid="moderation-refresh-btn"
          >
            <Icon name="rotateCcw" size="sm" className="ml-1.5" />
            تحديث البيانات
          </Button>
        </div>
      </div>

      {/* Pending Approval Banner (when an action requires approval) */}
      {pendingApprovalNotice && (
        <div
          className="bg-warning-light/40 border border-warning-dark/30 rounded-2xl p-4 flex items-start justify-between gap-3 text-xs sm:text-sm text-warning-dark"
          data-testid="pending-approval-notice-banner"
        >
          <div className="flex items-start gap-3">
            <span className="shrink-0 mt-0.5 text-warning-dark">
              <Icon name="pending" size="md" />
            </span>
            <div className="space-y-1 leading-relaxed">
              <span className="font-bold">طلب اعتماد قيد المراجعة: {pendingApprovalNotice.actionLabel}</span>
              <p className="text-text-muted text-xs">
                {pendingApprovalNotice.message} (رقم الطلب: <code className="font-mono">{pendingApprovalNotice.requestId}</code>).
                وفقاً لضوابط الحوكمة الثنائية، ستبقى البيانات الحالية معروضة دون تعديل حتى يبت مدير النظام الرئيسي في الطلب.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPendingApprovalNotice(null)}
            className="text-text-muted hover:text-text shrink-0"
            aria-label="إغلاق التنويه"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <Alert
          variant="danger"
          title="خطأ في استرجاع البيانات"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Comments */}
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-text-muted">إجمالي التعليقات</div>
          <div className="text-2xl font-bold text-text-heading" data-testid="kpi-total-comments">
            {summary?.totalComments ?? allComments.length}
          </div>
          <div className="text-[11px] text-text-muted">مشاركة عبر كافة المقررات</div>
        </div>

        {/* Card 2: Reported Comments */}
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-text-muted">تعليقات مُبلَّغ عنها</div>
          <div
            className={`text-2xl font-bold ${
              (summary?.reportedCommentsCount ?? reportedComments.length) > 0
                ? 'text-danger'
                : 'text-success'
            }`}
            data-testid="kpi-reported-comments"
          >
            {summary?.reportedCommentsCount ?? reportedComments.length}
          </div>
          <div className="text-[11px] text-text-muted">تتطلب المراجعة والتصرف</div>
        </div>

        {/* Card 3: Active Courses */}
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-text-muted">مقررات بنقاشات مفعّلة</div>
          <div className="text-2xl font-bold text-success" data-testid="kpi-active-courses">
            {courses.filter((c) => c.commentsEnabled !== false).length}
          </div>
          <div className="text-[11px] text-text-muted">تسمح بمشاركة المتدربين</div>
        </div>

        {/* Card 4: Disabled Courses */}
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-text-muted">مقررات بنقاشات مغلقة</div>
          <div className="text-2xl font-bold text-text-muted" data-testid="kpi-disabled-courses">
            {courses.filter((c) => c.commentsEnabled === false).length}
          </div>
          <div className="text-[11px] text-text-muted">معطلة بقرار إداري</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('reported')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'reported'
              ? 'bg-primary-dark text-white shadow-sm'
              : 'bg-surface text-text-muted hover:text-text hover:bg-bg-alt'
          }`}
          data-testid="tab-reported-comments"
        >
          <Icon name="alertCircle" size="sm" />
          <span>التعليقات المُبلَّغ عنها</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[11px] ${
              activeTab === 'reported'
                ? 'bg-white/20 text-white'
                : 'bg-bg-alt text-text-muted'
            }`}
          >
            {reportedComments.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'all'
              ? 'bg-primary-dark text-white shadow-sm'
              : 'bg-surface text-text-muted hover:text-text hover:bg-bg-alt'
          }`}
          data-testid="tab-all-comments"
        >
          <Icon name="list" size="sm" />
          <span>كل التعليقات</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[11px] ${
              activeTab === 'all'
                ? 'bg-white/20 text-white'
                : 'bg-bg-alt text-text-muted'
            }`}
          >
            {allComments.length}
          </span>
        </button>
      </div>

      {/* Tab 1 Content: Reported Comments Queue */}
      {activeTab === 'reported' && (
        <ReportedCommentsQueue
          comments={reportedComments}
          isLoading={isLoading}
          onDelete={handleOpenDeleteDialog}
          onIgnoreReport={handleIgnoreReport}
          isActionInProgress={isActionInProgress}
        />
      )}

      {/* Tab 2 Content: All Comments Directory */}
      {activeTab === 'all' && (
        <AllCommentsTable
          comments={allComments}
          courses={courses}
          isLoading={isLoading}
          onDelete={handleOpenDeleteDialog}
          onToggleCourseComments={(courseId, currentEnabled) =>
            handleOpenToggleDialog(courseId, currentEnabled)
          }
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCourseFilter={selectedCourseFilter}
          onCourseFilterChange={setSelectedCourseFilter}
          isActionInProgress={isActionInProgress}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {commentToDelete && (
        <ConfirmDialog
          isOpen={!!commentToDelete}
          title="تأكيد حذف التعليق نهائياً"
          variant="danger"
          isConfirming={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={handleCloseDeleteDialog}
          onClose={handleCloseDeleteDialog}
          confirmLabel="حذف التعليق"
          cancelLabel="إلغاء"
          testId="confirm-delete-comment-dialog"
          confirmTestId="confirm-delete-action-btn"
          cancelTestId="cancel-delete-action-btn"
          message={
            <div className="space-y-3 text-right">
              <p className="text-xs sm:text-sm text-text leading-relaxed">
                هل أنت متأكد من رغبتك في حذف هذا التعليق نهائياً من مقرر{' '}
                <strong className="text-primary-dark font-bold">"{commentToDelete.courseTitle}"</strong>؟
              </p>

              <div className="bg-bg-alt/60 border border-border p-3 rounded-xl text-xs space-y-1.5">
                <div className="font-semibold text-text">
                  المعلق: <span className="font-normal">{commentToDelete.userName}</span>
                </div>
                <div className="text-text-muted italic select-text">
                  "{commentToDelete.text}"
                </div>
              </div>

              {isAssistantAdmin && (
                <div className="bg-info-light/40 border border-info-dark/20 p-2.5 rounded-xl text-xs text-info-dark flex items-center gap-2">
                  <Icon name="info" size="sm" className="shrink-0" />
                  <span>
                    ملاحظة: بصفتك مدير نظام مساعد، سيتطلب هذا الإجراء اعتماد مدير النظام الرئيسي بموجب ضوابط الحوكمة ما لم تكن مفوضاً تشغيلياً.
                  </span>
                </div>
              )}
            </div>
          }
        />
      )}

      {/* Course Discussion Policy Toggle Confirmation Dialog */}
      {courseToToggle && (
        <ConfirmDialog
          isOpen={!!courseToToggle}
          title={
            courseToToggle.currentEnabled
              ? 'تأكيد إغلاق النقاشات للمقرر'
              : 'تأكيد تفعيل النقاشات للمقرر'
          }
          variant={courseToToggle.currentEnabled ? 'warning' : 'info'}
          isConfirming={isToggling}
          onConfirm={handleConfirmToggle}
          onCancel={handleCloseToggleDialog}
          onClose={handleCloseToggleDialog}
          confirmLabel={
            courseToToggle.currentEnabled ? 'إغلاق النقاشات' : 'تفعيل النقاشات'
          }
          cancelLabel="إلغاء"
          testId="confirm-toggle-comments-dialog"
          confirmTestId="confirm-toggle-action-btn"
          cancelTestId="cancel-toggle-action-btn"
          message={
            <div className="space-y-3 text-right">
              <p className="text-xs sm:text-sm text-text leading-relaxed">
                هل أنت متأكد من رغبتك في{' '}
                <strong className="font-bold">
                  {courseToToggle.currentEnabled ? 'إغلاق' : 'تفعيل'}
                </strong>{' '}
                التعليقات والنقاشات لمقرر{' '}
                <strong className="text-primary-dark font-bold">"{courseToToggle.courseTitle}"</strong>؟
              </p>

              <p className="text-xs text-text-muted">
                {courseToToggle.currentEnabled
                  ? 'لن يتمكن المتدربون من نشر تعليقات أو ردود جديدة حتى يُعاد فتح النقاشات من قبل الإدارة.'
                  : 'سيتاح للمتدربين الملتحقين بالمقرر المشاركة وطرح الاستفسارات في مساحة النقاش.'}
              </p>

              {isAssistantAdmin && (
                <div className="bg-info-light/40 border border-info-dark/20 p-2.5 rounded-xl text-xs text-info-dark flex items-center gap-2">
                  <Icon name="info" size="sm" className="shrink-0" />
                  <span>
                    ملاحظة: بصفتك مدير نظام مساعد، قد يتطلب تعديل سياسة النقاش اعتماد مدير النظام الرئيسي ما لم تكن مفوضاً تشغيلياً.
                  </span>
                </div>
              )}
            </div>
          }
        />
      )}
    </div>
  );
};
