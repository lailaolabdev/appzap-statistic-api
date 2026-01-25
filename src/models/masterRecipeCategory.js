/**
 * Master Recipe Category Model
 * 
 * Represents standardized recipe categories for organizing recipes.
 * Categories can be based on cuisine type, cooking method, meal type, etc.
 * 
 * Examples by cuisine: Lao, Thai, Chinese, Western, Japanese, Korean
 * Examples by method: Grilled, Fried, Steamed, Raw, Baked
 * Examples by meal: Breakfast, Lunch, Dinner, Snacks, Desserts
 */

const masterRecipeCategorySchema = {
    // Unique identifier code (auto-generated)
    // Format: RECCAT-XXXXXXXX
    code: {
        type: 'string',
        required: true,
        unique: true,
        index: true
    },
    
    // Parent category code (for hierarchical structure)
    // null for top-level categories
    parentCode: {
        type: 'string',
        default: null,
        index: true
    },
    
    // Category type to distinguish different classification methods
    categoryType: {
        type: 'string',
        default: 'cuisine'  // cuisine, cooking_method, meal_type, dietary
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
    
    // Icon or image URL
    icon: {
        type: 'string',
        default: ''
    },
    
    // Color code for UI display
    colorCode: {
        type: 'string',
        default: '#000000'
    },
    
    // Sort order
    sortOrder: {
        type: 'number',
        default: 0
    },
    
    // Hierarchy level (0 = root, 1 = subcategory, etc.)
    level: {
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
const COLLECTION_NAME = 'masterRecipeCategories';

// Indexes
const indexes = [
    { key: { code: 1 }, unique: true },
    { key: { parentCode: 1 } },
    { key: { categoryType: 1 } },
    { key: { name: 1 } },
    { key: { name_en: 1 } },
    { key: { isActive: 1, isDeleted: 1 } },
    { key: { level: 1 } }
];

module.exports = {
    schema: masterRecipeCategorySchema,
    collectionName: COLLECTION_NAME,
    indexes
};
