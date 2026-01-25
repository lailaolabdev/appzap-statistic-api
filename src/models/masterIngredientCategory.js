/**
 * Master Ingredient Category Model
 * 
 * Represents standardized ingredient categories for organizing ingredients.
 * This follows food industry standards for ingredient classification.
 * 
 * Examples: Proteins, Vegetables, Fruits, Dairy, Grains, Spices, Oils, etc.
 */

const masterIngredientCategorySchema = {
    // Unique identifier code (auto-generated)
    // Format: INGCAT-XXXXXXXX
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
    
    // Storage recommendations
    storageType: {
        type: 'string',
        default: 'dry'  // dry, refrigerated, frozen
    },
    
    // Default shelf life in days
    defaultShelfLifeDays: {
        type: 'number',
        default: 0
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
const COLLECTION_NAME = 'masterIngredientCategories';

// Indexes
const indexes = [
    { key: { code: 1 }, unique: true },
    { key: { parentCode: 1 } },
    { key: { name: 1 } },
    { key: { name_en: 1 } },
    { key: { isActive: 1, isDeleted: 1 } },
    { key: { level: 1 } }
];

module.exports = {
    schema: masterIngredientCategorySchema,
    collectionName: COLLECTION_NAME,
    indexes
};
