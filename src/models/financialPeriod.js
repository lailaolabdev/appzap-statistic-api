/**
 * Financial Period Model
 * 
 * Tracks monthly/quarterly/yearly financial period summaries.
 * Used for P&L, Balance Sheet, and Cash Flow statements.
 */

const collectionName = 'financialPeriods';

const schema = {
    // Period identification
    year: Number,
    month: Number,              // 1-12 (null for yearly)
    quarter: Number,            // 1-4 (null for monthly/yearly)
    periodType: String,         // "monthly" | "quarterly" | "yearly"
    periodKey: String,          // "2026-02" or "2026-Q1" or "2026"
    
    // Date range
    startDate: Date,
    endDate: Date,
    
    // Revenue Summary
    revenue: {
        subscriptions: Number,
        deviceSales: Number,
        services: Number,
        other: Number,
        total: Number,
    },
    
    // Expense Summary
    expenses: {
        salaries: Number,
        infrastructure: Number,
        marketing: Number,
        operations: Number,
        deviceCosts: Number,
        software: Number,
        travel: Number,
        other: Number,
        total: Number,
    },
    
    // Profit & Loss
    grossProfit: Number,        // Revenue - Cost of Goods
    operatingProfit: Number,    // Gross Profit - Operating Expenses
    netProfit: Number,          // Operating Profit - Other Expenses
    profitMargin: Number,       // (Net Profit / Revenue) * 100
    
    // Cash Flow
    cashFlow: {
        openingBalance: Number,
        cashIn: Number,
        cashOut: Number,
        netCashFlow: Number,
        closingBalance: Number,
    },
    
    // Key Metrics
    metrics: {
        // Revenue metrics
        mrr: Number,            // Monthly Recurring Revenue
        arr: Number,            // Annual Recurring Revenue
        revenueGrowth: Number,  // % vs previous period
        
        // Customer metrics
        activeRestaurants: Number,
        newRestaurants: Number,
        churnedRestaurants: Number,
        churnRate: Number,
        
        // Expense metrics
        expenseGrowth: Number,
        burnRate: Number,       // Cash burned per month
        runway: Number,         // Months of runway left
    },
    
    // Comparisons
    previousPeriod: {
        revenue: Number,
        expenses: Number,
        netProfit: Number,
    },
    
    // Status
    status: String,             // "open" | "closed" | "locked"
    closedBy: String,
    closedAt: Date,
    
    // Notes
    notes: String,
    
    // Metadata
    createdAt: Date,
    updatedAt: Date,
};

const indexes = [
    { key: { periodKey: 1 }, unique: true },
    { key: { year: 1, month: 1 } },
    { key: { status: 1 } },
    { key: { periodType: 1 } },
];

module.exports = {
    collectionName,
    schema,
    indexes,
};
