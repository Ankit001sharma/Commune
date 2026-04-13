const Service = require('../models/Service');
const AppError = require('../utils/AppError');
const { sendResponse, sendPaginatedResponse } = require('../utils/response');
const QueryBuilder = require('../utils/QueryBuilder');

const CATEGORY_MAP = {
  tutoring: 'tutoring',
  freelancing: 'freelancing',
  'coding-help': 'coding-help',
  codinghelp: 'coding-help',
  coding: 'coding-help',
  'room-rental': 'room-rental',
  roomrental: 'room-rental',
  'mess-info': 'mess-info',
  messinfo: 'mess-info',
  transport: 'transport',
  photography: 'photography',
  'event-planning': 'event-planning',
  eventplanning: 'event-planning',
  'event-help': 'event-planning',
  design: 'design',
  writing: 'writing',
  other: 'other',
};

const PRICING_TYPE_MAP = {
  fixed: 'fixed',
  'fixed-price': 'fixed',
  fixedprice: 'fixed',
  hourly: 'hourly',
  'hourly-rate': 'hourly',
  hourlyrate: 'hourly',
  negotiable: 'negotiable',
  free: 'free',
};

const parseJsonField = (value) => {
  if (!value) return undefined;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return undefined;
  try {
    return JSON.parse(value);
  } catch (_) {
    return undefined;
  }
};

const normalizeServiceType = (value) => {
  const normalized = (value || '').toString().trim().toLowerCase();
  if (normalized === 'requesting') return 'requesting';
  return 'offering';
};

const normalizeCategory = (value) => {
  const normalized = (value || '').toString().trim().toLowerCase().replace(/\s+/g, '-');
  return CATEGORY_MAP[normalized] || 'other';
};

const normalizePricing = (body) => {
  const parsed = parseJsonField(body.pricing) || {};
  const legacyType = body.pricingType || body['pricing[type]'];
  const rawType = parsed.type || legacyType || 'fixed';
  const typeKey = rawType.toString().trim().toLowerCase().replace(/\s+/g, '-');
  const type = PRICING_TYPE_MAP[typeKey] || 'fixed';

  const legacyAmount = body.pricingAmount || body.amount || body['pricing[amount]'];
  const rawAmount = parsed.amount ?? legacyAmount ?? 0;
  const numericAmount = Number(rawAmount);

  return {
    type,
    amount: Number.isFinite(numericAmount) ? Math.max(0, numericAmount) : 0,
    currency: parsed.currency || body.currency || 'INR',
  };
};

const normalizeAvailability = (body) => {
  const parsed = parseJsonField(body.availability);
  if (parsed && typeof parsed === 'object') {
    return {
      days: Array.isArray(parsed.days) ? parsed.days : [],
      timeSlots: Array.isArray(parsed.timeSlots) ? parsed.timeSlots : [],
    };
  }
  return undefined;
};

const normalizeTags = (value) => {
  if (!value) return undefined;
  if (Array.isArray(value)) return value.map((t) => `${t}`.trim().toLowerCase()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  return undefined;
};

exports.createService = async (req, res, next) => {
  try {
    const normalizedAvailability = normalizeAvailability(req.body);
    const normalizedTags = normalizeTags(req.body.tags);

    const serviceData = {
      ...req.body,
      category: normalizeCategory(req.body.category),
      serviceType: normalizeServiceType(req.body.serviceType || req.body.type),
      pricing: normalizePricing(req.body),
      provider: req.user._id,
    };

    if (normalizedAvailability) serviceData.availability = normalizedAvailability;

    if (req.files && req.files.length > 0) {
      serviceData.images = req.files.map((file) => ({
        url: `/uploads/${file.filename}`,
        thumbnail: `/uploads/${file.filename}`,
      }));
    }

    if (normalizedTags) serviceData.tags = normalizedTags;

    const service = await Service.create(serviceData);
    await service.populate('provider', 'firstName lastName avatar rating');

    sendResponse(res, 201, service, 'Service created successfully');
  } catch (error) {
    next(error);
  }
};

exports.getServices = async (req, res, next) => {
  try {
    const queryBuilder = new QueryBuilder(Service.find({ status: 'active' }), req.query)
      .filter()
      .search(['title', 'description', 'tags'])
      .sort()
      .limitFields()
      .paginate();

    const services = await queryBuilder.query.populate('provider', 'firstName lastName avatar rating');
    const total = await Service.countDocuments({ status: 'active' });

    sendPaginatedResponse(res, 200, services, {
      ...queryBuilder.pagination,
      total,
      pages: Math.ceil(total / (queryBuilder.pagination?.limit || 20)),
    });
  } catch (error) {
    next(error);
  }
};

exports.getService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id).populate(
      'provider',
      'firstName lastName avatar rating phone email bio department'
    );

    if (!service) return next(new AppError('Service not found.', 404));

    service.views += 1;
    await service.save({ validateBeforeSave: false });

    sendResponse(res, 200, service);
  } catch (error) {
    next(error);
  }
};

exports.updateService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return next(new AppError('Service not found.', 404));

    if (service.provider.toString() !== req.user._id.toString()) {
      return next(new AppError('You can only edit your own services.', 403));
    }

    const allowedFields = ['title', 'description', 'category', 'serviceType', 'location', 'tags', 'status'];
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    if (req.body.category !== undefined) {
      updateData.category = normalizeCategory(req.body.category);
    }

    if (req.body.serviceType !== undefined || req.body.type !== undefined) {
      updateData.serviceType = normalizeServiceType(req.body.serviceType || req.body.type);
    }

    if (
      req.body.pricing !== undefined ||
      req.body.pricingType !== undefined ||
      req.body.pricingAmount !== undefined ||
      req.body.amount !== undefined ||
      req.body['pricing[type]'] !== undefined ||
      req.body['pricing[amount]'] !== undefined
    ) {
      updateData.pricing = normalizePricing(req.body);
    }

    if (req.body.availability !== undefined) {
      const normalizedAvailability = normalizeAvailability(req.body);
      if (normalizedAvailability) updateData.availability = normalizedAvailability;
    }

    if (req.body.tags !== undefined) {
      updateData.tags = normalizeTags(req.body.tags) || [];
    }

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => ({
        url: `/uploads/${file.filename}`,
        thumbnail: `/uploads/${file.filename}`,
      }));
      updateData.images = [...(service.images || []), ...newImages];
    }

    const updated = await Service.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).populate('provider', 'firstName lastName avatar rating');

    sendResponse(res, 200, updated, 'Service updated successfully');
  } catch (error) {
    next(error);
  }
};

exports.deleteService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return next(new AppError('Service not found.', 404));

    if (service.provider.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return next(new AppError('You can only delete your own services.', 403));
    }

    service.status = 'removed';
    await service.save({ validateBeforeSave: false });

    sendResponse(res, 200, null, 'Service removed successfully');
  } catch (error) {
    next(error);
  }
};

exports.getMyServices = async (req, res, next) => {
  try {
    const services = await Service.find({ provider: req.user._id })
      .sort('-createdAt')
      .populate('provider', 'firstName lastName avatar');
    sendResponse(res, 200, services);
  } catch (error) {
    next(error);
  }
};
