import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import socketService from '../services/socket';
import notificationService from '../services/notificationService';

const NotificationContext = createContext(null);

const countUnread = (items = []) =>
  items.filter((item) => !item?.isRead).length;

const upsertAtTop = (list, item) => {
  if (!item?._id) return list;
  return [item, ...list.filter((entry) => entry?._id !== item._id)];
};

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const userId = user?._id;

  const [notifications, setNotifications] = useState([]);
  const [messageNotifications, setMessageNotifications] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(false);

  // ✅ SINGLE API CALL (no spam)
  const refreshNotifications = useCallback(async () => {
    if (!isAuthenticated || !userId) return;

    setLoading(true);

    try {
      const [allNotifications, messageList, unreadCount] = await Promise.all([
        notificationService.getNotifications({ scope: 'all', userId }),
        notificationService.getNotifications({ scope: 'messages', unreadOnly: true, userId }),
        notificationService.getUnreadMessagesCount(userId),
      ]);

      setNotifications(allNotifications);
      setMessageNotifications(messageList);
      setUnreadNotificationCount(countUnread(allNotifications));
      setUnreadMessages(unreadCount);
    } catch (err) {
      console.error("Notification fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, userId]);

  // ✅ RUN ONLY ON LOGIN / USER LOAD
  useEffect(() => {
    if (isAuthenticated && userId) {
      refreshNotifications();
    }
  }, [isAuthenticated, userId]);

  // ❌ REMOVED: duplicate refresh useEffect
  // ❌ REMOVED: FORCE REFRESH
  // ❌ REMOVED: interval spam

  // ✅ SOCKET (NO API CALL HERE)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleRealtimeNotification = (data) => {
      console.log('Socket received new notification:', data);

      if (!data?._id) return;

      setNotifications((prev) => {
        const exists = prev.some((item) => item._id === data._id);

        if (!exists && !data.isRead) {
          setUnreadNotificationCount((prevCount) => prevCount + 1);
        }

        return upsertAtTop(prev, data);
      });

      if (data.type === 'message') {
        setMessageNotifications((prev) => upsertAtTop(prev, data));

        if (!data.isRead) {
          setUnreadMessages((prev) => prev + 1);
        }
      }
    };

    socketService.on('new_notification', handleRealtimeNotification);

    return () => {
      socketService.off('new_notification', handleRealtimeNotification);
    };
  }, [isAuthenticated]);

  const markNotificationAsRead = useCallback(async (notificationId) => {
    if (!notificationId) return;

    setNotifications((prev) => {
      const updated = prev.map((n) =>
        n._id === notificationId ? { ...n, isRead: true } : n
      );
      setUnreadNotificationCount(countUnread(updated));
      return updated;
    });

    try {
      await notificationService.markAsRead(notificationId);
    } catch {}
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      messageNotifications,
      unreadNotificationCount,
      unreadMessages,
      loading,
      refreshNotifications,
      markNotificationAsRead,
    }),
    [
      notifications,
      messageNotifications,
      unreadNotificationCount,
      unreadMessages,
      loading,
      refreshNotifications,
      markNotificationAsRead,
    ]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};