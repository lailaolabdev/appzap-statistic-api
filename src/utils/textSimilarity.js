/**
 * Text Similarity Utility - IMPROVED VERSION
 * 
 * Provides robust text matching for Lao, Thai, and English text.
 * Uses multi-strategy matching with category-based filtering.
 * 
 * Key Features:
 * - Proper Unicode handling for Lao (U+0E80-U+0EFF) and Thai (U+0E00-U+0E7F)
 * - Category detection to prevent cross-category false matches
 * - Multi-strategy matching (exact, keyword, token, fuzzy)
 * - Stricter confidence thresholds
 */

// =============================================================================
// CATEGORY KEYWORDS
// =============================================================================

/**
 * Category keywords in multiple languages (Lao, Thai, English)
 * Used to detect the food/drink category before matching
 */
const CATEGORY_KEYWORDS = {
    // Beverages - Non-Alcoholic
    COFFEE: {
        keywords: ['ກາເຟ', 'กาแฟ', 'coffee', 'espresso', 'latte', 'cappuccino', 'americano', 'mocha', 'ລາເຕ້', 'ຄາປູຊິໂນ', 'ໂມຄ່າ', 'ເອສເປຣສໂຊ'],
        masterCategoryCode: 'MCAT-COFFEE'
    },
    TEA: {
        keywords: ['ຊາ', 'ชา', 'tea', 'ຊານົມ', 'ชานม', 'matcha', 'ມັດຊະ'],
        masterCategoryCode: 'MCAT-TEA',
        excludeKeywords: ['ເຫຼົ້າ', 'ເບຍ', 'whiskey', 'beer', 'wine'] // Don't match alcohol to tea
    },
    JUICE: {
        keywords: ['ນ້ຳ', 'น้ำ', 'juice', 'ນ້ຳໝາກ', 'น้ำผลไม้', 'smoothie', 'ສະມູດ', 'shake', 'ນ້ຳສົ້ມ', 'ນ້ຳໝາກນາວ', 'ນ້ຳໝາກໂມ'],
        masterCategoryCode: 'MCAT-JUICE',
        excludeKeywords: ['ເຫຼົ້າ', 'ເບຍ', 'whiskey', 'beer']
    },
    SOFT_DRINKS: {
        keywords: ['ໂຄກ', 'โค้ก', 'coke', 'coca', 'pepsi', 'sprite', 'fanta', 'ເປັບຊີ', 'ສະໄປຣ', 'ແຟນຕ້າ', 'soda', 'ໂຊດາ', 'redbull', 'ເຣດບູລ'],
        masterCategoryCode: 'MCAT-SOFTDRINKS'
    },
    
    // Alcoholic Beverages
    BEER: {
        keywords: ['ເບຍ', 'เบียร์', 'beer', 'beerlao', 'heineken', 'ໄຮເນເກັນ', 'tiger', 'singha', 'สิงห์', 'chang', 'ช้าง', 'draft', 'ສົດ', 'ຖັງ', 'tower', 'asahi', 'sapporo', 'kirin', 'corona', 'budweiser', 'lager', 'ale'],
        masterCategoryCode: 'MCAT-BEER'
    },
    SPIRITS: {
        keywords: ['ເຫຼົ້າ', 'เหล้า', 'whiskey', 'whisky', 'vodka', 'rum', 'gin', 'tequila', 'cognac', 'brandy', 'johnnie', 'chivas', 'hennessy', 'jack daniel', 'ຈອນນີ', 'ຊີວັສ', 'ເຮັນເນຊີ', 'ແຈັກ', 'smirnoff', 'absolut', 'bacardi', 'ຣັມ', 'ວອດກາ', 'ຈິນ', 'ເຕກີລາ', 'ລາວລາວ', 'ເຫຼົ້າຂາວ'],
        masterCategoryCode: 'MCAT-SPIRITS'
    },
    WINE: {
        keywords: ['ໄວນ໌', 'ไวน์', 'wine', 'champagne', 'ແຊມເປນ', 'sparkling', 'red wine', 'white wine', 'rose', 'prosecco'],
        masterCategoryCode: 'MCAT-WINE'
    },
    COCKTAIL: {
        keywords: ['cocktail', 'ຄ໋ອກເທວ', 'mojito', 'ໂມຈິໂຕ', 'margarita', 'ມາກາຣິຕາ', 'martini', 'ມາຕິນີ', 'long island', 'ລອງໄອແລນ', 'bloody mary', 'cosmopolitan', 'gin tonic', 'screwdriver', 'shot', 'ຊ໋ອດ'],
        masterCategoryCode: 'MCAT-COCKTAILS'
    },
    
    // Rice Dishes
    RICE: {
        keywords: ['ເຂົ້າ', 'ข้าว', 'rice', 'fried rice', 'ເຂົ້າຜັດ', 'ข้าวผัด', 'ເຂົ້າໜຽວ', 'ข้าวเหนียว', 'sticky rice', 'ເຂົ້າມັນ', 'ข้าวมัน', 'ເຂົ້າໝູ', 'ข้าวหมู'],
        masterCategoryCode: 'MCAT-RICE'
    },
    
    // Noodles
    NOODLES: {
        keywords: ['ເຝີ', 'เฝอ', 'pho', 'ผัดไทย', 'pad thai', 'ຜັດໄທ', 'noodle', 'ເສັ້ນ', 'เส้น', 'ບະໝີ່', 'บะหมี่', 'ກ໋ວຍ', 'ก๋วย', 'kuay', 'ລາດໜ້າ', 'ราดหน้า', 'ຜັດຊີອິ໊ວ', 'ผัดซีอิ๊ว', 'ຜັດຂີ້ເມົາ'],
        masterCategoryCode: 'MCAT-NOODLES'
    },
    
    // Salads - Lao/Thai Style
    SALAD_LAO: {
        keywords: ['ລາບ', 'ลาบ', 'laab', 'ສົ້ມຕຳ', 'ส้มตำ', 'somtam', 'papaya', 'ຍຳ', 'ยำ', 'yum', 'ນ້ຳຕົກ', 'น้ำตก', 'namtok'],
        masterCategoryCode: 'MCAT-LAOSALAD'
    },
    
    // Soups & Curries
    SOUP: {
        keywords: ['ຕົ້ມ', 'ต้ม', 'tom', 'ແກງ', 'แกง', 'kaeng', 'curry', 'ຍຳ', 'soup', 'ນ້ຳແກງ', 'tom yum', 'ຕົ້ມຍຳ', 'tom kha', 'ຕົ້ມຂ່າ', 'green curry', 'ແກງຂຽວ', 'red curry', 'ແກງແດງ', 'massaman', 'panang'],
        masterCategoryCode: 'MCAT-SOUP'
    },
    
    // Grilled
    GRILLED: {
        keywords: ['ປີ້ງ', 'ย่าง', 'grill', 'ປາປີ້ງ', 'ปิ้ง', 'ຍ່າງ', 'bbq', 'barbecue', 'roast', 'ໝູຍ່າງ', 'หมูย่าง', 'ໄກ່ຍ່າງ', 'ไก่ย่าง', 'steak', 'ສະເຕັກ', 'skewer'],
        masterCategoryCode: 'MCAT-GRILLED'
    },
    
    // Fried
    FRIED: {
        keywords: ['ທອດ', 'ทอด', 'fried', 'deep fried', 'crispy', 'tempura', 'ຊຸບແປ້ງ', 'ชุบแป้ง', 'ກອບ', 'กรอบ'],
        masterCategoryCode: 'MCAT-FRIED'
    },
    
    // Stir-fry
    STIRFRY: {
        keywords: ['ຜັດ', 'ผัด', 'stir fry', 'stir-fry', 'ກະເພົາ', 'กะเพรา', 'basil', 'ຜັດຜັກ', 'ผัดผัก', 'ຜັກບົ໋ງ', 'ผักบุ้ง', 'morning glory'],
        masterCategoryCode: 'MCAT-STIRFRY'
    },
    
    // Seafood
    SEAFOOD: {
        keywords: ['ກຸ້ງ', 'กุ้ง', 'shrimp', 'prawn', 'ປາ', 'ปลา', 'fish', 'ປູ', 'ปู', 'crab', 'ປາຫມຶກ', 'ปลาหมึก', 'squid', 'calamari', 'ຫອຍ', 'หอย', 'shellfish', 'ທະເລ', 'ทะเล', 'seafood'],
        masterCategoryCode: 'MCAT-SEAFOOD'
    },
    
    // Boiled dishes
    BOILED: {
        keywords: ['ລວກ', 'ลวก', 'boiled', 'blanched', 'ລວກກຸ້ງ', 'กุ้งลวก', 'ລວກຫອຍ', 'หอยลวก', 'ແຊ່ນ້ຳປາ', 'แช่น้ำปลา'],
        masterCategoryCode: 'MCAT-BOILED'
    },
    
    // Papaya Salad (Tam)
    TAM: {
        keywords: ['ຕຳ', 'ตำ', 'tam', 'ສົ້ມຕຳ', 'ส้มตำ', 'somtam', 'papaya salad', 'ຕຳໝາກຫຸ່ງ', 'ส้มตำมะละกอ', 'ຕຳເຂົ້າປຸ້ນ', 'ส้มตำข้าวปุ้น', 'ຕຳຖາດ', 'ตำถาด', 'ຕຳຕ່ອນ'],
        masterCategoryCode: 'MCAT-LAOSALAD'
    },
    
    // Koy (Raw Lao dishes)
    KOY: {
        keywords: ['ກ້ອຍ', 'ก้อย', 'koy', 'koi', 'raw salad', 'ກ້ອຍປາ', 'ก้อยปลา', 'ກ້ອຍຊີ້ນ', 'ก้อยเนื้อ'],
        masterCategoryCode: 'MCAT-KOY'
    },
    
    // Tom Saeb (Lao spicy soup)
    TOMSAEB: {
        keywords: ['ຕົ້ມແຊບ', 'ต้มแซ่บ', 'tom saeb', 'tom saab', 'ແຊບ', 'แซ่บ'],
        masterCategoryCode: 'MCAT-TOMSAEB'
    },
    
    // Steamed dishes
    STEAMED: {
        keywords: ['ນືງ', 'ໜືງ', 'นึ่ง', 'steamed', 'ປານືງ', 'ปลานึ่ง', 'ກຸ້ງນືງ', 'กุ้งนึ่ง'],
        masterCategoryCode: 'MCAT-STEAMED'
    },
    
    // Extras / Basic items
    EXTRAS: {
        keywords: ['ນ້ຳກ້ອນ', 'น้ำแข็ง', 'ice', 'ນ້ຳດື່ມ', 'น้ำดื่ม', 'water', 'ໄຂ່ດາວ', 'ไข่ดาว', 'fried egg', 'ເຂົ້າໜຽວ', 'ข้าวเหนียว', 'sticky rice', 'ເຂົ້າຈ້າວ', 'ข้าวสวย'],
        masterCategoryCode: 'MCAT-EXTRAS'
    },
    
    // Bar Snacks / Appetizers
    SNACKS: {
        keywords: ['ທອດເອັນ', 'กระดูกอ่อน', 'cartilage', 'ທອດຄາງ', 'คาง', 'chin', 'ທອດລູກຊີ້ນ', 'ลูกชิ้น', 'meatball', 'ທອດມັນ', 'มันฝรั่ง', 'french fries', 'ທອດຖົ່ວ', 'ถั่ว', 'peanuts', 'ທອດດູກຂ້າງ', 'ซี่โครง', 'ribs'],
        masterCategoryCode: 'MCAT-SNACKS'
    }
};

