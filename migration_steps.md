# Master Data Migration Steps

## Overview

This document outlines the complete process for migrating existing menu and category data to the master data system. The goal is to map existing store menus/categories to standardized master codes for cross-store analytics.

**Important**: Always backup the database before running any migration scripts.

---

## 🚀 NEW: Smart Order-Based Mapping Approach

### Why Order-Based Mapping?

Instead of mapping ALL menus (56,900+), we focus on menus that are **actually being ordered**:

| Traditional Approach | Smart Order-Based Approach |
|---------------------|---------------------------|
| Map all 56,900 menus | Map ~5,000 ordered menus (last 30 days) |
| Overwhelming workload | Focused, manageable workload |
| Low ROI for unused menus | High ROI - map what matters |
| Months to complete | Days to complete |

**Pareto Principle**: ~20% of menus account for ~80% of orders. Map those first!

### Order-Based Workflow

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  1. DISCOVER        │     │  2. ANALYZE         │     │  3. REVIEW          │
│  Query orders for   │ --> │  Match menus to     │ --> │  Approve/reject     │
│  date range         │     │  master codes       │     │  mappings           │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
                                                                  │
                                                                  ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  6. ANALYTICS       │     │  5. VERIFY          │     │  4. ENRICH          │
│  Top selling by     │ <-- │  Check enrichment   │ <-- │  Update orders with │
│  master menu code   │     │  results            │     │  master codes       │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

---

## Pre-Migration Checklist

- [ ] Backup database: `mongodump --uri="$MONGODB_URI" --out=./backup_$(date +%Y%m%d_%H%M%S)`
- [ ] Verify master data CSV/JSON files are complete
- [ ] Test on staging/dev environment first
- [ ] Have rollback plan ready
- [ ] Decide date range for order-based discovery (recommend: last 30 days)

---

## Phase 1: Preparation (No Risk)

### Step 1.1: Seed Master Data

**Purpose**: Populate master collections with standardized data.

**Script**: `npm run seed:master`

**Collections Created**:
- `masterCategories` - Standard menu categories
- `masterMenus` - Standard menu items with AI fields
- `masterRestaurantCategories` - Restaurant types
- `masterIngredientCategories` - Ingredient categories
- `masterIngredients` - Standard ingredients
- `masterRecipeCategories` - Recipe types
- `masterRecipes` - Standard recipes

**Verification**:
```javascript
// Check counts
db.masterCategories.countDocuments()           // Expected: ~29+
db.masterMenus.countDocuments()                // Expected: ~223+
```

**Rollback**: `db.masterCategories.drop()`, etc.

---

### Step 1.2: Create Mapping Collections

**Purpose**: Create collections to track mapping status and decisions.

**Script**: `npm run migration:init`

**Collections Created**:
- `menuMappings` - Tracks mapping status for each store menu item
- `categoryMappings` - Tracks mapping status for each store category
- `mappingDecisions` - Stores "learned" decisions for auto-mapping
- `mappingStats` - Tracks overall migration progress

**Indexes Created**:
```javascript
// menuMappings
{ menuId: 1 }                    // unique
{ storeId: 1 }
{ normalizedName: 1 }
{ mappingStatus: 1 }
{ confidenceScore: -1 }
{ masterMenuCode: 1 }
{ orderCount: -1 }               // NEW: for order-based sorting
```

---

## Phase 2: Order-Based Discovery (Read-Only) ⭐ NEW

### Step 2.1: Discover Menus from Orders

**Purpose**: Find menus that are actually being ordered, prioritized by frequency.

**API Endpoint**: `GET /api/v1/master/order-mapping/discover`

**Parameters**:
| Parameter | Default | Description |
|-----------|---------|-------------|
| startDate | 30 days ago | Start of date range |
| endDate | today | End of date range |
| minOrderCount | 1 | Minimum orders to include |
| limit | 1000 | Items per page |
| skip | 0 | Pagination offset |
| storeId | (optional) | Filter by store |

