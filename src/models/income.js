/**
 * Income Model
 * 
 * Tracks manual income entries that don't come through invoices.
 * Examples: cash payments, service fees, partnership revenue, etc.
 */

const collectionName = 'incomes';

const schema = {
    // Basic Info
    title: String,              // Income description
    description: String,        // Detailed notes
    
    // Categorization
    category: String,           // "subscription" | "device_sale" | "service" | "partnership" | "interest" | "refund" | "other"
    subcategory: String,        // More specific categorization
    
    // Amount
    amount: Number,             // Income amount
    currency: String,           // "LAK"
    
    // Dates
    incomeDate: Date,           // When income occurred
    receivedDate: Date,         // When actually received (for cash flow)
    
    // Payment
    paymentStatus: String,      // "received" | "pending" | "expected"
    paymentMethod: String,      // "cash" | "bank_transfer" | "card" | "mobile" | "other"
    paymentReference: String,   // Transaction ID, receipt number
    
    // Source
    source: {
        type: String,           // "restaurant" | "partner" | "other"
        id: String,             // Restaurant ID if applicable
        posVersion: String,     // "v1" | "v2"
        name: String,           // Source name
        contact: String,
    },
    
    // If linked to invoice (optional - for reconciliation)
    invoiceId: String,
    invoiceNumber: String,
    
    // Recurrence
    isRecurring: Boolean,
    recurrence: {
        frequency: String,      // "monthly" | "quarterly" | "yearly"
        nextDate: Date,
        endDate: Date,
    },
    
    // Tags for filtering
    tags: [String],
    
    // Metadata
    createdBy: String,
    updatedBy: String,
    createdAt: Date,
    updatedAt: Date,
};

const indexes = [
    { key: { incomeDate: -1 } },
    { key: { category: 1 } },
    { key: { paymentStatus: 1 } },
    { key: { 'source.id': 1 } },
    { key: { createdAt: -1 } },
];

module.exports = {
    collectionName,
    schema,
    indexes,
};
