/**
 * Subscription Package Controller
 * 
 * CRUD operations for subscription package templates.
 * Uses the POS V2 database's `subscriptionpackages` collection
 * (matching the Mongoose model name from appzap-pos-api-v2).
 */

const { ObjectId } = require('mongodb');
const { getPosV2Db } = require('../utils/multiDbConnection');

// The POS V2 Mongoose model "SubscriptionPackage" maps to collection "subscriptionpackages" (lowercase).
const COLLECTION = 'subscriptionpackages';

const subscriptionPackageController = {

    /**
     * GET /packages
     * List all subscription packages with optional filtering and pagination.
     */
    async getPackages(req, res) {
        try {
            const db = getPosV2Db();
            if (!db) {
                return res.status(500).json({ error: 'POS V2 database not connected' });
            }

            const collection = db.collection(COLLECTION);

            // Build filter
            const filter = {};

            if (req.query.isActive !== undefined) {
                filter.isActive = req.query.isActive === 'true';
            }

            if (req.query.country) {
                filter.countries = req.query.country;
            }

            if (req.query.search) {
                const searchRegex = new RegExp(escapeRegex(req.query.search), 'i');
                filter.$or = [
                    { name: searchRegex },
                    { description: searchRegex },
                ];
            }

            // Pagination
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 100;
            const skip = (page - 1) * limit;

            // Sorting
            const sortBy = req.query.sortBy || 'createdAt';
            const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

            const [packages, totalCount] = await Promise.all([
                collection.find(filter)
                    .sort({ [sortBy]: sortOrder })
                    .skip(skip)
                    .limit(limit)
                    .toArray(),
                collection.countDocuments(filter),
            ]);

            res.json({
                results: packages,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
                totalCount,
            });
        } catch (error) {
            console.error('Error fetching packages:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * GET /packages/:id
     * Get a single subscription package by ID.
     */
    async getPackageById(req, res) {
        try {
            const db = getPosV2Db();
            if (!db) {
                return res.status(500).json({ error: 'POS V2 database not connected' });
            }

            const packageDoc = await db.collection(COLLECTION).findOne({
                _id: new ObjectId(req.params.id),
            });

            if (!packageDoc) {
                return res.status(404).json({ error: 'Subscription package not found' });
            }

            res.json(packageDoc);
        } catch (error) {
            console.error('Error fetching package:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * POST /packages
     * Create a new subscription package.
     * Accepts the full POS V2 schema.
     */
    async createPackage(req, res) {
        try {
            const db = getPosV2Db();
            if (!db) {
                return res.status(500).json({ error: 'POS V2 database not connected' });
            }

            const now = new Date();
            const packageData = {
                ...req.body,
                isActive: req.body.isActive !== undefined ? req.body.isActive : true,
                createdAt: now,
                updatedAt: now,
            };

            // Ensure required fields
            if (!packageData.name) {
                return res.status(400).json({ error: 'Package name is required' });
            }

            // Ensure price object has at least monthly and yearly
            if (!packageData.price || (packageData.price.monthly === undefined && packageData.price.yearly === undefined)) {
                return res.status(400).json({ error: 'At least monthly or yearly price is required' });
            }

            // Ensure numeric prices
            if (packageData.price) {
                packageData.price.monthly = Number(packageData.price.monthly) || 0;
                packageData.price.quarterly = Number(packageData.price.quarterly) || 0;
                packageData.price.semiAnnual = Number(packageData.price.semiAnnual) || 0;
                packageData.price.yearly = Number(packageData.price.yearly) || 0;
            }

            // Ensure numeric limits
            if (packageData.limits) {
                packageData.limits.maxBranches = Number(packageData.limits.maxBranches) || 1;
                packageData.limits.maxUsers = Number(packageData.limits.maxUsers) || 5;
                packageData.limits.maxProducts = Number(packageData.limits.maxProducts) || 100;
                packageData.limits.maxOrders = packageData.limits.maxOrders !== undefined ? Number(packageData.limits.maxOrders) : -1;
                packageData.limits.maxTables = Number(packageData.limits.maxTables) || 20;
                packageData.limits.maxCustomers = packageData.limits.maxCustomers !== undefined ? Number(packageData.limits.maxCustomers) : -1;
                packageData.limits.maxStorage = Number(packageData.limits.maxStorage) || 1000;
            }

            // Remove _id if passed (let MongoDB generate it)
            delete packageData._id;

            const result = await db.collection(COLLECTION).insertOne(packageData);
            const insertedDoc = await db.collection(COLLECTION).findOne({ _id: result.insertedId });

            res.status(201).json(insertedDoc);
        } catch (error) {
            console.error('Error creating package:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * PUT /packages/:id
     * Update a subscription package.
     */
    async updatePackage(req, res) {
        try {
            const db = getPosV2Db();
            if (!db) {
                return res.status(500).json({ error: 'POS V2 database not connected' });
            }

            const collection = db.collection(COLLECTION);
            const packageId = new ObjectId(req.params.id);

            // Check if package exists
            const existing = await collection.findOne({ _id: packageId });
            if (!existing) {
                return res.status(404).json({ error: 'Subscription package not found' });
            }

            // Prepare update data
            const updateData = { ...req.body };
            delete updateData._id; // Never update _id

            // Ensure numeric prices if provided
            if (updateData.price) {
                updateData.price.monthly = Number(updateData.price.monthly) || 0;
                updateData.price.quarterly = Number(updateData.price.quarterly) || 0;
                updateData.price.semiAnnual = Number(updateData.price.semiAnnual) || 0;
                updateData.price.yearly = Number(updateData.price.yearly) || 0;
            }

            // Ensure numeric limits if provided
            if (updateData.limits) {
                if (updateData.limits.maxBranches !== undefined) updateData.limits.maxBranches = Number(updateData.limits.maxBranches);
                if (updateData.limits.maxUsers !== undefined) updateData.limits.maxUsers = Number(updateData.limits.maxUsers);
                if (updateData.limits.maxProducts !== undefined) updateData.limits.maxProducts = Number(updateData.limits.maxProducts);
                if (updateData.limits.maxOrders !== undefined) updateData.limits.maxOrders = Number(updateData.limits.maxOrders);
                if (updateData.limits.maxTables !== undefined) updateData.limits.maxTables = Number(updateData.limits.maxTables);
                if (updateData.limits.maxCustomers !== undefined) updateData.limits.maxCustomers = Number(updateData.limits.maxCustomers);
                if (updateData.limits.maxStorage !== undefined) updateData.limits.maxStorage = Number(updateData.limits.maxStorage);
            }

            updateData.updatedAt = new Date();

            await collection.updateOne(
                { _id: packageId },
                { $set: updateData }
            );

            const updatedDoc = await collection.findOne({ _id: packageId });
            res.json(updatedDoc);
        } catch (error) {
            console.error('Error updating package:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * DELETE /packages/:id
     * Delete a subscription package.
     */
    async deletePackage(req, res) {
        try {
            const db = getPosV2Db();
            if (!db) {
                return res.status(500).json({ error: 'POS V2 database not connected' });
            }

            const packageId = new ObjectId(req.params.id);
            const existing = await db.collection(COLLECTION).findOne({ _id: packageId });

            if (!existing) {
                return res.status(404).json({ error: 'Subscription package not found' });
            }

            await db.collection(COLLECTION).deleteOne({ _id: packageId });
            res.json({ message: 'Package deleted successfully' });
        } catch (error) {
            console.error('Error deleting package:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * PATCH /packages/:id/toggle
     * Toggle the active/inactive status of a subscription package.
     */
    async togglePackageStatus(req, res) {
        try {
            const db = getPosV2Db();
            if (!db) {
                return res.status(500).json({ error: 'POS V2 database not connected' });
            }

            const packageId = new ObjectId(req.params.id);
            const collection = db.collection(COLLECTION);

            const existing = await collection.findOne({ _id: packageId });
            if (!existing) {
                return res.status(404).json({ error: 'Subscription package not found' });
            }

            const newStatus = req.body.isActive !== undefined ? req.body.isActive : !existing.isActive;

            await collection.updateOne(
                { _id: packageId },
                { $set: { isActive: newStatus, updatedAt: new Date() } }
            );

            const updatedDoc = await collection.findOne({ _id: packageId });
            res.json(updatedDoc);
        } catch (error) {
            console.error('Error toggling package status:', error);
            res.status(500).json({ error: error.message });
        }
    },
};

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = subscriptionPackageController;
