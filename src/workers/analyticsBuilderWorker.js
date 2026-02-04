/**
 * Analytics Builder Worker
 * 
 * Background worker that processes analytics building jobs.
 * Builds the orderAnalytics materialized view with progress tracking.
 * 
 * Features:
 * - Real-time progress updates (%)
 * - Batch processing for memory efficiency
 * - Safe: Original orders never modified
 * - Can be cancelled/retried
 */

const { getAnalyticsBuilderQueue } = require('../utils/jobQueue');

/**
 * Process an analytics builder job
 * @param {Object} job - Bull job object
 * @param {Db} db - MongoDB database instance
 */
async function processAnalyticsBuilderJob(job, db) {
    const { startDate, endDate, storeId, rebuild } = job.data;
    
    console.log(`[AnalyticsWorker] Job ${job.id} started`);
    console.log(`[AnalyticsWorker] Date range: ${startDate} to ${endDate}`);
    
    try {
        const orders = db.collection('orders');
        const menuMappings = db.collection('menuMappings');
        const masterMenus = db.collection('masterMenus');
        const orderAnalytics = db.collection('orderAnalytics');

        // Parse dates
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        // Step 1: Clear existing data (5% progress)
        await job.progress({
            progress: 5,
            stage: 'clearing',
            message: 'Clearing old analytics data...'
        });

        if (rebuild) {
            const deleteResult = await orderAnalytics.deleteMany({
                createdAt: { $gte: start, $lte: end }
            });
            console.log(`[AnalyticsWorker] Cleared ${deleteResult.deletedCount} old records`);
        }

        // Step 2: Build aggregation pipeline (10% progress)
        await job.progress({
            progress: 10,
            stage: 'aggregating',
            message: 'Building aggregation pipeline...'
        });

        const pipeline = [
            // Match orders in date range
            {
                $match: {
                    createdAt: { $gte: start, $lte: end },
                    ...(storeId && { storeId: storeId })
                }
            },
            
            // Lookup mapping
            {
                $lookup: {
                    from: 'menuMappings',
                    let: { menuId: '$menuId', storeId: '$storeId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$menuId', '$$menuId'] },
                                        { $eq: ['$storeId', '$$storeId'] },
                                        { $eq: ['$mappingStatus', 'approved'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'mapping'
                }
            },
            
            { $unwind: { path: '$mapping', preserveNullAndEmptyArrays: true } },
            
            // Lookup master menu
            {
                $lookup: {
                    from: 'masterMenus',
                    let: { masterCode: '$mapping.masterMenuCode' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$code', '$$masterCode'] } } }
                    ],
                    as: 'masterMenu'
                }
            },
            
            { $unwind: { path: '$masterMenu', preserveNullAndEmptyArrays: true } },
            
            // Lookup store
            {
                $lookup: {
                    from: 'stores',
                    let: { storeId: '$storeId' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$_id', { $toObjectId: '$$storeId' }] } } }
                    ],
                    as: 'store'
                }
            },
            
            { $unwind: { path: '$store', preserveNullAndEmptyArrays: true } },
            
            // Project final document
            {
                $project: {
                    orderId: '$_id',
                    originalMenuName: '$name',
                    menuId: 1,
                    storeId: 1,
                    storeName: '$store.name',
                    storeCode: '$store.code',
                    price: 1,
                    quantity: 1,
                    revenue: { $multiply: ['$price', '$quantity'] },
                    billId: 1,
                    createdAt: 1,
                    status: 1,
                    masterMenuCode: '$masterMenu.code',
                    masterMenuName: '$masterMenu.name',
                    masterMenuName_en: '$masterMenu.name_en',
                    masterCategoryCode: '$masterMenu.masterCategoryCode',
                    baseProduct: '$masterMenu.baseProduct',
                    sizeVariant: '$masterMenu.sizeVariant',
                    sizeCategory: '$masterMenu.sizeCategory',
                    productCategory: '$masterMenu.productCategory',
                    mappingId: '$mapping._id',
                    mappingConfidence: '$mapping.confidenceScore',
                    isMapped: { 
                        $cond: [{ $ne: ['$masterMenu.code', null] }, true, false]
                    },
                    analyticsBuiltAt: new Date()
                }
            }
        ];

        // Step 3: Execute aggregation (15% progress)
        await job.progress({
            progress: 15,
            stage: 'executing',
            message: 'Executing aggregation query...'
        });

        const results = await orders.aggregate(pipeline, {
            allowDiskUse: true
        }).toArray();

        const totalOrders = results.length;
        console.log(`[AnalyticsWorker] Found ${totalOrders} orders to process`);

        if (totalOrders === 0) {
            await job.progress({
                progress: 100,
                stage: 'completed',
                message: 'No orders found in date range'
            });
            
            return {
                totalOrders: 0,
                inserted: 0,
                dateRange: { start, end }
            };
        }

        // Step 4: Insert in batches with progress tracking (15% -> 90%)
        const batchSize = 1000;
        let inserted = 0;
        
        for (let i = 0; i < results.length; i += batchSize) {
            const batch = results.slice(i, i + batchSize);
            await orderAnalytics.insertMany(batch, { ordered: false });
            inserted += batch.length;
            
            // Calculate progress (15% start, 90% end)
            const progressPercent = 15 + Math.floor((inserted / totalOrders) * 75);
            
            await job.progress({
                progress: progressPercent,
                stage: 'inserting',
                message: `Processed ${inserted.toLocaleString()} / ${totalOrders.toLocaleString()} orders`,
                inserted,
                total: totalOrders
            });
            
            console.log(`[AnalyticsWorker] Progress: ${inserted}/${totalOrders} (${progressPercent}%)`);
        }

        // Step 5: Create indexes (95% progress)
        await job.progress({
            progress: 95,
            stage: 'indexing',
            message: 'Creating indexes for fast queries...'
        });

        await Promise.all([
            orderAnalytics.createIndex({ masterMenuCode: 1 }),
            orderAnalytics.createIndex({ baseProduct: 1 }),
            orderAnalytics.createIndex({ masterCategoryCode: 1 }),
            orderAnalytics.createIndex({ storeId: 1 }),
            orderAnalytics.createIndex({ createdAt: -1 }),
            orderAnalytics.createIndex({ isMapped: 1 }),
            orderAnalytics.createIndex({ masterMenuCode: 1, createdAt: -1 })
        ]);

        // Step 6: Calculate stats (98% progress)
        await job.progress({
            progress: 98,
            stage: 'calculating',
            message: 'Calculating summary statistics...'
        });

        const stats = await orderAnalytics.aggregate([
            {
                $facet: {
                    total: [{ $count: 'count' }],
                    mapped: [{ $match: { isMapped: true } }, { $count: 'count' }],
                    unmapped: [{ $match: { isMapped: false } }, { $count: 'count' }],
                    revenue: [
                        { $match: { isMapped: true } },
                        { $group: { _id: null, total: { $sum: '$revenue' } } }
                    ],
                    quantity: [
                        { $match: { isMapped: true } },
                        { $group: { _id: null, total: { $sum: '$quantity' } } }
                    ],
                    uniqueMenus: [
                        { $match: { isMapped: true } },
                        { $group: { _id: '$masterMenuCode' } },
                        { $count: 'count' }
                    ]
                }
            }
        ]).toArray();

        const summary = {
            totalOrders: stats[0].total[0]?.count || 0,
            mappedOrders: stats[0].mapped[0]?.count || 0,
            unmappedOrders: stats[0].unmapped[0]?.count || 0,
            totalRevenue: stats[0].revenue[0]?.total || 0,
            totalQuantity: stats[0].quantity[0]?.total || 0,
            uniqueMasterMenus: stats[0].uniqueMenus[0]?.count || 0
        };

        // Step 7: Complete (100% progress)
        await job.progress({
            progress: 100,
            stage: 'completed',
            message: 'Analytics built successfully!',
            summary
        });

        console.log(`[AnalyticsWorker] Job ${job.id} completed successfully`);
        console.log(`[AnalyticsWorker] Summary:`, summary);

        return {
            totalOrders: inserted,
            summary,
            dateRange: { start, end }
        };

    } catch (error) {
        console.error(`[AnalyticsWorker] Job ${job.id} failed:`, error);
        throw error;
    }
}

/**
 * Initialize the worker
 * @param {Db} db - MongoDB database instance
 */
function initializeAnalyticsBuilderWorker(db) {
    console.log('[AnalyticsWorker] Initializing worker...');
    
    const queue = getAnalyticsBuilderQueue();
    
    // Process jobs named 'build-analytics' with concurrency of 1
    queue.process('build-analytics', 1, async (job) => {
        return await processAnalyticsBuilderJob(job, db);
    });
    
    console.log('[AnalyticsWorker] Worker initialized and ready');
}

module.exports = {
    initializeAnalyticsBuilderWorker,
    processAnalyticsBuilderJob
};
