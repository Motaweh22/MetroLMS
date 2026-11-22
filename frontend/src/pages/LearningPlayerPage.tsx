import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Navigate, useSearchParams, useLocation } from 'react-router-dom';
import { getEffectiveRefresherChapters } from '@/core/courses/refresher';
import { canDownloadCourseZip } from '@/core/courses/downloadPolicy';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useRolePreview } from '@/core/auth/useRolePreview';
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
  AttemptContextSelectorModal,
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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlAttemptId = searchParams.get('attemptId') || undefined;
  const urlGroupId = searchParams.get('groupId') || undefined;
  const urlCycleId = searchParams.get('cycleId') || undefined;

  const { previewRole } = useRolePreview();
  const effectiveCourseId = previewRole === 'assistant_lecturer' ? undefined : courseId;
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { course, isLoading: courseLoading, isNotFound } = useCourseDetail(effectiveCourseId);
  const { isEnrolledInCourse, isLoading: enrollmentLoading } = useEnrollment();
  const isEnrolled = courseId ? isEnrolledInCourse(courseId) : false;
  const progressCourseId =
    effectiveCourseId && (user?.role === 'user' || isEnrolled) ? effectiveCourseId : undefined;
  const {
    progress,
    isLoading: progressLoading,
    error: progressError,
    requiresAttemptSelection,
    eligibleAttempts,
    completeLesson,
    isSubmitting,
    updateLocalActivity,
  } = useCourseProgress(progressCourseId, {
    attemptId: urlAttemptId,
    groupId: urlGroupId,
    cycleId: urlCycleId,
  });

  const [celebrationOpen, setCelebrationOpen] = useState<boolean>(false);
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string | null>(null);
  const [mediaLoadError, setMediaLoadError] = useState<string | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState<boolean>(false);
  const [zipDownloadError, setZipDownloadError] = useState<string | null>(null);

  const handleSelectAttempt = useCallback(
    (selectedAttemptId: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('attemptId', selectedAttemptId);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const handleCancelAttemptSelection = useCallback(() => {
    navigate('/courses');
  }, [navigate]);

  const isRefresherContext =
    searchParams.get('version') === 'refresher' ||
    searchParams.get('refresher') === 'true' ||
    (progress as { courseRole?: string } | null)?.courseRole === 'reminder';

  const effectiveCourse = useMemo(() => {
    if (!course) return course;
    if (isRefresherContext && course.refresherConfig?.enabled) {
      return {
        ...course,
        chapters: getEffectiveRefresherChapters(course.chapters, course.refresherConfig),
      };
    }
    return course;
  }, [course, isRefresherContext]);

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
    course: effectiveCourse,
    progress,
    userRole: user?.role,
    initialItemId: itemId,
    onItemChange: (newItem) => {
      if (courseId) {
        navigate(`/courses/${courseId}/learn/${newItem.id}${location.search}`, { replace: true });
      }
    },
  });

  // Resolve backend media URLs directly and fall back to IndexedDB only for legacy local mediaId assets
  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    setMediaLoadError(null);

    const rawUrl = currentItem?.url?.trim();
    const isServerOrRemoteUrl = Boolean(
      rawUrl &&
        (rawUrl.startsWith('/api/') || rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))
    );
    const isBackendAssetId = Boolean(currentItem?.mediaId && /^\d+$/.test(currentItem.mediaId));

    if (isServerOrRemoteUrl && rawUrl) {
      setResolvedMediaUrl(rawUrl);
    } else if (isBackendAssetId && currentItem?.mediaId) {
      setResolvedMediaUrl(`/api/media/assets/${currentItem.mediaId}/stream`);
    } else if (currentItem?.mediaId) {
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
  }, [currentItem?.id, currentItem?.mediaId, currentItem?.url]);

  // Handle lesson completion and trigger celebration if course hits 100%
  const handleComplete = useCallback(async (completedItemId: string): Promise<boolean> => {
    // Review-only guard (MFR-23, MFR-42): Prohibit completion mutations when in review-only mode
    if (progress?.accessMode === 'review_only') {
      return false;
    }
    const res = await completeLesson(completedItemId);
    if (res) {
      if (res.justCompletedCourse || (res.progress && res.progress.progressPercent === 100)) {
        setCelebrationOpen(true);
      }
      return true;
    }
    return false;
  }, [completeLesson, progress?.accessMode]);

  // 1. Unauthenticated Visitor Guard
  if (!authLoading && !isAuthenticated) {
    const returnUrl = courseId ? `/courses/${courseId}/learn` : '/courses';
    return <Navigate to={`/login?redirect=${encodeURIComponent(returnUrl)}`} replace />;
  }

  // Assistant Lecturer Scope Guard: Trainee player interface is out of scope for group assistant lecturers
  if (previewRole === 'assistant_lecturer') {
    return (
      <div className="learning-player-page" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '480px' }} data-testid="player-assistant-denied">
          <Icon name="shield" size={48} className="text-primary-dark" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: '#FFFFFF' }}>
            مشغل الدروس مخصص للمتدربين فقط
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            بصفتك مشرف تدريب / مدرس مساعد للمجموعة، يقتصر نطاق عملك على متابعة أداء المتدربين من شاشة مراقبة المجموعة التدريبية المخصصة.
          </p>
          <button
            type="button"
            className="speed-dropdown-btn"
            onClick={() => navigate('/my-groups')}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}
          >
            العودة لمجموعاتي التدريبية
          </button>
        </div>
      </div>
    );
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
  if (!authLoading && !enrollmentLoading && isAuthenticated && user?.role === 'user' && !isEnrolled) {
    return (
      <Navigate
        to={`/courses/${courseId || ''}`}
        replace
        state={{ message: 'عذراً، يجب التسجيل في الدورة التدريبية أولاً للدخول إلى مشغل الدروس.' }}
      />
    );
  }

  // 3b. Course Access Expired / Revoked Guard (MFR-23, MFR-42)
  if (
    progressError &&
    (progressError.includes('COURSE_ACCESS_EXPIRED') ||
      progressError.includes('انتهت صلاحية الوصول') ||
      progressError.includes('COURSE_ACCESS_REVOKED') ||
      progressError.includes('لم يعد لديك صلاحية الوصول'))
  ) {
    return (
      <div className="learning-player-page" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '480px' }} data-testid="player-access-expired">
          <Icon name="lock" size={48} className="text-danger" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: '#FFFFFF' }}>
            انتهت مهلة المقرر التدريبي
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            {progressError}
          </p>
          <button
            type="button"
            className="speed-dropdown-btn"
            onClick={() => navigate('/my-courses')}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}
          >
            العودة إلى دوراتي التدريبية
          </button>
        </div>
      </div>
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

          {/* Review Only Access Mode Alert */}
          {progress?.accessMode === 'review_only' && (
            <div
              className="p-3.5 rounded-xl bg-warning/10 border border-warning/20 text-warning text-xs flex items-center gap-2.5"
              role="alert"
              data-testid="review-only-access-banner"
            >
              <Icon name="info" size={18} className="shrink-0" />
              <span>
                <strong>وضع المراجعة والاطلاع فقط:</strong> انتهت فترة التدريب النشطة لهذا المسار. يمكنك تصفح ومراجعة المحتوى والدروس، ولكن لا يمكن تسجيل إنجاز دروس جديدة أو الحصول على شهادة جديدة.
              </span>
            </div>
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
                  duration={currentItem.duration !== undefined ? String(currentItem.duration) : undefined}
                  completionPolicy={currentItem.completionPolicy}
                  isCompleted={currentItem.isCompleted}
                  initialEligibleSeconds={currentItem.progress?.eligibleViewingSeconds || 0}
                  embedPolicy={currentItem.embedPolicy}
                  cropTopPixels={currentItem.embedPolicy?.cropTopPixels}
                  blockPopups={currentItem.embedPolicy?.blockPopups}
                  isReadOnly={progress?.accessMode === 'review_only'}
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
                  isReadOnly={progress?.accessMode === 'review_only'}
                  canDownload={Boolean(
                    currentItem.downloadPolicy === 'immediate' ||
                    (currentItem.downloadPolicy === 'after_item_completion' && currentItem.isCompleted) ||
                    (currentItem.downloadPolicy === 'after_course_completion' &&
                      (progress?.progressPercent ?? 0) >= 100) ||
                    (!currentItem.downloadPolicy && currentItem.canDownload)
                  )}
                  onComplete={handleComplete}
                  onLocalProgressUpdate={updateLocalActivity}
                />
              )
            ) : currentItem.type === 'image' ? (
              <ImageViewer
                item={{
                  ...currentItem,
                  url: resolvedMediaUrl || currentItem.url,
                  canDownload: Boolean(
                    currentItem.downloadPolicy === 'immediate' ||
                    (currentItem.downloadPolicy === 'after_item_completion' && currentItem.isCompleted) ||
                    (currentItem.downloadPolicy === 'after_course_completion' &&
                      (progress?.progressPercent ?? 0) >= 100) ||
                    (!currentItem.downloadPolicy && currentItem.canDownload)
                  ),
                }}
                isCompleted={currentItem.isCompleted}
                isSubmitting={isSubmitting}
                isReadOnly={progress?.accessMode === 'review_only'}
                onComplete={handleComplete}
              />
            ) : (
              <DocumentViewer
                item={{
                  ...currentItem,
                  url: resolvedMediaUrl || currentItem.url,
                  canDownload: Boolean(
                    currentItem.downloadPolicy === 'immediate' ||
                    (currentItem.downloadPolicy === 'after_item_completion' && currentItem.isCompleted) ||
                    (currentItem.downloadPolicy === 'after_course_completion' &&
                      (progress?.progressPercent ?? 0) >= 100) ||
                    (!currentItem.downloadPolicy && currentItem.canDownload)
                  ),
                }}
                isCompleted={currentItem.isCompleted}
                isSubmitting={isSubmitting}
                isReadOnly={progress?.accessMode === 'review_only'}
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
              courseLecturerId={course.lecturerId ?? undefined}
              courseCoLecturers={course.coLecturers}
              theme="dark"
            />
          </div>
        </section>

        {/* Curriculum Navigation Sidebar (Left in RTL) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {effectiveCourse?.courseZipPolicy && effectiveCourse.courseZipPolicy !== 'disabled' && (() => {
            const isCourseCompleted =
              (progress?.progressPercent ?? 0) >= 100 ||
              (flatItems.length > 0 && flatItems.every((it) => it.isCompleted));
            const zipPerm = canDownloadCourseZip(
              effectiveCourse,
              isCourseCompleted,
              isEnrolled,
              user?.role
            );
            return (
              <div
                className="p-3 rounded-xl border border-white/10 bg-[#0F172A]/90 flex flex-col gap-2"
                data-testid="course-zip-archive-box"
              >
                {zipPerm.allowed ? (
                  <button
                    type="button"
                    disabled={isDownloadingZip}
                    onClick={async () => {
                      setZipDownloadError(null);
                      setIsDownloadingZip(true);
                      try {
                        const res = await fetch(
                          `/api/courses/${encodeURIComponent(effectiveCourse.id)}/archive-zip`,
                          {
                            method: 'GET',
                            credentials: 'include',
                          }
                        );
                        if (!res.ok) {
                          let errMsg = 'تعذر تنزيل أرشيف الدورة.';
                          try {
                            const errJson = await res.json();
                            errMsg =
                              errJson?.error?.message ||
                              errJson?.message ||
                              errJson?.detail ||
                              errMsg;
                          } catch {
                            // keep default message
                          }
                          setZipDownloadError(errMsg);
                          return;
                        }
                        const blob = await res.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = `${effectiveCourse.title || 'Course'}_Bundle.zip`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
                      } catch {
                        setZipDownloadError('تعذر الاتصال بالخادم لتنزيل الأرشيف.');
                      } finally {
                        setIsDownloadingZip(false);
                      }
                    }}
                    className="w-full py-2.5 px-3 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 disabled:opacity-60 text-sky-300 border border-sky-400/30 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    data-testid="course-zip-download-btn"
                  >
                    <Icon name="download" size="sm" />
                    <span>
                      {isDownloadingZip ? 'جارٍ تحضير وتنزيل الأرشيف...' : 'تنزيل أرشيف الدورة (ZIP)'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    title={zipPerm.reasonAr}
                    className="w-full py-2.5 px-3 rounded-lg border border-white/10 bg-white/5 text-slate-400 text-xs font-bold flex items-center justify-center gap-2 opacity-75 cursor-not-allowed"
                    data-testid="course-zip-download-disabled-btn"
                  >
                    <Icon name="lock" size="sm" />
                    <span>تنزيل أرشيف الدورة (ZIP)</span>
                  </button>
                )}
                {!zipPerm.allowed && zipPerm.reasonAr && (
                  <p className="text-[11px] text-slate-400 text-center leading-snug">
                    {zipPerm.reasonAr}
                  </p>
                )}
                {zipDownloadError && (
                  <p className="text-[11px] text-red-400 text-center leading-snug" role="alert">
                    {zipDownloadError}
                  </p>
                )}
              </div>
            );
          })()}

          <CurriculumSidebar
            chapters={effectiveCourse?.chapters || course.chapters}
            flatItems={flatItems}
            currentItemId={currentItem?.id || null}
            onSelectItem={(selectedId) => {
              selectItem(selectedId);
            }}
          />
        </div>
      </div>

      {/* 100% Course Completion Celebration Modal */}
      <CompletionCelebrationModal
        isOpen={celebrationOpen}
        courseTitle={course.title}
        onClose={() => setCelebrationOpen(false)}
      />

      {/* Attempt Context Selector Modal for Multiple Eligible Grants/Attempts */}
      <AttemptContextSelectorModal
        isOpen={requiresAttemptSelection}
        courseTitle={course.title}
        eligibleAttempts={eligibleAttempts}
        onSelectAttempt={handleSelectAttempt}
        onCancel={handleCancelAttemptSelection}
      />

      {/* Context-Aware Floating WhatsApp Contacts */}
      <WhatsAppFloatingFab
        config={{
          context: 'course',
          course: {
            id: course.id,
            title: course.title,
            lecturerId: course.lecturerId ?? undefined,
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
