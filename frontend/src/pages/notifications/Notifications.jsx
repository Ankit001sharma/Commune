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
    markNotificationAsRead,
    refreshNotifications,
  } = useNotifications();

  const shouldDebugNotifications = () => {
    if (typeof window === 'undefined') return false;
    return window.localStorage?.getItem('cx_debug_notifications') === 'true';
  };

  useEffect(() => {

    if (!userId) return;

    if (shouldDebugNotifications()) {
      console.debug('[notifications] page refresh triggered', { userId });
    }

    refreshNotifications();

  }, [userId, refreshNotifications]);

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