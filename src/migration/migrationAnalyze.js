/**
 * Migration Analysis Script
 * 
 * Reads existing menus and categories from the database,
 * finds potential master matches using similarity algorithms,
 * and creates mapping records with suggestions.
 * 
 * This is a READ-ONLY operation on existing data.
 * It only WRITES to the mapping collections.
 * 
 * USAGE: npm run migration:analyze
 * 
 * Options:
 *   --menus-only     Only analyze menus
 *   --categories-only Only analyze categories
 *   --limit=N        Limit number of items to process (for testing)
 *   --store=ID       Only analyze specific store
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const { normalizeText, findBestMatches } = require('../utils/textSimilarity');

// Parse command line arguments
const args = process.argv.slice(2);
const menusOnly = args.includes('--menus-only');
const categoriesOnly = args.includes('--categories-only');
const limitArg = args.find(a => a.startsWith('--limit='));
const storeArg = args.find(a => a.startsWith('--store='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const storeId = storeArg ? storeArg.split('=')[1] : null;

/**
 * Get confidence level from score
 */
function getConfidenceLevel(score) {
    if (score >= 90) return 'high';
    if (score >= 60) return 'medium';
    if (score > 0) return 'low';
    return 'none';
}

/**
 * Analyze menus and generate mapping suggestions
 */
