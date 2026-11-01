import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { builderApi } from '@/features/course-builder/services/builderApi';
import { CourseCreationModal } from '@/features/course-builder/components/CourseCreationModal';
import type { Course, CourseLevel } from '@/core/courses/types';
import { isAuthorizedForCoursePerformance } from '@/core/courses/courseAuthorization';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { QRCodeModal } from '@/shared/ui/QRCodeModal';

export const LecturerCoursesPage: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [courses, setCourses] = useState<(Course & { hasDraft?: boolean })[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active QR modal course
  const [selectedQrCourse, setSelectedQrCourse] = useState<Course | null>(null);

  // Filter tabs and search keyword
  const [activeTab, setActiveTab] = useState<'all' | 'published' | 'draft' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Course Creation Modal state
  const [isCreationModalOpen, setIsCreationModalOpen] = useState<boolean>(false);
  const [isCreatingCourse, setIsCreatingCourse] = useState<boolean>(false);

  // Check URL query param to open creation modal directly if routed from /lecturer/builder/new
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('new') === 'true') {
      setIsCreationModalOpen(true);
    }
  }, [location.search]);

  // Load lecturer courses
  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await builderApi.getLecturerCourses();
      setCourses(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'فشل في استرجاع المقررات التدريبية';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const isAuthorized =
      user?.role === 'lecturer' ||
      user?.role === 'admin' ||
      user?.role === 'super_admin' ||
      user?.role === 'developer' ||
      user?.role === 'assistant_admin';
    if (isAuthenticated && isAuthorized) {
      fetchCourses();
    }
  }, [isAuthenticated, user?.role, fetchCourses]);

  // Handle course creation submission
  const handleCreateCourse = async (data: {
    title: string;
    level: CourseLevel;
    description: string;
  }) => {
    setIsCreatingCourse(true);
    try {
      const newCourse = await builderApi.createCourse(data);
      setIsCreationModalOpen(false);
      navigate(`/lecturer/builder/${encodeURIComponent(newCourse.id)}`);
    } finally {
      setIsCreatingCourse(false);
    }
  };

  // Filter courses by tab and search
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      // Tab filter
      if (activeTab === 'published') {
        if (c.status !== 'published' && c.status !== 'live') return false;
      } else if (activeTab === 'draft') {
        if (c.status !== 'draft') return false;
      } else if (activeTab === 'pending') {
        if (c.status !== 'pending_admin' && c.status !== 'pending_owner') return false;
      }

      // Search keyword filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = c.title.toLowerCase().includes(q);
        const matchId = c.id.toLowerCase().includes(q);
        return matchTitle || matchId;
      }

      return true;
    });
  }, [courses, activeTab, searchQuery]);

  // Check if current user is authorized to inspect course performance
  const isPerformanceAuthorized = useCallback(
    (course: Course) => {
      return isAuthorizedForCoursePerformance(course, user);
    },
    [user]
  );

  // 1. Unauthenticated or Trainee Guard
  if (!authLoading && (!isAuthenticated || user?.role === 'user')) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4" data-testid="lecturer-access-denied">
        <div className="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto">
          <Icon name="alertCircle" size="lg" />
        </div>
        <h1 className="text-xl font-bold text-text-heading">غير مصرح بالدخول إلى مساحة المحاضرين</h1>
        <p className="text-sm text-text-muted leading-relaxed">
          هذه الصفحة مخصصة للمحاضرين والمدربين المعتمدين ومديري النظام لإعداد وتعديل المقررات التدريبية.
        </p>
        <Button variant="primary" size="sm" onClick={() => navigate('/dashboard')}>
          العودة للرئيسية
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="lecturer-workspace-page">
      {/* Top Welcome & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-l from-primary/10 via-surface to-surface border border-primary/20 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold">
              <Icon name="courses" size="md" />
            </span>
            <h1 className="text-xl font-black text-text-heading">
              مساحة عمل المحاضر والمدرب المعتمد
            </h1>
          </div>
          <p className="text-xs text-text-muted">
            إدارة وتطوير البرامج والمناهج التدريبية المكلف بتدريسها لمترو القاهرة
          </p>
        </div>

        {(user?.role === 'lecturer' ||
          user?.role === 'admin' ||
          user?.role === 'super_admin' ||
          user?.role === 'developer') && (
          <Button
            type="button"
            variant="primary"
            size="md"
            leftIcon="plus"
            onClick={() => setIsCreationModalOpen(true)}
            className="self-start sm:self-auto font-bold shadow-md"
            data-testid="create-course-btn"
          >
            إنشاء مقرر جديد
          </Button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" onClose={() => setError(null)}>
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={fetchCourses}
              className="underline text-xs font-bold mr-4 hover:opacity-80"
            >
              إعادة المحاولة
            </button>
          </div>
        </Alert>
      )}

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-bg-alt/50 border border-border self-start">
          {(
            [
              { id: 'all', label: 'الكل' },
              { id: 'published', label: 'منشورة ومفعلة' },
              { id: 'draft', label: 'مسودات قيد الإعداد' },
              { id: 'pending', label: 'قيد المراجعة' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-surface text-primary shadow-sm border border-border/80'
                  : 'text-text-muted hover:text-text hover:bg-surface/50'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالعنوان أو الرمز..."
            className="w-full px-3.5 py-2 text-xs bg-surface border border-border rounded-xl text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary"
            data-testid="workspace-search-input"
          />
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="workspace-skeleton">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5 space-y-3 animate-pulse">
              <div className="h-4 bg-border/60 rounded w-1/3" />
              <div className="h-6 bg-border/60 rounded w-3/4" />
              <div className="h-16 bg-border/40 rounded" />
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredCourses.length === 0 && (
        <Card className="text-center py-12 px-4 space-y-3 border-dashed border-2" data-testid="workspace-empty-state">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Icon name="courses" size="md" />
          </div>
          <h2 className="text-sm font-bold text-text-heading">لا توجد مقررات تطابق هذا التصنيف</h2>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            {searchQuery
              ? 'لم يتم العثور على أي دورات تدريبية تطابق عبارة البحث المدخلة.'
              : 'لم تقم بإنشاء أي دورات تدريبية بعد. يمكنك البدء بإنشاء دورتك الأولى الآن.'}
          </p>
          {!searchQuery && (
            <Button
              variant="primary"
              size="sm"
              leftIcon="plus"
              onClick={() => setIsCreationModalOpen(true)}
              className="mt-2"
            >
              إنشاء دورتك التدريبية الأولى
            </Button>
          )}
        </Card>
      )}

      {/* Courses Cards Grid */}
      {!loading && filteredCourses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map((course) => {
            const totalLessons = course.chapters.reduce(
              (acc, ch) => acc + ch.items.length,
              0
            );
            const isDraft = course.status === 'draft';
            const isPending = course.status === 'pending_admin' || course.status === 'pending_owner';

            return (
              <Card
                key={course.id}
                variant="default"
                className="p-5 flex flex-col justify-between space-y-4 hover:border-primary/50 hover:shadow-md transition-all"
                data-testid={`workspace-course-card-${course.id}`}
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="neutral" className="text-xs font-mono font-bold">
                      {course.id}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      {course.isTestLab && (
                        <Badge
                          variant="primary"
                          className="text-[10px] bg-primary/20 text-primary-light border-primary/40 font-bold"
                          data-testid="lab-course-badge"
                        >
                          معمل اختبار
                        </Badge>
                      )}
                      {course.hasDraft && (
                        <Badge variant="warning" className="text-[10px] py-0.5">
                          مسودة غير منشورة
                        </Badge>
                      )}
                      <Badge
                        variant={isDraft ? 'neutral' : isPending ? 'warning' : 'success'}
                        className="text-xs"
                      >
                        {isDraft ? 'مسودة' : isPending ? 'ينتظر المراجعة' : 'منشور'}
                      </Badge>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h2 className="text-sm font-bold text-text-heading line-clamp-2 leading-snug">
                      {course.title}
                    </h2>
                    <p className="text-xs text-text-muted line-clamp-2 mt-1">
                      {course.description || 'لا يوجد وصف مضاف لهذا المقرر.'}
                    </p>
                  </div>

                  {/* Metrics Bar */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-bg-alt/40 border border-border text-center text-xs">
                    <div>
                      <span className="text-[10px] text-text-muted block">الفصول</span>
                      <strong className="text-text-heading">{course.chapters.length}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted block">الدروس</span>
                      <strong className="text-text-heading">{totalLessons}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted block">المسجلين</span>
                      <strong className="text-text-heading">{course.enrollmentCount || 0}</strong>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
                  {user?.role === 'lecturer' ||
                  user?.role === 'admin' ||
                  user?.role === 'super_admin' ||
                  user?.role === 'developer' ? (
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon="edit"
                      onClick={() => navigate(`/lecturer/builder/${encodeURIComponent(course.id)}`)}
                      className="flex-1 font-bold text-xs min-w-[120px]"
                      data-testid={`edit-builder-btn-${course.id}`}
                    >
                      تعديل في المنشئ
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon="eye"
                      onClick={() => navigate(`/courses/${encodeURIComponent(course.id)}?preview=true`)}
                      className="flex-1 font-bold text-xs min-w-[120px]"
                      data-testid={`preview-course-btn-${course.id}`}
                    >
                      معاينة المقرر
                    </Button>
                  )}

                  {isPerformanceAuthorized(course) && (
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon="barChart"
                      onClick={() => navigate(`/lecturer/performance/${encodeURIComponent(course.id)}`)}
                      className="text-xs font-bold text-primary border-primary/30 hover:bg-primary/5"
                      title="استعراض تقرير أداء ومتابعة المتدربين"
                      data-testid={`course-performance-btn-${course.id}`}
                    >
                      تقرير الأداء
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedQrCourse(course)}
                    className="px-2.5 text-xs text-primary shrink-0"
                    title="رمز QR للمقرر"
                    data-testid={`course-qr-btn-${course.id}`}
                  >
                    <Icon name="link" size="sm" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/courses/${encodeURIComponent(course.id)}?preview=true`)}
                    className="px-3 text-xs shrink-0"
                    title="معاينة الدورة كما تظهر للمتدربين"
                    data-testid={`preview-course-btn-${course.id}`}
                  >
                    معاينة
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Creation Modal */}
      <CourseCreationModal
        isOpen={isCreationModalOpen}
        onClose={() => setIsCreationModalOpen(false)}
        onSubmit={handleCreateCourse}
        isSubmitting={isCreatingCourse}
      />

      {/* Course QR Code Modal */}
      {selectedQrCourse && (
        <QRCodeModal
          isOpen={Boolean(selectedQrCourse)}
          onClose={() => setSelectedQrCourse(null)}
          title={selectedQrCourse.title}
          url={`${window.location.origin}/courses/${encodeURIComponent(selectedQrCourse.id)}`}
          subtitle={`المحاضر: ${selectedQrCourse.lecturerName}`}
          badgeLabel={`المقرر ${selectedQrCourse.id}`}
          downloadFilename={`course-${selectedQrCourse.id}-qr.png`}
          isExternalResource={false}
        />
      )}
    </div>
  );
};

export default LecturerCoursesPage;
