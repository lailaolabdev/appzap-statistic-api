# Ads Management API Documentation

Complete guide for the AppZap Consumer API Advertisement Management System.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [API Endpoints](#api-endpoints)
5. [Data Models](#data-models)
6. [Ad Targeting](#ad-targeting)
7. [Analytics & Reporting](#analytics--reporting)
8. [Examples](#examples)
9. [Best Practices](#best-practices)

---

## Overview

The Ads Management API provides a comprehensive system for managing advertisements, advertisers, and ad campaigns across the AppZap platform. It supports multiple ad types, placements, targeting options, and pricing models.

### Key Features

- **Multi-placement Support** - Home, Eat, Market, Activity, Stay hubs
- **Advanced Targeting** - Location, demographics, user behavior, device
- **Flexible Pricing** - CPM, CPC, CPA, Flat fee models
- **Real-time Tracking** - Impressions, clicks, conversions
- **Budget Management** - Daily and total budget caps
- **Analytics & ROI** - Comprehensive reporting for advertisers
- **Exclusivity Management** - Placement exclusivity for premium sponsors

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
│              (Flutter App, Web Dashboard)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Routes Layer                          │
│  ┌──────────────┬──────────────┬─────────────────────┐     │
│  │ advertisement│ advertiser   │ ads.delivery        │     │
│  │ .routes.ts   │ .routes.ts   │ .routes.ts          │     │
│  └──────────────┴──────────────┴─────────────────────┘     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer                              │
│  ┌──────────────────────┬──────────────────────────┐        │
│  │ advertisement.service│ advertiser.service       │        │
│  └──────────────────────┴──────────────────────────┘        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Models                               │
│  ┌──────────────┬──────────────┬─────────────────────┐     │
│  │ Advertisement│ Advertiser   │ AdAnalytics         │     │
│  └──────────────┴──────────────┴─────────────────────┘     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
                  MongoDB Database
```

### Models

- **Advertisement** - Individual ad campaigns with content, targeting, budget
- **Advertiser** - Sponsors/advertisers with contracts and exclusivity
- **AdAnalytics** - Time-series analytics data for reporting

---

## Authentication

### Admin Authentication

Admin endpoints require either:

1. **Admin API Key** (recommended for server-to-server)
   ```bash
   curl -H "x-admin-key: YOUR_ADS_ADMIN_KEY" \
     https://api.appzap.la/api/v1/ads/admin/all
   ```

2. **JWT Token** (for authenticated users with admin role)
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://api.appzap.la/api/v1/ads/admin/all
   ```

### Public Endpoints

Public ad serving and tracking endpoints do not require authentication.

---

## API Endpoints

### Public Endpoints (Ad Serving)

#### Get Ads for Placement

```http
GET /api/v1/ads
```

**Query Parameters:**
- `placement` (required) - Ad placement ID
- `province` (optional) - User's province
- `language` (optional) - User's language (en, lo, th)
- `nationality` (optional) - User's nationality (ISO code)
- `userType` (optional) - new, returning, premium, inactive
- `device` (optional) - ios, android
- `limit` (optional) - Number of ads to return (default: 5)

**Example Request:**
```bash
curl "https://api.appzap.la/api/v1/ads?placement=eat_hero_banner&province=Vientiane&language=en&limit=3"
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65f1234567890abcdef12345",
      "name": "Heineken Summer Campaign",
      "type": "banner",
      "placement": "eat_hero_banner",
      "content": {
        "imageUrl": "https://cdn.appzap.la/ads/heineken-banner.jpg",
        "imageUrlMobile": "https://cdn.appzap.la/ads/heineken-banner-mobile.jpg",
        "title": "Heineken 0.0 - Now Available",
        "subtitle": "Order now and get 20% off",
        "ctaText": "Order Now",
        "ctaUrl": "appzap://restaurant/123"
      },
      "priority": 90,
      "weight": 80
    }
  ]
}
```

#### Track Ad Impression

```http
POST /api/v1/ads/:id/impression
```

**Body:**
```json
{
  "sessionId": "session_abc123",
  "userId": "user_xyz789"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Impression tracked"
}
```

#### Track Ad Click

```http
POST /api/v1/ads/:id/click
```

**Body:**
```json
{
  "sessionId": "session_abc123",
  "userId": "user_xyz789"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Click tracked",
  "redirectUrl": "appzap://restaurant/123"
}
```

#### Track Ad Conversion

```http
POST /api/v1/ads/:id/conversion
```

**Body:**
```json
{
  "revenue": 150000
}
```

**Response:**
```json
{
  "success": true,
  "message": "Conversion tracked"
}
```

---

### Admin Endpoints (Ad Management)

#### Get All Ads

```http
GET /api/v1/ads/admin/all
```

**Query Parameters:**
- `status` (optional) - draft, pending_approval, approved, active, paused, ended, rejected
- `type` (optional) - banner, popup, interstitial, native, sponsored
- `placement` (optional) - Placement ID
- `skip` (optional) - Pagination offset (default: 0)
- `limit` (optional) - Results per page (default: 20)

**Example Request:**
```bash
curl -H "x-admin-key: YOUR_KEY" \
  "https://api.appzap.la/api/v1/ads/admin/all?status=active&limit=10"
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "total": 45
}
```

#### Create Ad

```http
POST /api/v1/ads/admin
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
  "sponsorId": "65f1234567890abcdef12345",
  "content": {
    "imageUrl": "https://cdn.appzap.la/ads/heineken-banner.jpg",
    "imageUrlMobile": "https://cdn.appzap.la/ads/heineken-banner-mobile.jpg",
    "title": "Heineken 0.0 - Now Available",
    "subtitle": "Order now and get 20% off",
    "ctaText": "Order Now",
    "ctaUrl": "appzap://restaurant/123"
  },
  "targeting": {
    "provinces": ["Vientiane", "Luang Prabang"],
    "languages": ["en", "lo"],
    "nationalities": ["US", "GB", "FR", "TH"],
    "userTypes": ["new", "returning"],
    "devices": ["ios", "android"]
  },
  "schedule": {
    "startDate": "2026-06-01T00:00:00Z",
    "endDate": "2026-08-31T23:59:59Z",
    "timezone": "Asia/Vientiane"
  },
  "budget": {
    "daily": 500000,
    "total": 15000000,
    "currency": "LAK"
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

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Ad created successfully"
}
```

#### Update Ad

```http
PUT /api/v1/ads/admin/:id
```

**Body:** Same as create, partial updates allowed

#### Get Ad Details with Analytics

```http
GET /api/v1/ads/admin/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ad": { ... },
    "roi": 245.5,
    "costPerConversion": 25000
  }
}
```

#### Approve Ad

```http
POST /api/v1/ads/admin/:id/approve
```

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Ad approved successfully"
}
```

#### Reject Ad

```http
POST /api/v1/ads/admin/:id/reject
```

**Body:**
```json
{
  "reason": "Image quality does not meet standards"
}
```

#### Update Ad Status

```http
PATCH /api/v1/ads/admin/:id/status
```

**Body:**
```json
{
  "status": "active"
}
```

Valid statuses: `draft`, `pending_approval`, `approved`, `active`, `paused`, `ended`, `rejected`

#### Get Revenue Summary

```http
GET /api/v1/ads/admin/revenue
```

**Query Parameters:**
- `startDate` (optional) - ISO date string
- `endDate` (optional) - ISO date string

**Response:**
```json
{
  "success": true,
  "data": {
    "totalImpressions": 1500000,
    "totalClicks": 45000,
    "totalConversions": 2500,
    "totalRevenue": 125000000,
    "averageCtr": 3.0
  }
}
```

---

### Advertiser Management Endpoints

#### Get All Advertisers

```http
GET /api/v1/advertisers
```

**Query Parameters:**
- `status` (optional) - pending, active, paused, expired, cancelled
- `category` (optional) - beverage_beer, telecom, banking, etc.
- `productScope` (optional) - eat, market, activity, stay, home, all

#### Create Advertiser

```http
POST /api/v1/advertisers
```

**Body:**
```json
{
  "name": "Heineken",
  "companyName": "Heineken Laos Co., Ltd",
  "logo": "https://cdn.appzap.la/logos/heineken.png",
  "website": "https://heineken.com",
  "category": "beverage_beer",
  "contacts": [
    {
      "name": "John Doe",
      "email": "john@heineken.la",
      "phone": "+856 20 1234 5678",
      "role": "Marketing Manager"
    }
  ],
  "billingEmail": "billing@heineken.la",
  "contract": {
    "startDate": "2026-01-01T00:00:00Z",
    "endDate": "2026-12-31T23:59:59Z",
    "monthlyBudget": 50000000,
    "totalBudget": 600000000,
    "currency": "LAK",
    "productScope": ["eat", "home"],
    "exclusivePlacements": ["eat_hero_banner", "eat_deal_card"]
  }
}
```

#### Get Advertiser Analytics

```http
GET /api/v1/advertisers/:id/analytics
```

**Query Parameters:**
- `startDate` (optional) - ISO date string
- `endDate` (optional) - ISO date string

**Response:**
```json
{
  "success": true,
  "data": {
    "sponsor": { ... },
    "period": {
      "start": "2026-03-01T00:00:00Z",
      "end": "2026-03-31T23:59:59Z"
    },
    "summary": {
      "totalImpressions": 500000,
      "totalClicks": 15000,
      "totalConversions": 800,
      "totalRevenue": 40000000,
      "totalSpend": 25000000,
      "remainingBudget": 25000000,
      "daysRemaining": 275
    },
    "byPlacement": [...],
    "dailyTrend": [...],
    "adPerformance": [...]
  }
}
```

#### Get Ads by Advertiser

```http
GET /api/v1/advertisers/:id/ads
```

#### Check Placement Exclusivity

```http
GET /api/v1/advertisers/check-exclusivity/:placement
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isExclusive": true,
    "sponsor": { ... }
  }
}
```

---

### Ad Delivery Routes (Lightweight)

#### Get Ads by Zone

```http
GET /api/v1/ads/delivery
```

**Query Parameters:**
- `zone` (required) - HOME_CAROUSEL, INTERSTITIAL, SEARCH_SPONSOR, EAT_BETWEEN
- `limit` (optional) - Default: 5
- `device` (optional) - ios, android

**Example:**
```bash
curl "https://api.appzap.la/api/v1/ads/delivery?zone=HOME_CAROUSEL&limit=3"
```

**Response:**
```json
{
  "success": true,
  "zone": "HOME_CAROUSEL",
  "count": 3,
  "data": [
    {
      "id": "65f1234567890abcdef12345",
      "type": "banner",
      "placement": "home_top",
      "imageUrl": "https://cdn.appzap.la/ads/banner.jpg",
      "imageUrlMobile": "https://cdn.appzap.la/ads/banner-mobile.jpg",
      "title": "Special Offer",
      "subtitle": "Limited time only",
      "ctaText": "Shop Now",
      "ctaUrl": "appzap://market/deals",
      "linkedEntityId": "123",
      "linkedEntityType": "restaurant"
    }
  ]
}
```

#### Track Event (Fire-and-Forget)

```http
POST /api/v1/ads/track
```

**Body:**
```json
{
  "adId": "65f1234567890abcdef12345",
  "eventType": "impression",
  "sessionId": "session_abc123",
  "userId": "user_xyz789"
}
```

**Response:** `204 No Content` (immediate response, tracking happens async)

---

## Data Models

### Advertisement Model

```typescript
{
  name: string;                    // Internal name
  description?: string;
  
  // Advertiser info
  advertiser: {
    name: string;
    companyName?: string;
    phone: string;
    email: string;
    userId?: ObjectId;
  };
  
  sponsorId?: ObjectId;            // Link to Advertiser collection
  
  // Ad configuration
  type: 'banner' | 'popup' | 'interstitial' | 'native' | 'sponsored';
  placement: AdPlacement;          // See placements list below
  size?: string;                   // "320x50", "300x250", etc.
  
  // Content
  content: {
    imageUrl: string;
    imageUrlMobile?: string;
    title?: string;
    subtitle?: string;
    description?: string;
    ctaText?: string;
    ctaUrl?: string;
    backgroundColor?: string;
    textColor?: string;
  };
  
  // Targeting
  targeting: {
    provinces?: string[];
    landmarks?: string[];
    userTypes?: ('new' | 'returning' | 'premium' | 'inactive')[];
    languages?: string[];
    nationalities?: string[];
    ageRange?: { min?: number; max?: number };
    genders?: ('male' | 'female' | 'other')[];
    interests?: string[];
    devices?: ('ios' | 'android')[];
  };
  
  // Schedule
  schedule: {
    startDate: Date;
    endDate: Date;
    timezone?: string;
    daysOfWeek?: number[];         // 0=Sunday, 6=Saturday
    hoursOfDay?: number[];         // 0-23
  };
  
  // Budget
  budget?: {
    daily?: number;
    total?: number;
    currency: 'LAK' | 'USD';
    spent: number;
  };
  
  // Pricing
  pricing: {
    type: 'cpm' | 'cpc' | 'cpa' | 'flat';
    amount: number;
    currency: 'LAK' | 'USD';
  };
  
  // Priority
  priority: number;                // 1-100, higher = shown first
  weight: number;                  // 1-100, for weighted random selection
  
  // Stats
  stats: {
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    conversionRate: number;
    revenue: number;
  };
  
  // Status
  status: 'draft' | 'pending_approval' | 'approved' | 'active' | 'paused' | 'ended' | 'rejected';
  rejectionReason?: string;
  approvedBy?: ObjectId;
  approvedAt?: Date;
  
  // Linked entity (for sponsored listings)
  linkedEntityType?: 'restaurant' | 'hotel' | 'activity' | 'coupon';
  linkedEntityId?: ObjectId;
}
```

### Ad Placements

**Home Hub:**
- `home_top` - Top of home screen
- `home_middle` - Middle section
- `home_bottom` - Bottom section
- `home_featured_deal` - Featured deal card

**AppZap Eat:**
- `eat_hero_banner` - Eat hub top carousel
- `eat_deal_card` - Sponsored deal in deals tab
- `eat_restaurant_badge` - Badge on restaurant listings
- `eat_menu_highlight` - Drink menu product highlight
- `eat_checkout_upsell` - Checkout page upsell
- `eat_confirmation` - Order confirmation banner
- `eat_between_listings` - Between restaurant listings

**AppZap Activity:**
- `activity_hero_banner` - Activity hub top
- `activity_event_sponsor` - Event listing sponsor
- `activity_tour_card` - Sponsored tour card
- `activity_confirmation` - Booking confirmation

**AppZap Stay:**
- `stay_hero_banner` - Stay hub top
- `stay_hotel_badge` - Badge on hotel listings
- `stay_deal_card` - Sponsored deal
- `stay_confirmation` - Booking confirmation

**AppZap Market:**
- `market_hero_banner` - Market hub top
- `market_category_sponsor` - Category sponsor
- `market_checkout` - Checkout upsell

**Generic:**
- `discover_top`, `discover_banner`, `search_results`, `detail_page`, `category_page`, `checkout`, `app_open`, `between_sections`

---

## Ad Targeting

### Location Targeting

Target users by province or landmark proximity:

```json
{
  "targeting": {
    "provinces": ["Vientiane", "Luang Prabang"],
    "landmarks": ["Patuxai", "Pha That Luang"]
  }
}
```

### Demographic Targeting

```json
{
  "targeting": {
    "languages": ["en", "lo", "th"],
    "nationalities": ["US", "GB", "FR", "TH", "LA"],
    "ageRange": { "min": 21, "max": 45 },
    "genders": ["male", "female"]
  }
}
```

### Behavioral Targeting

```json
{
  "targeting": {
    "userTypes": ["new", "returning", "premium"],
    "interests": ["food", "nightlife", "tourism"]
  }
}
```

### Device Targeting

```json
{
  "targeting": {
    "devices": ["ios", "android"]
  }
}
```

### Time-based Targeting

```json
{
  "schedule": {
    "startDate": "2026-06-01T00:00:00Z",
    "endDate": "2026-08-31T23:59:59Z",
    "daysOfWeek": [5, 6],           // Friday, Saturday only
    "hoursOfDay": [18, 19, 20, 21, 22, 23]  // Evening hours
  }
}
```

---

## Analytics & Reporting

### Key Metrics

- **Impressions** - Number of times ad was displayed
- **Clicks** - Number of times ad was clicked
- **CTR** - Click-through rate (clicks / impressions × 100)
- **Conversions** - Number of desired actions completed
- **Conversion Rate** - Conversions / clicks × 100
- **Revenue** - Total revenue generated
- **ROI** - Return on investment ((revenue - spent) / spent × 100)
- **Cost per Click** - Total spent / clicks
- **Cost per Conversion** - Total spent / conversions

### Reporting Endpoints

1. **Ad-level Analytics** - `GET /api/v1/ads/admin/:id`
2. **Revenue Summary** - `GET /api/v1/ads/admin/revenue`
3. **Advertiser Analytics** - `GET /api/v1/advertisers/:id/analytics`

---

## Examples

### Example 1: Create a Restaurant Promotion Ad

```bash
curl -X POST https://api.appzap.la/api/v1/ads/admin \
  -H "x-admin-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lao Kitchen Summer Special",
    "type": "banner",
    "placement": "eat_hero_banner",
    "advertiser": {
      "name": "Lao Kitchen",
      "companyName": "Lao Kitchen Restaurant",
      "phone": "+856 20 5555 1234",
      "email": "info@laokitchen.la"
    },
    "content": {
      "imageUrl": "https://cdn.appzap.la/ads/lao-kitchen-summer.jpg",
      "title": "Summer BBQ Special",
      "subtitle": "Get 30% off all BBQ dishes",
      "ctaText": "Order Now",
      "ctaUrl": "appzap://restaurant/456"
    },
    "targeting": {
      "provinces": ["Vientiane"],
      "languages": ["en", "lo"]
    },
    "schedule": {
      "startDate": "2026-06-01T00:00:00Z",
      "endDate": "2026-06-30T23:59:59Z"
    },
    "pricing": {
      "type": "flat",
      "amount": 5000000,
      "currency": "LAK"
    },
    "priority": 70
  }'
```

### Example 2: Track Ad Performance

```javascript
// Client-side tracking (Flutter/React)

// 1. Display ad and track impression
async function displayAd(ad) {
  // Show ad to user
  showAdInUI(ad);
  
  // Track impression
  await fetch(`https://api.appzap.la/api/v1/ads/${ad._id}/impression`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: getSessionId(),
      userId: getCurrentUserId()
    })
  });
}

