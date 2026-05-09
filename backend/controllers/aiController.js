const RecommendationEngine = require('../services/RecommendationEngine');
const ChatbotService = require('../services/ChatbotService');
const ListingAssistService = require('../services/ListingAssistService');
const { sendResponse } = require('../utils/response');
const User = require('../models/User');

exports.getRecommendations = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userDoc = await User.findById(userId).select('favorites savedItems');
    const userFavorites = userDoc?.favorites || [];
    const userSavedItems = userDoc?.savedItems || [];
    const limit = parseInt(req.query.limit) || 10;

    const [listings, services] = await Promise.all([
      RecommendationEngine.getListingRecommendations(userId, userFavorites, userSavedItems, limit),
      RecommendationEngine.getServiceRecommendations(userId, userSavedItems, limit),
    ]);

    sendResponse(res, 200, { listings, services }, 'Recommendations generated');
  } catch (error) {
    next(error);
  }
};

exports.naturalLanguageSearch = async (req, res, next) => {
  try {
    const { q, type = 'all' } = req.query;
    if (!q || q.trim().length === 0) {
      return sendResponse(res, 200, { listings: [], services: [] }, 'No query provided');
    }

    const results = await RecommendationEngine.naturalLanguageSearch(q, type);
    if (req.user?._id) {
      const terms = q.toLowerCase().split(/\s+/).filter((word) => word.length > 2);
      await User.findByIdAndUpdate(req.user._id, {
        $push: {
          'recommendationProfile.searches': {
            $each: terms,
            $position: 0,
            $slice: 30,
          },
        },
      });
    }
    sendResponse(res, 200, results, 'Search results');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ai/listing-assist
 * Body: multipart with field "image" (single file)
 * Returns: { title, description, category, condition, keywords, price: { suggested, min, max, ... } }
 */
exports.listingAssist = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer || !req.file.buffer.length) {
      return res.status(400).json({ status: 'fail', message: 'Image is required' });
    }

    const suggestion = await ListingAssistService.analyseImage(
      req.file.buffer,
      req.file.mimetype || 'image/jpeg'
    );

    const price = await ListingAssistService.suggestPrice({
      category: suggestion.category,
      condition: suggestion.condition,
      title: suggestion.title,
    });

    sendResponse(res, 200, { ...suggestion, price }, 'AI listing suggestion ready');
  } catch (error) {
    next(error);
  }
};

exports.chatbot = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || message.trim().length === 0) {
      return sendResponse(res, 400, null, 'Message is required');
    }

    const response = await ChatbotService.getResponse(message);
    sendResponse(res, 200, response, 'Chatbot response');
  } catch (error) {
    next(error);
  }
};
