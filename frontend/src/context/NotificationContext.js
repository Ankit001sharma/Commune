import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from './AuthContext';
import socketService from '../services/socket';
import notificationService from '../services/notificationService';

const NotificationContext = createContext(null);

const shouldDebugNotifications = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage?.getItem('cx_debug_notifications') === 'true';
};

export const NotificationProvider = ({ children }) => {

  const { isAuthenticated, user } = useAuth();

  const userId = user?._id;

  const [notifications, setNotifications] = useState([]);
  const [messageNotifications, setMessageNotifications] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(false);

  const listenerAttached = useRef(false);
  const refreshCounter = useRef(0);

  // =========================================
  // DERIVED UNREAD COUNT
  // =========================================
  const unreadNotificationCount = useMemo(() => {
    return notifications.filter(
      (item) => !item?.isRead
    ).length;
  }, [notifications]);

  useEffect(() => {
    if (shouldDebugNotifications()) {
      console.debug('[notifications] unread count recalculated', {
        count: unreadNotificationCount,
        total: notifications.length,
      });
    }
  }, [unreadNotificationCount, notifications.length]);

  // =========================================
  // REFRESH NOTIFICATIONS
  // =========================================
  const refreshNotifications = useCallback(async () => {

    if (!isAuthenticated || !userId) return;

    const requestId = ++refreshCounter.current;

    if (shouldDebugNotifications()) {
      console.debug('[notifications] refresh start', {
        requestId,
        userId,
      });
    }

    setLoading(true);

    try {

      const [
        allNotifications,
        messageList,
        unreadCount,
      ] = await Promise.all([
        notificationService.getNotifications({
          scope: 'all',
          userId,
        }),

        notificationService.getNotifications({
          scope: 'messages',
          unreadOnly: true,
          userId,
        }),

        notificationService.getUnreadMessagesCount(userId),
      ]);

      // =====================================
      // DEDUPE NOTIFICATIONS
      // =====================================
      const uniqueNotifications = [];

      const senderMap = new Set();

      allNotifications.forEach((notification) => {

        if (notification.type !== 'message') {
          uniqueNotifications.push(notification);
          return;
        }

        const senderId =
          typeof notification.sender === 'object'
            ? notification.sender?._id
            : notification.sender;

        const key = `${senderId}_${notification.isRead}`;

        if (!senderMap.has(key)) {
          senderMap.add(key);
          uniqueNotifications.push(notification);
        }
      });

      // =====================================
      // REMOVE DUPLICATE IDS
      // =====================================
      const notificationMap = new Map();

      uniqueNotifications.forEach((notification) => {

        const existing =
          notificationMap.get(notification._id);

        // keep READ version if duplicate exists
        if (!existing) {

          notificationMap.set(
            notification._id,
            notification
          );

        } else if (
          notification.isRead &&
          !existing.isRead
        ) {

          notificationMap.set(
            notification._id,
            notification
          );
        }
      });

const dedupedNotifications =
  Array.from(notificationMap.values());

      if (shouldDebugNotifications()) {
        console.debug('[notifications] refresh result', {
          requestId,
          total: allNotifications.length,
          deduped: dedupedNotifications.length,
          messages: messageList.length,
        });
      }

      if (requestId !== refreshCounter.current) {
        if (shouldDebugNotifications()) {
          console.debug('[notifications] refresh ignored (stale)', {
            requestId,
            latest: refreshCounter.current,
          });
        }
        return;
      }

      setNotifications(dedupedNotifications);

      setMessageNotifications(messageList);

      setUnreadMessages(unreadCount);

    } catch (err) {

      console.error(
        'Notification fetch error:',
        err
      );

    } finally {
      if (requestId === refreshCounter.current) {
        setLoading(false);
      }
    }

  }, [isAuthenticated, userId]);

  // =========================================
  // INITIAL LOAD
  // =========================================
  useEffect(() => {

    if (isAuthenticated && userId) {
      refreshNotifications();
    }

  }, [isAuthenticated, userId, refreshNotifications]);

  // =========================================
  // SOCKET REALTIME NOTIFICATIONS
  // =========================================
  useEffect(() => {

    if (!isAuthenticated) return;

    if (listenerAttached.current) return;

    const handleRealtimeNotification = (data) => {

      console.log(
        'Socket received new notification:',
        data
      );

      if (!data?._id) return;

      // =====================================
      // MAIN NOTIFICATIONS
      // =====================================
      setNotifications((prev) => {

        const senderId =
          typeof data.sender === 'object'
            ? data.sender?._id
            : data.sender;

        let updated = [...prev];

        // only one unread message notification per sender
        if (data.type === 'message') {

          updated = updated.filter((item) => {

            const itemSender =
              typeof item.sender === 'object'
                ? item.sender?._id
                : item.sender;

            return !(
              item.type === 'message' &&
              itemSender === senderId &&
              !item.isRead
            );
          });
        }

        // prevent duplicate notifications
        const alreadyExists = updated.some(
          (item) => item._id === data._id
        );

        if (alreadyExists) {
          return updated;
        }

        updated = [data, ...updated];

        if (shouldDebugNotifications()) {
          console.debug('[notifications] socket merge', {
            incomingId: data._id,
            prevCount: prev.length,
            nextCount: updated.length,
          });
        }

        return updated;
      });

      // =====================================
      // MESSAGE NOTIFICATIONS
      // =====================================
      if (data.type === 'message') {

        setMessageNotifications((prev) => {

          const senderId =
            typeof data.sender === 'object'
              ? data.sender?._id
              : data.sender;

          let updated = prev.filter((item) => {

            const itemSender =
              typeof item.sender === 'object'
                ? item.sender?._id
                : item.sender;

            return !(
              itemSender === senderId &&
              !item.isRead
            );
          });

          updated = [data, ...updated];

          return updated;
        });

        if (!data.isRead) {

          setUnreadMessages(
            (prev) => prev + 1
          );
        }
      }
    };

    socketService.off('new_notification');

    socketService.on(
      'new_notification',
      handleRealtimeNotification
    );

    listenerAttached.current = true;

    return () => {

      socketService.off('new_notification');

      listenerAttached.current = false;
    };

  }, [isAuthenticated]);

  // =========================================
  // MARK NOTIFICATION READ
  // =========================================
  const markNotificationAsRead = useCallback(
    async (notificationId) => {

      if (!notificationId) return;

      if (shouldDebugNotifications()) {
        console.debug('[notifications] mark read start', {
          notificationId,
        });
      }

      // =====================================
      // INSTANT UI UPDATE
      // =====================================
      setNotifications((prev) => {

        const next = prev.map((item) => {

          if (item._id === notificationId) {

            return {
              ...item,
              isRead: true,
            };
          }

          return item;
        });

        if (shouldDebugNotifications()) {
          console.debug('[notifications] mark read optimistic update', {
            notificationId,
            prevCount: prev.length,
            nextCount: next.length,
          });
        }

        return next;
      });

      try {
        await notificationService.markAsRead(notificationId);

        if (shouldDebugNotifications()) {
          console.debug('[notifications] mark read success', {
            notificationId,
          });
        }

      } catch (error) {

        console.error(
          'Failed to mark notification read:',
          error
        );

        if (shouldDebugNotifications()) {
          console.debug('[notifications] mark read failed, refreshing', {
            notificationId,
          });
        }

        refreshNotifications();
      }
    },
    [refreshNotifications]
  );

  // =========================================
  // CONTEXT VALUE
  // =========================================
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

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {

  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      'useNotifications must be used within NotificationProvider'
    );
  }

  return context;
};