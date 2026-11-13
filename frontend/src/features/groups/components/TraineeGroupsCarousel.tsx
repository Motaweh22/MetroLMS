import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { TraineeGroupItemDTO } from '@/core/groups/dtos';
import {
  sortTraineeGroupsForCarousel,
  formatGroupTimeInfoAr,
} from '@/core/groups/resolvers';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';

export interface TraineeGroupsCarouselProps {
  groups: TraineeGroupItemDTO[];
  title?: string;
}

export const TraineeGroupsCarousel: React.FC<TraineeGroupsCarouselProps> = ({
  groups,
  title = 'المجموعات والبرامج المخصصة لك',
}) => {
  // Deterministic ordering: Active (nearest deadline) -> Scheduled (nearest start) -> Expired (latest expired first)
  const sortedGroups = useMemo(() => sortTraineeGroupsForCarousel(groups), [groups]);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });

  // Track window resizing to adapt visible items count
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const visibleCardsCount = isDesktop ? 2 : 1;
  const maxIndex = Math.max(0, sortedGroups.length - visibleCardsCount);

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
  const isNextDisabled = currentIndex >= maxIndex || sortedGroups.length <= visibleCardsCount;

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(maxIndex, prev + 1));
  }, [maxIndex]);

  // Keyboard navigation for carousel accessibility
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
    sortedGroups.length === 0
      ? '0 من 0'
      : sortedGroups.length === 1
      ? 'المجموعة 1 من 1'
      : isDesktop
      ? `المجموعات ${currentIndex + 1} - ${Math.min(currentIndex + visibleCardsCount, sortedGroups.length)} من ${sortedGroups.length}`
      : `المجموعة ${currentIndex + 1} من ${sortedGroups.length}`;

  // Shift calculation for RTL sliding track:
  // In RTL, sliding with positive X brings hidden items on the left into view.
  const transformStyle = isDesktop
    ? `translateX(calc(${currentIndex} * (50% + 0.5rem)))`
    : `translateX(calc(${currentIndex} * (100% + 1rem)))`;

  return (
    <div
      className="space-y-4"
      data-testid="trainee-groups-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="شريط استعراض المجموعات التدريبية والبرامج التذكيرية"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Header with Title & Navigation Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-base sm:text-lg font-bold text-text-heading flex items-center gap-2">
          <Icon name="trainingGroups" size="sm" className="text-primary" />
          <span>{title}</span>
          <span className="text-xs text-text-muted font-bold bg-surface px-2 py-0.5 rounded-full border border-border">
            {sortedGroups.length}
          </span>
        </h2>

        {sortedGroups.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Slide Index Counter */}
            <span
              className="text-xs text-text-muted font-medium px-2.5 py-1 rounded-lg bg-surface border border-border select-none"
              data-testid="carousel-indicator"
              aria-live="polite"
            >
              {positionLabel}
            </span>

            {/* Navigational Arrows Controls (RTL-aware) */}
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
      {sortedGroups.length === 0 && (
        <Card
          variant="default"
          className="text-center py-8 px-4 border-dashed text-text-muted text-sm"
          data-testid="carousel-empty-state"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
            <Icon name="trainingGroups" size="md" />
          </div>
          <p className="font-semibold text-text-heading">لا توجد مجموعات أو برامج مخصصة لك حالياً</p>
          <p className="text-xs text-text-muted mt-1">
            سيتم إدراج مجموعاتك التدريبية والبرامج التذكيرية فور تكليفك من إدارة التدريب.
          </p>
        </Card>
      )}

      {/* Navigable Sliding Viewport */}
      {sortedGroups.length > 0 && (
        <div className="overflow-hidden rounded-xl">
          <div
            className="flex gap-4 transition-transform duration-300 ease-in-out"
            style={{ transform: transformStyle }}
            data-testid="carousel-track"
          >
            {sortedGroups.map((grp, index) => {
              const statusConfig = {
                active: {
                  variant: 'primary' as const,
                  label: 'نشطة — قيد التدريب',
                  icon: 'activity' as const,
                  iconColor: 'text-primary',
                },
                scheduled: {
                  variant: 'warning' as const,
                  label: 'مجدولة',
                  icon: 'calendar' as const,
                  iconColor: 'text-warning-dark',
                },
                expired: {
                  variant: 'danger' as const,
                  label: 'منتهية الصلاحية',
                  icon: 'clock' as const,
                  iconColor: 'text-danger-dark',
                },
              }[grp.operationalStatus] || {
                variant: 'neutral' as const,
                label: grp.operationalStatus,
                icon: 'clock' as const,
                iconColor: 'text-text-muted',
              };

              const timeText = formatGroupTimeInfoAr(grp.timeInfo);

              return (
                <div
                  key={grp.id}
                  className="w-full sm:w-[calc(50%-0.5rem)] shrink-0"
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`مجموعة ${grp.name} (${index + 1} من ${sortedGroups.length})`}
                  data-testid={`carousel-card-${grp.id}`}
                >
                  <Link
                    to={grp.navigationUrl || `/my-groups/${encodeURIComponent(grp.id)}`}
                    className="block h-full group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl"
                    aria-label={`عرض تفاصيل مجموعة ${grp.name} (${grp.id})`}
                    data-testid={`carousel-card-link-${grp.id}`}
                  >
                    <Card
                      variant="default"
                      className="p-4 sm:p-5 h-full flex flex-col justify-between bg-surface border border-border shadow-sm hover:border-primary/60 hover:shadow-md transition-all cursor-pointer rounded-xl group-hover:border-primary/60"
                    >
                      <div className="space-y-3">
                        {/* Badges & Code Row */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {/* Operational Status Badge */}
                            <Badge
                              variant={statusConfig.variant}
                              size="sm"
                              icon={statusConfig.icon}
                              className="text-[11px] font-bold"
                              data-testid={`carousel-status-badge-${grp.id}`}
                            >
                              <span>{statusConfig.label}</span>
                            </Badge>

                            {/* Group-Level Reminder Badge (D-GRP-03, D-GRP-05, D-GRP-06) */}
                            {grp.groupType === 'reminder' && (
                              <Badge
                                variant="warning"
                                size="sm"
                                icon="refresh"
                                className="text-[11px] font-bold"
                                data-testid={`carousel-reminder-badge-${grp.id}`}
                              >
                                <span>تذكيري</span>
                              </Badge>
                            )}
                          </div>

                          {/* Enrollment / Group Code */}
                          <Badge
                            variant="neutral"
                            size="sm"
                            className="font-mono text-xs bg-bg border-border"
                            data-testid={`carousel-code-badge-${grp.id}`}
                          >
                            {grp.enrollmentCode || grp.id}
                          </Badge>
                        </div>

                        {/* Group Name Prominent */}
                        <h3 className="text-base sm:text-lg font-bold text-text-heading line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                          {grp.name}
                        </h3>

                        {/* Remaining Time Presentation */}
                        <div className="flex items-center gap-1.5 text-xs text-text-muted">
                          <Icon name={statusConfig.icon} size="sm" className={`${statusConfig.iconColor} shrink-0`} />
                          <span className="font-medium text-text-muted line-clamp-1">{timeText}</span>
                        </div>

                        {/* Compact Courses Identifiers (D-GRP-08) */}
                        {grp.courses && grp.courses.length > 0 && (
                          <div className="pt-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-text-muted font-medium">
                              المقررات:
                            </span>
                            {grp.courses.map((c) => {
                              const isReminderCourse = c.courseRole === 'reminder';
                              return (
                                <span
                                  key={c.courseId}
                                  className={`inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded border shadow-2xs ${
                                    isReminderCourse
                                      ? 'bg-warning-light text-warning-dark border-warning-dark/20 font-bold'
                                      : 'bg-bg text-text-heading border-border font-medium'
                                  }`}
                                  title={`${c.courseTitle} (${isReminderCourse ? 'مقرر تذكيري' : 'دورة أساسية'})`}
                                  data-testid={`carousel-course-pill-${grp.id}-${c.courseId}`}
                                >
                                  {c.courseCode || c.courseId}
                                  {isReminderCourse && (
                                    <span className="ms-1 w-1.5 h-1.5 rounded-full bg-warning-dark shrink-0" />
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Interactive Footer Affordance */}
                      <div className="pt-3 mt-3 border-t border-border/70 flex items-center justify-between text-xs">
                        <span className="text-text-muted font-medium text-[11px] flex items-center gap-1.5">
                          <Icon name="users" size="sm" className="text-primary" />
                          <span>{grp.traineeCount} متدرب</span>
                        </span>
                        <span className="text-primary font-bold flex items-center gap-1 group-hover:translate-x-[-3px] transition-transform">
                          <span>عرض التفاصيل</span>
                          <Icon name="arrowLeft" size="sm" />
                        </span>
                      </div>
                    </Card>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TraineeGroupsCarousel;

