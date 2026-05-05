const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

router.use(protect, restrictTo('admin'));
router.get('/overview', adminController.getOverview);
router.get('/users', adminController.getUsers);
router.put('/users/:id', adminController.updateUser);
router.post('/recommendation-emails', adminController.sendRecommendationEmails);

module.exports = router;
