import { apiClient } from '@/core/api/apiClient';
import type { NotificationItem, NotificationsResponse } from '@/core/notifications/types';

/**
 * Notifications Center API Service
 */
export const notificationsApi = {
  /**
   * Fetch all notifications and unread counter for current user
   */
  async getNotifications(): Promise<NotificationsResponse> {
    return apiClient<NotificationsResponse>('/api/notifications', {
      method: 'GET',
    });
  },

  /**
   * Mark a single notification as read
   */
  async markRead(
    notificationId: string
  ): Promise<{ notification: NotificationItem; unreadCount: number }> {
    return apiClient<{ notification: NotificationItem; unreadCount: number }>(
      `/api/notifications/${encodeURIComponent(notificationId)}/read`,
      {
        method: 'PATCH',
      }
    );
  },

  /**
   * Mark all notifications for current user as read
   */
  async markAllRead(): Promise<{ success: boolean; unreadCount: number }> {
    return apiClient<{ success: boolean; unreadCount: number }>(
      '/api/notifications/mark-all-read',
      {
        method: 'POST',
      }
    );
  },
};
