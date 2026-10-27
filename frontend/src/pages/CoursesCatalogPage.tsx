import React, { useState } from 'react';
import { useCourses } from '@/features/courses/hooks/useCourses';
import { CourseFilterBar } from '@/features/courses/components/CourseFilterBar';
import { CourseGrid } from '@/features/courses/components/CourseGrid';
import type { CourseLevel } from '@/core/courses/types';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import '@/features/courses/styles/courses.css';

export const CoursesCatalogPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<CourseLevel | 'all'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'rating' | 'enrollment'>('newest');

  const { courses, totalCount, isLoading, error, refetch } = useCourses({
    search: searchQuery,
    level: levelFilter,
    sortBy,
  });

  const handleResetFilters = () => {
    setSearchQuery('');
    setLevelFilter('all');
    setSortBy('newest');
  };

  const hasActiveFilters = Boolean(searchQuery.trim() !== '' || levelFilter !== 'all');

  return (
    <div className="min-h-full py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Catalog Page Header */}
      <div className="bg-surface rounded-xl border border-border p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-2 h-full bg-primary-dark" aria-hidden="true" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge variant="primary" className="text-xs font-semibold px-2.5 py-0.5">
                دليل البرامج التدريبية
              </Badge>
              <span className="text-xs text-text-muted flex items-center gap-1">
                <Icon name="checkCircle" size="sm" className="text-success" />
                استعراض وقراءة فقط
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-heading tracking-tight">
              دليل الدورات التدريبية المعتمدة
            </h1>
            <p className="text-sm text-text-muted max-w-2xl leading-relaxed">
              استكشف كافة البرامج التدريبية والحقائب الفنية التخصصية المعتمدة لقطاعات التشغيل والصيانة والأمن وخدمة الركاب بالشركة المصرية لإدارة وتشغيل المترو.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center shrink-0">
            <div className="px-4 py-2.5 bg-neutral-light/70 rounded-lg border border-border/60 text-center">
              <span className="block text-xs text-text-muted font-medium">إجمالي الدورات</span>
              <span className="text-lg font-bold text-primary-dark">{totalCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <CourseFilterBar
        search={searchQuery}
        onSearchChange={setSearchQuery}
        selectedLevel={levelFilter}
        onLevelChange={setLevelFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        totalCount={totalCount}
        filteredCount={courses.length}
        onResetFilters={handleResetFilters}
      />

      {/* Courses Grid Container */}
      <CourseGrid
        courses={courses}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
      />
    </div>
  );
};

export default CoursesCatalogPage;
