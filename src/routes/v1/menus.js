// src/routes/v1/menus.js

const express = require('express');
const bestSellingMenusController = require('../../controllers/bestSellingMenusController');

const router = express.Router();

module.exports = (db) => {
    router.get('/best_selling_menus', (req, res) => bestSellingMenusController.getBestSellingMenus(req, res, db));
    return router;
};
