/**
 * Master Menu Model
 * 
 * Represents standardized menu items across all stores.
 * Each master menu has a unique code that can be linked to
 * individual store menus for cross-store analytics.
 * 
 * Examples: Fried Rice, Pad Thai, Green Curry, etc.
 */

const masterMenuSchema = {
    // Unique identifier code (auto-generated)
    // Format: MENU-XXXXXXXX
    code: {
        type: 'string',
        required: true,
        unique: true,
        index: true
    },
    
    // Reference to master category code
    masterCategoryCode: {
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
    
    // Recommended restaurant types (array of readable codes)
    // e.g., ['RCAT-BEERGARDEN', 'RCAT-BAR', 'RCAT-RESTAURANT']
    recommendedRestaurantTypes: {
        type: 'array',
        default: []
    },
    
    // Standard/reference price in LAK (for benchmarking)
    standardPrice: {
        type: 'number',
        default: 0
    },
    
    // Standard image URL for the menu item
    imageUrl: {
        type: 'string',
        default: ''
    },
    
    // Search keywords for auto-matching
    // Array of alternative names, regional variations, common misspellings
    keywords: {
        type: 'array',
        default: []
    },
    
    // Description of the menu item
    description: {
        type: 'string',
        default: ''
    },
    
    // Standard image URL
    imageUrl: {
        type: 'string',
        default: ''
    },
    
    // Allergen information
    allergens: {
        type: 'array',
        default: []  // e.g., ['gluten', 'dairy', 'nuts', 'shellfish']
    },
    
    // Dietary flags
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
    
    // Spice level (0-5)
    spiceLevel: {
        type: 'number',
        default: 0
    },
    
    // Preparation time in minutes (average)
    prepTimeMinutes: {
        type: 'number',
        default: 0
    },
    
    // Sort order within category
    sortOrder: {
        type: 'number',
        default: 0
    },
    
    // Whether this menu item is active
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
const COLLECTION_NAME = 'masterMenus';

// Indexes for optimal query performance
const indexes = [
    { key: { code: 1 }, unique: true },
    { key: { masterCategoryCode: 1 } },
    { key: { name: 1 } },
    { key: { name_en: 1 } },
    { key: { isActive: 1, isDeleted: 1 } },
    { key: { keywords: 1 } },
    { key: { recommendedRestaurantTypes: 1 } }
];

module.exports = {
    schema: masterMenuSchema,
    collectionName: COLLECTION_NAME,
    indexes
};
