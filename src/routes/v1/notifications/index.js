/**
 * Notifications Routes
 *
 * Proxies admin push notification endpoints to the Consumer API (server-to-server).
 *
 * Admin:
 *   POST /admin/register                  — admin device, forwards Bearer token
 *   POST /admin/broadcast/dispatch        — targeted broadcast, uses NOTIFICATIONS_ADMIN_KEY
 */

const express = require('express');
const notificationsController = require('../../../controllers/notificationsController');

module.exports = (db) => {
    const router = express.Router();

    // Admin - Device Registration
    router.post('/admin/register', (req, res) =>
        notificationsController.registerAdminDevice(req, res));

    // Admin - Broadcast Dispatch
    router.post('/admin/broadcast/dispatch', (req, res) =>
        notificationsController.dispatchBroadcast(req, res));

    return router;
};
