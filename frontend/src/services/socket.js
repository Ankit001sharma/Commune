import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map(); // ✅ keep this
  }

  connect(token) {
    if (this.socket) {
      if (this.socket.connected) return;

      this.socket.auth = { token };
      this.socket.connect();
      return;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Error:', error.message);
    });

    // ✅ rebind listeners after reconnect
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((cb) => this.socket.on(event, cb));
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

    const set = this.listeners.get(event) || new Set();
    set.add(callback);
    this.listeners.set(event, set);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    const set = this.listeners.get(event);
    if (set) {
      if (callback) set.delete(callback);
      else set.clear();

      if (set.size === 0) this.listeners.delete(event);
    }

    if (this.socket) {
      if (callback) this.socket.off(event, callback);
      else this.socket.off(event);
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

export default new SocketService();