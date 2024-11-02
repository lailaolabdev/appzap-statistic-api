// src/routes/v1/restaurants.js

const express = require('express');
const restaurantsController = require('../../controllers/restaurantsController');

const router = express.Router();

module.exports = (db) => {
    router.get('/', (req, res) => restaurantsController.getRestaurants(req, res, db));
    return router;
};

