import React, { useState } from 'react';
import type {
  Course,
  CourseChapter,
  ChapterItem,
  ContentItemType,
  ReviewerWorkingNotes,
} from '@/core/courses/types';
import { Icon, type SemanticIconName } from '@/shared/ui/Icon';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';

export type ReviewTarget =
  | { type: 'course' }
  | { type: 'chapter'; chapterId: string }
  | { type: 'item'; chapterId: string; itemId: string };

export interface CurriculumNavigatorProps {
  course: Course;
  selectedTarget: ReviewTarget;
  onSelectTarget: (target: ReviewTarget) => void;
  workingNotes: ReviewerWorkingNotes | null;
  submissionType: 'new' | 'update';
  hasStagedEdits?: boolean;
  isEditMode?: boolean;
  onAddChapter?: () => void;
  onDeleteChapter?: (chapterId: string) => void;
  onReorderChapter?: (chapterId: string, direction: 'up' | 'down') => void;
  onAddLesson?: (chapterId: string) => void;
  onDeleteLesson?: (chapterId: string, itemId: string) => void;
  onReorderLesson?: (chapterId: string, itemId: string, direction: 'up' | 'down') => void;
}

function getItemSemanticIcon(type: ContentItemType): SemanticIconName {
  switch (type) {
    case 'video':
      return 'video';
    case 'pdf':
    case 'powerpoint':
    case 'docx':
      return 'fileText';
    case 'image':
      return 'palette';
    case 'audio':
      return 'volume';
    default:
      return 'file';
  }
}

