import api from './api';

const VALID_SCOPES = new Set(['non-message', 'messages', 'all']);

const normalizeScope = (scope) => {
  const normalized = `${scope || 'non-message'}`.toLowerCase();
  return VALID_SCOPES.has(normalized) ? normalized : 'non-message';
};

const notificationService = {
  async getNotifications({ scope = 'non-message', unreadOnly = false, userId } = {}) {
    if (!userId) return [];

    const { data } = await api.get('/notifications', {
      params: {
        scope,
        unreadOnly,
      },
    });

    return data?.data || [];
  },

  async markAsRead(notificationId, userId) {
    if (!notificationId || !userId) return;
    await api.put(`/notifications/${notificationId}/read`);
  },

  async markAllAsRead(scope = 'non-message', userId) {
    if (!userId) return { updated: 0 };

    try {
      const normalizedScope = normalizeScope(scope);
      const { data } = await api.put('/notifications/read-all', null, {
        params: { scope: normalizedScope },
      });

      return data?.data || { updated: 0 };
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);

      if (error?.response?.status === 400) {
        return null;
      }

      return { updated: 0 };
    }
  },

  async markMessageNotificationsByTargetRead(targetId, userId) {
    if (!targetId || !userId) return { updated: 0 };

    const { data } = await api.put(`/notifications/messages/${targetId}/read`);
    return data?.data || { updated: 0 };
  },

  async getUnreadMessagesCount(userId) {
    if (!userId) return 0;

    const { data } = await api.get('/chat/unread');
    return data?.data?.unreadCount || 0;
  },
};

export default notificationService;
