/**
 * Multi-Database Connection Utility
 * 
 * Manages connections to multiple MongoDB databases:
 * - Main Stats DB (read-write)
 * - POS v1 DB (read-only for safety)
 * - POS v2 DB (read-only for safety)
 */

const { MongoClient } = require('mongodb');

let connections = {
    main: null,      // Main stats database
    posV1: null,     // POS v1 database
    posV2: null,     // POS v2 database
};

let databases = {
    main: null,
    posV1: null,
    posV2: null,
};

const connectionOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 60000,
    maxPoolSize: 10,
};

/**
 * Connect to all databases
 */
async function connectAllDatabases() {
    console.log('Connecting to multiple databases...');

    // Connect to main stats database
    if (process.env.MONGODB_URI) {
        try {
            connections.main = await MongoClient.connect(process.env.MONGODB_URI, connectionOptions);
            databases.main = connections.main.db('AppZap');
            console.log('✓ Main Stats DB connected');
        } catch (error) {
            console.error('✗ Main Stats DB connection failed:', error.message);
        }
    }

    // Connect to POS v1 database
    if (process.env.MONGODB_URI_POS_V1) {
        try {
            connections.posV1 = await MongoClient.connect(process.env.MONGODB_URI_POS_V1, connectionOptions);
            const dbName = process.env.POS_V1_DB_NAME || 'AppZap';
            databases.posV1 = connections.posV1.db(dbName);
            console.log(`✓ POS v1 DB connected (${dbName})`);
        } catch (error) {
            console.error('✗ POS v1 DB connection failed:', error.message);
        }
    }

    // Connect to POS v2 database
    if (process.env.MONGODB_URI_POS_V2) {
        try {
            connections.posV2 = await MongoClient.connect(process.env.MONGODB_URI_POS_V2, connectionOptions);
            const dbName = process.env.POS_V2_DB_NAME || 'AppZap';
            databases.posV2 = connections.posV2.db(dbName);
            console.log(`✓ POS v2 DB connected (${dbName})`);
        } catch (error) {
            console.error('✗ POS v2 DB connection failed:', error.message);
        }
    }

    return databases;
}

/**
 * Get main database
 */
function getMainDb() {
    return databases.main;
}

/**
 * Get POS v1 database
 */
function getPosV1Db() {
    return databases.posV1;
}

/**
 * Get POS v2 database
 */
function getPosV2Db() {
    return databases.posV2;
}

/**
 * Get all databases
 */
function getAllDatabases() {
    return databases;
}

/**
 * Close all connections
 */
async function closeAllConnections() {
    console.log('Closing all database connections...');
    
    if (connections.main) {
        await connections.main.close();
        console.log('✓ Main DB closed');
    }
    if (connections.posV1) {
        await connections.posV1.close();
        console.log('✓ POS v1 DB closed');
    }
    if (connections.posV2) {
        await connections.posV2.close();
        console.log('✓ POS v2 DB closed');
    }
}

/**
 * Get unified restaurant list from both POS versions
 * Returns restaurants with subscription info
 */
async function getUnifiedRestaurants(options = {}) {
    const { search, province, district, posVersion, subscriptionStatus, startDate, endDate, limit = 50, skip = 0 } = options;
    const results = [];

    // Get from POS v1 (stores collection)
    if (databases.posV1 && (!posVersion || posVersion === 'v1' || posVersion === 'both')) {
        try {
            const v1Query = { isDeleted: { $ne: true } };
            
            if (search) {
                v1Query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } },
                    { nameForSearch: { $regex: search, $options: 'i' } },
                ];
            }
            if (province) {
                v1Query['address.province'] = { $regex: province, $options: 'i' };
            }
            if (district) {
                v1Query['address.district'] = { $regex: district, $options: 'i' };
            }

            const v1Stores = await databases.posV1.collection('stores')
                .find(v1Query)
                .project({
                    _id: 1,
                    name: 1,
                    phone: 1,
                    whatsapp: 1,
                    address: 1,
                    province: 1,
                    district: 1,
                    village: 1,
                    location: 1,
                    startDate: 1,
                    endDate: 1,
                    period: 1,
                    type: 1,
                    createdAt: 1,
                })
                .toArray();

            v1Stores.forEach(store => {
                results.push({
                    ...store,
                    posVersion: 'v1',
                    restaurantId: store._id.toString(),
                    province: store.province || store.address?.province,
                    district: store.district || store.address?.district,
                    village: store.village || store.address?.village,
                });
            });
        } catch (error) {
            console.error('Error fetching POS v1 stores:', error.message);
        }
    }

    // Get from POS v2 (restaurants collection)
    if (databases.posV2 && (!posVersion || posVersion === 'v2' || posVersion === 'both')) {
        try {
            const v2Query = { isDeleted: { $ne: true } };
            
            if (search) {
                v2Query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { code: { $regex: search, $options: 'i' } },
                    { 'contactInfo.phone': { $regex: search, $options: 'i' } },
                ];
            }
            // Note: POS v2 might have different address structure

            const v2Restaurants = await databases.posV2.collection('restaurants')
                .find(v2Query)
                .project({
                    _id: 1,
                    name: 1,
                    code: 1,
                    contactInfo: 1,
                    address: 1,
                    location: 1,
                    packageInfo: 1,
                    createdAt: 1,
                })
                .toArray();

            v2Restaurants.forEach(restaurant => {
                const daysLeft = restaurant.packageInfo?.endDate 
                    ? Math.ceil((new Date(restaurant.packageInfo.endDate) - new Date()) / (1000 * 60 * 60 * 24))
                    : null;
                    
                results.push({
                    ...restaurant,
                    posVersion: 'v2',
                    restaurantId: restaurant._id.toString(),
                    phone: restaurant.contactInfo?.phone,
                    whatsapp: restaurant.contactInfo?.whatsapp,
                    startDate: restaurant.packageInfo?.startDate,
                    endDate: restaurant.packageInfo?.endDate,
                    paymentStatus: restaurant.packageInfo?.paymentStatus,
                    packageLevel: restaurant.packageInfo?.level,
                    daysLeft,
                });
            });
        } catch (error) {
            console.error('Error fetching POS v2 restaurants:', error.message);
        }
    }

    // Filter by subscription status if needed
    let filteredResults = results;
    if (subscriptionStatus) {
        const now = new Date();
        filteredResults = results.filter(r => {
            if (!r.endDate) return subscriptionStatus === 'no_subscription';
            const rEndDate = new Date(r.endDate);
            const daysLeft = Math.ceil((rEndDate - now) / (1000 * 60 * 60 * 24));
            
            switch (subscriptionStatus) {
                case 'expired': return daysLeft < 0;
                case 'expiring_soon': return daysLeft >= 0 && daysLeft <= 30;
                case 'expiring_3months': return daysLeft > 30 && daysLeft <= 90;
                case 'active': return daysLeft > 90;
                default: return true;
            }
        });
    }

    // TOR 1: Filter by date range (endDate within startDate-endDate)
    if (startDate || endDate) {
        const rangeStart = startDate ? new Date(startDate) : null;
        const rangeEnd = endDate ? new Date(endDate + 'T23:59:59.999Z') : null;
        filteredResults = filteredResults.filter(r => {
            if (!r.endDate) return false;
            const rEnd = new Date(r.endDate);
            if (rangeStart && rEnd < rangeStart) return false;
            if (rangeEnd && rEnd > rangeEnd) return false;
            return true;
        });
    }

    // Sort by name
    filteredResults.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // Pagination
    const total = filteredResults.length;
    const paginatedResults = filteredResults.slice(skip, skip + limit);

    return {
        data: paginatedResults,
        pagination: { total, limit, skip },
    };
}

