const User = require('../models/User');
const Listing = require('../models/Listing');
const Service = require('../models/Service');
const Transaction = require('../models/Transaction');
const { sendRecommendationEmail } = require('../services/emailService');
const { sendResponse } = require('../utils/response');

exports.getOverview = async (req, res, next) => {
  try {
    const [users, admins, listings, services, transactions, activeListings] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isAdmin: true }),
      Listing.countDocuments({ status: { $ne: 'removed' } }),
      Service.countDocuments({ status: { $ne: 'removed' } }),
      Transaction.countDocuments(),
      Listing.find({ status: 'active' }).sort('-views -createdAt').limit(8).populate('seller', 'firstName lastName email'),
    ]);

    sendResponse(res, 200, {
      stats: { users, admins, listings, services, transactions },
      popularListings: activeListings,
    });
  } catch (error) {
    next(error);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .select('firstName lastName email rollNumber isAdmin isVerified tokens wallet createdAt')
      .sort('-createdAt')
      .limit(100);
    sendResponse(res, 200, users);
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const update = {};
    if (typeof req.body.isAdmin === 'boolean') update.isAdmin = req.body.isAdmin;
    if (typeof req.body.isVerified === 'boolean') update.isVerified = req.body.isVerified;
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password -refreshToken');
    sendResponse(res, 200, user, 'User updated');
  } catch (error) {
    next(error);
  }
};

exports.sendRecommendationEmails = async (req, res, next) => {
  try {
    const users = await User.find({ email: { $exists: true }, isVerified: true }).limit(50);
    let sent = 0;

    for (const user of users) {
      const categories = user.recommendationProfile?.viewedCategories || [];
      const query = categories.length ? { status: 'active', category: { $in: categories } } : { status: 'active' };
      const items = await Listing.find(query).sort('-views -createdAt').limit(4).select('title price');
      try {
        await sendRecommendationEmail({ to: user.email, firstName: user.firstName, items });
        user.recommendationProfile.lastRecommendationEmailAt = new Date();
        await user.save({ validateBeforeSave: false });
        sent += 1;
      } catch (error) {
        console.error(`Recommendation email failed for ${user.email}:`, error.message);
      }
    }

    sendResponse(res, 200, { sent }, `Sent ${sent} recommendation emails`);
  } catch (error) {
    next(error);
  }
};
