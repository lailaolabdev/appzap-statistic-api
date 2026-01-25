/**
 * Analytics Controller
 * 
 * Provides cross-store analytics using master data mappings.
 * Includes top-selling menus/categories and ingredient consumption analysis.
 */

const { ObjectId } = require('mongodb');

const analyticsController = {
    /**
     * Get top selling master menus across stores
     * Uses menu mappings to aggregate sales data
     */
    getTopSellingMasterMenus: async (req, res, db) => {
        try {
            const { 
                startDate, 
                endDate, 
                storeIds,
                limit = 20,
                skip = 0
            } = req.query;

            // Build match query for orders
            const matchQuery = {
                isCheckOut: true,
                status: 'SERVED'
            };

            if (startDate) {
                matchQuery.createdAt = { $gte: new Date(startDate) };
            }

            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                matchQuery.createdAt = { ...matchQuery.createdAt, $lte: end };
            }

            if (storeIds) {
                matchQuery.storeId = { 
                    $in: storeIds.split(',').map(id => new ObjectId(id.trim())) 
                };
            }

            // Aggregate orders with menu mappings
            const result = await db.collection('orders').aggregate([
                { $match: matchQuery },
                // Join with menu mappings
                {
                    $lookup: {
                        from: 'menuMappings',
                        localField: 'menuId',
                        foreignField: 'menuId',
                        as: 'mapping'
                    }
                },
                // Only include orders with mappings
                { $match: { 'mapping.0': { $exists: true } } },
                { $unwind: '$mapping' },
                // Join with master menus
                {
                    $lookup: {
                        from: 'masterMenus',
                        localField: 'mapping.masterMenuCode',
                        foreignField: 'code',
                        as: 'masterMenu'
                    }
                },
                { $unwind: '$masterMenu' },
                // Group by master menu
                {
                    $group: {
                        _id: '$mapping.masterMenuCode',
                        masterMenuName: { $first: '$masterMenu.name' },
                        masterMenuNameEn: { $first: '$masterMenu.name_en' },
                        masterCategoryCode: { $first: '$masterMenu.masterCategoryCode' },
                        totalQuantity: { $sum: '$quantity' },
                        totalRevenue: { $sum: { $multiply: ['$quantity', '$price'] } },
                        orderCount: { $sum: 1 },
                        uniqueStores: { $addToSet: '$storeId' },
                        avgPrice: { $avg: '$price' }
                    }
                },
                // Calculate store count
                {
                    $addFields: {
                        storeCount: { $size: '$uniqueStores' }
                    }
                },
                // Sort by quantity
                { $sort: { totalQuantity: -1 } },
                // Pagination
                { $skip: parseInt(skip) },
                { $limit: parseInt(limit) },
                // Clean up output
                {
                    $project: {
                        masterMenuCode: '$_id',
                        masterMenuName: 1,
                        masterMenuNameEn: 1,
                        masterCategoryCode: 1,
                        totalQuantity: 1,
                        totalRevenue: 1,
                        orderCount: 1,
                        storeCount: 1,
                        avgPrice: { $round: ['$avgPrice', 2] },
                        _id: 0
                    }
                }
            ]).toArray();

            // Get total count for pagination
            const totalCount = await db.collection('orders').aggregate([
                { $match: matchQuery },
                {
                    $lookup: {
                        from: 'menuMappings',
                        localField: 'menuId',
                        foreignField: 'menuId',
                        as: 'mapping'
                    }
                },
                { $match: { 'mapping.0': { $exists: true } } },
                { $unwind: '$mapping' },
                { $group: { _id: '$mapping.masterMenuCode' } },
                { $count: 'total' }
            ]).toArray();

            res.status(200).json({
                data: result,
                pagination: {
                    total: totalCount[0]?.total || 0,
                    limit: parseInt(limit),
                    skip: parseInt(skip)
                }
            });
        } catch (error) {
            console.error('Error fetching top selling master menus:', error);
            res.status(500).json({ error: 'Failed to fetch analytics' });
        }
    },

    /**
     * Get top selling master categories across stores
     */
    getTopSellingMasterCategories: async (req, res, db) => {
        try {
            const { 
                startDate, 
                endDate, 
                storeIds,
                limit = 20
            } = req.query;

            const matchQuery = {
                isCheckOut: true,
                status: 'SERVED'
            };

            if (startDate) {
                matchQuery.createdAt = { $gte: new Date(startDate) };
            }

            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                matchQuery.createdAt = { ...matchQuery.createdAt, $lte: end };
            }

            if (storeIds) {
                matchQuery.storeId = { 
                    $in: storeIds.split(',').map(id => new ObjectId(id.trim())) 
                };
            }

            const result = await db.collection('orders').aggregate([
                { $match: matchQuery },
                // Join with menu mappings
                {
                    $lookup: {
                        from: 'menuMappings',
                        localField: 'menuId',
                        foreignField: 'menuId',
                        as: 'mapping'
                    }
                },
                { $match: { 'mapping.0': { $exists: true } } },
                { $unwind: '$mapping' },
                // Join with master menus to get category
                {
                    $lookup: {
                        from: 'masterMenus',
                        localField: 'mapping.masterMenuCode',
                        foreignField: 'code',
                        as: 'masterMenu'
                    }
                },
                { $unwind: '$masterMenu' },
                // Join with master categories
                {
                    $lookup: {
                        from: 'masterCategories',
                        localField: 'masterMenu.masterCategoryCode',
                        foreignField: 'code',
                        as: 'masterCategory'
                    }
                },
                { $unwind: '$masterCategory' },
                // Group by master category
                {
                    $group: {
                        _id: '$masterMenu.masterCategoryCode',
                        masterCategoryName: { $first: '$masterCategory.name' },
                        masterCategoryNameEn: { $first: '$masterCategory.name_en' },
                        totalQuantity: { $sum: '$quantity' },
                        totalRevenue: { $sum: { $multiply: ['$quantity', '$price'] } },
                        orderCount: { $sum: 1 },
                        uniqueMenus: { $addToSet: '$mapping.masterMenuCode' },
                        uniqueStores: { $addToSet: '$storeId' }
                    }
                },
                {
                    $addFields: {
                        menuCount: { $size: '$uniqueMenus' },
                        storeCount: { $size: '$uniqueStores' }
                    }
                },
                { $sort: { totalQuantity: -1 } },
                { $limit: parseInt(limit) },
                {
                    $project: {
                        masterCategoryCode: '$_id',
                        masterCategoryName: 1,
                        masterCategoryNameEn: 1,
                        totalQuantity: 1,
                        totalRevenue: 1,
                        orderCount: 1,
                        menuCount: 1,
                        storeCount: 1,
                        _id: 0
                    }
                }
            ]).toArray();

            res.status(200).json({ data: result });
        } catch (error) {
            console.error('Error fetching top selling master categories:', error);
            res.status(500).json({ error: 'Failed to fetch analytics' });
        }
    },

    /**
     * Calculate ingredient consumption based on orders and recipes
     */
    getIngredientConsumption: async (req, res, db) => {
        try {
            const { 
                startDate, 
                endDate, 
                storeIds,
                ingredientCategoryCode,
                limit = 50
            } = req.query;

            const matchQuery = {
                isCheckOut: true,
                status: 'SERVED'
            };

            if (startDate) {
                matchQuery.createdAt = { $gte: new Date(startDate) };
            }

            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                matchQuery.createdAt = { ...matchQuery.createdAt, $lte: end };
            }

            if (storeIds) {
                matchQuery.storeId = { 
                    $in: storeIds.split(',').map(id => new ObjectId(id.trim())) 
                };
            }

            // First, get order quantities grouped by master menu
            const ordersByMenu = await db.collection('orders').aggregate([
                { $match: matchQuery },
                {
                    $lookup: {
                        from: 'menuMappings',
                        localField: 'menuId',
                        foreignField: 'menuId',
                        as: 'mapping'
                    }
                },
                { $match: { 'mapping.0': { $exists: true } } },
                { $unwind: '$mapping' },
                {
                    $group: {
                        _id: '$mapping.masterMenuCode',
                        totalQuantity: { $sum: '$quantity' }
                    }
                }
            ]).toArray();

            // Create a map of menu quantities
            const menuQuantities = new Map(ordersByMenu.map(o => [o._id, o.totalQuantity]));

            // Get recipes for these menus
            const menuCodes = Array.from(menuQuantities.keys());
            const recipes = await db.collection('masterRecipes')
                .find({ 
                    masterMenuCode: { $in: menuCodes },
                    isDeleted: false,
                    isPrimary: true
                })
                .toArray();

            // Calculate ingredient consumption
            const ingredientConsumption = new Map();

            for (const recipe of recipes) {
                const menuQuantity = menuQuantities.get(recipe.masterMenuCode) || 0;
                const servingsOrdered = menuQuantity / recipe.servingSize;

                for (const ingredient of recipe.ingredients) {
                    const consumedGrams = ingredient.quantity * servingsOrdered;
                    const current = ingredientConsumption.get(ingredient.masterIngredientCode) || {
                        code: ingredient.masterIngredientCode,
                        name: ingredient.ingredientName,
                        nameEn: ingredient.ingredientNameEn,
                        totalGrams: 0,
                        usedInMenus: new Set(),
                        orderCount: 0
                    };

                    current.totalGrams += consumedGrams;
                    current.usedInMenus.add(recipe.masterMenuCode);
                    current.orderCount += menuQuantity;

                    ingredientConsumption.set(ingredient.masterIngredientCode, current);
                }
            }

            // Convert to array and enrich with ingredient details
            let result = Array.from(ingredientConsumption.values())
                .map(ing => ({
                    ...ing,
                    usedInMenus: ing.usedInMenus.size,
                    totalKg: Math.round(ing.totalGrams / 1000 * 100) / 100,
                    totalGrams: Math.round(ing.totalGrams * 100) / 100
                }))
                .sort((a, b) => b.totalGrams - a.totalGrams);

            // Filter by ingredient category if specified
            if (ingredientCategoryCode) {
                const ingredientCodes = result.map(r => r.code);
                const ingredients = await db.collection('masterIngredients')
                    .find({ 
                        code: { $in: ingredientCodes },
                        masterIngredientCategoryCode: ingredientCategoryCode
                    })
                    .toArray();
                const validCodes = new Set(ingredients.map(i => i.code));
                result = result.filter(r => validCodes.has(r.code));
            }

            // Apply limit
            result = result.slice(0, parseInt(limit));

            res.status(200).json({
                dateRange: {
                    startDate: startDate || 'all',
                    endDate: endDate || 'all'
                },
                data: result,
                summary: {
                    totalIngredients: result.length,
                    totalConsumptionKg: Math.round(result.reduce((sum, r) => sum + r.totalKg, 0) * 100) / 100
                }
            });
        } catch (error) {
            console.error('Error calculating ingredient consumption:', error);
            res.status(500).json({ error: 'Failed to calculate consumption' });
        }
    },

    /**
     * Get analytics summary dashboard
     */
    getDashboardSummary: async (req, res, db) => {
        try {
            const { startDate, endDate, storeIds } = req.query;

            const matchQuery = {
                isCheckOut: true,
                status: 'SERVED'
            };

            if (startDate) {
                matchQuery.createdAt = { $gte: new Date(startDate) };
            }

            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                matchQuery.createdAt = { ...matchQuery.createdAt, $lte: end };
            }

            if (storeIds) {
                matchQuery.storeId = { 
                    $in: storeIds.split(',').map(id => new ObjectId(id.trim())) 
                };
            }

            const [
                orderStats,
                masterDataStats,
                mappingStats
            ] = await Promise.all([
                // Order statistics
                db.collection('orders').aggregate([
                    { $match: matchQuery },
                    {
                        $group: {
                            _id: null,
                            totalOrders: { $sum: 1 },
                            totalQuantity: { $sum: '$quantity' },
                            totalRevenue: { $sum: { $multiply: ['$quantity', '$price'] } },
                            uniqueMenus: { $addToSet: '$menuId' },
                            uniqueStores: { $addToSet: '$storeId' }
                        }
                    }
                ]).toArray(),

                // Master data statistics
                Promise.all([
                    db.collection('masterCategories').countDocuments({ isDeleted: false }),
                    db.collection('masterMenus').countDocuments({ isDeleted: false }),
                    db.collection('masterIngredientCategories').countDocuments({ isDeleted: false }),
                    db.collection('masterIngredients').countDocuments({ isDeleted: false }),
                    db.collection('masterRecipeCategories').countDocuments({ isDeleted: false }),
                    db.collection('masterRecipes').countDocuments({ isDeleted: false })
                ]),

                // Mapping statistics
                Promise.all([
                    db.collection('menuMappings').countDocuments({ isActive: true }),
                    db.collection('categoryMappings').countDocuments({ isActive: true })
                ])
            ]);

            const stats = orderStats[0] || {
                totalOrders: 0,
                totalQuantity: 0,
                totalRevenue: 0,
                uniqueMenus: [],
                uniqueStores: []
            };

            res.status(200).json({
                orders: {
                    totalOrders: stats.totalOrders,
                    totalQuantity: stats.totalQuantity,
                    totalRevenue: stats.totalRevenue,
                    uniqueMenuCount: stats.uniqueMenus?.length || 0,
                    uniqueStoreCount: stats.uniqueStores?.length || 0
                },
                masterData: {
                    masterCategories: masterDataStats[0],
                    masterMenus: masterDataStats[1],
                    masterIngredientCategories: masterDataStats[2],
                    masterIngredients: masterDataStats[3],
                    masterRecipeCategories: masterDataStats[4],
                    masterRecipes: masterDataStats[5]
                },
                mappings: {
                    menuMappings: mappingStats[0],
                    categoryMappings: mappingStats[1]
                }
            });
        } catch (error) {
            console.error('Error fetching dashboard summary:', error);
            res.status(500).json({ error: 'Failed to fetch summary' });
        }
    }
};

module.exports = analyticsController;
