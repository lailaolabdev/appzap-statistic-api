/**
 * Mapping Stats Model
 * 
 * Tracks overall migration progress and statistics.
 * Used for dashboard and monitoring.
 */

const mappingStatsSchema = {
    // Type of entity
    entityType: {
        type: 'string',
        required: true,
        unique: true  // 'menu' | 'category'
    },
    
    // Total counts
    totalItems: {
        type: 'number',
        default: 0
    },
    
    totalUniqueNames: {
        type: 'number',
        default: 0
    },
    
    totalStores: {
        type: 'number',
        default: 0
    },
    
    // Status counts
    pendingCount: {
        type: 'number',
        default: 0
    },
    
    suggestedCount: {
        type: 'number',
        default: 0
    },
    
    approvedCount: {
        type: 'number',
        default: 0
    },
    
    rejectedCount: {
        type: 'number',
        default: 0
    },
    
    notApplicableCount: {
        type: 'number',
        default: 0
    },
    
    // Confidence distribution
    highConfidenceCount: {
        type: 'number',
        default: 0  // >= 90%
    },
    
    mediumConfidenceCount: {
        type: 'number',
        default: 0  // 60-89%
    },
    
    lowConfidenceCount: {
        type: 'number',
        default: 0  // < 60%
    },
    
    noMatchCount: {
        type: 'number',
        default: 0  // No suggestions found
    },
    
    // Applied counts
    appliedCount: {
        type: 'number',
        default: 0
    },
    
    // Learned decisions count
    learnedDecisionsCount: {
        type: 'number',
        default: 0
    },
    
    // Coverage percentage
    mappingCoverage: {
        type: 'number',
        default: 0  // (approved + appliedCount) / totalItems * 100
    },
    
    // Last analysis run
    lastAnalysisRun: {
        type: 'date',
        default: null
    },
    
    lastAnalysisDuration: {
        type: 'number',
        default: 0  // in milliseconds
    },
    
    // Last update
    lastUpdated: {
        type: 'date',
        default: () => new Date()
    }
};

// Collection name
const COLLECTION_NAME = 'mappingStats';

// Indexes
const indexes = [
    { key: { entityType: 1 }, unique: true }
];

module.exports = {
    schema: mappingStatsSchema,
    collectionName: COLLECTION_NAME,
    indexes
};
