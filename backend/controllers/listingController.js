const Listing = require('../models/Listing');
const AppError = require('../utils/AppError');
const { sendResponse, sendPaginatedResponse } = require('../utils/response');
const QueryBuilder = require('../utils/QueryBuilder');
const { normalizeFilePath } = require('../utils/file');

const mongoose = require ("mongoose");
const https = require('https');
const FREE_UPLOAD_LIMIT = 2;
const DEBUG_LOCATION = process.env.DEBUG_LOCATION === 'true';

const parseCoordinate = (value, min, max) => {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < min || num > max) return null;
  return num;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = `${value}`.toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
};

const buildLocationText = (data) => {
  const address = data?.address || {};
  const place =
    address.amenity ||
    address.attraction ||
    address.university ||
    address.college ||
    address.school ||
    address.hospital ||
    address.building ||
    address.neighbourhood ||
    address.suburb ||
    address.road ||
    address.village ||
    address.town ||
    address.city ||
    address.county;

  const area =
    address.city ||
    address.town ||
    address.village ||
    address.state ||
    address.county;

  if (place && area && place !== area) {
    return `Near ${place}, ${area}`;
  }

  return place || area || data?.display_name || null;
};

const reverseGeocode = (lat, lng) => new Promise((resolve) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    resolve(null);
    return;
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

  const request = https.get(url, {
    headers: {
      'User-Agent': 'CommuneX/1.0',
      'Accept-Language': 'en',
    },
  }, (res) => {
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(body);
        const text = buildLocationText(parsed);
        if (DEBUG_LOCATION) {
          console.log('[location] reverse geocode', { lat, lng, text });
        }
        resolve(text);
      } catch (_) {
        resolve(null);
      }
    });
  });

  request.on('error', () => resolve(null));
  request.end();
});

const normalizeLocation = async (body, currentLocation = {}) => {
  if (!body.location && !body.locationAddress && !body.locationLat && !body.locationLng && !body.locationText && body.trackingActive === undefined) {
    return undefined;
  }

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

  const hasIncomingCoords =
    body.locationLat !== undefined ||
    body.locationLng !== undefined ||
    parsed.lat !== undefined ||
    parsed.lng !== undefined ||
    parsed.coordinates?.lat !== undefined ||
    parsed.coordinates?.lng !== undefined;

  const rawLat = body.locationLat ?? parsed.lat ?? parsed.coordinates?.lat;
  const rawLng = body.locationLng ?? parsed.lng ?? parsed.coordinates?.lng;

  const currentLat = currentLocation?.coordinates?.lat ?? null;
  const currentLng = currentLocation?.coordinates?.lng ?? null;

  const lat = hasIncomingCoords ? parseCoordinate(rawLat, -90, 90) : currentLat;
  const lng = hasIncomingCoords ? parseCoordinate(rawLng, -180, 180) : currentLng;

  const trackingActive = parseBoolean(body.trackingActive, currentLocation?.trackingActive || false);

  const locationMode =
    body.locationMode || parsed.mode || (lat && lng ? 'live' : 'manual');

  const providedText =
    body.locationText ||
    parsed.locationText ||
    parsed.text ||
    body.locationAddress ||
    parsed.address ||
    parsed.label ||
    null;

  const textUpdatedAt = currentLocation?.textUpdatedAt ? new Date(currentLocation.textUpdatedAt) : null;
  const canGeocode = Number.isFinite(lat) && Number.isFinite(lng);
  const shouldGeocode =
    canGeocode &&
    (!providedText || !textUpdatedAt || (Date.now() - textUpdatedAt.getTime() > 60000));

  let resolvedText = providedText;
  let nextTextUpdatedAt = textUpdatedAt;

  if (shouldGeocode) {
    const geocoded = await reverseGeocode(lat, lng);
    if (geocoded) {
      resolvedText = geocoded;
      nextTextUpdatedAt = new Date();
    }
  }

  if (resolvedText && !nextTextUpdatedAt) {
    nextTextUpdatedAt = new Date();
  }

  const fallbackText = resolvedText || currentLocation?.locationText || currentLocation?.address || 'Campus';

  return {
    address: fallbackText,
    locationText: fallbackText,
    mode: trackingActive ? 'live' : locationMode,
    coordinates: {
      lat: lat !== undefined && lat !== '' ? lat : null,
      lng: lng !== undefined && lng !== '' ? lng : null,
    },
    updatedAt: lat && lng ? new Date() : currentLocation?.updatedAt || null,
    trackingActive,
    textUpdatedAt: nextTextUpdatedAt,
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
    const location = await normalizeLocation(req.body);
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

exports.getListingLocation = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id)
      .select('location status')
      .lean();

    if (!listing || listing.status === 'removed') {
      return next(new AppError('Listing not found.', 404));
    }

    sendResponse(res, 200, listing.location || {});
  } catch (error) {
    next(error);
  }
};

exports.updateListingLocation = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return next(new AppError('Listing not found.', 404));
    }

    if (listing.seller.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return next(new AppError('You can only update your own listing location.', 403));
    }

    if (DEBUG_LOCATION) {
      console.log('[location] update request', {
        listingId: listing._id,
        userId: req.user?._id,
        body: req.body,
      });
    }

    const location = await normalizeLocation(req.body, listing.location || {});

    if (location) {
      const existing = listing.location?.toObject ? listing.location.toObject() : (listing.location || {});
      listing.location = {
        ...existing,
        ...location,
        coordinates: { ...(location.coordinates || {}) },
      };
    }

    await listing.save({ validateBeforeSave: false });

    sendResponse(res, 200, listing.location || {}, 'Location updated');
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

    const allowedFields = ['title', 'description', 'category', 'price', 'negotiable', 'condition', 'tags', 'status'];
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => ({
        url: normalizeFilePath(file.path),
      }));
      updateData.images = [...(listing.images || []), ...newImages];
    }
    const location = await normalizeLocation(req.body, listing.location);
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
