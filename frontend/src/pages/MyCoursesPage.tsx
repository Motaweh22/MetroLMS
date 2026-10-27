import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { coursesApi } from '@/features/courses/services/coursesApi';
import type { EnrolledCourseDetail } from '@/core/courses/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { Alert } from '@/shared/ui/Alert';

const THUMB_GRADIENTS = [
  'linear-gradient(135deg, #1A3F6F 0%, #5BBFDE 100%)',
  'linear-gradient(135deg, #0369A1 0%, #38BDF8 100%)',
  'linear-gradient(135deg, #1E3A8A 0%, #60A5FA 100%)',
  'linear-gradient(135deg, #0F766E 0%, #2DD4BF 100%)',
];

export const MyCoursesPage: React.FC = () => {
  const [courses, setCourses] = useState<EnrolledCourseDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'in_progress' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadEnrolledCourses = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await coursesApi.getMyEnrolledCourses();
      setCourses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل قائمة الدورات المسجلة');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEnrolledCourses();
  }, [loadEnrolledCourses]);

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      // Tab filtering
      const isCourseCompleted = Boolean(c.progress?.isCompleted);
      if (filterTab === 'in_progress' && isCourseCompleted) return false;
      if (filterTab === 'completed' && !isCourseCompleted) return false;

      // Search query filtering
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesLecturer = c.lecturerName.toLowerCase().includes(q);
        if (!matchesTitle && !matchesLecturer) return false;
      }

      return true;
    });
  }, [courses, filterTab, searchQuery]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto" data-testid="my-courses-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-heading flex items-center gap-3">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Icon name="myCourses" size="lg" />
            </span>
            <span>دوراتي ومسار التعلم</span>
          </h1>
          <p className="text-sm text-text-muted mt-1">
            متابعة إنجازك في البرامج التدريبية المعتمدة واستكمال المحاضرات التعليمية.
          </p>
        </div>

        <Link to="/courses">
          <Button variant="outline" size="sm" leftIcon="courses">
            استعراض دليل الكورسات
          </Button>
        </Link>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" title="خطأ في تحميل البيانات">
          <div className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={loadEnrolledCourses}>
              إعادة المحاولة
            </Button>
          </div>
        </Alert>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-3 sm:p-4 rounded-xl border border-border">
        {/* Filter Pills */}
        <div className="flex items-center gap-2" role="tablist" aria-label="تصفية الدورات">
          <button
            type="button"
            role="tab"
            data-testid="filter-tab-all"
            aria-selected={filterTab === 'all'}
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
              filterTab === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-neutral-light'
            }`}
          >
            الكل ({courses.length})
          </button>
          <button
            type="button"
            role="tab"
            data-testid="filter-tab-in-progress"
            aria-selected={filterTab === 'in_progress'}
            onClick={() => setFilterTab('in_progress')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
              filterTab === 'in_progress'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-neutral-light'
            }`}
          >
            قيد التدريب ({courses.filter((c) => !c.progress?.isCompleted).length})
          </button>
          <button
            type="button"
            role="tab"
            data-testid="filter-tab-completed"
            aria-selected={filterTab === 'completed'}
            onClick={() => setFilterTab('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
              filterTab === 'completed'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-neutral-light'
            }`}
          >
            مكتملة ({courses.filter((c) => Boolean(c.progress?.isCompleted)).length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في دوراتي..."
            aria-label="بحث في دوراتي"
            className="w-full px-3 py-1.5 ps-9 text-xs sm:text-sm bg-neutral-light border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-text placeholder:text-text-muted"
          />
          <span className="absolute start-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
            <Icon name="search" size="sm" />
          </span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
              aria-label="مسح البحث"
            >
              <Icon name="close" size="sm" />
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true">
          {[1, 2, 3].map((n) => (
            <Card key={n} variant="elevated" className="animate-pulse">
              <div className="h-40 bg-neutral-light rounded-t-xl" />
              <CardContent className="p-4 space-y-3">
                <div className="h-5 bg-neutral-light rounded-sm w-3/4" />
                <div className="h-4 bg-neutral-light rounded-sm w-1/2" />
                <div className="h-3 bg-neutral-light rounded-sm w-full mt-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State: Zero Enrolled Courses */}
      {!isLoading && !error && courses.length === 0 && (
        <Card variant="default" className="text-center py-12 px-4 sm:px-8 border-dashed">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
              <Icon name="courses" size="xl" />
            </div>
            <h2 className="text-xl font-bold text-text-heading">لا توجد دورات تدريبية مسجلة حالياً</h2>
            <p className="text-sm text-text-muted leading-relaxed">
              لم تقم بالتسجيل في أي دورة تدريبية بعد. استكشف برامج ودورات مترو القاهرة المتاحة وابدأ مسارك المهني الآن.
            </p>
            <div className="pt-2">
              <Link to="/courses">
                <Button variant="primary" size="md" leftIcon="search" className="font-bold">
                  تصفح دليل الدورات المتاحة
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Empty State: Filter Returned Zero */}
      {!isLoading && !error && courses.length > 0 && filteredCourses.length === 0 && (
        <Card variant="default" className="text-center py-10 px-4">
          <p className="text-text-muted text-sm">لا توجد دورات تطابق معايير البحث أو التصفية الحالية.</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterTab('all');
              setSearchQuery('');
            }}
            className="mt-2 text-primary font-bold"
          >
            إعادة تعيين الفلاتر
          </Button>
        </Card>
      )}

      {/* Enrolled Courses Grid */}
      {!isLoading && !error && filteredCourses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course, idx) => {
            const isCompleted = course.progress.isCompleted;
            const progressPercent = course.progress.overallProgressPercentage;
            const grad = THUMB_GRADIENTS[idx % THUMB_GRADIENTS.length];
            const initial = course.title ? course.title.trim()[0] : 'ك';

            // Destination link: specific resume item or course learn root
            const learnLink = course.lastWatchedItemId
              ? `/courses/${course.id}/learn/${course.lastWatchedItemId}`
              : `/courses/${course.id}/learn`;

            return (
              <Card
                key={course.id}
                variant="elevated"
                className="flex flex-col justify-between overflow-hidden border-border hover:shadow-md transition-shadow group"
              >
                <div>
                  {/* Thumbnail Banner */}
                  <div
                    className="h-36 w-full flex items-center justify-center relative text-white text-4xl font-extrabold select-none shadow-inner"
                    style={{ background: grad }}
                  >
                    <span>{initial}</span>

                    {/* Level Pill */}
                    <div className="absolute top-3 end-3">
                      <Badge variant="neutral" className="bg-white/90 text-text-heading backdrop-blur-xs text-xs font-bold shadow-xs">
                        {course.level}
                      </Badge>
                    </div>

                    {/* Completion / Expired Ribbon */}
                    <div className="absolute bottom-3 start-3 flex gap-1.5">
                      {isCompleted ? (
                        <Badge variant="primary" className="bg-emerald-600 text-white font-bold text-xs shadow-xs">
                          مكتمل ✓
                        </Badge>
                      ) : (
                        <Badge variant="info" className="text-xs font-semibold">
                          قيد التدريب
                        </Badge>
                      )}

                      {course.isExpired && (
                        <Badge variant="danger" className="text-[10px] font-bold">
                          منتهية الصلاحية
                        </Badge>
                      )}
                    </div>
                  </div>

                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base sm:text-lg font-bold text-text-heading line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                      {course.title}
                    </CardTitle>
                    <p className="text-xs text-text-muted mt-1 flex items-center gap-1.5">
                      <Icon name="user" size="sm" />
                      <span>{course.lecturerName}</span>
                    </p>
                  </CardHeader>

                  <CardContent className="px-4 py-2 space-y-3">
                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-text-muted">
                        <span className="font-medium">نسبة الإنجاز</span>
                        <span className="font-bold text-text-heading">{progressPercent}%</span>
                      </div>
                      <ProgressBar
                        value={progressPercent}
                        variant={isCompleted ? 'success' : 'primary'}
                        size="sm"
                      />
                    </div>

                    {/* Expired Policy Disclaimer */}
                    {course.policyLabel && (
                      <p className="text-[11px] text-danger-dark font-medium bg-danger-light/50 px-2.5 py-1 rounded-md">
                        {course.policyLabel}
                      </p>
                    )}
                  </CardContent>
                </div>

                {/* Card Action Footer */}
                <div className="p-4 pt-2 border-t border-border flex items-center justify-between gap-2 bg-neutral-light/30">
                  <Link to={`/courses/${course.id}`} className="text-xs text-text-muted hover:text-text font-medium underline">
                    التفاصيل
                  </Link>

                  <Link to={learnLink}>
                    <Button
                      variant={isCompleted ? 'secondary' : 'primary'}
                      size="sm"
                      rightIcon={isCompleted ? undefined : 'arrowLeft'}
                      className="font-bold text-xs"
                    >
                      {isCompleted ? 'مراجعة المحتوى' : 'متابعة التعلم'}
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyCoursesPage;
