import React, { useState } from 'react';
import type {
  CourseChapter,
  ChapterItem,
  RefresherCourseConfig,
  ReviewFeedbackItem,
} from '@/core/courses/types';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon, type SemanticIconName } from '@/shared/ui/Icon';
import { ConfirmDialog, type ConfirmDialogVariant } from '@/shared/ui/ConfirmDialog';
import { Modal } from '@/shared/ui/Modal';
import { ItemEditorModal } from './ItemEditorModal';
import {
  isItemVisibleInRefresher,
  calculateRefresherStats,
  assessRefresherImpact,
} from '@/core/courses/refresher';

export interface CurriculumTreeEditorProps {
  chapters: CourseChapter[];
  onChange?: (updatedChapters: CourseChapter[]) => void;
  mode?: 'curriculum' | 'refresher';
  refresherConfig?: RefresherCourseConfig;
  onRefresherConfigChange?: (updatedConfig: RefresherCourseConfig) => void;
  feedbackItems?: ReviewFeedbackItem[];
  readOnly?: boolean;
}

interface ConfirmationModalState {
  title: string;
  message: string;
  confirmLabel: string;
  variant: ConfirmDialogVariant;
  onConfirm: () => void;
}

export const CurriculumTreeEditor: React.FC<CurriculumTreeEditorProps> = ({
  chapters,
  onChange,
  mode = 'curriculum',
  refresherConfig,
  onRefresherConfigChange,
  feedbackItems,
  readOnly = false,
}) => {
  const isRefresherMode = mode === 'refresher';
  const isRefresherEnabled = Boolean(refresherConfig?.enabled);

  // Modal state for contextual reviewer feedback notes
  const [activeFeedbackNote, setActiveFeedbackNote] = useState<{
    title: string;
    comment: string;
  } | null>(null);

  // Modal state for editing/adding lesson items (curriculum mode only)
  const [editingItemInfo, setEditingItemInfo] = useState<{
    chapterId: string;
    chapterTitle: string;
    item: ChapterItem | null;
  } | null>(null);

  // New chapter input state (curriculum mode only)
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [isAddingChapter, setIsAddingChapter] = useState(false);

  // Unified Confirmation Modal (destructive deletes & refresher impact warnings)
  const [confirmation, setConfirmation] = useState<ConfirmationModalState | null>(null);

  // Curriculum Mode: Inline original chapter title editing state
  const [editingCurriculumChapterId, setEditingCurriculumChapterId] = useState<string | null>(null);
  const [editingCurriculumChapterTitleValue, setEditingCurriculumChapterTitleValue] = useState<string>('');

  // Refresher Mode: Inline title editing state (items & chapters)
  const [editingTitleItemId, setEditingTitleItemId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState<string>('');
  const [editingTitleChapterId, setEditingTitleChapterId] = useState<string | null>(null);
  const [editingChapterTitleValue, setEditingChapterTitleValue] = useState<string>('');

  // Refresher Statistics
  const refresherStats = calculateRefresherStats(chapters, refresherConfig);

  // =========================================================================
  // Refresher Mode Configuration Handlers
  // =========================================================================
  const handleToggleRefresher = (enabled: boolean) => {
    if (!onRefresherConfigChange) return;
    if (enabled) {
      onRefresherConfigChange({
        ...refresherConfig,
        enabled: true,
        chapters: refresherConfig?.chapters || {},
        items: refresherConfig?.items || {},
      });
    } else {
      // Retain saved configuration while disabling feature
      onRefresherConfigChange({
        ...refresherConfig,
        enabled: false,
      });
    }
  };

  const handleToggleItemVisibility = (itemId: string, isVisible: boolean) => {
    if (!onRefresherConfigChange) return;
    const existing = refresherConfig?.items?.[itemId] || { itemId, isVisible: true };
    const updatedItems = {
      ...(refresherConfig?.items || {}),
      [itemId]: {
        ...existing,
        isVisible,
      },
    };
    onRefresherConfigChange({
      ...refresherConfig,
      enabled: true,
      items: updatedItems,
    });
  };

  const handleSaveCustomTitle = (itemId: string) => {
    if (!onRefresherConfigChange) return;
    const trimmed = editingTitleValue.trim();
    const existing = refresherConfig?.items?.[itemId] || { itemId, isVisible: true };
    const updatedItems = {
      ...(refresherConfig?.items || {}),
      [itemId]: {
        ...existing,
        customTitle: trimmed || undefined,
      },
    };
    onRefresherConfigChange({
      ...refresherConfig,
      enabled: true,
      items: updatedItems,
    });
    setEditingTitleItemId(null);
    setEditingTitleValue('');
  };

  const handleResetCustomTitle = (itemId: string) => {
    if (!onRefresherConfigChange) return;
    const existing = refresherConfig?.items?.[itemId];
    if (!existing) return;

    const updatedItems = { ...(refresherConfig?.items || {}) };
    if (updatedItems[itemId]) {
      updatedItems[itemId] = {
        ...updatedItems[itemId],
        customTitle: undefined,
      };
    }

    onRefresherConfigChange({
      ...refresherConfig,
      enabled: true,
      items: updatedItems,
    });
    if (editingTitleItemId === itemId) {
      setEditingTitleItemId(null);
    }
  };

  const handleSaveCustomChapterTitle = (chapterId: string) => {
    if (!onRefresherConfigChange) return;
    const trimmed = editingChapterTitleValue.trim();
    const existing = refresherConfig?.chapters?.[chapterId] || { chapterId };
    const updatedChapters = {
      ...(refresherConfig?.chapters || {}),
      [chapterId]: {
        ...existing,
        customTitle: trimmed || undefined,
      },
    };
    onRefresherConfigChange({
      ...refresherConfig,
      enabled: true,
      chapters: updatedChapters,
    });
    setEditingTitleChapterId(null);
    setEditingChapterTitleValue('');
  };

  const handleResetCustomChapterTitle = (chapterId: string) => {
    if (!onRefresherConfigChange) return;
    const existing = refresherConfig?.chapters?.[chapterId];
    if (!existing) return;

    const updatedChapters = { ...(refresherConfig?.chapters || {}) };
    if (updatedChapters[chapterId]) {
      updatedChapters[chapterId] = {
        ...updatedChapters[chapterId],
        customTitle: undefined,
      };
    }

    onRefresherConfigChange({
      ...refresherConfig,
      enabled: true,
      chapters: updatedChapters,
    });
    if (editingTitleChapterId === chapterId) {
      setEditingTitleChapterId(null);
    }
  };

  // =========================================================================
  // Curriculum Mode: Chapter Actions
  // =========================================================================
  const handleAddChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapterTitle.trim() || !onChange) return;

    const newChapter: CourseChapter = {
      id: `CH_${Date.now()}`,
      title: newChapterTitle.trim(),
      order: chapters.length + 1,
      items: [],
    };

    onChange([...chapters, newChapter]);
    setNewChapterTitle('');
    setIsAddingChapter(false);
  };

  const handleMoveChapter = (index: number, direction: 'up' | 'down') => {
    if (!onChange) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= chapters.length) return;

    const applyMove = () => {
      const updated = [...chapters];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;

      updated.forEach((ch, idx) => {
        ch.order = idx + 1;
      });

      onChange(updated);
      setConfirmation(null);
    };

    const impact = assessRefresherImpact('move_chapter', {
      refresherConfig,
      chapters,
      index,
      direction,
    });

    if (impact.hasImpact) {
      setConfirmation({
        title: 'تأثير تغيير ترتيب الفصول على النسخة التذكيرية',
        message: impact.impactMessage || 'تغيير ترتيب الفصول سيؤثر أيضًا على تسلسل الفصول في النسخة التذكيرية للمقرر. هل تريد المتابعة؟',
        confirmLabel: 'تأكيد تغيير الترتيب',
        variant: 'warning',
        onConfirm: applyMove,
      });
      return;
    }

    applyMove();
  };

  const executeDeleteChapter = (chapterId: string) => {
    if (!onChange) return;
    const chapterToDelete = chapters.find((ch) => ch.id === chapterId);
    const updated = chapters
      .filter((ch) => ch.id !== chapterId)
      .map((ch, idx) => ({ ...ch, order: idx + 1 }));
    onChange(updated);

    // Clean up refresher configuration references to prevent broken links
    if (chapterToDelete && onRefresherConfigChange) {
      const updatedItems = { ...(refresherConfig?.items || {}) };
      let itemsChanged = false;
      chapterToDelete.items.forEach((it) => {
        if (updatedItems[it.id]) {
          delete updatedItems[it.id];
          itemsChanged = true;
        }
      });

      const updatedChapters = { ...(refresherConfig?.chapters || {}) };
      let chaptersChanged = false;
      if (updatedChapters[chapterToDelete.id]) {
        delete updatedChapters[chapterToDelete.id];
        chaptersChanged = true;
      }

      if (itemsChanged || chaptersChanged) {
        onRefresherConfigChange({
          ...refresherConfig,
          enabled: Boolean(refresherConfig?.enabled),
          chapters: updatedChapters,
          items: updatedItems,
        });
      }
    }
    setConfirmation(null);
  };

  const promptDeleteChapter = (chapter: CourseChapter) => {
    const impact = assessRefresherImpact('delete_chapter', {
      refresherConfig,
      chapter,
    });

    const isImpact = impact.hasImpact;
    setConfirmation({
      title: isImpact ? 'تأثير حذف الفصل على النسخة التذكيرية' : 'تأكيد الحذف النهائي',
      message: isImpact
        ? impact.impactMessage || 'هذا الحذف سيؤثر أيضًا على النسخة التذكيرية من الكورس حيث يحتوي هذا الفصل على محتويات مفعلة بها. هل تريد المتابعة؟'
        : `هل أنت متأكد من حذف الفصل "${chapter.title}"؟ سيتم حذف جميع الدروس والمحتويات التابعة له نهائياً.`,
      confirmLabel: 'تأكيد حذف الفصل',
      variant: 'destructive',
      onConfirm: () => executeDeleteChapter(chapter.id),
    });
  };

  // =========================================================================
  // Curriculum Mode: Chapter Title Inline Editing Handlers
  // =========================================================================
  const handleStartEditCurriculumChapterTitle = (chapterId: string, currentTitle: string) => {
    setEditingCurriculumChapterId(chapterId);
    setEditingCurriculumChapterTitleValue(currentTitle);
  };

  const handleCancelCurriculumChapterTitle = () => {
    setEditingCurriculumChapterId(null);
    setEditingCurriculumChapterTitleValue('');
  };

  const handleSaveCurriculumChapterTitle = (chapterId: string) => {
    if (!onChange) return;
    const cleanTitle = editingCurriculumChapterTitleValue.trim();
    if (!cleanTitle) return;

    const chapter = chapters.find((ch) => ch.id === chapterId);
    if (!chapter) return;

    const applyEdit = () => {
      const updated = chapters.map((ch) =>
        ch.id === chapterId ? { ...ch, title: cleanTitle } : ch
      );
      onChange(updated);
      setConfirmation(null);
      setEditingCurriculumChapterId(null);
      setEditingCurriculumChapterTitleValue('');
    };

    const impact = assessRefresherImpact('edit_chapter', {
      refresherConfig,
      chapter,
      newTitle: cleanTitle,
    });

    if (impact.hasImpact) {
      setConfirmation({
        title: 'تأثير تعديل عنوان الفصل على النسخة التذكيرية',
        message:
          impact.impactMessage ||
          'تعديل عنوان الفصل سيؤدي أيضًا إلى تحديث اسمه في النسخة التذكيرية للمقرر. هل تريد المتابعة؟',
        confirmLabel: 'تأكيد تعديل عنوان الفصل',
        variant: 'warning',
        onConfirm: applyEdit,
      });
      return;
    }

    applyEdit();
  };

  // =========================================================================
  // Curriculum Mode: Lesson Item Actions
  // =========================================================================
  const executeSaveItem = (itemData: ChapterItem, chapterId: string, item: ChapterItem | null) => {
    if (!onChange) return;
    const updated = chapters.map((ch) => {
      if (ch.id !== chapterId) return ch;

      const itemExists = ch.items.some((it) => it.id === itemData.id);
      let updatedItems: ChapterItem[];

      if (item && itemExists) {
        updatedItems = ch.items.map((it) => (it.id === itemData.id ? itemData : it));
      } else {
        updatedItems = [...ch.items, itemData];
      }

      return { ...ch, items: updatedItems };
    });

    onChange(updated);
    setEditingItemInfo(null);
    setConfirmation(null);
  };

  const handleSaveItem = (itemData: ChapterItem) => {
    if (!editingItemInfo) return;
    const { chapterId, item } = editingItemInfo;

    // 1. Adding a new item to an existing chapter
    if (!item) {
      const chapter = chapters.find((ch) => ch.id === chapterId);
      const impact = assessRefresherImpact('add_item', {
        refresherConfig,
        newItem: itemData,
        chapter,
      });

      if (impact.hasImpact) {
        setConfirmation({
          title: 'تأثير إضافة المحتوى على النسخة التذكيرية',
          message: impact.impactMessage || 'إضافة هذا الدرس سيؤدي أيضًا إلى إدراجه تلقائيًا ضمن النسخة التذكيرية للمقرر. هل تريد المتابعة؟',
          confirmLabel: 'تأكيد المتابعة وإضافة المحتوى',
          variant: 'warning',
          onConfirm: () => executeSaveItem(itemData, chapterId, item),
        });
        return;
      }
    }

    // 2. Modifying an existing item
    if (item) {
      const impact = assessRefresherImpact('edit_item', {
        refresherConfig,
        originalItem: item,
        updatedItem: itemData,
      });

      if (impact.hasImpact) {
        setConfirmation({
          title: 'تأثير التعديل على النسخة التذكيرية',
          message: impact.impactMessage || 'هذا التعديل سيؤثر أيضًا على النسخة التذكيرية من الكورس. هل تريد المتابعة؟',
          confirmLabel: 'تأكيد المتابعة وتطبيق التعديل',
          variant: 'warning',
          onConfirm: () => executeSaveItem(itemData, chapterId, item),
        });
        return;
      }
    }

    executeSaveItem(itemData, chapterId, item);
  };

  const handleMoveItem = (
    chapterId: string,
    itemIndex: number,
    direction: 'up' | 'down'
  ) => {
    if (!onChange) return;
    const chapter = chapters.find((ch) => ch.id === chapterId);
    if (!chapter) return;

    const targetIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1;
    if (targetIndex < 0 || targetIndex >= chapter.items.length) return;

    const currentItem = chapter.items[itemIndex];
    const applyMove = () => {
      const updated = chapters.map((ch) => {
        if (ch.id !== chapterId) return ch;

        const items = [...ch.items];
        const temp = items[itemIndex];
        items[itemIndex] = items[targetIndex];
        items[targetIndex] = temp;

        return { ...ch, items };
      });

      onChange(updated);
      setConfirmation(null);
    };

    const impact = assessRefresherImpact('move_item', {
      refresherConfig,
      originalItem: currentItem,
      chapter,
      direction,
      itemIndex,
    });

    if (impact.hasImpact) {
      setConfirmation({
        title: 'تأثير تغيير ترتيب المحتوى على النسخة التذكيرية',
        message: impact.impactMessage || 'تغيير ترتيب هذا الدرس سيؤثر أيضًا على تسلسل المحتوى في النسخة التذكيرية للمقرر. هل تريد المتابعة؟',
        confirmLabel: 'تأكيد تغيير الترتيب',
        variant: 'warning',
        onConfirm: applyMove,
      });
      return;
    }

    applyMove();
  };

  const executeDeleteItem = (chapterId: string, itemId: string) => {
    if (!onChange) return;
    const updated = chapters.map((ch) => {
      if (ch.id !== chapterId) return ch;
      return { ...ch, items: ch.items.filter((it) => it.id !== itemId) };
    });
    onChange(updated);

    // Clean up refresher configuration reference to prevent broken references
    if (refresherConfig?.items?.[itemId] && onRefresherConfigChange) {
      const updatedItems = { ...refresherConfig.items };
      delete updatedItems[itemId];
      onRefresherConfigChange({
        ...refresherConfig,
        items: updatedItems,
      });
    }
    setConfirmation(null);
  };

  const promptDeleteItem = (chapterId: string, item: ChapterItem) => {
    const impact = assessRefresherImpact('delete_item', {
      refresherConfig,
      originalItem: item,
    });

    const isImpact = impact.hasImpact;
    setConfirmation({
      title: isImpact ? 'تأثير الحذف على النسخة التذكيرية' : 'تأكيد الحذف النهائي',
      message: isImpact
        ? impact.impactMessage || 'هذا التعديل سيؤثر أيضًا على النسخة التذكيرية من الكورس وسيؤدي إلى استبعاد المحتوى منها. هل تريد المتابعة؟'
        : `هل أنت متأكد من حذف الدرس "${item.title}" من هذا الفصل؟`,
      confirmLabel: 'تأكيد الحذف',
      variant: 'destructive',
      onConfirm: () => executeDeleteItem(chapterId, item.id),
    });
  };

  const getItemIcon = (type: ChapterItem['type']): SemanticIconName => {
    switch (type) {
      case 'video':
        return 'video';
      case 'pdf':
        return 'fileText';
      case 'image':
        return 'info';
      case 'powerpoint':
      case 'docx':
      case 'zip':
      case 'other':
        return 'download';
      case 'audio':
        return 'info';
      default:
        return 'file';
    }
  };

  return (
    <div
      className="space-y-6"
      data-testid={isRefresherMode ? 'refresher-tab-container' : 'curriculum-tree-editor'}
    >
      {/* =================================================================== */}
      {/* Refresher Mode: Header & Enable Toggle Card                         */}
      {/* =================================================================== */}
      {isRefresherMode ? (
        <div
          className="p-4 sm:p-5 rounded-2xl border border-border bg-bg-alt/30 space-y-4"
          data-testid="refresher-header-card"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Icon name="refreshCw" size="sm" className="text-primary" />
                <h2 className="text-base font-bold text-text-heading">النسخة التذكيرية للمقرر</h2>
                <Badge
                  variant={isRefresherEnabled ? 'success' : 'neutral'}
                  className="text-[11px]"
                  data-testid="refresher-status-badge"
                >
                  {isRefresherEnabled ? 'مفعلة' : 'معطلة'}
                </Badge>
              </div>
              <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-2xl">
                تتيح النسخة التذكيرية تقديم محتوى مكثف ومخصص لإعادة تدريب وتذكير العاملين دورياً،
                مع الحفاظ على بنية الكورس الأصلية ومصادرها دون تكرار ملفات الوسائط.
              </p>
            </div>

            {/* Refresher Enable Checkbox */}
            <label
              htmlFor="refresher-enable-toggle"
              className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface cursor-pointer hover:bg-neutral-light/50 transition-colors shrink-0"
              data-testid="refresher-enable-toggle-label"
            >
              <input
                id="refresher-enable-toggle"
                type="checkbox"
                checked={isRefresherEnabled}
                onChange={(e) => handleToggleRefresher(e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer"
                data-testid="refresher-enable-checkbox"
              />
              <span className="text-xs font-bold text-text-heading select-none">
                تفعيل النسخة التذكيرية لهذا الكورس
              </span>
            </label>
          </div>

          {/* Refresher Summary Stats Bar (when enabled) */}
          {isRefresherEnabled && (
            <div
              className="pt-3 border-t border-border flex flex-wrap items-center gap-4 text-xs"
              data-testid="refresher-stats-bar"
            >
              <div className="flex items-center gap-1.5 text-text-muted">
                <Icon name="checkCircle" size="sm" className="text-success" />
                <span>
                  المحتويات المفعلة بالتذكيري:{' '}
                  <strong className="text-text-heading font-mono">
                    {refresherStats.visibleRefresherItems} من {refresherStats.totalOriginalItems}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-text-muted">
                <Icon name="courses" size="sm" className="text-primary" />
                <span>
                  الفصول النشطة:{' '}
                  <strong className="text-text-heading font-mono">
                    {refresherStats.activeChaptersCount} من {refresherStats.totalChapters}
                  </strong>
                </span>
              </div>
              {refresherStats.customTitlesCount > 0 && (
                <div className="flex items-center gap-1.5 text-text-muted">
                  <Icon name="edit" size="sm" className="text-warning-dark" />
                  <span>
                    أسماء مخصصة بالتذكيري:{' '}
                    <strong className="text-text-heading font-mono">
                      {refresherStats.customTitlesCount}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Read-Only Notice when Refresher is Disabled */}
          {!isRefresherEnabled && (
            <div
              className="p-3 rounded-xl border border-border bg-surface flex items-center gap-2.5 text-xs text-text-muted"
              data-testid="refresher-disabled-notice"
            >
              <Icon name="info" size="sm" className="text-text-muted shrink-0" />
              <span>
                النسخة التذكيرية غير مفعلة لهذا المقرر حالياً. يتم عرض هيكل المقرر الأصلي كمعاينة للقراءة فقط،
                ولا يمكن تعديل خيارات التذكيري حتى يتم تفعيل الميزة أعلاه.
              </span>
            </div>
          )}
        </div>
      ) : (
        /* =================================================================== */
        /* Curriculum Mode: Standard Section Header                            */
        /* =================================================================== */
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-text-heading flex items-center gap-2">
              <Icon name="courses" size="sm" className="text-primary" />
              <span>هيكل المنهج والوحدات التدريبية</span>
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              قم بتنظيم فصول الكورس وإضافة الدروس والمحاضرات والمخططات المرفقة
            </p>
          </div>

          {!isAddingChapter && !readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon="plus"
              onClick={() => setIsAddingChapter(true)}
              className="self-start font-bold"
              data-testid="add-chapter-btn"
            >
              إضافة فصل جديد
            </Button>
          )}
        </div>
      )}

      {/* Curriculum Mode: Add Chapter Inline Form */}
      {!isRefresherMode && isAddingChapter && (
        <form
          onSubmit={handleAddChapter}
          className="p-4 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 space-y-3"
          data-testid="add-chapter-form"
        >
          <label htmlFor="new-chapter-input" className="block text-xs font-bold text-text-heading">
            عنوان الفصل الجديد
          </label>
          <div className="flex items-center gap-2">
            <input
              id="new-chapter-input"
              type="text"
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              placeholder="مثال: الفصل الثاني: نظم الإشارات الكهربائية"
              className="flex-1 px-3.5 py-2 text-sm bg-surface border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
              data-testid="new-chapter-title-input"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!newChapterTitle.trim()}
              data-testid="save-new-chapter-btn"
            >
              إضافة
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAddingChapter(false);
                setNewChapterTitle('');
              }}
            >
              إلغاء
            </Button>
          </div>
        </form>
      )}

      {/* Chapters Empty State */}
      {chapters.length === 0 && !isAddingChapter && (
        <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-border bg-bg-alt/30 space-y-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Icon name="courses" size="md" />
          </div>
          <h3 className="text-sm font-bold text-text-heading">لا توجد فصول دراسية في هذا المقرر بعد</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            {isRefresherMode
              ? 'يجب إضافة فصول ومحتويات في تبويب "هيكل المنهج والمحتوى" أولاً لتتمكن من إعداد النسخة التذكيرية.'
              : 'ابدأ بإضافة الفصل الأول لتتمكن من رفع المحاضرات ومستندات التدريب والمخططات.'}
          </p>
          {!isRefresherMode && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon="plus"
              onClick={() => setIsAddingChapter(true)}
            >
              إضافة الفصل الأول الآن
            </Button>
          )}
        </div>
      )}

      {/* Chapters Tree List */}
      <div
        className={`space-y-4 ${
          isRefresherMode && !isRefresherEnabled ? 'opacity-70 select-none' : ''
        }`}
        data-testid="curriculum-tree-list"
      >
        {chapters.map((chapter, chIdx) => {
          // In refresher mode, compute count of visible items in this chapter
          const visibleItemsInChapter = chapter.items.filter((it) =>
            isItemVisibleInRefresher(it.id, refresherConfig)
          );
          const allItemsHidden = isRefresherMode && isRefresherEnabled && chapter.items.length > 0 && visibleItemsInChapter.length === 0;
          const customChapterTitle = refresherConfig?.chapters?.[chapter.id]?.customTitle?.trim();
          const isEditingChapterTitle = editingTitleChapterId === chapter.id;

          return (
            <div
              key={chapter.id}
              className={`rounded-2xl border bg-surface overflow-hidden shadow-sm transition-colors ${
                allItemsHidden ? 'border-warning/40 bg-warning/5' : 'border-border'
              }`}
              data-testid={`chapter-card-${chapter.id}`}
            >
              {/* Chapter Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-bg-alt/40 border-b border-border">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center font-mono">
                    {chIdx + 1}
                  </span>
                  <h3 className="text-sm font-bold text-text-heading">
                    {isRefresherMode ? (customChapterTitle || chapter.title) : chapter.title}
                  </h3>

                  {/* Contextual Feedback Note Badge for Chapter */}
                  {(() => {
                    const chFeedback = (feedbackItems || []).find(
                      (f) => f.targetType === 'chapter' && f.targetId === chapter.id
                    );
                    if (!chFeedback) return null;
                    return (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveFeedbackNote({
                            title: `ملاحظة المراجع على الفصل: ${chapter.title}`,
                            comment: chFeedback.comment,
                          })
                        }
                        className="px-2 py-0.5 rounded-lg bg-warning/15 text-warning-dark border border-warning/40 hover:bg-warning/25 flex items-center gap-1 text-[11px] font-bold transition-colors shadow-2xs"
                        title="عرض ملاحظة المراجع لهذا الفصل"
                        data-testid={`chapter-feedback-badge-${chapter.id}`}
                      >
                        <Icon name="messageSquare" size="sm" />
                        <span>ملاحظة المراجع</span>
                      </button>
                    );
                  })()}

                  {isRefresherMode ? (
                    <Badge
                      variant={visibleItemsInChapter.length > 0 ? 'primary' : 'warning'}
                      className="text-[11px] font-mono"
                      data-testid={`chapter-refresher-badge-${chapter.id}`}
                    >
                      {visibleItemsInChapter.length} من {chapter.items.length} بالتذكيري
                    </Badge>
                  ) : (
                    <Badge variant="neutral" className="text-[11px] font-mono">
                      {chapter.items.length} محتوى
                    </Badge>
                  )}
                </div>

                {/* Chapter Controls (Curriculum Mode Only) */}
                {!isRefresherMode && !readOnly && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveChapter(chIdx, 'up')}
                      disabled={chIdx === 0}
                      className="p-1.5 rounded-lg border border-border hover:bg-neutral-light disabled:opacity-30 disabled:cursor-not-allowed text-text-muted"
                      title="نقل الفصل للأعلى"
                      aria-label="نقل الفصل للأعلى"
                      data-testid={`chapter-move-up-${chapter.id}`}
                    >
                      <Icon name="chevronUp" size="sm" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMoveChapter(chIdx, 'down')}
                      disabled={chIdx === chapters.length - 1}
                      className="p-1.5 rounded-lg border border-border hover:bg-neutral-light disabled:opacity-30 disabled:cursor-not-allowed text-text-muted"
                      title="نقل الفصل للأسفل"
                      aria-label="نقل الفصل للأسفل"
                      data-testid={`chapter-move-down-${chapter.id}`}
                    >
                      <Icon name="chevronDown" size="sm" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartEditCurriculumChapterTitle(chapter.id, chapter.title)}
                      className="p-1.5 rounded-lg border border-border hover:bg-neutral-light text-text-muted"
                      title="تعديل عنوان الفصل"
                      aria-label="تعديل عنوان الفصل"
                      data-testid={`chapter-edit-title-${chapter.id}`}
                    >
                      <Icon name="edit" size="sm" />
                    </button>

                    <button
                      type="button"
                      onClick={() => promptDeleteChapter(chapter)}
                      className="p-1.5 rounded-lg border border-danger/20 text-danger hover:bg-danger/10"
                      title="حذف الفصل بجميع محتوياته"
                      aria-label="حذف الفصل"
                      data-testid={`chapter-delete-${chapter.id}`}
                    >
                      <Icon name="trash" size="sm" />
                    </button>
                  </div>
                )}

                {/* Refresher Mode: Chapter Custom Title Controls */}
                {isRefresherMode && isRefresherEnabled && !isEditingChapterTitle && (
                  <div className="flex items-center gap-2 text-[11px]">
                    {customChapterTitle ? (
                      <Badge
                        variant="primary"
                        className="text-[11px] bg-primary/10 text-primary border-primary/30"
                        data-testid={`refresher-custom-chapter-title-badge-${chapter.id}`}
                      >
                        اسم مخصص بالتذكيري: "{customChapterTitle}"
                      </Badge>
                    ) : (
                      <span className="text-text-muted text-[11px] hidden sm:inline">
                        اسم الفصل بالتذكيري: مطابق للأصل
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setEditingTitleChapterId(chapter.id);
                        setEditingChapterTitleValue(customChapterTitle || chapter.title);
                      }}
                      className="text-primary hover:underline font-bold text-[11px] flex items-center gap-1"
                      data-testid={`refresher-custom-chapter-title-btn-${chapter.id}`}
                    >
                      <Icon name="edit" size="sm" />
                      <span>{customChapterTitle ? 'تعديل الاسم' : 'تخصيص الاسم'}</span>
                    </button>

                    {customChapterTitle && (
                      <button
                        type="button"
                        onClick={() => handleResetCustomChapterTitle(chapter.id)}
                        className="text-text-muted hover:text-danger text-[11px] underline"
                        title="استعادة اسم الفصل الأصلي"
                        data-testid={`refresher-chapter-title-reset-${chapter.id}`}
                      >
                        استعادة الأصل
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Curriculum Mode: Inline Editor for Original Chapter Title */}
              {!isRefresherMode && editingCurriculumChapterId === chapter.id && (
                <div className="p-3 bg-primary/5 border-b border-primary/20 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-text-heading shrink-0">
                    تعديل عنوان الفصل:
                  </span>
                  <input
                    type="text"
                    value={editingCurriculumChapterTitleValue}
                    onChange={(e) => setEditingCurriculumChapterTitleValue(e.target.value)}
                    className="flex-1 min-w-[200px] px-3 py-1.5 text-xs bg-surface border border-primary rounded-lg text-text focus:outline-none"
                    autoFocus
                    data-testid={`chapter-title-input-${chapter.id}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveCurriculumChapterTitle(chapter.id);
                      } else if (e.key === 'Escape') {
                        handleCancelCurriculumChapterTitle();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => handleSaveCurriculumChapterTitle(chapter.id)}
                    className="px-3 py-1 text-xs h-8"
                    data-testid={`chapter-title-save-${chapter.id}`}
                  >
                    حفظ
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancelCurriculumChapterTitle}
                    className="px-3 py-1 text-xs h-8"
                    data-testid={`chapter-title-cancel-${chapter.id}`}
                  >
                    إلغاء
                  </Button>
                </div>
              )}

              {/* Refresher Mode: Inline Editor for Chapter Custom Title */}
              {isRefresherMode && isRefresherEnabled && isEditingChapterTitle && (
                <div className="p-3 bg-primary/5 border-b border-primary/20 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-text-heading shrink-0">
                    تخصيص اسم الفصل بالنسخة التذكيرية:
                  </span>
                  <input
                    type="text"
                    value={editingChapterTitleValue}
                    onChange={(e) => setEditingChapterTitleValue(e.target.value)}
                    placeholder={`اسم الفصل بالتذكيري (الافتراضي: ${chapter.title})`}
                    className="flex-1 min-w-[200px] px-3 py-1.5 text-xs bg-surface border border-primary rounded-lg text-text focus:outline-none"
                    autoFocus
                    data-testid={`refresher-chapter-title-input-${chapter.id}`}
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => handleSaveCustomChapterTitle(chapter.id)}
                    className="px-3 py-1 text-xs h-8"
                    data-testid={`refresher-chapter-title-save-${chapter.id}`}
                  >
                    حفظ
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingTitleChapterId(null)}
                    className="px-3 py-1 text-xs h-8"
                    data-testid={`refresher-chapter-title-cancel-${chapter.id}`}
                  >
                    إلغاء
                  </Button>
                </div>
              )}

              {/* Notice when all items in this chapter are hidden in Refresher */}
              {allItemsHidden && (
                <div
                  className="px-4 py-2 bg-warning/10 border-b border-warning/20 text-[11px] text-warning-dark font-medium flex items-center gap-2"
                  data-testid={`refresher-empty-section-notice-${chapter.id}`}
                >
                  <Icon name="info" size="sm" className="text-warning-dark shrink-0" />
                  <span>
                    جميع محتويات هذا الفصل مخفية في النسخة التذكيرية — لن يظهر هذا الفصل كقسم فارغ للمتدرب في النسخة التذكيرية.
                  </span>
                </div>
              )}

              {/* Chapter Items List */}
              <div className="p-4 space-y-2.5">
                {chapter.items.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-border rounded-xl text-xs text-text-muted">
                    لا توجد دروس أو ملفات مضافة في هذا الفصل بعد.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {chapter.items.map((item, itIdx) => {
                      const isItemVisible = isItemVisibleInRefresher(item.id, refresherConfig);
                      const customTitle = refresherConfig?.items?.[item.id]?.customTitle;
                      const isEditingTitle = editingTitleItemId === item.id;

                      return (
                        <div
                          key={item.id}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border transition-colors gap-3 ${
                            isRefresherMode
                              ? !isItemVisible
                                ? 'border-border/60 bg-neutral-light/30 opacity-60'
                                : 'border-border bg-bg-alt/20 hover:border-primary/40'
                              : 'border-border bg-bg-alt/20 hover:border-primary/40'
                          }`}
                          data-testid={`item-row-${item.id}`}
                        >
                          {/* Item Identity & Title */}
                          <div className="flex items-start sm:items-center gap-3 overflow-hidden flex-1">
                            <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0 text-primary mt-0.5 sm:mt-0">
                              <Icon name={getItemIcon(item.type)} size="sm" />
                            </div>

                            <div className="overflow-hidden flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-xs font-bold truncate ${!isItemVisible && isRefresherMode ? 'text-text-muted line-through' : 'text-text-heading'}`}>
                                  {item.title}
                                </span>
                                <Badge
                                  variant={
                                    item.type === 'video' || item.type === 'pdf' || item.type === 'image'
                                      ? 'primary'
                                      : 'neutral'
                                  }
                                  className="text-[10px] shrink-0"
                                >
                                  {item.type === 'video'
                                    ? 'فيديو'
                                    : item.type === 'pdf'
                                    ? 'PDF'
                                    : item.type === 'image'
                                    ? 'مخطط'
                                    : 'تنزيل'}
                                </Badge>

                                {/* Contextual Feedback Note Badge for Lesson Item */}
                                {(() => {
                                  const itFeedback = (feedbackItems || []).find(
                                    (f) => f.targetType === 'item' && f.targetId === item.id
                                  );
                                  if (!itFeedback) return null;
                                  return (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setActiveFeedbackNote({
                                          title: `ملاحظة المراجع على الدرس: ${item.title}`,
                                          comment: itFeedback.comment,
                                        })
                                      }
                                      className="px-2 py-0.5 rounded-lg bg-warning/15 text-warning-dark border border-warning/40 hover:bg-warning/25 flex items-center gap-1 text-[10px] font-bold transition-colors shadow-2xs"
                                      title="عرض ملاحظة المراجع لهذا الدرس"
                                      data-testid={`item-feedback-badge-${item.id}`}
                                    >
                                      <Icon name="messageSquare" size="sm" />
                                      <span>ملاحظة المراجع</span>
                                    </button>
                                  );
                                })()}

                                {isRefresherMode && !isItemVisible && (
                                  <Badge variant="neutral" className="text-[10px] text-text-muted shrink-0">
                                    مخفي بالتذكيري
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-[11px] text-text-muted">
                                {item.duration && <span>المدة: {item.duration}</span>}
                                {item.fileSizeBytes && (
                                  <span>{(item.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                                )}
                                {item.downloadPolicy === 'never' ? (
                                  <span className="text-danger font-medium">غير قابل للتنزيل</span>
                                ) : (
                                  <span className="text-success font-medium">قابل للتنزيل</span>
                                )}
                              </div>

                              {/* Refresher Mode: Custom Title Display / Inline Editor */}
                              {isRefresherMode && isRefresherEnabled && isItemVisible && (
                                <div className="pt-1.5 text-xs flex flex-wrap items-center gap-2">
                                  {isEditingTitle ? (
                                    <div className="flex items-center gap-2 w-full max-w-md mt-1">
                                      <input
                                        type="text"
                                        value={editingTitleValue}
                                        onChange={(e) => setEditingTitleValue(e.target.value)}
                                        placeholder={`الاسم بالتذكيري (الافتراضي: ${item.title})`}
                                        className="flex-1 px-2.5 py-1 text-xs bg-surface border border-primary rounded-lg text-text focus:outline-none"
                                        autoFocus
                                        data-testid={`refresher-title-input-${item.id}`}
                                      />
                                      <Button
                                        type="button"
                                        variant="primary"
                                        size="sm"
                                        onClick={() => handleSaveCustomTitle(item.id)}
                                        className="px-2 py-1 text-[11px] h-7"
                                        data-testid={`refresher-title-save-${item.id}`}
                                      >
                                        حفظ
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setEditingTitleItemId(null)}
                                        className="px-2 py-1 text-[11px] h-7"
                                        data-testid={`refresher-title-cancel-${item.id}`}
                                      >
                                        إلغاء
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 text-[11px]">
                                      {customTitle ? (
                                        <Badge
                                          variant="primary"
                                          className="text-[11px] bg-primary/10 text-primary border-primary/30"
                                          data-testid={`refresher-custom-title-badge-${item.id}`}
                                        >
                                          اسم مخصص بالتذكيري: "{customTitle}"
                                        </Badge>
                                      ) : (
                                        <span className="text-text-muted">الاسم بالتذكيري: مطابق للأصل</span>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingTitleItemId(item.id);
                                          setEditingTitleValue(customTitle || item.title);
                                        }}
                                        className="text-primary hover:underline font-bold text-[11px] flex items-center gap-1"
                                        data-testid={`refresher-custom-title-btn-${item.id}`}
                                      >
                                        <Icon name="edit" size="sm" />
                                        <span>{customTitle ? 'تعديل الاسم' : 'تخصيص الاسم'}</span>
                                      </button>

                                      {customTitle && (
                                        <button
                                          type="button"
                                          onClick={() => handleResetCustomTitle(item.id)}
                                          className="text-text-muted hover:text-danger text-[11px] underline"
                                          title="استعادة الاسم الأصلي للمقرر"
                                          data-testid={`refresher-title-reset-${item.id}`}
                                        >
                                          استعادة الأصل
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Controls (Refresher vs Curriculum Mode) */}
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            {isRefresherMode ? (
                              /* Refresher Mode: Visibility Checkbox */
                              <label
                                className={`flex items-center gap-2 p-2 rounded-xl border border-border bg-surface text-xs select-none ${
                                  !isRefresherEnabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-neutral-light/50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isItemVisible}
                                  disabled={!isRefresherEnabled}
                                  onChange={(e) =>
                                    handleToggleItemVisibility(item.id, e.target.checked)
                                  }
                                  className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer disabled:cursor-not-allowed"
                                  data-testid={`refresher-item-visibility-${item.id}`}
                                />
                                <span className="font-semibold text-text-heading text-[11px]">
                                  إظهار هذا المحتوى في النسخة التذكيرية
                                </span>
                              </label>
                            ) : !readOnly ? (
                              /* Curriculum Mode: Standard Item Manipulation Controls */
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleMoveItem(chapter.id, itIdx, 'up')}
                                  disabled={itIdx === 0}
                                  className="p-1 rounded-lg border border-border hover:bg-neutral-light disabled:opacity-30 disabled:cursor-not-allowed text-text-muted"
                                  title="نقل الدرس للأعلى"
                                  aria-label="نقل الدرس للأعلى"
                                  data-testid={`item-move-up-${item.id}`}
                                >
                                  <Icon name="chevronUp" size="sm" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveItem(chapter.id, itIdx, 'down')}
                                  disabled={itIdx === chapter.items.length - 1}
                                  className="p-1 rounded-lg border border-border hover:bg-neutral-light disabled:opacity-30 disabled:cursor-not-allowed text-text-muted"
                                  title="نقل الدرس للأسفل"
                                  aria-label="نقل الدرس للأسفل"
                                  data-testid={`item-move-down-${item.id}`}
                                >
                                  <Icon name="chevronDown" size="sm" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingItemInfo({
                                      chapterId: chapter.id,
                                      chapterTitle: chapter.title,
                                      item,
                                    })
                                  }
                                  className="p-1 rounded-lg border border-border hover:bg-neutral-light text-text-muted"
                                  title="تعديل بيانات الدرس"
                                  aria-label="تعديل الدرس"
                                  data-testid={`item-edit-${item.id}`}
                                >
                                  <Icon name="edit" size="sm" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => promptDeleteItem(chapter.id, item)}
                                  className="p-1 rounded-lg border border-danger/20 text-danger hover:bg-danger/10"
                                  title="حذف الدرس"
                                  aria-label="حذف الدرس"
                                  data-testid={`item-delete-${item.id}`}
                                >
                                  <Icon name="trash" size="sm" />
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Item Trigger Button (Curriculum Mode Only) */}
                {!isRefresherMode && !readOnly && (
                  <button
                    type="button"
                    onClick={() =>
                      setEditingItemInfo({
                        chapterId: chapter.id,
                        chapterTitle: chapter.title,
                        item: null,
                      })
                    }
                    className="w-full py-2.5 px-3 border border-dashed border-border rounded-xl text-xs font-bold text-primary hover:bg-primary/5 hover:border-primary transition-colors flex items-center justify-center gap-1.5"
                    data-testid={`chapter-add-item-btn-${chapter.id}`}
                  >
                    <Icon name="plus" size="sm" />
                    <span>إضافة درس أو محتوى لهذا الفصل</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Item Editor Modal (Curriculum Mode Only) */}
      {!isRefresherMode && editingItemInfo && (
        <ItemEditorModal
          isOpen={true}
          chapterTitle={editingItemInfo.chapterTitle}
          item={editingItemInfo.item}
          onClose={() => setEditingItemInfo(null)}
          onSave={handleSaveItem}
        />
      )}

      {/* Contextual Feedback Note Modal */}
      {activeFeedbackNote && (
        <Modal
          isOpen={true}
          onClose={() => setActiveFeedbackNote(null)}
          title={activeFeedbackNote.title}
          size="md"
          dataTestId="contextual-feedback-modal"
          footer={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveFeedbackNote(null)}
              data-testid="close-contextual-feedback-btn"
            >
              إغلاق الملاحظة
            </Button>
          }
        >
          <div className="p-4 space-y-3 text-xs text-text" dir="rtl">
            <div className="flex items-center gap-2 font-bold text-warning-dark">
              <Icon name="fileText" size="sm" />
              <span>توجيه وملاحظة مراجع الجودة:</span>
            </div>
            <p
              className="p-3.5 rounded-xl bg-surface border border-border/80 leading-relaxed whitespace-pre-wrap text-text font-medium"
              data-testid="contextual-feedback-comment"
            >
              {activeFeedbackNote.comment}
            </p>
          </div>
        </Modal>
      )}

      {/* Unified Confirmation Modal (Destructive Deletes & Refresher Impact Warnings) */}
      {confirmation && (
        <ConfirmDialog
          isOpen={true}
          title={confirmation.title}
          message={confirmation.message}
          confirmLabel={confirmation.confirmLabel}
          cancelLabel="إلغاء"
          variant={confirmation.variant}
          onConfirm={confirmation.onConfirm}
          onCancel={() => setConfirmation(null)}
          testId="curriculum-confirm-dialog"
          confirmTestId="confirm-delete-btn"
          cancelTestId="confirm-cancel-btn"
        />
      )}
    </div>
  );
};

export default CurriculumTreeEditor;
