/**
 * Master Menu Controller
 * 
 * Handles CRUD operations for master menu items.
 */

const { generateMasterMenuCode } = require('../../utils/codeGenerator');
const { findBestMatches } = require('../../utils/textSimilarity');

const COLLECTION_NAME = 'masterMenus';

const masterMenuController = {
    /**
     * Create a new master menu
     */
    create: async (req, res, db) => {
        try {
            const {
                masterCategoryCode,
                name,
                name_en = '',
                name_th = '',
                name_cn = '',
                name_kr = '',
                keywords = [],
                description = '',
                imageUrl = '',
                allergens = [],
                isVegetarian = false,
                isVegan = false,
                isHalal = false,
                isGlutenFree = false,
                spiceLevel = 0,
                prepTimeMinutes = 0,
                sortOrder = 0
            } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            if (!masterCategoryCode) {
                return res.status(400).json({ error: 'Master category code is required' });
            }

            // Verify category exists
            const category = await db.collection('masterCategories').findOne({ 
                code: masterCategoryCode, 
                isDeleted: false 
            });

            if (!category) {
                return res.status(400).json({ error: 'Invalid master category code' });
            }

            const code = generateMasterMenuCode();
            const now = new Date();

            const document = {
                code,
                masterCategoryCode,
                name,
                name_en,
                name_th,
                name_cn,
                name_kr,
                keywords,
                description,
                imageUrl,
                allergens,
                isVegetarian,
                isVegan,
                isHalal,
                isGlutenFree,
                spiceLevel,
                prepTimeMinutes,
                sortOrder,
                isActive: true,
                isDeleted: false,
                createdAt: now,
                updatedAt: now
            };

            const result = await db.collection(COLLECTION_NAME).insertOne(document);

            res.status(201).json({
                message: 'Master menu created successfully',
                data: { ...document, _id: result.insertedId }
            });
        } catch (error) {
            console.error('Error creating master menu:', error);
            res.status(500).json({ error: 'Failed to create master menu' });
        }
    },

    /**
     * Get all master menus
     */
    getAll: async (req, res, db) => {
        try {
            const { 
                includeDeleted = 'false',
                activeOnly = 'true',
                masterCategoryCode = '',
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

            if (masterCategoryCode) {
                query.masterCategoryCode = masterCategoryCode;
            }

            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { name_en: { $regex: search, $options: 'i' } },
                    { keywords: { $regex: search, $options: 'i' } }
                ];
            }

            const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

            const [menus, total] = await Promise.all([
                db.collection(COLLECTION_NAME)
                    .find(query)
                    .sort(sort)
                    .skip(parseInt(skip))
                    .limit(parseInt(limit))
                    .toArray(),
                db.collection(COLLECTION_NAME).countDocuments(query)
            ]);

            res.status(200).json({
                data: menus,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    skip: parseInt(skip),
                    hasMore: parseInt(skip) + menus.length < total
                }
            });
        } catch (error) {
            console.error('Error fetching master menus:', error);
            res.status(500).json({ error: 'Failed to fetch master menus' });
        }
    },

    /**
     * Get a single master menu by code
     */
    getByCode: async (req, res, db) => {
        try {
            const { code } = req.params;

            const menu = await db.collection(COLLECTION_NAME).findOne({ 
                code, 
                isDeleted: false 
            });

            if (!menu) {
                return res.status(404).json({ error: 'Master menu not found' });
            }

            // Also fetch the category details
            const category = await db.collection('masterCategories').findOne({
                code: menu.masterCategoryCode,
                isDeleted: false
            });

            res.status(200).json({ 
                data: {
                    ...menu,
                    category
                }
            });
        } catch (error) {
            console.error('Error fetching master menu:', error);
            res.status(500).json({ error: 'Failed to fetch master menu' });
        }
    },

    /**
     * Update a master menu
     */
    update: async (req, res, db) => {
        try {
            const { code } = req.params;
            const updates = req.body;

            // Remove fields that shouldn't be updated
            delete updates._id;
            delete updates.code;
            delete updates.createdAt;

            // If updating category, verify it exists
            if (updates.masterCategoryCode) {
                const category = await db.collection('masterCategories').findOne({ 
                    code: updates.masterCategoryCode, 
                    isDeleted: false 
                });

                if (!category) {
                    return res.status(400).json({ error: 'Invalid master category code' });
                }
            }

            updates.updatedAt = new Date();

            const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
                { code, isDeleted: false },
                { $set: updates },
                { returnDocument: 'after' }
            );

            if (!result) {
                return res.status(404).json({ error: 'Master menu not found' });
            }

            res.status(200).json({
                message: 'Master menu updated successfully',
                data: result
            });
        } catch (error) {
            console.error('Error updating master menu:', error);
            res.status(500).json({ error: 'Failed to update master menu' });
        }
    },

    /**
     * Soft delete a master menu
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
                return res.status(404).json({ error: 'Master menu not found' });
            }

            res.status(200).json({
                message: 'Master menu deleted successfully',
                data: result
            });
        } catch (error) {
            console.error('Error deleting master menu:', error);
            res.status(500).json({ error: 'Failed to delete master menu' });
        }
    },

    /**
     * Bulk create master menus
     */
    bulkCreate: async (req, res, db) => {
        try {
            const { menus } = req.body;

            if (!Array.isArray(menus) || menus.length === 0) {
                return res.status(400).json({ error: 'Menus array is required' });
            }

            // Verify all category codes exist
            const categoryCodes = [...new Set(menus.map(m => m.masterCategoryCode))];
            const existingCategories = await db.collection('masterCategories')
                .find({ code: { $in: categoryCodes }, isDeleted: false })
                .toArray();

            const existingCodes = new Set(existingCategories.map(c => c.code));
            const invalidCodes = categoryCodes.filter(c => !existingCodes.has(c));

            if (invalidCodes.length > 0) {
                return res.status(400).json({ 
                    error: 'Invalid category codes', 
                    invalidCodes 
                });
            }

            const now = new Date();
            const documents = menus.map(menu => ({
                code: generateMasterMenuCode(),
                masterCategoryCode: menu.masterCategoryCode,
                name: menu.name,
                name_en: menu.name_en || '',
                name_th: menu.name_th || '',
                name_cn: menu.name_cn || '',
                name_kr: menu.name_kr || '',
                keywords: menu.keywords || [],
                description: menu.description || '',
                imageUrl: menu.imageUrl || '',
                allergens: menu.allergens || [],
                isVegetarian: menu.isVegetarian || false,
                isVegan: menu.isVegan || false,
                isHalal: menu.isHalal || false,
                isGlutenFree: menu.isGlutenFree || false,
                spiceLevel: menu.spiceLevel || 0,
                prepTimeMinutes: menu.prepTimeMinutes || 0,
                sortOrder: menu.sortOrder || 0,
                isActive: true,
                isDeleted: false,
                createdAt: now,
                updatedAt: now
            }));

            const result = await db.collection(COLLECTION_NAME).insertMany(documents);

            res.status(201).json({
                message: `${result.insertedCount} master menus created successfully`,
                data: documents
            });
        } catch (error) {
            console.error('Error bulk creating master menus:', error);
            res.status(500).json({ error: 'Failed to bulk create master menus' });
        }
    },

    /**
     * Find matching master menus for a given name (for auto-suggestion)
     */
    findMatches: async (req, res, db) => {
        try {
            const { name, masterCategoryCode, threshold = 0.3, limit = 5 } = req.query;

            if (!name) {
                return res.status(400).json({ error: 'Name parameter is required' });
            }

            const query = { isDeleted: false, isActive: true };
            if (masterCategoryCode) {
                query.masterCategoryCode = masterCategoryCode;
            }

            const allMenus = await db.collection(COLLECTION_NAME)
                .find(query)
                .toArray();

            const matches = findBestMatches(name, allMenus, parseFloat(threshold), parseInt(limit));

            res.status(200).json({
                query: name,
                matches: matches.map(m => ({
                    code: m.candidate.code,
                    name: m.candidate.name,
                    name_en: m.candidate.name_en,
                    masterCategoryCode: m.candidate.masterCategoryCode,
                    score: Math.round(m.score * 100) / 100,
                    matchType: m.matchType
                }))
            });
        } catch (error) {
            console.error('Error finding menu matches:', error);
            res.status(500).json({ error: 'Failed to find matches' });
        }
    },

    /**
     * Get menus grouped by category
     */
    getGroupedByCategory: async (req, res, db) => {
        try {
            const { activeOnly = 'true' } = req.query;

            const matchQuery = { isDeleted: false };
            if (activeOnly === 'true') {
                matchQuery.isActive = true;
            }

            const result = await db.collection(COLLECTION_NAME).aggregate([
                { $match: matchQuery },
                {
                    $lookup: {
                        from: 'masterCategories',
                        localField: 'masterCategoryCode',
                        foreignField: 'code',
                        as: 'category'
                    }
                },
                { $unwind: '$category' },
                {
                    $group: {
                        _id: '$masterCategoryCode',
                        categoryName: { $first: '$category.name' },
                        categoryNameEn: { $first: '$category.name_en' },
                        menus: { $push: '$$ROOT' },
                        menuCount: { $sum: 1 }
                    }
                },
                { $sort: { 'category.sortOrder': 1 } }
            ]).toArray();

            res.status(200).json({ data: result });
        } catch (error) {
            console.error('Error fetching grouped menus:', error);
            res.status(500).json({ error: 'Failed to fetch grouped menus' });
        }
    }
};

module.exports = masterMenuController;