/**
 * Get restaurant by ID from appropriate database
 */
async function getRestaurantById(restaurantId, posVersion) {
    if (posVersion === 'v1' && databases.posV1) {
        const { ObjectId } = require('mongodb');
        return await databases.posV1.collection('stores').findOne({ 
            _id: new ObjectId(restaurantId) 
        });
    }
    
    if (posVersion === 'v2' && databases.posV2) {
        const { ObjectId } = require('mongodb');
        return await databases.posV2.collection('restaurants').findOne({ 
            _id: new ObjectId(restaurantId) 
        });
    }
    
    return null;
}

/**
 * Update subscription dates for a restaurant (WRITE operation)
 * Use with caution - this modifies the POS databases
 */
async function updateRestaurantSubscription(restaurantId, posVersion, subscriptionData) {
    const { startDate, endDate, period } = subscriptionData;
    const { ObjectId } = require('mongodb');
    
    if (posVersion === 'v1' && databases.posV1) {
        return await databases.posV1.collection('stores').updateOne(
            { _id: new ObjectId(restaurantId) },
            { 
                $set: { 
                    startDate: startDate ? new Date(startDate) : null,
                    endDate: endDate ? new Date(endDate) : null,
                    period: period || null,
                    updatedAt: new Date(),
                }
            }
        );
    }
    
    if (posVersion === 'v2' && databases.posV2) {
        return await databases.posV2.collection('restaurants').updateOne(
            { _id: new ObjectId(restaurantId) },
            { 
                $set: { 
                    'packageInfo.startDate': startDate ? new Date(startDate) : null,
                    'packageInfo.endDate': endDate ? new Date(endDate) : null,
                    updatedAt: new Date(),
                }
            }
        );
    }
    
    return { modifiedCount: 0 };
}

/**
 * TOR 1: Get system health summary (online/offline counts)
 * Uses systemHealth collection in Main DB - populated by cron or POS heartbeat
 */
async function getSystemHealthSummary(mainDb) {
    if (!mainDb) return { online: 0, offline: 0, total: 0, byVersion: { v1: { online: 0, offline: 0 }, v2: { online: 0, offline: 0 } } };
    
    try {
        const healthRecords = await mainDb.collection('systemHealth').find({}).toArray();
        const now = new Date();
        const OFFLINE_THRESHOLD_MINUTES = 30; // Consider offline if no heartbeat in 30 min
        
        let online = 0, offline = 0;
        const byVersion = { v1: { online: 0, offline: 0 }, v2: { online: 0, offline: 0 } };
        
        healthRecords.forEach(r => {
            const lastSeen = r.lastHeartbeat || r.lastSyncAt || r.updatedAt;
            const isOnline = lastSeen && (now - new Date(lastSeen)) < OFFLINE_THRESHOLD_MINUTES * 60 * 1000 && r.status !== 'offline';
            
            if (isOnline) {
                online++;
                if (r.posVersion === 'v1') byVersion.v1.online++;
                else byVersion.v2.online++;
            } else {
                offline++;
                if (r.posVersion === 'v1') byVersion.v1.offline++;
                else byVersion.v2.offline++;
            }
        });
        
        return { online, offline, total: online + offline, byVersion };
    } catch (e) {
        return { online: 0, offline: 0, total: 0, byVersion: { v1: { online: 0, offline: 0 }, v2: { online: 0, offline: 0 } } };
    }
}

module.exports = {
    connectAllDatabases,
    getMainDb,
    getPosV1Db,
    getPosV2Db,
    getAllDatabases,
    closeAllConnections,
    getUnifiedRestaurants,
    getRestaurantById,
    updateRestaurantSubscription,
    getSystemHealthSummary,
};
