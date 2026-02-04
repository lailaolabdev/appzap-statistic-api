/**
 * Order-Based Mapping Controller
 * 
 * Smart mapping approach that prioritizes menu items based on actual orders.
 * This follows the Pareto principle - focus on mapping menus that are actually being ordered.
 * 
 * IMPORTANT: Order Schema (Flat Structure)
 * Each document in 'orders' collection IS an order item:
 * {
 *   _id, name, menuId, storeId, price, quantity, billId, 
 *   createdAt, status, categoryId, menuImage, etc.
 * }
 * 
 * Key Features:
 * 1. Analyze orders for a date range to discover frequently-ordered menus
 * 2. Prioritize mapping queue by order frequency (most ordered first)
 * 3. Enrich orders with master menu codes after mapping
 * 4. Track "no match found" items for manual review
 */

const { ObjectId } = require('mongodb');

const orderBasedMappingController = {
    /**
     * Discover menus from orders within a date range
     * This creates a prioritized list of menus to map based on actual usage
     * 
     * Note: Each 'orders' document IS an order item (flat schema)
     * 
     * Supports:
     * - Status filter: all, mapped, suggested, pending
     * - Search by menu name or store name
     */
    discoverMenusFromOrders: async (req, res, db) => {
        try {
            const {
                startDate,
                endDate,
                limit = 50,
                skip = 0,
                minOrderCount = 1,
                storeId,
                statusFilter = 'all', // all, mapped, suggested, pending
                search = ''
            } = req.query;

            // Default to last 30 days if no dates provided
            const end = endDate ? new Date(endDate) : new Date();
            const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

            console.log(`[Order Discovery] Analyzing orders from ${start.toISOString()} to ${end.toISOString()}, status=${statusFilter}, search=${search}`);

            // Build match stage - each document IS an order item
            const matchStage = {
                createdAt: { $gte: start, $lte: end },
                menuId: { $exists: true, $ne: null }
            };

            if (storeId) {
                matchStage.storeId = new ObjectId(storeId);
            }

            // Aggregate to find unique menu items and their order count
            // Then lookup mappings and stores for filtering
            const pipeline = [
                { $match: matchStage },
                {
                    $group: {
                        _id: {
                            menuId: '$menuId',
                            storeId: '$storeId'
                        },
                        menuName: { $first: '$name' },
                        menuImage: { $first: '$menuImage' },
                        categoryId: { $first: '$categoryId' },
                        totalQuantity: { $sum: '$quantity' },
                        orderCount: { $sum: 1 },
                        totalRevenue: { $sum: { $multiply: ['$price', '$quantity'] } },
                        lastOrderedAt: { $max: '$createdAt' },
                        avgPrice: { $avg: '$price' }
                    }
                },
                { $match: { orderCount: { $gte: parseInt(minOrderCount) } } },
                // Lookup mapping status
                {
                    $lookup: {
                        from: 'menuMappings',
                        let: { menuId: '$_id.menuId', storeId: '$_id.storeId' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$menuId', '$$menuId'] },
                                            { $eq: ['$storeId', '$$storeId'] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: 'mapping'
                    }
                },
                { $unwind: { path: '$mapping', preserveNullAndEmptyArrays: true } },
                // Lookup store info for search
                {
                    $lookup: {
                        from: 'stores',
                        localField: '_id.storeId',
                        foreignField: '_id',
                        as: 'store'
                    }
                },
                { $unwind: { path: '$store', preserveNullAndEmptyArrays: true } },
                // Add computed fields
                {
                    $addFields: {
                        mappingStatus: {
                            $cond: {
                                if: { $eq: ['$mapping', null] },
                                then: 'not-analyzed',
                                else: '$mapping.mappingStatus'
                            }
                        },
                        masterMenuCode: '$mapping.masterMenuCode',
                        masterMenuName: '$mapping.masterMenuName',
                        masterMenuName_en: '$mapping.masterMenuName_en',
                        confidenceScore: { $ifNull: ['$mapping.confidenceScore', 0] },
                        suggestedMappings: '$mapping.suggestedMappings',
                        mappingId: '$mapping._id',
                        storeName: '$store.name',
                        searchText: {
                            $concat: [
                                { $ifNull: ['$menuName', ''] },
                                ' ',
                                { $ifNull: ['$store.name', ''] }
                            ]
                        },
                        // Display status: distinguishes between suggested (high conf) and no-match (low conf)
                        displayStatus: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ['$mapping', null] }, then: 'pending' },
                                    { case: { $eq: ['$mapping.mappingStatus', 'approved'] }, then: 'mapped' },
                                    {
                                        case: {
                                            $and: [
                                                { $eq: ['$mapping.mappingStatus', 'suggested'] },
                                                { $gte: [{ $ifNull: ['$mapping.confidenceScore', 0] }, 60] }
                                            ]
                                        },
                                        then: 'suggested'
                                    },
                                    {
                                        case: { $eq: ['$mapping.mappingStatus', 'suggested'] },
                                        then: 'no-match'
                                    }
                                ],
                                default: 'pending'
                            }
                        }
                    }
                }
            ];

            // Add status filter
            // Status definitions:
            // - mapped: approved mappings
            // - unmapped: ALL items that are NOT mapped (suggested + no-match + pending)
            // - suggested: suggestions with confidence >= 60%
            // - pending: not analyzed yet (no mapping record)
            // - no-match: low confidence (<60%) or no suggestion found
            if (statusFilter && statusFilter !== 'all') {
                if (statusFilter === 'mapped') {
                    pipeline.push({ $match: { mappingStatus: 'approved' } });
                } else if (statusFilter === 'unmapped') {
                    // ALL items that are NOT approved (mapped)
                    pipeline.push({
                        $match: {
                            mappingStatus: { $ne: 'approved' }
                        }
                    });
                } else if (statusFilter === 'suggested') {
                    pipeline.push({
                        $match: {
                            mappingStatus: 'suggested',
                            confidenceScore: { $gte: 60 }
                        }
                    });
                } else if (statusFilter === 'pending') {
                    pipeline.push({
                        $match: {
                            $or: [
                                { mappingStatus: 'not-analyzed' },
                                { mappingStatus: null },
                                { mapping: null }
                            ]
                        }
                    });
                } else if (statusFilter === 'no-match') {
                    // Low confidence suggestions
                    pipeline.push({
                        $match: {
                            $or: [
                                { mappingStatus: 'suggested', confidenceScore: { $lt: 60 } },
                                { mappingStatus: 'suggested', masterMenuCode: null }
                            ]
                        }
                    });
                }
            }

            // Add search filter (menu name or store name)
            if (search && search.trim()) {
                pipeline.push({
                    $match: {
                        searchText: { $regex: search.trim(), $options: 'i' }
                    }
                });
            }

            // Sort and paginate
            pipeline.push(
                { $sort: { orderCount: -1, totalQuantity: -1 } },
                {
                    $facet: {
                        items: [
                            { $skip: parseInt(skip) },
                            { $limit: parseInt(limit) }
                        ],
                        total: [{ $count: 'count' }],
                        stats: [
                            {
                                $group: {
                                    _id: null,
                                    totalUniqueMenus: { $sum: 1 },
                                    totalOrders: { $sum: '$orderCount' },
                                    totalQuantity: { $sum: '$totalQuantity' },
                                    totalRevenue: { $sum: '$totalRevenue' }
                                }
                            }
                        ]
                    }
                }
            );

            const [result] = await db.collection('orders').aggregate(pipeline, { allowDiskUse: true }).toArray();

            const items = result.items || [];
            const total = result.total[0]?.count || 0;
            const stats = result.stats[0] || {};

            // Format the response
            const enrichedItems = items.map(item => ({
                menuId: item._id.menuId,
                storeId: item._id.storeId,
                menuName: item.menuName,
                menuImage: item.menuImage,
                categoryId: item.categoryId,
                orderCount: item.orderCount,
                totalQuantity: item.totalQuantity,
                totalRevenue: item.totalRevenue,
                avgPrice: Math.round(item.avgPrice || 0),
                lastOrderedAt: item.lastOrderedAt,
                mappingStatus: item.mappingStatus || 'not-analyzed',
                displayStatus: item.displayStatus || 'pending',
                masterMenuCode: item.masterMenuCode || null,
                masterMenuName: item.masterMenuName || null,
                masterMenuName_en: item.masterMenuName_en || null,
                confidenceScore: item.confidenceScore || 0,
                suggestedMappings: item.suggestedMappings || [],
                mappingId: item.mappingId || null,
                storeName: item.storeName || null
            }));

            res.status(200).json({
                data: enrichedItems,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    skip: parseInt(skip),
                    hasMore: parseInt(skip) + items.length < total
                },
                stats: {
                    totalUniqueMenus: stats.totalUniqueMenus || 0,
                    totalOrders: stats.totalOrders || 0,
                    totalQuantity: stats.totalQuantity || 0,
                    totalRevenue: stats.totalRevenue || 0,
                    dateRange: {
                        start: start.toISOString(),
                        end: end.toISOString()
                    }
                }
            });
        } catch (error) {
            console.error('Error discovering menus from orders:', error);
            res.status(500).json({ error: 'Failed to discover menus from orders' });
        }
    },

    /**
     * Get summary statistics for order-based mapping
     * OPTIMIZED VERSION: Uses caching and single $lookup aggregation
     * 
     * Note: Flat schema - each document IS an order item
     */
    getOrderBasedStats: async (req, res, db) => {
        const startTime = Date.now();

        try {
            const {
                startDate,
                endDate,
                storeId,
                noCache // Optional query param to bypass cache
            } = req.query;

            const end = endDate ? new Date(endDate) : new Date();
            const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

            // Generate cache key
            const cacheKey = `stats_${start.toISOString()}_${end.toISOString()}_${storeId || 'all'}`;

            // Check cache first (unless noCache is set)
            const { getCachedStats, setCachedStats } = require('../../utils/statsCache');
            if (!noCache) {
                const cached = getCachedStats(cacheKey);
                if (cached) {
                    return res.status(200).json({
                        data: cached,
                        fromCache: true,
                        cacheKey
                    });
                }
            }

            const matchStage = {
                createdAt: { $gte: start, $lte: end },
                menuId: { $exists: true, $ne: null }
            };

            if (storeId) {
                matchStage.storeId = new ObjectId(storeId);
            }

            console.log(`[Stats] Calculating stats for ${start.toISOString()} to ${end.toISOString()}`);

            // OPTIMIZED: Single aggregation with $lookup instead of multiple batch queries
            const statsResult = await db.collection('orders').aggregate([
                { $match: matchStage },
                // Group by unique menu
                {
                    $group: {
                        _id: { menuId: '$menuId', storeId: '$storeId' },
                        orderCount: { $sum: 1 },
                        totalQuantity: { $sum: '$quantity' },
                        totalRevenue: { $sum: { $multiply: ['$price', '$quantity'] } }
                    }
                },
                // Lookup mapping for each menu
                {
                    $lookup: {
                        from: 'menuMappings',
                        let: { menuId: '$_id.menuId', storeId: '$_id.storeId' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$menuId', '$$menuId'] },
                                            { $eq: ['$storeId', '$$storeId'] }
                                        ]
                                    }
                                }
                            },
                            { $project: { mappingStatus: 1, confidenceScore: 1 } }
                        ],
                        as: 'mapping'
                    }
                },
                // Unwind the mapping (will be null if no mapping)
                {
                    $addFields: {
                        mapping: { $arrayElemAt: ['$mapping', 0] }
                    }
                },
                // Calculate stats in a single facet
                {
                    $facet: {
                        totals: [
                            {
                                $group: {
                                    _id: null,
                                    totalMenus: { $sum: 1 },
                                    totalOrders: { $sum: '$orderCount' },
                                    totalQuantity: { $sum: '$totalQuantity' },
                                    totalRevenue: { $sum: '$totalRevenue' }
                                }
                            }
                        ],
                        byStatus: [
                            {
                                $group: {
                                    _id: {
                                        $switch: {
                                            branches: [
                                                {
                                                    case: { $eq: ['$mapping', null] },
                                                    then: 'notAnalyzed'
                                                },
                                                {
                                                    case: { $eq: ['$mapping.mappingStatus', 'approved'] },
                                                    then: 'mapped'
                                                },
                                                {
                                                    case: {
                                                        $and: [
                                                            { $eq: ['$mapping.mappingStatus', 'suggested'] },
                                                            { $gte: ['$mapping.confidenceScore', 60] }
                                                        ]
                                                    },
                                                    then: 'suggested'
                                                },
                                                {
                                                    case: {
                                                        $and: [
                                                            { $eq: ['$mapping.mappingStatus', 'suggested'] },
                                                            { $lt: ['$mapping.confidenceScore', 60] }
                                                        ]
                                                    },
                                                    then: 'noMatch'
                                                }
                                            ],
                                            default: 'pending'
                                        }
                                    },
                                    count: { $sum: 1 }
                                }
                            }
                        ]
                    }
                }
            ], { allowDiskUse: true }).toArray();

            const duration = Date.now() - startTime;
            console.log(`[Stats] Query completed in ${duration}ms`);

            // Extract results
            const totals = statsResult[0]?.totals[0] || {
                totalMenus: 0, totalOrders: 0, totalQuantity: 0, totalRevenue: 0
            };

            const statusCounts = {};
            for (const item of statsResult[0]?.byStatus || []) {
                statusCounts[item._id] = item.count;
            }

            const stats = {
                totalUniqueMenusOrdered: totals.totalMenus,
                mapped: statusCounts.mapped || 0,
                suggested: statusCounts.suggested || 0,
                noMatch: statusCounts.noMatch || 0,
                pending: statusCounts.pending || 0,
                notAnalyzed: statusCounts.notAnalyzed || 0,
                totalOrders: totals.totalOrders,
                totalQuantity: totals.totalQuantity,
                totalRevenue: totals.totalRevenue,
                mappingCoverage: totals.totalMenus > 0
                    ? Math.round((statusCounts.mapped || 0) / totals.totalMenus * 100)
                    : 0,
                dateRange: {
                    start: start.toISOString(),
                    end: end.toISOString()
                },
                queryDurationMs: duration
            };

            // Calculate unmapped
            stats.unmapped = stats.suggested + stats.noMatch + stats.pending + stats.notAnalyzed;

            console.log(`[Stats] Complete: mapped=${stats.mapped}, suggested=${stats.suggested}, noMatch=${stats.noMatch}, pending=${stats.pending}, notAnalyzed=${stats.notAnalyzed}`);

            // Cache the result
            setCachedStats(cacheKey, stats);

            res.status(200).json({
                data: stats,
                fromCache: false,
                cacheKey
            });
        } catch (error) {
            console.error('Error getting order-based stats:', error);
            res.status(500).json({ error: 'Failed to get order-based statistics' });
        }
    },

    /**
     * Get items with no match found
     * These need manual mapping or new master item creation
     */
    getNoMatchItems: async (req, res, db) => {
        try {
            const {
                entityType = 'menu', // 'menu' or 'category'
                limit = 50,
                skip = 0,
                search = '',
                sortBy = 'count', // 'count' or 'name'
                sortOrder = 'desc'
            } = req.query;

            const collection = entityType === 'menu' ? 'menuMappings' : 'categoryMappings';
            const codeField = entityType === 'menu' ? 'masterMenuCode' : 'masterCategoryCode';

            // Items with no match: low confidence or no suggestions
            const query = {
                $or: [
                    { mappingStatus: 'suggested', confidenceScore: { $lt: 60 } },
                    { mappingStatus: 'suggested', suggestedMappings: { $size: 0 } },
                    { mappingStatus: 'suggested', [codeField]: null }
                ]
            };

            if (search) {
                query.$and = [
                    { $or: query.$or },
                    {
                        $or: [
                            { [entityType === 'menu' ? 'menuName' : 'categoryName']: { $regex: search, $options: 'i' } },
                            { normalizedName: { $regex: search, $options: 'i' } }
                        ]
                    }
                ];
                delete query.$or;
            }

            // Aggregate to count occurrences of each unique name
            const pipeline = [
                { $match: query },
                {
                    $group: {
                        _id: '$normalizedName',
                        originalName: { $first: entityType === 'menu' ? '$menuName' : '$categoryName' },
                        count: { $sum: 1 },
                        storeIds: { $addToSet: '$storeId' },
                        sampleIds: { $push: '$_id' },
                        avgConfidence: { $avg: '$confidenceScore' }
                    }
                },
                {
                    $project: {
                        normalizedName: '$_id',
                        originalName: 1,
                        count: 1,
                        storeCount: { $size: '$storeIds' },
                        sampleId: { $arrayElemAt: ['$sampleIds', 0] },
                        avgConfidence: { $round: ['$avgConfidence', 0] }
                    }
                },
                { $sort: { [sortBy === 'name' ? 'originalName' : 'count']: sortOrder === 'asc' ? 1 : -1 } },
                {
                    $facet: {
                        items: [
                            { $skip: parseInt(skip) },
                            { $limit: parseInt(limit) }
                        ],
                        total: [{ $count: 'count' }]
                    }
                }
            ];

            const [result] = await db.collection(collection).aggregate(pipeline).toArray();

            res.status(200).json({
                data: result.items || [],
                pagination: {
                    total: result.total[0]?.count || 0,
                    limit: parseInt(limit),
                    skip: parseInt(skip),
                    hasMore: parseInt(skip) + (result.items?.length || 0) < (result.total[0]?.count || 0)
                }
            });
        } catch (error) {
            console.error('Error getting no-match items:', error);
            res.status(500).json({ error: 'Failed to get no-match items' });
        }
    },

    /**
     * Enrich orders with master menu codes
     * This backfills historical orders with the mapped master codes
     * 
     * Note: Flat schema - each document IS an order item, not nested
     */
    enrichOrders: async (req, res, db) => {
        try {
            const {
                startDate,
                endDate,
                storeId,
                dryRun = 'true',
                batchSize = 1000
            } = req.body;

            const end = endDate ? new Date(endDate) : new Date();
            const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

            console.log(`[Order Enrichment] ${dryRun === 'true' ? '[DRY RUN] ' : ''}Processing orders from ${start.toISOString()} to ${end.toISOString()}`);

            // Match orders without masterMenuCode (not yet enriched)
            const matchStage = {
                createdAt: { $gte: start, $lte: end },
                menuId: { $exists: true, $ne: null },
                masterMenuCode: { $exists: false } // Only non-enriched orders
            };

            if (storeId) {
                matchStage.storeId = new ObjectId(storeId);
            }

            // Get all approved menu mappings
            const approvedMappings = await db.collection('menuMappings').find({
                mappingStatus: 'approved',
                masterMenuCode: { $ne: null }
            }).toArray();

            // Create lookup map: menuId + storeId -> masterMenuCode
            const mappingMap = new Map();
            for (const mapping of approvedMappings) {
                const key = `${mapping.menuId}_${mapping.storeId}`;
                mappingMap.set(key, {
                    masterMenuCode: mapping.masterMenuCode,
                    masterMenuName: mapping.masterMenuName,
                    masterMenuName_en: mapping.masterMenuName_en
                });
            }

            console.log(`[Order Enrichment] Loaded ${approvedMappings.length} approved mappings`);

            // Find orders to update (flat schema - each doc is an order item)
            const orderItems = await db.collection('orders')
                .find(matchStage)
                .limit(parseInt(batchSize))
                .toArray();

            console.log(`[Order Enrichment] Found ${orderItems.length} order items to process`);

            let enrichedCount = 0;
            let skippedCount = 0;
            const bulkOps = [];

            // Flat schema: each document IS an order item
            for (const orderItem of orderItems) {
                const key = `${orderItem.menuId}_${orderItem.storeId}`;
                const mapping = mappingMap.get(key);

                if (mapping) {
                    enrichedCount++;
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: orderItem._id },
                            update: {
                                $set: {
                                    masterMenuCode: mapping.masterMenuCode,
                                    masterMenuName: mapping.masterMenuName,
                                    masterMenuName_en: mapping.masterMenuName_en,
                                    enrichedAt: new Date()
                                }
                            }
                        }
                    });
                } else {
                    skippedCount++;
                }
            }

            // Execute bulk update if not dry run
            let writeResult = null;
            if (dryRun !== 'true' && bulkOps.length > 0) {
                writeResult = await db.collection('orders').bulkWrite(bulkOps, { ordered: false });
                console.log(`[Order Enrichment] Updated ${writeResult.modifiedCount} order items`);
            }

            res.status(200).json({
                message: dryRun === 'true' ? 'Dry run completed' : 'Orders enriched successfully',
                data: {
                    dryRun: dryRun === 'true',
                    totalOrderItemsProcessed: orderItems.length,
                    orderItemsEnriched: enrichedCount,
                    orderItemsSkipped: skippedCount,
                    mappingsLoaded: approvedMappings.length,
                    dateRange: {
                        start: start.toISOString(),
                        end: end.toISOString()
                    },
                    writeResult: writeResult ? {
                        matched: writeResult.matchedCount,
                        modified: writeResult.modifiedCount
                    } : null
                }
            });
        } catch (error) {
            console.error('Error enriching orders:', error);
            res.status(500).json({ error: 'Failed to enrich orders' });
        }
    },

    /**
     * Get top selling items by master menu code
     * This is the analytics endpoint that shows aggregated sales
     * 
     * Note: Flat schema - each document IS an order item
     */
    getTopSellingByMasterMenu: async (req, res, db) => {
        try {
            const {
                startDate,
                endDate,
                storeId,
                limit = 50,
                skip = 0,
                masterCategoryCode
            } = req.query;

            const end = endDate ? new Date(endDate) : new Date();
            const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

            // Flat schema: masterMenuCode is directly on the document
            const matchStage = {
                createdAt: { $gte: start, $lte: end },
                masterMenuCode: { $exists: true, $ne: null }
            };

            if (storeId) {
                matchStage.storeId = new ObjectId(storeId);
            }

            const pipeline = [
                { $match: matchStage }
                // No $unwind needed - flat schema
            ];

            // Add category filter if provided
            if (masterCategoryCode) {
                // Look up master menu to get category (flat schema)
                pipeline.push({
                    $lookup: {
                        from: 'masterMenus',
                        localField: 'masterMenuCode',
                        foreignField: 'code',
                        as: 'masterMenu'
                    }
                });
                pipeline.push({ $unwind: '$masterMenu' });
                pipeline.push({ $match: { 'masterMenu.masterCategoryCode': masterCategoryCode } });
            }

            // Flat schema: fields are directly on the document
            pipeline.push(
                {
                    $group: {
                        _id: '$masterMenuCode',
                        masterMenuName: { $first: '$masterMenuName' },
                        masterMenuName_en: { $first: '$masterMenuName_en' },
                        totalQuantity: { $sum: '$quantity' },
                        orderCount: { $sum: 1 },
                        totalRevenue: { $sum: { $multiply: ['$price', '$quantity'] } },
                        uniqueStores: { $addToSet: '$storeId' },
                        avgPrice: { $avg: '$price' }
                    }
                },
                {
                    $project: {
                        masterMenuCode: '$_id',
                        masterMenuName: 1,
                        masterMenuName_en: 1,
                        totalQuantity: 1,
                        orderCount: 1,
                        totalRevenue: { $round: ['$totalRevenue', 0] },
                        storeCount: { $size: '$uniqueStores' },
                        avgPrice: { $round: ['$avgPrice', 0] }
                    }
                },
                { $sort: { totalQuantity: -1 } },
                {
                    $facet: {
                        items: [
                            { $skip: parseInt(skip) },
                            { $limit: parseInt(limit) }
                        ],
                        total: [{ $count: 'count' }],
                        summary: [
                            {
                                $group: {
                                    _id: null,
                                    totalRevenue: { $sum: '$totalRevenue' },
                                    totalQuantity: { $sum: '$totalQuantity' },
                                    uniqueMenus: { $sum: 1 }
                                }
                            }
                        ]
                    }
                }
            );

            const [result] = await db.collection('orders').aggregate(pipeline).toArray();

            res.status(200).json({
                data: result.items || [],
                pagination: {
                    total: result.total[0]?.count || 0,
                    limit: parseInt(limit),
                    skip: parseInt(skip),
                    hasMore: parseInt(skip) + (result.items?.length || 0) < (result.total[0]?.count || 0)
                },
                summary: {
                    totalRevenue: result.summary[0]?.totalRevenue || 0,
                    totalQuantity: result.summary[0]?.totalQuantity || 0,
                    uniqueMenus: result.summary[0]?.uniqueMenus || 0,
                    dateRange: {
                        start: start.toISOString(),
                        end: end.toISOString()
                    }
                }
            });
        } catch (error) {
            console.error('Error getting top selling by master menu:', error);
            res.status(500).json({ error: 'Failed to get top selling items' });
        }
    },

    /**
     * Trigger analysis for menus discovered from orders
     * This creates/updates menuMappings records for ordered items
     * 
     * Enhanced with variant-aware matching:
     * 1. First detects product (Heineken, Beer Lao, etc.) and size variant
     * 2. If known product, finds exact variant match (e.g., Heineken - Large Glass)
     * 3. Falls back to text similarity for unknown products
     */
    analyzeOrderedMenus: async (req, res, db) => {
        try {
            const {
                startDate,
                endDate,
                storeId,
                minOrderCount = 1,
                batchSize = 500
            } = req.body;

            const end = endDate ? new Date(endDate) : new Date();
            const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

            console.log(`[Analyze Ordered Menus] Processing orders from ${start.toISOString()} to ${end.toISOString()}`);

            // Flat schema: each document IS an order item
            const matchStage = {
                createdAt: { $gte: start, $lte: end },
                menuId: { $exists: true, $ne: null }
            };

            if (storeId) {
                matchStage.storeId = new ObjectId(storeId);
            }

            // Get unique menus from orders (flat schema - no $unwind)
            const uniqueMenus = await db.collection('orders').aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: { menuId: '$menuId', storeId: '$storeId' },
                        menuName: { $first: '$name' },
                        orderCount: { $sum: 1 }
                    }
                },
                { $match: { orderCount: { $gte: parseInt(minOrderCount) } } },
                { $sort: { orderCount: -1 } },
                { $limit: parseInt(batchSize) }
            ]).toArray();

            console.log(`[Analyze Ordered Menus] Found ${uniqueMenus.length} unique menus`);

            // Load master menus for matching (once)
            const masterMenus = await db.collection('masterMenus')
                .find({ isDeleted: false, isActive: true })
                .toArray();

            // Pre-load all existing mappings for these menus (batch query instead of individual)
            const menuKeys = uniqueMenus.map(m => ({
                menuId: m._id.menuId,
                storeId: m._id.storeId
            }));

            const existingMappings = await db.collection('menuMappings')
                .find({ $or: menuKeys })
                .toArray();

            // Create lookup map using string keys
            const existingMap = new Map();
            for (const m of existingMappings) {
                const key = `${String(m.menuId)}_${String(m.storeId)}`;
                existingMap.set(key, m);
            }

            console.log(`[Analyze Ordered Menus] Pre-loaded ${existingMappings.length} existing mappings`);

            // Import utilities
            const { findBestMatches } = require('../../utils/textSimilarity');
            const { analyzeMenuName, findBestVariantMatch } = require('../../utils/sizeVariantDetection');

            let created = 0, updated = 0, skipped = 0;
            let variantMatched = 0, textMatched = 0;
            const now = new Date();

            // Prepare bulk operations
            const bulkOps = [];

            for (const menu of uniqueMenus) {
                // Check if mapping already exists (from pre-loaded data)
                const key = `${String(menu._id.menuId)}_${String(menu._id.storeId)}`;
                const existing = existingMap.get(key);

                // Skip ONLY approved mappings - we want to re-analyze everything else
                // to potentially find better matches with updated similarity logic
                if (existing && existing.mappingStatus === 'approved') {
                    skipped++;
                    continue;
                }

                // Also skip if already high confidence suggested (user hasn't reviewed yet)
                // But DO re-analyze low confidence items to potentially find better matches
                if (existing && existing.mappingStatus === 'suggested' && existing.confidenceScore >= 85) {
                    skipped++;
                    continue;
                }

                // Normalize name for matching
                const normalizedName = (menu.menuName || '')
                    .toLowerCase()
                    .trim()
                    .replace(/\s+/g, ' ');

                let mappingData = {
                    menuId: menu._id.menuId,
                    storeId: menu._id.storeId,
                    menuName: menu.menuName,
                    menuName_en: menu.menuName_en,
                    normalizedName,
                    orderCount: menu.orderCount,
                    mappingStatus: 'suggested',
                    updatedAt: now
                };

                // STEP 1: Try variant-aware matching for known products
                const variantAnalysis = analyzeMenuName(menu.menuName);
                
                if (variantAnalysis.isKnownProduct && variantAnalysis.product) {
                    // Filter master menus by this product
                    const productMenus = masterMenus.filter(m => 
                        m.baseProduct === variantAnalysis.product.productId
                    );

                    if (productMenus.length > 0) {
                        const variantMatch = findBestVariantMatch(menu.menuName, productMenus);
                        
                        if (variantMatch && variantMatch.match) {
                            variantMatched++;

                            // Build suggestion list from product variants
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
                            mappingData.usedDefaultVariant = variantAnalysis.usedDefaultVariant;

                            // If high confidence, set the master menu code
                            if (variantMatch.confidence >= 60) {
                                mappingData.masterMenuCode = variantMatch.match.code;
                                mappingData.masterMenuName = variantMatch.match.name;
                                mappingData.masterMenuName_en = variantMatch.match.name_en;
                            }
                        }
                    }
                }

                // STEP 2: Fall back to text similarity if no variant match
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

                // AUTO-APPROVE: If confidence >= 95%, automatically approve the mapping
                // This reduces manual work for high-confidence matches
                const AUTO_APPROVE_THRESHOLD = 95;
                if (mappingData.confidenceScore >= AUTO_APPROVE_THRESHOLD && mappingData.masterMenuCode) {
                    mappingData.mappingStatus = 'approved';
                    mappingData.autoApproved = true;
                    mappingData.approvedAt = now;
                }

                if (existing) {
                    // Queue update
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: existing._id },
                            update: { $set: mappingData }
                        }
                    });
                    updated++;
                } else {
                    // Queue insert
                    mappingData.createdAt = now;
                    bulkOps.push({
                        insertOne: { document: mappingData }
                    });
                    created++;
                }
            }

            // Execute bulk operations in batches
            if (bulkOps.length > 0) {
                console.log(`[Analyze Ordered Menus] Executing ${bulkOps.length} bulk operations`);
                const BULK_BATCH_SIZE = 500;
                for (let i = 0; i < bulkOps.length; i += BULK_BATCH_SIZE) {
                    const batch = bulkOps.slice(i, i + BULK_BATCH_SIZE);
                    await db.collection('menuMappings').bulkWrite(batch, { ordered: false });
                }
            }

            console.log(`[Analyze Ordered Menus] Complete: created=${created}, updated=${updated}, skipped=${skipped}`);

            res.status(200).json({
                message: 'Analysis completed with variant-aware matching',
                data: {
                    totalMenusProcessed: uniqueMenus.length,
                    created,
                    updated,
                    skipped,
                    matchStats: {
                        variantMatched,
                        textMatched,
                        noMatch: uniqueMenus.length - variantMatched - textMatched - skipped
                    },
                    dateRange: {
                        start: start.toISOString(),
                        end: end.toISOString()
                    }
                }
            });
        } catch (error) {
            console.error('Error analyzing ordered menus:', error);
            res.status(500).json({ error: 'Failed to analyze ordered menus' });
        }
    },

    // ============================================
    // JOB-BASED ENDPOINTS (Background Processing)
    // ============================================

    /**
     * Start an analysis job (background processing)
     * Returns jobId immediately, processing happens in background
     */
    startAnalysisJob: async (req, res, db) => {
        try {
            const { startDate, endDate, storeId, minOrderCount = 1 } = req.body;

            // Lazy import to avoid circular dependencies
            const { getAnalysisQueue } = require('../../utils/jobQueue');
            const queue = getAnalysisQueue();

            // Generate a readable job ID
            const timestamp = Date.now();
            const jobId = `analysis-${timestamp}`;

            // Add job to queue
            const job = await queue.add('analyze-menus', {
                startDate,
                endDate,
                storeId,
                minOrderCount
            }, {
                jobId,
                priority: 1
            });

            console.log(`[Analysis Job] Started job ${job.id} for date range ${startDate} - ${endDate}`);

            res.json({
                success: true,
                jobId: job.id,
                message: 'Analysis job started',
                data: {
                    startDate,
                    endDate,
                    storeId,
                    minOrderCount,
                    queuedAt: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Error starting analysis job:', error);
            res.status(500).json({ error: 'Failed to start analysis job', message: error.message });
        }
    },

    /**
     * Get job status and progress (polling)
     */
    getJobStatus: async (req, res, db) => {
        try {
            const { jobId } = req.params;

            const { getJobStatus } = require('../../utils/jobQueue');
            const status = await getJobStatus(jobId);

            if (!status.exists) {
                return res.status(404).json({ error: 'Job not found' });
            }

            res.json({
                success: true,
                data: status
            });

        } catch (error) {
            console.error('Error getting job status:', error);
            res.status(500).json({ error: 'Failed to get job status' });
        }
    },

    /**
     * Stream job progress via Server-Sent Events (SSE)
     */
    streamJobProgress: async (req, res, db) => {
        const { jobId } = req.params;

        console.log(`[SSE] Client connected for job ${jobId}`);

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // For nginx
        res.flushHeaders();

        // Send initial connection message
        res.write(`data: ${JSON.stringify({ type: 'connected', jobId })}\n\n`);

        // Register for progress updates
        const { addSSEClient, removeSSEClient, getJobStatus } = require('../../utils/jobQueue');
        addSSEClient(jobId, res);

        // Check current job status and send immediately
        try {
            const status = await getJobStatus(jobId);
            res.write(`data: ${JSON.stringify({ type: 'status', ...status })}\n\n`);

            // If job is already completed or failed, close after sending status
            if (status.status === 'completed' || status.status === 'failed') {
                setTimeout(() => {
                    res.write(`data: ${JSON.stringify({ type: 'close', reason: 'job_finished' })}\n\n`);
                    res.end();
                }, 1000);
                return;
            }
        } catch (error) {
            console.error('[SSE] Error getting initial status:', error);
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
            console.log(`[SSE] Client disconnected for job ${jobId}`);
            clearInterval(pingInterval);
            removeSSEClient(jobId, res);
        });

        req.on('error', (error) => {
            console.log(`[SSE] Client error for job ${jobId}:`, error.message);
            clearInterval(pingInterval);
            removeSSEClient(jobId, res);
        });
    },

    /**
     * Approve an order-based mapping
     * Updates the mapping status from 'suggested' or 'pending' to 'approved'
     * Also adds the original menu name as a learned keyword
     */
    approveMapping: async (req, res, db) => {
        try {
            const { id } = req.params;
            const { masterMenuCode, approvedBy, notes } = req.body;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing mapping ID'
                });
            }

            if (!masterMenuCode) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing masterMenuCode'
                });
            }

            const menuMappings = db.collection('menuMappings');
            const masterMenus = db.collection('masterMenus');

            // Get the mapping
            const mapping = await menuMappings.findOne({ _id: new ObjectId(id) });
            if (!mapping) {
                return res.status(404).json({
                    success: false,
                    error: 'Mapping not found'
                });
            }

            // Get the master menu to confirm it exists and get its name
            const masterMenu = await masterMenus.findOne({ code: masterMenuCode });
            if (!masterMenu) {
                return res.status(404).json({
                    success: false,
                    error: 'Master menu not found'
                });
            }

            // Update the mapping to approved status
            const updateResult = await menuMappings.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        mappingStatus: 'approved',
                        masterMenuCode: masterMenuCode,
                        masterMenuName: masterMenu.name,
                        masterMenuName_en: masterMenu.name_en,
                        approvedBy: approvedBy || 'admin',
                        approvedAt: new Date(),
                        notes: notes || null,
                        updatedAt: new Date()
                    }
                }
            );

            if (updateResult.modifiedCount === 0) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update mapping'
                });
            }

            // Add the original menu name as a learned keyword (if not already present)
            if (mapping.menuName) {
                await masterMenus.updateOne(
                    { code: masterMenuCode },
                    {
                        $addToSet: {
                            learnedKeywords: mapping.menuName
                        },
                        $set: {
                            updatedAt: new Date()
                        }
                    }
                );
            }

            return res.status(200).json({
                success: true,
                message: 'Mapping approved successfully',
                data: {
                    mappingId: id,
                    masterMenuCode,
                    approvedBy: approvedBy || 'admin',
                    learnedKeyword: mapping.menuName
                }
            });

        } catch (error) {
            console.error('[Approve Mapping] Error:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        }
    }
};

module.exports = orderBasedMappingController;

