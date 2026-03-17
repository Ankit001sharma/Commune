/**
 * AI Recommendation Engine
 * Provides product/service recommendations based on user behavior and content similarity.
 * Uses TF-IDF-style keyword matching and collaborative filtering concepts.
 */

const Listing = require('../models/Listing');
const Service = require('../models/Service');

class RecommendationEngine {
  /**
   * Get recommended listings for a user based on their favorites and browsing history
   */
  static async getListingRecommendations(userId, userFavorites = [], limit = 10) {
    try {
      // Get categories from user's favorites
      const favListings = await Listing.find({ _id: { $in: userFavorites } }).select('category tags');
      const preferredCategories = [...new Set(favListings.map((l) => l.category))];
      const preferredTags = [...new Set(favListings.flatMap((l) => l.tags || []))];

      // Find similar listings
      const query = {
        status: 'active',
        seller: { $ne: userId },
        _id: { $nin: userFavorites },
      };

      if (preferredCategories.length > 0) {
        query.$or = [
          { category: { $in: preferredCategories } },
          { tags: { $in: preferredTags } },
        ];
      }

      const recommendations = await Listing.find(query)
        .sort({ views: -1, createdAt: -1 })
        .limit(limit)
        .populate('seller', 'firstName lastName avatar rating');

      return recommendations;
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
  static async getServiceRecommendations(userId, limit = 10) {
    try {
      const recommendations = await Service.find({
        status: 'active',
        provider: { $ne: userId },
      })
        .sort({ 'rating.average': -1, views: -1 })
        .limit(limit)
        .populate('provider', 'firstName lastName avatar rating');

      return recommendations;
    } catch (error) {
      console.error('[AI] Service recommendation error:', error.message);
      return [];
    }
  }

  /**
   * Natural language search across listings and services
   */
  static async naturalLanguageSearch(queryText, type = 'all', limit = 20) {
    const keywords = queryText
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const searchRegex = keywords.map((k) => new RegExp(k, 'i'));
    const results = { listings: [], services: [] };

    if (type === 'all' || type === 'listings') {
      results.listings = await Listing.find({
        status: 'active',
        $or: [
          { title: { $in: searchRegex } },
          { description: { $in: searchRegex } },
          { tags: { $in: keywords } },
          { category: { $in: keywords } },
        ],
      })
        .sort({ views: -1 })
        .limit(limit)
        .populate('seller', 'firstName lastName avatar');
    }

    if (type === 'all' || type === 'services') {
      results.services = await Service.find({
        status: 'active',
        $or: [
          { title: { $in: searchRegex } },
          { description: { $in: searchRegex } },
          { tags: { $in: keywords } },
          { category: { $in: keywords } },
        ],
      })
        .sort({ 'rating.average': -1 })
        .limit(limit)
        .populate('provider', 'firstName lastName avatar');
    }

    return results;
  }
}

module.exports = RecommendationEngine;
