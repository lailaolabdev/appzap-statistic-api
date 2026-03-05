/**
 * Migration Analysis Script - IMPROVED VERSION
 * 
 * Reads existing menus and categories from the database,
 * finds potential master matches using multi-strategy similarity algorithms,
 * and creates mapping records with suggestions.
 * 
 * Key Improvements:
 * - Proper Lao/Thai Unicode handling
 * - Category-based filtering to prevent cross-category matches
 * - Multi-strategy matching (exact, keyword, token overlap, fuzzy)
 * - Stricter confidence thresholds
 * - Option to clear existing mappings
 * 
 * USAGE: npm run migration:analyze
 * 
 * Options:
 *   --menus-only      Only analyze menus
 *   --categories-only Only analyze categories
 *   --limit=N         Limit number of items to process (for testing)
 *   --store=ID        Only analyze specific store
 *   --clear           Clear existing mappings before analysis
 *   --verbose         Show detailed logging
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const {
    normalizeText,
    findBestMatches,
    detectCategory,
    calculateMultiStrategyScore
} = require('../utils/textSimilarity');

// Parse command line arguments
const args = process.argv.slice(2);
const menusOnly = args.includes('--menus-only');
const categoriesOnly = args.includes('--categories-only');
const clearExisting = args.includes('--clear');
const verbose = args.includes('--verbose');
const limitArg = args.find(a => a.startsWith('--limit='));
const storeArg = args.find(a => a.startsWith('--store='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const storeId = storeArg ? storeArg.split('=')[1] : null;

/**
 * IMPROVED confidence level thresholds
 * Much stricter than before to reduce false positives
 */
function getConfidenceLevel(score) {
    if (score >= 95) return 'high';      // Was 90 - now stricter
    if (score >= 75) return 'medium';    // Was 60 - now stricter
    if (score >= 50) return 'low';       // Was 0 - now has minimum
    return 'none';
}

/**
 * Log message if verbose mode is enabled
 */
function verboseLog(...args) {
    if (verbose) {
        console.log(...args);
    }
}

/**
 * Clear existing mapping collections
 */
async function clearMappings(db) {
    console.log('\n--- Clearing Existing Mappings ---');

    const menuResult = await db.collection('menuMappings').deleteMany({});
    console.log(`  Deleted ${menuResult.deletedCount} menu mappings`);

    const categoryResult = await db.collection('categoryMappings').deleteMany({});
    console.log(`  Deleted ${categoryResult.deletedCount} category mappings`);

    console.log('  Mappings cleared successfully\n');
}

/**
 * Analyze menus and generate mapping suggestions
 */
