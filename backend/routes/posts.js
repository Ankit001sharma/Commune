const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { protect, optionalAuth } = require('../middleware/auth');
const { validatePost, validateObjectId } = require('../middleware/validate');
const upload = require('../middleware/upload');

router.get('/', optionalAuth, postController.getPosts);
router.get('/:id', validateObjectId, optionalAuth, postController.getPost);

router.post('/', protect, upload.array('images', 3), validatePost, postController.createPost);
router.put('/:id', protect, validateObjectId, postController.updatePost);
router.delete('/:id', protect, validateObjectId, postController.deletePost);

router.post('/:id/comments', protect, validateObjectId, postController.addComment);
router.delete('/:id/comments/:commentId', protect, postController.deleteComment);
router.put('/:id/like', protect, validateObjectId, postController.toggleLike);

module.exports = router;
