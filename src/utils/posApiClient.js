/**
 * POS API Client
 *
 * HTTP client for fetching data from POS v2 API instead of querying
 * the database directly. This follows the architectural rule that the
 * statistics API must not access POS databases directly.
 */

const axios = require('axios');

const POS_V2_API_URL = process.env.POS_V2_API_URL || 'https://api-v2.appzap.la/api/v1';
const POS_V2_API_TOKEN = process.env.POS_V2_API_TOKEN || '';

const headers = { 'Content-Type': 'application/json' };
if (POS_V2_API_TOKEN) {
    headers['Authorization'] = `Bearer ${POS_V2_API_TOKEN}`;
}

const posV2Client = axios.create({
    baseURL: POS_V2_API_URL,
    timeout: 30000,
    headers,
});

/**
 * Map a raw POS v2 restaurant object into the unified format
 * used by getUnifiedRestaurants().
 */
function mapV2Restaurant(restaurant) {
    const daysLeft = restaurant.packageInfo?.endDate
        ? Math.ceil((new Date(restaurant.packageInfo.endDate) - new Date()) / (1000 * 60 * 60 * 24))
        : null;

    return {
        ...restaurant,
        _id: restaurant._id,
        posVersion: 'v2',
        restaurantId: (restaurant._id || '').toString(),
        phone: restaurant.contactInfo?.phone,
        whatsapp: restaurant.contactInfo?.whatsapp,
        startDate: restaurant.packageInfo?.startDate,
        endDate: restaurant.packageInfo?.endDate,
        paymentStatus: restaurant.packageInfo?.paymentStatus,
        packageLevel: restaurant.packageInfo?.level,
        packagePrice: restaurant.packageInfo?.packagePrice,
        daysLeft,
        province: restaurant.address?.state,
        district: restaurant.address?.city,
        village: restaurant.address?.street,
        latitude: restaurant.address?.coordinates?.latitude,
        longitude: restaurant.address?.coordinates?.longitude,
        storeType: restaurant.storeType,
    };
}

/**
 * Fetch restaurants from POS v2 API.
 *
 * @param {Object} params - Query parameters
 * @param {string} [params.search] - Search term (name, code, phone)
 * @param {number} [params.page] - Page number (1-based)
 * @param {number} [params.limit] - Results per page
 * @returns {Promise<Array>} Array of restaurants in unified format
 */
async function fetchV2Restaurants(params = {}) {
    try {
        const queryParams = {};

        if (params.search) queryParams.search = params.search;
        queryParams.page = params.page || 1;
        queryParams.limit = params.limit || 500;

        if (params.paymentStatus && params.paymentStatus.toLowerCase() !== 'all') {
            queryParams.paymentStatus = params.paymentStatus;
        }

        console.log(`[PosApiClient] GET ${POS_V2_API_URL}/restaurants`, queryParams);

        const response = await posV2Client.get('/restaurants', { params: queryParams });

        console.log(`[PosApiClient] Response status: ${response.status}`);

        // Handle different possible response shapes from the POS v2 API
        const rawData = response.data;
        let restaurants = [];

        if (Array.isArray(rawData)) {
            restaurants = rawData;
        } else if (rawData?.data && Array.isArray(rawData.data)) {
            restaurants = rawData.data;
        } else if (rawData?.data?.results && Array.isArray(rawData.data.results)) {
            restaurants = rawData.data.results;
        } else if (rawData?.results && Array.isArray(rawData.results)) {
            restaurants = rawData.results;
        } else {
            console.warn('[PosApiClient] Unexpected response shape. Raw keys:', Object.keys(rawData || {}));
            console.warn('[PosApiClient] Full response (first 500 chars):', JSON.stringify(rawData).substring(0, 500));
            restaurants = [];
        }

        console.log(`[PosApiClient] Fetched ${restaurants.length} V2 restaurants`);

        return restaurants.map(mapV2Restaurant);
    } catch (error) {
        console.error('[PosApiClient] Error fetching V2 restaurants:', error.message);
        if (error.response) {
            console.error('[PosApiClient] Response status:', error.response.status);
            console.error('[PosApiClient] Response data:', JSON.stringify(error.response.data).substring(0, 500));
        }
        return [];
    }
}

/**
 * Fetch a single restaurant from POS v2 API by ID.
 */
async function fetchV2RestaurantById(restaurantId) {
    try {
        const response = await posV2Client.get(`/restaurants/${restaurantId}`);
        const rawData = response.data;
        const restaurant = rawData?.data || rawData;
        return restaurant ? mapV2Restaurant(restaurant) : null;
    } catch (error) {
        console.error(`[PosApiClient] Error fetching V2 restaurant ${restaurantId}:`, error.message);
        return null;
    }
}

module.exports = {
    fetchV2Restaurants,
    fetchV2RestaurantById,
    mapV2Restaurant,
};
