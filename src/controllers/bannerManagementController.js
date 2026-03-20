/**
 * Banner Management Controller
 *
 * Proxies banner CRUD and consumer endpoints to the Consumer API (server-to-server).
 * Admin endpoints use ADS_ADMIN_KEY for authentication.
 * Consumer endpoints (placement, tracking) require no auth.
 */

const ADMIN_PATH = '/api/v1/banner-management';
const CONSUMER_PATH = '/api/v1/banners';

function getConfig() {
    const baseUrl = process.env.CONSUMER_API_URL;
    const adminKey = process.env.ADS_ADMIN_KEY;
    if (!baseUrl || !adminKey) {
        return null;
    }
    return { baseUrl, adminKey };
}

function buildUrl(path) {
    const base = (process.env.CONSUMER_API_URL || '').replace(/\/+$/, '');
    return `${base}${path}`;
}

const bannerManagementController = {
    // ==================== ADMIN ENDPOINTS ====================

    /**
     * Upload banner images (multipart/form-data)
     * POST /banner-management/upload
     */
    uploadImages: async (req, res) => {
        try {
            const config = getConfig();
            if (!config) {
                return res.status(503).json({ success: false, error: 'Banner API not configured (CONSUMER_API_URL / ADS_ADMIN_KEY missing)' });
            }

            const contentType = req.headers['content-type'];
            if (!contentType || !contentType.includes('multipart/form-data')) {
                return res.status(400).json({ success: false, error: 'Content-Type must be multipart/form-data' });
            }

            const chunks = [];
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', async () => {
                try {
                    const body = Buffer.concat(chunks);
                    const response = await fetch(buildUrl(`${ADMIN_PATH}/upload`), {
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
                    console.error('[BannerManagement] Error forwarding upload:', error);
                    res.status(500).json({ success: false, error: error.message });
                }
            });
        } catch (error) {
            console.error('[BannerManagement] Error uploading images:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Create a new banner
     * POST /banner-management
     */
    createBanner: async (req, res) => {
        try {
            const config = getConfig();
            if (!config) {
                return res.status(503).json({ success: false, error: 'Banner API not configured (CONSUMER_API_URL / ADS_ADMIN_KEY missing)' });
            }

            const response = await fetch(buildUrl(ADMIN_PATH), {
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
            console.error('[BannerManagement] Error creating banner:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get all banners with optional filters
     * GET /banner-management?status=&placement=&skip=&limit=
     */
    getBanners: async (req, res) => {
        try {
            const config = getConfig();
            if (!config) {
                return res.status(503).json({ success: false, error: 'Banner API not configured (CONSUMER_API_URL / ADS_ADMIN_KEY missing)' });
            }

            const queryString = new URLSearchParams(req.query).toString();
            const url = queryString
                ? `${buildUrl(ADMIN_PATH)}?${queryString}`
                : buildUrl(ADMIN_PATH);

            const response = await fetch(url, {
                headers: {
                    'x-admin-key': config.adminKey,
                },
            });

            const json = await response.json();
            res.status(response.status).json(json);
        } catch (error) {
            console.error('[BannerManagement] Error getting banners:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get a single banner by ID
     * GET /banner-management/:id
     */
    getBannerById: async (req, res) => {
        try {
            const config = getConfig();
            if (!config) {
                return res.status(503).json({ success: false, error: 'Banner API not configured (CONSUMER_API_URL / ADS_ADMIN_KEY missing)' });
            }

            const { id } = req.params;
            const response = await fetch(buildUrl(`${ADMIN_PATH}/${id}`), {
                headers: {
                    'x-admin-key': config.adminKey,
                },
            });

            const json = await response.json();
            res.status(response.status).json(json);
        } catch (error) {
            console.error('[BannerManagement] Error getting banner:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Update a banner
     * PUT /banner-management/:id
     */
    updateBanner: async (req, res) => {
        try {
            const config = getConfig();
            if (!config) {
                return res.status(503).json({ success: false, error: 'Banner API not configured (CONSUMER_API_URL / ADS_ADMIN_KEY missing)' });
            }

            const { id } = req.params;
            const response = await fetch(buildUrl(`${ADMIN_PATH}/${id}`), {
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
            console.error('[BannerManagement] Error updating banner:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Delete a banner
     * DELETE /banner-management/:id
     */
    deleteBanner: async (req, res) => {
        try {
            const config = getConfig();
            if (!config) {
                return res.status(503).json({ success: false, error: 'Banner API not configured (CONSUMER_API_URL / ADS_ADMIN_KEY missing)' });
            }

            const { id } = req.params;
            const response = await fetch(buildUrl(`${ADMIN_PATH}/${id}`), {
                method: 'DELETE',
                headers: {
                    'x-admin-key': config.adminKey,
                },
            });

            const json = await response.json();
            res.status(response.status).json(json);
        } catch (error) {
            console.error('[BannerManagement] Error deleting banner:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // ==================== CONSUMER ENDPOINTS ====================

    /**
     * Get banners by placement (no auth required)
     * GET /banners/placement/:placement
     */
    getBannersByPlacement: async (req, res) => {
        try {
            const { placement } = req.params;
            const response = await fetch(buildUrl(`${CONSUMER_PATH}/placement/${placement}`));

            const json = await response.json();
            res.status(response.status).json(json);
        } catch (error) {
            console.error('[BannerManagement] Error getting banners by placement:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Track banner impression (no auth required)
     * POST /banners/:id/impression
     */
    trackImpression: async (req, res) => {
        try {
            const { id } = req.params;
            const response = await fetch(buildUrl(`${CONSUMER_PATH}/${id}/impression`), {
                method: 'POST',
            });

            const json = await response.json();
            res.status(response.status).json(json);
        } catch (error) {
            console.error('[BannerManagement] Error tracking impression:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Track banner click (no auth required)
     * POST /banners/:id/click
     */
    trackClick: async (req, res) => {
        try {
            const { id } = req.params;
            const response = await fetch(buildUrl(`${CONSUMER_PATH}/${id}/click`), {
                method: 'POST',
            });

            const json = await response.json();
            res.status(response.status).json(json);
        } catch (error) {
            console.error('[BannerManagement] Error tracking click:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },
};

module.exports = bannerManagementController;
