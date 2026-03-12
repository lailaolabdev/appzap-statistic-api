/**
 * Admin Auth Routes
 *
 * POST /api/v1/admin/auth/login  — issue a 24-hour admin JWT
 * GET  /api/v1/admin/auth/me     — return current admin info (requires token)
 */

const express = require('express');
const { signAdminToken, requireAdminAuth } = require('../../middleware/adminAuth');

const router = express.Router();

// Admin credentials from env (MVP: plain-text. Upgrade to bcrypt for production.)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'appzapAdmin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'appzapAdmin@V2';

/**
 * POST /api/v1/admin/auth/login
 * Body: { userId: string, password: string }
 * Compatible with the dashboard's existing loginWithUserId() call format.
 */
router.post('/login', (req, res) => {
    const { userId, password } = req.body;

    if (!userId || !password) {
        return res.status(400).json({
            success: false,
            error: { code: 'MISSING_CREDENTIALS', message: 'userId and password are required' },
        });
    }

    // Validate credentials
    if (userId !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        return res.status(401).json({
            success: false,
            error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect username or password' },
        });
    }

    // Issue JWT
    const user = {
        userId: 'admin-001',
        username: ADMIN_USERNAME,
        name: 'Admin User',
        role: 'admin',
    };

    const accessToken = signAdminToken(user);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return res.json({
        success: true,
        user,
        tokens: {
            access: {
                token: accessToken,
                expires: expiresAt,
            },
        },
    });
});

/**
 * GET /api/v1/admin/auth/me
 * Returns the currently authenticated admin's info.
 */
router.get('/me', requireAdminAuth, (req, res) => {
    return res.json({
        success: true,
        user: req.admin,
    });
});

module.exports = router;
