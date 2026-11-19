import React from 'react';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';

export interface AudienceSectionCardProps {
  title: string;
  description: string;
  summaryText: string;
  hasSelection: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit?: () => void;
  editLabel?: string;
  toggleTestId: string;
  editTestId?: string;
  children?: React.ReactNode;
}

export const AudienceSectionCard: React.FC<AudienceSectionCardProps> = ({
  title,
  description,
  summaryText,
  hasSelection,
  isExpanded,
  onToggleExpand,
  onEdit,
  editLabel = 'تعديل',
  toggleTestId,
  editTestId,
  children,
}) => {
  return (
    <div className="rounded-xl border border-border bg-bg/40 transition-colors">
      <div className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          data-testid={toggleTestId}
          className="flex items-start sm:items-center gap-3 text-right flex-1 min-w-0 group focus:outline-none"
        >
          <span className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0 text-text-muted group-hover:text-primary transition-colors mt-0.5 sm:mt-0">
            <Icon
              name="chevronDown"
              size="sm"
              className={`transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
            />
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-text-heading group-hover:text-primary transition-colors">
                {title}
              </span>
              <Badge variant={hasSelection ? 'primary' : 'neutral'} size="sm">
                {summaryText}
              </Badge>
            </div>
            <p className="text-[11px] text-text-muted truncate">{description}</p>
          </div>
        </button>

        <div className="flex items-center justify-end gap-2 shrink-0">
          {onEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onEdit}
              data-testid={editTestId}
              className="text-xs"
            >
              <Icon name="edit" size="sm" className="ml-1" />
              {editLabel}
            </Button>
          )}
        </div>
      </div>

      {isExpanded && children && (
        <div className="px-4 pb-4 pt-2 border-t border-border/60 bg-surface/60 rounded-b-xl">
          {children}
        </div>
      )}
    </div>
  );
};
