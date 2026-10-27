import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { builderApi } from '@/features/course-builder/services/builderApi';
import { MetadataEditor } from '@/features/course-builder/components/MetadataEditor';
import { CurriculumTreeEditor } from '@/features/course-builder/components/CurriculumTreeEditor';
import { DownloadPoliciesEditor } from '@/features/course-builder/components/DownloadPoliciesEditor';
import type { Course, CourseAuditLogEntry } from '@/core/courses/types';
import { coursesApi } from '@/features/courses/services/coursesApi';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { useToast } from '@/shared/ui/Toast';
import { QRCodeModal } from '@/shared/ui/QRCodeModal';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useUnsavedChangesGuard } from '@/core/navigation';
import {
  ActiveReviewFeedbackBanner,
  CourseDiffViewerModal,
} from '@/features/course-review';
import { reviewApi } from '@/features/course-review/api/reviewApi';

export const CourseBuilderPage: React.FC = () => {
  const toast = useToast();
  const { courseId } = useParams<{ courseId: string }>();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState<string>('');
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [activeTab, setActiveTab] = useState<'metadata' | 'curriculum' | 'downloads' | 'refresher' | 'history'>('metadata');

  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);

  // QR Code Modal State
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);

  // Local backup restoration banner
  const [hasRestoredBackup, setHasRestoredBackup] = useState<boolean>(false);
  const [isResettingLab, setIsResettingLab] = useState<boolean>(false);

  // Confirmation dialogs
  const [isResetLabDialogOpen, setIsResetLabDialogOpen] = useState<boolean>(false);

  // Review Feedback & Dual-Snapshot Diff State (Phase 7 & Increment 9)
  const [isDiffModalOpen, setIsDiffModalOpen] = useState<boolean>(false);
  const [selectedHistoryDiffEntry, setSelectedHistoryDiffEntry] = useState<CourseAuditLogEntry | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  // Track unsaved changes
  const isDirty = Boolean(
    course && initialSnapshot && JSON.stringify(course) !== initialSnapshot
  );

  // Centralized Unsaved Changes Guard across all navigation paths (links, tabs, back/forward, unload)
  const { guardDialog, handleSafeNavigate } = useUnsavedChangesGuard({
    isDirty,
    onConfirmDiscard: () => {
      if (courseId) {
        localStorage.removeItem(`metro_builder_draft_${courseId}`);
      }
    },
  });

  // Save backup to localStorage on edit
  useEffect(() => {
    if (course && courseId && isDirty) {
      try {
        localStorage.setItem(`metro_builder_draft_${courseId}`, JSON.stringify(course));
      } catch {
        // Storage quota exceeded or disabled; silently continue
      }
    }
  }, [course, courseId, isDirty]);

  // Load course and catalog prerequisites
  const loadCourseData = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setErrorMessage(null);
    setAccessDeniedMessage(null);

    try {
      // 1. Fetch course for editing (validates ownership & role)
      const data = await builderApi.getCourseForEditing(courseId);

      // Check if a recoverable local backup exists
      const backupKey = `metro_builder_draft_${courseId}`;
      const savedBackup = localStorage.getItem(backupKey);
      let courseToUse = data;

      if (savedBackup) {
        try {
          const parsed = JSON.parse(savedBackup) as Course;
          if (parsed && parsed.id === courseId) {
            courseToUse = parsed;
            setHasRestoredBackup(true);
          }
        } catch {
          localStorage.removeItem(backupKey);
        }
      }

      setCourse(courseToUse);
      setInitialSnapshot(JSON.stringify(data));

      // Attempt to load authoritative review data if available
      try {
        const reviewDataRes = await reviewApi.getCourseReviewData(courseId);
        let updatedWithReview = false;
        if (reviewDataRes.activeReviewFeedback) {
          courseToUse.activeReviewFeedback = reviewDataRes.activeReviewFeedback;
          updatedWithReview = true;
        }
        if (reviewDataRes.auditLog && reviewDataRes.auditLog.length > 0) {
          courseToUse.auditLog = reviewDataRes.auditLog;
          updatedWithReview = true;
        }
        if (updatedWithReview) {
          setCourse({ ...courseToUse });
          setInitialSnapshot(JSON.stringify(courseToUse));
        }
      } catch {
        // Non-critical: continue with courseToUse
      }

      // 2. Fetch published courses for prerequisites dropdown
      try {
        const publishedList = await coursesApi.getCourses();
        setAvailableCourses(publishedList);
      } catch {
        // Non-critical: continue without prerequisites list
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل في تحميل الدورة التدريبية';
      if (
        msg.includes('غير مصرح') ||
        (err as { status?: number })?.status === 403
      ) {
        setAccessDeniedMessage(msg);
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (isAuthenticated && (user?.role === 'lecturer' || user?.role === 'admin')) {
      loadCourseData();
    }
  }, [isAuthenticated, user?.role, loadCourseData]);

  // Handle Save Draft
  const handleSaveDraft = async () => {
    if (!course || !courseId) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await builderApi.saveCourseDraft(courseId, course);
      setCourse(res.course);
      setInitialSnapshot(JSON.stringify(res.course));

      // Clear local backup after successful remote save
      localStorage.removeItem(`metro_builder_draft_${courseId}`);

      const successText = res.isPublishedPreserved
        ? 'تم حفظ المسودة بنجاح! تم الحفاظ على النسخة المنشورة حالياً في دليل الدورات دون تغيير.'
        : 'تم حفظ تعديلات المقرر التدريبي بنجاح.';

      toast.success(successText);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل في حفظ المسودة';
      setErrorMessage(msg);
      toast.error('تعذر حفظ التعديلات. يرجى مراجعة تفاصيل الخطأ أدناه.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Explicit Reset of Content Testing Lab
  const handleResetLab = () => {
    if (!course || !courseId) return;
    setIsResetLabDialogOpen(true);
  };

  const executeResetLab = async () => {
    setIsResetLabDialogOpen(false);
    if (!course || !courseId) return;

    setIsResettingLab(true);
    setErrorMessage(null);

    try {
      const res = await builderApi.resetContentLab(courseId);
      setCourse(res.course);
      setInitialSnapshot(JSON.stringify(res.course));
      localStorage.removeItem(`metro_builder_draft_${courseId}`);
      setHasRestoredBackup(false);
      const resetText = res.message || 'تمت إعادة ضبط معمل تجربة المحتوى لحالته الافتراضية بنجاح.';
      toast.success(resetText);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل في إعادة ضبط معمل الاختبار';
      setErrorMessage(msg);
      toast.error('تعذر إعادة ضبط معمل الاختبار. يرجى التحقق من تفاصيل الخطأ أدناه.');
    } finally {
      setIsResettingLab(false);
    }
  };

  // Safe navigation back to courses
  const handleBackToCourses = () => {
    handleSafeNavigate('/lecturer/courses');
  };

  // Latest returned audit entry with dual snapshots (Phase 7 & Increment 9)
  const latestReturnedAuditEntry = useMemo(() => {
    if (!course?.auditLog) return null;
    return (
      [...course.auditLog]
        .reverse()
        .find(
          (e) =>
            (e.action === 'returned_with_admin_edits' || e.action === 'approved') &&
            e.baselineSnapshot &&
            e.adminEditedSnapshot
        ) || null
    );
  }, [course?.auditLog]);

  const isPublished = Boolean(course && (course.status === 'published' || course.status === 'live'));

  const isPendingReview = Boolean(
    course &&
      (course.status === 'pending_admin' ||
        (isPublished && course.isUpdatePendingApproval === true))
  );

  const isResubmission = Boolean(
    course?.auditLog?.some(
      (e) => e.action === 'returned_with_admin_edits' || e.action === 'rejected'
    )
  );

  // Handle Submit / Resubmit for Review (Phase 7)
  const handleSubmitForReview = async () => {
    if (!course || !courseId) return;
    if (isDirty) {
      toast.warning('يرجى حفظ المسودة أولاً قبل تقديم المقرر للمراجعة والاعتماد.');
      return;
    }
    setIsSubmittingReview(true);
    setErrorMessage(null);
    try {
      const res = await reviewApi.submitCourse(courseId);
      setCourse(res.course);
      setInitialSnapshot(JSON.stringify(res.course));
      toast.success(res.message || 'تم تقديم المقرر للمراجعة والاعتماد بنجاح');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل في تقديم المقرر للمراجعة';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // 1. Unauthenticated or Trainee Guard
  if (!authLoading && (!isAuthenticated || user?.role === 'user')) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4" data-testid="builder-access-denied">
        <div className="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto">
          <Icon name="alertCircle" size="lg" />
        </div>
        <h1 className="text-xl font-bold text-text-heading">غير مصرح بالدخول إلى منشئ المحتوى</h1>
        <p className="text-sm text-text-muted leading-relaxed">
          هذا القسم مخصص للمحاضرين والمدربين المعتمدين ومديري النظام لإعداد وتعديل المقررات التدريبية.
        </p>
        <Button variant="primary" size="sm" onClick={() => navigate('/dashboard')}>
          العودة للرئيسية
        </Button>
      </div>
    );
  }

  // 2. Specific 403 Access Denied (Non-owner lecturer trying to edit unassigned course)
  if (accessDeniedMessage) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4" data-testid="builder-ownership-denied">
        <div className="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto">
          <Icon name="lock" size="lg" />
        </div>
        <h1 className="text-xl font-bold text-text-heading">غير مصرح لك بتعديل هذا المقرر</h1>
        <p className="text-sm text-text-muted leading-relaxed">
          {accessDeniedMessage}
        </p>
        <Button variant="primary" size="sm" onClick={() => navigate('/lecturer/courses')}>
          العودة إلى دوراتي المكلف بها
        </Button>
      </div>
    );
  }

  // 3. Loading State
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-3" data-testid="builder-loading-state">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-text-muted">جاري تحميل هيكل ومحتوى المقرر...</p>
      </div>
    );
  }

  // 4. General Error State (e.g. 404 Not Found)
  if (!course) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto">
          <Icon name="alertCircle" size="lg" />
        </div>
        <h1 className="text-xl font-bold text-text-heading">خطأ في فتح المقرر التدريبي</h1>
        <p className="text-sm text-text-muted leading-relaxed">
          {errorMessage || 'تعذر العثور على المقرر التدريبي المطلوب.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" onClick={loadCourseData}>
            إعادة المحاولة
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/lecturer/courses')}>
            العودة للقائمة
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto" data-testid="course-builder-page">
      {/* Top Sticky Authoring Header */}
      <div className="sticky top-2 z-30 p-4 rounded-2xl bg-surface/95 backdrop-blur-md border border-border shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackToCourses}
            className="p-2 rounded-xl border border-border hover:bg-neutral-light text-text transition-colors"
            title="العودة إلى قائمة الدورات"
            aria-label="العودة إلى قائمة الدورات"
            data-testid="builder-back-btn"
          >
            <Icon name="arrowRight" size="sm" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-text-heading truncate max-w-md">
                {course.title}
              </h1>
              <Badge variant="neutral" className="text-xs font-mono font-bold">
                {course.id}
              </Badge>
              <Badge
                variant={isPublished ? 'success' : course.status === 'pending_admin' ? 'warning' : 'neutral'}
                className="text-xs"
              >
                {isPublished ? 'منشور' : course.status === 'pending_admin' ? 'ينتظر الاعتماد' : 'مسودة'}
              </Badge>
              {course.isTestLab && (
                <Badge
                  variant="primary"
                  className="text-xs bg-primary/20 text-primary-light border-primary/40 font-bold"
                  data-testid="test-lab-badge"
                >
                  معمل تجريبي
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-text-muted mt-0.5">
              <span>المحاضر: {course.lecturerName}</span>
              {isDirty && (
                <span className="text-warning-dark font-bold flex items-center gap-1" data-testid="unsaved-badge">
                  ● تعديلات غير محفوظة
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
          {course.isTestLab && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon="refreshCw"
              onClick={handleResetLab}
              disabled={isResettingLab || isSaving}
              className="text-xs font-semibold text-warning-dark border-warning/40 hover:bg-warning/10"
              title="إعادة ضبط المعمل إلى السيناريوهات الافتراضية الأصلية ومسح المسودات"
              data-testid="reset-test-lab-btn"
            >
              {isResettingLab ? 'جاري إعادة الضبط...' : 'إعادة ضبط المعمل'}
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon="link"
            onClick={() => setIsQrModalOpen(true)}
            className="text-xs font-semibold"
            title="عرض وتنزيل رمز QR المباشر للمقرر"
            data-testid="builder-course-qr-btn"
          >
            رمز QR
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate(`/courses/${encodeURIComponent(course.id)}?preview=true`)}
            className="text-xs font-semibold"
            data-testid="builder-preview-btn"
          >
            معاينة الدورة
          </Button>

          {!isPendingReview && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSubmitForReview}
              disabled={isSubmittingReview || isSaving || isDirty}
              className="font-bold text-xs text-primary border-primary/40 hover:bg-primary/10 shadow-2xs gap-1.5"
              data-testid="builder-submit-for-review-btn"
            >
              <Icon name="checkCircle" size="sm" />
              <span>
                {isSubmittingReview
                  ? 'جاري التقديم...'
                  : isResubmission
                  ? 'إعادة التقديم للاعتماد'
                  : 'تقديم للاعتماد'}
              </span>
            </Button>
          )}

          <Button
            type="button"
            variant="primary"
            size="sm"
            leftIcon="save"
            onClick={handleSaveDraft}
            disabled={isSaving || !isDirty || isPendingReview}
            className="font-bold px-4 shadow-sm"
            data-testid="save-draft-btn"
          >
            {isSaving ? 'جاري الحفظ...' : 'حفظ كمسودة'}
          </Button>
        </div>
      </div>

      {/* Recovered Local Backup Banner */}
      {hasRestoredBackup && (
        <Alert
          variant="warning"
          onClose={() => setHasRestoredBackup(false)}
          data-testid="recovered-backup-banner"
        >
          <div className="flex items-center justify-between text-xs">
            <span>
              تم استرجاع تعديلات غير محفوظة محفوظة محلياً على هذا الجهاز من جلسة سابقة. يمكنك حفظها أو التراجع عنها.
            </span>
            <button
              onClick={() => {
                localStorage.removeItem(`metro_builder_draft_${courseId}`);
                loadCourseData();
                setHasRestoredBackup(false);
              }}
              className="underline font-bold mr-3"
            >
              تجاهل واستعادة الأصل
            </button>
          </div>
        </Alert>
      )}

      {/* Error Message */}
      {errorMessage && (
        <Alert variant="danger" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {/* Pending Review Banner (Read-only Guard) */}
      {isPendingReview && (
        <div
          className="p-4 rounded-xl border border-warning/40 bg-warning/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
          data-testid="pending-review-banner"
          dir="rtl"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-warning/20 text-warning-dark flex items-center justify-center shrink-0">
              <Icon name="clock" size="md" />
            </div>
            <div>
              <div className="font-bold text-text-heading text-sm mb-0.5">
                المقرر قيد المراجعة والاعتماد حالياً
              </div>
              <p className="text-text-muted leading-relaxed">
                المقرر قيد المراجعة والاعتماد حالياً لدى إدارة التدريب والجودة ولا يمكن تعديله حتى صدور القرار الرسمي.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/approvals')}
            data-testid="view-approvals-status-btn"
            className="shrink-0 font-bold"
          >
            متابعة في لوحة الاعتمادات
          </Button>
        </div>
      )}

      {/* Official Lecturer Feedback Banner (Phase 7) */}
      {course.activeReviewFeedback && !isPendingReview && (
        <ActiveReviewFeedbackBanner
          feedback={course.activeReviewFeedback}
          onOpenDiff={() => setIsDiffModalOpen(true)}
          hasSnapshots={Boolean(latestReturnedAuditEntry)}
          onResubmit={handleSubmitForReview}
          isResubmitting={isSubmittingReview}
        />
      )}

      {/* Published Course Notice */}
      {isPublished && !isPendingReview && (
        <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between text-xs text-text-heading">
          <div className="flex items-center gap-2">
            <Icon name="info" size="sm" className="text-primary" />
            <span>
              <strong>مقرر منشور ومفعل:</strong> التعديلات التي تجريها تحفظ كمسودة مستقلة دون التأثير على النسخة المنشورة الحالية للمتدربين.
            </span>
          </div>
        </div>
      )}

      {/* Tab Navigation Controls */}
      <div className="border-b border-border flex items-center gap-2">
        {(
          [
            { id: 'metadata', label: 'البيانات الأساسية', icon: 'courses' },
            { id: 'curriculum', label: 'هيكل المنهج والمحتوى', icon: 'courses' },
            { id: 'downloads', label: 'سياسات التنزيل والملفات', icon: 'download' },
            { id: 'refresher', label: 'النسخة التذكيرية', icon: 'refreshCw' },
            {
              id: 'history',
              label: `سجل النشاط والقرارات (${course.auditLog?.length || 0})`,
              icon: 'clock',
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-text-muted hover:text-text hover:bg-neutral-light/50'
            }`}
            data-testid={`builder-tab-${tab.id}`}
          >
            <Icon name={tab.icon} size="sm" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content Panels */}
      {activeTab === 'metadata' ? (
        <div className="space-y-6" data-testid="metadata-tab-container">
          <MetadataEditor
            course={course}
            onChange={(updated) => setCourse(updated)}
            availableCourses={availableCourses}
            isAdmin={user?.role === 'admin'}
          />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border p-6 shadow-xs">
          {activeTab === 'curriculum' && (
            <CurriculumTreeEditor
              chapters={course.chapters}
              onChange={(updatedChapters) =>
                setCourse({ ...course, chapters: updatedChapters })
              }
              mode="curriculum"
              refresherConfig={course.refresherConfig}
              onRefresherConfigChange={(updatedRefresher) =>
                setCourse({ ...course, refresherConfig: updatedRefresher })
              }
              feedbackItems={course.activeReviewFeedback?.items}
              readOnly={isPendingReview}
            />
          )}

          {activeTab === 'downloads' && (
            <DownloadPoliciesEditor
              course={course}
              onChange={(updatedCourse) => setCourse(updatedCourse)}
            />
          )}

          {activeTab === 'refresher' && (
            <CurriculumTreeEditor
              chapters={course.chapters}
              onChange={(updatedChapters) =>
                setCourse({ ...course, chapters: updatedChapters })
              }
              mode="refresher"
              refresherConfig={course.refresherConfig}
              onRefresherConfigChange={(updatedRefresher) =>
                setCourse({ ...course, refresherConfig: updatedRefresher })
              }
              feedbackItems={course.activeReviewFeedback?.items}
              readOnly={isPendingReview}
            />
          )}

          {activeTab === 'history' && (
            <div className="space-y-4" data-testid="builder-history-panel" dir="rtl">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div>
                  <h3 className="font-bold text-base text-text">سجل قرارات واعتمادات المقرر</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    السجل الرسمي لعمليات التقديم، الاعتماد، والإعادة مع التغذية الراجعة من إدارة التدريب والجودة.
                  </p>
                </div>
                <Badge variant="neutral" size="sm">
                  {course.auditLog?.length || 0} أحداث رسمية
                </Badge>
              </div>

              {!course.auditLog || course.auditLog.length === 0 ? (
                <div className="p-12 text-center text-text-muted text-sm bg-surface-muted/30 rounded-xl border border-border">
                  لا توجد قيود أو قرارات رسمية مسجلة لهذا المقرر حتى الآن.
                </div>
              ) : (
                <div className="space-y-3" data-testid="builder-audit-list">
                  {[...course.auditLog].reverse().map((entry, idx) => (
                    <div
                      key={entry.id || idx}
                      className="p-4 bg-surface rounded-xl border border-border space-y-2 shadow-2xs"
                      data-testid={`builder-audit-entry-${idx}`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          {entry.action === 'submitted' && (
                            <Badge variant="info" size="sm">
                              تقديم للمراجعة
                            </Badge>
                          )}
                          {entry.action === 'resubmitted' && (
                            <Badge variant="info" size="sm">
                              إعادة تقديم
                            </Badge>
                          )}
                          {entry.action === 'approved' && (
                            <Badge variant="success" size="sm">
                              اعتماد ونشر
                            </Badge>
                          )}
                          {entry.action === 'returned_with_admin_edits' && (
                            <Badge variant="warning" size="sm">
                              إعادة بتعديلات الإدارة
                            </Badge>
                          )}
                          {entry.action === 'rejected' && (
                            <Badge variant="danger" size="sm">
                              إعادة بطلب تعديلات
                            </Badge>
                          )}
                          <span className="text-xs font-semibold text-text">
                            بواسطة: {entry.actorName} ({entry.actorRole === 'admin' ? 'مدير نظام ومراجع جودة' : 'محاضر'})
                          </span>
                        </div>
                        <span className="text-xs text-text-muted font-mono">
                          {new Date(entry.timestamp).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {entry.feedback && (
                        <div className="p-3 bg-surface-muted/50 rounded-lg border border-border text-xs space-y-1">
                          <span className="font-bold text-text block">
                            التغذية الراجعة الرسمية:
                          </span>
                          <p className="text-text-muted leading-relaxed">
                            {entry.feedback.summaryMessage}
                          </p>
                        </div>
                      )}

                      {entry.approvalNote && (
                        <div className="p-3 bg-surface-muted/50 rounded-lg border border-border text-xs space-y-1">
                          <span className="font-bold text-success block">
                            ملاحظة الاعتماد:
                          </span>
                          <p className="text-text-muted leading-relaxed">
                            {entry.approvalNote}
                          </p>
                        </div>
                      )}

                      {entry.baselineSnapshot && entry.adminEditedSnapshot && (
                        <div className="pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedHistoryDiffEntry(entry)}
                            className="text-xs font-semibold text-primary border-primary/30 hover:bg-primary/5 gap-1.5"
                            data-testid={`builder-view-entry-diff-btn-${idx}`}
                          >
                            <Icon name="courses" size="sm" />
                            <span>
                              {entry.action === 'approved'
                                ? 'عرض مقارنة التعديلات المعتمدة للمقرر'
                                : 'عرض مقارنة تعديلات الإدارة المعادة'}
                            </span>
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Course QR Code Modal */}
      {isQrModalOpen && (
        <QRCodeModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          title={course.title}
          url={`${window.location.origin}/courses/${encodeURIComponent(course.id)}`}
          subtitle={`المحاضر: ${course.lecturerName}`}
          badgeLabel={`المقرر ${course.id}`}
          downloadFilename={`course-${course.id}-qr.png`}
          isExternalResource={false}
        />
      )}

      {/* Unified Unsaved Changes Leave Confirmation Dialog */}
      {guardDialog}

      {/* Reset Test Lab Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isResetLabDialogOpen}
        title="إعادة ضبط معمل الاختبار"
        message="هل أنت متأكد من رغبتك في إعادة ضبط معمل تجربة المحتوى إلى حالته الافتراضية؟ سيتم مسح أي مسودة وتعديلات غير محفوظة واستعادة السيناريوهات الاختبارية الستة الأصلية."
        confirmLabel="إعادة ضبط المعمل"
        cancelLabel="إلغاء"
        variant="warning"
        isConfirming={isResettingLab}
        onConfirm={executeResetLab}
        onCancel={() => setIsResetLabDialogOpen(false)}
        testId="reset-lab-dialog"
        confirmTestId="confirm-delete-btn"
        cancelTestId="confirm-cancel-btn"
      />

      {/* Dual-Snapshot Structured Diff Viewer Modal (Phase 7 & Increment 9) */}
      {(isDiffModalOpen || Boolean(selectedHistoryDiffEntry)) && (
        <CourseDiffViewerModal
          isOpen={true}
          onClose={() => {
            setIsDiffModalOpen(false);
            setSelectedHistoryDiffEntry(null);
          }}
          baselineSnapshot={
            selectedHistoryDiffEntry?.baselineSnapshot || latestReturnedAuditEntry?.baselineSnapshot
          }
          adminEditedSnapshot={
            selectedHistoryDiffEntry?.adminEditedSnapshot || latestReturnedAuditEntry?.adminEditedSnapshot
          }
        />
      )}
    </div>
  );
};

export default CourseBuilderPage;
