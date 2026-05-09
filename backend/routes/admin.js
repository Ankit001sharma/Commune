const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

router.use(protect, restrictTo('admin'));

// Overview / dashboard
router.get('/overview', adminController.getOverview);

// Activity feed
router.get('/activity', adminController.getActivity);

// Users
router.get('/users', adminController.getUsers);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Listings
router.get('/listings', adminController.getListings);
router.put('/listings/:id', adminController.updateListingStatus);
router.delete('/listings/:id', adminController.deleteListing);

// Services
router.get('/services', adminController.getServices);
router.delete('/services/:id', adminController.deleteService);

// Transactions
router.get('/transactions', adminController.getTransactions);

// Posts
router.get('/posts', adminController.getPosts);
router.delete('/posts/:id', adminController.deletePost);

// Recommendation emails
router.post('/recommendation-emails', adminController.sendRecommendationEmails);

module.exports = router;
