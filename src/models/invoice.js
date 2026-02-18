/**
 * Invoice Model
 * 
 * Stores invoice data for restaurant subscriptions and device sales.
 * Matches the AppZap invoice format (Lao language).
 */

const collectionName = 'invoices';

const schema = {
    invoiceNumber: String,      // e.g., "AZ-202602-105"
    invoiceDate: Date,          // Date created
    dueDate: Date,              // Payment due date
    
    // Restaurant Info
    restaurant: {
        id: String,             // Restaurant ObjectId from POS v1 or v2
        posVersion: String,     // "v1" or "v2"
        name: String,           // Restaurant name
        code: String,           // Restaurant code (v2 only)
        phone: String,
        address: String,
    },
    
    // Invoice Items
    items: [{
        description: String,    // Item description (e.g., "ກັ້ນເຈ້ຍ 1 ແຜ່ນ")
        quantity: Number,
        unitPrice: Number,
        totalPrice: Number,
        type: String,           // "subscription" | "device" | "service" | "other"
        deviceId: String,       // Reference to device if type is "device"
    }],
    
    // Pricing
    subtotal: Number,           // Sum of all items
    discount: {
        type: String,           // "percentage" | "fixed"
        value: Number,          // Discount value
        amount: Number,         // Calculated discount amount
    },
    freeMonths: Number,         // Number of free months given
    freeMonthsValue: Number,    // Value of free months
    total: Number,              // Final total after discounts
    currency: String,           // "LAK" (Lao Kip)
    
    // Subscription Details (if applicable)
    subscription: {
        packageName: String,    // "Basic", "Premium", etc.
        packageCode: String,    // Package code
        period: Number,         // Number of months
        startDate: Date,
        endDate: Date,
        monthlyRate: Number,
    },
    
    // Payment Info
    paymentStatus: String,      // "pending" | "paid" | "overdue" | "cancelled"
    paymentMethod: String,      // "bank_transfer" | "cash" | "mobile_payment" | "other"
    paymentDate: Date,          // Date payment received
    paymentDetails: {
        bankName: String,       // e.g., "ທະນາຄານການຄ້າຕ່າງປະເທດລາວ (BCEL)"
        accountNumber: String,  // e.g., "010-11-00192298"
        accountName: String,    // e.g., "LAILAO APPZAP CO.,LTD"
        transactionId: String,  // Transaction reference
    },
    
    // Notes
    notes: String,              // Admin notes
    terms: [String],            // Terms and conditions
    
    // Metadata
    createdBy: String,          // Admin user who created
    updatedBy: String,          // Admin user who last updated
    createdAt: Date,
    updatedAt: Date,
    
    // PDF
    pdfUrl: String,             // URL to generated PDF
    pdfGeneratedAt: Date,
};

const indexes = [
    { key: { invoiceNumber: 1 }, unique: true },
    { key: { 'restaurant.id': 1, 'restaurant.posVersion': 1 } },
    { key: { paymentStatus: 1 } },
    { key: { invoiceDate: -1 } },
    { key: { dueDate: 1 } },
    { key: { createdAt: -1 } },
];

module.exports = {
    collectionName,
    schema,
    indexes,
};
