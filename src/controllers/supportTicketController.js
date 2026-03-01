/**
 * Support Ticket Controller (TOR 3 - Case Management)
 */

const { ObjectId } = require('mongodb');

async function generateTicketNumber(db) {
    const now = new Date();
    const prefix = `TKT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
    const last = await db.collection('supportTickets')
        .find({ ticketNumber: { $regex: `^${prefix}` } })
        .sort({ ticketNumber: -1 })
        .limit(1)
        .toArray();
    const nextNum = last.length ? parseInt(last[0].ticketNumber.split('-')[2]) + 1 : 1;
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

const supportTicketController = {
    getTickets: async (req, res, db) => {
        try {
            const { status, category, priority, restaurantId, limit = 50, skip = 0 } = req.query;
            const query = {};
            if (status) query.status = status;
            if (category) query.category = category;
            if (priority) query.priority = priority;
            if (restaurantId) query.restaurantId = restaurantId;

            const [tickets, total] = await Promise.all([
                db.collection('supportTickets').find(query).sort({ createdAt: -1 })
                    .skip(parseInt(skip)).limit(parseInt(limit)).toArray(),
                db.collection('supportTickets').countDocuments(query),
            ]);

            res.json({ success: true, data: tickets, pagination: { total, limit: parseInt(limit), skip: parseInt(skip) } });
        } catch (error) {
            console.error('[SupportTicket] Error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    getById: async (req, res, db) => {
        try {
            const ticket = await db.collection('supportTickets').findOne({ _id: new ObjectId(req.params.id) });
            if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });
            res.json({ success: true, data: ticket });
        } catch (error) {
            console.error('[SupportTicket] Error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    create: async (req, res, db) => {
        try {
            const {
                restaurantId, posVersion, restaurantName, contactPhone, contactEmail,
                category, subcategory, priority, subject, description,
                hardwareTrackingNumber, hardwareCarrier,
            } = req.body;

            if (!restaurantId || !category || !subject || !description) {
                return res.status(400).json({ success: false, error: 'restaurantId, category, subject, description required' });
            }

            const ticketNumber = await generateTicketNumber(db);
            const ticket = {
                ticketNumber,
                restaurantId,
                posVersion: posVersion || 'v1',
                restaurantName: restaurantName || '',
                contactPhone: contactPhone || '',
                contactEmail: contactEmail || '',
                category,
                subcategory: subcategory || '',
                priority: priority || 'medium',
                subject,
                description,
                hardwareClaim: (category === 'hardware' && hardwareTrackingNumber) ? {
                    trackingNumber: hardwareTrackingNumber,
                    carrier: hardwareCarrier || '',
                    shippedAt: null,
                    estimatedDelivery: null,
                } : null,
                status: 'open',
                assignedTo: null,
                assignedToName: null,
                assignedAt: null,
                resolvedAt: null,
                resolution: null,
                closedAt: null,
                csatScore: null,
                csatFeedback: null,
                attachments: [],
                comments: [],
                createdBy: req.user?.id || 'system',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const result = await db.collection('supportTickets').insertOne(ticket);
            ticket._id = result.insertedId;

            res.status(201).json({ success: true, data: ticket });
        } catch (error) {
            console.error('[SupportTicket] Error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    updateStatus: async (req, res, db) => {
        try {
            const { id } = req.params;
            const { status, resolution, assignedTo, assignedToName } = req.body;

            const updates = { updatedAt: new Date() };
            if (status) {
                updates.status = status;
                if (status === 'resolved' || status === 'closed') {
                    updates.resolvedAt = new Date();
                    updates.resolution = resolution || updates.resolution;
                    updates.resolvedBy = req.user?.id || 'system';
                }
                if (status === 'closed') updates.closedAt = new Date();
            }
            if (assignedTo !== undefined) {
                updates.assignedTo = assignedTo;
                updates.assignedToName = assignedToName || null;
                updates.assignedAt = assignedTo ? new Date() : null;
            }

            const result = await db.collection('supportTickets').updateOne(
                { _id: new ObjectId(id) },
                { $set: updates }
            );

            if (result.matchedCount === 0) return res.status(404).json({ success: false, error: 'Ticket not found' });

            const ticket = await db.collection('supportTickets').findOne({ _id: new ObjectId(id) });
            res.json({ success: true, data: ticket });
        } catch (error) {
            console.error('[SupportTicket] Error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    addComment: async (req, res, db) => {
        try {
            const { id } = req.params;
            const { content, isInternal } = req.body;

            const comment = {
                authorId: req.user?.id || 'system',
                authorName: req.user?.name || 'Admin',
                content,
                isInternal: isInternal || false,
                createdAt: new Date(),
            };

            const result = await db.collection('supportTickets').updateOne(
                { _id: new ObjectId(id) },
                { $push: { comments: comment }, $set: { updatedAt: new Date() } }
            );

            if (result.matchedCount === 0) return res.status(404).json({ success: false, error: 'Ticket not found' });

            const ticket = await db.collection('supportTickets').findOne({ _id: new ObjectId(id) });
            res.json({ success: true, data: ticket });
        } catch (error) {
            console.error('[SupportTicket] Error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    updateHardwareTracking: async (req, res, db) => {
        try {
            const { id } = req.params;
            const { trackingNumber, carrier, shippedAt, estimatedDelivery } = req.body;

            const result = await db.collection('supportTickets').updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        'hardwareClaim.trackingNumber': trackingNumber,
                        'hardwareClaim.carrier': carrier,
                        'hardwareClaim.shippedAt': shippedAt ? new Date(shippedAt) : null,
                        'hardwareClaim.estimatedDelivery': estimatedDelivery ? new Date(estimatedDelivery) : null,
                        updatedAt: new Date(),
                    }
                }
            );

            if (result.matchedCount === 0) return res.status(404).json({ success: false, error: 'Ticket not found' });

            const ticket = await db.collection('supportTickets').findOne({ _id: new ObjectId(id) });
            res.json({ success: true, data: ticket });
        } catch (error) {
            console.error('[SupportTicket] Error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    submitCsat: async (req, res, db) => {
        try {
            const { id } = req.params;
            const { csatScore, csatFeedback } = req.body;

            const result = await db.collection('supportTickets').updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        csatScore: parseInt(csatScore),
                        csatFeedback: csatFeedback || '',
                        csatSentAt: new Date(),
                        updatedAt: new Date(),
                    }
                }
            );

            if (result.matchedCount === 0) return res.status(404).json({ success: false, error: 'Ticket not found' });

            res.json({ success: true, message: 'CSAT submitted' });
        } catch (error) {
            console.error('[SupportTicket] Error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    getAnalytics: async (req, res, db) => {
        try {
            const { startDate, endDate } = req.query;
            const match = {};
            if (startDate || endDate) {
                match.createdAt = {};
                if (startDate) match.createdAt.$gte = new Date(startDate);
                if (endDate) match.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
            }

            const [byCategory, byStatus, resolutionTime] = await Promise.all([
                db.collection('supportTickets').aggregate([
                    { $match: match },
                    { $group: { _id: '$category', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                ]).toArray(),
                db.collection('supportTickets').aggregate([
                    { $match: match },
                    { $group: { _id: '$status', count: { $sum: 1 } } },
                ]).toArray(),
                db.collection('supportTickets').aggregate([
                    { $match: { ...match, resolvedAt: { $ne: null } } },
                    {
                        $project: {
                            resolutionMinutes: {
                                $divide: [
                                    { $subtract: ['$resolvedAt', '$createdAt'] },
                                    60000
                                ]
                            }
                        }
                    },
                    { $group: { _id: null, avgMinutes: { $avg: '$resolutionMinutes' } } },
                ]).toArray(),
            ]);

            res.json({
                success: true,
                data: {
                    byCategory,
                    byStatus: byStatus.reduce((o, s) => { o[s._id] = s.count; return o; }, {}),
                    averageResolutionTimeMinutes: resolutionTime[0]?.avgMinutes || 0,
                },
            });
        } catch (error) {
            console.error('[SupportTicket] Error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },
};

module.exports = supportTicketController;
