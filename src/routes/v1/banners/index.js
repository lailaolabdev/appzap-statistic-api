/**
 * Banner Management Routes
 *
 * Admin routes: CRUD + upload (proxied to Consumer API with x-admin-key)
 * Consumer routes: placement lookup + impression/click tracking (no auth)
 */

const express = require('express');
const bannerManagementController = require('../../../controllers/bannerManagementController');

module.exports = (db) => {
    const admin = express.Router();
    const consumer = express.Router();

    // ==================== ADMIN ROUTES (/api/v1/banner-management) ====================

    // Upload banner images (multipart/form-data)
    admin.post('/upload', (req, res) =>
        bannerManagementController.uploadImages(req, res));

    // Create a new banner
    admin.post('/', (req, res) =>
        bannerManagementController.createBanner(req, res));

    // Get all banners (with optional filters: status, placement, skip, limit)
    admin.get('/', (req, res) =>
        bannerManagementController.getBanners(req, res));

    // Get a single banner by ID
    admin.get('/:id', (req, res) =>
        bannerManagementController.getBannerById(req, res));

    // Update a banner
    admin.put('/:id', (req, res) =>
        bannerManagementController.updateBanner(req, res));

    // Delete a banner
    admin.delete('/:id', (req, res) =>
        bannerManagementController.deleteBanner(req, res));

    // ==================== CONSUMER ROUTES (/api/v1/banners) ====================

    // Get banners by placement (no auth)
    consumer.get('/placement/:placement', (req, res) =>
        bannerManagementController.getBannersByPlacement(req, res));

    // Track banner impression (no auth)
    consumer.post('/:id/impression', (req, res) =>
        bannerManagementController.trackImpression(req, res));

    // Track banner click (no auth)
    consumer.post('/:id/click', (req, res) =>
        bannerManagementController.trackClick(req, res));

    return { admin, consumer };
};
