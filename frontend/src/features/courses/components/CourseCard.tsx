import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@/shared/ui/Icon';
import type { Course } from '@/core/courses/types';
import { useEnrollment } from '../hooks/useEnrollment';
import '../styles/courses.css';

export interface CourseCardProps {
  course: Course;
  index?: number;
}

const THUMB_GRADIENTS = [
  'linear-gradient(135deg, #1A3F6F 0%, #5BBFDE 100%)',
  'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
  'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)',
  'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)',
  'linear-gradient(135deg, #1E293B 0%, #64748B 100%)',
  'linear-gradient(135deg, #1A3F6F 0%, #49B0D1 100%)',
];

const LEVEL_CONFIG: Record<string, { className: string; bgClass: string }> = {
  'مبتدئ': { className: 'beginner', bgClass: 'bg-[#2E7D32]/95' },
  'متوسط': { className: 'intermediate', bgClass: 'bg-[#F9A825]/95' },
  'متقدم': { className: 'advanced', bgClass: 'bg-[#D32F2F]/95' },
};

export const CourseCard: React.FC<CourseCardProps> = ({ course, index = 0 }) => {
  const navigate = useNavigate();
  const { isEnrolledInCourse } = useEnrollment();
  const isEnrolled = isEnrolledInCourse(course.id);
  const gradient = THUMB_GRADIENTS[index % THUMB_GRADIENTS.length];
  const initial = course.title ? course.title.trim()[0] : 'ك';
  const levelInfo = LEVEL_CONFIG[course.level] || { className: 'beginner', bgClass: 'bg-[#2E7D32]/95' };

  const handleCardClick = () => {
    navigate(`/courses/${course.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(`/courses/${course.id}`);
    }
  };

  return (
    <article
      className="course-card bg-surface rounded-2xl border border-border overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-primary/40 flex flex-col relative group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary w-full shadow-xs"
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label={`دورة: ${course.title}`}
      data-testid={`course-card-${course.id}`}
    >
      {/* Thumbnail Container */}
      <div
        className="course-card-thumb w-full h-40 flex items-center justify-center text-5xl font-bold text-white/90 relative overflow-hidden select-none shrink-0"
        style={{
          background: course.thumbnail ? `url('${course.thumbnail}') center/cover no-repeat` : gradient,
        }}
      >
        {!course.thumbnail && (
          <span className="select-none font-bold text-white/90 drop-shadow-sm">
            {initial}
          </span>
        )}
        <span
          className={`level-badge ${levelInfo.className} ${levelInfo.bgClass} absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold z-10 text-white backdrop-blur-xs shadow-xs`}
        >
          {course.level}
        </span>
        {isEnrolled && (
          <span
            data-testid={`enrolled-badge-${course.id}`}
            className="enrolled-badge absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold z-10 text-white bg-emerald-600/95 backdrop-blur-xs shadow-xs flex items-center gap-1"
          >
            <Icon name="check" size="sm" />
            <span>مسجل</span>
          </span>
        )}
      </div>

      {/* Card Body */}
      <div className="course-card-body p-4.5 flex-1 flex flex-col">
        <h3 className="course-card-title text-base font-bold text-text line-clamp-2 min-h-[2.9em] mb-2 leading-snug group-hover:text-primary-dark transition-colors">
          {course.title}
        </h3>

        <div className="course-card-lecturer text-xs text-text-muted mb-3 flex items-center gap-1.5">
          <Icon name="user" size="sm" className="text-text-muted shrink-0" />
          <span className="truncate">{course.lecturerName || 'إدارة التدريب'}</span>
        </div>

        {/* Metadata Grid */}
        <div className="course-card-meta flex items-center gap-3.5 flex-wrap mb-4 text-xs text-text-muted">
          <span className="course-meta-item rating flex items-center gap-1 font-semibold text-text">
            <Icon name="star" size="sm" className="text-amber-500 fill-amber-500 shrink-0" />
            <span className="meta-value">{course.rating.toFixed(1)}</span>
            <span className="meta-count">({course.ratingCount})</span>
          </span>

          <span className="course-meta-item flex items-center gap-1">
            <Icon name="users" size="sm" className="text-text-muted shrink-0" />
            <span className="meta-value">{course.enrollmentCount}</span>
            <span className="text-[11px] text-text-muted">متدرب</span>
          </span>

          <span className="course-meta-item flex items-center gap-1">
            <Icon name="clock" size="sm" className="text-text-muted shrink-0" />
            <span className="meta-value">{course.estimatedHours}</span>
            <span className="text-[11px] text-text-muted">ساعة</span>
          </span>
        </div>
      </div>

      {/* Card Footer */}
      <div className="course-card-footer p-4.5 pt-0 mt-auto">
        <Link
          to={`/courses/${course.id}`}
          className={`course-view-btn w-full py-2.5 px-3 flex items-center justify-center gap-1.5 rounded-lg border-1.5 font-bold text-sm transition-all duration-150 ${
            isEnrolled
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white'
              : 'border-primary text-primary-dark hover:bg-primary hover:text-white hover:border-primary hover:shadow-md'
          }`}
          onClick={(e) => e.stopPropagation()}
          aria-label={`عرض تفاصيل دورة ${course.title}`}
        >
          <span>{isEnrolled ? 'استعراض الدورة (مسجل)' : 'عرض الكورس'}</span>
          <Icon name="chevronLeft" size="sm" className="shrink-0" />
        </Link>
      </div>
    </article>
  );
};

export default CourseCard;
