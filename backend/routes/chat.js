const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validate');

router.get('/', protect, chatController.getConversations);
router.get('/unread', protect, chatController.getUnreadCount);
router.post('/', protect, chatController.createOrGetConversation);
router.get('/:id', protect, validateObjectId, chatController.getConversation);
router.post('/:id/messages', protect, validateObjectId, chatController.sendMessage);

module.exports = router;
