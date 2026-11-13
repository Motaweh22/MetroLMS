import React, { useMemo } from 'react';
import type { TraineeGroupItemDTO } from '@/core/groups/dtos';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';

export interface TraineeGroupsSummaryCardsProps {
  groups: TraineeGroupItemDTO[]; // Complete unfiltered non-archived groups collection
}

export const TraineeGroupsSummaryCards: React.FC<TraineeGroupsSummaryCardsProps> = ({
  groups,
}) => {
  // Authoritative derivation from unfiltered collection
  const stats = useMemo(() => {
    const total = groups.length;
    const active = groups.filter((g) => g.operationalStatus === 'active').length;
    const scheduled = groups.filter((g) => g.operationalStatus === 'scheduled').length;
    return { total, active, scheduled };
  }, [groups]);

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      data-testid="trainee-summary-cards"
      role="region"
      aria-label="إحصائيات المجموعات والبرامج التدريبية"
    >
      {/* Card 1: Total Groups */}
      <Card
        variant="default"
        className="p-4 bg-surface border border-border shadow-sm hover:shadow-md transition-shadow rounded-xl"
        data-testid="summary-card-total"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
            <Icon name="trainingGroups" size="md" />
          </div>
          <div>
            <div className="text-xs text-text-muted font-medium mb-0.5">إجمالي المجموعات</div>
            <div
              className="text-2xl font-black text-text-heading tracking-tight"
              data-testid="summary-card-total-value"
            >
              {stats.total}
            </div>
          </div>
        </div>
      </Card>

      {/* Card 2: Active Groups */}
      <Card
        variant="default"
        className="p-4 bg-surface border border-border shadow-sm hover:shadow-md transition-shadow rounded-xl"
        data-testid="summary-card-active"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-success-light text-success flex items-center justify-center font-bold shrink-0">
            <Icon name="activity" size="md" />
          </div>
          <div>
            <div className="text-xs text-text-muted font-medium mb-0.5">المجموعات النشطة</div>
            <div
              className="text-2xl font-black text-success tracking-tight"
              data-testid="summary-card-active-value"
            >
              {stats.active}
            </div>
          </div>
        </div>
      </Card>

      {/* Card 3: Scheduled Groups */}
      <Card
        variant="default"
        className="p-4 bg-surface border border-border shadow-sm hover:shadow-md transition-shadow rounded-xl"
        data-testid="summary-card-scheduled"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-warning-light text-warning-dark flex items-center justify-center font-bold shrink-0">
            <Icon name="calendar" size="md" />
          </div>
          <div>
            <div className="text-xs text-text-muted font-medium mb-0.5">المجموعات المجدولة</div>
            <div
              className="text-2xl font-black text-warning-dark tracking-tight"
              data-testid="summary-card-scheduled-value"
            >
              {stats.scheduled}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TraineeGroupsSummaryCards;

