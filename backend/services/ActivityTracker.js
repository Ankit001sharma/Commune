/**
 * ActivityTracker
 * ---------------
 * Single entry-point for any code that wants to record a user's behaviour.
 *
 * Why a service and not just an inline write?
 *   - Two writes per event (UserActivity log + User.recommendationProfile
 *     denormalised counters) need to be kept in sync.
 *   - We want every caller to fail-soft: tracking must NEVER block a request
 *     or take down a route, so we wrap everything in try/catch and log.
 *
 * Public API:
 *     await ActivityTracker.logSearch(userId, { query, results })
 *     await ActivityTracker.logView(userId, { itemType, itemId, category, tags })
 *     await ActivityTracker.logFavorite(userId, { itemType, itemId, category, tags })
 *     await ActivityTracker.logClick(userId, { itemType, itemId, campaignId })
 *     await ActivityTracker.logInactive(userId)
 */

const mongoose = require('mongoose');
const UserActivity = require('../models/UserActivity');
const User = require('../models/User');

const SEARCH_HISTORY_LIMIT = 30;
const CATEGORY_HISTORY_LIMIT = 25;

/* ------------------------------------------------------------------ */
/* Internal helpers                                                    */
/* ------------------------------------------------------------------ */
const safeId = (id) => {
  if (!id) return null;
  try {
    return new mongoose.Types.ObjectId(id);
  } catch (_) {
    return null;
  }
};

const tokenise = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 6);

/**
 * Bumps a Map<string,number> stored in User.recommendationProfile.tagAffinity.
 * Mongo's `$inc` works on dotted Map paths — but only if the key is a valid
 * field name. We sanitise to lowercase alphanumerics first.
 */
const buildTagAffinityIncrement = (tags = []) => {
  const inc = {};
  tags
    .map((t) => `${t}`.toLowerCase().trim())
    .filter((t) => /^[a-z0-9_-]+$/.test(t))
    .forEach((t) => {
      inc[`recommendationProfile.tagAffinity.${t}`] = 1;
    });
  return inc;
};

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */
class ActivityTracker {
  /**
   * Log a search query. We push tokens onto recommendationProfile.searches
   * and write a separate UserActivity row for analytics.
   */
  static async logSearch(userId, { query, results = null, source = 'search' } = {}) {
    if (!userId || !query) return;
    const uid = safeId(userId);
    if (!uid) return;

    const tokens = tokenise(query);
    const eventType = results !== null && results === 0 ? 'search_no_result' : 'search';

    try {
      await UserActivity.create({
        user: uid,
        eventType,
        query: query.trim().toLowerCase(),
        keywords: tokens,
        source,
      });

      if (tokens.length) {
        await User.findByIdAndUpdate(uid, {
          $push: {
            'recommendationProfile.searches': {
              $each: tokens,
              $position: 0,
              $slice: SEARCH_HISTORY_LIMIT,
            },
          },
        });
      }
    } catch (err) {
      console.error('[ActivityTracker] logSearch failed:', err.message);
    }
  }

  /**
   * Log a "view" (open detail page). Updates viewedCategories and tagAffinity.
   */
  static async logView(userId, { itemType, itemId, category, tags = [], source = 'marketplace' } = {}) {
    if (!userId) return;
    const uid = safeId(userId);
    if (!uid) return;

    try {
      await UserActivity.create({
        user: uid,
        eventType: 'view',
        itemType,
        itemId: safeId(itemId),
        category: category ? category.toLowerCase() : null,
        keywords: tags.map((t) => `${t}`.toLowerCase()),
        source,
      });

      const update = {};
      if (category) {
        update.$push = update.$push || {};
        update.$push['recommendationProfile.viewedCategories'] = {
          $each: [category.toLowerCase()],
          $position: 0,
          $slice: CATEGORY_HISTORY_LIMIT,
        };
      }
      const tagInc = buildTagAffinityIncrement(tags);
      if (Object.keys(tagInc).length) {
        update.$inc = tagInc;
      }
      if (Object.keys(update).length) {
        await User.findByIdAndUpdate(uid, update);
      }
    } catch (err) {
      console.error('[ActivityTracker] logView failed:', err.message);
    }
  }

  /**
   * Log a favorite/save — high-intent signal, weighted heavier in ranking.
   */
  /**
   * Log an explicit save (wishlist) — distinct from favorite sync on listings.
   */
  static async logSave(userId, { itemType, itemId, category, tags = [] } = {}) {
    if (!userId) return;
    const uid = safeId(userId);
    if (!uid) return;

    try {
      await UserActivity.create({
        user: uid,
        eventType: 'save',
        itemType,
        itemId: safeId(itemId),
        category: category ? category.toLowerCase() : null,
        keywords: tags.map((t) => `${t}`.toLowerCase()),
        source: 'marketplace',
      });

      const tagInc = buildTagAffinityIncrement(tags);
      const doubled = Object.fromEntries(Object.entries(tagInc).map(([k, v]) => [k, v * 2]));
      if (Object.keys(doubled).length) {
        await User.findByIdAndUpdate(uid, { $inc: doubled });
      }
    } catch (err) {
      console.error('[ActivityTracker] logSave failed:', err.message);
    }
  }

  static async logFavorite(userId, { itemType, itemId, category, tags = [] } = {}) {
    if (!userId) return;
    const uid = safeId(userId);
    if (!uid) return;

    try {
      await UserActivity.create({
        user: uid,
        eventType: 'favorite',
        itemType,
        itemId: safeId(itemId),
        category: category ? category.toLowerCase() : null,
        keywords: tags.map((t) => `${t}`.toLowerCase()),
        source: 'marketplace',
      });

      // Favorites count 3x more than a view in tag affinity.
      const tagInc = buildTagAffinityIncrement(tags);
      const tripled = Object.fromEntries(Object.entries(tagInc).map(([k, v]) => [k, v * 3]));
      if (Object.keys(tripled).length) {
        await User.findByIdAndUpdate(uid, { $inc: tripled });
      }
    } catch (err) {
      console.error('[ActivityTracker] logFavorite failed:', err.message);
    }
  }

  /**
   * Log a click on a recommendation email link or in-app rec card.
   */
  static async logClick(userId, { itemType, itemId, campaignId, source = 'recommendation' } = {}) {
    if (!userId) return;
    const uid = safeId(userId);
    if (!uid) return;

    try {
      await UserActivity.create({
        user: uid,
        eventType: 'click',
        itemType,
        itemId: safeId(itemId),
        campaignId: safeId(campaignId),
        source,
      });
    } catch (err) {
      console.error('[ActivityTracker] logClick failed:', err.message);
    }
  }

  /**
   * Bulk fetch recent activity for a user — used by the recommendation engine.
   */
  static async getRecentActivity(userId, { limit = 100, days = 30 } = {}) {
    const uid = safeId(userId);
    if (!uid) return [];
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return UserActivity.find({ user: uid, createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}

module.exports = ActivityTracker;
