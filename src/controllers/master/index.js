/**
 * Master Controllers Index
 * 
 * Central export for all master data controllers.
 */

const masterCategoryController = require('./masterCategoryController');
const masterMenuController = require('./masterMenuController');
const masterIngredientCategoryController = require('./masterIngredientCategoryController');
const masterIngredientController = require('./masterIngredientController');
const masterRecipeCategoryController = require('./masterRecipeCategoryController');
const masterRecipeController = require('./masterRecipeController');
const masterRestaurantCategoryController = require('./masterRestaurantCategoryController');
const mappingController = require('./mappingController');
const analyticsController = require('./analyticsController');
const reviewController = require('./reviewController');

module.exports = {
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
};
