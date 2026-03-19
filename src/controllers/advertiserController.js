const consumerApiClient = require("../utils/consumerApiClient");

const getAllAdvertisers = async (req, res) => {
  try {
    const queryString = new URLSearchParams(req.query).toString();
    const path = `/api/v1/advertisers${queryString ? "?" + queryString : ""}`;

    const headers = {};
    if (req.headers["authorization"]) {
      headers["authorization"] = req.headers["authorization"];
    }

    const response = await consumerApiClient.get(path, headers);

    res.status(response.statusCode).json(response.data);
  } catch (error) {
    console.error("Error fetching advertisers:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const createAdvertiser = async (req, res) => {
  try {
    const headers = {};
    if (req.headers["authorization"]) {
      headers["authorization"] = req.headers["authorization"];
    }

    const response = await consumerApiClient.post(
      "/api/v1/advertisers",
      req.body,
      headers,
    );

    res.status(response.statusCode).json(response.data);
  } catch (error) {
    console.error("Error creating advertiser:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const updateAdvertiser = async (req, res) => {
  try {
    const { id } = req.params;
    const headers = {};
    if (req.headers["authorization"]) {
      headers["authorization"] = req.headers["authorization"];
    }

    const response = await consumerApiClient.put(
      `/api/v1/advertisers/${id}`,
      req.body,
      headers,
    );

    res.status(response.statusCode).json(response.data);
  } catch (error) {
    console.error("Error updating advertiser:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getAdvertiserAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const queryString = new URLSearchParams(req.query).toString();
    const path = `/api/v1/advertisers/${id}/analytics${queryString ? "?" + queryString : ""}`;

    const headers = {};
    if (req.headers["authorization"]) {
      headers["authorization"] = req.headers["authorization"];
    }

    const response = await consumerApiClient.get(path, headers);

    res.status(response.statusCode).json(response.data);
  } catch (error) {
    console.error("Error fetching advertiser analytics:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getAdvertiserAds = async (req, res) => {
  try {
    const { id } = req.params;
    const headers = {};
    if (req.headers["authorization"]) {
      headers["authorization"] = req.headers["authorization"];
    }

    const response = await consumerApiClient.get(
      `/api/v1/advertisers/${id}/ads`,
      headers,
    );

    res.status(response.statusCode).json(response.data);
  } catch (error) {
    console.error("Error fetching advertiser ads:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const checkPlacementExclusivity = async (req, res) => {
  try {
    const { placement } = req.params;
    const headers = {};
    if (req.headers["authorization"]) {
      headers["authorization"] = req.headers["authorization"];
    }

    const response = await consumerApiClient.get(
      `/api/v1/advertisers/check-exclusivity/${placement}`,
      headers,
    );

    res.status(response.statusCode).json(response.data);
  } catch (error) {
    console.error("Error checking placement exclusivity:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getAllAdvertisers,
  createAdvertiser,
  updateAdvertiser,
  getAdvertiserAnalytics,
  getAdvertiserAds,
  checkPlacementExclusivity,
};
