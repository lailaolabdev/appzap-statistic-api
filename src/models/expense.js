/**
 * Expense Model
 * 
 * Tracks company expenses for P&L and cash flow calculations.
 */

const collectionName = 'expenses';

const schema = {
    // Basic Info
    title: String,              // Expense description
    description: String,        // Detailed notes
    
    // Categorization
    categoryId: String,         // Reference to expenseCategories
    categoryName: String,       // Denormalized for quick access
    
    // Amount
    amount: Number,             // Expense amount
    currency: String,           // "LAK"
    
    // Dates
    expenseDate: Date,          // When expense occurred
    paymentDate: Date,          // When actually paid (for cash flow)
    dueDate: Date,              // If payable later
    
    // Payment
    paymentStatus: String,      // "paid" | "pending" | "scheduled"
    paymentMethod: String,      // "cash" | "bank_transfer" | "card" | "other"
    paymentReference: String,   // Transaction ID, receipt number
    
    // Recurrence
    isRecurring: Boolean,       // Is this a recurring expense?
    recurrence: {
        frequency: String,      // "monthly" | "quarterly" | "yearly"
        nextDate: Date,         // Next occurrence
        endDate: Date,          // When recurrence ends
    },
    
    // Vendor/Payee
    vendor: {
        name: String,
        contact: String,
        accountNumber: String,
    },
    
    // Attachments
    attachments: [{
        filename: String,
        url: String,
        uploadedAt: Date,
    }],
    
    // Tags for filtering
    tags: [String],
    
    // Metadata
    createdBy: String,
    updatedBy: String,
    createdAt: Date,
    updatedAt: Date,
};

const indexes = [
    { key: { expenseDate: -1 } },
    { key: { categoryId: 1 } },
    { key: { paymentStatus: 1 } },
    { key: { createdAt: -1 } },
    { key: { 'recurrence.nextDate': 1 } },
];

module.exports = {
    collectionName,
    schema,
    indexes,
};
