import React from 'react';
import { useNavigate } from 'react-router-dom';
import './NotificationItem.css';
import {
  FiMessageCircle,
  FiBookmark,
  FiBell,
  FiHeart,
  FiEdit3,
  FiStar,
  FiAlertCircle,
  FiCheckCircle,
} from 'react-icons/fi';

// =========================================
// HELPERS
// =========================================
const normalizeId = (value) => {

  if (!value) return null;

  if (typeof value === 'string') {
    return value;
  }

  if (
    typeof value === 'object' &&
    value._id
  ) {
    return `${value._id}`;
  }

  return `${value}`;
};

const isValidObjectId = (value) => (
  /^[a-fA-F0-9]{24}$/.test(`${value || ''}`)
);

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

// =========================================
// ICONS
// =========================================
const getNotificationIcon = (notification) => {

switch (notification?.type){

    case 'message':
      return (
        <FiMessageCircle
          size={20}
          color="#3b82f6"
        />
      );

    case 'item_save':
      return (
        <FiBookmark
          size={20}
          color="#f59e0b"
        />
      );

    case 'recommendation':
      return (
        <FiStar
          size={20}
          color="#eab308"
        />
      );

    case 'community_interaction': {

  const text =
    notification?.text?.toLowerCase() || '';

  // ✅ COMMENT
  if (text.includes('comment')) {

    return (
      <FiEdit3
        size={20}
        color="#06b6d4"
      />
    );
  }

  // ✅ LIKE
  if (text.includes('like')) {

    return (
      <FiHeart
        size={20}
        color="#ef4444"
      />
    );
  }

  // ✅ DEFAULT
  return (
    <FiBell
      size={20}
      color="#a855f7"
    />
  );
}

    case 'success':
      return (
        <FiCheckCircle
          size={20}
          color="#22c55e"
        />
      );

    case 'warning':
      return (
        <FiAlertCircle
          size={20}
          color="#f97316"
        />
      );

    default:
      return (
        <FiBell
          size={20}
          color="#a855f7"
        />
      );
  }
};

// =========================================
// ROUTES
// =========================================
const getNotificationRoute = (
  notification
) => {

  switch (notification?.type) {

    case 'message': {

      const chatId =
        notification?.sender?._id ||
        notification?.senderId ||
        notification?.metadata?.senderId ||
        notification?.targetId;

      return chatId
        ? `/chat/${chatId}`
        : '/chat';
    }

    case 'item_save': {

      const itemId =
        getItemId(notification);

      if (!itemId || !isValidObjectId(itemId)) {
        return '/notifications';
      }

      const itemType =
        `${
          notification?.metadata?.itemType || ''
        }`.toLowerCase();

      if (itemType === 'service') {
        return `/services/${itemId}`;
      }

      return `/marketplace/item/${itemId}`;
    }

    case 'community_interaction': {
      const postId = getPostId(notification);

      if (!postId || !isValidObjectId(postId)) {
        return '/notifications';
      }

      return `/community/${postId}`;
    }

    default:
      return '/notifications';
  }
};

// =========================================
// COMPONENT
// =========================================
const NotificationItem = ({
  notification,
  compact = false,
  onBeforeNavigate,
}) => {

  const navigate = useNavigate();

  if (!notification) return null;

const handleClick = async (e) => {

  e.preventDefault();

  e.stopPropagation();

  try {

    // ====================================
    // ✅ FIRST MARK AS READ
    // ====================================
    if (
      onBeforeNavigate &&
      !notification?.isRead
    ) {

      await onBeforeNavigate(notification);

      // ✅ wait tiny moment
      await new Promise((resolve) =>
        setTimeout(resolve, 200)
      );
    }

    // ====================================
    // MESSAGE
    // ====================================
    if (
      notification?.type === 'message'
    ) {

      const chatId =
        notification?.sender?._id ||
        notification?.senderId ||
        notification?.metadata?.senderId ||
        notification?.targetId;

      if (chatId) {

        navigate(`/chat/${chatId}`);

      } else {

        navigate('/chat');
      }

      return;
    }

    // ====================================
    // OTHER ROUTES
    // ====================================
    const route =
      getNotificationRoute(notification);

    navigate(route);

  } catch (error) {

    console.error(
      'Notification click error:',
      error
    );
  }
};

  return (
    <button
      type="button"
      className={`notification-item ${
        compact ? 'compact' : ''
      } ${
        notification.isRead
          ? ''
          : 'unread'
      }`.trim()}

      onClick={handleClick}
    >

      {/* ICON */}
      <div
        className="notification-icon"
      >
        {getNotificationIcon( notification )}
      </div>

      {/* CONTENT */}
      <div
        className="notification-content"
      >

        <div
          className="notification-item-text"
        >
          {notification.text}
        </div>

        <div
          className="notification-item-meta"
        >
          <span>
            {new Date(
              notification.createdAt
            ).toLocaleString()}
          </span>

          {!notification.isRead && (
            <span
              className="notification-dot"
              aria-label="Unread"
            />
          )}
        </div>

      </div>

    </button>
  );
};

export default NotificationItem;