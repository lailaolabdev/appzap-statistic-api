/**
 * Support / Case Management Controller
 *
 * Support tickets for restaurant issues. Phase 1: tickets are logged manually
 * by the support team while chatting with restaurants on WhatsApp
 * (source: "manual"). Phase 2 will add Twilio WhatsApp inbound intake
 * (source: "whatsapp").
 */

const { ObjectId } = require('mongodb');
const { getUnifiedRestaurants } = require('../utils/multiDbConnection');
const { uploadSupportAttachment } = require('../utils/s3Upload');

const OPEN_STATUSES = ['open', 'in_progress', 'waiting_restaurant'];
const VALID_STATUSES = [...OPEN_STATUSES, 'resolved'];
const VALID_PRIORITIES = ['urgent', 'normal'];
const VALID_CATEGORIES = ['hardware', 'software', 'billing', 'network', 'question', 'other'];

/**
 * Generate a monthly-sequential ticket number, e.g. SUP-2607-014
 */
async function nextTicketNumber(db) {
    const now = new Date();
    const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const result = await db.collection('counters').findOneAndUpdate(
        { _id: `supportTicket-${yymm}` },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
    );
    const seq = result?.seq ?? result?.value?.seq ?? 1;
    return `SUP-${yymm}-${String(seq).padStart(3, '0')}`;
}

/** Actor ({ userId, name }) from request body, tolerant of missing fields */
function actorFrom(body) {
    const by = body?.by || {};
    return {
        userId: by.userId || null,
        name: by.name || 'unknown',
    };
}

