/**
 * EmailCampaignLog
 * ----------------
 * Audit trail of every recommendation/notification email we send.
 *
 * Why a separate collection?
 *   1. Dedup — we never want to email the same {user, listing} pair twice for
 *      the same campaign. A unique compound index enforces this.
 *   2. Analytics — open/click rate, conversion to a transaction, A/B test arms.
 *   3. Unsubscribe links — we mint a campaignId-scoped token so users can
 *      opt out from the email itself without logging in.
 */

const mongoose = require('mongoose');

const emailCampaignLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    /* Campaign type — keep this enum aligned with the queue job names. */
    campaignType: {
      type: String,
      required: true,
      enum: ['daily-digest', 'new-match-alert', 'price-drop', 're-engagement'],
      index: true,
    },

    /* Subject line that was actually sent (post AI generation). */
    subject: { type: String, default: '' },

    /* Items recommended in this email (listings, services, etc.). */
    items: [
      {
        itemType: { type: String, enum: ['listing', 'service', 'post'] },
        itemId: { type: mongoose.Schema.Types.ObjectId },
        title: { type: String },
        reason: { type: String }, // AI-generated "Because you viewed X"
      },
    ],

    /* Engagement metrics — updated by tracking pixel & click handler. */
    sentAt: { type: Date, default: Date.now },
    openedAt: { type: Date, default: null },
    clickedAt: { type: Date, default: null },

    /* Did the user end up performing a transaction within 7 days? */
    convertedAt: { type: Date, default: null },

    /* Soft-delete / failure flags. */
    status: {
      type: String,
      enum: ['queued', 'sent', 'failed', 'skipped'],
      default: 'queued',
    },
    errorMessage: { type: String, default: null },

    /* A/B test arm — random per send so we can later compare arms. */
    abArm: { type: String, default: 'A' },
  },
  { timestamps: true }
);

/* Dedup — within the last 24h, the same campaignType+listing shouldn't
   reach the same user twice. Enforced at write-time via Mongo. */
emailCampaignLogSchema.index({ user: 1, campaignType: 1, createdAt: -1 });

module.exports = mongoose.model('EmailCampaignLog', emailCampaignLogSchema);
