/**
 * Master Recipe Controller
 * 
 * Handles CRUD operations for master recipes.
 * Recipes define the ingredients needed for each master menu item.
 */

const { generateMasterRecipeCode } = require('../../utils/codeGenerator');

const COLLECTION_NAME = 'masterRecipes';

const masterRecipeController = {
    /**
     * Create a new master recipe
     */
    create: async (req, res, db) => {
        try {
            const {
                masterMenuCode,
                masterRecipeCategoryCode = null,
                name,
                name_en = '',
                name_th = '',
                description = '',
                servingSize = 1,
                ingredients = [],
                preparationSteps = [],
                prepTimeMinutes = 0,
                cookTimeMinutes = 0,
                difficultyLevel = 1,
                equipmentNeeded = [],
                tags = [],
                imageUrl = '',
                videoUrl = '',
                isPrimary = true
            } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            if (!masterMenuCode) {
                return res.status(400).json({ error: 'Master menu code is required' });
            }

            // Verify menu exists
            const menu = await db.collection('masterMenus').findOne({ 
                code: masterMenuCode, 
                isDeleted: false 
            });

            if (!menu) {
                return res.status(400).json({ error: 'Invalid master menu code' });
            }

            // Verify recipe category if provided
            if (masterRecipeCategoryCode) {
                const category = await db.collection('masterRecipeCategories').findOne({ 
                    code: masterRecipeCategoryCode, 
                    isDeleted: false 
                });

                if (!category) {
                    return res.status(400).json({ error: 'Invalid master recipe category code' });
                }
            }

            // Validate and process ingredients
            const processedIngredients = [];
            let totalWeight = 0;
            const allergens = new Set();
            let isVegetarian = true;
            let isVegan = true;
            let isHalal = true;
            let isGlutenFree = true;

            for (const ing of ingredients) {
                if (!ing.masterIngredientCode || ing.quantity === undefined) {
                    return res.status(400).json({ 
                        error: 'Each ingredient must have masterIngredientCode and quantity' 
                    });
                }

                const ingredient = await db.collection('masterIngredients').findOne({
                    code: ing.masterIngredientCode,
                    isDeleted: false
                });

                if (!ingredient) {
                    return res.status(400).json({ 
                        error: `Invalid ingredient code: ${ing.masterIngredientCode}` 
                    });
                }

                // Add to processed ingredients
                processedIngredients.push({
                    masterIngredientCode: ing.masterIngredientCode,
                    ingredientName: ingredient.name,
                    ingredientNameEn: ingredient.name_en,
                    quantity: parseFloat(ing.quantity),
                    unit: ing.unit || 'g',
                    isOptional: ing.isOptional || false,
                    notes: ing.notes || ''
                });

                // Calculate totals
                totalWeight += parseFloat(ing.quantity);

                // Aggregate allergens
                if (ingredient.allergens) {
                    ingredient.allergens.forEach(a => allergens.add(a));
                }

                // Track dietary flags (recipe is only vegetarian/vegan/etc if ALL ingredients are)
                if (!ingredient.isVegetarian) isVegetarian = false;
                if (!ingredient.isVegan) isVegan = false;
                if (!ingredient.isHalal) isHalal = false;
                if (!ingredient.isGlutenFree) isGlutenFree = false;
            }

            const code = generateMasterRecipeCode();
            const now = new Date();

            const document = {
                code,
                masterMenuCode,
                masterRecipeCategoryCode,
                name,
                name_en,
                name_th,
                description,
                version: 1,
                servingSize,
                ingredients: processedIngredients,
                preparationSteps,
                prepTimeMinutes,
                cookTimeMinutes,
                totalTimeMinutes: prepTimeMinutes + cookTimeMinutes,
                difficultyLevel,
                nutritionPerServing: {}, // To be calculated
                costPerServing: 0, // To be calculated
                totalWeightPerServing: totalWeight / servingSize,
                equipmentNeeded,
                tags,
                isVegetarian,
                isVegan,
                isHalal,
                isGlutenFree,
                allergens: Array.from(allergens),
                imageUrl,
                videoUrl,
                isPrimary,
                isActive: true,
                isDeleted: false,
                createdBy: '',
                updatedBy: '',
                createdAt: now,
                updatedAt: now
            };

            const result = await db.collection(COLLECTION_NAME).insertOne(document);

            res.status(201).json({
                message: 'Master recipe created successfully',
                data: { ...document, _id: result.insertedId }
            });
        } catch (error) {
            console.error('Error creating master recipe:', error);
            res.status(500).json({ error: 'Failed to create master recipe' });
        }
    },

    /**
     * Get all master recipes
     */
    getAll: async (req, res, db) => {
        try {
            const { 
                includeDeleted = 'false',
                activeOnly = 'true',
                masterMenuCode = '',
                masterRecipeCategoryCode = '',
                tag = '',
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

            if (masterMenuCode) {
                query.masterMenuCode = masterMenuCode;
            }

            if (masterRecipeCategoryCode) {
                query.masterRecipeCategoryCode = masterRecipeCategoryCode;
            }

            if (tag) {
                query.tags = tag;
            }

            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { name_en: { $regex: search, $options: 'i' } }
                ];
            }

            const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

            const [recipes, total] = await Promise.all([
                db.collection(COLLECTION_NAME)
                    .find(query)
                    .sort(sort)
                    .skip(parseInt(skip))
                    .limit(parseInt(limit))
                    .toArray(),
                db.collection(COLLECTION_NAME).countDocuments(query)
            ]);

            res.status(200).json({
                data: recipes,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    skip: parseInt(skip),
                    hasMore: parseInt(skip) + recipes.length < total
                }
            });
        } catch (error) {
            console.error('Error fetching master recipes:', error);
            res.status(500).json({ error: 'Failed to fetch master recipes' });
        }
    },

    /**
     * Get a single master recipe by code
     */
    getByCode: async (req, res, db) => {
        try {
            const { code } = req.params;

            const recipe = await db.collection(COLLECTION_NAME).findOne({ 
                code, 
                isDeleted: false 
            });

            if (!recipe) {
                return res.status(404).json({ error: 'Master recipe not found' });
            }

            // Fetch related data
            const [menu, category, ingredientDetails] = await Promise.all([
                db.collection('masterMenus').findOne({ 
                    code: recipe.masterMenuCode, 
                    isDeleted: false 
                }),
                recipe.masterRecipeCategoryCode ? 
                    db.collection('masterRecipeCategories').findOne({ 
                        code: recipe.masterRecipeCategoryCode, 
                        isDeleted: false 
                    }) : null,
                db.collection('masterIngredients')
                    .find({ 
                        code: { $in: recipe.ingredients.map(i => i.masterIngredientCode) },
                        isDeleted: false 
                    })
                    .toArray()
            ]);

            // Enrich ingredients with full details
            const ingredientMap = new Map(ingredientDetails.map(i => [i.code, i]));
            const enrichedIngredients = recipe.ingredients.map(ing => ({
                ...ing,
                ingredientDetails: ingredientMap.get(ing.masterIngredientCode)
            }));

            res.status(200).json({ 
                data: {
                    ...recipe,
                    ingredients: enrichedIngredients,
                    menu,
                    category
                }
            });
        } catch (error) {
            console.error('Error fetching master recipe:', error);
            res.status(500).json({ error: 'Failed to fetch master recipe' });
        }
    },

    /**
     * Get recipe by menu code (primary recipe)
     */
    getByMenuCode: async (req, res, db) => {
        try {
            const { menuCode } = req.params;

            const recipe = await db.collection(COLLECTION_NAME).findOne({ 
                masterMenuCode: menuCode,
                isPrimary: true,
                isDeleted: false 
            });

            if (!recipe) {
                return res.status(404).json({ error: 'Recipe not found for this menu' });
            }

            res.status(200).json({ data: recipe });
        } catch (error) {
            console.error('Error fetching recipe by menu code:', error);
            res.status(500).json({ error: 'Failed to fetch recipe' });
        }
    },

    /**
     * Update a master recipe
     */
    update: async (req, res, db) => {
        try {
            const { code } = req.params;
            const updates = req.body;

            // Remove fields that shouldn't be updated directly
            delete updates._id;
            delete updates.code;
            delete updates.createdAt;
            delete updates.createdBy;

            // Handle ingredient updates if provided
            if (updates.ingredients) {
                const processedIngredients = [];
                let totalWeight = 0;
                const allergens = new Set();
                let isVegetarian = true;
                let isVegan = true;
                let isHalal = true;
                let isGlutenFree = true;

                for (const ing of updates.ingredients) {
                    const ingredient = await db.collection('masterIngredients').findOne({
                        code: ing.masterIngredientCode,
                        isDeleted: false
                    });

                    if (!ingredient) {
                        return res.status(400).json({ 
                            error: `Invalid ingredient code: ${ing.masterIngredientCode}` 
                        });
                    }

                    processedIngredients.push({
                        masterIngredientCode: ing.masterIngredientCode,
                        ingredientName: ingredient.name,
                        ingredientNameEn: ingredient.name_en,
                        quantity: parseFloat(ing.quantity),
                        unit: ing.unit || 'g',
                        isOptional: ing.isOptional || false,
                        notes: ing.notes || ''
                    });

                    totalWeight += parseFloat(ing.quantity);

                    if (ingredient.allergens) {
                        ingredient.allergens.forEach(a => allergens.add(a));
                    }

                    if (!ingredient.isVegetarian) isVegetarian = false;
                    if (!ingredient.isVegan) isVegan = false;
                    if (!ingredient.isHalal) isHalal = false;
                    if (!ingredient.isGlutenFree) isGlutenFree = false;
                }

                updates.ingredients = processedIngredients;
                updates.allergens = Array.from(allergens);
                updates.isVegetarian = isVegetarian;
                updates.isVegan = isVegan;
                updates.isHalal = isHalal;
                updates.isGlutenFree = isGlutenFree;
                
                const servingSize = updates.servingSize || 1;
                updates.totalWeightPerServing = totalWeight / servingSize;
            }

            // Update total time if prep or cook time changed
            if (updates.prepTimeMinutes !== undefined || updates.cookTimeMinutes !== undefined) {
                const existing = await db.collection(COLLECTION_NAME).findOne({ code });
                const prep = updates.prepTimeMinutes ?? existing.prepTimeMinutes;
                const cook = updates.cookTimeMinutes ?? existing.cookTimeMinutes;
                updates.totalTimeMinutes = prep + cook;
            }

            updates.updatedAt = new Date();
            updates.$inc = { version: 1 };

            const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
                { code, isDeleted: false },
                { $set: updates, $inc: { version: 1 } },
                { returnDocument: 'after' }
            );

            if (!result) {
                return res.status(404).json({ error: 'Master recipe not found' });
            }

            res.status(200).json({
                message: 'Master recipe updated successfully',
                data: result
            });
        } catch (error) {
            console.error('Error updating master recipe:', error);
            res.status(500).json({ error: 'Failed to update master recipe' });
        }
    },

    /**
     * Soft delete a master recipe
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
                return res.status(404).json({ error: 'Master recipe not found' });
            }

            res.status(200).json({
                message: 'Master recipe deleted successfully',
                data: result
            });
        } catch (error) {
            console.error('Error deleting master recipe:', error);
            res.status(500).json({ error: 'Failed to delete master recipe' });
        }
    },

    /**
     * Calculate ingredient requirements for a quantity of servings
     */
    calculateIngredients: async (req, res, db) => {
        try {
            const { code } = req.params;
            const { servings = 1 } = req.query;

            const recipe = await db.collection(COLLECTION_NAME).findOne({ 
                code, 
                isDeleted: false 
            });

            if (!recipe) {
                return res.status(404).json({ error: 'Master recipe not found' });
            }

            const multiplier = parseFloat(servings) / recipe.servingSize;

            const calculatedIngredients = recipe.ingredients.map(ing => ({
                ...ing,
                calculatedQuantity: Math.round(ing.quantity * multiplier * 100) / 100
            }));

            res.status(200).json({
                recipeCode: code,
                recipeName: recipe.name,
                originalServingSize: recipe.servingSize,
                requestedServings: parseFloat(servings),
                multiplier,
                ingredients: calculatedIngredients,
                totalWeight: Math.round(recipe.totalWeightPerServing * parseFloat(servings) * 100) / 100
            });
        } catch (error) {
            console.error('Error calculating ingredients:', error);
            res.status(500).json({ error: 'Failed to calculate ingredients' });
        }
    },

    /**
     * Get recipes that use a specific ingredient
     */
    getByIngredient: async (req, res, db) => {
        try {
            const { ingredientCode } = req.params;
            const { activeOnly = 'true' } = req.query;

            const query = {
                'ingredients.masterIngredientCode': ingredientCode,
                isDeleted: false
            };

            if (activeOnly === 'true') {
                query.isActive = true;
            }

            const recipes = await db.collection(COLLECTION_NAME)
                .find(query)
                .toArray();

            res.status(200).json({
                ingredientCode,
                recipeCount: recipes.length,
                recipes: recipes.map(r => ({
                    code: r.code,
                    name: r.name,
                    masterMenuCode: r.masterMenuCode,
                    ingredientUsage: r.ingredients.find(i => i.masterIngredientCode === ingredientCode)
                }))
            });
        } catch (error) {
            console.error('Error fetching recipes by ingredient:', error);
            res.status(500).json({ error: 'Failed to fetch recipes' });
        }
    }
};

module.exports = masterRecipeController;
