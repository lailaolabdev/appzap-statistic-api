# Ads Management API Setup Guide

## Architecture

The **Statistics API** acts as a **proxy/gateway** that forwards Ads Management requests to the **Consumer API** via server-to-server calls.

```
Client/Postman
     ↓
Statistics API (localhost:5050)
     ↓ (HTTP proxy)
Consumer API (localhost:4000 or consumer-api.appzap.la)
     ↓
MongoDB (AppZap database)
```

## Environment Variables

Add these to your `.env` file:

```bash
# Ads Management - Server-to-Server Configuration
ADS_ADMIN_KEY=your_secure_admin_key_here
CONSUMER_API_URL=http://localhost:4000

# For production:
# CONSUMER_API_URL=https://consumer-api.appzap.la
```

## How It Works

1. **Statistics API** receives requests at `/api/v1/ads/*` endpoints
2. **Authentication middleware** validates the `x-admin-key` header
3. **Controllers** forward the request to Consumer API with the admin key
4. **Consumer API** processes the request using its MongoDB models
5. Response is proxied back to the client

## API Endpoints

All endpoints are available through the Statistics API (port 5050):

### Admin Endpoints (require `x-admin-key` header)
- `GET /api/v1/ads/admin/all` - List all ads
- `POST /api/v1/ads/admin` - Create ad
- `PUT /api/v1/ads/admin/:id` - Update ad
- `GET /api/v1/ads/admin/:id` - Get ad details with analytics
- `POST /api/v1/ads/admin/:id/approve` - Approve ad
- `POST /api/v1/ads/admin/:id/reject` - Reject ad
- `PATCH /api/v1/ads/admin/:id/status` - Update ad status
- `GET /api/v1/ads/admin/revenue` - Revenue summary

### Advertiser Management (require `x-admin-key` header)
- `GET /api/v1/advertisers` - List advertisers
- `POST /api/v1/advertisers` - Create advertiser
- `PUT /api/v1/advertisers/:id` - Update advertiser
- `GET /api/v1/advertisers/:id/analytics` - Get analytics & ROI
- `GET /api/v1/advertisers/:id/ads` - Get advertiser's ads
- `GET /api/v1/advertisers/check-exclusivity/:placement` - Check exclusivity

### Public Endpoints (no authentication)
- `GET /api/v1/ads?placement=...` - Get ads for placement
- `POST /api/v1/ads/:id/impression` - Track impression
- `POST /api/v1/ads/:id/click` - Track click
- `POST /api/v1/ads/:id/conversion` - Track conversion
- `GET /api/v1/ads/delivery?zone=...` - Get ads by zone
- `POST /api/v1/ads/track` - Fire-and-forget tracking

## Testing with Postman

1. Import `Ads_Management_API.postman_collection.json`
2. Update collection variables:
   - `base_url`: `http://localhost:5050` (Statistics API)
   - `ADS_ADMIN_KEY`: Your admin key from `.env`
3. Test endpoints - they will proxy to Consumer API

## Authentication

Admin endpoints require the `x-admin-key` header:

```bash
curl -H "x-admin-key: YOUR_ADS_ADMIN_KEY" \
  http://localhost:5050/api/v1/ads/admin/all
```

The Statistics API validates the key and forwards it to the Consumer API.

## Files Created

### HTTP Client
- `src/utils/consumerApiClient.js` - HTTP client for Consumer API calls

### Controllers (Proxy Pattern)
- `src/controllers/advertisementController.js` - Forwards ad management requests
- `src/controllers/advertiserController.js` - Forwards advertiser requests
- `src/controllers/adsDeliveryController.js` - Forwards public ad serving requests

### Routes
- `src/routes/v1/advertisement.js` - Admin ad routes
- `src/routes/v1/advertiser.js` - Advertiser routes
- `src/routes/v1/adsDelivery.js` - Public delivery routes

### Middleware
- `src/utils/adsAuth.js` - Admin API key validation

### Documentation
- `Ads_Management_API.postman_collection.json` - Postman collection
- `ADS_MANAGEMENT_API.md` - Complete API documentation

## Notes

- **No database models** in Statistics API - all data is in Consumer API
- **No Mongoose** dependency needed in Statistics API
- All business logic and data access happens in Consumer API
- Statistics API is a lightweight proxy/gateway layer
