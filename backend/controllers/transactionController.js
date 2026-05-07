const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Listing = require('../models/Listing');
const AppError = require('../utils/AppError');
const { sendResponse } = require('../utils/response');

exports.initiateTransaction = async (req, res, next) => {
  try {
    const { sellerId, listingId, serviceId, amount, paymentMethod, notes } = req.body;

    if (!sellerId || !amount) {
      return next(new AppError('Seller and amount are required.', 400));
    }

    if (sellerId === req.user._id.toString()) {
      return next(new AppError('Cannot transact with yourself.', 400));
    }

    const platformFee = Math.round(amount * 0.02 * 100) / 100; // 2% platform fee

    const transaction = await Transaction.create({
      buyer: req.user._id,
      seller: sellerId,
      listing: listingId || null,
      service: serviceId || null,
      amount,
      platformFee,
      paymentMethod: paymentMethod || 'wallet',
      notes,
      status: 'initiated',
    });

    await transaction.populate('buyer', 'firstName lastName avatar');
    await transaction.populate('seller', 'firstName lastName avatar');

    sendResponse(res, 201, transaction, 'Transaction initiated');
  } catch (error) {
    next(error);
  }
};

exports.holdEscrow = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return next(new AppError('Transaction not found.', 404));

    if (transaction.buyer.toString() !== req.user._id.toString()) {
      return next(new AppError('Only the buyer can hold escrow.', 403));
    }

    if (transaction.status !== 'initiated') {
      return next(new AppError('Transaction is not in the correct state for escrow.', 400));
    }

    const totalAmount = transaction.amount + transaction.platformFee;

    // Atomic update of buyer wallet
    const buyer = await User.findOneAndUpdate(
      { 
        _id: req.user._id, 
        'wallet.balance': { $gte: totalAmount } 
      },
      { 
        $inc: { 
          'wallet.balance': -totalAmount, 
          'wallet.escrowHeld': totalAmount 
        } 
      },
      { new: true, runValidators: true }
    );

    if (!buyer) {
      return next(new AppError('Insufficient wallet balance or account error.', 400));
    }

    transaction.status = 'escrow-held';
    transaction.escrow = {
      heldAt: new Date(),
      amount: totalAmount,
    };
    await transaction.save();

    // Update listing status if applicable
    if (transaction.listing) {
      await Listing.findByIdAndUpdate(transaction.listing, { status: 'reserved' });
    }

    await transaction.populate('buyer seller', 'firstName lastName avatar');
    sendResponse(res, 200, transaction, 'Escrow held successfully');
  } catch (error) {
    next(error);
  }
};

exports.completeTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return next(new AppError('Transaction not found.', 404));

    if (transaction.buyer.toString() !== req.user._id.toString()) {
      return next(new AppError('Only the buyer can confirm completion.', 403));
    }

    if (transaction.status !== 'escrow-held') {
      return next(new AppError('Escrow must be held before completing.', 400));
    }

    // Atomic Release escrow from buyer and add to seller
    const escrowAmount = transaction.escrow.amount;
    const sellerAmount = transaction.amount;

    const [buyer, seller] = await Promise.all([
      User.findOneAndUpdate(
        { _id: transaction.buyer, 'wallet.escrowHeld': { $gte: escrowAmount } },
        { $inc: { 'wallet.escrowHeld': -escrowAmount } },
        { new: true }
      ),
      User.findByIdAndUpdate(
        transaction.seller,
        { $inc: { 'wallet.balance': sellerAmount } },
        { new: true }
      )
    ]);

    if (!buyer || !seller) {
      // Note: In a real production app with high stakes, use Mongoose sessions/transactions.
      // For now, this atomic $inc is much safer than manual property updates.
      return next(new AppError('Failed to release funds. Please contact support.', 500));
    }

    transaction.status = 'completed';
    transaction.completedAt = new Date();
    transaction.escrow.releasedAt = new Date();
    await transaction.save();

    // Update listing status
    if (transaction.listing) {
      await Listing.findByIdAndUpdate(transaction.listing, { status: 'sold' });
    }

    await transaction.populate('buyer seller', 'firstName lastName avatar');
    sendResponse(res, 200, transaction, 'Transaction completed successfully');
  } catch (error) {
    next(error);
  }
};

exports.cancelTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return next(new AppError('Transaction not found.', 404));

    const isParty =
      transaction.buyer.toString() === req.user._id.toString() ||
      transaction.seller.toString() === req.user._id.toString();

    if (!isParty) return next(new AppError('Access denied.', 403));

    if (['completed', 'refunded', 'cancelled'].includes(transaction.status)) {
      return next(new AppError('Cannot cancel this transaction.', 400));
    }

    // Refund escrow atomically if held
    if (transaction.status === 'escrow-held') {
      const escrowAmount = transaction.escrow.amount;
      const buyer = await User.findOneAndUpdate(
        { _id: transaction.buyer, 'wallet.escrowHeld': { $gte: escrowAmount } },
        { 
          $inc: { 
            'wallet.escrowHeld': -escrowAmount, 
            'wallet.balance': escrowAmount 
          } 
        },
        { new: true }
      );

      if (!buyer) return next(new AppError('Refund failed.', 500));

      if (transaction.listing) {
        await Listing.findByIdAndUpdate(transaction.listing, { status: 'active' });
      }
    }

    transaction.status = 'cancelled';
    await transaction.save();

    sendResponse(res, 200, transaction, 'Transaction cancelled');
  } catch (error) {
    next(error);
  }
};

exports.getMyTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({
      $or: [{ buyer: req.user._id }, { seller: req.user._id }],
    })
      .populate('buyer', 'firstName lastName avatar')
      .populate('seller', 'firstName lastName avatar')
      .populate('listing', 'title images price')
      .populate('service', 'title pricing')
      .sort('-createdAt');

    sendResponse(res, 200, transactions);
  } catch (error) {
    next(error);
  }
};

exports.getTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('buyer', 'firstName lastName avatar email')
      .populate('seller', 'firstName lastName avatar email')
      .populate('listing', 'title images price')
      .populate('service', 'title pricing');

    if (!transaction) return next(new AppError('Transaction not found.', 404));

    const isParty =
      transaction.buyer._id.toString() === req.user._id.toString() ||
      transaction.seller._id.toString() === req.user._id.toString();

    if (!isParty) return next(new AppError('Access denied.', 403));

    sendResponse(res, 200, transaction);
  } catch (error) {
    next(error);
  }
};
