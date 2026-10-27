import React, { useState } from 'react';
import type { UserTranscriptCourseItem } from '@/core/user-management/types';
import { Badge, type BadgeVariant } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';

export interface UserCoursesHistoryListProps {
  courses: UserTranscriptCourseItem[];
}

function getCourseStatusBadge(status: UserTranscriptCourseItem['status']): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case 'completed':
      return { label: 'مكتمل بنجاح', variant: 'success' };
    case 'in_progress':
      return { label: 'قيد الدراسة', variant: 'primary' };
    case 'not_started':
    default:
      return { label: 'مسجل — لم يبدأ بعد', variant: 'neutral' };
  }
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export const UserCoursesHistoryList: React.FC<UserCoursesHistoryListProps> = ({ courses }) => {
  const [expandedCourseIds, setExpandedCourseIds] = useState<Set<string>>(new Set());

  const toggleExpand = (courseId: string) => {
    setExpandedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

  if (courses.length === 0) {
    return (
      <div
        data-testid="empty-transcript-courses"
        className="bg-surface border border-dashed border-border rounded-2xl p-10 sm:p-14 text-center space-y-3"
      >
        <div className="w-14 h-14 rounded-2xl bg-neutral-light text-text-muted mx-auto flex items-center justify-center">
          <Icon name="bookOpen" size="xl" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-text-heading">
            لا يوجد سجل تدريبي مسجل لهذا المستخدم
          </h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            لم يتم تسجيل المستخدم في أي دورة تدريبية حتى الآن، أو أن الحساب مخصص للأدوار الإدارية فقط دون التحاق أكاديمي.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="courses-history-list" className="space-y-4">
      <div className="flex items-center justify-between pb-1">
        <h2 className="text-base sm:text-lg font-bold text-text-heading flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Icon name="bookOpen" size="md" />
          </span>
          سجل المقررات التدريبية والمحاولات ({courses.length})
        </h2>
        <span className="text-xs text-text-muted">
          مرتب حسب تاريخ التسجيل (الأحدث أولاً)
        </span>
      </div>

      <div className="space-y-3">
        {courses.map((course) => {
          const statusInfo = getCourseStatusBadge(course.status);
          const isExpanded = expandedCourseIds.has(course.courseId);
          const hasMultipleAttempts = course.attempts && course.attempts.length > 1;

          return (
            <div
              key={course.courseId}
              data-testid={`transcript-course-${course.courseId}`}
              className="bg-surface border border-border rounded-xl p-4 sm:p-5 shadow-sm space-y-4 hover:border-primary/30 transition-colors"
            >
              {/* Header: Title, CourseId, Status Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-text-heading">
                      {course.title}
                    </h3>
                    <span className="font-mono text-[11px] bg-bg-alt text-text-muted px-2 py-0.5 rounded border border-border">
                      {course.courseId}
                    </span>
                    {course.level && (
                      <span className="text-[11px] bg-neutral-light text-text-muted px-2 py-0.5 rounded">
                        {course.level}
                      </span>
                    )}
                  </div>
                  {course.description && (
                    <p className="text-xs text-text-muted line-clamp-1">
                      {course.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={statusInfo.variant} size="sm" dot>
                    {statusInfo.label}
                  </Badge>
                  {course.attemptsCount > 1 && (
                    <Badge variant="primary" size="sm">
                      {course.attemptsCount} محاولات
                    </Badge>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted font-medium">نسبة التقدم الحالية</span>
                  <span className="font-bold text-text-heading">{course.progressPercent}%</span>
                </div>
                <div className="w-full bg-bg-alt h-2 rounded-full overflow-hidden border border-border/40">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      course.progressPercent === 100
                        ? 'bg-success'
                        : course.progressPercent > 0
                        ? 'bg-primary'
                        : 'bg-transparent'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, course.progressPercent))}%` }}
                  />
                </div>
              </div>

              {/* Course Detail Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-bg-alt/50 p-3 rounded-lg border border-border/60">
                <div>
                  <span className="text-text-muted block text-[11px]">تاريخ التسجيل</span>
                  <span className="font-semibold text-text">{formatDate(course.enrolledAt)}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[11px]">آخر تفاعل تعليمي</span>
                  <span className="font-semibold text-text">{formatDate(course.lastActivityAt)}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[11px]">الدرس الأكثر مشاهدة</span>
                  <span
                    className="font-semibold text-text truncate block"
                    title={course.mostWatchedLessonTitle || '— (غير مسجل)'}
                    data-testid={`most-watched-cell-${course.courseId}`}
                  >
                    {course.mostWatchedLessonTitle ? (
                      course.mostWatchedLessonTitle
                    ) : (
                      <span
                        className="text-text-muted font-normal"
                        data-testid={`most-watched-unavailable-${course.courseId}`}
                      >
                        — (غير مسجل)
                      </span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[11px]">مرات الفتح</span>
                  <span className="font-semibold text-text-muted" title="مؤشر إحصائي غير مسجل في مشغل الدروس الحالي">
                    — (غير مسجل)
                  </span>
                </div>
              </div>

              {/* Expandable Attempts Section */}
              {course.attempts && course.attempts.length > 0 && (
                <div className="pt-1 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(course.courseId)}
                      data-testid={`toggle-attempts-btn-${course.courseId}`}
                      className="text-xs text-primary hover:text-primary-dark p-0 h-auto"
                    >
                      <Icon
                        name={isExpanded ? 'chevronUp' : 'chevronDown'}
                        size="sm"
                        className="ml-1"
                      />
                      {isExpanded
                        ? 'إخفاء تفاصيل المحاولات'
                        : `عرض سجل المحاولات (${course.attempts.length})`}
                    </Button>

                    <span className="text-[11px] text-text-muted">
                      {hasMultipleAttempts ? 'مقرر مكرر عبر دورات تجديد' : 'محاولة فردية'}
                    </span>
                  </div>

                  {isExpanded && (
                    <div
                      data-testid={`attempts-list-${course.courseId}`}
                      className="mt-3 space-y-2 border-r-2 border-primary/40 pr-3 mr-1"
                    >
                      {course.attempts.map((att, idx) => {
                        const attStarted = Boolean(att.startedAt);
                        const attCompleted = att.status === 'completed';

                        return (
                          <div
                            key={att.id || idx}
                            className="bg-bg p-2.5 rounded-lg border border-border/70 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-text-heading">
                                  {att.attemptNumber !== null
                                    ? `المحاولة رقم ${att.attemptNumber}`
                                    : `محاولة محجوزة (${idx + 1})`}
                                </span>
                                <Badge
                                  variant={attCompleted ? 'success' : attStarted ? 'primary' : 'neutral'}
                                  size="sm"
                                >
                                  {attCompleted
                                    ? 'مكتملة'
                                    : attStarted
                                    ? 'قيد الدراسة'
                                    : 'لم تبدأ'}
                                </Badge>
                                {att.cycleId && (
                                  <span className="text-[10px] bg-bg-alt text-text-muted px-1.5 py-0.2 rounded border border-border">
                                    دورة: {att.cycleId}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-text-muted flex gap-3 flex-wrap">
                                <span>بدأت: {formatDate(att.startedAt)}</span>
                                <span>أتمت: {formatDate(att.completedAt)}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="font-bold text-text">{att.progressPercent}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