**Example Request**:
```bash
curl "http://localhost:5050/api/v1/master/order-mapping/discover?startDate=2026-01-01&endDate=2026-01-27&minOrderCount=5"
```

**Response**:
```json
{
  "data": [
    {
      "menuId": "...",
      "storeId": "...",
      "menuName": "ເຂົ້າຜັດ",
      "orderCount": 1523,
      "totalQuantity": 2847,
      "totalRevenue": 142350000,
      "mappingStatus": "not-analyzed",
      "masterMenuCode": null
    }
  ],
  "pagination": { "total": 5234, "limit": 1000, "skip": 0 },
  "stats": {
    "totalUniqueMenus": 5234,
    "totalOrders": 45678,
    "dateRange": { "start": "...", "end": "..." }
  }
}
```

### Step 2.2: Get Order-Based Statistics

**Purpose**: See mapping coverage for ordered items.

**API Endpoint**: `GET /api/v1/master/order-mapping/stats`

**Response**:
```json
{
  "data": {
    "totalUniqueMenusOrdered": 5234,
    "mapped": 2100,
    "suggested": 2500,
    "noMatch": 400,
    "notAnalyzed": 234,
    "mappingCoverage": 40
  }
}
```

### Step 2.3: Analyze Ordered Menus

**Purpose**: Generate mapping suggestions for discovered menus.

**API Endpoint**: `POST /api/v1/master/order-mapping/analyze`

**Request Body**:
```json
{
  "startDate": "2026-01-01",
  "endDate": "2026-01-27",
  "minOrderCount": 5,
  "batchSize": 500
}
```

**Process**:
1. Get unique menus from orders
2. Match against master menus using text similarity
3. Create/update `menuMappings` records with suggestions
4. Prioritize by order count

---

## Phase 3: Admin Review (Manual)

### Step 3.1: Review via Dashboard

**URL**: `/dashboard/mapping-review`

**Priority Order** (recommended):
1. **High Confidence (95%+)** - Quick approve
2. **Ordered Items (High Count)** - Most impactful
3. **Medium Confidence (60-94%)** - Careful review
4. **No Match Found** - Create new master or mark N/A

### Step 3.2: Handle No Match Items

**Purpose**: Review items that couldn't be matched automatically.

**API Endpoint**: `GET /api/v1/master/order-mapping/no-match`

**Options for each item**:
1. **Map to existing master** - Search and select manually
2. **Create new master** - Item doesn't exist in master data
3. **Mark as not-applicable** - Store-specific item, shouldn't be mapped

### Step 3.3: Quick Win - Bulk Approve High Confidence

**API Endpoint**: `POST /api/v1/master/reviews/menus/bulk/approve-by-confidence`

```json
{
  "confidenceLevel": "high",
  "approvedBy": "admin"
}
```

---

## Phase 4: Enrich Orders (Careful!) ⭐ NEW

### Step 4.1: Dry Run First

**Purpose**: Preview what orders would be updated.

**API Endpoint**: `POST /api/v1/master/order-mapping/enrich`

**Request Body**:
```json
{
  "startDate": "2026-01-01",
  "endDate": "2026-01-27",
  "dryRun": "true",
  "batchSize": 1000
}
```

**Response**:
```json
{
  "message": "Dry run completed",
  "data": {
    "dryRun": true,
    "totalOrdersProcessed": 1000,
    "ordersEnriched": 847,
    "ordersSkipped": 153,
    "itemsEnriched": 2341,
    "mappingsLoaded": 2500
  }
}
```

### Step 4.2: Execute Enrichment

**After verifying dry run results**, run without dry run:

```json
{
  "startDate": "2026-01-01",
  "endDate": "2026-01-27",
  "dryRun": "false",
  "batchSize": 1000
}
```

**Process**:
1. Load all approved menu mappings
2. Find orders in date range
3. For each order item, add `masterMenuCode`, `masterMenuName`
4. Update orders in database

