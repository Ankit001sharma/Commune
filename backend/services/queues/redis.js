/**
 * redis.js
 * --------
 * Single shared ioredis connection for BullMQ. We export both:
 *   - getRedisConnection() — returns the ioredis instance (or null if disabled)
 *   - isQueueEnabled()     — boolean checked by callers before enqueuing
 *
 * If REDIS_URL is not set we DON'T crash the server — the queue layer
 * silently no-ops, and the rest of the app keeps working without
 * recommendations until Redis is available.
 */

const config = require('../../config');

let connection = null;
let attemptedConnection = false;

const isQueueEnabled = () => Boolean(config.redis?.url);

const getRedisConnection = () => {
  if (!isQueueEnabled()) return null;
  if (connection) return connection;
  if (attemptedConnection) return null;
  attemptedConnection = true;

  try {
    // Lazy-require so dev environments without ioredis installed still boot.
    // eslint-disable-next-line global-require
    const IORedis = require('ioredis');
    connection = new IORedis(config.redis.url, {
      // BullMQ requirement — never auto-disconnect background commands.
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    connection.on('error', (err) => {
      console.error('[Redis] error:', err.message);
    });
    connection.on('connect', () => {
      console.log('[Redis] connected');
    });
    return connection;
  } catch (err) {
    console.warn('[Redis] ioredis not installed or REDIS_URL invalid — recommendation queue disabled.');
    console.warn('[Redis]   Run `npm install ioredis bullmq` and set REDIS_URL=redis://localhost:6379 to enable.');
    return null;
  }
};

const closeRedis = async () => {
  if (connection) {
    await connection.quit().catch(() => {});
    connection = null;
  }
};

module.exports = { getRedisConnection, isQueueEnabled, closeRedis };
