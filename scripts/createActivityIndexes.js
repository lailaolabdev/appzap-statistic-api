/**
 * Restaurant Activity Indexes Setup Script
 *
 * Creates the index that backs getRestaurantActivityMap() — the "which
 * restaurants actually took orders recently" sweep behind the Restaurant
 * Management activity filter.
 *
 * POS v1 `bills` ships with only the _id index, so the date-ranged $group
 * would be a full collection scan without this. POS v2 already has
 * {"timing.orderedAt": 1}, which is why nothing is created there.
 *
 * Usage: node scripts/createActivityIndexes.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function createActivityIndexes() {
    if (!process.env.MONGODB_URI_POS_V1) {
        console.error('MONGODB_URI_POS_V1 is not set — nothing to do.');
        process.exit(1);
    }

    const client = new MongoClient(process.env.MONGODB_URI_POS_V1, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    try {
        await client.connect();
        const dbName = process.env.POS_V1_DB_NAME || 'AppZap';
        const db = client.db(dbName);
        console.log(`Connected to POS v1 (${dbName})`);

        await db.collection('bills').createIndex(
            { createdAt: -1 },
            { name: 'bills_createdAt', background: true }
        );
        console.log('  ✅ Created: bills_createdAt');

        const indexes = await db.collection('bills').indexInformation();
        console.log('\n📑 bills indexes:');
        Object.entries(indexes).forEach(([name, keys]) => {
            console.log(`    - ${name}: ${JSON.stringify(keys)}`);
        });
    } catch (error) {
        console.error('Error creating indexes:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('\nDisconnected from MongoDB');
    }
}

createActivityIndexes();
