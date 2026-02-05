/**
 * Analysis Worker
 * 
 * Background worker for processing menu analysis jobs.
 * Uses cursor-based iteration for memory efficiency and reports progress via Bull.
 */

const { ObjectId } = require('mongodb');

/**
 * Initialize the analysis worker
 * @param {Queue} queue - The Bull queue instance
 * @param {Db} db - MongoDB database instance
 */
function initializeAnalysisWorker(queue, db) {
    console.log('[AnalysisWorker] Initializing worker with extended timeout (40 min)...');

    // Process with concurrency = 1 to prevent multiple jobs running simultaneously
    // Timeout is configured in queue settings (40 minutes)
    queue.process('analyze-menus', 1, async (job) => {
        const startTime = Date.now();
        const { startDate, endDate, storeId, minOrderCount = 1 } = job.data;

        console.log(`[AnalysisWorker] Processing job ${job.id}:`, {
            startDate, endDate, storeId, minOrderCount
        });

        try {
            // Step 1: Count total unique menus to process
            const end = endDate ? new Date(endDate) : new Date();
            const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

            const matchStage = {
                createdAt: { $gte: start, $lte: end },
                menuId: { $exists: true, $ne: null }
            };

            if (storeId) {
                matchStage.storeId = new ObjectId(storeId);
            }

            // Get total count first
            const countResult = await db.collection('orders').aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: { menuId: '$menuId', storeId: '$storeId' }
                    }
                },
                { $count: 'total' }
            ], { allowDiskUse: true }).toArray();

            const totalMenus = countResult[0]?.total || 0;

            // Report initial progress
            job.progress({
                percent: 0,
                phase: 'counting',
                message: `Found ${totalMenus} unique menus to analyze`,
                totalMenus,
                processed: 0,
                created: 0,
                updated: 0,
                skipped: 0,
                startTime: startTime
            });

            if (totalMenus === 0) {
                return {
                    success: true,
                    totalMenusProcessed: 0,
                    created: 0,
                    updated: 0,
                    skipped: 0,
                    duration: Date.now() - startTime
                };
            }

            // Step 2: Load master menus for matching (once)
            const masterMenus = await db.collection('masterMenus')
                .find({ isDeleted: false, isActive: true })
                .toArray();

            job.progress({
                percent: 5,
                phase: 'loading',
                message: `Loaded ${masterMenus.length} master menus for matching`,
                totalMenus,
                processed: 0,
                created: 0,
                updated: 0,
                skipped: 0,
                startTime
            });

            // Step 3: Process in batches using cursor
            const BATCH_SIZE = 500;
            let processed = 0;
            let created = 0;
            let updated = 0;
            let skipped = 0;
            let variantMatched = 0;
            let textMatched = 0;

            // Import utilities
            const { findBestMatches } = require('../utils/textSimilarity');
            const { analyzeMenuName, findBestVariantMatch } = require('../utils/sizeVariantDetection');

            // Use cursor for memory-efficient processing
            const cursor = db.collection('orders').aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: { menuId: '$menuId', storeId: '$storeId' },
                        menuName: { $first: '$name' },
                        orderCount: { $sum: 1 }
                    }
                },
                { $match: { orderCount: { $gte: parseInt(minOrderCount) } } },
                { $sort: { orderCount: -1 } }
            ], { allowDiskUse: true });

            let batch = [];
            const now = new Date();

            // Process cursor in batches
            while (await cursor.hasNext()) {
                const menu = await cursor.next();
                batch.push(menu);

                if (batch.length >= BATCH_SIZE) {
                    const result = await processBatch(
                        db, batch, masterMenus, now,
                        findBestMatches, analyzeMenuName, findBestVariantMatch
                    );

                    created += result.created;
                    updated += result.updated;
                    skipped += result.skipped;
                    variantMatched += result.variantMatched;
                    textMatched += result.textMatched;
                    processed += batch.length;

                    const percent = Math.min(95, Math.round((processed / totalMenus) * 90) + 5);
                    const elapsed = Date.now() - startTime;
                    const rate = processed / (elapsed / 1000);
                    const remaining = Math.round((totalMenus - processed) / rate);

                    job.progress({
                        percent,
                        phase: 'processing',
                        message: `Processing batch ${Math.ceil(processed / BATCH_SIZE)}...`,
                        totalMenus,
                        processed,
                        created,
                        updated,
                        skipped,
                        variantMatched,
                        textMatched,
                        rate: Math.round(rate),
                        estimatedRemainingSeconds: remaining,
                        startTime
                    });

                    batch = [];
                }
            }

            // Process remaining items
            if (batch.length > 0) {
                const result = await processBatch(
                    db, batch, masterMenus, now,
                    findBestMatches, analyzeMenuName, findBestVariantMatch
                );

                created += result.created;
                updated += result.updated;
                skipped += result.skipped;
                variantMatched += result.variantMatched;
                textMatched += result.textMatched;
                processed += batch.length;
            }

            await cursor.close();

            const duration = Date.now() - startTime;

            // Final progress
            job.progress({
                percent: 100,
                phase: 'completed',
                message: 'Analysis complete',
                totalMenus,
                processed,
                created,
                updated,
                skipped,
                variantMatched,
                textMatched,
                duration,
                startTime
            });

            console.log(`[AnalysisWorker] Job ${job.id} completed:`, {
                processed, created, updated, skipped, duration
            });

            // Invalidate stats cache so fresh data shows immediately
            try {
                const { invalidateCache } = require('../utils/statsCache');
                invalidateCache('stats_');
                console.log('[AnalysisWorker] Stats cache invalidated');
            } catch (cacheError) {
                console.warn('[AnalysisWorker] Failed to invalidate cache:', cacheError);
            }

            return {
                success: true,
                totalMenusProcessed: processed,
                created,
                updated,
                skipped,
                matchStats: {
                    variantMatched,
                    textMatched,
                    noMatch: processed - variantMatched - textMatched - skipped
                },
                duration
            };

        } catch (error) {
            console.error(`[AnalysisWorker] Job ${job.id} failed:`, error);
            throw error;
        }
    });

    console.log('[AnalysisWorker] Worker initialized');
}

