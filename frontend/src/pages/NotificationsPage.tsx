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
import type { UserRole } from '@/core/auth/types';

export type NotificationCategory =
  | 'all'
  | 'requires_action'
  | 'approvals'
  | 'join_requests'
  | 'content_review'
  | 'user_management'
  | 'groups'
  | 'audit_security'
  | 'system';

export interface CategoryDefinition {
  id: NotificationCategory;
  labelAr: string;
  icon: SemanticIconName;
  roles: UserRole[];
}

export const NOTIFICATION_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'all',
    labelAr: 'الكل',
    icon: 'notifications',
    roles: ['admin', 'assistant_admin', 'super_admin', 'developer', 'lecturer', 'user'],
  },
  {
    id: 'requires_action',
    labelAr: 'تتطلب إجراء',
    icon: 'alertCircle',
    roles: ['admin', 'assistant_admin', 'super_admin', 'developer', 'lecturer'],
  },
  {
    id: 'approvals',
    labelAr: 'طلبات الاعتماد',
    icon: 'checkCircle',
    roles: ['admin', 'assistant_admin', 'super_admin', 'developer'],
  },
  {
    id: 'join_requests',
    labelAr: 'طلبات الانضمام',
    icon: 'trainingGroups',
    roles: ['admin', 'assistant_admin', 'super_admin', 'developer', 'lecturer'],
  },
  {
    id: 'content_review',
    labelAr: 'مراجعة المحتوى',
    icon: 'courses',
    roles: ['admin', 'assistant_admin', 'super_admin', 'developer', 'lecturer'],
  },
  {
    id: 'user_management',
    labelAr: 'إدارة المستخدمين',
    icon: 'user',
    roles: ['admin', 'assistant_admin', 'super_admin', 'developer'],
  },
  {
    id: 'groups',
    labelAr: 'المجموعات والتدريب',
    icon: 'trainingGroups',
    roles: ['admin', 'assistant_admin', 'super_admin', 'developer', 'lecturer', 'user'],
  },
  {
    id: 'audit_security',
    labelAr: 'الرقابة والأمان',
    icon: 'shield',
    roles: ['admin', 'assistant_admin', 'super_admin', 'developer'],
  },
  {
    id: 'system',
    labelAr: 'إشعارات النظام',
    icon: 'info',
    roles: ['admin', 'assistant_admin', 'super_admin', 'developer', 'lecturer', 'user'],
  },
];

/**
 * Pure, deterministic mapping from notification domain item to conceptual category.
 * Grounded in explicit notification types and linked metadata (requestId, courseId, groupId).
 * Heuristic text matching on Arabic titles/messages is strictly avoided.
 */
export function getNotificationCategory(
  notif: NotificationItem
): Exclude<NotificationCategory, 'all' | 'requires_action'> {
  // 1. Explicit Approval Requests
  if (
    notif.requestId &&
    (notif.targetUrl?.startsWith('/approvals') || notif.type === 'general_alert')
  ) {
    return 'approvals';
  }

  // 2. User Management
  if (notif.type === 'new_registration_request') {
    return 'user_management';
  }

  // 3. Group Join Requests
  if (notif.type === 'enrollment_request') {
    return 'join_requests';
  }

  // 4. Content Review (including reported comments moderation)
  if (
    notif.type === 'content_pending_review' ||
    notif.type === 'content_approved' ||
    notif.type === 'content_rejected' ||
    notif.type === 'comment_reported'
  ) {
    return 'content_review';
  }

  // 5. System Audit & Security
  if (
    notif.type === 'security_alert' ||
    notif.auditLogId ||
    notif.targetUrl?.startsWith('/admin/audit')
  ) {
    return 'audit_security';
  }

  // 6. Groups & Training
  if (
    notif.type === 'enrollment_approved' ||
    notif.type === 'enrollment_rejected' ||
    notif.type === 'forced_enrollment' ||
    notif.type === 'group_renewed' ||
    notif.type === 'group_archived' ||
    notif.type === 'group_updated' ||
    notif.type === 'instructor_assigned' ||
    notif.type === 'deadline_reminder' ||
    notif.type === 'course_completed' ||
    notif.type === 'new_course_suggested'
  ) {
    return 'groups';
  }

  // 7. System Notifications (general alerts, comments, and unknown/fallback types)
  return 'system';
}

