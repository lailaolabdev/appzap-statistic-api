/**
 * Ads Management Routes
 *
 * Proxies ads CRUD + image upload to Consumer API (server-to-server).
 */

const express = require('express');
const adsManagementController = require('../../../controllers/adsManagementController');

module.exports = (db) => {
    const router = express.Router();

    // Upload images for ads (multipart/form-data)
    router.post('/upload', (req, res) =>
        adsManagementController.uploadImages(req, res));

    // Create a new ad
    router.post('/', (req, res) =>
        adsManagementController.createAd(req, res));

    // Get all ads (with optional filters: status, type, placement, skip, limit)
    router.get('/', (req, res) =>
        adsManagementController.getAds(req, res));

    // Get a single ad by ID
    router.get('/:id', (req, res) =>
        adsManagementController.getAdById(req, res));

    // Update an ad
    router.put('/:id', (req, res) =>
        adsManagementController.updateAd(req, res));

    // Delete an ad
    router.delete('/:id', (req, res) =>
        adsManagementController.deleteAd(req, res));

    return router;
};
