/**
 * Migration Module Index
 * 
 * Exports migration utilities for programmatic use.
 */

const { initMigrationCollections } = require('./migrationInit');
const { runAnalysis, analyzeMenus, analyzeCategories } = require('./migrationAnalyze');

module.exports = {
    initMigrationCollections,
    runAnalysis,
    analyzeMenus,
    analyzeCategories
};
