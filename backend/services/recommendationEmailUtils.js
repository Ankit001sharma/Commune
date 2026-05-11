/**
 * Shared helpers for AI email campaigns (digest, new-match, re-engagement).
 */

const EmailCampaignLog = require('../models/EmailCampaignLog');

const isUnderWeeklyCap = async (userId, cap) => {
  if (!cap || cap <= 0) return false;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sentThisWeek = await EmailCampaignLog.countDocuments({
    user: userId,
    status: 'sent',
    sentAt: { $gte: since },
  });
  return sentThisWeek < cap;
};

module.exports = { isUnderWeeklyCap };
