/**
 * Bank Account Model
 * 
 * Tracks company bank accounts and balances.
 */

const collectionName = 'bankAccounts';

const schema = {
    name: String,               // Account name (e.g., "BCEL Main Account")
    accountNumber: String,      // Bank account number
    bankName: String,           // Bank name
    bankCode: String,           // Bank code (e.g., "BCEL")
    
    // Type
    accountType: String,        // "checking" | "savings" | "cash" | "mobile_money"
    currency: String,           // "LAK" | "USD" | "THB"
    
    // Balance
    currentBalance: Number,     // Current balance
    lastUpdated: Date,          // When balance was last updated
    
    // Opening balance (for reconciliation)
    openingBalance: Number,
    openingDate: Date,
    
    // Status
    isActive: Boolean,
    isPrimary: Boolean,         // Is this the primary account?
    
    // For display
    color: String,              // Hex color for charts
    icon: String,
    
    // Metadata
    createdBy: String,
    createdAt: Date,
    updatedAt: Date,
};

const indexes = [
    { key: { accountNumber: 1 }, unique: true },
    { key: { isActive: 1 } },
    { key: { isPrimary: 1 } },
];

module.exports = {
    collectionName,
    schema,
    indexes,
};
