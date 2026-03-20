/**
 * Live Events Controller
 *
 * Proxies live events admin CRUD and consumer feed to the Consumer API (server-to-server).
 * Admin endpoints use ADS_ADMIN_KEY for authentication.
 * Consumer endpoints (public feed) require no auth.
 */

const ADMIN_PATH = "/api/v1/discover/events/admin";
const CONSUMER_PATH = "/api/v1/discover/events";

function getConfig() {
  const baseUrl = process.env.CONSUMER_API_URL;
  const adminKey = process.env.EVENTS_ADMIN_KEY;
  if (!baseUrl || !adminKey) {
    return null;
  }
  return { baseUrl, adminKey };
}

function buildUrl(path) {
  const base = (process.env.CONSUMER_API_URL || "").replace(/\/+$/, "");
  return `${base}${path}`;
}

const liveEventsController = {
  // ==================== ADMIN ENDPOINTS ====================

  /**
   * Create a new event
   * POST /discover/events/admin
   */
  createEvent: async (req, res) => {
    try {
      const config = getConfig();
      if (!config) {
        return res
          .status(503)
          .json({
            success: false,
            error:
              "Events API not configured (CONSUMER_API_URL / ADS_ADMIN_KEY missing)",
          });
      }

      const response = await fetch(buildUrl(ADMIN_PATH), {
        method: "POST",
        headers: {
          "x-admin-key": config.adminKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      });

      const json = await response.json();
      res.status(response.status).json(json);
    } catch (error) {
      console.error("[LiveEvents] Error creating event:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Get all events (admin view with drafts)
   * GET /discover/events/admin?page=&limit=&isDraft=
   */
  getEvents: async (req, res) => {
    try {
      const config = getConfig();
      if (!config) {
        return res
          .status(503)
          .json({
            success: false,
            error:
              "Events API not configured (CONSUMER_API_URL / ADS_ADMIN_KEY missing)",
          });
      }

      const queryString = new URLSearchParams(req.query).toString();
      const url = queryString
        ? `${buildUrl(ADMIN_PATH)}?${queryString}`
        : buildUrl(ADMIN_PATH);

      const response = await fetch(url, {
        headers: {
          "x-admin-key": config.adminKey,
        },
      });

      const json = await response.json();
      res.status(response.status).json(json);
    } catch (error) {
      console.error("[LiveEvents] Error getting events:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Update an event
   * PUT /discover/events/admin/:id
   */
  updateEvent: async (req, res) => {
    try {
      const config = getConfig();
      if (!config) {
        return res
          .status(503)
          .json({
            success: false,
            error:
              "Events API not configured (CONSUMER_API_URL / ADS_ADMIN_KEY missing)",
          });
      }

      const { id } = req.params;
      const response = await fetch(buildUrl(`${ADMIN_PATH}/${id}`), {
        method: "PUT",
        headers: {
          "x-admin-key": config.adminKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      });

      const json = await response.json();
      res.status(response.status).json(json);
    } catch (error) {
      console.error("[LiveEvents] Error updating event:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Publish or unpublish an event
   * PATCH /discover/events/admin/:id/publish
   */
  publishEvent: async (req, res) => {
    try {
      const config = getConfig();
      if (!config) {
        return res
          .status(503)
          .json({
            success: false,
            error:
              "Events API not configured (CONSUMER_API_URL / ADS_ADMIN_KEY missing)",
          });
      }

      const { id } = req.params;
      const response = await fetch(buildUrl(`${ADMIN_PATH}/${id}/publish`), {
        method: "PATCH",
        headers: {
          "x-admin-key": config.adminKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      });

      const json = await response.json();
      res.status(response.status).json(json);
    } catch (error) {
      console.error("[LiveEvents] Error publishing event:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Delete an event
   * DELETE /discover/events/admin/:id
   */
  deleteEvent: async (req, res) => {
    try {
      const config = getConfig();
      if (!config) {
        return res
          .status(503)
          .json({
            success: false,
            error:
              "Events API not configured (CONSUMER_API_URL / ADS_ADMIN_KEY missing)",
          });
      }

      const { id } = req.params;
      const response = await fetch(buildUrl(`${ADMIN_PATH}/${id}`), {
        method: "DELETE",
        headers: {
          "x-admin-key": config.adminKey,
        },
      });

      const json = await response.json();
      res.status(response.status).json(json);
    } catch (error) {
      console.error("[LiveEvents] Error deleting event:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // ==================== CONSUMER ENDPOINTS ====================

  /**
   * Get live events feed (no auth required)
   * GET /discover/events?limit=
   */
  getLiveEvents: async (req, res) => {
    try {
      const queryString = new URLSearchParams(req.query).toString();
      const url = queryString
        ? `${buildUrl(CONSUMER_PATH)}?${queryString}`
        : buildUrl(CONSUMER_PATH);

      const response = await fetch(url);

      const json = await response.json();
      res.status(response.status).json(json);
    } catch (error) {
      console.error("[LiveEvents] Error getting live events:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
};

module.exports = liveEventsController;
