/**
 * Master Recipe Category Controller
 * 
 * Handles CRUD operations for master recipe categories.
 * Categories can be organized by cuisine, cooking method, meal type, etc.
 */

const { generateMasterRecipeCategoryCode } = require('../../utils/codeGenerator');

const COLLECTION_NAME = 'masterRecipeCategories';

const masterRecipeCategoryController = {
    /**
     * Create a new master recipe category
     */
    create: async (req, res, db) => {
        try {
            const {
                parentCode = null,
                categoryType = 'cuisine',
                name,
                name_en = '',
                name_th = '',
                name_cn = '',
                name_kr = '',
                keywords = [],
                description = '',
                icon = '',
                colorCode = '#000000',
                sortOrder = 0
            } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            // Valid category types
            const validTypes = ['cuisine', 'cooking_method', 'meal_type', 'dietary'];
            if (!validTypes.includes(categoryType)) {
                return res.status(400).json({ 
                    error: `Invalid category type. Must be one of: ${validTypes.join(', ')}` 
                });
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

            const code = generateMasterRecipeCategoryCode();
            const now = new Date();

            const document = {
                code,
                parentCode,
                categoryType,
                name,
                name_en,
                name_th,
                name_cn,
                name_kr,
                keywords,
                description,
                icon,
                colorCode,
                sortOrder,
                level,
                isActive: true,
                isDeleted: false,
                createdAt: now,
                updatedAt: now
            };

            const result = await db.collection(COLLECTION_NAME).insertOne(document);

            res.status(201).json({
                message: 'Master recipe category created successfully',
                data: { ...document, _id: result.insertedId }
            });
        } catch (error) {
            console.error('Error creating master recipe category:', error);
            res.status(500).json({ error: 'Failed to create master recipe category' });
        }
    },

    /**
     * Get all master recipe categories
     */
    getAll: async (req, res, db) => {
        try {
            const { 
                includeDeleted = 'false',
                activeOnly = 'true',
                parentCode = '',
                categoryType = '',
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

            if (categoryType) {
                query.categoryType = categoryType;
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
            console.error('Error fetching master recipe categories:', error);
            res.status(500).json({ error: 'Failed to fetch master recipe categories' });
        }
    },

    /**
     * Get a single master recipe category by code
     */
    getByCode: async (req, res, db) => {
        try {
            const { code } = req.params;

            const category = await db.collection(COLLECTION_NAME).findOne({ 
                code, 
                isDeleted: false 
            });

            if (!category) {
                return res.status(404).json({ error: 'Master recipe category not found' });
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
            console.error('Error fetching master recipe category:', error);
            res.status(500).json({ error: 'Failed to fetch master recipe category' });
        }
    },

    /**
     * Update a master recipe category
     */
    update: async (req, res, db) => {
        try {
            const { code } = req.params;
            const updates = req.body;

            // Remove fields that shouldn't be updated
            delete updates._id;
            delete updates.code;
            delete updates.createdAt;
            delete updates.level;

            // Validate category type if being updated
            if (updates.categoryType) {
                const validTypes = ['cuisine', 'cooking_method', 'meal_type', 'dietary'];
                if (!validTypes.includes(updates.categoryType)) {
                    return res.status(400).json({ 
                        error: `Invalid category type. Must be one of: ${validTypes.join(', ')}` 
                    });
                }
            }

            updates.updatedAt = new Date();

            const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
                { code, isDeleted: false },
                { $set: updates },
                { returnDocument: 'after' }
            );

            if (!result) {
                return res.status(404).json({ error: 'Master recipe category not found' });
            }

            res.status(200).json({
                message: 'Master recipe category updated successfully',
                data: result
            });
        } catch (error) {
            console.error('Error updating master recipe category:', error);
            res.status(500).json({ error: 'Failed to update master recipe category' });
        }
    },

    /**
     * Soft delete a master recipe category
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

            // Check if there are any recipes using this category
            const recipesCount = await db.collection('masterRecipes')
                .countDocuments({ masterRecipeCategoryCode: code, isDeleted: false });

            if (recipesCount > 0) {
                return res.status(400).json({ 
                    error: 'Cannot delete category with linked recipes. Reassign recipes first.' 
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
                return res.status(404).json({ error: 'Master recipe category not found' });
            }

            res.status(200).json({
                message: 'Master recipe category deleted successfully',
                data: result
            });
        } catch (error) {
            console.error('Error deleting master recipe category:', error);
            res.status(500).json({ error: 'Failed to delete master recipe category' });
        }
    },

    /**
     * Bulk create master recipe categories
     */
    bulkCreate: async (req, res, db) => {
        try {
            const { categories } = req.body;

            if (!Array.isArray(categories) || categories.length === 0) {
                return res.status(400).json({ error: 'Categories array is required' });
            }

            const validTypes = ['cuisine', 'cooking_method', 'meal_type', 'dietary'];
            const now = new Date();

            const documents = categories.map(cat => ({
                code: generateMasterRecipeCategoryCode(),
                parentCode: cat.parentCode || null,
                categoryType: validTypes.includes(cat.categoryType) ? cat.categoryType : 'cuisine',
                name: cat.name,
                name_en: cat.name_en || '',
                name_th: cat.name_th || '',
                name_cn: cat.name_cn || '',
                name_kr: cat.name_kr || '',
                keywords: cat.keywords || [],
                description: cat.description || '',
                icon: cat.icon || '',
                colorCode: cat.colorCode || '#000000',
                sortOrder: cat.sortOrder || 0,
                level: 0,
                isActive: true,
                isDeleted: false,
                createdAt: now,
                updatedAt: now
            }));

            const result = await db.collection(COLLECTION_NAME).insertMany(documents);

            res.status(201).json({
                message: `${result.insertedCount} master recipe categories created successfully`,
                data: documents
            });
        } catch (error) {
            console.error('Error bulk creating master recipe categories:', error);
            res.status(500).json({ error: 'Failed to bulk create master recipe categories' });
        }
    },

    /**
     * Get categories grouped by type
     */
    getGroupedByType: async (req, res, db) => {
        try {
            const { activeOnly = 'true' } = req.query;

            const query = { isDeleted: false };
            if (activeOnly === 'true') {
                query.isActive = true;
            }

            const result = await db.collection(COLLECTION_NAME).aggregate([
                { $match: query },
                {
                    $group: {
                        _id: '$categoryType',
                        categories: { $push: '$$ROOT' },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]).toArray();

            res.status(200).json({ data: result });
        } catch (error) {
            console.error('Error fetching grouped categories:', error);
            res.status(500).json({ error: 'Failed to fetch grouped categories' });
        }
    }
};

module.exports = masterRecipeCategoryController;
