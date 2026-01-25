/**
 * Menu Mapping Model
 * 
 * Links individual store menus to master menu items.
 * This enables cross-store analytics by normalizing menu data.
 * 
 * Supports both manual mapping (admin) and auto-suggested mapping (AI).
 */

const { ObjectId } = require('mongodb');

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
    
    // Reference to master menu code
    masterMenuCode: {
        type: 'string',
        required: true,
        index: true
    },
    
    // Original menu name (denormalized for reference)
    originalName: {
        type: 'string',
        default: ''
    },
    
    // Mapping method
    mappingMethod: {
        type: 'string',
        default: 'manual'  // manual, auto_suggested, auto_confirmed
    },
    
    // Confidence score for auto-mapping (0-1)
    confidenceScore: {
        type: 'number',
        default: 1  // 1 for manual mappings
    },
    
    // Who created this mapping
    createdBy: {
        type: 'string',
        default: 'system'  // 'system' for auto, admin user ID for manual
    },
    
    // Who confirmed/approved this mapping
    confirmedBy: {
        type: 'string',
        default: null
    },
    
    // Confirmation timestamp
    confirmedAt: {
        type: 'date',
        default: null
    },
    
    // Mapping status
    status: {
        type: 'string',
        default: 'active'  // active, pending_review, rejected
    },
    
    // Rejection reason (if rejected)
    rejectionReason: {
        type: 'string',
        default: ''
    },
    
    // Notes
    notes: {
        type: 'string',
        default: ''
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
    { key: { menuId: 1, masterMenuCode: 1 }, unique: true },  // Prevent duplicate mappings
    { key: { storeId: 1 } },
    { key: { masterMenuCode: 1 } },
    { key: { status: 1 } },
    { key: { mappingMethod: 1 } },
    { key: { isActive: 1 } },
    { key: { confidenceScore: -1 } }
];

module.exports = {
    schema: menuMappingSchema,
    collectionName: COLLECTION_NAME,
    indexes
};
