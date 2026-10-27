import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { reviewApi } from '@/features/course-review/api/reviewApi';
import { useStagedEditsAutosave } from '@/features/course-review/hooks/useStagedEditsAutosave';
import { ConflictResolutionModal } from '@/features/course-review/components/ConflictResolutionModal';
import {
  CurriculumNavigator,
  type ReviewTarget,
} from '@/features/course-review/components/CurriculumNavigator';
import { ReviewContentPreview } from '@/features/course-review/components/ReviewContentPreview';
import { ReviewInspector } from '@/features/course-review/components/ReviewInspector';
import {
  DecisionModal,
  type DecisionMode,
} from '@/features/course-review/components/DecisionModal';
import type {
  Course,
  CourseChapter,
  ChapterItem,
  CourseReviewDataResponseDTO,
  ReviewerWorkingNotes,
} from '@/core/courses/types';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { Badge } from '@/shared/ui/Badge';

/**
 * CourseReviewPage — Phase 5: Admin Review Studio
 *
 * Implements the 3-pane Arabic RTL workspace:
 * - Right: Curriculum Navigator
 * - Center: Side-effect-free Content Preview & In-place Staged Editor
 * - Left: Review Inspector (Private notes, audit log, version comparison)
 *
 * Strict Guarantees:
 * - Admin-only authorization barrier
 * - Side-effect-free preview: zero mutation of trainee progress or viewing time
 * - Private notes confidentiality: never leaks to lecturer or audit log
 * - Staged edits concurrency via useStagedEditsAutosave
 */
