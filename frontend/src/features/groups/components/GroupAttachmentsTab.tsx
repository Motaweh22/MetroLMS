import React, { useState } from 'react';
import type { TrainingGroup, GroupResource } from '@/core/groups/types';
import { Card, CardContent } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Modal } from '@/shared/ui/Modal';
import { FormInput } from '@/shared/ui/FormInput';
import { Alert } from '@/shared/ui/Alert';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useToast } from '@/shared/ui/Toast';
import { groupsApi } from '../services/groupsApi';
import { formatMaterialDate } from '../utils/materialUtils';
import { isMeetingResource } from '../utils/meetingUtils';

export interface GroupAttachmentsTabProps {
  groupId: string;
  group: TrainingGroup;
  onUpdateGroup?: (updated: TrainingGroup) => void;
  readOnly?: boolean;
}

export const GroupAttachmentsTab: React.FC<GroupAttachmentsTabProps> = ({
  groupId,
  group,
  onUpdateGroup,
  readOnly = false,
}) => {
  const toast = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<GroupResource | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'pdf' | 'link'>('pdf');
  const [error, setError] = useState<string | null>(null);

  const attachments = (group.resources || []).filter((r) => !isMeetingResource(r));

  const handleOpenAdd = () => {
    setTitle('');
    setUrl('');
    setDescription('');
    setType('pdf');
    setError(null);
    setIsAddModalOpen(true);
  };

  const handleSaveAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('عنوان المادة المرفقة مطلوب');
      return;
    }
    if (!url.trim()) {
      setError('رابط أو مسار المستند مطلوب');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const newAttachment: GroupResource = {
        id: `RES-${groupId}-${Date.now().toString(36)}`,
        title: title.trim(),
        url: url.trim(),
        description: description.trim(),
        order: (group.resources?.length || 0) + 1,
        type,
        createdAt: new Date().toISOString(),
      };

      const updatedResources = [...(group.resources || []), newAttachment];
      const updated = await groupsApi.updateGroup(groupId, { resources: updatedResources });
      toast.success('تمت إضافة المادة المرفقة بنجاح');
      onUpdateGroup?.(updated);
      setIsAddModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر حفظ المادة المرفقة';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!attachmentToDelete) return;

    try {
      const updatedResources = (group.resources || []).filter((r) => r.id !== attachmentToDelete.id);
      const updated = await groupsApi.updateGroup(groupId, { resources: updatedResources });
      toast.success(`تم حذف المادة المرفقة: ${attachmentToDelete.title}`);
      onUpdateGroup?.(updated);
      setAttachmentToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر حذف المادة المرفقة';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6" data-testid="group-attachments-tab" dir="rtl">
      {/* Header Bar */}
      <Card variant="elevated" className="border-border">
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-text-muted mb-1 font-semibold">
              <Icon name="attachment" size="sm" className="text-primary" />
              <span>المواد المرفقة المعتمدة للمجموعة</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-text-heading">
              المواد المرفقة والوثائق التدريبية
            </h2>
            <p className="text-xs sm:text-sm text-text-muted mt-0.5 leading-relaxed">
              الأدلة الإجرائية، كتيبات الطوارئ، وروابط الوثائق واللوائح الرسمية الملحقة بدفعة التدريب.
            </p>
          </div>

          {!readOnly && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon="plus"
              onClick={handleOpenAdd}
              data-testid="open-add-attachment-btn"
            >
              إضافة مادة مرفقة
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Attachments List */}
      {attachments.length === 0 ? (
        <Card variant="default" className="text-center py-12 px-6 border-dashed border-2" data-testid="attachments-empty-state">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <Icon name="attachment" size="lg" />
          </div>
          <h3 className="text-base font-bold text-text-heading mb-1">
            لا توجد مواد مرفقة مضافة لهذه المجموعة حالياً
          </h3>
          <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed mb-4">
            {readOnly
              ? 'لم يقم المشرف بإرفاق ملفات أو كتيبات خارجية لهذه المجموعة التدريبية حتى الآن.'
              : 'يمكنك إرفاق كتيبات الطوارئ ووثائق الإجراءات وروابط التشغيل الميداني للمتدربين.'}
          </p>
          {!readOnly && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon="plus"
              onClick={handleOpenAdd}
              data-testid="empty-add-attachment-btn"
            >
              إضافة أول مادة مرفقة
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5" data-testid="attachments-grid">
          {attachments.map((res) => {
            const isPdf = res.type === 'pdf' || res.url.endsWith('.pdf');

            return (
              <Card
                key={res.id}
                variant="default"
                className="p-5 sm:p-6 rounded-2xl flex flex-col justify-between space-y-4 hover:border-primary/40 transition-all bg-surface"
                data-testid={`attachment-card-${res.id}`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Badge variant={isPdf ? 'danger' : 'primary'} className="text-xs font-bold gap-1">
                      <Icon name={isPdf ? 'fileText' : 'link'} size="sm" />
                      <span>{isPdf ? 'كتيب ومستند PDF' : 'رابط مرجعي'}</span>
                    </Badge>
                    {res.createdAt && (
                      <span className="text-[11px] text-text-muted">
                        {formatMaterialDate(res.createdAt)}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-text-heading">
                    {res.title}
                  </h3>
                  {res.description && (
                    <p className="text-xs text-text-muted leading-relaxed">
                      {res.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/70 text-xs">
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      leftIcon={isPdf ? 'download' : 'externalLink'}
                      className="text-xs font-bold"
                    >
                      {isPdf ? 'تحميل المستند المعتمد' : 'فتح الرابط الخارجي'}
                    </Button>
                  </a>

                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      leftIcon="trash"
                      onClick={() => setAttachmentToDelete(res)}
                      className="text-danger-dark hover:bg-danger-light/40 text-xs"
                      data-testid={`delete-attachment-btn-${res.id}`}
                    >
                      حذف
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Attachment Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="إضافة مادة مرفقة جديدة للمجموعة"
        size="md"
      >
        <form onSubmit={handleSaveAttachment} className="space-y-4" dir="rtl">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormInput
            label="عنوان المادة المرفقة *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: دليل إجراءات السلامة المعتمد للخط الثاني"
            required
            data-testid="attachment-title-input"
          />

          <FormInput
            label="رابط أو مسار المستند *"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="مثال: /dev-media/emergency-guidelines.pdf"
            required
            data-testid="attachment-url-input"
          />

          <div>
            <label className="block text-xs font-bold text-text-heading mb-1.5">
              نوع المادة المرفقة
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'pdf' | 'link')}
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="pdf">مستند أو كتيب PDF</option>
              <option value="link">رابط أو مستند مرجعي خارجي</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-heading mb-1.5">
              الوصف والملاحظات الإيضاحية
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="وصف مختصر للغرض من هذا المستند ومتى يجب على المتدرب الرجوع إليه..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary"
              data-testid="attachment-desc-input"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              data-testid="save-attachment-btn"
            >
              حفظ المادة المرفقة
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(attachmentToDelete)}
        title="تأكيد حذف المادة المرفقة"
        message={`هل أنت متأكد من حذف المادة المرفقة "${attachmentToDelete?.title}"؟ لن يتمكن متدربو المجموعة من الوصول إليها بعد الحذف.`}
        confirmLabel="تأكيد الحذف"
        cancelLabel="إلغاء"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setAttachmentToDelete(null)}
        onClose={() => setAttachmentToDelete(null)}
      />
    </div>
  );
};

export default GroupAttachmentsTab;
