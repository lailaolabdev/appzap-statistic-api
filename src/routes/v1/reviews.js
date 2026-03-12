/**
 * Reviews Admin Routes
 *
 * All routes query the Consumer DB (appzap_consumer_dev → reviews collection)
 * directly using MongoDB driver — no HTTP proxy to the consumer API needed.
 *
 * Mirrors the paths that the dashboard pages already call:
 *   GET    /api/v1/reviews/admin               — paginated list (includes hidden)
 *   PATCH  /api/v1/reviews/admin/:id/hide      — toggle isHidden
 *   DELETE /api/v1/reviews/admin/:id           — hard delete
 */

const express = require('express');
const { ObjectId } = require('mongodb');
const { getConsumerDb } = require('../../utils/multiDbConnection');
const { requireAdminAuth } = require('../../middleware/adminAuth');

const router = express.Router();

// Apply admin auth to all routes in this file
router.use(requireAdminAuth);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function reviewsCollection() {
    const db = getConsumerDb();
    if (!db) throw new Error('Consumer DB not connected');
    return db.collection('reviews');
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/reviews/admin?page=1&limit=20&minStar=1&maxStar=5&isHidden=true
 * Returns ALL reviews (including hidden) for admin moderation.
 */
router.get('/admin', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 500);
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.storeId) filter.storeId = req.query.storeId;
        if (req.query.isHidden !== undefined) {
            filter.isHidden = req.query.isHidden === 'true';
        }
        if (req.query.minStar || req.query.maxStar) {
            filter.star = {};
            if (req.query.minStar) filter.star.$gte = parseInt(req.query.minStar);
            if (req.query.maxStar) filter.star.$lte = parseInt(req.query.maxStar);
        }

        const col = reviewsCollection();

        const [reviews, total] = await Promise.all([
            col.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            col.countDocuments(filter),
        ]);

        return res.json({
            success: true,
            reviews,
            pagination: {
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                limit,
            },
        });
    } catch (err) {
        return next(err);
    }
});

/**
 * PATCH /api/v1/reviews/admin/:id/hide
 * Body: { hide: boolean }
 * Toggles isHidden flag on a review.
 */
router.patch('/admin/:id/hide', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { hide } = req.body;

        if (typeof hide !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_BODY', message: '`hide` must be a boolean' },
            });
        }

        const result = await reviewsCollection().findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: { isHidden: hide, updatedAt: new Date() } },
            { returnDocument: 'after' }
        );

        if (!result) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Review not found' } });
        }

        return res.json({
            success: true,
            message: hide ? 'Review hidden from public feed' : 'Review restored to public feed',
            data: { reviewId: id, isHidden: result.isHidden },
        });
    } catch (err) {
        return next(err);
    }
});

/**
 * DELETE /api/v1/reviews/admin/:id
 * Hard delete any review regardless of ownership.
 */
router.delete('/admin/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await reviewsCollection().findOneAndDelete({ _id: new ObjectId(id) });

        if (!result) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Review not found' } });
        }

        return res.json({ success: true, message: 'Review permanently deleted', data: { reviewId: id } });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;
