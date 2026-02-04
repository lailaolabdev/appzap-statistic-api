/**
 * Analytics Builder Controller
 * 
 * Builds a materialized view (orderAnalytics collection) for fast queries.
 * This approach:
 * 1. Keeps original orders collection IMMUTABLE (never modified)
 * 2. Creates derived orderAnalytics collection (can rebuild anytime)
 * 3. Pre-joins orders + menuMappings + masterMenus for fast queries
 * 4. Industry-standard pattern (Stripe, Google Analytics, Netflix)
 * 
 * IMPORTANT: Original data is NEVER modified!
 */

const { ObjectId } = require('mongodb');
const { getAnalyticsBuilderQueue, getJob, getJobStatus, addSSEClient, removeSSEClient } = require('../../utils/jobQueue');

const analyticsBuilderController = {
    /**
     * Consolidate duplicate Heineken master menus
     * Migrates old random-code menus to new standardized variants
     */
    consolidateHeinekenVariants: async (req, res, db) => {
        try {
            const masterMenus = db.collection('masterMenus');
            const menuMappings = db.collection('menuMappings');
            
            // Variant mapping logic
            const VARIANT_MAPPING = {
                'bottle_large': 'MENU-HEINEKEN-BOTTLE-LARGE',
                'ແກ້ວໃຫຍ່': 'MENU-HEINEKEN-BOTTLE-LARGE',
                'large bottle': 'MENU-HEINEKEN-BOTTLE-LARGE',
                'bottle_small': 'MENU-HEINEKEN-BOTTLE-SMALL',
                'ແກ້ວນ້ອຍ': 'MENU-HEINEKEN-BOTTLE-SMALL',
                'small bottle': 'MENU-HEINEKEN-BOTTLE-SMALL',
                'can_large': 'MENU-HEINEKEN-CAN-LARGE',
                'ປ໋ອງໃຫຍ່': 'MENU-HEINEKEN-CAN-LARGE',
                '640ml': 'MENU-HEINEKEN-CAN-LARGE',
                'large can': 'MENU-HEINEKEN-CAN-LARGE',
                'can_small': 'MENU-HEINEKEN-CAN-SMALL',
                'ປ໋ອງນ້ອຍ': 'MENU-HEINEKEN-CAN-SMALL',
                '330ml': 'MENU-HEINEKEN-CAN-SMALL',
                'small can': 'MENU-HEINEKEN-CAN-SMALL',
                'bucket': 'MENU-HEINEKEN-BUCKET',
                'ຖັງ': 'MENU-HEINEKEN-BUCKET',
                '12 ແກ້ວ': 'MENU-HEINEKEN-BUCKET',
                '12 bottles': 'MENU-HEINEKEN-BUCKET',
                'tower': 'MENU-HEINEKEN-TOWER',
                'ຫໍ': 'MENU-HEINEKEN-TOWER',
                '2.5l': 'MENU-HEINEKEN-TOWER',
                '2.5 l': 'MENU-HEINEKEN-TOWER'
            };
            
            // Find all Heineken menus
            const heinekenMenus = await masterMenus.find({
                $or: [
                    { baseProduct: 'heineken' },
                    { name: /heineken/i },
                    { name: /ໄຮເນເກັ້ນ/i },
                    { name_en: /heineken/i },
                    { code: /HEINEKEN/i }
                ]
            }).toArray();
            
            const standardCodes = [
                'MENU-HEINEKEN-BOTTLE-LARGE',
                'MENU-HEINEKEN-BOTTLE-SMALL',
                'MENU-HEINEKEN-CAN-LARGE',
                'MENU-HEINEKEN-CAN-SMALL',
                'MENU-HEINEKEN-BUCKET',
                'MENU-HEINEKEN-TOWER'
            ];
            
            const oldMenus = heinekenMenus.filter(m => !standardCodes.includes(m.code));
            
            const migrationMap = new Map();
            const skipped = [];
            
            // Create migration mapping
            for (const oldMenu of oldMenus) {
                let newCode = null;
                
                if (oldMenu.sizeVariant && VARIANT_MAPPING[oldMenu.sizeVariant]) {
                    newCode = VARIANT_MAPPING[oldMenu.sizeVariant];
                } else {
                    const combined = `${(oldMenu.name || '').toLowerCase()} ${(oldMenu.name_en || '').toLowerCase()}`;
                    for (const [key, value] of Object.entries(VARIANT_MAPPING)) {
                        if (combined.includes(key.toLowerCase())) {
                            newCode = value;
                            break;
                        }
                    }
                }
                
                if (newCode) {
                    migrationMap.set(oldMenu.code, newCode);
                } else {
                    skipped.push({ code: oldMenu.code, name: oldMenu.name });
                }
            }
            
            // Update mappings
            let updatedMappings = 0;
            for (const [oldCode, newCode] of migrationMap.entries()) {
                const result = await menuMappings.updateMany(
                    { masterMenuCode: oldCode },
                    { $set: { masterMenuCode: newCode, updatedAt: new Date() } }
                );
                updatedMappings += result.modifiedCount;
            }
            
            // Delete old master menus
            const deleteResult = await masterMenus.deleteMany({
                code: { $in: Array.from(migrationMap.keys()) }
            });
            
            return res.status(200).json({
                success: true,
                message: 'Heineken variants consolidated',
                data: {
                    totalFound: heinekenMenus.length,
                    oldMenus: oldMenus.length,
                    migrated: migrationMap.size,
                    mappingsUpdated: updatedMappings,
                    menuDeleted: deleteResult.deletedCount,
                    skipped: skipped,
                    migrations: Array.from(migrationMap.entries()).map(([old, newCode]) => ({ old, new: newCode }))
                }
            });
            
        } catch (error) {
            console.error('[Analytics Builder] Error consolidating variants:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to consolidate variants',
                message: error.message
            });
        }
    },

    /**
     * Fix generic MENU-HEINEKEN by mapping to a specific variant
     * Maps to MENU-HEINEKEN-BOTTLE-LARGE (most common)
     */
    fixGenericHeineken: async (req, res, db) => {
        try {
            const menuMappings = db.collection('menuMappings');
            const masterMenus = db.collection('masterMenus');
            
            const genericCode = 'MENU-HEINEKEN';
            const targetCode = 'MENU-HEINEKEN-BOTTLE-LARGE';
            
            console.log(`[Fix Generic Heineken] Mapping ${genericCode} → ${targetCode}`);
            
            // Check if generic exists
            const genericMenu = await masterMenus.findOne({ code: genericCode });
            if (!genericMenu) {
                return res.status(404).json({
                    success: false,
                    message: 'Generic MENU-HEINEKEN not found (already fixed?)'
                });
            }
            
            // Check if target exists
            const targetMenu = await masterMenus.findOne({ code: targetCode });
            if (!targetMenu) {
                return res.status(404).json({
                    success: false,
                    message: 'Target MENU-HEINEKEN-BOTTLE-LARGE not found'
                });
            }
            
            // Update all mappings from generic to specific variant
            const updateResult = await menuMappings.updateMany(
                { masterMenuCode: genericCode },
                { 
                    $set: { 
                        masterMenuCode: targetCode,
                        updatedAt: new Date()
                    }
                }
            );
            
            console.log(`[Fix Generic Heineken] Updated ${updateResult.modifiedCount} mappings`);
            
            // Delete the generic master menu
            const deleteResult = await masterMenus.deleteOne({ code: genericCode });
            
            console.log(`[Fix Generic Heineken] Deleted generic master menu`);
            
            return res.status(200).json({
                success: true,
                message: 'Generic Heineken fixed',
                data: {
                    mappingsUpdated: updateResult.modifiedCount,
                    menuDeleted: deleteResult.deletedCount,
                    migration: {
                        from: genericCode,
                        to: targetCode
                    }
                }
            });
            
        } catch (error) {
            console.error('[Fix Generic Heineken] Error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fix generic Heineken',
                message: error.message
            });
        }
    },

    /**
     * Clean failed jobs from the queue
     * Useful for removing stuck jobs after code changes
     */
    cleanFailedJobs: async (req, res, db) => {
        try {
            const queue = getAnalyticsBuilderQueue();
            
            // Get all failed jobs
            const failedJobs = await queue.getFailed();
            
            console.log(`[Analytics Builder] Found ${failedJobs.length} failed jobs`);
            
            // Remove them
            for (const job of failedJobs) {
                await job.remove();
                console.log(`[Analytics Builder] Removed failed job ${job.id}`);
            }
            
            return res.status(200).json({
                success: true,
                message: `Cleaned ${failedJobs.length} failed jobs`,
                data: { removed: failedJobs.length }
            });
            
        } catch (error) {
            console.error('[Analytics Builder] Error cleaning failed jobs:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to clean failed jobs',
                message: error.message
            });
        }
    },

    /**
     * Start analytics build as a background job
     * Returns job ID immediately, processing happens in background
     */
    startBuildJob: async (req, res, db) => {
        try {
            const {
                startDate,
                endDate,
                storeId,
                rebuild = true
            } = req.body;

            console.log('[Analytics Builder] Starting background job...');

            const queue = getAnalyticsBuilderQueue();
            
            // Create job with name 'build-analytics'
            const job = await queue.add('build-analytics', {
                startDate,
                endDate,
                storeId,
                rebuild
            }, {
                jobId: `analytics-build-${Date.now()}`,
                attempts: 2,
                backoff: {
                    type: 'exponential',
                    delay: 5000
                }
            });

            console.log(`[Analytics Builder] Job ${job.id} created`);

            return res.status(202).json({
                success: true,
                message: 'Analytics build job started',
                data: {
                    jobId: job.id,
                    status: 'queued'
                }
            });

        } catch (error) {
            console.error('[Analytics Builder] Error starting job:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to start analytics build job',
                message: error.message
            });
        }
    },

    /**
     * Get job status and progress
     */
    getJobStatusById: async (req, res, db) => {
        try {
            const { jobId } = req.params;

            const status = await getJobStatus(jobId);
            
            if (!status) {
                return res.status(404).json({
                    success: false,
                    error: 'Job not found'
                });
            }

            return res.status(200).json({
                success: true,
                data: status
            });

        } catch (error) {
            console.error('[Analytics Builder] Error getting job status:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to get job status',
                message: error.message
            });
        }
    },

    /**
     * Stream job progress via Server-Sent Events (SSE)
     * Matches Order-Based Mapping pattern for consistency
     */
    streamJobProgress: async (req, res, db) => {
        const { jobId } = req.params;

        console.log(`[Analytics Builder SSE] Client connected for job ${jobId}`);

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
        res.flushHeaders();

        // Send initial connected event
        res.write(`data: ${JSON.stringify({ type: 'connected', jobId })}\n\n`);

        // Register client for progress updates
        addSSEClient(jobId, res);

        // Get current job status and send immediately
        try {
            const status = await getJobStatus(jobId);
            res.write(`data: ${JSON.stringify({ type: 'status', ...status })}\n\n`);

            // If job is already completed/failed, close after sending
            if (status.status === 'completed' || status.status === 'failed') {
                setTimeout(() => {
                    res.write(`data: ${JSON.stringify({ type: 'close', reason: 'job_finished' })}\n\n`);
                    res.end();
                }, 1000);
                return;
            }
        } catch (error) {
            console.error('[Analytics Builder SSE] Error getting initial status:', error);
        }

        // Keep-alive ping every 30 seconds
        const pingInterval = setInterval(() => {
            try {
                res.write(`: ping\n\n`);
            } catch (e) {
                clearInterval(pingInterval);
            }
        }, 30000);

        // Cleanup on client disconnect
        req.on('close', () => {
            console.log(`[Analytics Builder SSE] Client disconnected for job ${jobId}`);
            clearInterval(pingInterval);
            removeSSEClient(jobId, res);
        });

        req.on('error', (error) => {
            console.log(`[Analytics Builder SSE] Client error for job ${jobId}:`, error.message);
            clearInterval(pingInterval);
            removeSSEClient(jobId, res);
        });
    },

    /**
     * Build/Rebuild the orderAnalytics collection
     * 
     * This reads from:
     * - orders (original, immutable)
     * - menuMappings (approved mappings)
     * - masterMenus (master catalog)
     * 
     * And creates:
     * - orderAnalytics (derived, rebuildable)
     */
    buildAnalytics: async (req, res, db) => {
        try {
            const {
                startDate,
                endDate,
                storeId,
                rebuild = true // If true, drops and rebuilds. If false, incremental
            } = req.body;

            console.log('[Build Analytics] Starting analytics build process...');
            console.log('[Build Analytics] Date range:', startDate, 'to', endDate);
            console.log('[Build Analytics] Rebuild mode:', rebuild);

            // Parse dates
            const end = endDate ? new Date(endDate) : new Date();
            const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
            
            const orders = db.collection('orders');
            const menuMappings = db.collection('menuMappings');
            const masterMenus = db.collection('masterMenus');
            const orderAnalytics = db.collection('orderAnalytics');

            // Step 1: If rebuild, clear the collection for this date range
            if (rebuild) {
                console.log('[Build Analytics] Clearing existing analytics data for date range...');
                const deleteResult = await orderAnalytics.deleteMany({
                    createdAt: {
                        $gte: start,
                        $lte: end
                    }
                });
                console.log(`[Build Analytics] Deleted ${deleteResult.deletedCount} existing records`);
            }

            // Step 2: Build the analytics using aggregation pipeline
            console.log('[Build Analytics] Running aggregation pipeline...');
            
            const pipeline = [
                // Match orders in date range
                {
                    $match: {
                        createdAt: {
                            $gte: start,
                            $lte: end
                        },
                        ...(storeId && { storeId: storeId })
                    }
                },
                
                // Lookup mapping for this menu+store
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
                
                // Unwind mapping (keep orders without mapping as null)
                {
                    $unwind: {
                        path: '$mapping',
                        preserveNullAndEmptyArrays: true
                    }
                },
                
                // Lookup master menu details
                {
                    $lookup: {
                        from: 'masterMenus',
                        let: { masterCode: '$mapping.masterMenuCode' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ['$code', '$$masterCode'] }
                                }
                            }
                        ],
                        as: 'masterMenu'
                    }
                },
                
                // Unwind master menu
                {
                    $unwind: {
                        path: '$masterMenu',
                        preserveNullAndEmptyArrays: true
                    }
                },
                
                // Lookup store details
                {
                    $lookup: {
                        from: 'stores',
                        let: { storeId: '$storeId' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ['$_id', { $toObjectId: '$$storeId' }] }
                                }
                            }
                        ],
                        as: 'store'
                    }
                },
                
                // Unwind store
                {
                    $unwind: {
                        path: '$store',
                        preserveNullAndEmptyArrays: true
                    }
                },
                
                // Project final analytics document
                {
                    $project: {
                        // Original order data (reference only)
                        orderId: '$_id',
                        originalMenuName: '$name',
                        menuId: 1,
                        storeId: 1,
                        
                        // Store info
                        storeName: '$store.name',
                        storeCode: '$store.code',
                        
                        // Order details
                        price: 1,
                        quantity: 1,
                        revenue: { $multiply: ['$price', '$quantity'] },
                        billId: 1,
                        createdAt: 1,
                        status: 1,
                        
                        // Master menu mapping (enriched)
                        masterMenuCode: '$masterMenu.code',
                        masterMenuName: '$masterMenu.name',
                        masterMenuName_en: '$masterMenu.name_en',
                        masterCategoryCode: '$masterMenu.masterCategoryCode',
                        
                        // Product variant info
                        baseProduct: '$masterMenu.baseProduct',
                        sizeVariant: '$masterMenu.sizeVariant',
                        sizeCategory: '$masterMenu.sizeCategory',
                        productCategory: '$masterMenu.productCategory',
                        
                        // Mapping info
                        mappingId: '$mapping._id',
                        mappingConfidence: '$mapping.confidenceScore',
                        
                        // Metadata
                        isMapped: { 
                            $cond: [
                                { $ne: ['$masterMenu.code', null] },
                                true,
                                false
                            ]
                        },
                        analyticsBuiltAt: new Date()
                    }
                }
            ];

            // Execute pipeline and write to analytics collection
            console.log('[Build Analytics] Executing aggregation and writing results...');
            const startTime = Date.now();
            
            const results = await orders.aggregate(pipeline, {
                allowDiskUse: true
            }).toArray();
            
            const aggregationTime = Date.now() - startTime;
            console.log(`[Build Analytics] Aggregation completed in ${aggregationTime}ms`);
            console.log(`[Build Analytics] Found ${results.length} orders to process`);

            // Insert in batches for better performance
            if (results.length > 0) {
                const batchSize = 1000;
                let inserted = 0;
                
                for (let i = 0; i < results.length; i += batchSize) {
                    const batch = results.slice(i, i + batchSize);
                    await orderAnalytics.insertMany(batch, { ordered: false });
                    inserted += batch.length;
                    
                    if (i % 5000 === 0 && i > 0) {
                        console.log(`[Build Analytics] Progress: ${inserted}/${results.length} orders processed`);
                    }
                }
                
                console.log(`[Build Analytics] Successfully inserted ${inserted} analytics records`);
            }

            const totalTime = Date.now() - startTime;

            // Step 3: Create indexes for fast queries
            console.log('[Build Analytics] Creating indexes...');
            await orderAnalytics.createIndex({ masterMenuCode: 1 });
            await orderAnalytics.createIndex({ baseProduct: 1 });
            await orderAnalytics.createIndex({ masterCategoryCode: 1 });
            await orderAnalytics.createIndex({ storeId: 1 });
            await orderAnalytics.createIndex({ createdAt: -1 });
            await orderAnalytics.createIndex({ isMapped: 1 });
            await orderAnalytics.createIndex({ 
                masterMenuCode: 1, 
                createdAt: -1 
            });

            // Step 4: Calculate summary stats
            const stats = await orderAnalytics.aggregate([
                {
                    $facet: {
                        total: [{ $count: 'count' }],
                        mapped: [
                            { $match: { isMapped: true } },
                            { $count: 'count' }
                        ],
                        unmapped: [
                            { $match: { isMapped: false } },
                            { $count: 'count' }
                        ],
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

            console.log('[Build Analytics] ✅ Build complete!');
            console.log('[Build Analytics] Summary:', summary);
            console.log(`[Build Analytics] Total time: ${totalTime}ms`);

            return res.status(200).json({
                success: true,
                message: 'Analytics built successfully',
                data: {
                    dateRange: { startDate: start, endDate: end },
                    processingTime: totalTime,
                    summary
                }
            });

        } catch (error) {
            console.error('[Build Analytics] Error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to build analytics',
                message: error.message
            });
        }
    },

    /**
     * Get analytics build status
     */
    getAnalyticsStatus: async (req, res, db) => {
        try {
            const orderAnalytics = db.collection('orderAnalytics');

            // Get latest build timestamp and count
            const stats = await orderAnalytics.aggregate([
                {
                    $facet: {
                        total: [{ $count: 'count' }],
                        latest: [
                            { $sort: { analyticsBuiltAt: -1 } },
                            { $limit: 1 },
                            { $project: { analyticsBuiltAt: 1 } }
                        ],
                        dateRange: [
                            { $group: {
                                _id: null,
                                minDate: { $min: '$createdAt' },
                                maxDate: { $max: '$createdAt' }
                            }}
                        ]
                    }
                }
            ]).toArray();

            return res.status(200).json({
                success: true,
                data: {
                    totalRecords: stats[0].total[0]?.count || 0,
                    lastBuiltAt: stats[0].latest[0]?.analyticsBuiltAt || null,
                    dateRange: stats[0].dateRange[0] || null
                }
            });

        } catch (error) {
            console.error('[Analytics Status] Error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to get analytics status'
            });
        }
    }
};

module.exports = analyticsBuilderController;
