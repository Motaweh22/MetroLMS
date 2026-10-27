import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/shared/ui/Icon/Icon';
import type { UserRole } from '@/core/auth/types';

export interface LearningHeaderProps {
  courseId: string;
  courseTitle: string;
  currentLessonTitle?: string;
  progressPercent: number;
  userRole?: UserRole;
}

export const LearningHeader: React.FC<LearningHeaderProps> = ({
  courseId,
  courseTitle,
  currentLessonTitle,
  progressPercent,
  userRole,
}) => {
  const isPreview = userRole === 'admin' || userRole === 'lecturer';

  return (
    <header className="learning-header-container" role="banner">
      {/* Breadcrumb Navigation & Course Details Return Link */}
      <nav aria-label="مسار التنقل" className="learning-breadcrumb-bar">
        <Link to="/">الرئيسية</Link>
        <span>/</span>
        <Link to="/courses">الدورات</Link>
        <span>/</span>
        <Link to={`/courses/${courseId}`} title="العودة إلى تفاصيل الدورة">
          {courseTitle}
        </Link>
        {currentLessonTitle && (
          <>
            <span>/</span>
            <span style={{ color: '#F1F5F9', fontWeight: 600 }}>{currentLessonTitle}</span>
          </>
        )}
      </nav>

      {/* Progress Bar & Preview Badge */}
      <div className="learning-progress-summary">
        {isPreview && (
          <span
            style={{
              background: 'rgba(234, 179, 8, 0.15)',
              color: '#FACC15',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              padding: '0.2rem 0.6rem',
              borderRadius: '4px',
              fontSize: '0.78rem',
              fontWeight: 600,
            }}
          >
            وضع المعاينة
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#CBD5E1', fontWeight: 500 }}>
            {progressPercent}% مكتمل
          </span>
          <div
            className="learning-progress-track"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="نسبة إنجاز الدورة التدريبية"
          >
            <div
              className="learning-progress-fill"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
        </div>

        <Link
          to={`/courses/${courseId}`}
          className="learning-exit-btn"
          title="العودة إلى صفحة الدورة"
          aria-label="العودة إلى صفحة الدورة"
        >
          <Icon name="arrowRight" size="sm" />
          <span>تفاصيل الدورة</span>
        </Link>
      </div>
    </header>
  );
};
