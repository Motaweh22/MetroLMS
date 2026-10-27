import React, { useState } from 'react';
import type { FlatCurriculumItem } from '../types';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';

export interface ImageViewerProps {
  item: FlatCurriculumItem;
  isCompleted: boolean;
  isSubmitting?: boolean;
  onComplete: (itemId: string) => Promise<boolean>;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  item,
  isCompleted,
  isSubmitting = false,
  onComplete,
}) => {
  const [completedLocally, setCompletedLocally] = useState<boolean>(isCompleted);
  const [error, setError] = useState<string | null>(null);

  const handleMarkComplete = async () => {
    setError(null);
    try {
      const success = await onComplete(item.id);
      if (success) {
        setCompletedLocally(true);
      }
    } catch {
      setError('تعذر تسجيل إتمام المحتوى، يرجى المحاولة مرة أخرى.');
    }
  };

  return (
    <div
      className="rounded-2xl border border-white/10 bg-[#0B1120] overflow-hidden p-6 space-y-4"
      role="region"
      aria-label={`عارض المخطط والصور: ${item.title}`}
      data-testid="image-viewer-container"
    >
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2 text-white font-semibold">
          <Icon name="info" size="md" className="text-primary-light" />
          <span>{item.title}</span>
        </div>

        {item.canDownload && item.url && (
          <a
            href={item.url}
            download={`${item.title}.png`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-text text-xs font-semibold hover:bg-neutral-light transition-colors"
            title="تحميل الصورة"
          >
            <Icon name="download" size="sm" />
            <span>تنزيل</span>
          </a>
        )}
      </div>

      {/* Image Display */}
      <div className="relative rounded-xl overflow-hidden bg-black/40 flex items-center justify-center min-h-[320px] max-h-[550px] p-2 border border-white/5">
        <img
          src={item.url || '/sample-diagram.png'}
          alt={item.title}
          className="max-h-[500px] max-w-full object-contain rounded-lg shadow-md"
          data-testid="image-viewer-display"
        />
      </div>

      {/* Completion & Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="text-xs text-text-muted">
          يتطلب هذا المحتوى مراجعة المخطط والتأكيد اليدوي لاعتماد الإنجاز
        </div>

        <div>
          {completedLocally ? (
            <Badge variant="success" className="px-3 py-1.5 text-xs font-bold gap-1.5">
              <Icon name="checkCircle" size="sm" />
              <span>تم إتمام هذا المخطط بنجاح</span>
            </Badge>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleMarkComplete}
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold"
              data-testid="image-complete-btn"
            >
              {isSubmitting ? 'جاري الاعتماد...' : 'تأكيد الاطلاع وإتمام المحتوى ✓'}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-xs text-danger font-semibold text-center">{error}</p>
      )}
    </div>
  );
};

export default ImageViewer;
