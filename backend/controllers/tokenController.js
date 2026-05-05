const { sendResponse } = require('../utils/response');

const PLANS = {
  starter: { name: 'Starter', price: 20, uploads: 5 },
  popular: { name: 'Popular', price: 45, uploads: 12 },
  pro: { name: 'Pro', price: 80, uploads: 25 },
};

exports.getPricing = async (req, res) => {
  sendResponse(res, 200, {
    unitPrice: 5,
    freeUploads: 2,
    plans: Object.values(PLANS),
    tokens: req.user.tokens || { balance: 0, freeUploadsUsed: 0, totalPurchased: 0 },
  });
};

exports.purchasePlan = async (req, res, next) => {
  try {
    const plan = PLANS[`${req.body.plan || ''}`.toLowerCase()];
    if (!plan) {
      return res.status(400).json({ status: 'fail', message: 'Choose Starter, Popular, or Pro.' });
    }

    if (!req.user.tokens) {
      req.user.tokens = { balance: 0, freeUploadsUsed: 0, totalPurchased: 0 };
    }

    req.user.tokens.balance = (req.user.tokens?.balance || 0) + plan.uploads;
    req.user.tokens.totalPurchased = (req.user.tokens?.totalPurchased || 0) + plan.uploads;
    await req.user.save({ validateBeforeSave: false });

    sendResponse(res, 200, { plan, tokens: req.user.tokens }, `${plan.name} plan added`);
  } catch (error) {
    next(error);
  }
};
