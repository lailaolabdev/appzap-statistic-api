// src/routes/v1/statistics.js

const express = require('express');
const statisticsController = require('../../controllers/statisticsController');

const router = express.Router();

module.exports = (db) => {
    router.get('/', (req, res) => statisticsController.getStatistics(req, res, db));
    return router;
};
