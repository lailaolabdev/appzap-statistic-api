/**
 * Migration Initialization Script
 * 
 * Creates mapping collections and their indexes.
 * Safe to run multiple times - only creates if not exists.
 * 
 * USAGE: npm run migration:init
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');
const {
    menuMapping,
    categoryMapping,
    mappingDecision,
    mappingStats
} = require('../models');

async function initMigrationCollections() {
    let client;
    
    try {
        console.log('========================================');
        console.log('Migration Initialization');
        console.log('========================================\n');
        
        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        client = await MongoClient.connect(process.env.MONGODB_URI);
        const db = client.db('AppZap');
        console.log('Connected successfully!\n');
        
        // Get list of existing collections
        const existingCollections = await db.listCollections().toArray();
        const existingNames = existingCollections.map(c => c.name);
        
        // Collections to create
        const collectionsToCreate = [
            { model: menuMapping, name: 'menuMappings' },
            { model: categoryMapping, name: 'categoryMappings' },
            { model: mappingDecision, name: 'mappingDecisions' },
            { model: mappingStats, name: 'mappingStats' }
        ];
        
        for (const { model, name } of collectionsToCreate) {
            console.log(`\n--- ${name} ---`);
            
            // Check if collection exists
            if (existingNames.includes(name)) {
                console.log(`  Collection already exists`);
            } else {
                await db.createCollection(name);
                console.log(`  Created collection`);
            }
            
            // Create indexes
            console.log('  Creating indexes...');
            for (const index of model.indexes) {
                try {
                    const options = { ...index };
                    const key = options.key;
                    delete options.key;
                    
                    await db.collection(name).createIndex(key, options);
                    console.log(`    ✓ Index: ${JSON.stringify(key)}`);
                } catch (indexError) {
                    if (indexError.code === 85 || indexError.code === 86) {
                        // Index already exists with different options - skip
                        console.log(`    - Index exists: ${JSON.stringify(index.key)}`);
                    } else {
                        throw indexError;
                    }
                }
            }
        }
        
        // Initialize stats documents
        console.log('\n--- Initializing Stats ---');
        
        const statsCollection = db.collection('mappingStats');
        
        for (const entityType of ['menu', 'category']) {
            const existing = await statsCollection.findOne({ entityType });
            if (!existing) {
                await statsCollection.insertOne({
                    entityType,
                    totalItems: 0,
                    totalUniqueNames: 0,
                    totalStores: 0,
                    pendingCount: 0,
                    suggestedCount: 0,
                    approvedCount: 0,
                    rejectedCount: 0,
                    notApplicableCount: 0,
                    highConfidenceCount: 0,
                    mediumConfidenceCount: 0,
                    lowConfidenceCount: 0,
                    noMatchCount: 0,
                    appliedCount: 0,
                    learnedDecisionsCount: 0,
                    mappingCoverage: 0,
                    lastAnalysisRun: null,
                    lastAnalysisDuration: 0,
                    lastUpdated: new Date()
                });
                console.log(`  Created stats document for: ${entityType}`);
            } else {
                console.log(`  Stats document exists for: ${entityType}`);
            }
        }
        
        // Summary
        console.log('\n========================================');
        console.log('Migration Initialization Complete');
        console.log('========================================');
        console.log('\nCollections ready:');
        console.log('  - menuMappings');
        console.log('  - categoryMappings');
        console.log('  - mappingDecisions');
        console.log('  - mappingStats');
        console.log('\nNext step: Run "npm run migration:analyze" to generate suggestions');
        console.log('========================================\n');
        
    } catch (error) {
        console.error('\nError during initialization:', error);
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
    initMigrationCollections()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = { initMigrationCollections };
