/**
 * Subscription Management Routes
 * 
 * Routes for subscription tracking, invoices, devices, and WhatsApp broadcasts.
 */

const express = require('express');

const subscriptionController = require('../../../controllers/subscriptionController');
const subscriptionPackageController = require('../../../controllers/subscriptionPackageController');
const invoiceController = require('../../../controllers/invoiceController');
const deviceController = require('../../../controllers/deviceController');
const whatsappController = require('../../../controllers/whatsappController');
const excelImportController = require('../../../controllers/excelImportController');
const promotionController = require('../../../controllers/promotionController');

module.exports = (db) => {
    const router = express.Router();

    // ==================== SUBSCRIPTION PACKAGE ROUTES ====================

    // Get all subscription packages
    router.get('/packages', (req, res) =>
        subscriptionPackageController.getPackages(req, res));

    // Get single subscription package
    router.get('/packages/:id', (req, res) =>
        subscriptionPackageController.getPackageById(req, res));

    // Create subscription package
    router.post('/packages', (req, res) =>
        subscriptionPackageController.createPackage(req, res));

    // Update subscription package
    router.put('/packages/:id', (req, res) =>
        subscriptionPackageController.updatePackage(req, res));

    // Delete subscription package
    router.delete('/packages/:id', (req, res) =>
        subscriptionPackageController.deletePackage(req, res));

    // Toggle subscription package status
    router.patch('/packages/:id/toggle', (req, res) =>
        subscriptionPackageController.togglePackageStatus(req, res));

    // ==================== SUBSCRIPTION ROUTES ====================

    // Get unified restaurant list (from both POS v1 and v2)
    router.get('/restaurants', (req, res) =>
        subscriptionController.getUnifiedRestaurants(req, res, db));

    // Get subscription expiry statistics
    router.get('/expiry-stats', (req, res) =>
        subscriptionController.getExpiryStats(req, res, db));

    // Get single restaurant detail
    router.get('/restaurants/:restaurantId/:posVersion', (req, res) =>
        subscriptionController.getRestaurantDetail(req, res, db));

    // Update subscription for a restaurant
    router.put('/restaurants/:restaurantId/:posVersion', (req, res) =>
        subscriptionController.updateSubscription(req, res, db));

    // Bulk update from Excel data
    router.post('/bulk-update', (req, res) =>
        subscriptionController.bulkUpdateFromExcel(req, res, db));

    // ==================== INVOICE ROUTES ====================

    // Get all invoices
    router.get('/invoices', (req, res) =>
        invoiceController.getInvoices(req, res, db));

    // Get subscription packages (for invoice creation)
    router.get('/invoices/packages', (req, res) =>
        invoiceController.getSubscriptionPackages(req, res, db));

    // Get single invoice
    router.get('/invoices/:id', (req, res) =>
        invoiceController.getInvoiceById(req, res, db));

    // Get invoice PDF data
    router.get('/invoices/:id/pdf-data', (req, res) =>
        invoiceController.getInvoicePdfData(req, res, db));

    // Create invoice
    router.post('/invoices', (req, res) =>
        invoiceController.createInvoice(req, res, db));

    // Update invoice
    router.put('/invoices/:id', (req, res) =>
        invoiceController.updateInvoice(req, res, db));

    // Update payment status
    router.patch('/invoices/:id/payment', (req, res) =>
        invoiceController.updatePaymentStatus(req, res, db));

    // Delete invoice
    router.delete('/invoices/:id', (req, res) =>
        invoiceController.deleteInvoice(req, res, db));

    // ==================== DEVICE ROUTES ====================

    // Get all devices
    router.get('/devices', (req, res) =>
        deviceController.getDevices(req, res, db));

    // Get device types
    router.get('/devices/types', (req, res) =>
        deviceController.getDeviceTypes(req, res, db));

    // Get available devices (for invoice selection)
    router.get('/devices/available', (req, res) =>
        deviceController.getAvailableDevices(req, res, db));

    // Get single device
    router.get('/devices/:id', (req, res) =>
        deviceController.getDeviceById(req, res, db));

    // Create device
    router.post('/devices', (req, res) =>
        deviceController.createDevice(req, res, db));

    // Update device
    router.put('/devices/:id', (req, res) =>
        deviceController.updateDevice(req, res, db));

    // Assign device to restaurant
    router.post('/devices/:id/assign', (req, res) =>
        deviceController.assignDevice(req, res, db));

    // Return device
    router.post('/devices/:id/return', (req, res) =>
        deviceController.returnDevice(req, res, db));

    // Delete device
    router.delete('/devices/:id', (req, res) =>
        deviceController.deleteDevice(req, res, db));

    // ==================== WHATSAPP ROUTES ====================

    // Get template categories
    router.get('/whatsapp/categories', (req, res) =>
        whatsappController.getCategories(req, res, db));

    // Get all templates
    router.get('/whatsapp/templates', (req, res) =>
        whatsappController.getTemplates(req, res, db));

    // Get single template
    router.get('/whatsapp/templates/:id', (req, res) =>
        whatsappController.getTemplateById(req, res, db));

    // Create template
    router.post('/whatsapp/templates', (req, res) =>
        whatsappController.createTemplate(req, res, db));

    // Update template
    router.put('/whatsapp/templates/:id', (req, res) =>
        whatsappController.updateTemplate(req, res, db));

    // Delete template
    router.delete('/whatsapp/templates/:id', (req, res) =>
        whatsappController.deleteTemplate(req, res, db));

    // Preview recipients
    router.get('/whatsapp/preview-recipients', (req, res) =>
        whatsappController.previewRecipients(req, res, db));

    // Get all broadcasts
    router.get('/whatsapp/broadcasts', (req, res) =>
        whatsappController.getBroadcasts(req, res, db));

    // Get single broadcast
    router.get('/whatsapp/broadcasts/:id', (req, res) =>
        whatsappController.getBroadcastById(req, res, db));

    // Create broadcast
    router.post('/whatsapp/broadcasts', (req, res) =>
        whatsappController.createBroadcast(req, res, db));

    // Send/resume broadcast
    router.post('/whatsapp/broadcasts/:id/send', (req, res) =>
        whatsappController.sendBroadcast(req, res, db));

    // Cancel broadcast
    router.post('/whatsapp/broadcasts/:id/cancel', (req, res) =>
        whatsappController.cancelBroadcast(req, res, db));

    // Test send
    router.post('/whatsapp/test', (req, res) =>
        whatsappController.testSend(req, res, db));

    // ==================== PROMOTION ROUTES ====================

    // List promotions from POS v2
    router.get('/promotions', (req, res) =>
        promotionController.getPromotions(req, res));

    // Get single promotion
    router.get('/promotions/:id', (req, res) =>
        promotionController.getPromotionById(req, res));

    // Create promotion for a restaurant
    router.post('/promotions', (req, res) =>
        promotionController.createPromotion(req, res));

    // Update promotion
    router.put('/promotions/:id', (req, res) =>
        promotionController.updatePromotion(req, res));

    // Delete promotion
    router.delete('/promotions/:id', (req, res) =>
        promotionController.deletePromotion(req, res));

    // ==================== EXCEL IMPORT ROUTES ====================

    // Get sample template
    router.get('/import/template', (req, res) =>
        excelImportController.getSampleTemplate(req, res, db));

    // Parse uploaded Excel file
    router.post('/import/parse',
        excelImportController.uploadMiddleware,
        (req, res) => excelImportController.parseExcel(req, res, db));

    // Validate and match restaurants
    router.post('/import/validate', (req, res) =>
        excelImportController.validateAndMatch(req, res, db));

    // Execute import
    router.post('/import/execute', (req, res) =>
        excelImportController.executeImport(req, res, db));

    return router;
};
