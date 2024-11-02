// src/controllers/restaurantsController.js

const restaurantsController = {
    getRestaurants: async (req, res, db) => {
        try {
            const { status, paymentStatus, packageType, packagePeriod, category, hasPOS } = req.query;
    
            // Build the query object based on provided parameters
            const query = {};
            
            if (status) query.status = status.toUpperCase();
            if (paymentStatus) query.paymentStatus = paymentStatus.toUpperCase();
            if (packageType) query.package = packageType.toUpperCase();
            if (packagePeriod) query.period = packagePeriod.toUpperCase();
            if (category) query.category = category.toUpperCase();
            if (hasPOS) query.hasPOS = hasPOS === 'true'; // Assuming hasPOS is a boolean
    
            console.log({ query });
    
            // Fetching filtered restaurants
            const restaurants = await db.collection('stores').find(query).toArray();
            console.log({ restaurants });
    
            // Return the number of restaurants along with the list
            res.status(200).json({
                count: restaurants.length,
                restaurants
            });
        } catch (error) {
            console.error("Error fetching restaurants:", error);
            res.status(500).json({ error: 'An error occurred while fetching restaurants.' });
        }
    },

    // Get restaurant sorted by their income
    getRestaurantsIncome: async (req, res, db) => {
        try {
            const { startDate, endDate, restaurantIds } = req.query;

            // Prepare the match query
            const matchQuery = {
                status: 'CHECKOUT',
                isCheckout: true
            };

            if (startDate) {
                matchQuery.createdAt = {
                    $gte: new Date(startDate),
                };
            }
    
            if (endDate) {
                // Set the endDate to the last millisecond of that day
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999); // Set to end of day
                matchQuery.createdAt = {
                    ...matchQuery.createdAt,
                    $lte: end
                };
            }

            if (restaurantIds) {
                matchQuery.storeId = { $in: restaurantIds.split(',').map(id => id.trim()) }; // Convert to array
            }

            // Fetching the income summary from the Bill collection
            const summary = await db.collection('bills').aggregate([
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
                        _id: '$storeId', // Group by storeId
                        totalIncome: { $sum: '$billAmount' },
                        storeName: { $first: '$storeDetails.name' } // Include the store name
                    }
                },
                { $sort: { totalIncome: -1 } } // Sort by totalIncome in descending order
            ]).toArray();

            // Calculate GMP (Gross Money Processing)
            const totalGMP = summary.reduce((acc, item) => acc + item.totalIncome, 0);

            // Format totalIncome as currency in Lao Kip (LAK)
            const formattedSummary = summary.map(item => ({
                ...item,
                totalIncome: new Intl.NumberFormat('lo-LA', { style: 'currency', currency: 'LAK' }).format(item.totalIncome)
            }));

            res.status(200).json({
                count: formattedSummary.length,
                totalGMP: new Intl.NumberFormat('lo-LA', { style: 'currency', currency: 'LAK' }).format(totalGMP), // GMP formatted as currency
                restaurants: formattedSummary
            });
        } catch (error) {
            console.error("Error fetching restaurant income:", error);
            res.status(500).json({ error: 'An error occurred while fetching restaurant income.' });
        }
    }

};

module.exports = restaurantsController;
