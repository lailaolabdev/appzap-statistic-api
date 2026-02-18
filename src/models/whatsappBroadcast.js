/**
 * WhatsApp Broadcast Model
 * 
 * Stores broadcast campaign data and delivery status.
 */

const collectionName = 'whatsappBroadcasts';

const schema = {
    name: String,               // Campaign name
    templateId: String,         // Reference to whatsappTemplate
    
    // Message content (final rendered)
    subject: String,
    message: String,            // Final message with variables replaced
    
    // Recipient criteria
    recipientCriteria: {
        type: String,           // "all" | "pos_version" | "status" | "province" | "custom"
        posVersion: String,     // "v1" | "v2" | "both"
        status: String,         // Subscription status filter
        province: String,       // Province filter
        customIds: [String],    // Custom list of restaurant IDs
    },
    
    // Recipients list (snapshot at send time)
    recipients: [{
        restaurantId: String,
        posVersion: String,
        restaurantName: String,
        phone: String,
        whatsapp: String,
        
        // Delivery status for this recipient
        status: String,         // "pending" | "sent" | "delivered" | "read" | "failed"
        sentAt: Date,
        deliveredAt: Date,
        readAt: Date,
        error: String,
        messageSid: String,     // Twilio message SID
    }],
    
    // Summary statistics
    stats: {
        totalRecipients: Number,
        sent: Number,
        delivered: Number,
        read: Number,
        failed: Number,
    },
    
    // Schedule
    status: String,             // "draft" | "scheduled" | "sending" | "completed" | "cancelled"
    scheduledAt: Date,          // When to send (null = immediate)
    startedAt: Date,            // When sending started
    completedAt: Date,          // When sending completed
    
    // Metadata
    createdBy: String,
    updatedBy: String,
    createdAt: Date,
    updatedAt: Date,
};

const indexes = [
    { key: { status: 1 } },
    { key: { scheduledAt: 1 } },
    { key: { createdAt: -1 } },
    { key: { 'recipients.restaurantId': 1 } },
];

module.exports = {
    collectionName,
    schema,
    indexes,
};
