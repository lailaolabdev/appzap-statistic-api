/**
 * Redis Publisher Utility
 *
 * Publishes restaurant sync events to Redis Pub/Sub so that
 * the Consumer API can update its RestaurantRegistry in real-time.
 *
 * Channel: pos:restaurant:updated
 * Channel: pos:restaurant:deactivated
 */

const Redis = require('ioredis');

const CHANNEL_RESTAURANT_UPDATED = 'pos:restaurant:updated';
const CHANNEL_RESTAURANT_DEACTIVATED = 'pos:restaurant:deactivated';

let publisher = null;

/**
 * Initialize the Redis publisher connection
 */
function initializePublisher() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const isTls = redisUrl.startsWith('rediss://');

  publisher = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
    ...(isTls && { tls: { rejectUnauthorized: false } }),
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 200, 2000);
    },
  });

  publisher.on('connect', () => {
    console.log('[RedisPublisher] Connected');
  });

  publisher.on('error', (err) => {
    console.error('[RedisPublisher] Error:', err.message);
  });

  publisher.connect().catch((err) => {
    console.warn('[RedisPublisher] Initial connect failed:', err.message);
  });
}

/**
 * Publish restaurant updated event
 * Called after admin updates a restaurant in POS v1 or v2
 *
 * @param {string} restaurantId
 * @param {'v1'|'v2'} posVersion
 * @param {object} updatedData - the fields that were updated
 */
async function publishRestaurantUpdated(restaurantId, posVersion, updatedData = {}) {
  if (!publisher) return;

  try {
    const payload = JSON.stringify({
      source: posVersion,
      restaurantId: String(restaurantId),
      data: updatedData,
      timestamp: new Date().toISOString(),
    });

    await publisher.publish(CHANNEL_RESTAURANT_UPDATED, payload);
    console.log(`[RedisPublisher] Published restaurant update: ${restaurantId} (${posVersion})`);
  } catch (err) {
    console.error('[RedisPublisher] Failed to publish restaurant update:', err.message);
  }
}

/**
 * Publish restaurant deactivated event
 *
 * @param {string} restaurantId
 * @param {'v1'|'v2'} posVersion
 */
async function publishRestaurantDeactivated(restaurantId, posVersion) {
  if (!publisher) return;

  try {
    const payload = JSON.stringify({
      source: posVersion,
      restaurantId: String(restaurantId),
      timestamp: new Date().toISOString(),
    });

    await publisher.publish(CHANNEL_RESTAURANT_DEACTIVATED, payload);
    console.log(`[RedisPublisher] Published restaurant deactivated: ${restaurantId} (${posVersion})`);
  } catch (err) {
    console.error('[RedisPublisher] Failed to publish restaurant deactivated:', err.message);
  }
}

/**
 * Graceful shutdown
 */
async function closePublisher() {
  if (publisher) {
    await publisher.quit();
    publisher = null;
    console.log('[RedisPublisher] Connection closed');
  }
}

module.exports = {
  initializePublisher,
  publishRestaurantUpdated,
  publishRestaurantDeactivated,
  closePublisher,
};
