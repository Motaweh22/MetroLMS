import React, { useState, useEffect } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { commentsApi } from '../services/commentsApi';
import type { CourseComment, CommentReportReason } from '@/core/comments/types';
import { COMMENT_REPORT_REASONS_AR } from '@/core/comments/types';

export interface ReportCommentModalProps {
  isOpen: boolean;
  comment: CourseComment | null;
  onClose: () => void;
  onSuccess: (updatedComment: CourseComment) => void;
}

export const ReportCommentModal: React.FC<ReportCommentModalProps> = ({
  isOpen,
  comment,
  onClose,
  onSuccess,
}) => {
  const [selectedReason, setSelectedReason] = useState<CommentReportReason>('inappropriate_content');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens with a new comment
  useEffect(() => {
    if (isOpen) {
      setSelectedReason('inappropriate_content');
      setNotes('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, comment?.id]);

  if (!isOpen || !comment) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!comment) return;

    if (!selectedReason) {
      setError('يرجى تحديد سبب الإبلاغ عن التعليق');
      return;
    }

    if (selectedReason === 'other' && !notes.trim()) {
      setError('يرجى توضيح سبب الإبلاغ في حقل الملاحظات');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const updated = await commentsApi.reportComment(
        comment.id,
        selectedReason,
        notes.trim() || undefined
      );
      onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'فشلت معالجة الإبلاغ عن التعليق، يرجى المحاولة لاحقاً';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      size="md"
      title="الإبلاغ عن تعليق مخالف"
      description="ساعدنا في الحفاظ على مجتمع تعليمي آمن وملتزم بمعايير السلوك الأكاديمي"
      data-testid="report-comment-modal"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-right" data-testid="report-comment-form">
        {/* Identified Comment Preview */}
        <div
          className="bg-neutral-light border border-border/80 rounded-xl p-3.5 space-y-1.5"
          data-testid="comment-preview"
        >
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-bold text-text-heading">{comment.userName}</span>
            <span className="font-mono text-[11px]">{comment.courseTitle}</span>
          </div>
          <p className="text-xs text-text leading-relaxed line-clamp-3 bg-surface/70 p-2.5 rounded-lg border border-border/40 font-normal">
            "{comment.text}"
          </p>
        </div>

        {/* Error Feedback */}
        {error && (
          <Alert variant="danger" data-testid="report-error-alert">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Icon name="alertCircle" size="sm" />
              <span>{error}</span>
            </div>
          </Alert>
        )}

        {/* Reason Selector */}
        <div className="space-y-2">
          <label
            htmlFor="report-reason-select"
            className="block text-xs font-bold text-text-heading"
          >
            سبب الإبلاغ <span className="text-danger">*</span>
          </label>
          <div className="space-y-1.5" data-testid="report-reasons-group">
            {(Object.keys(COMMENT_REPORT_REASONS_AR) as CommentReportReason[]).map((reasonKey) => {
              const label = COMMENT_REPORT_REASONS_AR[reasonKey];
              const isChecked = selectedReason === reasonKey;
              return (
                <label
                  key={reasonKey}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    isChecked
                      ? 'border-primary bg-primary/5 text-primary-dark font-bold'
                      : 'border-border hover:bg-neutral-light text-text font-medium'
                  }`}
                  data-testid={`report-reason-option-${reasonKey}`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={reasonKey}
                    checked={isChecked}
                    onChange={() => setSelectedReason(reasonKey)}
                    disabled={isSubmitting}
                    className="accent-primary w-4 h-4 cursor-pointer"
                    data-testid={`report-reason-radio-${reasonKey}`}
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Explanatory Notes (Shown for 'other' or optional for additional details) */}
        {selectedReason === 'other' && (
          <div className="space-y-1.5 pt-1" data-testid="report-notes-field">
            <label
              htmlFor="report-notes-input"
              className="block text-xs font-bold text-text-heading"
            >
              توضيح سبب الإبلاغ <span className="text-danger">*</span>
            </label>
            <textarea
              id="report-notes-input"
              data-testid="report-notes-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              placeholder="اكتب توضيحاً إضافياً لسبب البلاغ لمساعدة الإدارة في التحقق..."
              className="w-full text-xs p-3 rounded-lg border border-border bg-surface focus:outline-none focus:border-primary resize-none text-text"
            />
          </div>
        )}

        {/* Dialog Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="cancel-report-btn"
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            variant="destructive"
            size="sm"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            data-testid="submit-report-btn"
          >
            {isSubmitting ? 'جاري الإرسال...' : 'إرسال البلاغ'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ReportCommentModal;
