/**
 * dailyDigestWorker
 * -----------------
 * Once per day:
 *   1. Find users who:
 *      - have notificationPreferences.dailyDigest enabled
 *      - have not been emailed a digest in the last 22 hours
 *      - have at least some recommendation signal (searches OR favorites)
 *      - are under their weekly cap
 *   2. For each user, build a personalised digest of 3-5 listings.
 *   3. Run the AI composer to write the email copy.
 *   4. Send via emailService.
 *   5. Log an EmailCampaignLog row + update User.recommendationProfile.
 *
 * The whole loop is sequential and rate-limited by the worker's `limiter`
 * config so we don't trip SMTP throttles.
 */

const User = require('../../../models/User');
const EmailCampaignLog = require('../../../models/EmailCampaignLog');
const RecommendationEngine = require('../../RecommendationEngine');
const AIEmailComposer = require('../../AIEmailComposer');
const emailService = require('../../emailService');
const { isUnderWeeklyCap } = require('../../recommendationEmailUtils');

const TWENTY_TWO_HOURS = 22 * 60 * 60 * 1000;

const processDailyDigest = async (job) => {
  const startedAt = Date.now();
  console.log(`[daily-digest] starting (job ${job.id})`);

  /* 1. Find candidate users. */
  const cutoff = new Date(Date.now() - TWENTY_TWO_HOURS);
  const users = await User.find({
    'recommendationProfile.notificationPreferences.dailyDigest': { $ne: false },
    'recommendationProfile.notificationPreferences.unsubscribedAt': null,
    $or: [
      { 'recommendationProfile.lastRecommendationEmailAt': { $lt: cutoff } },
      { 'recommendationProfile.lastRecommendationEmailAt': null },
      { 'recommendationProfile.lastRecommendationEmailAt': { $exists: false } },
    ],
  })
    .select('_id email firstName recommendationProfile')
    .limit(500); // safety cap per run

  console.log(`[daily-digest] ${users.length} candidate users`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const cap = user.recommendationProfile?.notificationPreferences?.weeklyCap ?? 4;
      const allowed = await isUnderWeeklyCap(user._id, cap);
      if (!allowed) {
        skipped += 1;
        continue;
      }

      /* 2. Build personalised digest. */
      const { profile, items } = await RecommendationEngine.getPersonalizedDigest(user._id, 4);
      if (!profile || !items.length) {
        skipped += 1;
        continue;
      }

      /* 3. AI-compose copy. */
      const composed = await AIEmailComposer.compose({
        profile,
        items,
        campaignType: 'daily-digest',
      });

      /* 4. Create campaign log first so we can pass campaignId into UTM links. */
      const reasons = composed.reasons || [];
      const log = await EmailCampaignLog.create({
        user: user._id,
        campaignType: 'daily-digest',
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

      /* 5. Send. */
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

      /* 6. Update suppression timestamp. */
      await User.findByIdAndUpdate(user._id, {
        'recommendationProfile.lastRecommendationEmailAt': new Date(),
      });

      sent += 1;
      console.log(`[daily-digest] → ${user.email} (provider=${composed.provider}, items=${items.length})`);
    } catch (err) {
      failed += 1;
      console.error(`[daily-digest] FAILED for ${user.email}:`, err.message);
      try {
        await EmailCampaignLog.create({
          user: user._id,
          campaignType: 'daily-digest',
          status: 'failed',
          errorMessage: err.message?.slice(0, 500),
        });
      } catch (_) {}
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[daily-digest] done in ${elapsed}s — sent=${sent}, skipped=${skipped}, failed=${failed}`);
  return { sent, skipped, failed };
};

module.exports = async (job) => {
  if (job.name === 'run-re-engagement') {
    const runReEngagement = require('./reEngagementWorker');
    return runReEngagement(job);
  }
  return processDailyDigest(job);
};
