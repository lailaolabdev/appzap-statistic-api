/**
 * Master Restaurant Category Controller
 * 
 * Handles CRUD operations for master restaurant categories.
 * Provides template generation for new restaurants.
 */

const { generateMasterRestaurantCategoryCode } = require('../../utils/codeGenerator');
const { findBestMatches } = require('../../utils/textSimilarity');

const COLLECTION_NAME = 'masterRestaurantCategories';

const masterRestaurantCategoryController = {
    /**
     * Create a new master restaurant category
     */
    create: async (req, res, db) => {
        try {
            const {
                code = null, // Optional: allow custom readable code like RCAT-BEERGARDEN
                name,
                name_en = '',
                name_th = '',
                name_cn = '',
                name_kr = '',
                name_jp = '',
                name_vi = '',
                keywords = [],
                description = '',
                icon = '',
                coverImage = '',
                typicalMenuCount = 50,
                typicalCategoryCount = 8,
                characteristics = {},
                sortOrder = 0
            } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            // Use provided code or generate one
            const finalCode = code || generateMasterRestaurantCategoryCode();
            const now = new Date();

            const document = {
                code: finalCode,
                name,
                name_en,
                name_th,
                name_cn,
                name_kr,
                name_jp,
                name_vi,
                keywords,
                description,
                icon,
                coverImage,
                // NOTE: recommendedCategoryCodes and recommendedMenuCodes are removed
                // The relationship is reversed - categories/menus have recommendedRestaurantTypes
                typicalMenuCount,
                typicalCategoryCount,
                characteristics: {
                    hasAlcohol: characteristics.hasAlcohol || false,
                    hasFood: characteristics.hasFood !== false,
                    hasDineIn: characteristics.hasDineIn !== false,
                    hasTakeaway: characteristics.hasTakeaway !== false,
                    hasDelivery: characteristics.hasDelivery || false,
                    typicalOperatingHours: characteristics.typicalOperatingHours || '',
                    peakHours: characteristics.peakHours || [],
                    avgTicketSize: characteristics.avgTicketSize || 0,
                    targetCustomers: characteristics.targetCustomers || []
                },
                sortOrder,
                isActive: true,
                isDeleted: false,
                createdAt: now,
                updatedAt: now
            };

            const result = await db.collection(COLLECTION_NAME).insertOne(document);

            res.status(201).json({
                message: 'Master restaurant category created successfully',
                data: { ...document, _id: result.insertedId }
            });
        } catch (error) {
            console.error('Error creating master restaurant category:', error);
            res.status(500).json({ error: 'Failed to create master restaurant category' });
        }
    },

    /**
     * Get all master restaurant categories
     */
    getAll: async (req, res, db) => {
        try {
            const { 
                includeDeleted = 'false',
                activeOnly = 'true',
                search = '',
                limit = 100,
                skip = 0,
                sortBy = 'sortOrder',
                sortOrder = 'asc'
            } = req.query;

            const query = {};
            
            if (includeDeleted !== 'true') {
                query.isDeleted = false;
            }
            
            if (activeOnly === 'true') {
                query.isActive = true;
            }

            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { name_en: { $regex: search, $options: 'i' } },
                    { keywords: { $regex: search, $options: 'i' } }
                ];
            }

            const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

            const [categories, total] = await Promise.all([
                db.collection(COLLECTION_NAME)
                    .find(query)
                    .sort(sort)
                    .skip(parseInt(skip))
                    .limit(parseInt(limit))
                    .toArray(),
                db.collection(COLLECTION_NAME).countDocuments(query)
            ]);

            res.status(200).json({
                data: categories,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    skip: parseInt(skip),
                    hasMore: parseInt(skip) + categories.length < total
                }
            });
        } catch (error) {
            console.error('Error fetching master restaurant categories:', error);
            res.status(500).json({ error: 'Failed to fetch master restaurant categories' });
        }
    },

    /**
     * Get a single master restaurant category by code
     */
    getByCode: async (req, res, db) => {
        try {
            const { code } = req.params;

            const category = await db.collection(COLLECTION_NAME).findOne({ 
                code, 
                isDeleted: false 
            });

            if (!category) {
                return res.status(404).json({ error: 'Master restaurant category not found' });
            }

            res.status(200).json({ data: category });
        } catch (error) {
            console.error('Error fetching master restaurant category:', error);
            res.status(500).json({ error: 'Failed to fetch master restaurant category' });
        }
    },

    /**
     * Get full template (recommended categories and menus) for a restaurant type
     * 
     * Uses the reverse relationship approach:
     * - Categories and menus have `recommendedRestaurantTypes` array
     * - This endpoint queries them by matching the restaurant category code
     */
    getTemplate: async (req, res, db) => {
        try {
            const { code } = req.params;

            const restaurantCategory = await db.collection(COLLECTION_NAME).findOne({ 
                code, 
                isDeleted: false 
            });

            if (!restaurantCategory) {
                return res.status(404).json({ error: 'Master restaurant category not found' });
            }

            // Fetch categories that recommend this restaurant type
            // Using the reverse relationship: categories have recommendedRestaurantTypes array
            const recommendedCategories = await db.collection('masterCategories')
                .find({ 
                    recommendedRestaurantTypes: code,
                    isActive: true,
                    isDeleted: false 
                })
                .sort({ sortOrder: 1 })
                .toArray();

            // Fetch menus that recommend this restaurant type
            // Using the reverse relationship: menus have recommendedRestaurantTypes array
            const recommendedMenus = await db.collection('masterMenus')
                .find({ 
                    recommendedRestaurantTypes: code,
                    isActive: true,
                    isDeleted: false 
                })
                .sort({ sortOrder: 1 })
                .toArray();

            // Group menus by category
            const menusByCategory = {};
            for (const menu of recommendedMenus) {
                if (!menusByCategory[menu.masterCategoryCode]) {
                    menusByCategory[menu.masterCategoryCode] = [];
                }
                menusByCategory[menu.masterCategoryCode].push(menu);
            }

            // Get category names for the grouped menus
            const categoryCodeSet = new Set(Object.keys(menusByCategory));
            const categoriesForGrouping = await db.collection('masterCategories')
                .find({ 
                    code: { $in: Array.from(categoryCodeSet) },
                    isDeleted: false 
                })
                .toArray();
            
            const categoryNameMap = {};
            categoriesForGrouping.forEach(cat => {
                categoryNameMap[cat.code] = {
                    name: cat.name,
                    name_en: cat.name_en,
                    name_vi: cat.name_vi
                };
            });

            res.status(200).json({
                restaurantCategory: {
                    code: restaurantCategory.code,
                    name: restaurantCategory.name,
                    name_en: restaurantCategory.name_en,
                    name_vi: restaurantCategory.name_vi,
                    characteristics: restaurantCategory.characteristics
                },
                template: {
                    categories: recommendedCategories,
                    menus: recommendedMenus,
                    menusByCategory,
                    categoryNameMap,
                    summary: {
                        totalCategories: recommendedCategories.length,
                        totalMenus: recommendedMenus.length
                    }
                }
            });
        } catch (error) {
            console.error('Error fetching template:', error);
            res.status(500).json({ error: 'Failed to fetch template' });
        }
    },

    /**
     * Update a master restaurant category
     */
    update: async (req, res, db) => {
        try {
            const { code } = req.params;
            const updates = req.body;

            // Remove fields that shouldn't be updated
            delete updates._id;
            delete updates.code;
            delete updates.createdAt;

            updates.updatedAt = new Date();

            const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
                { code, isDeleted: false },
                { $set: updates },
                { returnDocument: 'after' }
            );

            if (!result) {
                return res.status(404).json({ error: 'Master restaurant category not found' });
            }

            res.status(200).json({
                message: 'Master restaurant category updated successfully',
                data: result
            });
        } catch (error) {
            console.error('Error updating master restaurant category:', error);
            res.status(500).json({ error: 'Failed to update master restaurant category' });
        }
    },

    /**
     * @deprecated - Use reverse relationship instead
     * 
     * The relationship has been reversed for scalability.
     * Instead of adding category codes here, update the category's
     * `recommendedRestaurantTypes` array to include this restaurant type code.
     * 
     * Example: To link a category to Beer Garden, update the category:
     * PUT /api/v1/master/categories/:categoryCode
     * { "recommendedRestaurantTypes": ["RCAT-BEERGARDEN", "RCAT-BAR"] }
     */
    addRecommendedCategories: async (req, res, db) => {
        return res.status(410).json({ 
            error: 'This endpoint is deprecated',
            message: 'The relationship has been reversed. Update the category\'s recommendedRestaurantTypes array instead.',
            example: 'PUT /api/v1/master/categories/:code with { "recommendedRestaurantTypes": ["RCAT-BEERGARDEN"] }'
        });
    },

    /**
     * @deprecated - Use reverse relationship instead
     * 
     * The relationship has been reversed for scalability.
     * Instead of adding menu codes here, update the menu's
     * `recommendedRestaurantTypes` array to include this restaurant type code.
     * 
     * Example: To link a menu to Beer Garden, update the menu:
     * PUT /api/v1/master/menus/:menuCode
     * { "recommendedRestaurantTypes": ["RCAT-BEERGARDEN", "RCAT-BAR"] }
     */
    addRecommendedMenus: async (req, res, db) => {
        return res.status(410).json({ 
            error: 'This endpoint is deprecated',
            message: 'The relationship has been reversed. Update the menu\'s recommendedRestaurantTypes array instead.',
            example: 'PUT /api/v1/master/menus/:code with { "recommendedRestaurantTypes": ["RCAT-BEERGARDEN"] }'
        });
    },

    /**
     * Soft delete a master restaurant category
     */
    delete: async (req, res, db) => {
        try {
            const { code } = req.params;

            const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
                { code, isDeleted: false },
                { 
                    $set: { 
                        isDeleted: true, 
                        isActive: false,
                        updatedAt: new Date() 
                    } 
                },
                { returnDocument: 'after' }
            );

            if (!result) {
                return res.status(404).json({ error: 'Master restaurant category not found' });
            }

            res.status(200).json({
                message: 'Master restaurant category deleted successfully',
                data: result
            });
        } catch (error) {
            console.error('Error deleting master restaurant category:', error);
            res.status(500).json({ error: 'Failed to delete master restaurant category' });
        }
    },

    /**
     * Bulk create master restaurant categories
     */
    bulkCreate: async (req, res, db) => {
        try {
            const { categories } = req.body;

            if (!Array.isArray(categories) || categories.length === 0) {
                return res.status(400).json({ error: 'Categories array is required' });
            }

            const now = new Date();
            const documents = categories.map(cat => ({
                code: generateMasterRestaurantCategoryCode(),
                name: cat.name,
                name_en: cat.name_en || '',
                name_th: cat.name_th || '',
                name_cn: cat.name_cn || '',
                name_kr: cat.name_kr || '',
                name_jp: cat.name_jp || '',
                keywords: cat.keywords || [],
                description: cat.description || '',
                icon: cat.icon || '',
                coverImage: cat.coverImage || '',
                recommendedCategoryCodes: cat.recommendedCategoryCodes || [],
                recommendedMenuCodes: cat.recommendedMenuCodes || [],
                typicalMenuCount: cat.typicalMenuCount || 50,
                typicalCategoryCount: cat.typicalCategoryCount || 8,
                characteristics: cat.characteristics || {},
                sortOrder: cat.sortOrder || 0,
                isActive: true,
                isDeleted: false,
                createdAt: now,
                updatedAt: now
            }));

            const result = await db.collection(COLLECTION_NAME).insertMany(documents);

            res.status(201).json({
                message: `${result.insertedCount} master restaurant categories created successfully`,
                data: documents
            });
        } catch (error) {
            console.error('Error bulk creating master restaurant categories:', error);
            res.status(500).json({ error: 'Failed to bulk create master restaurant categories' });
        }
    }
};

module.exports = masterRestaurantCategoryController;
