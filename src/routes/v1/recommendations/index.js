/**
 * Recommendations Routes
 *
 * Proxies admin pinned-restaurant recommendation endpoints to the Consumer API.
 *
 *   GET    /recommendations        — list (page, limit, isActive filters)
 *   POST   /recommendations        — create
 *   PUT    /recommendations/:id    — update
 *   DELETE /recommendations/:id    — delete
 */

const express = require('express');
const recommendationsController = require('../../../controllers/recommendationsController');

module.exports = (db) => {
    const router = express.Router();

    router.get('/', (req, res) => recommendationsController.getRecommendations(req, res));
    router.post('/', (req, res) => recommendationsController.createRecommendation(req, res));
    router.put('/:id', (req, res) => recommendationsController.updateRecommendation(req, res));
    router.delete('/:id', (req, res) => recommendationsController.deleteRecommendation(req, res));

    return router;
};
