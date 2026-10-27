import React from 'react';
import { Icon } from '@/shared/ui/Icon/Icon';
import { Button } from '@/shared/ui/Button/Button';
import type { EnrichedChapterItem } from '../types';

export interface PlayerToolbarProps {
  currentItem: EnrichedChapterItem | null;
  canGoPrev: boolean;
  canGoNext: boolean;
  onGoPrev: () => void;
  onGoNext: () => void;
}

export const PlayerToolbar: React.FC<PlayerToolbarProps> = ({
  currentItem,
  canGoPrev,
  canGoNext,
  onGoPrev,
  onGoNext,
}) => {
  if (!currentItem) return null;

  return (
    <div className="player-bottom-toolbar" role="navigation" aria-label="شريط التنقل بين الدروس">
      {/* Previous Lesson Action (Right side in RTL) */}
      <Button
        variant="secondary"
        size="md"
        disabled={!canGoPrev}
        onClick={onGoPrev}
        aria-label="الدرس السابق"
        leftIcon="chevronRight"
      >
        الدرس السابق
      </Button>

      {/* Lesson Status Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
        {currentItem.isCompleted ? (
          <span style={{ color: '#4ADE80', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
            <Icon name="checkCircle" size="sm" />
            هذا الدرس مكتمل
          </span>
        ) : (
          <span style={{ color: '#94A3B8' }}>
            الدرس {currentItem.globalIndex + 1}
          </span>
        )}
      </div>

      {/* Next Lesson Action (Left side in RTL) */}
      <Button
        variant="primary"
        size="md"
        disabled={!canGoNext}
        onClick={onGoNext}
        aria-label="الدرس التالي"
        rightIcon="chevronLeft"
      >
        الدرس التالي
      </Button>
    </div>
  );
};
