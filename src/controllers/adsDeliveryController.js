const consumerApiClient = require("../utils/consumerApiClient");

const getAdsForPlacement = async (req, res) => {
  try {
    const queryString = new URLSearchParams(req.query).toString();
    const path = `/api/v1/ads${queryString ? "?" + queryString : ""}`;

    const response = await consumerApiClient.get(path);

    res.status(response.statusCode).json(response.data);
  } catch (error) {
    console.error("Error fetching ads for placement:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const trackImpression = async (req, res) => {
  try {
    const { id } = req.params;

    const response = await consumerApiClient.post(
      `/api/v1/ads/${id}/impression`,
      req.body,
    );

    res.status(response.statusCode).json(response.data);
  } catch (error) {
    console.error("Error tracking impression:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const trackClick = async (req, res) => {
  try {
    const { id } = req.params;

    const response = await consumerApiClient.post(
      `/api/v1/ads/${id}/click`,
      req.body,
    );

    res.status(response.statusCode).json(response.data);
  } catch (error) {
    console.error("Error tracking click:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const trackConversion = async (req, res) => {
  try {
    const { id } = req.params;

    const response = await consumerApiClient.post(
      `/api/v1/ads/${id}/conversion`,
      req.body,
    );

    res.status(response.statusCode).json(response.data);
  } catch (error) {
    console.error("Error tracking conversion:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getAdsByZone = async (req, res) => {
  try {
    const queryString = new URLSearchParams(req.query).toString();
    const path = `/api/v1/ads/delivery${queryString ? "?" + queryString : ""}`;

    const response = await consumerApiClient.get(path);

    res.status(response.statusCode).json(response.data);
  } catch (error) {
    console.error("Error fetching ads by zone:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const trackEvent = async (req, res) => {
  try {
    const response = await consumerApiClient.post(
      "/api/v1/ads/track",
      req.body,
    );

    res.status(response.statusCode).send();
  } catch (error) {
    console.error("Error in track event:", error);
    res.status(204).send();
  }
};

module.exports = {
  getAdsForPlacement,
  trackImpression,
  trackClick,
  trackConversion,
  getAdsByZone,
  trackEvent,
};
