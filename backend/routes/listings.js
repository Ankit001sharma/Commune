const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController');
const { protect, optionalAuth } = require('../middleware/auth');
const { logViewAfterResponse } = require('../middleware/activityLogger');
const { validateListing, validateObjectId } = require('../middleware/validate');
const upload = require('../middleware/upload');

router.get('/', optionalAuth, listingController.getListings);
router.get('/my', protect, listingController.getMyListings);
router.get('/category/:category', optionalAuth, listingController.getListingsByCategory);
router.get('/:id/location', validateObjectId, optionalAuth, listingController.getListingLocation);
router.get('/:id', validateObjectId, optionalAuth, listingController.getListing, logViewAfterResponse('listing'));

router.post('/', protect, upload.array('images', 5), validateListing, listingController.createListing);
router.put('/:id', protect, validateObjectId, upload.array('images', 5), listingController.updateListing);
router.put('/:id/location', protect, validateObjectId, listingController.updateListingLocation);
router.delete('/:id', protect, validateObjectId, listingController.deleteListing);

module.exports = router;
