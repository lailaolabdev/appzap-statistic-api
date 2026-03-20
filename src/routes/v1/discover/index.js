/**
 * Discover Routes (Live Events)
 *
 * Admin routes: events CRUD + publish/unpublish (proxied to Consumer API with x-admin-key)
 * Consumer routes: public events feed (no auth)
 */

const express = require('express');
const liveEventsController = require('../../../controllers/liveEventsController');

module.exports = (db) => {
    const router = express.Router();

    // ==================== CONSUMER ROUTES (/api/v1/discover/events) ====================

    // Get live events feed (no auth)
    router.get('/events', (req, res) =>
        liveEventsController.getLiveEvents(req, res));

    // ==================== ADMIN ROUTES (/api/v1/discover/events/admin) ====================

    // Create a new event
    router.post('/events/admin', (req, res) =>
        liveEventsController.createEvent(req, res));

    // Get all events (admin view, includes drafts)
    router.get('/events/admin', (req, res) =>
        liveEventsController.getEvents(req, res));

    // Update an event
    router.put('/events/admin/:id', (req, res) =>
        liveEventsController.updateEvent(req, res));

    // Publish / unpublish an event
    router.patch('/events/admin/:id/publish', (req, res) =>
        liveEventsController.publishEvent(req, res));

    // Delete an event
    router.delete('/events/admin/:id', (req, res) =>
        liveEventsController.deleteEvent(req, res));

    return router;
};
