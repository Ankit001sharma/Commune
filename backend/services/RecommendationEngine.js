/**
 * AI Recommendation Engine
 * Provides product/service recommendations based on user behavior and content similarity.
 * Uses TF-IDF-style keyword matching and collaborative filtering concepts.
 */

const Listing = require('../models/Listing');
const Service = require('../models/Service');

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
