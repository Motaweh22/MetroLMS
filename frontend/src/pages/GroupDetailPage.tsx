import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { groupsApi, type EnrichedTrainingGroup } from '@/features/groups/services/groupsApi';
import { GroupMaterialsTab } from '@/features/groups/components';
import { useAuth } from '@/features/auth';
import { Card, CardContent } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { Alert } from '@/shared/ui/Alert';
import { useToast } from '@/shared/ui/Toast';
import {
  isMeetingResource,
  detectMeetingPlatform,
  MEETING_PLATFORMS,
} from '@/features/groups/utils/meetingUtils';
import { WhatsAppFloatingFab } from '@/features/whatsapp';

export const GroupDetailPage: React.FC = () => {
  const toast = useToast();
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const [group, setGroup] = useState<EnrichedTrainingGroup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  const loadGroupDetails = useCallback(async () => {
    if (!groupId) return;
    try {
      setIsLoading(true);
      setError(null);
      setIsForbidden(false);
      const data = await groupsApi.getGroupById(groupId);
      setGroup(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'تعذر تحميل بيانات المجموعة';
      if (
        message.includes('403') ||
        message.includes('غير مصرح') ||
        message.includes('أنت لست عضواً')
      ) {
        setIsForbidden(true);
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadGroupDetails();
  }, [loadGroupDetails]);

  // 403 Forbidden State
  if (isForbidden) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6" data-testid="group-forbidden">
        <Link to="/my-groups">
          <Button variant="ghost" size="sm" leftIcon="arrowRight" className="text-text-muted hover:text-text">
            ← العودة إلى قائمة المجموعات
          </Button>
        </Link>
        <Card variant="default" className="text-center py-12 px-6 border-danger/30 bg-danger-light/10">
          <div className="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-4">
            <Icon name="lock" size="xl" />
          </div>
          <h1 className="text-2xl font-bold text-text-heading mb-2">غير مصرح لك بالوصول إلى هذه المجموعة</h1>
          <p className="text-sm text-text-muted max-w-md mx-auto leading-relaxed mb-6">
            عذراً، المجموعة التدريبية المطلوبة مخصصة لدفعات أخرى أو فنيين محددين، ولا تملك صلاحية الاطلاع على بياناتها أو مواردها الخاصة.
          </p>
          <Link to="/my-groups">
            <Button variant="primary" size="md">
              الرجوع إلى مجموعاتي المخصصة
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  // Loading Skeleton
  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto" aria-busy="true">
        <div className="h-6 bg-neutral-light rounded w-1/4 animate-pulse" />
        <Card variant="elevated" className="p-6 space-y-4 animate-pulse">
          <div className="h-8 bg-neutral-light rounded w-1/2" />
          <div className="h-4 bg-neutral-light rounded w-3/4" />
          <div className="h-20 bg-neutral-light rounded w-full" />
        </Card>
      </div>
    );
  }

  // Error State (non-403)
  if (error || !group) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <Link to="/my-groups">
          <Button variant="ghost" size="sm" leftIcon="arrowRight">
            ← العودة إلى قائمة المجموعات
          </Button>
        </Link>
        <Alert variant="danger" title="خطأ في تحميل تفاصيل المجموعة">
          <div className="flex items-center justify-between gap-4">
            <span>{error || 'المجموعة غير موجودة'}</span>
            <Button variant="outline" size="sm" onClick={loadGroupDetails}>
              إعادة المحاولة
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  const metrics = group.metrics;
  const statusKey = metrics?.status || 'active';
  const statusBadgeVariant =
    statusKey === 'active' ? 'primary' : statusKey === 'scheduled' ? 'neutral' : 'danger';
  const statusLabel =
    statusKey === 'active'
      ? 'نشطة — قيد التدريب'
      : statusKey === 'scheduled'
      ? 'مجدولة'
      : 'منتهية الصلاحية';

  // Find current trainee's specific metrics
  const myMetrics = metrics?.traineeMetricsList.find(
    (tm) => tm.userId.toLowerCase() === (user?.id || '').toLowerCase()
  );

  const programPercent = myMetrics?.programPercent ?? 0;
  const completedLessonsTotal = myMetrics?.completedLessonsTotal ?? 0;
  const totalRequiredLessons = myMetrics?.totalRequiredLessons ?? 0;
  const attention = myMetrics?.worstAttention;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto" data-testid="group-detail-page">
      {/* Breadcrumb / Back button */}
      <div>
        <Link to="/my-groups">
          <Button variant="ghost" size="sm" className="text-text-muted hover:text-text font-medium text-xs">
            ← العودة إلى قائمة المجموعات التدريبية
          </Button>
        </Link>
      </div>

      {/* Header Card */}
      <Card variant="elevated" className="border-border">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge variant={statusBadgeVariant} className="text-xs font-bold gap-1 px-3 py-1">
                <Icon
                  name={statusKey === 'active' ? 'activity' : statusKey === 'scheduled' ? 'calendar' : 'clock'}
                  size="sm"
                />
                <span>{statusLabel}</span>
              </Badge>
              <Badge variant="neutral" className="text-xs font-mono">
                {group.id}
              </Badge>
            </div>

            {metrics && (
              <span className="text-xs text-text-muted font-bold flex items-center gap-1.5 bg-neutral-light px-3 py-1.5 rounded-md">
                <Icon name="clock" size="sm" />
                <span>المهلة المتبقية: {metrics.timeRemainingText}</span>
              </span>
            )}
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-heading leading-tight">
              {group.name}
            </h1>
            <p className="text-sm text-text-muted mt-2 leading-relaxed max-w-3xl">
              {group.description}
            </p>
          </div>

          {/* Attention Notice if any */}
          {attention && attention.needsAttention && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-danger-light/60 border border-danger/40 text-danger-dark text-xs sm:text-sm font-semibold">
              <Icon name="alert" size="md" className="shrink-0" />
              <span>{attention.reason}</span>
            </div>
          )}

          {/* Overall Program Progress Bar */}
          <div className="pt-2 border-t border-border/60 space-y-2">
            <div className="flex items-center justify-between text-xs sm:text-sm font-semibold text-text-heading">
              <span className="flex items-center gap-2">
                <Icon name="checkmark" size="sm" className="text-success" />
                <span>إجمالي تقدمك في مقررات المجموعة</span>
              </span>
              <span className="font-bold text-primary">
                {programPercent}% ({completedLessonsTotal} من أصل {totalRequiredLessons} درساً)
              </span>
            </div>
            <ProgressBar
              value={programPercent}
              variant={programPercent === 100 ? 'success' : 'primary'}
              size="lg"
            />
          </div>
        </CardContent>
      </Card>

      {/* Resources Sections: المواد المرفقة واللقاءات التفاعلية (Above Assigned Courses) */}
      {(() => {
        const allResources = group.resources || [];
        const attachments = allResources.filter((r) => !isMeetingResource(r));
        const meetings = allResources.filter((r) => isMeetingResource(r));

        return (
          <div className="space-y-6 pt-2" data-testid="group-resources-section">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-3">
              <div>
                <h2 className="text-xl font-bold text-text-heading flex items-center gap-2">
                  <Icon name="attachment" size="md" className="text-primary" />
                  <span>المواد المرفقة واللقاءات التفاعلية</span>
                </h2>
                <p className="text-xs text-text-muted mt-1">
                  المستندات الإرشادية والروابط المباشرة للقاءات التفاعلية المخصصة لأعضاء هذه المجموعة.
                </p>
              </div>
              <span className="text-xs text-text-muted font-medium">
                {allResources.length} عنصر
              </span>
            </div>

            {/* Sub-section 1: المواد المرفقة */}
            <div className="space-y-3" data-testid="group-attachments-section">
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <Icon name="file" size="sm" className="text-primary" />
                <span>المواد المرفقة</span>
              </h3>
              {attachments.length === 0 ? (
                <Card
                  variant="default"
                  className="p-6 text-center text-text-muted text-xs border-dashed"
                  data-testid="attachments-empty-state"
                >
                  لا توجد مواد تدريبية أو ملفات مرفقة بهذه المجموعة حالياً.
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {attachments.map((res) => {
                    const isPdf = res.type === 'pdf' || res.url.endsWith('.pdf');
                    return (
                      <Card
                        key={res.id}
                        variant="default"
                        className="p-5 flex flex-col justify-between space-y-4 bg-surface hover:border-primary/40 transition-colors"
                        data-testid={`attachment-card-${res.id}`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <Badge variant="neutral" className="text-xs gap-1">
                              <Icon name="attachment" size="sm" />
                              <span>{isPdf ? 'مستند PDF تدريبي' : 'دليل ومستند تدريبي'}</span>
                            </Badge>
                            <span className="text-[11px] font-bold text-warning-dark bg-warning-light/40 px-2 py-0.5 rounded">
                              بيانات استرشادية للعرض التجريبي
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-text-heading">{res.title}</h4>
                          {res.description && (
                            <p className="text-xs text-text-muted leading-relaxed">{res.description}</p>
                          )}
                        </div>
                        <div className="pt-2 border-t border-border/40">
                          <a href={res.url} target="_blank" rel="noopener noreferrer" className="inline-block">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs font-bold gap-1.5"
                              leftIcon="download"
                              data-testid={`download-attachment-btn-${res.id}`}
                            >
                              {isPdf ? 'تحميل كتيب الطوارئ' : 'تحميل المستند'}
                            </Button>
                          </a>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sub-section 2: اللقاءات التفاعلية */}
            <div className="space-y-3" data-testid="group-meetings-section">
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <Icon name="video" size="sm" className="text-primary" />
                <span>اللقاءات التفاعلية</span>
              </h3>
              {meetings.length === 0 ? (
                <Card
                  variant="default"
                  className="p-6 text-center text-text-muted text-xs border-dashed"
                  data-testid="meetings-empty-state"
                >
                  لا توجد لقاءات تفاعلية مجدولة لهذه المجموعة حالياً.
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {meetings.map((res) => {
                    const platform = detectMeetingPlatform(res.url, res.type);
                    const meta = MEETING_PLATFORMS[platform];
                    const platformLabel = platform === 'teams' ? 'Teams' : platform === 'zoom' ? 'Zoom' : platform === 'meet' ? 'Google Meet' : meta.shortLabel;

                    return (
                      <Card
                        key={res.id}
                        variant="default"
                        className="p-5 flex flex-col justify-between space-y-4 bg-surface hover:border-primary/40 transition-colors"
                        data-testid={`meeting-card-${res.id}`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <Badge variant={meta.badgeVariant} className="text-xs gap-1">
                              <Icon name="video" size="sm" />
                              <span>لقاء تفاعلي {platformLabel}</span>
                            </Badge>
                            <span className="text-[11px] font-bold text-warning-dark bg-warning-light/40 px-2 py-0.5 rounded">
                              بيانات استرشادية للعرض التجريبي
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-text-heading">{res.title}</h4>
                          {res.description && (
                            <p className="text-xs text-text-muted leading-relaxed">{res.description}</p>
                          )}
                        </div>
                        <div className="pt-2 border-t border-border/40">
                          {(() => {
                            const handleJoinClick = (e: React.MouseEvent) => {
                              if (
                                res.url.startsWith('#') ||
                                res.url.includes('teams.microsoft.com') ||
                                res.url.includes('zoom.us') ||
                                res.url.includes('meet.google.com')
                              ) {
                                e.preventDefault();
                                e.stopPropagation();
                                toast.info(`هذا رابط تجريبي تمثيلي لجلسة التدريب الميدانية عبر ${meta.label}.`, {
                                  title: 'رابط تدريب تجريبي',
                                  duration: 5000,
                                });
                              }
                            };

                            return (
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block"
                                onClick={handleJoinClick}
                              >
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="text-xs font-bold gap-1.5"
                                  leftIcon="video"
                                  onClick={handleJoinClick}
                                  data-testid={`join-meeting-btn-${res.id}`}
                                >
                                  الانضمام للقاء التجريبي
                                </Button>
                              </a>
                            );
                          })()}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Assigned Courses Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-heading flex items-center gap-2">
            <Icon name="courses" size="md" className="text-primary" />
            <span>المقررات التدريبية المخصصة ({group.courses.length})</span>
          </h2>
          <span className="text-xs text-text-muted">
            مسارات تدريبية إلزامية ومقرونة بالدورة الميدانية
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {metrics?.assignedCoursesMetrics.map((ac) => {
            const courseUserProgress = myMetrics?.courseProgressMap?.[ac.courseId];
            const coursePercent = courseUserProgress?.percent ?? 0;
            const completedCount = courseUserProgress?.completedLessons ?? 0;
            const totalCount = ac.totalRequiredLessons;
            const isCompleted = courseUserProgress?.isCompleted ?? false;

            return (
              <Card
                key={ac.courseId}
                variant="default"
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5 bg-surface hover:border-primary/40 transition-colors"
              >
                <div className="space-y-2 sm:max-w-md">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral" className="text-xs font-mono">
                      {ac.courseId}
                    </Badge>
                    {isCompleted ? (
                      <Badge variant="primary" className="text-xs font-bold gap-1">
                        <Icon name="checkmark" size="sm" />
                        <span>مكتمل</span>
                      </Badge>
                    ) : (
                      <Badge variant="neutral" className="text-xs">
                        {coursePercent > 0 ? 'قيد التدريب' : 'لم يبدأ بعد'}
                      </Badge>
                    )}
                    {ac.effective.hasDeadlineOverride && (
                      <Badge variant="warning" className="text-[11px]">
                        موعد مخصص
                      </Badge>
                    )}
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-text-heading">
                    {ac.courseTitle}
                  </h3>

                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span>
                      المهلة: {new Date(ac.effective.deadlineDateTime).toLocaleDateString('ar-EG')}
                    </span>
                    <span>•</span>
                    <span>المتبقي: {ac.timeRemainingText}</span>
                  </div>
                </div>

                {/* Progress Bar & Action */}
                <div className="sm:w-64 space-y-3 shrink-0">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>الإنجاز</span>
                      <span className="font-bold text-text-heading">
                        {coursePercent}% ({completedCount}/{totalCount})
                      </span>
                    </div>
                    <ProgressBar
                      value={coursePercent}
                      variant={isCompleted ? 'success' : 'primary'}
                      size="sm"
                    />
                  </div>

                  <Link to={`/courses/${ac.courseId}/learn`} className="block w-full">
                    <Button
                      variant={isCompleted ? 'outline' : 'primary'}
                      size="sm"
                      className="w-full font-bold text-xs"
                      rightIcon={isCompleted ? 'courses' : 'arrowLeft'}
                    >
                      {isCompleted ? 'مراجعة محتوى المقرر' : coursePercent > 0 ? 'متابعة الدورة التدريبية' : 'بدء المقرر الآن'}
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Group Materials Library (Phase 7 - Read-only for Trainees) */}
      <div className="space-y-4 pt-2" data-testid="trainee-group-materials-section">
        <GroupMaterialsTab groupId={group.id} group={group} readOnly={true} />
      </div>

      {/* Context-Aware Floating WhatsApp Contacts for Group Supervisors */}
      <WhatsAppFloatingFab
        config={{
          context: 'group',
          group: {
            id: group.id,
            name: group.name,
            supervisorIds: group.supervisorIds,
            traineeIds: group.traineeIds,
          },
        }}
      />
    </div>
  );
};

export default GroupDetailPage;
