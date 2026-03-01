/**
 * Subscription Management Controller
 * 
 * Handles subscription tracking, expiry monitoring, and unified restaurant views
 * across both POS v1 and v2 databases.
 */

const { ObjectId } = require('mongodb');
const { 
    getUnifiedRestaurants, 
    getRestaurantById,
    updateRestaurantSubscription,
    getSystemHealthSummary,
    getPosV1Db,
    getPosV2Db 
} = require('../utils/multiDbConnection');

const subscriptionController = {
    /**
     * Get unified list of all restaurants from both POS versions
     * with subscription status
     */
    getUnifiedRestaurants: async (req, res, db) => {
        try {
            const {
                search,
                province,
                district,
                posVersion,
                subscriptionStatus, // "expired" | "expiring_soon" | "expiring_3months" | "active"
                startDate,
                endDate,
                limit = 50,
                skip = 0,
            } = req.query;

            const result = await getUnifiedRestaurants({
                search,
                province,
                district,
                posVersion,
                subscriptionStatus,
                startDate,
                endDate,
                limit: parseInt(limit),
                skip: parseInt(skip),
            });

            // Calculate subscription status summary
            const now = new Date();
            const summary = {
                total: result.pagination.total,
                expired: 0,
                expiringSoon: 0, // < 1 month
                expiring3Months: 0, // 1-3 months
                active: 0, // > 3 months
                noSubscription: 0,
            };

            result.data.forEach(r => {
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

            res.json({
                success: true,
                data: result.data,
                pagination: result.pagination,
                summary,
            });
        } catch (error) {
            console.error('[Subscription] Error getting unified restaurants:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * TOR 1: Get system health summary (online/offline counts)
     */
    getSystemHealth: async (req, res, db) => {
        try {
            const summary = await getSystemHealthSummary(db);
            res.json({ success: true, data: summary });
        } catch (error) {
            console.error('[Subscription] Error getting system health:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get subscription expiry statistics
     */
    getExpiryStats: async (req, res, db) => {
        try {
            const { startDate, endDate } = req.query;
            const result = await getUnifiedRestaurants({ limit: 10000, skip: 0, startDate, endDate });
            const now = new Date();

            const stats = {
                total: result.data.length,
                byStatus: {
                    expired: [],
                    expiringSoon: [], // < 30 days
                    expiring1to3Months: [], // 30-90 days
                    active: [], // > 90 days
                    noSubscription: [],
                },
                byPosVersion: {
                    v1: { total: 0, expired: 0, expiringSoon: 0 },
                    v2: { total: 0, expired: 0, expiringSoon: 0 },
                },
                byMonth: {}, // Expiry by month
            };

            result.data.forEach(r => {
                // Count by POS version
                if (r.posVersion === 'v1') stats.byPosVersion.v1.total++;
                if (r.posVersion === 'v2') stats.byPosVersion.v2.total++;

                if (!r.endDate) {
                    stats.byStatus.noSubscription.push({
                        id: r.restaurantId,
                        posVersion: r.posVersion,
                        name: r.name,
                        phone: r.phone,
                    });
                    return;
                }

                const endDate = new Date(r.endDate);
                const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                
                const restaurantInfo = {
                    id: r.restaurantId,
                    posVersion: r.posVersion,
                    name: r.name,
                    phone: r.phone,
                    whatsapp: r.whatsapp,
                    endDate: r.endDate,
                    daysLeft,
                };

                // Categorize by status
                if (daysLeft < 0) {
                    stats.byStatus.expired.push(restaurantInfo);
                    if (r.posVersion === 'v1') stats.byPosVersion.v1.expired++;
                    if (r.posVersion === 'v2') stats.byPosVersion.v2.expired++;
                } else if (daysLeft <= 30) {
                    stats.byStatus.expiringSoon.push(restaurantInfo);
                    if (r.posVersion === 'v1') stats.byPosVersion.v1.expiringSoon++;
                    if (r.posVersion === 'v2') stats.byPosVersion.v2.expiringSoon++;
                } else if (daysLeft <= 90) {
                    stats.byStatus.expiring1to3Months.push(restaurantInfo);
                } else {
                    stats.byStatus.active.push(restaurantInfo);
                }

                // Group by expiry month
                const monthKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;
                if (!stats.byMonth[monthKey]) {
                    stats.byMonth[monthKey] = [];
                }
                stats.byMonth[monthKey].push(restaurantInfo);
            });

            // Sort byMonth keys
            stats.byMonth = Object.keys(stats.byMonth)
                .sort()
                .reduce((obj, key) => {
                    obj[key] = stats.byMonth[key];
                    return obj;
                }, {});

            res.json({
                success: true,
                data: stats,
            });
        } catch (error) {
            console.error('[Subscription] Error getting expiry stats:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get single restaurant details
     */
    getRestaurantDetail: async (req, res, db) => {
        try {
            const { restaurantId, posVersion } = req.params;

            const restaurant = await getRestaurantById(restaurantId, posVersion);

            if (!restaurant) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Restaurant not found' 
                });
            }

            // Get invoices for this restaurant
            const invoices = await db.collection('invoices')
                .find({ 
                    'restaurant.id': restaurantId,
                    'restaurant.posVersion': posVersion 
                })
                .sort({ invoiceDate: -1 })
                .limit(10)
                .toArray();

            res.json({
                success: true,
                data: {
                    restaurant,
                    posVersion,
                    invoices,
                },
            });
        } catch (error) {
            console.error('[Subscription] Error getting restaurant detail:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Update subscription dates for a restaurant
     * WARNING: This modifies the POS database
     */
    updateSubscription: async (req, res, db) => {
        try {
            const { restaurantId, posVersion } = req.params;
            const { startDate, endDate, period } = req.body;

            // Validate
            if (!restaurantId || !posVersion) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'restaurantId and posVersion are required' 
                });
            }

            // Update the subscription
            const result = await updateRestaurantSubscription(
                restaurantId, 
                posVersion, 
                { startDate, endDate, period }
            );

            if (result.modifiedCount === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Restaurant not found or no changes made' 
                });
            }

            res.json({
                success: true,
                message: 'Subscription updated successfully',
                modifiedCount: result.modifiedCount,
            });
        } catch (error) {
            console.error('[Subscription] Error updating subscription:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Bulk update subscriptions from Excel data
     */
    bulkUpdateFromExcel: async (req, res, db) => {
        try {
            const { restaurants } = req.body;
            // restaurants: [{ restaurantId, posVersion, startDate, endDate, period, matchBy }]

            if (!Array.isArray(restaurants) || restaurants.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'restaurants array is required' 
                });
            }

            const results = {
                total: restaurants.length,
                updated: 0,
                failed: 0,
                errors: [],
            };

            for (const r of restaurants) {
                try {
                    let restaurantId = r.restaurantId;
                    let posVersion = r.posVersion;

                    // If no ID provided, try to match by name/phone
                    if (!restaurantId && (r.name || r.phone)) {
                        const matched = await findRestaurantByNameOrPhone(
                            r.name, 
                            r.phone, 
                            r.posVersion
                        );
                        if (matched) {
                            restaurantId = matched.restaurantId;
                            posVersion = matched.posVersion;
                        }
                    }

                    if (!restaurantId) {
                        results.failed++;
                        results.errors.push({
                            input: r,
                            error: 'Could not match restaurant',
                        });
                        continue;
                    }

                    const updateResult = await updateRestaurantSubscription(
                        restaurantId,
                        posVersion,
                        {
                            startDate: r.startDate,
                            endDate: r.endDate,
                            period: r.period,
                        }
                    );

                    if (updateResult.modifiedCount > 0) {
                        results.updated++;
                    } else {
                        results.failed++;
                        results.errors.push({
                            input: r,
                            error: 'No changes made',
                        });
                    }
                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        input: r,
                        error: error.message,
                    });
                }
            }

            res.json({
                success: true,
                results,
            });
        } catch (error) {
            console.error('[Subscription] Error bulk updating:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },
};

/**
 * Helper function to find restaurant by name or phone
 */
async function findRestaurantByNameOrPhone(name, phone, preferredVersion) {
    const posV1Db = getPosV1Db();
    const posV2Db = getPosV2Db();

    // Try POS v1
    if (posV1Db && (!preferredVersion || preferredVersion === 'v1')) {
        const query = {};
        if (name && phone) {
            query.$or = [
                { name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } },
                { phone: phone },
            ];
        } else if (name) {
            query.name = { $regex: `^${escapeRegex(name)}$`, $options: 'i' };
        } else if (phone) {
            query.phone = phone;
        }

        const found = await posV1Db.collection('stores').findOne(query);
        if (found) {
            return { restaurantId: found._id.toString(), posVersion: 'v1' };
        }
    }

    // Try POS v2
    if (posV2Db && (!preferredVersion || preferredVersion === 'v2')) {
        const query = {};
        if (name && phone) {
            query.$or = [
                { name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } },
                { 'contactInfo.phone': phone },
            ];
        } else if (name) {
            query.name = { $regex: `^${escapeRegex(name)}$`, $options: 'i' };
        } else if (phone) {
            query['contactInfo.phone'] = phone;
        }

        const found = await posV2Db.collection('restaurants').findOne(query);
        if (found) {
            return { restaurantId: found._id.toString(), posVersion: 'v2' };
        }
    }

    return null;
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = subscriptionController;