// 2. Track click when user taps ad
async function handleAdClick(ad) {
  const response = await fetch(`https://api.appzap.la/api/v1/ads/${ad._id}/click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: getSessionId(),
      userId: getCurrentUserId()
    })
  });
  
  const data = await response.json();
  
  // Navigate to redirect URL
  if (data.redirectUrl) {
    navigateTo(data.redirectUrl);
  }
}

// 3. Track conversion when user completes action
async function trackConversion(ad, orderTotal) {
  await fetch(`https://api.appzap.la/api/v1/ads/${ad._id}/conversion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      revenue: orderTotal
    })
  });
}
```

### Example 3: Get Advertiser ROI Report

```bash
curl -H "x-admin-key: YOUR_KEY" \
  "https://api.appzap.la/api/v1/advertisers/65f1234567890abcdef12345/analytics?startDate=2026-03-01&endDate=2026-03-31"
```

---

## Best Practices

### 1. Ad Creation

- **Use high-quality images** - Minimum 1200x628px for banners
- **Keep text concise** - Titles under 50 characters, subtitles under 80
- **Clear CTAs** - Use action verbs: "Order Now", "Book Today", "Learn More"
- **Test multiple variations** - A/B test different images and copy
- **Set realistic budgets** - Start small and scale based on performance

### 2. Targeting

- **Start broad, then narrow** - Begin with minimal targeting, refine based on data
- **Avoid over-targeting** - Too many filters = small audience = fewer impressions
- **Use time-based targeting** - Show food ads during meal times, nightlife ads in evenings
- **Consider user journey** - New users see awareness ads, returning users see conversion ads

### 3. Budget Management

- **Set daily caps** - Prevent budget exhaustion in first few hours
- **Monitor spend daily** - Check budget utilization and adjust as needed
- **Use appropriate pricing** - CPM for awareness, CPC for engagement, CPA for conversions
- **Reserve budget for testing** - Allocate 10-20% for testing new placements/creatives

### 4. Performance Optimization

- **Monitor CTR** - Healthy CTR is 2-5%, below 1% needs creative refresh
- **Track conversion rate** - Optimize landing pages if CR is low
- **Adjust priority/weight** - Higher performing ads get more weight
- **Pause underperformers** - Stop ads with CTR < 0.5% after 10,000 impressions
- **Refresh creatives** - Update images/copy every 2-4 weeks to prevent ad fatigue

### 5. Analytics

- **Review daily** - Check performance metrics every day
- **Weekly reports** - Generate weekly summaries for stakeholders
- **Compare periods** - Week-over-week, month-over-month comparisons
- **Segment analysis** - Break down by placement, device, time of day
- **ROI focus** - Always calculate and optimize for ROI, not just impressions

### 6. Compliance

- **Get approval** - All ads must be approved before going live
- **Follow guidelines** - No misleading claims, inappropriate content
- **Respect exclusivity** - Check placement exclusivity before creating ads
- **Honor budgets** - Never exceed advertiser's budget limits
- **Privacy compliance** - Don't use PII in targeting without consent

---

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 400 | Bad Request | Missing required fields or invalid data |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Ad or advertiser not found |
| 409 | Conflict | Placement exclusivity conflict |
| 500 | Internal Server Error | Server-side error |

---

## Rate Limits

- **Public endpoints** - 1000 requests/minute per IP
- **Admin endpoints** - 100 requests/minute per API key
- **Tracking endpoints** - 10,000 requests/minute (fire-and-forget)

---

## Support

For API support or questions:
- **Email:** dev@appzap.la
- **Slack:** #ads-api-support
- **Documentation:** https://docs.appzap.la/ads

---

**Last Updated:** March 19, 2026  
**API Version:** v1  
**Maintained by:** AppZap Engineering Team
