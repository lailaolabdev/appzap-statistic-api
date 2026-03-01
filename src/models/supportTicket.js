/**
 * Support Ticket Model (TOR 3 - Case Management)
 * 
 * Helpdesk tickets for incident reporting and tracking.
 */

const collectionName = 'supportTickets';

const schema = {
    ticketNumber: String,       // e.g., "TKT-202502-001"
    
    // Restaurant/Customer
    restaurantId: String,
    posVersion: String,
    restaurantName: String,
    contactPhone: String,
    contactEmail: String,
    
    // Issue Details
    category: String,           // "hardware" | "software" | "billing" | "system_outage" | "other"
    subcategory: String,        // More specific
    priority: String,           // "low" | "medium" | "high" | "critical"
    
    subject: String,
    description: String,
    
    // Hardware claim (if category = hardware)
    hardwareClaim: {
        trackingNumber: String,
        carrier: String,
        shippedAt: Date,
        estimatedDelivery: Date,
    },
    
    // Status workflow
    status: String,             // "open" | "in_progress" | "waiting_customer" | "resolved" | "closed"
    
    // Assignment
    assignedTo: String,         // Staff ID
    assignedToName: String,
    assignedAt: Date,
    
    // Resolution
    resolvedAt: Date,
    resolution: String,
    resolvedBy: String,
    
    closedAt: Date,
    closedBy: String,
    
    // CSAT (Customer Satisfaction)
    csatScore: Number,          // 1-5
    csatFeedback: String,
    csatSentAt: Date,
    
    // Attachments
    attachments: [{
        filename: String,
        url: String,
        type: String,
        uploadedAt: Date,
    }],
    
    // Comments/History
    comments: [{
        authorId: String,
        authorName: String,
        content: String,
        isInternal: Boolean,     // Internal note (not visible to customer)
        createdAt: Date,
    }],
    
    // Metadata
    createdBy: String,
    createdAt: Date,
    updatedAt: Date,
};

const indexes = [
    { key: { ticketNumber: 1 }, unique: true },
    { key: { restaurantId: 1, posVersion: 1 } },
    { key: { status: 1 } },
    { key: { category: 1 } },
    { key: { priority: 1 } },
    { key: { createdAt: -1 } },
    { key: { assignedTo: 1 } },
];

module.exports = {
    collectionName,
    schema,
    indexes,
};
