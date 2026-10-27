import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { performanceApi } from '../services/performanceApi';
import type { CoursePerformanceReportDTO } from '@/core/performance/types';
import { Card, CardContent } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';

export const CoursePerformancePage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [report, setReport] = useState<CoursePerformanceReportDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadReport = useCallback(async () => {
    if (!courseId) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await performanceApi.getCoursePerformanceReport(courseId);
      setReport(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تحميل تقرير أداء المقرر';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const filteredTrainees = (report?.trainees || []).filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      t.name.toLowerCase().includes(q) ||
      t.jobTitle.toLowerCase().includes(q) ||
      t.department.toLowerCase().includes(q) ||
      (t.phone && t.phone.includes(q))
    );
  });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6" data-testid="performance-loading-state">
        <div className="h-8 w-64 bg-surface-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-surface rounded-xl border border-border animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-surface rounded-xl border border-border animate-pulse" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6" data-testid="performance-error-state">
        <Link to="/lecturer/courses" data-testid="performance-back-to-courses">
          <Button variant="ghost" size="sm" leftIcon="arrowRight">
            العودة إلى مقررات المحاضر
          </Button>
        </Link>
        <Alert
          type="error"
          title="خطأ في استعراض تقرير الأداء"
          message={error || 'المقرر التدريبي غير متوفر'}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6" data-testid="course-performance-page">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-text-muted" aria-label="مسار التنقل">
        <Link to="/dashboard" className="hover:text-primary transition-colors">الرئيسية</Link>
        <span>/</span>
        <Link to="/lecturer/courses" className="hover:text-primary transition-colors" data-testid="breadcrumb-lecturer-courses">
          مقررات المحاضر
        </Link>
        <span>/</span>
        <Link to={`/courses/${report.courseId}`} className="hover:text-primary transition-colors max-w-xs truncate">
          {report.courseTitle}
        </Link>
        <span>/</span>
        <span className="text-text font-bold">تقرير أداء المتدربين</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary-dark">
              متابعة الأداء الأكاديمي
            </span>
            <span className="text-xs text-text-muted">المحاضر: {report.lecturerName}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-heading">
            أداء المتدربين — {report.courseTitle}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/lecturer/courses">
            <Button variant="outline" size="sm" leftIcon="arrowRight" data-testid="btn-back-to-lecturer-courses">
              مقرراتي
            </Button>
          </Link>
          <Link to={`/courses/${report.courseId}`}>
            <Button variant="ghost" size="sm">
              صفحة المقرر
            </Button>
          </Link>
          <Button variant="ghost" size="sm" leftIcon="refresh" onClick={loadReport}>
            تحديث
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Enrolled */}
        <Card className="border-border">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-text-muted font-medium">إجمالي المتدربين</span>
            <div className="text-2xl font-black text-text-heading" data-testid="kpi-total-enrolled">
              {report.totalEnrolled}
            </div>
            <span className="text-[11px] text-text-muted">مسجل بالدورة</span>
          </CardContent>
        </Card>

        {/* Completed */}
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-emerald-800 font-medium">أتموا الدورة بنجاح</span>
            <div className="text-2xl font-black text-emerald-700" data-testid="kpi-completed-count">
              {report.completedCount}
            </div>
            <span className="text-[11px] text-emerald-600">نسبة الإنجاز 100%</span>
          </CardContent>
        </Card>

        {/* Active In Progress */}
        <Card className="border-sky-200 bg-sky-50/40">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-sky-800 font-medium">متابعة نشطة</span>
            <div className="text-2xl font-black text-sky-700" data-testid="kpi-active-count">
              {report.activeCount}
            </div>
            <span className="text-[11px] text-sky-600">نشاط خلال آخر 5 أيام</span>
          </CardContent>
        </Card>

        {/* Inactive / Late (At Risk) */}
        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-red-800 font-medium">متأخرون عن المتابعة ⚠️</span>
            <div className="text-2xl font-black text-red-700" data-testid="kpi-late-count">
              {report.lateCount}
            </div>
            <span className="text-[11px] text-red-600">انقطاع لأكثر من 5 أيام</span>
          </CardContent>
        </Card>

        {/* Average Progress */}
        <Card className="border-border">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-text-muted font-medium">متوسط تقدم الدفعة</span>
            <div className="text-2xl font-black text-primary-dark" data-testid="kpi-avg-progress">
              {report.averageProgressPercent}%
            </div>
            <span className="text-[11px] text-text-muted">إجمالي المسجلين</span>
          </CardContent>
        </Card>
      </div>

      {/* Trainees Roster Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-text-heading flex items-center gap-2">
            <Icon name="trainingGroups" size="sm" className="text-primary" />
            <span>سجل أداء المتدربين والتنبيهات المباشرة</span>
            <span className="text-xs font-normal text-text-muted">({filteredTrainees.length} متدرب)</span>
          </h2>

          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="بحث بالاسم، الوظيفة، أو الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-border rounded-lg bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
              data-testid="trainee-search-input"
            />
          </div>
        </div>

        {report.totalEnrolled === 0 ? (
          <div
            className="p-10 text-center bg-surface-muted rounded-xl border-2 border-dashed border-border space-y-3"
            data-testid="performance-empty-state"
          >
            <div className="text-4xl">📉</div>
            <h3 className="text-base font-bold text-text-heading">لا يوجد متدربون في هذا المقرر بعد</h3>
            <p className="text-xs text-text-muted max-w-md mx-auto">
              لم يقم أي متدرب بالتسجيل أو بدء التعلم في هذا المقرر حتى الآن.
            </p>
          </div>
        ) : filteredTrainees.length === 0 ? (
          <div className="p-8 text-center bg-surface rounded-xl border border-border text-xs text-text-muted">
            لا توجد نتائج مطابقة لبحثك "{searchQuery}".
          </div>
        ) : (
          <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse" data-testid="trainees-roster-table">
                <thead>
                  <tr className="bg-surface-muted/60 border-b border-border text-text-muted font-bold">
                    <th className="p-3.5">المتدرب</th>
                    <th className="p-3.5 text-center">نسبة الإنجاز</th>
                    <th className="p-3.5 text-center">آخر نشاط</th>
                    <th className="p-3.5 text-center">الحالة</th>
                    <th className="p-3.5 text-left">إجراءات المتابعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTrainees.map((trainee) => {
                    const isLate = trainee.status === 'late';
                    const isCompleted = trainee.status === 'completed';

                    return (
                      <tr
                        key={trainee.userId}
                        className="hover:bg-surface-muted/40 transition-colors"
                        data-testid={`trainee-row-${trainee.userId}`}
                      >
                        {/* Trainee Profile */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary-dark font-bold flex items-center justify-center shrink-0 text-sm">
                              {trainee.name ? trainee.name.trim()[0] : 'م'}
                            </div>
                            <div>
                              <div className="font-bold text-text-heading">{trainee.name}</div>
                              <div className="text-[11px] text-text-muted">
                                {trainee.jobTitle} • {trainee.department}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Progress Bar & % */}
                        <td className="p-3.5 text-center">
                          <div className="flex items-center gap-2 justify-center max-w-[130px] mx-auto">
                            <div className="w-20 h-2 bg-neutral-light rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  isCompleted
                                    ? 'bg-emerald-500'
                                    : isLate
                                    ? 'bg-red-500'
                                    : 'bg-primary'
                                }`}
                                style={{ width: `${trainee.progressPercent}%` }}
                              />
                            </div>
                            <span className="font-bold text-text w-9 text-right">
                              {trainee.progressPercent}%
                            </span>
                          </div>
                        </td>

                        {/* Last Activity */}
                        <td className="p-3.5 text-center text-text-muted">
                          {trainee.lastActivityAt ? (
                            <div>
                              <div>{new Date(trainee.lastActivityAt).toLocaleDateString('ar-EG')}</div>
                              {typeof trainee.daysSinceLastActivity === 'number' && trainee.daysSinceLastActivity > 0 && (
                                <div className="text-[10px] text-text-muted">
                                  منذ {trainee.daysSinceLastActivity} يوم
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-text-muted">لم يبدأ</span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="p-3.5 text-center">
                          {isCompleted ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                              مكتمل ✅
                            </span>
                          ) : isLate ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">
                              متأخر ⚠️
                            </span>
                          ) : trainee.status === 'active' ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800">
                              نشط ⏳
                            </span>
                          ) : (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">
                              لم يبدأ بعد
                            </span>
                          )}
                        </td>

                        {/* Actions (WhatsApp Reminder) */}
                        <td className="p-3.5 text-left">
                          <div className="flex justify-end">
                            {trainee.whatsappUrl ? (
                              <a
                                href={trainee.whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 transition-colors"
                                data-testid={`whatsapp-nudge-btn-${trainee.userId}`}
                                title={`إرسال تنبيه واتساب للمتدرب (${trainee.name})`}
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  width="14"
                                  height="14"
                                  fill="#15803d"
                                  aria-hidden="true"
                                >
                                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2Z" />
                                </svg>
                                <span>تنبيه واتساب</span>
                              </a>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 bg-gray-100 cursor-not-allowed opacity-60"
                                data-testid={`whatsapp-nudge-disabled-${trainee.userId}`}
                                title="رقم الهاتف غير متوفر في سجل الموظف"
                              >
                                <span>لا يتوفر هاتف</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoursePerformancePage;
