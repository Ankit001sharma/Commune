import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import socketService from '../services/socket';
import notificationService from '../services/notificationService';

const NotificationContext = createContext(null);
const COUNTABLE_TYPES = new Set(['item_save', 'community_interaction']);

const countUnreadNonMessage = (items = []) =>
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

  const refreshUnreadMessages = useCallback(async () => {
    if (!isAuthenticated || !userId) {
      setUnreadMessages(0);
      return;
    }

    try {
      const unreadCount = await notificationService.getUnreadMessagesCount(userId);
      setUnreadMessages(unreadCount);
    } catch (_) {
      // Keep last known value when refresh fails.
    }
  }, [isAuthenticated, userId]);

  const refreshNotifications = useCallback(async () => {
    if (!isAuthenticated || !userId) {
      setNotifications([]);
      setMessageNotifications([]);
      setUnreadNotificationCount(0);
      setUnreadMessages(0);
      return;
    }

    setLoading(true);

    try {
      const [allNotifications, messageList, unreadCount] = await Promise.all([
        notificationService.getNotifications({ scope: 'all', userId }),
        notificationService.getNotifications({ scope: 'messages', unreadOnly: true, userId }),
        notificationService.getUnreadMessagesCount(userId),
      ]);

      setNotifications(allNotifications);
      setMessageNotifications(messageList);
      setUnreadNotificationCount(countUnreadNonMessage(allNotifications));
      setUnreadMessages(unreadCount);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, userId]);

  const markNotificationAsRead = useCallback(async (notificationId) => {
    if (!notificationId || !userId) return;

    setNotifications((prev) => {
      const next = prev.map((item) =>
        item._id === notificationId ? { ...item, isRead: true } : item
      );
      setUnreadNotificationCount(countUnreadNonMessage(next));
      return next;
    });

    try {
      await notificationService.markAsRead(notificationId, userId);
    } catch (_) {
      // Keep optimistic UI state to avoid lingering highlight.
    }
  }, [userId]);

  const markAllNonMessageAsRead = useCallback(async () => {
    if (!userId) return;

    setNotifications((prev) =>
      prev.map((item) =>
        item.type === 'message' ? item : { ...item, isRead: true }
      )
    );
    setUnreadNotificationCount(0);

    try {
      await notificationService.markAllAsRead('non-message', userId);
    } catch (_) {
      // Keep optimistic UI state and avoid runtime crashes.
    }
  }, [userId]);

  const markMessageNotificationsByTargetRead = useCallback(async (targetId) => {
    if (!targetId || !userId) return;

    setNotifications((prev) =>
      prev.map((item) =>
        item.type === 'message' && `${item.targetId}` === `${targetId}`
          ? { ...item, isRead: true }
          : item
      )
    );

    try {
      await notificationService.markMessageNotificationsByTargetRead(targetId, userId);
    } catch (_) {
      return;
    }

    setMessageNotifications((prev) =>
      prev.filter((item) => item.targetId !== `${targetId}`)
    );

    await refreshUnreadMessages();
  }, [refreshUnreadMessages, userId]);

  useEffect(() => {
    if (isAuthenticated && userId) {
      refreshNotifications();
    }
  }, [isAuthenticated, userId]);

  useEffect(() => {
    if (!userId) return;

    console.log("FORCE REFRESH TRIGGER");

    refreshNotifications();
  }, [userId]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      refreshUnreadMessages();
    }, 20000);

    return () => clearInterval(interval);
  }, [isAuthenticated, refreshUnreadMessages]);

  // Dedicated realtime notification effect.
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleRealtimeNotification = (data) => {
      console.log('Socket received new notification:', data);

      const incoming = data;
      if (!incoming?._id) return;

      setNotifications((prevNotifications) => {
        const alreadyExists = prevNotifications.some(
          (entry) => entry?._id === incoming._id
        );

        if (!alreadyExists ) {
          setUnreadNotificationCount((prevCount) => prevCount + 1);
        }

        return upsertAtTop(prevNotifications, incoming);
      });

      if (incoming.type === 'message') {
        setMessageNotifications((prevNotifications) =>
          upsertAtTop(prevNotifications, incoming)
        );

        if (!incoming.isRead) {
          setUnreadMessages((prevCount) => prevCount + 1);
        }
      }
    };

    socketService.on('new_notification', handleRealtimeNotification);

    return () => {
      socketService.off('new_notification', handleRealtimeNotification);
    };
  }, [isAuthenticated]);

  const value = useMemo(
    () => ({
      notifications,
      messageNotifications,
      unreadNotificationCount,
      unreadMessages,
      loading,
      refreshNotifications,
      refreshUnreadMessages,
      markNotificationAsRead,
      markAllNonMessageAsRead,
      markMessageNotificationsByTargetRead,
    }),
    [
      notifications,
      messageNotifications,
      unreadNotificationCount,
      unreadMessages,
      loading,
      refreshNotifications,
      refreshUnreadMessages,
      markNotificationAsRead,
      markAllNonMessageAsRead,
      markMessageNotificationsByTargetRead,
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
