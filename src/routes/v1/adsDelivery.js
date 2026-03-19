const express = require('express');
const {
  getAdsForPlacement,
  trackImpression,
  trackClick,
  trackConversion,
  getAdsByZone,
  trackEvent
} = require('../../controllers/adsDeliveryController');

module.exports = (db) => {
  const router = express.Router();

  router.get('/', getAdsForPlacement);
  router.post('/:id/impression', trackImpression);
  router.post('/:id/click', trackClick);
  router.post('/:id/conversion', trackConversion);
  router.get('/delivery', getAdsByZone);
  router.post('/track', trackEvent);

  return router;
};
