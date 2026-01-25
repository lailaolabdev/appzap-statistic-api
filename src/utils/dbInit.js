/**
 * Database Initialization Utility
 * 
 * Sets up collections and indexes for the master data system.
 * Safe to run multiple times - won't duplicate indexes.
 * 
 * USAGE:
 * node src/utils/dbInit.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const models = require('../models');

async function initializeDatabase() {
    let client;
    
    try {
        console.log('Connecting to MongoDB...');
        client = await MongoClient.connect(process.env.MONGODB_URI);
        const db = client.db('AppZap');
        console.log('Connected successfully!\n');

        console.log('========================================');
        console.log('Initializing Master Data Collections');
        console.log('========================================\n');

        // Create collections and indexes for each model
        for (const model of models.allCollections) {
            const collectionName = model.collectionName;
            console.log(`\nProcessing: ${collectionName}`);
            
            // Check if collection exists
            const collections = await db.listCollections({ name: collectionName }).toArray();
            
            if (collections.length === 0) {
                // Create the collection
                await db.createCollection(collectionName);
                console.log(`  ✓ Created collection: ${collectionName}`);
            } else {
                console.log(`  - Collection exists: ${collectionName}`);
            }

            // Create indexes
            if (model.indexes && model.indexes.length > 0) {
                for (const indexSpec of model.indexes) {
                    try {
                        await db.collection(collectionName).createIndex(
                            indexSpec.key, 
                            { unique: indexSpec.unique || false }
                        );
                        const indexKeys = Object.keys(indexSpec.key).join(', ');
                        console.log(`  ✓ Index created: ${indexKeys}${indexSpec.unique ? ' (unique)' : ''}`);
                    } catch (error) {
                        if (error.code === 85) {
                            // Index already exists with different options
                            console.log(`  - Index already exists for: ${Object.keys(indexSpec.key).join(', ')}`);
                        } else {
                            throw error;
                        }
                    }
                }
            }
        }

        // Summary
        console.log('\n========================================');
        console.log('Database Initialization Complete!');
        console.log('========================================');
        console.log('\nCollections created/verified:');
        for (const model of models.allCollections) {
            const count = await db.collection(model.collectionName).countDocuments();
            console.log(`  - ${model.collectionName}: ${count} documents`);
        }

        console.log('\n✓ All collections and indexes are ready.');
        console.log('\nNext steps:');
        console.log('1. Run seed data: node src/seeds/masterDataSeeds.js');
        console.log('2. Start the server: npm start');
        console.log('3. Access API at: http://localhost:3000/api/v1/master\n');

    } catch (error) {
        console.error('Database initialization error:', error);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
            console.log('Database connection closed.');
        }
    }
}

// Run if executed directly
if (require.main === module) {
    initializeDatabase()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = { initializeDatabase };
