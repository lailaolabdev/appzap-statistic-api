/**
 * Master Recipe Model
 * 
 * Represents standardized recipes that define the ingredients needed
 * for each master menu item. This is the core model for ingredient
 * consumption analytics.
 * 
 * Each recipe links a master menu to its required ingredients with
 * precise quantities (in grams).
 */

const masterRecipeSchema = {
    // Unique identifier code (auto-generated)
    // Format: REC-XXXXXXXX
    code: {
        type: 'string',
        required: true,
        unique: true,
        index: true
    },
    
    // Reference to master menu code (1:1 relationship typically)
    masterMenuCode: {
        type: 'string',
        required: true,
        index: true
    },
    
    // Reference to recipe category code
    masterRecipeCategoryCode: {
        type: 'string',
        default: null,
        index: true
    },
    
    // Recipe name (usually same as menu name)
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
    
    // Description
    description: {
        type: 'string',
        default: ''
    },
    
    // Recipe version (for tracking changes)
    version: {
        type: 'number',
        default: 1
    },
    
    // Serving size (number of portions this recipe makes)
    servingSize: {
        type: 'number',
        default: 1
    },
    
    // Ingredients list with quantities
    // All quantities are in grams (g) as the base unit
    ingredients: {
        type: 'array',
        default: [],
        // Each item: {
        //     masterIngredientCode: 'ING-XXXXXXXX',
        //     quantity: 200,  // in grams
        //     unit: 'g',      // display unit (always stored as g internally)
        //     isOptional: false,
        //     notes: 'diced'  // preparation notes
        // }
    },
    
    // Preparation steps (optional, for future expansion)
    preparationSteps: {
        type: 'array',
        default: []
        // Each item: {
        //     stepNumber: 1,
        //     instruction: 'Wash and dice the vegetables',
        //     timeMinutes: 5
        // }
    },
    
    // Total preparation time in minutes
    prepTimeMinutes: {
        type: 'number',
        default: 0
    },
    
    // Total cooking time in minutes
    cookTimeMinutes: {
        type: 'number',
        default: 0
    },
    
    // Total time (prep + cook)
    totalTimeMinutes: {
        type: 'number',
        default: 0
    },
    
    // Difficulty level (1-5)
    difficultyLevel: {
        type: 'number',
        default: 1
    },
    
    // Calculated nutrition per serving (derived from ingredients)
    nutritionPerServing: {
        type: 'object',
        default: {
            calories: 0,
            protein: 0,
            carbohydrates: 0,
            fat: 0,
            fiber: 0,
            sodium: 0
        }
    },
    
    // Total ingredient cost per serving (calculated from ingredients)
    costPerServing: {
        type: 'number',
        default: 0  // in LAK
    },
    
    // Total weight of ingredients per serving (in grams)
    totalWeightPerServing: {
        type: 'number',
        default: 0
    },
    
    // Equipment needed
    equipmentNeeded: {
        type: 'array',
        default: []  // e.g., ['wok', 'rice cooker', 'blender']
    },
    
    // Tags for filtering
    tags: {
        type: 'array',
        default: []  // e.g., ['quick', 'easy', 'family-size', 'party']
    },
    
    // Dietary flags (derived from ingredients or overridden)
    isVegetarian: {
        type: 'boolean',
        default: false
    },
    
    isVegan: {
        type: 'boolean',
        default: false
    },
    
    isHalal: {
        type: 'boolean',
        default: false
    },
    
    isGlutenFree: {
        type: 'boolean',
        default: false
    },
    
    // Allergens (derived from ingredients)
    allergens: {
        type: 'array',
        default: []
    },
    
    // Image URL
    imageUrl: {
        type: 'string',
        default: ''
    },
    
    // Video URL (for cooking instructions)
    videoUrl: {
        type: 'string',
        default: ''
    },
    
    // Whether this is the primary recipe for the menu
    // (a menu could have multiple recipe variations)
    isPrimary: {
        type: 'boolean',
        default: true
    },
    
    // Whether this recipe is active
    isActive: {
        type: 'boolean',
        default: true
    },
    
    // Soft delete flag
    isDeleted: {
        type: 'boolean',
        default: false
    },
    
    // Created by (admin user)
    createdBy: {
        type: 'string',
        default: ''
    },
    
    // Last updated by
    updatedBy: {
        type: 'string',
        default: ''
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
const COLLECTION_NAME = 'masterRecipes';

// Indexes
const indexes = [
    { key: { code: 1 }, unique: true },
    { key: { masterMenuCode: 1 } },
    { key: { masterRecipeCategoryCode: 1 } },
    { key: { name: 1 } },
    { key: { 'ingredients.masterIngredientCode': 1 } },
    { key: { isActive: 1, isDeleted: 1 } },
    { key: { isPrimary: 1 } },
    { key: { tags: 1 } }
];

module.exports = {
    schema: masterRecipeSchema,
    collectionName: COLLECTION_NAME,
    indexes
};
