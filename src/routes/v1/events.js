/**
 * Live Events Admin Routes
 *
 * Queries the Consumer DB → publicevents collection.
 *
 * Mirrors paths the dashboard already calls:
 *   GET    /api/v1/discover/events/admin           — all events including drafts
 *   POST   /api/v1/discover/events/admin           — create event (isDraft=true default)
 *   PUT    /api/v1/discover/events/admin/:id       — full update
 *   PATCH  /api/v1/discover/events/admin/:id/publish — toggle isDraft
 *   DELETE /api/v1/discover/events/admin/:id       — hard delete
 */

const express = require('express');
const { ObjectId } = require('mongodb');
const { getConsumerDb } = require('../../utils/multiDbConnection');
const { requireAdminAuth } = require('../../middleware/adminAuth');

const router = express.Router();

router.use(requireAdminAuth);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eventsCollection() {
    const db = getConsumerDb();
    if (!db) throw new Error('Consumer DB not connected');
    return db.collection('publicevents');
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/discover/events/admin?page=1&limit=100&isDraft=false
 * All events including drafts for the admin dashboard.
 */
router.get('/admin', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 200);
        const skip = (page - 1) * limit;
        const filter = {};
        if (req.query.isDraft !== undefined) filter.isDraft = req.query.isDraft === 'true';

        const col = eventsCollection();
        const [events, total] = await Promise.all([
            col.find(filter).sort({ startDate: 1 }).skip(skip).limit(limit).toArray(),
            col.countDocuments(filter),
        ]);

        return res.json({
            success: true,
            data: events,
            pagination: { total, totalPages: Math.ceil(total / limit), currentPage: page, limit },
        });
    } catch (err) {
        return next(err);
    }
});

/**
 * POST /api/v1/discover/events/admin — create event
 */
router.post('/admin', async (req, res, next) => {
    try {
        const { title, coverImage, latitude, longitude, locationName, startDate, endDate } = req.body;
        if (!title || !coverImage || !latitude || !longitude || !locationName || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: { code: 'MISSING_FIELDS', message: 'title, coverImage, latitude, longitude, locationName, startDate, endDate are required' },
            });
        }
        if (new Date(endDate) <= new Date(startDate)) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_DATES', message: 'endDate must be after startDate' },
            });
        }

        const now = new Date();
        const event = {
            ...req.body,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            isDraft: req.body.isDraft !== false,   // default to draft
            tags: req.body.tags || [],
            createdAt: now,
            updatedAt: now,
        };

        const result = await eventsCollection().insertOne(event);
        return res.status(201).json({ success: true, data: { ...event, _id: result.insertedId } });
    } catch (err) {
        return next(err);
    }
});

/**
 * PUT /api/v1/discover/events/admin/:id — full update
 */
router.put('/admin/:id', async (req, res, next) => {
    try {
        const update = { ...req.body, updatedAt: new Date() };
        if (update.startDate) update.startDate = new Date(update.startDate);
        if (update.endDate) update.endDate = new Date(update.endDate);

        const result = await eventsCollection().findOneAndUpdate(
            { _id: new ObjectId(req.params.id) },
            { $set: update },
            { returnDocument: 'after' }
        );

        if (!result) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } });
        }
        return res.json({ success: true, data: result });
    } catch (err) {
        return next(err);
    }
});

/**
 * PATCH /api/v1/discover/events/admin/:id/publish
 * Body: { publish: boolean }
 */
router.patch('/admin/:id/publish', async (req, res, next) => {
    try {
        const { publish } = req.body;
        if (typeof publish !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_BODY', message: '`publish` must be a boolean' },
            });
        }

        const result = await eventsCollection().findOneAndUpdate(
            { _id: new ObjectId(req.params.id) },
            { $set: { isDraft: !publish, updatedAt: new Date() } },
            { returnDocument: 'after' }
        );

        if (!result) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } });
        }

        return res.json({
            success: true,
            message: publish ? 'Event published successfully' : 'Event moved to draft',
            data: { eventId: req.params.id, isDraft: result.isDraft },
        });
    } catch (err) {
        return next(err);
    }
});

/**
 * DELETE /api/v1/discover/events/admin/:id
 */
router.delete('/admin/:id', async (req, res, next) => {
    try {
        const result = await eventsCollection().findOneAndDelete({ _id: new ObjectId(req.params.id) });
        if (!result) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } });
        }
        return res.json({ success: true, message: 'Event deleted', data: { eventId: req.params.id } });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;
