import React, { useState, useEffect } from 'react';
import type { GroupMaterialFolder } from '@/core/groups/types';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { FormInput } from '@/shared/ui/FormInput';
import { Alert } from '@/shared/ui/Alert';

interface GroupFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; isVisibleToTrainees: boolean }) => Promise<void>;
  folderToEdit?: GroupMaterialFolder | null;
  isSubmitting?: boolean;
}

export const GroupFolderModal: React.FC<GroupFolderModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  folderToEdit,
  isSubmitting = false,
}) => {
  const [name, setName] = useState('');
  const [isVisibleToTrainees, setIsVisibleToTrainees] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (folderToEdit) {
      setName(folderToEdit.name || '');
      setIsVisibleToTrainees(folderToEdit.isVisibleToTrainees !== false);
    } else {
      setName('');
      setIsVisibleToTrainees(true);
    }
    setError(null);
  }, [folderToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('اسم المجلد مطلوب');
      return;
    }
    if (trimmed.length < 2) {
      setError('يجب ألا يقل اسم المجلد عن حرفين');
      return;
    }

    try {
      setError(null);
      await onSubmit({ name: trimmed, isVisibleToTrainees });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر حفظ المجلد';
      setError(msg);
    }
  };

  const isEdit = !!folderToEdit;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'تعديل بيانات المجلد' : 'إنشاء مجلد مواد جديد'}
      size="md"
      data-testid="group-folder-modal"
    >
      <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
        {error && (
          <Alert variant="danger" title="خطأ في البيانات" data-testid="folder-error-alert">
            {error}
          </Alert>
        )}

        <FormInput
          label="اسم المجلد"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="مثال: تعليمات التشغيل والسلامة، نماذج الفحص الميداني"
          autoFocus
          required
          data-testid="folder-name-input"
        />

        <div className="flex items-center gap-3 p-3 bg-neutral-light/50 rounded-lg border border-border">
          <input
            type="checkbox"
            id="folder-visibility-checkbox"
            checked={isVisibleToTrainees}
            onChange={(e) => setIsVisibleToTrainees(e.target.checked)}
            className="w-4 h-4 text-primary rounded border-border focus:ring-primary cursor-pointer"
            data-testid="folder-visibility-checkbox"
          />
          <label
            htmlFor="folder-visibility-checkbox"
            className="text-xs sm:text-sm font-medium text-text cursor-pointer select-none"
          >
            إتاحة هذا المجلد ومحتوياته للمتدربين في صفحة المجموعة
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="cancel-folder-btn"
          >
            إلغاء
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            data-testid="submit-folder-btn"
          >
            {isEdit ? 'حفظ التعديلات' : 'إنشاء المجلد'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
