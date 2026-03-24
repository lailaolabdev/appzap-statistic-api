/**
 * Users Controller
 *
 * Proxies consumer user management endpoints to the Consumer API (server-to-server).
 * Uses ADS_ADMIN_KEY header for authentication.
 */

const CONSUMER_USERS_PATH = '/api/v1/admin/users';

function buildUrl(path) {
    const baseUrl = (process.env.CONSUMER_API_URL || '').replace(/\/+$/, '');
    return `${baseUrl}${path}`;
}

const usersController = {
    /**
     * Get paginated consumer users
     * GET /users → proxies to Consumer API GET /api/v1/admin/users
     */
    getUsers: async (req, res) => {
        try {
            if (!process.env.CONSUMER_API_URL) {
                return res.status(503).json({
                    success: false,
                    error: 'Consumer API not configured (CONSUMER_API_URL missing)',
                });
            }

            const params = new URLSearchParams();
            if (req.query.page) params.set('page', req.query.page);
            if (req.query.limit) params.set('limit', req.query.limit);
            if (req.query.phone) params.set('phone', req.query.phone);
            if (req.query.isDeleted !== undefined) params.set('isDeleted', req.query.isDeleted);

            const url = `${buildUrl(CONSUMER_USERS_PATH)}?${params.toString()}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': process.env.ADS_ADMIN_KEY || '',
                },
            });

            const json = await response.json();
            res.status(response.status).json(json);
        } catch (error) {
            console.error('[Users] Error fetching users:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get single consumer user detail
     * GET /users/:id → proxies to Consumer API GET /api/v1/admin/users/:id
     */
    getUserDetail: async (req, res) => {
        try {
            if (!process.env.CONSUMER_API_URL) {
                return res.status(503).json({
                    success: false,
                    error: 'Consumer API not configured (CONSUMER_API_URL missing)',
                });
            }

            const response = await fetch(
                buildUrl(`${CONSUMER_USERS_PATH}/${req.params.id}`),
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-key': process.env.ADS_ADMIN_KEY || '',
                    },
                }
            );

            const json = await response.json();
            res.status(response.status).json(json);
        } catch (error) {
            console.error('[Users] Error fetching user detail:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },
};

module.exports = usersController;
