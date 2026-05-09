const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      default: null,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      default: null,
    },
    amount: {
      type: Number,
      required: [true, 'Transaction amount is required'],
      min: 0,
    },
    platformFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        'initiated',
        'escrow-held',
        'payment-pending',
        'completed',
        'disputed',
        'refunded',
        'cancelled',
      ],
      default: 'initiated',
      index: true,
    },
    escrow: {
      heldAt: Date,
      releasedAt: Date,
      amount: { type: Number, default: 0 },
    },
    paymentMethod: {
      type: String,
      enum: ['wallet', 'upi', 'cash', 'bank-transfer', 'razorpay'],
      default: 'wallet',
    },
    razorpay: {
      orderId: { type: String, index: true },
      paymentId: { type: String, index: true },
      signature: { type: String },
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    completedAt: Date,
    disputeReason: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

transactionSchema.index({ buyer: 1, status: 1 });
transactionSchema.index({ seller: 1, status: 1 });
transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
