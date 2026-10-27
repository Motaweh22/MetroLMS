import React, { useState, useRef } from 'react';
import type { GroupMaterialFolder } from '@/core/groups/types';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { validateMaterialUpload, resolveMaterialFileType } from '@/core/domain/groups';
import {
  formatBytes,
  getFileTypeMeta,
  registerMaterialBlob,
} from '../utils/materialUtils';
import { groupsApi } from '../services/groupsApi';

interface GroupUploadFilesModalProps {
  groupId: string;
  folder: GroupMaterialFolder | null;
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

interface StagedFile {
  id: string;
  file: File;
  title: string;
  isValid: boolean;
  error?: string;
}

export const GroupUploadFilesModal: React.FC<GroupUploadFilesModalProps> = ({
  groupId,
  folder,
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!folder) return null;

  const handleFilesSelected = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    setUploadError(null);

    const newStaged: StagedFile[] = [];
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      const validation = validateMaterialUpload({ name: file.name, size: file.size });
      newStaged.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        file,
        title: file.name.substring(0, file.name.lastIndexOf('.')) || file.name,
        isValid: validation.isValid,
        error: validation.error,
      });
    }

    setStagedFiles((prev) => [...prev, ...newStaged]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveStaged = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelected(e.dataTransfer.files);
  };

  const validFilesCount = stagedFiles.filter((f) => f.isValid).length;
  const hasInvalidFiles = stagedFiles.some((f) => !f.isValid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filesToUpload = stagedFiles.filter((f) => f.isValid);
    if (filesToUpload.length === 0) {
      setUploadError('يرجى اختيار ملفات صالحة للرفع أولاً');
      return;
    }

    setIsSubmitting(true);
    setUploadError(null);

    try {
      for (const staged of filesToUpload) {
        const file = staged.file;
        const res = await groupsApi.addMaterialFile(groupId, {
          folderId: folder.id,
          title: staged.title || file.name,
          fileName: file.name,
          sizeBytes: file.size,
          mimeType: file.type || 'application/octet-stream',
          isVisible: true,
          cycleId: folder.cycleId,
        });

        // Register the actual file Blob so subsequent downloads contain genuine bytes
        registerMaterialBlob(res.id, file);
      }

      setStagedFiles([]);
      onUploadSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء رفع الملفات';
      setUploadError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) {
          setStagedFiles([]);
          onClose();
        }
      }}
      title={`رفع مواد تدريبية إلى: ${folder.name}`}
      size="lg"
      data-testid="group-upload-files-modal"
    >
      <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
        {uploadError && (
          <Alert variant="danger" title="تعذر استكمال الرفع" data-testid="upload-error-alert">
            {uploadError}
          </Alert>
        )}

        {/* Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 bg-bg-alt/40'
          }`}
          data-testid="upload-dropzone"
        >
          <input
            type="file"
            ref={fileInputRef}
            multiple
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="hidden"
            data-testid="file-input-element"
          />
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <Icon name="upload" size="md" />
          </div>
          <h4 className="font-bold text-sm text-text-heading mb-1">
            اسحب وأفلت الملفات هنا، أو انقر للاختيار من جهازك
          </h4>
          <p className="text-xs text-text-muted leading-relaxed max-w-md mx-auto">
            يدعم ملفات PDF، الصور (PNG, JPG)، ملفات Office (Word, Excel, PowerPoint)، الفيديو والصوت، والأرشيف (ZIP). الحد الأقصى للملف الواحد 50 ميجابايت.
          </p>
        </div>

        {/* Staged Files List */}
        {stagedFiles.length > 0 && (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1" data-testid="staged-files-list">
            <div className="flex items-center justify-between text-xs text-text-muted font-bold px-1">
              <span>الملفات المحددة ({stagedFiles.length})</span>
              {hasInvalidFiles && (
                <span className="text-danger font-normal text-[11px]">
                  توجد ملفات غير متوافقة لن يتم رفعها
                </span>
              )}
            </div>

            {stagedFiles.map((staged) => {
              const fileType = resolveMaterialFileType(staged.file.name, staged.file.type);
              const meta = getFileTypeMeta(fileType);

              return (
                <div
                  key={staged.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                    staged.isValid
                      ? 'bg-surface border-border'
                      : 'bg-danger-light/30 border-danger/30'
                  }`}
                  data-testid={`staged-file-item-${staged.file.name}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${meta.colorClass}`}
                    >
                      <Icon name={meta.iconName} size="sm" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-text truncate max-w-xs">{staged.file.name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-text-muted">
                        <span>{formatBytes(staged.file.size)}</span>
                        <span>•</span>
                        <span>{meta.labelAr}</span>
                        {!staged.isValid && (
                          <span className="text-danger font-semibold">({staged.error})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveStaged(staged.id)}
                    className="p-1 rounded text-text-muted hover:text-danger hover:bg-neutral-light transition-colors"
                    title="حذف من القائمة"
                    data-testid={`remove-staged-btn-${staged.file.name}`}
                  >
                    <Icon name="close" size="sm" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-xs text-text-muted">
            {validFilesCount > 0
              ? `${validFilesCount} ملف جاهز للرفع`
              : 'لم يتم اختيار ملفات صالحة'}
          </span>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setStagedFiles([]);
                onClose();
              }}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              disabled={isSubmitting || validFilesCount === 0}
              data-testid="confirm-upload-btn"
              className="font-bold"
            >
              بدء رفع الملفات ({validFilesCount})
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
