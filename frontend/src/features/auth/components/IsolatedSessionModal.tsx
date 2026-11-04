import React, { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { useIsolatedSession } from '@/core/auth/useIsolatedSession';
import type { SyntheticTestPersona } from '@/core/auth/testPersonas';
import { ROLE_CANONICAL_LABELS_AR } from '@/core/permissions/types';

export interface IsolatedSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IsolatedSessionModal: React.FC<IsolatedSessionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    availablePersonas,
    launchIsolatedTestSession,
    isTransitioning,
    canLaunch,
    error,
    clearError,
  } = useIsolatedSession();

  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('USR_TEST_ADMIN_001');
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLaunch = async () => {
    if (!selectedPersonaId) return;
    setLocalError(null);
    clearError();

    try {
      const success = await launchIsolatedTestSession(selectedPersonaId);
      if (success) {
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل بدء جلسة الاختبار المعزولة.';
      setLocalError(msg);
    }
  };

  const selectedPersona = availablePersonas.find((p) => p.id === selectedPersonaId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="بدء جلسة اختبار صلاحيات معزولة (اختبار الصلاحيات)"
      size="lg"
      dataTestId="isolated-session-modal"
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isTransitioning}>
            إلغاء
          </Button>

          <Button
            variant="primary"
            size="md"
            leftIcon="shield"
            isLoading={isTransitioning}
            disabled={isTransitioning || !canLaunch || !selectedPersonaId}
            onClick={handleLaunch}
            data-testid="confirm-launch-session-btn"
          >
            {isTransitioning ? 'جاري تبديل الجلسة وتأمين اللقطة...' : 'بدء جلسة الاختبار المعزولة'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 text-sm" dir="rtl">
        {/* Architectural Context Alert */}
        <Alert variant="warning" icon="shield">
          <div className="space-y-1">
            <strong className="block font-bold">
              تبديل مصادقة حقيقي مع حفظ لقطة جلسة المطور (Decision D-10)
            </strong>
            <p className="text-xs text-text-muted leading-relaxed">
              على عكس «معاينة الأدوار» التي تعدل الواجهة بصرياً فقط، تقوم جلسة الاختبار المعزولة بتبديل جلسة الدخول
              وحقن رمز JWT خاص بالشخصية الاختبارية، مما يتيح اختبار العمليات الحقيقية وتعديل البيانات وفق صلاحيات الدور
              المحدد. يتم حفظ جلسة المطور الأصلية بشكل آمن للرجوع إليها بنقرة زر واحدة في أي وقت.
            </p>
          </div>
        </Alert>

        {(localError || error) && (
          <Alert variant="danger" icon="alert">
            {localError || error}
          </Alert>
        )}

        {/* Persona Selector List */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-text-heading">
            اختر الشخصية الاختبارية الاصطناعية المعتمدة:
          </label>

          <div className="grid grid-cols-1 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {availablePersonas.map((persona: SyntheticTestPersona) => {
              const isSelected = persona.id === selectedPersonaId;
              const roleLabel = ROLE_CANONICAL_LABELS_AR[persona.role] || persona.role;

              return (
                <div
                  key={persona.id}
                  onClick={() => setSelectedPersonaId(persona.id)}
                  data-testid={`persona-card-${persona.id}`}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                      : 'border-border bg-surface hover:border-primary/40'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-text-heading text-sm">
                        {persona.name}
                      </span>
                      <Badge variant="primary" className="text-[10px] font-bold">
                        {roleLabel}
                      </Badge>
                      <span className="font-mono text-[11px] text-text-muted">
                        ({persona.id})
                      </span>
                    </div>

                    <p className="text-xs text-text-muted leading-relaxed">
                      {persona.descriptionAr}
                    </p>

                    <div className="text-[11px] text-text-muted/80 flex items-center gap-2 pt-0.5">
                      <span>القطاع: {persona.department}</span>
                      <span>•</span>
                      <span>الوظيفة: {persona.jobTitle}</span>
                    </div>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    <input
                      type="radio"
                      name="selectedPersona"
                      checked={isSelected}
                      onChange={() => setSelectedPersonaId(persona.id)}
                      className="w-4 h-4 text-primary focus:ring-primary"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Confirmation Summary Box */}
        {selectedPersona && (
          <div className="p-3 bg-neutral-light/70 rounded-lg border border-border/80 text-xs space-y-1">
            <span className="font-bold text-text-heading block">
              ملخص الانتقال لجلسة الاختبار:
            </span>
            <p className="text-text-muted leading-relaxed">
              سيتم حفظ جلسة المطور النشطة في مساحة التخزين الخاصة (<code className="font-mono text-primary font-semibold">metro_lms_developer_origin_session</code>) ثم تسجيل الدخول كـ «{selectedPersona.name}» بصلاحيات «{ROLE_CANONICAL_LABELS_AR[selectedPersona.role] || selectedPersona.role}».
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default IsolatedSessionModal;