async function analyzeMenus(db, masterMenus, learnedDecisions) {
    console.log('\n========================================');
    console.log('Analyzing Menus');
    console.log('========================================\n');
    
    const startTime = Date.now();
    
    // Build query
    const query = {};
    if (storeId) {
        query.storeId = new ObjectId(storeId);
    }
    
    // Get total count
    const totalMenus = await db.collection('menus').countDocuments(query);
    console.log(`Total menus to analyze: ${totalMenus}`);
    
    if (limit) {
        console.log(`Limiting to: ${limit} menus`);
    }
    
    // Get existing mappings to avoid duplicates
    const existingMappings = await db.collection('menuMappings')
        .find({}, { projection: { menuId: 1 } })
        .toArray();
    const existingMenuIds = new Set(existingMappings.map(m => m.menuId.toString()));
    console.log(`Existing mappings: ${existingMenuIds.size}`);
    
    // Fetch menus
    let menusCursor = db.collection('menus').find(query);
    if (limit) {
        menusCursor = menusCursor.limit(limit);
    }
    
    const menus = await menusCursor.toArray();
    console.log(`Fetched ${menus.length} menus for analysis\n`);
    
    // Statistics
    const stats = {
        total: menus.length,
        skipped: 0,
        created: 0,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0,
        noMatch: 0,
        learned: 0
    };
    
    // Process menus in batches
    const batchSize = 100;
    const mappingsToInsert = [];
    
    for (let i = 0; i < menus.length; i++) {
        const menu = menus[i];
        
        // Skip if already has mapping
        if (existingMenuIds.has(menu._id.toString())) {
            stats.skipped++;
            continue;
        }
        
        // Get menu name (try various fields)
        const menuName = menu.name || menu.title || '';
        const menuName_en = menu.name_en || menu.title_en || '';
        const normalizedName = normalizeText(menuName);
        
        if (!normalizedName) {
            stats.skipped++;
            continue;
        }
        
        // Check if we have a learned decision for this name
        const learnedDecision = learnedDecisions.get(normalizedName);
        
        let mapping;
        
        if (learnedDecision && learnedDecision.decisionType === 'approved') {
            // Use learned decision
            mapping = {
                menuId: menu._id,
                storeId: menu.storeId || menu.store_id,
                menuName,
                menuName_en,
                normalizedName,
                originalPrice: menu.price || 0,
                masterMenuCode: learnedDecision.masterCode,
                masterMenuName: learnedDecision.masterName,
                masterMenuName_en: learnedDecision.masterName_en,
                mappingStatus: 'suggested',
                confidenceScore: 100,
                confidenceLevel: 'high',
                suggestedMappings: [{
                    masterMenuCode: learnedDecision.masterCode,
                    masterMenuName: learnedDecision.masterName,
                    masterMenuName_en: learnedDecision.masterName_en,
                    confidenceScore: 100,
                    matchType: 'learned'
                }],
                mappingMethod: 'learned',
                isActive: true,
                isApplied: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            stats.learned++;
            stats.highConfidence++;
        } else if (learnedDecision && learnedDecision.decisionType === 'not-applicable') {
            // Learned that this should not be mapped
            mapping = {
                menuId: menu._id,
                storeId: menu.storeId || menu.store_id,
                menuName,
                menuName_en,
                normalizedName,
                originalPrice: menu.price || 0,
                masterMenuCode: null,
                masterMenuName: '',
                masterMenuName_en: '',
                mappingStatus: 'not-applicable',
                confidenceScore: 0,
                confidenceLevel: 'none',
                suggestedMappings: [],
                mappingMethod: 'learned',
                isActive: true,
                isApplied: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            stats.learned++;
            stats.noMatch++;
        } else {
            // Find best matches using similarity algorithm
            const matches = findBestMatches(menuName, masterMenus, 0.3, 5);
            
            // Also try English name if available
            if (menuName_en) {
                const enMatches = findBestMatches(menuName_en, masterMenus, 0.3, 5);
                // Merge and dedupe
                for (const match of enMatches) {
                    if (!matches.find(m => m.candidate.code === match.candidate.code)) {
                        matches.push(match);
                    }
                }
                // Re-sort by score
                matches.sort((a, b) => b.score - a.score);
            }
            
            // Convert matches to suggested mappings
            const suggestedMappings = matches.slice(0, 5).map(match => ({
                masterMenuCode: match.candidate.code,
                masterMenuName: match.candidate.name,
                masterMenuName_en: match.candidate.name_en || '',
                confidenceScore: Math.round(match.score * 100),
                matchType: match.matchType
            }));
            
            const topScore = suggestedMappings.length > 0 ? suggestedMappings[0].confidenceScore : 0;
            const confidenceLevel = getConfidenceLevel(topScore);
            
            mapping = {
                menuId: menu._id,
                storeId: menu.storeId || menu.store_id,
                menuName,
                menuName_en,
                normalizedName,
                originalPrice: menu.price || 0,
                masterMenuCode: suggestedMappings.length > 0 ? suggestedMappings[0].masterMenuCode : null,
                masterMenuName: suggestedMappings.length > 0 ? suggestedMappings[0].masterMenuName : '',
                masterMenuName_en: suggestedMappings.length > 0 ? suggestedMappings[0].masterMenuName_en : '',
                mappingStatus: suggestedMappings.length > 0 ? 'suggested' : 'pending',
                confidenceScore: topScore,
                confidenceLevel,
                suggestedMappings,
                mappingMethod: 'auto_suggested',
                isActive: true,
                isApplied: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // Update stats
            switch (confidenceLevel) {
                case 'high': stats.highConfidence++; break;
                case 'medium': stats.mediumConfidence++; break;
                case 'low': stats.lowConfidence++; break;
                default: stats.noMatch++; break;
            }
        }
        
        mappingsToInsert.push(mapping);
        
        // Insert in batches
        if (mappingsToInsert.length >= batchSize) {
            await db.collection('menuMappings').insertMany(mappingsToInsert);
            stats.created += mappingsToInsert.length;
            console.log(`  Processed ${i + 1}/${menus.length} menus, created ${stats.created} mappings`);
            mappingsToInsert.length = 0;
        }
    }
    
    // Insert remaining
    if (mappingsToInsert.length > 0) {
        await db.collection('menuMappings').insertMany(mappingsToInsert);
        stats.created += mappingsToInsert.length;
    }
    
    const duration = Date.now() - startTime;
    
    // Update stats collection
    await db.collection('mappingStats').updateOne(
        { entityType: 'menu' },
        {
            $set: {
                totalItems: totalMenus,
                pendingCount: stats.noMatch,
                suggestedCount: stats.created - stats.noMatch,
                highConfidenceCount: stats.highConfidence,
                mediumConfidenceCount: stats.mediumConfidence,
                lowConfidenceCount: stats.lowConfidence,
                noMatchCount: stats.noMatch,
                lastAnalysisRun: new Date(),
                lastAnalysisDuration: duration,
                lastUpdated: new Date()
            }
        },
        { upsert: true }
    );
    
    console.log('\n--- Menu Analysis Complete ---');
    console.log(`Total processed: ${stats.total}`);
    console.log(`Skipped (existing): ${stats.skipped}`);
    console.log(`Mappings created: ${stats.created}`);
    console.log(`  - High confidence (>=90%): ${stats.highConfidence}`);
    console.log(`  - Medium confidence (60-89%): ${stats.mediumConfidence}`);
    console.log(`  - Low confidence (<60%): ${stats.lowConfidence}`);
    console.log(`  - No match: ${stats.noMatch}`);
    console.log(`  - From learned decisions: ${stats.learned}`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    
    return stats;
}

/**
 * Analyze categories and generate mapping suggestions
 */
async function analyzeCategories(db, masterCategories, learnedDecisions) {
    console.log('\n========================================');
    console.log('Analyzing Categories');
    console.log('========================================\n');
    
    const startTime = Date.now();
    
    // Build query
    const query = {};
    if (storeId) {
        query.storeId = new ObjectId(storeId);
    }
    
    // Get total count
    const totalCategories = await db.collection('categories').countDocuments(query);
    console.log(`Total categories to analyze: ${totalCategories}`);
    
    if (limit) {
        console.log(`Limiting to: ${limit} categories`);
    }
    
    // Get existing mappings to avoid duplicates
    const existingMappings = await db.collection('categoryMappings')
        .find({}, { projection: { categoryId: 1 } })
        .toArray();
    const existingCategoryIds = new Set(existingMappings.map(m => m.categoryId.toString()));
    console.log(`Existing mappings: ${existingCategoryIds.size}`);
    
    // Fetch categories
    let categoriesCursor = db.collection('categories').find(query);
    if (limit) {
        categoriesCursor = categoriesCursor.limit(limit);
    }
    
    const categories = await categoriesCursor.toArray();
    console.log(`Fetched ${categories.length} categories for analysis\n`);
    
    // Statistics
    const stats = {
        total: categories.length,
        skipped: 0,
        created: 0,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0,
        noMatch: 0,
        learned: 0
    };
    
    // Process categories in batches
    const batchSize = 100;
    const mappingsToInsert = [];
    
    for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        
        // Skip if already has mapping
        if (existingCategoryIds.has(category._id.toString())) {
            stats.skipped++;
            continue;
        }
        
        // Get category name (try various fields)
        const categoryName = category.name || category.title || '';
        const categoryName_en = category.name_en || category.title_en || '';
        const normalizedName = normalizeText(categoryName);
        
        if (!normalizedName) {
            stats.skipped++;
            continue;
        }
        
        // Check if we have a learned decision for this name
        const learnedDecision = learnedDecisions.get(normalizedName);
        
        let mapping;
        
        if (learnedDecision && learnedDecision.decisionType === 'approved') {
            // Use learned decision
            mapping = {
                categoryId: category._id,
                storeId: category.storeId || category.store_id,
                categoryName,
                categoryName_en,
                normalizedName,
                masterCategoryCode: learnedDecision.masterCode,
                masterCategoryName: learnedDecision.masterName,
                masterCategoryName_en: learnedDecision.masterName_en,
                mappingStatus: 'suggested',
                confidenceScore: 100,
                confidenceLevel: 'high',
                suggestedMappings: [{
                    masterCategoryCode: learnedDecision.masterCode,
                    masterCategoryName: learnedDecision.masterName,
                    masterCategoryName_en: learnedDecision.masterName_en,
                    confidenceScore: 100,
                    matchType: 'learned'
                }],
                mappingMethod: 'learned',
                isActive: true,
                isApplied: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            stats.learned++;
            stats.highConfidence++;
        } else if (learnedDecision && learnedDecision.decisionType === 'not-applicable') {
            // Learned that this should not be mapped
            mapping = {
                categoryId: category._id,
                storeId: category.storeId || category.store_id,
                categoryName,
                categoryName_en,
                normalizedName,
                masterCategoryCode: null,
                masterCategoryName: '',
                masterCategoryName_en: '',
                mappingStatus: 'not-applicable',
                confidenceScore: 0,
                confidenceLevel: 'none',
                suggestedMappings: [],
                mappingMethod: 'learned',
                isActive: true,
                isApplied: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            stats.learned++;
            stats.noMatch++;
        } else {
            // Find best matches using similarity algorithm
            const matches = findBestMatches(categoryName, masterCategories, 0.3, 5);
            
            // Also try English name if available
            if (categoryName_en) {
                const enMatches = findBestMatches(categoryName_en, masterCategories, 0.3, 5);
                // Merge and dedupe
                for (const match of enMatches) {
                    if (!matches.find(m => m.candidate.code === match.candidate.code)) {
                        matches.push(match);
                    }
                }
                // Re-sort by score
                matches.sort((a, b) => b.score - a.score);
            }
            
            // Convert matches to suggested mappings
            const suggestedMappings = matches.slice(0, 5).map(match => ({
                masterCategoryCode: match.candidate.code,
                masterCategoryName: match.candidate.name,
                masterCategoryName_en: match.candidate.name_en || '',
                confidenceScore: Math.round(match.score * 100),
                matchType: match.matchType
            }));
            
            const topScore = suggestedMappings.length > 0 ? suggestedMappings[0].confidenceScore : 0;
            const confidenceLevel = getConfidenceLevel(topScore);
            
            mapping = {
                categoryId: category._id,
                storeId: category.storeId || category.store_id,
                categoryName,
                categoryName_en,
                normalizedName,
                masterCategoryCode: suggestedMappings.length > 0 ? suggestedMappings[0].masterCategoryCode : null,
                masterCategoryName: suggestedMappings.length > 0 ? suggestedMappings[0].masterCategoryName : '',
                masterCategoryName_en: suggestedMappings.length > 0 ? suggestedMappings[0].masterCategoryName_en : '',
                mappingStatus: suggestedMappings.length > 0 ? 'suggested' : 'pending',
                confidenceScore: topScore,
                confidenceLevel,
                suggestedMappings,
                mappingMethod: 'auto_suggested',
                isActive: true,
                isApplied: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // Update stats
            switch (confidenceLevel) {
                case 'high': stats.highConfidence++; break;
                case 'medium': stats.mediumConfidence++; break;
                case 'low': stats.lowConfidence++; break;
                default: stats.noMatch++; break;
            }
        }
        
        mappingsToInsert.push(mapping);
        
        // Insert in batches
        if (mappingsToInsert.length >= batchSize) {
            await db.collection('categoryMappings').insertMany(mappingsToInsert);
            stats.created += mappingsToInsert.length;
            console.log(`  Processed ${i + 1}/${categories.length} categories, created ${stats.created} mappings`);
            mappingsToInsert.length = 0;
        }
    }
    
    // Insert remaining
    if (mappingsToInsert.length > 0) {
        await db.collection('categoryMappings').insertMany(mappingsToInsert);
        stats.created += mappingsToInsert.length;
    }
    
    const duration = Date.now() - startTime;
    
    // Update stats collection
    await db.collection('mappingStats').updateOne(
        { entityType: 'category' },
        {
            $set: {
                totalItems: totalCategories,
                pendingCount: stats.noMatch,
                suggestedCount: stats.created - stats.noMatch,
                highConfidenceCount: stats.highConfidence,
                mediumConfidenceCount: stats.mediumConfidence,
                lowConfidenceCount: stats.lowConfidence,
                noMatchCount: stats.noMatch,
                lastAnalysisRun: new Date(),
                lastAnalysisDuration: duration,
                lastUpdated: new Date()
            }
        },
        { upsert: true }
    );
    
    console.log('\n--- Category Analysis Complete ---');
    console.log(`Total processed: ${stats.total}`);
    console.log(`Skipped (existing): ${stats.skipped}`);
    console.log(`Mappings created: ${stats.created}`);
    console.log(`  - High confidence (>=90%): ${stats.highConfidence}`);
    console.log(`  - Medium confidence (60-89%): ${stats.mediumConfidence}`);
    console.log(`  - Low confidence (<60%): ${stats.lowConfidence}`);
    console.log(`  - No match: ${stats.noMatch}`);
    console.log(`  - From learned decisions: ${stats.learned}`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    
    return stats;
}

/**
 * Main analysis function
 */
async function runAnalysis() {
    let client;
    
    try {
        console.log('========================================');
        console.log('Migration Analysis');
        console.log('========================================\n');
        
        if (storeId) {
            console.log(`Analyzing store: ${storeId}`);
        }
        if (limit) {
            console.log(`Limit: ${limit} items`);
        }
        
        // Connect to MongoDB
        console.log('\nConnecting to MongoDB...');
        client = await MongoClient.connect(process.env.MONGODB_URI);
        const db = client.db('AppZap');
        console.log('Connected successfully!');
        
        // Load master data
        console.log('\nLoading master data...');
        const masterMenus = await db.collection('masterMenus')
            .find({ isActive: true, isDeleted: false })
            .toArray();
        const masterCategories = await db.collection('masterCategories')
            .find({ isActive: true, isDeleted: false })
            .toArray();
        
        console.log(`  Master menus: ${masterMenus.length}`);
        console.log(`  Master categories: ${masterCategories.length}`);
        
        // Load learned decisions
        console.log('\nLoading learned decisions...');
        const menuDecisions = await db.collection('mappingDecisions')
            .find({ entityType: 'menu', isActive: true })
            .toArray();
        const categoryDecisions = await db.collection('mappingDecisions')
            .find({ entityType: 'category', isActive: true })
            .toArray();
        
        const menuDecisionsMap = new Map();
        for (const d of menuDecisions) {
            menuDecisionsMap.set(d.normalizedName, d);
        }
        
        const categoryDecisionsMap = new Map();
        for (const d of categoryDecisions) {
            categoryDecisionsMap.set(d.normalizedName, d);
        }
        
        console.log(`  Menu decisions: ${menuDecisions.length}`);
        console.log(`  Category decisions: ${categoryDecisions.length}`);
        
        // Run analysis
        let menuStats = null;
        let categoryStats = null;
        
        if (!categoriesOnly) {
            menuStats = await analyzeMenus(db, masterMenus, menuDecisionsMap);
        }
        
        if (!menusOnly) {
            categoryStats = await analyzeCategories(db, masterCategories, categoryDecisionsMap);
        }
        
        // Final summary
        console.log('\n========================================');
        console.log('Analysis Complete');
        console.log('========================================');
        
        if (menuStats) {
            console.log(`\nMenus:`);
            console.log(`  Created: ${menuStats.created} mappings`);
            console.log(`  Ready for review: ${menuStats.highConfidence + menuStats.mediumConfidence}`);
        }
        
        if (categoryStats) {
            console.log(`\nCategories:`);
            console.log(`  Created: ${categoryStats.created} mappings`);
            console.log(`  Ready for review: ${categoryStats.highConfidence + categoryStats.mediumConfidence}`);
        }
        
        console.log('\nNext steps:');
        console.log('  1. Review high-confidence mappings first (quick wins)');
        console.log('  2. Review medium-confidence mappings');
        console.log('  3. Handle low-confidence and no-match items');
        console.log('\nUse the admin dashboard or API to approve/reject mappings.');
        console.log('========================================\n');
        
    } catch (error) {
        console.error('\nError during analysis:', error);
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
    runAnalysis()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = { runAnalysis, analyzeMenus, analyzeCategories };
