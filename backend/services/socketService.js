const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const ChatService = require('./ChatService');

const onlineUsers = new Map();
let ioInstance = null;

const emitToConversation = (conversationId, event, payload) => {
  if (!ioInstance || !conversationId) return;
  ioInstance.to(`conversation:${conversationId}`).emit(event, payload);
};

const emitNotificationToUser = (userId, notificationPayload) => {
  if (!ioInstance || !userId) return;
  const socketId = onlineUsers.get(String(userId));

  const payload = notificationPayload?.toObject
    ? notificationPayload.toObject()
    : notificationPayload;

  // Preferred event for new clients.
  ioInstance.to(String(userId)).emit('new_notification', payload);

  // Backward-compatible event name.
  ioInstance.to(String(userId)).emit('notification:new', payload);

  // Direct emit to known socket as a fallback if room membership is absent.
  if (!socketId) return;

  ioInstance.to(socketId).emit('new_notification', payload);
  ioInstance.to(socketId).emit('notification:new', payload);
};

const initializeSocket = (io) => {
  ioInstance = io;

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    onlineUsers.set(userId, socket.id);
    socket.join(userId);

    console.log(`[Socket] User connected: ${socket.user.fullName} (${userId})`);

    // Broadcast online status
    io.emit('user:online', { userId, online: true });

    // Join user's conversation rooms
    socket.on('conversation:join', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Handle new message
    socket.on('message:send', async (data) => {
      try {
        const { conversationId, content, messageType = 'text', metadata } = data;

        const { newMessage, notifications, recipients } = await ChatService.sendMessage({
          conversationId,
          senderId: socket.user._id,
          senderName: socket.user.fullName,
          content,
          messageType,
          metadata,
        });

        const messageData = {
          _id: newMessage._id,
          sender: {
            _id: socket.user._id,
            firstName: socket.user.firstName,
            lastName: socket.user.lastName,
            avatar: socket.user.avatar,
          },
          content,
          messageType,
          metadata,
          createdAt: newMessage.createdAt,
          conversationId,
        };

        // Emit to conversation room
        emitToConversation(conversationId, 'message:new', messageData);

        // Emit notifications real-time
        notifications.forEach((notification, index) => {
          const pid = recipients[index].toString();
          emitNotificationToUser(pid, notification);

          // Legacy event
          if (onlineUsers.has(pid)) {
            io.to(onlineUsers.get(pid)).emit('message:notification', {
              conversationId,
              message: messageData,
            });
          }
        });
      } catch (error) {
        socket.emit('error', { message: error.message || 'Failed to send message' });
      }
    });

    // Typing indicators
    socket.on('typing:start', (conversationId) => {
      socket.to(`conversation:${conversationId}`).emit('typing:start', {
        userId,
        conversationId,
      });
    });

    socket.on('typing:stop', (conversationId) => {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
        userId,
        conversationId,
      });
    });

    // Mark messages as read
    socket.on('messages:read', async (data) => {
      try {
        const { conversationId } = data;
        const updated = await ChatService.markAsRead(conversationId, userId);

        if (updated) {
          socket.to(`conversation:${conversationId}`).emit('messages:read', {
            userId,
            conversationId,
          });
        }
      } catch (error) {
        console.error('[Socket] Read error:', error.message);
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      io.emit('user:online', { userId, online: false });
      console.log(`[Socket] User disconnected: ${socket.user.fullName}`);
    });
  });

  return io;
};

module.exports = {
  initializeSocket,
  onlineUsers,
  emitNotificationToUser,
  emitToConversation,
};
