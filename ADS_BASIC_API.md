# Basic Ads Management API

Simple CRUD API for ads management with multi-image upload support. Uses `ADS_ADMIN_KEY` for server-to-server authentication.

## Base URL

```
/api/v1/ads-management
```

## Authentication

All endpoints require the `ADS_ADMIN_KEY` header:

```bash
x-admin-key: YOUR_ADS_ADMIN_KEY
```

Get your key from `.env` file:
```bash
ADS_ADMIN_KEY=c89042be847246eb3ae2ed4c9c3ed02d5fd9981103b9fda7644a03722b7672f4
```

---

## Endpoints

### 1. Upload Images

Upload multiple images for ads (up to 5 images, max 5MB each).

**Endpoint:** `POST /api/v1/ads-management/upload`

**Headers:**
```
x-admin-key: YOUR_ADS_ADMIN_KEY
Content-Type: multipart/form-data
```

**Body (Form Data):**
- `images`: File[] (multiple image files)

**Example (cURL):**
```bash
curl -X POST http://localhost:9000/api/v1/ads-management/upload \
  -H "x-admin-key: c89042be847246eb3ae2ed4c9c3ed02d5fd9981103b9fda7644a03722b7672f4" \
  -F "images=@banner.jpg" \
  -F "images=@mobile-banner.jpg"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "urls": [
      "https://appzap-assets.s3.ap-southeast-1.amazonaws.com/ads/uuid1.jpg",
      "https://appzap-assets.s3.ap-southeast-1.amazonaws.com/ads/uuid2.jpg"
    ],
    "count": 2
  }
}
```

---

### 2. Create Ad

Create a new advertisement.

**Endpoint:** `POST /api/v1/ads-management`

**Headers:**
```
x-admin-key: YOUR_ADS_ADMIN_KEY
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Heineken Summer Campaign",
  "description": "Summer promotion for Heineken 0.0",
  "type": "banner",
  "placement": "eat_hero_banner",
  "advertiser": {
    "name": "Heineken",
    "companyName": "Heineken Laos Co., Ltd",
    "phone": "+856 20 1234 5678",
    "email": "marketing@heineken.la"
  },
  "content": {
    "imageUrl": "https://appzap-assets.s3.amazonaws.com/ads/uuid1.jpg",
    "imageUrlMobile": "https://appzap-assets.s3.amazonaws.com/ads/uuid2.jpg",
    "title": "Heineken 0.0 - Now Available",
    "subtitle": "Order now and get 20% off",
    "ctaText": "Order Now",
    "ctaUrl": "appzap://restaurant/123"
  },
  "targeting": {
    "provinces": ["Vientiane", "Luang Prabang"],
    "languages": ["en", "lo"]
  },
  "schedule": {
    "startDate": "2026-06-01T00:00:00Z",
    "endDate": "2026-08-31T23:59:59Z"
  },
  "pricing": {
    "type": "cpm",
    "amount": 50000,
    "currency": "LAK"
  },
  "priority": 90,
  "weight": 80
}
```

**Example (cURL):**
```bash
curl -X POST http://localhost:9000/api/v1/ads-management \
  -H "x-admin-key: c89042be847246eb3ae2ed4c9c3ed02d5fd9981103b9fda7644a03722b7672f4" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Campaign",
    "type": "banner",
    "placement": "eat_hero_banner",
    "advertiser": {
      "name": "Test Advertiser",
      "phone": "+856 20 1234 5678",
      "email": "test@example.com"
    },
    "content": {
      "imageUrl": "https://example.com/banner.jpg"
    },
    "schedule": {
      "startDate": "2026-06-01T00:00:00Z",
      "endDate": "2026-08-31T23:59:59Z"
    },
    "pricing": {
      "type": "flat",
      "amount": 1000000,
      "currency": "LAK"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "65f1234567890abcdef12345",
    "name": "Test Campaign",
    "status": "pending_approval",
    ...
  }
}
```

---

### 3. Get All Ads

Retrieve all ads with optional filters.

**Endpoint:** `GET /api/v1/ads-management`

**Headers:**
```
x-admin-key: YOUR_ADS_ADMIN_KEY
```

**Query Parameters:**
- `status` (optional): Filter by status (draft, pending_approval, approved, active, paused, ended, rejected)
- `type` (optional): Filter by type (banner, popup, interstitial, native, sponsored)
- `placement` (optional): Filter by placement
- `skip` (optional): Pagination offset (default: 0)
- `limit` (optional): Results per page (default: 20)

**Example:**
```bash
curl -H "x-admin-key: c89042be847246eb3ae2ed4c9c3ed02d5fd9981103b9fda7644a03722b7672f4" \
  "http://localhost:9000/api/v1/ads-management?status=pending_approval&limit=10"
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "total": 45,
  "skip": 0,
  "limit": 10
}
```

---

### 4. Get Ad by ID

Retrieve a single ad by its ID.

**Endpoint:** `GET /api/v1/ads-management/:id`

**Headers:**
```
x-admin-key: YOUR_ADS_ADMIN_KEY
```

**Example:**
```bash
curl -H "x-admin-key: c89042be847246eb3ae2ed4c9c3ed02d5fd9981103b9fda7644a03722b7672f4" \
  http://localhost:9000/api/v1/ads-management/65f1234567890abcdef12345
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "65f1234567890abcdef12345",
    "name": "Heineken Summer Campaign",
    ...
  }
}
```

