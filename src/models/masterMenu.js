/**
 * Master Menu Model
 * 
 * Represents standardized menu items across all stores.
 * Each master menu has a unique code that can be linked to
 * individual store menus for cross-store analytics.
 * 
 * Examples: Fried Rice, Pad Thai, Green Curry, etc.
 */

const masterMenuSchema = {
    // Unique identifier code (auto-generated)
    // Format: MENU-XXXXXXXX
    code: {
        type: 'string',
        required: true,
        unique: true,
        index: true
    },
    
    // Reference to master category code
    masterCategoryCode: {
        type: 'string',
        required: true,
        index: true
    },
    
    // Standard name in Lao
    name: {
        type: 'string',
        required: true
    },
    
    // English name
    name_en: {
        type: 'string',
        default: ''
    },
    
    // Thai name
    name_th: {
        type: 'string',
        default: ''
    },
    
    // Chinese name
    name_cn: {
        type: 'string',
        default: ''
    },
    
    // Korean name
    name_kr: {
        type: 'string',
        default: ''
    },
    
    // Japanese name
    name_jp: {
        type: 'string',
        default: ''
    },
    
    // Vietnamese name
    name_vi: {
        type: 'string',
        default: ''
    },
    
    // Recommended restaurant types (array of readable codes)
    // e.g., ['RCAT-BEERGARDEN', 'RCAT-BAR', 'RCAT-RESTAURANT']
    recommendedRestaurantTypes: {
        type: 'array',
        default: []
    },
    
    // Standard/reference price in LAK (for benchmarking)
    standardPrice: {
        type: 'number',
        default: 0
    },
    
    // Standard image URL for the menu item
    imageUrl: {
        type: 'string',
        default: ''
    },
    
    // Search keywords for auto-matching
    // Array of alternative names, regional variations, common misspellings
    keywords: {
        type: 'array',
        default: []
    },
    
    // Description of the menu item
    description: {
        type: 'string',
        default: ''
    },
    
    // Standard image URL
    imageUrl: {
        type: 'string',
        default: ''
    },
    
    // Allergen information
    allergens: {
        type: 'array',
        default: []  // e.g., ['gluten', 'dairy', 'nuts', 'shellfish']
    },
    
    // Dietary flags
    isVegetarian: {
        type: 'boolean',
        default: false
    },
    
    isVegan: {
        type: 'boolean',
        default: false
    },
    
    isHalal: {
        type: 'boolean',
        default: false
    },
    
    isGlutenFree: {
        type: 'boolean',
        default: false
    },
    
    // Spice level (0-5)
    spiceLevel: {
        type: 'number',
        default: 0
    },
    
    // Preparation time in minutes (average)
    prepTimeMinutes: {
        type: 'number',
        default: 0
    },
    
    // ============================================
    // AI-Ready Search Fields
    // ============================================
    
    // Taste profile (0-5 scale for each taste)
    // Enables searches like "sweet things", "sour soup", "savory snack"
    tasteProfile: {
        type: 'object',
        default: {
            sweet: 0,      // ຫວານ / หวาน
            sour: 0,       // ສົ້ມ / เปรี้ยว
            spicy: 0,      // ເຜັດ / เผ็ด
            salty: 0,      // ເຄັມ / เค็ม
            bitter: 0,     // ຂົມ / ขม
            umami: 0       // ກົ້ນລົດ / อูมามิ
        }
    },
    
    // Texture profile (0-5 scale for each texture)
    // Enables searches like "crunchy", "soft", "creamy"
    textureProfile: {
        type: 'object',
        default: {
            crispy: 0,     // ກອບ / กรอบ
            soft: 0,       // ນຸ້ມ / นุ่ม
            chewy: 0,      // ໜຽວ / เหนียว
            creamy: 0,     // ຂຸ້ນ / ครีมมี่
            soupy: 0       // ນ້ຳ / น้ำ (liquid/broth)
        }
    },
    
    // Serving temperature
    // Enables searches like "hot noodle", "cold dessert"
    servingTemperature: {
        type: 'string',
        enum: ['hot', 'warm', 'room', 'cold', 'iced', 'varies'],
        default: 'room'
    },
    
    // Occasion/mood tags
    // Enables searches like "hangout food", "romantic dinner", "party snacks"
    occasions: {
        type: 'array',
        default: []  // e.g., ['casual', 'hangout', 'drinking', 'celebration', 'romantic', 'business', 'family', 'late-night', 'party']
    },
    
    // Emotion/feeling tags
    // Enables mood-based recommendations
    emotionTags: {
        type: 'array',
        default: []  // e.g., ['comfort', 'refreshing', 'energizing', 'indulgent', 'light', 'filling', 'warming', 'cooling']
    },
    
    // Meal time suitability
    // Enables time-based recommendations
    mealTimes: {
        type: 'array',
        default: []  // e.g., ['breakfast', 'brunch', 'lunch', 'dinner', 'late-night', 'snack', 'anytime']
    },
    
    // Season suitability
    // Enables weather-based recommendations
    bestSeasons: {
        type: 'array',
        default: []  // e.g., ['hot-weather', 'rainy-season', 'cool-weather', 'all-year']
    },
    
    // Pairing suggestions (menu codes that go well together)
    // Enables "what goes well with this" recommendations
    pairingMenuCodes: {
        type: 'array',
        default: []  // e.g., ['MENU-STICKY-RICE', 'MENU-BEERLAO']
    },
    
    // AI-ready rich description for embedding/vector search
    // Detailed description for semantic search
    aiDescription: {
        type: 'string',
        default: ''
    },
    
    // AI description in multiple languages (for multilingual search)
    aiDescription_th: {
        type: 'string',
        default: ''
    },
    
    aiDescription_en: {
        type: 'string',
        default: ''
    },
    
    // Popularity score (0-100) - can be updated from order analytics
    // Higher score = more popular
    popularityScore: {
        type: 'number',
        default: 50
    },
    
    // Sort order within category
    sortOrder: {
        type: 'number',
        default: 0
    },
    
    // Whether this menu item is active
    isActive: {
        type: 'boolean',
        default: true
    },
    
    // Soft delete flag
    isDeleted: {
        type: 'boolean',
        default: false
    },
    
    // Timestamps
    createdAt: {
        type: 'date',
        default: () => new Date()
    },
    
    updatedAt: {
        type: 'date',
        default: () => new Date()
    }
};

// Collection name
const COLLECTION_NAME = 'masterMenus';

// Indexes for optimal query performance
const indexes = [
    { key: { code: 1 }, unique: true },
    { key: { masterCategoryCode: 1 } },
    { key: { name: 1 } },
    { key: { name_en: 1 } },
    { key: { isActive: 1, isDeleted: 1 } },
    { key: { keywords: 1 } },
    { key: { recommendedRestaurantTypes: 1 } },
    // AI search indexes
    { key: { 'tasteProfile.spicy': 1 } },
    { key: { 'tasteProfile.sweet': 1 } },
    { key: { 'tasteProfile.sour': 1 } },
    { key: { servingTemperature: 1 } },
    { key: { occasions: 1 } },
    { key: { emotionTags: 1 } },
    { key: { mealTimes: 1 } },
    { key: { bestSeasons: 1 } },
    { key: { popularityScore: -1 } }
];

module.exports = {
    schema: masterMenuSchema,
    collectionName: COLLECTION_NAME,
    indexes
};
