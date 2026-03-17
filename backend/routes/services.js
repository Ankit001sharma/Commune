const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { protect, optionalAuth } = require('../middleware/auth');
const { validateService, validateObjectId } = require('../middleware/validate');
const upload = require('../middleware/upload');

router.get('/', optionalAuth, serviceController.getServices);
router.get('/my', protect, serviceController.getMyServices);
router.get('/:id', validateObjectId, optionalAuth, serviceController.getService);

router.post('/', protect, upload.array('images', 5), validateService, serviceController.createService);
router.put('/:id', protect, validateObjectId, upload.array('images', 5), serviceController.updateService);
router.delete('/:id', protect, validateObjectId, serviceController.deleteService);

module.exports = router;
