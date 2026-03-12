/**
 * Admin JWT Authentication Middleware
 *
 * Verifies the Bearer token on incoming admin dashboard requests.
 * Token is issued by POST /api/v1/admin/auth/login and signed with ADMIN_JWT_SECRET.
 */

const jwt = require('jsonwebtoken');

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'appzap-admin-api-secret-2026';

/**
 * Middleware: require a valid admin JWT.
 * Attaches req.admin = { userId, username, role } on success.
 */
function requireAdminAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' },
        });
    }

    const token = authHeader.slice(7);

    try {
        const payload = jwt.verify(token, ADMIN_JWT_SECRET);
        req.admin = payload;
        return next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'TOKEN_INVALID',
                message: err.name === 'TokenExpiredError' ? 'Token expired, please log in again' : 'Invalid token',
            },
        });
    }
}

/**
 * Issue an admin JWT. Called by the login route.
 */
function signAdminToken(payload) {
    return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: '24h' });
}

module.exports = { requireAdminAuth, signAdminToken };
