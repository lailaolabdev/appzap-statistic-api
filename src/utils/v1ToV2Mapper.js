/**
 * V1 → V2 Restaurant Shape Mapper
 *
 * Translates a V1 `stores` document into the V2 `restaurants` schema shape
 * so that V1 restaurants can be mirrored into the consumer DB `restaurants`
 * collection alongside V2 docs.
 *
 * Field-path conventions match the V2 update logic in `updateRestaurantSubscription`
 * (see multiDbConnection.js v2 branch) so consumer-api-v2 reads work consistently.
 */

const { ObjectId } = require("mongodb");

function setIfDefined(target, path, value) {
  if (value === undefined) return;
  target[path] = value;
}

function pickCoord(...candidates) {
  for (const c of candidates) {
    if (c === undefined || c === null || c === "") continue;
    const n = Number(c);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

/**
 * Build a flat $set object (with dotted paths) representing a V1 store
 * in V2 restaurants schema shape.
 *
 * @param {object} v1Doc - full V1 stores document (as returned by findOne)
 * @returns {object} flat $set object for upsert
 */
function mapV1ToV2RestaurantShape(v1Doc) {
  if (!v1Doc) return {};
  const set = {};

  setIfDefined(set, "name", v1Doc.name);

  // Contact
  setIfDefined(set, "contactInfo.phone", v1Doc.phone);
  setIfDefined(set, "contactInfo.whatsapp", v1Doc.whatsapp);

  // Coordinates (V1 may store on root or nested under `location`)
  const lat = pickCoord(v1Doc.lat, v1Doc.location && v1Doc.location.lat);
  const lng = pickCoord(v1Doc.lng, v1Doc.location && v1Doc.location.lon);
  if (lat !== undefined) set["address.coordinates.latitude"] = lat;
  if (lng !== undefined) set["address.coordinates.longitude"] = lng;

  // Address parts (V1 has both root and nested `address.*` — prefer nested when present)
  const village =
    (v1Doc.address && v1Doc.address.village) !== undefined
      ? v1Doc.address.village
      : v1Doc.village;
  const district =
    (v1Doc.address && v1Doc.address.district) !== undefined
      ? v1Doc.address.district
      : v1Doc.district;
  const province =
    (v1Doc.address && v1Doc.address.province) !== undefined
      ? v1Doc.address.province
      : v1Doc.province;
  setIfDefined(set, "address.street", village);
  setIfDefined(set, "address.city", district);
  setIfDefined(set, "address.state", province);

  // Store type (normalize to array shape used in V2)
  if (v1Doc.storeType !== undefined) {
    set.storeType = Array.isArray(v1Doc.storeType)
      ? v1Doc.storeType
      : typeof v1Doc.storeType === "string"
        ? v1Doc.storeType.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
  }

  // Package info
  setIfDefined(set, "packageInfo.level", v1Doc.packageLevel);
  if (v1Doc.packageId !== undefined) {
    set["packageInfo.packageId"] = v1Doc.packageId
      ? (v1Doc.packageId instanceof ObjectId
          ? v1Doc.packageId
          : new ObjectId(v1Doc.packageId))
      : null;
  }
  if (v1Doc.packagePrice !== undefined) {
    set["packageInfo.packagePrice"] = Number(v1Doc.packagePrice);
  }
  setIfDefined(set, "packageInfo.paymentStatus", v1Doc.paymentStatus);
  if (v1Doc.startDate !== undefined) {
    set["packageInfo.startDate"] = v1Doc.startDate
      ? new Date(v1Doc.startDate)
      : null;
  }
  if (v1Doc.endDate !== undefined) {
    set["packageInfo.endDate"] = v1Doc.endDate
      ? new Date(v1Doc.endDate)
      : null;
  }
  setIfDefined(set, "packageInfo.period", v1Doc.period);

  // Misc
  if (v1Doc.isHeinekenPartner !== undefined) {
    set.isHeinekenPartner = Boolean(v1Doc.isHeinekenPartner);
  }
  setIfDefined(set, "image", v1Doc.image);

  // Markers so consumers can distinguish mirrored V1 docs
  set.posVersion = "v1";
  set.isV1Mirror = true;
  set.updatedAt = new Date();

  return set;
}

module.exports = { mapV1ToV2RestaurantShape };
