const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validateSaveItem } = require('../middleware/validate');
const userController = require('../controllers/userController');

router.post('/save-item', protect, validateSaveItem, userController.saveItem);
router.get('/saved-items', protect, userController.getSavedItems);
router.get('/activity', protect, userController.getActivity);
router.get('/email-preferences', protect, userController.getEmailPreferences);
router.patch('/email-preferences', protect, userController.updateEmailPreferences);

module.exports = router;
