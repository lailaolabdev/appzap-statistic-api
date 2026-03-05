/**
 * Master Data Seeds
 * 
 * Comprehensive seed data for the master analytics system.
 * Reads data from CSV files in the /src/data directory for easy modification.
 * 
 * USAGE:
 * node src/seeds/masterDataSeeds.js
 * 
 * WARNING: This will create new collections if they don't exist.
 * It will NOT modify any existing data in menus, categories, orders, or bills.
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');
const {
    generateMasterCategoryCode,
    generateMasterMenuCode,
    generateMasterIngredientCategoryCode,
    generateMasterIngredientCode,
    generateMasterRecipeCategoryCode,
    generateMasterRecipeCode,
    generateMasterRestaurantCategoryCode
} = require('../utils/codeGenerator');
const { loadAllMasterData } = require('../utils/csvParser');

/**
 * Load recipes from JSON file
 */
function loadRecipesFromJSON(dataDir) {
    const filePath = path.join(dataDir, 'masterRecipes.json');
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        return data.recipes || [];
    }
    return [];
}

/**
 * Load AI enrichment data from JSON file
 * @param {string} dataDir - Data directory path
 * @param {string} fileName - JSON file name
 * @returns {Object} AI data indexed by code
 */
function loadAIData(dataDir, fileName) {
    const filePath = path.join(dataDir, fileName);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        return data.aiData || {};
    }
    return {};
}

/**
 * Merge AI data with base data
 * @param {Object} baseData - Base data from CSV
 * @param {Object} aiData - AI enrichment data
 * @param {string} code - The code to look up in AI data
 * @returns {Object} Merged data
 */
function mergeAIData(baseData, aiData, code) {
    const enrichment = aiData[code] || {};
    return { ...baseData, ...enrichment };
}

/**
 * Main seed function
 */
