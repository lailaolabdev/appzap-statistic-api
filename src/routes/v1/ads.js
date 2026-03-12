/**
 * Ads Admin Routes
 *
 * Queries the Consumer DB → advertisements collection.
 *
 * Mirrors paths the dashboard already calls:
 *   GET    /api/v1/ads/admin/all          — all campaigns
 *   POST   /api/v1/ads/admin              — create campaign
 *   GET    /api/v1/ads/admin/:id          — single campaign analytics
 *   PATCH  /api/v1/ads/admin/:id/status   — update status
 *   POST   /api/v1/ads/admin/:id/approve  — approve
 *   POST   /api/v1/ads/admin/:id/reject   — reject
 */

const express = require('express');
const { ObjectId } = require('mongodb');
const { getConsumerDb } = require('../../utils/multiDbConnection');
const { requireAdminAuth } = require('../../middleware/adminAuth');

const router = express.Router();

router.use(requireAdminAuth);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function adsCollection() {
    const db = getConsumerDb();
    if (!db) throw new Error('Consumer DB not connected');
    return db.collection('advertisements');
}

const VALID_STATUSES = ['draft', 'pending_approval', 'approved', 'active', 'paused', 'ended', 'rejected'];

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/ads/admin/all?status=active&limit=50
 */
router.get('/admin/all', async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const skip = parseInt(req.query.skip) || 0;
        const filter = {};
        if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
        if (req.query.type) filter.type = req.query.type;
        if (req.query.placement) filter.placement = req.query.placement;

        const col = adsCollection();
        const [ads, total] = await Promise.all([
            col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            col.countDocuments(filter),
        ]);

        return res.json({ success: true, data: ads, total });
    } catch (err) {
        return next(err);
    }
});

/**
 * POST /api/v1/ads/admin — create new campaign
 */
router.post('/admin', async (req, res, next) => {
    try {
        const now = new Date();
        const ad = {
            ...req.body,
            status: req.body.status || 'pending_approval',
            stats: { impressions: 0, clicks: 0, conversions: 0 },
            createdAt: now,
            updatedAt: now,
        };

        const result = await adsCollection().insertOne(ad);
        return res.status(201).json({
            success: true,
            data: { ...ad, _id: result.insertedId },
            message: 'Ad created successfully',
        });
    } catch (err) {
        return next(err);
    }
});

/**
 * GET /api/v1/ads/admin/:id — single ad with analytics
 */
router.get('/admin/:id', async (req, res, next) => {
    try {
        const ad = await adsCollection().findOne({ _id: new ObjectId(req.params.id) });
        if (!ad) return res.status(404).json({ success: false, error: 'Ad not found' });
        return res.json({ success: true, data: ad });
    } catch (err) {
        return next(err);
    }
});

/**
 * PATCH /api/v1/ads/admin/:id/status — update status
 */
router.patch('/admin/:id/status', async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        const result = await adsCollection().findOneAndUpdate(
            { _id: new ObjectId(req.params.id) },
            { $set: { status, updatedAt: new Date() } },
            { returnDocument: 'after' }
        );

        if (!result) return res.status(404).json({ success: false, error: 'Ad not found' });
        return res.json({ success: true, message: `Ad status updated to ${status}` });
    } catch (err) {
        return next(err);
    }
});

/**
 * POST /api/v1/ads/admin/:id/approve
 */
router.post('/admin/:id/approve', async (req, res, next) => {
    try {
        const result = await adsCollection().findOneAndUpdate(
            { _id: new ObjectId(req.params.id) },
            { $set: { status: 'approved', approvedAt: new Date(), updatedAt: new Date() } },
            { returnDocument: 'after' }
        );

        if (!result) return res.status(404).json({ success: false, error: 'Ad not found' });
        return res.json({ success: true, data: result, message: 'Ad approved successfully' });
    } catch (err) {
        return next(err);
    }
});

/**
 * POST /api/v1/ads/admin/:id/reject
 * Body: { reason: string }
 */
router.post('/admin/:id/reject', async (req, res, next) => {
    try {
        const { reason } = req.body;
        if (!reason) {
            return res.status(400).json({ success: false, error: 'Rejection reason is required' });
        }

        const result = await adsCollection().findOneAndUpdate(
            { _id: new ObjectId(req.params.id) },
            { $set: { status: 'rejected', rejectionReason: reason, updatedAt: new Date() } },
            { returnDocument: 'after' }
        );

        if (!result) return res.status(404).json({ success: false, error: 'Ad not found' });
        return res.json({ success: true, data: result, message: 'Ad rejected' });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;
