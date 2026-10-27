import React from 'react';
import type { GroupMaterialFile } from '@/core/groups/types';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import {
  getFileTypeMeta,
  formatBytes,
  formatMaterialDate,
  downloadMaterialFile,
  getMaterialBlob,
} from '../utils/materialUtils';

interface GroupMaterialViewerModalProps {
  file: GroupMaterialFile | null;
  isOpen: boolean;
  onClose: () => void;
}

export const GroupMaterialViewerModal: React.FC<GroupMaterialViewerModalProps> = ({
  file,
  isOpen,
  onClose,
}) => {
  if (!file) return null;

  const meta = getFileTypeMeta(file.fileType);
  const registeredBlob = getMaterialBlob(file.id);
  const previewUrl = registeredBlob ? URL.createObjectURL(registeredBlob) : file.url;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={file.title}
      size="xl"
      data-testid="group-material-viewer-modal"
    >
      <div className="space-y-4" dir="rtl">
        {/* Header Metadata Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-light/50 rounded-lg border border-border text-xs">
          <div className="flex items-center gap-2">
            <Badge variant={meta.variant} className="gap-1 px-2.5 py-0.5 font-bold">
              <Icon name={meta.iconName} size="sm" />
              <span>{meta.labelAr}</span>
            </Badge>
            <span className="text-text-muted font-mono">{file.originalFileName}</span>
          </div>

          <div className="flex items-center gap-3 text-text-muted">
            <span>الحجم: <strong className="text-text">{formatBytes(file.fileSizeBytes)}</strong></span>
            <span>تاريخ الرفع: <strong className="text-text">{formatMaterialDate(file.uploadedAt)}</strong></span>
            {file.uploadedByName && (
              <span>بواسطة: <strong className="text-text">{file.uploadedByName}</strong></span>
            )}
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="min-h-[350px] max-h-[72vh] flex items-center justify-center bg-bg-alt/40 rounded-xl border border-border p-2 overflow-auto">
          {file.fileType === 'pdf' ? (
            <div className="w-full h-[65vh] flex flex-col items-center justify-center">
              <iframe
                src={`${previewUrl}#toolbar=0`}
                title={file.title}
                className="w-full h-full rounded-lg border border-border shadow-inner"
                data-testid="pdf-preview-frame"
              />
            </div>
          ) : file.fileType === 'image' ? (
            <div className="flex flex-col items-center justify-center p-4">
              <img
                src={previewUrl}
                alt={file.title}
                className="max-h-[62vh] max-w-full object-contain rounded-lg shadow-sm"
                data-testid="image-preview"
              />
            </div>
          ) : file.fileType === 'video' ? (
            <div className="w-full flex items-center justify-center p-4">
              <video
                controls
                src={previewUrl}
                className="max-h-[62vh] w-full rounded-lg shadow"
                data-testid="video-preview"
              >
                متصفحك لا يدعم تشغيل هذا الفيديو مباشرة.
              </video>
            </div>
          ) : file.fileType === 'audio' ? (
            <div className="w-full max-w-lg p-6 bg-surface rounded-xl border border-border shadow-sm text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-warning/10 text-warning-dark flex items-center justify-center mx-auto">
                <Icon name="music" size="lg" />
              </div>
              <h4 className="font-bold text-base text-text-heading">{file.title}</h4>
              <audio controls src={previewUrl} className="w-full" data-testid="audio-preview">
                متصفحك لا يدعم تشغيل هذا الملف الصوتي.
              </audio>
            </div>
          ) : (
            /* Fallback for Office docs and archives: download action */
            <div
              className="text-center p-8 max-w-md mx-auto space-y-4 bg-surface rounded-xl border border-border shadow-sm"
              data-testid="preview-fallback-card"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                <Icon name={meta.iconName} size="lg" />
              </div>
              <h4 className="font-bold text-lg text-text-heading">{file.title}</h4>
              <p className="text-xs text-text-muted leading-relaxed">
                ملفات {meta.labelAr} لا تدعم العرض المباشر داخل المتصفح لأسباب أمنية وتقنية. يمكنك تنزيل النسخة الأصلية الكاملة للاطلاع عليها عبر البرنامج المخصص بجهازك.
              </p>
              <Button
                variant="primary"
                size="md"
                onClick={() => downloadMaterialFile(file)}
                data-testid="preview-fallback-download-btn"
                className="w-full gap-2 font-bold"
              >
                <Icon name="download" size="sm" />
                <span>تحميل الملف الأصلي ({formatBytes(file.fileSizeBytes)})</span>
              </Button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => downloadMaterialFile(file)}
            data-testid="viewer-download-btn"
            className="gap-1.5 font-bold text-xs"
          >
            <Icon name="download" size="sm" />
            <span>تحميل الملف</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            data-testid="close-viewer-btn"
          >
            إغلاق
          </Button>
        </div>
      </div>
    </Modal>
  );
};
