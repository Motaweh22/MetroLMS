import { http, HttpResponse } from 'msw';
import { inMemoryStore, MockStoreError } from '../store/inMemoryStore';
import { resolveAuthenticatedUser } from './resolveUser';

/**
 * MSW v2 REST Interceptors for Notification Center
 */
export const notificationHandlers = [
  // Query notifications and unread counter for authenticated user
  http.get('/api/notifications', ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لعرض الإشعارات' },
        { status: 401 }
      );
    }

    const notifications = inMemoryStore.getNotificationsForUser(user.id);
    const unreadCount = inMemoryStore.getUnreadNotificationsCount(user.id);

    return HttpResponse.json(
      {
        notifications,
        unreadCount,
        totalCount: notifications.length,
      },
      { status: 200 }
    );
  }),

  // Mark a single notification as read
  http.patch('/api/notifications/:id/read', ({ request, params }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لتعديل الإشعار' },
        { status: 401 }
      );
    }

    const notificationId = params.id as string;
    try {
      const updated = inMemoryStore.markNotificationRead(notificationId, user.id);
      const unreadCount = inMemoryStore.getUnreadNotificationsCount(user.id);

      return HttpResponse.json(
        {
          notification: updated,
          unreadCount,
        },
        { status: 200 }
      );
    } catch (err) {
      if (err instanceof MockStoreError) {
        return HttpResponse.json({ message: err.message }, { status: err.status });
      }
      return HttpResponse.json(
        { message: 'فشل في تحديث حالة الإشعار' },
        { status: 500 }
      );
    }
  }),

  // Mark all notifications for current user as read
  http.post('/api/notifications/mark-all-read', ({ request }) => {
    const user = resolveAuthenticatedUser(request);
    if (!user) {
      return HttpResponse.json(
        { message: 'يجب تسجيل الدخول لتعديل الإشعارات' },
        { status: 401 }
      );
    }

    inMemoryStore.markAllNotificationsRead(user.id);
    return HttpResponse.json(
      {
        success: true,
        unreadCount: 0,
        message: 'تم تحديد جميع الإشعارات كمقروءة بنجاح',
      },
      { status: 200 }
    );
  }),
];
