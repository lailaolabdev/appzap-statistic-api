const consumerApiClient = require("../utils/consumerApiClient");

const getAllAds = async (req, res) => {
  try {
    const queryString = new URLSearchParams(req.query).toString();
    const path = `/api/v1/ads/admin/all${queryString ? "?" + queryString : ""}`;

    const headers = {};
    if (req.headers["authorization"]) {
      headers["authorization"] = req.headers["authorization"];
    }

    const response = await consumerApiClient.get(path, headers);

    res.status(response.statusCode).json(response.data);
  } catch (error) {
    console.error("Error fetching ads:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const createAd = async (req, res) => {
  try {
    const headers = {};
    if (req.headers["authorization"]) {
      headers["authorization"] = req.headers["authorization"];
    }

    const response = await consumerApiClient.post(
      "/api/v1/ads/admin",
      req.body,
      headers,
    );

    res.status(response.statusCode).json(response.data);
  } catch (error) {
    console.error("Error creating ad:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const updateAd = async (req, res) => {
  try {
    const { id } = req.params;
    const headers = {};
    if (req.headers["authorization"]) {
      headers["authorization"] = req.headers["authorization"];
    }

    const response = await consumerApiClient.put(
      `/api/v1/ads/admin/${id}`,
      req.body,
      headers,
    );

    res.status(response.statusCode).json(response.data);
  } catch (error) {
    console.error("Error updating ad:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getAdDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const headers = {};
    if (req.headers["authorization"]) {
      headers["authorization"] = req.headers["authorization"];
    }

    const response = await consumerApiClient.get(
      `/api/v1/ads/admin/${id}`,
      headers,
    );

    res.status(response.statusCode).json(response.data);
  } catch (error) {
    console.error("Error fetching ad details:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const approveAd = async (req, res) => {
  try {
    const { id } = req.params;
    const headers = {};
    if (req.headers["authorization"]) {
      headers["authorization"] = req.headers["authorization"];
    }

    const response = await consumerApiClient.post(
      `/api/v1/ads/admin/${id}/approve`,
      {},
      headers,
    );

    res.status(response.statusCode).json(response.data);
  } catch (error) {
    console.error("Error approving ad:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const rejectAd = async (req, res) => {
  try {
    const { id } = req.params;
    const headers = {};
    if (req.headers["authorization"]) {
      headers["authorization"] = req.headers["authorization"];
    }

    const response = await consumerApiClient.post(
      `/api/v1/ads/admin/${id}/reject`,
      req.body,
      headers,
    );

    res.status(response.statusCode).json(response.data);
  } catch (error) {
    console.error("Error rejecting ad:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const updateAdStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const headers = {};
    if (req.headers["authorization"]) {
      headers["authorization"] = req.headers["authorization"];
    }

    const response = await consumerApiClient.patch(
      `/api/v1/ads/admin/${id}/status`,
      req.body,
      headers,
    );

    res.status(response.statusCode).json(response.data);
  } catch (error) {
    console.error("Error updating ad status:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getRevenueSummary = async (req, res) => {
  try {
    const queryString = new URLSearchParams(req.query).toString();
    const path = `/api/v1/ads/admin/revenue${queryString ? "?" + queryString : ""}`;

    const headers = {};
    if (req.headers["authorization"]) {
      headers["authorization"] = req.headers["authorization"];
    }

    const response = await consumerApiClient.get(path, headers);

    res.status(response.statusCode).json(response.data);
  } catch (error) {
    console.error("Error fetching revenue summary:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getAllAds,
  createAd,
  updateAd,
  getAdDetails,
  approveAd,
  rejectAd,
  updateAdStatus,
  getRevenueSummary,
};
