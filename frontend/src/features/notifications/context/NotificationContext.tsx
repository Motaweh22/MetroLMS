import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
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
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Stale-response guard & request generation tracker across direct account switches
  const activeUserIdRef = useRef<string | null>(user?.id ?? null);
  const requestSeqRef = useRef<number>(0);

  // Immediate state isolation on user identity change (direct A-to-B switch or logout)
  useEffect(() => {
    const currentId = user?.id ?? null;
    if (activeUserIdRef.current !== currentId) {
      activeUserIdRef.current = currentId;
      requestSeqRef.current += 1; // Invalidate any pending in-flight requests from the previous user
      setNotifications([]);
      setUnreadCount(0);
      setLoadedUserId(null);
      setError(null);
    }
  }, [user?.id]);

  const loadNotifications = useCallback(async () => {
    const targetUserId = user?.id ?? null;
    if (!targetUserId || !user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoadedUserId(null);
      return;
    }

    const currentSeq = ++requestSeqRef.current;

    try {
      setIsLoading(true);
      setError(null);
      const data = await notificationsApi.getNotifications();

      // Guard: Discard stale response if active user changed or a newer request was dispatched
      if (currentSeq !== requestSeqRef.current || activeUserIdRef.current !== targetUserId) {
        return;
      }

      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setLoadedUserId(targetUserId);
    } catch (err) {
      if (currentSeq !== requestSeqRef.current || activeUserIdRef.current !== targetUserId) {
        return;
      }
      setError(err instanceof Error ? err.message : 'تعذر تحميل الإشعارات');
    } finally {
      if (currentSeq === requestSeqRef.current && activeUserIdRef.current === targetUserId) {
        setIsLoading(false);
      }
    }
  }, [user]);

  // Approved refresh strategy:
  // Trigger on initial session load/restoration, user change, route navigation, or in-app notification mutation events
  useEffect(() => {
    if (user) {
      loadNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setLoadedUserId(null);
    }
  }, [user, location.pathname, loadNotifications]);

  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;
    const currentUserId = user.id;
    const handleNotificationsChanged = () => {
      // Ignore notification event if the user identity has already switched
      if (activeUserIdRef.current !== currentUserId) return;
      void loadNotifications();
    };
    window.addEventListener('metro:notifications-changed', handleNotificationsChanged);
    return () => {
      window.removeEventListener('metro:notifications-changed', handleNotificationsChanged);
    };
  }, [user, loadNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    const currentUserId = user?.id ?? null;
    try {
      const res = await notificationsApi.markRead(notificationId);
      if (activeUserIdRef.current !== currentUserId) return;
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount(res.unreadCount);
      setLoadedUserId(currentUserId);
    } catch (err) {
      if (activeUserIdRef.current === currentUserId) {
        await loadNotifications();
      }
      throw err;
    }
  }, [user?.id, loadNotifications]);

  const markAllAsRead = useCallback(async () => {
    const currentUserId = user?.id ?? null;
    try {
      const res = await notificationsApi.markAllRead();
      if (activeUserIdRef.current !== currentUserId) return;
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(res.unreadCount);
      setLoadedUserId(currentUserId);
    } catch (err) {
      if (activeUserIdRef.current === currentUserId) {
        await loadNotifications();
      }
      throw err;
    }
  }, [user?.id, loadNotifications]);

  // Render-time state gating:
  // If stored state belongs to another user (e.g. immediately during a direct User A -> User B switch,
  // before useEffect runs or before User B's network response arrives), expose empty notifications and 0 unreadCount.
  const currentUserId = user?.id ?? null;
  const isCurrentSessionState = Boolean(currentUserId && loadedUserId === currentUserId);
  const activeNotifications = isCurrentSessionState ? notifications : [];
  const activeUnreadCount = isCurrentSessionState ? unreadCount : 0;

  return (
    <NotificationContext.Provider
      value={{
        notifications: activeNotifications,
        unreadCount: activeUnreadCount,
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
