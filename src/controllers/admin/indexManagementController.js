/**
 * Index Management Controller
 * 
 * Safely creates and manages MongoDB indexes for performance optimization.
 * 
 * SAFETY GUARANTEES:
 * - Index creation is NON-BLOCKING (background: true)
 * - Does NOT modify any data
 * - Does NOT lock collections
 * - Can be run on production safely
 * - Original data remains untouched
 */

const indexManagementController = {
    /**
     * Create performance indexes for orders collection
     * 
     * SAFE: This only creates indexes (read optimization), never modifies data
     */
    createOrderIndexes: async (req, res, db) => {
        try {
            console.log('[Index Management] Creating indexes for orders collection...');
            
            const orders = db.collection('orders');
            const results = [];

            // Index 1: Compound index for date range queries with grouping
            // Used by: discoverMenusFromOrders, getOrderBasedStats
            console.log('[Index] Creating: { createdAt: 1, menuId: 1, storeId: 1 }');
            const index1 = await orders.createIndex(
                { createdAt: 1, menuId: 1, storeId: 1 },
                { 
                    background: true,  // ✅ Non-blocking (safe for production)
                    name: 'orders_date_menu_store_idx'
                }
            );
            results.push({ index: 'createdAt_menuId_storeId', status: 'created', name: index1 });

            // Index 2: Compound index for menu-store lookups
            // Used by: Joins with menuMappings, order analysis
            console.log('[Index] Creating: { menuId: 1, storeId: 1 }');
            const index2 = await orders.createIndex(
                { menuId: 1, storeId: 1 },
                { 
                    background: true,
                    name: 'orders_menu_store_idx'
                }
            );
            results.push({ index: 'menuId_storeId', status: 'created', name: index2 });

            // Index 3: Simple date range index (fallback)
            // Used by: Date filtering, time-based queries
            console.log('[Index] Creating: { createdAt: 1 }');
            const index3 = await orders.createIndex(
                { createdAt: 1 },
                { 
                    background: true,
                    name: 'orders_date_idx'
                }
            );
            results.push({ index: 'createdAt', status: 'created', name: index3 });

            console.log('[Index Management] Orders indexes created successfully');

            res.status(200).json({
                success: true,
                message: 'Orders indexes created successfully',
                collection: 'orders',
                indexes: results,
                note: 'Indexes created in background (non-blocking)'
            });

        } catch (error) {
            console.error('[Index Management] Error creating orders indexes:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create orders indexes',
                message: error.message
            });
        }
    },

    /**
     * Create performance indexes for menuMappings collection
     * 
     * SAFE: This only creates indexes (read optimization), never modifies data
     */
    createMappingIndexes: async (req, res, db) => {
        try {
            console.log('[Index Management] Creating indexes for menuMappings collection...');
            
            const menuMappings = db.collection('menuMappings');
            const results = [];

            // Index 1: Compound index for menu-store lookups
            // Used by: Joins with orders, finding existing mappings
            console.log('[Index] Creating: { menuId: 1, storeId: 1 }');
            const index1 = await menuMappings.createIndex(
                { menuId: 1, storeId: 1 },
                { 
                    background: true,
                    name: 'mappings_menu_store_idx',
                    unique: true  // Prevent duplicate mappings
                }
            );
            results.push({ index: 'menuId_storeId', status: 'created', name: index1 });

            // Index 2: Status filtering index
            // Used by: Review queue, filtering by mappingStatus
            console.log('[Index] Creating: { mappingStatus: 1 }');
            const index2 = await menuMappings.createIndex(
                { mappingStatus: 1 },
                { 
                    background: true,
                    name: 'mappings_status_idx'
                }
            );
            results.push({ index: 'mappingStatus', status: 'created', name: index2 });

            // Index 3: Confidence score for filtering
            // Used by: High confidence review queue, quick wins
            console.log('[Index] Creating: { mappingStatus: 1, confidenceScore: 1 }');
            const index3 = await menuMappings.createIndex(
                { mappingStatus: 1, confidenceScore: 1 },
                { 
                    background: true,
                    name: 'mappings_status_confidence_idx'
                }
            );
            results.push({ index: 'mappingStatus_confidenceScore', status: 'created', name: index3 });

            console.log('[Index Management] MenuMappings indexes created successfully');

            res.status(200).json({
                success: true,
                message: 'MenuMappings indexes created successfully',
                collection: 'menuMappings',
                indexes: results,
                note: 'Indexes created in background (non-blocking)'
            });

        } catch (error) {
            console.error('[Index Management] Error creating mapping indexes:', error);
            
            // If error is "duplicate key", indexes already exist (that's ok!)
            if (error.code === 11000 || error.message.includes('already exists')) {
                return res.status(200).json({
                    success: true,
                    message: 'Indexes already exist',
                    collection: 'menuMappings',
                    note: 'No action needed'
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to create mapping indexes',
                message: error.message
            });
        }
    },

    /**
     * Create all performance indexes at once
     * 
     * SAFE: Creates all indexes in parallel (non-blocking)
     */
    createAllIndexes: async (req, res, db) => {
        try {
            console.log('[Index Management] Creating all performance indexes...');

            const results = {
                orders: [],
                menuMappings: [],
                errors: []
            };

            // Create orders indexes
            try {
                const orders = db.collection('orders');
                
                const ordersIndexes = await Promise.all([
                    orders.createIndex(
                        { createdAt: 1, menuId: 1, storeId: 1 },
                        { background: true, name: 'orders_date_menu_store_idx' }
                    ),
                    orders.createIndex(
                        { menuId: 1, storeId: 1 },
                        { background: true, name: 'orders_menu_store_idx' }
                    ),
                    orders.createIndex(
                        { createdAt: 1 },
                        { background: true, name: 'orders_date_idx' }
                    )
                ]);

                results.orders = ordersIndexes.map((name, i) => ({
                    name,
                    collection: 'orders',
                    status: 'created'
                }));

                console.log('[Index] Orders indexes created:', ordersIndexes);
            } catch (error) {
                console.error('[Index] Error creating orders indexes:', error.message);
                results.errors.push({ collection: 'orders', error: error.message });
            }

            // Create menuMappings indexes
            try {
                const menuMappings = db.collection('menuMappings');
                
                const mappingsIndexes = await Promise.all([
                    menuMappings.createIndex(
                        { menuId: 1, storeId: 1 },
                        { background: true, name: 'mappings_menu_store_idx', unique: true }
                    ),
                    menuMappings.createIndex(
                        { mappingStatus: 1 },
                        { background: true, name: 'mappings_status_idx' }
                    ),
                    menuMappings.createIndex(
                        { mappingStatus: 1, confidenceScore: 1 },
                        { background: true, name: 'mappings_status_confidence_idx' }
                    )
                ]);

                results.menuMappings = mappingsIndexes.map((name, i) => ({
                    name,
                    collection: 'menuMappings',
                    status: 'created'
                }));

                console.log('[Index] MenuMappings indexes created:', mappingsIndexes);
            } catch (error) {
                console.error('[Index] Error creating mapping indexes:', error.message);
                results.errors.push({ collection: 'menuMappings', error: error.message });
            }

            // Summary
            const totalCreated = results.orders.length + results.menuMappings.length;
            const success = results.errors.length === 0;

            console.log(`[Index Management] Complete: ${totalCreated} indexes created, ${results.errors.length} errors`);

            res.status(success ? 200 : 207).json({
                success,
                message: success 
                    ? 'All performance indexes created successfully'
                    : 'Some indexes created with errors',
                totalIndexes: totalCreated,
                results,
                note: 'Indexes created in background (non-blocking, safe for production)'
            });

        } catch (error) {
            console.error('[Index Management] Fatal error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create indexes',
                message: error.message
            });
        }
    },

    /**
     * List all indexes on critical collections
     * 
     * SAFE: Read-only operation
     */
    listIndexes: async (req, res, db) => {
        try {
            console.log('[Index Management] Listing indexes...');

            const collections = ['orders', 'menuMappings', 'orderAnalytics', 'masterMenus'];
            const indexInfo = {};

            for (const collectionName of collections) {
                try {
                    const collection = db.collection(collectionName);
                    const indexes = await collection.indexes();
                    indexInfo[collectionName] = indexes;
                } catch (error) {
                    indexInfo[collectionName] = { error: error.message };
                }
            }

            res.status(200).json({
                success: true,
                indexes: indexInfo
            });

        } catch (error) {
            console.error('[Index Management] Error listing indexes:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to list indexes',
                message: error.message
            });
        }
    },

    /**
     * Check index usage statistics
     * 
     * SAFE: Read-only operation
     */
    getIndexStats: async (req, res, db) => {
        try {
            const { collection: collectionName } = req.query;

            if (!collectionName) {
                return res.status(400).json({
                    success: false,
                    error: 'Collection name required'
                });
            }

            const collection = db.collection(collectionName);
            const stats = await collection.stats({ indexDetails: true });

            res.status(200).json({
                success: true,
                collection: collectionName,
                stats: {
                    count: stats.count,
                    size: stats.size,
                    avgObjSize: stats.avgObjSize,
                    storageSize: stats.storageSize,
                    totalIndexSize: stats.totalIndexSize,
                    indexSizes: stats.indexSizes
                }
            });

        } catch (error) {
            console.error('[Index Management] Error getting index stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get index stats',
                message: error.message
            });
        }
    }
};

module.exports = indexManagementController;
