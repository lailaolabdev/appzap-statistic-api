// src/controllers/statisticsController.js

const statisticsController = {
    getStatistics: async (req, res, db) => {
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

            console.log({query})

            // Fetching statistics
            const statistics = await db.collection('stores').aggregate([
                { $match: query },
                {
                    $group: {
                        _id: null,
                        totalStores: { $sum: 1 },
                        activePosStores: { $sum: { $cond: [{ $or: [{ $eq: ["$status", "PAID"] }, { $eq: ["$status", "TRIAL"] }] }, 1, 0] } },
                        paidPosStores: { $sum: { $cond: [{ $eq: ["$status", "PAID"] }, 1, 0] } },
                        trialPosStores: { $sum: { $cond: [{ $eq: ["$status", "TRIAL"] }, 1, 0] } },
                        waitingPosStores: { $sum: { $cond: [{ $eq: ["$status", "WAITING"] }, 1, 0] } },
                        cancelPosStores: { $sum: { $cond: [{ $eq: ["$status", "CANCEL"] }, 1, 0] } },
                    }
                }
            ]).toArray();
            console.log({statistics})

            res.status(200).json(statistics[0]); // Return the first object from the statistics array
        } catch (error) {
            console.error("Error fetching statistics:", error);
            res.status(500).json({ error: 'An error occurred while fetching statistics.' });
        }
    }
};

module.exports = statisticsController;
