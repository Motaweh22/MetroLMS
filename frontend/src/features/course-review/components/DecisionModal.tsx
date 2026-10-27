import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Badge } from '@/shared/ui/Badge';
import { Alert } from '@/shared/ui/Alert';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useToast } from '@/shared/ui/Toast';
import { Tooltip } from '@/shared/ui/Tooltip';
import { reviewApi } from '../api/reviewApi';
import type {
  Course,
  StagedAdminEditsRecord,
  ReviewerWorkingNotes,
  ReviewDecisionRequestDTO,
  ReviewDecisionResponseDTO,
  ReviewOutcome,
} from '@/core/courses/types';

export type DecisionMode = 'approve' | 'return_with_edits' | 'reject';

export interface DecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: DecisionMode;
  course: Course;
  baselineCourse?: Course | null;
  stagedEdits?: StagedAdminEditsRecord | null;
  workingNotes?: ReviewerWorkingNotes | null;
  onSuccess?: (result: ReviewDecisionResponseDTO) => void;
  testId?: string;
}

export const DecisionModal: React.FC<DecisionModalProps> = ({
  isOpen,
  onClose,
  mode,
  course,
  stagedEdits,
  workingNotes,
  onSuccess,
  testId = 'decision-modal',
}) => {
  const navigate = useNavigate();
  const toast = useToast();

  const [publishOption, setPublishOption] = useState<'submitted_baseline' | 'with_staged_edits'>(
    'with_staged_edits'
  );
  const [approvalNote, setApprovalNote] = useState<string>('');
  const [summaryMessage, setSummaryMessage] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showImportConfirm, setShowImportConfirm] = useState<boolean>(false);

  const hasStagedEdits = Boolean(
    stagedEdits &&
      stagedEdits.patchedContent &&
      Object.keys(stagedEdits.patchedContent).length > 0
  );

  // Reset state when opening/mode changes
  useEffect(() => {
    if (isOpen) {
      setPublishOption(hasStagedEdits ? 'with_staged_edits' : 'submitted_baseline');
      setApprovalNote('');
      setSummaryMessage('');
      setValidationError(null);
      setApiError(null);
      setIsSubmitting(false);
      setShowImportConfirm(false);
    }
  }, [isOpen, mode, hasStagedEdits]);

  // Check if reviewer has any private working notes to import
  const hasPrivateNotes = Boolean(
    workingNotes &&
      (workingNotes.generalNote?.trim() ||
        Object.values(workingNotes.chapterNotes || {}).some((n) => n?.trim()) ||
        Object.values(workingNotes.itemNotes || {}).some((n) => n?.trim()))
  );

  // Helper to compile private notes into formatted text
  const assembleWorkingNotesText = (notes: ReviewerWorkingNotes): string => {
    const parts: string[] = [];
    if (notes.generalNote?.trim()) {
      parts.push(`ملاحظات عامة:\n${notes.generalNote.trim()}`);
    }
    const chapterNotes = Object.values(notes.chapterNotes || {}).filter((n) => n?.trim());
    if (chapterNotes.length > 0) {
      parts.push(
        'ملاحظات الفصول:\n' + chapterNotes.map((n) => `- ${n.trim()}`).join('\n')
      );
    }
    const itemNotes = Object.values(notes.itemNotes || {}).filter((n) => n?.trim());
    if (itemNotes.length > 0) {
      parts.push(
        'ملاحظات الدروس:\n' + itemNotes.map((n) => `- ${n.trim()}`).join('\n')
      );
    }
    return parts.join('\n\n');
  };

  const handleConfirmImportNotes = () => {
    if (!workingNotes) return;
    const text = assembleWorkingNotesText(workingNotes);
    setSummaryMessage((prev) => (prev.trim() ? `${prev}\n\n${text}` : text));
    setShowImportConfirm(false);
    toast.info('تم استيراد الملاحظات الخاصة إلى التغذية الراجعة الرسمية');
  };

  const handleSubmit = async () => {
    setValidationError(null);
    setApiError(null);

    // Validation
    if (mode === 'return_with_edits') {
      if (!hasStagedEdits) {
        setValidationError('لا يمكن إعادة المقرر بتعديلات الإدارة لعدم وجود أي تعديلات مؤقتة');
        return;
      }
      if (!summaryMessage.trim()) {
        setValidationError('رسالة التغذية الراجعة للمحاضر مطلوبة');
        return;
      }
    }

    if (mode === 'reject') {
      if (!summaryMessage.trim()) {
        setValidationError('سبب الرفض والتغذية الراجعة للمحاضر مطلوبة');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let outcome: ReviewOutcome;
      if (mode === 'approve') outcome = 'approved';
      else if (mode === 'return_with_edits') outcome = 'returned_with_admin_edits';
      else outcome = 'rejected';

      const payload: ReviewDecisionRequestDTO = {
        outcome,
        summaryMessage: summaryMessage.trim() || undefined,
        approvalNote: mode === 'approve' ? approvalNote.trim() || undefined : undefined,
        publishOption: mode === 'approve' && hasStagedEdits ? publishOption : undefined,
      };

      const result = await reviewApi.executeReviewDecision(course.id, payload);

      if (mode === 'approve') {
        toast.success('تم اعتماد ونشر المقرر بنجاح');
      } else if (mode === 'return_with_edits') {
        toast.info('تمت إعادة المقرر للمحاضر مع تعديلات الإدارة بنجاح');
      } else {
        toast.warning('تمت إعادة المقرر للمحاضر لطلب التعديلات');
      }

      if (onSuccess) {
        onSuccess(result);
      }

      navigate('/approvals');
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء تنفيذ قرار المراجعة، يرجى إعادة المحاولة';
      setApiError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Header configuration based on mode
  const getHeaderConfig = () => {
    switch (mode) {
      case 'approve':
        return {
          title: 'اعتماد ونشر المقرر التدريبي',
          description: `أنت على وشك اعتماد المقرر "${course.title}" ونشره ليصبح متاحاً للمتدربين.`,
          icon: 'checkCircle' as const,
          iconBg: 'bg-emerald-500/15 text-emerald-600',
          confirmLabel: 'اعتماد ونشر الآن',
          confirmTestId: 'confirm-approve-btn',
          confirmVariant: 'primary' as const,
          confirmBtnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        };
      case 'return_with_edits':
        return {
          title: 'إعادة المقرر للمحاضر مع تعديلات الإدارة',
          description: `سيتم إرسال المقرر مع تعديلات إدارة الجودة للمحاضر، مع حفظ لقطات المقارنة الرسمية المعتمدة.`,
          icon: 'edit' as const,
          iconBg: 'bg-warning/15 text-warning-dark',
          confirmLabel: 'تأكيد الإعادة بتعديلات الإدارة',
          confirmTestId: 'confirm-return-edits-btn',
          confirmVariant: 'primary' as const,
          confirmBtnClass: 'bg-warning-dark hover:bg-warning-darker text-white',
        };
      case 'reject':
        return {
          title: 'إعادة المقرر للمحاضر لطلب تعديلات',
          description: `سيتم إعادة المقرر إلى حالة المسودة لدى المحاضر مع إرسال أسباب الرفض والملاحظات المطلوبة.`,
          icon: 'alertCircle' as const,
          iconBg: 'bg-danger/15 text-danger',
          confirmLabel: 'تأكيد إعادة المقرر للمحاضر',
          confirmTestId: 'confirm-reject-btn',
          confirmVariant: 'destructive' as const,
          confirmBtnClass: '',
        };
    }
  };

  const headerConfig = getHeaderConfig();

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={() => {
          if (!isSubmitting) onClose();
        }}
        size="lg"
        hideHeader
        dataTestId={testId}
        ariaLabelledBy="decision-modal-title"
        ariaDescribedBy="decision-modal-description"
      >
        <div className="space-y-5 text-right font-sans" dir="rtl">
          {/* Header */}
          <div className="flex items-start gap-3 border-b border-border pb-4">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${headerConfig.iconBg}`}
            >
              <Icon name={headerConfig.icon} size="md" />
            </div>
            <div>
              <h3
                id="decision-modal-title"
                data-testid="decision-modal-title"
                className="text-lg font-bold text-text-heading"
              >
                {headerConfig.title}
              </h3>
              <p
                id="decision-modal-description"
                className="text-sm text-text-muted mt-1 leading-relaxed"
              >
                {headerConfig.description}
              </p>
            </div>
          </div>

          {/* Validation & API Error Alerts */}
          {validationError && (
            <Alert variant="danger" title="تنبيه مطلوب">
              <span data-testid="decision-validation-error">{validationError}</span>
            </Alert>
          )}

          {apiError && (
            <Alert variant="danger" title="تعذر تنفيذ القرار">
              <span data-testid="decision-api-error">{apiError}</span>
            </Alert>
          )}

          {/* ── MODE A: APPROVE & PUBLISH ─────────────────────────────── */}
          {mode === 'approve' && (
            <div className="space-y-4">
              {/* Explicit choice when staged edits exist */}
              {hasStagedEdits && (
                <div className="space-y-2.5" data-testid="publish-choice-container">
                  <label className="block text-xs font-bold text-text-heading">
                    خيارات النشر والاعتماد:
                  </label>

                  <div className="grid grid-cols-1 gap-2.5">
                    {/* Option 2: Publish with staged admin edits */}
                    <label
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        publishOption === 'with_staged_edits'
                          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                          : 'border-border bg-surface hover:bg-surface-muted/50'
                      }`}
                      data-testid="publish-choice-staged"
                    >
                      <input
                        type="radio"
                        name="publishOption"
                        value="with_staged_edits"
                        checked={publishOption === 'with_staged_edits'}
                        onChange={() => setPublishOption('with_staged_edits')}
                        className="mt-1 text-primary focus:ring-primary"
                      />
                      <div className="text-xs">
                        <div className="font-bold text-text-heading flex items-center gap-1.5">
                          <span>اعتماد ونشر المقرر مع تعديلات الإدارة المعتمدة</span>
                          <Badge variant="warning" size="sm">
                            تعديلات نشطة
                          </Badge>
                        </div>
                        <p className="text-text-muted mt-0.5 leading-relaxed">
                          دمج التعديلات الإدارية المحفوظة ونشر النسخة المحسّنة من قِبل إدارة
                          الجودة مباشرة للمتدربين.
                        </p>
                      </div>
                    </label>

                    {/* Option 1: Publish submitted baseline unchanged */}
                    <label
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        publishOption === 'submitted_baseline'
                          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                          : 'border-border bg-surface hover:bg-surface-muted/50'
                      }`}
                      data-testid="publish-choice-submitted"
                    >
                      <input
                        type="radio"
                        name="publishOption"
                        value="submitted_baseline"
                        checked={publishOption === 'submitted_baseline'}
                        onChange={() => setPublishOption('submitted_baseline')}
                        className="mt-1 text-primary focus:ring-primary"
                      />
                      <div className="text-xs">
                        <div className="font-bold text-text-heading">
                          اعتماد ونشر النسخة المقدمة كما هي
                        </div>
                        <p className="text-text-muted mt-0.5 leading-relaxed">
                          تجاهل تعديلات الإدارة المؤقتة ونشر المقرر تماماً كما قدمه المحاضر في
                          الأصل.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Optional Approval Note */}
              <div>
                <label
                  htmlFor="approval-note-input"
                  className="block text-xs font-semibold text-text mb-1.5"
                >
                  ملاحظة اعتماد رسمية (اختياري)
                </label>
                <textarea
                  id="approval-note-input"
                  rows={3}
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                  placeholder="اكتب ملاحظة أو توجيهات عامة للمحاضر تظهر في سجل الاعتماد..."
                  data-testid="approval-note-input"
                  className="w-full p-2.5 text-xs bg-bg border border-border rounded-lg text-text focus:outline-none focus:border-primary resize-y"
                />
              </div>
            </div>
          )}

          {/* ── MODE B: RETURN WITH ADMIN EDITS ───────────────────────── */}
          {mode === 'return_with_edits' && (
            <div className="space-y-4">
              {hasStagedEdits ? (
                <div
                  className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-xs space-y-1.5"
                  data-testid="staged-edits-summary-box"
                >
                  <div className="font-semibold text-warning-dark flex items-center gap-1.5">
                    <Icon name="edit" size="sm" />
                    <span>ملخص التعديلات الإدارية التي ستُرفق مع المقرر:</span>
                  </div>
                  <div className="text-text-muted flex flex-wrap gap-1.5 pt-1">
                    {stagedEdits?.patchedContent?.title && (
                      <Badge variant="neutral" size="sm">
                        العنوان
                      </Badge>
                    )}
                    {stagedEdits?.patchedContent?.description && (
                      <Badge variant="neutral" size="sm">
                        الوصف
                      </Badge>
                    )}
                    {stagedEdits?.patchedContent?.level && (
                      <Badge variant="neutral" size="sm">
                        المستوى
                      </Badge>
                    )}
                    {stagedEdits?.patchedContent?.estimatedHours && (
                      <Badge variant="neutral" size="sm">
                        الساعات التقديرية
                      </Badge>
                    )}
                    {stagedEdits?.patchedContent?.targetJobTitles && (
                      <Badge variant="neutral" size="sm">
                        المسميات الوظيفية
                      </Badge>
                    )}
                    {stagedEdits?.patchedContent?.chapters && (
                      <Badge variant="neutral" size="sm">
                        الفصول والدروس
                      </Badge>
                    )}
                    {stagedEdits?.patchedContent?.externalResources && (
                      <Badge variant="neutral" size="sm">
                        المصادر الخارجية
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <Alert variant="danger" title="لا توجد تعديلات إدارية مؤقتة">
                  <p className="text-xs">
                    يتطلب هذا الإجراء وجود تعديلات إدارية مؤقتة. إذا أردت إعادة المقرر دون تعديلات،
                    يرجى اختيار "إعادة بطلب تعديلات".
                  </p>
                </Alert>
              )}

              {/* Mandatory Feedback Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="decision-feedback-input"
                    className="block text-xs font-semibold text-text"
                  >
                    رسالة التوجيه والتغذية الراجعة للمحاضر (إجباري)
                  </label>
                  {hasPrivateNotes && (
                    <button
                      type="button"
                      onClick={() => setShowImportConfirm(true)}
                      data-testid="import-private-notes-btn"
                      className="text-[11px] text-primary hover:underline flex items-center gap-1"
                    >
                      <Icon name="fileText" size="sm" />
                      <span>استيراد الملاحظات الخاصة</span>
                    </button>
                  )}
                </div>
                <textarea
                  id="decision-feedback-input"
                  rows={4}
                  value={summaryMessage}
                  onChange={(e) => setSummaryMessage(e.target.value)}
                  placeholder="وضح للمحاضر سبب التعديلات وأبرز ما تم تغييره والتوجيهات للمرحلة القادمة..."
                  data-testid="decision-feedback-input"
                  className="w-full p-2.5 text-xs bg-bg border border-border rounded-lg text-text focus:outline-none focus:border-primary resize-y"
                />
              </div>
            </div>
          )}

          {/* ── MODE C: REJECT / RETURN FOR REVISION ──────────────────── */}
          {mode === 'reject' && (
            <div className="space-y-4">
              {/* Warning about Stale Edits non-commitment */}
              {hasStagedEdits && (
                <div
                  className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-xs text-warning-dark flex items-start gap-2"
                  data-testid="stale-edits-warning"
                >
                  <Icon name="alertCircle" size="sm" className="shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold block mb-0.5">تنبيه بشأن التعديلات المؤقتة:</span>
                    لن يتم تطبيق أي من التعديلات الإدارية المؤقتة على المقرر، وستُحفظ كمسودة غير
                    نشطة (Stale) للرجوع إليها لاحقاً ما لم يتم حذفها صراحة.
                  </div>
                </div>
              )}

              {/* Mandatory Rejection Reason */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="decision-feedback-input"
                    className="block text-xs font-semibold text-text"
                  >
                    أسباب الرفض والملاحظات المطلوبة من المحاضر (إجباري)
                  </label>
                  {hasPrivateNotes && (
                    <button
                      type="button"
                      onClick={() => setShowImportConfirm(true)}
                      data-testid="import-private-notes-btn"
                      className="text-[11px] text-primary hover:underline flex items-center gap-1"
                    >
                      <Icon name="fileText" size="sm" />
                      <span>استيراد الملاحظات الخاصة</span>
                    </button>
                  )}
                </div>
                <textarea
                  id="decision-feedback-input"
                  rows={4}
                  value={summaryMessage}
                  onChange={(e) => setSummaryMessage(e.target.value)}
                  placeholder="حدد بدقة النقاط التي تحتاج إلى تعديل أو استكمال من قبل المحاضر..."
                  data-testid="decision-feedback-input"
                  className="w-full p-2.5 text-xs bg-bg border border-border rounded-lg text-text focus:outline-none focus:border-primary resize-y"
                />
              </div>
            </div>
          )}

          {/* Modal Actions Footer */}
          <div className="pt-3 border-t border-border flex flex-col sm:flex-row items-center justify-end gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              data-testid="decision-cancel-btn"
              className="w-full sm:w-auto text-xs"
            >
              إلغاء
            </Button>

            <Tooltip
              content={
                mode === 'return_with_edits' && !hasStagedEdits
                  ? 'لتفعيل هذا الإجراء، يجب وجود تعديلات إدارية محفوظة على المقرر.'
                  : undefined
              }
              disabled={!(mode === 'return_with_edits' && !hasStagedEdits)}
              isTriggerDisabled={mode === 'return_with_edits' && !hasStagedEdits}
              testId="modal-confirm-tooltip"
            >
              <Button
                variant={headerConfig.confirmVariant}
                size="sm"
                onClick={handleSubmit}
                isLoading={isSubmitting}
                disabled={isSubmitting || (mode === 'return_with_edits' && !hasStagedEdits)}
                data-testid={headerConfig.confirmTestId}
                className={`w-full sm:w-auto text-xs ${headerConfig.confirmBtnClass}`}
              >
                {headerConfig.confirmLabel}
              </Button>
            </Tooltip>
          </div>
        </div>
      </Modal>

      {/* Confirmation dialog for importing private notes */}
      <ConfirmDialog
        isOpen={showImportConfirm}
        title="تأكيد استيراد الملاحظات الخاصة"
        message="سيتم نسخ ملاحظاتك الخاصة وتضمينها في حقل التغذية الراجعة الرسمية التي سيشاهدها المحاضر في حسابه. هل ترغب في المتابعة؟"
        confirmLabel="استيراد إلى التغذية الراجعة"
        cancelLabel="إلغاء"
        variant="info"
        onConfirm={handleConfirmImportNotes}
        onCancel={() => setShowImportConfirm(false)}
        testId="import-notes-confirm-dialog"
        confirmTestId="confirm-import-notes-btn"
        cancelTestId="cancel-import-notes-btn"
      />
    </>
  );
};

export default DecisionModal;
