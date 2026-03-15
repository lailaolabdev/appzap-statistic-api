/**
 * Promotion Controller
 *
 * Queries promotions from POS v2 database with restaurant lookup.
 */

const { ObjectId } = require('mongodb');
const { getPosV2Db } = require('../utils/multiDbConnection');

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
};

module.exports = promotionController;
