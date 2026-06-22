/**
 * Backfill V1 Stores → Consumer DB `restaurants`
 *
 * One-shot script that mirrors every active V1 store from the POS V1
 * `stores` collection into the consumer DB `restaurants` collection,
 * using the V2 schema shape (via mapV1ToV2RestaurantShape).
 *
 * Idempotent: re-running updates existing mirror docs and only inserts
 * new ones for stores that don't yet have a consumer-side doc.
 *
 * Usage:
 *   npm run backfill:v1-consumer
 */

require("dotenv").config();
const {
  connectAllDatabases,
  getPosV1Db,
  getConsumerDb,
  closeAllConnections,
} = require("../src/utils/multiDbConnection");
const { mapV1ToV2RestaurantShape } = require("../src/utils/v1ToV2Mapper");

const PROGRESS_EVERY = 50;

async function run() {
  await connectAllDatabases();

  const posV1 = getPosV1Db();
  const consumer = getConsumerDb();

  if (!posV1) {
    console.error("✗ POS V1 DB not connected — check MONGODB_URI_POS_V1");
    process.exit(1);
  }
  if (!consumer) {
    console.error(
      "✗ Consumer DB not connected — check MONGODB_URI_CONSUMER and CONSUMER_DB_NAME",
    );
    process.exit(1);
  }

  const cursor = posV1
    .collection("stores")
    .find({ isDeleted: { $ne: true } });

  const total = await posV1
    .collection("stores")
    .countDocuments({ isDeleted: { $ne: true } });

  console.log(`Found ${total} V1 stores. Starting mirror upsert...`);

  let processed = 0;
  let inserted = 0;
  let modified = 0;
  let unchanged = 0;
  let errors = 0;

  for await (const store of cursor) {
    try {
      const mirror = mapV1ToV2RestaurantShape(store);
      const result = await consumer.collection("restaurants").updateOne(
        { _id: store._id },
        { $set: mirror, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );

      if (result.upsertedCount > 0) inserted += 1;
      else if (result.modifiedCount > 0) modified += 1;
      else unchanged += 1;
    } catch (err) {
      errors += 1;
      console.error(
        `  ! Failed for store ${store._id} (${store.name || "unnamed"}): ${err.message}`,
      );
    }

    processed += 1;
    if (processed % PROGRESS_EVERY === 0) {
      console.log(
        `  …${processed}/${total} processed (inserted=${inserted}, modified=${modified}, unchanged=${unchanged}, errors=${errors})`,
      );
    }
  }

  console.log("\nBackfill complete:");
  console.log(`  Total V1 stores:     ${total}`);
  console.log(`  Processed:           ${processed}`);
  console.log(`  Inserted (new doc):  ${inserted}`);
  console.log(`  Modified (updated):  ${modified}`);
  console.log(`  Unchanged:           ${unchanged}`);
  console.log(`  Errors:              ${errors}`);

  await closeAllConnections();
  process.exit(errors > 0 ? 1 : 0);
}

run().catch(async (err) => {
  console.error("Fatal error:", err);
  try {
    await closeAllConnections();
  } catch (_) {}
  process.exit(1);
});