// =============================================================================
// TEXT NORMALIZATION
// =============================================================================

/**
 * Normalizes text for comparison while preserving Lao and Thai characters
 * 
 * Unicode Ranges:
 * - Thai: U+0E00 - U+0E7F
 * - Lao: U+0E80 - U+0EFF
 * 
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
const normalizeText = (text) => {
    if (!text) return '';
    
    return text
        // Convert to string if not already
        .toString()
        // Trim whitespace
        .trim()
        // Normalize whitespace (multiple spaces to single space)
        .replace(/\s+/g, ' ')
        // Convert English to lowercase (preserve Lao/Thai as-is)
        .replace(/[A-Z]/g, char => char.toLowerCase())
        // Remove only specific punctuation, keep all letters including Lao/Thai
        .replace(/[.,!?;:'"()\[\]{}<>\/\\@#$%^&*+=`~_\-]+/g, ' ')
        // Normalize whitespace again after punctuation removal
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Tokenize text into words/meaningful units
 * @param {string} text - Text to tokenize
 * @returns {string[]} Array of tokens
 */
const tokenizeText = (text) => {
    const normalized = normalizeText(text);
    if (!normalized) return [];
    
    // Split by whitespace
    return normalized.split(/\s+/).filter(token => token.length > 0);
};

// =============================================================================
// CATEGORY DETECTION
// =============================================================================

