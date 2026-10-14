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

// Dev-board workflow. "open" (Backlog) and "resolved" (Done) keep their original
// stored values so existing tickets and the WhatsApp intake need no migration.
const OPEN_STATUSES = ['open', 'todo', 'in_progress', 'review', 'waiting_restaurant'];
const VALID_STATUSES = [...OPEN_STATUSES, 'resolved'];
const VALID_PRIORITIES = ['urgent', 'high', 'normal', 'low'];
const VALID_CATEGORIES = ['hardware', 'software', 'billing', 'network', 'question', 'other'];
// Tickets created before the dev board have no type: they are support tickets.
const VALID_TYPES = ['support', 'bug', 'feature', 'task'];
const VALID_PROJECTS = [
    'pos_web', 'pos_api', 'pos_app', 'dashboard', 'owner_web',
    'consumer_app', 'consumer_api', 'mobile_order', 'statistic_api', 'other',
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today as YYYY-MM-DD in Laos time (dates are stored as plain date strings) */
function todayLao(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Vientiane' }).format(now);
}

/**
 * Validate the editable dev-board fields of a create/update body.
 * Returns { fields, error } where fields holds only the keys present in body.
 */
function pickTaskFields(body = {}) {
    const fields = {};
    if ('type' in body) {
        if (!VALID_TYPES.includes(body.type)) return { error: 'invalid type' };
        fields.type = body.type;
    }
    if ('project' in body) {
        if (body.project !== null && !VALID_PROJECTS.includes(body.project)) return { error: 'invalid project' };
        fields.project = body.project || null;
    }
    if ('priority' in body) {
        if (!VALID_PRIORITIES.includes(body.priority)) return { error: 'invalid priority' };
        fields.priority = body.priority;
    }
    if ('category' in body) {
        if (body.category !== null && !VALID_CATEGORIES.includes(body.category)) return { error: 'invalid category' };
        fields.category = body.category || null;
    }
    for (const key of ['startDate', 'dueDate']) {
        if (key in body) {
            if (body[key] && !DATE_RE.test(body[key])) return { error: `invalid ${key}` };
            fields[key] = body[key] || null;
        }
    }
    if ('estimateHours' in body) {
        const raw = body.estimateHours;
        const n = raw === null || raw === '' ? null : Number(raw);
        if (n !== null && (!Number.isFinite(n) || n < 0 || n > 1000)) return { error: 'invalid estimateHours' };
        fields.estimateHours = n;
    }
    if ('subject' in body) {
        if (!String(body.subject || '').trim()) return { error: 'subject is required' };
        fields.subject = String(body.subject).trim();
    }
    if ('description' in body) fields.description = String(body.description || '');
    return { fields };
}

/** Field-level diff for the activity log, skipping unchanged values */
function diffTask(ticket, fields) {
    return Object.entries(fields)
        .filter(([k, v]) => (ticket[k] ?? null) !== (v ?? null))
        .map(([field, to]) => ({ field, from: ticket[field] ?? null, to: to ?? null }));
}

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

/**
 * Ranks for a manual reorder: the listed tickets reuse their own existing rank slots in
 * the new order, so tickets hidden by the dashboard's filters keep their place; tickets
 * with no rank get new slots after maxRank. Returns { [id]: rank }.
 * Mirrors rankSlots in appzap_v2_dashboard app/utils/devBoard.js (its optimistic update).
 */
function rankSlots(ordered, maxRank = 0) {
    const slots = ordered.map((t) => t.rank).filter((r) => typeof r === 'number').sort((a, b) => a - b);
    let next = Math.max(maxRank, slots.length ? slots[slots.length - 1] : 0);
    while (slots.length < ordered.length) {
        next += 1000;
        slots.push(next);
    }
    return Object.fromEntries(ordered.map((t, i) => [t._id, slots[i]]));
}

const supportController = {
    // ==================== TICKETS ====================

    /**
     * List tickets. Urgent tickets float to the top, then newest first.
     * Query: status, category, priority, type, project, assignedTo (userId or
     *        "none"), restaurantId, search, page, limit
     */
    getTickets: async (req, res, db) => {
        try {
            const {
                status, category, priority, type, project, assignedTo, restaurantId, search,
                page = 1, limit = 50,
            } = req.query;

            const query = {};
            if (status && status !== 'all') query.status = status;
            if (category && category !== 'all') query.category = category;
            if (priority && priority !== 'all') query.priority = priority;
            if (type && type !== 'all') query.type = type === 'support' ? { $in: ['support', null] } : type;
            if (project && project !== 'all') query.project = project;
            if (assignedTo === 'none') query['assignedTo.userId'] = null;
            else if (assignedTo) query['assignedTo.userId'] = assignedTo;
            if (restaurantId) query['restaurant.id'] = restaurantId;
            if (search) {
                // Literal match: titles use "[Feature name]" prefixes, which are regex syntax
                const pattern = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                query.$or = [
                    { ticketNumber: { $regex: pattern, $options: 'i' } },
                    { subject: { $regex: pattern, $options: 'i' } },
                    { 'restaurant.name': { $regex: pattern, $options: 'i' } },
                ];
            }

            const pageSize = Math.min(parseInt(limit) || 50, 1000);
            const skip = (parseInt(page) - 1) * pageSize;

            const [tickets, total] = await Promise.all([
                db.collection('supportTickets').aggregate([
                    { $match: query },
                    {
                        $addFields: {
                            priorityRank: { $indexOfArray: [VALID_PRIORITIES, '$priority'] },
                            statusRank: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] },
                        },
                    },
                    { $sort: { statusRank: 1, priorityRank: 1, createdAt: -1 } },
                    { $skip: skip },
                    { $limit: pageSize },
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
            const [urgentOpen, totalOpen, over24h, resolvedThisWeek, avgAgg, overdue, openBugs, untriagedSupport24h] = await Promise.all([
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
                col.countDocuments({ status: { $in: OPEN_STATUSES }, dueDate: { $ne: null, $lt: todayLao(now) } }),
                col.countDocuments({ status: { $in: OPEN_STATUSES }, type: 'bug' }),
                // Team rule: a restaurant's support ticket must leave "New / Backlog" within 24h
                col.countDocuments({ status: 'open', type: { $in: ['support', null] }, createdAt: { $lt: dayAgo } }),
            ]);

            res.json({
                success: true,
                data: {
                    urgentOpen,
                    totalOpen,
                    over24h,
                    resolvedThisWeek,
                    avgResolutionMinutes: avgAgg[0]?.avgMinutes || 0,
                    overdue,
                    openBugs,
                    untriagedSupport24h,
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
     * Create a ticket (manual intake) or a dev task.
     * Body: { type, restaurant: {id, posVersion, name, phone, whatsapp, province} | null,
     *         category, priority, project, subject, description, startDate, dueDate,
     *         estimateHours, assignedTo: {userId, name, role} | null, by: {userId, name} }
     * Restaurant and category are required only for support tickets.
     */
    createTicket: async (req, res, db) => {
        try {
            const { restaurant, attachments, assignedTo } = req.body;
            const { fields, error } = pickTaskFields({
                type: 'support', priority: 'normal', project: null, category: null,
                startDate: null, dueDate: null, estimateHours: null, description: '',
                ...req.body,
                subject: req.body.subject ?? '',
            });
            if (error) return res.status(400).json({ success: false, error });

            const hasRestaurant = Boolean(restaurant?.id && restaurant?.name);
            if (fields.type === 'support' && !hasRestaurant) {
                return res.status(400).json({ success: false, error: 'restaurant is required' });
            }
            if (fields.type === 'support' && !fields.category) {
                return res.status(400).json({ success: false, error: 'invalid category' });
            }
            if (fields.startDate && fields.dueDate && fields.startDate > fields.dueDate) {
                return res.status(400).json({ success: false, error: 'startDate must be before dueDate' });
            }

            const by = actorFrom(req.body);
            const now = new Date();
            const assignee = assignedTo?.name
                ? { userId: assignedTo.userId || null, name: assignedTo.name, role: assignedTo.role || null }
                : null;
            const activity = [{ type: 'created', message: null, by, at: now }];
            if (assignee) activity.push({ type: 'assign', from: null, to: assignee.name, by, at: now });

            const ticket = {
                ticketNumber: await nextTicketNumber(db),
                source: 'manual',
                ...fields,
                restaurant: hasRestaurant ? {
                    id: String(restaurant.id),
                    posVersion: restaurant.posVersion || 'v2',
                    name: restaurant.name,
                    phone: restaurant.phone || null,
                    whatsapp: restaurant.whatsapp || null,
                    province: restaurant.province || null,
                    logo: restaurant.logo || null,
                } : null,
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
                assignedTo: assignee,
                activity,
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
     * Edit dev-board fields (type, project, priority, category, dates, estimate,
     * subject, description). Each changed field is logged in the activity.
     * Body: { ...fields, by }
     */
    updateTicket: async (req, res, db) => {
        try {
            const { fields, error } = pickTaskFields(req.body);
            if (error) return res.status(400).json({ success: false, error });

            const _id = new ObjectId(req.params.id);
            const ticket = await db.collection('supportTickets').findOne({ _id });
            if (!ticket) {
                return res.status(404).json({ success: false, error: 'Ticket not found' });
            }
            const startDate = 'startDate' in fields ? fields.startDate : ticket.startDate;
            const dueDate = 'dueDate' in fields ? fields.dueDate : ticket.dueDate;
            if (startDate && dueDate && startDate > dueDate) {
                return res.status(400).json({ success: false, error: 'startDate must be before dueDate' });
            }

            const changes = diffTask({ type: 'support', ...ticket }, fields);
            if (changes.length === 0) return res.json({ success: true, data: ticket });

            const by = actorFrom(req.body);
            const now = new Date();
            await db.collection('supportTickets').updateOne({ _id }, {
                $set: { ...fields, updatedAt: now },
                $push: { activity: { type: 'update', changes, by, at: now } },
            });
            const updated = await db.collection('supportTickets').findOne({ _id });
            res.json({ success: true, data: updated });
        } catch (error) {
            console.error('[Support] Error updating ticket:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Save a manual order (dragging rows in the Table). Body: { ids: [ticketId, ...] in
     * the new order, by }. Only the listed tickets change; see rankSlots.
     */
    reorderTickets: async (req, res, db) => {
        try {
            const { ids } = req.body;
            if (!Array.isArray(ids) || ids.length === 0 || ids.length > 1000
                || !ids.every((id) => typeof id === 'string' && ObjectId.isValid(id))
                || new Set(ids).size !== ids.length) {
                return res.status(400).json({ success: false, error: 'ids must be a list of unique ticket ids' });
            }

            const col = db.collection('supportTickets');
            const docs = await col
                .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } }, { projection: { rank: 1 } })
                .toArray();
            if (docs.length !== ids.length) {
                return res.status(404).json({ success: false, error: 'Ticket not found' });
            }
            const rankById = Object.fromEntries(docs.map((d) => [String(d._id), d.rank]));
            const [top] = await col
                .find({ rank: { $type: 'number' } }, { projection: { rank: 1 } })
                .sort({ rank: -1 })
                .limit(1)
                .toArray();

            const slots = rankSlots(ids.map((id) => ({ _id: id, rank: rankById[id] })), top?.rank ?? 0);
            await col.bulkWrite(ids.map((id) => ({
                updateOne: { filter: { _id: new ObjectId(id) }, update: { $set: { rank: slots[id] } } },
            })));
            res.json({ success: true, data: ids.map((id) => ({ _id: id, rank: slots[id] })) });
        } catch (error) {
            console.error('[Support] Error reordering tickets:', error);
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
module.exports.pickTaskFields = pickTaskFields;
module.exports.diffTask = diffTask;
module.exports.rankSlots = rankSlots;
module.exports.OPEN_STATUSES = OPEN_STATUSES;
