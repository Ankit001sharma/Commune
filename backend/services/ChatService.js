const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');

class ChatService {
  /**
   * Send a message in a conversation and create notifications for recipients
   */

  async sendMessage({
      conversationId,
      senderId,
      senderName,
      content,
      messageType = 'text',
      metadata = {},
    }) {
      try {

        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
          throw new AppError('Conversation not found', 404);
        }

        const isParticipant = conversation.participants.some(
          (p) => p.toString() === senderId.toString()
        );

        if (!isParticipant) {
          throw new AppError('Access denied', 403);
        }

        // ✅ FIX: ensure messages array exists
        if (!conversation.messages) {
          conversation.messages = [];
        }

        const message = {
          sender: senderId,
          content: content.trim(),
          messageType,
          metadata,
          readBy: [
            {
              user: senderId,
              readAt: new Date(),
            },
          ],
        };

        conversation.messages.push(message);

        conversation.lastMessage = {
          content: content.trim(),
          sender: senderId,
          createdAt: new Date(),
        };

        // ✅ safer save
        await conversation.save({ validateBeforeSave: false });

        const newMessage =
          conversation.messages[conversation.messages.length - 1];

        // recipients
        const recipients = conversation.participants.filter(
          (p) => p.toString() !== senderId.toString()
        );

        // notifications
      const notifications = await Promise.all(
        recipients.map(async (userId) => {

          // ✅ check existing unread notification
          let existingNotification = await Notification.findOne({
            user: userId,
            type: 'message',
            sender: senderId,
            isRead: false,
          });

          // ✅ if already exists -> reuse it
          if (existingNotification) {
            return existingNotification;
          }

          // ✅ otherwise create new notification
          return Notification.create({
            user: userId,
            type: 'message',
            sender: senderId,
            senderName: senderName || 'Someone',
            targetId: senderId.toString(),
            text: `${senderName || 'Someone'} sent you a message`,
            conversationId: conversation._id,
            metadata: {
              senderId: senderId.toString(),
              messagePreview: content.trim().slice(0, 120),
            },
          });

        })
      );

        return {
          conversation,
          newMessage,
          notifications,
          recipients,
        };

      } catch (error) {

        console.log('SEND MESSAGE ERROR:', error);

        throw error;
      }
  }

  /**
   * Mark all messages in a conversation as read for a specific user
   */
  async markAsRead(conversationId, userId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return null;

    let updated = false;
    conversation.messages.forEach((msg) => {
      if (msg.sender.toString() !== userId.toString()) {
        const alreadyRead = msg.readBy.some(
          (r) => r.user.toString() === userId.toString()
        );
        if (!alreadyRead) {
          msg.readBy.push({ user: userId, readAt: new Date() });
          updated = true;
        }
      }
    });

    if (updated) {
      await conversation.save({ validateBeforeSave: false });
    }

    // Also mark related notifications as read
    await Notification.updateMany(
      {
        user: userId,
        type: 'message',
        conversationId,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    return updated;
  }
}

module.exports = new ChatService();
