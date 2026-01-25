/**
 * Master Ingredient Category Controller
 * 
 * Handles CRUD operations for master ingredient categories.
 */

const { generateMasterIngredientCategoryCode } = require('../../utils/codeGenerator');
const { findBestMatches } = require('../../utils/textSimilarity');

const COLLECTION_NAME = 'masterIngredientCategories';

const masterIngredientCategoryController = {
    /**
     * Create a new master ingredient category
     */
    create: async (req, res, db) => {
        try {
            const {
                parentCode = null,
                name,
                name_en = '',
                name_th = '',
                name_cn = '',
                name_kr = '',
                keywords = [],
                description = '',
                icon = '',
                storageType = 'dry',
                defaultShelfLifeDays = 0,
                sortOrder = 0
            } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            // If parent code is provided, verify it exists and calculate level
            let level = 0;
            if (parentCode) {
                const parent = await db.collection(COLLECTION_NAME).findOne({ 
                    code: parentCode, 
                    isDeleted: false 
                });

                if (!parent) {
                    return res.status(400).json({ error: 'Invalid parent category code' });
                }
                level = parent.level + 1;
            }

            const code = generateMasterIngredientCategoryCode();
            const now = new Date();

            const document = {
                code,
                parentCode,
                name,
                name_en,
                name_th,
                name_cn,
                name_kr,
                keywords,
                description,
                icon,
                storageType,
                defaultShelfLifeDays,
                sortOrder,
                level,
                isActive: true,
                isDeleted: false,
                createdAt: now,
                updatedAt: now
            };

            const result = await db.collection(COLLECTION_NAME).insertOne(document);

            res.status(201).json({
                message: 'Master ingredient category created successfully',
                data: { ...document, _id: result.insertedId }
            });
        } catch (error) {
            console.error('Error creating master ingredient category:', error);
            res.status(500).json({ error: 'Failed to create master ingredient category' });
        }
    },

    /**
     * Get all master ingredient categories
     */
    getAll: async (req, res, db) => {
        try {
            const { 
                includeDeleted = 'false',
                activeOnly = 'true',
                parentCode = '',
                level = '',
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

            if (parentCode === 'null') {
                query.parentCode = null;
            } else if (parentCode) {
                query.parentCode = parentCode;
            }

            if (level !== '') {
                query.level = parseInt(level);
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
            console.error('Error fetching master ingredient categories:', error);
            res.status(500).json({ error: 'Failed to fetch master ingredient categories' });
        }
    },

    /**
     * Get a single master ingredient category by code
     */
    getByCode: async (req, res, db) => {
        try {
            const { code } = req.params;

            const category = await db.collection(COLLECTION_NAME).findOne({ 
                code, 
                isDeleted: false 
            });

            if (!category) {
                return res.status(404).json({ error: 'Master ingredient category not found' });
            }

            // Also fetch children
            const children = await db.collection(COLLECTION_NAME)
                .find({ parentCode: code, isDeleted: false })
                .toArray();

            res.status(200).json({ 
                data: {
                    ...category,
                    children
                }
            });
        } catch (error) {
            console.error('Error fetching master ingredient category:', error);
            res.status(500).json({ error: 'Failed to fetch master ingredient category' });
        }
    },

    /**
     * Update a master ingredient category
     */
    update: async (req, res, db) => {
        try {
            const { code } = req.params;
            const updates = req.body;

            // Remove fields that shouldn't be updated
            delete updates._id;
            delete updates.code;
            delete updates.createdAt;
            delete updates.level; // Level is calculated from parent

            updates.updatedAt = new Date();

            const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
                { code, isDeleted: false },
                { $set: updates },
                { returnDocument: 'after' }
            );

            if (!result) {
                return res.status(404).json({ error: 'Master ingredient category not found' });
            }

            res.status(200).json({
                message: 'Master ingredient category updated successfully',
                data: result
            });
        } catch (error) {
            console.error('Error updating master ingredient category:', error);
            res.status(500).json({ error: 'Failed to update master ingredient category' });
        }
    },

    /**
     * Soft delete a master ingredient category
     */
    delete: async (req, res, db) => {
        try {
            const { code } = req.params;

            // Check if there are any children
            const childrenCount = await db.collection(COLLECTION_NAME)
                .countDocuments({ parentCode: code, isDeleted: false });

            if (childrenCount > 0) {
                return res.status(400).json({ 
                    error: 'Cannot delete category with children. Delete children first.' 
                });
            }

            // Check if there are any ingredients using this category
            const ingredientsCount = await db.collection('masterIngredients')
                .countDocuments({ masterIngredientCategoryCode: code, isDeleted: false });

            if (ingredientsCount > 0) {
                return res.status(400).json({ 
                    error: 'Cannot delete category with linked ingredients. Reassign ingredients first.' 
                });
            }

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
                return res.status(404).json({ error: 'Master ingredient category not found' });
            }

            res.status(200).json({
                message: 'Master ingredient category deleted successfully',
                data: result
            });
        } catch (error) {
            console.error('Error deleting master ingredient category:', error);
            res.status(500).json({ error: 'Failed to delete master ingredient category' });
        }
    },

    /**
     * Bulk create master ingredient categories
     */
    bulkCreate: async (req, res, db) => {
        try {
            const { categories } = req.body;

            if (!Array.isArray(categories) || categories.length === 0) {
                return res.status(400).json({ error: 'Categories array is required' });
            }

            const now = new Date();
            const documents = categories.map(cat => ({
                code: generateMasterIngredientCategoryCode(),
                parentCode: cat.parentCode || null,
                name: cat.name,
                name_en: cat.name_en || '',
                name_th: cat.name_th || '',
                name_cn: cat.name_cn || '',
                name_kr: cat.name_kr || '',
                keywords: cat.keywords || [],
                description: cat.description || '',
                icon: cat.icon || '',
                storageType: cat.storageType || 'dry',
                defaultShelfLifeDays: cat.defaultShelfLifeDays || 0,
                sortOrder: cat.sortOrder || 0,
                level: 0, // Will need to be recalculated if parent is specified
                isActive: true,
                isDeleted: false,
                createdAt: now,
                updatedAt: now
            }));

            const result = await db.collection(COLLECTION_NAME).insertMany(documents);

            res.status(201).json({
                message: `${result.insertedCount} master ingredient categories created successfully`,
                data: documents
            });
        } catch (error) {
            console.error('Error bulk creating master ingredient categories:', error);
            res.status(500).json({ error: 'Failed to bulk create master ingredient categories' });
        }
    },

    /**
     * Get hierarchical tree structure
     */
    getTree: async (req, res, db) => {
        try {
            const { activeOnly = 'true' } = req.query;

            const query = { isDeleted: false };
            if (activeOnly === 'true') {
                query.isActive = true;
            }

            const allCategories = await db.collection(COLLECTION_NAME)
                .find(query)
                .sort({ sortOrder: 1 })
                .toArray();

            // Build tree structure
            const buildTree = (parentCode = null) => {
                return allCategories
                    .filter(cat => cat.parentCode === parentCode)
                    .map(cat => ({
                        ...cat,
                        children: buildTree(cat.code)
                    }));
            };

            const tree = buildTree(null);

            res.status(200).json({ data: tree });
        } catch (error) {
            console.error('Error fetching category tree:', error);
            res.status(500).json({ error: 'Failed to fetch category tree' });
        }
    }
};

module.exports = masterIngredientCategoryController;
