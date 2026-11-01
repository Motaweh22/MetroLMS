import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { useNotifications } from '@/features/notifications';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge, type BadgeVariant } from '@/shared/ui/Badge';
import { Icon, type SemanticIconName } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import type { NotificationItem, NotificationType } from '@/core/notifications/types';

const NOTIFICATION_TYPE_LABELS_AR: Record<NotificationType, string> = {
  enrollment_approved: 'قبول التسجيل',
  enrollment_rejected: 'رفض طلب الانضمام',
  new_course_suggested: 'اقتراح مقرر تدريبي',
  new_comment: 'تعليق ونقاش جديد',
  forced_enrollment: 'تعيين مسار تدريبي',
  content_pending_review: 'محتوى بانتظار المراجعة',
  content_approved: 'اعتماد ونشر المقرر',
  content_rejected: 'ملاحظات مراجعة المقرر',
  new_registration_request: 'طلب اعتماد حساب',
  enrollment_request: 'طلب انضمام للمجموعة',
  deadline_reminder: 'تذكير بالموعد النهائي',
  general_alert: 'تنبيه إداري',
  group_renewed: 'تجديد البرنامج التدريبي',
  group_archived: 'أرشفة مجموعة تدريبية',
  instructor_assigned: 'تعيين بطاقم التدريب',
  group_updated: 'تحديث بيانات المجموعة',
  course_completed: 'إتمام مقرر تدريبي',
};

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    loadNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'unread') return !item.read;
    return true;
  });

  const handleMarkAllRead = async () => {
    try {
      setIsMarkingAll(true);
      setActionError(null);
      await markAllAsRead();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'تعذر تحديث جميع الإشعارات');
    } finally {
      setIsMarkingAll(false);
    }
  };

  const resolveNotificationDestination = (notif: NotificationItem): string | null => {
    const role = user?.role || 'user';
    const explicitUrl = notif.targetUrl?.trim() || null;

    if (explicitUrl) {
      // Guard role boundaries so recipients are never navigated to unauthorized routes
      if (role === 'user' && (explicitUrl.startsWith('/admin') || explicitUrl.startsWith('/lecturer'))) {
        if (notif.type === 'enrollment_rejected') return '/my-groups';
        if (notif.groupId) return `/my-groups/${encodeURIComponent(notif.groupId)}`;
        if (notif.courseId) return `/courses/${encodeURIComponent(notif.courseId)}`;
        return '/my-groups';
      }
      if (role === 'lecturer') {
        if (explicitUrl.startsWith('/admin/review/') && notif.courseId) {
          return `/courses/${encodeURIComponent(notif.courseId)}`;
        }
        if (explicitUrl.endsWith('/edit') && notif.groupId) {
          return `/admin/groups/${encodeURIComponent(notif.groupId)}/monitoring`;
        }
        if (explicitUrl.startsWith('/admin/users')) {
          return '/lecturer/courses';
        }
      }
      return explicitUrl;
    }

    if (notif.type === 'enrollment_request' && notif.groupId && role !== 'user') {
      return `/admin/groups/${encodeURIComponent(notif.groupId)}/monitoring?tab=requests`;
    }

    if (notif.type === 'enrollment_rejected' && role === 'user') {
      return '/my-groups';
    }

    if (notif.groupId) {
      if (role === 'user') {
        return `/my-groups/${encodeURIComponent(notif.groupId)}`;
      }
      return `/admin/groups/${encodeURIComponent(notif.groupId)}/monitoring`;
    }

    if (notif.type === 'content_pending_review' && notif.courseId && (role === 'admin' || role === 'assistant_admin')) {
      return `/admin/review/${encodeURIComponent(notif.courseId)}`;
    }

    if (notif.type === 'content_rejected' && notif.courseId && (role === 'lecturer' || role === 'admin')) {
      return `/lecturer/builder/${encodeURIComponent(notif.courseId)}`;
    }

    if (notif.courseId) {
      return `/courses/${encodeURIComponent(notif.courseId)}`;
    }

    if (notif.type === 'new_registration_request' && (role === 'admin' || role === 'assistant_admin')) {
      return '/admin/users';
    }

    return null;
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    try {
      setActionError(null);
      if (!notif.read) {
        await markAsRead(notif.id);
      }
      const targetPath = resolveNotificationDestination(notif);
      if (targetPath) {
        navigate(targetPath);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'تعذر تحديث حالة الإشعار');
    }
  };

  const getNotificationIcon = (type: string): SemanticIconName => {
    switch (type) {
      case 'enrollment_approved':
      case 'content_approved':
      case 'course_completed':
        return 'checkCircle';
      case 'enrollment_rejected':
      case 'content_rejected':
        return 'alertCircle';
      case 'deadline_reminder':
        return 'clock';
      case 'general_alert':
      case 'warning':
      case 'alert':
        return 'alert';
      case 'new_course_suggested':
      case 'forced_enrollment':
      case 'content_pending_review':
      case 'course_assigned':
      case 'course':
        return 'courses';
      case 'enrollment_request':
      case 'group_renewed':
      case 'group_archived':
      case 'instructor_assigned':
      case 'group_updated':
      case 'group':
        return 'trainingGroups';
      case 'new_comment':
        return 'chat';
      case 'new_registration_request':
        return 'user';
      default:
        return 'notifications';
    }
  };

  const getNotificationVariant = (type: string): BadgeVariant => {
    switch (type) {
      case 'enrollment_approved':
      case 'content_approved':
      case 'course_completed':
        return 'success';
      case 'deadline_reminder':
      case 'content_pending_review':
      case 'enrollment_request':
      case 'new_registration_request':
      case 'warning':
        return 'warning';
      case 'enrollment_rejected':
      case 'content_rejected':
      case 'general_alert':
      case 'danger':
      case 'alert':
        return 'danger';
      case 'group_renewed':
      case 'instructor_assigned':
      case 'forced_enrollment':
      case 'new_course_suggested':
      case 'group_updated':
        return 'primary';
      case 'new_comment':
        return 'info';
      default:
        return 'neutral';
    }
  };

  const getNotificationTypeLabel = (type: string): string => {
    return NOTIFICATION_TYPE_LABELS_AR[type as NotificationType] || type;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto" data-testid="notifications-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-heading flex items-center gap-3">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Icon name="notifications" size="lg" />
            </span>
            <span>مركز التنبيهات والإشعارات</span>
          </h1>
          <p className="text-sm text-text-muted mt-1">
            متابعة المهام التدريبية، مواعيد الدورات الميدانية، وتحديثات المسارات المخصصة لك.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            leftIcon="check"
            onClick={handleMarkAllRead}
            disabled={isMarkingAll || isLoading}
            className="text-xs font-bold self-start sm:self-auto shrink-0"
            data-testid="mark-all-read-btn"
          >
            {isMarkingAll ? 'جاري التحديث...' : 'تحديد الكل كمقروء'}
          </Button>
        )}
      </div>

      {/* Global / Action Alerts */}
      {error && (
        <Alert variant="danger" title="خطأ في تحميل الإشعارات">
          <div className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={loadNotifications}>
              إعادة المحاولة
            </Button>
          </div>
        </Alert>
      )}

      {actionError && (
        <Alert variant="warning" title="تنبيه">
          <span>{actionError}</span>
        </Alert>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
            filter === 'all'
              ? 'bg-primary text-white shadow-xs'
              : 'text-text-muted hover:text-text hover:bg-neutral-light'
          }`}
          data-testid="tab-all-notifications"
        >
          <span>جميع الإشعارات</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] ${
              filter === 'all' ? 'bg-white/20 text-white' : 'bg-neutral-light text-text-muted'
            }`}
          >
            {notifications.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
            filter === 'unread'
              ? 'bg-primary text-white shadow-xs'
              : 'text-text-muted hover:text-text hover:bg-neutral-light'
          }`}
          data-testid="tab-unread-notifications"
        >
          <span>غير مقروءة فقط</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] ${
              filter === 'unread' ? 'bg-white/20 text-white' : 'bg-neutral-light text-text-muted'
            }`}
          >
            {unreadCount}
          </span>
        </button>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-3" aria-busy="true">
          {[1, 2, 3].map((n) => (
            <Card key={n} variant="elevated" className="p-4 space-y-2 animate-pulse">
              <div className="h-4 bg-neutral-light rounded w-3/4" />
              <div className="h-3 bg-neutral-light rounded w-1/2" />
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredNotifications.length === 0 && (
        <Card variant="default" className="text-center py-12 px-6 border-dashed">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Icon name="notifications" size="lg" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-text-heading">
              {filter === 'unread' ? 'لا توجد إشعارات غير مقروءة' : 'صندوق الإشعارات فارغ'}
            </h3>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
              {filter === 'unread'
                ? 'لقد اطلعت على جميع التنبيهات الموجهة إليك. أحسنت متابعة مهامك التدريبية!'
                : 'سيتم إشعارك فور تعيين دورات جديدة أو اقتراب المواعيد النهائية للمقررات.'}
            </p>
          </div>
        </Card>
      )}

      {/* Notifications List */}
      {!isLoading && !error && filteredNotifications.length > 0 && (
        <div className="space-y-3" role="list">
          {filteredNotifications.map((notif) => {
            const iconName = getNotificationIcon(notif.type);
            const badgeVariant = getNotificationVariant(notif.type);
            const formattedDate = new Date(notif.createdAt).toLocaleDateString('ar-EG', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <Card
                key={notif.id}
                variant="elevated"
                onClick={() => handleNotificationClick(notif)}
                className={`p-4 transition-all cursor-pointer border ${
                  !notif.read
                    ? 'bg-surface border-primary/30 shadow-xs hover:border-primary'
                    : 'bg-surface-alt/40 border-border/70 opacity-80 hover:opacity-100 hover:border-border'
                }`}
                data-testid={`notification-item-${notif.id}`}
                role="listitem"
              >
                <div className="flex items-start gap-3.5">
                  {/* Status Indicator Icon */}
                  <div
                    className={`p-2.5 rounded-xl shrink-0 ${
                      !notif.read
                        ? 'bg-primary/10 text-primary'
                        : 'bg-neutral-light text-text-muted'
                    }`}
                  >
                    <Icon name={iconName} size="md" />
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4
                          className={`text-sm sm:text-base leading-snug ${
                            !notif.read ? 'font-extrabold text-text-heading' : 'font-semibold text-text'
                          }`}
                        >
                          {notif.title || notif.message}
                        </h4>
                        {!notif.read && (
                          <span
                            className="inline-block w-2 h-2 rounded-full bg-primary"
                            aria-label="غير مقروء"
                          />
                        )}
                      </div>

                      <span className="text-[11px] text-text-muted font-medium shrink-0 flex items-center gap-1">
                        <Icon name="clock" size="sm" />
                        <span>{formattedDate}</span>
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-text-muted leading-relaxed line-clamp-2">
                      {notif.message}
                    </p>

                    {/* Metadata Footer */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <Badge variant={badgeVariant} className="text-[10px] py-0 px-2">
                        {getNotificationTypeLabel(notif.type)}
                      </Badge>
                      {notif.groupId && (
                        <span className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline">
                          <Icon name="trainingGroups" size="sm" />
                          <span>
                            {notif.type === 'enrollment_request'
                              ? `مراجعة طلبات الانضمام (${notif.groupId}) ←`
                              : `عرض المجموعة التدريبية (${notif.groupId}) ←`}
                          </span>
                        </span>
                      )}
                      {!notif.groupId && notif.courseId && (
                        <span className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline">
                          <Icon name="courses" size="sm" />
                          <span>عرض المقرر التدريبي ({notif.courseId}) ←</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
