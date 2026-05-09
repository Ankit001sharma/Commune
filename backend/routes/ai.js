const express = require('express');
const multer = require('multer');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

/**
 * For listing-assist we want the raw image buffer in memory so we can
 * base64-encode it for the vision model. This is a separate uploader
 * from the disk/cloudinary one used for actual listing photos.
 */
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 }, // 6 MB
  fileFilter: (req, file, cb) => {
    if (/^image\//i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are accepted'));
  },
});

router.get('/recommendations', protect, aiController.getRecommendations);
router.get('/search', protect, aiController.naturalLanguageSearch);
router.post('/chatbot', aiController.chatbot);

router.post(
  '/listing-assist',
  protect,
  memoryUpload.single('image'),
  aiController.listingAssist
);

module.exports = router;