/**
 * Process a batch of menus
 */
async function processBatch(db, batch, masterMenus, now, findBestMatches, analyzeMenuName, findBestVariantMatch) {
    // Pre-load existing mappings for this batch
    const menuKeys = batch.map(m => ({
        menuId: m._id.menuId,
        storeId: m._id.storeId
    }));

    const existingMappings = await db.collection('menuMappings')
        .find({ $or: menuKeys })
        .toArray();

    const existingMap = new Map();
    for (const m of existingMappings) {
        const key = `${String(m.menuId)}_${String(m.storeId)}`;
        existingMap.set(key, m);
    }

    let created = 0, updated = 0, skipped = 0;
    let variantMatched = 0, textMatched = 0;
    const bulkOps = [];

    for (const menu of batch) {
        const key = `${String(menu._id.menuId)}_${String(menu._id.storeId)}`;
        const existing = existingMap.get(key);

        // Skip approved mappings
        if (existing && existing.mappingStatus === 'approved') {
            skipped++;
            continue;
        }

        // Skip high confidence suggested mappings
        if (existing && existing.mappingStatus === 'suggested' && existing.confidenceScore >= 85) {
            skipped++;
            continue;
        }

        // Normalize name
        const normalizedName = (menu.menuName || '')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ');

        let mappingData = {
            menuId: menu._id.menuId,
            storeId: menu._id.storeId,
            menuName: menu.menuName,
            normalizedName,
            orderCount: menu.orderCount,
            mappingStatus: 'suggested',
            updatedAt: now
        };

        // Try variant-aware matching first
        const variantAnalysis = analyzeMenuName(menu.menuName);

        if (variantAnalysis.isKnownProduct && variantAnalysis.product) {
            const productMenus = masterMenus.filter(m =>
                m.baseProduct === variantAnalysis.product.productId
            );

            if (productMenus.length > 0) {
                const variantMatch = findBestVariantMatch(menu.menuName, productMenus);

                if (variantMatch && variantMatch.match) {
                    variantMatched++;

                    const suggestions = productMenus.map(pm => ({
                        masterMenuCode: pm.code,
                        masterMenuName: pm.name,
                        masterMenuName_en: pm.name_en,
                        confidenceScore: pm.code === variantMatch.match.code ? variantMatch.confidence : 50,
                        matchType: pm.code === variantMatch.match.code ? 'variant_match' : 'same_product'
                    })).sort((a, b) => b.confidenceScore - a.confidenceScore);

                    mappingData.confidenceScore = variantMatch.confidence;
                    mappingData.suggestedMappings = suggestions.slice(0, 5);
                    mappingData.matchMethod = 'variant_detection';
                    mappingData.detectedProduct = variantAnalysis.product.productId;
                    mappingData.detectedVariant = variantAnalysis.finalVariant?.variantId;

                    if (variantMatch.confidence >= 60) {
                        mappingData.masterMenuCode = variantMatch.match.code;
                        mappingData.masterMenuName = variantMatch.match.name;
                        mappingData.masterMenuName_en = variantMatch.match.name_en;
                    }
                }
            }
        }

        // Fallback to text similarity
        if (!mappingData.masterMenuCode) {
            const matches = findBestMatches(normalizedName, masterMenus, 0.3, 5);
            const topMatch = matches[0];

            if (!mappingData.suggestedMappings || mappingData.suggestedMappings.length === 0) {
                textMatched++;
                mappingData.confidenceScore = topMatch ? Math.round(topMatch.score * 100) : 0;
                mappingData.suggestedMappings = matches.map(m => ({
                    masterMenuCode: m.candidate.code,
                    masterMenuName: m.candidate.name,
                    masterMenuName_en: m.candidate.name_en,
                    confidenceScore: Math.round(m.score * 100),
                    matchType: m.matchType
                }));
                mappingData.matchMethod = 'text_similarity';
            }

            if (topMatch && topMatch.score >= 0.6 && !mappingData.masterMenuCode) {
                mappingData.masterMenuCode = topMatch.candidate.code;
                mappingData.masterMenuName = topMatch.candidate.name;
                mappingData.masterMenuName_en = topMatch.candidate.name_en;
            }
        }

        // Auto-approve high confidence
        const AUTO_APPROVE_THRESHOLD = 95;
        if (mappingData.confidenceScore >= AUTO_APPROVE_THRESHOLD && mappingData.masterMenuCode) {
            mappingData.mappingStatus = 'approved';
            mappingData.autoApproved = true;
            mappingData.approvedAt = now;
        }

        // Use updateOne with upsert to avoid duplicate key issues
        // Filter by menuId + storeId (which should be unique)
        bulkOps.push({
            updateOne: {
                filter: {
                    menuId: menu._id.menuId,
                    storeId: menu._id.storeId
                },
                update: {
                    $set: mappingData,
                    $setOnInsert: { createdAt: now }
                },
                upsert: true
            }
        });

        if (existing) {
            updated++;
        } else {
            created++;
        }
    }

    // Execute bulk operations with error handling
    if (bulkOps.length > 0) {
        try {
            await db.collection('menuMappings').bulkWrite(bulkOps, { ordered: false });
        } catch (error) {
            // Handle duplicate key errors gracefully - this can happen due to race conditions
            if (error.code === 11000) {
                console.log(`[AnalysisWorker] Duplicate key error in batch (handled): ${error.writeErrors?.length || 1} duplicates`);
                // The operation continues - bulkWrite with ordered:false processes all ops even if some fail
            } else {
                throw error;
            }
        }
    }

    return { created, updated, skipped, variantMatched, textMatched };
}

module.exports = {
    initializeAnalysisWorker
};
