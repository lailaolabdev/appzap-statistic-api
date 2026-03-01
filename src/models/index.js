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

// New models for subscription management
const invoice = require('./invoice');
const device = require('./device');
const subscriptionPackage = require('./subscriptionPackage');
const whatsappTemplate = require('./whatsappTemplate');
const whatsappBroadcast = require('./whatsappBroadcast');

// Finance models
const expense = require('./expense');
const expenseCategory = require('./expenseCategory');
const financialTransaction = require('./financialTransaction');
const bankAccount = require('./bankAccount');
const budget = require('./budget');
const financialPeriod = require('./financialPeriod');
const income = require('./income');
const restaurantAssignment = require('./restaurantAssignment');
const supportTicket = require('./supportTicket');
const systemHealth = require('./systemHealth');
const notificationPreference = require('./notificationPreference');

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
    
    // Subscription management models
    invoice,
    device,
    subscriptionPackage,
    whatsappTemplate,
    whatsappBroadcast,
    
    // Finance models
    expense,
    expenseCategory,
    financialTransaction,
    bankAccount,
    budget,
    financialPeriod,
    income,
    restaurantAssignment,
    supportTicket,
    systemHealth,
    notificationPreference,
    
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
        mappingStats,
        // Subscription collections
        invoice,
        device,
        subscriptionPackage,
        whatsappTemplate,
        whatsappBroadcast,
        // Finance collections
        expense,
        expenseCategory,
        financialTransaction,
        bankAccount,
        budget,
        financialPeriod,
        income,
        restaurantAssignment,
        supportTicket,
        systemHealth,
        notificationPreference,
    ]
};
