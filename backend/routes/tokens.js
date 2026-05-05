const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const tokenController = require('../controllers/tokenController');

router.get('/pricing', protect, tokenController.getPricing);
router.post('/purchase', protect, tokenController.purchasePlan);

module.exports = router;
