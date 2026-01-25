/**
 * CSV Parser Utility
 * 
 * Simple CSV parser for reading seed data files.
 * Handles quoted fields, commas within fields, and various data types.
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse a profile string in format "key1:value1|key2:value2" into an object
 * @param {string} str - Profile string
 * @param {string} profileType - Type of profile ('tasteProfile', 'textureProfile', 'typicalTasteProfile')
 * @returns {Object} Parsed profile object
 */
function parseProfileString(str, profileType) {
    // Default structures
    const defaults = {
        tasteProfile: { sweet: 0, sour: 0, spicy: 0, salty: 0, bitter: 0, umami: 0 },
        typicalTasteProfile: { sweet: 0, sour: 0, spicy: 0, salty: 0, bitter: 0, umami: 0 },
        textureProfile: { crispy: 0, soft: 0, chewy: 0, creamy: 0, soupy: 0 }
    };
    
    const result = { ...defaults[profileType] } || {};
    
    if (!str) return result;
    
    // Parse "key:value|key:value" format
    const pairs = str.split('|');
    for (const pair of pairs) {
        const [key, val] = pair.split(':').map(s => s.trim());
        if (key && val !== undefined) {
            result[key] = parseInt(val, 10) || 0;
        }
    }
    
    return result;
}

/**
 * Parse a CSV line handling quoted fields
 * @param {string} line - CSV line
 * @returns {string[]} Array of field values
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                current += '"';
                i++;
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    // Don't forget the last field
    result.push(current.trim());
    
    return result;
}

/**
 * Parse a CSV file and return array of objects
 * @param {string} filePath - Path to CSV file
 * @returns {Object[]} Array of objects with header keys
 */
function parseCSV(filePath) {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, '..', filePath);
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
        return [];
    }
    
    // First line is headers
    const headers = parseCSVLine(lines[0]);
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const obj = {};
        
        for (let j = 0; j < headers.length; j++) {
            const header = headers[j];
            let value = values[j] || '';
            
            // Type conversion based on header name or value
            if (header === 'sortOrder' || header === 'categoryIndex' || 
                header === 'standardPrice' || header === 'typicalMenuCount' ||
                header === 'typicalCategoryCount' || header === 'averageWeightPerPiece' ||
                header === 'popularityScore' || header === 'priceTier' || header === 'noiseLevel') {
                value = value ? parseInt(value, 10) : 0;
            } else if (header === 'isVegetarian' || header === 'isVegan' || 
                       header === 'isHalal' || header === 'hasAlcohol' || header === 'hasFood') {
                value = value.toLowerCase() === 'true';
            } else if (header === 'keywords') {
                // Parse keywords as array (comma-separated)
                value = value ? value.split(',').map(k => k.trim()).filter(k => k) : [];
            } else if (header === 'recommendedRestaurantTypes' || 
                       header === 'occasions' || 
                       header === 'emotionTags' || 
                       header === 'mealTimes' || 
                       header === 'bestSeasons' || 
                       header === 'pairingMenuCodes' ||
                       header === 'ambiance' ||
                       header === 'features' ||
                       header === 'typicalOccasions') {
                // Parse arrays (pipe-separated to avoid conflict with keywords)
                value = value ? value.split('|').map(k => k.trim()).filter(k => k) : [];
            } else if (header === 'tasteProfile' || header === 'textureProfile' || header === 'typicalTasteProfile') {
                // Parse profile objects from format like "sweet:3|sour:2|spicy:4"
                // or as JSON string like '{"sweet":3,"sour":2}'
                if (value) {
                    if (value.startsWith('{')) {
                        try {
                            value = JSON.parse(value);
                        } catch (e) {
                            value = parseProfileString(value, header);
                        }
                    } else {
                        value = parseProfileString(value, header);
                    }
                } else {
                    // Default values based on profile type
                    if (header === 'tasteProfile' || header === 'typicalTasteProfile') {
                        value = { sweet: 0, sour: 0, spicy: 0, salty: 0, bitter: 0, umami: 0 };
                    } else if (header === 'textureProfile') {
                        value = { crispy: 0, soft: 0, chewy: 0, creamy: 0, soupy: 0 };
                    }
                }
            }
            
            obj[header] = value;
        }
        
        result.push(obj);
    }
    
    return result;
}

/**
 * Load all master data from CSV files in the data directory
 * @param {string} dataDir - Path to data directory
 * @returns {Object} Object containing all master data arrays
 */
function loadAllMasterData(dataDir) {
    const basePath = dataDir || path.join(__dirname, '..', 'data');
    
    return {
        masterCategories: parseCSV(path.join(basePath, 'masterCategories.csv')),
        masterMenus: parseCSV(path.join(basePath, 'masterMenus.csv')),
        masterRestaurantCategories: parseCSV(path.join(basePath, 'masterRestaurantCategories.csv')),
        masterIngredientCategories: parseCSV(path.join(basePath, 'masterIngredientCategories.csv')),
        masterIngredients: parseCSV(path.join(basePath, 'masterIngredients.csv')),
        masterRecipeCategories: parseCSV(path.join(basePath, 'masterRecipeCategories.csv'))
    };
}

module.exports = {
    parseProfileString,
    parseCSVLine,
    parseCSV,
    loadAllMasterData
};
