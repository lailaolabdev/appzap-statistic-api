/**
 * Master Ingredient Controller
 * 
 * Handles CRUD operations for master ingredients.
 * All quantities are normalized to grams (g) as the base unit.
 */

const { generateMasterIngredientCode } = require('../../utils/codeGenerator');
const { findBestMatches } = require('../../utils/textSimilarity');

const COLLECTION_NAME = 'masterIngredients';

const masterIngredientController = {
    /**
     * Create a new master ingredient
     */
    create: async (req, res, db) => {
        try {
            const {
                masterIngredientCategoryCode,
                name,
                name_en = '',
                name_th = '',
                name_cn = '',
                name_kr = '',
                keywords = [],
                description = '',
                imageUrl = '',
                unitConversions = { g: 1, kg: 1000, mg: 0.001 },
                displayUnits = ['g', 'kg'],
                averageWeightPerPiece = null,
                nutritionPer100g = {},
                averageCostPerGram = 0,
                storageType = 'dry',
                shelfLifeDays = 0,
                allergens = [],
                isVegetarian = true,
                isVegan = true,
                isHalal = true,
                isGlutenFree = true,
                origin = '',
                seasonalMonths = [],
                sortOrder = 0
            } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            if (!masterIngredientCategoryCode) {
                return res.status(400).json({ error: 'Master ingredient category code is required' });
            }

            // Verify category exists
            const category = await db.collection('masterIngredientCategories').findOne({ 
                code: masterIngredientCategoryCode, 
                isDeleted: false 
            });

            if (!category) {
                return res.status(400).json({ error: 'Invalid master ingredient category code' });
            }

            const code = generateMasterIngredientCode();
            const now = new Date();

            const document = {
                code,
                masterIngredientCategoryCode,
                name,
                name_en,
                name_th,
                name_cn,
                name_kr,
                keywords,
                description,
                imageUrl,
                baseUnit: 'g',
                unitConversions,
                displayUnits,
                averageWeightPerPiece,
                nutritionPer100g: {
                    calories: nutritionPer100g.calories || 0,
                    protein: nutritionPer100g.protein || 0,
                    carbohydrates: nutritionPer100g.carbohydrates || 0,
                    fat: nutritionPer100g.fat || 0,
                    fiber: nutritionPer100g.fiber || 0,
                    sodium: nutritionPer100g.sodium || 0
                },
                averageCostPerGram,
                storageType,
                shelfLifeDays,
                allergens,
                isVegetarian,
                isVegan,
                isHalal,
                isGlutenFree,
                origin,
                seasonalMonths,
                sortOrder,
                isActive: true,
                isDeleted: false,
                createdAt: now,
                updatedAt: now
            };

            const result = await db.collection(COLLECTION_NAME).insertOne(document);

            res.status(201).json({
                message: 'Master ingredient created successfully',
                data: { ...document, _id: result.insertedId }
            });
        } catch (error) {
            console.error('Error creating master ingredient:', error);
            res.status(500).json({ error: 'Failed to create master ingredient' });
        }
    },

    /**
     * Get all master ingredients
     */
    getAll: async (req, res, db) => {
        try {
            const { 
                includeDeleted = 'false',
                activeOnly = 'true',
                masterIngredientCategoryCode = '',
                storageType = '',
                allergen = '',
                search = '',
                limit = 100,
                skip = 0,
                sortBy = 'name',
                sortOrder = 'asc'
            } = req.query;

            const query = {};
            
            if (includeDeleted !== 'true') {
                query.isDeleted = false;
            }
            
            if (activeOnly === 'true') {
                query.isActive = true;
            }

            if (masterIngredientCategoryCode) {
                query.masterIngredientCategoryCode = masterIngredientCategoryCode;
            }

            if (storageType) {
                query.storageType = storageType;
            }

            if (allergen) {
                query.allergens = allergen;
            }

            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { name_en: { $regex: search, $options: 'i' } },
                    { keywords: { $regex: search, $options: 'i' } }
                ];
            }

            const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

            const [ingredients, total] = await Promise.all([
                db.collection(COLLECTION_NAME)
                    .find(query)
                    .sort(sort)
                    .skip(parseInt(skip))
                    .limit(parseInt(limit))
                    .toArray(),
                db.collection(COLLECTION_NAME).countDocuments(query)
            ]);

            res.status(200).json({
                data: ingredients,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    skip: parseInt(skip),
                    hasMore: parseInt(skip) + ingredients.length < total
                }
            });
        } catch (error) {
            console.error('Error fetching master ingredients:', error);
            res.status(500).json({ error: 'Failed to fetch master ingredients' });
        }
    },

    /**
     * Get a single master ingredient by code
     */
    getByCode: async (req, res, db) => {
        try {
            const { code } = req.params;

            const ingredient = await db.collection(COLLECTION_NAME).findOne({ 
                code, 
                isDeleted: false 
            });

            if (!ingredient) {
                return res.status(404).json({ error: 'Master ingredient not found' });
            }

            // Also fetch the category details
            const category = await db.collection('masterIngredientCategories').findOne({
                code: ingredient.masterIngredientCategoryCode,
                isDeleted: false
            });

            res.status(200).json({ 
                data: {
                    ...ingredient,
                    category
                }
            });
        } catch (error) {
            console.error('Error fetching master ingredient:', error);
            res.status(500).json({ error: 'Failed to fetch master ingredient' });
        }
    },

    /**
     * Update a master ingredient
     */
    update: async (req, res, db) => {
        try {
            const { code } = req.params;
            const updates = req.body;

            // Remove fields that shouldn't be updated
            delete updates._id;
            delete updates.code;
            delete updates.createdAt;
            delete updates.baseUnit; // Always 'g'

            // If updating category, verify it exists
            if (updates.masterIngredientCategoryCode) {
                const category = await db.collection('masterIngredientCategories').findOne({ 
                    code: updates.masterIngredientCategoryCode, 
                    isDeleted: false 
                });

                if (!category) {
                    return res.status(400).json({ error: 'Invalid master ingredient category code' });
                }
            }

            updates.updatedAt = new Date();

            const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
                { code, isDeleted: false },
                { $set: updates },
                { returnDocument: 'after' }
            );

            if (!result) {
                return res.status(404).json({ error: 'Master ingredient not found' });
            }

            res.status(200).json({
                message: 'Master ingredient updated successfully',
                data: result
            });
        } catch (error) {
            console.error('Error updating master ingredient:', error);
            res.status(500).json({ error: 'Failed to update master ingredient' });
        }
    },

    /**
     * Soft delete a master ingredient
     */
    delete: async (req, res, db) => {
        try {
            const { code } = req.params;

            // Check if ingredient is used in any recipes
            const recipeCount = await db.collection('masterRecipes')
                .countDocuments({ 
                    'ingredients.masterIngredientCode': code, 
                    isDeleted: false 
                });

            if (recipeCount > 0) {
                return res.status(400).json({ 
                    error: `Cannot delete ingredient. It is used in ${recipeCount} recipe(s).` 
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
                return res.status(404).json({ error: 'Master ingredient not found' });
            }

            res.status(200).json({
                message: 'Master ingredient deleted successfully',
                data: result
            });
        } catch (error) {
            console.error('Error deleting master ingredient:', error);
            res.status(500).json({ error: 'Failed to delete master ingredient' });
        }
    },

    /**
     * Bulk create master ingredients
     */
    bulkCreate: async (req, res, db) => {
        try {
            const { ingredients } = req.body;

            if (!Array.isArray(ingredients) || ingredients.length === 0) {
                return res.status(400).json({ error: 'Ingredients array is required' });
            }

            // Verify all category codes exist
            const categoryCodes = [...new Set(ingredients.map(i => i.masterIngredientCategoryCode))];
            const existingCategories = await db.collection('masterIngredientCategories')
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
            const documents = ingredients.map(ing => ({
                code: generateMasterIngredientCode(),
                masterIngredientCategoryCode: ing.masterIngredientCategoryCode,
                name: ing.name,
                name_en: ing.name_en || '',
                name_th: ing.name_th || '',
                name_cn: ing.name_cn || '',
                name_kr: ing.name_kr || '',
                keywords: ing.keywords || [],
                description: ing.description || '',
                imageUrl: ing.imageUrl || '',
                baseUnit: 'g',
                unitConversions: ing.unitConversions || { g: 1, kg: 1000, mg: 0.001 },
                displayUnits: ing.displayUnits || ['g', 'kg'],
                averageWeightPerPiece: ing.averageWeightPerPiece || null,
                nutritionPer100g: ing.nutritionPer100g || {},
                averageCostPerGram: ing.averageCostPerGram || 0,
                storageType: ing.storageType || 'dry',
                shelfLifeDays: ing.shelfLifeDays || 0,
                allergens: ing.allergens || [],
                isVegetarian: ing.isVegetarian !== false,
                isVegan: ing.isVegan !== false,
                isHalal: ing.isHalal !== false,
                isGlutenFree: ing.isGlutenFree !== false,
                origin: ing.origin || '',
                seasonalMonths: ing.seasonalMonths || [],
                sortOrder: ing.sortOrder || 0,
                isActive: true,
                isDeleted: false,
                createdAt: now,
                updatedAt: now
            }));

            const result = await db.collection(COLLECTION_NAME).insertMany(documents);

            res.status(201).json({
                message: `${result.insertedCount} master ingredients created successfully`,
                data: documents
            });
        } catch (error) {
            console.error('Error bulk creating master ingredients:', error);
            res.status(500).json({ error: 'Failed to bulk create master ingredients' });
        }
    },

    /**
     * Find matching ingredients for a given name
     */
    findMatches: async (req, res, db) => {
        try {
            const { name, categoryCode, threshold = 0.3, limit = 5 } = req.query;

            if (!name) {
                return res.status(400).json({ error: 'Name parameter is required' });
            }

            const query = { isDeleted: false, isActive: true };
            if (categoryCode) {
                query.masterIngredientCategoryCode = categoryCode;
            }

            const allIngredients = await db.collection(COLLECTION_NAME)
                .find(query)
                .toArray();

            const matches = findBestMatches(name, allIngredients, parseFloat(threshold), parseInt(limit));

            res.status(200).json({
                query: name,
                matches: matches.map(m => ({
                    code: m.candidate.code,
                    name: m.candidate.name,
                    name_en: m.candidate.name_en,
                    masterIngredientCategoryCode: m.candidate.masterIngredientCategoryCode,
                    score: Math.round(m.score * 100) / 100,
                    matchType: m.matchType
                }))
            });
        } catch (error) {
            console.error('Error finding ingredient matches:', error);
            res.status(500).json({ error: 'Failed to find matches' });
        }
    },

    /**
     * Convert quantity between units
     */
    convertUnit: async (req, res, db) => {
        try {
            const { code } = req.params;
            const { quantity, fromUnit, toUnit } = req.query;

            if (!quantity || !fromUnit || !toUnit) {
                return res.status(400).json({ error: 'quantity, fromUnit, and toUnit are required' });
            }

            const ingredient = await db.collection(COLLECTION_NAME).findOne({ 
                code, 
                isDeleted: false 
            });

            if (!ingredient) {
                return res.status(404).json({ error: 'Master ingredient not found' });
            }

            const conversions = ingredient.unitConversions || {};
            
            if (!conversions[fromUnit]) {
                return res.status(400).json({ error: `Unknown unit: ${fromUnit}` });
            }
            
            if (!conversions[toUnit]) {
                return res.status(400).json({ error: `Unknown unit: ${toUnit}` });
            }

            // Convert to grams first, then to target unit
            const inGrams = parseFloat(quantity) * conversions[fromUnit];
            const result = inGrams / conversions[toUnit];

            res.status(200).json({
                original: { quantity: parseFloat(quantity), unit: fromUnit },
                converted: { quantity: Math.round(result * 1000) / 1000, unit: toUnit },
                inBaseUnit: { quantity: inGrams, unit: 'g' }
            });
        } catch (error) {
            console.error('Error converting unit:', error);
            res.status(500).json({ error: 'Failed to convert unit' });
        }
    }
};

module.exports = masterIngredientController;
