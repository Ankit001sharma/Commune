const RecommendationEngine = require('../services/RecommendationEngine');
const ChatbotService = require('../services/ChatbotService');
const { sendResponse } = require('../utils/response');

exports.getRecommendations = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userFavorites = req.user.favorites || [];
    const limit = parseInt(req.query.limit) || 10;

    const [listings, services] = await Promise.all([
      RecommendationEngine.getListingRecommendations(userId, userFavorites, limit),
      RecommendationEngine.getServiceRecommendations(userId, limit),
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
    sendResponse(res, 200, results, 'Search results');
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

    const response = ChatbotService.getResponse(message);
    sendResponse(res, 200, response, 'Chatbot response');
  } catch (error) {
    next(error);
  }
};
