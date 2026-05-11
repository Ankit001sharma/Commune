/**
 * One-off or cron-friendly runner for the AI Email Recommendation Agent.
 *
 * Usage (from `Commune/backend`):
 *   node scripts/runRecommendationAgent.js
 *
 * - If REDIS_URL is set: enqueues the BullMQ daily-digest job (workers must be
 *   running — normally via `node server.js` or a dedicated worker process).
 * - Else: runs the digest worker inline once against MongoDB (dev convenience).
 */

require('dotenv').config();
const path = require('path');

// Ensure cwd resolves models the same as server
process.chdir(path.join(__dirname, '..'));

const { runRecommendationAgent } = require('../services/recommendationAgent');
const { isQueueEnabled } = require('../services/queues/redis');

const main = async () => {
  const inline = !isQueueEnabled();
  if (inline) {
    console.log('[rec:agent] REDIS_URL not set — running digest inline (dev mode).');
  } else {
    console.log('[rec:agent] Enqueuing daily digest on BullMQ…');
  }

  const out = await runRecommendationAgent({ inlineIfNoRedis: inline });
  console.log('[rec:agent] result:', JSON.stringify(out, null, 2));

  if (out.mode === 'bullmq') {
    console.log('[rec:agent] Ensure the API server (or a worker) is running to process the job.');
  }

  process.exit(out.ok ? 0 : 1);
};

main().catch((err) => {
  console.error('[rec:agent] fatal:', err);
  process.exit(1);
});
