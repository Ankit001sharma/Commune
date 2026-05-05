const Listing = require('../models/Listing');
const AppError = require('../utils/AppError');
const { sendResponse, sendPaginatedResponse } = require('../utils/response');
const QueryBuilder = require('../utils/QueryBuilder');

const mongoose = require ("mongoose");
const FREE_UPLOAD_LIMIT = 2;

const normalizeLocation = (body) => {
  if (!body.location && !body.locationAddress && !body.locationLat && !body.locationLng) return undefined;

  let parsed = {};
  if (body.location && typeof body.location === 'string') {
    try {
      parsed = JSON.parse(body.location);
    } catch (_) {
      parsed = { address: body.location };
    }
  } else if (body.location && typeof body.location === 'object') {
    parsed = body.location;
  }

  const lat = body.locationLat ?? parsed.lat ?? parsed.coordinates?.lat;
  const lng = body.locationLng ?? parsed.lng ?? parsed.coordinates?.lng;

  return {
    address: body.locationAddress || parsed.address || parsed.label || 'Campus',
    mode: body.locationMode || parsed.mode || (lat && lng ? 'live' : 'manual'),
    coordinates: {
      lat: lat !== undefined && lat !== '' ? Number(lat) : null,
      lng: lng !== undefined && lng !== '' ? Number(lng) : null,
    },
    updatedAt: lat && lng ? new Date() : null,
  };
};

const chargeListingToken = async (user) => {
  if (!user.tokens) {
    user.tokens = { balance: 0, freeUploadsUsed: 0, totalPurchased: 0 };
  }

  if ((user.tokens?.freeUploadsUsed || 0) < FREE_UPLOAD_LIMIT) {
    user.tokens.freeUploadsUsed = (user.tokens.freeUploadsUsed || 0) + 1;
    await user.save({ validateBeforeSave: false });
    return { charged: false, freeUploadsLeft: FREE_UPLOAD_LIMIT - user.tokens.freeUploadsUsed };
  }

  if ((user.tokens?.balance || 0) < 1) {
    throw new AppError('You used your 2 free uploads. Buy tokens from Transactions to post more products.', 402);
  }

  user.tokens.balance -= 1;
  await user.save({ validateBeforeSave: false });
  return { charged: true, freeUploadsLeft: 0 };
};

exports.createListing = async (req, res, next) => {
  try {
    console.log('FILES:', req.files);

    const tokenResult = await chargeListingToken(req.user);

    const listingData = {
      ...req.body,
      seller: req.user._id,
    };
    const location = normalizeLocation(req.body);
    if (location) listingData.location = location;

    if (req.files && req.files.length > 0) {
      listingData.images = req.files.map((file) => ({
        url: file.path,
      }));
    }

    if (req.body.tags && typeof req.body.tags === 'string') {
      listingData.tags = req.body.tags.split(',').map((t) => t.trim().toLowerCase());
    }

    const listing = await Listing.create(listingData);
    await listing.populate('seller', 'firstName lastName avatar rating');

    sendResponse(res, 201, listing, tokenResult.charged ? 'Listing created using 1 token' : 'Listing created using a free upload');
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
    const id = req.params.id;

    // check valid id
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid listing ID", 400));
    }

    const listing = await Listing.findById(id).populate(
      "seller",
      "firstName lastName avatar rating phone email"
    );

    if (!listing) {
      return next(new AppError("Listing not found.", 404));
    }

    // safe views increment
    listing.views = (listing.views || 0) + 1;
    await listing.save({ validateBeforeSave: false });

    // safe user check
    if (req.user && req.user._id && listing.category) {
      try {
        await require("../models/User").findByIdAndUpdate(
          req.user._id,
          {
            $addToSet: {
              "recommendationProfile.viewedCategories": listing.category,
            },
          },
          { new: true }
        );
      } catch (err) {
        console.log("Recommendation update error:", err);
      }
    }

    sendResponse(res, 200, listing);

  } catch (error) {
    console.log("GET LISTING ERROR:", error);
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

    const allowedFields = ['title', 'description', 'category', 'price', 'negotiable', 'condition', 'tags', 'status'];
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => ({
        url: file.path,
      }));
      updateData.images = [...(listing.images || []), ...newImages];
    }
    const location = normalizeLocation(req.body);
    if (location) updateData.location = location;

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
