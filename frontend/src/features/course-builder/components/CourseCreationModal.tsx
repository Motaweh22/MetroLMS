import React, { useState } from 'react';
import type { CourseLevel } from '@/core/courses/types';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';

export interface CourseCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; level: CourseLevel; description: string }) => Promise<void>;
  isSubmitting?: boolean;
}

export const CourseCreationModal: React.FC<CourseCreationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}) => {
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<CourseLevel>('مبتدئ');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (cleanTitle.length < 5) {
      setError('يرجى إدخال عنوان للدورة التدريبية مكون من 5 أحرف على الأقل.');
      return;
    }
    setError(null);
    try {
      await onSubmit({ title: cleanTitle, level, description: description.trim() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'فشل في إنشاء الدورة التدريبية';
      setError(message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="creation-modal-title"
      data-testid="course-creation-modal"
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-bg-alt/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Icon name="courses" size="md" />
            </div>
            <div>
              <h2 id="creation-modal-title" className="text-base font-bold text-text-heading">
                إنشاء مقرر تدريبي جديد
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                أدخل البيانات الأولية لبدء بناء وحدات ومحتوى البرنامج التدريبي
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text p-1.5 rounded-lg hover:bg-neutral-light transition-colors"
            aria-label="إغلاق النافذة"
          >
            ✕
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div
              className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-semibold"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="course-modal-title" className="block text-xs font-bold text-text-heading">
              عنوان المقرر التدريبي <span className="text-danger">*</span>
            </label>
            <input
              id="course-modal-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: إجراءات السلامة الميدانية وتشغيل الخط الثاني"
              className="w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              required
              autoFocus
              data-testid="creation-title-input"
            />
            <span className="text-[11px] text-text-muted">5 أحرف على الأقل</span>
          </div>

          {/* Level */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-text-heading">
              المستوى التدريبي المستهدف <span className="text-danger">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['مبتدئ', 'متوسط', 'متقدم'] as CourseLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevel(lvl)}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all text-center ${
                    level === lvl
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-surface text-text-muted hover:bg-neutral-light'
                  }`}
                  data-testid={`creation-level-${lvl}`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="course-modal-desc" className="block text-xs font-bold text-text-heading">
              نبذة موجزة عن المقرر
            </label>
            <textarea
              id="course-modal-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="أدخل ملخصاً يوضح الأهداف التعليمية والمحاور الأساسية..."
              className="w-full px-3.5 py-2 text-sm bg-surface border border-border rounded-xl text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
              data-testid="creation-desc-input"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting || title.trim().length < 5}
              className="px-5 font-bold"
              data-testid="creation-submit-btn"
            >
              {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء وبدء التعديل ←'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseCreationModal;
