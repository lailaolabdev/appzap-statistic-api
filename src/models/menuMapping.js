/**
 * Menu Mapping Model
 * 
 * Links individual store menus to master menu items.
 * This enables cross-store analytics by normalizing menu data.
 * 
 * Supports both manual mapping (admin) and auto-suggested mapping (AI).
 */

const menuMappingSchema = {
    // Reference to store's menu _id (from existing 'menus' collection)
    menuId: {
        type: 'objectId',
        required: true,
        index: true
    },
    
    // Reference to store _id
    storeId: {
        type: 'objectId',
        required: true,
        index: true
    },
    
    // Original menu info (denormalized for display)
    menuName: {
        type: 'string',
        default: ''
    },
    
    menuName_en: {
        type: 'string',
        default: ''
    },
    
    // Normalized name for matching (lowercase, trimmed)
    normalizedName: {
        type: 'string',
        default: '',
        index: true
    },
    
    // Original price (for reference)
    originalPrice: {
        type: 'number',
        default: 0
    },
    
    // Reference to master menu (null if pending)
    masterMenuCode: {
        type: 'string',
        default: null,
        index: true
    },
    
    // Master menu info for easy admin display
    masterMenuName: {
        type: 'string',
        default: ''
    },
    
    masterMenuName_en: {
        type: 'string',
        default: ''
    },
    
    // Mapping status
    // 'pending' - Not yet analyzed
    // 'suggested' - Has suggestions, awaiting review
    // 'approved' - Admin approved mapping
    // 'rejected' - Admin rejected all suggestions
    // 'not-applicable' - Item should not be mapped (store-specific)
    mappingStatus: {
        type: 'string',
        default: 'pending',
        index: true
    },
    
    // Confidence score for top suggestion (0-100)
    confidenceScore: {
        type: 'number',
        default: 0,
        index: true
    },
    
    // Confidence level category
    // 'high' (>= 90), 'medium' (60-89), 'low' (< 60), 'none' (no matches)
    confidenceLevel: {
        type: 'string',
        default: 'none'
    },
    
    // Suggested mappings from algorithm (top 5)
    suggestedMappings: {
        type: 'array',
        default: []
        // Each item: {
        //   masterMenuCode: string,
        //   masterMenuName: string,
        //   masterMenuName_en: string,
        //   confidenceScore: number (0-100),
        //   matchType: 'exact' | 'fuzzy' | 'keyword'
        // }
    },
    
    // Mapping method
    mappingMethod: {
        type: 'string',
        default: 'pending'  // 'pending', 'auto_suggested', 'manual', 'learned'
    },
    
    // Approval tracking
    approvedBy: {
        type: 'string',
        default: null
    },
    
    approvedAt: {
        type: 'date',
        default: null
    },
    
    // Rejection tracking
    rejectedBy: {
        type: 'string',
        default: null
    },
    
    rejectedAt: {
        type: 'date',
        default: null
    },
    
    rejectionReason: {
        type: 'string',
        default: ''
    },
    
    // Admin notes
    notes: {
        type: 'string',
        default: ''
    },
    
    // Whether this mapping has been applied to the menu document
    isApplied: {
        type: 'boolean',
        default: false
    },
    
    appliedAt: {
        type: 'date',
        default: null
    },
    
    // Whether this mapping is active
    isActive: {
        type: 'boolean',
        default: true
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
const COLLECTION_NAME = 'menuMappings';

// Indexes
const indexes = [
    { key: { menuId: 1 }, unique: true },  // One mapping per menu
    { key: { storeId: 1 } },
    { key: { normalizedName: 1 } },
    { key: { masterMenuCode: 1 } },
    { key: { mappingStatus: 1 } },
    { key: { confidenceScore: -1 } },
    { key: { confidenceLevel: 1 } },
    { key: { mappingMethod: 1 } },
    { key: { isActive: 1 } },
    { key: { isApplied: 1 } },
    // Compound indexes for common queries
    { key: { mappingStatus: 1, confidenceLevel: 1 } },
    { key: { storeId: 1, mappingStatus: 1 } }
];

module.exports = {
    schema: menuMappingSchema,
    collectionName: COLLECTION_NAME,
    indexes
};