/**
 * Detects the category of a menu item based on keywords
 * @param {string} text - Menu name to analyze
 * @returns {Object} { category: string, confidence: number, masterCategoryCode: string }
 */
const detectCategory = (text) => {
    const normalizedText = normalizeText(text).toLowerCase();
    const tokens = tokenizeText(text).map(t => t.toLowerCase());
    
    let bestMatch = { category: 'UNKNOWN', confidence: 0, masterCategoryCode: null };
    
    for (const [category, config] of Object.entries(CATEGORY_KEYWORDS)) {
        let matchScore = 0;
        let matchCount = 0;
        
        // Check exclude keywords first - if found, skip this category
        if (config.excludeKeywords) {
            const hasExclude = config.excludeKeywords.some(kw => 
                normalizedText.includes(kw.toLowerCase())
            );
            if (hasExclude) continue;
        }
        
        // Check each keyword
        for (const keyword of config.keywords) {
            const kwLower = keyword.toLowerCase();
            
            // Exact token match (highest weight)
            if (tokens.includes(kwLower)) {
                matchScore += 3;
                matchCount++;
            }
            // Contains keyword (medium weight)
            else if (normalizedText.includes(kwLower)) {
                matchScore += 2;
                matchCount++;
            }
            // Keyword contains a token (lower weight)
            else if (tokens.some(t => kwLower.includes(t) && t.length >= 2)) {
                matchScore += 1;
                matchCount++;
            }
        }
        
        // Calculate confidence based on matches
        const confidence = matchCount > 0 ? Math.min(100, (matchScore / config.keywords.length) * 50 + matchCount * 10) : 0;
        
        if (confidence > bestMatch.confidence) {
            bestMatch = {
                category,
                confidence,
                masterCategoryCode: config.masterCategoryCode
            };
        }
    }
    
    return bestMatch;
};