---

### 5. Update Ad

Update an existing ad (partial update supported).

**Endpoint:** `PUT /api/v1/ads-management/:id`

**Headers:**
```
x-admin-key: YOUR_ADS_ADMIN_KEY
Content-Type: application/json
```

**Body:** (all fields optional)
```json
{
  "name": "Updated Campaign Name",
  "content": {
    "imageUrl": "https://new-image-url.jpg",
    "title": "Updated Title"
  },
  "status": "active"
}
```

**Example:**
```bash
curl -X PUT http://localhost:9000/api/v1/ads-management/65f1234567890abcdef12345 \
  -H "x-admin-key: c89042be847246eb3ae2ed4c9c3ed02d5fd9981103b9fda7644a03722b7672f4" \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "65f1234567890abcdef12345",
    "status": "active",
    ...
  }
}
```

---

### 6. Delete Ad

Delete an ad permanently.

**Endpoint:** `DELETE /api/v1/ads-management/:id`

**Headers:**
```
x-admin-key: YOUR_ADS_ADMIN_KEY
```

**Example:**
```bash
curl -X DELETE http://localhost:9000/api/v1/ads-management/65f1234567890abcdef12345 \
  -H "x-admin-key: c89042be847246eb3ae2ed4c9c3ed02d5fd9981103b9fda7644a03722b7672f4"
```

**Response:**
```json
{
  "success": true,
  "message": "Ad deleted successfully"
}
```

---

## Complete Workflow Example

### Step 1: Upload Images

```bash
curl -X POST http://localhost:9000/api/v1/ads-management/upload \
  -H "x-admin-key: c89042be847246eb3ae2ed4c9c3ed02d5fd9981103b9fda7644a03722b7672f4" \
  -F "images=@heineken-banner.jpg" \
  -F "images=@heineken-mobile.jpg"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "urls": [
      "https://appzap-assets.s3.amazonaws.com/ads/abc123.jpg",
      "https://appzap-assets.s3.amazonaws.com/ads/def456.jpg"
    ],
    "count": 2
  }
}
```

### Step 2: Create Ad with Uploaded Images

```bash
curl -X POST http://localhost:9000/api/v1/ads-management \
  -H "x-admin-key: c89042be847246eb3ae2ed4c9c3ed02d5fd9981103b9fda7644a03722b7672f4" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Heineken Summer Campaign",
    "type": "banner",
    "placement": "eat_hero_banner",
    "advertiser": {
      "name": "Heineken",
      "phone": "+856 20 1234 5678",
      "email": "marketing@heineken.la"
    },
    "content": {
      "imageUrl": "https://appzap-assets.s3.amazonaws.com/ads/abc123.jpg",
      "imageUrlMobile": "https://appzap-assets.s3.amazonaws.com/ads/def456.jpg",
      "title": "Heineken 0.0",
      "subtitle": "Order now and get 20% off",
      "ctaText": "Order Now"
    },
    "schedule": {
      "startDate": "2026-06-01T00:00:00Z",
      "endDate": "2026-08-31T23:59:59Z"
    },
    "pricing": {
      "type": "cpm",
      "amount": 50000,
      "currency": "LAK"
    }
  }'
```

### Step 3: Get All Ads

```bash
curl -H "x-admin-key: c89042be847246eb3ae2ed4c9c3ed02d5fd9981103b9fda7644a03722b7672f4" \
  http://localhost:9000/api/v1/ads-management
```

### Step 4: Update Ad Status

```bash
curl -X PUT http://localhost:9000/api/v1/ads-management/RETURNED_AD_ID \
  -H "x-admin-key: c89042be847246eb3ae2ed4c9c3ed02d5fd9981103b9fda7644a03722b7672f4" \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}'
```

---

## Error Responses

**401 Unauthorized:**
```json
{
  "success": false,
  "error": "Unauthorized - Invalid or missing admin key"
}
```

**400 Bad Request:**
```json
{
  "success": false,
  "error": "No images provided"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Ad not found"
}
```

**500 Server Error:**
```json
{
  "success": false,
  "error": "Failed to upload images"
}
```

---

## Image Upload Requirements

- **Max file size:** 5MB per image
- **Max files:** 5 images per request
- **Allowed formats:** JPG, PNG, GIF, WebP
- **Recommended dimensions:** 
  - Desktop banner: 1200x628px
  - Mobile banner: 800x600px

---

## S3 Configuration

Make sure your `.env` file has S3 credentials configured:

```bash
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=appzap-assets
S3_REGION=ap-southeast-1
# Optional: For MinIO or custom S3 endpoint
S3_ENDPOINT=https://s3.example.com
```

---

## Integration with Statistic API

This API is designed for server-to-server communication. The statistic API backend can call these endpoints using the `ADS_ADMIN_KEY`:

```javascript
// Example: Statistic API calling Consumer API
const response = await fetch('http://consumer-api:9000/api/v1/ads-management', {
  method: 'POST',
  headers: {
    'x-admin-key': process.env.ADS_ADMIN_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(adData)
});
```

---

**Last Updated:** March 19, 2026  
**API Version:** v1  
**Maintained by:** AppZap Engineering Team
