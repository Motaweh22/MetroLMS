import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '@/features/dashboard/services/dashboardApi';
import type {
  DashboardData,
  TraineeDashboardData,
  LecturerDashboardData,
  AdminDashboardData,
} from '@/core/dashboard/types';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { Alert } from '@/shared/ui/Alert';
import { useToast } from '@/shared/ui/Toast';
import { TrainingGroupsCarousel } from '@/features/dashboard/components/TrainingGroupsCarousel';

/**
 * Trainee Dashboard View
 */
const TraineeDashboard: React.FC<{ data: TraineeDashboardData }> = ({ data }) => {
  const toast = useToast();

  return (
    <div className="space-y-6" data-testid="trainee-dashboard">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-l from-primary-dark via-primary to-primary-light p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 space-y-2 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-semibold text-accent-cyan border border-white/20">
            <Icon name="activity" size="sm" />
            <span>{data.welcome.dateAr}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug">
            أهلاً بك، {data.welcome.name}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-light/90">
            {data.welcome.jobTitle} • {data.welcome.department}
          </p>
        </div>
      </div>

      {/* Trainee LMS Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="default" className="p-4 bg-surface text-center space-y-1">
          <span className="text-xs text-text-muted font-medium">الكورسات المسجلة</span>
          <p className="text-2xl font-black text-primary">{data.stats.enrolledCount}</p>
          <span className="text-[11px] text-text-muted">مقررات قيد الدراسة</span>
        </Card>

        <Card variant="default" className="p-4 bg-surface text-center space-y-1">
          <span className="text-xs text-text-muted font-medium">الكورسات المكتملة</span>
          <p className="text-2xl font-black text-success">{data.stats.completedCount}</p>
          <span className="text-[11px] text-text-muted">تم إنجازها 100%</span>
        </Card>

        <Card variant="default" className="p-4 bg-surface text-center space-y-1">
          <span className="text-xs text-text-muted font-medium">ساعات التدريب</span>
          <p className="text-2xl font-black text-warning-dark">{data.stats.totalLearningHours}</p>
          <span className="text-[11px] text-text-muted">ساعة تدريب ميداني ورقمي</span>
        </Card>

        <Card variant="default" className="p-4 bg-surface text-center space-y-1">
          <span className="text-xs text-text-muted font-medium">المجموعات التدريبية</span>
          <p className="text-2xl font-black text-text-heading">{data.stats.activeGroupsCount}</p>
          <span className="text-[11px] text-text-muted">دفعات مشتركة</span>
        </Card>
      </div>

      {/* Continue Learning & Attention Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Continue Learning Card */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-text-heading flex items-center gap-2">
            <Icon name="play" size="sm" className="text-primary" />
            <span>متابعة التعلم</span>
          </h2>

          {data.continueLearning ? (
            <Card variant="elevated" className="border-border hover:shadow-md transition-shadow">
              <div className="p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="primary" className="text-xs font-bold gap-1">
                    <Icon name="activity" size="sm" />
                    <span>آخر نشاط تعليمي</span>
                  </Badge>
                  <span className="text-xs text-text-muted font-mono">
                    {data.continueLearning.courseId}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-text-heading">
                    {data.continueLearning.courseTitle}
                  </h3>
                  <p className="text-xs sm:text-sm text-text-muted mt-1">
                    المحاضر: {data.continueLearning.lecturerName}
                  </p>
                </div>

                <div className="bg-surface-alt/60 p-3 rounded-lg border border-border/80 text-xs flex items-center justify-between">
                  <span className="text-text-muted">الدرس التالي:</span>
                  <span className="font-bold text-text-heading">
                    {data.continueLearning.resumeLessonTitle}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>نسبة إنجاز المقرر</span>
                    <span className="font-bold text-text-heading">
                      {data.continueLearning.progressPercent}%
                    </span>
                  </div>
                  <ProgressBar
                    value={data.continueLearning.progressPercent}
                    variant={data.continueLearning.progressPercent === 100 ? 'success' : 'primary'}
                    size="md"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Link
                    to={`/courses/${data.continueLearning.courseId}/learn`}
                    className="w-full sm:w-auto"
                  >
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full sm:w-auto font-bold text-xs"
                      rightIcon="arrowLeft"
                    >
                      متابعة التعلم الآن ←
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ) : (
            <Card variant="default" className="p-8 text-center border-dashed">
              <p className="text-sm text-text-muted mb-4">
                لم تبدأ في دراسة أي كورس بعد. ابدأ الآن بتسجيل وتصفح الكورسات المتاحة.
              </p>
              <Link to="/courses">
                <Button variant="primary" size="sm" leftIcon="courses">
                  تصفح دليل الكورسات
                </Button>
              </Link>
            </Card>
          )}
        </div>

        {/* Attention & Status Widget */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-text-heading flex items-center gap-2">
            <Icon name="alert" size="sm" className="text-warning-dark" />
            <span>حالة المهل التدريبية</span>
          </h2>

          <Card variant="default" className="p-5 space-y-3">
            {data.attention.hasEvaluated && data.attention.allClear && (
              <div className="p-4 rounded-xl bg-success-light/30 border border-success/30 text-success-dark text-xs sm:text-sm font-semibold flex items-start gap-2.5">
                <Icon name="checkmark" size="md" className="shrink-0 text-success mt-0.5" />
                <span className="leading-relaxed">
                  {data.attention.allClearMessage ||
                    'جميع مساراتك التدريبية تسير وفق الجدول الزمني المحدد'}
                </span>
              </div>
            )}

            {data.attention.items && data.attention.items.length > 0 && (
              <div className="space-y-2.5">
                {data.attention.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-danger-light/30 border border-danger/30 text-danger-dark text-xs font-semibold flex items-start gap-2"
                  >
                    <Icon name="alert" size="sm" className="shrink-0 mt-0.5" />
                    <span>{item.reason}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Links */}
            <div className="pt-3 border-t border-border flex flex-col gap-2">
              <Link to="/my-courses" className="block">
                <Button variant="outline" size="sm" className="w-full text-xs justify-between">
                  <span>كورساتي المسجلة</span>
                  <Icon name="arrowLeft" size="sm" />
                </Button>
              </Link>
              <Link to="/my-groups" className="block">
                <Button variant="outline" size="sm" className="w-full text-xs justify-between">
                  <span>مجموعاتي والبرامج التدريبية</span>
                  <Icon name="arrowLeft" size="sm" />
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Upcoming Sessions Section */}
      {data.upcomingSessions && data.upcomingSessions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-text-heading flex items-center gap-2">
            <Icon name="calendar" size="sm" className="text-primary" />
            <span>اللقاءات التفاعلية والجلسات المباشرة القادمة</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.upcomingSessions.map((session) => (
              <Card key={session.id} variant="default" className="p-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="primary" className="text-[11px] gap-1">
                      <Icon name="video" size="sm" />
                      <span>{session.groupName}</span>
                    </Badge>
                    <span className="text-[11px] font-bold text-warning-dark bg-warning-light/40 px-2 py-0.5 rounded">
                      جلسة افتراضية استرشادية
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-text-heading pt-1">{session.title}</h4>
                  <p className="text-xs text-text-muted">{session.description}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-xs font-bold"
                  onClick={() => {
                    toast.info('هذا رابط تجريبي تمثيلي لجلسة التدريب الميدانية عبر Microsoft Teams.', {
                      title: 'جلسة تدريب افتراضية',
                      duration: 5000,
                    });
                  }}
                >
                  انضمام
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Lecturer Dashboard View
 */
const LecturerDashboard: React.FC<{ data: LecturerDashboardData }> = ({ data }) => {
  return (
    <div className="space-y-6" data-testid="lecturer-dashboard">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-l from-primary-dark via-primary to-primary-light p-6 sm:p-8 text-white shadow-md">
        <div className="space-y-2 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-semibold text-accent-cyan border border-white/20">
            <Icon name="user" size="sm" />
            <span>لوحة المحاضر والمدرب المعتمد</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug">
            مرحباً بك، {data.welcome.name}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-light/90">
            {data.welcome.roleTitle} • {data.welcome.department}
          </p>
        </div>
      </div>

      {/* Lecturer Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="default" className="p-4 bg-surface text-center space-y-1">
          <span className="text-xs text-text-muted font-medium">الدورات المكلف بها</span>
          <p className="text-2xl font-black text-primary">{data.stats.assignedCoursesCount}</p>
          <span className="text-[11px] text-text-muted">مقررات نشطة</span>
        </Card>

        <Card variant="default" className="p-4 bg-surface text-center space-y-1">
          <span className="text-xs text-text-muted font-medium">إجمالي المتدربين المسجلين</span>
          <p className="text-2xl font-black text-success">{data.stats.totalTraineesCount}</p>
          <span className="text-[11px] text-text-muted">متدرب عبر دوراتك</span>
        </Card>

        <Card variant="default" className="p-4 bg-surface text-center space-y-1">
          <span className="text-xs text-text-muted font-medium">متوسط التقييم العام</span>
          <p className="text-2xl font-black text-warning-dark">{data.stats.averageRating} ★</p>
          <span className="text-[11px] text-text-muted">تقييمات حقيقية معتمدة</span>
        </Card>

        <Card variant="default" className="p-4 bg-surface text-center space-y-1">
          <span className="text-xs text-text-muted font-medium">المجموعات الخاضعة لإشرافك</span>
          <p className="text-2xl font-black text-text-heading">{data.stats.supervisedGroupsCount}</p>
          <span className="text-[11px] text-text-muted">دفعات إشراف ميداني</span>
        </Card>
      </div>

      {/* Assigned Courses Table */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-text-heading flex items-center gap-2">
          <Icon name="courses" size="sm" className="text-primary" />
          <span>المقررات والدورات المكلف بتدريسها</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.assignedCourses.map((course) => (
            <Link
              key={course.id}
              to={`/courses/${encodeURIComponent(course.id)}`}
              className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
              aria-label={`عرض تفاصيل مقرر ${course.title} (${course.id})`}
              data-testid={`lecturer-course-card-link-${course.id}`}
            >
              <Card
                variant="default"
                className="p-4 space-y-3 border-border hover:border-primary/60 hover:shadow-md transition-all cursor-pointer h-full group-hover:border-primary/60"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="primary" className="text-xs font-mono font-bold">
                    {course.id}
                  </Badge>
                  <Badge variant="neutral" className="text-xs">
                    {course.level}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-base font-bold text-text-heading group-hover:text-primary transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-xs text-text-muted mt-1">المدة التقديرية: {course.duration}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-text-muted">
                  <span>المتدربين: <strong className="text-text-heading">{course.enrolledCount}</strong></span>
                  <span>التقييم: <strong className="text-warning-dark">{course.rating} ★</strong></span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Supervised Groups List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-text-heading flex items-center gap-2">
          <Icon name="trainingGroups" size="sm" className="text-primary" />
          <span>الدفعات والمجموعات الخاضعة لإشرافك التدريبي</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.supervisedGroups.map((grp) => (
            <Link
              key={grp.id}
              to={`/my-groups/${encodeURIComponent(grp.id)}`}
              className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
              aria-label={`عرض تفاصيل مجموعة ${grp.name} (${grp.id})`}
              data-testid={`supervised-group-card-link-${grp.id}`}
            >
              <Card
                variant="default"
                className="p-4 space-y-3 border-border hover:border-primary/60 hover:shadow-md transition-all cursor-pointer h-full group-hover:border-primary/60"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-text-heading group-hover:text-primary transition-colors">
                    {grp.name}
                  </h3>
                  <Badge variant="neutral" className="text-xs font-mono font-bold">
                    {grp.id}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>نسبة الإنجاز الإجمالية للدفعة</span>
                    <span className="font-bold text-text-heading">{grp.completionRate}%</span>
                  </div>
                  <ProgressBar value={grp.completionRate} size="sm" variant="primary" />
                </div>

                <div className="flex items-center justify-between text-xs text-text-muted pt-1">
                  <span>عدد المتدربين: {grp.traineeCount}</span>
                  <span>المهلة: {grp.deadlineText}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Admin Dashboard View
 */
const AdminDashboard: React.FC<{ data: AdminDashboardData }> = ({ data }) => {
  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-l from-primary-dark via-primary to-primary-light p-6 sm:p-8 text-white shadow-md">
        <div className="space-y-2 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-semibold text-accent-cyan border border-white/20">
            <Icon name="dashboard" size="sm" />
            <span>لوحة القيادة والمتابعة المركزية</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug">
            مرحباً بك، {data.welcome.name}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-light/90">
            {data.welcome.roleTitle} • الشركة المصرية لإدارة وتشغيل المترو
          </p>
        </div>
      </div>

      {/* Admin Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="default" className="p-4 bg-surface text-center space-y-1">
          <span className="text-xs text-text-muted font-medium">إجمالي الكورسات بالمنظومة</span>
          <p className="text-2xl font-black text-primary">{data.stats.totalCoursesCount}</p>
          <span className="text-[11px] text-text-muted">مقررات معتمدة</span>
        </Card>

        <Card variant="default" className="p-4 bg-surface text-center space-y-1">
          <span className="text-xs text-text-muted font-medium">إجمالي التسجيلات التدريبية</span>
          <p className="text-2xl font-black text-success">{data.stats.totalEnrollmentsCount}</p>
          <span className="text-[11px] text-text-muted">تسجيل نشط</span>
        </Card>

        <Card variant="default" className="p-4 bg-surface text-center space-y-1">
          <span className="text-xs text-text-muted font-medium">المجموعات التدريبية الميدانية</span>
          <p className="text-2xl font-black text-text-heading">{data.stats.activeGroupsCount}</p>
          <span className="text-[11px] text-text-muted">دفعات مفعلة</span>
        </Card>

        <Card variant="default" className="p-4 bg-surface text-center space-y-1">
          <span className="text-xs text-text-muted font-medium">تنبيهات المهل الحرجة</span>
          <p className="text-2xl font-black text-warning-dark">{data.stats.totalAttentionFlagsCount}</p>
          <span className="text-[11px] text-text-muted">متأخرات قيد المتابعة</span>
        </Card>
      </div>

      {/* Top Courses Summary */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-text-heading flex items-center gap-2">
          <Icon name="courses" size="sm" className="text-primary" />
          <span>المقررات الأكثر تسجيلاً بالمنظومة</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.topCourses.map((c) => (
            <Link
              key={c.id}
              to={`/courses/${encodeURIComponent(c.id)}`}
              className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
              aria-label={`عرض تفاصيل مقرر ${c.title} (${c.id})`}
              data-testid={`top-course-card-link-${c.id}`}
            >
              <Card
                variant="default"
                className="p-4 space-y-2 border-border hover:border-primary/60 hover:shadow-md transition-all cursor-pointer h-full group-hover:border-primary/60"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="primary" className="text-xs font-mono font-bold">
                    {c.id}
                  </Badge>
                  <span className="text-xs font-bold text-warning-dark">{c.rating} ★</span>
                </div>
                <h3 className="text-sm font-bold text-text-heading group-hover:text-primary transition-colors">
                  {c.title}
                </h3>
                <p className="text-xs text-text-muted">المحاضر: {c.lecturerName}</p>
                <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-border">
                  <span>المسجلين: <strong className="text-text-heading">{c.enrollmentCount}</strong></span>
                  <span>نسبة الإنجاز: <strong className="text-success">{c.completionRate}%</strong></span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Active Groups Overview Carousel */}
      <TrainingGroupsCarousel groups={data.activeGroupsOverview} />
    </div>
  );
};

/**
 * Main Role-Adaptive Dashboard Page
 */
export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await dashboardApi.getDashboardData();
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل بيانات لوحة المتابعة');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto" aria-busy="true">
        <div className="h-40 bg-neutral-light rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-24 bg-neutral-light rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <Alert variant="danger" title="خطأ في تحميل لوحة المتابعة">
          <div className="flex items-center justify-between gap-4">
            <span>{error || 'تعذر استرجاع البيانات'}</span>
            <Button variant="outline" size="sm" onClick={loadDashboard}>
              إعادة المحاولة
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto" data-testid="dashboard-page">
      {data.role === 'user' && <TraineeDashboard data={data} />}
      {data.role === 'lecturer' && <LecturerDashboard data={data} />}
      {(data.role === 'admin' ||
        data.role === 'assistant_admin' ||
        data.role === 'super_admin' ||
        data.role === 'developer') && <AdminDashboard data={data} />}
    </div>
  );
};

export default DashboardPage;
