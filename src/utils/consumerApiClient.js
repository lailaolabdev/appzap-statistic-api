const https = require("https");
const http = require("http");

const getConsumerApiUrl = () => {
  return process.env.CONSUMER_API_URL || "http://localhost:9000";
};

const makeRequest = (method, path, data = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const baseUrl = getConsumerApiUrl();
    const url = new URL(path, baseUrl);
    const isHttps = url.protocol === "https:";
    const lib = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
      const body = JSON.stringify(data);
      options.headers["Content-Length"] = Buffer.byteLength(body);
    }

    const req = lib.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        try {
          const parsed = responseData ? JSON.parse(responseData) : {};
          resolve({
            statusCode: res.statusCode,
            data: parsed,
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: responseData,
          });
        }
      });
    });

    req.on("error", (error) => {
      reject({
        message: "Network error connecting to consumer API",
        error: error.message,
      });
    });

    if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
};

const consumerApiClient = {
  get: (path, headers = {}) => makeRequest("GET", path, null, headers),
  post: (path, data, headers = {}) => makeRequest("POST", path, data, headers),
  put: (path, data, headers = {}) => makeRequest("PUT", path, data, headers),
  patch: (path, data, headers = {}) =>
    makeRequest("PATCH", path, data, headers),
  delete: (path, headers = {}) => makeRequest("DELETE", path, null, headers),
};

module.exports = consumerApiClient;
