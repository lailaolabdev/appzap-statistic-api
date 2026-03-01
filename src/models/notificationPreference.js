/**
 * Notification Preference Model (TOR 2 - Opt-in/Opt-out)
 * 
 * Per-restaurant notification settings.
 */

const collectionName = 'notificationPreferences';

const schema = {
    restaurantId: String,
    posVersion: String,
    
    // Channels
    whatsapp: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    email: { type: Boolean, default: true },
    
    // Notification types (opt-in/opt-out)
    subscriptionReminder: { type: Boolean, default: true },
    paymentFailure: { type: Boolean, default: true },
    systemOutage: { type: Boolean, default: true },
    securityAlerts: { type: Boolean, default: true },
    marketingAnnouncements: { type: Boolean, default: false },
    
    updatedAt: Date,
};

const indexes = [
    { key: { restaurantId: 1, posVersion: 1 }, unique: true },
];

module.exports = {
    collectionName,
    schema,
    indexes,
};
