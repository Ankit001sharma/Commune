const Service = require('../models/Service');
const AppError = require('../utils/AppError');
const { sendResponse, sendPaginatedResponse } = require('../utils/response');
const QueryBuilder = require('../utils/QueryBuilder');

exports.createService = async (req, res, next) => {
  try {
    const serviceData = {
      ...req.body,
      provider: req.user._id,
    };

    if (req.body.pricing) {
      serviceData.pricing = typeof req.body.pricing === 'string' ? JSON.parse(req.body.pricing) : req.body.pricing;
    }

    if (req.body.availability) {
      serviceData.availability = typeof req.body.availability === 'string' ? JSON.parse(req.body.availability) : req.body.availability;
    }

    if (req.files && req.files.length > 0) {
      serviceData.images = req.files.map((file) => ({
        url: `/uploads/${file.filename}`,
        thumbnail: `/uploads/${file.filename}`,
      }));
    }

    if (req.body.tags && typeof req.body.tags === 'string') {
      serviceData.tags = req.body.tags.split(',').map((t) => t.trim().toLowerCase());
    }

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

    const allowedFields = ['title', 'description', 'category', 'serviceType', 'pricing', 'availability', 'location', 'tags', 'status'];
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

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
