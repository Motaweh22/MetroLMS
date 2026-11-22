import React, { useState } from 'react';
import type { GroupMaterialFile, GroupMaterialFolder } from '@/core/groups/types';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Alert } from '@/shared/ui/Alert';
import { StyledSelect } from '@/shared/ui/StyledSelect';
import { groupsApi } from '../services/groupsApi';

interface GroupMoveFileModalProps {
  groupId: string;
  file: GroupMaterialFile | null;
  folders: GroupMaterialFolder[];
  isOpen: boolean;
  onClose: () => void;
  onMoveSuccess: () => void;
}

export const GroupMoveFileModal: React.FC<GroupMoveFileModalProps> = ({
  groupId,
  file,
  folders,
  isOpen,
  onClose,
  onMoveSuccess,
}) => {
  const [targetFolderId, setTargetFolderId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!file) return null;

  const eligibleFolders = folders.filter((f) => f.id !== file.folderId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetFolderId) {
      setError('يرجى اختيار المجلد الوجهة');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await groupsApi.moveMaterialFile(groupId, file.id, targetFolderId);
      onMoveSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر نقل الملف';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`نقل الملف: ${file.title}`}
      size="md"
      data-testid="group-move-file-modal"
    >
      <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
        {error && (
          <Alert variant="danger" title="خطأ في النقل" data-testid="move-error-alert">
            {error}
          </Alert>
        )}

        <p className="text-xs text-text-muted leading-relaxed">
          اختر المجلد الذي ترغب في نقل الملف <strong>({file.originalFileName})</strong> إليه داخل نفس المجموعة التدريبية:
        </p>

        {eligibleFolders.length === 0 ? (
          <div className="p-4 rounded-lg bg-neutral-light/50 border border-border text-center text-xs text-text-muted">
            لا توجد مجلدات أخرى متاحة في هذه المجموعة لنقل الملف إليها. يرجى إنشاء مجلد جديد أولاً.
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-heading">المجلد الوجهة</label>
            <StyledSelect
              dataTestId="target-folder-select"
              ariaLabel="المجلد الوجهة"
              size="sm"
              buttonClassName="bg-surface"
              value={targetFolderId}
              onChange={(val) => {
                setTargetFolderId(val);
                setError(null);
              }}
              placeholder="-- اختر المجلد --"
              emptyMessage="لا توجد مجلدات متاحة"
              options={[
                { value: '', label: '-- اختر المجلد --' },
                ...eligibleFolders.map((f) => ({
                  value: f.id,
                  label: `${f.name} (${f.filesCount} ملف)`,
                })),
              ]}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={isSubmitting || eligibleFolders.length === 0}
            data-testid="confirm-move-file-btn"
          >
            نقل الملف
          </Button>
        </div>
      </form>
    </Modal>
  );
};
