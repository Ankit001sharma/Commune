const Conversation = require('../models/Conversation');
const AppError = require('../utils/AppError');
const { sendResponse } = require('../utils/response');
const ChatService = require('../services/ChatService');
const { emitNotificationToUser, emitToConversation, onlineUsers } = require('../services/socketService');

// 🔹 GET ALL CONVERSATIONS
exports.getConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
      isActive: true,
    })
      .populate('participants', 'firstName lastName avatar lastActive')
      .populate('relatedListing', 'title images price')
      .populate('relatedService', 'title pricing')
      .sort('-updatedAt');

    const enriched = conversations.map((conversation) => {
      const unreadCount = (conversation.messages || []).reduce((count, msg) => {
        if (msg.sender.toString() === req.user._id.toString()) return count;

        const isRead = msg.readBy.some(
          (r) => r.user.toString() === req.user._id.toString()
        );

        return isRead ? count : count + 1;
      }, 0);

      const base = conversation.toObject();
      return { ...base, unreadCount };
    });

    sendResponse(res, 200, enriched);
  } catch (error) {
    next(error);
  }
};

// 🔹 GET SINGLE CONVERSATION
exports.getConversation = async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user._id;

    const conversation = await Conversation.findById(conversationId)
      .populate('participants', 'firstName lastName avatar lastActive')
      .populate('relatedListing', 'title images price seller')
      .populate('relatedService', 'title pricing provider')
      .populate('messages.sender', 'firstName lastName avatar');

    if (!conversation) return next(new AppError('Conversation not found.', 404));

    const isParticipant = conversation.participants.some(
      (p) => p._id.toString() === userId.toString()
    );
    if (!isParticipant) return next(new AppError('Access denied.', 403));

    // Mark as read using ChatService
    await ChatService.markAsRead(conversationId, userId);

    sendResponse(res, 200, conversation);
  } catch (error) {
    next(error);
  }
};

// 🔹 CREATE OR GET CONVERSATION
exports.createOrGetConversation = async (req, res, next) => {
  try {
    const { recipientId, listingId, serviceId } = req.body;

    if (!recipientId) return next(new AppError('Recipient is required.', 400));
    if (recipientId === req.user._id.toString()) {
      return next(new AppError('Cannot chat with yourself.', 400));
    }

    const query = {
      participants: { $all: [req.user._id, recipientId] },
      isActive: true,
    };

    if (listingId) query.relatedListing = listingId;
    if (serviceId) query.relatedService = serviceId;

    let conversation = await Conversation.findOne(query)
      .populate('participants', 'firstName lastName avatar lastActive')
      .populate('relatedListing', 'title images price')
      .populate('relatedService', 'title pricing');

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, recipientId],
        relatedListing: listingId || null,
        relatedService: serviceId || null,
        messages: [],
      });

      await conversation.populate('participants', 'firstName lastName avatar lastActive');
    }

    sendResponse(res, 200, conversation);

  } catch (error) {
    next(error);
  }
};

// 🔹 SEND MESSAGE (IMPORTANT)
exports.sendMessage = async (req, res, next) => {
  try {
    const { content, messageType = 'text', metadata } = req.body;
    const conversationId = req.params.id;

    if (!content || content.trim().length === 0) {
      return next(new AppError('Message content is required.', 400));
    }

    const { newMessage, notifications, recipients } = await ChatService.sendMessage({
      conversationId,
      senderId: req.user._id,
      senderName: req.user.fullName,
      content,
      messageType,
      metadata,
    });

    const messageData = {
      _id: newMessage._id,
      sender: {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        avatar: req.user.avatar,
      },
      content: newMessage.content,
      messageType: newMessage.messageType,
      metadata: newMessage.metadata,
      createdAt: newMessage.createdAt,
      conversationId,
    };

    // Emit to conversation room
    emitToConversation(conversationId, 'message:new', messageData);

    // Emit notifications
    notifications.forEach((notification, index) => {
      const pid = recipients[index].toString();
      
      emitNotificationToUser(pid, notification);
    });

    sendResponse(res, 201, newMessage, 'Message sent');
  } catch (error) {
    next(error);
  }
};

// 🔹 UNREAD COUNT
exports.getUnreadCount = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
      isActive: true,
    });

    let unreadCount = 0;

    conversations.forEach((conv) => {
      conv.messages.forEach((msg) => {
        if (msg.sender.toString() !== req.user._id.toString()) {
          const isRead = msg.readBy.some(
            (r) => r.user.toString() === req.user._id.toString()
          );
          if (!isRead) unreadCount++;
        }
      });
    });

    sendResponse(res, 200, { unreadCount });

  } catch (error) {
    next(error);
  }
};