/**
 * Database Indexes Setup Script
 * 
 * Run this script to create indexes for optimal query performance.
 * Usage: node scripts/createIndexes.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function createIndexes() {
    const client = new MongoClient(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    try {
        await client.connect();
        const db = client.db('AppZap');
        console.log('Connected to MongoDB');

        // ===== ORDERS COLLECTION =====
        console.log('\n📊 Creating indexes on orders collection...');

        // Index for date range queries (most important for stats)
        await db.collection('orders').createIndex(
            { createdAt: 1, menuId: 1, storeId: 1 },
            { name: 'orders_createdAt_menuId_storeId', background: true }
        );
        console.log('  ✅ Created: orders_createdAt_menuId_storeId');

        // Index for filtering by store
        await db.collection('orders').createIndex(
            { storeId: 1, createdAt: 1 },
            { name: 'orders_storeId_createdAt', background: true }
        );
        console.log('  ✅ Created: orders_storeId_createdAt');

        // ===== MENU MAPPINGS COLLECTION =====
        console.log('\n🗺️  Creating indexes on menuMappings collection...');

        // Compound index for lookups (used by $lookup in stats)
        await db.collection('menuMappings').createIndex(
            { menuId: 1, storeId: 1 },
            { name: 'menuMappings_menuId_storeId', unique: true, background: true }
        );
        console.log('  ✅ Created: menuMappings_menuId_storeId (unique)');

        // Index for status filtering
        await db.collection('menuMappings').createIndex(
            { mappingStatus: 1, confidenceScore: -1 },
            { name: 'menuMappings_status_confidence', background: true }
        );
        console.log('  ✅ Created: menuMappings_status_confidence');

        // Index for master menu code lookups
        await db.collection('menuMappings').createIndex(
            { masterMenuCode: 1 },
            { name: 'menuMappings_masterMenuCode', background: true }
        );
        console.log('  ✅ Created: menuMappings_masterMenuCode');

        // ===== MASTER MENUS COLLECTION =====
        console.log('\n📋 Creating indexes on masterMenus collection...');

        await db.collection('masterMenus').createIndex(
            { isDeleted: 1, isActive: 1 },
            { name: 'masterMenus_deleted_active', background: true }
        );
        console.log('  ✅ Created: masterMenus_deleted_active');

        await db.collection('masterMenus').createIndex(
            { code: 1 },
            { name: 'masterMenus_code', unique: true, background: true }
        );
        console.log('  ✅ Created: masterMenus_code (unique)');

        console.log('\n✨ All indexes created successfully!');

        // List all indexes
        console.log('\n📑 Current indexes:');
        for (const collection of ['orders', 'menuMappings', 'masterMenus']) {
            const indexes = await db.collection(collection).indexInformation();
            console.log(`\n  ${collection}:`);
            Object.entries(indexes).forEach(([name, keys]) => {
                console.log(`    - ${name}: ${JSON.stringify(keys)}`);
            });
        }

    } catch (error) {
        console.error('Error creating indexes:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('\nDisconnected from MongoDB');
    }
}

createIndexes();
