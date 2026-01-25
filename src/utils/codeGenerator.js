/**
 * Code Generator Utility
 * Generates industry-standard unique codes for master data collections
 * 
 * Code Format: PREFIX-XXXXXXXX
 * - PREFIX: Identifies the collection type (e.g., MCAT, MENU, ING)
 * - XXXXXXXX: 8-character alphanumeric code (Base36 timestamp + random suffix)
 * 
 * This ensures:
 * - Uniqueness across the system
 * - Chronological sortability
 * - Human readability
 * - Industry standard compliance
 */

const CODE_PREFIXES = {
    MASTER_CATEGORY: 'MCAT',
    MASTER_MENU: 'MENU',
    MASTER_INGREDIENT_CATEGORY: 'INGCAT',
    MASTER_INGREDIENT: 'ING',
    MASTER_RECIPE_CATEGORY: 'RECCAT',
    MASTER_RECIPE: 'REC',
    MASTER_RESTAURANT_CATEGORY: 'RCAT'
};

/**
 * Generates a unique 8-character alphanumeric code
 * Combines timestamp (for sortability) with random suffix (for uniqueness)
 * @returns {string} 8-character alphanumeric code
 */
const generateUniqueCode = () => {
    // Get current timestamp in base36 (last 5 chars for compactness)
    const timestamp = Date.now().toString(36).toUpperCase().slice(-5);
    
    // Generate 3 random alphanumeric characters
    const randomChars = Math.random().toString(36).substring(2, 5).toUpperCase();
    
    return `${timestamp}${randomChars}`;
};

/**
 * Generates a master category code
 * @returns {string} e.g., "MCAT-LK5X7A2B"
 */
const generateMasterCategoryCode = () => {
    return `${CODE_PREFIXES.MASTER_CATEGORY}-${generateUniqueCode()}`;
};

/**
 * Generates a master menu code
 * @returns {string} e.g., "MENU-LK5X7A2B"
 */
const generateMasterMenuCode = () => {
    return `${CODE_PREFIXES.MASTER_MENU}-${generateUniqueCode()}`;
};

/**
 * Generates a master ingredient category code
 * @returns {string} e.g., "INGCAT-LK5X7A2B"
 */
const generateMasterIngredientCategoryCode = () => {
    return `${CODE_PREFIXES.MASTER_INGREDIENT_CATEGORY}-${generateUniqueCode()}`;
};

/**
 * Generates a master ingredient code
 * @returns {string} e.g., "ING-LK5X7A2B"
 */
const generateMasterIngredientCode = () => {
    return `${CODE_PREFIXES.MASTER_INGREDIENT}-${generateUniqueCode()}`;
};

/**
 * Generates a master recipe category code
 * @returns {string} e.g., "RECCAT-LK5X7A2B"
 */
const generateMasterRecipeCategoryCode = () => {
    return `${CODE_PREFIXES.MASTER_RECIPE_CATEGORY}-${generateUniqueCode()}`;
};

/**
 * Generates a master recipe code
 * @returns {string} e.g., "REC-LK5X7A2B"
 */
const generateMasterRecipeCode = () => {
    return `${CODE_PREFIXES.MASTER_RECIPE}-${generateUniqueCode()}`;
};

/**
 * Generates a master restaurant category code
 * @returns {string} e.g., "RCAT-LK5X7A2B"
 */
const generateMasterRestaurantCategoryCode = () => {
    return `${CODE_PREFIXES.MASTER_RESTAURANT_CATEGORY}-${generateUniqueCode()}`;
};

/**
 * Validates a code format
 * @param {string} code - The code to validate
 * @param {string} prefix - Expected prefix
 * @returns {boolean} Whether the code is valid
 */
const validateCode = (code, prefix) => {
    if (!code || typeof code !== 'string') return false;
    const regex = new RegExp(`^${prefix}-[A-Z0-9]{8}$`);
    return regex.test(code);
};

module.exports = {
    CODE_PREFIXES,
    generateUniqueCode,
    generateMasterCategoryCode,
    generateMasterMenuCode,
    generateMasterIngredientCategoryCode,
    generateMasterIngredientCode,
    generateMasterRecipeCategoryCode,
    generateMasterRecipeCode,
    generateMasterRestaurantCategoryCode,
    validateCode
};
