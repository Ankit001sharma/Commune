/**
 * AI Recommendation Engine
 * Provides product/service recommendations based on user behavior and content similarity.
 * Uses TF-IDF-style keyword matching and collaborative filtering concepts.
 */

const Listing = require('../models/Listing');
const Service = require('../models/Service');
const Post = require('../models/Post');
const User = require('../models/User');
const UserActivity = require('../models/UserActivity');

class RecommendationEngine {
  static buildTagFrequency(savedItems = []) {
    return savedItems.reduce((acc, saved) => {
      const tags = Array.isArray(saved.tags) ? saved.tags : [];
      tags.forEach((tag) => {
        const normalized = `${tag}`.trim().toLowerCase();
        if (!normalized) return;
        acc[normalized] = (acc[normalized] || 0) + 1;
      });
      return acc;
    }, {});
  }

  static scoreByTagFrequency(items, tagFrequency) {
    return [...items].sort((a, b) => {
      const scoreA = (a.tags || []).reduce((sum, tag) => sum + (tagFrequency[`${tag}`.toLowerCase()] || 0), 0);
      const scoreB = (b.tags || []).reduce((sum, tag) => sum + (tagFrequency[`${tag}`.toLowerCase()] || 0), 0);

      if (scoreB !== scoreA) return scoreB - scoreA;
      const viewsA = a.views || 0;
      const viewsB = b.views || 0;
      if (viewsB !== viewsA) return viewsB - viewsA;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  /**
   * Get recommended listings for a user based on their favorites and browsing history
   */
  static async getListingRecommendations(userId, userFavorites = [], userSavedItems = [], limit = 10) {
    try {
      // Get categories from user's favorites
      const favListings = await Listing.find({ _id: { $in: userFavorites } }).select('category tags');
      const preferredCategories = [...new Set(favListings.map((l) => l.category))];
      const preferredTags = [...new Set(favListings.flatMap((l) => l.tags || []))];
      const savedTags = [...new Set(userSavedItems.flatMap((saved) => saved.tags || []))];
      const mergedPreferredTags = [...new Set([...preferredTags, ...savedTags])];
      const savedListingIds = userSavedItems
        .filter((saved) => saved.itemType === 'listing')
        .map((saved) => saved.item);

      const tagFrequency = this.buildTagFrequency(userSavedItems);

      // Find similar listings
      const query = {
        status: 'active',
        seller: { $ne: userId },
        _id: { $nin: [...userFavorites, ...savedListingIds] },
      };

      if (preferredCategories.length > 0 || mergedPreferredTags.length > 0) {
        const orConditions = [];
        if (preferredCategories.length > 0) {
          orConditions.push({ category: { $in: preferredCategories } });
        }
        if (mergedPreferredTags.length > 0) {
          orConditions.push({ tags: { $in: mergedPreferredTags } });
        }
        query.$or = [
          ...orConditions,
        ];
      }

      const recommendations = await Listing.find(query)
        .sort({ views: -1, createdAt: -1 })
        .limit(limit * 3)
        .populate('seller', 'firstName lastName avatar rating');

      return this.scoreByTagFrequency(recommendations, tagFrequency).slice(0, limit);
    } catch (error) {
      console.error('[AI] Recommendation error:', error.message);
      // Fallback to trending items
      return Listing.find({ status: 'active' })
        .sort({ views: -1, createdAt: -1 })
        .limit(limit)
        .populate('seller', 'firstName lastName avatar rating');
    }
  }

  /**
   * Get recommended services based on user preferences
   */
  static async getServiceRecommendations(userId, userSavedItems = [], limit = 10) {
    try {
      const savedServiceIds = userSavedItems
        .filter((saved) => saved.itemType === 'service')
        .map((saved) => saved.item);
      const savedTags = [...new Set(userSavedItems.flatMap((saved) => saved.tags || []))];
      const tagFrequency = this.buildTagFrequency(userSavedItems);

      const query = {
        status: 'active',
        provider: { $ne: userId },
        _id: { $nin: savedServiceIds },
      };

      if (savedTags.length > 0) {
        query.tags = { $in: savedTags };
      }

      const recommendations = await Service.find(query)
        .sort({ 'rating.average': -1, views: -1 })
        .limit(limit * 3)
        .populate('provider', 'firstName lastName avatar rating');

      return this.scoreByTagFrequency(recommendations, tagFrequency).slice(0, limit);
    } catch (error) {
      console.error('[AI] Service recommendation error:', error.message);
      return [];
    }
  }

  /**
   * Natural language search across listings, services and community posts
   */
  static async naturalLanguageSearch(queryText, type = 'all', limit = 20) {
    const trimmedQuery = queryText.trim();
    if (!trimmedQuery) return { listings: [], services: [], posts: [] };

    const keywords = trimmedQuery
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const searchRegex = keywords.map((k) => new RegExp(k, 'i'));
    const results = { listings: [], services: [], posts: [] };

    // Use $text search if possible, with regex fallback for partial matches
    const textQuery = { $text: { $search: trimmedQuery } };
    const regexQuery = keywords.length > 0 ? {
      $or: [
        { title: { $in: searchRegex } },
        { description: { $in: searchRegex } },
        { content: { $in: searchRegex } }, // For posts
        { tags: { $in: keywords } },
        { category: { $in: keywords } },
        { type: { $in: keywords } }, // For posts
      ],
    } : null;

    if (type === 'all' || type === 'listing' || type === 'listings') {
      try {
        // Try text search first for better relevance
        results.listings = await Listing.find({ status: 'active', ...textQuery })
          .select({ score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' } })
          .limit(limit)
          .populate('seller', 'firstName lastName avatar');
        
        // If no results, fallback to regex
        if (results.listings.length === 0 && regexQuery) {
          results.listings = await Listing.find({ status: 'active', ...regexQuery })
            .sort({ views: -1 })
            .limit(limit)
            .populate('seller', 'firstName lastName avatar');
        }
      } catch (err) {
        console.error('Listing search error:', err.message);
        if (regexQuery) {
          results.listings = await Listing.find({ status: 'active', ...regexQuery })
            .sort({ views: -1 })
            .limit(limit)
            .populate('seller', 'firstName lastName avatar');
        }
      }
    }

    if (type === 'all' || type === 'service' || type === 'services') {
      try {
        results.services = await Service.find({ status: 'active', ...textQuery })
          .select({ score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' } })
          .limit(limit)
          .populate('provider', 'firstName lastName avatar');

        if (results.services.length === 0 && regexQuery) {
          results.services = await Service.find({ status: 'active', ...regexQuery })
            .sort({ 'rating.average': -1 })
            .limit(limit)
            .populate('provider', 'firstName lastName avatar');
        }
      } catch (err) {
        console.error('Service search error:', err.message);
        if (regexQuery) {
          results.services = await Service.find({ status: 'active', ...regexQuery })
            .sort({ 'rating.average': -1 })
            .limit(limit)
            .populate('provider', 'firstName lastName avatar');
        }
      }
    }

    if (type === 'all' || type === 'post' || type === 'posts' || type === 'community') {
      try {
        results.posts = await Post.find({ status: 'active', ...textQuery })
          .select({ score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' } })
          .limit(limit)
          .populate('author', 'firstName lastName avatar');

        if (results.posts.length === 0 && regexQuery) {
          results.posts = await Post.find({ status: 'active', ...regexQuery })
            .sort({ views: -1, createdAt: -1 })
            .limit(limit)
            .populate('author', 'firstName lastName avatar');
        }
      } catch (err) {
        console.error('Post search error:', err.message);
        if (regexQuery) {
          results.posts = await Post.find({ status: 'active', ...regexQuery })
            .sort({ views: -1, createdAt: -1 })
            .limit(limit)
            .populate('author', 'firstName lastName avatar');
        }
      }
    }

    return results;
  }

  /* ================================================================ */
  /*  Personalised digest — used by the AI Email Recommendation Agent  */
  /* ================================================================ */

  /**
   * buildUserProfile
   * ----------------
   * Aggregates everything we know about a user into a single object the
   * digest pipeline can ingest:
   *   {
   *     userId,
   *     topCategory,
   *     topKeywords:        [{ keyword, weight }, ...],
   *     viewedCategories:   [...],
   *     savedTags:          [...],
   *     mostSearchedQuery:  string,
   *     unmetSearches:      [...] // queries that returned 0 results recently
   *   }
   */
  static async buildUserProfile(userId) {
    const user = await User.findById(userId)
      .select('favorites savedItems recommendationProfile firstName email')
      .lean();
    if (!user) return null;

    const profile = user.recommendationProfile || {};
    const searches = profile.searches || [];
    const viewedCategories = profile.viewedCategories || [];
    const savedTags = (user.savedItems || []).flatMap((s) => s.tags || []);

    /* Frequency-rank search keywords. */
    const searchFreq = searches.reduce((acc, kw) => {
      acc[kw] = (acc[kw] || 0) + 1;
      return acc;
    }, {});
    const topKeywords = Object.entries(searchFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([keyword, weight]) => ({ keyword, weight }));

    /* Frequency-rank viewed categories. */
    const catFreq = viewedCategories.reduce((acc, c) => {
      acc[c] = (acc[c] || 0) + 1;
      return acc;
    }, {});
    const topCategory = Object.entries(catFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    /* Find search queries that returned no results in the last 30 days. */
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const unmet = await UserActivity.find({
      user: userId,
      eventType: 'search_no_result',
      createdAt: { $gte: since },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('query')
      .lean();

    /* Tag affinity Map → plain object. */
    const tagAffinity = profile.tagAffinity instanceof Map
      ? Object.fromEntries(profile.tagAffinity)
      : (profile.tagAffinity || {});

    return {
      userId: String(user._id),
      firstName: user.firstName,
      email: user.email,
      topCategory,
      topKeywords,
      viewedCategories: Object.keys(catFreq),
      savedTags: [...new Set(savedTags)],
      tagAffinity,
      mostSearchedQuery: searches[0] || null,
      unmetSearches: unmet.map((u) => u.query).filter(Boolean),
      preferences: profile.notificationPreferences || {},
      lastDigestAt: profile.lastRecommendationEmailAt || null,
    };
  }

  /**
   * scoreItem
   * ---------
   * Hybrid score combining:
   *   - category match (heavy)
   *   - tag overlap weighted by tagAffinity
   *   - keyword match in title
   *   - freshness bonus
   *   - popularity bonus (views)
   */
  static scoreItem(item, profile) {
    let score = 0;
    const cat = (item.category || '').toLowerCase();
    if (cat && profile.viewedCategories.includes(cat)) score += 5;
    if (cat && cat === profile.topCategory) score += 3;

    const itemTags = (item.tags || []).map((t) => `${t}`.toLowerCase());
    itemTags.forEach((tag) => {
      score += (profile.tagAffinity?.[tag] || 0);
      if (profile.savedTags.includes(tag)) score += 2;
    });

    const title = (item.title || '').toLowerCase();
    profile.topKeywords.forEach(({ keyword, weight }) => {
      if (title.includes(keyword)) score += weight * 1.5;
    });

    const ageDays = (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 7 - ageDays) * 0.5;          // freshness
    score += Math.log1p(item.views || 0) * 0.3;       // popularity

    return score;
  }

  /**
   * getPersonalizedDigest
   * ---------------------
   * Returns up to `limit` listings ranked for this user, plus the profile
   * we used (so the AI composer can write reasons that reference the actual
   * signals we acted on).
   */
  static async getPersonalizedDigest(userId, limit = 5) {
    const profile = await this.buildUserProfile(userId);
    if (!profile) return { profile: null, items: [] };

    /* Build a query that pulls a generous candidate set, then re-rank locally.
       We exclude the user's own listings and anything they already saved/favorited. */
    const orClauses = [];
    if (profile.viewedCategories.length) {
      orClauses.push({ category: { $in: profile.viewedCategories } });
    }
    if (profile.savedTags.length) {
      orClauses.push({ tags: { $in: profile.savedTags } });
    }
    if (profile.topKeywords.length) {
      const keywordRegex = profile.topKeywords.map(({ keyword }) => new RegExp(keyword, 'i'));
      orClauses.push({ title: { $in: keywordRegex } });
    }

    const query = {
      status: 'active',
      seller: { $ne: userId },
    };
    if (orClauses.length) query.$or = orClauses;

    const candidates = await Listing.find(query)
      .sort({ createdAt: -1, views: -1 })
      .limit(limit * 6)
      .populate('seller', 'firstName lastName avatar')
      .lean();

    /* Dedup against existing favorites/saved. */
    const user = await User.findById(userId).select('favorites savedItems').lean();
    const blocked = new Set([
      ...(user?.favorites || []).map(String),
      ...((user?.savedItems || []).filter((s) => s.itemType === 'listing').map((s) => String(s.item))),
    ]);

    const ranked = candidates
      .filter((c) => !blocked.has(String(c._id)))
      .map((c) => ({ item: c, score: this.scoreItem(c, profile) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item, score }) => ({ ...item, _recScore: Math.round(score * 100) / 100 }));

    return { profile, items: ranked };
  }

  /**
   * findUsersForListing
   * -------------------
   * The inverse query — given a brand new listing, find the users whose
   * profile matches it well enough to warrant a "new match" email.
   * Used by the new-match-alert worker.
   */
  static async findUsersForListing(listing, { minScore = 6, maxUsers = 50 } = {}) {
    if (!listing || !listing.category) return [];
    const cat = listing.category.toLowerCase();
    const tags = (listing.tags || []).map((t) => `${t}`.toLowerCase());
    const titleTokens = (listing.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    /* Pull candidates whose profile mentions the category, a matching tag,
       or a search keyword that overlaps the title. */
    const candidates = await User.find({
      _id: { $ne: listing.seller },
      'recommendationProfile.notificationPreferences.newMatchAlerts': { $ne: false },
      'recommendationProfile.notificationPreferences.unsubscribedAt': null,
      $or: [
        { 'recommendationProfile.viewedCategories': cat },
        { 'recommendationProfile.searches': { $in: titleTokens.length ? titleTokens : [''] } },
        ...(tags.length ? [{ 'savedItems.tags': { $in: tags } }] : []),
      ],
    })
      .select('firstName email recommendationProfile savedItems')
      .limit(200)
      .lean();

    const matches = [];
    for (const user of candidates) {
      const profile = await this.buildUserProfile(user._id);
      if (!profile) continue;
      const score = this.scoreItem(listing, profile);
      if (score >= minScore) {
        matches.push({ user, score });
      }
    }

    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, maxUsers);
  }

  /**
   * Collaborative-lite: listings that share tags with the user's saved items,
   * excluding their own inventory and already-saved rows (approximates
   * "people with similar tastes also viewed").
   */
  static async getSimilarInterestListings(userId, userSavedItems = [], limit = 6) {
    const savedListingIds = userSavedItems
      .filter((s) => s.itemType === 'listing')
      .map((s) => String(s.item));
    const tags = [...new Set(userSavedItems.flatMap((s) => s.tags || []).map((t) => `${t}`.toLowerCase()))];
    if (!tags.length) return [];

    const rows = await Listing.find({
      status: 'active',
      seller: { $ne: userId },
      _id: { $nin: savedListingIds },
      tags: { $in: tags },
    })
      .sort({ views: -1, createdAt: -1 })
      .limit(limit * 2)
      .populate('seller', 'firstName lastName avatar rating')
      .lean();

    return rows.slice(0, limit);
  }

  /**
   * Aggregated in-app feed for Home + recommendation dashboard.
   */
  static async getRecommendationFeed(userId, limit = 12) {
    const profile = await this.buildUserProfile(userId);
    const userDoc = await User.findById(userId).select('favorites savedItems').lean();
    const userFavorites = userDoc?.favorites || [];
    const userSavedItems = userDoc?.savedItems || [];

    const digestLimit = Math.min(Math.max(4, Math.floor(limit / 2)), 8);
    const [digestResult, listingsRec, servicesRec, similarPool] = await Promise.all([
      this.getPersonalizedDigest(userId, digestLimit),
      this.getListingRecommendations(userId, userFavorites, userSavedItems, limit),
      this.getServiceRecommendations(userId, userSavedItems, Math.min(8, limit)),
      this.getSimilarInterestListings(userId, userSavedItems, 6),
    ]);

    const topKw = profile?.topKeywords?.[0]?.keyword;
    let becauseYouSearched = null;
    if (topKw) {
      const esc = topKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(esc, 'i');
      const matched = listingsRec.filter(
        (l) =>
          rx.test(l.title || '') ||
          (l.tags || []).some((t) => rx.test(`${t}`))
      );
      becauseYouSearched = {
        keyword: topKw,
        subtitle: `Because you searched for "${topKw}"`,
        listings: matched.slice(0, 4),
      };
    }

    let trendingInCategory = [];
    if (profile?.topCategory) {
      trendingInCategory = await Listing.find({
        status: 'active',
        category: profile.topCategory,
        seller: { $ne: userId },
      })
        .sort({ views: -1, createdAt: -1 })
        .limit(4)
        .populate('seller', 'firstName lastName avatar rating')
        .lean();
    }

    return {
      profileSummary: profile && {
        topCategory: profile.topCategory,
        topKeywords: profile.topKeywords,
        viewedCategories: profile.viewedCategories,
        unmetSearches: profile.unmetSearches,
      },
      personalizedListings: digestResult.items || [],
      recommendedListings: listingsRec,
      recommendedServices: servicesRec,
      becauseYouSearched,
      trendingInCategory,
      similarUsersAlsoViewed: similarPool,
    };
  }
}

module.exports = RecommendationEngine;
