# AppZap Statistics & Ingredients Analytics API

A comprehensive analytics system for AppZap POS, featuring cross-store menu analytics and ingredient consumption tracking.

## Setup

```bash
# Install dependencies
npm install

# Initialize database collections and indexes
node src/utils/dbInit.js

# Seed master data (optional - creates sample data)
node src/seeds/masterDataSeeds.js

# Start the server
npm start
```

---

## Original API Endpoints

### 1. Query Important Statistics
```
GET http://localhost:3000/api/v1/statistics
```

### 2. Query Restaurants with Params
```
GET http://localhost:3000/api/v1/restaurants?status=PAID&hasPOS=true&paymentStatus=PAID
```

### 3. Query Restaurants Sorted by Income
```
GET http://localhost:3000/api/v1/restaurants/income?startDate=2024-10-01&endDate=2024-10-31

GET http://localhost:3000/api/v1/restaurants/income?startDate=2024-10-01&endDate=2024-10-31&restaurantIds=64c725ab43f4d2001f2bd417,6447a2ef853b28001fb5b5e1
```

### 4. Query Best Selling Menus (Per Store)
```
GET http://localhost:3000/api/v1/menus/best_selling_menus?startDate=2024-10-01&endDate=2024-10-31

GET http://localhost:3000/api/v1/menus/best_selling_menus?menuLimit=10&startDate=2024-09-01&endDate=2024-09-31&restaurantIds=64c725ab43f4d2001f2bd417,6447a2ef853b28001fb5b5e1
```

---

## Master Data API (Ingredients Analytics System)

Base URL: `http://localhost:3000/api/v1/master`

### Master Categories (Menu Categories)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/categories` | Create master category |
| POST | `/categories/bulk` | Bulk create categories |
| GET | `/categories` | List all categories |
| GET | `/categories/:code` | Get single category |
| GET | `/categories/match?name=xxx` | Find matching categories |
| PUT | `/categories/:code` | Update category |
| DELETE | `/categories/:code` | Delete category |

### Master Menus
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/menus` | Create master menu |
| POST | `/menus/bulk` | Bulk create menus |
| GET | `/menus` | List all menus |
| GET | `/menus/:code` | Get single menu |
| GET | `/menus/match?name=xxx` | Find matching menus |
| GET | `/menus/grouped` | Get menus grouped by category |
| PUT | `/menus/:code` | Update menu |
| DELETE | `/menus/:code` | Delete menu |

### Master Ingredient Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ingredient-categories` | Create category |
| POST | `/ingredient-categories/bulk` | Bulk create |
| GET | `/ingredient-categories` | List all |
| GET | `/ingredient-categories/tree` | Get hierarchical tree |
| GET | `/ingredient-categories/:code` | Get single |
| PUT | `/ingredient-categories/:code` | Update |
| DELETE | `/ingredient-categories/:code` | Delete |

### Master Ingredients
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ingredients` | Create ingredient |
| POST | `/ingredients/bulk` | Bulk create |
| GET | `/ingredients` | List all |
| GET | `/ingredients/:code` | Get single |
| GET | `/ingredients/:code/convert?quantity=100&fromUnit=g&toUnit=kg` | Convert units |
| GET | `/ingredients/match?name=xxx` | Find matching |
| PUT | `/ingredients/:code` | Update |
| DELETE | `/ingredients/:code` | Delete |

### Master Recipe Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/recipe-categories` | Create category |
| POST | `/recipe-categories/bulk` | Bulk create |
| GET | `/recipe-categories` | List all |
| GET | `/recipe-categories/grouped` | Get grouped by type |
| GET | `/recipe-categories/:code` | Get single |
| PUT | `/recipe-categories/:code` | Update |
| DELETE | `/recipe-categories/:code` | Delete |

### Master Recipes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/recipes` | Create recipe |
| GET | `/recipes` | List all recipes |
| GET | `/recipes/:code` | Get single recipe |
| GET | `/recipes/:code/calculate?servings=10` | Calculate ingredients for servings |
| GET | `/recipes/by-menu/:menuCode` | Get recipe by menu code |
| GET | `/recipes/by-ingredient/:ingredientCode` | Get recipes using ingredient |
| PUT | `/recipes/:code` | Update recipe |
| DELETE | `/recipes/:code` | Delete recipe |

