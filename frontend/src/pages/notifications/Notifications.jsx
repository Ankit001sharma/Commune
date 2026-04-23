import React, { useEffect } from 'react';
import NotificationItem from '../../components/common/NotificationItem';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

const Notifications = () => {
  const { user } = useAuth();
  const userId = user?._id;

  const {
    notifications,
    loading,
    markAllNonMessageAsRead,
    markNotificationAsRead,
    refreshNotifications,
  } = useNotifications();

  useEffect(() => {
    const markSeen = async () => {
      if (!userId) return;

      try {
        await markAllNonMessageAsRead();
        await refreshNotifications();
      } catch (error) {
        // Prevent uncaught runtime errors from crashing the UI.
        console.error('Failed to mark notifications as seen:', error);
      }
    };

    markSeen();
  }, [markAllNonMessageAsRead, refreshNotifications, userId]);

  return (
    <div style={{ padding: '24px' }}>
      <h2>Notifications</h2>

      {loading && <p style={{ marginTop: 12 }}>Loading...</p>}

      {notifications.length === 0 ? (
        <p style={{ marginTop: 12 }}>No notifications yet</p>
      ) : (
        notifications.map((notification) => (
          <NotificationItem
            key={notification._id}
            notification={notification}
            onBeforeNavigate={async () => {
              if (!notification.isRead) {
                await markNotificationAsRead(notification._id);
              }
            }}
          />
        ))
      )}
    </div>
  );
};

export default Notifications;