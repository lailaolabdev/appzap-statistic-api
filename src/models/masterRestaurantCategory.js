/**
 * Master Restaurant Category Model
 * 
 * Represents standardized restaurant types/categories.
 * Links to recommended menus and categories for quick setup.
 * 
 * Examples: Cafe, Beer Garden, Restaurant, Bar, Nightclub, etc.
 */

const masterRestaurantCategorySchema = {
    // Unique identifier code (auto-generated)
    // Format: RCAT-XXXXXXXX
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
    
    // Search keywords for matching
    keywords: {
        type: 'array',
        default: []
    },
    
    // Description of the restaurant type
    description: {
        type: 'string',
        default: ''
    },
    
    // Icon URL for the restaurant category
    icon: {
        type: 'string',
        default: ''
    },
    
    // Cover image URL
    coverImage: {
        type: 'string',
        default: ''
    },
    
    // NOTE: recommendedCategoryCodes and recommendedMenuCodes are REMOVED
    // The relationship is now reversed - categories and menus have
    // recommendedRestaurantTypes field that links back to this collection.
    // This approach is more scalable as array sizes stay small.
    
    // Typical number of menu items for this restaurant type
    typicalMenuCount: {
        type: 'number',
        default: 50
    },
    
    // Typical number of categories for this restaurant type
    typicalCategoryCount: {
        type: 'number',
        default: 8
    },
    
    // Business characteristics
    characteristics: {
        type: 'object',
        default: {
            hasAlcohol: false,          // Serves alcohol
            hasFood: true,              // Serves food
            hasDineIn: true,            // Dine-in available
            hasTakeaway: true,          // Takeaway available
            hasDelivery: false,         // Delivery available
            typicalOperatingHours: '',  // e.g., "06:00-22:00"
            peakHours: [],              // e.g., ["11:00-14:00", "18:00-21:00"]
            avgTicketSize: 0,           // Average bill amount in LAK
            targetCustomers: []         // e.g., ["families", "young adults", "business"]
        }
    },
    
    // Sort order for display
    sortOrder: {
        type: 'number',
        default: 0
    },
    
    // Whether this restaurant category is active
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
const COLLECTION_NAME = 'masterRestaurantCategories';

// Indexes for optimal query performance
const indexes = [
    { key: { code: 1 }, unique: true },
    { key: { name: 1 } },
    { key: { name_en: 1 } },
    { key: { isActive: 1, isDeleted: 1 } },
    { key: { keywords: 1 } }
];

module.exports = {
    schema: masterRestaurantCategorySchema,
    collectionName: COLLECTION_NAME,
    indexes
};
