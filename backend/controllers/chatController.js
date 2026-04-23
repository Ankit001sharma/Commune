const Conversation = require('../models/Conversation');
const AppError = require('../utils/AppError');
const { sendResponse } = require('../utils/response');
const Notification = require('../models/Notification');
const { emitNotificationToUser, emitToConversation } = require('../services/socketService');

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
    const conversation = await Conversation.findById(req.params.id)
      .populate('participants', 'firstName lastName avatar lastActive')
      .populate('relatedListing', 'title images price seller')
      .populate('relatedService', 'title pricing provider')
      .populate('messages.sender', 'firstName lastName avatar');

    if (!conversation) return next(new AppError('Conversation not found.', 404));

    const isParticipant = conversation.participants.some(
      (p) => p._id.toString() === req.user._id.toString()
    );
    if (!isParticipant) return next(new AppError('Access denied.', 403));

    // mark messages read
    conversation.messages.forEach((msg) => {
      if (msg.sender._id.toString() !== req.user._id.toString()) {
        const alreadyRead = msg.readBy.some(
          (r) => r.user.toString() === req.user._id.toString()
        );
        if (!alreadyRead) {
          msg.readBy.push({ user: req.user._id, readAt: new Date() });
        }
      }
    });

    await conversation.save();

    await Notification.updateMany(
      {
        user: req.user._id,
        type: 'message',
        conversationId: conversation._id,
        isRead: false,
      },
      { isRead: true }
    );

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

    if (!content || content.trim().length === 0) {
      return next(new AppError('Message content is required.', 400));
    }

    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return next(new AppError('Conversation not found.', 404));

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );

    if (!isParticipant) return next(new AppError('Access denied.', 403));

    const message = {
      sender: req.user._id,
      content: content.trim(),
      messageType,
      metadata: metadata || {},
      readBy: [{ user: req.user._id, readAt: new Date() }],
    };

    conversation.messages.push(message);

    conversation.lastMessage = {
      content: content.trim(),
      sender: req.user._id,
      createdAt: new Date(),
    };

    await conversation.save();

    // 🔥 CREATE NOTIFICATIONS
    const recipients = conversation.participants.filter(
      (p) => p.toString() !== req.user._id.toString()
    );

    const senderName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'Someone';

    for (const userId of recipients) {
      const notification = await Notification.create({
        user: userId,
        type: 'message',
        sender: req.user._id,
        senderName,
        targetId: req.user._id.toString(),
        text: `User ${senderName} sent you a message`,
        conversationId: conversation._id,
        metadata: {
          senderId: req.user._id.toString(),
          messagePreview: content.trim().slice(0, 120),
        },
      });

      emitNotificationToUser(userId.toString(), notification);
    }

    const newMessage = conversation.messages[conversation.messages.length - 1];

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
      conversationId: conversation._id.toString(),
    };

    emitToConversation(conversation._id.toString(), 'message:new', messageData);

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