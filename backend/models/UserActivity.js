/**
 * UserActivity
 * ------------
 * Append-only log of every behavioural signal we want to learn from.
 * Each document represents ONE event (a search, a view, a click, a favorite,
 * a save, an unsave, an unavailable-search, etc.).
 *
 * We keep the schema deliberately wide so the recommendation engine has many
 * features to work with, but every field is optional so callers can log a
 * minimal event without worrying about validation.
 *
 * Design notes:
 *   - We don't reference the actual item via Mongoose `ref` because the same
 *     activity collection logs across listings/services/posts. Instead we
 *     store `itemType` + `itemId` and let the consumer decide which model to
 *     populate from.
 *   - A TTL index on `createdAt` purges anything older than 180 days so the
 *     collection stays small and GDPR-friendly.
 */

const mongoose = require('mongoose');

const userActivitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    /* Type of behavioural event. Add new ones here as triggers grow. */
    eventType: {
      type: String,
      required: true,
      enum: [
        'search',           // user typed a query
        'search_no_result', // user searched and we returned nothing  → trigger #1
        'view',             // user opened a listing/service/post
        'click',            // user clicked a recommendation (CTR analytics)
        'favorite',         // user favorited a listing
        'save',             // user saved an item
        'unsave',           // user removed a saved item
        'message',          // user messaged a seller (high-intent signal)
        'inactive',         // synthetic event from inactivity scanner
      ],
      index: true,
    },

    /* What was acted on (optional — searches don't have an item). */
    itemType: {
      type: String,
      enum: ['listing', 'service', 'post', null],
      default: null,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    /* Free-form context about the event. */
    query: { type: String, default: null, lowercase: true, trim: true },
    category: { type: String, default: null, lowercase: true, trim: true },
    keywords: [{ type: String, lowercase: true, trim: true }],

    /* Best-effort location signal — used only when the user opted-in. */
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      city: { type: String, default: null },
    },

    /* Where the event happened — useful for funnel analysis. */
    source: {
      type: String,
      enum: ['marketplace', 'services', 'community', 'home', 'search', 'email', 'recommendation', 'other'],
      default: 'other',
    },

    /* For recommendation clicks — which campaign drove them in. */
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailCampaignLog',
      default: null,
    },
  },
  { timestamps: true }
);

userActivitySchema.index({ user: 1, eventType: 1, createdAt: -1 });
userActivitySchema.index({ user: 1, category: 1 });
userActivitySchema.index({ user: 1, query: 1 });

/* TTL — purge events older than 180 days. */
userActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

module.exports = mongoose.model('UserActivity', userActivitySchema);
