import React from 'react';
import { useNavigate } from 'react-router-dom';

const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return `${value._id}`;
  return `${value}`;
};

const getItemId = (notification) => {
  return (
    normalizeId(notification?.itemId) ||
    normalizeId(notification?.metadata?.itemId) ||
    normalizeId(notification?.targetId)
  );
};

const getPostId = (notification) => {
  return (
    normalizeId(notification?.postId) ||
    normalizeId(notification?.metadata?.postId) ||
    normalizeId(notification?.targetId)
  );
};

const getNotificationRoute = (notification) => {
  switch (notification?.type) {
    case 'message': {
      const chatId =
        notification?.sender?._id ||
        notification?.senderId ||
        notification?.metadata?.senderId ||
        notification?.targetId;

      return chatId ? `/chat/${chatId}` : '/chat';
    }
    case 'item_save': {
      const itemId = getItemId(notification);
      if (!itemId) return '/notifications';

      const itemType = `${notification?.metadata?.itemType || ''}`.toLowerCase();
      if (itemType === 'service') return `/services/${itemId}`;
      return `/marketplace/item/${itemId}`;
    }
    case 'community_interaction': {
      const postId = getPostId(notification);
      return postId ? `/community/post/${postId}` : '/community';
    }
    default:
      return '/notifications';
  }
};

const NotificationItem = ({ notification, compact = false, onBeforeNavigate }) => {
  const navigate = useNavigate();

  if (!notification) return null;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('Notification Payload:', notification);
    console.log('Navigating with payload:', notification);

    if (notification?.type === 'message') {
      const chatId =
        notification?.sender?._id ||
        notification?.senderId ||
        notification?.metadata?.senderId ||
        notification?.targetId;

      if (chatId) {
        navigate(`/chat/${chatId}`);
      } else {
        console.error('Redirect failed: No ID found', notification);
        navigate('/chat');
      }
    } else {
      const route = getNotificationRoute(notification);
      navigate(route);
    }

    if (onBeforeNavigate) {
      Promise.resolve(onBeforeNavigate(notification)).catch((error) => {
        console.error('Failed to mark notification as read:', error);
      });
    }
  };

  return (
    <button
      type="button"
      className={`notification-item ${compact ? 'compact' : ''} ${notification.isRead ? '' : 'unread'}`.trim()}
      onClick={handleClick}
    >
      <div className="notification-item-text">{notification.text}</div>
      <div className="notification-item-meta">
        <span>{new Date(notification.createdAt).toLocaleString()}</span>
        {!notification.isRead && <span className="notification-dot" aria-label="Unread" />}
      </div>
    </button>
  );
};

export default NotificationItem;
