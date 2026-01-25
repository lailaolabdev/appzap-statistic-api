/**
 * Category Mapping Model
 * 
 * Links individual store categories to master category items.
 * This enables cross-store analytics by normalizing category data.
 * 
 * Supports both manual mapping (admin) and auto-suggested mapping (AI).
 */

const { ObjectId } = require('mongodb');

const categoryMappingSchema = {
    // Reference to store's category _id (from existing 'categories' collection)
    categoryId: {
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
    
    // Reference to master category code
    masterCategoryCode: {
        type: 'string',
        required: true,
        index: true
    },
    
    // Original category name (denormalized for reference)
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
const COLLECTION_NAME = 'categoryMappings';

// Indexes
const indexes = [
    { key: { categoryId: 1, masterCategoryCode: 1 }, unique: true },  // Prevent duplicate mappings
    { key: { storeId: 1 } },
    { key: { masterCategoryCode: 1 } },
    { key: { status: 1 } },
    { key: { mappingMethod: 1 } },
    { key: { isActive: 1 } },
    { key: { confidenceScore: -1 } }
];

module.exports = {
    schema: categoryMappingSchema,
    collectionName: COLLECTION_NAME,
    indexes
};
