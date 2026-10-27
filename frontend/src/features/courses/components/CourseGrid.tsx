import React from 'react';
import { CourseCard } from './CourseCard';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { sanitizeErrorMessage } from '@/core/api/apiClient';
import type { Course } from '@/core/courses/types';
import '../styles/courses.css';

export interface CourseGridProps {
  courses: Course[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
}

export const CourseGrid: React.FC<CourseGridProps> = ({
  courses,
  isLoading = false,
  error = null,
  onRetry,
  onResetFilters,
}) => {
  // Loading Skeleton State
  if (isLoading) {
    return (
      <div
        className="courses-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5.5"
        aria-busy="true"
        aria-label="جارِ تحميل الكورسات"
        data-testid="courses-loading-grid"
      >
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="border border-border rounded-2xl p-4 bg-surface/50 animate-pulse space-y-4 min-h-[340px]"
          >
            <div className="h-40 bg-neutral-light rounded-xl w-full" />
            <div className="h-5 bg-neutral-light rounded-sm w-3/4" />
            <div className="h-4 bg-neutral-light rounded-sm w-1/2" />
            <div className="flex gap-3 pt-2">
              <div className="h-3 bg-neutral-light rounded-sm w-16" />
              <div className="h-3 bg-neutral-light rounded-sm w-16" />
              <div className="h-3 bg-neutral-light rounded-sm w-16" />
            </div>
            <div className="h-10 bg-neutral-light rounded-lg w-full mt-4" />
          </div>
        ))}
      </div>
    );
  }

  // Error State
  if (error) {
    const userFriendlyError = sanitizeErrorMessage(
      error,
      'تعذر تحميل الدورات التدريبية حاليًا. يرجى المحاولة مرة أخرى.'
    );

    return (
      <div
        className="courses-empty text-center py-12"
        role="alert"
        aria-label="خطأ في تحميل الكورسات"
        data-testid="courses-error-state"
      >
        <div className="w-12 h-12 rounded-full bg-danger-light text-danger-dark flex items-center justify-center mx-auto mb-3">
          <Icon name="alertCircle" size="lg" />
        </div>
        <h3 className="text-lg font-bold text-text-heading mb-1">
          تعذر تحميل الدورات التدريبية
        </h3>
        <p className="text-sm text-text-muted mb-4 max-w-md mx-auto">
          {userFriendlyError}
        </p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            leftIcon="refresh"
          >
            إعادة المحاولة
          </Button>
        )}
      </div>
    );
  }

  // Empty Results State
  if (courses.length === 0) {
    return (
      <div
        className="courses-empty text-center py-12"
        role="region"
        aria-label="نتائج البحث فارغة"
        data-testid="courses-empty-state"
      >
        <div className="flex justify-center mb-3 text-text-muted/60">
          <Icon name="courses" size="lg" />
        </div>
        <h3 className="text-lg font-bold text-primary-dark mb-1">
          لا توجد نتائج مطابقة لبحثك
        </h3>
        <p className="text-sm text-text-muted mb-4 max-w-md mx-auto">
          لم نتمكن من العثور على أي دورات تدريبية تطابق الكلمات المكتوبة أو الفلاتر المحددة.
        </p>
        {onResetFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onResetFilters}
            leftIcon="refresh"
          >
            إعادة ضبط معايير البحث
          </Button>
        )}
      </div>
    );
  }

  // Loaded Grid
  return (
    <div
      className="courses-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5.5"
      data-testid="courses-grid"
    >
      {courses.map((course, idx) => (
        <CourseCard key={course.id} course={course} index={idx} />
      ))}
    </div>
  );
};

export default CourseGrid;
