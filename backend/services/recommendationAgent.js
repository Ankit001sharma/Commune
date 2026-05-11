/**
 * AI Email Recommendation Agent
 * ------------------------------
 * This module replaces the legacy root-level `recommendationAgent.js` pattern
 * (loop users → pick category from searchHistory → sendRecommendationEmail).
 *
 * Reference files in repo root (for comparison only — paths assume `backend/`):
 *   - `recommendationAgent.js` — simple 3-day throttle + category picks + email
 *   - `RecommendationEngine.js` — slimmer engine (listings/services only)
 *
 * Production CommuneX instead uses:
 *   - `ActivityTracker` + `UserActivity` + `User.recommendationProfile` for signals
 *   - `RecommendationEngine` (extended) for hybrid scoring + digest feed
 *   - `AIEmailComposer` (Groq) + `emailService.sendPersonalizedDigestEmail`
 *   - BullMQ `recommendationQueue` + `dailyDigestWorker` / `newMatchAlertWorker`
 *
 * Public entry point kept beginner-friendly:
 *   const { runRecommendationAgent } = require('./services/recommendationAgent');
 *   await runRecommendationAgent();                    // enqueue if Redis OK
 *   await runRecommendationAgent({ inlineIfNoRedis: true }); // dev: run once without Redis
 */

const connectDB = require('../config/database');
const { enqueueDailyDigest } = require('./queues/recommendationQueue');
const { isQueueEnabled } = require('./queues/redis');

const digestWorker = require('./queues/workers/dailyDigestWorker');

/**
 * @param {{ inlineIfNoRedis?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, mode: string, jobId?: string, result?: unknown, hint?: string }>}
 */
const runRecommendationAgent = async (options = {}) => {
  const { inlineIfNoRedis = false } = options;

  const job = await enqueueDailyDigest({ source: 'recommendationAgent' });
  if (job) {
    return { ok: true, mode: 'bullmq', jobId: String(job.id) };
  }

  if (!inlineIfNoRedis) {
    return {
      ok: false,
      mode: 'disabled',
      hint: isQueueEnabled()
        ? 'BullMQ failed to enqueue (check Redis and bullmq install).'
        : 'Set REDIS_URL for production. For a one-off local run without Redis, pass { inlineIfNoRedis: true } (requires MONGODB_URI).',
    };
  }

  await connectDB();
  const fakeJob = {
    id: 'inline-recommendation-agent',
    name: 'run-daily-digest',
    data: { source: 'recommendationAgent-inline' },
  };
  const result = await digestWorker(fakeJob);
  return { ok: true, mode: 'inline', result };
};

module.exports = { runRecommendationAgent };
