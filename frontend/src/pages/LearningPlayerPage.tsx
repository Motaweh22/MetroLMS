import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useCourseDetail } from '@/features/courses/hooks/useCourseDetail';
import { useEnrollment } from '@/features/courses/hooks/useEnrollment';
import {
  useCourseProgress,
  useLearningPlayer,
  VideoPlayer,
  DocumentViewer,
  ImageViewer,
  CurriculumSidebar,
  LearningHeader,
  PlayerToolbar,
  CompletionCelebrationModal,
} from '@/features/learning-player';
import { Alert } from '@/shared/ui/Alert/Alert';
import { Icon } from '@/shared/ui/Icon/Icon';
import { ExternalResourcesList } from '@/features/courses/components/ExternalResourcesList';
import { YouTubePlayer } from '@/features/learning-player/components/YouTubePlayer';
import { GoogleDrivePlayer } from '@/features/learning-player/components/GoogleDrivePlayer';
import { mediaStorageService } from '@/core/storage/mediaStorageService';
import { CourseCommentsSection } from '@/features/comments/components/CourseCommentsSection';
import { WhatsAppFloatingFab } from '@/features/whatsapp';
import '@/features/learning-player/styles/learningPlayer.css';

export const LearningPlayerPage: React.FC = () => {
  const { courseId, itemId } = useParams<{ courseId: string; itemId?: string }>();
  const navigate = useNavigate();

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { course, isLoading: courseLoading, isNotFound } = useCourseDetail(courseId);
  const { isEnrolledInCourse, isLoading: enrollmentLoading } = useEnrollment();
  const {
    progress,
    isLoading: progressLoading,
    error: progressError,
    completeLesson,
    isSubmitting,
    updateLocalActivity,
  } = useCourseProgress(courseId);

  const [celebrationOpen, setCelebrationOpen] = useState<boolean>(false);
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string | null>(null);
  const [mediaLoadError, setMediaLoadError] = useState<string | null>(null);

  const isEnrolled = courseId ? isEnrolledInCourse(courseId) : false;

  const {
    flatItems,
    currentItem,
    canGoPrev,
    canGoNext,
    lockedWarning,
    clearLockedWarning,
    selectItem,
    goToPrev,
    goToNext,
  } = useLearningPlayer({
    course,
    progress,
    userRole: user?.role,
    initialItemId: itemId,
    onItemChange: (newItem) => {
      if (courseId) {
        navigate(`/courses/${courseId}/learn/${newItem.id}`, { replace: true });
      }
    },
  });

  // Recreate browser Object URL for persistent IndexedDB media assets
  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    setMediaLoadError(null);

    if (currentItem?.mediaId) {
      mediaStorageService
        .createMediaObjectUrl(currentItem.mediaId)
        .then((url) => {
          if (!active) {
            if (url) mediaStorageService.revokeMediaObjectUrl(url);
            return;
          }
          if (url) {
            createdUrl = url;
            setResolvedMediaUrl(url);
          } else {
            // Media ID was not found in storage (missing record / data cleared)
            setMediaLoadError(
              'عذراً، تعذر العثور على ملف الوسائط في التخزين المحلي للمتصفح (IndexedDB). قد يكون تم مسح بيانات التخزين المؤقتة أو حفظ المقرر من متصفح/جهاز آخر.'
            );
            setResolvedMediaUrl(null);
          }
        })
        .catch(() => {
          if (active) {
            setMediaLoadError('حدث خطأ أثناء قراءة ملف الوسائط من الذاكرة التخزينية للمتصفح.');
            setResolvedMediaUrl(null);
          }
        });
    } else {
      setResolvedMediaUrl(null);
    }

    return () => {
      active = false;
      if (createdUrl) {
        mediaStorageService.revokeMediaObjectUrl(createdUrl);
      }
    };
  }, [currentItem?.id, currentItem?.mediaId]);

  // Handle lesson completion and trigger celebration if course hits 100%
  const handleComplete = useCallback(async (completedItemId: string): Promise<boolean> => {
    const res = await completeLesson(completedItemId);
    if (res) {
      if (res.justCompletedCourse || (res.progress && res.progress.progressPercent === 100)) {
        setCelebrationOpen(true);
      }
      return true;
    }
    return false;
  }, [completeLesson]);

  // 1. Unauthenticated Visitor Guard
  if (!authLoading && !isAuthenticated) {
    const returnUrl = courseId ? `/courses/${courseId}/learn` : '/courses';
    return <Navigate to={`/login?redirect=${encodeURIComponent(returnUrl)}`} replace />;
  }

  // 2. Loading State: Wait for course, progress, and enrollment queries
  if (courseLoading || progressLoading || authLoading || (user?.role === 'user' && enrollmentLoading)) {
    return (
      <div className="learning-player-page" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="video-spinner" style={{ margin: '0 auto 1.5rem' }} />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#E2E8F0' }}>
            جاري تهيئة مشغل التعلم ومحتوى الدورة...
          </h2>
        </div>
      </div>
    );
  }

  // 3. Trainee Enrollment Guard (Non-enrolled trainees cannot access player)
  if (!authLoading && isAuthenticated && user?.role === 'user' && !isEnrolled) {
    return (
      <Navigate
        to={`/courses/${courseId || ''}`}
        replace
        state={{ message: 'عذراً، يجب التسجيل في الدورة التدريبية أولاً للدخول إلى مشغل الدروس.' }}
      />
    );
  }

  // 4. Course Not Found State (404)
  if (isNotFound || !course) {
    return (
      <div className="learning-player-page" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '480px' }}>
          <Icon name="alertCircle" size={48} className="text-warning-dark" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            الدورة التدريبية غير موجودة
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            تعذر العثور على الدورة التدريبية برمز المعرف "{courseId}".
          </p>
          <button
            type="button"
            className="speed-dropdown-btn"
            onClick={() => navigate('/courses')}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}
          >
            العودة إلى دليل الدورات
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="learning-player-page" data-testid="learning-player-page">
      {/* Top Learning Header */}
      <LearningHeader
        courseId={course.id}
        courseTitle={course.title}
        currentLessonTitle={currentItem?.title}
        progressPercent={progress?.progressPercent ?? 0}
        userRole={user?.role}
      />

      {/* Main Learning Workspace */}
      <div className="learning-player-layout" role="region" aria-label="مساحة مشغل التعلم">
        {/* Main Stage Column (Right in RTL) */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Sequential Locking Alert */}
          {lockedWarning && (
            <Alert variant="warning" onClose={clearLockedWarning}>
              {lockedWarning}
            </Alert>
          )}

          {/* Progress Error Alert */}
          {progressError && (
            <Alert variant="danger">
              {progressError}
            </Alert>
          )}

          {/* Persisted Media Missing / Error Alert */}
          {mediaLoadError && (
            <div
              className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs space-y-1"
              role="alert"
              data-testid="persisted-media-missing-error"
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                <Icon name="alertCircle" size={18} />
                <span>تنبيه: ملف الوسائط غير متوفر محلياً</span>
              </div>
              <p className="text-text-muted leading-relaxed">
                {mediaLoadError}
              </p>
            </div>
          )}

          {/* Active Lesson Stage */}
          {currentItem ? (
            currentItem.type === 'video' ? (
              currentItem.videoSourceType === 'youtube' && currentItem.youtubeVideoId ? (
                <YouTubePlayer
                  key={`yt-${currentItem.id}-${currentItem.youtubeVideoId}`}
                  videoId={currentItem.youtubeVideoId}
                  itemId={currentItem.id}
                  title={currentItem.title}
                  isCompleted={currentItem.isCompleted}
                  initialPosition={currentItem.progress?.lastPositionSeconds || 0}
                  embedPolicy={currentItem.embedPolicy}
                  blockPopups={currentItem.embedPolicy?.blockPopups}
                  onComplete={handleComplete}
                  onLocalProgressUpdate={updateLocalActivity}
                />
              ) : currentItem.videoSourceType === 'drive' && currentItem.driveFileId ? (
                <GoogleDrivePlayer
                  driveFileId={currentItem.driveFileId}
                  itemId={currentItem.id}
                  courseId={course.id}
                  title={currentItem.title}
                  duration={currentItem.duration}
                  completionPolicy={currentItem.completionPolicy}
                  isCompleted={currentItem.isCompleted}
                  initialEligibleSeconds={currentItem.progress?.eligibleViewingSeconds || 0}
                  embedPolicy={currentItem.embedPolicy}
                  cropTopPixels={currentItem.embedPolicy?.cropTopPixels}
                  blockPopups={currentItem.embedPolicy?.blockPopups}
                  onComplete={handleComplete}
                  onLocalProgressUpdate={updateLocalActivity}
                />
              ) : (
                <VideoPlayer
                  courseId={course.id}
                  itemId={currentItem.id}
                  src={resolvedMediaUrl || currentItem.url || '/sample-video.mp4'}
                  poster={course.thumbnail}
                  title={currentItem.title}
                  initialPosition={currentItem.progress?.lastPositionSeconds || 0}
                  furthestWatched={currentItem.progress?.furthestWatchedSeconds || 0}
                  isCompleted={currentItem.isCompleted}
                  onComplete={handleComplete}
                  onLocalProgressUpdate={updateLocalActivity}
                />
              )
            ) : currentItem.type === 'image' ? (
              <ImageViewer
                item={resolvedMediaUrl ? { ...currentItem, url: resolvedMediaUrl } : currentItem}
                isCompleted={currentItem.isCompleted}
                isSubmitting={isSubmitting}
                onComplete={handleComplete}
              />
            ) : (
              <DocumentViewer
                item={resolvedMediaUrl ? { ...currentItem, url: resolvedMediaUrl } : currentItem}
                isCompleted={currentItem.isCompleted}
                isSubmitting={isSubmitting}
                onComplete={handleComplete}
              />
            )
          ) : (
            <div className="video-error-state" style={{ background: '#0F172A', borderRadius: '12px' }}>
              <Icon name="info" size={40} className="text-primary-light" />
              <h3>لا يوجد دروس متاحة في هذه الدورة التدريبية</h3>
            </div>
          )}

          {/* Lesson Info Box */}
          {currentItem && (
            <div
              style={{
                background: '#0B1120',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#38BDF8', fontWeight: 600 }}>
                  {currentItem.chapterTitle}
                </span>
                <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                  {currentItem.type === 'video'
                    ? 'محاضرة فيديو'
                    : currentItem.type === 'image'
                    ? 'مخطط توضيحي'
                    : 'مستند إرشادي PDF'}
                </span>
              </div>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#FFFFFF' }}>
                {currentItem.title}
              </h1>
              <p style={{ fontSize: '0.88rem', color: '#CBD5E1', lineHeight: '1.6', margin: 0 }}>
                {course.description}
              </p>
            </div>
          )}

          {/* Lesson External Resources */}
          {currentItem?.externalResources && currentItem.externalResources.length > 0 && (
            <div
              style={{
                background: '#0B1120',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1.25rem',
              }}
              data-testid="lesson-external-resources-section"
            >
              <ExternalResourcesList
                resources={currentItem.externalResources}
                title="المصادر والمراجع المرفقة بهذا الدرس"
                description="روابط إثرائية ومراجع تدريبية خاصة بهذا الدرس للمساعدة في التطبيق والممارسة"
              />
            </div>
          )}

          {/* Bottom Player Navigation Toolbar */}
          <PlayerToolbar
            currentItem={currentItem}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            onGoPrev={goToPrev}
            onGoNext={goToNext}
          />

          {/* Course Discussions & Comments */}
          <div className="mt-4" data-testid="player-comments-wrapper">
            <CourseCommentsSection
              courseId={course.id}
              courseTitle={course.title}
              commentsEnabled={course.commentsEnabled}
              isEnrolled={isEnrolled}
              courseLecturerId={course.lecturerId}
              courseCoLecturers={course.coLecturers}
            />
          </div>
        </section>

        {/* Curriculum Navigation Sidebar (Left in RTL) */}
        <CurriculumSidebar
          chapters={course.chapters}
          flatItems={flatItems}
          currentItemId={currentItem?.id || null}
          onSelectItem={(selectedId) => {
            selectItem(selectedId);
          }}
        />
      </div>

      {/* 100% Course Completion Celebration Modal */}
      <CompletionCelebrationModal
        isOpen={celebrationOpen}
        courseTitle={course.title}
        onClose={() => setCelebrationOpen(false)}
      />

      {/* Context-Aware Floating WhatsApp Contacts */}
      <WhatsAppFloatingFab
        config={{
          context: 'course',
          course: {
            id: course.id,
            title: course.title,
            lecturerId: course.lecturerId,
            lecturerName: course.lecturerName,
            coLecturers: course.coLecturers,
            whatsappContacts: course.whatsappContacts,
          },
        }}
      />
    </div>
  );
};

export default LearningPlayerPage;
