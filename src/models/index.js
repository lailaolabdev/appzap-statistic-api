/**
 * Models Index
 * 
 * Central export for all master data models.
 * Provides easy access to schemas, collection names, and indexes.
 */

const masterCategory = require('./masterCategory');
const masterMenu = require('./masterMenu');
const masterIngredientCategory = require('./masterIngredientCategory');
const masterIngredient = require('./masterIngredient');
const masterRecipeCategory = require('./masterRecipeCategory');
const masterRecipe = require('./masterRecipe');
const masterRestaurantCategory = require('./masterRestaurantCategory');
const menuMapping = require('./menuMapping');
const categoryMapping = require('./categoryMapping');
const mappingDecision = require('./mappingDecision');
const mappingStats = require('./mappingStats');

module.exports = {
    masterCategory,
    masterMenu,
    masterIngredientCategory,
    masterIngredient,
    masterRecipeCategory,
    masterRecipe,
    masterRestaurantCategory,
    menuMapping,
    categoryMapping,
    mappingDecision,
    mappingStats,
    
    // List of all collections for initialization
    allCollections: [
        masterCategory,
        masterMenu,
        masterIngredientCategory,
        masterIngredient,
        masterRecipeCategory,
        masterRecipe,
        masterRestaurantCategory,
        menuMapping,
        categoryMapping,
        mappingDecision,
        mappingStats
    ]
};
