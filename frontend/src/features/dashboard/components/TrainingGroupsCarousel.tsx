import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import type { AdminGroupOverviewMetric } from '@/core/dashboard/types';

export interface TrainingGroupsCarouselProps {
  groups: AdminGroupOverviewMetric[];
  title?: string;
}

export const TrainingGroupsCarousel: React.FC<TrainingGroupsCarouselProps> = ({
  groups,
  title = 'حالة المجموعات والدفعات الميدانية',
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 640;
    }
    return true;
  });

  // Track window resizing to adapt visible items count
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 640);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const visibleCardsCount = isDesktop ? 2 : 1;
  const maxIndex = Math.max(0, groups.length - visibleCardsCount);

  // Auto-clamp index when screen or data size changes
  useEffect(() => {
    if (currentIndex > maxIndex) {
      setCurrentIndex(maxIndex);
    }
  }, [currentIndex, maxIndex]);

  // In Arabic RTL reading direction:
  // "Next" (التالية) moves forward towards later items (leftwards)
  // "Previous" (السابقة) moves backward towards earlier items (rightwards)
  const isPrevDisabled = currentIndex <= 0;
  const isNextDisabled = currentIndex >= maxIndex || groups.length <= visibleCardsCount;

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(maxIndex, prev + 1));
  }, [maxIndex]);

  // Keyboard navigation for carousel
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handleNext();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handlePrev();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setCurrentIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setCurrentIndex(maxIndex);
    }
  };

  // Build Arabic position label
  const positionLabel =
    groups.length === 0
      ? '0 من 0'
      : groups.length === 1
      ? 'المجموعة 1 من 1'
      : isDesktop
      ? `المجموعات ${currentIndex + 1} - ${Math.min(currentIndex + visibleCardsCount, groups.length)} من ${groups.length}`
      : `المجموعة ${currentIndex + 1} من ${groups.length}`;

  // Shift calculation for RTL sliding track:
  // In RTL, items are arranged from right to left.
  // Shifting positive X (to the physical right) brings the items on the left into view.
  const transformStyle = isDesktop
    ? `translateX(calc(${currentIndex} * (50% + 0.5rem)))`
    : `translateX(calc(${currentIndex} * (100% + 1rem)))`;

  return (
    <div
      className="space-y-4"
      data-testid="active-groups-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="شريط استعراض المجموعات والدفعات الميدانية"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Header with Title, Live Indicator & Navigation Arrows */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-text-heading flex items-center gap-2">
          <Icon name="trainingGroups" size="sm" className="text-primary" />
          <span>{title}</span>
        </h2>

        {groups.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Slide Index Counter */}
            <span
              className="text-xs text-text-muted font-medium px-2.5 py-1 rounded-lg bg-surface border border-border select-none"
              data-testid="carousel-indicator"
              aria-live="polite"
            >
              {positionLabel}
            </span>

            {/* Navigational Arrows Controls */}
            <div
              className="flex items-center gap-1.5"
              role="group"
              aria-label="أزرار تصفح المجموعات التدريبية"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={isPrevDisabled}
                aria-label="المجموعة السابقة"
                aria-disabled={isPrevDisabled}
                data-testid="carousel-prev-btn"
                className="w-8 h-8 p-0 flex items-center justify-center rounded-lg border-border hover:bg-neutral-light disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Icon name="chevronRight" size="sm" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={isNextDisabled}
                aria-label="المجموعة التالية"
                aria-disabled={isNextDisabled}
                data-testid="carousel-next-btn"
                className="w-8 h-8 p-0 flex items-center justify-center rounded-lg border-border hover:bg-neutral-light disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Icon name="chevronLeft" size="sm" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {groups.length === 0 && (
        <Card
          variant="default"
          className="text-center py-8 px-4 border-dashed text-text-muted text-sm"
          data-testid="carousel-empty-state"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
            <Icon name="trainingGroups" size="md" />
          </div>
          <p className="font-semibold text-text-heading">لا توجد مجموعات تدريبية نشطة حالياً</p>
          <p className="text-xs text-text-muted mt-1">
            سيتم إدراج الدفعات والمجموعات الميدانية فور بدء البرامج التدريبية المقررة.
          </p>
        </Card>
      )}

      {/* Navigable Sliding Viewport */}
      {groups.length > 0 && (
        <div className="overflow-hidden rounded-xl">
          <div
            className="flex gap-4 transition-transform duration-300 ease-in-out"
            style={{ transform: transformStyle }}
            data-testid="carousel-track"
          >
            {groups.map((grp, index) => (
              <div
                key={grp.id}
                className="w-full sm:w-[calc(50%-0.5rem)] shrink-0"
                role="group"
                aria-roledescription="slide"
                aria-label={`مجموعة ${grp.name} (${index + 1} من ${groups.length})`}
                data-testid={`carousel-card-${grp.id}`}
              >
                <Link
                  to={`/my-groups/${encodeURIComponent(grp.id)}`}
                  className="block h-full group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
                  aria-label={`عرض تفاصيل مجموعة ${grp.name} (${grp.id})`}
                  data-testid={`carousel-card-link-${grp.id}`}
                >
                  <Card
                    variant="default"
                    className="p-4 space-y-2 h-full flex flex-col justify-between border-border hover:border-primary/60 hover:shadow-md transition-all cursor-pointer group-hover:border-primary/60"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <Badge variant="neutral" className="text-xs font-mono font-bold">
                          {grp.id}
                        </Badge>
                        <span className="text-xs text-text-muted font-medium">{grp.deadlineText}</span>
                      </div>
                      <h3 className="text-sm font-bold text-text-heading line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                        {grp.name}
                      </h3>
                      <p className="text-xs text-text-muted mt-1">عدد المتدربين: {grp.traineeCount}</p>
                    </div>

                    <div className="space-y-1 pt-2 border-t border-border/70">
                      <div className="flex justify-between text-[11px] text-text-muted">
                        <span>الإنجاز</span>
                        <span className="font-bold text-text-heading">{grp.overallProgress}%</span>
                      </div>
                      <ProgressBar value={grp.overallProgress} size="sm" variant="primary" />
                    </div>
                  </Card>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingGroupsCarousel;
