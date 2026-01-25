/**
 * Master Ingredient Model
 * 
 * Represents standardized ingredients used in recipes.
 * All quantities are normalized to grams (g) as the base unit.
 * 
 * Examples: Rice, Chicken Breast, Garlic, Fish Sauce, etc.
 */

const masterIngredientSchema = {
    // Unique identifier code (auto-generated)
    // Format: ING-XXXXXXXX
    code: {
        type: 'string',
        required: true,
        unique: true,
        index: true
    },
    
    // Reference to ingredient category code
    masterIngredientCategoryCode: {
        type: 'string',
        required: true,
        index: true
    },
    
    // Standard name in Lao
    name: {
        type: 'string',
        required: true
    },
    
    // English name
    name_en: {
        type: 'string',
        default: ''
    },
    
    // Thai name
    name_th: {
        type: 'string',
        default: ''
    },
    
    // Chinese name
    name_cn: {
        type: 'string',
        default: ''
    },
    
    // Korean name
    name_kr: {
        type: 'string',
        default: ''
    },
    
    // Japanese name
    name_jp: {
        type: 'string',
        default: ''
    },
    
    // Vietnamese name
    name_vi: {
        type: 'string',
        default: ''
    },
    
    // Search keywords
    keywords: {
        type: 'array',
        default: []
    },
    
    // Description
    description: {
        type: 'string',
        default: ''
    },
    
    // Image URL
    imageUrl: {
        type: 'string',
        default: ''
    },
    
    // Base unit is always grams (g)
    // This is the standard unit for all measurements
    baseUnit: {
        type: 'string',
        default: 'g'
    },
    
    // Conversion factors to base unit (grams)
    // e.g., { "kg": 1000, "lb": 453.592, "oz": 28.3495, "piece": 50, "tbsp": 15, "tsp": 5, "cup": 240, "ml": 1 }
    unitConversions: {
        type: 'object',
        default: {
            g: 1,
            kg: 1000,
            mg: 0.001,
            lb: 453.592,
            oz: 28.3495
        }
    },
    
    // Common display units for this ingredient
    // e.g., for liquids: ml, L; for solids: g, kg, pieces
    displayUnits: {
        type: 'array',
        default: ['g', 'kg']
    },
    
    // Average weight per piece (in grams) - for countable items
    // e.g., 1 egg = 50g, 1 garlic clove = 5g
    averageWeightPerPiece: {
        type: 'number',
        default: null
    },
    
    // Nutritional information per 100g
    nutritionPer100g: {
        type: 'object',
        default: {
            calories: 0,        // kcal
            protein: 0,         // g
            carbohydrates: 0,   // g
            fat: 0,             // g
            fiber: 0,           // g
            sodium: 0           // mg
        }
    },
    
    // Cost tracking (optional)
    averageCostPerGram: {
        type: 'number',
        default: 0  // in LAK
    },
    
    // Storage requirements
    storageType: {
        type: 'string',
        default: 'dry'  // dry, refrigerated, frozen
    },
    
    // Shelf life in days
    shelfLifeDays: {
        type: 'number',
        default: 0
    },
    
    // Allergen flags
    allergens: {
        type: 'array',
        default: []  // e.g., ['gluten', 'dairy', 'nuts', 'soy', 'shellfish', 'eggs', 'fish']
    },
    
    // Dietary flags
    isVegetarian: {
        type: 'boolean',
        default: true
    },
    
    isVegan: {
        type: 'boolean',
        default: true
    },
    
    isHalal: {
        type: 'boolean',
        default: true
    },
    
    isGlutenFree: {
        type: 'boolean',
        default: true
    },
    
    // Origin/source information
    origin: {
        type: 'string',
        default: ''  // e.g., 'local', 'imported', 'regional'
    },
    
    // Seasonality (months when typically available)
    seasonalMonths: {
        type: 'array',
        default: []  // e.g., [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] for year-round
    },
    
    // Sort order
    sortOrder: {
        type: 'number',
        default: 0
    },
    
    // Whether this ingredient is active
    isActive: {
        type: 'boolean',
        default: true
    },
    
    // Soft delete flag
    isDeleted: {
        type: 'boolean',
        default: false
    },
    
    // Timestamps
    createdAt: {
        type: 'date',
        default: () => new Date()
    },
    
    updatedAt: {
        type: 'date',
        default: () => new Date()
    }
};

// Collection name
const COLLECTION_NAME = 'masterIngredients';

// Indexes
const indexes = [
    { key: { code: 1 }, unique: true },
    { key: { masterIngredientCategoryCode: 1 } },
    { key: { name: 1 } },
    { key: { name_en: 1 } },
    { key: { isActive: 1, isDeleted: 1 } },
    { key: { keywords: 1 } },
    { key: { allergens: 1 } }
];

module.exports = {
    schema: masterIngredientSchema,
    collectionName: COLLECTION_NAME,
    indexes
};
