import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/features/notifications';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import type { NotificationItem } from '@/core/notifications/types';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
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

  const handleNotificationClick = async (notif: NotificationItem) => {
    try {
      if (!notif.read) {
        await markAsRead(notif.id);
      }
      // Approved navigation rule:
      // If notification has courseId, navigate to course page
      // If notification has no courseId, remain in place
      if (notif.courseId) {
        navigate(`/courses/${encodeURIComponent(notif.courseId)}`);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'تعذر تحديث حالة الإشعار');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'warning':
      case 'alert':
        return 'alert';
      case 'course_assigned':
      case 'course':
        return 'courses';
      case 'success':
        return 'checkmark';
      case 'group':
        return 'trainingGroups';
      case 'info':
      default:
        return 'notifications';
    }
  };

  const getNotificationVariant = (type: string): 'primary' | 'warning' | 'danger' | 'neutral' => {
    switch (type) {
      case 'warning':
        return 'warning';
      case 'danger':
      case 'alert':
        return 'danger';
      case 'course_assigned':
      case 'success':
        return 'primary';
      default:
        return 'neutral';
    }
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
                        {notif.type}
                      </Badge>
                      {notif.courseId && (
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
