/**
 * newMatchAlertWorker
 * -------------------
 * Triggered when a new listing is created. Notifies users whose taste profile
 * matches the listing (see RecommendationEngine.findUsersForListing).
 */

const Listing = require('../../../models/Listing');
const EmailCampaignLog = require('../../../models/EmailCampaignLog');
const User = require('../../../models/User');
const RecommendationEngine = require('../../RecommendationEngine');
const AIEmailComposer = require('../../AIEmailComposer');
const emailService = require('../../emailService');
const { isUnderWeeklyCap } = require('../../recommendationEmailUtils');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const processNewMatchAlert = async (job) => {
  const listingId = job.data?.listingId;
  if (!listingId) return { skipped: true, reason: 'no listingId' };

  const listing = await Listing.findById(listingId).lean();
  if (!listing || listing.status !== 'active') {
    return { skipped: true, reason: 'inactive listing' };
  }

  const matches = await RecommendationEngine.findUsersForListing(listing, {
    minScore: 6,
    maxUsers: 80,
  });

  let sent = 0;
  let skipped = 0;

  for (const { user: u } of matches) {
    try {
      const prefs = u.recommendationProfile?.notificationPreferences;
      if (prefs?.newMatchAlerts === false || prefs?.unsubscribedAt) {
        skipped += 1;
        continue;
      }

      const dup = await EmailCampaignLog.findOne({
        user: u._id,
        campaignType: 'new-match-alert',
        'items.itemId': listing._id,
        status: 'sent',
        sentAt: { $gte: new Date(Date.now() - THIRTY_DAYS_MS) },
      });
      if (dup) {
        skipped += 1;
        continue;
      }

      const fullUser = await User.findById(u._id).select('_id email firstName recommendationProfile').lean();
      if (!fullUser?.email) {
        skipped += 1;
        continue;
      }

      const cap = fullUser.recommendationProfile?.notificationPreferences?.weeklyCap ?? 4;
      const allowed = await isUnderWeeklyCap(fullUser._id, cap);
      if (!allowed) {
        skipped += 1;
        continue;
      }

      const profile = await RecommendationEngine.buildUserProfile(fullUser._id);
      const composed = await AIEmailComposer.compose({
        profile,
        items: [listing],
        campaignType: 'new-match-alert',
      });

      const log = await EmailCampaignLog.create({
        user: fullUser._id,
        campaignType: 'new-match-alert',
        subject: composed.subject,
        items: [
          {
            itemType: 'listing',
            itemId: listing._id,
            title: listing.title,
            reason: composed.reasons?.[0] || '',
          },
        ],
        status: 'queued',
        abArm: Math.random() < 0.5 ? 'A' : 'B',
      });

      await emailService.sendNewMatchEmail({
        to: fullUser.email,
        firstName: fullUser.firstName,
        listing,
        composed,
        campaignId: log._id,
      });

      log.status = 'sent';
      log.sentAt = new Date();
      await log.save();

      await User.findByIdAndUpdate(fullUser._id, {
        'recommendationProfile.lastNewMatchEmailAt': new Date(),
      });

      sent += 1;
    } catch (err) {
      console.error('[new-match-alert] user send failed:', err.message);
    }
  }

  console.log(`[new-match-alert] listing=${listingId} sent=${sent} skipped=${skipped}`);
  return { sent, skipped };
};

module.exports = processNewMatchAlert;
