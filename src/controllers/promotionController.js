/**
 * Promotion Controller
 *
 * Queries and mutates promotions in POS v2 database (for dashboard admin).
 * create/update/delete are used by the dashboard to manage promotions for any restaurant.
 */

const { ObjectId } = require('mongodb');
const { getPosV2Db } = require('../utils/multiDbConnection');

// Placeholder for dashboard-created promotions (POS v2 schema requires createdBy)
const DASHBOARD_CREATED_BY = new ObjectId('000000000000000000000001');

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const promotionController = {
    /**
     * Get promotions from POS v2 database with filtering, sorting, and pagination
     */
    getPromotions: async (req, res) => {
        try {
            const posV2Db = getPosV2Db();
            if (!posV2Db) {
                return res.status(500).json({
                    success: false,
                    error: 'POS v2 database not connected',
                });
            }

            const {
                status,
                businessType,
                restaurantId,
                search,
                page = 1,
                limit = 10,
                sortBy = 'createdAt',
                sortOrder = 'desc',
            } = req.query;

            const pageNum = Math.max(1, parseInt(page));
            const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
            const sortDir = sortOrder === 'asc' ? 1 : -1;

            // Build match stage
            const matchStage = {};

            if (status) {
                matchStage.status = status;
            }

            if (businessType) {
                matchStage.businessType = businessType;
            }

            if (restaurantId) {
                try {
                    matchStage.restaurantId = new ObjectId(restaurantId);
                } catch {
                    matchStage.restaurantId = restaurantId;
                }
            }

            if (search) {
                matchStage.name = { $regex: escapeRegex(search), $options: 'i' };
            }

            const pipeline = [
                { $match: matchStage },
                {
                    $lookup: {
                        from: 'restaurants',
                        localField: 'restaurantId',
                        foreignField: '_id',
                        as: '_restaurant',
                    },
                },
                {
                    $addFields: {
                        restaurantName: {
                            $ifNull: [
                                { $arrayElemAt: ['$_restaurant.name', 0] },
                                'Unknown Restaurant',
                            ],
                        },
                    },
                },
                { $project: { _restaurant: 0 } },
                { $sort: { [sortBy]: sortDir } },
                {
                    $facet: {
                        data: [
                            { $skip: (pageNum - 1) * limitNum },
                            { $limit: limitNum },
                        ],
                        totalCount: [{ $count: 'count' }],
                    },
                },
            ];

            const [result] = await posV2Db.collection('promotions').aggregate(pipeline).toArray();

            const promotions = result.data || [];
            const total = result.totalCount[0]?.count || 0;

            res.json({
                success: true,
                data: {
                    promotions,
                    pagination: {
                        page: pageNum,
                        limit: limitNum,
                        total,
                        pages: Math.ceil(total / limitNum),
                    },
                },
            });
        } catch (error) {
            console.error('[Promotions] Error getting promotions:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get a single promotion by ID (with restaurant name)
     */
    getPromotionById: async (req, res) => {
        try {
            const posV2Db = getPosV2Db();
            if (!posV2Db) {
                return res.status(500).json({ success: false, error: 'POS v2 database not connected' });
            }
            const { id } = req.params;
            let promotionId;
            try {
                promotionId = new ObjectId(id);
            } catch {
                return res.status(400).json({ success: false, error: 'Invalid promotion ID' });
            }
            const pipeline = [
                { $match: { _id: promotionId } },
                {
                    $lookup: {
                        from: 'restaurants',
                        localField: 'restaurantId',
                        foreignField: '_id',
                        as: '_restaurant',
                    },
                },
                {
                    $addFields: {
                        restaurantName: {
                            $ifNull: [{ $arrayElemAt: ['$_restaurant.name', 0] }, 'Unknown Restaurant'],
                        },
                    },
                },
                { $project: { _restaurant: 0 } },
            ];
            const [promotion] = await posV2Db.collection('promotions').aggregate(pipeline).toArray();
            if (!promotion) {
                return res.status(404).json({ success: false, error: 'Promotion not found' });
            }
            res.json({ success: true, data: promotion });
        } catch (error) {
            console.error('[Promotions] Error getting promotion:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Create a new promotion for a restaurant (dashboard admin)
     */
    createPromotion: async (req, res) => {
        try {
            const posV2Db = getPosV2Db();
            if (!posV2Db) {
                return res.status(500).json({ success: false, error: 'POS v2 database not connected' });
            }
            const body = req.body || {};
            const { restaurantId, name, businessType, calculationType, discountValue, startDate, endDate, status, code, description } = body;
            if (!restaurantId || !name || !businessType || !calculationType || discountValue == null) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: restaurantId, name, businessType, calculationType, discountValue',
                });
            }
            let restId;
            try {
                restId = new ObjectId(restaurantId);
            } catch {
                return res.status(400).json({ success: false, error: 'Invalid restaurantId' });
            }
            const start = startDate ? new Date(startDate) : new Date();
            const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            if (start >= end) {
                return res.status(400).json({ success: false, error: 'Start date must be before end date' });
            }
            if (calculationType === 'percentage' && (Number(discountValue) < 0 || Number(discountValue) > 100)) {
                return res.status(400).json({ success: false, error: 'Percentage discount must be between 0 and 100' });
            }
            const promotionDoc = {
                restaurantId: restId,
                name: String(name).trim(),
                description: description ? String(description).trim() : '',
                code: code && String(code).trim() ? String(code).trim().toUpperCase() : `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                businessType: String(businessType),
                type: 'order_discount',
                calculationType: String(calculationType),
                discountType: calculationType === 'percentage' ? 'percentage' : 'fixed',
                discountValue: Number(discountValue),
                startDate: start,
                endDate: end,
                status: status || 'draft',
                branchIds: [],
                conditions: {
                    minimumOrderValue: 0,
                    timeRestrictions: { daysOfWeek: [], timeSlots: [], excludeHolidays: false },
                    customerConditions: { segments: [], loyaltyTiers: [], isFirstTimeCustomer: false, isBirthdayMonth: false },
                    orderConditions: { orderTypes: [], paymentMethods: [], tableSize: {} },
                },
                currentUsage: 0,
                analytics: { totalUsage: 0, uniqueCustomers: 0, totalDiscountGiven: 0, averageOrderValue: 0, conversionRate: 0 },
                createdBy: DASHBOARD_CREATED_BY,
                isActive: true,
                priority: 1,
            };
            const insertResult = await posV2Db.collection('promotions').insertOne(promotionDoc);
            const inserted = await posV2Db.collection('promotions').findOne({ _id: insertResult.insertedId });
            res.status(201).json({
                success: true,
                data: inserted,
                message: 'Promotion created successfully',
            });
        } catch (error) {
            console.error('[Promotions] Error creating promotion:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Update a promotion (dashboard admin)
     */
    updatePromotion: async (req, res) => {
        try {
            const posV2Db = getPosV2Db();
            if (!posV2Db) {
                return res.status(500).json({ success: false, error: 'POS v2 database not connected' });
            }
            const { id } = req.params;
            let promotionId;
            try {
                promotionId = new ObjectId(id);
            } catch {
                return res.status(400).json({ success: false, error: 'Invalid promotion ID' });
            }
            const existing = await posV2Db.collection('promotions').findOne({ _id: promotionId });
            if (!existing) {
                return res.status(404).json({ success: false, error: 'Promotion not found' });
            }
            const body = req.body || {};
            const allowed = ['name', 'description', 'code', 'businessType', 'calculationType', 'discountValue', 'maxDiscountAmount', 'startDate', 'endDate', 'status'];
            const update = { updatedBy: DASHBOARD_CREATED_BY };
            for (const key of allowed) {
                if (body[key] !== undefined) {
                    if (key === 'startDate' || key === 'endDate') update[key] = new Date(body[key]);
                    else if (key === 'discountValue' || key === 'maxDiscountAmount') update[key] = Number(body[key]);
                    else update[key] = typeof body[key] === 'string' ? body[key].trim() : body[key];
                }
            }
            if (update.startDate !== undefined && update.endDate !== undefined && update.startDate >= update.endDate) {
                return res.status(400).json({ success: false, error: 'Start date must be before end date' });
            }
            const startDate = update.startDate ?? existing.startDate;
            const endDate = update.endDate ?? existing.endDate;
            if (new Date(startDate) >= new Date(endDate)) {
                return res.status(400).json({ success: false, error: 'Start date must be before end date' });
            }
            update.updatedAt = new Date();
            await posV2Db.collection('promotions').updateOne(
                { _id: promotionId },
                { $set: update }
            );
            const updated = await posV2Db.collection('promotions').findOne({ _id: promotionId });
            res.json({ success: true, data: updated, message: 'Promotion updated successfully' });
        } catch (error) {
            console.error('[Promotions] Error updating promotion:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Delete a promotion (dashboard admin)
     */
    deletePromotion: async (req, res) => {
        try {
            const posV2Db = getPosV2Db();
            if (!posV2Db) {
                return res.status(500).json({ success: false, error: 'POS v2 database not connected' });
            }
            const { id } = req.params;
            let promotionId;
            try {
                promotionId = new ObjectId(id);
            } catch {
                return res.status(400).json({ success: false, error: 'Invalid promotion ID' });
            }
            const result = await posV2Db.collection('promotions').deleteOne({ _id: promotionId });
            if (result.deletedCount === 0) {
                return res.status(404).json({ success: false, error: 'Promotion not found' });
            }
            res.json({ success: true, message: 'Promotion deleted successfully' });
        } catch (error) {
            console.error('[Promotions] Error deleting promotion:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },
};

module.exports = promotionController;