// =============================================================================
// SIMILARITY ALGORITHMS
// =============================================================================

/**
 * Calculates Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
const levenshteinDistance = (str1, str2) => {
    const m = str1.length;
    const n = str2.length;
    
    if (m === 0) return n;
    if (n === 0) return m;
    
    // Create a 2D array to store the distances
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    // Initialize base cases
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    // Fill in the rest of the matrix
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,     // Deletion
                    dp[i][j - 1] + 1,     // Insertion
                    dp[i - 1][j - 1] + 1  // Substitution
                );
            }
        }
    }
    
    return dp[m][n];
};

/**
 * Calculates basic character similarity score between two strings (0 to 1)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
const calculateCharSimilarity = (str1, str2) => {
    const s1 = normalizeText(str1);
    const s2 = normalizeText(str2);
    
    if (s1 === s2) return 1;
    if (!s1 || !s2) return 0;
    
    const maxLen = Math.max(s1.length, s2.length);
    const distance = levenshteinDistance(s1, s2);
    
    return 1 - (distance / maxLen);
};

/**
 * Calculates token overlap score (Jaccard-like similarity)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Token overlap score (0-1)
 */
const calculateTokenOverlap = (str1, str2) => {
    const tokens1 = new Set(tokenizeText(str1).map(t => t.toLowerCase()));
    const tokens2 = new Set(tokenizeText(str2).map(t => t.toLowerCase()));
    
    if (tokens1.size === 0 || tokens2.size === 0) return 0;
    
    let intersection = 0;
    for (const token of tokens1) {
        if (tokens2.has(token)) {
            intersection++;
        }
    }
    
    // Jaccard similarity
    const union = tokens1.size + tokens2.size - intersection;
    return union > 0 ? intersection / union : 0;
};

