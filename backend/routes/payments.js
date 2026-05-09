const express = require('express');
const router = express.Router();

const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

/**
 * Razorpay payment routes
 * All routes are authenticated. The two endpoints implement the standard
 * Razorpay Checkout flow:
 *   1. POST /orders   – server creates a Razorpay order
 *   2. POST /verify   – server verifies the signature returned by Checkout
 */

router.post('/orders', protect, paymentController.createOrder);
router.post('/verify', protect, paymentController.verifyPayment);

module.exports = router;
