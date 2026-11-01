import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  Course,
  CourseAuditLogEntry,
  StagedAdminEditsRecord,
  ReviewerWorkingNotes,
} from '@/core/courses/types';
import type { ReviewTarget } from './CurriculumNavigator';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Tooltip } from '@/shared/ui/Tooltip';
import { CourseDiffViewerModal } from './CourseDiffViewerModal';

export interface ReviewInspectorProps {
  course: Course;
  baselineCourse?: Course | null;
  selectedTarget: ReviewTarget;
  workingNotes: ReviewerWorkingNotes | null;
  onSaveWorkingNotes: (notes: ReviewerWorkingNotes) => Promise<void>;
  auditLog: CourseAuditLogEntry[];
  stagedEdits: StagedAdminEditsRecord | null;
  onOpenDecisionModal?: (mode: 'approve' | 'return_with_edits' | 'reject') => void;
  autosaveStatus?: 'idle' | 'saving' | 'saved' | 'conflict' | 'error';
  hasUnsavedChanges?: boolean;
  hasConflict?: boolean;
  canDecide?: boolean;
}

function formatAuditTimestamp(timestamp?: string | null): string {
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

export const ReviewInspector: React.FC<ReviewInspectorProps> = ({
  course,
  baselineCourse,
  selectedTarget,
  workingNotes,
  onSaveWorkingNotes,
  auditLog,
  stagedEdits,
  onOpenDecisionModal,
  autosaveStatus = 'idle',
  hasUnsavedChanges = false,
  hasConflict = false,
  canDecide = true,
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'audit' | 'diff'>('notes');
  const [selectedDiffEntry, setSelectedDiffEntry] = useState<CourseAuditLogEntry | null>(null);

  // 1. Conflict condition: active unresolved revision conflict
  const isConflictActive = Boolean(hasConflict || autosaveStatus === 'conflict');

  // 2. Saving or pending local edits condition
  const isSavingActive = Boolean(autosaveStatus === 'saving');
  const hasPendingUnsaved = Boolean(hasUnsavedChanges || isSavingActive);

  // 3. Staged edits accepted on server condition
  const hasRealStagedEdits = Boolean(
    stagedEdits &&
      stagedEdits.patchedContent &&
      Object.keys(stagedEdits.patchedContent).length > 0 &&
      !stagedEdits.isStale
  );

  // Return with Admin Edits (Blue button)
  let returnEditsTooltip: string | undefined;
  let isReturnEditsDisabled = false;

  if (isConflictActive) {
    isReturnEditsDisabled = true;
    returnEditsTooltip = 'توجد تعارضات غير محلولة في التعديلات؛ يجب حل التعارض أولاً قبل إرجاع المقرر.';
  } else if (hasPendingUnsaved) {
    isReturnEditsDisabled = true;
    returnEditsTooltip = 'جارٍ حفظ التعديلات؛ انتظر اكتمال الحفظ قبل إرجاع المقرر.';
  } else if (!hasRealStagedEdits) {
    isReturnEditsDisabled = true;
    returnEditsTooltip = 'لتفعيل هذا الإجراء، فعّل وضع التعديل، وأجرِ تعديلًا واحدًا على الأقل، ثم انتظر حتى يتم حفظه بنجاح.';
  }

  // Approve & Publish (Green button)
  let approveTooltip: string | undefined;
  let isApproveDisabled = false;

  if (isConflictActive) {
    isApproveDisabled = true;
    approveTooltip = 'توجد تعارضات غير محلولة في التعديلات؛ يجب حل التعارض أولاً قبل اعتماد المقرر.';
  } else if (isSavingActive) {
    isApproveDisabled = true;
    approveTooltip = 'جارٍ حفظ التعديلات الإدارية؛ انتظر اكتمال الحفظ قبل اعتماد المقرر.';
  }

  // Reject / Request Revisions (Outline Red button)
  let rejectTooltip: string | undefined;
  let isRejectDisabled = false;

  if (isConflictActive) {
    isRejectDisabled = true;
    rejectTooltip = 'توجد تعارضات غير محلولة في التعديلات؛ يجب حل التعارض أولاً قبل إعادة المقرر.';
  } else if (isSavingActive) {
    isRejectDisabled = true;
    rejectTooltip = 'جارٍ حفظ التعديلات؛ انتظر اكتمال الحفظ قبل إعادة المقرر.';
  }

  // Find active entity
  let targetTitle = 'ملاحظات عامة على المقرر';
  let noteKeyType: 'general' | 'chapter' | 'item' = 'general';
  let noteKeyId = 'main';

  if (selectedTarget.type === 'chapter') {
    const ch = (course.chapters || []).find((c) => c.id === selectedTarget.chapterId);
    targetTitle = ch ? `فصل: ${ch.title}` : 'فصل غير محدد';
    noteKeyType = 'chapter';
    noteKeyId = selectedTarget.chapterId;
  } else if (selectedTarget.type === 'item') {
    const ch = (course.chapters || []).find((c) => c.id === selectedTarget.chapterId);
    const it = (ch?.items || []).find((i) => i.id === selectedTarget.itemId);
    targetTitle = it ? `درس: ${it.title}` : 'درس غير محدد';
    noteKeyType = 'item';
    noteKeyId = selectedTarget.itemId;
  }

  // Active note content
  const getCurrentNoteValue = useCallback((): string => {
    if (!workingNotes) return '';
    if (noteKeyType === 'general') {
      return workingNotes.generalNote || '';
    }
    if (noteKeyType === 'chapter') {
      return workingNotes.chapterNotes?.[noteKeyId] || '';
    }
    if (noteKeyType === 'item') {
      return workingNotes.itemNotes?.[noteKeyId] || '';
    }
    return '';
  }, [workingNotes, noteKeyType, noteKeyId]);

  const [currentNoteText, setCurrentNoteText] = useState<string>(getCurrentNoteValue());
  const [isSavingNote, setIsSavingNote] = useState<boolean>(false);
  const [noteSavedFeedback, setNoteSavedFeedback] = useState<boolean>(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state when selection changes
  useEffect(() => {
    setCurrentNoteText(getCurrentNoteValue());
    setNoteSavedFeedback(false);
  }, [selectedTarget, getCurrentNoteValue]);

  // Debounced auto-save for working notes
  const triggerDebouncedSave = (newText: string) => {
    setCurrentNoteText(newText);
    setNoteSavedFeedback(false);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setIsSavingNote(true);
      try {
        const updated: ReviewerWorkingNotes = {
          courseId: course.id,
          reviewerId: workingNotes?.reviewerId || '',
          generalNote: workingNotes?.generalNote || '',
          chapterNotes: { ...(workingNotes?.chapterNotes || {}) },
          itemNotes: { ...(workingNotes?.itemNotes || {}) },
          lastSavedAt: new Date().toISOString(),
        };

        if (noteKeyType === 'general') {
          updated.generalNote = newText.trim();
        } else if (noteKeyType === 'chapter') {
          if (newText.trim()) {
            updated.chapterNotes[noteKeyId] = newText.trim();
          } else {
            delete updated.chapterNotes[noteKeyId];
          }
        } else if (noteKeyType === 'item') {
          if (newText.trim()) {
            updated.itemNotes[noteKeyId] = newText.trim();
          } else {
            delete updated.itemNotes[noteKeyId];
          }
        }

        await onSaveWorkingNotes(updated);
        setNoteSavedFeedback(true);
      } finally {
        setIsSavingNote(false);
      }
    }, 700);
  };

  // Clear current note
  const handleClearNote = async () => {
    triggerDebouncedSave('');
  };

  return (
    <aside
      className="w-full lg:w-88 shrink-0 bg-surface border border-border rounded-xl flex flex-col h-full overflow-hidden shadow-sm"
      data-testid="review-inspector"
      dir="rtl"
    >
      {/* Tab Navigation */}
      <div className="flex border-b border-border bg-surface-muted/40 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          data-testid="tab-notes"
          className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
            activeTab === 'notes'
              ? 'bg-surface text-primary shadow-xs'
              : 'text-text-muted hover:text-text'
          }`}
        >
          ملاحظات خاصة (للمراجع)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          data-testid="tab-audit"
          className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
            activeTab === 'audit'
              ? 'bg-surface text-primary shadow-xs'
              : 'text-text-muted hover:text-text'
          }`}
        >
          سجل التدقيق ({auditLog.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('diff')}
          data-testid="tab-diff"
          className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
            activeTab === 'diff'
              ? 'bg-surface text-primary shadow-xs'
              : 'text-text-muted hover:text-text'
          }`}
        >
          مقارنة التعديلات
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {/* ── TAB 1: PRIVATE WORKING NOTES ───────────────────────────────── */}
        {activeTab === 'notes' && (
          <div className="space-y-4" data-testid="working-notes-panel">
            {/* Context Badge */}
            <div className="p-2.5 rounded-lg bg-surface-muted/50 border border-border flex items-center justify-between">
              <div className="flex items-center gap-1.5 truncate">
                <Icon name="edit" size="sm" className="text-primary" />
                <span className="text-xs font-semibold text-text truncate">
                  {targetTitle}
                </span>
              </div>
              <Badge variant="neutral" size="sm">
                {noteKeyType === 'general'
                  ? 'مقرر'
                  : noteKeyType === 'chapter'
                  ? 'فصل'
                  : 'درس'}
              </Badge>
            </div>

            {/* Confidentiality Warning */}
            <div className="p-3 rounded-lg bg-info-light/40 border border-info/30 text-[11px] text-text-muted leading-relaxed">
              <span className="font-bold text-info-dark flex items-center gap-1 mb-1">
                <Icon name="lock" size="sm" />
                <span>ملاحظات خاصة بالمراجع فقط (سرية تماماً)</span>
              </span>
              <p className="mb-1">
                تُحفظ هذه الملاحظات لمسؤول الجودة ولا تظهر للمحاضر مطلقاً، ولا يتم إشعاره بأي تعديل عليها، ولا تُسجل في سجل التدقيق العام.
              </p>
              <p className="text-[10px] text-text-muted">
                إذا أردت توجيه ملاحظات رسمية للمحاضر، استخدم خيار تحويلها إلى تغذية راجعة رسمية عند اتخاذ قرار الإعادة أو الرفض.
              </p>
            </div>

            {/* Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="working-notes-textarea"
                  className="text-xs font-semibold text-text"
                >
                  نص الملاحظة الخاصة
                </label>
                {isSavingNote && (
                  <span className="text-[10px] text-warning-dark animate-pulse">
                    جاري الحفظ...
                  </span>
                )}
                {noteSavedFeedback && !isSavingNote && (
                  <span className="text-[10px] text-success">
                    تم الحفظ تلقائياً
                  </span>
                )}
              </div>
              <textarea
                id="working-notes-textarea"
                rows={6}
                value={currentNoteText}
                onChange={(e) => triggerDebouncedSave(e.target.value)}
                placeholder="اكتب ملاحظاتك وتدقيقاتك الخاصة هنا..."
                data-testid="working-notes-textarea"
                className="w-full p-3 text-xs bg-bg border border-border rounded-lg text-text focus:outline-none focus:border-primary resize-y"
              />
            </div>

            {currentNoteText.trim() && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <Tooltip
                  content={!hasRealStagedEdits ? 'يتطلب وجود تعديلات إدارية محفوظة لتحويل الملاحظات إلى إعادة بتعديلات.' : undefined}
                  disabled={hasRealStagedEdits}
                  isTriggerDisabled={!hasRealStagedEdits}
                  testId="convert-notes-tooltip"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenDecisionModal?.('return_with_edits')}
                    disabled={!hasRealStagedEdits}
                    data-testid="convert-notes-to-feedback-btn"
                    className="text-primary text-[11px] h-7 px-2"
                  >
                    <Icon name="fileText" size="sm" />
                    <span>تحويل لتغذية راجعة</span>
                  </Button>
                </Tooltip>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearNote}
                  data-testid="clear-note-btn"
                  className="text-danger-dark text-xs h-7 px-2"
                >
                  حذف الملاحظة
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: AUDIT LOG HISTORY ───────────────────────────────────── */}
        {activeTab === 'audit' && (
          <div className="space-y-3" data-testid="audit-log-panel">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                سجل قرارات واعتمادات المقرر
              </h3>
              <Badge variant="neutral" size="sm">
                قرارات رسمية فقط
              </Badge>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed mb-2">
              يسجل هذا السجل القرارات الرسمية الصادرة من الإدارة والتقديمات من المحاضر. الملاحظات الخاصة ومسودات التعديلات المؤقتة لا تسجل هنا.
            </p>

            {auditLog.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-xs">
                لا توجد قيود مسجلة في سجل التدقيق حتى الآن.
              </div>
            ) : (
              <div className="space-y-2.5" data-testid="audit-log-list">
                {auditLog.map((entry, idx) => (
                  <div
                    key={entry.id || idx}
                    className="p-3 bg-surface-muted/40 border border-border rounded-lg text-xs space-y-1.5"
                    data-testid={`audit-entry-${idx}`}
                  >
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div className="font-semibold text-text">
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
                      </div>
                      <span className="text-[10px] text-text-muted">
                        {formatAuditTimestamp(entry.timestamp)}
                      </span>
                    </div>

                    <div className="text-[11px] text-text-muted pt-0.5">
                      بواسطة: <span className="text-text font-medium">{entry.actorName}</span>{' '}
                      ({entry.actorRole === 'admin' ? 'مدير نظام ومراجع جودة' : 'محاضر'})
                    </div>

                    {entry.feedback && (
                      <div className="text-[11px] text-text bg-surface p-2 rounded border border-border/60 mt-1">
                        <span className="font-bold text-[10px] text-warning-dark block mb-0.5">
                          التغذية الراجعة الرسمية الموجهة للمحاضر:
                        </span>
                        <p className="font-medium">{entry.feedback.summaryMessage}</p>
                      </div>
                    )}

                    {entry.approvalNote && (
                      <div className="text-[11px] text-text bg-surface p-2 rounded border border-border/60 mt-1">
                        <span className="font-bold text-[10px] text-success block mb-0.5">
                          ملاحظة الاعتماد الرسمية:
                        </span>
                        <p>{entry.approvalNote}</p>
                      </div>
                    )}

                    {entry.baselineSnapshot && entry.adminEditedSnapshot && (
                      <div className="pt-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedDiffEntry(entry)}
                          className="w-full text-[11px] h-7 gap-1.5 text-primary border-primary/30"
                          data-testid={`view-entry-diff-btn-${idx}`}
                        >
                          <Icon name="courses" size="sm" />
                          <span>
                            {entry.action === 'approved'
                              ? 'عرض مقارنة تعديلات الإدارة المعتمدة'
                              : 'عرض مقارنة لقطات التعديل المعادة'}
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

        {/* ── TAB 3: DIFF & COMPARISON ───────────────────────────────────── */}
        {activeTab === 'diff' && (
          <div className="space-y-4 text-xs" data-testid="diff-panel">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
              حالة التعديلات المؤقتة للإدارة
            </h3>

            {baselineCourse && (
              <div className="p-2.5 bg-neutral-light/50 border border-border rounded text-[11px] mb-2">
                <span className="text-text-muted">النسخة المرجعية المعتمدة: </span>
                <span className="font-semibold text-text">{baselineCourse.title}</span>
              </div>
            )}

            {stagedEdits?.patchedContent &&
            Object.keys(stagedEdits.patchedContent).length > 0 ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-warning-light/30 border border-warning-dark/20 text-xs">
                  <span className="font-semibold text-warning-dark block mb-1">
                    تعديلات مسودة الإدارة النشطة
                  </span>
                  <span>رقم المراجعة الحالية: {stagedEdits.clientRevision}</span>
                </div>

                <div className="space-y-2">
                  {stagedEdits.patchedContent.title && (
                    <div className="p-2.5 bg-surface border border-border rounded" data-testid="staged-diff-title">
                      <div className="text-text-muted text-[10px]">العنوان المعدل:</div>
                      <div className="font-bold text-text">
                        {stagedEdits.patchedContent.title}
                      </div>
                    </div>
                  )}

                  {stagedEdits.patchedContent.description && (
                    <div className="p-2.5 bg-surface border border-border rounded" data-testid="staged-diff-description">
                      <div className="text-text-muted text-[10px]">الوصف المعدل:</div>
                      <div className="text-text text-[11px] line-clamp-2">
                        {stagedEdits.patchedContent.description}
                      </div>
                    </div>
                  )}

                  {stagedEdits.patchedContent.level && (
                    <div className="p-2.5 bg-surface border border-border rounded" data-testid="staged-diff-level">
                      <div className="text-text-muted text-[10px]">المستوى المعدل:</div>
                      <div className="font-bold text-text">
                        {stagedEdits.patchedContent.level}
                      </div>
                    </div>
                  )}

                  {stagedEdits.patchedContent.targetJobTitles &&
                    stagedEdits.patchedContent.targetJobTitles.length > 0 && (
                      <div className="p-2.5 bg-surface border border-border rounded" data-testid="staged-diff-jobs">
                        <div className="text-text-muted text-[10px]">الوظائف المستهدفة:</div>
                        <div className="text-text text-[11px]">
                          {stagedEdits.patchedContent.targetJobTitles.join('، ')}
                        </div>
                      </div>
                    )}

                  {stagedEdits.patchedContent.externalResources &&
                    stagedEdits.patchedContent.externalResources.length > 0 && (
                      <div className="p-2.5 bg-surface border border-border rounded" data-testid="staged-diff-resources">
                        <div className="text-text-muted text-[10px]">المصادر الخارجية:</div>
                        <div className="text-text text-[11px]">
                          {stagedEdits.patchedContent.externalResources.length} مصادر مرفقة
                        </div>
                      </div>
                    )}

                  {stagedEdits.patchedContent.chapters && (
                    <div className="p-2.5 bg-surface border border-border rounded" data-testid="staged-diff-chapters">
                      <div className="text-text-muted text-[10px]">تعديلات المنهج الدراسي:</div>
                      <div className="text-text text-[11px] font-semibold">
                        تم تعديل هيكل الفصول والدروس ({stagedEdits.patchedContent.chapters.length} فصول)
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Card className="p-6 text-center text-text-muted text-xs">
                لا توجد تعديلات إدارية مؤقتة مسجلة على هذا المقرر حتى الآن.
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Sticky Bottom Review Action Footer */}
      <div className="p-3 border-t border-border bg-surface-muted/30 flex flex-col gap-2 shrink-0">
        {canDecide ? (
          <>
            <div className="p-2 rounded-lg bg-surface border border-border text-[11px] text-text-muted leading-tight">
              <div className="flex items-center gap-1 font-semibold text-text mb-0.5">
                <Icon name="info" size="sm" className="text-primary" />
                <span>قرارات الاعتماد الرسمية</span>
              </div>
              <span>
                يمكنك تعديل المحتوى بحرية عبر وضع التعديل قبل اتخاذ أي قرار. الأزرار أدناه لإنهاء دورة المراجعة.
              </span>
            </div>

            <Tooltip
              content={approveTooltip}
              disabled={!isApproveDisabled}
              isTriggerDisabled={isApproveDisabled}
              wrapperClassName="w-full"
              testId="approve-tooltip"
              align="center"
            >
              <Button
                variant="primary"
                size="sm"
                onClick={() => onOpenDecisionModal?.('approve')}
                disabled={isApproveDisabled}
                data-testid="action-approve-btn"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium justify-center text-xs h-9"
              >
                <Icon name="checkCircle" size="sm" />
                <span>اعتماد ونشر المقرر</span>
              </Button>
            </Tooltip>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Tooltip
                content={returnEditsTooltip}
                disabled={!isReturnEditsDisabled}
                isTriggerDisabled={isReturnEditsDisabled}
                wrapperClassName="w-full"
                testId="return-edits-tooltip"
                align="start"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenDecisionModal?.('return_with_edits')}
                  disabled={isReturnEditsDisabled}
                  data-testid="action-return-edits-btn"
                  className="text-xs justify-center h-9 w-full font-semibold"
                >
                  <span>إرجاع للمحاضر مع تعديلات الإدارة</span>
                </Button>
              </Tooltip>

              <Tooltip
                content={rejectTooltip}
                disabled={!isRejectDisabled}
                isTriggerDisabled={isRejectDisabled}
                wrapperClassName="w-full"
                testId="reject-tooltip"
                align="end"
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenDecisionModal?.('reject')}
                  disabled={isRejectDisabled}
                  data-testid="action-reject-btn"
                  className="text-xs text-danger border-danger/40 hover:bg-danger/10 justify-center h-9 w-full font-medium"
                >
                  <span>إعادة بطلب تعديلات</span>
                </Button>
              </Tooltip>
            </div>
          </>
        ) : (
          <div className="p-3 rounded-lg bg-surface border border-border text-xs text-text-muted flex items-start gap-2" data-testid="review-readonly-notice">
            <Icon name="info" size="sm" className="text-primary mt-0.5 shrink-0" />
            <span className="leading-relaxed">
              استعراض المراجعة متاح للقراءة والتدقيق. اعتماد أو إرجاع القرارات مخصص لمدير النظام التنفيذي.
            </span>
          </div>
        )}
      </div>

      {/* Snapshot Diff Modal */}
      {selectedDiffEntry && (
        <CourseDiffViewerModal
          isOpen={true}
          onClose={() => setSelectedDiffEntry(null)}
          baselineSnapshot={selectedDiffEntry.baselineSnapshot}
          adminEditedSnapshot={selectedDiffEntry.adminEditedSnapshot}
        />
      )}
    </aside>
  );
};
