/**
 * Mapping Controller
 * 
 * Handles mapping operations between store-specific items and master items.
 * Supports both manual mapping (by admin) and auto-suggestion based on name similarity.
 */

const { ObjectId } = require('mongodb');
const { findBestMatches } = require('../../utils/textSimilarity');

const mappingController = {
    // ============ CATEGORY MAPPINGS ============

    /**
     * Create a category mapping (manual)
     */
    createCategoryMapping: async (req, res, db) => {
        try {
            const {
                categoryId,
                storeId,
                masterCategoryCode,
                notes = ''
            } = req.body;

            if (!categoryId || !storeId || !masterCategoryCode) {
                return res.status(400).json({ 
                    error: 'categoryId, storeId, and masterCategoryCode are required' 
                });
            }

            // Verify the store category exists
            const storeCategory = await db.collection('categories').findOne({
                _id: new ObjectId(categoryId)
            });

            if (!storeCategory) {
                return res.status(404).json({ error: 'Store category not found' });
            }

            // Verify the master category exists
            const masterCategory = await db.collection('masterCategories').findOne({
                code: masterCategoryCode,
                isDeleted: false
            });

            if (!masterCategory) {
                return res.status(404).json({ error: 'Master category not found' });
            }

            // Check if mapping already exists
            const existingMapping = await db.collection('categoryMappings').findOne({
                categoryId: new ObjectId(categoryId),
                masterCategoryCode
            });

            if (existingMapping) {
                return res.status(400).json({ error: 'Mapping already exists' });
            }

            const now = new Date();
            const document = {
                categoryId: new ObjectId(categoryId),
                storeId: new ObjectId(storeId),
                masterCategoryCode,
                originalName: storeCategory.name || '',
                mappingMethod: 'manual',
                confidenceScore: 1,
                createdBy: req.body.createdBy || 'admin',
                confirmedBy: req.body.createdBy || 'admin',
                confirmedAt: now,
                status: 'active',
                rejectionReason: '',
                notes,
                isActive: true,
                createdAt: now,
                updatedAt: now
            };

            const result = await db.collection('categoryMappings').insertOne(document);

            res.status(201).json({
                message: 'Category mapping created successfully',
                data: { ...document, _id: result.insertedId }
            });
        } catch (error) {
            console.error('Error creating category mapping:', error);
            res.status(500).json({ error: 'Failed to create category mapping' });
        }
    },

    /**
     * Get category mapping suggestions
     */
    getCategoryMappingSuggestions: async (req, res, db) => {
        try {
            const { storeId, unmappedOnly = 'true', threshold = 0.3, limit = 5 } = req.query;

            // Build query for store categories
            const categoryQuery = { isDeleted: { $ne: true } };
            if (storeId) {
                categoryQuery.storeId = new ObjectId(storeId);
            }

            // Get store categories
            const storeCategories = await db.collection('categories')
                .find(categoryQuery)
                .limit(100) // Limit for performance
                .toArray();

            // Get existing mappings if only want unmapped
            let existingMappings = new Set();
            if (unmappedOnly === 'true') {
                const mappings = await db.collection('categoryMappings')
                    .find({ isActive: true })
                    .toArray();
                existingMappings = new Set(mappings.map(m => m.categoryId.toString()));
            }

            // Get all master categories
            const masterCategories = await db.collection('masterCategories')
                .find({ isDeleted: false, isActive: true })
                .toArray();

            // Generate suggestions for each unmapped category
            const suggestions = [];
            for (const category of storeCategories) {
                if (unmappedOnly === 'true' && existingMappings.has(category._id.toString())) {
                    continue;
                }

                const matches = findBestMatches(
                    category.name, 
                    masterCategories, 
                    parseFloat(threshold), 
                    parseInt(limit)
                );

                if (matches.length > 0) {
                    suggestions.push({
                        storeCategory: {
                            _id: category._id,
                            name: category.name,
                            storeId: category.storeId
                        },
                        suggestedMappings: matches.map(m => ({
                            masterCategoryCode: m.candidate.code,
                            masterCategoryName: m.candidate.name,
                            masterCategoryNameEn: m.candidate.name_en,
                            score: Math.round(m.score * 100) / 100,
                            matchType: m.matchType
                        }))
                    });
                }
            }

            res.status(200).json({
                total: suggestions.length,
                suggestions
            });
        } catch (error) {
            console.error('Error getting category mapping suggestions:', error);
            res.status(500).json({ error: 'Failed to get suggestions' });
        }
    },

    /**
     * Get all category mappings
     */
    getCategoryMappings: async (req, res, db) => {
        try {
            const { 
                storeId, 
                masterCategoryCode, 
                status = 'active',
                limit = 100, 
                skip = 0 
            } = req.query;

            const query = {};
            
            if (storeId) {
                query.storeId = new ObjectId(storeId);
            }
            
            if (masterCategoryCode) {
                query.masterCategoryCode = masterCategoryCode;
            }
            
            if (status) {
                query.status = status;
            }

            const [mappings, total] = await Promise.all([
                db.collection('categoryMappings')
                    .find(query)
                    .skip(parseInt(skip))
                    .limit(parseInt(limit))
                    .toArray(),
                db.collection('categoryMappings').countDocuments(query)
            ]);

            res.status(200).json({
                data: mappings,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    skip: parseInt(skip)
                }
            });
        } catch (error) {
            console.error('Error fetching category mappings:', error);
            res.status(500).json({ error: 'Failed to fetch mappings' });
        }
    },

    /**
     * Delete a category mapping
     */
    deleteCategoryMapping: async (req, res, db) => {
        try {
            const { id } = req.params;

            const result = await db.collection('categoryMappings').findOneAndUpdate(
                { _id: new ObjectId(id) },
                { 
                    $set: { 
                        isActive: false, 
                        status: 'deleted',
                        updatedAt: new Date() 
                    } 
                },
                { returnDocument: 'after' }
            );

            if (!result) {
                return res.status(404).json({ error: 'Mapping not found' });
            }

            res.status(200).json({
                message: 'Category mapping deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting category mapping:', error);
            res.status(500).json({ error: 'Failed to delete mapping' });
        }
    },

    // ============ MENU MAPPINGS ============

    /**
     * Create a menu mapping (manual)
     */
    createMenuMapping: async (req, res, db) => {
        try {
            const {
                menuId,
                storeId,
                masterMenuCode,
                notes = ''
            } = req.body;

            if (!menuId || !storeId || !masterMenuCode) {
                return res.status(400).json({ 
                    error: 'menuId, storeId, and masterMenuCode are required' 
                });
            }

            // Verify the store menu exists
            const storeMenu = await db.collection('menus').findOne({
                _id: new ObjectId(menuId)
            });

            if (!storeMenu) {
                return res.status(404).json({ error: 'Store menu not found' });
            }

            // Verify the master menu exists
            const masterMenu = await db.collection('masterMenus').findOne({
                code: masterMenuCode,
                isDeleted: false
            });

            if (!masterMenu) {
                return res.status(404).json({ error: 'Master menu not found' });
            }

            // Check if mapping already exists
            const existingMapping = await db.collection('menuMappings').findOne({
                menuId: new ObjectId(menuId),
                masterMenuCode
            });

            if (existingMapping) {
                return res.status(400).json({ error: 'Mapping already exists' });
            }

            const now = new Date();
            const document = {
                menuId: new ObjectId(menuId),
                storeId: new ObjectId(storeId),
                masterMenuCode,
                originalName: storeMenu.name || '',
                mappingMethod: 'manual',
                confidenceScore: 1,
                createdBy: req.body.createdBy || 'admin',
                confirmedBy: req.body.createdBy || 'admin',
                confirmedAt: now,
                status: 'active',
                rejectionReason: '',
                notes,
                isActive: true,
                createdAt: now,
                updatedAt: now
            };

            const result = await db.collection('menuMappings').insertOne(document);

            res.status(201).json({
                message: 'Menu mapping created successfully',
                data: { ...document, _id: result.insertedId }
            });
        } catch (error) {
            console.error('Error creating menu mapping:', error);
            res.status(500).json({ error: 'Failed to create menu mapping' });
        }
    },

    /**
     * Get menu mapping suggestions
     */
    getMenuMappingSuggestions: async (req, res, db) => {
        try {
            const { 
                storeId, 
                unmappedOnly = 'true', 
                threshold = 0.3, 
                limit = 5,
                menuLimit = 100 
            } = req.query;

            // Build query for store menus
            const menuQuery = { isDeleted: { $ne: true } };
            if (storeId) {
                menuQuery.storeId = new ObjectId(storeId);
            }

            // Get store menus
            const storeMenus = await db.collection('menus')
                .find(menuQuery)
                .limit(parseInt(menuLimit))
                .toArray();

            // Get existing mappings if only want unmapped
            let existingMappings = new Set();
            if (unmappedOnly === 'true') {
                const mappings = await db.collection('menuMappings')
                    .find({ isActive: true })
                    .toArray();
                existingMappings = new Set(mappings.map(m => m.menuId.toString()));
            }

            // Get all master menus
            const masterMenus = await db.collection('masterMenus')
                .find({ isDeleted: false, isActive: true })
                .toArray();

            // Generate suggestions for each unmapped menu
            const suggestions = [];
            for (const menu of storeMenus) {
                if (unmappedOnly === 'true' && existingMappings.has(menu._id.toString())) {
                    continue;
                }

                const matches = findBestMatches(
                    menu.name, 
                    masterMenus, 
                    parseFloat(threshold), 
                    parseInt(limit)
                );

                if (matches.length > 0) {
                    suggestions.push({
                        storeMenu: {
                            _id: menu._id,
                            name: menu.name,
                            storeId: menu.storeId,
                            categoryId: menu.categoryId
                        },
                        suggestedMappings: matches.map(m => ({
                            masterMenuCode: m.candidate.code,
                            masterMenuName: m.candidate.name,
                            masterMenuNameEn: m.candidate.name_en,
                            masterCategoryCode: m.candidate.masterCategoryCode,
                            score: Math.round(m.score * 100) / 100,
                            matchType: m.matchType
                        }))
                    });
                }
            }

            res.status(200).json({
                total: suggestions.length,
                suggestions
            });
        } catch (error) {
            console.error('Error getting menu mapping suggestions:', error);
            res.status(500).json({ error: 'Failed to get suggestions' });
        }
    },

    /**
     * Get all menu mappings
     */
    getMenuMappings: async (req, res, db) => {
        try {
            const { 
                storeId, 
                masterMenuCode, 
                status = 'active',
                limit = 100, 
                skip = 0 
            } = req.query;

            const query = {};
            
            if (storeId) {
                query.storeId = new ObjectId(storeId);
            }
            
            if (masterMenuCode) {
                query.masterMenuCode = masterMenuCode;
            }
            
            if (status) {
                query.status = status;
            }

            const [mappings, total] = await Promise.all([
                db.collection('menuMappings')
                    .find(query)
                    .skip(parseInt(skip))
                    .limit(parseInt(limit))
                    .toArray(),
                db.collection('menuMappings').countDocuments(query)
            ]);

            res.status(200).json({
                data: mappings,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    skip: parseInt(skip)
                }
            });
        } catch (error) {
            console.error('Error fetching menu mappings:', error);
            res.status(500).json({ error: 'Failed to fetch mappings' });
        }
    },

    /**
     * Bulk create menu mappings
     */
    bulkCreateMenuMappings: async (req, res, db) => {
        try {
            const { mappings } = req.body;

            if (!Array.isArray(mappings) || mappings.length === 0) {
                return res.status(400).json({ error: 'Mappings array is required' });
            }

            const now = new Date();
            const documents = [];
            const errors = [];

            for (const mapping of mappings) {
                // Validate each mapping
                if (!mapping.menuId || !mapping.storeId || !mapping.masterMenuCode) {
                    errors.push({ mapping, error: 'Missing required fields' });
                    continue;
                }

                documents.push({
                    menuId: new ObjectId(mapping.menuId),
                    storeId: new ObjectId(mapping.storeId),
                    masterMenuCode: mapping.masterMenuCode,
                    originalName: mapping.originalName || '',
                    mappingMethod: mapping.mappingMethod || 'manual',
                    confidenceScore: mapping.confidenceScore || 1,
                    createdBy: mapping.createdBy || 'admin',
                    confirmedBy: mapping.confirmedBy || null,
                    confirmedAt: mapping.confirmedAt || null,
                    status: 'active',
                    rejectionReason: '',
                    notes: mapping.notes || '',
                    isActive: true,
                    createdAt: now,
                    updatedAt: now
                });
            }

            if (documents.length === 0) {
                return res.status(400).json({ error: 'No valid mappings to create', errors });
            }

            const result = await db.collection('menuMappings').insertMany(documents, { ordered: false });

            res.status(201).json({
                message: `${result.insertedCount} mappings created successfully`,
                insertedCount: result.insertedCount,
                errors: errors.length > 0 ? errors : undefined
            });
        } catch (error) {
            console.error('Error bulk creating menu mappings:', error);
            res.status(500).json({ error: 'Failed to bulk create mappings' });
        }
    },

    /**
     * Delete a menu mapping
     */
    deleteMenuMapping: async (req, res, db) => {
        try {
            const { id } = req.params;

            const result = await db.collection('menuMappings').findOneAndUpdate(
                { _id: new ObjectId(id) },
                { 
                    $set: { 
                        isActive: false, 
                        status: 'deleted',
                        updatedAt: new Date() 
                    } 
                },
                { returnDocument: 'after' }
            );

            if (!result) {
                return res.status(404).json({ error: 'Mapping not found' });
            }

            res.status(200).json({
                message: 'Menu mapping deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting menu mapping:', error);
            res.status(500).json({ error: 'Failed to delete mapping' });
        }
    },

    // ============ STATISTICS ============

    /**
     * Get mapping statistics
     */
    getMappingStats: async (req, res, db) => {
        try {
            const { storeId } = req.query;

            const storeQuery = storeId ? { storeId: new ObjectId(storeId) } : {};

            const [
                totalStoreCategories,
                totalStoreMenues,
                totalCategoryMappings,
                totalMenuMappings,
                masterCategoriesCount,
                masterMenusCount
            ] = await Promise.all([
                db.collection('categories').countDocuments({ 
                    ...storeQuery, 
                    isDeleted: { $ne: true } 
                }),
                db.collection('menus').countDocuments({ 
                    ...storeQuery, 
                    isDeleted: { $ne: true } 
                }),
                db.collection('categoryMappings').countDocuments({ 
                    ...storeQuery, 
                    isActive: true 
                }),
                db.collection('menuMappings').countDocuments({ 
                    ...storeQuery, 
                    isActive: true 
                }),
                db.collection('masterCategories').countDocuments({ isDeleted: false }),
                db.collection('masterMenus').countDocuments({ isDeleted: false })
            ]);

            res.status(200).json({
                storeData: {
                    totalCategories: totalStoreCategories,
                    totalMenus: totalStoreMenues,
                    mappedCategories: totalCategoryMappings,
                    mappedMenus: totalMenuMappings,
                    unmappedCategories: totalStoreCategories - totalCategoryMappings,
                    unmappedMenus: totalStoreMenues - totalMenuMappings,
                    categoryMappingPercent: totalStoreCategories > 0 
                        ? Math.round((totalCategoryMappings / totalStoreCategories) * 100) 
                        : 0,
                    menuMappingPercent: totalStoreMenues > 0 
                        ? Math.round((totalMenuMappings / totalStoreMenues) * 100) 
                        : 0
                },
                masterData: {
                    totalMasterCategories: masterCategoriesCount,
                    totalMasterMenus: masterMenusCount
                }
            });
        } catch (error) {
            console.error('Error fetching mapping stats:', error);
            res.status(500).json({ error: 'Failed to fetch stats' });
        }
    }
};

module.exports = mappingController;