const NOTIFICATION_TYPE_LABELS_AR: Record<NotificationType, string> = {
  enrollment_approved: 'قبول التسجيل',
  enrollment_rejected: 'رفض طلب الانضمام',
  new_course_suggested: 'اقتراح مقرر تدريبي',
  new_comment: 'تعليق ونقاش جديد',
  comment_reported: 'إبلاغ عن تعليق مخالف',
  forced_enrollment: 'تعيين مسار تدريبي',
  content_pending_review: 'محتوى بانتظار المراجعة',
  content_approved: 'اعتماد ونشر المقرر',
  content_rejected: 'ملاحظات مراجعة المقرر',
  new_registration_request: 'طلب اعتماد حساب',
  enrollment_request: 'طلب انضمام للمجموعة',
  deadline_reminder: 'تذكير بالموعد النهائي',
  general_alert: 'تنبيه إداري',
  security_alert: 'تنبيه أمني ورقابي',
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

  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory>('all');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Role-Aware Category Visibility
  const currentRole = user?.role || 'user';
  const visibleCategories = React.useMemo(
    () => NOTIFICATION_CATEGORIES.filter((cat) => cat.roles.includes(currentRole)),
    [currentRole]
  );
  const effectiveCategory = React.useMemo(
    () => (visibleCategories.some((c) => c.id === selectedCategory) ? selectedCategory : 'all'),
    [visibleCategories, selectedCategory]
  );

  // Arrow Navigation & Viewport State
  const tabsContainerRef = React.useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);

  const updateScrollButtons = React.useCallback(() => {
    const container = tabsContainerRef.current;
    if (!container) return;
    const { scrollWidth, clientWidth, scrollLeft } = container;
    const maxScroll = Math.max(0, scrollWidth - clientWidth);
    const overflow = maxScroll > 2;
    setHasOverflow(overflow);

    if (!overflow) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    if (scrollLeft < 0) {
      setCanScrollLeft(Math.abs(scrollLeft) < maxScroll - 2);
      setCanScrollRight(Math.abs(scrollLeft) > 2);
    } else if (scrollLeft > 0 && scrollLeft <= maxScroll) {
      setCanScrollLeft(scrollLeft < maxScroll - 2);
      setCanScrollRight(scrollLeft > 2);
    } else {
      setCanScrollLeft(true);
      setCanScrollRight(false);
    }
  }, []);

  const handleScroll = (direction: 'left' | 'right') => {
    const container = tabsContainerRef.current;
    if (!container) return;
    const scrollAmount = Math.max(container.clientWidth * 0.75, 200);
    const delta = direction === 'left' ? -scrollAmount : scrollAmount;
    if (typeof container.scrollBy === 'function') {
      container.scrollBy({ left: delta, behavior: 'smooth' });
    } else {
      container.scrollLeft += delta;
    }
    setTimeout(updateScrollButtons, 50);
  };

  React.useEffect(() => {
    updateScrollButtons();
    const container = tabsContainerRef.current;
    if (!container) return;

    const handleResize = () => updateScrollButtons();
    window.addEventListener('resize', handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateScrollButtons());
      resizeObserver.observe(container);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [updateScrollButtons, visibleCategories]);

  // Keep active category tab visible
  React.useEffect(() => {
    const container = tabsContainerRef.current;
    if (!container) return;
    const activeTab = container.querySelector(
      `[data-testid="category-tab-${effectiveCategory}"]`
    ) as HTMLElement;
    if (activeTab && typeof activeTab.scrollIntoView === 'function') {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
    updateScrollButtons();
  }, [effectiveCategory, updateScrollButtons]);

  // Count Calculations
  // Unresolved actionable items count (includes both read and unread actionable tasks)
  const actionableCount = notifications.filter((n) => Boolean(n.actionRequired)).length;

  const getCategoryCountBadge = (catId: NotificationCategory): { count: number; isActionCount: boolean } => {
    if (catId === 'requires_action') {
      return { count: actionableCount, isActionCount: true };
    }
    if (catId === 'all') {
      const count = notifications.filter((n) => !n.read).length;
      return { count, isActionCount: false };
    }
    const count = notifications.filter((n) => !n.read && getNotificationCategory(n) === catId).length;
    return { count, isActionCount: false };
  };

  // Composed Filtering: Category × Read State
  const filteredNotifications = notifications
    .filter((item) => {
      // 1. Category Filter
      if (effectiveCategory === 'requires_action') {
        if (!item.actionRequired) return false;
      } else if (effectiveCategory !== 'all') {
        const itemCat = getNotificationCategory(item);
        if (itemCat !== effectiveCategory) {
          // Allow user_management approval requests to also surface under Approvals
          if (
            effectiveCategory === 'approvals' &&
            item.type === 'new_registration_request' &&
            item.requestId
          ) {
            // Include in approvals
          } else {
            return false;
          }
        }
      }

      // 2. Read State Filter
      if (filter === 'unread') {
        if (item.read) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Sorting: inside Requires Action tab, prioritize actionable tasks first, then newest first
      if (effectiveCategory === 'requires_action') {
        if (Boolean(a.actionRequired) !== Boolean(b.actionRequired)) {
          return a.actionRequired ? -1 : 1;
        }
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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

    if (
      notif.type === 'content_pending_review' &&
      notif.courseId &&
      (role === 'admin' || role === 'assistant_admin' || role === 'super_admin' || role === 'developer')
    ) {
      return `/admin/review/${encodeURIComponent(notif.courseId)}`;
    }

    if (notif.type === 'content_rejected' && notif.courseId && (role === 'lecturer' || role === 'admin')) {
      return `/lecturer/builder/${encodeURIComponent(notif.courseId)}`;
    }

    if (notif.courseId) {
      return `/courses/${encodeURIComponent(notif.courseId)}`;
    }

    if (
      notif.type === 'new_registration_request' &&
      (role === 'admin' || role === 'assistant_admin' || role === 'super_admin' || role === 'developer')
    ) {
      return '/approvals';
    }

    if (notif.type === 'comment_reported') {
      if (role === 'admin' || role === 'assistant_admin' || role === 'super_admin' || role === 'developer') {
        return '/admin/comment-moderation';
      }
      if (notif.courseId) {
        return `/courses/${encodeURIComponent(notif.courseId)}`;
      }
    }

    if (
      (notif.type === 'security_alert' || notif.auditLogId) &&
      (role === 'admin' || role === 'assistant_admin' || role === 'super_admin' || role === 'developer')
    ) {
      return '/admin/audit';
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
      case 'comment_reported':
        return 'alertCircle';
      case 'security_alert':
        return 'shield';
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
      case 'new_registration_request':
        return 'user';
      case 'enrollment_request':
      case 'instructor_assigned':
      case 'group_renewed':
      case 'group_archived':
      case 'group_updated':
        return 'trainingGroups';
      case 'new_comment':
        return 'chat';
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
      case 'enrollment_rejected':
      case 'content_rejected':
      case 'comment_reported':
      case 'security_alert':
        return 'danger';
      case 'deadline_reminder':
        return 'warning';
      case 'general_alert':
        return 'primary';
      case 'content_pending_review':
      case 'new_registration_request':
      case 'enrollment_request':
        return 'warning';
      case 'group_renewed':
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

  const getCategoryEmptyState = (catId: NotificationCategory, isUnreadFilter: boolean) => {
    if (isUnreadFilter) {
      return {
        title: 'لا توجد إشعارات غير مقروءة في هذا القسم',
        message: 'لقد اطلعت على جميع الإشعارات المندرجة تحت هذا التصنيف.',
      };
    }
    switch (catId) {
      case 'requires_action':
        return {
          title: 'لا توجد مهام أو إجراءات معلقة بانتظار قرارك',
          message: 'رائع! لا توجد طلبات اعتماد أو مراجعات تتطلب تدخلك الإداري في الوقت الحالي.',
        };
      case 'approvals':
        return {
          title: 'لا توجد طلبات اعتماد',
          message: 'لا توجد طلبات اعتماد حوكمة أو عمليات تتطلب موافقة في هذا القسم.',
        };
      case 'join_requests':
        return {
          title: 'لا توجد طلبات انضمام للمجموعات',
          message: 'لا توجد طلبات انضمام مقدمة من المتدربين بانتظار المراجعة.',
        };
      case 'content_review':
        return {
          title: 'لا توجد إشعارات مراجعة محتوى',
          message: 'لا توجد مقررات تدريبية بانتظار المراجعة أو الاعتماد في الوقت الراهن.',
        };
      case 'user_management':
        return {
          title: 'لا توجد إشعارات لإدارة المستخدمين',
          message: 'لا توجد طلبات تسجيل مستخدمين أو إجراءات حسابات معلقة.',
        };
      case 'groups':
        return {
          title: 'لا توجد إشعارات مجموعات وتدريب',
          message: 'لا توجد تحديثات حالية بخصوص المجموعات التدريبية أو التعيينات.',
        };
      case 'audit_security':
        return {
          title: 'سجل الرقابة والأمان خالٍ من التنبيهات',
          message: 'لا توجد تنبيهات أمنية أو أحداث رقابية معلقة تتطلب المتابعة في الوقت الحالي.',
        };
      case 'system':
        return {
          title: 'لا توجد إشعارات نظام أو تنبيهات عامة',
          message: 'سجل إشعارات النظام والتنبيهات العامة نظيف تماماً.',
        };
      default:
        return {
          title: 'صندوق الإشعارات فارغ',
          message: 'سيتم إشعارك فور تعيين دورات جديدة أو اقتراب المواعيد النهائية للمقررات.',
        };
    }
  };

  const emptyState = getCategoryEmptyState(effectiveCategory, filter === 'unread');

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto" data-testid="notifications-page">
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
            متابعة المهام التدريبية، قرارات الاعتماد، وتحديثات المسارات المخصصة لك.
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

      {/* Role-Aware Category Tabs with Arrow Navigation */}
      <div className="space-y-3" data-testid="category-navigation-wrapper">
        <div className="relative flex items-center border-b border-border pb-1.5">
          {hasOverflow && (
            <button
              type="button"
              onClick={() => handleScroll('right')}
              disabled={!canScrollRight}
              aria-label="التمرير إلى اليمين"
              title="التمرير إلى اليمين"
              aria-disabled={!canScrollRight}
              className={`shrink-0 p-1.5 rounded-lg border border-border bg-surface text-text shadow-xs transition-all me-1.5 z-10 focus:outline-none focus:ring-2 focus:ring-primary ${!canScrollRight
                  ? 'opacity-30 cursor-not-allowed text-text-muted border-border/50'
                  : 'hover:bg-neutral-light hover:text-text-heading active:scale-95'
                }`}
              data-testid="category-nav-right"
              data-direction="right"
            >
              <Icon name="chevronRight" size="sm" />
            </button>
          )}

          <div
            ref={tabsContainerRef}
            onScroll={updateScrollButtons}
            className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden scroll-smooth flex-1"
            role="tablist"
            aria-label="تصنيفات الإشعارات"
            data-testid="category-tabs-container"
          >
            {visibleCategories.map((cat) => {
              const isSelected = effectiveCategory === cat.id;
              const { count, isActionCount } = getCategoryCountBadge(cat.id);

              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-all shrink-0 ${isSelected
                      ? cat.id === 'requires_action'
                        ? 'bg-danger text-white shadow-xs'
                        : 'bg-primary text-white shadow-xs'
                      : cat.id === 'requires_action' && count > 0
                        ? 'bg-danger/10 text-danger-dark hover:bg-danger/20 border border-danger/30'
                        : 'text-text-muted hover:text-text hover:bg-neutral-light'
                    }`}
                  data-testid={`category-tab-${cat.id}`}
                >
                  <Icon name={cat.icon} size="sm" />
                  <span>{cat.labelAr}</span>
                  {count > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${isSelected
                          ? 'bg-white/25 text-white'
                          : isActionCount
                            ? 'bg-danger text-white'
                            : 'bg-neutral-light text-text-muted'
                        }`}
                    >
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {hasOverflow && (
            <button
              type="button"
              onClick={() => handleScroll('left')}
              disabled={!canScrollLeft}
              aria-label="التمرير إلى اليسار"
              title="التمرير إلى اليسار"
              aria-disabled={!canScrollLeft}
              className={`shrink-0 p-1.5 rounded-lg border border-border bg-surface text-text shadow-xs transition-all ms-1.5 z-10 focus:outline-none focus:ring-2 focus:ring-primary ${!canScrollLeft
                  ? 'opacity-30 cursor-not-allowed text-text-muted border-border/50'
                  : 'hover:bg-neutral-light hover:text-text-heading active:scale-95'
                }`}
              data-testid="category-nav-left"
              data-direction="left"
            >
              <Icon name="chevronLeft" size="sm" />
            </button>
          )}
        </div>

        {/* Sub-Filter Controls: Read State & Context Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Read State Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'all'
                  ? 'bg-surface text-text font-black border border-border shadow-xs'
                  : 'text-text-muted hover:text-text hover:bg-neutral-light'
                }`}
              data-testid="tab-all-notifications"
            >
              <span>جميع الحالات</span>
              <span className="text-[11px] text-text-muted font-normal">
                ({effectiveCategory === 'all' ? notifications.length : notifications.filter((n) => effectiveCategory === 'requires_action' ? n.actionRequired : getNotificationCategory(n) === effectiveCategory).length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'unread'
                  ? 'bg-surface text-danger font-black border border-danger/30 shadow-xs'
                  : 'text-text-muted hover:text-text hover:bg-neutral-light'
                }`}
              data-testid="tab-unread-notifications"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-danger" aria-hidden="true" />
              <span>غير مقروءة فقط</span>
              <span className="px-1.5 py-0.2 rounded-full bg-danger/10 text-danger text-[10px] font-bold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            </button>
          </div>

          {/* Active Category Scope Notice */}
          <div className="text-xs text-text-muted font-medium flex items-center gap-1">
            <span>عرض:</span>
            <span className="font-bold text-text-heading">
              {visibleCategories.find((c) => c.id === effectiveCategory)?.labelAr}
            </span>
            <span>({filteredNotifications.length})</span>
          </div>
        </div>
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
            <h3 className="text-base sm:text-lg font-bold text-text-heading">{emptyState.title}</h3>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">{emptyState.message}</p>
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
                className={`p-4 transition-all cursor-pointer border ${notif.actionRequired
                    ? 'bg-surface border-warning shadow-xs hover:border-warning-dark'
                    : !notif.read
                      ? 'bg-surface border-primary/30 shadow-xs hover:border-primary'
                      : 'bg-surface-alt/40 border-border/70 opacity-85 hover:opacity-100 hover:border-border'
                  }`}
                data-testid={`notification-item-${notif.id}`}
                role="listitem"
              >
                <div className="flex items-start gap-3.5">
                  {/* Status Indicator Icon */}
                  <div
                    className={`p-2.5 rounded-xl shrink-0 ${notif.actionRequired
                        ? 'bg-warning-light text-warning-dark'
                        : !notif.read
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
                          className={`text-sm sm:text-base leading-snug ${!notif.read || notif.actionRequired
                              ? 'font-extrabold text-text-heading'
                              : 'font-semibold text-text'
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
                        {notif.actionRequired && (
                          <Badge variant="danger" size="sm" className="font-bold border-danger/30 text-[10px] py-0 px-1.5">
                            تتطلب إجراء
                          </Badge>
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
                      {notif.requestId && notif.targetUrl === '/approvals' && (
                        <span className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline">
                          <Icon name="checkCircle" size="sm" />
                          <span>الانتقال لمركز الاعتمادات الإدارية ({notif.requestId}) ←</span>
                        </span>
                      )}
                      {notif.type === 'comment_reported' && (
                        <span className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline">
                          <Icon name="alertCircle" size="sm" />
                          <span>الانتقال لإدارة التعليقات المبلغ عنها ←</span>
                        </span>
                      )}
                      {(notif.type === 'security_alert' || notif.auditLogId) && (
                        <span className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline">
                          <Icon name="shield" size="sm" />
                          <span>الانتقال لسجل الرقابة والأمان ←</span>
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
