/**
 * Master Data Routes
 * 
 * API routes for all master data management.
 */

const express = require('express');
const {
    masterCategoryController,
    masterMenuController,
    masterIngredientCategoryController,
    masterIngredientController,
    masterRecipeCategoryController,
    masterRecipeController,
    masterRestaurantCategoryController,
    mappingController,
    analyticsController,
    reviewController,
    orderBasedMappingController
} = require('../../../controllers/master');
const analyticsBuilderController = require('../../../controllers/analytics/analyticsBuilderController');
const indexManagementController = require('../../../controllers/admin/indexManagementController');
const { getPosV1Db } = require('../../../utils/multiDbConnection');

module.exports = (db) => {
    const router = express.Router();
    const posV1Db = getPosV1Db();

    // ============================================
    // MASTER CATEGORIES
    // ============================================

    // Create master category
    router.post('/categories', (req, res) =>
        masterCategoryController.create(req, res, posV1Db));

    // Bulk create master categories
    router.post('/categories/bulk', (req, res) =>
        masterCategoryController.bulkCreate(req, res, posV1Db));

    // Find matching categories (for auto-suggestion)
    router.get('/categories/match', (req, res) =>
        masterCategoryController.findMatches(req, res, posV1Db));

    // Get all master categories
    router.get('/categories', (req, res) =>
        masterCategoryController.getAll(req, res, posV1Db));

    // Get category statistics (linked menus count)
    router.get('/categories/:code/stats', (req, res) =>
        masterCategoryController.getStats(req, res, posV1Db));

    // Get single master category
    router.get('/categories/:code', (req, res) =>
        masterCategoryController.getByCode(req, res, posV1Db));

    // Update master category
    router.put('/categories/:code', (req, res) =>
        masterCategoryController.update(req, res, posV1Db));

    // Delete master category
    router.delete('/categories/:code', (req, res) =>
        masterCategoryController.delete(req, res, posV1Db));

    // ============================================
    // MASTER MENUS
    // ============================================

    // Create master menu
    router.post('/menus', (req, res) =>
        masterMenuController.create(req, res, posV1Db));

    // Bulk create master menus
    router.post('/menus/bulk', (req, res) =>
        masterMenuController.bulkCreate(req, res, posV1Db));

    // Seed product variants (Heineken, Beer Lao, etc. with sizes)
    router.post('/menus/seed-variants', (req, res) =>
        masterMenuController.seedProductVariants(req, res, posV1Db));

    // Analyze menu name for product/variant detection
    router.post('/menus/analyze-variant', (req, res) =>
        masterMenuController.analyzeForVariant(req, res, posV1Db));

    // Assign product variants to existing master menus
    router.post('/menus/assign-variants', (req, res) =>
        masterMenuController.assignProductVariants(req, res, posV1Db));

    // Delete product variants (for re-seeding)
    router.post('/menus/delete-variants', (req, res) =>
        masterMenuController.deleteProductVariants(req, res, posV1Db));

    // Learn keywords from approved mappings (batch training)
    router.post('/menus/learn-keywords', (req, res) =>
        masterMenuController.learnKeywordsFromMappings(req, res, posV1Db));

    // Add a single learned keyword to a master menu
    router.post('/menus/add-keyword', (req, res) =>
        masterMenuController.addLearnedKeyword(req, res, posV1Db));

    // Get product definitions (for UI)
    router.get('/menus/product-definitions', (req, res) =>
        masterMenuController.getProductDefinitions(req, res, posV1Db));

    // Get menus by product
    router.get('/menus/by-product/:productId', (req, res) =>
        masterMenuController.getByProduct(req, res, posV1Db));

    // Find matching menus (for auto-suggestion)
    router.get('/menus/match', (req, res) =>
        masterMenuController.findMatches(req, res, posV1Db));

    // Get menus grouped by category
    router.get('/menus/grouped', (req, res) =>
        masterMenuController.getGroupedByCategory(req, res, posV1Db));

    // Get all master menus
    router.get('/menus', (req, res) =>
        masterMenuController.getAll(req, res, posV1Db));

    // Get mapping statistics for a master menu
    router.get('/menus/:code/mapping-stats', (req, res) =>
        masterMenuController.getMappingStats(req, res, posV1Db));

    // Get single master menu
    router.get('/menus/:code', (req, res) =>
        masterMenuController.getByCode(req, res, posV1Db));

    // Update master menu
    router.put('/menus/:code', (req, res) =>
        masterMenuController.update(req, res, posV1Db));

    // Delete master menu
    router.delete('/menus/:code', (req, res) =>
        masterMenuController.delete(req, res, posV1Db));

    // ============================================
    // MASTER INGREDIENT CATEGORIES
    // ============================================

    // Create master ingredient category
    router.post('/ingredient-categories', (req, res) =>
        masterIngredientCategoryController.create(req, res, db));

    // Bulk create
    router.post('/ingredient-categories/bulk', (req, res) =>
        masterIngredientCategoryController.bulkCreate(req, res, db));

    // Get tree structure
    router.get('/ingredient-categories/tree', (req, res) =>
        masterIngredientCategoryController.getTree(req, res, db));

    // Get all
    router.get('/ingredient-categories', (req, res) =>
        masterIngredientCategoryController.getAll(req, res, db));

    // Get single
    router.get('/ingredient-categories/:code', (req, res) =>
        masterIngredientCategoryController.getByCode(req, res, db));

    // Update
    router.put('/ingredient-categories/:code', (req, res) =>
        masterIngredientCategoryController.update(req, res, db));

    // Delete
    router.delete('/ingredient-categories/:code', (req, res) =>
        masterIngredientCategoryController.delete(req, res, db));

    // ============================================
    // MASTER INGREDIENTS
    // ============================================

    // Create master ingredient
    router.post('/ingredients', (req, res) =>
        masterIngredientController.create(req, res, db));

    // Bulk create
    router.post('/ingredients/bulk', (req, res) =>
        masterIngredientController.bulkCreate(req, res, db));

    // Find matches
    router.get('/ingredients/match', (req, res) =>
        masterIngredientController.findMatches(req, res, db));

    // Get all
    router.get('/ingredients', (req, res) =>
        masterIngredientController.getAll(req, res, db));

    // Get single
    router.get('/ingredients/:code', (req, res) =>
        masterIngredientController.getByCode(req, res, db));

    // Convert units
    router.get('/ingredients/:code/convert', (req, res) =>
        masterIngredientController.convertUnit(req, res, db));

    // Update
    router.put('/ingredients/:code', (req, res) =>
        masterIngredientController.update(req, res, db));

    // Delete
    router.delete('/ingredients/:code', (req, res) =>
        masterIngredientController.delete(req, res, db));

    // ============================================
    // MASTER RECIPE CATEGORIES
    // ============================================

    // Create
    router.post('/recipe-categories', (req, res) =>
        masterRecipeCategoryController.create(req, res, db));

    // Bulk create
    router.post('/recipe-categories/bulk', (req, res) =>
        masterRecipeCategoryController.bulkCreate(req, res, db));

    // Get grouped by type
    router.get('/recipe-categories/grouped', (req, res) =>
        masterRecipeCategoryController.getGroupedByType(req, res, db));

    // Get all
    router.get('/recipe-categories', (req, res) =>
        masterRecipeCategoryController.getAll(req, res, db));

    // Get single
    router.get('/recipe-categories/:code', (req, res) =>
        masterRecipeCategoryController.getByCode(req, res, db));

    // Update
    router.put('/recipe-categories/:code', (req, res) =>
        masterRecipeCategoryController.update(req, res, db));

    // Delete
    router.delete('/recipe-categories/:code', (req, res) =>
        masterRecipeCategoryController.delete(req, res, db));

    // ============================================
    // MASTER RECIPES
    // ============================================

    // Create
    router.post('/recipes', (req, res) =>
        masterRecipeController.create(req, res, db));

    // Get all
    router.get('/recipes', (req, res) =>
        masterRecipeController.getAll(req, res, db));

    // Get by menu code
    router.get('/recipes/by-menu/:menuCode', (req, res) =>
        masterRecipeController.getByMenuCode(req, res, db));

    // Get recipes by ingredient
    router.get('/recipes/by-ingredient/:ingredientCode', (req, res) =>
        masterRecipeController.getByIngredient(req, res, db));

    // Get single
    router.get('/recipes/:code', (req, res) =>
        masterRecipeController.getByCode(req, res, db));

    // Calculate ingredients for servings
    router.get('/recipes/:code/calculate', (req, res) =>
        masterRecipeController.calculateIngredients(req, res, db));

    // Update
    router.put('/recipes/:code', (req, res) =>
        masterRecipeController.update(req, res, db));

    // Delete
    router.delete('/recipes/:code', (req, res) =>
        masterRecipeController.delete(req, res, db));

    // ============================================
    // MASTER RESTAURANT CATEGORIES
    // ============================================

    // Create
    router.post('/restaurant-categories', (req, res) =>
        masterRestaurantCategoryController.create(req, res, db));

    // Bulk create
    router.post('/restaurant-categories/bulk', (req, res) =>
        masterRestaurantCategoryController.bulkCreate(req, res, db));

    // Get all
    router.get('/restaurant-categories', (req, res) =>
        masterRestaurantCategoryController.getAll(req, res, db));

    // Get single
    router.get('/restaurant-categories/:code', (req, res) =>
        masterRestaurantCategoryController.getByCode(req, res, db));

    // Get template (recommended categories and menus)
    router.get('/restaurant-categories/:code/template', (req, res) =>
        masterRestaurantCategoryController.getTemplate(req, res, db));

    // Add recommended categories
    router.post('/restaurant-categories/:code/recommended-categories', (req, res) =>
        masterRestaurantCategoryController.addRecommendedCategories(req, res, db));

    // Add recommended menus
    router.post('/restaurant-categories/:code/recommended-menus', (req, res) =>
        masterRestaurantCategoryController.addRecommendedMenus(req, res, db));

    // Update
    router.put('/restaurant-categories/:code', (req, res) =>
        masterRestaurantCategoryController.update(req, res, db));

    // Delete
    router.delete('/restaurant-categories/:code', (req, res) =>
        masterRestaurantCategoryController.delete(req, res, db));

    // ============================================
    // MAPPINGS
    // ============================================

    // Category mappings
    router.post('/mappings/categories', (req, res) =>
        mappingController.createCategoryMapping(req, res, db));

    router.get('/mappings/categories', (req, res) =>
        mappingController.getCategoryMappings(req, res, db));

    router.get('/mappings/categories/suggestions', (req, res) =>
        mappingController.getCategoryMappingSuggestions(req, res, db));

    router.delete('/mappings/categories/:id', (req, res) =>
        mappingController.deleteCategoryMapping(req, res, db));

    // Menu mappings
    router.post('/mappings/menus', (req, res) =>
        mappingController.createMenuMapping(req, res, db));

    router.post('/mappings/menus/bulk', (req, res) =>
        mappingController.bulkCreateMenuMappings(req, res, db));

    router.get('/mappings/menus', (req, res) =>
        mappingController.getMenuMappings(req, res, db));

    router.get('/mappings/menus/suggestions', (req, res) =>
        mappingController.getMenuMappingSuggestions(req, res, db));

    router.delete('/mappings/menus/:id', (req, res) =>
        mappingController.deleteMenuMapping(req, res, db));

    // Mapping statistics
    router.get('/mappings/stats', (req, res) =>
        mappingController.getMappingStats(req, res, db));

    // ============================================
    // ANALYTICS
    // ============================================

    // Dashboard summary
    router.get('/analytics/dashboard', (req, res) =>
        analyticsController.getDashboardSummary(req, res, db));

    // Top selling master menus
    router.get('/analytics/top-menus', (req, res) =>
        analyticsController.getTopSellingMasterMenus(req, res, db));

    // Top selling master categories
    router.get('/analytics/top-categories', (req, res) =>
        analyticsController.getTopSellingMasterCategories(req, res, db));

    // Ingredient consumption
    router.get('/analytics/ingredient-consumption', (req, res) =>
        analyticsController.getIngredientConsumption(req, res, db));

    // ============================================
    // ADMIN REVIEW
    // ============================================

    // Review statistics
    router.get('/reviews/stats', (req, res) =>
        reviewController.getReviewStats(req, res, posV1Db));

    // --- Menu Review Queue ---

    // Get menu review queue
    router.get('/reviews/menus', (req, res) =>
        reviewController.getMenuReviewQueue(req, res, posV1Db));

    // Get single menu mapping for review
    router.get('/reviews/menus/:id', (req, res) =>
        reviewController.getMenuMappingForReview(req, res, posV1Db));

    // Approve a menu mapping
    router.post('/reviews/menus/:id/approve', (req, res) =>
        reviewController.approveMenuMapping(req, res, posV1Db));

    // Reject a menu mapping
    router.post('/reviews/menus/:id/reject', (req, res) =>
        reviewController.rejectMenuMapping(req, res, posV1Db));

    // Manually map a menu to a different master
    router.put('/reviews/menus/:id/manual-map', (req, res) =>
        reviewController.manualMapMenu(req, res, posV1Db));

    // Mark menu as not applicable
    router.post('/reviews/menus/:id/not-applicable', (req, res) =>
        reviewController.markMenuNotApplicable(req, res, posV1Db));

    // Bulk approve menu mappings (by IDs)
    router.post('/reviews/menus/bulk/approve', (req, res) =>
        reviewController.bulkApproveMenuMappings(req, res, posV1Db));

    // Bulk approve ALL menus by confidence level (Quick Win feature)
    router.post('/reviews/menus/bulk/approve-by-confidence', (req, res) =>
        reviewController.bulkApproveMenusByConfidence(req, res, posV1Db));

    // Bulk reject menu mappings
    router.post('/reviews/menus/bulk/reject', (req, res) =>
        reviewController.bulkRejectMenuMappings(req, res, posV1Db));

    // --- Category Review Queue ---

    // Get category review queue
    router.get('/reviews/categories', (req, res) =>
        reviewController.getCategoryReviewQueue(req, res, posV1Db));

    // Get single category mapping for review
    router.get('/reviews/categories/:id', (req, res) =>
        reviewController.getCategoryMappingForReview(req, res, posV1Db));

    // Approve a category mapping
    router.post('/reviews/categories/:id/approve', (req, res) =>
        reviewController.approveCategoryMapping(req, res, posV1Db));

    // Reject a category mapping
    router.post('/reviews/categories/:id/reject', (req, res) =>
        reviewController.rejectCategoryMapping(req, res, posV1Db));

    // Manually map a category to a different master
    router.put('/reviews/categories/:id/manual-map', (req, res) =>
        reviewController.manualMapCategory(req, res, posV1Db));

    // Mark category as not applicable
    router.post('/reviews/categories/:id/not-applicable', (req, res) =>
        reviewController.markCategoryNotApplicable(req, res, posV1Db));

    // Bulk approve category mappings (by IDs)
    router.post('/reviews/categories/bulk/approve', (req, res) =>
        reviewController.bulkApproveCategoryMappings(req, res, posV1Db));

    // Bulk approve ALL categories by confidence level (Quick Win feature)
    router.post('/reviews/categories/bulk/approve-by-confidence', (req, res) =>
        reviewController.bulkApproveCategoriesByConfidence(req, res, posV1Db));

    // Bulk reject category mappings
    router.post('/reviews/categories/bulk/reject', (req, res) =>
        reviewController.bulkRejectCategoryMappings(req, res, posV1Db));

    // ============================================
    // ORDER-BASED MAPPING (Smart Mapping Approach)
    // ============================================

    // Discover menus from orders (prioritized by order count)
    router.get('/order-mapping/discover', (req, res) =>
        orderBasedMappingController.discoverMenusFromOrders(req, res, posV1Db));

    // Export all discovered menus (no pagination, for Excel/PDF)
    router.get('/order-mapping/discover/export', (req, res) =>
        orderBasedMappingController.exportDiscoveredMenus(req, res, posV1Db));

    // Get order-based mapping statistics
    router.get('/order-mapping/stats', (req, res) =>
        orderBasedMappingController.getOrderBasedStats(req, res, posV1Db));

    // Get items with no match found
    router.get('/order-mapping/no-match', (req, res) =>
        orderBasedMappingController.getNoMatchItems(req, res, posV1Db));

    // Approve an order-based mapping
    router.post('/order-mapping/:id/approve', (req, res) =>
        orderBasedMappingController.approveMapping(req, res, posV1Db));

    // Analyze ordered menus (create/update mapping suggestions)
    router.post('/order-mapping/analyze', (req, res) =>
        orderBasedMappingController.analyzeOrderedMenus(req, res, posV1Db));

    // Bulk analyze all store categories → create categoryMappings suggestions
    router.post('/order-mapping/analyze-categories', (req, res) =>
        orderBasedMappingController.analyzeAllCategories(req, res, posV1Db));

    // Enrich orders with master menu codes
    router.post('/order-mapping/enrich', (req, res) =>
        orderBasedMappingController.enrichOrders(req, res, posV1Db));

    // Get top selling items by master menu code
    router.get('/order-mapping/top-selling', (req, res) =>
        orderBasedMappingController.getTopSellingByMasterMenu(req, res, posV1Db));

    // Get top restaurants by revenue (for Restaurant Analytics tab)
    router.get('/order-mapping/top-restaurants', (req, res) =>
        orderBasedMappingController.getTopRestaurants(req, res, posV1Db));

    // Get store details for a specific master menu item
    router.get('/order-mapping/menu-item/:masterMenuCode/stores', (req, res) =>
        orderBasedMappingController.getStoreDetailsByMenuItem(req, res, posV1Db));

    // ============================================
    // ANALYTICS BUILDER (Materialized View)
    // ============================================

    // Start analytics build job (returns jobId immediately - async/background)
    router.post('/analytics/build-job', (req, res) =>
        analyticsBuilderController.startBuildJob(req, res, posV1Db));

    // Get analytics build job status
    router.get('/analytics/job/:jobId/status', (req, res) =>
        analyticsBuilderController.getJobStatusById(req, res, posV1Db));

    // Stream analytics build job progress (SSE)
    router.get('/analytics/job/:jobId/stream', (req, res) =>
        analyticsBuilderController.streamJobProgress(req, res, posV1Db));

    // Consolidate duplicate Heineken variants
    router.post('/analytics/consolidate-heineken', (req, res) =>
        analyticsBuilderController.consolidateHeinekenVariants(req, res, posV1Db));

    // Fix generic Heineken (map to specific variant)
    router.post('/analytics/fix-generic-heineken', (req, res) =>
        analyticsBuilderController.fixGenericHeineken(req, res, posV1Db));

    // Clean failed jobs from queue
    router.post('/analytics/clean-failed', (req, res) =>
        analyticsBuilderController.cleanFailedJobs(req, res, posV1Db));

    // Get analytics collection status (record counts, last built time)
    router.get('/analytics/status', (req, res) =>
        analyticsBuilderController.getAnalyticsStatus(req, res, posV1Db));

    // LEGACY: Synchronous build endpoint (kept for backwards compatibility, but not recommended)
    router.post('/analytics/build', (req, res) =>
        analyticsBuilderController.buildAnalytics(req, res, posV1Db));

    // JOB-BASED ANALYSIS (Background Processing with Redis/Bull)

    // Start analysis job (returns jobId immediately)
    router.post('/order-mapping/analyze-job', (req, res) =>
        orderBasedMappingController.startAnalysisJob(req, res, posV1Db));

    // Get job status (for polling)
    router.get('/order-mapping/job/:jobId', (req, res) =>
        orderBasedMappingController.getJobStatus(req, res, posV1Db));

    // Stream job progress via SSE (real-time updates)
    router.get('/order-mapping/job/:jobId/progress', (req, res) =>
        orderBasedMappingController.streamJobProgress(req, res, posV1Db));

    // ============================================
    // INDEX MANAGEMENT (Performance Optimization)
    // ============================================

    // Create all performance indexes (orders + menuMappings)
    router.post('/admin/indexes/create-all', (req, res) =>
        indexManagementController.createAllIndexes(req, res, db));

    // Create orders indexes only
    router.post('/admin/indexes/orders', (req, res) =>
        indexManagementController.createOrderIndexes(req, res, db));

    // Create menuMappings indexes only
    router.post('/admin/indexes/mappings', (req, res) =>
        indexManagementController.createMappingIndexes(req, res, db));

    // List all indexes (read-only)
    router.get('/admin/indexes/list', (req, res) =>
        indexManagementController.listIndexes(req, res, db));

    // Get index statistics (read-only)
    router.get('/admin/indexes/stats', (req, res) =>
        indexManagementController.getIndexStats(req, res, db));

    return router;
};
