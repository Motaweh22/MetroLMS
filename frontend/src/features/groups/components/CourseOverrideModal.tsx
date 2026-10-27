import React, { useState, useEffect, useMemo } from 'react';
import type { PostDeadlinePolicy, TrainingGroup, GroupRenewalCycle, GroupCycleCourseAssignment } from '@/core/groups/types';
import { getEffectiveCourseSettings } from '@/core/domain/groups';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import {
  toDatetimeLocal,
  toIsoString,
  formatArabicDateTime,
} from '../utils/dateUtils';

export interface CourseOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  courseTitle: string;
  group: TrainingGroup;
  cycle: GroupRenewalCycle | null;
  initialCustomStartDateTime?: string | null;
  initialCustomDeadlineDateTime?: string | null;
  initialCustomPostDeadlinePolicy?: PostDeadlinePolicy | null;
  onApply: (override: {
    customStartDateTime: string | null;
    customDeadlineDateTime: string | null;
    customPostDeadlinePolicy: PostDeadlinePolicy | null;
  }) => void;
}

export const CourseOverrideModal: React.FC<CourseOverrideModalProps> = ({
  isOpen,
  onClose,
  courseId,
  courseTitle,
  group,
  cycle,
  initialCustomStartDateTime,
  initialCustomDeadlineDateTime,
  initialCustomPostDeadlinePolicy,
  onApply,
}) => {
  const [customStart, setCustomStart] = useState<string>('');
  const [customDeadline, setCustomDeadline] = useState<string>('');
  const [customPolicy, setCustomPolicy] = useState<string>('inherit');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize or reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCustomStart(toDatetimeLocal(initialCustomStartDateTime));
      setCustomDeadline(toDatetimeLocal(initialCustomDeadlineDateTime));
      setCustomPolicy(initialCustomPostDeadlinePolicy || 'inherit');
      setValidationError(null);
    }
  }, [isOpen, initialCustomStartDateTime, initialCustomDeadlineDateTime, initialCustomPostDeadlinePolicy]);

  // Compute effective settings dynamically for preview
  const previewAssignment = useMemo<GroupCycleCourseAssignment>(() => ({
    courseId,
    courseRole: 'core',
    order: 1,
    customStartDateTime: customStart ? toIsoString(customStart) : null,
    customDeadlineDateTime: customDeadline ? toIsoString(customDeadline) : null,
    customPostDeadlinePolicy: customPolicy !== 'inherit' ? (customPolicy as PostDeadlinePolicy) : null,
  }), [courseId, customStart, customDeadline, customPolicy]);

  const effective = useMemo(() => {
    return getEffectiveCourseSettings(group, previewAssignment, undefined, cycle);
  }, [group, previewAssignment, cycle]);

  // Validate on field change
  useEffect(() => {
    if (!effective.isValidDateRange) {
      setValidationError(effective.dateRangeError || 'الموعد النهائي يجب أن يكون لاحقاً لتاريخ البداية');
    } else {
      setValidationError(null);
    }
  }, [effective]);

  const handleClearOverrides = () => {
    setCustomStart('');
    setCustomDeadline('');
    setCustomPolicy('inherit');
    setValidationError(null);
  };

  const handleApply = () => {
    if (validationError) return;

    onApply({
      customStartDateTime: customStart ? toIsoString(customStart) : null,
      customDeadlineDateTime: customDeadline ? toIsoString(customDeadline) : null,
      customPostDeadlinePolicy: customPolicy !== 'inherit' ? (customPolicy as PostDeadlinePolicy) : null,
    });
    onClose();
  };

  const inheritedStartDate = cycle?.startDateTime || group.startDateTime;
  const inheritedDeadlineDate = cycle?.deadlineDateTime || group.deadlineDateTime;
  const inheritedPolicy = cycle?.postDeadlinePolicy || group.postDeadlinePolicy || 'keep_no_cert';

  const policyLabels: Record<string, string> = {
    keep_no_cert: 'إتاحة المحتوى دون شهادة (keep_no_cert)',
    hide: 'حجب المحتوى التدريبي (hide)',
    inherit: `استخدام السياسة العامة الموروثة (${inheritedPolicy === 'keep_no_cert' ? 'دون شهادة' : 'حجب'})`,
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تخصيص مواعيد وسياسة المقرر التدريبي"
      size="lg"
      dataTestId="course-override-modal"
    >
      <div className="space-y-6" dir="rtl">
        {/* Course Header Banner */}
        <div className="bg-bg rounded-xl p-4 border border-border flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-text-muted">المقرر التدريبي المستهدف:</span>
            <h4 className="text-sm font-bold text-text mt-0.5">{courseTitle}</h4>
            <span className="text-xs text-primary font-mono">{courseId}</span>
          </div>
          <Badge variant="neutral" size="sm">
            {cycle ? `ضمن ${cycle.title}` : 'ضمن إعدادات المجموعة العامة'}
          </Badge>
        </div>

        {/* Informative Inherited Reference Box */}
        <div className="bg-surface rounded-xl p-3.5 border border-border/80 text-xs text-text-muted space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-text">
            <Icon name="info" size="sm" className="text-primary" />
            <span>المواعيد والسياسات الموروثة افتراضياً للدورة:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
            <div>
              <span className="font-semibold text-text">بداية الدورة: </span>
              <span>{formatArabicDateTime(inheritedStartDate)}</span>
            </div>
            <div>
              <span className="font-semibold text-text">نهاية الدورة: </span>
              <span>{formatArabicDateTime(inheritedDeadlineDate)}</span>
            </div>
          </div>
          <div className="text-[11px]">
            <span className="font-semibold text-text">سياسة ما بعد الموعد الموروثة: </span>
            <span>{policyLabels[inheritedPolicy] || inheritedPolicy}</span>
          </div>
        </div>

        {/* Validation Alert */}
        {validationError && (
          <div data-testid="override-validation-error">
            <Alert variant="danger" title="خطأ في المواعيد">
              {validationError}
            </Alert>
          </div>
        )}

        {/* Form Inputs */}
        <div className="space-y-4">
          {/* Custom Start DateTime */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="custom-start-input" className="text-xs font-semibold text-text">
                موعد بداية المقرر المخصص (اختياري)
              </label>
              <Badge
                variant={customStart ? 'primary' : 'neutral'}
                size="sm"
                data-testid="start-inheritance-badge"
              >
                {customStart ? 'مخصص لهذا المقرر' : 'موروث من دورة التدريب'}
              </Badge>
            </div>
            <input
              id="custom-start-input"
              type="datetime-local"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              data-testid="custom-start-input"
            />
            <p className="text-[11px] text-text-muted mt-1">
              اترك الحقل فارغاً لوراثة تاريخ البداية تلقائياً من الدورة التدريبية.
            </p>
          </div>

          {/* Custom Deadline DateTime */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="custom-deadline-input" className="text-xs font-semibold text-text">
                الموعد النهائي المخصص لهذا المقرر (اختياري)
              </label>
              <Badge
                variant={customDeadline ? 'primary' : 'neutral'}
                size="sm"
                data-testid="deadline-inheritance-badge"
              >
                {customDeadline ? 'مخصص لهذا المقرر' : 'موروث من دورة التدريب'}
              </Badge>
            </div>
            <input
              id="custom-deadline-input"
              type="datetime-local"
              value={customDeadline}
              onChange={(e) => setCustomDeadline(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              data-testid="custom-deadline-input"
            />
            <p className="text-[11px] text-text-muted mt-1">
              اترك الحقل فارغاً لوراثة الموعد النهائي تلقائياً من الدورة التدريبية.
            </p>
          </div>

          {/* Custom Post Deadline Policy */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="custom-policy-select" className="text-xs font-semibold text-text">
                سياسة ما بعد انتهاء الموعد النهائي لهذا المقرر
              </label>
              <Badge
                variant={customPolicy !== 'inherit' ? 'primary' : 'neutral'}
                size="sm"
                data-testid="policy-inheritance-badge"
              >
                {customPolicy !== 'inherit' ? 'سياسة مخصصة' : 'موروثة'}
              </Badge>
            </div>
            <select
              id="custom-policy-select"
              value={customPolicy}
              onChange={(e) => setCustomPolicy(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              data-testid="custom-policy-select"
            >
              <option value="inherit">استخدام السياسة العامة الموروثة</option>
              <option value="keep_no_cert">إتاحة المحتوى للقراءة دون إصدار شهادة (keep_no_cert)</option>
              <option value="hide">حجب المحتوى التدريبي تماماً بعد الموعد (hide)</option>
            </select>
          </div>
        </div>

        {/* Resulting Effective Summary Preview */}
        <div className="bg-primary/5 rounded-xl p-3.5 border border-primary/20 space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-primary">
            <Icon name="checkCircle" size="sm" />
            <span>المواعيد الفعالة الناتجة لهذا المقرر:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] text-text">
            <div>
              <span className="font-semibold">تاريخ البداية الفعلي: </span>
              <span className="font-bold">{formatArabicDateTime(effective.effectiveStartDateTime)}</span>
              <span className="text-text-muted text-[10px] block">
                ({effective.hasStartOverride ? 'مخصص لهذا المقرر' : effective.inheritedFrom?.start === 'cycle' ? 'موروث من دورة التجديد' : 'موروث من المجموعة'})
              </span>
            </div>
            <div>
              <span className="font-semibold">الموعد النهائي الفعلي: </span>
              <span className="font-bold">{formatArabicDateTime(effective.effectiveDeadlineDateTime)}</span>
              <span className="text-text-muted text-[10px] block">
                ({effective.hasDeadlineOverride ? 'مخصص لهذا المقرر' : effective.inheritedFrom?.deadline === 'cycle' ? 'موروث من دورة التجديد' : 'موروث من المجموعة'})
              </span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearOverrides}
            data-testid="clear-override-modal-btn"
          >
            <Icon name="rotateCcw" size="sm" />
            <span>استعادة المواعيد الموروثة</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              data-testid="cancel-override-modal-btn"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleApply}
              disabled={Boolean(validationError)}
              data-testid="apply-override-modal-btn"
            >
              <Icon name="check" size="sm" />
              <span>تطبيق التخصيص</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