### Step 4.3: Verify Enrichment

```javascript
// Check enriched orders
db.orders.find({ 
  "items.masterMenuCode": { $exists: true },
  createdAt: { $gte: ISODate("2026-01-01") }
}).count()

// Sample enriched order
db.orders.findOne({ "items.masterMenuCode": { $exists: true } })
```

---

## Phase 5: Analytics (Read-Only)

### Step 5.1: Top Selling by Master Menu

**Purpose**: Aggregate sales across all stores by standardized menu code.

**API Endpoint**: `GET /api/v1/master/order-mapping/top-selling`

**Parameters**:
| Parameter | Description |
|-----------|-------------|
| startDate | Start of date range |
| endDate | End of date range |
| limit | Number of results |
| masterCategoryCode | Filter by category |

**Response**:
```json
{
  "data": [
    {
      "masterMenuCode": "MENU-HEINEKEN",
      "masterMenuName": "ເບຍໄຮເນເກັນ",
      "masterMenuName_en": "Heineken",
      "totalQuantity": 15234,
      "orderCount": 8923,
      "totalRevenue": 456780000,
      "storeCount": 94
    }
  ],
  "summary": {
    "totalRevenue": 12345678000,
    "totalQuantity": 234567,
    "uniqueMenus": 1523
  }
}
```

### Step 5.2: Dashboard Verification

**URL**: `/dashboard/mapping-review`

Check:
- Mapping coverage percentage
- Top selling items display correctly
- Cross-store aggregation working

---

## Phase 6: Ongoing Operations

### Step 6.1: New Menu Detection

**Trigger**: When new menu is created via API

**Process**:
1. Check `mappingDecisions` for exact match
2. If found → Auto-apply mapping
3. If not found → Add to review queue with priority based on orders

### Step 6.2: Periodic Re-analysis

**Schedule**: Weekly or Monthly

**Tasks**:
1. Run order discovery for recent period
2. Analyze any new menus
3. Review pending mappings
4. Enrich new orders

### Step 6.3: Coverage Monitoring

**Dashboard Metrics**:
- Total menus ordered vs mapped (%)
- Pending review count
- New unmapped items this week
- Most common no-match items

---

## Rollback Procedures

### Rollback Master Data
```bash
mongo $MONGODB_URI --eval "
  db.masterCategories.drop();
  db.masterMenus.drop();
  // ... other master collections
"
```

### Rollback Mapping Collections
```bash
mongo $MONGODB_URI --eval "
  db.menuMappings.drop();
  db.categoryMappings.drop();
  db.mappingDecisions.drop();
  db.mappingStats.drop();
"
```

### Rollback Order Enrichment
```bash
# Remove masterMenuCode from orders
mongo $MONGODB_URI --eval "
  db.orders.updateMany(
    { 'items.masterMenuCode': { \$exists: true } },
    { \$unset: { 'items.\$[].masterMenuCode': '', 'items.\$[].masterMenuName': '', 'items.\$[].masterMenuName_en': '', enrichedAt: '' } }
  );
"
```

### Restore from Backup
```bash
mongorestore --uri="$MONGODB_URI" --drop ./backup_YYYYMMDD_HHMMSS
```

---

## API Reference

### Order-Based Mapping Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/order-mapping/discover` | GET | Discover menus from orders |
| `/order-mapping/stats` | GET | Get order-based mapping stats |
| `/order-mapping/no-match` | GET | Get items with no match |
| `/order-mapping/analyze` | POST | Analyze ordered menus |
| `/order-mapping/enrich` | POST | Enrich orders with master codes |
| `/order-mapping/top-selling` | GET | Top selling by master menu |

### Review Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/reviews/menus` | GET | Get menu review queue |
| `/reviews/menus/:id/approve` | POST | Approve mapping |
| `/reviews/menus/:id/reject` | POST | Reject mapping |
| `/reviews/menus/:id/manual-map` | PUT | Manual mapping |
| `/reviews/menus/bulk/approve-by-confidence` | POST | Bulk approve high confidence |

