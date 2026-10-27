import React from 'react';
import { Icon } from '@/shared/ui/Icon';
import type { TraineeAttentionResult } from '@/core/groups/types';

export interface AttentionBadgeProps {
  attention?: TraineeAttentionResult | null;
  isCompleted?: boolean;
  className?: string;
  testId?: string;
}

export const AttentionBadge: React.FC<AttentionBadgeProps> = ({
  attention,
  isCompleted = false,
  className = '',
  testId = 'attention-badge',
}) => {
  if (attention?.needsAttention) {
    if (attention.level === 'danger') {
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-danger/10 text-danger border border-danger/25 select-none ${className}`}
          title={attention.reason}
          data-testid={testId}
          data-attention-level="danger"
        >
          <Icon name="alert" size="sm" className="text-danger shrink-0" />
          <span>{attention.badge || 'تنبيه عاجل'}</span>
        </span>
      );
    }

    if (attention.level === 'warning') {
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-warning/15 text-warning-dark border border-warning/30 select-none ${className}`}
          title={attention.reason}
          data-testid={testId}
          data-attention-level="warning"
        >
          <Icon name={attention.badge === 'لم يبدأ بعد' ? 'clock' : 'alertCircle'} size="sm" className="text-warning-dark shrink-0" />
          <span>{attention.badge || 'يحتاج متابعة'}</span>
        </span>
      );
    }
  }

  if (isCompleted || attention?.badge === 'مكتمل بنجاح') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/25 select-none ${className}`}
        title={attention?.reason || 'تم إكمال جميع المتطلبات التدريبية بنجاح'}
        data-testid={testId}
        data-attention-level="success"
      >
        <Icon name="checkCircle" size="sm" className="text-success shrink-0" />
        <span>مكتمل بنجاح</span>
      </span>
    );
  }

  // Normal / on track
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/25 select-none ${className}`}
      title={attention?.reason || 'التقدم منتظم وضمن الجدول الزمني المقرر'}
      data-testid={testId}
      data-attention-level="normal"
    >
      <Icon name="check" size="sm" className="text-primary shrink-0" />
      <span>{attention?.badge || 'منتظم'}</span>
    </span>
  );
};

export default AttentionBadge;
