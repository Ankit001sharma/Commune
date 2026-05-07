const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { sendOtp, verifyOtp, resendOtp } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validateRegister, validateLogin, validateObjectId } = require('../middleware/validate');
const upload = require('../middleware/upload');

console.log('Auth routes loaded');

router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/send-otp', validateRegister, sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);

// Protected routes
router.get('/me', protect, authController.getMe);
router.put('/me', protect, upload.single('avatar'), authController.updateMe);
router.put('/change-password', protect, authController.changePassword);
router.put('/favorites/:listingId', protect, authController.toggleFavorite);
router.get('/profile/:id', validateObjectId, authController.getUserProfile);

module.exports = router;
