/**
 * Subscription Management Controller
 *
 * Handles subscription tracking, expiry monitoring, and unified restaurant views
 * across both POS v1 and v2 databases.
 */

const crypto = require("crypto");
const { ObjectId } = require("mongodb");
const {
  getUnifiedRestaurants,
  getRestaurantById,
  updateRestaurantSubscription,
  getTrialUsageStats,
  getTrialOrderCounts,
  computeRestaurantActivity,
  getPosV1Db,
  getPosV2Db,
} = require("../utils/multiDbConnection");

/**
 * Optional shared secret for the activity feed. When ACTIVITY_API_KEY is set,
 * callers must send it as `x-activity-key`; when unset the endpoint is open
 * like the rest of this API. Timing-safe compare (same pattern as ADS_ADMIN_KEY).
 */
function activityKeyAccepted(req) {
  const expected = process.env.ACTIVITY_API_KEY || "";
  if (!expected) return true;
  const provided = String(req.headers["x-activity-key"] || "");
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}
const { publishRestaurantUpdated } = require("../utils/redisPublisher");
const { syncAllPackagedRestaurants, attachV2Branches } = require("../utils/syncPackagedRestaurants");
const { getCachedStats, setCachedStats, invalidateCache } = require("../utils/statsCache");

/**
 * Store-info completeness rules. Kept identical to the POS v1 / v2 apps:
 * hours need valid "HH:mm" times, location must fall inside Laos.
 */
const HHMM = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/; // "24:00" = closes at midnight
const V2_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function toCoord(lat, lng) {
  if (lat == null || lng == null || lat === "" || lng === "") return null;
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  return { lat: la, lng: lo };
}

function insideLaos(c) {
  return !!c && c.lat >= 13.9 && c.lat <= 22.6 && c.lng >= 100 && c.lng <= 107.7;
}

function v1HoursComplete(s) {
  return HHMM.test(s.openTime || "") && HHMM.test(s.closeTime || "") &&
    Array.isArray(s.openDay) && s.openDay.length > 0;
}

// location.{lat,lon} -> top-level lat/lng -> address.{lat,lng}; first pair INSIDE Laos wins
// (a 0,0 or junk pair falls through), same rule as the consumer sync's parseV1Coordinates.
function v1Coord(s) {
  return [
    toCoord(s.location?.lat, s.location?.lon),
    toCoord(s.lat, s.lng),
    toCoord(s.address?.lat, s.address?.lng),
  ].find(insideLaos) || null;
}

// ≥1 day with an entry isOpen!==false and valid open/close. Same shape on
// restaurants.enhancedBusinessHours and branches.settings.openingHours.
function v2DaysComplete(h) {
  h = h || {};
  return V2_DAYS.some((d) => Array.isArray(h[d]) && h[d].some((e) =>
    e && e.isOpen !== false && HHMM.test(e.open || "") && HHMM.test(e.close || "")));
}

// POS v2 seeds every new restaurant/branch with 09:00-21:00 on all 7 days.
// Untouched seed hours are not real data, so they count as missing until
// someone confirms them (storeInfoFill.hours, written by every hours save).
function isV2SeedHours(h) {
  return V2_DAYS.every((d) => Array.isArray(h?.[d]) && h[d].length === 1 &&
    h[d][0]?.isOpen !== false && h[d][0]?.open === "09:00" && h[d][0]?.close === "21:00");
}

function v2HoursConfirmed(h, doc) {
  return v2DaysComplete(h) && !(isV2SeedHours(h) && !doc?.storeInfoFill?.hours);
}

function v2Coord(r) {
  return toCoord(r.address?.coordinates?.latitude, r.address?.coordinates?.longitude);
}

// First shift per day, for prefilling the team editor.
function v2HoursSlim(h) {
  const out = {};
  V2_DAYS.forEach((d) => {
    const e = Array.isArray(h?.[d]) ? h[d][0] : null;
    out[d] = e ? { open: e.open || "", close: e.close || "", isOpen: e.isOpen !== false } : null;
  });
  return out;
}

/**
 * v1 openDay / serviceDays, copied from appzap-owner-web/src/helpers/storeProfile.js
 * so a team fill reads exactly like an owner fill. Monday is stored as "Mun".
 */
