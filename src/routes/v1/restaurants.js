// src/routes/v1/restaurants.js

const express = require('express');
const restaurantsController = require('../../controllers/restaurantsController');

const router = express.Router();

module.exports = (db) => {
    router.get('/', (req, res) => restaurantsController.getRestaurants(req, res, db));
    // Route for fetching restaurant income
    router.get('/income', (req, res) => restaurantsController.getRestaurantsIncome(req, res, db));

    return router;
};

