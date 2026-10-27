import React from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Badge } from '@/shared/ui/Badge';
import type { GroupStatus } from '@/core/groups/types';
import { formatMaterialDate } from '../utils/materialUtils';

export interface CountdownStripProps {
  startDateTime: string;
  deadlineDateTime: string;
  status: GroupStatus;
  timeRemainingText?: string;
  isHistorical?: boolean;
  className?: string;
  testId?: string;
}

export const CountdownStrip: React.FC<CountdownStripProps> = ({
  startDateTime,
  deadlineDateTime,
  status,
  timeRemainingText,
  isHistorical = false,
  className = '',
  testId = 'countdown-strip',
}) => {
  const now = new Date().getTime();
  const start = new Date(startDateTime).getTime();
  const deadline = new Date(deadlineDateTime).getTime();

  const totalDurationMs = Math.max(1, deadline - start);
  const elapsedMs = Math.max(0, now - start);
  const elapsedPercent = isHistorical || status === 'expired'
    ? 100
    : status === 'scheduled'
      ? 0
      : Math.min(100, Math.max(0, Math.round((elapsedMs / totalDurationMs) * 100)));

  return (
    <div
      className={`bg-surface p-4 rounded-xl border border-border shadow-xs space-y-3 ${className}`}
      data-testid={testId}
      dir="rtl"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
            <Icon name="clock" size="md" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text-heading">
                {isHistorical
                  ? 'الجدول الزمني للدورة السابقة'
                  : status === 'scheduled'
                    ? 'الجدول الزمني للبدء'
                    : 'الجدول الزمني وسريان التدريب'}
              </span>
              {isHistorical ? (
                <Badge variant="neutral" size="sm" data-testid="temporal-status-badge">
                  سجل تاريخي مؤرشف
                </Badge>
              ) : status === 'active' ? (
                <Badge variant="primary" size="sm" data-testid="temporal-status-badge">
                  دورة نشطة ومستمرة
                </Badge>
              ) : status === 'scheduled' ? (
                <Badge variant="neutral" size="sm" data-testid="temporal-status-badge">
                  مجدولة
                </Badge>
              ) : (
                <Badge variant="danger" size="sm" data-testid="temporal-status-badge">
                  انتهى الموعد النهائي
                </Badge>
              )}
            </div>
            {timeRemainingText && (
              <p className="text-xs text-text-muted mt-0.5" data-testid="time-remaining-text">
                {timeRemainingText}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-text-muted bg-neutral-light/50 px-3 py-2 rounded-lg border border-border/60">
          <div className="flex items-center gap-1.5">
            <Icon name="calendar" size="sm" className="text-primary" />
            <span>البداية:</span>
            <strong className="text-text font-semibold">{formatMaterialDate(startDateTime)}</strong>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-1.5">
            <Icon name="calendar" size="sm" className="text-danger" />
            <span>النهاية:</span>
            <strong className="text-text font-semibold">{formatMaterialDate(deadlineDateTime)}</strong>
          </div>
        </div>
      </div>

      {/* Visual Elapsed Duration Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-text-muted">
          <span>المدة الزمنية المنقضية للدورة</span>
          <span className="font-semibold">{elapsedPercent}%</span>
        </div>
        <div className="w-full bg-neutral-light rounded-full h-2 overflow-hidden border border-border/40">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isHistorical
                ? 'bg-text-muted'
                : elapsedPercent >= 90
                  ? 'bg-danger'
                  : elapsedPercent >= 70
                    ? 'bg-warning-dark'
                    : 'bg-primary'
            }`}
            style={{ width: `${elapsedPercent}%` }}
            data-testid="elapsed-progress-bar"
          />
        </div>
      </div>
    </div>
  );
};

export default CountdownStrip;