const supportController = {
    // ==================== TICKETS ====================

    /**
     * List tickets. Urgent tickets float to the top, then newest first.
     * Query: status, category, priority, assignedTo (userId), restaurantId,
     *        search, page, limit
     */
    getTickets: async (req, res, db) => {
        try {
            const {
                status, category, priority, assignedTo, restaurantId, search,
                page = 1, limit = 50,
            } = req.query;

            const query = {};
            if (status && status !== 'all') query.status = status;
            if (category && category !== 'all') query.category = category;
            if (priority && priority !== 'all') query.priority = priority;
            if (assignedTo) query['assignedTo.userId'] = assignedTo;
            if (restaurantId) query['restaurant.id'] = restaurantId;
            if (search) {
                query.$or = [
                    { ticketNumber: { $regex: search, $options: 'i' } },
                    { subject: { $regex: search, $options: 'i' } },
                    { 'restaurant.name': { $regex: search, $options: 'i' } },
                ];
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [tickets, total] = await Promise.all([
                db.collection('supportTickets').aggregate([
                    { $match: query },
                    {
                        $addFields: {
                            priorityRank: { $cond: [{ $eq: ['$priority', 'urgent'] }, 0, 1] },
                            statusRank: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] },
                        },
                    },
                    { $sort: { statusRank: 1, priorityRank: 1, createdAt: -1 } },
                    { $skip: skip },
                    { $limit: parseInt(limit) },
                    { $project: { priorityRank: 0, statusRank: 0 } },
                ]).toArray(),
                db.collection('supportTickets').countDocuments(query),
            ]);

            res.json({ success: true, data: tickets, total });
        } catch (error) {
            console.error('[Support] Error listing tickets:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Summary numbers for the stat cards.
     */
    getSummary: async (req, res, db) => {
        try {
            const now = new Date();
            const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

            const col = db.collection('supportTickets');
            const [urgentOpen, totalOpen, over24h, resolvedThisWeek, avgAgg] = await Promise.all([
                col.countDocuments({ status: { $in: OPEN_STATUSES }, priority: 'urgent' }),
                col.countDocuments({ status: { $in: OPEN_STATUSES } }),
                col.countDocuments({ status: { $in: OPEN_STATUSES }, createdAt: { $lt: dayAgo } }),
                col.countDocuments({ status: 'resolved', resolvedAt: { $gte: weekAgo } }),
                col.aggregate([
                    { $match: { status: 'resolved', resolvedAt: { $gte: weekAgo } } },
                    {
                        $project: {
                            minutes: {
                                $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 60000],
                            },
                        },
                    },
                    { $group: { _id: null, avgMinutes: { $avg: '$minutes' } } },
                ]).toArray(),
            ]);

            res.json({
                success: true,
                data: {
                    urgentOpen,
                    totalOpen,
                    over24h,
                    resolvedThisWeek,
                    avgResolutionMinutes: avgAgg[0]?.avgMinutes || 0,
                },
            });
        } catch (error) {
            console.error('[Support] Error getting summary:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get one ticket with full activity log.
     */
    getTicketById: async (req, res, db) => {
        try {
            const ticket = await db.collection('supportTickets').findOne({
                _id: new ObjectId(req.params.id),
            });
            if (!ticket) {
                return res.status(404).json({ success: false, error: 'Ticket not found' });
            }
            res.json({ success: true, data: ticket });
        } catch (error) {
            console.error('[Support] Error getting ticket:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Create a ticket (manual intake).
     * Body: { restaurant: {id, posVersion, name, phone, whatsapp, province},
     *         category, priority, subject, description, by: {userId, name} }
     */
    createTicket: async (req, res, db) => {
        try {
            const { restaurant, category, priority, subject, description, attachments } = req.body;

            if (!restaurant?.id || !restaurant?.name) {
                return res.status(400).json({ success: false, error: 'restaurant is required' });
            }
            if (!subject) {
                return res.status(400).json({ success: false, error: 'subject is required' });
            }
            if (!VALID_CATEGORIES.includes(category)) {
                return res.status(400).json({ success: false, error: 'invalid category' });
            }
            if (!VALID_PRIORITIES.includes(priority)) {
                return res.status(400).json({ success: false, error: 'invalid priority' });
            }

            const by = actorFrom(req.body);
            const now = new Date();
            const ticket = {
                ticketNumber: await nextTicketNumber(db),
                source: 'manual',
                restaurant: {
                    id: String(restaurant.id),
                    posVersion: restaurant.posVersion || 'v2',
                    name: restaurant.name,
                    phone: restaurant.phone || null,
                    whatsapp: restaurant.whatsapp || null,
                    province: restaurant.province || null,
                    logo: restaurant.logo || null,
                },
                category,
                priority,
                subject,
                description: description || '',
                attachments: Array.isArray(attachments)
                    ? attachments
                        .filter((a) => a && typeof a.url === 'string')
                        .map((a) => ({
                            url: a.url,
                            type: a.type === 'video' ? 'video' : 'image',
                            name: typeof a.name === 'string' ? a.name : '',
                        }))
                    : [],
                status: 'open',
                assignedTo: null,
                activity: [{ type: 'created', message: null, by, at: now }],
                createdBy: by,
                createdAt: now,
                updatedAt: now,
                resolvedAt: null,
            };

            const result = await db.collection('supportTickets').insertOne(ticket);
            res.status(201).json({ success: true, data: { ...ticket, _id: result.insertedId } });
        } catch (error) {
            console.error('[Support] Error creating ticket:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Change status. Body: { status, by: {userId, name} }
     */
    updateStatus: async (req, res, db) => {
        try {
            const { status } = req.body;
            if (!VALID_STATUSES.includes(status)) {
                return res.status(400).json({ success: false, error: 'invalid status' });
            }

            const _id = new ObjectId(req.params.id);
            const ticket = await db.collection('supportTickets').findOne({ _id });
            if (!ticket) {
                return res.status(404).json({ success: false, error: 'Ticket not found' });
            }
            if (ticket.status === status) {
                return res.json({ success: true, data: ticket });
            }

            const by = actorFrom(req.body);
            const now = new Date();
            const update = {
                $set: {
                    status,
                    updatedAt: now,
                    resolvedAt: status === 'resolved' ? now : null,
                },
                $push: {
                    activity: { type: 'status', from: ticket.status, to: status, by, at: now },
                },
            };

            await db.collection('supportTickets').updateOne({ _id }, update);
            const updated = await db.collection('supportTickets').findOne({ _id });
            res.json({ success: true, data: updated });
        } catch (error) {
            console.error('[Support] Error updating status:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Assign / unassign. Body: { assignedTo: {userId, name} | null, by }
     */
    assignTicket: async (req, res, db) => {
        try {
            const { assignedTo } = req.body;
            const _id = new ObjectId(req.params.id);
            const ticket = await db.collection('supportTickets').findOne({ _id });
            if (!ticket) {
                return res.status(404).json({ success: false, error: 'Ticket not found' });
            }

            const by = actorFrom(req.body);
            const now = new Date();
            await db.collection('supportTickets').updateOne({ _id }, {
                $set: { assignedTo: assignedTo || null, updatedAt: now },
                $push: {
                    activity: {
                        type: 'assign',
                        from: ticket.assignedTo?.name || null,
                        to: assignedTo?.name || null,
                        by,
                        at: now,
                    },
                },
            });
            const updated = await db.collection('supportTickets').findOne({ _id });
            res.json({ success: true, data: updated });
        } catch (error) {
            console.error('[Support] Error assigning ticket:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Add a free-text progress note. Body: { message, by }
     */
    addNote: async (req, res, db) => {
        try {
            const { message } = req.body;
            if (!message || !message.trim()) {
                return res.status(400).json({ success: false, error: 'message is required' });
            }

            const _id = new ObjectId(req.params.id);
            const by = actorFrom(req.body);
            const now = new Date();
            const result = await db.collection('supportTickets').updateOne({ _id }, {
                $set: { updatedAt: now },
                $push: { activity: { type: 'note', message: message.trim(), by, at: now } },
            });
            if (result.matchedCount === 0) {
                return res.status(404).json({ success: false, error: 'Ticket not found' });
            }
            const updated = await db.collection('supportTickets').findOne({ _id });
            res.json({ success: true, data: updated });
        } catch (error) {
            console.error('[Support] Error adding note:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // ==================== ATTACHMENTS ====================

    /**
     * Add attachments to an existing ticket. Body: { attachments: [...], by }
     */
    addAttachments: async (req, res, db) => {
        try {
            const { attachments } = req.body;
            const clean = (Array.isArray(attachments) ? attachments : [])
                .filter((a) => a && typeof a.url === 'string')
                .map((a) => ({
                    url: a.url,
                    type: a.type === 'video' ? 'video' : 'image',
                    name: typeof a.name === 'string' ? a.name : '',
                }));
            if (clean.length === 0) {
                return res.status(400).json({ success: false, error: 'attachments is required' });
            }

            const _id = new ObjectId(req.params.id);
            const by = actorFrom(req.body);
            const now = new Date();
            const result = await db.collection('supportTickets').updateOne({ _id }, {
                $set: { updatedAt: now },
                $push: {
                    attachments: { $each: clean },
                    activity: { type: 'note', message: `📎 ເພີ່ມໄຟລ໌ ${clean.length} ໄຟລ໌`, by, at: now },
                },
            });
            if (result.matchedCount === 0) {
                return res.status(404).json({ success: false, error: 'Ticket not found' });
            }
            const updated = await db.collection('supportTickets').findOne({ _id });
            res.json({ success: true, data: updated });
        } catch (error) {
            console.error('[Support] Error adding attachments:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Upload files (multer memory storage) to S3 and return attachment objects.
     */
    uploadAttachments: async (req, res) => {
        try {
            const data = await Promise.all(
                (req.files || []).map(async (f) => {
                    const { url } = await uploadSupportAttachment(f);
                    return {
                        url,
                        type: f.mimetype.startsWith('video/') ? 'video' : 'image',
                        name: f.originalname,
                    };
                })
            );
            res.json({ success: true, data });
        } catch (error) {
            console.error('[Support] Error uploading attachments:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // ==================== RESTAURANT SEARCH ====================

    /**
     * Search restaurants across POS v1 + v2 for the ticket-create picker.
     * Query: q (name/phone), limit
     */
    searchRestaurants: async (req, res) => {
        try {
            const { q = '', limit = 15 } = req.query;
            const result = await getUnifiedRestaurants({
                search: q,
                posVersion: 'both',
                limit: parseInt(limit),
            });

            const data = (result.data || []).map((r) => ({
                id: r.restaurantId,
                posVersion: r.posVersion,
                name: r.name,
                phone: r.phone || null,
                whatsapp: r.whatsapp || null,
                province: r.province || null,
                logo: r.logo || r.image || null,
            }));

            res.json({ success: true, data });
        } catch (error) {
            console.error('[Support] Error searching restaurants:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },
};

module.exports = supportController;
module.exports.nextTicketNumber = nextTicketNumber;
