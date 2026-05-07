const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: 2000,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'books',
        'electronics',
        'furniture',
        'clothing',
        'stationery',
        'sports',
        'vehicles',
        'food',
        'accessories',
        'other',
      ],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
    },
    negotiable: {
      type: Boolean,
      default: false,
    },
    condition: {
      type: String,
      enum: ['new', 'like-new', 'good', 'fair', 'poor'],
      default: 'good',
    },
    images: [
      {
        url: { type: String, required: true },
        thumbnail: { type: String },
        publicId: { type: String },
      },
    ],
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'sold', 'reserved', 'expired', 'removed'],
      default: 'active',
      index: true,
    },
    location: {
      address: { type: String, default: 'Campus' },
      locationText: { type: String, default: null },
      mode: { type: String, enum: ['manual', 'live'], default: 'manual' },
      coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
      updatedAt: { type: Date, default: null },
      trackingActive: { type: Boolean, default: false },
      textUpdatedAt: { type: Date, default: null },
    },
    tags: [{ type: String, lowercase: true, trim: true }],
    views: {
      type: Number,
      default: 0,
    },
    favoritedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

listingSchema.index({ title: 'text', description: 'text', tags: 'text' });
listingSchema.index({ category: 1, status: 1 });
listingSchema.index({ price: 1 });
listingSchema.index({ createdAt: -1 });

listingSchema.virtual('favoriteCount').get(function () {
  return this.favoritedBy ? this.favoritedBy.length : 0;
});

module.exports = mongoose.model('Listing', listingSchema);
