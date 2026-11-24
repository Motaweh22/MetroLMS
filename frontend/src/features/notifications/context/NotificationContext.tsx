import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { notificationsApi } from '../services/notificationsApi';
import { isStaleEpochError } from '@/core/api/apiClient';
import { getCurrentSessionEpoch } from '@/core/auth/sessionEpoch';
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
  const { user, sessionEpoch } = useAuth();
  const location = useLocation();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [loadedEpoch, setLoadedEpoch] = useState<number>(sessionEpoch);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Stale-response guard & request generation tracker across direct account switches & session epoch transitions
  const activeUserIdRef = useRef<string | null>(user?.id ?? null);
  const activeEpochRef = useRef<number>(sessionEpoch);
  const requestSeqRef = useRef<number>(0);

  // Immediate state isolation on user identity change or session epoch transition (WP-5.4.2)
  useEffect(() => {
    const currentId = user?.id ?? null;
    if (activeUserIdRef.current !== currentId || activeEpochRef.current !== sessionEpoch) {
      activeUserIdRef.current = currentId;
      activeEpochRef.current = sessionEpoch;
      requestSeqRef.current += 1; // Invalidate any pending in-flight requests from the previous session/user
      setNotifications([]);
      setUnreadCount(0);
      setLoadedUserId(null);
      setLoadedEpoch(sessionEpoch);
      setError(null);
    }
  }, [user?.id, sessionEpoch]);

  const loadNotifications = useCallback(async () => {
    const targetUserId = user?.id ?? null;
    const targetEpoch = sessionEpoch;
    if (!targetUserId || !user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoadedUserId(null);
      setLoadedEpoch(sessionEpoch);
      return;
    }

    const currentSeq = ++requestSeqRef.current;

    try {
      setIsLoading(true);
      setError(null);
      const data = await notificationsApi.getNotifications();

      // Guard: Discard stale response if active user changed, epoch advanced, or a newer request was dispatched
      if (
        currentSeq !== requestSeqRef.current ||
        activeUserIdRef.current !== targetUserId ||
        activeEpochRef.current !== targetEpoch ||
        getCurrentSessionEpoch() !== targetEpoch
      ) {
        return;
      }

      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setLoadedUserId(targetUserId);
      setLoadedEpoch(targetEpoch);
    } catch (err) {
      // Discard stale in-flight responses silently without displaying obsolete error states (WP-5.4.2)
      if (isStaleEpochError(err)) {
        return;
      }
      if (
        currentSeq !== requestSeqRef.current ||
        activeUserIdRef.current !== targetUserId ||
        activeEpochRef.current !== targetEpoch ||
        getCurrentSessionEpoch() !== targetEpoch
      ) {
        return;
      }
      setError(err instanceof Error ? err.message : 'تعذر تحميل الإشعارات');
    } finally {
      if (
        currentSeq === requestSeqRef.current &&
        activeUserIdRef.current === targetUserId &&
        activeEpochRef.current === targetEpoch
      ) {
        setIsLoading(false);
      }
    }
  }, [user, sessionEpoch]);

  // Approved refresh strategy:
  // Trigger on initial session load/restoration, user change, epoch transition, route navigation, or in-app notification mutation events
  useEffect(() => {
    if (user) {
      loadNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setLoadedUserId(null);
      setLoadedEpoch(sessionEpoch);
    }
  }, [user, sessionEpoch, location.pathname, loadNotifications]);

  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;
    const currentUserId = user.id;
    const currentEpoch = sessionEpoch;
    const handleNotificationsChanged = () => {
      // Ignore notification event if the user identity or session epoch has already switched
      if (
        activeUserIdRef.current !== currentUserId ||
        activeEpochRef.current !== currentEpoch ||
        getCurrentSessionEpoch() !== currentEpoch
      ) return;
      void loadNotifications();
    };
    const handleVisibilityRefresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      handleNotificationsChanged();
    };
    window.addEventListener('metro:notifications-changed', handleNotificationsChanged);
    window.addEventListener('focus', handleNotificationsChanged);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityRefresh);
    }
    return () => {
      window.removeEventListener('metro:notifications-changed', handleNotificationsChanged);
      window.removeEventListener('focus', handleNotificationsChanged);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityRefresh);
      }
    };
  }, [user, sessionEpoch, loadNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    const currentUserId = user?.id ?? null;
    const currentEpoch = sessionEpoch;
    try {
      const res = await notificationsApi.markRead(notificationId);
      if (
        activeUserIdRef.current !== currentUserId ||
        activeEpochRef.current !== currentEpoch ||
        getCurrentSessionEpoch() !== currentEpoch
      ) return;
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount(res.unreadCount);
      setLoadedUserId(currentUserId);
      setLoadedEpoch(currentEpoch);
    } catch (err) {
      if (isStaleEpochError(err)) {
        return;
      }
      if (
        activeUserIdRef.current === currentUserId &&
        activeEpochRef.current === currentEpoch &&
        getCurrentSessionEpoch() === currentEpoch
      ) {
        await loadNotifications();
      }
      throw err;
    }
  }, [user?.id, sessionEpoch, loadNotifications]);

  const markAllAsRead = useCallback(async () => {
    const currentUserId = user?.id ?? null;
    const currentEpoch = sessionEpoch;
    try {
      const res = await notificationsApi.markAllRead();
      if (
        activeUserIdRef.current !== currentUserId ||
        activeEpochRef.current !== currentEpoch ||
        getCurrentSessionEpoch() !== currentEpoch
      ) return;
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(res.unreadCount);
      setLoadedUserId(currentUserId);
      setLoadedEpoch(currentEpoch);
    } catch (err) {
      if (isStaleEpochError(err)) {
        return;
      }
      if (
        activeUserIdRef.current === currentUserId &&
        activeEpochRef.current === currentEpoch &&
        getCurrentSessionEpoch() === currentEpoch
      ) {
        await loadNotifications();
      }
      throw err;
    }
  }, [user?.id, sessionEpoch, loadNotifications]);

  // Synchronous render-time cache ownership gating (WP-5.4.2 Final Cache Isolation Audit):
  // If stored cache values do NOT match the current authenticated user and current session epoch,
  // expose empty notifications, 0 unreadCount, and null error synchronously.
  // This guarantees that previous-session cache values are NEVER visible during transition renders before useEffect runs.
  const currentUserId = user?.id ?? null;
  const isCurrentSessionState = Boolean(
    currentUserId &&
    loadedUserId === currentUserId &&
    loadedEpoch === sessionEpoch
  );
  const activeNotifications = isCurrentSessionState ? notifications : [];
  const activeUnreadCount = isCurrentSessionState ? unreadCount : 0;
  const activeError = isCurrentSessionState ? error : null;
  const activeIsLoading = isCurrentSessionState ? isLoading : Boolean(currentUserId);

  return (
    <NotificationContext.Provider
      value={{
        notifications: activeNotifications,
        unreadCount: activeUnreadCount,
        isLoading: activeIsLoading,
        error: activeError,
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
