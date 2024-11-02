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

            res.status(200).json(restaurants);
        } catch (error) {
            console.error("Error fetching restaurants:", error);
            res.status(500).json({ error: 'An error occurred while fetching restaurants.' });
        }
    }
};

module.exports = restaurantsController;
