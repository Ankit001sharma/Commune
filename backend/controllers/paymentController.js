const crypto = require('crypto');
const Razorpay = require('razorpay');

const config = require('../config');
const Listing = require('../models/Listing');
const Transaction = require('../models/Transaction');
const AppError = require('../utils/AppError');
const { sendResponse } = require('../utils/response');

let razorpayInstance = null;
const getRazorpay = () => {
  if (razorpayInstance) return razorpayInstance;

  const { keyId, keySecret } = config.razorpay || {};

  console.log("RAZORPAY CONFIG:", config.razorpay);

  if (!keyId || !keySecret) {
    throw new AppError(
      'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the backend .env file.',
      500
    );
  }

  razorpayInstance = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  return razorpayInstance;
};

/**
 * POST /api/payments/orders
 * Body: { listingId }
 *
 * Creates a Razorpay order for the given listing and returns the order
 * details + the publishable key the frontend needs to open Checkout.
 */
exports.createOrder = async (req, res, next) => {
  try {
    const { listingId } = req.body || {};
    if (!listingId) {
      return next(new AppError('listingId is required.', 400));
    }

    const listing = await Listing.findById(listingId).populate(
      'seller',
      'firstName lastName email'
    );
    if (!listing) {
      return next(new AppError('Listing not found.', 404));
    }

    if (listing.status && listing.status !== 'active') {
      return next(
        new AppError(`This listing is currently ${listing.status} and not available to buy.`, 400)
      );
    }

console.log("SELLER:", listing.seller._id.toString());
console.log("BUYER:", req.user._id.toString());

if (listing.seller && listing.seller._id.toString() === req.user._id.toString()) {
  return next(
    new AppError('You cannot purchase your own listing.', 400)
  );
}

    const amountInRupees = Number(listing.price);
    if (!Number.isFinite(amountInRupees) || amountInRupees <= 0) {
      return next(
        new AppError('This listing has no payable price. Please contact the seller instead.', 400)
      );
    }

    const currency = config.razorpay?.currency || 'INR';
    const amountInPaise = Math.round(amountInRupees * 100);

    // Razorpay receipt has a 40-char limit

    const rp = getRazorpay();
try {
  const order = await rp.orders.create({
    amount: amountInPaise,
    currency,
    receipt: `rcpt_${Date.now()}`,
    notes: {
      listingId: listing._id.toString(),
      buyerId: req.user._id.toString(),
      sellerId: listing.seller?._id?.toString() || '',
    },
  });

  console.log("RAZORPAY ORDER CREATED:", order);

  return sendResponse(
    res,
    201,
    {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: config.razorpay.keyId,
      listing: {
        _id: listing._id,
        title: listing.title,
        price: listing.price,
      },
      buyer: {
        name: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
        email: req.user.email,
      },
    },
    'Razorpay order created'
  );

} catch (razorpayError) {

  console.error("RAZORPAY ERROR:", razorpayError);

  return res.status(500).json({
    success: false,
    message: razorpayError.message,
    error: razorpayError,
  });
}

    return sendResponse(
      res,
      201,
      {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: config.razorpay.keyId,
        listing: {
          _id: listing._id,
          title: listing.title,
          price: listing.price,
        },
        buyer: {
          name: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
          email: req.user.email,
        },
      },
      'Razorpay order created'
    );
  } catch (error) {
    // Razorpay errors carry useful info we should bubble up
    if (error?.statusCode && error?.error?.description) {
      return next(new AppError(`Razorpay: ${error.error.description}`, error.statusCode));
    }
    return next(error);
  }
};

/**
 * POST /api/payments/verify
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, listingId }
 *
 * Verifies the HMAC signature returned by Razorpay Checkout, marks the listing
 * as sold and creates a completed transaction record. The buyer's wallet is
 * NOT touched because this is a direct purchase via Razorpay.
 */
exports.verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      listingId,
    } = req.body || {};

    if (!orderId || !paymentId || !signature || !listingId) {
      return next(
        new AppError(
          'razorpay_order_id, razorpay_payment_id, razorpay_signature and listingId are required.',
          400
        )
      );
    }

    const { keySecret } = config.razorpay || {};
    if (!keySecret) {
      return next(new AppError('Razorpay is not configured on the server.', 500));
    }

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (expectedSignature !== signature) {
      return next(new AppError('Payment signature verification failed.', 400));
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return next(new AppError('Listing not found.', 404));
    }

    const sellerId = listing.seller;
    if (!sellerId) {
      return next(new AppError('Listing has no seller. Cannot record transaction.', 400));
    }
    if (sellerId.toString() === req.user._id.toString()) {
      return next(new AppError('You cannot purchase your own listing.', 400));
    }

    const amount = Number(listing.price) || 0;
    const platformFee = Math.round(amount * 0.02 * 100) / 100;

    // Avoid duplicate transactions for the same Razorpay order
    let transaction = await Transaction.findOne({ 'razorpay.orderId': orderId });
    if (!transaction) {
      transaction = await Transaction.create({
        buyer: req.user._id,
        seller: sellerId,
        listing: listing._id,
        amount,
        platformFee,
        paymentMethod: 'razorpay',
        status: 'completed',
        completedAt: new Date(),
        razorpay: {
          orderId,
          paymentId,
          signature,
        },
      });
    } else {
      transaction.status = 'completed';
      transaction.completedAt = new Date();
      transaction.razorpay = { orderId, paymentId, signature };
      await transaction.save();
    }

    if (listing.status !== 'sold') {
      listing.status = 'sold';
      await listing.save();
    }

    await transaction.populate('buyer seller', 'firstName lastName avatar');

    return sendResponse(
      res,
      200,
      { transaction },
      'Payment verified and transaction recorded'
    );
  } catch (error) {
    return next(error);
  }
};