export const CurriculumNavigator: React.FC<CurriculumNavigatorProps> = ({
  course,
  selectedTarget,
  onSelectTarget,
  workingNotes,
  submissionType,
  hasStagedEdits = false,
  isEditMode = false,
  onAddChapter,
  onDeleteChapter,
  onReorderChapter,
  onAddLesson,
  onDeleteLesson,
  onReorderLesson,
}) => {
  // Accordion open chapters (default all open)
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    (course.chapters || []).forEach((ch) => {
      initial[ch.id] = true;
    });
    return initial;
  });

  const toggleChapter = (chapterId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const isCourseSelected = selectedTarget.type === 'course';

  return (
    <aside
      className="w-full lg:w-80 shrink-0 bg-surface border border-border rounded-xl p-4 flex flex-col h-full overflow-hidden shadow-sm"
      data-testid="curriculum-navigator"
      dir="rtl"
    >
      {/* Header */}
      <div className="pb-3 mb-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon name="bookOpen" size="sm" className="text-primary" />
            <h2 className="font-bold text-sm text-text">هيكل ومحتوى المقرر</h2>
          </div>
          {submissionType === 'update' ? (
            <Badge variant="info" size="sm">
              تحديث منشور
            </Badge>
          ) : (
            <Badge variant="primary" size="sm">
              مقرر جديد
            </Badge>
          )}
        </div>
        <p className="text-text-muted text-[11px]">
          انقر لاختيار المقرر كاملاً أو فحص الدروس المحددة.
        </p>
      </div>

      {/* Course Root Selector */}
      <button
        type="button"
        onClick={() => onSelectTarget({ type: 'course' })}
        data-testid="nav-course-root"
        className={`w-full text-right p-3 rounded-lg mb-3 border transition-all ${
          isCourseSelected
            ? 'bg-primary-light/50 border-primary shadow-xs font-semibold'
            : 'bg-surface-muted/50 border-border/80 hover:bg-surface-muted hover:border-primary/40'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Icon name="courses" size="sm" className="text-primary" />
            <span className="text-xs font-bold text-text truncate max-w-[180px]">
              {course.title || 'بيانات المقرر العامة'}
            </span>
          </div>
          {workingNotes?.generalNote && (
            <Badge
              variant="warning"
              size="sm"
              dot
              data-testid="note-badge-course"
              title="توجد ملاحظة عامة خاصة"
            >
              ملاحظة
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span>{course.level || 'متوسط'}</span>
          <span>•</span>
          <span>{(course.chapters || []).length} فصول</span>
          {hasStagedEdits && (
            <>
              <span>•</span>
              <span className="text-warning-dark font-medium">معدل</span>
            </>
          )}
        </div>
      </button>

      {/* Add Chapter Button (Active in Edit Mode) */}
      {isEditMode && onAddChapter && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAddChapter}
          data-testid="add-chapter-btn"
          className="w-full justify-center gap-1.5 mb-3 text-xs border-dashed border-primary/50 text-primary hover:bg-primary/5 font-semibold"
        >
          <Icon name="plus" size="sm" />
          <span>إضافة فصل جديد للمقرر</span>
        </Button>
      )}

      {/* Chapters & Items Accordion */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {(course.chapters || []).map((chapter: CourseChapter, chIndex: number) => {
          const isOpen = openChapters[chapter.id] ?? true;
          const isChapterSelected =
            selectedTarget.type === 'chapter' && selectedTarget.chapterId === chapter.id;
          const chapterHasNote = Boolean(workingNotes?.chapterNotes?.[chapter.id]);

          return (
            <div
              key={chapter.id}
              className="border border-border/80 rounded-lg overflow-hidden bg-bg/40"
              data-testid={`chapter-block-${chapter.id}`}
            >
              {/* Chapter Header */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelectTarget({ type: 'chapter', chapterId: chapter.id })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelectTarget({ type: 'chapter', chapterId: chapter.id });
                  }
                }}
                data-testid={`nav-chapter-${chapter.id}`}
                className={`w-full flex items-center justify-between p-2.5 text-right text-xs cursor-pointer select-none transition-colors ${
                  isChapterSelected
                    ? 'bg-primary/10 text-primary-dark font-bold'
                    : 'bg-surface-muted/60 hover:bg-surface-muted text-text font-medium'
                }`}
              >
                <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                  <span className="text-text-muted font-mono text-[10px] w-4 shrink-0">
                    {chIndex + 1}
                  </span>
                  <span className="truncate">{chapter.title}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {chapterHasNote && (
                    <span
                      className="w-2 h-2 rounded-full bg-warning-dark shrink-0"
                      title="توجد ملاحظة خاصة على الفصل"
                      data-testid={`note-dot-chapter-${chapter.id}`}
                    />
                  )}
                  <span className="text-text-muted text-[10px]">
                    ({(chapter.items || []).length})
                  </span>

                  {/* Chapter Editing Actions */}
                  {isEditMode && (
                    <div
                      className="flex items-center gap-0.5 ml-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {onReorderChapter && chIndex > 0 && (
                        <button
                          type="button"
                          onClick={() => onReorderChapter(chapter.id, 'up')}
                          data-testid={`move-chapter-up-${chapter.id}`}
                          aria-label="تقديم الفصل للأعلى"
                          title="تقديم الفصل للأعلى"
                          className="p-1 hover:text-primary text-text-muted rounded"
                        >
                          <Icon name="chevronUp" size="sm" />
                        </button>
                      )}
                      {onReorderChapter && chIndex < (course.chapters || []).length - 1 && (
                        <button
                          type="button"
                          onClick={() => onReorderChapter(chapter.id, 'down')}
                          data-testid={`move-chapter-down-${chapter.id}`}
                          aria-label="تأخير الفصل للأسفل"
                          title="تأخير الفصل للأسفل"
                          className="p-1 hover:text-primary text-text-muted rounded"
                        >
                          <Icon name="chevronDown" size="sm" />
                        </button>
                      )}
                      {onAddLesson && (
                        <button
                          type="button"
                          onClick={() => onAddLesson(chapter.id)}
                          data-testid={`add-lesson-header-btn-${chapter.id}`}
                          aria-label="إضافة درس للفصل"
                          title="إضافة درس للفصل"
                          className="p-1 hover:text-primary text-text-muted rounded"
                        >
                          <Icon name="plus" size="sm" />
                        </button>
                      )}
                      {onDeleteChapter && (course.chapters || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteChapter(chapter.id)}
                          data-testid={`delete-chapter-btn-${chapter.id}`}
                          aria-label="حذف الفصل"
                          title="حذف الفصل"
                          className="p-1 hover:text-danger text-text-muted rounded"
                        >
                          <Icon name="trash" size="sm" />
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={(e) => toggleChapter(chapter.id, e)}
                    aria-label={isOpen ? 'طي الفصل' : 'توسيع الفصل'}
                    className="p-0.5 hover:text-text text-text-muted rounded"
                  >
                    <Icon name={isOpen ? 'chevronUp' : 'chevronDown'} size="sm" />
                  </button>
                </div>
              </div>

              {/* Chapter Lessons List */}
              {isOpen && (
                <div className="divide-y divide-border/40 bg-surface/50">
                  {(chapter.items || []).map((item: ChapterItem, itemIdx: number) => {
                    const isItemSelected =
                      selectedTarget.type === 'item' &&
                      selectedTarget.itemId === item.id;
                    const itemHasNote = Boolean(workingNotes?.itemNotes?.[item.id]);

                    return (
                      <div
                        key={item.id}
                        className={`w-full text-right py-2 px-3 flex items-center justify-between text-xs transition-colors ${
                          isItemSelected
                            ? 'bg-primary text-surface font-semibold shadow-xs'
                            : 'hover:bg-surface-muted/80 text-text'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            onSelectTarget({
                              type: 'item',
                              chapterId: chapter.id,
                              itemId: item.id,
                            })
                          }
                          data-testid={`nav-item-${item.id}`}
                          className="flex items-center gap-2 truncate pl-1 flex-1 min-w-0 text-right"
                        >
                          <Icon
                            name={getItemSemanticIcon(item.type)}
                            size="sm"
                            className={isItemSelected ? 'text-surface' : 'text-primary shrink-0'}
                          />
                          <span className="truncate">{item.title}</span>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {itemHasNote && (
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isItemSelected ? 'bg-surface' : 'bg-warning-dark'
                              }`}
                              title="توجد ملاحظة خاصة على الدرس"
                              data-testid={`note-badge-${item.id}`}
                            />
                          )}
                          {item.duration && (
                            <span
                              className={`text-[10px] font-mono ${
                                isItemSelected ? 'text-surface/80' : 'text-text-muted'
                              }`}
                            >
                              {item.duration}
                            </span>
                          )}

                          {/* Lesson Editing Actions */}
                          {isEditMode && (
                            <div
                              className="flex items-center gap-0.5 ml-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {onReorderLesson && itemIdx > 0 && (
                                <button
                                  type="button"
                                  onClick={() => onReorderLesson(chapter.id, item.id, 'up')}
                                  data-testid={`move-lesson-up-${item.id}`}
                                  aria-label="تقديم الدرس للأعلى"
                                  title="تقديم الدرس للأعلى"
                                  className={`p-1 rounded ${
                                    isItemSelected
                                      ? 'text-surface hover:text-surface/80'
                                      : 'text-text-muted hover:text-primary'
                                  }`}
                                >
                                  <Icon name="chevronUp" size="sm" />
                                </button>
                              )}
                              {onReorderLesson && itemIdx < (chapter.items || []).length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => onReorderLesson(chapter.id, item.id, 'down')}
                                  data-testid={`move-lesson-down-${item.id}`}
                                  aria-label="تأخير الدرس للأسفل"
                                  title="تأخير الدرس للأسفل"
                                  className={`p-1 rounded ${
                                    isItemSelected
                                      ? 'text-surface hover:text-surface/80'
                                      : 'text-text-muted hover:text-primary'
                                  }`}
                                >
                                  <Icon name="chevronDown" size="sm" />
                                </button>
                              )}
                              {onDeleteLesson && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteLesson(chapter.id, item.id)}
                                  data-testid={`delete-lesson-btn-${item.id}`}
                                  aria-label="حذف الدرس"
                                  title="حذف الدرس"
                                  className={`p-1 rounded ${
                                    isItemSelected
                                      ? 'text-surface hover:text-danger-light'
                                      : 'text-text-muted hover:text-danger'
                                  }`}
                                >
                                  <Icon name="trash" size="sm" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Lesson to Chapter in Edit Mode */}
                  {isEditMode && onAddLesson && (
                    <button
                      type="button"
                      onClick={() => onAddLesson(chapter.id)}
                      data-testid={`add-lesson-btn-${chapter.id}`}
                      className="w-full text-center py-2 px-3 text-xs font-semibold text-primary hover:bg-primary/5 border-t border-dashed border-border/80 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Icon name="plus" size="sm" />
                      <span>إضافة درس لهذا الفصل</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
