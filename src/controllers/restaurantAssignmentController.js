/**
 * Restaurant Assignment Controller (TOR 1 - Staff/AE Assignment)
 */

const { ObjectId } = require('mongodb');

const restaurantAssignmentController = {
    getAll: async (req, res, db) => {
        try {
            const { staffId, restaurantId, posVersion } = req.query;
            const query = { isActive: true };
            if (staffId) query.staffId = staffId;
            if (restaurantId) query.restaurantId = restaurantId;
            if (posVersion) query.posVersion = posVersion;

            const assignments = await db.collection('restaurantAssignments')
                .find(query)
                .sort({ assignedAt: -1 })
                .toArray();

            res.json({ success: true, data: assignments });
        } catch (error) {
            console.error('[Assignment] Error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    getByRestaurant: async (req, res, db) => {
        try {
            const { restaurantId, posVersion } = req.params;
            const assignment = await db.collection('restaurantAssignments').findOne({
                restaurantId,
                posVersion,
                isActive: true,
            });
            res.json({ success: true, data: assignment });
        } catch (error) {
            console.error('[Assignment] Error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    createOrUpdate: async (req, res, db) => {
        try {
            const { restaurantId, posVersion, staffId, staffName, staffEmail, staffPhone, role, notes } = req.body;

            if (!restaurantId || !posVersion) {
                return res.status(400).json({ success: false, error: 'restaurantId and posVersion required' });
            }

            const doc = {
                restaurantId,
                posVersion,
                staffId: staffId || null,
                staffName: staffName || '',
                staffEmail: staffEmail || '',
                staffPhone: staffPhone || '',
                role: role || 'ae',
                notes: notes || '',
                assignedAt: new Date(),
                assignedBy: req.user?.id || 'system',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const result = await db.collection('restaurantAssignments').updateOne(
                { restaurantId, posVersion },
                { $set: doc },
                { upsert: true }
            );

            const assignment = await db.collection('restaurantAssignments').findOne({
                restaurantId,
                posVersion,
            });

            res.json({ success: true, data: assignment });
        } catch (error) {
            console.error('[Assignment] Error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    remove: async (req, res, db) => {
        try {
            const { restaurantId, posVersion } = req.params;

            const result = await db.collection('restaurantAssignments').updateOne(
                { restaurantId, posVersion },
                { $set: { isActive: false, updatedAt: new Date() } }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ success: false, error: 'Assignment not found' });
            }

            res.json({ success: true, message: 'Assignment removed' });
        } catch (error) {
            console.error('[Assignment] Error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },
};

module.exports = restaurantAssignmentController;
