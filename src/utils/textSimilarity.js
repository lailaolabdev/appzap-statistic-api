/**
 * Text Similarity Utility
 * Provides functions for text matching and similarity scoring
 * Used for auto-suggestion of menu/category mappings
 */

/**
 * Normalizes text for comparison
 * - Converts to lowercase
 * - Removes extra whitespace
 * - Removes common punctuation
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
const normalizeText = (text) => {
    if (!text) return '';
    return text
        .toLowerCase()
        .trim()
        .replace(/[\s\-_]+/g, ' ')  // Normalize whitespace and separators
        .replace(/[^\w\s\u0E00-\u0E7F\u0EA0-\u0EDF]/g, ''); // Keep alphanumeric, Thai, and Lao characters
};

/**
 * Calculates Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
const levenshteinDistance = (str1, str2) => {
    const m = str1.length;
    const n = str2.length;
    
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
 * Calculates similarity score between two strings (0 to 1)
 * 1 = identical, 0 = completely different
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
const calculateSimilarity = (str1, str2) => {
    const s1 = normalizeText(str1);
    const s2 = normalizeText(str2);
    
    if (s1 === s2) return 1;
    if (!s1 || !s2) return 0;
    
    const maxLen = Math.max(s1.length, s2.length);
    const distance = levenshteinDistance(s1, s2);
    
    return 1 - (distance / maxLen);
};

/**
 * Checks if a string contains another string (keyword matching)
 * @param {string} text - Text to search in
 * @param {string} keyword - Keyword to find
 * @returns {boolean} Whether keyword is found
 */
const containsKeyword = (text, keyword) => {
    const normalizedText = normalizeText(text);
    const normalizedKeyword = normalizeText(keyword);
    return normalizedText.includes(normalizedKeyword);
};

/**
 * Finds the best matches from a list of candidates
 * @param {string} query - The text to match
 * @param {Array} candidates - Array of objects with 'name' and 'keywords' fields
 * @param {number} threshold - Minimum similarity score (default 0.3)
 * @param {number} limit - Maximum number of results (default 5)
 * @returns {Array} Array of matches with scores, sorted by relevance
 */
const findBestMatches = (query, candidates, threshold = 0.3, limit = 5) => {
    const normalizedQuery = normalizeText(query);
    const results = [];
    
    for (const candidate of candidates) {
        let maxScore = 0;
        let matchType = 'similarity';
        
        // Check exact name match
        const nameSimilarity = calculateSimilarity(normalizedQuery, candidate.name);
        if (nameSimilarity > maxScore) {
            maxScore = nameSimilarity;
            matchType = 'name';
        }
        
        // Check name_en if available
        if (candidate.name_en) {
            const enSimilarity = calculateSimilarity(normalizedQuery, candidate.name_en);
            if (enSimilarity > maxScore) {
                maxScore = enSimilarity;
                matchType = 'name_en';
            }
        }
        
        // Check name_th if available
        if (candidate.name_th) {
            const thSimilarity = calculateSimilarity(normalizedQuery, candidate.name_th);
            if (thSimilarity > maxScore) {
                maxScore = thSimilarity;
                matchType = 'name_th';
            }
        }
        
        // Check keywords
        if (candidate.keywords && Array.isArray(candidate.keywords)) {
            for (const keyword of candidate.keywords) {
                // Exact keyword match gets high score
                if (containsKeyword(normalizedQuery, keyword) || containsKeyword(keyword, normalizedQuery)) {
                    const keywordScore = 0.8; // High score for keyword match
                    if (keywordScore > maxScore) {
                        maxScore = keywordScore;
                        matchType = 'keyword';
                    }
                }
                
                // Similarity to keyword
                const keywordSimilarity = calculateSimilarity(normalizedQuery, keyword);
                if (keywordSimilarity > maxScore) {
                    maxScore = keywordSimilarity;
                    matchType = 'keyword_similarity';
                }
            }
        }
        
        if (maxScore >= threshold) {
            results.push({
                candidate,
                score: maxScore,
                matchType
            });
        }
    }
    
    // Sort by score descending and limit results
    return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
};

module.exports = {
    normalizeText,
    levenshteinDistance,
    calculateSimilarity,
    containsKeyword,
    findBestMatches
};
