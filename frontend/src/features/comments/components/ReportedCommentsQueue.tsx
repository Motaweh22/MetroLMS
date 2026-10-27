import React from 'react';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import type { CourseComment } from '@/core/comments/types';
import { COMMENT_REPORT_REASONS_AR } from '@/core/comments/types';
import { ROLE_CANONICAL_LABELS_AR } from '@/core/permissions/types';

export interface ReportedCommentsQueueProps {
  comments: CourseComment[];
  isLoading: boolean;
  onDelete: (comment: CourseComment) => void;
  onIgnoreReport: (comment: CourseComment) => void;
  isActionInProgress?: boolean;
}

export const ReportedCommentsQueue: React.FC<ReportedCommentsQueueProps> = ({
  comments,
  isLoading,
  onDelete,
  onIgnoreReport,
  isActionInProgress = false,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="reported-queue-loading">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-3 animate-pulse"
          >
            <div className="h-5 bg-bg-alt rounded-lg w-1/3" />
            <div className="h-16 bg-bg-alt/60 rounded-xl" />
            <div className="flex justify-between items-center pt-2">
              <div className="h-4 bg-bg-alt rounded w-1/4" />
              <div className="h-8 bg-bg-alt rounded-xl w-36" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div
        className="bg-surface border border-border rounded-2xl p-10 text-center space-y-3 shadow-sm"
        data-testid="reported-queue-empty"
      >
        <div className="w-14 h-14 mx-auto rounded-full bg-success-light text-success flex items-center justify-center">
          <Icon name="checkCircle" size="xl" />
        </div>
        <h3 className="text-base font-bold text-text-heading">لا توجد تعليقات مُبلَّغ عنها حالياً</h3>
        <p className="text-xs sm:text-sm text-text-muted max-w-md mx-auto">
          كافة نقاشات ومشاركات المقررات التدريبية نظيفة ومطابقة لمعايير المجتمع الأكاديمي، ولم يتم تسجيل أي بلاغات نشطة معلقة.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-right" data-testid="reported-comments-queue">
      {comments.map((comment) => {
        const reportReasonLabel =
          COMMENT_REPORT_REASONS_AR[comment.reportReason as keyof typeof COMMENT_REPORT_REASONS_AR] ||
          comment.reportReasonLabelAr ||
          comment.reportReason ||
          'محتوى غير لائق';

        const roleLabel =
          ROLE_CANONICAL_LABELS_AR[comment.userRole as keyof typeof ROLE_CANONICAL_LABELS_AR] ||
          comment.userRole ||
          'متدرب';

        const formattedDate = comment.reportedAt
          ? new Date(comment.reportedAt).toLocaleDateString('ar-EG', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : comment.time || 'مؤخراً';

        return (
          <div
            key={comment.id}
            className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 hover:border-primary/40 transition-all"
            data-testid={`reported-comment-card-${comment.id}`}
          >
            {/* Card Header: Course Title & Reason Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-border/70">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary-dark flex items-center justify-center shrink-0">
                  <Icon name="courses" size="sm" />
                </span>
                <span className="font-bold text-sm sm:text-base text-primary-dark" data-testid="comment-course-title">
                  {comment.courseTitle}
                </span>
                <span className="font-mono text-xs text-text-muted">({comment.courseId})</span>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="danger" size="sm" icon="alertCircle" data-testid="report-reason-badge">
                  {reportReasonLabel}
                </Badge>
              </div>
            </div>

            {/* Comment Quote Box */}
            <div className="bg-bg-alt/50 border border-border/80 rounded-xl p-3.5 sm:p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-text" data-testid="comment-author-name">
                    {comment.userName}
                  </span>
                  <Badge variant="neutral" size="sm">
                    {roleLabel}
                  </Badge>
                </div>
                <span className="text-[11px] text-text-muted">
                  {comment.createdAt ? new Date(comment.createdAt).toLocaleString('ar-EG') : comment.time || '-'}
                </span>
              </div>

              <p
                className="text-xs sm:text-sm text-text leading-relaxed whitespace-pre-wrap select-text"
                data-testid="comment-text-content"
              >
                {comment.text}
              </p>
            </div>

            {/* Card Footer: Reporter Identity & Moderation Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="text-xs text-text-muted flex items-center gap-1.5" data-testid="reporter-info">
                <Icon name="user" size="sm" className="text-text-muted shrink-0" />
                <span>
                  أُبلغ عنه بواسطة:{' '}
                  <strong className="text-text font-semibold">
                    {comment.reportedByName || comment.reportedBy || 'مستخدم المنظومة'}
                  </strong>
                </span>
                <span>•</span>
                <span>{formattedDate}</span>
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onIgnoreReport(comment)}
                  disabled={isActionInProgress}
                  data-testid={`ignore-report-btn-${comment.id}`}
                >
                  <Icon name="check" size="sm" className="ml-1 text-success" />
                  تجاهل البلاغ
                </Button>

                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => onDelete(comment)}
                  disabled={isActionInProgress}
                  data-testid={`delete-comment-btn-${comment.id}`}
                >
                  <Icon name="trash" size="sm" className="ml-1" />
                  حذف التعليق
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