/**
 * Checks if any significant keyword from master item is contained in the menu name
 * @param {string} menuName - The menu name to search in
 * @param {string[]} keywords - Keywords to find
 * @returns {Object} { found: boolean, matchedKeyword: string, isExactToken: boolean }
 */
const checkKeywordMatch = (menuName, keywords) => {
    if (!keywords || keywords.length === 0) return { found: false };
    
    const normalizedMenu = normalizeText(menuName).toLowerCase();
    const menuTokens = tokenizeText(menuName).map(t => t.toLowerCase());
    
    for (const keyword of keywords) {
        const kwLower = keyword.toLowerCase();
        
        // Exact token match
        if (menuTokens.includes(kwLower)) {
            return { found: true, matchedKeyword: keyword, isExactToken: true };
        }
        
        // Contains match (for longer keywords)
        if (kwLower.length >= 3 && normalizedMenu.includes(kwLower)) {
            return { found: true, matchedKeyword: keyword, isExactToken: false };
        }
    }
    
    return { found: false };
};

// =============================================================================
// MULTI-STRATEGY MATCHING
// =============================================================================

/**
 * Calculate similarity using multiple strategies and return combined score
 * 
 * Strategies:
 * 1. Exact match: 100%
 * 2. Keyword match (exact token): 95%
 * 3. Keyword match (contains): 85%
 * 4. Token overlap + char similarity: 60-80%
 * 5. Character similarity only: 40-60%
 * 
 * @param {string} query - Menu name to match
 * @param {Object} candidate - Master menu object with name, name_en, name_th, keywords, categoryCode
 * @param {string} queryCategory - Detected category of the query
 * @returns {Object} { score: number, matchType: string, details: Object }
 */
