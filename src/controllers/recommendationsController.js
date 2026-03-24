/**
 * Recommendations Controller
 *
 * Proxies admin pinned-restaurant recommendation endpoints to the Consumer API
 * (server-to-server) using ADS_ADMIN_KEY.
 */

const CONSUMER_RECO_PATH = '/api/v1/admin/recommendations';

function buildUrl(path) {
    const baseUrl = (process.env.CONSUMER_API_URL || '').replace(/\/+$/, '');
    return `${baseUrl}${path}`;
}

function adminHeaders() {
    return {
        'Content-Type': 'application/json',
        'x-admin-key': process.env.ADS_ADMIN_KEY || '',
    };
}

const recommendationsController = {
    getRecommendations: async (req, res) => {
        try {
            if (!process.env.CONSUMER_API_URL) {
                return res.status(503).json({ success: false, error: 'CONSUMER_API_URL not configured' });
            }

            const params = new URLSearchParams();
            if (req.query.page) params.set('page', req.query.page);
            if (req.query.limit) params.set('limit', req.query.limit);
            if (req.query.isActive !== undefined) params.set('isActive', req.query.isActive);

            const response = await fetch(`${buildUrl(CONSUMER_RECO_PATH)}?${params.toString()}`, {
                method: 'GET',
                headers: adminHeaders(),
            });

            const json = await response.json();
            res.status(response.status).json(json);
        } catch (error) {
            console.error('[Recommendations] getRecommendations error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    createRecommendation: async (req, res) => {
        try {
            if (!process.env.CONSUMER_API_URL) {
                return res.status(503).json({ success: false, error: 'CONSUMER_API_URL not configured' });
            }

            const response = await fetch(buildUrl(CONSUMER_RECO_PATH), {
                method: 'POST',
                headers: adminHeaders(),
                body: JSON.stringify(req.body),
            });

            const json = await response.json();
            res.status(response.status).json(json);
        } catch (error) {
            console.error('[Recommendations] createRecommendation error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    updateRecommendation: async (req, res) => {
        try {
            if (!process.env.CONSUMER_API_URL) {
                return res.status(503).json({ success: false, error: 'CONSUMER_API_URL not configured' });
            }

            const response = await fetch(buildUrl(`${CONSUMER_RECO_PATH}/${req.params.id}`), {
                method: 'PUT',
                headers: adminHeaders(),
                body: JSON.stringify(req.body),
            });

            const json = await response.json();
            res.status(response.status).json(json);
        } catch (error) {
            console.error('[Recommendations] updateRecommendation error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    deleteRecommendation: async (req, res) => {
        try {
            if (!process.env.CONSUMER_API_URL) {
                return res.status(503).json({ success: false, error: 'CONSUMER_API_URL not configured' });
            }

            const response = await fetch(buildUrl(`${CONSUMER_RECO_PATH}/${req.params.id}`), {
                method: 'DELETE',
                headers: adminHeaders(),
            });

            const json = await response.json();
            res.status(response.status).json(json);
        } catch (error) {
            console.error('[Recommendations] deleteRecommendation error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },
};

module.exports = recommendationsController;
