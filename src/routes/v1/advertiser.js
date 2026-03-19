const express = require('express');
const { adminAuth } = require('../../utils/adsAuth');
const {
  getAllAdvertisers,
  createAdvertiser,
  updateAdvertiser,
  getAdvertiserAnalytics,
  getAdvertiserAds,
  checkPlacementExclusivity
} = require('../../controllers/advertiserController');

module.exports = (db) => {
  const router = express.Router();

  router.get('/', adminAuth, getAllAdvertisers);
  router.post('/', adminAuth, createAdvertiser);
  router.put('/:id', adminAuth, updateAdvertiser);
  router.get('/:id/analytics', adminAuth, getAdvertiserAnalytics);
  router.get('/:id/ads', adminAuth, getAdvertiserAds);
  router.get('/check-exclusivity/:placement', adminAuth, checkPlacementExclusivity);

  return router;
};
