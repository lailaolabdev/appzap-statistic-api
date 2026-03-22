/**
 * Notifications Controller
 *
 * Proxies notification endpoints to the Consumer API (server-to-server).
 * Uses NOTIFICATIONS_ADMIN_KEY for admin broadcast dispatch.
 * Forwards Authorization (Bearer) header for user-authenticated endpoints.
 */

const CONSUMER_NOTIFICATIONS_PATH = "/api/v1/notifications";

function getConfig() {
  const baseUrl = process.env.CONSUMER_API_URL;
  const adminKey = process.env.ADS_ADMIN_KEY;
  if (!baseUrl || !adminKey) {
    return null;
  }
  return { baseUrl, adminKey };
}

function buildUrl(path) {
  const baseUrl = process.env.CONSUMER_API_URL;
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}${path}`;
}

const notificationsController = {
  /**
   * Register anonymous device (no auth required)
   * POST /notifications/device/register-public
   * Proxies to Consumer API — call on first app boot before user logs in
   */
  registerPublicDevice: async (req, res) => {
    try {
      if (!process.env.CONSUMER_API_URL) {
        return res
          .status(503)
          .json({
            success: false,
            error:
              "Notifications API not configured (CONSUMER_API_URL missing)",
          });
      }

      const response = await fetch(
        buildUrl(`${CONSUMER_NOTIFICATIONS_PATH}/device/register-public`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(req.body),
        },
      );

      const json = await response.json();
      res.status(response.status).json(json);
    } catch (error) {
      console.error("[Notifications] Error registering public device:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Register authenticated user device (Bearer token required)
   * POST /notifications/device/register
   * Forwards Authorization header — binds FCM token to authenticated user
   */
  registerDevice: async (req, res) => {
    try {
      if (!process.env.CONSUMER_API_URL) {
        return res
          .status(503)
          .json({
            success: false,
            error:
              "Notifications API not configured (CONSUMER_API_URL missing)",
          });
      }

      const authHeader = req.headers["authorization"];
      const headers = { "Content-Type": "application/json" };
      if (authHeader) {
        headers["Authorization"] = authHeader;
      }

      const response = await fetch(
        buildUrl(`${CONSUMER_NOTIFICATIONS_PATH}/device/register`),
        {
          method: "POST",
          headers,
          body: JSON.stringify(req.body),
        },
      );

      const json = await response.json();
      res.status(response.status).json(json);
    } catch (error) {
      console.error("[Notifications] Error registering device:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Register admin/merchant device (Bearer token + admin role required)
   * POST /notifications/admin/register
   * Forwards Authorization header — registers device for system notifications
   */
  registerAdminDevice: async (req, res) => {
    try {
      if (!process.env.CONSUMER_API_URL) {
        return res
          .status(503)
          .json({
            success: false,
            error:
              "Notifications API not configured (CONSUMER_API_URL missing)",
          });
      }

      const authHeader = req.headers["authorization"];
      const headers = { "Content-Type": "application/json" };
      if (authHeader) {
        headers["Authorization"] = authHeader;
      }

      const response = await fetch(
        buildUrl(`${CONSUMER_NOTIFICATIONS_PATH}/admin/register`),
        {
          method: "POST",
          headers,
          body: JSON.stringify(req.body),
        },
      );

      const json = await response.json();
      res.status(response.status).json(json);
    } catch (error) {
      console.error("[Notifications] Error registering admin device:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Dispatch demographic-targeted broadcast (admin key required)
   * POST /notifications/admin/broadcast/dispatch
   * Returns 202 Accepted — Consumer API processes in background worker
   */
  dispatchBroadcast: async (req, res) => {
    try {
      const config = getConfig();
      if (!config) {
        return res
          .status(503)
          .json({
            success: false,
            error:
              "Notifications API not configured (CONSUMER_API_URL / NOTIFICATIONS_ADMIN_KEY missing)",
          });
      }

      const response = await fetch(
        buildUrl(`${CONSUMER_NOTIFICATIONS_PATH}/admin/broadcast/dispatch`),
        {
          method: "POST",
          headers: {
            "x-admin-key": config.adminKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(req.body),
        },
      );

      const json = await response.json();
      res.status(response.status).json(json);
    } catch (error) {
      console.error("[Notifications] Error dispatching broadcast:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
};

module.exports = notificationsController;
