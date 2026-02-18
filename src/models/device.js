/**
 * Device Model
 * 
 * Manages inventory of devices (printers, cash drawers, tablets, etc.)
 * that can be sold/included in invoices.
 */

const collectionName = 'devices';

const schema = {
    serialNumber: String,       // Unique device serial number
    type: String,               // "printer" | "cash_drawer" | "tablet" | "scanner" | "other"
    model: String,              // Device model name (e.g., "Epson TM-T82")
    brand: String,              // Brand name
    description: String,        // Additional description
    
    // Pricing
    purchasePrice: Number,      // Cost price
    sellingPrice: Number,       // Selling price
    currency: String,           // "LAK"
    
    // Status
    status: String,             // "available" | "sold" | "reserved" | "defective" | "returned"
    
    // Assignment (if sold/assigned)
    assignedTo: {
        restaurantId: String,   // Restaurant ObjectId
        posVersion: String,     // "v1" | "v2"
        restaurantName: String,
        invoiceId: String,      // Reference to invoice
        assignedDate: Date,
    },
    
    // Warranty
    warranty: {
        months: Number,         // Warranty period in months
        startDate: Date,
        endDate: Date,
    },
    
    // Notes
    notes: String,
    
    // Metadata
    createdBy: String,
    updatedBy: String,
    createdAt: Date,
    updatedAt: Date,
};

const indexes = [
    { key: { serialNumber: 1 }, unique: true },
    { key: { type: 1 } },
    { key: { status: 1 } },
    { key: { 'assignedTo.restaurantId': 1 } },
    { key: { createdAt: -1 } },
];

module.exports = {
    collectionName,
    schema,
    indexes,
};
