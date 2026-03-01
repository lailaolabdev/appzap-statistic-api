/**
 * Support / Case Management Routes (TOR 3)
 */

const express = require('express');
const supportTicketController = require('../../../controllers/supportTicketController');

module.exports = (db) => {
    const router = express.Router();

    router.get('/tickets', (req, res) => supportTicketController.getTickets(req, res, db));
    router.get('/tickets/analytics', (req, res) => supportTicketController.getAnalytics(req, res, db));
    router.get('/tickets/:id', (req, res) => supportTicketController.getById(req, res, db));
    router.post('/tickets', (req, res) => supportTicketController.create(req, res, db));
    router.patch('/tickets/:id/status', (req, res) => supportTicketController.updateStatus(req, res, db));
    router.post('/tickets/:id/comments', (req, res) => supportTicketController.addComment(req, res, db));
    router.patch('/tickets/:id/hardware-tracking', (req, res) => supportTicketController.updateHardwareTracking(req, res, db));
    router.post('/tickets/:id/csat', (req, res) => supportTicketController.submitCsat(req, res, db));

    return router;
};
