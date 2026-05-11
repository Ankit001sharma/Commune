/**
 * activityLogger middleware
 * -------------------------
 * Tiny adapters around ActivityTracker for use in route definitions:
 *
 *     router.get('/listings/:id',
 *                 protect,
 *                 listingController.getListing,
 *                 logViewAfterResponse('listing'));
 *
 * Why "after response"? We never want tracking to delay the user's request,
 * so the middleware runs in res.on('finish') after the response is flushed.
 */

const ActivityTracker = require('../services/ActivityTracker');

/**
 * Logs a "view" event for the resource at req.params.id once the response
 * has been sent. Caller specifies the itemType ('listing'|'service'|'post').
 *
 * Expects the controller to have attached `req._loggedItem` with the
 * { category, tags } pulled from the DB — this avoids a second DB roundtrip.
 */
const logViewAfterResponse = (itemType) => (req, res, next) => {
  res.on('finish', () => {
    if (!req.user || !req.params.id) return;
    if (res.statusCode >= 400) return; // don't track failed requests

    const item = req._loggedItem || {};
    ActivityTracker.logView(req.user._id, {
      itemType,
      itemId: req.params.id,
      category: item.category,
      tags: item.tags || [],
      source: itemType === 'listing' ? 'marketplace'
            : itemType === 'service' ? 'services'
            : 'community',
    }).catch(() => {});
  });
  next();
};

const logSearchAfterResponse = () => (req, res, next) => {
  res.on('finish', () => {
    if (!req.user || res.statusCode >= 400) return;
    const q = req.query?.q || req.body?.q;
    if (!q) return;
    const resultsCount = req._searchResultsCount;
    ActivityTracker.logSearch(req.user._id, { query: q, results: resultsCount }).catch(() => {});
  });
  next();
};

module.exports = { logViewAfterResponse, logSearchAfterResponse };
