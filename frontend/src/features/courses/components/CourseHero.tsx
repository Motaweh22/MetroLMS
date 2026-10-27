import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/shared/ui/Icon';
import { useAuth } from '@/features/auth';
import { useEnrollCourse } from '../hooks/useEnrollCourse';
import type { Course } from '@/core/courses/types';
import type { UseEnrollCourseResult } from '../hooks/useEnrollCourse';
import { QRCodeModal } from '@/shared/ui/QRCodeModal';

export interface CourseHeroProps {
  course: Course;
  enrollmentState?: UseEnrollCourseResult;
}

export const CourseHero: React.FC<CourseHeroProps> = ({ course, enrollmentState }) => {
  const { user } = useAuth();
  const fallbackHook = useEnrollCourse(enrollmentState ? undefined : course.id);
  const { isEnrolled, isSubmitting, isSuccess, enroll } = enrollmentState || fallbackHook;
  const initial = course.lecturerName ? course.lecturerName.trim()[0] : 'م';

  const [qrOpen, setQrOpen] = useState<boolean>(false);

  // Apply custom cover styling if configured
  const heroStyle: React.CSSProperties = {};
  if (course.coverType === 'color' && course.coverColor) {
    heroStyle.backgroundColor = course.coverColor;
    heroStyle.backgroundImage = 'none';
  } else if (course.coverType === 'image' && course.thumbnail) {
    heroStyle.backgroundImage = `linear-gradient(rgba(0, 51, 102, 0.85), rgba(15, 23, 42, 0.94)), url(${course.thumbnail})`;
    heroStyle.backgroundSize = 'cover';
    heroStyle.backgroundPosition = 'center';
  }

  const canonicalUrl = `${window.location.origin}/courses/${encodeURIComponent(course.id)}`;

  return (
    <div className="cd-hero" style={heroStyle}>
      {/* Breadcrumb Navigation */}
      <nav className="cd-breadcrumb" aria-label="مسار التنقل">
        <Link to="/dashboard">الرئيسية</Link>
        <span className="sep">/</span>
        <Link to="/courses">الكورسات</Link>
        <span className="sep">/</span>
        <span className="text-white font-medium truncate max-w-xs">{course.title}</span>
      </nav>

      {/* Main Hero Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 relative z-10">
        <div className="space-y-3 max-w-3xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/30 backdrop-blur-sm">
              {course.level}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white/90 border border-white/20">
              {course.estimatedHours} ساعة تدريبية
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white/90 border border-white/20">
              {course.chapters?.length || 0} وحدات دراسية
            </span>
          </div>

          <h1 className="cd-hero-title">{course.title}</h1>

          {/* Lecturer Info */}
          <div className="cd-hero-lecturer">
            <div className="cd-hero-avatar" aria-hidden="true">
              {initial}
            </div>
            <div>
              <span className="text-xs text-white/70 block">المحاضر المعتمد</span>
              <span className="font-bold text-white text-sm">{course.lecturerName}</span>
            </div>
          </div>

          {/* Target Job Titles */}
          {course.targetJobTitles && course.targetJobTitles.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-2">
              <span className="text-xs text-white/75 ml-1">الوظائف المستهدفة:</span>
              {course.targetJobTitles.map((title) => (
                <span
                  key={title}
                  className="px-2 py-0.5 bg-black/20 text-white/90 rounded text-[11px] font-medium border border-white/10"
                >
                  {title}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Enrollment Status & Navigation Container */}
        <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-lg border border-white/40 transition-colors"
              title="عرض رمز QR المباشر للمقرر"
              data-testid="hero-qr-code-btn"
            >
              <Icon name="link" size="sm" />
              <span>رمز QR</span>
            </button>

            <Link
              to="/courses"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-lg border border-white/40 transition-colors"
            >
              <Icon name="arrowRight" size="sm" />
              <span>العودة إلى دليل الكورسات</span>
            </Link>
          </div>

          {/* Role-Aware Enrollment State */}
          {user?.role === 'user' ? (
            isEnrolled ? (
              <div
                data-testid="hero-enrolled-indicator"
                className="bg-emerald-700/90 backdrop-blur-md border border-emerald-400/40 rounded-lg px-4 py-2.5 text-start text-white flex items-center gap-2 shadow-sm"
              >
                <Icon name="checkCircle" size="sm" className="text-emerald-200" />
                <span className="text-xs font-bold">
                  {isSuccess ? 'تم تسجيلك بنجاح في الدورة' : 'أنت مسجل في هذه الدورة التدريبية'}
                </span>
              </div>
            ) : (
              <button
                type="button"
                data-testid="hero-enroll-button"
                onClick={() => enroll()}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-cyan hover:bg-accent-cyan/90 text-neutral-dark text-xs font-extrabold rounded-lg shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Icon name="refresh" size="sm" className="animate-spin" />
                ) : (
                  <Icon name="plus" size="sm" />
                )}
                <span>{isSubmitting ? 'جاري التسجيل...' : 'التسجيل في الدورة'}</span>
              </button>
            )
          ) : user?.role === 'lecturer' ? (
            <div className="bg-black/30 backdrop-blur-md border border-white/20 rounded-lg px-3.5 py-2 text-white text-xs font-semibold flex items-center gap-2">
              <Icon name="user" size="sm" />
              <span>حساب محاضر معتمد — استعراض المنهج</span>
            </div>
          ) : (
            <div className="bg-black/30 backdrop-blur-md border border-white/20 rounded-lg px-3.5 py-2 text-white text-xs font-semibold flex items-center gap-2">
              <Icon name="shield" size="sm" />
              <span>حساب مسؤول النظام — استعراض وإشراف</span>
            </div>
          )}
        </div>
      </div>

      {/* Course QR Code Modal */}
      {qrOpen && (
        <QRCodeModal
          isOpen={qrOpen}
          onClose={() => setQrOpen(false)}
          title={course.title}
          url={canonicalUrl}
          subtitle={`المحاضر: ${course.lecturerName}`}
          badgeLabel={`المقرر ${course.id}`}
          downloadFilename={`course-${course.id}-qr.png`}
          isExternalResource={false}
        />
      )}
    </div>
  );
};

export default CourseHero;
