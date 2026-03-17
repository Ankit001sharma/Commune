const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

router.get('/recommendations', protect, aiController.getRecommendations);
router.get('/search', aiController.naturalLanguageSearch);
router.post('/chatbot', aiController.chatbot);

module.exports = router;
