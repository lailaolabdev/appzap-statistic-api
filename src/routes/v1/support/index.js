/**
 * Support / Case Management Routes
 *
 * Support tickets for restaurant issues, logged by the support team.
 */

const express = require('express');
const multer = require('multer');

const supportController = require('../../../controllers/supportController');
const supportInboundController = require('../../../controllers/supportInboundController');

// Ticket attachments (images/videos) buffered in memory, then uploaded to S3
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024, files: 5 },
    fileFilter: (req, file, cb) => cb(null, /^(image|video)\//.test(file.mimetype)),
});

module.exports = (db) => {
    const router = express.Router();

    // Attachment upload (multipart field: "files", max 5, images/videos only)
    router.post('/upload', upload.array('files', 5), (req, res) =>
        supportController.uploadAttachments(req, res));

    // Twilio WhatsApp inbound webhook (form-encoded, replies with TwiML)
    router.post('/whatsapp-webhook', express.urlencoded({ extended: false }), (req, res) =>
        supportInboundController.handleWhatsappWebhook(req, res, db));

    // FAQ knowledge base (feeds the Claude classifier)
    router.get('/faqs', (req, res) => supportInboundController.getFaqs(req, res, db));
    router.post('/faqs', (req, res) => supportInboundController.createFaq(req, res, db));
    router.patch('/faqs/:id', (req, res) => supportInboundController.updateFaq(req, res, db));
    router.delete('/faqs/:id', (req, res) => supportInboundController.deleteFaq(req, res, db));

    // AI replies log (quality review)
    router.get('/ai-replies', (req, res) => supportInboundController.getAiReplies(req, res, db));

    // Reply templates (greeting / ticket ack / follow-up / AI style)
    router.get('/settings', (req, res) => supportInboundController.getSettings(req, res, db));
    router.put('/settings', (req, res) => supportInboundController.updateSettings(req, res, db));

    // Restaurant picker (search across POS v1 + v2)
    router.get('/restaurants/search', (req, res) =>
        supportController.searchRestaurants(req, res));

    // Summary for stat cards (must be registered before /tickets/:id)
    router.get('/tickets/analytics', (req, res) =>
        supportController.getSummary(req, res, db));

    // Tickets
    router.get('/tickets', (req, res) =>
        supportController.getTickets(req, res, db));
    router.get('/tickets/:id', (req, res) =>
        supportController.getTicketById(req, res, db));
    router.post('/tickets', (req, res) =>
        supportController.createTicket(req, res, db));
    router.patch('/tickets/:id/status', (req, res) =>
        supportController.updateStatus(req, res, db));
    router.patch('/tickets/:id/assign', (req, res) =>
        supportController.assignTicket(req, res, db));
    router.post('/tickets/:id/notes', (req, res) =>
        supportController.addNote(req, res, db));
    router.post('/tickets/:id/attachments', (req, res) =>
        supportController.addAttachments(req, res, db));

    return router;
};
