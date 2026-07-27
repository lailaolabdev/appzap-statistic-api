/**
 * Support WhatsApp Inbound Controller (Phase 2)
 *
 * Receives Twilio WhatsApp webhooks, groups messages into tickets, and uses
 * Claude to classify + answer FAQ questions. Works without Claude configured:
 * every non-grouped message just becomes a ticket (source: "whatsapp").
 *
 * Reply goes back as TwiML in the webhook response — no outbound Twilio
 * credentials needed for replies.
 */

const { getUnifiedRestaurants } = require('../utils/multiDbConnection');
const { classifyMessage } = require('../utils/claudeSupport');
const { nextTicketNumber } = require('./supportController');

const OPEN_STATUSES = ['open', 'in_progress', 'waiting_restaurant'];
const WHATSAPP_ACTOR = { userId: null, name: 'ຮ້ານ (WhatsApp)' };

// Reply templates — editable from the dashboard, stored in supportSettings.
// {ticket} is replaced with the ticket number.
const DEFAULT_TEMPLATES = {
    greetingReply: 'ສະບາຍດີ 🙏 ນີ້ແມ່ນຊ່ອງທາງ support ຂອງ AppZap — ແຈ້ງບັນຫາ ຫຼື ສອບຖາມການໃຊ້ງານໄດ້ເລີຍເດີ',
    ticketCreatedReply: 'ຮັບເລື່ອງແລ້ວ ✅ ເລກຕິດຕາມ {ticket} — ທີມງານຈະຕິດຕໍ່ກັບໄປໄວໆນີ້ເດີ',
    followUpReply: 'ໄດ້ຮັບຂໍ້ຄວາມແລ້ວ ✅ ທີມງານກຳລັງຕິດຕາມເລື່ອງນີ້ຢູ່ (ເລກຕິດຕາມ {ticket})',
    aiStyle: '',
};

async function getTemplates(db) {
    try {
        const doc = await db.collection('supportSettings').findOne({ _id: 'templates' });
        const merged = { ...DEFAULT_TEMPLATES };
        for (const key of Object.keys(DEFAULT_TEMPLATES)) {
            if (doc?.[key]) merged[key] = doc[key];
        }
        return merged;
    } catch {
        return { ...DEFAULT_TEMPLATES };
    }
}

/** Last 8 digits — tolerant of +856 / 020 prefix differences */
function phoneKey(phone) {
    return String(phone || '').replace(/\D/g, '').slice(-8);
}

