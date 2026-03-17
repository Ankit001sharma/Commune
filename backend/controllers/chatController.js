const Conversation = require('../models/Conversation');
const AppError = require('../utils/AppError');
const { sendResponse } = require('../utils/response');

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

    sendResponse(res, 200, conversations);
  } catch (error) {
    next(error);
  }
};

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

    // Mark messages as read
    conversation.messages.forEach((msg) => {
      if (msg.sender._id.toString() !== req.user._id.toString()) {
        const alreadyRead = msg.readBy.some((r) => r.user.toString() === req.user._id.toString());
        if (!alreadyRead) {
          msg.readBy.push({ user: req.user._id, readAt: new Date() });
        }
      }
    });
    await conversation.save();

    sendResponse(res, 200, conversation);
  } catch (error) {
    next(error);
  }
};

exports.createOrGetConversation = async (req, res, next) => {
  try {
    const { recipientId, listingId, serviceId } = req.body;

    if (!recipientId) return next(new AppError('Recipient is required.', 400));
    if (recipientId === req.user._id.toString()) {
      return next(new AppError('Cannot start a conversation with yourself.', 400));
    }

    // Check for existing conversation
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
      if (listingId) await conversation.populate('relatedListing', 'title images price');
      if (serviceId) await conversation.populate('relatedService', 'title pricing');
    }

    sendResponse(res, 200, conversation);
  } catch (error) {
    next(error);
  }
};

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

    const newMessage = conversation.messages[conversation.messages.length - 1];

    sendResponse(res, 201, newMessage, 'Message sent');
  } catch (error) {
    next(error);
  }
};

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
          const isRead = msg.readBy.some((r) => r.user.toString() === req.user._id.toString());
          if (!isRead) unreadCount++;
        }
      });
    });

    sendResponse(res, 200, { unreadCount });
  } catch (error) {
    next(error);
  }
};
