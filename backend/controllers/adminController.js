const User = require('../models/User');
const Listing = require('../models/Listing');
const Service = require('../models/Service');
const Transaction = require('../models/Transaction');
const Post = require('../models/Post');
const { sendRecommendationEmail } = require('../services/emailService');
const { sendResponse } = require('../utils/response');

/* ------------------------------------------------------------------ */
/* Overview – used by the Dashboard tab                                */
/* ------------------------------------------------------------------ */
exports.getOverview = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const [
      users,
      admins,
      verifiedUsers,
      listings,
      activeListings,
      soldListings,
      services,
      posts,
      transactions,
      completedTx,
      newUsers7d,
      newUsers30d,
      newListings7d,
      revenueAgg,
      popularListings,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isAdmin: true }),
      User.countDocuments({ isVerified: true }),
      Listing.countDocuments({ status: { $ne: 'removed' } }),
      Listing.countDocuments({ status: 'active' }),
      Listing.countDocuments({ status: 'sold' }),
      Service.countDocuments({ status: { $ne: 'removed' } }),
      Post.countDocuments(),
      Transaction.countDocuments(),
      Transaction.countDocuments({ status: 'completed' }),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Listing.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Transaction.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' }, fees: { $sum: '$platformFee' } } },
      ]),
      Listing.find({ status: 'active' })
        .sort('-views -createdAt')
        .limit(8)
        .populate('seller', 'firstName lastName email'),
    ]);

    /* User signups per day for the past 14 days */
    const signupsByDay = await User.aggregate([
      { $match: { createdAt: { $gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    /* Listings by category */
    const listingsByCategory = await Listing.aggregate([
      { $match: { status: { $ne: 'removed' } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    /* Transactions by status */
    const txByStatus = await Transaction.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    sendResponse(res, 200, {
      stats: {
        users,
        admins,
        verifiedUsers,
        listings,
        activeListings,
        soldListings,
        services,
        posts,
        transactions,
        completedTx,
        newUsers7d,
        newUsers30d,
        newListings7d,
        revenue: revenueAgg[0]?.total || 0,
        platformFees: revenueAgg[0]?.fees || 0,
      },
      charts: {
        signupsByDay,
        listingsByCategory,
        txByStatus,
      },
      popularListings,
    });
  } catch (error) {
    next(error);
  }
};

/* ------------------------------------------------------------------ */
/* Users                                                                */
/* ------------------------------------------------------------------ */
exports.getUsers = async (req, res, next) => {
  try {
    const search = (req.query.search || '').trim();
    const filter = {};
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { rollNumber: rx }];
    }
    const users = await User.find(filter)
      .select('firstName lastName email rollNumber department isAdmin isVerified isBanned tokens wallet createdAt lastLogin avatar')
      .sort('-createdAt')
      .limit(200);
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
    if (typeof req.body.isBanned === 'boolean') update.isBanned = req.body.isBanned;
    if (typeof req.body.tokenBalance === 'number') update['tokens.balance'] = req.body.tokenBalance;
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password -refreshToken');
    sendResponse(res, 200, user, 'User updated');
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ status: 'fail', message: 'You cannot delete your own admin account.' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ status: 'fail', message: 'User not found' });
    if (target.isAdmin) {
      return res.status(400).json({ status: 'fail', message: 'Cannot delete another admin from this panel.' });
    }
    await User.findByIdAndDelete(req.params.id);
    sendResponse(res, 200, { id: req.params.id }, 'User removed');
  } catch (error) {
    next(error);
  }
};

/* ------------------------------------------------------------------ */
/* Listings                                                             */
/* ------------------------------------------------------------------ */
exports.getListings = async (req, res, next) => {
  try {
    const items = await Listing.find()
      .sort('-createdAt')
      .limit(150)
      .populate('seller', 'firstName lastName email');
    sendResponse(res, 200, items);
  } catch (error) {
    next(error);
  }
};

exports.updateListingStatus = async (req, res, next) => {
  try {
    const allowed = ['active', 'sold', 'removed', 'pending', 'reserved'];
    if (!allowed.includes(req.body.status)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid status' });
    }
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    ).populate('seller', 'firstName lastName email');
    sendResponse(res, 200, listing, 'Listing updated');
  } catch (error) {
    next(error);
  }
};

exports.deleteListing = async (req, res, next) => {
  try {
    await Listing.findByIdAndDelete(req.params.id);
    sendResponse(res, 200, { id: req.params.id }, 'Listing deleted');
  } catch (error) {
    next(error);
  }
};

/* ------------------------------------------------------------------ */
/* Services                                                             */
/* ------------------------------------------------------------------ */
exports.getServices = async (req, res, next) => {
  try {
    const items = await Service.find()
      .sort('-createdAt')
      .limit(150)
      .populate('provider', 'firstName lastName email')
      .populate('user', 'firstName lastName email');
    sendResponse(res, 200, items);
  } catch (error) {
    next(error);
  }
};

exports.deleteService = async (req, res, next) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    sendResponse(res, 200, { id: req.params.id }, 'Service deleted');
  } catch (error) {
    next(error);
  }
};