function escapeXml(s) {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function twiml(res, message) {
    const body = message ? `<Message>${escapeXml(message)}</Message>` : '';
    res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`);
}

/** Find the restaurant behind a phone number: ticket history first, then POS DBs */
async function resolveRestaurant(db, key) {
    if (!key) return null;

    // 1. Latest ticket whose stored phone/whatsapp matches (accumulated by Phase 1)
    const prev = await db.collection('supportTickets')
        .find({ $or: [{ 'restaurant.whatsapp': { $regex: `${key}$` } }, { 'restaurant.phone': { $regex: `${key}$` } }] })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();
    if (prev[0]) return prev[0].restaurant;

    // 2. POS v1 + v2 master data
    try {
        const result = await getUnifiedRestaurants({ search: key, posVersion: 'both', limit: 5 });
        const match = (result.data || []).find(
            (r) => phoneKey(r.whatsapp) === key || phoneKey(r.phone) === key,
        );
        if (match) {
            return {
                id: match.restaurantId,
                posVersion: match.posVersion,
                name: match.name,
                phone: match.phone || null,
                whatsapp: match.whatsapp || null,
                province: match.province || null,
                logo: match.logo || match.image || null,
            };
        }
    } catch (e) {
        console.error('[Support/Inbound] restaurant lookup failed:', e.message);
    }
    return null;
}

async function createInboundTicket(db, { restaurant, phone, category, priority, subject, text }) {
    const now = new Date();
    const ticket = {
        ticketNumber: await nextTicketNumber(db),
        source: 'whatsapp',
        restaurant: restaurant || {
            id: null,
            posVersion: null,
            name: `ຮ້ານບໍ່ລະບຸ (${phone})`,
            phone: null,
            whatsapp: phone,
            province: null,
            logo: null,
        },
        category,
        priority,
        subject,
        description: text,
        status: 'open',
        assignedTo: null,
        activity: [{ type: 'created', message: text, by: WHATSAPP_ACTOR, at: now }],
        createdBy: WHATSAPP_ACTOR,
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
    };
    // Keep the sender's number on the ticket so the WhatsApp button always works
    if (!ticket.restaurant.whatsapp) ticket.restaurant.whatsapp = phone;

    const result = await db.collection('supportTickets').insertOne(ticket);
    return { ...ticket, _id: result.insertedId };
}

const supportInboundController = {
    /**
     * Twilio WhatsApp webhook (application/x-www-form-urlencoded).
     * Body: From ("whatsapp:+8562055512345"), Body (text), ProfileName, MessageSid
     */
    handleWhatsappWebhook: async (req, res, db) => {
        try {
            const from = req.body?.From || '';
            const text = (req.body?.Body || '').trim();
            const phone = from.replace(/^whatsapp:/, '');
            const key = phoneKey(phone);

            if (!key) return twiml(res, null);
            if (!text) return twiml(res, null);

            const templates = await getTemplates(db);

            // 1. Open ticket for this number? → append as activity, no new ticket
            const open = await db.collection('supportTickets')
                .find({
                    status: { $in: OPEN_STATUSES },
                    $or: [
                        { 'restaurant.whatsapp': { $regex: `${key}$` } },
                        { 'restaurant.phone': { $regex: `${key}$` } },
                    ],
                })
                .sort({ createdAt: -1 })
                .limit(1)
                .toArray();

            if (open[0]) {
                await db.collection('supportTickets').updateOne(
                    { _id: open[0]._id },
                    {
                        $set: { updatedAt: new Date() },
                        $push: { activity: { type: 'note', message: text, by: WHATSAPP_ACTOR, at: new Date() } },
                    },
                );
                return twiml(res, templates.followUpReply.replace('{ticket}', open[0].ticketNumber));
            }

            // 2. New conversation → resolve restaurant + classify with Claude
            const restaurant = await resolveRestaurant(db, key);
            const faqs = await db.collection('supportFaqs')
                .find({ isActive: { $ne: false } })
                .sort({ createdAt: 1 })
                .toArray();

            const ai = await classifyMessage({
                text,
                restaurantName: restaurant?.name,
                faqs,
                style: templates.aiStyle,
            });

            // 3a. Greeting → polite reply, no ticket
            if (ai?.type === 'greeting') {
                return twiml(res, templates.greetingReply);
            }

            // 3b. Question answered confidently from FAQ → reply + log for review
            if (ai?.type === 'question' && ai.reply) {
                await db.collection('supportAiReplies').insertOne({
                    phone,
                    restaurant: restaurant || null,
                    message: text,
                    reply: ai.reply,
                    at: new Date(),
                });
                return twiml(res, ai.reply);
            }

            // 3c. Issue (or unanswerable question, or Claude unavailable) → ticket
            const ticket = await createInboundTicket(db, {
                restaurant,
                phone,
                category: ai?.category || (ai?.type === 'question' ? 'question' : 'other'),
                priority: ai?.priority || 'normal',
                subject: ai?.subject || text.slice(0, 80),
                text,
            });

            return twiml(res, templates.ticketCreatedReply.replace('{ticket}', ticket.ticketNumber));
        } catch (error) {
            console.error('[Support/Inbound] webhook error:', error);
            // Always answer Twilio with valid TwiML so it doesn't retry-spam
            return twiml(res, null);
        }
    },

    // ==================== FAQ KNOWLEDGE BASE ====================

    getFaqs: async (req, res, db) => {
        try {
            const faqs = await db.collection('supportFaqs').find({}).sort({ createdAt: 1 }).toArray();
            res.json({ success: true, data: faqs });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    createFaq: async (req, res, db) => {
        try {
            const { question, answer } = req.body;
            if (!question || !answer) {
                return res.status(400).json({ success: false, error: 'question and answer are required' });
            }
            const now = new Date();
            const faq = { question, answer, isActive: true, createdAt: now, updatedAt: now };
            const result = await db.collection('supportFaqs').insertOne(faq);
            res.status(201).json({ success: true, data: { ...faq, _id: result.insertedId } });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    updateFaq: async (req, res, db) => {
        try {
            const { ObjectId } = require('mongodb');
            const { question, answer, isActive } = req.body;
            const $set = { updatedAt: new Date() };
            if (question !== undefined) $set.question = question;
            if (answer !== undefined) $set.answer = answer;
            if (isActive !== undefined) $set.isActive = isActive;
            const result = await db.collection('supportFaqs').updateOne(
                { _id: new ObjectId(req.params.id) }, { $set },
            );
            if (result.matchedCount === 0) {
                return res.status(404).json({ success: false, error: 'FAQ not found' });
            }
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    deleteFaq: async (req, res, db) => {
        try {
            const { ObjectId } = require('mongodb');
            const result = await db.collection('supportFaqs').deleteOne({ _id: new ObjectId(req.params.id) });
            if (result.deletedCount === 0) {
                return res.status(404).json({ success: false, error: 'FAQ not found' });
            }
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // ==================== REPLY TEMPLATES ====================

    getSettings: async (req, res, db) => {
        try {
            const templates = await getTemplates(db);
            res.json({ success: true, data: templates });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    updateSettings: async (req, res, db) => {
        try {
            const $set = { updatedAt: new Date() };
            for (const key of Object.keys(DEFAULT_TEMPLATES)) {
                if (typeof req.body?.[key] === 'string') $set[key] = req.body[key];
            }
            await db.collection('supportSettings').updateOne(
                { _id: 'templates' }, { $set }, { upsert: true },
            );
            res.json({ success: true, data: await getTemplates(db) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /** AI answers sent to restaurants — for quality review */
    getAiReplies: async (req, res, db) => {
        try {
            const replies = await db.collection('supportAiReplies')
                .find({}).sort({ at: -1 }).limit(parseInt(req.query.limit) || 100).toArray();
            res.json({ success: true, data: replies });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },
};

module.exports = supportInboundController;
