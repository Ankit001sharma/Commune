/**
 * reEngagementWorker
 * ------------------
 * Weekly job: users inactive for N days who opted in receive a "we miss you"
 * digest using the same AI pipeline as the daily digest.
 */

const config = require('../../../config');
const User = require('../../../models/User');
const EmailCampaignLog = require('../../../models/EmailCampaignLog');
const RecommendationEngine = require('../../RecommendationEngine');
const AIEmailComposer = require('../../AIEmailComposer');
const emailService = require('../../emailService');
const { isUnderWeeklyCap } = require('../../recommendationEmailUtils');

const processReEngagement = async (job) => {
  const inactiveDays = config.recommendation?.inactiveDaysForReEngagement || 7;
  const cooldownDays = config.recommendation?.reEngagementCooldownDays || 14;
  const cutoffUserActivity = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);
  const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;

  const users = await User.find({
    'recommendationProfile.notificationPreferences.reEngagement': { $ne: false },
    'recommendationProfile.notificationPreferences.unsubscribedAt': null,
    lastActive: { $lte: cutoffUserActivity },
    $or: [
      { 'recommendationProfile.searches.0': { $exists: true } },
      { favorites: { $exists: true, $not: { $size: 0 } } },
      { 'savedItems.0': { $exists: true } },
    ],
  })
    .select('_id email firstName recommendationProfile lastActive')
    .limit(300);

  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      const recentReEngage = await EmailCampaignLog.findOne({
        user: user._id,
        campaignType: 're-engagement',
        status: 'sent',
        sentAt: { $gte: new Date(Date.now() - cooldownMs) },
      });
      if (recentReEngage) {
        skipped += 1;
        continue;
      }

      const cap = user.recommendationProfile?.notificationPreferences?.weeklyCap ?? 4;
      const allowed = await isUnderWeeklyCap(user._id, cap);
      if (!allowed) {
        skipped += 1;
        continue;
      }

      const { profile, items } = await RecommendationEngine.getPersonalizedDigest(user._id, 4);
      if (!profile || !items.length) {
        skipped += 1;
        continue;
      }

      const composed = await AIEmailComposer.compose({
        profile,
        items,
        campaignType: 're-engagement',
      });

      const reasons = composed.reasons || [];
      const log = await EmailCampaignLog.create({
        user: user._id,
        campaignType: 're-engagement',
        subject: composed.subject,
        items: items.map((it, idx) => ({
          itemType: 'listing',
          itemId: it._id,
          title: it.title,
          reason: reasons[idx] || '',
        })),
        status: 'queued',
        abArm: Math.random() < 0.5 ? 'A' : 'B',
      });

      await emailService.sendPersonalizedDigestEmail({
        to: user.email,
        firstName: user.firstName,
        items,
        composed,
        campaignId: log._id,
      });

      log.status = 'sent';
      log.sentAt = new Date();
      await log.save();

      await User.findByIdAndUpdate(user._id, {
        'recommendationProfile.lastRecommendationEmailAt': new Date(),
      });

      sent += 1;
    } catch (err) {
      console.error('[re-engagement] FAILED for user:', err.message);
    }
  }

  console.log(`[re-engagement] sent=${sent} skipped=${skipped}`);
  return { sent, skipped };
};

module.exports = processReEngagement;