### Mappings (Link Store Items to Master Items)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mappings/categories` | Create category mapping |
| GET | `/mappings/categories` | List category mappings |
| GET | `/mappings/categories/suggestions?storeId=xxx` | Get auto-suggestions |
| DELETE | `/mappings/categories/:id` | Delete mapping |
| POST | `/mappings/menus` | Create menu mapping |
| POST | `/mappings/menus/bulk` | Bulk create menu mappings |
| GET | `/mappings/menus` | List menu mappings |
| GET | `/mappings/menus/suggestions?storeId=xxx` | Get auto-suggestions |
| DELETE | `/mappings/menus/:id` | Delete mapping |
| GET | `/mappings/stats?storeId=xxx` | Get mapping statistics |

### Analytics (Cross-Store Analytics)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/dashboard` | Dashboard summary |
| GET | `/analytics/top-menus?startDate=xxx&endDate=xxx` | Top selling master menus |
| GET | `/analytics/top-categories?startDate=xxx&endDate=xxx` | Top selling master categories |
| GET | `/analytics/ingredient-consumption?startDate=xxx&endDate=xxx` | Ingredient consumption |

---

## Example Usage

### 1. Create a Master Category
```bash
curl -X POST http://localhost:3000/api/v1/master/categories \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ເຄື່ອງດື່ມ",
    "name_en": "Beverages",
    "keywords": ["drink", "coffee", "tea"]
  }'
```

### 2. Create a Master Menu
```bash
curl -X POST http://localhost:3000/api/v1/master/menus \
  -H "Content-Type: application/json" \
  -d '{
    "masterCategoryCode": "MCAT-XXXXXXXX",
    "name": "ກາເຟເຢັນ",
    "name_en": "Iced Coffee",
    "keywords": ["coffee", "iced", "cold"]
  }'
```

### 3. Create a Menu Mapping (Link Store Menu to Master Menu)
```bash
curl -X POST http://localhost:3000/api/v1/master/mappings/menus \
  -H "Content-Type: application/json" \
  -d '{
    "menuId": "6917d3f3969da4001afb0cc3",
    "storeId": "68f86074da892287f044bc5c",
    "masterMenuCode": "MENU-XXXXXXXX"
  }'
```

### 4. Get Mapping Suggestions
```bash
curl "http://localhost:3000/api/v1/master/mappings/menus/suggestions?storeId=68f86074da892287f044bc5c&threshold=0.3"
```

### 5. Get Top Selling Master Menus (Cross-Store)
```bash
curl "http://localhost:3000/api/v1/master/analytics/top-menus?startDate=2024-01-01&endDate=2024-12-31"
```

### 6. Get Ingredient Consumption
```bash
curl "http://localhost:3000/api/v1/master/analytics/ingredient-consumption?startDate=2024-01-01&endDate=2024-12-31"
```

---

## Data Flow

```
Store Menu (ເຂົ້າຜັດ) → Menu Mapping → Master Menu (MENU-XXX: Fried Rice)
                                              ↓
                                    Master Recipe (REC-XXX)
                                              ↓
                                    Ingredients:
                                    - Rice: 200g
                                    - Oil: 20ml
                                    - Egg: 1pc (50g)
                                              ↓
                                    Analytics:
                                    - Top selling: Fried Rice (50,000 orders)
                                    - Consumption: Rice 10,000kg, Oil 1,000L
```

---

## Collections

| Collection | Description |
|------------|-------------|
| `masterCategories` | Standardized menu categories |
| `masterMenus` | Standardized menu items |
| `masterIngredientCategories` | Ingredient categories (hierarchical) |
| `masterIngredients` | Standardized ingredients (base unit: grams) |
| `masterRecipeCategories` | Recipe categories (by cuisine/method/meal) |
| `masterRecipes` | Recipes linking menus to ingredients |
| `menuMappings` | Links store menus → master menus |
| `categoryMappings` | Links store categories → master categories |

---

## Important Notes

1. **No Existing Data Modified**: This system creates NEW collections. It does NOT modify existing `menus`, `categories`, `orders`, or `bills` collections.

2. **Migration Required**: To use cross-store analytics, store menus must be mapped to master menus via the mapping APIs.

3. **Base Unit**: All ingredient quantities are stored in grams (g) for consistency.

4. **Auto-Suggestions**: The mapping suggestion API uses text similarity algorithms (Levenshtein distance + keyword matching) to suggest mappings.