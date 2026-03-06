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
    if (process.env.MONGODB_URI_POS_V2) {
        try {
            connections.main = await MongoClient.connect(process.env.MONGODB_URI_POS_V2, connectionOptions);
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
    const { search, province, district, posVersion, subscriptionStatus, limit = 50, skip = 0 } = options;
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
                    lat: 1,
                    lng: 1,
                    startDate: 1,
                    endDate: 1,
                    period: 1,
                    type: 1,
                    storeType: 1,
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
                    latitude: store.location?.lat || store.lat,
                    longitude: store.location?.lon || store.lng,
                    storeType: store.storeType || (store.type ? [store.type] : []),
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
                    storeType: 1,
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
                    province: restaurant.address?.state,
                    district: restaurant.address?.city,
                    village: restaurant.address?.street,
                    latitude: restaurant.address?.coordinates?.latitude,
                    longitude: restaurant.address?.coordinates?.longitude,
                    storeType: restaurant.storeType,
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
            const endDate = new Date(r.endDate);
            const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

            switch (subscriptionStatus) {
                case 'expired': return daysLeft < 0;
                case 'expiring_soon': return daysLeft >= 0 && daysLeft <= 30;
                case 'expiring_3months': return daysLeft > 30 && daysLeft <= 90;
                case 'active': return daysLeft > 90;
                default: return true;
            }
        });
    }

    // Sort by name
    filteredResults.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // Calculate subscription status summary on the FULL filtered dataset
    const now = new Date();
    const summary = {
        total: filteredResults.length,
        expired: 0,
        expiringSoon: 0, // < 1 month
        expiring3Months: 0, // 1-3 months
        active: 0, // > 3 months
        noSubscription: 0,
    };

    filteredResults.forEach(r => {
        if (!r.endDate) {
            summary.noSubscription++;
        } else {
            const endDate = new Date(r.endDate);
            const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

            if (daysLeft < 0) summary.expired++;
            else if (daysLeft <= 30) summary.expiringSoon++;
            else if (daysLeft <= 90) summary.expiring3Months++;
            else summary.active++;
        }
    });

    // Pagination
    const total = filteredResults.length;
    const paginatedResults = filteredResults.slice(skip, skip + limit);

    return {
        data: paginatedResults,
        summary,
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
    const {
        startDate, endDate, period,
        phone, whatsapp,
        latitude, longitude, village, province, district,
        storeType, packageLevel, paymentStatus
    } = subscriptionData;
    const { ObjectId } = require('mongodb');

    if (posVersion === 'v1' && databases.posV1) {
        const setObjV1 = {};
        if (startDate !== undefined) setObjV1.startDate = startDate ? new Date(startDate) : null;
        if (endDate !== undefined) setObjV1.endDate = endDate ? new Date(endDate) : null;
        if (period !== undefined) setObjV1.period = period || null;

        if (phone !== undefined) setObjV1.phone = phone;
        if (whatsapp !== undefined) setObjV1.whatsapp = whatsapp;

        if (latitude !== undefined) {
            setObjV1.lat = latitude;
            setObjV1['location.lat'] = latitude;
        }
        if (longitude !== undefined) {
            setObjV1.lng = longitude;
            setObjV1['location.lon'] = longitude;
        }
        if (village !== undefined) {
            setObjV1.village = village;
            setObjV1['address.village'] = village;
        }
        if (province !== undefined) {
            setObjV1.province = province;
            setObjV1['address.province'] = province;
        }
        if (district !== undefined) {
            setObjV1.district = district;
            setObjV1['address.district'] = district;
        }
        if (storeType !== undefined) {
            setObjV1.storeType = Array.isArray(storeType) ? storeType :
                (typeof storeType === 'string' ? storeType.split(',').map(s => s.trim()).filter(Boolean) : []);
        }
        if (packageLevel !== undefined) setObjV1.packageLevel = packageLevel;
        if (paymentStatus !== undefined) setObjV1.paymentStatus = paymentStatus;
        setObjV1.updatedAt = new Date();

        return await databases.posV1.collection('stores').updateOne(
            { _id: new ObjectId(restaurantId) },
            { $set: setObjV1 }
        );
    }

    if (posVersion === 'v2' && databases.posV2) {
        const setObjV2 = {};
        if (startDate !== undefined) setObjV2['packageInfo.startDate'] = startDate ? new Date(startDate) : null;
        if (endDate !== undefined) setObjV2['packageInfo.endDate'] = endDate ? new Date(endDate) : null;
        // period not heavily used in V2 natively

        if (phone !== undefined) setObjV2['contactInfo.phone'] = phone;
        if (whatsapp !== undefined) setObjV2['contactInfo.whatsapp'] = whatsapp;

        if (latitude !== undefined) setObjV2['address.coordinates.latitude'] = Number(latitude);
        if (longitude !== undefined) setObjV2['address.coordinates.longitude'] = Number(longitude);

        if (village !== undefined) setObjV2['address.street'] = village;
        if (district !== undefined) setObjV2['address.city'] = district;
        if (province !== undefined) setObjV2['address.state'] = province;

        if (storeType !== undefined) {
            setObjV2.storeType = Array.isArray(storeType) ? storeType :
                (typeof storeType === 'string' ? storeType.split(',').map(s => s.trim()).filter(Boolean) : []);
        }
        if (packageLevel !== undefined) setObjV2['packageInfo.level'] = packageLevel;
        if (paymentStatus !== undefined) setObjV2['packageInfo.paymentStatus'] = paymentStatus;
        setObjV2.updatedAt = new Date();

        return await databases.posV2.collection('restaurants').updateOne(
            { _id: new ObjectId(restaurantId) },
            { $set: setObjV2 }
        );
    }

    return { modifiedCount: 0 };
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
};
