import React, { useState, useEffect } from 'react';
import type {
  Course,
  CourseChapter,
  ChapterItem,
  CourseLevel,
  ContentItemType,
} from '@/core/courses/types';
import type { ReviewTarget } from './CurriculumNavigator';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { ExternalResourcesEditor } from '@/features/courses/components/ExternalResourcesEditor';

export interface ReviewContentPreviewProps {
  course: Course;
  baselineCourse?: Course | null;
  selectedTarget: ReviewTarget;
  isEditMode: boolean;
  isExitingEditMode?: boolean;
  onSaveNow?: () => void;
  hasUnsavedChanges?: boolean;
  onUpdateMetadata: (patch: Partial<Course>) => void;
  onUpdateChapter: (chapterId: string, patch: Partial<CourseChapter>) => void;
  onUpdateItem: (chapterId: string, itemId: string, patch: Partial<ChapterItem>) => void;
  onAddLesson?: (chapterId: string) => void;
  onDeleteLesson?: (chapterId: string, itemId: string) => void;
  onDeleteChapter?: (chapterId: string) => void;
  autosaveStatus: 'idle' | 'saving' | 'saved' | 'conflict' | 'error';
  submissionType: 'new' | 'update';
  isPublishedUpdate: boolean;
}

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

export const ReviewContentPreview: React.FC<ReviewContentPreviewProps> = ({
  course,
  baselineCourse,
  selectedTarget,
  isEditMode,
  isExitingEditMode = false,
  onSaveNow,
  hasUnsavedChanges = false,
  onUpdateMetadata,
  onUpdateChapter,
  onUpdateItem,
  onAddLesson,
  onDeleteLesson,
  onDeleteChapter,
  autosaveStatus,
  submissionType,
  isPublishedUpdate,
}) => {
  const [videoError, setVideoError] = useState<boolean>(false);
  const [documentError, setDocumentError] = useState<boolean>(false);

  useEffect(() => {
    setVideoError(false);
    setDocumentError(false);
  }, [selectedTarget]);

  // Find active chapter and item from selectedTarget
  let activeChapter: CourseChapter | null = null;
  let activeItem: ChapterItem | null = null;

  if (selectedTarget.type === 'chapter') {
    activeChapter =
      (course.chapters || []).find((ch) => ch.id === selectedTarget.chapterId) || null;
  } else if (selectedTarget.type === 'item') {
    activeChapter =
      (course.chapters || []).find((ch) => ch.id === selectedTarget.chapterId) || null;
    if (activeChapter) {
      activeItem =
        (activeChapter.items || []).find((it) => it.id === selectedTarget.itemId) || null;
    }
  }

  // Find baseline counterparts for comparison
  let baselineChapter: CourseChapter | null = null;
  let baselineItem: ChapterItem | null = null;

  if (baselineCourse) {
    if (selectedTarget.type === 'chapter' && selectedTarget.chapterId) {
      baselineChapter =
        (baselineCourse.chapters || []).find((ch) => ch.id === selectedTarget.chapterId) || null;
    } else if (selectedTarget.type === 'item' && selectedTarget.chapterId) {
      baselineChapter =
        (baselineCourse.chapters || []).find((ch) => ch.id === selectedTarget.chapterId) || null;
      if (baselineChapter) {
        baselineItem =
          (baselineChapter.items || []).find((it) => it.id === selectedTarget.itemId) || null;
      }
    }
  }

  // Helper for autosave badge
  const renderAutosaveStatusBadge = () => {
    switch (autosaveStatus) {
      case 'saving':
        return (
          <Badge
            variant="warning"
            size="sm"
            data-testid="autosave-status-badge"
            className="animate-pulse"
          >
            جاري الحفظ التلقائي...
          </Badge>
        );
      case 'saved':
        return (
          <Badge variant="success" size="sm" dot data-testid="autosave-status-badge">
            تم حفظ تعديلات الإدارة
          </Badge>
        );
      case 'conflict':
        return (
          <Badge variant="danger" size="sm" data-testid="autosave-status-badge">
            تعارض في الحفظ
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="danger" size="sm" data-testid="autosave-status-badge">
            خطأ في الحفظ
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" size="sm" data-testid="autosave-status-badge">
            جاهز
          </Badge>
        );
    }
  };

  return (
    <main
      className="flex-1 flex flex-col min-w-0 bg-surface border border-border rounded-xl overflow-hidden shadow-sm h-full"
      data-testid="review-content-preview"
      dir="rtl"
    >
      {/* Top Header Banner */}
      <div className="p-4 border-b border-border bg-surface-muted/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface border border-border text-text-muted">
                معرف: {course.id}
              </span>
              {submissionType === 'update' || isPublishedUpdate ? (
                <Badge variant="info" size="sm">
                  تحديث لمقرر منشور
                </Badge>
              ) : (
                <Badge variant="primary" size="sm">
                  مقرر جديد
                </Badge>
              )}
              {renderAutosaveStatusBadge()}
            </div>
            <h1 className="text-lg font-bold text-text truncate max-w-xl">
              {course.title}
            </h1>
            <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
              <span>المحاضر: {course.lecturerName || 'غير محدد'}</span>
              <span>•</span>
              <span data-testid="review-submission-date">
                تاريخ التقديم: {formatSubmissionDate(course.submittedAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 p-6 overflow-y-auto bg-bg/20">
        {/* ── CASE 1: Course Root Selected ────────────────────────────────── */}
        {selectedTarget.type === 'course' && (
          <div className="space-y-6 max-w-3xl mx-auto" data-testid="preview-course-root">
            {isEditMode ? (
              /* Course Root Edit Form */
              <Card className="p-6 space-y-4" data-testid="edit-course-root-form">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="font-bold text-base text-text flex items-center gap-2">
                    <Icon name="edit" size="sm" className="text-primary" />
                    تعديل بيانات المقرر كمسؤول الجودة
                  </h3>
                  <Badge variant="warning" size="sm">
                    تعديلات مسودة الإدارة
                  </Badge>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="course-title-input" className="block text-xs font-semibold text-text">
                      عنوان المقرر
                    </label>
                    {baselineCourse?.title && baselineCourse.title !== course.title && (
                      <span className="text-[11px] text-text-muted" data-testid="baseline-comparison-title">
                        المقدم أصلاً: <strong className="text-text">{baselineCourse.title}</strong>
                      </span>
                    )}
                  </div>
                  <input
                    id="course-title-input"
                    type="text"
                    value={course.title || ''}
                    onChange={(e) => onUpdateMetadata({ title: e.target.value })}
                    data-testid="edit-course-title"
                    className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="course-desc-input" className="block text-xs font-semibold text-text">
                      وصف المقرر
                    </label>
                    {baselineCourse?.description && baselineCourse.description !== course.description && (
                      <span className="text-[11px] text-text-muted" data-testid="baseline-comparison-description">
                        معدل عن النسخة الأصلية
                      </span>
                    )}
                  </div>
                  <textarea
                    id="course-desc-input"
                    rows={4}
                    value={course.description || ''}
                    onChange={(e) => onUpdateMetadata({ description: e.target.value })}
                    data-testid="edit-course-description"
                    className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary resize-y"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="course-level-select" className="block text-xs font-semibold text-text mb-1">
                      المستوى
                    </label>
                    <select
                      id="course-level-select"
                      value={course.level || 'متوسط'}
                      onChange={(e) =>
                        onUpdateMetadata({ level: e.target.value as CourseLevel })
                      }
                      data-testid="edit-course-level"
                      className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
                    >
                      <option value="مبتدئ">مبتدئ</option>
                      <option value="متوسط">متوسط</option>
                      <option value="متقدم">متقدم</option>
                      <option value="شامل">شامل</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="course-hours-input" className="block text-xs font-semibold text-text">
                        الساعات التقديرية
                      </label>
                      {baselineCourse?.estimatedHours !== undefined &&
                        baselineCourse.estimatedHours !== course.estimatedHours && (
                          <span className="text-[11px] text-text-muted" data-testid="baseline-comparison-hours">
                            الأصلية: <span className="font-mono">{baselineCourse.estimatedHours}</span>
                          </span>
                        )}
                    </div>
                    <input
                      id="course-hours-input"
                      type="number"
                      min={1}
                      value={course.estimatedHours || 1}
                      onChange={(e) =>
                        onUpdateMetadata({ estimatedHours: Number(e.target.value) || 1 })
                      }
                      data-testid="edit-course-hours"
                      className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="course-job-titles-input" className="block text-xs font-semibold text-text mb-1">
                    المسميات الوظيفية المستهدفة (مفصولة بفواصل)
                  </label>
                  <input
                    id="course-job-titles-input"
                    type="text"
                    placeholder="مهندس إشارات، فني صيانة، قائد قطار..."
                    value={(course.targetJobTitles || []).join('، ')}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const list = raw
                        .split(/[,،]/)
                        .map((s) => s.trim())
                        .filter(Boolean);
                      onUpdateMetadata({ targetJobTitles: list });
                    }}
                    data-testid="edit-course-job-titles"
                    className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="border-t border-border pt-4">
                  <h4 className="text-xs font-semibold text-text mb-2">المصادر والمراجع الخارجية للمقرر</h4>
                  <ExternalResourcesEditor
                    resources={course.externalResources || []}
                    onChange={(updated) => onUpdateMetadata({ externalResources: updated })}
                    scopeLabel="للمقرر التدريبي ككل"
                  />
                </div>

                {onSaveNow && (
                  <div className="flex justify-end pt-4 border-t border-border mt-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={onSaveNow}
                      disabled={!hasUnsavedChanges || autosaveStatus === 'saving' || isExitingEditMode}
                      data-testid="save-now-root-btn"
                      className="text-xs font-semibold gap-1.5"
                    >
                      <Icon name="save" size="sm" />
                      <span>حفظ التعديلات الآن</span>
                    </Button>
                  </div>
                )}
              </Card>
            ) : (
              /* Course Root Read-Only Overview */
              <div className="space-y-6" data-testid="preview-course-overview">
                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Badge variant="primary" size="sm">
                      {course.level || 'متوسط'}
                    </Badge>
                    <Badge variant="neutral" size="sm">
                      {course.estimatedHours || 0} ساعات تدريبية
                    </Badge>
                    <Badge variant="neutral" size="sm">
                      {(course.chapters || []).length} فصول
                    </Badge>
                  </div>

                  <h2 className="text-xl font-bold text-text mb-3">{course.title}</h2>
                  <p className="text-text-muted text-sm leading-relaxed mb-4">
                    {course.description || 'لا يوجد وصف للمقرر حتى الآن.'}
                  </p>

                  {course.targetJobTitles && course.targetJobTitles.length > 0 && (
                    <div className="mb-4">
                      <span className="text-xs text-text-muted block mb-1.5 font-medium">
                        الوظائف المستهدفة:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {course.targetJobTitles.map((title, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 text-xs rounded bg-surface border border-border text-text font-medium"
                          >
                            {title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-surface-muted/50 border border-border text-center">
                    <div>
                      <div className="text-xs text-text-muted mb-1">الفصول</div>
                      <div className="text-lg font-bold text-text">
                        {(course.chapters || []).length}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-text-muted mb-1">الدروس</div>
                      <div className="text-lg font-bold text-text">
                        {(course.chapters || []).reduce(
                          (acc, ch) => acc + (ch.items || []).length,
                          0
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-text-muted mb-1">الساعات</div>
                      <div className="text-lg font-bold text-text">
                        {course.estimatedHours || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-text-muted mb-1">الحالة</div>
                      <div className="text-sm font-semibold text-primary">
                        {course.status}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ── CASE 2: Chapter Selected ────────────────────────────────────── */}
        {selectedTarget.type === 'chapter' && activeChapter && (
          <div className="max-w-3xl mx-auto space-y-4" data-testid="preview-chapter-view">
            <Card className="p-6">
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Icon name="bookOpen" size="md" className="text-primary" />
                  <span className="text-xs text-text-muted font-mono">
                    معرف الفصل: {activeChapter.id}
                  </span>
                </div>
                {isEditMode && (
                  <Badge variant="warning" size="sm">
                    نمط التعديل
                  </Badge>
                )}
              </div>

              {isEditMode ? (
                <div className="space-y-4" data-testid="edit-chapter-form">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="chapter-title-input" className="block text-xs font-semibold text-text">
                        عنوان الفصل
                      </label>
                      {baselineChapter?.title && baselineChapter.title !== activeChapter.title && (
                        <span className="text-[11px] text-text-muted" data-testid="baseline-comparison-chapter-title">
                          المقدم أصلاً: <strong className="text-text">{baselineChapter.title}</strong>
                        </span>
                      )}
                    </div>
                    <input
                      id="chapter-title-input"
                      type="text"
                      value={activeChapter.title || ''}
                      onChange={(e) =>
                        activeChapter &&
                        onUpdateChapter(activeChapter.id, { title: e.target.value })
                      }
                      data-testid="edit-chapter-title"
                      className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border mt-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {onAddLesson && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onAddLesson(activeChapter.id)}
                          data-testid="chapter-form-add-lesson-btn"
                          className="gap-1.5 text-xs font-semibold"
                        >
                          <Icon name="plus" size="sm" />
                          <span>إضافة درس لهذا الفصل</span>
                        </Button>
                      )}
                      {onSaveNow && (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={onSaveNow}
                          disabled={!hasUnsavedChanges || autosaveStatus === 'saving' || isExitingEditMode}
                          data-testid="save-now-chapter-btn"
                          className="text-xs font-semibold gap-1.5"
                        >
                          <Icon name="save" size="sm" />
                          <span>حفظ التعديلات الآن</span>
                        </Button>
                      )}
                    </div>
                    {onDeleteChapter && (course.chapters || []).length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onDeleteChapter(activeChapter.id)}
                        data-testid="chapter-form-delete-btn"
                        className="text-danger border-danger/40 hover:bg-danger/10 gap-1.5 text-xs font-semibold"
                      >
                        <Icon name="trash" size="sm" />
                        <span>حذف هذا الفصل</span>
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-lg font-bold text-text mb-2">
                    {activeChapter.title}
                  </h2>
                  <p className="text-xs text-text-muted mb-4">
                    يحتوي هذا الفصل على {(activeChapter.items || []).length} عناصر تدريبية.
                  </p>

                  <div className="space-y-2">
                    {(activeChapter.items || []).map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-3 bg-surface rounded-lg border border-border flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-text-muted font-mono">{idx + 1}.</span>
                          <span className="font-medium text-text">{item.title}</span>
                          <Badge variant="neutral" size="sm">
                            {item.type}
                          </Badge>
                        </div>
                        {item.duration && (
                          <span className="text-text-muted font-mono">{item.duration}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── CASE 3: Lesson Item Selected ────────────────────────────────── */}
        {selectedTarget.type === 'item' && activeItem && activeChapter && (
          <div className="max-w-4xl mx-auto space-y-4" data-testid="preview-item-view">
            {/* Item Title and Subheader */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <span className="text-xs text-text-muted font-medium block mb-1">
                  {activeChapter.title} &gt; {activeItem.title}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="primary" size="sm">
                    {activeItem.type}
                  </Badge>
                  {activeItem.duration && (
                    <Badge variant="neutral" size="sm">
                      {activeItem.duration}
                    </Badge>
                  )}
                  <span className="text-xs font-mono text-text-muted">
                    معرف الدرس: {activeItem.id}
                  </span>
                </div>
              </div>
            </div>

            {isEditMode ? (
              /* Item Edit Form */
              <Card className="p-6 space-y-4" data-testid="edit-item-form">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="font-bold text-sm text-text flex items-center gap-2">
                    <Icon name="edit" size="sm" className="text-primary" />
                    تعديل بيانات ومحتوى الدرس
                  </h3>
                  <Badge variant="warning" size="sm">
                    مسودة الإدارة
                  </Badge>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="item-title-input" className="block text-xs font-semibold text-text">
                      عنوان الدرس
                    </label>
                    {baselineItem?.title && baselineItem.title !== activeItem.title && (
                      <span className="text-[11px] text-text-muted" data-testid="baseline-comparison-item-title">
                        المقدم أصلاً: <strong className="text-text">{baselineItem.title}</strong>
                      </span>
                    )}
                  </div>
                  <input
                    id="item-title-input"
                    type="text"
                    value={activeItem.title || ''}
                    onChange={(e) =>
                      activeChapter &&
                      activeItem &&
                      onUpdateItem(activeChapter.id, activeItem.id, {
                        title: e.target.value,
                      })
                    }
                    data-testid="edit-item-title"
                    className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="item-type-select" className="block text-xs font-semibold text-text mb-1">
                      نوع الدرس ومحتواه
                    </label>
                    <select
                      id="item-type-select"
                      value={activeItem.type}
                      onChange={(e) =>
                        activeChapter &&
                        activeItem &&
                        onUpdateItem(activeChapter.id, activeItem.id, {
                          type: e.target.value as ContentItemType,
                        })
                      }
                      data-testid="edit-item-type"
                      className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
                    >
                      <option value="video">فيديو مرئي (Video)</option>
                      <option value="pdf">مستند إلكتروني (PDF)</option>
                      <option value="audio">ملف صوتي (Audio)</option>
                      <option value="powerpoint">عرض تقديمي (PowerPoint)</option>
                      <option value="docx">مستند نصي (Word/DOCX)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="item-duration-input" className="block text-xs font-semibold text-text mb-1">
                      المدة التقديرية (دقيقة:ثانية)
                    </label>
                    <input
                      id="item-duration-input"
                      type="text"
                      placeholder="10:00"
                      value={activeItem.duration || ''}
                      onChange={(e) =>
                        activeChapter &&
                        activeItem &&
                        onUpdateItem(activeChapter.id, activeItem.id, {
                          duration: e.target.value,
                        })
                      }
                      data-testid="edit-item-duration"
                      className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary font-mono"
                    />
                  </div>

                  <div>
                    <label htmlFor="item-url-input" className="block text-xs font-semibold text-text mb-1">
                      رابط المحتوى أو الوسائط
                    </label>
                    <input
                      id="item-url-input"
                      type="text"
                      placeholder="https://..."
                      value={activeItem.url || activeItem.externalUrl || ''}
                      onChange={(e) =>
                        activeChapter &&
                        activeItem &&
                        onUpdateItem(activeChapter.id, activeItem.id, {
                          url: e.target.value,
                        })
                      }
                      data-testid="edit-item-url"
                      className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary font-mono text-left"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <h4 className="text-xs font-semibold text-text mb-2">المصادر الخارجية للدرس</h4>
                  <ExternalResourcesEditor
                    resources={activeItem.externalResources || []}
                    onChange={(updated) =>
                      activeChapter &&
                      activeItem &&
                      onUpdateItem(activeChapter.id, activeItem.id, { externalResources: updated })
                    }
                    scopeLabel="لهذا الدرس التدريبي"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border mt-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    {onSaveNow && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={onSaveNow}
                        disabled={!hasUnsavedChanges || autosaveStatus === 'saving' || isExitingEditMode}
                        data-testid="save-now-item-btn"
                        className="text-xs font-semibold gap-1.5"
                      >
                        <Icon name="save" size="sm" />
                        <span>حفظ التعديلات الآن</span>
                      </Button>
                    )}
                  </div>
                  {onDeleteLesson && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        activeChapter && activeItem && onDeleteLesson(activeChapter.id, activeItem.id)
                      }
                      data-testid="delete-item-btn"
                      className="text-danger border-danger/40 hover:bg-danger/10 gap-1.5 text-xs font-semibold"
                    >
                      <Icon name="trash" size="sm" />
                      <span>حذف هذا الدرس من الفصل</span>
                    </Button>
                  )}
                </div>
              </Card>
            ) : (
              /* Real Side-Effect-Free Lesson Preview */
              <div className="space-y-4" data-testid="real-lesson-preview">
                {/* 1. Video Lesson Preview */}
                {activeItem.type === 'video' && (
                  <div
                    className="rounded-xl overflow-hidden bg-black/90 aspect-video flex items-center justify-center relative border border-border"
                    data-testid="preview-video-container"
                  >
                    {(activeItem.url || activeItem.externalUrl) && !videoError ? (
                      (activeItem.url || activeItem.externalUrl || '').includes('youtube.com') ||
                      (activeItem.url || activeItem.externalUrl || '').includes('youtu.be') ? (
                        <iframe
                          title={activeItem.title}
                          src={(activeItem.url || activeItem.externalUrl || '').replace('watch?v=', 'embed/')}
                          className="w-full h-full border-0"
                          sandbox="allow-scripts allow-same-origin allow-presentation"
                          data-testid="preview-video-player"
                        />
                      ) : (activeItem.url || activeItem.externalUrl || '').includes('drive.google.com') ? (
                        <iframe
                          title={activeItem.title}
                          src={(activeItem.url || activeItem.externalUrl || '').replace('/view', '/preview')}
                          className="w-full h-full border-0"
                          sandbox="allow-scripts allow-same-origin"
                          data-testid="preview-video-player"
                        />
                      ) : (
                        <video
                          controls
                          controlsList="nodownload"
                          src={activeItem.url || activeItem.externalUrl}
                          onError={() => setVideoError(true)}
                          className="w-full h-full object-contain"
                          data-testid="preview-video-player"
                        >
                          المتصفح لا يدعم تشغيل الفيديو.
                        </video>
                      )
                    ) : (
                      <div
                        className="text-center p-8 max-w-sm"
                        data-testid="media-unavailable-alert"
                      >
                        <Icon name="video" size="lg" className="mx-auto text-text-muted mb-2" />
                        <p className="text-text text-sm font-semibold mb-1">
                          معاينة الفيديو غير متاحة
                        </p>
                        <p className="text-text-muted text-xs">
                          {activeItem.url || activeItem.externalUrl
                            ? 'تعذر تحميل ملف الوسائط من الرابط المحدد.'
                            : 'لم يتم إرفاق رابط وسائط صالح لهذا الدرس.'}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. PDF In-Workspace Document Preview */}
                {activeItem.type === 'pdf' && (
                  <div className="space-y-3" data-testid="preview-document-viewer">
                    {activeItem.url || activeItem.externalUrl ? (
                      !documentError ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-surface border border-border rounded-lg">
                            <div className="flex items-center gap-2">
                              <Icon name="fileText" size="md" className="text-primary" />
                              <span className="font-semibold text-sm text-text">{activeItem.title}</span>
                              <Badge variant="neutral" size="sm">PDF</Badge>
                            </div>
                            <a
                              href={activeItem.url || activeItem.externalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-muted hover:bg-neutral-light border border-border text-text rounded-md text-xs font-medium transition-colors"
                            >
                              <Icon name="externalLink" size="sm" />
                              فتح المستند للاطلاع
                            </a>
                          </div>

                          <iframe
                            src={activeItem.url || activeItem.externalUrl}
                            title={activeItem.title}
                            className="w-full h-[600px] rounded-xl border border-border bg-surface"
                            sandbox="allow-scripts allow-same-origin allow-forms"
                            data-testid="preview-pdf-frame"
                            onError={() => setDocumentError(true)}
                          />
                        </div>
                      ) : (
                        <div
                          className="p-8 text-center max-w-sm mx-auto bg-surface border border-border rounded-xl"
                          data-testid="document-unavailable-alert"
                        >
                          <Icon name="fileText" size="lg" className="mx-auto text-text-muted mb-2" />
                          <p className="text-text text-sm font-semibold mb-1">معاينة المستند غير متاحة</p>
                          <p className="text-text-muted text-xs">
                            تعذر تحميل ملف المستند من الرابط المحدد.
                          </p>
                        </div>
                      )
                    ) : (
                      <div
                        className="p-8 text-center max-w-sm mx-auto bg-surface border border-border rounded-xl"
                        data-testid="document-unavailable-alert"
                      >
                        <Icon name="fileText" size="lg" className="mx-auto text-text-muted mb-2" />
                        <p className="text-text text-sm font-semibold mb-1">معاينة المستند غير متاحة</p>
                        <p className="text-text-muted text-xs">
                          لم يتم إرفاق رابط مستند صالح لهذا الدرس.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. PowerPoint & Word In-Workspace Document Preview */}
                {(activeItem.type === 'powerpoint' || activeItem.type === 'docx') && (
                  <div className="space-y-3" data-testid="preview-document-viewer">
                    {activeItem.url || activeItem.externalUrl ? (
                      (activeItem.url || activeItem.externalUrl || '').includes('drive.google.com') ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-surface border border-border rounded-lg">
                            <div className="flex items-center gap-2">
                              <Icon name="fileText" size="md" className="text-primary" />
                              <span className="font-semibold text-sm text-text">{activeItem.title}</span>
                              <Badge variant="neutral" size="sm">
                                {activeItem.type === 'powerpoint' ? 'PowerPoint' : 'Word'}
                              </Badge>
                            </div>
                            <a
                              href={activeItem.url || activeItem.externalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-muted hover:bg-neutral-light border border-border text-text rounded-md text-xs font-medium transition-colors"
                            >
                              <Icon name="externalLink" size="sm" />
                              فتح المستند للاطلاع
                            </a>
                          </div>

                          <iframe
                            src={(activeItem.url || activeItem.externalUrl || '').replace('/view', '/preview')}
                            title={activeItem.title}
                            className="w-full h-[600px] rounded-xl border border-border bg-surface"
                            sandbox="allow-scripts allow-same-origin"
                            data-testid="preview-office-frame"
                          />
                        </div>
                      ) : (activeItem.url || activeItem.externalUrl || '').includes('officeapps.live.com') ||
                        (activeItem.url || activeItem.externalUrl || '').includes('onedrive') ||
                        (activeItem.url || activeItem.externalUrl || '').includes('sharepoint') ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-surface border border-border rounded-lg">
                            <div className="flex items-center gap-2">
                              <Icon name="fileText" size="md" className="text-primary" />
                              <span className="font-semibold text-sm text-text">{activeItem.title}</span>
                              <Badge variant="neutral" size="sm">
                                {activeItem.type === 'powerpoint' ? 'PowerPoint' : 'Word'}
                              </Badge>
                            </div>
                            <a
                              href={activeItem.url || activeItem.externalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-muted hover:bg-neutral-light border border-border text-text rounded-md text-xs font-medium transition-colors"
                            >
                              <Icon name="externalLink" size="sm" />
                              فتح المستند للاطلاع
                            </a>
                          </div>

                          <iframe
                            src={activeItem.url || activeItem.externalUrl}
                            title={activeItem.title}
                            className="w-full h-[600px] rounded-xl border border-border bg-surface"
                            sandbox="allow-scripts allow-same-origin"
                            data-testid="preview-office-frame"
                          />
                        </div>
                      ) : (
                        /* Direct binary without cloud preview provider: render metadata card with limitation notice & download link */
                        <Card className="p-8 text-center">
                          <Icon name="fileText" size="lg" className="mx-auto text-primary mb-3" />
                          <h3 className="text-base font-bold text-text mb-1">{activeItem.title}</h3>
                          <Badge variant="neutral" size="sm" className="mb-3">
                            {activeItem.type === 'powerpoint' ? 'عرض تقديمي (PowerPoint)' : 'مستند نصي (Word)'}
                          </Badge>
                          <p className="text-text-muted text-xs max-w-md mx-auto mb-4">
                            المعاينة المباشرة داخل المتصفح لملفات Office الثنائية تتطلب استضافتها على موفر متوافق (مثل Google Drive أو OneDrive).
                          </p>
                          <a
                            href={activeItem.url || activeItem.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-surface rounded-lg text-xs font-semibold hover:bg-primary-dark transition-colors"
                          >
                            <Icon name="externalLink" size="sm" />
                            فتح المستند للاطلاع
                          </a>
                        </Card>
                      )
                    ) : (
                      <div
                        className="p-8 text-center max-w-sm mx-auto bg-surface border border-border rounded-xl"
                        data-testid="document-unavailable-alert"
                      >
                        <Icon name="fileText" size="lg" className="mx-auto text-text-muted mb-2" />
                        <p className="text-text text-sm font-semibold mb-1">معاينة المستند غير متاحة</p>
                        <p className="text-text-muted text-xs">
                          لم يتم إرفاق رابط مستند صالح لهذا الدرس.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Image Lesson Preview */}
                {activeItem.type === 'image' && (
                  <div
                    className="p-4 bg-surface rounded-xl border border-border text-center"
                    data-testid="preview-image-viewer"
                  >
                    {activeItem.url || activeItem.externalUrl ? (
                      <img
                        src={activeItem.url || activeItem.externalUrl}
                        alt={activeItem.title}
                        className="max-h-96 mx-auto rounded-lg object-contain"
                      />
                    ) : (
                      <div className="p-8 text-text-muted text-xs">
                        لم يتم توفير صورة للعرض.
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Audio Lesson Preview */}
                {activeItem.type === 'audio' && (
                  <Card className="p-6 text-center" data-testid="preview-audio-viewer">
                    <Icon name="volume" size="lg" className="mx-auto text-primary mb-3" />
                    <h3 className="text-sm font-bold text-text mb-2">{activeItem.title}</h3>
                    {activeItem.url || activeItem.externalUrl ? (
                      <audio controls className="w-full max-w-md mx-auto mt-2">
                        <source src={activeItem.url || activeItem.externalUrl} />
                        المتصفح لا يدعم مشغل الصوت.
                      </audio>
                    ) : (
                      <span className="text-text-muted text-xs">
                        رابط الملف الصوتي غير متاح حالياً.
                      </span>
                    )}
                  </Card>
                )}

                {/* Side-Effect-Free Guarantee Notice */}
                <div className="p-3 rounded-lg bg-surface-muted/40 border border-border/60 text-[11px] text-text-muted flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="shield" size="sm" className="text-success" />
                    <span>
                      المعاينة تعمل بنمط التدقيق الآمن (قراءة فقط بدون احتساب تقدم أو وقت مشاهدة للمتدربين).
                    </span>
                  </div>
                  <span className="font-mono text-[10px]">Read-Only Mode</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
};