async function analyzeMenus(db, masterMenus, learnedDecisions) {
    console.log('\n========================================');
    console.log('Analyzing Menus (Improved Algorithm)');
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

    // Get existing mappings to avoid duplicates (only if not clearing)
    let existingMenuIds = new Set();
    if (!clearExisting) {
        const existingMappings = await db.collection('menuMappings')
            .find({}, { projection: { menuId: 1 } })
            .toArray();
        existingMenuIds = new Set(existingMappings.map(m => m.menuId.toString()));
        console.log(`Existing mappings: ${existingMenuIds.size}`);
    }

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
        learned: 0,
        byMatchType: {
            exact: 0,
            keyword_exact: 0,
            keyword_contains: 0,
            combined: 0,
            char_only: 0,
            none: 0
        },
        byCategory: {}
    };

    // Process menus in batches
    const batchSize = 100;
    const mappingsToInsert = [];

    for (let i = 0; i < menus.length; i++) {
        const menu = menus[i];

        // Skip if already has mapping (and not clearing)
        if (!clearExisting && existingMenuIds.has(menu._id.toString())) {
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

        // Detect category of menu item
        const detectedCategory = detectCategory(menuName);

        // Track category stats
        if (!stats.byCategory[detectedCategory.category]) {
            stats.byCategory[detectedCategory.category] = 0;
        }
        stats.byCategory[detectedCategory.category]++;

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
                detectedCategory: detectedCategory.category,
                detectedCategoryConfidence: detectedCategory.confidence,
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
            stats.byMatchType.exact++;

        } else if (learnedDecision && learnedDecision.decisionType === 'not-applicable') {
            // Learned that this should not be mapped
            mapping = {
                menuId: menu._id,
                storeId: menu.storeId || menu.store_id,
                menuName,
                menuName_en,
                normalizedName,
                originalPrice: menu.price || 0,
                detectedCategory: detectedCategory.category,
                detectedCategoryConfidence: detectedCategory.confidence,
                masterMenuCode: null,
                masterMenuName: '',
                masterMenuName_en: '',
                mappingStatus: 'not-applicable',
                confidenceScore: 0,
                confidenceLevel: 'none',
                suggestedMappings: [],
                mappingMethod: 'learned',
                notes: 'Marked as not-applicable based on previous decision',
                isActive: true,
                isApplied: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            stats.learned++;
            stats.noMatch++;
            stats.byMatchType.none++;

        } else {
            // Find best matches using improved multi-strategy algorithm
            const matches = findBestMatches(menuName, masterMenus, 0.5, 5);

            // Also try English name if available
            if (menuName_en) {
                const enMatches = findBestMatches(menuName_en, masterMenus, 0.5, 5);
                // Merge and dedupe, keeping higher scores
                for (const match of enMatches) {
                    const existing = matches.find(m => m.candidate.code === match.candidate.code);
                    if (!existing) {
                        matches.push(match);
                    } else if (match.score > existing.score) {
                        // Replace with better score
                        Object.assign(existing, match);
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
                matchType: match.matchType,
                matchDetails: match.details
            }));

            const topMatch = suggestedMappings.length > 0 ? suggestedMappings[0] : null;
            const topScore = topMatch ? topMatch.confidenceScore : 0;
            const confidenceLevel = getConfidenceLevel(topScore);

            mapping = {
                menuId: menu._id,
                storeId: menu.storeId || menu.store_id,
                menuName,
                menuName_en,
                normalizedName,
                originalPrice: menu.price || 0,
                detectedCategory: detectedCategory.category,
                detectedCategoryConfidence: Math.round(detectedCategory.confidence),
                masterMenuCode: topMatch ? topMatch.masterMenuCode : null,
                masterMenuName: topMatch ? topMatch.masterMenuName : '',
                masterMenuName_en: topMatch ? topMatch.masterMenuName_en : '',
                mappingStatus: topMatch ? 'suggested' : 'pending',
                confidenceScore: topScore,
                confidenceLevel,
                suggestedMappings,
                mappingMethod: 'auto_suggested',
                matchType: topMatch ? topMatch.matchType : 'none',
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

            // Track match type
            const matchType = topMatch ? topMatch.matchType : 'none';
            if (stats.byMatchType[matchType] !== undefined) {
                stats.byMatchType[matchType]++;
            } else {
                stats.byMatchType[matchType] = 1;
            }

            // Verbose logging for debugging
            verboseLog(`  [${i + 1}] "${menuName}" -> ${topMatch ? topMatch.masterMenuCode : 'NO MATCH'} (${topScore}% ${topMatch?.matchType || 'none'})`);
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
    console.log(`\nBy Confidence Level:`);
    console.log(`  - High (>=95%): ${stats.highConfidence}`);
    console.log(`  - Medium (75-94%): ${stats.mediumConfidence}`);
    console.log(`  - Low (50-74%): ${stats.lowConfidence}`);
    console.log(`  - No match (<50%): ${stats.noMatch}`);
    console.log(`  - From learned decisions: ${stats.learned}`);
    console.log(`\nBy Match Type:`);
    for (const [type, count] of Object.entries(stats.byMatchType)) {
        if (count > 0) {
            console.log(`  - ${type}: ${count}`);
        }
    }
    console.log(`\nBy Detected Category:`);
    for (const [category, count] of Object.entries(stats.byCategory)) {
        console.log(`  - ${category}: ${count}`);
    }
    console.log(`\nDuration: ${(duration / 1000).toFixed(2)}s`);

    return stats;
}

/**
 * Analyze categories and generate mapping suggestions
 */
async function analyzeCategories(db, masterCategories, learnedDecisions) {
    console.log('\n========================================');
    console.log('Analyzing Categories (Improved Algorithm)');
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

    // Get existing mappings to avoid duplicates (only if not clearing)
    let existingCategoryIds = new Set();
    if (!clearExisting) {
        const existingMappings = await db.collection('categoryMappings')
            .find({}, { projection: { categoryId: 1 } })
            .toArray();
        existingCategoryIds = new Set(existingMappings.map(m => m.categoryId.toString()));
        console.log(`Existing mappings: ${existingCategoryIds.size}`);
    }

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
        learned: 0,
        byMatchType: {}
    };

    // Process categories in batches
    const batchSize = 100;
    const mappingsToInsert = [];

    for (let i = 0; i < categories.length; i++) {
        const category = categories[i];

        // Skip if already has mapping (and not clearing)
        if (!clearExisting && existingCategoryIds.has(category._id.toString())) {
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
            // Find best matches using improved multi-strategy algorithm
            const matches = findBestMatches(categoryName, masterCategories, 0.5, 5);

            // Also try English name if available
            if (categoryName_en) {
                const enMatches = findBestMatches(categoryName_en, masterCategories, 0.5, 5);
                // Merge and dedupe
                for (const match of enMatches) {
                    const existing = matches.find(m => m.candidate.code === match.candidate.code);
                    if (!existing) {
                        matches.push(match);
                    } else if (match.score > existing.score) {
                        Object.assign(existing, match);
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
                matchType: match.matchType,
                matchDetails: match.details
            }));

            const topMatch = suggestedMappings.length > 0 ? suggestedMappings[0] : null;
            const topScore = topMatch ? topMatch.confidenceScore : 0;
            const confidenceLevel = getConfidenceLevel(topScore);

            mapping = {
                categoryId: category._id,
                storeId: category.storeId || category.store_id,
                categoryName,
                categoryName_en,
                normalizedName,
                masterCategoryCode: topMatch ? topMatch.masterCategoryCode : null,
                masterCategoryName: topMatch ? topMatch.masterCategoryName : '',
                masterCategoryName_en: topMatch ? topMatch.masterCategoryName_en : '',
                mappingStatus: topMatch ? 'suggested' : 'pending',
                confidenceScore: topScore,
                confidenceLevel,
                suggestedMappings,
                mappingMethod: 'auto_suggested',
                matchType: topMatch ? topMatch.matchType : 'none',
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

            // Track match type
            const matchType = topMatch ? topMatch.matchType : 'none';
            if (stats.byMatchType[matchType] !== undefined) {
                stats.byMatchType[matchType]++;
            } else {
                stats.byMatchType[matchType] = 1;
            }

            verboseLog(`  [${i + 1}] "${categoryName}" -> ${topMatch ? topMatch.masterCategoryCode : 'NO MATCH'} (${topScore}%)`);
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
    console.log(`\nBy Confidence Level:`);
    console.log(`  - High (>=95%): ${stats.highConfidence}`);
    console.log(`  - Medium (75-94%): ${stats.mediumConfidence}`);
    console.log(`  - Low (50-74%): ${stats.lowConfidence}`);
    console.log(`  - No match (<50%): ${stats.noMatch}`);
    console.log(`  - From learned decisions: ${stats.learned}`);
    console.log(`\nBy Match Type:`);
    for (const [type, count] of Object.entries(stats.byMatchType)) {
        if (count > 0) {
            console.log(`  - ${type}: ${count}`);
        }
    }
    console.log(`\nDuration: ${(duration / 1000).toFixed(2)}s`);

    return stats;
}

/**
 * Main analysis function
 */
async function runAnalysis() {
    let client;

    try {
        console.log('========================================');
        console.log('Migration Analysis (IMPROVED ALGORITHM)');
        console.log('========================================\n');

        console.log('Options:');
        if (storeId) console.log(`  Store: ${storeId}`);
        if (limit) console.log(`  Limit: ${limit} items`);
        if (clearExisting) console.log(`  Clear existing: YES`);
        if (verbose) console.log(`  Verbose: YES`);
        console.log('');

        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        client = await MongoClient.connect(process.env.MONGODB_URI_POS_V2);
        const db = client.db('AppZap');
        console.log('Connected successfully!');

        // Clear existing mappings if requested
        if (clearExisting) {
            await clearMappings(db);
        }

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
            const highMedium = menuStats.highConfidence + menuStats.mediumConfidence;
            const reviewPct = menuStats.created > 0 ? Math.round((highMedium / menuStats.created) * 100) : 0;
            console.log(`\nMenus:`);
            console.log(`  Created: ${menuStats.created} mappings`);
            console.log(`  Ready for quick review: ${highMedium} (${reviewPct}%)`);
            console.log(`  Needs manual review: ${menuStats.lowConfidence + menuStats.noMatch}`);
        }

        if (categoryStats) {
            const highMedium = categoryStats.highConfidence + categoryStats.mediumConfidence;
            const reviewPct = categoryStats.created > 0 ? Math.round((highMedium / categoryStats.created) * 100) : 0;
            console.log(`\nCategories:`);
            console.log(`  Created: ${categoryStats.created} mappings`);
            console.log(`  Ready for quick review: ${highMedium} (${reviewPct}%)`);
            console.log(`  Needs manual review: ${categoryStats.lowConfidence + categoryStats.noMatch}`);
        }

        console.log('\n========================================');
        console.log('Next Steps:');
        console.log('========================================');
        console.log('1. Review HIGH confidence mappings first (quick batch approve)');
        console.log('2. Review MEDIUM confidence mappings (verify and approve)');
        console.log('3. Review LOW/NO MATCH items:');
        console.log('   - Create new master items if needed');
        console.log('   - Mark as "not-applicable" for store-specific items');
        console.log('4. Approved decisions are learned for future use');
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