export const CourseReviewPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [reviewData, setReviewData] = useState<CourseReviewDataResponseDTO | null>(null);
  const [workingNotes, setWorkingNotes] = useState<ReviewerWorkingNotes | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);

  // Active review target (course root, specific chapter, or specific item)
  const [selectedTarget, setSelectedTarget] = useState<ReviewTarget>({ type: 'course' });
  // Editing mode toggle
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isExitingEditMode, setIsExitingEditMode] = useState<boolean>(false);
  const [exitError, setExitError] = useState<string | null>(null);
  // Decision Modal state (Phase 6)
  const [decisionModal, setDecisionModal] = useState<{
    isOpen: boolean;
    mode: DecisionMode;
  }>({
    isOpen: false,
    mode: 'approve',
  });

  const isAdmin = user?.role === 'admin';

  // Load review data and working notes
  const loadReviewStudioData = useCallback(async () => {
    if (!courseId || !isAuthenticated || !isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const [data, notes] = await Promise.all([
        reviewApi.getCourseReviewData(courseId),
        reviewApi.getReviewerWorkingNotes(courseId),
      ]);
      setReviewData(data);
      setWorkingNotes(notes);

      // Default select the first item of the first chapter if available
      if (data.effectiveContent?.chapters?.[0]?.items?.[0]) {
        setSelectedTarget({
          type: 'item',
          chapterId: data.effectiveContent.chapters[0].id,
          itemId: data.effectiveContent.chapters[0].items[0].id,
        });
      }
    } catch (err: unknown) {
      const errObj = err as { status?: number; message?: string };
      if (errObj.status === 404) {
        setNotFound(true);
      } else {
        const msg = err instanceof Error ? err.message : 'تعذر تحميل بيانات استوديو المراجعة';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [courseId, isAuthenticated, isAdmin]);

  useEffect(() => {
    if (!authLoading) {
      loadReviewStudioData();
    }
  }, [authLoading, loadReviewStudioData]);

  // Autosave hook for staged administrative edits
  const {
    pendingPatch: localEdits,
    updateLocalEdits,
    status: autosaveStatus,
    serverRecord,
    conflicts,
    resolveConflict,
    hasUnsavedChanges,
    saveImmediately,
  } = useStagedEditsAutosave({
    courseId: courseId || '',
    baselineCourse: reviewData?.course || reviewData?.effectiveContent || null,
    initialStagedEdits: reviewData?.stagedEdits,
    initialRevision: reviewData?.stagedEdits?.clientRevision ?? 0,
    initialPatchedContent: reviewData?.stagedEdits?.patchedContent || {},
    debounceMs: 1200,
  });

  // Effective course combining base/draft content with staged edits
  const effectiveCourse = useMemo<Course | null>(() => {
    if (!reviewData?.effectiveContent) return null;
    return {
      ...reviewData.effectiveContent,
      ...localEdits,
    };
  }, [reviewData, localEdits]);

  // Handle in-place metadata update
  const handleUpdateMetadata = (patch: Partial<Course>) => {
    updateLocalEdits(patch);
  };

  // Handle chapter title/metadata update
  const handleUpdateChapter = (chapterId: string, patch: Partial<CourseChapter>) => {
    if (!effectiveCourse) return;
    const updatedChapters = (effectiveCourse.chapters || []).map((ch) =>
      ch.id === chapterId ? { ...ch, ...patch } : ch
    );
    updateLocalEdits({ chapters: updatedChapters });
  };

  // Handle lesson item update
  const handleUpdateItem = (chapterId: string, itemId: string, patch: Partial<ChapterItem>) => {
    if (!effectiveCourse) return;
    const updatedChapters = (effectiveCourse.chapters || []).map((ch) => {
      if (ch.id !== chapterId) return ch;
      const updatedItems = (ch.items || []).map((it) =>
        it.id === itemId ? { ...it, ...patch } : it
      );
      return { ...ch, items: updatedItems };
    });
    updateLocalEdits({ chapters: updatedChapters });
  };

  // Curriculum operations: Chapter add, delete, reorder
  const handleAddChapter = () => {
    if (!effectiveCourse) return;
    const currentChapters = effectiveCourse.chapters || [];
    const newChapterId = `ch-${Date.now()}`;
    const newChapter: CourseChapter = {
      id: newChapterId,
      title: `فصل جديد ${currentChapters.length + 1}`,
      order: currentChapters.length + 1,
      items: [],
    };
    updateLocalEdits({ chapters: [...currentChapters, newChapter] });
    setSelectedTarget({ type: 'chapter', chapterId: newChapterId });
  };

  const handleDeleteChapter = (chapterId: string) => {
    if (!effectiveCourse) return;
    const currentChapters = effectiveCourse.chapters || [];
    const updated = currentChapters
      .filter((ch) => ch.id !== chapterId)
      .map((ch, idx) => ({ ...ch, order: idx + 1 }));
    updateLocalEdits({ chapters: updated });
    if (selectedTarget.type === 'chapter' && selectedTarget.chapterId === chapterId) {
      setSelectedTarget({ type: 'course' });
    } else if (selectedTarget.type === 'item' && selectedTarget.chapterId === chapterId) {
      setSelectedTarget({ type: 'course' });
    }
  };

  const handleReorderChapter = (chapterId: string, direction: 'up' | 'down') => {
    if (!effectiveCourse) return;
    const chapters = [...(effectiveCourse.chapters || [])];
    const index = chapters.findIndex((c) => c.id === chapterId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= chapters.length) return;

    const temp = chapters[index];
    chapters[index] = chapters[targetIndex];
    chapters[targetIndex] = temp;

    const reordered = chapters.map((ch, idx) => ({ ...ch, order: idx + 1 }));
    updateLocalEdits({ chapters: reordered });
  };

  // Curriculum operations: Lesson add, delete, reorder
  const handleAddLesson = (chapterId: string) => {
    if (!effectiveCourse) return;
    const currentChapters = effectiveCourse.chapters || [];
    const targetChapter = currentChapters.find((ch) => ch.id === chapterId);
    if (!targetChapter) return;

    const currentItems = targetChapter.items || [];
    const newItemId = `item-${Date.now()}`;
    const newItem: ChapterItem = {
      id: newItemId,
      title: `درس جديد ${currentItems.length + 1}`,
      type: 'video',
      duration: '10:00',
    };

    const updatedChapters = currentChapters.map((ch) => {
      if (ch.id !== chapterId) return ch;
      return {
        ...ch,
        items: [...(ch.items || []), newItem],
      };
    });

    updateLocalEdits({ chapters: updatedChapters });
    setSelectedTarget({ type: 'item', chapterId, itemId: newItemId });
  };

  const handleDeleteLesson = (chapterId: string, itemId: string) => {
    if (!effectiveCourse) return;
    const currentChapters = effectiveCourse.chapters || [];
    const updatedChapters = currentChapters.map((ch) => {
      if (ch.id !== chapterId) return ch;
      const filtered = (ch.items || []).filter((it) => it.id !== itemId);
      return { ...ch, items: filtered };
    });
    updateLocalEdits({ chapters: updatedChapters });
    if (selectedTarget.type === 'item' && selectedTarget.itemId === itemId) {
      setSelectedTarget({ type: 'chapter', chapterId });
    }
  };

  const handleReorderLesson = (chapterId: string, itemId: string, direction: 'up' | 'down') => {
    if (!effectiveCourse) return;
    const currentChapters = effectiveCourse.chapters || [];
    const targetChapter = currentChapters.find((ch) => ch.id === chapterId);
    if (!targetChapter) return;

    const items = [...(targetChapter.items || [])];
    const index = items.findIndex((it) => it.id === itemId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    const updatedChapters = currentChapters.map((ch) =>
      ch.id === chapterId ? { ...ch, items } : ch
    );
    updateLocalEdits({ chapters: updatedChapters });
  };

  // Handle saving working notes
  const handleSaveWorkingNotes = async (notes: ReviewerWorkingNotes) => {
    if (!courseId) return;
    const updated = await reviewApi.saveReviewerWorkingNotes(courseId, notes);
    setWorkingNotes(updated);
  };

  // Handle safe exit from edit mode with autosave flush and error guard
  const handleExitEditMode = async () => {
    if (isExitingEditMode) return;
    setIsExitingEditMode(true);
    setExitError(null);

    try {
      // 1. Guard against exiting if a revision conflict is currently active
      if (autosaveStatus === 'conflict' || conflicts.length > 0) {
        setExitError('توجد تعارضات غير محلولة في التعديلات. يرجى حل التعارض قبل الخروج من نمط التعديل.');
        setIsExitingEditMode(false);
        return;
      }

      // 2. If there are pending local changes or an active autosave in flight, flush immediately
      if (hasUnsavedChanges || autosaveStatus === 'saving') {
        const savedRecord = await saveImmediately();
        if (!savedRecord) {
          setExitError(
            conflicts.length > 0
              ? 'توجد تعارضات في الحفظ تحتاج إلى حل قبل العودة للمعاينة.'
              : 'تعذر حفظ التعديلات المعلقة قبل العودة للمعاينة. يرجى إعادة المحاولة.'
          );
          setIsExitingEditMode(false);
          return;
        }
      }

      // 3. Verify conflicts after save
      if (conflicts.length > 0) {
        setExitError('توجد تعارضات غير محلولة في التعديلات. يرجى حل التعارض قبل الخروج من نمط التعديل.');
        setIsExitingEditMode(false);
        return;
      }

      // 4. Safely return to preview without affecting decisions
      setIsEditMode(false);
      setExitError(null);
    } catch (err) {
      setExitError(
        err instanceof Error
          ? err.message
          : 'تعذر حفظ التعديلات المعلقة قبل العودة للمعاينة. يرجى المحاولة مرة أخرى.'
      );
    } finally {
      setIsExitingEditMode(false);
    }
  };

  // Loading state
  if (authLoading || (loading && !reviewData && !notFound && !error)) {
    return (
      <div
        className="container mx-auto px-4 py-16 max-w-7xl"
        data-testid="review-loading"
        dir="rtl"
      >
        <div className="flex flex-col items-center justify-center p-12 bg-surface rounded-xl border border-border">
          <Icon name="clock" size="lg" className="animate-spin text-primary mb-4" />
          <p className="text-text-muted text-base font-medium">
            جاري تهيئة استوديو مراجعة وتدقيق المقرر التدريبي...
          </p>
        </div>
      </div>
    );
  }

  // Unauthorized state (trainee, lecturer, or unauthenticated)
  if (!isAuthenticated || !isAdmin) {
    return (
      <div
        className="container mx-auto px-4 py-16 max-w-2xl"
        data-testid="review-unauthorized"
        dir="rtl"
      >
        <Alert variant="warning" title="غير مصرح بالوصول إلى استوديو المراجعة">
          <p className="text-sm mb-4">
            استوديو المراجعة والتدقيق مخصص حصرياً لمديري النظام ومسؤولي الجودة والاعتماد.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate('/approvals')}>
            العودة إلى لوحة الاعتمادات
          </Button>
        </Alert>
      </div>
    );
  }

  // Course Not Found state
  if (notFound || !effectiveCourse || !reviewData) {
    return (
      <div
        className="container mx-auto px-4 py-16 max-w-2xl"
        data-testid="course-review-page"
        dir="rtl"
      >
        <div data-testid="review-not-found">
          <Alert variant="danger" title="المقرر المطلوب غير موجود">
            <p className="text-sm mb-4">
              لم يتم العثور على المقرر المحدد ({courseId}). ربما تم حذفه أو أن الرابط غير صحيح.
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate('/approvals')}>
              العودة إلى قائمة الانتظار
            </Button>
          </Alert>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className="container mx-auto px-4 py-16 max-w-3xl"
        data-testid="course-review-page"
        dir="rtl"
      >
        <div data-testid="review-error">
          <Alert variant="danger" title="خطأ أثناء تحميل استوديو المراجعة">
            <p className="text-sm mb-4">{error}</p>
            <Button variant="primary" size="sm" onClick={loadReviewStudioData}>
              إعادة المحاولة
            </Button>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div
      className="container mx-auto px-3 sm:px-6 py-4 max-w-[1700px] h-[calc(100vh-5rem)] flex flex-col"
      data-testid="course-review-page"
      dir="rtl"
    >
      {/* Top Header & Breadcrumb Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 shrink-0 border-b border-border mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/approvals')}
            className="hover:text-primary transition-colors flex items-center gap-1 text-xs text-text-muted"
          >
            <Icon name="arrowRight" size="sm" />
            <span>لوحة الاعتمادات</span>
          </button>
          <span className="text-text-muted text-xs">/</span>
          <span className="text-text font-semibold truncate max-w-xs text-sm">
            {effectiveCourse.title}
          </span>
          {isEditMode ? (
            <Badge variant="warning" size="sm" dot data-testid="mode-badge-editing">
              وضع التعديل النشط
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm" data-testid="mode-badge-readonly">
              وضع المعاينة والتدقيق
            </Badge>
          )}
          {hasUnsavedChanges && (
            <Badge variant="warning" size="sm" data-testid="unsaved-indicator">
              تغييرات محلية معلقة
            </Badge>
          )}
          {autosaveStatus === 'saving' && (
            <span className="text-xs text-text-muted flex items-center gap-1">
              <Icon name="clock" size="sm" className="animate-spin text-primary" />
              <span>جاري الحفظ التلقائي...</span>
            </span>
          )}
          {autosaveStatus === 'saved' && (
            <span className="text-xs text-success flex items-center gap-1" data-testid="save-success-indicator">
              <Icon name="check" size="sm" />
              <span>تم حفظ التعديلات الإدارية</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {isEditMode ? (
            <>
              <Button
                variant="secondary"
                size="md"
                onClick={handleExitEditMode}
                disabled={isExitingEditMode}
                data-testid="toggle-edit-mode-btn"
                id="exit-edit-mode-btn"
                className="font-bold border-2 border-primary/40 text-primary-dark bg-primary-light hover:bg-[#D5EEF7] shadow-sm px-4 py-2 text-sm flex items-center gap-2 shrink-0 transition-all active:scale-95"
              >
                {isExitingEditMode ? (
                  <>
                    <Icon name="clock" size="sm" className="animate-spin" />
                    <span>جاري الحفظ والعودة...</span>
                  </>
                ) : (
                  <>
                    <Icon name="eye" size="sm" />
                    <span>إنهاء التعديل والعودة للمعاينة</span>
                  </>
                )}
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => saveImmediately()}
                disabled={!hasUnsavedChanges || autosaveStatus === 'saving' || isExitingEditMode}
                data-testid="save-now-btn"
                className="font-semibold text-xs h-10 px-3 flex items-center gap-1.5"
              >
                <Icon name="save" size="sm" />
                <span>حفظ التعديلات الآن</span>
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsEditMode(true)}
              data-testid="toggle-edit-mode-btn"
              id="activate-edit-mode-btn"
              className="font-bold shadow-sm px-4 py-2 text-sm flex items-center gap-2 shrink-0 transition-all active:scale-95"
            >
              <Icon name="edit" size="sm" />
              <span>تفعيل وضع التعديل</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="md"
            onClick={() => navigate('/approvals')}
            data-testid="back-to-approvals-btn"
            className="text-xs h-10 px-3"
          >
            العودة للقائمة
          </Button>
        </div>
      </div>

      {/* Exit Edit Mode Error Banner */}
      {exitError && (
        <div className="mb-3 shrink-0" data-testid="exit-edit-mode-error">
          <Alert variant="danger" title="تعذر إنهاء نمط التعديل" onClose={() => setExitError(null)}>
            <div className="flex items-center justify-between text-xs">
              <span>{exitError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExitEditMode}
                className="text-xs mr-3 border-danger/40 text-danger hover:bg-danger/10"
              >
                إعادة المحاولة
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {/* Explanatory Mode Banner */}
      {!isEditMode ? (
        <div
          data-testid="readonly-mode-banner"
          className="mb-3 p-3 bg-surface-raised border border-border rounded-lg flex items-center gap-2 text-xs text-text-muted shrink-0"
        >
          <Icon name="info" size="sm" className="text-primary shrink-0" />
          <span>
            استوديو المراجعة في وضع المعاينة الآمنة والقراءة فقط دون تعديل. لتعديل بيانات المقرر أو الفصول والدروس قبل اتخاذ قرار الاعتماد، انقر على زر &quot;تفعيل وضع التعديل&quot; في الشريط العلوي.
          </span>
        </div>
      ) : (
        <div
          data-testid="editing-mode-banner"
          className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between text-xs text-amber-200 shrink-0"
        >
          <div className="flex items-center gap-2">
            <Icon name="edit" size="sm" className="text-warning shrink-0" />
            <span>
              وضع التعديل الإداري نشط. يمكنك تعديل العناوين، الأوصاف، الفصول، الدروس ومصادر التعلم. يتم حفظ تعديلاتك كمسودة مراجعة إدارية دون نشرها أو اعتمادها تلقائياً.
            </span>
          </div>
          <span className="text-[11px] text-amber-300 font-medium">
            مفصول تماماً عن قرار الاعتماد النهائي
          </span>
        </div>
      )}

      {/* 3-Pane Workspace (Desktop: 3 Columns, Mobile: Stacked) */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden">
        {/* Right Pane: Curriculum Navigator (Column 1 - RTL First) */}
        <CurriculumNavigator
          course={effectiveCourse}
          selectedTarget={selectedTarget}
          onSelectTarget={setSelectedTarget}
          workingNotes={workingNotes}
          submissionType={reviewData.submissionType}
          hasStagedEdits={Boolean(reviewData.stagedEdits || Object.keys(localEdits).length > 0)}
          isEditMode={isEditMode}
          onAddChapter={handleAddChapter}
          onDeleteChapter={handleDeleteChapter}
          onReorderChapter={handleReorderChapter}
          onAddLesson={handleAddLesson}
          onDeleteLesson={handleDeleteLesson}
          onReorderLesson={handleReorderLesson}
        />

        {/* Center Pane: Content Preview & In-Place Editing (Column 2) */}
        <ReviewContentPreview
          course={effectiveCourse}
          baselineCourse={reviewData.course}
          selectedTarget={selectedTarget}
          isEditMode={isEditMode}
          onSaveNow={() => saveImmediately()}
          hasUnsavedChanges={hasUnsavedChanges}
          onUpdateMetadata={handleUpdateMetadata}
          onUpdateChapter={handleUpdateChapter}
          onUpdateItem={handleUpdateItem}
          onAddLesson={handleAddLesson}
          onDeleteLesson={handleDeleteLesson}
          onDeleteChapter={handleDeleteChapter}
          autosaveStatus={autosaveStatus}
          submissionType={reviewData.submissionType}
          isPublishedUpdate={reviewData.isPublishedUpdate}
        />

        {/* Left Pane: Review Inspector & Working Notes (Column 3) */}
        <ReviewInspector
          course={effectiveCourse}
          baselineCourse={reviewData.course}
          selectedTarget={selectedTarget}
          workingNotes={workingNotes}
          onSaveWorkingNotes={handleSaveWorkingNotes}
          auditLog={reviewData.auditLog || []}
          stagedEdits={serverRecord || reviewData.stagedEdits}
          onOpenDecisionModal={(mode) => setDecisionModal({ isOpen: true, mode })}
          autosaveStatus={autosaveStatus}
          hasUnsavedChanges={hasUnsavedChanges}
          hasConflict={autosaveStatus === 'conflict' || conflicts.length > 0}
        />
      </div>

      {/* Review Decision Modal (Phase 6: The Three Outcomes) */}
      <DecisionModal
        isOpen={decisionModal.isOpen}
        onClose={() => setDecisionModal((prev) => ({ ...prev, isOpen: false }))}
        mode={decisionModal.mode}
        course={effectiveCourse}
        baselineCourse={reviewData.course}
        stagedEdits={serverRecord || reviewData.stagedEdits}
        workingNotes={workingNotes}
        onSuccess={() => {
          loadReviewStudioData();
        }}
      />

      {/* Conflict Resolution Modal from Phase 3 */}
      <ConflictResolutionModal
        isOpen={autosaveStatus === 'conflict'}
        conflicts={conflicts}
        serverRevision={serverRecord?.clientRevision}
        isSaving={autosaveStatus === 'saving'}
        onKeepLocal={() => resolveConflict('keep_local')}
        onAcceptServer={() => resolveConflict('accept_server')}
        onCancel={() => resolveConflict('cancel')}
      />
    </div>
  );
};
