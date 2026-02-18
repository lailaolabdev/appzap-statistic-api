/**
 * Subscription Package Model
 * 
 * Defines available subscription packages that can be used in invoices.
 */

const collectionName = 'subscriptionPackages';

const schema = {
    code: String,               // Unique package code
    name: String,               // Package name (Lao)
    nameEnglish: String,        // Package name (English)
    description: String,        // Package description
    
    // Pricing
    monthlyPrice: Number,       // Price per month
    currency: String,           // "LAK"
    
    // Features
    features: [{
        name: String,
        value: String,
        included: Boolean,
    }],
    
    // Limits
    limits: {
        maxBranches: Number,
        maxUsers: Number,
        maxProducts: Number,
        maxTables: Number,
        maxOrders: Number,      // -1 for unlimited
    },
    
    // Discount tiers (for longer periods)
    discountTiers: [{
        months: Number,         // e.g., 6, 12
        discountPercent: Number, // e.g., 10, 20
    }],
    
    // Status
    isActive: Boolean,
    sortOrder: Number,
    
    // Metadata
    createdBy: String,
    updatedBy: String,
    createdAt: Date,
    updatedAt: Date,
};

const indexes = [
    { key: { code: 1 }, unique: true },
    { key: { isActive: 1 } },
    { key: { sortOrder: 1 } },
];

module.exports = {
    collectionName,
    schema,
    indexes,
};
