import React, { useState, useEffect } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import type { TraineeGroupMetrics, TraineeCourseAttemptStats, TraineeCourseProgressInGroup } from '@/core/groups/types';
import { groupsApi } from '@/features/groups/services/groupsApi';
import { formatAttemptBadge } from '@/core/domain/groups';
import { formatMaterialDate } from '../utils/materialUtils';
import { AttentionBadge } from './AttentionBadge';

export interface TraineeProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainee: TraineeGroupMetrics | null;
  cycleId: string;
  cycleLabel?: string;
  isHistorical?: boolean;
}

interface CourseAttemptRowProps {
  traineeUserId: string;
  courseId: string;
  cycleId: string;
}

const CourseAttemptWidget: React.FC<CourseAttemptRowProps> = ({
  traineeUserId,
  courseId,
  cycleId,
}) => {
  const [stats, setStats] = useState<TraineeCourseAttemptStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    groupsApi
      .getTraineeCourseAttempts(traineeUserId, courseId, cycleId)
      .then((res) => {
        if (active) {
          setStats(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err?.message || 'تعذر تحميل سجل المحاولات');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [traineeUserId, courseId, cycleId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-text-muted">
        <Icon name="clock" size="sm" className="animate-spin text-primary shrink-0" />
        <span>جاري تحميل سجل المحاولات...</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-xs text-danger py-1" data-testid={`attempt-error-${courseId}`}>
        {error || 'لا تتوفر بيانات المحاولات'}
      </div>
    );
  }

  const badgeInfo = formatAttemptBadge(stats);

  return (
    <div
      className="mt-3 bg-neutral-light/50 border border-border/80 rounded-lg p-3 text-xs space-y-2.5"
      data-testid={`course-attempt-section-${courseId}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold text-primary bg-primary/10 border border-primary/20"
            data-testid={`attempt-badge-${courseId}`}
          >
            <Icon name="award" size="sm" />
            <span>{badgeInfo.title}</span>
          </span>
          {stats.hasStartedCurrentAttempt ? (
            <Badge variant="primary" size="sm">
              محاولة سارية
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm">
              لم تبدأ في هذه الدورة
            </Badge>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-primary hover:text-primary-dark font-medium inline-flex items-center gap-1 transition-colors"
          data-testid={`toggle-history-btn-${courseId}`}
        >
          <span>{isExpanded ? 'إخفاء الأرشيف' : 'سجل المحاولات السابقة'}</span>
          <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} size="sm" />
        </button>
      </div>

      {badgeInfo.detailsText && (
        <p className="text-text-muted text-[11px]">{badgeInfo.detailsText}</p>
      )}

      {/* Historical Attempts Accordion / Timeline */}
      {isExpanded && (
        <div
          className="pt-2 border-t border-border/60 space-y-2"
          data-testid={`attempt-history-list-${courseId}`}
        >
          <div className="text-[11px] font-semibold text-text-heading flex items-center justify-between">
            <span>جميع محاولات المتدرب المسجلة لهذا المقرر:</span>
            <span className="text-text-muted">
              إجمالي المحاولات السابقة: {stats.previousStartedAttemptsCount}
            </span>
          </div>

          {stats.historicalAttempts.length === 0 ? (
            <p className="text-[11px] text-text-muted italic py-1">
              لا توجد محاولات سابقة مسجلة لهذا المتدرب في دورات أخرى.
            </p>
          ) : (
            <div className="space-y-1.5">
              {stats.historicalAttempts.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between bg-surface p-2 rounded border border-border/40 text-[11px]"
                  data-testid={`history-attempt-row-${att.attemptNumber}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-heading">
                      المحاولة #{att.attemptNumber}
                    </span>
                    <span className="text-text-muted">({att.cycleId})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>
                      {att.completedAt ? (
                        <span className="text-success font-semibold">مكتملة</span>
                      ) : (
                        <span className="text-warning-dark font-medium">غير مكتملة</span>
                      )}
                    </span>
                    <span className="text-text-muted">
                      {att.startedAt ? formatMaterialDate(att.startedAt) : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const TraineeProgressModal: React.FC<TraineeProgressModalProps> = ({
  isOpen,
  onClose,
  trainee,
  cycleId,
  cycleLabel,
  isHistorical = false,
}) => {
  if (!trainee) return null;

  const coursesList: TraineeCourseProgressInGroup[] = Object.values(trainee.courseProgressMap || {});

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`تقرير تقدم المتدرب: ${trainee.userName}`}
      size="xl"
      data-testid="trainee-progress-modal"
    >
      <div className="space-y-6 text-right" dir="rtl">
        {/* Historical Context Notice */}
        {isHistorical && (
          <Alert variant="warning" icon="clock">
            أنت تستعرض سجل المتدرب في دورة تجديد تاريخية سابقة ({cycleLabel || cycleId}). البيانات
            محفوظة كأرشيف للإنجاز.
          </Alert>
        )}

        {/* Trainee Profile Card */}
        <div className="bg-surface p-4 rounded-xl border border-border shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg border border-primary/20 shrink-0">
                {trainee.userName.slice(0, 1)}
              </div>
              <div>
                <h3 className="text-base font-bold text-text-heading">{trainee.userName}</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted mt-1">
                  <span>{trainee.email}</span>
                  {trainee.department && (
                    <>
                      <span>•</span>
                      <span>{trainee.department}</span>
                    </>
                  )}
                  {trainee.jobTitle && (
                    <>
                      <span>•</span>
                      <span>{trainee.jobTitle}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <AttentionBadge
                attention={trainee.worstAttention}
                isCompleted={trainee.isAllCoreCompleted}
                testId="modal-trainee-attention-badge"
              />
              {trainee.isAllCoreCompleted ? (
                <Badge variant="success" size="sm" data-testid="modal-core-status-badge">
                  أكمل جميع المقررات الأساسية
                </Badge>
              ) : (
                <Badge variant="warning" size="sm" data-testid="modal-core-status-badge">
                  أكمل {trainee.completedCoreCoursesCount ?? 0} من {trainee.totalCoreCoursesCount ?? 0} مقرر أساسي
                </Badge>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border/70 text-center">
            <div className="p-2.5 rounded-lg bg-neutral-light/50 border border-border/40">
              <span className="text-[11px] text-text-muted block">نسبة الإنجاز الكلية</span>
              <span
                className="text-lg font-bold text-primary"
                data-testid="modal-overall-progress-text"
              >
                {trainee.programPercent}%
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-neutral-light/50 border border-border/40">
              <span className="text-[11px] text-text-muted block">المقررات الأساسية</span>
              <span className="text-lg font-bold text-text-heading">
                {trainee.completedCoreCoursesCount ?? 0} / {trainee.totalCoreCoursesCount ?? 0}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-neutral-light/50 border border-border/40">
              <span className="text-[11px] text-text-muted block">المقررات التي بدأت</span>
              <span className="text-lg font-bold text-text-heading">
                {trainee.startedCoursesCount ?? 0} / {trainee.totalAssignedCourses}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-neutral-light/50 border border-border/40">
              <span className="text-[11px] text-text-muted block">تاريخ الانضمام</span>
              <span className="text-xs font-semibold text-text-heading mt-1 block">
                {trainee.joinedAt ? formatMaterialDate(trainee.joinedAt) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Courses Detailed Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-text-heading">
              المقررات المخصصة في هذه الدورة ({coursesList.length})
            </h4>
            <span className="text-xs text-text-muted">
              الدورة: {cycleLabel || cycleId}
            </span>
          </div>

          {coursesList.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-sm bg-surface rounded-xl border border-dashed border-border">
              لم يتم تخصيص أية مقررات تدريبية في هذه الدورة.
            </div>
          ) : (
            <div className="space-y-3" data-testid="modal-courses-list">
              {coursesList.map((c) => {
                const isCore = c.courseRole === 'core';
                const isCompleted = c.percent === 100 || c.isCompleted;

                return (
                  <div
                    key={c.courseId}
                    className="p-4 bg-surface rounded-xl border border-border shadow-xs space-y-3"
                    data-testid={`trainee-course-card-${c.courseId}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-text-heading">
                          {c.courseTitle}
                        </span>
                        {isCore ? (
                          <Badge variant="primary" size="sm">
                            مقرر أساسي
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">
                            مقرر تذكيري
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isCompleted ? (
                          <Badge variant="success" size="sm">
                            مكتمل بنجاح
                          </Badge>
                        ) : c.started ? (
                          <Badge variant="primary" size="sm">
                            قيد الدراسة
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">
                            لم يبدأ بعد
                          </Badge>
                        )}
                        <span className="text-xs font-bold text-primary">
                          {c.percent}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar & Lessons Info */}
                    <div className="space-y-1.5">
                      <div className="w-full bg-neutral-light rounded-full h-2 overflow-hidden border border-border/40">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            isCompleted ? 'bg-success' : 'bg-primary'
                          }`}
                          style={{ width: `${c.percent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-text-muted">
                        <span>
                          الدروس المنجزة: {c.completedLessons} من {c.totalLessons} درس
                        </span>
                        <span>
                          آخر نشاط: {c.lastActivityAt ? formatMaterialDate(c.lastActivityAt) : 'لا يوجد'}
                        </span>
                      </div>
                    </div>

                    {/* Course Attempt Widget */}
                    <CourseAttemptWidget
                      traineeUserId={trainee.userId}
                      courseId={c.courseId}
                      cycleId={cycleId}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end pt-3 border-t border-border">
          <Button variant="outline" onClick={onClose} data-testid="close-trainee-progress-modal-btn">
            إغلاق
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default TraineeProgressModal;
