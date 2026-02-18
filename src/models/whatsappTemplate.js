/**
 * WhatsApp Template Model
 * 
 * Stores preset message templates for WhatsApp broadcasts.
 */

const collectionName = 'whatsappTemplates';

const schema = {
    name: String,               // Template name (internal)
    category: String,           // "maintenance" | "payment" | "update" | "emergency" | "promotion" | "general"
    icon: String,               // Emoji icon for UI
    
    // Message content
    subject: String,            // Brief subject/title
    messageLao: String,         // Message in Lao language
    messageEnglish: String,     // Message in English (optional)
    
    // Variables that can be replaced
    variables: [{
        name: String,           // e.g., "date", "time", "amount"
        description: String,    // What this variable represents
        defaultValue: String,   // Default value
    }],
    
    // Quick responses (suggested replies)
    quickResponses: [{
        textLao: String,        // Response in Lao
        textEnglish: String,    // Response in English
    }],
    
    // Status
    isActive: Boolean,
    
    // Usage statistics
    usageCount: Number,
    lastUsedAt: Date,
    
    // Metadata
    createdBy: String,
    updatedBy: String,
    createdAt: Date,
    updatedAt: Date,
};

const indexes = [
    { key: { name: 1 }, unique: true },
    { key: { category: 1 } },
    { key: { isActive: 1 } },
];

module.exports = {
    collectionName,
    schema,
    indexes,
};
