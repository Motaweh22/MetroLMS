import React from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import type { FieldConflict } from '../services/threeWayRebase';

export interface ConflictResolutionModalProps {
  isOpen: boolean;
  conflicts: FieldConflict[];
  serverRevision?: number;
  isSaving?: boolean;
  onKeepLocal: () => void | Promise<void>;
  onAcceptServer: () => void | Promise<void>;
  onCancel: () => void;
  testId?: string;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  conflicts,
  serverRevision,
  isSaving = false,
  onKeepLocal,
  onAcceptServer,
  onCancel,
  testId = 'conflict-resolution-modal',
}) => {
  const formatValue = (val: unknown): string => {
    if (val === undefined || val === null) return 'غير محدد';
    if (typeof val === 'string') return val.trim().length > 0 ? val : 'فارغ';
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) {
      if (val.length === 0) return 'قائمة فارغة';
      if (typeof val[0] === 'string') return val.join('، ');
      return `مصفوفة عناصر (${val.length})`;
    }
    return JSON.stringify(val);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSaving) onCancel();
      }}
      size="xl"
      hideHeader
      dataTestId={testId}
      ariaLabelledBy="conflict-modal-title"
      ariaDescribedBy="conflict-modal-description"
    >
      <div className="space-y-5 text-right font-sans" dir="rtl">
        {/* Header Alert */}
        <div className="flex items-start gap-3 border-b border-border-subtle pb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-warning/15 text-warning-dark shrink-0 mt-0.5">
            <Icon name="alertCircle" size="md" />
          </div>
          <div>
            <h3
              id="conflict-modal-title"
              data-testid="conflict-modal-title"
              className="text-lg font-bold text-text-heading"
            >
              تعارض في التعديلات المتزامنة (409 Conflict)
            </h3>
            <p
              id="conflict-modal-description"
              className="text-sm text-text-muted mt-1 leading-relaxed"
            >
              تم اكتشاف تعديلات أحدث تم اعتمادها على الخادم
              {serverRevision !== undefined ? ` (المراجعة المقبولة: #${serverRevision})` : ''} أثناء حفظ تعديلاتك. يرجى مراجعة الحقول المتعارضة أدناه واختيار الإجراء المناسب:
            </p>
          </div>
        </div>

        {/* Conflicts Table / Cards */}
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          <div className="text-xs font-semibold text-text-muted">
            قائمة الحقول المتعارضة ({conflicts.length}):
          </div>

          <div className="divide-y divide-border-subtle border border-border-subtle rounded-lg bg-surface-ground">
            {conflicts.map((conflict, idx) => (
              <div key={conflict.path || idx} className="p-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text-heading">{conflict.label}</span>
                  <span className="text-xs font-mono text-text-muted dir-ltr">
                    {conflict.path}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* Server Version */}
                  <div className="bg-surface-card p-2 rounded border border-info/30">
                    <div className="font-semibold text-info-dark mb-1 flex items-center gap-1">
                      <Icon name="checkCircle" size="sm" />
                      نسخة الخادم المعتمدة:
                    </div>
                    <div className="text-text-body font-medium break-words">
                      {formatValue(conflict.serverValue)}
                    </div>
                  </div>

                  {/* Local Version */}
                  <div className="bg-surface-card p-2 rounded border border-warning/30">
                    <div className="font-semibold text-warning-dark mb-1 flex items-center gap-1">
                      <Icon name="edit" size="sm" />
                      تعديلاتك المحلية المعلقة:
                    </div>
                    <div className="text-text-body font-medium break-words">
                      {formatValue(conflict.localValue)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Decision Buttons */}
        <div className="pt-2 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-end gap-2.5">
          {/* Choice 3: Cancel for manual review */}
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={isSaving}
            data-testid="conflict-cancel-btn"
            className="w-full sm:w-auto"
          >
            إلغاء والمراجعة يدوياً
          </Button>

          {/* Choice 2: Accept server version */}
          <Button
            variant="secondary"
            onClick={onAcceptServer}
            disabled={isSaving}
            data-testid="conflict-accept-server-btn"
            className="w-full sm:w-auto"
          >
            اعتماد نسخة الخادم الأحدث
          </Button>

          {/* Choice 1: Keep local edits */}
          <Button
            variant="primary"
            onClick={onKeepLocal}
            isLoading={isSaving}
            data-testid="conflict-keep-local-btn"
            className="w-full sm:w-auto bg-warning-dark hover:bg-warning-darker text-white"
          >
            الإبقاء على تعديلاتي المحلية
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConflictResolutionModal;
