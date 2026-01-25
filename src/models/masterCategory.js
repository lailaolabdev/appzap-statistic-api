/**
 * Master Category Model
 * 
 * Represents standardized menu categories across all stores.
 * Each master category has a unique code that can be linked to
 * individual store categories for cross-store analytics.
 * 
 * Examples: Beverages, Main Dishes, Appetizers, Desserts, etc.
 */

const masterCategorySchema = {
    // Unique identifier code (auto-generated)
    // Format: MCAT-XXXXXXXX
    code: {
        type: 'string',
        required: true,
        unique: true,
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
    
    // Recommended restaurant types (array of readable codes)
    // e.g., ['RCAT-BEERGARDEN', 'RCAT-BAR', 'RCAT-RESTAURANT']
    recommendedRestaurantTypes: {
        type: 'array',
        default: []
    },
    
    // Search keywords for auto-matching
    // Array of alternative names, common misspellings, etc.
    keywords: {
        type: 'array',
        default: []
    },
    
    // Description of the category
    description: {
        type: 'string',
        default: ''
    },
    
    // Icon or image URL for the category
    icon: {
        type: 'string',
        default: ''
    },
    
    // ============================================
    // AI-Ready Search Fields
    // ============================================
    
    // Typical taste profile for this category (0-5 scale)
    // Helps AI understand what kind of tastes are common in this category
    typicalTasteProfile: {
        type: 'object',
        default: {
            sweet: 0,
            sour: 0,
            spicy: 0,
            salty: 0,
            bitter: 0,
            umami: 0
        }
    },
    
    // Occasion/mood tags for this category
    // e.g., "Beer" category -> ['hangout', 'drinking', 'party']
    occasions: {
        type: 'array',
        default: []
    },
    
    // Meal time suitability for this category
    // e.g., "Breakfast" category -> ['breakfast', 'brunch']
    mealTimes: {
        type: 'array',
        default: []
    },
    
    // AI-ready rich description for this category
    aiDescription: {
        type: 'string',
        default: ''
    },
    
    // Sort order for display
    sortOrder: {
        type: 'number',
        default: 0
    },
    
    // Whether this category is active
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
const COLLECTION_NAME = 'masterCategories';

// Indexes for optimal query performance
const indexes = [
    { key: { code: 1 }, unique: true },
    { key: { name: 1 } },
    { key: { name_en: 1 } },
    { key: { isActive: 1, isDeleted: 1 } },
    { key: { keywords: 1 } },
    { key: { recommendedRestaurantTypes: 1 } },
    // AI search indexes
    { key: { occasions: 1 } },
    { key: { mealTimes: 1 } }
];

module.exports = {
    schema: masterCategorySchema,
    collectionName: COLLECTION_NAME,
    indexes
};
