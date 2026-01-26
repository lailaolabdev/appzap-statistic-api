# Master Data Migration Steps

## Overview

This document outlines the complete process for migrating existing menu and category data to the master data system. The goal is to map existing store menus/categories to standardized master codes for cross-store analytics.

**Important**: Always backup the database before running any migration scripts.

---

## Pre-Migration Checklist

- [ ] Backup database: `mongodump --uri="$MONGODB_URI" --out=./backup_$(date +%Y%m%d_%H%M%S)`
- [ ] Verify master data CSV/JSON files are complete
- [ ] Test on staging/dev environment first
- [ ] Have rollback plan ready

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
db.masterCategories.countDocuments()           // Expected: ~29
db.masterMenus.countDocuments()                // Expected: ~223
db.masterRestaurantCategories.countDocuments() // Expected: ~33
db.masterIngredientCategories.countDocuments() // Expected: ~16
db.masterIngredients.countDocuments()          // Expected: ~100
db.masterRecipeCategories.countDocuments()     // Expected: ~25
db.masterRecipes.countDocuments()              // Expected: ~15
```

**Rollback**: `db.masterCategories.drop()`, etc.

---

### Step 1.2: Create Mapping Collections

**Purpose**: Create collections to track mapping status and decisions.

**Script**: `npm run migration:init`

**Collections Created**:

#### 1. `menuMappings`
Tracks mapping status for each store menu item.

```javascript
{
  _id: ObjectId,
  menuId: ObjectId,              // Reference to original menu
  storeId: ObjectId,             // Store this menu belongs to
  menuName: String,              // Original menu name (for display)
  menuName_en: String,           // English name if available
  normalizedName: String,        // Lowercase, trimmed for matching
  
  // Mapping result
  masterMenuCode: String,        // Mapped master code (null if pending)
  masterMenuName: String,        // Master menu name (for admin display)
  masterMenuName_en: String,     // Master menu English name
  
  // Status tracking
  mappingStatus: String,         // 'pending' | 'suggested' | 'approved' | 'rejected' | 'not-applicable'
  confidenceScore: Number,       // 0-100 (from similarity algorithm)
  
  // Suggestions from algorithm
  suggestedMappings: [{
    masterMenuCode: String,
    masterMenuName: String,
    masterMenuName_en: String,
    confidenceScore: Number,
    matchType: String            // 'exact' | 'fuzzy' | 'keyword'
  }],
  
  // Approval tracking
  approvedBy: String,            // Admin username/ID
  approvedAt: Date,
  rejectedBy: String,
  rejectedAt: Date,
  notes: String,                 // Admin notes
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

#### 2. `categoryMappings`
Same structure as menuMappings but for categories.

```javascript
{
  _id: ObjectId,
  categoryId: ObjectId,
  storeId: ObjectId,
  categoryName: String,
  normalizedName: String,
  
  masterCategoryCode: String,
  masterCategoryName: String,
  masterCategoryName_en: String,
  
  mappingStatus: String,
  confidenceScore: Number,
  suggestedMappings: [...],
  
  approvedBy: String,
  approvedAt: Date,
  notes: String,
  
  createdAt: Date,
  updatedAt: Date
}
```

#### 3. `mappingDecisions`
Stores "learned" decisions for auto-mapping future items.

```javascript
{
  _id: ObjectId,
  entityType: String,            // 'menu' | 'category'
  originalName: String,          // Original name that was mapped
  normalizedName: String,        // Normalized version for matching
  
  masterCode: String,            // The master code it maps to
  masterName: String,            // Master name for reference
  masterName_en: String,
  
  decisionType: String,          // 'approved' | 'rejected' | 'not-applicable'
  decisionBy: String,
  decisionAt: Date,
  
  // Stats
  timesApplied: Number,          // How many times this decision was auto-applied
  storeIds: [ObjectId],          // Stores where this mapping was applied
  
  createdAt: Date,
  updatedAt: Date
}
```

#### 4. `mappingStats`
Tracks overall migration progress.

```javascript
{
  _id: ObjectId,
  entityType: String,            // 'menu' | 'category'
  
  // Counts
  totalItems: Number,
  mappedItems: Number,
  pendingItems: Number,
  suggestedItems: Number,
  rejectedItems: Number,
  notApplicableItems: Number,
  
  // By confidence
  highConfidence: Number,        // >= 90%
  mediumConfidence: Number,      // 60-89%
  lowConfidence: Number,         // < 60%
  
  // Progress
  lastUpdated: Date,
  lastAnalysisRun: Date
}
```

**Indexes Created**:
```javascript
// menuMappings
{ menuId: 1 }                    // unique
{ storeId: 1 }
{ normalizedName: 1 }
{ mappingStatus: 1 }
{ confidenceScore: -1 }
{ masterMenuCode: 1 }

// categoryMappings
{ categoryId: 1 }                // unique
{ storeId: 1 }
{ normalizedName: 1 }
{ mappingStatus: 1 }
{ masterCategoryCode: 1 }

// mappingDecisions
{ entityType: 1, normalizedName: 1 }  // unique
{ masterCode: 1 }
```

**Verification**:
```javascript
db.menuMappings.getIndexes()
db.categoryMappings.getIndexes()
db.mappingDecisions.getIndexes()
```

**Rollback**: 
```javascript
db.menuMappings.drop()
db.categoryMappings.drop()
db.mappingDecisions.drop()
db.mappingStats.drop()
```

---

## Phase 2: Analysis (Read-Only)

### Step 2.1: Extract Existing Items

**Purpose**: Fetch all menus and categories from existing stores.

**Script**: `npm run migration:analyze`

**Process**:
1. Query all documents from `menus` collection
2. Query all documents from `categories` collection
3. Normalize names (lowercase, trim, remove special chars)
4. Group by normalized name to find unique items
5. Count occurrences across stores

**Output**:
```
Analysis Results:
- Total menus: 15,000
- Unique menu names: 2,500
- Total categories: 1,200
- Unique category names: 150
```

### Step 2.2: Run Similarity Matching

**Purpose**: Find potential master matches for each unique name.

**Algorithm**:
1. **Exact Match**: Normalized name matches master keyword/name exactly
2. **Fuzzy Match**: Levenshtein/Jaro-Winkler similarity score
3. **Keyword Match**: Any master keyword found in menu name

**Confidence Scoring**:
| Match Type | Base Score |
|------------|------------|
| Exact name match | 100% |
| Exact keyword match | 95% |
| Fuzzy match >= 0.9 | 90% |
| Fuzzy match >= 0.8 | 80% |
| Fuzzy match >= 0.7 | 70% |
| Keyword partial match | 60% |
| No match | 0% |

### Step 2.3: Generate Suggestions

**Purpose**: Create mapping records with suggestions.

**Process**:
1. For each existing menu:
   - Find top 3 master matches
   - Calculate confidence scores
   - Create `menuMappings` record with status='suggested'
2. For each existing category:
   - Same process for `categoryMappings`

### Step 2.4: Categorize by Confidence

**Purpose**: Prioritize review workload.

**Categories**:
| Confidence | Status | Priority | Action |
|------------|--------|----------|--------|
| 95-100% | `high-confidence` | Low | Quick approve |
| 80-94% | `medium-confidence` | Medium | Review needed |
| 60-79% | `low-confidence` | High | Careful review |
| <60% | `no-match` | High | Manual mapping or new master |

**Verification**:
```javascript
// Check distribution
db.menuMappings.aggregate([
  { $group: { _id: "$mappingStatus", count: { $sum: 1 } } }
])

// Check confidence distribution
db.menuMappings.aggregate([
  { $bucket: {
    groupBy: "$confidenceScore",
    boundaries: [0, 60, 80, 95, 101],
    output: { count: { $sum: 1 } }
  }}
])
```

---

## Phase 3: Admin Review (Manual)

### Step 3.1: Review High Confidence Items

**Purpose**: Quick-win approvals for obvious matches.

**Process**:
1. Filter: `mappingStatus='suggested' AND confidenceScore >= 95`
2. Review suggestion
3. Click Approve or Reject
4. System creates `mappingDecisions` record

### Step 3.2: Review Medium Confidence Items

**Purpose**: Careful review for ambiguous matches.

**Process**:
1. Filter: `mappingStatus='suggested' AND confidenceScore >= 60 AND confidenceScore < 95`
2. Compare original name with suggested master
3. Check alternative suggestions
4. Approve, Reject, or Create New Master

### Step 3.3: Handle Low Confidence / No Match

**Purpose**: Handle items that need manual mapping.

**Options**:
1. **Map to existing master**: Search and select manually
2. **Create new master**: Item doesn't exist in master data
3. **Mark as not-applicable**: Item is store-specific, shouldn't be mapped

### Step 3.4: Review Stats

**Verification**:
```javascript
// Overall progress
db.mappingStats.findOne({ entityType: 'menu' })

// Pending review count
db.menuMappings.countDocuments({ mappingStatus: 'suggested' })

// Approved count
db.menuMappings.countDocuments({ mappingStatus: 'approved' })
```

---

## Phase 4: Apply Mappings (Careful!)

### Step 4.1: Pilot Test (1 Store)

**Purpose**: Verify mapping works correctly on a single store.

**Script**: `npm run migration:apply --storeId=<STORE_ID> --dryRun=true`

**Process**:
1. Select one pilot store
2. Run in dry-run mode first
3. Review what would be updated
4. Run actual update
5. Verify in database and application

**Verification**:
```javascript
// Check menus have masterMenuCode
db.menus.find({ storeId: ObjectId("<STORE_ID>"), masterMenuCode: { $exists: true } }).count()

// Sample check
db.menus.findOne({ storeId: ObjectId("<STORE_ID>"), masterMenuCode: { $exists: true } })
```

### Step 4.2: Expand to 10 Stores

**Purpose**: Broader test before full rollout.

**Script**: `npm run migration:apply --storeIds=<ID1,ID2,...> --dryRun=true`

**Verification**:
- Check application works correctly
- Verify analytics queries return expected results
- Monitor for any errors

### Step 4.3: Full Rollout

**Purpose**: Apply mappings to all stores.

**Script**: `npm run migration:apply --all --dryRun=true`

Then without dry-run:
**Script**: `npm run migration:apply --all`

**Verification**:
```javascript
// Overall mapping coverage
db.menus.aggregate([
  { $group: {
    _id: { hasMaster: { $cond: [{ $ifNull: ["$masterMenuCode", false] }, true, false] } },
    count: { $sum: 1 }
  }}
])
```

---

## Phase 5: Backfill Orders (Optional)

### Step 5.1: Update Order Items

**Purpose**: Add masterMenuCode to historical orders for analytics.

**Script**: `npm run migration:backfill-orders --dryRun=true`

**Process**:
1. Find all orders with items missing masterMenuCode
2. Look up menuId → masterMenuCode from menus collection
3. Update order items

**Warning**: This can be a large operation. Run during off-peak hours.

### Step 5.2: Verify Analytics

**Purpose**: Ensure analytics queries work correctly.

**Verification**:
```javascript
// Top selling master menus
db.orders.aggregate([
  { $unwind: "$items" },
  { $match: { "items.masterMenuCode": { $exists: true } } },
  { $group: { _id: "$items.masterMenuCode", totalQty: { $sum: "$items.quantity" } } },
  { $sort: { totalQty: -1 } },
  { $limit: 10 }
])
```

---

## Phase 6: Ongoing Operations

### Step 6.1: New Menu Detection

**Purpose**: Auto-map new menus when created.

**Trigger**: When new menu is created via API

**Process**:
1. Check `mappingDecisions` for exact match
2. If found → Auto-apply mapping
3. If not found → Add to review queue

### Step 6.2: Periodic Review

**Schedule**: Weekly

**Tasks**:
1. Review pending mappings
2. Check mapping coverage stats
3. Add new master items if needed

### Step 6.3: Coverage Monitoring

**Dashboard Metrics**:
- Total menus vs mapped menus (%)
- Pending review count
- New unmapped items this week
- Most common unmapped names

---

## Rollback Procedures

### Rollback Master Data
```bash
# Drop master collections
mongo $MONGODB_URI --eval "
  db.masterCategories.drop();
  db.masterMenus.drop();
  db.masterRestaurantCategories.drop();
  db.masterIngredientCategories.drop();
  db.masterIngredients.drop();
  db.masterRecipeCategories.drop();
  db.masterRecipes.drop();
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

### Rollback Applied Mappings
```bash
# Remove masterMenuCode from menus
mongo $MONGODB_URI --eval "
  db.menus.updateMany({}, { \$unset: { masterMenuCode: '' } });
"

# Remove masterCategoryCode from categories
mongo $MONGODB_URI --eval "
  db.categories.updateMany({}, { \$unset: { masterCategoryCode: '' } });
"
```

### Restore from Backup
```bash
mongorestore --uri="$MONGODB_URI" --drop ./backup_YYYYMMDD_HHMMSS
```

---

## Scripts Reference

| Script | Purpose | Risk |
|--------|---------|------|
| `npm run seed:master` | Populate master data | None |
| `npm run migration:init` | Create mapping collections & indexes | None |
| `npm run migration:analyze` | Generate mapping suggestions for all | None (read-only on menus/categories) |
| `npm run migration:analyze:menus` | Analyze menus only | None |
| `npm run migration:analyze:categories` | Analyze categories only | None |
| `npm run migration:analyze -- --limit=100` | Analyze limited items (testing) | None |
| `npm run migration:analyze -- --store=ID` | Analyze specific store | None |
| `npm run migration:apply --dryRun` | Preview mapping application | None |
| `npm run migration:apply --storeId=X` | Apply to single store | Low |
| `npm run migration:apply --all` | Apply to all stores | Medium |
| `npm run migration:backfill-orders` | Backfill order history | Medium |
| `npm run migration:rollback` | Remove applied mappings | Low |

### Script Locations

```
src/
├── seeds/
│   └── masterDataSeeds.js      # npm run seed:master
├── migration/
│   ├── index.js                # Module exports
│   ├── migrationInit.js        # npm run migration:init
│   └── migrationAnalyze.js     # npm run migration:analyze
└── data/
    ├── masterMenus.csv         # Menu seed data
    ├── masterMenusAI.json      # Menu AI enrichment data
    ├── masterCategories.csv    # Category seed data
    ├── masterCategoriesAI.json # Category AI enrichment data
    └── ...other data files
```

---

## Troubleshooting

### Common Issues

**1. Similarity matching too slow**
- Add indexes on `normalizedName` fields
- Process in batches of 1000

**2. Too many false positives**
- Increase confidence threshold
- Add more keywords to master data

**3. Missing master items**
- Create new master entries
- Update master CSV/JSON files
- Re-run seed script

**4. Duplicate mappings**
- Check for duplicate normalized names
- Verify unique constraints on mappings

---

## Contact & Support

For issues with migration, contact the development team.

Last Updated: 2026-01-25
