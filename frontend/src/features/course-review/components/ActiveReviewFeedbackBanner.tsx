import React from 'react';
import type { CourseActiveReviewFeedback } from '@/core/courses/types';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';

export interface ActiveReviewFeedbackBannerProps {
  feedback: CourseActiveReviewFeedback;
  onOpenDiff?: () => void;
  hasSnapshots?: boolean;
  onResubmit?: () => void;
  isResubmitting?: boolean;
  testId?: string;
}

/**
 * Format decision timestamp in Arabic or return neutral label "غير متوفر"
 */
function formatDecisionTimestamp(timestamp?: string | null): string {
  if (!timestamp || !timestamp.trim()) {
    return 'غير متوفر';
  }
  try {
    const d = new Date(timestamp);
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

/**
 * ActiveReviewFeedbackBanner — Phase 7: Lecturer Course Builder Feedback
 *
 * Displays official reviewer feedback, outcome status badge, decision timestamp,
 * reviewer summary message, contextual chapter/item note indicators count,
 * and direct action to view dual-snapshot diffs if admin edits were returned.
 */
export const ActiveReviewFeedbackBanner: React.FC<ActiveReviewFeedbackBannerProps> = ({
  feedback,
  onOpenDiff,
  hasSnapshots = true,
  onResubmit,
  isResubmitting = false,
  testId = 'active-review-feedback-banner',
}) => {
  const isReturnedWithEdits = feedback.outcome === 'returned_with_admin_edits';
  const isRejected = feedback.outcome === 'rejected';

  const formattedDate = formatDecisionTimestamp(feedback.reviewedAt);
  const reviewerDisplayName = feedback.reviewerName?.trim() || 'غير متوفر';
  const contextualItemsCount = feedback.items?.length || 0;

  return (
    <div
      className={`p-5 rounded-2xl border transition-all ${
        isReturnedWithEdits
          ? 'bg-warning/5 border-warning/30 shadow-xs'
          : isRejected
          ? 'bg-danger/5 border-danger/30 shadow-xs'
          : 'bg-primary/5 border-primary/30 shadow-xs'
      }`}
      data-testid={testId}
      dir="rtl"
    >
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        {/* Main Feedback Information */}
        <div className="space-y-3 flex-1">
          {/* Header Row: Outcome Badge & Title */}
          <div className="flex flex-wrap items-center gap-2.5">
            {isReturnedWithEdits && (
              <Badge
                variant="warning"
                size="md"
                className="font-bold gap-1"
                data-testid="feedback-outcome-badge"
              >
                <Icon name="edit" size="sm" />
                <span>إعادة المقرر مع تعديلات الإدارة</span>
              </Badge>
            )}

            {isRejected && (
              <Badge
                variant="danger"
                size="md"
                className="font-bold gap-1"
                data-testid="feedback-outcome-badge"
              >
                <Icon name="alert" size="sm" />
                <span>مرفوض / يتطلب تعديلات</span>
              </Badge>
            )}

            {!isReturnedWithEdits && !isRejected && (
              <Badge
                variant="neutral"
                size="md"
                className="font-bold"
                data-testid="feedback-outcome-badge"
              >
                تغذية راجعة رسمية
              </Badge>
            )}

            <span className="text-xs font-semibold text-text-muted">
              المراجع: <strong className="text-text font-bold" data-testid="feedback-reviewer-name">{reviewerDisplayName}</strong>
            </span>

            <span className="text-xs text-text-muted font-mono" data-testid="feedback-decision-date">
              تاريخ القرار: {formattedDate}
            </span>
          </div>

          {/* Guidance Message */}
          <div className="text-xs text-text-muted leading-relaxed">
            {isReturnedWithEdits ? (
              <p>
                قام مراجع الجودة بإجراء تعديلات مباشرة على هيكل ومحتوى المقرر وإعادته إليك للاطلاع عليها.
                يمكنك معاينة التغييرات الدقيقة عبر أداة مقارنة التعديلات، وإجراء أي تنقيحات إضافية قبل إعادة التقديم.
              </p>
            ) : isRejected ? (
              <p>
                تمت مراجعة المقرر وإعادته لاستيفاء الملاحظات والتعديلات المطلوبة أدناه قبل إعادة تقديمه للاعتماد.
              </p>
            ) : (
              <p>ملاحظات وتوجيهات لجنة الاعتماد والمراجعة الأكاديمية.</p>
            )}
          </div>

          {/* Official Summary Message Box */}
          <div
            className="p-3.5 rounded-xl bg-surface border border-border/80 space-y-1 shadow-2xs"
            data-testid="feedback-summary-box"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-text-heading">
              <Icon name="fileText" size="sm" className="text-primary" />
              <span>الرسالة الرسمية والتوجيهات العامة:</span>
            </div>
            <p className="text-xs text-text leading-relaxed whitespace-pre-wrap pr-6" data-testid="feedback-summary-message">
              {feedback.summaryMessage?.trim() || 'لا توجد رسالة ملاحظات تفصيلية مسجلة.'}
            </p>
          </div>

          {/* Contextual Feedback Notice (if items exist) */}
          {contextualItemsCount > 0 && (
            <div
              className="flex items-center gap-2 text-xs text-text-muted bg-surface/60 px-3 py-2 rounded-lg border border-border/60"
              data-testid="feedback-contextual-notice"
            >
              <Icon name="info" size="sm" className="text-primary shrink-0" />
              <span>
                توجد <strong className="text-text font-bold">{contextualItemsCount}</strong> ملاحظات تفصيلية محددة على الفصول والدروس (موضحة بأيقونة الملاحظة في هيكل المنهج).
              </span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap lg:flex-col items-stretch gap-2 shrink-0 self-end lg:self-start min-w-[200px]">
          {isReturnedWithEdits && onOpenDiff && hasSnapshots && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenDiff}
              className="w-full font-bold gap-2 text-primary border-primary/40 hover:bg-primary/10 shadow-2xs"
              data-testid="view-admin-diff-btn"
            >
              <Icon name="courses" size="sm" />
              <span>عرض مقارنة تعديلات الإدارة</span>
            </Button>
          )}

          {onResubmit && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onResubmit}
              disabled={isResubmitting}
              className="w-full font-bold gap-2 shadow-2xs"
              data-testid="banner-resubmit-btn"
            >
              <Icon name="checkCircle" size="sm" />
              <span>{isResubmitting ? 'جاري إعادة التقديم...' : 'إعادة التقديم للاعتماد'}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActiveReviewFeedbackBanner;
