const express = require('express');
const { adminAuth } = require('../../utils/adsAuth');
const {
  getAllAds,
  createAd,
  updateAd,
  getAdDetails,
  approveAd,
  rejectAd,
  updateAdStatus,
  getRevenueSummary
} = require('../../controllers/advertisementController');

module.exports = (db) => {
  const router = express.Router();

  router.get('/admin/all', adminAuth, getAllAds);
  router.post('/admin', adminAuth, createAd);
  router.put('/admin/:id', adminAuth, updateAd);
  router.get('/admin/:id', adminAuth, getAdDetails);
  router.post('/admin/:id/approve', adminAuth, approveAd);
  router.post('/admin/:id/reject', adminAuth, rejectAd);
  router.patch('/admin/:id/status', adminAuth, updateAdStatus);
  router.get('/admin/revenue', adminAuth, getRevenueSummary);

  return router;
};
