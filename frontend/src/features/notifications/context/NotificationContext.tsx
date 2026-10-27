import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { notificationsApi } from '../services/notificationsApi';
import type { NotificationItem } from '@/core/notifications/types';

export interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  loadNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await notificationsApi.getNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل الإشعارات');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Approved refresh strategy:
  // Trigger on initial session load/restoration, user change, or route navigation
  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user, location.pathname, loadNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const res = await notificationsApi.markRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount(res.unreadCount);
    } catch (err) {
      // Re-fetch to ensure sync on failure
      await loadNotifications();
      throw err;
    }
  }, [loadNotifications]);

  const markAllAsRead = useCallback(async () => {
    try {
      const res = await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(res.unreadCount);
    } catch (err) {
      await loadNotifications();
      throw err;
    }
  }, [loadNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        error,
        loadNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;
