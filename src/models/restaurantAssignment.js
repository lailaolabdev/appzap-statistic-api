/**
 * Restaurant Assignment Model (TOR 1 - Staff/AE Assignment)
 * 
 * Maps staff/account executives to restaurants for customer management.
 */

const collectionName = 'restaurantAssignments';

const schema = {
    restaurantId: String,       // Restaurant ObjectId
    posVersion: String,         // "v1" | "v2"
    
    staffId: String,            // Staff/AE ID
    staffName: String,          // Staff name for display
    staffEmail: String,
    staffPhone: String,
    
    role: String,               // "ae" | "account_manager" | "support"
    
    assignedAt: Date,
    assignedBy: String,
    
    notes: String,
    isActive: { type: Boolean, default: true },
    
    createdAt: Date,
    updatedAt: Date,
};

const indexes = [
    { key: { restaurantId: 1, posVersion: 1 }, unique: true },
    { key: { staffId: 1 } },
    { key: { isActive: 1 } },
];

module.exports = {
    collectionName,
    schema,
    indexes,
};
