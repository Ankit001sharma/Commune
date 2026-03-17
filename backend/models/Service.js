const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Service title is required'],
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      required: [true, 'Service description is required'],
      maxlength: 3000,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'tutoring',
        'freelancing',
        'coding-help',
        'room-rental',
        'mess-info',
        'transport',
        'photography',
        'event-planning',
        'design',
        'writing',
        'other',
      ],
    },
    serviceType: {
      type: String,
      enum: ['offering', 'requesting'],
      default: 'offering',
    },
    pricing: {
      type: {
        type: String,
        enum: ['fixed', 'hourly', 'negotiable', 'free'],
        default: 'fixed',
      },
      amount: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: 'INR' },
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    images: [
      {
        url: { type: String },
        thumbnail: { type: String },
      },
    ],
    availability: {
      days: [
        {
          type: String,
          enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        },
      ],
      timeSlots: [
        {
          start: String,
          end: String,
        },
      ],
    },
    location: {
      type: String,
      default: 'Campus',
    },
    tags: [{ type: String, lowercase: true, trim: true }],
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'removed'],
      default: 'active',
      index: true,
    },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    views: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

serviceSchema.index({ title: 'text', description: 'text', tags: 'text' });
serviceSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('Service', serviceSchema);
