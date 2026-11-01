import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCourseDetail } from '@/features/courses/hooks/useCourseDetail';
import { useEnrollCourse } from '@/features/courses/hooks/useEnrollCourse';
import { useAuth } from '@/features/auth';
import { CourseHero } from '@/features/courses/components/CourseHero';
import { CourseCurriculum } from '@/features/courses/components/CourseCurriculum';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Badge } from '@/shared/ui/Badge';
import { Alert } from '@/shared/ui/Alert';
import { ExternalResourcesList } from '@/features/courses/components/ExternalResourcesList';
import { CourseCommentsSection } from '@/features/comments/components/CourseCommentsSection';
import { WhatsAppFloatingFab } from '@/features/whatsapp';
import { ROLE_CANONICAL_LABELS_AR } from '@/core/permissions/types';

export const CourseDetailPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const { course, isLoading, error, isNotFound, refetch } = useCourseDetail(courseId);
  const enrollmentResult = useEnrollCourse(courseId);
  const {
    isEnrolled,
    enrollment,
    isSubmitting,
    isSuccess,
    successMessage,
    error: enrollmentError,
    enroll,
  } = enrollmentResult;

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-full py-8 px-4 sm:px-6 lg:px-8 space-y-6" data-testid="course-detail-loading">
        {/* Back Link Skeleton */}
        <div className="h-5 w-32 bg-border/60 rounded-sm animate-pulse" />

        {/* Hero Skeleton */}
        <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 animate-pulse space-y-4">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-64 h-48 bg-neutral-light rounded-xl shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-24 bg-neutral-light rounded-sm" />
              <div className="h-8 w-3/4 bg-neutral-light rounded-sm" />
              <div className="h-4 w-full bg-neutral-light rounded-sm" />
              <div className="h-4 w-5/6 bg-neutral-light rounded-sm" />
              <div className="h-10 w-48 bg-neutral-light rounded-lg mt-4" />
            </div>
          </div>
        </div>

        {/* Curriculum Skeleton */}
        <div className="bg-surface rounded-xl border border-border p-6 animate-pulse space-y-3">
          <div className="h-6 w-40 bg-neutral-light rounded-sm" />
          <div className="h-12 bg-neutral-light/60 rounded-lg" />
          <div className="h-12 bg-neutral-light/60 rounded-lg" />
        </div>
      </div>
    );
  }

  // Course Not Found (404)
  if (isNotFound || (!course && !error)) {
    return (
      <div className="min-h-full py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-center" data-testid="course-not-found">
        <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-full bg-danger-light text-danger-dark flex items-center justify-center mx-auto">
            <Icon name="alertCircle" size="xl" />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold text-text-heading">
              الدورة التدريبية غير موجودة
            </h1>
            <p className="text-sm text-text-muted">
              لم يتم العثور على أي برنامج تدريبي بالرمز المعرف{' '}
              <span className="font-mono text-primary-dark font-semibold">"{courseId}"</span>. قد يكون الرابط غير صحيح أو تم نقل المحتوى.
            </p>
          </div>

          <div className="pt-2">
            <Link to="/courses">
              <Button variant="primary" leftIcon="arrowRight" className="w-full justify-center">
                العودة إلى دليل الدورات التدريبية
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Error State (Network / Server failure)
  if (error || !course) {
    return (
      <div className="min-h-full py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-center" data-testid="course-detail-error">
        <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-full bg-danger-light text-danger-dark flex items-center justify-center mx-auto">
            <Icon name="alertCircle" size="xl" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-text-heading">تعذر تحميل بيانات الدورة</h2>
            <p className="text-sm text-text-muted">{error || 'حدث خطأ أثناء الاتصال بالخادم.'}</p>
          </div>

          <div className="flex items-center gap-3 justify-center pt-2">
            <Button variant="outline" leftIcon="refresh" onClick={refetch}>
              إعادة المحاولة
            </Button>
            <Link to="/courses">
              <Button variant="ghost" leftIcon="arrowRight">
                دليل الدورات
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success State
  return (
    <div className="min-h-full py-6 px-4 sm:px-6 lg:px-8 space-y-6" data-testid="course-detail-page">
      {/* Return to Catalog navigation */}
      <div>
        <Link
          to="/courses"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-primary-dark transition-colors py-1 px-2 -mr-2 rounded-md hover:bg-neutral-light"
          aria-label="العودة إلى دليل الدورات التدريبية"
        >
          <Icon name="arrowRight" size="sm" />
          <span>العودة إلى دليل الدورات</span>
        </Link>
      </div>

      {/* Main Course Hero Banner */}
      <CourseHero course={course} enrollmentState={enrollmentResult} />

      {/* Detailed Course Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Curriculum / Syllabus */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prerequisites Section (if any defined) */}
          {((course.knowledgePrerequisites && course.knowledgePrerequisites.length > 0) ||
            (course.prerequisiteCourseIds && course.prerequisiteCourseIds.length > 0) ||
            course.prerequisiteCourseId) && (
            <div className="bg-surface rounded-xl border border-border p-5 space-y-4 shadow-xs" data-testid="detail-prerequisites-card">
              <div className="flex items-center gap-2 text-text-heading font-bold text-sm">
                <Icon name="bookOpen" size="sm" className="text-primary-dark" />
                <span>متطلبات ومقدمات الالتحاق بالدورة</span>
              </div>

              {/* Free-text Knowledge Prerequisites */}
              {course.knowledgePrerequisites && course.knowledgePrerequisites.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-text-muted block">
                    المتطلبات المعرفية والمهارات الموصى بها:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {course.knowledgePrerequisites.map((req, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-light text-text-heading border border-border text-xs font-medium"
                      >
                        <span>● {req}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Prerequisite Courses */}
              {((course.prerequisiteCourseIds && course.prerequisiteCourseIds.length > 0) || course.prerequisiteCourseId) && (
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <span className="text-xs font-semibold text-text-muted block">
                    المقررات التدريبية السابقة المعتمدة:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(course.prerequisiteCourseIds || [course.prerequisiteCourseId!]).map((cId) => (
                      <Link
                        key={cId}
                        to={`/courses/${cId}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary-dark border border-primary/20 text-xs font-bold transition-colors"
                      >
                        <Badge variant="primary" className="text-[10px] font-mono">
                          {cId}
                        </Badge>
                        <span>استعراض المقرر السابق ↗</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Course Curriculum Accordion */}
          <CourseCurriculum chapters={course.chapters} />

          {/* Course-Level External Resources */}
          {course.externalResources && course.externalResources.length > 0 && (
            <div className="bg-surface rounded-xl border border-border p-5 shadow-xs" data-testid="detail-course-resources-card">
              <ExternalResourcesList
                resources={course.externalResources}
                title="المصادر والمراجع التعليمية للبرنامج"
                description="وثائق رسمية، أدوات تثبيت، ومراجع موجهة لمتدربي هذا المقرر"
              />
            </div>
          )}

          {/* Course Discussions & Comments */}
          <CourseCommentsSection
            courseId={course.id}
            courseTitle={course.title}
            commentsEnabled={course.commentsEnabled}
            isEnrolled={isEnrolled}
            courseLecturerId={course.lecturerId}
            courseCoLecturers={course.coLecturers}
          />
        </div>

        {/* Right Column (1 Col): Course Info & Target Audience */}
        <div className="space-y-6">
          {/* Target Roles Card */}
          {course.targetJobTitles && course.targetJobTitles.length > 0 && (
            <div className="bg-surface rounded-xl border border-border p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-text-heading font-bold text-sm">
                <Icon name="trainingGroups" size="sm" className="text-primary-dark" />
                <span>الوظائف والمهن المستهدفة</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                هذا البرنامج مخصص للكوادر الفنية والإدارية العاملة بالوظائف التالية:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {course.targetJobTitles.map((role, idx) => (
                  <Badge key={idx} variant="info" className="text-xs py-1 px-2.5">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Academic / Lecturer Profile Card */}
          <div className="bg-surface rounded-xl border border-border p-5 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-text-heading font-bold text-sm">
              <Icon name="user" size="sm" className="text-primary-dark" />
              <span>المحاضر المعتمد</span>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <div className="w-11 h-11 rounded-full bg-primary/10 text-primary-dark font-extrabold flex items-center justify-center text-sm shrink-0 border border-primary/20">
                {course.lecturerName.slice(0, 2)}
              </div>
              <div>
                <h4 className="text-sm font-bold text-text-heading">{course.lecturerName}</h4>
                <p className="text-xs text-text-muted">مركز تدريب مترو القاهرة المعتمد</p>
              </div>
            </div>
          </div>

          {/* Course Enrollment & Program Status Card */}
          <div className="bg-surface rounded-xl border border-border p-5 space-y-4 shadow-xs" data-testid="course-enrollment-card">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2 text-text-heading font-bold text-sm">
                <Icon name="fileText" size="sm" className="text-primary-dark" />
                <span>حالة البرنامج في المنظومة</span>
              </div>
              {isEnrolled && (
                <Badge variant="success" icon="checkCircle">
                  مسجل
                </Badge>
              )}
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              هذا البرنامج متاح للاستعراض والقراءة الكاملة لجميع الفصول والوحدات التدريبية المعتمدة.
            </p>

            {/* Error Feedback */}
            {enrollmentError && (
              <Alert variant="danger" title="تعذر إتمام التسجيل">
                <div className="space-y-2">
                  <p>{enrollmentError}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon="refresh"
                    onClick={() => enroll()}
                    disabled={isSubmitting}
                  >
                    إعادة المحاولة
                  </Button>
                </div>
              </Alert>
            )}

            {/* Success Feedback */}
            {isSuccess && (
              <Alert variant="success" title="تم التسجيل بنجاح">
                <p>{successMessage || 'تم تسجيلك بنجاح في هذه الدورة التدريبية!'}</p>
              </Alert>
            )}

            {/* State: Trainee & Enrolled */}
            {user?.role === 'user' && isEnrolled ? (
              <div className="space-y-3" data-testid="already-enrolled-section">
                <div className="bg-success-light/60 border border-success/20 rounded-lg p-3 text-xs text-success-dark flex items-start gap-2.5">
                  <Icon name="checkCircle" size="sm" className="text-success shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="font-bold block" data-testid="enrolled-status-heading">
                      {isSuccess
                        ? 'تم تأكيد تسجيلك في الدورة التدريبية بنجاح'
                        : 'أنت مسجل بالفعل في هذه الدورة التدريبية'}
                    </strong>
                    <p className="text-text-muted text-[11px] leading-relaxed" data-testid="enrolled-status-description">
                      {isSuccess
                        ? 'أصبحت الدورة متاحة الآن ضمن خطتك التدريبية بالمنظومة.'
                        : enrollment?.enrolledAt
                          ? `تاريخ التسجيل: ${new Date(enrollment.enrolledAt).toLocaleDateString('ar-EG', { dateStyle: 'long' })}`
                          : 'تم تسجيلك في هذه الدورة بالمنظومة التدريبية.'}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  leftIcon="check"
                  disabled
                  className="w-full justify-center text-success border-success/30 bg-success/5 cursor-default"
                >
                  مسجل في الدورة التدريبية
                </Button>

                <Link to={`/courses/${course.id}/learn`} className="block">
                  <Button
                    variant="primary"
                    leftIcon="play"
                    className="w-full justify-center font-bold"
                  >
                    متابعة التعلم
                  </Button>
                </Link>
              </div>
            ) : null}

            {/* State: Trainee & Not Enrolled */}
            {user?.role === 'user' && !isEnrolled ? (
              <div className="space-y-3">
                <p className="text-xs text-text-muted leading-relaxed">
                  سجل الآن للوصول الكامل إلى محتويات الحقيبة التدريبية والمحاضرات المقررة ضمن خطتك التدريبية.
                </p>

                <Button
                  data-testid="enroll-course-button"
                  variant="primary"
                  leftIcon={isSubmitting ? undefined : 'plus'}
                  isLoading={isSubmitting}
                  disabled={isSubmitting}
                  onClick={() => enroll()}
                  className="w-full justify-center font-bold"
                >
                  {isSubmitting ? 'جاري إتمام التسجيل...' : 'التسجيل في الدورة'}
                </Button>

                <div className="flex items-center gap-1.5 text-[11px] text-text-muted pt-1">
                  <Icon name="info" size="sm" className="text-primary-dark shrink-0" />
                  <span>التسجيل متاح لكافة المتدربين المستوفين لشروط البرنامج.</span>
                </div>
              </div>
            ) : null}

            {/* State: Lecturer or Administrator */}
            {user?.role !== 'user' && (
              <div className="bg-neutral-light rounded-lg p-3.5 space-y-2 text-xs text-text-muted">
                <div className="flex items-center gap-1.5 text-text font-bold">
                  <Icon
                    name={user?.role === 'lecturer' ? 'user' : 'shield'}
                    size="sm"
                    className="text-primary-dark"
                  />
                  <span>
                    {user ? `صلاحيات ${ROLE_CANONICAL_LABELS_AR[user.role] || user.role}` : 'معاينة غير مصرح بها'}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  حسابك الحالي مخصص للاستعراض والإشراف الإداري على المناهج. التسجيل متاح فقط لحسابات المتدربين.
                </p>

                <Link to={`/courses/${course.id}/learn`} className="block pt-1">
                  <Button
                    variant="primary"
                    leftIcon="eye"
                    className="w-full justify-center font-bold"
                  >
                    معاينة محتوى الدورة
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

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

export default CourseDetailPage;
