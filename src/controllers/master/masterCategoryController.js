/**
 * Master Category Controller
 * 
 * Handles CRUD operations for master menu categories.
 */

const { generateMasterCategoryCode } = require('../../utils/codeGenerator');
const { findBestMatches } = require('../../utils/textSimilarity');

const COLLECTION_NAME = 'masterCategories';

const masterCategoryController = {
    /**
     * Create a new master category
     * - name (Lao) is required
     * - name_en is optional
     * - code is optional (auto-generated if not provided)
     */
    create: async (req, res, db) => {
        try {
            const {
                code: providedCode,
                name,
                name_en = '',
                name_th = '',
                name_cn = '',
                name_kr = '',
                keywords = [],
                description = '',
                description_en = '',
                icon = '',
                sortOrder = 0,
                displayOrder = 0,
                isActive = true
            } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Name (Lao) is required' });
            }

            // Handle code: use provided code or auto-generate
            let code;
            if (providedCode && providedCode.trim()) {
                // Validate uniqueness of provided code
                const existingWithCode = await db.collection(COLLECTION_NAME).findOne({ 
                    code: providedCode.trim().toUpperCase(),
                    isDeleted: false 
                });
                
                if (existingWithCode) {
                    return res.status(400).json({ 
                        error: 'Code already exists. Please use a different code.',
                        existingCode: providedCode 
                    });
                }
                code = providedCode.trim().toUpperCase();
            } else {
                // Auto-generate unique code
                let attempts = 0;
                const maxAttempts = 10;
                
                do {
                    code = generateMasterCategoryCode();
                    const existing = await db.collection(COLLECTION_NAME).findOne({ code });
                    if (!existing) break;
                    attempts++;
                } while (attempts < maxAttempts);
                
                if (attempts >= maxAttempts) {
                    return res.status(500).json({ error: 'Failed to generate unique code. Please try again.' });
                }
            }

            const now = new Date();

            const document = {
                code,
                name,
                name_en,
                name_th,
                name_cn,
                name_kr,
                keywords: Array.isArray(keywords) ? keywords : [],
                description,
                description_en,
                icon,
                sortOrder: sortOrder || displayOrder || 0,
                displayOrder: displayOrder || sortOrder || 0,
                isActive,
                isDeleted: false,
                createdAt: now,
                updatedAt: now
            };

            const result = await db.collection(COLLECTION_NAME).insertOne(document);

            res.status(201).json({
                message: 'Master category created successfully',
                data: { ...document, _id: result.insertedId }
            });
        } catch (error) {
            console.error('Error creating master category:', error);
            res.status(500).json({ error: 'Failed to create master category' });
        }
    },

    /**
     * Get all master categories
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
            console.error('Error fetching master categories:', error);
            res.status(500).json({ error: 'Failed to fetch master categories' });
        }
    },

    /**
     * Get a single master category by code
     */
    getByCode: async (req, res, db) => {
        try {
            const { code } = req.params;

            const category = await db.collection(COLLECTION_NAME).findOne({ 
                code, 
                isDeleted: false 
            });

            if (!category) {
                return res.status(404).json({ error: 'Master category not found' });
            }

            res.status(200).json({ data: category });
        } catch (error) {
            console.error('Error fetching master category:', error);
            res.status(500).json({ error: 'Failed to fetch master category' });
        }
    },

    /**
     * Update a master category
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
                return res.status(404).json({ error: 'Master category not found' });
            }

            res.status(200).json({
                message: 'Master category updated successfully',
                data: result
            });
        } catch (error) {
            console.error('Error updating master category:', error);
            res.status(500).json({ error: 'Failed to update master category' });
        }
    },

    /**
     * Soft delete a master category
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
                return res.status(404).json({ error: 'Master category not found' });
            }

            res.status(200).json({
                message: 'Master category deleted successfully',
                data: result
            });
        } catch (error) {
            console.error('Error deleting master category:', error);
            res.status(500).json({ error: 'Failed to delete master category' });
        }
    },

    /**
     * Bulk create master categories
     */
    bulkCreate: async (req, res, db) => {
        try {
            const { categories } = req.body;

            if (!Array.isArray(categories) || categories.length === 0) {
                return res.status(400).json({ error: 'Categories array is required' });
            }

            const now = new Date();
            const documents = categories.map(cat => ({
                code: generateMasterCategoryCode(),
                name: cat.name,
                name_en: cat.name_en || '',
                name_th: cat.name_th || '',
                name_cn: cat.name_cn || '',
                name_kr: cat.name_kr || '',
                keywords: cat.keywords || [],
                description: cat.description || '',
                icon: cat.icon || '',
                sortOrder: cat.sortOrder || 0,
                isActive: true,
                isDeleted: false,
                createdAt: now,
                updatedAt: now
            }));

            const result = await db.collection(COLLECTION_NAME).insertMany(documents);

            res.status(201).json({
                message: `${result.insertedCount} master categories created successfully`,
                data: documents
            });
        } catch (error) {
            console.error('Error bulk creating master categories:', error);
            res.status(500).json({ error: 'Failed to bulk create master categories' });
        }
    },

    /**
     * Find matching master categories for a given name (for auto-suggestion)
     */
    findMatches: async (req, res, db) => {
        try {
            const { name, threshold = 0.3, limit = 5 } = req.query;

            if (!name) {
                return res.status(400).json({ error: 'Name parameter is required' });
            }

            const allCategories = await db.collection(COLLECTION_NAME)
                .find({ isDeleted: false, isActive: true })
                .toArray();

            const matches = findBestMatches(name, allCategories, parseFloat(threshold), parseInt(limit));

            res.status(200).json({
                query: name,
                matches: matches.map(m => ({
                    code: m.candidate.code,
                    name: m.candidate.name,
                    name_en: m.candidate.name_en,
                    score: Math.round(m.score * 100) / 100,
                    matchType: m.matchType
                }))
            });
        } catch (error) {
            console.error('Error finding category matches:', error);
            res.status(500).json({ error: 'Failed to find matches' });
        }
    },

    /**
     * Get statistics for a master category
     * Returns linked menu count and sample menus
     */
    getStats: async (req, res, db) => {
        try {
            const { code } = req.params;
            const { includeMenus = 'true', menuLimit = 10 } = req.query;

            // Verify category exists
            const category = await db.collection(COLLECTION_NAME).findOne({ 
                code, 
                isDeleted: false 
            });

            if (!category) {
                return res.status(404).json({ error: 'Master category not found' });
            }

            // Count linked menus
            const menuCount = await db.collection('masterMenus').countDocuments({
                masterCategoryCode: code,
                isDeleted: false
            });

            const result = {
                categoryCode: code,
                categoryName: category.name,
                categoryName_en: category.name_en,
                linkedMenuCount: menuCount,
                canSafelyDelete: menuCount === 0
            };

            // Optionally include sample linked menus
            if (includeMenus === 'true' && menuCount > 0) {
                const linkedMenus = await db.collection('masterMenus')
                    .find({ masterCategoryCode: code, isDeleted: false })
                    .project({ code: 1, name: 1, name_en: 1, isActive: 1 })
                    .limit(parseInt(menuLimit))
                    .toArray();

                result.linkedMenus = linkedMenus;
                result.hasMoreMenus = menuCount > parseInt(menuLimit);
            }

            res.status(200).json({ data: result });
        } catch (error) {
            console.error('Error getting category stats:', error);
            res.status(500).json({ error: 'Failed to get category statistics' });
        }
    }
};

module.exports = masterCategoryController;