const V1_STORE_DAYS = [
  { value: "Mun", serviceLabel: "ວັນຈັນ" },
  { value: "Tue", serviceLabel: "ວັນອັງຄານ" },
  { value: "Wed", serviceLabel: "ວັນພຸດ" },
  { value: "Thu", serviceLabel: "ວັນພະຫັດ" },
  { value: "Fri", serviceLabel: "ວັນສຸກ" },
  { value: "Sat", serviceLabel: "ວັນເສົາ" },
  { value: "Sun", serviceLabel: "ວັນອາທິດ" },
];
const V1_OPEN_DAY_SAVE_ORDER = ["Sun", "Mun", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HHMM_OPEN = /^([01]\d|2[0-3]):[0-5]\d$/; // open time: no "24:00"

const formatServiceTime = (hhmm) => hhmm.replace(/^0(\d)/, "$1");

const formatServiceDayList = (openDay) => {
  const indexes = V1_STORE_DAYS.map((d, i) => (openDay.includes(d.value) ? i : -1)).filter((i) => i >= 0);
  const isRun = indexes.every((v, i) => i === 0 || v === indexes[i - 1] + 1);
  if (indexes.length >= 2 && isRun) {
    return `${V1_STORE_DAYS[indexes[0]].serviceLabel} - ${V1_STORE_DAYS[indexes[indexes.length - 1]].serviceLabel}`;
  }
  return indexes.map((i) => V1_STORE_DAYS[i].serviceLabel).join(", ");
};

const buildServiceDays = ({ openTime, closeTime, openDay }) =>
  `${formatServiceDayList(openDay)} ${formatServiceTime(openTime)} - ${formatServiceTime(closeTime)}`;

// -> { value } | { error }
function parseV1Hours(h) {
  if (!h || typeof h !== "object") return { error: "hours must be an object" };
  const { openTime, closeTime } = h;
  if (!HHMM_OPEN.test(openTime || "")) return { error: "openTime must be HH:mm" };
  if (!HHMM.test(closeTime || "")) return { error: "closeTime must be HH:mm or 24:00" };
  const days = Array.isArray(h.openDay) ? h.openDay.map((d) => (d === "Mon" ? "Mun" : d)) : [];
  const openDay = V1_OPEN_DAY_SAVE_ORDER.filter((d) => days.includes(d));
  if (!openDay.length) return { error: "openDay needs at least one day" };
  return { value: { openTime, closeTime, openDay, serviceDays: buildServiceDays({ openTime, closeTime, openDay }) } };
}

// { monday: {open, close, isOpen}, ... } -> { value: {monday: [shift], ...} } | { error }
// One "Regular" shift per day, the shape POS v2 creates. A missing day is closed.
function parseV2Hours(h) {
  if (!h || typeof h !== "object") return { error: "hours must be an object" };
  const value = {};
  let openDays = 0;
  for (const d of V2_DAYS) {
    const e = Array.isArray(h[d]) ? h[d][0] : h[d];
    const isOpen = !!e && e.isOpen !== false;
    if (isOpen) {
      if (!HHMM_OPEN.test(e.open || "") || !HHMM.test(e.close || "")) {
        return { error: `${d}: open must be HH:mm and close HH:mm or 24:00` };
      }
      openDays++;
    }
    value[d] = [{
      _id: new ObjectId(),
      shiftName: "Regular",
      open: e && HHMM_OPEN.test(e.open || "") ? e.open : "09:00",
      close: e && HHMM.test(e.close || "") ? e.close : "21:00",
      isOpen,
    }];
  }
  if (!openDays) return { error: "hours need at least one open day" };
  return { value };
}

/**
 * POS v2 activity per branch (same order filter as computeRestaurantActivity).
 * The tracker lists v2 per branch because location and hours live on the branch.
 */
async function computeV2BranchActivity(v2Db, windowDays) {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  return v2Db.collection("orders").aggregate(
    [
      {
        $match: {
          "timing.orderedAt": { $gte: since },
          orderStatus: { $nin: ["cancelled", "refunded"] },
          restaurantId: { $ne: null },
          branchId: { $ne: null },
        },
      },
      {
        $group: {
          _id: { restaurantId: "$restaurantId", branchId: "$branchId" },
          lastOrderAt: { $max: "$timing.orderedAt" },
          orderCount: { $sum: 1 },
        },
      },
    ],
    { allowDiskUse: true },
  ).toArray();
}

async function countActiveBranches(v2Db, restaurantIds) {
  const rows = await v2Db.collection("branches").aggregate([
    { $match: { restaurantId: { $in: restaurantIds }, isActive: { $ne: false } } },
    { $group: { _id: "$restaurantId", n: { $sum: 1 } } },
  ]).toArray();
  return new Map(rows.map((r) => [r._id.toString(), r.n]));
}

/**
 * Effective v2 branch values. Hours: branch openingHours if valid, else the
 * restaurant's enhancedBusinessHours. Location: branch coords if inside Laos,
 * else restaurant coords only when the restaurant has exactly one active branch.
 */
function effectiveBranchInfo(branch, restaurant, activeBranchCount) {
  const bHours = branch.settings?.openingHours;
  const rHours = restaurant?.enhancedBusinessHours;
  const hoursSource = v2HoursConfirmed(bHours, branch) ? "branch"
    : v2HoursConfirmed(rHours, restaurant) ? "restaurant" : null;

  let coord = null;
  let locationSource = null;
  const bCoord = v2Coord(branch);
  const rCoord = restaurant ? v2Coord(restaurant) : null;
  if (insideLaos(bCoord)) {
    coord = bCoord;
    locationSource = "branch";
  } else if (activeBranchCount === 1 && insideLaos(rCoord)) {
    coord = rCoord;
    locationSource = "restaurant";
  }
  return {
    hoursSource,
    locationSource,
    coord,
    hours: v2HoursSlim(hoursSource === "restaurant" ? rHours : bHours),
  };
}

const restaurantName = (r) => (typeof r?.name === "string" ? r.name : r?.name?.lo || r?.name?.en || "");

function toObjectIds(ids) {
  return ids.map((id) => { try { return new ObjectId(id); } catch { return null; } }).filter(Boolean);
}

const subscriptionController = {
  /**
   * Get unified list of all restaurants from both POS versions
   * with subscription status
   */
  getUnifiedRestaurants: async (req, res, db) => {
    try {
      const {
        search,
        province,
        district,
        posVersion,
        subscriptionStatus, // "expired" | "expiring_soon" | "expiring_3months" | "active" | "no_subscription" | "has_package"
        paymentStatus, // "paid" | "pending" | "overdue"
        expireMonth, // format "YYYY-MM"
        activityStatus, // "active" | "dormant" | "inactive"
        activeDays, // days of recency that count as active (default 7)
        devFilter, // "hide" (default) | "show" | "only" — staff test restaurants
        sortField = "createdAt",
        sortDirection = "desc",
        limit = 50,
        skip = 0,
      } = req.query;

      // console.log("[Subscription] getUnifiedRestaurants query:", req.query);

      const result = await getUnifiedRestaurants({
        search,
        province,
        district,
        posVersion,
        subscriptionStatus,
        paymentStatus,
        expireMonth,
        activityStatus,
        activeDays: activeDays ? parseInt(activeDays) : undefined,
        devFilter,
        sortField,
        sortDirection,
        limit: parseInt(limit),
        skip: parseInt(skip),
      });

      // console.log("[Subscription] getUnifiedRestaurants result:", result);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        summary: result.summary,
      });
    } catch (error) {
      console.error("[Subscription] Error getting unified restaurants:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Get trial usage stats: how many trial restaurants actually have completed orders
   */
  getTrialUsage: async (req, res, db) => {
    try {
      const result = await getTrialUsageStats();
      res.json({ success: true, data: result });
    } catch (error) {
      console.error("[Subscription] Error getting trial usage:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Get per-restaurant completed-order counts for trial restaurants
   * Returns a map: { [restaurantId]: { orderCount, lastOrderAt } }
   */
  getTrialOrderCounts: async (req, res, db) => {
    try {
      const result = await getTrialOrderCounts();
      res.json({ success: true, data: result });
    } catch (error) {
      console.error("[Subscription] Error getting trial order counts:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Per-restaurant real-order activity across POS v1 + v2 for the consumer-api
   * listing gate (RestaurantRegistry.activity). Slim rows only — no restaurant
   * data. 503 when either POS aggregation failed so the caller never writes a
   * half-empty activity set over its registry.
   *
   * GET /api/v1/subscription/activity?days=90  (header x-activity-key when set)
   */
  getRestaurantActivity: async (req, res) => {
    try {
      if (!activityKeyAccepted(req)) {
        return res.status(401).json({ success: false, error: "unauthorized" });
      }
      const { map, degraded, windowDays } = await computeRestaurantActivity(req.query.days);
      if (degraded) {
        return res.status(503).json({
          success: false,
          degraded: true,
          error: "activity data incomplete (one POS aggregation failed)",
        });
      }
      const data = [];
      for (const [key, v] of map) {
        const idx = key.indexOf(":");
        data.push({
          posVersion: key.slice(0, idx),
          posId: key.slice(idx + 1),
          lastOrderAt: v.lastOrderAt,
          orderCount: v.orderCount,
        });
      }
      res.json({
        success: true,
        windowDays,
        generatedAt: new Date().toISOString(),
        count: data.length,
        data,
      });
    } catch (error) {
      console.error("[Subscription] Error getting restaurant activity:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Active stores (real order in the window) still missing opening hours
   * and/or a map location, for the team to follow up. Read-only on POS DBs.
   * v1 = one row per store. v2 = one row per ACTIVE BRANCH (a branch with a
   * non-cancelled/refunded order in the window), judged on effective values
   * (see effectiveBranchInfo).
   * sharedLocation = same coords (4 decimals) as another active row;
   * a soft warning only (food courts / malls), never counted as missing.
   *
   * GET /api/v1/subscription/store-info-completeness?days=30
   */
  getStoreInfoCompleteness: async (req, res) => {
    try {
      const { map, degraded, windowDays } = await computeRestaurantActivity(req.query.days || 30);
      if (degraded) {
        return res.status(503).json({
          success: false,
          degraded: true,
          error: "activity data incomplete (one POS aggregation failed)",
        });
      }

      const cacheKey = `store_info_completeness_${windowDays}d`;
      const cached = getCachedStats(cacheKey);
      if (cached) return res.json(cached);

      const v1Ids = [];
      for (const key of map.keys()) {
        if (key.startsWith("v1:")) v1Ids.push(key.slice(3));
      }

      const rows = [];
      const v1Db = getPosV1Db();
      if (v1Db && v1Ids.length) {
        const stores = await v1Db.collection("stores")
          .find({ _id: { $in: toObjectIds(v1Ids) } })
          .project({ name: 1, phone: 1, whatsapp: 1, openTime: 1, closeTime: 1, openDay: 1, location: 1, lat: 1, lng: 1, address: 1 })
          .toArray();
        stores.forEach((s) => {
          const coord = v1Coord(s);
          const usage = map.get(`v1:${s._id.toString()}`);
          rows.push({
            posVersion: "v1",
            restaurantId: s._id.toString(),
            name: s.name || "",
            phone: s.phone || "",
            whatsapp: s.whatsapp || "",
            missingHours: !v1HoursComplete(s),
            missingLocation: !insideLaos(coord),
            coord,
            hours: {
              openTime: s.openTime || "",
              closeTime: s.closeTime || "",
              openDay: Array.isArray(s.openDay) ? s.openDay : [],
            },
            lastOrderAt: usage?.lastOrderAt || null,
            orderCount: usage?.orderCount || 0,
          });
        });
      }

      let v2Restaurants = 0;
      const v2Db = getPosV2Db();
      if (v2Db) {
        let activity;
        try {
          activity = await computeV2BranchActivity(v2Db, windowDays);
        } catch (error) {
          console.error("[StoreInfo] POS v2 branch activity failed:", error.message);
          return res.status(503).json({
            success: false,
            degraded: true,
            error: "activity data incomplete (POS v2 branch aggregation failed)",
          });
        }
        if (activity.length) {
          const restaurantIds = [...new Set(activity.map((a) => a._id.restaurantId.toString()))];
          const rIds = toObjectIds(restaurantIds);
          const [branches, restaurants, branchCounts] = await Promise.all([
            v2Db.collection("branches")
              .find({ _id: { $in: activity.map((a) => a._id.branchId) } })
              .project({ name: 1, restaurantId: 1, contactInfo: 1, address: 1, "settings.openingHours": 1, "storeInfoFill.hours": 1 })
              .toArray(),
            v2Db.collection("restaurants")
              .find({ _id: { $in: rIds } })
              .project({ name: 1, contactInfo: 1, enhancedBusinessHours: 1, address: 1, "storeInfoFill.hours": 1 })
              .toArray(),
            countActiveBranches(v2Db, rIds),
          ]);
          const branchById = new Map(branches.map((b) => [b._id.toString(), b]));
          const restaurantById = new Map(restaurants.map((r) => [r._id.toString(), r]));
          v2Restaurants = restaurantIds.length;

          activity.forEach((a) => {
            const restaurantId = a._id.restaurantId.toString();
            const branchId = a._id.branchId.toString();
            const branch = branchById.get(branchId);
            if (!branch) return; // order points at a deleted branch
            const restaurant = restaurantById.get(restaurantId);
            const activeBranchCount = branchCounts.get(restaurantId) || 0;
            const eff = effectiveBranchInfo(branch, restaurant, activeBranchCount);
            const name = restaurantName(restaurant);
            rows.push({
              posVersion: "v2",
              restaurantId,
              branchId,
              restaurantName: name,
              branchName: branch.name || "",
              name,
              activeBranchCount,
              phone: branch.contactInfo?.phone || restaurant?.contactInfo?.phone || "",
              whatsapp: restaurant?.contactInfo?.whatsapp || "",
              missingHours: !eff.hoursSource,
              missingLocation: !eff.locationSource,
              hoursSource: eff.hoursSource,
              locationSource: eff.locationSource,
              coord: eff.coord,
              hours: eff.hours,
              lastOrderAt: a.lastOrderAt || null,
              orderCount: a.orderCount || 0,
            });
          });
        }
      }

      // Shared location across all active rows (both POS versions)
      const coordKey = (c) => `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`;
      const coordCounts = new Map();
      rows.forEach((r) => {
        if (r.missingLocation) return;
        const k = coordKey(r.coord);
        coordCounts.set(k, (coordCounts.get(k) || 0) + 1);
      });

      // v1 counts stores; v2 counts branches (restaurants = distinct v2 restaurants)
      const summary = {};
      ["v1", "v2"].forEach((v) => {
        summary[v] = { active: 0, complete: 0, missingHours: 0, missingLocation: 0, missingBoth: 0, sharedLocation: 0, restaurants: 0 };
      });

      const data = rows.map((r) => {
        const row = {
          ...r,
          sharedLocation: !r.missingLocation && coordCounts.get(coordKey(r.coord)) > 1,
        };
        const s = summary[row.posVersion];
        s.active++;
        if (row.missingHours) s.missingHours++;
        if (row.missingLocation) s.missingLocation++;
        if (row.missingHours && row.missingLocation) s.missingBoth++;
        if (!row.missingHours && !row.missingLocation) s.complete++;
        if (row.sharedLocation) s.sharedLocation++;
        return row;
      });
      summary.v1.restaurants = summary.v1.active;
      summary.v2.restaurants = v2Restaurants;
      data.sort((a, b) => new Date(b.lastOrderAt || 0) - new Date(a.lastOrderAt || 0));

      const body = {
        success: true,
        windowDays,
        generatedAt: new Date().toISOString(),
        summary,
        data,
      };
      setCachedStats(cacheKey, body);
      res.json(body);
    } catch (error) {
      console.error("[Subscription] Error getting store info completeness:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * AppZap team fills opening hours and/or location on behalf of a store.
   * Documented exception to "POS DBs are read-only" (like updateRestaurantSubscription):
   * writes ONLY the hours/location fields below plus the storeInfoFill audit.
   *
   * PUT /api/v1/subscription/store-info/:posVersion/:id
   *   v1: id = storeId,  body { hours?: {openTime, closeTime, openDay[]}, location?: {lat, lng} }
   *       -> openTime, closeTime, openDay, serviceDays, location.{lat,lon}, lat/lng (strings)
   *   v2: id = branchId, body { hours?: {monday: {open, close, isOpen}, ...}, location?: {lat, lng},
   *                             alsoRestaurant?: boolean }
   *       -> branch settings.openingHours.*, address.coordinates.*; with alsoRestaurant
   *          (only when the restaurant has exactly one active branch) the same values
   *          also go to restaurant enhancedBusinessHours.* / address.coordinates.*
   * Audit on every written doc: storeInfoFill.{hours|location} = { by: "appzap_team", at }.
   */
  updateStoreInfo: async (req, res) => {
    try {
      const { posVersion, id } = req.params;
      const { hours, location, alsoRestaurant } = req.body || {};
      if (posVersion !== "v1" && posVersion !== "v2") {
        return res.status(400).json({ success: false, error: "posVersion must be v1 or v2" });
      }
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: "invalid id" });
      }
      if (hours == null && location == null) {
        return res.status(400).json({ success: false, error: "hours or location is required" });
      }

      let coord = null;
      if (location != null) {
        coord = toCoord(location.lat, location.lng);
        if (!insideLaos(coord)) {
          return res.status(400).json({ success: false, error: "location must be inside Laos" });
        }
      }

      const at = new Date();
      const audit = { by: "appzap_team", at };
      const _id = new ObjectId(id);

      if (posVersion === "v1") {
        const v1Db = getPosV1Db();
        if (!v1Db) return res.status(503).json({ success: false, error: "POS v1 DB unavailable" });
        const set = {};
        if (hours != null) {
          const parsed = parseV1Hours(hours);
          if (parsed.error) return res.status(400).json({ success: false, error: parsed.error });
          Object.assign(set, parsed.value);
          set["storeInfoFill.hours"] = audit;
        }
        if (coord) {
          set["location.lat"] = coord.lat;
          set["location.lon"] = coord.lng;
          set.lat = String(coord.lat);
          set.lng = String(coord.lng);
          set["storeInfoFill.location"] = audit;
        }
        set.updatedAt = at;

        const stores = v1Db.collection("stores");
        const result = await stores.updateOne({ _id }, { $set: set });
        if (result.matchedCount === 0) {
          return res.status(404).json({ success: false, error: "store not found" });
        }
        const fullDoc = await stores.findOne({ _id });
        if (fullDoc) publishRestaurantUpdated(id, "v1", fullDoc).catch(() => {});
        invalidateCache("store_info_completeness");

        const fullCoord = fullDoc ? v1Coord(fullDoc) : coord;
        return res.json({
          success: true,
          posVersion,
          restaurantId: id,
          missingHours: fullDoc ? !v1HoursComplete(fullDoc) : false,
          missingLocation: !insideLaos(fullCoord),
          coord: fullCoord,
          hours: fullDoc
            ? { openTime: fullDoc.openTime || "", closeTime: fullDoc.closeTime || "", openDay: fullDoc.openDay || [] }
            : null,
        });
      }

      // v2: id is a branch
      const v2Db = getPosV2Db();
      if (!v2Db) return res.status(503).json({ success: false, error: "POS v2 DB unavailable" });
      const branches = v2Db.collection("branches");
      const restaurants = v2Db.collection("restaurants");
      const branch = await branches.findOne({ _id }, { projection: { restaurantId: 1 } });
      if (!branch) return res.status(404).json({ success: false, error: "branch not found" });

      let parsedHours = null;
      if (hours != null) {
        const parsed = parseV2Hours(hours);
        if (parsed.error) return res.status(400).json({ success: false, error: parsed.error });
        parsedHours = parsed.value;
      }

      const restaurantId = branch.restaurantId;
      const activeBranchCount = restaurantId
        ? (await countActiveBranches(v2Db, [restaurantId])).get(restaurantId.toString()) || 0
        : 0;
      if (alsoRestaurant && activeBranchCount !== 1) {
        return res.status(400).json({
          success: false,
          error: "alsoRestaurant is only allowed when the restaurant has exactly one active branch",
        });
      }

      const branchSet = { updatedAt: at };
      const restaurantSet = { updatedAt: at };
      if (parsedHours) {
        V2_DAYS.forEach((d) => {
          branchSet[`settings.openingHours.${d}`] = parsedHours[d];
          restaurantSet[`enhancedBusinessHours.${d}`] = parsedHours[d];
        });
        branchSet["storeInfoFill.hours"] = audit;
        restaurantSet["storeInfoFill.hours"] = audit;
      }
      if (coord) {
        branchSet["address.coordinates.latitude"] = coord.lat;
        branchSet["address.coordinates.longitude"] = coord.lng;
        restaurantSet["address.coordinates.latitude"] = coord.lat;
        restaurantSet["address.coordinates.longitude"] = coord.lng;
        branchSet["storeInfoFill.location"] = audit;
        restaurantSet["storeInfoFill.location"] = audit;
      }

      await branches.updateOne({ _id }, { $set: branchSet });
      if (alsoRestaurant) {
        await restaurants.updateOne({ _id: restaurantId }, { $set: restaurantSet });
      }

      const [fullBranch, fullRestaurant] = await Promise.all([
        branches.findOne({ _id }),
        restaurantId ? restaurants.findOne({ _id: restaurantId }) : null,
      ]);
      // Same as the admin restaurant update: the registry gets the full restaurant doc,
      // plus its branches (same shape as the packaged sync) so branch edits land at once.
      if (fullRestaurant) {
        attachV2Branches(v2Db, [{ ...fullRestaurant }])
          .then(([doc]) => publishRestaurantUpdated(restaurantId.toString(), "v2", doc))
          .catch(() => {});
      }
      invalidateCache("store_info_completeness");

      const eff = effectiveBranchInfo(fullBranch, fullRestaurant, activeBranchCount);
      return res.json({
        success: true,
        posVersion,
        branchId: id,
        restaurantId: restaurantId ? restaurantId.toString() : null,
        alsoRestaurant: !!alsoRestaurant,
        missingHours: !eff.hoursSource,
        missingLocation: !eff.locationSource,
        hoursSource: eff.hoursSource,
        locationSource: eff.locationSource,
        coord: eff.coord,
        hours: eff.hours,
      });
    } catch (error) {
      console.error("[Subscription] Error updating store info:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Get subscription expiry statistics
   */
  getExpiryStats: async (req, res, db) => {
    try {
      const result = await getUnifiedRestaurants({ limit: 10000, skip: 0 });
      const now = new Date();

      const stats = {
        total: result.data.length,
        byStatus: {
          expired: [],
          expiringSoon: [], // < 30 days
          expiring1to3Months: [], // 30-90 days
          active: [], // > 90 days
          noSubscription: [],
        },
        byPosVersion: {
          v1: { total: 0, expired: 0, expiringSoon: 0 },
          v2: { total: 0, expired: 0, expiringSoon: 0 },
        },
        byMonth: {}, // Expiry by month
      };

      result.data.forEach((r) => {
        // Count by POS version
        if (r.posVersion === "v1") stats.byPosVersion.v1.total++;
        if (r.posVersion === "v2") stats.byPosVersion.v2.total++;

        if (!r.endDate) {
          stats.byStatus.noSubscription.push({
            id: r.restaurantId,
            posVersion: r.posVersion,
            name: r.name,
            phone: r.phone,
          });
          return;
        }

        const endDate = new Date(r.endDate);
        const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

        const restaurantInfo = {
          id: r.restaurantId,
          posVersion: r.posVersion,
          name: r.name,
          phone: r.phone,
          whatsapp: r.whatsapp,
          endDate: r.endDate,
          daysLeft,
        };

        // Categorize by status
        if (daysLeft < 0) {
          stats.byStatus.expired.push(restaurantInfo);
          if (r.posVersion === "v1") stats.byPosVersion.v1.expired++;
          if (r.posVersion === "v2") stats.byPosVersion.v2.expired++;
        } else if (daysLeft <= 30) {
          stats.byStatus.expiringSoon.push(restaurantInfo);
          if (r.posVersion === "v1") stats.byPosVersion.v1.expiringSoon++;
          if (r.posVersion === "v2") stats.byPosVersion.v2.expiringSoon++;
        } else if (daysLeft <= 90) {
          stats.byStatus.expiring1to3Months.push(restaurantInfo);
        } else {
          stats.byStatus.active.push(restaurantInfo);
        }

        // Group by expiry month
        const monthKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}`;
        if (!stats.byMonth[monthKey]) {
          stats.byMonth[monthKey] = [];
        }
        stats.byMonth[monthKey].push(restaurantInfo);
      });

      // Sort byMonth keys
      stats.byMonth = Object.keys(stats.byMonth)
        .sort()
        .reduce((obj, key) => {
          obj[key] = stats.byMonth[key];
          return obj;
        }, {});

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("[Subscription] Error getting expiry stats:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Get single restaurant details
   */
  getRestaurantDetail: async (req, res, db) => {
    try {
      const { restaurantId, posVersion } = req.params;

      const restaurant = await getRestaurantById(restaurantId, posVersion);

      if (!restaurant) {
        return res.status(404).json({
          success: false,
          error: "Restaurant not found",
        });
      }

      // Get invoices for this restaurant
      const invoices = await db
        .collection("invoices")
        .find({
          "restaurant.id": restaurantId,
          "restaurant.posVersion": posVersion,
        })
        .sort({ invoiceDate: -1 })
        .limit(10)
        .toArray();

      res.json({
        success: true,
        data: {
          restaurant,
          posVersion,
          invoices,
        },
      });
    } catch (error) {
      console.error("[Subscription] Error getting restaurant detail:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Update subscription dates for a restaurant
   * WARNING: This modifies the POS database
   */
  updateSubscription: async (req, res, db) => {
    try {
      const { restaurantId, posVersion } = req.params;
      const {
        name,
        startDate,
        endDate,
        period,
        phone,
        whatsapp,
        latitude,
        longitude,
        village,
        province,
        district,
        storeType,
        packageLevel,
        packageId,
        packagePrice,
        paymentStatus,
        isHeinekenPartner,
      } = req.body;

      // Validate
      if (!restaurantId || !posVersion) {
        return res.status(400).json({
          success: false,
          error: "restaurantId and posVersion are required",
        });
      }

      // Update the subscription
      const result = await updateRestaurantSubscription(
        restaurantId,
        posVersion,
        {
          name,
          startDate,
          endDate,
          period,
          phone,
          whatsapp,
          latitude,
          longitude,
          village,
          province,
          district,
          storeType,
          packageLevel,
          packageId,
          packagePrice,
          paymentStatus,
          isHeinekenPartner,
        },
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({
          success: false,
          error: "Restaurant not found or no changes made",
        });
      }

      res.json({
        success: true,
        message: "Subscription updated successfully",
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      console.error("[Subscription] Error updating subscription:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Bulk update subscriptions from Excel data
   */
  bulkUpdateFromExcel: async (req, res, db) => {
    try {
      const { restaurants } = req.body;
      // restaurants: [{ restaurantId, posVersion, startDate, endDate, period, matchBy }]

      if (!Array.isArray(restaurants) || restaurants.length === 0) {
        return res.status(400).json({
          success: false,
          error: "restaurants array is required",
        });
      }

      const results = {
        total: restaurants.length,
        updated: 0,
        failed: 0,
        errors: [],
      };

      for (const r of restaurants) {
        try {
          let restaurantId = r.restaurantId;
          let posVersion = r.posVersion;

          // If no ID provided, try to match by name/phone
          if (!restaurantId && (r.name || r.phone)) {
            const matched = await findRestaurantByNameOrPhone(
              r.name,
              r.phone,
              r.posVersion,
            );
            if (matched) {
              restaurantId = matched.restaurantId;
              posVersion = matched.posVersion;
            }
          }

          if (!restaurantId) {
            results.failed++;
            results.errors.push({
              input: r,
              error: "Could not match restaurant",
            });
            continue;
          }

          const updateResult = await updateRestaurantSubscription(
            restaurantId,
            posVersion,
            {
              startDate: r.startDate,
              endDate: r.endDate,
              period: r.period,
            },
          );

          if (updateResult.modifiedCount > 0) {
            results.updated++;
          } else {
            results.failed++;
            results.errors.push({
              input: r,
              error: "No changes made",
            });
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            input: r,
            error: error.message,
          });
        }
      }

      res.json({
        success: true,
        results,
      });
    } catch (error) {
      console.error("[Subscription] Error bulk updating:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
};

/**
 * Helper function to find restaurant by name or phone
 */
async function findRestaurantByNameOrPhone(name, phone, preferredVersion) {
  const posV1Db = getPosV1Db();
  const posV2Db = getPosV2Db();

  // Try POS v1
  if (posV1Db && (!preferredVersion || preferredVersion === "v1")) {
    const query = {};
    if (name && phone) {
      query.$or = [
        { name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } },
        { phone: phone },
      ];
    } else if (name) {
      query.name = { $regex: `^${escapeRegex(name)}$`, $options: "i" };
    } else if (phone) {
      query.phone = phone;
    }

    const found = await posV1Db.collection("stores").findOne(query);
    if (found) {
      return { restaurantId: found._id.toString(), posVersion: "v1" };
    }
  }

  // Try POS v2
  if (posV2Db && (!preferredVersion || preferredVersion === "v2")) {
    const query = {};
    if (name && phone) {
      query.$or = [
        { name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } },
        { "contactInfo.phone": phone },
      ];
    } else if (name) {
      query.name = { $regex: `^${escapeRegex(name)}$`, $options: "i" };
    } else if (phone) {
      query["contactInfo.phone"] = phone;
    }

    const found = await posV2Db.collection("restaurants").findOne(query);
    if (found) {
      return { restaurantId: found._id.toString(), posVersion: "v2" };
    }
  }

  return null;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Sync helpers ────────────────────────────────────────────────────────────

// Sync ALL packaged restaurants to Consumer API
subscriptionController.syncAllPackagedToConsumer = async (req, res) => {
  try {
    // Respond immediately so the HTTP request doesn't time out on large datasets
    res.json({ success: true, message: 'Sync started — check server logs for progress' });
    // Run in background after response
    syncAllPackagedRestaurants().catch((err) => {
      console.error('[syncAllPackagedToConsumer] Background sync failed:', err.message);
    });
  } catch (err) {
    console.error('[syncAllPackagedToConsumer] Error:', err.message);
    res.status(500).json({ success: false, message: 'Sync failed', error: err.message });
  }
};

// Attach syncRestaurantToConsumer to the controller object
// Sync a single restaurant to Consumer API by ID and POS version
subscriptionController.syncRestaurantToConsumer = async (req, res) => {
  const { restaurantId, posVersion } = req.params;

  try {
    const restaurant = await getRestaurantById(restaurantId, posVersion);

    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    await publishRestaurantUpdated(restaurantId, posVersion, restaurant);

    return res.json({
      success: true,
      message: `Restaurant synced to Consumer App`,
      data: { restaurantId, posVersion },
    });
  } catch (err) {
    console.error("[syncRestaurantToConsumer] Error:", err.message);
    return res.status(500).json({ success: false, message: "Sync failed", error: err.message });
  }
};

module.exports = subscriptionController;
