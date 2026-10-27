import React, { useState } from 'react';
import type { ExternalResource } from '@/core/courses/types';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon, type SemanticIconName } from '@/shared/ui/Icon';
import { QRCodeModal } from '@/shared/ui/QRCodeModal';

export interface ExternalResourcesEditorProps {
  resources?: ExternalResource[];
  onChange: (updatedResources: ExternalResource[]) => void;
  scopeLabel?: string; // e.g. "للمقرر" or "لهذا الدرس"
}

const AVAILABLE_ICONS: { name: SemanticIconName; label: string }[] = [
  { name: 'link', label: 'رابط خارجي عام' },
  { name: 'fileText', label: 'مستند / وثيقة مرجعية' },
  { name: 'bookOpen', label: 'كتيب / دليل تدريبي' },
  { name: 'code', label: 'مستودع كود برمجي' },
  { name: 'download', label: 'برنامج / حزمة تنزيل' },
  { name: 'video', label: 'شرح مرئي إضافي' },
  { name: 'info', label: 'معلومات ومواصفات' },
];

export const ExternalResourcesEditor: React.FC<ExternalResourcesEditorProps> = ({
  resources = [],
  onChange,
  scopeLabel = 'للمقرر',
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<SemanticIconName>('link');
  const [error, setError] = useState<string | null>(null);

  // Active QR modal resource
  const [qrResource, setQrResource] = useState<ExternalResource | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setUrl('');
    setDescription('');
    setIcon('link');
    setError(null);
  };

  const validateUrl = (rawUrl: string): boolean => {
    try {
      const parsed = new URL(rawUrl);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleStartEdit = (res: ExternalResource) => {
    setEditingId(res.id);
    setTitle(res.title);
    setUrl(res.url);
    setDescription(res.description || '');
    setIcon((res.icon as SemanticIconName) || 'link');
    setError(null);
  };

  const handleSaveResource = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanTitle = title.trim();
    const cleanUrl = url.trim();

    if (!cleanTitle) {
      setError('يرجى إدخال عنوان للمورد التعليمي.');
      return;
    }

    if (!cleanUrl || !validateUrl(cleanUrl)) {
      setError('يرجى إدخال عنوان URL صالح يبدأ بـ http:// أو https:// (يمنع استخدام الروابط غير الآمنة).');
      return;
    }

    if (editingId) {
      // Update existing
      const updated = resources.map((r) =>
        r.id === editingId
          ? {
              ...r,
              title: cleanTitle,
              url: cleanUrl,
              description: description.trim() || undefined,
              icon,
            }
          : r
      );
      onChange(updated);
    } else {
      // Add new
      const newResource: ExternalResource = {
        id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: cleanTitle,
        url: cleanUrl,
        description: description.trim() || undefined,
        icon,
        order: resources.length + 1,
      };
      onChange([...resources, newResource]);
    }

    resetForm();
  };

  const handleDeleteResource = (id: string) => {
    const updated = resources
      .filter((r) => r.id !== id)
      .map((r, idx) => ({ ...r, order: idx + 1 }));
    onChange(updated);
    if (editingId === id) resetForm();
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= resources.length) return;

    const copy = [...resources];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;

    const reordered = copy.map((r, idx) => ({ ...r, order: idx + 1 }));
    onChange(reordered);
  };

  return (
    <div className="space-y-4" data-testid="external-resources-editor">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-text-heading flex items-center gap-1.5">
            <Icon name="link" size="sm" className="text-primary" />
            <span>المصادر والمراجع التعليمية الخارجية ({scopeLabel})</span>
          </h3>
          <p className="text-[11px] text-text-muted mt-0.5">
            أضف روابط موثوقة لمستودعات الأكواد، برامج التثبيت، والوثائق الرسمية التوجيهية
          </p>
        </div>
        <Badge variant="neutral" className="text-xs">
          {resources.length} مورد مضاف
        </Badge>
      </div>

      {/* Existing Resources List */}
      {resources.length > 0 ? (
        <div className="space-y-2">
          {resources.map((res, idx) => (
            <div
              key={res.id}
              className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface hover:border-primary/40 transition-colors gap-3"
              data-testid={`resource-row-${res.id}`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon name={(res.icon as SemanticIconName) || 'link'} size="sm" />
                </span>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2">
                    <strong className="text-xs text-text-heading truncate">{res.title}</strong>
                    <span className="text-[10px] text-text-muted font-mono" dir="ltr">
                      {new URL(res.url).hostname}
                    </span>
                  </div>
                  {res.description && (
                    <p className="text-[11px] text-text-muted truncate mt-0.5">{res.description}</p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Reorder Buttons */}
                <button
                  type="button"
                  onClick={() => handleMove(idx, 'up')}
                  disabled={idx === 0}
                  className="p-1 rounded-md text-text-muted hover:text-text hover:bg-neutral-light disabled:opacity-30"
                  title="تحريك لأعلى"
                  data-testid={`resource-reorder-up-${res.id}`}
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(idx, 'down')}
                  disabled={idx === resources.length - 1}
                  className="p-1 rounded-md text-text-muted hover:text-text hover:bg-neutral-light disabled:opacity-30"
                  title="تحريك لأسفل"
                  data-testid={`resource-reorder-down-${res.id}`}
                >
                  ▼
                </button>

                {/* QR Code Button */}
                <button
                  type="button"
                  onClick={() => setQrResource(res)}
                  className="p-1.5 rounded-lg border border-border hover:bg-neutral-light text-primary transition-colors text-xs"
                  title="عرض رمز QR للمورد"
                  data-testid={`resource-qr-${res.id}`}
                >
                  <Icon name="link" size="sm" />
                </button>

                {/* Edit Button */}
                <button
                  type="button"
                  onClick={() => handleStartEdit(res)}
                  className="p-1.5 rounded-lg border border-border hover:bg-neutral-light text-text transition-colors text-xs"
                  title="تعديل المورد"
                  data-testid={`resource-edit-${res.id}`}
                >
                  <Icon name="edit" size="sm" />
                </button>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => handleDeleteResource(res.id)}
                  className="p-1.5 rounded-lg border border-border hover:bg-danger/10 text-danger transition-colors text-xs"
                  title="حذف المورد"
                  data-testid={`resource-delete-${res.id}`}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3 text-center border border-dashed border-border rounded-xl text-xs text-text-muted">
          لا توجد مصادر خارجية مضافة حتى الآن. يمكنك إضافة مراجع وروابط مساعدة عبر النموذج أدناه.
        </div>
      )}

      {/* Add / Edit Form */}
      <form
        onSubmit={handleSaveResource}
        className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3"
        data-testid="resource-form"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-text-heading">
            {editingId ? 'تعديل بيانات المورد التعليمي' : '+ إضافة مورد خارجي جديد'}
          </span>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-[11px] text-danger hover:underline font-semibold"
            >
              إلغاء التعديل
            </button>
          )}
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Title */}
          <div className="space-y-1 sm:col-span-1">
            <label htmlFor="resource-title-input" className="block text-[11px] font-bold text-text-heading">
              عنوان المورد <span className="text-danger">*</span>
            </label>
            <input
              id="resource-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: الموقع الرسمي لتحميل بايثون"
              className="w-full px-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
              data-testid="resource-title-input"
              required
            />
          </div>

          {/* URL */}
          <div className="space-y-1 sm:col-span-1">
            <label htmlFor="resource-url-input" className="block text-[11px] font-bold text-text-heading">
              رابط المورد (URL) <span className="text-danger">*</span>
            </label>
            <input
              id="resource-url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.python.org/downloads"
              className="w-full px-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary font-mono text-left"
              dir="ltr"
              data-testid="resource-url-input"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="resource-desc-input" className="block text-[11px] font-bold text-text-heading">
              شرح مختصر أو توجيه للمتدرب (اختياري)
            </label>
            <input
              id="resource-desc-input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: يرجى تحميل أحدث إصدار وتثبيت خيار إضافة إلى PATH..."
              className="w-full px-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
              data-testid="resource-desc-input"
            />
          </div>

          {/* Icon Selector */}
          <div className="space-y-1 sm:col-span-2">
            <label className="block text-[11px] font-bold text-text-heading">
              أيقونة المورد الدلالية
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {AVAILABLE_ICONS.map((ic) => (
                <button
                  key={ic.name}
                  type="button"
                  onClick={() => setIcon(ic.name)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border transition-all ${
                    icon === ic.name
                      ? 'border-primary bg-primary text-white font-bold shadow-xs'
                      : 'border-border bg-surface text-text-muted hover:bg-neutral-light'
                  }`}
                  data-testid={`icon-btn-${ic.name}`}
                >
                  <Icon name={ic.name} size="sm" />
                  <span>{ic.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            leftIcon={editingId ? undefined : 'plus'}
            className="text-xs font-bold"
            data-testid="save-resource-btn"
          >
            {editingId ? 'حفظ التعديلات' : 'إضافة المورد'}
          </Button>
        </div>
      </form>

      {/* QR Code Modal for Individual Resource */}
      {qrResource && (
        <QRCodeModal
          isOpen={Boolean(qrResource)}
          onClose={() => setQrResource(null)}
          title={qrResource.title}
          url={qrResource.url}
          subtitle={qrResource.description}
          badgeLabel="مورد خارجي مستقل"
          downloadFilename={`resource-${qrResource.id}-qr.png`}
          isExternalResource={true}
        />
      )}
    </div>
  );
};

export default ExternalResourcesEditor;
