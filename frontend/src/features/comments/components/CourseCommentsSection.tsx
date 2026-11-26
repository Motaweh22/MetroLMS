import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useToast } from '@/shared/ui/Toast';
import { commentsApi } from '../services/commentsApi';
import { ReportCommentModal } from './ReportCommentModal';
import { getCommentCardAppearance } from '../utils/commentRolePresentation';
import type { CourseComment } from '@/core/comments/types';

export interface CourseCommentsSectionProps {
  courseId: string;
  courseTitle?: string;
  commentsEnabled?: boolean;
  isEnrolled?: boolean;
  courseLecturerId?: string;
  courseCoLecturers?: string[];
  isInstructor?: boolean;
  theme?: 'light' | 'dark';
  className?: string;
}

export const CourseCommentsSection: React.FC<CourseCommentsSectionProps> = ({
  courseId,
  courseTitle,
  commentsEnabled: propCommentsEnabled,
  isEnrolled = false,
  courseLecturerId,
  courseCoLecturers,
  isInstructor,
  theme = 'light',
  className = '',
}) => {
  const isDark = theme === 'dark';
  const { user } = useAuth();
  const toast = useToast();

  const [comments, setComments] = useState<CourseComment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // New comment input state
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reporting dialog state
  const [reportingComment, setReportingComment] = useState<CourseComment | null>(null);

  // Deletion confirm dialog state
  const [deletingComment, setDeletingComment] = useState<CourseComment | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Load comments from API
  const fetchComments = useCallback(async () => {
    if (!courseId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await commentsApi.getCourseComments(courseId);
      setComments(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'تعذر تحميل نقاشات الدورة التدريبية';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Determine if comments are enabled
  // Prefer explicit prop if defined; otherwise check commentsEnabled attribute from loaded comments
  const areCommentsEnabled =
    typeof propCommentsEnabled === 'boolean'
      ? propCommentsEnabled
      : comments.length > 0 && typeof comments[0].commentsEnabled === 'boolean'
      ? comments[0].commentsEnabled
      : true;

  // Participant permission derivation
  const isTrainee = user?.role === 'user';
  const isLecturer = user?.role === 'lecturer';
  const isAdmin =
    user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'developer';
  const isAssistantAdmin = user?.role === 'assistant_admin';

  const isAssignedInstructor =
    typeof isInstructor === 'boolean'
      ? isInstructor
      : isLecturer
      ? courseLecturerId
        ? Boolean(
            (user?.id && user.id.toLowerCase() === courseLecturerId.toLowerCase()) ||
            (courseCoLecturers && user?.id && courseCoLecturers.some((id) => id.toLowerCase() === user.id.toLowerCase()))
          )
        : true // Fallback when courseLecturerId is omitted
      : false;

  // Can post:
  // - System admin (admin)
  // - Assigned course instructor (lecturer where isAssignedInstructor === true)
  // - Enrolled trainee (user where isEnrolled === true)
  // (assistant_admin is strictly excluded from posting comments on courses)
  const canPostComment =
    areCommentsEnabled &&
    (isAdmin || (isLecturer && isAssignedInstructor) || (isTrainee && isEnrolled));

  // Can report:
  // - Enrolled trainee (user where isEnrolled === true)
  // - Assigned course instructor (lecturer where isAssignedInstructor === true)
  // (admin and assistant_admin do not report; they moderate directly or via admin queue)
  const canReportComment =
    areCommentsEnabled &&
    ((isTrainee && isEnrolled) || (isLecturer && isAssignedInstructor));

  // Handle comment submission
  const handleSubmitComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCommentText.trim();
    if (!trimmed) {
      setSubmitError('نص التعليق مطلوب ولا يمكن أن يكون فارغاً');
      return;
    }

    if (!areCommentsEnabled) {
      setSubmitError('التعليقات مغلقة على هذا الكورس.');
      return;
    }

    if (isAssistantAdmin) {
      setSubmitError('غير مصرح: حساب مدير النظام المساعد مخصص للإشراف والاعتمادات فقط');
      return;
    }

    if (isLecturer && !isAssignedInstructor) {
      setSubmitError('غير مصرح: لا يمتلك المحاضر صلاحية المشاركة في نقاشات مقرر غير مسند إليه');
      return;
    }

    if (isTrainee && !isEnrolled) {
      setSubmitError('يجب أن تكون مسجلاً في المقرر للمشاركة في النقاشات');
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const created = await commentsApi.createComment(courseId, trimmed);
      // Prepend the new comment to the list
      setComments((prev) => [created, ...prev]);
      setNewCommentText('');
      toast.success('تم إرسال التعليق بنجاح');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('metro:notifications-changed'));
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'فشلت إضافة التعليق، يرجى المحاولة لاحقاً';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle successful report
  const handleReportSuccess = (updatedComment: CourseComment) => {
    const targetId = updatedComment?.id || reportingComment?.id;
    setComments((prev) =>
      prev.map((c) =>
        c.id === targetId
          ? {
              ...c,
              ...updatedComment,
              reported: true,
              reportedBy: user?.id,
            }
          : c
      )
    );
    toast.success('تم إرسال البلاغ. سيتم مراجعته من قِبل الإدارة');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('metro:notifications-changed'));
    }
  };

  // Handle comment deletion (for instructors / admins)
  const handleConfirmDelete = async () => {
    if (!deletingComment) return;
    setIsDeleting(true);

    try {
      if (user?.role === 'lecturer') {
        // Lecturer course-scoped deletion
        await commentsApi.deleteCourseComment(courseId, deletingComment.id);
      } else {
        // Admin / Assistant Admin deletion
        const res = await commentsApi.deleteComment(deletingComment.id);
        if (res.approvalRequired) {
          toast.info(res.message || 'تم إرسال طلب حذف التعليق للاعتماد بنجاح');
          setDeletingComment(null);
          setIsDeleting(false);
          return;
        }
      }

      setComments((prev) => prev.filter((c) => c.id !== deletingComment.id));
      toast.success('تم حذف التعليق بنجاح');
      setDeletingComment(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'فشل حذف التعليق';
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const canDeleteComment = (): boolean => {
    if (!user) return false;
    if (isAdmin || isAssistantAdmin) return true;
    if (isLecturer && isAssignedInstructor) return true;
    return false;
  };

  const formatCommentDate = (comment: CourseComment): string => {
    if (comment.time && comment.time === 'الآن') return 'الآن';
    try {
      const date = new Date(comment.createdAt);
      if (isNaN(date.getTime())) return comment.time || 'مؤخراً';
      return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return comment.time || 'مؤخراً';
    }
  };

  return (
    <div
      className={`rounded-xl border p-5 space-y-5 shadow-xs text-right ${
        isDark
          ? 'bg-[#0F172A]/90 border-white/10 text-slate-100'
          : 'bg-surface border-border'
      } ${className}`}
      data-testid="course-comments-section"
    >
      {/* Section Header */}
      <div
        className={`flex items-center justify-between pb-3 border-b ${
          isDark ? 'border-white/10' : 'border-border/70'
        }`}
      >
        <div
          className={`flex items-center gap-2 font-bold text-sm sm:text-base ${
            isDark ? 'text-slate-100' : 'text-text-heading'
          }`}
        >
          <Icon name="messageSquare" size="md" className={isDark ? 'text-sky-400' : 'text-primary-dark'} />
          <span>النقاشات والتعليقات</span>
          <Badge variant="neutral" className="font-mono text-xs px-2">
            {comments.length}
          </Badge>
        </div>
        {courseTitle && (
          <span
            className={`text-xs font-normal hidden sm:inline ${
              isDark ? 'text-slate-400' : 'text-text-muted'
            }`}
          >
            {courseTitle}
          </span>
        )}
      </div>

      {/* Discussion Status Banner when Closed */}
      {!areCommentsEnabled && (
        <div
          className={`rounded-xl border p-4 text-center text-xs sm:text-sm font-semibold space-y-1 ${
            isDark
              ? 'bg-white/5 border-white/10 text-slate-300'
              : 'bg-neutral-light border-border/80 text-text-muted'
          }`}
          data-testid="comments-disabled-banner"
        >
          <div className={`flex items-center justify-center gap-2 ${isDark ? 'text-amber-300' : 'text-warning-dark'}`}>
            <Icon name="lock" size="sm" />
            <span className="font-bold">التعليقات مغلقة على هذا الكورس.</span>
          </div>
          <p className={`text-[11px] font-normal ${isDark ? 'text-slate-400' : 'text-text-muted'}`}>
            يمكنك استعراض المشاركات السابقة كمرجع تعليمي، بينما تم إيقاف إضافة تعليقات جديدة مؤقتاً.
          </p>
        </div>
      )}

      {/* Enrollment Required Banner for Unenrolled Trainees */}
      {areCommentsEnabled && isTrainee && !isEnrolled && (
        <div
          className={`rounded-xl border p-4 text-center text-xs sm:text-sm space-y-2 ${
            isDark
              ? 'bg-sky-500/10 border-sky-400/25 text-slate-100'
              : 'bg-primary/5 border-primary/20 text-text-heading'
          }`}
          data-testid="enrollment-required-banner"
        >
          <div className={`flex items-center justify-center gap-2 font-bold ${isDark ? 'text-sky-300' : 'text-primary-dark'}`}>
            <Icon name="info" size="sm" />
            <span>سجّل في الكورس للمشاركة في النقاشات</span>
          </div>
          <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-text-muted'}`}>
            النقاشات مخصصة للمتدربين المسجلين بالمقرر لتبادل الأسئلة مع المحاضر والزملاء.
          </p>
        </div>
      )}

      {/* Comment Submission Composer (Enabled for enrolled learners, instructors, admins) */}
      {canPostComment && (
        <form
          onSubmit={handleSubmitComment}
          className={`space-y-3 border rounded-xl p-3.5 ${
            isDark
              ? 'bg-white/[0.03] border-white/10'
              : 'bg-neutral-light/50 border-border/60'
          }`}
          data-testid="comment-composer-form"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="course-comment-input"
              className={`block text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-text-heading'}`}
            >
              أضف استفسارك أو تعليقك حول محتوى المقرر: <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <textarea
              id="course-comment-input"
              data-testid="comment-input"
              rows={3}
              value={newCommentText}
              onChange={(e) => {
                setNewCommentText(e.target.value);
                if (submitError) setSubmitError(null);
              }}
              disabled={isSubmitting}
              placeholder="اكتب تعليقك أو سؤالك هنا..."
              className={`w-full p-3 text-xs sm:text-sm rounded-lg border focus:outline-none resize-vertical ${
                isDark
                  ? 'bg-[#070B14]/80 border-white/15 text-slate-100 placeholder:text-slate-500 focus:border-sky-400'
                  : 'border-border bg-surface text-text focus:border-primary'
              }`}
            />
          </div>

          {submitError && (
            <Alert variant="danger" data-testid="comment-submit-error">
              <div className="flex items-center gap-1.5 text-xs">
                <Icon name="alertCircle" size="sm" />
                <span>{submitError}</span>
              </div>
            </Alert>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-text-muted'}`}>
              يرجى الالتزام بآداب الحوار الأكاديمي والمهني.
            </span>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              leftIcon={isSubmitting ? undefined : 'send'}
              isLoading={isSubmitting}
              disabled={isSubmitting || !newCommentText.trim()}
              data-testid="submit-comment-button"
            >
              {isSubmitting ? 'جاري الإرسال...' : 'إرسال التعليق'}
            </Button>
          </div>
        </form>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3" data-testid="course-comments-loading">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-neutral-light/40 border border-border/60 rounded-xl p-4 animate-pulse space-y-2.5"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-border/60" />
                <div className="h-4 bg-border/60 rounded w-28" />
                <div className="h-3 bg-border/40 rounded w-16" />
              </div>
              <div className="h-10 bg-border/40 rounded-lg w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div
          className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-center space-y-2 text-danger"
          data-testid="course-comments-error"
        >
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold">
            <Icon name="alertCircle" size="sm" />
            <span>{error}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            leftIcon="refresh"
            onClick={fetchComments}
            className="text-xs"
            data-testid="retry-comments-button"
          >
            إعادة المحاولة
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && comments.length === 0 && (
        <div
          className={`border border-dashed rounded-xl p-8 text-center space-y-2 ${
            isDark
              ? 'bg-white/[0.02] border-white/15'
              : 'bg-neutral-light/30 border-border'
          }`}
          data-testid="course-comments-empty"
        >
          <div
            className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center ${
              isDark ? 'bg-sky-500/15 text-sky-400' : 'bg-primary/10 text-primary-dark'
            }`}
          >
            <Icon name="messageSquare" size="md" />
          </div>
          <h4 className={`text-xs sm:text-sm font-bold ${isDark ? 'text-slate-100' : 'text-text-heading'}`}>
            لا توجد تعليقات حتى الآن
          </h4>
          <p className={`text-[11px] max-w-sm mx-auto ${isDark ? 'text-slate-400' : 'text-text-muted'}`}>
            {areCommentsEnabled
              ? 'كن أول من يبدأ النقاش ويشارك استفساره أو رأيه حول محتوى هذا البرنامج التدريبي.'
              : 'لم تتم إضافة أي مشاركات أثناء فترة فتح النقاشات على هذا المقرر.'}
          </p>
        </div>
      )}

      {/* Comments List */}
      {!isLoading && !error && comments.length > 0 && (
        <div className="space-y-3" data-testid="course-comments-list">
          {comments.map((comment) => {
            const appearance = getCommentCardAppearance(
              comment,
              user?.id,
              courseCoLecturers,
              isDark
            );
            const isReportedByMe = comment.reportedBy === user?.id;

            return (
              <div
                key={comment.id}
                className={`p-4 rounded-xl border transition-colors ${appearance.cardClass}`}
                data-testid={`comment-card-${comment.id}`}
              >
                {/* Comment Header: Author, Badge, Timestamp & Actions */}
                <div className="flex items-start justify-between gap-2.5 pb-2">
                  <div className="flex items-center gap-2.5">
                    {/* User Avatar Circle */}
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${appearance.avatarClass}`}
                      data-testid="comment-avatar"
                    >
                      {comment.userInitial || (comment.userName || 'م').charAt(0)}
                    </div>

                    {/* Author Meta */}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-bold text-xs sm:text-sm ${isDark ? 'text-slate-100' : 'text-text-heading'}`}
                          data-testid="comment-author-name"
                        >
                          {comment.userName}
                        </span>

                        {appearance.roleBadgeLabel && (
                          <Badge variant={appearance.roleBadgeVariant} size="sm" data-testid="comment-role-badge">
                            {appearance.roleBadgeLabel}
                          </Badge>
                        )}
                        {appearance.isOwnComment && (
                          <Badge variant="success" size="sm" data-testid="comment-own-badge">
                            تعليقك
                          </Badge>
                        )}
                      </div>

                      <span
                        className={`text-[11px] block ${isDark ? 'text-slate-400' : 'text-text-muted'}`}
                        data-testid="comment-date"
                      >
                        {formatCommentDate(comment)}
                      </span>
                    </div>
                  </div>

                  {/* Actions: Report (Enrolled Trainee / Assigned Instructor, never own comment) or Delete (Instructor/Admin) */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Report Button (Visible only when discussion is open, user is enrolled/assigned, and NOT author's own comment) */}
                    {areCommentsEnabled && canReportComment && !appearance.isOwnComment && (
                      isReportedByMe ? (
                        <button
                          type="button"
                          disabled
                          className="text-[11px] font-semibold text-text-muted/60 cursor-default px-2 py-1 rounded"
                          data-testid={`comment-reported-${comment.id}`}
                        >
                          تم الإبلاغ ✓
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReportingComment(comment)}
                          className="text-[11px] font-semibold text-danger hover:text-danger-dark transition-colors px-2 py-1 rounded hover:bg-danger/10 flex items-center gap-1 cursor-pointer"
                          data-testid={`report-comment-btn-${comment.id}`}
                        >
                          <Icon name="alert" size="sm" />
                          <span>إبلاغ</span>
                        </button>
                      )
                    )}

                    {/* Instructor / Admin Deletion Button */}
                    {canDeleteComment() && (
                      <button
                        type="button"
                        onClick={() => setDeletingComment(comment)}
                        className="text-[11px] font-semibold text-danger hover:text-danger-dark transition-colors px-2 py-1 rounded hover:bg-danger/10 flex items-center gap-1 cursor-pointer"
                        data-testid={`delete-comment-btn-${comment.id}`}
                        title="حذف التعليق"
                      >
                        <Icon name="trash" size="sm" />
                        <span className="hidden sm:inline">حذف</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Comment Body Text (Safely rendered as React text node) */}
                <div
                  className={`pt-1 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-normal ${
                    isDark ? 'text-slate-200' : 'text-text'
                  }`}
                >
                  {comment.text}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reporting Modal */}
      <ReportCommentModal
        isOpen={Boolean(reportingComment)}
        comment={reportingComment}
        onClose={() => setReportingComment(null)}
        onSuccess={handleReportSuccess}
      />

      {/* Comment Deletion Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingComment)}
        title="تأكيد حذف التعليق"
        message={
          deletingComment ? (
            <span>
              هل أنت متأكد من رغبتك في حذف تعليق المتدرب{' '}
              <strong className="text-text-heading font-bold">{deletingComment.userName}</strong> نهائياً من نقاشات المقرر؟
            </span>
          ) : (
            'هل أنت متأكد من رغبتك في حذف هذا التعليق؟'
          )
        }
        confirmLabel="حذف التعليق"
        cancelLabel="إلغاء"
        variant="danger"
        isConfirming={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingComment(null)}
        testId="delete-comment-confirm-dialog"
        confirmTestId="confirm-delete-comment-button"
        cancelTestId="cancel-delete-comment-button"
      />
    </div>
  );
};

export default CourseCommentsSection;
