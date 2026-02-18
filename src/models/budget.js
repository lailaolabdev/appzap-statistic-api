/**
 * Budget Model
 * 
 * Budget planning and tracking for expense categories.
 */

const collectionName = 'budgets';

const schema = {
    // Period
    year: Number,               // Budget year
    month: Number,              // 1-12 for monthly, null for yearly
    period: String,             // "monthly" | "quarterly" | "yearly"
    
    // Category-wise budgets
    categoryBudgets: [{
        categoryId: String,
        categoryCode: String,
        categoryName: String,
        budgetAmount: Number,
        actualAmount: Number,   // Calculated from expenses
        variance: Number,       // Budget - Actual
        variancePercent: Number,
    }],
    
    // Totals
    totalBudget: Number,
    totalActual: Number,
    totalVariance: Number,
    
    // Revenue targets
    revenueTarget: Number,
    actualRevenue: Number,
    
    // Profit targets
    profitTarget: Number,
    actualProfit: Number,
    
    // Status
    status: String,             // "draft" | "approved" | "closed"
    approvedBy: String,
    approvedAt: Date,
    
    // Notes
    notes: String,
    
    // Metadata
    createdBy: String,
    createdAt: Date,
    updatedAt: Date,
};

const indexes = [
    { key: { year: 1, month: 1 }, unique: true },
    { key: { status: 1 } },
];

module.exports = {
    collectionName,
    schema,
    indexes,
};