async function seedMasterData() {
    let client;

    try {
        // Load data from CSV files
        console.log('Loading data from CSV files...');
        const dataDir = path.join(__dirname, '..', 'data');
        const data = loadAllMasterData(dataDir);

        // Load AI enrichment data
        console.log('Loading AI enrichment data...');
        const menuAIData = loadAIData(dataDir, 'masterMenusAI.json');
        const categoryAIData = loadAIData(dataDir, 'masterCategoriesAI.json');
        const restCategoryAIData = loadAIData(dataDir, 'masterRestaurantCategoriesAI.json');

        console.log(`Loaded:`);
        console.log(`  - ${data.masterCategories.length} master categories`);
        console.log(`  - ${data.masterMenus.length} master menus`);
        console.log(`  - ${data.masterRestaurantCategories.length} restaurant categories`);
        console.log(`  - ${data.masterIngredientCategories.length} ingredient categories`);
        console.log(`  - ${data.masterIngredients.length} ingredients`);
        console.log(`  - ${data.masterRecipeCategories.length} recipe categories`);
        console.log(`  - ${Object.keys(menuAIData).length} menu AI enrichments`);
        console.log(`  - ${Object.keys(categoryAIData).length} category AI enrichments`);
        console.log(`  - ${Object.keys(restCategoryAIData).length} restaurant category AI enrichments`);

        // Connect to MongoDB
        console.log('\nConnecting to MongoDB...');
        client = await MongoClient.connect(process.env.MONGODB_URI_POS_V2);
        const db = client.db('AppZap');
        console.log('Connected successfully!');

        const now = new Date();

        // ============================================
        // 1. Seed Master Categories
        // ============================================
        console.log('\n1. Seeding Master Categories...');
        const existingCategories = await db.collection('masterCategories').countDocuments();

        if (existingCategories > 0) {
            console.log(`   Skipping: ${existingCategories} categories already exist`);
        } else {
            const categoryDocs = data.masterCategories.map(cat => {
                const code = cat.code || generateMasterCategoryCode();
                const aiEnrichment = categoryAIData[code] || {};

                return {
                    code,
                    name: cat.name,
                    name_en: cat.name_en || '',
                    name_th: cat.name_th || '',
                    name_cn: cat.name_cn || '',
                    name_kr: cat.name_kr || '',
                    name_jp: cat.name_jp || '',
                    name_vi: cat.name_vi || '',
                    keywords: cat.keywords || [],
                    description: cat.description || '',
                    icon: '',
                    sortOrder: cat.sortOrder || 0,
                    recommendedRestaurantTypes: cat.recommendedRestaurantTypes || [],
                    // AI-Ready Fields (merged from AI enrichment data)
                    typicalTasteProfile: aiEnrichment.typicalTasteProfile || cat.typicalTasteProfile || { sweet: 0, sour: 0, spicy: 0, salty: 0, bitter: 0, umami: 0 },
                    occasions: aiEnrichment.occasions || cat.occasions || [],
                    mealTimes: aiEnrichment.mealTimes || cat.mealTimes || [],
                    aiDescription: aiEnrichment.aiDescription || cat.aiDescription || '',
                    isActive: true,
                    isDeleted: false,
                    createdAt: now,
                    updatedAt: now
                };
            });

            const result = await db.collection('masterCategories').insertMany(categoryDocs);
            console.log(`   Created ${result.insertedCount} master categories`);
        }

        // Get category code map for menus (by index)
        const allCategories = await db.collection('masterCategories')
            .find({})
            .sort({ sortOrder: 1 })
            .toArray();
        const categoryCodeMap = {};
        allCategories.forEach((cat, index) => {
            categoryCodeMap[index] = cat.code;
        });

        // ============================================
        // 2. Seed Master Menus
        // ============================================
        console.log('\n2. Seeding Master Menus...');
        const existingMenus = await db.collection('masterMenus').countDocuments();

        if (existingMenus > 0) {
            console.log(`   Skipping: ${existingMenus} menus already exist`);
        } else {
            const menuDocs = data.masterMenus.map(menu => {
                const code = menu.code || generateMasterMenuCode();
                const aiEnrichment = menuAIData[code] || {};

                return {
                    code,
                    masterCategoryCode: categoryCodeMap[menu.categoryIndex] || categoryCodeMap[0],
                    name: menu.name,
                    name_en: menu.name_en || '',
                    name_th: menu.name_th || '',
                    name_cn: menu.name_cn || '',
                    name_kr: menu.name_kr || '',
                    name_jp: menu.name_jp || '',
                    name_vi: menu.name_vi || '',
                    keywords: menu.keywords || [],
                    description: menu.description || '',
                    standardPrice: menu.standardPrice || 0,
                    imageUrl: menu.imageUrl || '',
                    recommendedRestaurantTypes: menu.recommendedRestaurantTypes || [],
                    allergens: [],
                    isVegetarian: menu.isVegetarian || false,
                    isVegan: menu.isVegan || false,
                    isHalal: menu.isHalal !== false,
                    isGlutenFree: menu.isGlutenFree || false,
                    spiceLevel: aiEnrichment.tasteProfile?.spicy || menu.spiceLevel || 0,
                    prepTimeMinutes: menu.prepTimeMinutes || 0,
                    // AI-Ready Fields (merged from AI enrichment data)
                    tasteProfile: aiEnrichment.tasteProfile || menu.tasteProfile || { sweet: 0, sour: 0, spicy: 0, salty: 0, bitter: 0, umami: 0 },
                    textureProfile: aiEnrichment.textureProfile || menu.textureProfile || { crispy: 0, soft: 0, chewy: 0, creamy: 0, soupy: 0 },
                    servingTemperature: aiEnrichment.servingTemperature || menu.servingTemperature || 'room',
                    occasions: aiEnrichment.occasions || menu.occasions || [],
                    emotionTags: aiEnrichment.emotionTags || menu.emotionTags || [],
                    mealTimes: aiEnrichment.mealTimes || menu.mealTimes || [],
                    bestSeasons: aiEnrichment.bestSeasons || menu.bestSeasons || [],
                    pairingMenuCodes: aiEnrichment.pairingMenuCodes || menu.pairingMenuCodes || [],
                    aiDescription: aiEnrichment.aiDescription || menu.aiDescription || '',
                    aiDescription_th: menu.aiDescription_th || '',
                    aiDescription_en: aiEnrichment.aiDescription || menu.aiDescription_en || '',
                    popularityScore: aiEnrichment.popularityScore || menu.popularityScore || 50,
                    sortOrder: 0,
                    isActive: true,
                    isDeleted: false,
                    createdAt: now,
                    updatedAt: now
                };
            });

            const result = await db.collection('masterMenus').insertMany(menuDocs);
            console.log(`   Created ${result.insertedCount} master menus`);
        }

        // ============================================
        // 3. Seed Master Restaurant Categories
        // ============================================
        console.log('\n3. Seeding Master Restaurant Categories...');
        const existingRestCats = await db.collection('masterRestaurantCategories').countDocuments();

        if (existingRestCats > 0) {
            console.log(`   Skipping: ${existingRestCats} restaurant categories already exist`);
        } else {
            // Restaurant categories use readable codes from CSV (e.g., RCAT-BEERGARDEN)
            const restCatDocs = data.masterRestaurantCategories.map(cat => {
                const code = cat.code;
                const aiEnrichment = restCategoryAIData[code] || {};

                return {
                    code, // Use readable code from CSV instead of auto-generating
                    name: cat.name,
                    name_en: cat.name_en || '',
                    name_th: cat.name_th || '',
                    name_cn: cat.name_cn || '',
                    name_kr: cat.name_kr || '',
                    name_jp: cat.name_jp || '',
                    name_vi: cat.name_vi || '',
                    keywords: cat.keywords || [],
                    description: cat.description || '',
                    icon: '',
                    coverImage: '',
                    // NOTE: recommendedCategoryCodes and recommendedMenuCodes are removed
                    // The relationship is reversed - categories/menus have recommendedRestaurantTypes field
                    typicalMenuCount: cat.typicalMenuCount || 50,
                    typicalCategoryCount: cat.typicalCategoryCount || 8,
                    characteristics: {
                        hasAlcohol: cat.hasAlcohol || false,
                        hasFood: cat.hasFood !== false,
                        hasDineIn: true,
                        hasTakeaway: true,
                        hasDelivery: false,
                        typicalOperatingHours: '',
                        peakHours: [],
                        avgTicketSize: 0,
                        targetCustomers: []
                    },
                    // AI-Ready Fields (merged from AI enrichment data)
                    ambiance: aiEnrichment.ambiance || cat.ambiance || [],
                    features: aiEnrichment.features || cat.features || [],
                    typicalOccasions: aiEnrichment.typicalOccasions || cat.typicalOccasions || [],
                    priceTier: aiEnrichment.priceTier || cat.priceTier || 3,
                    noiseLevel: aiEnrichment.noiseLevel || cat.noiseLevel || 3,
                    aiDescription: aiEnrichment.aiDescription || cat.aiDescription || '',
                    sortOrder: cat.sortOrder || 0,
                    isActive: true,
                    isDeleted: false,
                    createdAt: now,
                    updatedAt: now
                };
            });

            const result = await db.collection('masterRestaurantCategories').insertMany(restCatDocs);
            console.log(`   Created ${result.insertedCount} master restaurant categories`);
        }

        // ============================================
        // 4. Seed Master Ingredient Categories
        // ============================================
        console.log('\n4. Seeding Master Ingredient Categories...');
        const existingIngCats = await db.collection('masterIngredientCategories').countDocuments();

        if (existingIngCats > 0) {
            console.log(`   Skipping: ${existingIngCats} ingredient categories already exist`);
        } else {
            const ingCatDocs = data.masterIngredientCategories.map((cat, index) => ({
                code: cat.code || generateMasterIngredientCategoryCode(), // Use code from CSV if available
                parentCode: null,
                name: cat.name,
                name_en: cat.name_en || '',
                name_th: cat.name_th || '',
                name_cn: cat.name_cn || '',
                name_kr: cat.name_kr || '',
                name_jp: cat.name_jp || '',
                name_vi: cat.name_vi || '',
                keywords: cat.keywords || [],
                description: '',
                icon: '',
                storageType: cat.storageType || 'dry',
                defaultShelfLifeDays: 0,
                sortOrder: cat.sortOrder || index,
                level: 0,
                isActive: true,
                isDeleted: false,
                createdAt: now,
                updatedAt: now
            }));

            const result = await db.collection('masterIngredientCategories').insertMany(ingCatDocs);
            console.log(`   Created ${result.insertedCount} master ingredient categories`);
        }

        // Get ingredient category code map
        const allIngCategories = await db.collection('masterIngredientCategories')
            .find({})
            .sort({ sortOrder: 1 })
            .toArray();
        const ingCategoryCodeMap = {};
        allIngCategories.forEach((cat, index) => {
            ingCategoryCodeMap[index] = cat.code;
        });

        // ============================================
        // 5. Seed Master Ingredients
        // ============================================
        console.log('\n5. Seeding Master Ingredients...');
        const existingIngs = await db.collection('masterIngredients').countDocuments();

        if (existingIngs > 0) {
            console.log(`   Skipping: ${existingIngs} ingredients already exist`);
        } else {
            const ingDocs = data.masterIngredients.map(ing => ({
                code: ing.code || generateMasterIngredientCode(), // Use code from CSV if available
                masterIngredientCategoryCode: ingCategoryCodeMap[ing.categoryIndex] || ingCategoryCodeMap[0],
                name: ing.name,
                name_en: ing.name_en || '',
                name_th: ing.name_th || '',
                name_cn: ing.name_cn || '',
                name_kr: ing.name_kr || '',
                name_jp: ing.name_jp || '',
                name_vi: ing.name_vi || '',
                keywords: ing.keywords || [],
                description: '',
                imageUrl: '',
                baseUnit: 'g',
                unitConversions: { g: 1, kg: 1000, mg: 0.001 },
                displayUnits: ['g', 'kg'],
                averageWeightPerPiece: ing.averageWeightPerPiece || null,
                nutritionPer100g: {},
                averageCostPerGram: 0,
                storageType: 'dry',
                shelfLifeDays: 0,
                allergens: [],
                isVegetarian: ing.isVegetarian !== false,
                isVegan: ing.isVegan !== false,
                isHalal: ing.isHalal !== false,
                isGlutenFree: true,
                origin: '',
                seasonalMonths: [],
                sortOrder: 0,
                isActive: true,
                isDeleted: false,
                createdAt: now,
                updatedAt: now
            }));

            const result = await db.collection('masterIngredients').insertMany(ingDocs);
            console.log(`   Created ${result.insertedCount} master ingredients`);
        }

        // ============================================
        // 6. Seed Master Recipe Categories
        // ============================================
        console.log('\n6. Seeding Master Recipe Categories...');
        const existingRecCats = await db.collection('masterRecipeCategories').countDocuments();

        if (existingRecCats > 0) {
            console.log(`   Skipping: ${existingRecCats} recipe categories already exist`);
        } else {
            const recCatDocs = data.masterRecipeCategories.map((cat, index) => ({
                code: cat.code || generateMasterRecipeCategoryCode(), // Use code from CSV if available
                parentCode: null,
                categoryType: cat.categoryType || 'cuisine',
                name: cat.name,
                name_en: cat.name_en || '',
                name_th: cat.name_th || '',
                name_cn: cat.name_cn || '',
                name_kr: cat.name_kr || '',
                name_jp: cat.name_jp || '',
                name_vi: cat.name_vi || '',
                keywords: cat.keywords || [],
                description: '',
                icon: '',
                colorCode: '#000000',
                sortOrder: cat.sortOrder || index,
                level: 0,
                isActive: true,
                isDeleted: false,
                createdAt: now,
                updatedAt: now
            }));

            const result = await db.collection('masterRecipeCategories').insertMany(recCatDocs);
            console.log(`   Created ${result.insertedCount} master recipe categories`);
        }

        // ============================================
        // 7. Seed Master Recipes (from JSON)
        // ============================================
        console.log('\n7. Seeding Master Recipes...');
        const existingRecipes = await db.collection('masterRecipes').countDocuments();

        if (existingRecipes > 0) {
            console.log(`   Skipping: ${existingRecipes} recipes already exist`);
        } else {
            // Load recipes from JSON
            const recipesData = loadRecipesFromJSON(dataDir);

            if (recipesData.length === 0) {
                console.log('   No recipe data found in masterRecipes.json');
            } else {
                // Validate codes exist in database (optional but good for data integrity)
                const allMenuCodes = new Set((await db.collection('masterMenus').find({}).toArray()).map(m => m.code));
                const allRecipeCatCodes = new Set((await db.collection('masterRecipeCategories').find({}).toArray()).map(c => c.code));
                const allIngredientCodes = new Set((await db.collection('masterIngredients').find({}).toArray()).map(i => i.code));

                // Process each recipe - use codes directly from JSON
                const recipeDocs = [];
                let skippedCount = 0;

                for (const recipe of recipesData) {
                    // Use menu code directly from JSON
                    const masterMenuCode = recipe.menuCode;
                    if (!masterMenuCode) {
                        console.log(`   Warning: No menuCode for recipe "${recipe.name_en}"`);
                        skippedCount++;
                        continue;
                    }
                    if (!allMenuCodes.has(masterMenuCode)) {
                        console.log(`   Warning: Menu code "${masterMenuCode}" not found for recipe "${recipe.name_en}" (menuName: ${recipe.menuName})`);
                        skippedCount++;
                        continue;
                    }

                    // Use recipe category code directly from JSON
                    const masterRecipeCategoryCode = recipe.recipeCategoryCode || null;
                    if (masterRecipeCategoryCode && !allRecipeCatCodes.has(masterRecipeCategoryCode)) {
                        console.log(`   Warning: Recipe category code "${masterRecipeCategoryCode}" not found for recipe "${recipe.name_en}"`);
                    }

                    // Process ingredients - use codes directly from JSON
                    const processedIngredients = [];

                    for (const ing of recipe.ingredients) {
                        const ingredientCode = ing.ingredientCode;
                        if (!ingredientCode) {
                            console.log(`   Warning: No ingredientCode for ingredient in recipe "${recipe.name_en}" (ingredientName: ${ing.ingredientName})`);
                        } else if (!allIngredientCodes.has(ingredientCode)) {
                            console.log(`   Warning: Ingredient code "${ingredientCode}" not found (ingredientName: ${ing.ingredientName}) in recipe "${recipe.name_en}"`);
                        }
                        processedIngredients.push({
                            masterIngredientCode: ingredientCode || 'UNKNOWN',
                            ingredientName: ing.ingredientName || '', // Keep name for quick checking
                            quantity: ing.quantity,
                            quantityUnit: ing.quantityUnit,
                            displayQuantity: ing.displayQuantity,
                            displayUnit: ing.displayUnit,
                            isOptional: ing.isOptional || false,
                            notes: ing.notes || ''
                        });
                    }

                    // Create recipe document
                    const recipeDoc = {
                        code: generateMasterRecipeCode(),
                        masterMenuCode,
                        menuName: recipe.menuName || '', // Keep name for quick checking
                        masterRecipeCategoryCode,
                        recipeCategoryName: recipe.recipeCategoryName || '', // Keep name for quick checking
                        name: recipe.name,
                        name_en: recipe.name_en,
                        name_th: recipe.name_th || '',
                        name_cn: recipe.name_cn || '',
                        name_kr: recipe.name_kr || '',
                        name_jp: recipe.name_jp || '',
                        name_vi: recipe.name_vi || '',
                        description: recipe.description || '',
                        version: 1,
                        servingSize: recipe.servingSize || 1,
                        difficultyLevel: recipe.difficultyLevel || 1,
                        spiceLevel: recipe.spiceLevel || 0,
                        ingredients: processedIngredients,
                        preparationSteps: (recipe.preparationSteps || []).map((step, idx) => ({
                            stepNumber: step.stepNumber || idx + 1,
                            title: step.title || '',
                            title_en: step.title_en || step.title || '',
                            instruction: step.instruction || '',
                            instruction_en: step.instruction_en || step.instruction || '',
                            timeMinutes: step.timeMinutes || 0
                        })),
                        prepTimeMinutes: recipe.prepTimeMinutes || 0,
                        cookTimeMinutes: recipe.cookTimeMinutes || 0,
                        totalTimeMinutes: recipe.totalTimeMinutes || 0,
                        nutritionPerServing: recipe.nutritionPerServing || {},
                        costPerServing: 0,
                        totalWeightPerServing: 0,
                        equipmentNeeded: recipe.equipmentNeeded || [],
                        tags: recipe.tags || [],
                        isVegetarian: recipe.isVegetarian || false,
                        isVegan: recipe.isVegan || false,
                        isHalal: recipe.isHalal || false,
                        isGlutenFree: recipe.isGlutenFree || false,
                        allergens: recipe.allergens || [],
                        imageUrl: '',
                        videoUrl: '',
                        isPrimary: true,
                        isActive: true,
                        isDeleted: false,
                        createdBy: 'seed',
                        updatedBy: 'seed',
                        createdAt: now,
                        updatedAt: now
                    };

                    recipeDocs.push(recipeDoc);
                }

                if (recipeDocs.length > 0) {
                    const result = await db.collection('masterRecipes').insertMany(recipeDocs);
                    console.log(`   Created ${result.insertedCount} master recipes`);
                    if (skippedCount > 0) {
                        console.log(`   Skipped ${skippedCount} recipes (menu not found)`);
                    }
                } else {
                    console.log('   No recipes created (all menus not found)');
                }
            }
        }

        // ============================================
        // 8. Create Indexes
        // ============================================
        console.log('\n8. Creating indexes...');

        // Master Categories
        await db.collection('masterCategories').createIndex({ code: 1 }, { unique: true });
        await db.collection('masterCategories').createIndex({ name: 1 });
        await db.collection('masterCategories').createIndex({ isActive: 1, isDeleted: 1 });
        await db.collection('masterCategories').createIndex({ recommendedRestaurantTypes: 1 });
        await db.collection('masterCategories').createIndex({ occasions: 1 });
        await db.collection('masterCategories').createIndex({ mealTimes: 1 });

        // Master Menus
        await db.collection('masterMenus').createIndex({ code: 1 }, { unique: true });
        await db.collection('masterMenus').createIndex({ masterCategoryCode: 1 });
        await db.collection('masterMenus').createIndex({ name: 1 });
        await db.collection('masterMenus').createIndex({ isActive: 1, isDeleted: 1 });
        await db.collection('masterMenus').createIndex({ standardPrice: 1 });
        await db.collection('masterMenus').createIndex({ recommendedRestaurantTypes: 1 });
        // AI search indexes for menus
        await db.collection('masterMenus').createIndex({ 'tasteProfile.spicy': 1 });
        await db.collection('masterMenus').createIndex({ 'tasteProfile.sweet': 1 });
        await db.collection('masterMenus').createIndex({ 'tasteProfile.sour': 1 });
        await db.collection('masterMenus').createIndex({ servingTemperature: 1 });
        await db.collection('masterMenus').createIndex({ occasions: 1 });
        await db.collection('masterMenus').createIndex({ emotionTags: 1 });
        await db.collection('masterMenus').createIndex({ mealTimes: 1 });
        await db.collection('masterMenus').createIndex({ bestSeasons: 1 });
        await db.collection('masterMenus').createIndex({ popularityScore: -1 });

        // Master Restaurant Categories
        await db.collection('masterRestaurantCategories').createIndex({ code: 1 }, { unique: true });
        await db.collection('masterRestaurantCategories').createIndex({ name: 1 });
        await db.collection('masterRestaurantCategories').createIndex({ isActive: 1, isDeleted: 1 });
        await db.collection('masterRestaurantCategories').createIndex({ ambiance: 1 });
        await db.collection('masterRestaurantCategories').createIndex({ features: 1 });
        await db.collection('masterRestaurantCategories').createIndex({ typicalOccasions: 1 });
        await db.collection('masterRestaurantCategories').createIndex({ priceTier: 1 });
        await db.collection('masterRestaurantCategories').createIndex({ noiseLevel: 1 });

        // Master Ingredient Categories
        await db.collection('masterIngredientCategories').createIndex({ code: 1 }, { unique: true });
        await db.collection('masterIngredientCategories').createIndex({ parentCode: 1 });

        // Master Ingredients
        await db.collection('masterIngredients').createIndex({ code: 1 }, { unique: true });
        await db.collection('masterIngredients').createIndex({ masterIngredientCategoryCode: 1 });
        await db.collection('masterIngredients').createIndex({ name: 1 });

        // Master Recipe Categories
        await db.collection('masterRecipeCategories').createIndex({ code: 1 }, { unique: true });
        await db.collection('masterRecipeCategories').createIndex({ categoryType: 1 });

        // Master Recipes
        await db.collection('masterRecipes').createIndex({ code: 1 }, { unique: true });
        await db.collection('masterRecipes').createIndex({ masterMenuCode: 1 });

        // Mappings
        await db.collection('menuMappings').createIndex({ menuId: 1, masterMenuCode: 1 }, { unique: true });
        await db.collection('menuMappings').createIndex({ storeId: 1 });
        await db.collection('menuMappings').createIndex({ masterMenuCode: 1 });

        await db.collection('categoryMappings').createIndex({ categoryId: 1, masterCategoryCode: 1 }, { unique: true });
        await db.collection('categoryMappings').createIndex({ storeId: 1 });
        await db.collection('categoryMappings').createIndex({ masterCategoryCode: 1 });

        console.log('   Indexes created successfully');

        // ============================================
        // Summary
        // ============================================
        console.log('\n========================================');
        console.log('SEED COMPLETE - Summary:');
        console.log('========================================');

        const counts = await Promise.all([
            db.collection('masterCategories').countDocuments(),
            db.collection('masterMenus').countDocuments(),
            db.collection('masterRestaurantCategories').countDocuments(),
            db.collection('masterIngredientCategories').countDocuments(),
            db.collection('masterIngredients').countDocuments(),
            db.collection('masterRecipeCategories').countDocuments(),
            db.collection('masterRecipes').countDocuments()
        ]);

        console.log(`Master Categories:            ${counts[0]}`);
        console.log(`Master Menus:                 ${counts[1]}`);
        console.log(`Master Restaurant Categories: ${counts[2]}`);
        console.log(`Master Ingredient Categories: ${counts[3]}`);
        console.log(`Master Ingredients:           ${counts[4]}`);
        console.log(`Master Recipe Categories:     ${counts[5]}`);
        console.log(`Master Recipes:               ${counts[6]}`);
        console.log('\n----------------------------------------');
        console.log('Data Location: src/data/');
        console.log('  CSV Files:');
        console.log('    - masterCategories.csv');
        console.log('    - masterMenus.csv');
        console.log('    - masterRestaurantCategories.csv');
        console.log('    - masterIngredientCategories.csv');
        console.log('    - masterIngredients.csv');
        console.log('    - masterRecipeCategories.csv');
        console.log('  JSON Files (nested/enrichment data):');
        console.log('    - masterRecipes.json (nested recipe data)');
        console.log('    - masterMenusAI.json (AI search fields)');
        console.log('    - masterCategoriesAI.json (AI search fields)');
        console.log('    - masterRestaurantCategoriesAI.json (AI search fields)');
        console.log('----------------------------------------');
        console.log('\nTo modify data, edit the data files and re-run');
        console.log('this seed script (after clearing collections).');
        console.log('========================================\n');

    } catch (error) {
        console.error('Seed error:', error);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
            console.log('Database connection closed.');
        }
    }
}

// Run if executed directly
if (require.main === module) {
    seedMasterData()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = { seedMasterData };