---

## Troubleshooting

### Common Issues

**1. Order discovery returns 0 items**
- Check orders collection has data in date range
- Verify orders have `items` array with `menuId`
- Check storeId filter if used

**2. Enrichment not updating orders**
- Ensure mappings are in `approved` status
- Check `masterMenuCode` is set in menuMappings
- Verify menuId and storeId match exactly

**3. Top selling not showing data**
- Orders must have `masterMenuCode` field set (flat schema: each order doc IS an item)
- Run enrichment first
- Check date range matches enriched orders

**4. Low mapping coverage**
- Review no-match items
- Add missing master menu items
- Adjust similarity threshold if needed

---

## Admin Dashboard UI Guide

### Accessing the Dashboard

**URL**: `http://localhost:3000/dashboard`

**Required Role**: `appzap_admin`

### Key Pages

#### 1. Mapping Review (`/dashboard/mapping-review/queue`)

The main page for managing menu mappings with three tabs:

| Tab | Description |
|-----|-------------|
| **Order-Based** | Smart mapping mode - discover and map menus from actual orders |
| **Menus** | Traditional menu mapping queue |
| **Categories** | Category mapping queue |

**Order-Based Tab Features**:
- Date range picker (presets: 7/30/90/180/365 days)
- Statistics cards: unique menus, mapped, suggested, coverage %
- "Analyze Ordered Menus" button - generates mapping suggestions
- "Enrich Orders" button - injects master codes into orders (dry run first!)
- Discovered Menus list with quick approve actions
- No Match Found list for manual review

#### 2. Top Selling Analytics (`/dashboard/top-selling`)

View aggregated sales by master menu code across all restaurants.

**Features**:
- Date range filter with presets
- Category filter
- Search functionality
- Summary cards: total revenue, items sold, unique menus
- Ranked table with quantity/revenue progress bars
- Store count per menu item

#### 3. Master Menus (`/dashboard/master-menus`)

Manage master menu items.

**Features**:
- Create/Edit/Delete master menus
- View mapping statistics (how many store menus linked)
- Search and filter by category

#### 4. Master Categories (`/dashboard/master-categories`)

Manage master categories.

**Features**:
- Create/Edit/Delete master categories
- View linked menu count (safe delete check)

### Typical Workflow in Dashboard

1. Go to **Mapping Review** > **Order-Based** tab
2. Set date range (e.g., last 30 days)
3. Click **"Analyze Ordered Menus"** - creates mapping suggestions
4. Review the **Discovered Menus** list
5. **Quick Approve** items with high confidence
6. Check **No Match Found** tab for items needing manual mapping
7. Click **"Enrich Orders"** > enable **Dry Run** > **Preview Changes**
8. If preview looks good, disable Dry Run > **Apply Enrichment**
9. Go to **Top Selling** page to view aggregated analytics

---

## Quick Start (TL;DR)

```bash
# 1. Seed master data
npm run seed:master

# 2. Initialize mapping collections
npm run migration:init

# 3. Analyze ordered menus (API call)
curl -X POST http://localhost:5050/api/v1/master/order-mapping/analyze \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2026-01-01","endDate":"2026-01-27","minOrderCount":5}'

# 4. Review and approve mappings via Dashboard
# URL: /dashboard/mapping-review

# 5. Enrich orders (dry run first)
curl -X POST http://localhost:5050/api/v1/master/order-mapping/enrich \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2026-01-01","endDate":"2026-01-27","dryRun":"true"}'

# 6. View analytics
curl "http://localhost:5050/api/v1/master/order-mapping/top-selling?startDate=2026-01-01&endDate=2026-01-27"
```

---

## Contact & Support

For issues with migration, contact the development team.

Last Updated: 2026-01-27
