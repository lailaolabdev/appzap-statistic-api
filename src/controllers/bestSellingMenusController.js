const getBestSellingMenus = async (req, res, db) => {
    try {
        const { startDate, endDate, restaurantIds } = req.query;

        // Prepare the match query
        const matchQuery = {
            isCheckOut: true,
            status: 'SERVED' // Ensuring we only fetch completed orders
        };

        if (startDate) {
            matchQuery.createdAt = { $gte: new Date(startDate) };
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            matchQuery.createdAt = { ...matchQuery.createdAt, $lte: end };
        }

        if (restaurantIds) {
            matchQuery.storeId = { $in: restaurantIds.split(',').map(id => id.trim()) };
        }

        const summary = await db.collection('orders').aggregate([
            { $match: matchQuery },
            {
                $lookup: {
                    from: 'stores', // the collection name in MongoDB
                    localField: 'storeId',
                    foreignField: '_id',
                    as: 'storeDetails'
                }
            },
            { $unwind: '$storeDetails' },
            {
                $group: {
                    _id: {
                        storeId: '$storeId',
                        menuId: '$menuId',
                    },
                    totalQuantity: { $sum: '$quantity' },
                    totalRevenue: { $sum: '$totalPrice' },
                    menuName: { $first: '$name' },
                    storeName: { $first: '$storeDetails.name' }
                }
            },
            {
                $group: {
                    _id: '$_id.storeId',
                    storeName: { $first: '$storeName' },
                    menus: {
                        $push: {
                            menuId: '$_id.menuId',
                            menuName: '$menuName',
                            totalQuantity: '$totalQuantity',
                            totalRevenue: '$totalRevenue'
                        }
                    }
                }
            },
            {
                $project: {
                    storeId: '$_id',
                    storeName: 1,
                    menus: {
                        $slice: [
                            {
                                $sortArray: { input: '$menus', sortBy: { totalQuantity: -1 } }
                            },
                            5 // Limit to top 5 best-selling items per restaurant
                        ]
                    }
                }
            }
        ]).toArray();

        // Format totalRevenue as currency in Lao Kip (LAK)
        const formattedSummary = summary.map(store => ({
            storeId: store.storeId,
            storeName: store.storeName,
            menus: store.menus.map(menu => ({
                ...menu,
                totalRevenueFormat: new Intl.NumberFormat('lo-LA', { style: 'currency', currency: 'LAK' }).format(menu.totalRevenue),
            }))
        }));

        res.status(200).json({
            count: formattedSummary.length,
            bestSellingMenus: formattedSummary
        });
    } catch (error) {
        console.error("Error fetching best-selling menus:", error);
        res.status(500).json({ error: 'An error occurred while fetching best-selling menus.' });
    }
};

module.exports = { getBestSellingMenus };
