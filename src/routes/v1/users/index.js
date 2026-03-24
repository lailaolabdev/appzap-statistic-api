/**
 * Consumer Users Routes
 *
 * Proxies consumer user management to the Consumer API.
 *
 *   GET  /users        — paginated user list (phone/isDeleted filters)
 *   GET  /users/:id    — single user detail
 */

const express = require('express');
const usersController = require('../../../controllers/usersController');

module.exports = (db) => {
    const router = express.Router();

    router.get('/', (req, res) => usersController.getUsers(req, res));
    router.get('/:id', (req, res) => usersController.getUserDetail(req, res));

    return router;
};
