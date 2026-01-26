/**
 * Mapping Decision Model
 * 
 * Stores "learned" mapping decisions so that when the same menu/category name
 * appears in another store, it can be auto-mapped without manual review.
 * 
 * This acts as a knowledge base for the mapping system.
 */

const mappingDecisionSchema = {
    // Type of entity
    entityType: {
        type: 'string',
        required: true,
        index: true  // 'menu' | 'category'
    },
    
    // Original name that was mapped
    originalName: {
        type: 'string',
        required: true
    },
    
    // Normalized version for matching
    normalizedName: {
        type: 'string',
        required: true,
        index: true
    },
    
    // The master code it maps to (null if rejected/not-applicable)
    masterCode: {
        type: 'string',
        default: null,
        index: true
    },
    
    // Master name for reference
    masterName: {
        type: 'string',
        default: ''
    },
    
    masterName_en: {
        type: 'string',
        default: ''
    },
    
    // Decision type
    // 'approved' - This name maps to masterCode
    // 'rejected' - This name should NOT map to this masterCode
    // 'not-applicable' - This name should not be mapped to any master
    decisionType: {
        type: 'string',
        required: true,
        index: true
    },
    
    // Who made this decision
    decisionBy: {
        type: 'string',
        default: 'system'
    },
    
    decisionAt: {
        type: 'date',
        default: () => new Date()
    },
    
    // Statistics
    timesApplied: {
        type: 'number',
        default: 0
    },
    
    // Stores where this decision has been applied
    appliedToStores: {
        type: 'array',
        default: []  // Array of storeId strings
    },
    
    // Original confidence score when first decided
    originalConfidenceScore: {
        type: 'number',
        default: 0
    },
    
    // Notes
    notes: {
        type: 'string',
        default: ''
    },
    
    // Whether this decision is active
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
const COLLECTION_NAME = 'mappingDecisions';

// Indexes
const indexes = [
    { key: { entityType: 1, normalizedName: 1 }, unique: true },  // One decision per entity+name
    { key: { masterCode: 1 } },
    { key: { decisionType: 1 } },
    { key: { timesApplied: -1 } },
    { key: { isActive: 1 } }
];

module.exports = {
    schema: mappingDecisionSchema,
    collectionName: COLLECTION_NAME,
    indexes
};
