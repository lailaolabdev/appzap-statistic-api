/**
 * System Health Model (TOR 1 - POS Online/Offline Status)
 * 
 * Tracks last heartbeat/sync status of restaurants for system health dashboard.
 * Can be populated by POS sync, cron job, or webhook.
 */

const collectionName = 'systemHealth';

const schema = {
    restaurantId: String,
    posVersion: String,         // "v1" | "v2"
    
    status: String,             // "online" | "offline" | "syncing" | "error"
    lastHeartbeat: Date,        // Last activity from POS
    lastSyncAt: Date,           // Last successful data sync
    
    deviceInfo: {
        deviceId: String,
        appVersion: String,
        lastSeen: Date,
    },
    
    errorMessage: String,       // If status = error
    errorCode: String,
    
    updatedAt: Date,
};

const indexes = [
    { key: { restaurantId: 1, posVersion: 1 }, unique: true },
    { key: { status: 1 } },
    { key: { lastHeartbeat: -1 } },
];

module.exports = {
    collectionName,
    schema,
    indexes,
};
