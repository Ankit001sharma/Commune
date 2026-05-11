/**
 * recommendationQueue.js
 * ----------------------
 * Public API for the recommendation pipeline:
 *
 *   await enqueueDailyDigest()          // schedules tonight's digest run
 *   await enqueueNewMatchAlert(listingId)  // run after a listing is created
 *   await scheduleRepeatableJobs()      // wires the cron 09:00 IST trigger
 *   await startWorkers()                // spins up the daily + alert workers
 *   await closeQueues()                 // graceful shutdown
 *
 * Everything is a no-op if Redis isn't configured — that lets the rest of
 * the project run even without bullmq installed.
 */

const config = require('../../config');
const { getRedisConnection, isQueueEnabled } = require('./redis');

const digestCron = () => config.recommendation?.dailyDigestCron || '0 9 * * *';
const reEngagementCron = () => config.recommendation?.reEngagementCron || '0 10 * * 1';

let Queue = null;
let Worker = null;
let dailyDigestQueue = null;
let newMatchAlertQueue = null;
const activeWorkers = [];

/* Lazy-require bullmq so the server boots without it installed. */
const loadBullMQ = () => {
  if (Queue && Worker) return true;
  try {
    // eslint-disable-next-line global-require
    const bullmq = require('bullmq');
    Queue = bullmq.Queue;
    Worker = bullmq.Worker;
    return true;
  } catch (err) {
    console.warn('[Queue] bullmq not installed — run `npm install bullmq ioredis` to enable.');
    return false;
  }
};

const QUEUE_NAMES = {
  dailyDigest: 'recommendation-daily-digest',
  newMatch: 'recommendation-new-match',
};

const ensureQueues = () => {
  if (!isQueueEnabled() || !loadBullMQ()) return false;
  const connection = getRedisConnection();
  if (!connection) return false;
  if (!dailyDigestQueue) {
    dailyDigestQueue = new Queue(QUEUE_NAMES.dailyDigest, { connection });
  }
  if (!newMatchAlertQueue) {
    newMatchAlertQueue = new Queue(QUEUE_NAMES.newMatch, { connection });
  }
  return true;
};

/* ------------------------------------------------------------------ */
/* Producers                                                            */
/* ------------------------------------------------------------------ */
const enqueueDailyDigest = async (opts = {}) => {
  if (!ensureQueues()) return null;
  return dailyDigestQueue.add('run-daily-digest', { runAt: Date.now(), ...opts }, {
    removeOnComplete: 100,
    removeOnFail: 50,
  });
};

const enqueueNewMatchAlert = async (listingId) => {
  if (!ensureQueues() || !listingId) return null;
  return newMatchAlertQueue.add('new-match-alert', { listingId: String(listingId) }, {
    /* Wait 30 seconds — listing might be edited right after creation. */
    delay: 30 * 1000,
    attempts: 3,
    backoff: { type: 'exponential', delay: 60 * 1000 },
    removeOnComplete: 200,
    removeOnFail: 100,
  });
};

/**
 * scheduleRepeatableJobs — wires the daily 09:00 IST cron trigger.
 * Called once at server startup.
 */
const scheduleRepeatableJobs = async () => {
  if (!ensureQueues()) return;
  const cron = digestCron();
  await dailyDigestQueue.add(
    'run-daily-digest',
    { source: 'cron' },
    {
      repeat: { pattern: cron, tz: 'Asia/Kolkata' },
      jobId: 'daily-digest-cron', // dedup so restarts don't duplicate the schedule
      removeOnComplete: true,
      removeOnFail: 50,
    }
  );
  console.log(`[Queue] daily-digest scheduled with cron "${cron}"`);

  const reCron = reEngagementCron();
  await dailyDigestQueue.add(
    'run-re-engagement',
    { source: 'cron' },
    {
      repeat: { pattern: reCron, tz: 'Asia/Kolkata' },
      jobId: 're-engagement-cron',
      removeOnComplete: true,
      removeOnFail: 50,
    }
  );
  console.log(`[Queue] re-engagement scheduled with cron "${reCron}"`);
};

/* ------------------------------------------------------------------ */
/* Workers                                                              */
/* ------------------------------------------------------------------ */
const startWorkers = async () => {
  if (!ensureQueues()) {
    console.log('[Queue] disabled — Redis not configured, skipping workers.');
    return;
  }
  const connection = getRedisConnection();

  /* Lazy-require workers so test environments don't pull them in. */
  // eslint-disable-next-line global-require
  const dailyDigestProcessor = require('./workers/dailyDigestWorker');
  // eslint-disable-next-line global-require
  const newMatchProcessor = require('./workers/newMatchAlertWorker');

  const dailyWorker = new Worker(QUEUE_NAMES.dailyDigest, dailyDigestProcessor, {
    connection,
    concurrency: 1,           // one digest run at a time
  });
  dailyWorker.on('failed', (job, err) =>
    console.error(`[Queue] daily-digest job ${job?.id} failed:`, err.message)
  );
  dailyWorker.on('completed', (job) =>
    console.log(`[Queue] daily-digest job ${job.id} completed`)
  );

  const matchWorker = new Worker(QUEUE_NAMES.newMatch, newMatchProcessor, {
    connection,
    concurrency: 5,           // alerts can fan out in parallel
    limiter: { max: 30, duration: 60 * 1000 }, // SMTP-friendly rate limit
  });
  matchWorker.on('failed', (job, err) =>
    console.error(`[Queue] new-match job ${job?.id} failed:`, err.message)
  );

  activeWorkers.push(dailyWorker, matchWorker);
  console.log('[Queue] workers started: daily-digest, new-match-alert');
};

const closeQueues = async () => {
  for (const worker of activeWorkers) {
    await worker.close().catch(() => {});
  }
  if (dailyDigestQueue) await dailyDigestQueue.close().catch(() => {});
  if (newMatchAlertQueue) await newMatchAlertQueue.close().catch(() => {});
};

module.exports = {
  enqueueDailyDigest,
  enqueueNewMatchAlert,
  scheduleRepeatableJobs,
  startWorkers,
  closeQueues,
  QUEUE_NAMES,
};
