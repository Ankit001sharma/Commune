const Listing = require('../models/Listing');
const AppError = require('../utils/AppError');
const { sendResponse, sendPaginatedResponse } = require('../utils/response');
const QueryBuilder = require('../utils/QueryBuilder');

exports.createListing = async (req, res, next) => {
  try {
    const listingData = {
      ...req.body,
      seller: req.user._id,
    };

    if (req.files && req.files.length > 0) {
      listingData.images = req.files.map((file) => ({
        url: `/uploads/${file.filename}`,
        thumbnail: `/uploads/${file.filename}`,
      }));
    }

    if (req.body.tags && typeof req.body.tags === 'string') {
      listingData.tags = req.body.tags.split(',').map((t) => t.trim().toLowerCase());
    }

    const listing = await Listing.create(listingData);
    await listing.populate('seller', 'firstName lastName avatar rating');

    sendResponse(res, 201, listing, 'Listing created successfully');
  } catch (error) {
    next(error);
  }
};

exports.getListings = async (req, res, next) => {
  try {
    const queryBuilder = new QueryBuilder(Listing.find({ status: 'active' }), req.query)
      .filter()
      .search(['title', 'description', 'tags'])
      .sort()
      .limitFields()
      .paginate();

    const listings = await queryBuilder.query.populate('seller', 'firstName lastName avatar rating');
    const total = await Listing.countDocuments({ status: 'active' });

    sendPaginatedResponse(res, 200, listings, {
      ...queryBuilder.pagination,
      total,
      pages: Math.ceil(total / (queryBuilder.pagination?.limit || 20)),
    });
  } catch (error) {
    next(error);
  }
};

exports.getListing = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id).populate(
      'seller',
      'firstName lastName avatar rating phone email'
    );

    if (!listing) return next(new AppError('Listing not found.', 404));

    // Increment views
    listing.views += 1;
    await listing.save({ validateBeforeSave: false });

    sendResponse(res, 200, listing);
  } catch (error) {
    next(error);
  }
};

exports.updateListing = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return next(new AppError('Listing not found.', 404));

    if (listing.seller.toString() !== req.user._id.toString()) {
      return next(new AppError('You can only edit your own listings.', 403));
    }

    const allowedFields = ['title', 'description', 'category', 'price', 'negotiable', 'condition', 'location', 'tags', 'status'];
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => ({
        url: `/uploads/${file.filename}`,
        thumbnail: `/uploads/${file.filename}`,
      }));
      updateData.images = [...(listing.images || []), ...newImages];
    }

    if (updateData.tags && typeof updateData.tags === 'string') {
      updateData.tags = updateData.tags.split(',').map((t) => t.trim().toLowerCase());
    }

    const updated = await Listing.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).populate('seller', 'firstName lastName avatar rating');

    sendResponse(res, 200, updated, 'Listing updated successfully');
  } catch (error) {
    next(error);
  }
};

exports.deleteListing = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return next(new AppError('Listing not found.', 404));

    if (listing.seller.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return next(new AppError('You can only delete your own listings.', 403));
    }

    listing.status = 'removed';
    await listing.save({ validateBeforeSave: false });

    sendResponse(res, 200, null, 'Listing removed successfully');
  } catch (error) {
    next(error);
  }
};

exports.getMyListings = async (req, res, next) => {
  try {
    const listings = await Listing.find({ seller: req.user._id })
      .sort('-createdAt')
      .populate('seller', 'firstName lastName avatar');
    sendResponse(res, 200, listings);
  } catch (error) {
    next(error);
  }
};

exports.getListingsByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const listings = await Listing.find({ category, status: 'active' })
      .sort('-createdAt')
      .populate('seller', 'firstName lastName avatar rating');
    sendResponse(res, 200, listings);
  } catch (error) {
    next(error);
  }
};
