/**
 * Sync All Packaged Restaurants to Consumer API
 *
 * Fetches every restaurant that has an active subscription package
 * from POS v1 and POS v2, then publishes each to Redis so the
 * Consumer API's sync listener can upsert them into restaurant_registry.
 */

const { getAllDatabases } = require('./multiDbConnection');
const { publishRestaurantUpdated } = require('./redisPublisher');

const BATCH_DELAY_MS = 50; // small delay between publishes to avoid Redis flood

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Sync all V1 stores that have a package
 */
async function syncV1PackagedRestaurants() {
  const { posV1 } = getAllDatabases();
  if (!posV1) {
    console.warn('[SyncPackaged] POS v1 DB not connected, skipping');
    return 0;
  }

  // A V1 store "has a package" when packageLevel is set and not empty/none
  const stores = await posV1
    .collection('stores')
    .find({
      isDeleted: { $ne: true },
      packageLevel: { $exists: true, $nin: [null, '', 'none'] },
    })
    .project({
      _id: 1,
      name: 1,
      name_en: 1,
      nameForSearch: 1,
      image: 1,
      lat: 1,
      lng: 1,
      province: 1,
      district: 1,
      village: 1,
      address: 1,
      location: 1,
      phone: 1,
      whatsapp: 1,
      isActive: 1,
      isOpen: 1,
      // The consumer listener admits a V1 store only when hasPOS === true and
      // soft-deactivates it otherwise, so leaving this out hides paying stores.
      hasPOS: 1,
      hasReservation: 1,
      isDelivery: 1,
      isHeinekenPartner: 1,
      reviewStar: 1,
      reviewStarCount: 1,
      startDate: 1,
      endDate: 1,
      period: 1,
      packageLevel: 1,
      packageId: 1,
      packagePrice: 1,
      paymentStatus: 1,
      openTime: 1,
      closeTime: 1,
      openDay: 1,
    })
    .toArray();

  let count = 0;
  for (const store of stores) {
    try {
      await publishRestaurantUpdated(store._id.toString(), 'v1', store);
      count++;
      await sleep(BATCH_DELAY_MS);
    } catch (err) {
      console.error(`[SyncPackaged] Failed to publish v1 store ${store._id}:`, err.message);
    }
  }

  return count;
}

/**
 * Sync all V2 restaurants that have a package
 */
async function syncV2PackagedRestaurants() {
  const { posV2 } = getAllDatabases();
  if (!posV2) {
    console.warn('[SyncPackaged] POS v2 DB not connected, skipping');
    return 0;
  }

  // A V2 restaurant "has a package" when packageInfo.level is set and not empty
  const restaurants = await posV2
    .collection('restaurants')
    .find({
      isDeleted: { $ne: true },
      'packageInfo.level': { $exists: true, $nin: [null, ''] },
    })
    .project({
      _id: 1,
      name: 1,
      logo: 1,
      coverImage: 1,
      address: 1,
      contactInfo: 1,
      isActive: 1,
      isOpen: 1,
      isDev: 1,
      packageInfo: 1,
      tags: 1,
      enhancedBusinessHours: 1,
      operatingHours: 1,
    })
    .toArray();

  await attachV2Branches(posV2, restaurants);

  let count = 0;
  for (const restaurant of restaurants) {
    try {
      await publishRestaurantUpdated(restaurant._id.toString(), 'v2', restaurant);
      count++;
      await sleep(BATCH_DELAY_MS);
    } catch (err) {
      console.error(`[SyncPackaged] Failed to publish v2 restaurant ${restaurant._id}:`, err.message);
    }
  }

  return count;
}

/**
 * Set `doc.branches` on each v2 restaurant doc before publishing, so the Consumer
 * API can map per-branch hours / location. One $in query for all restaurants.
 */
async function attachV2Branches(posV2, restaurants) {
  if (!restaurants.length) return restaurants;
  const branches = await posV2
    .collection('branches')
    .find({
      restaurantId: { $in: restaurants.map((r) => r._id) },
      isDeleted: { $ne: true },
    })
    .project({ _id: 1, restaurantId: 1, name: 1, isActive: 1, address: 1, 'settings.openingHours': 1 })
    .toArray();

  const byRestaurant = new Map();
  branches.forEach(({ restaurantId, ...branch }) => {
    const key = String(restaurantId);
    if (!byRestaurant.has(key)) byRestaurant.set(key, []);
    byRestaurant.get(key).push(branch);
  });
  restaurants.forEach((r) => {
    r.branches = byRestaurant.get(String(r._id)) || [];
  });
  return restaurants;
}

/**
 * Main entry point — sync all packaged restaurants from both POS systems
 * Returns { v1, v2, total } counts
 */
async function syncAllPackagedRestaurants() {
  console.log('[SyncPackaged] Starting sync of all packaged restaurants...');
  const start = Date.now();

  const [v1, v2] = await Promise.all([
    syncV1PackagedRestaurants(),
    syncV2PackagedRestaurants(),
  ]);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[SyncPackaged] Done — v1: ${v1}, v2: ${v2}, total: ${v1 + v2} (${elapsed}s)`);

  return { v1, v2, total: v1 + v2 };
}

module.exports = { syncAllPackagedRestaurants, attachV2Branches };
