/**
 * Ads Management Controller
 *
 * Proxies ads CRUD operations to the Consumer API (server-to-server).
 * Uses ADS_ADMIN_KEY for authentication and CONSUMER_API_URL as base URL.
 */

const CONSUMER_ADS_PATH = '/api/v1/ads-management';

function getConfig() {
    const baseUrl = process.env.CONSUMER_API_URL;
    const adminKey = process.env.ADS_ADMIN_KEY;
    if (!baseUrl || !adminKey) {
        return null;
    }
    return { baseUrl, adminKey };
}

function buildUrl(path) {
    const { baseUrl } = getConfig();
    // Remove trailing slash from baseUrl
    const base = baseUrl.replace(/\/+$/, '');
    return `${base}${path}`;
}

const adsManagementController = {
    /**
     * Upload images for ads
     * POST /ads-management/upload
     * Forwards multipart form data to consumer API
     */
    uploadImages: async (req, res) => {
        try {
            const config = getConfig();
            if (!config) {
                return res.status(503).json({ success: false, error: 'Ads API not configured (CONSUMER_API_URL / ADS_ADMIN_KEY missing)' });
            }

            // Forward the raw request body for multipart
            const contentType = req.headers['content-type'];
            if (!contentType || !contentType.includes('multipart/form-data')) {
                return res.status(400).json({ success: false, error: 'Content-Type must be multipart/form-data' });
            }

            // Collect raw body chunks
            const chunks = [];
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', async () => {
                try {
                    const body = Buffer.concat(chunks);
                    const response = await fetch(buildUrl(`${CONSUMER_ADS_PATH}/upload`), {
                        method: 'POST',
                        headers: {
                            'x-admin-key': config.adminKey,
                            'content-type': contentType,
                        },
                        body,
                    });

                    const json = await response.json();
                    res.status(response.status).json(json);
                } catch (error) {
                    console.error('[AdsManagement] Error forwarding upload:', error);
                    res.status(500).json({ success: false, error: error.message });
                }
            });
        } catch (error) {
            console.error('[AdsManagement] Error uploading images:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Create a new ad
     * POST /ads-management
     */
    createAd: async (req, res) => {
        try {
            const config = getConfig();
            if (!config) {
                return res.status(503).json({ success: false, error: 'Ads API not configured (CONSUMER_API_URL / ADS_ADMIN_KEY missing)' });
            }

            const response = await fetch(buildUrl(CONSUMER_ADS_PATH), {
                method: 'POST',
                headers: {
                    'x-admin-key': config.adminKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(req.body),
            });

            const json = await response.json();
            res.status(response.status).json(json);
        } catch (error) {
            console.error('[AdsManagement] Error creating ad:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get all ads with optional filters
     * GET /ads-management?status=&type=&placement=&skip=&limit=
     */
    getAds: async (req, res) => {
        try {
            const config = getConfig();
            if (!config) {
                return res.status(503).json({ success: false, error: 'Ads API not configured (CONSUMER_API_URL / ADS_ADMIN_KEY missing)' });
            }

            // Forward query parameters
            const queryString = new URLSearchParams(req.query).toString();
            const url = queryString
                ? `${buildUrl(CONSUMER_ADS_PATH)}?${queryString}`
                : buildUrl(CONSUMER_ADS_PATH);

            const response = await fetch(url, {
                headers: {
                    'x-admin-key': config.adminKey,
                },
            });

            const json = await response.json();
            res.status(response.status).json(json);
        } catch (error) {
            console.error('[AdsManagement] Error getting ads:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get a single ad by ID
     * GET /ads-management/:id
     */
    getAdById: async (req, res) => {
        try {
            const config = getConfig();
            if (!config) {
                return res.status(503).json({ success: false, error: 'Ads API not configured (CONSUMER_API_URL / ADS_ADMIN_KEY missing)' });
            }

            const { id } = req.params;
            const response = await fetch(buildUrl(`${CONSUMER_ADS_PATH}/${id}`), {
                headers: {
                    'x-admin-key': config.adminKey,
                },
            });

            const json = await response.json();
            res.status(response.status).json(json);
        } catch (error) {
            console.error('[AdsManagement] Error getting ad:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Update an ad
     * PUT /ads-management/:id
     */
    updateAd: async (req, res) => {
        try {
            const config = getConfig();
            if (!config) {
                return res.status(503).json({ success: false, error: 'Ads API not configured (CONSUMER_API_URL / ADS_ADMIN_KEY missing)' });
            }

            const { id } = req.params;
            const response = await fetch(buildUrl(`${CONSUMER_ADS_PATH}/${id}`), {
                method: 'PUT',
                headers: {
                    'x-admin-key': config.adminKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(req.body),
            });

            const json = await response.json();
            res.status(response.status).json(json);
        } catch (error) {
            console.error('[AdsManagement] Error updating ad:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Delete an ad
     * DELETE /ads-management/:id
     */
    deleteAd: async (req, res) => {
        try {
            const config = getConfig();
            if (!config) {
                return res.status(503).json({ success: false, error: 'Ads API not configured (CONSUMER_API_URL / ADS_ADMIN_KEY missing)' });
            }

            const { id } = req.params;
            const response = await fetch(buildUrl(`${CONSUMER_ADS_PATH}/${id}`), {
                method: 'DELETE',
                headers: {
                    'x-admin-key': config.adminKey,
                },
            });

            const json = await response.json();
            res.status(response.status).json(json);
        } catch (error) {
            console.error('[AdsManagement] Error deleting ad:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },
};

module.exports = adsManagementController;
