/**
 * Financial Transaction Model
 * 
 * Tracks all money movements (both income and expenses) for cash flow.
 * This is the core of the financial system - every money movement is recorded here.
 */

const collectionName = 'financialTransactions';

const schema = {
    // Transaction Type
    type: String,               // "income" | "expense" | "transfer"
    
    // Source/Reference
    sourceType: String,         // "invoice" | "expense" | "manual" | "device_sale" | "refund" | "other"
    sourceId: String,           // Reference to invoice._id or expense._id
    sourceNumber: String,       // Invoice number or reference
    
    // Amount
    amount: Number,             // Positive for income, negative for expense
    currency: String,           // "LAK"
    
    // Categorization
    category: String,           // Category for reporting
    subcategory: String,
    
    // Description
    description: String,
    notes: String,
    
    // Date
    transactionDate: Date,      // When the transaction occurred
    recordedDate: Date,         // When it was recorded in system
    
    // Bank/Account
    accountId: String,          // Reference to bank account
    accountName: String,        // Denormalized
    
    // Counterparty
    counterparty: {
        type: String,           // "restaurant" | "vendor" | "employee" | "other"
        id: String,
        name: String,
    },
    
    // Payment details
    paymentMethod: String,      // "cash" | "bank_transfer" | "card" | "mobile"
    paymentReference: String,   // Transaction ID
    
    // For reconciliation
    isReconciled: Boolean,
    reconciledAt: Date,
    reconciledBy: String,
    
    // Tags
    tags: [String],
    
    // Metadata
    createdBy: String,
    createdAt: Date,
    updatedAt: Date,
};

const indexes = [
    { key: { transactionDate: -1 } },
    { key: { type: 1 } },
    { key: { sourceType: 1, sourceId: 1 } },
    { key: { category: 1 } },
    { key: { accountId: 1 } },
    { key: { 'counterparty.id': 1 } },
    { key: { createdAt: -1 } },
];

module.exports = {
    collectionName,
    schema,
    indexes,
};
