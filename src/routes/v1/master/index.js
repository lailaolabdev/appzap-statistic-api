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
    reviewController
} = require('../../../controllers/master');

module.exports = (db) => {
    const router = express.Router();

    // ============================================
    // MASTER CATEGORIES
    // ============================================
    
    // Create master category
    router.post('/categories', (req, res) => 
        masterCategoryController.create(req, res, db));
    
    // Bulk create master categories
    router.post('/categories/bulk', (req, res) => 
        masterCategoryController.bulkCreate(req, res, db));
    
    // Find matching categories (for auto-suggestion)
    router.get('/categories/match', (req, res) => 
        masterCategoryController.findMatches(req, res, db));
    
    // Get all master categories
    router.get('/categories', (req, res) => 
        masterCategoryController.getAll(req, res, db));
    
    // Get single master category
    router.get('/categories/:code', (req, res) => 
        masterCategoryController.getByCode(req, res, db));
    
    // Update master category
    router.put('/categories/:code', (req, res) => 
        masterCategoryController.update(req, res, db));
    
    // Delete master category
    router.delete('/categories/:code', (req, res) => 
        masterCategoryController.delete(req, res, db));

    // ============================================
    // MASTER MENUS
    // ============================================
    
    // Create master menu
    router.post('/menus', (req, res) => 
        masterMenuController.create(req, res, db));
    
    // Bulk create master menus
    router.post('/menus/bulk', (req, res) => 
        masterMenuController.bulkCreate(req, res, db));
    
    // Find matching menus (for auto-suggestion)
    router.get('/menus/match', (req, res) => 
        masterMenuController.findMatches(req, res, db));
    
    // Get menus grouped by category
    router.get('/menus/grouped', (req, res) => 
        masterMenuController.getGroupedByCategory(req, res, db));
    
    // Get all master menus
    router.get('/menus', (req, res) => 
        masterMenuController.getAll(req, res, db));
    
    // Get single master menu
    router.get('/menus/:code', (req, res) => 
        masterMenuController.getByCode(req, res, db));
    
    // Update master menu
    router.put('/menus/:code', (req, res) => 
        masterMenuController.update(req, res, db));
    
    // Delete master menu
    router.delete('/menus/:code', (req, res) => 
        masterMenuController.delete(req, res, db));

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
        reviewController.getReviewStats(req, res, db));
    
    // --- Menu Review Queue ---
    
    // Get menu review queue
    router.get('/reviews/menus', (req, res) => 
        reviewController.getMenuReviewQueue(req, res, db));
    
    // Get single menu mapping for review
    router.get('/reviews/menus/:id', (req, res) => 
        reviewController.getMenuMappingForReview(req, res, db));
    
    // Approve a menu mapping
    router.post('/reviews/menus/:id/approve', (req, res) => 
        reviewController.approveMenuMapping(req, res, db));
    
    // Reject a menu mapping
    router.post('/reviews/menus/:id/reject', (req, res) => 
        reviewController.rejectMenuMapping(req, res, db));
    
    // Manually map a menu to a different master
    router.put('/reviews/menus/:id/manual-map', (req, res) => 
        reviewController.manualMapMenu(req, res, db));
    
    // Mark menu as not applicable
    router.post('/reviews/menus/:id/not-applicable', (req, res) => 
        reviewController.markMenuNotApplicable(req, res, db));
    
    // Bulk approve menu mappings
    router.post('/reviews/menus/bulk/approve', (req, res) => 
        reviewController.bulkApproveMenuMappings(req, res, db));
    
    // Bulk reject menu mappings
    router.post('/reviews/menus/bulk/reject', (req, res) => 
        reviewController.bulkRejectMenuMappings(req, res, db));
    
    // --- Category Review Queue ---
    
    // Get category review queue
    router.get('/reviews/categories', (req, res) => 
        reviewController.getCategoryReviewQueue(req, res, db));
    
    // Get single category mapping for review
    router.get('/reviews/categories/:id', (req, res) => 
        reviewController.getCategoryMappingForReview(req, res, db));
    
    // Approve a category mapping
    router.post('/reviews/categories/:id/approve', (req, res) => 
        reviewController.approveCategoryMapping(req, res, db));
    
    // Reject a category mapping
    router.post('/reviews/categories/:id/reject', (req, res) => 
        reviewController.rejectCategoryMapping(req, res, db));
    
    // Manually map a category to a different master
    router.put('/reviews/categories/:id/manual-map', (req, res) => 
        reviewController.manualMapCategory(req, res, db));
    
    // Mark category as not applicable
    router.post('/reviews/categories/:id/not-applicable', (req, res) => 
        reviewController.markCategoryNotApplicable(req, res, db));
    
    // Bulk approve category mappings
    router.post('/reviews/categories/bulk/approve', (req, res) => 
        reviewController.bulkApproveCategoryMappings(req, res, db));
    
    // Bulk reject category mappings
    router.post('/reviews/categories/bulk/reject', (req, res) => 
        reviewController.bulkRejectCategoryMappings(req, res, db));

    return router;
};
