import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect(token) {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Error:', error.message);
    });

    // Re-bind persisted listeners for the current socket instance.
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        this.socket.on(event, callback);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  on(event, callback) {
    if (!event || typeof callback !== 'function') return;

    const callbacks = this.listeners.get(event) || new Set();
    callbacks.add(callback);
    this.listeners.set(event, callbacks);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (!event) return;

    const callbacks = this.listeners.get(event);
    if (callbacks) {
      if (callback) {
        callbacks.delete(callback);
      } else {
        callbacks.clear();
      }

      if (callbacks.size === 0) {
        this.listeners.delete(event);
      } else {
        this.listeners.set(event, callbacks);
      }
    }

    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  joinConversation(conversationId) {
    this.emit('conversation:join', conversationId);
  }

  leaveConversation(conversationId) {
    this.emit('conversation:leave', conversationId);
  }

  sendMessage(data) {
    this.emit('message:send', data);
  }

  startTyping(conversationId) {
    this.emit('typing:start', conversationId);
  }

  stopTyping(conversationId) {
    this.emit('typing:stop', conversationId);
  }

  markAsRead(conversationId) {
    this.emit('messages:read', { conversationId });
  }
}

const socketService = new SocketService();
export default socketService;