const calculateMultiStrategyScore = (query, candidate, queryCategory) => {
    const normalizedQuery = normalizeText(query);
    
    // Names to check
    const candidateNames = [
        candidate.name,
        candidate.name_en,
        candidate.name_th,
        candidate.name_vi,
        candidate.name_cn,
        candidate.name_kr,
        candidate.name_jp
    ].filter(Boolean);
    
    // Keywords from candidate
    const keywords = candidate.keywords || [];
    if (typeof keywords === 'string') {
        // Parse if it's a comma-separated string
        keywords = keywords.split(',').map(k => k.trim()).filter(Boolean);
    }
    
    let bestScore = 0;
    let bestMatchType = 'none';
    let bestMatchDetails = {};
    
    // Strategy 1: Exact match with any name variant
    for (const name of candidateNames) {
        if (normalizeText(name) === normalizedQuery) {
            return {
                score: 1.0,
                matchType: 'exact',
                details: { matchedName: name }
            };
        }
    }
    
    // Strategy 2: Keyword exact token match
    const keywordMatch = checkKeywordMatch(query, keywords);
    if (keywordMatch.found && keywordMatch.isExactToken) {
        const score = 0.95;
        if (score > bestScore) {
            bestScore = score;
            bestMatchType = 'keyword_exact';
            bestMatchDetails = { matchedKeyword: keywordMatch.matchedKeyword };
        }
    } else if (keywordMatch.found) {
        const score = 0.85;
        if (score > bestScore) {
            bestScore = score;
            bestMatchType = 'keyword_contains';
            bestMatchDetails = { matchedKeyword: keywordMatch.matchedKeyword };
        }
    }
    
    // Strategy 3: Token overlap + name similarity
    for (const name of candidateNames) {
        const tokenOverlap = calculateTokenOverlap(query, name);
        const charSimilarity = calculateCharSimilarity(query, name);
        
        // Combined score with weights
        const combinedScore = (tokenOverlap * 0.6) + (charSimilarity * 0.4);
        
        if (combinedScore > bestScore) {
            bestScore = combinedScore;
            bestMatchType = 'combined';
            bestMatchDetails = {
                matchedName: name,
                tokenOverlap: Math.round(tokenOverlap * 100),
                charSimilarity: Math.round(charSimilarity * 100)
            };
        }
    }
    
    // Strategy 4: Character similarity only (fallback)
    for (const name of candidateNames) {
        const charSimilarity = calculateCharSimilarity(query, name);
        
        // Only use if no better match found, and apply penalty
        const adjustedScore = charSimilarity * 0.7; // 30% penalty for char-only match
        
        if (adjustedScore > bestScore && bestMatchType === 'none') {
            bestScore = adjustedScore;
            bestMatchType = 'char_only';
            bestMatchDetails = {
                matchedName: name,
                charSimilarity: Math.round(charSimilarity * 100)
            };
        }
    }
    
    // Apply category penalty if categories don't match
    if (queryCategory && queryCategory !== 'UNKNOWN' && candidate.categoryCode) {
        const candidateCategory = detectCategory(candidate.name);
        if (candidateCategory.category !== 'UNKNOWN' && candidateCategory.category !== queryCategory) {
            // Different categories - apply significant penalty
            bestScore *= 0.3;
            bestMatchDetails.categoryMismatch = true;
            bestMatchDetails.queryCategory = queryCategory;
            bestMatchDetails.candidateCategory = candidateCategory.category;
        }
    }
    
    return {
        score: bestScore,
        matchType: bestMatchType,
        details: bestMatchDetails
    };
};

// =============================================================================
// MAIN MATCHING FUNCTION
// =============================================================================

/**
 * Finds the best matches from a list of master candidates using multi-strategy matching
 * 
 * @param {string} query - The menu name to match
 * @param {Array} candidates - Array of master menu objects
 * @param {Object} options - Options for matching
 * @param {number} options.threshold - Minimum similarity score (default 0.5)
 * @param {number} options.limit - Maximum number of results (default 5)
 * @param {boolean} options.categoryFilter - Enable category filtering (default true)
 * @returns {Array} Array of matches with scores, sorted by relevance
 */
const findBestMatches = (query, candidates, threshold = 0.5, limit = 5) => {
    if (!query || !candidates || candidates.length === 0) {
        return [];
    }
    
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
        return [];
    }
    
    // Detect query category
    const queryCategory = detectCategory(query);
    
    const results = [];
    
    for (const candidate of candidates) {
        const matchResult = calculateMultiStrategyScore(query, candidate, queryCategory.category);
        
        if (matchResult.score >= threshold) {
            results.push({
                candidate,
                score: matchResult.score,
                matchType: matchResult.matchType,
                details: matchResult.details,
                queryCategory: queryCategory
            });
        }
    }
    
    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    
    // Return top results
    return results.slice(0, limit);
};

/**
 * Legacy compatibility function
 */
const calculateSimilarity = (str1, str2) => {
    return calculateCharSimilarity(str1, str2);
};

/**
 * Legacy compatibility function
 */
const containsKeyword = (text, keyword) => {
    const normalizedText = normalizeText(text).toLowerCase();
    const normalizedKeyword = normalizeText(keyword).toLowerCase();
    return normalizedText.includes(normalizedKeyword);
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    // Core functions
    normalizeText,
    tokenizeText,
    detectCategory,
    
    // Similarity algorithms
    levenshteinDistance,
    calculateCharSimilarity,
    calculateTokenOverlap,
    checkKeywordMatch,
    calculateMultiStrategyScore,
    
    // Main matching function
    findBestMatches,
    
    // Legacy compatibility
    calculateSimilarity,
    containsKeyword,
    
    // Constants
    CATEGORY_KEYWORDS
};
