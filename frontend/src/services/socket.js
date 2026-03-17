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
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
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
