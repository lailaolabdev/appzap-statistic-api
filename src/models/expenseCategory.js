/**
 * Expense Category Model
 * 
 * Categorizes expenses for reporting and analysis.
 */

const collectionName = 'expenseCategories';

const schema = {
    code: String,               // Unique code (e.g., "SALARY", "INFRA")
    name: String,               // Display name (Lao)
    nameEnglish: String,        // Display name (English)
    description: String,
    icon: String,               // Emoji or icon name
    color: String,              // Hex color for charts
    
    // Type classification
    type: String,               // "operating" | "capital" | "financial"
    
    // For P&L classification
    plCategory: String,         // "cost_of_goods" | "operating_expense" | "other_expense"
    
    // Budget
    monthlyBudget: Number,      // Default monthly budget
    
    // Status
    isActive: Boolean,
    sortOrder: Number,
    
    // Metadata
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