/* ------------------------------------------------------------------ */
/* Transactions                                                         */
/* ------------------------------------------------------------------ */
exports.getTransactions = async (req, res, next) => {
  try {
    const items = await Transaction.find()
      .sort('-createdAt')
      .limit(150)
      .populate('buyer', 'firstName lastName email')
      .populate('seller', 'firstName lastName email')
      .populate('listing', 'title price')
      .populate('service', 'title');
    sendResponse(res, 200, items);
  } catch (error) {
    next(error);
  }
};

/* ------------------------------------------------------------------ */
/* Posts                                                                */
/* ------------------------------------------------------------------ */
exports.getPosts = async (req, res, next) => {
  try {
    const items = await Post.find()
      .sort('-createdAt')
      .limit(80)
      .populate('author', 'firstName lastName email');
    sendResponse(res, 200, items);
  } catch (error) {
    next(error);
  }
};

exports.deletePost = async (req, res, next) => {
  try {
    await Post.findByIdAndDelete(req.params.id);
    sendResponse(res, 200, { id: req.params.id }, 'Post deleted');
  } catch (error) {
    next(error);
  }
};

/* ------------------------------------------------------------------ */
/* Activity feed (combined cross-resource feed)                          */
/* ------------------------------------------------------------------ */
exports.getActivity = async (req, res, next) => {
  try {
    const limit = 25;
    const [recentUsers, recentListings, recentServices, recentPosts, recentTx] = await Promise.all([
      User.find().sort('-createdAt').limit(limit).select('firstName lastName email createdAt avatar'),
      Listing.find().sort('-createdAt').limit(limit).populate('seller', 'firstName lastName').select('title price createdAt seller status'),
      Service.find().sort('-createdAt').limit(limit).populate('provider user', 'firstName lastName').select('title createdAt provider user status'),
      Post.find().sort('-createdAt').limit(limit).populate('author', 'firstName lastName').select('title type createdAt author'),
      Transaction.find().sort('-createdAt').limit(limit)
        .populate('buyer seller', 'firstName lastName')
        .select('amount status createdAt buyer seller'),
    ]);

    const events = [];
    recentUsers.forEach((u) =>
      events.push({
        type: 'user_signup',
        at: u.createdAt,
        title: `${u.firstName} ${u.lastName} joined`,
        subtitle: u.email,
        ref: u._id,
      })
    );
    recentListings.forEach((l) =>
      events.push({
        type: 'listing_created',
        at: l.createdAt,
        title: `New listing: ${l.title}`,
        subtitle: `${l.seller?.firstName || 'A user'} listed for ₹${l.price}`,
        status: l.status,
        ref: l._id,
      })
    );
    recentServices.forEach((s) =>
      events.push({
        type: 'service_created',
        at: s.createdAt,
        title: `New service: ${s.title}`,
        subtitle: `${(s.provider || s.user)?.firstName || 'A user'} added a service`,
        status: s.status,
        ref: s._id,
      })
    );
    recentPosts.forEach((p) =>
      events.push({
        type: 'post_created',
        at: p.createdAt,
        title: `Post: ${p.title}`,
        subtitle: `${p.author?.firstName || 'Someone'} posted in ${p.type}`,
        ref: p._id,
      })
    );
    recentTx.forEach((t) =>
      events.push({
        type: 'transaction',
        at: t.createdAt,
        title: `Transaction ₹${t.amount}`,
        subtitle: `${t.buyer?.firstName || 'Buyer'} → ${t.seller?.firstName || 'Seller'} (${t.status})`,
        status: t.status,
        ref: t._id,
      })
    );

    events.sort((a, b) => new Date(b.at) - new Date(a.at));
    sendResponse(res, 200, events.slice(0, 60));
  } catch (error) {
    next(error);
  }
};

/* ------------------------------------------------------------------ */
/* Recommendation emails                                                */
/* ------------------------------------------------------------------ */
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
        if (user.recommendationProfile) {
          user.recommendationProfile.lastRecommendationEmailAt = new Date();
        }
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
