import React from 'react';
import type { UserTranscriptMetrics } from '@/core/user-management/types';
import { Icon } from '@/shared/ui/Icon';

export interface UserTranscriptCardProps {
  metrics: UserTranscriptMetrics;
}

export const UserTranscriptCard: React.FC<UserTranscriptCardProps> = ({ metrics }) => {
  return (
    <div
      data-testid="transcript-metrics"
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-bold text-text-heading flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Icon name="award" size="md" />
          </span>
          ملخص المؤشرات التعليمية والسجل العام
        </h2>
        <span className="text-xs text-text-muted">
          إجمالي المحاولات: <strong className="text-text">{metrics.totalAttemptsCount}</strong> | مكتملة: <strong className="text-success">{metrics.completedAttemptsCount}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Learning Hours */}
        <div
          data-testid="metric-learning-hours"
          className="bg-surface border border-border rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-text-muted">إجمالي ساعات التعلم</span>
            <div className="w-9 h-9 rounded-lg bg-info/10 text-info flex items-center justify-center">
              <Icon name="clock" size="md" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-text-heading tracking-tight">
              {metrics.totalLearningHours !== null ? (
                <>
                  {metrics.totalLearningHours}{' '}
                  <span className="text-xs sm:text-sm font-semibold text-text-muted">ساعة</span>
                </>
              ) : (
                <span
                  data-testid="learning-hours-unavailable"
                  className="text-lg sm:text-xl font-bold text-text-muted"
                >
                  — (غير مسجل)
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-muted mt-1 leading-normal">
              {metrics.totalLearningHours !== null
                ? 'الوقت الفعلي الموثق داخل مشغل المحتوى'
                : 'غير متاح — لا تسجل المنظومة الحالية إجمالي وقت التعلم التراكمي عبر الجلسات'}
            </p>
          </div>
        </div>

        {/* Metric 2: Average Completion Rate */}
        <div
          data-testid="metric-completion-rate"
          className="bg-surface border border-border rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-text-muted">متوسط نسبة الإتمام</span>
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="checkCircle" size="md" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-text-heading tracking-tight">
              {metrics.averageCompletionRate}%
            </div>
            <div className="w-full bg-bg-alt h-1.5 rounded-full overflow-hidden mt-2 border border-border/40">
              <div
                className="bg-primary h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, metrics.averageCompletionRate))}%` }}
              />
            </div>
            <p className="text-[11px] text-text-muted mt-1.5 leading-normal">
              متوسط التقدم عبر المقررات المسجلة
            </p>
          </div>
        </div>

        {/* Metric 3: Distinct Enrolled Courses */}
        <div
          data-testid="metric-enrolled-courses"
          className="bg-surface border border-border rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-text-muted">الدورات المسجلة</span>
            <div className="w-9 h-9 rounded-lg bg-neutral-light text-text-muted flex items-center justify-center">
              <Icon name="bookOpen" size="md" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-text-heading tracking-tight">
              {metrics.enrolledCoursesCount}{' '}
              <span className="text-xs sm:text-sm font-semibold text-text-muted">مقرر</span>
            </div>
            <p className="text-[11px] text-text-muted mt-1 leading-normal">
              المقررات المسجلة فردياً أو عبر المجموعات
            </p>
          </div>
        </div>

        {/* Metric 4: Distinct Completed Courses */}
        <div
          data-testid="metric-completed-courses"
          className="bg-surface border border-border rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-text-muted">الدورات المكتملة</span>
            <div className="w-9 h-9 rounded-lg bg-success/10 text-success flex items-center justify-center">
              <Icon name="check" size="md" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-success tracking-tight">
              {metrics.completedCoursesCount}{' '}
              <span className="text-xs sm:text-sm font-semibold text-text-muted">مقرر</span>
            </div>
            <p className="text-[11px] text-text-muted mt-1 leading-normal">
              مقررات أتم المتدرب جميع دروسها بنجاح
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
