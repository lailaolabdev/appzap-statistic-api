/**
 * Master Menu Controller
 * 
 * Handles CRUD operations for master menu items.
 */

const { generateMasterMenuCode } = require('../../utils/codeGenerator');
const { findBestMatches } = require('../../utils/textSimilarity');
const { 
    PRODUCT_DEFINITIONS, 
    SIZE_VARIANTS,
    generateAllProductVariants, 
    generateProductVariants,
    analyzeMenuName,
    findBestVariantMatch
} = require('../../utils/sizeVariantDetection');

const COLLECTION_NAME = 'masterMenus';

const masterMenuController = {
    /**
     * Create a new master menu
     * - name (Lao) is required
     * - name_en is optional
     * - code is optional (auto-generated if not provided)
     * - masterCategoryCode is optional
     */
    create: async (req, res, db) => {
        try {
            const {
                code: providedCode,
                masterCategoryCode = '',
                name,
                name_en = '',
                name_th = '',
                name_cn = '',
                name_kr = '',
                keywords = [],
                description = '',
                description_en = '',
                imageUrl = '',
                allergens = [],
                isVegetarian = false,
                isVegan = false,
                isHalal = false,
                isGlutenFree = false,
                spiceLevel = 0,
                prepTimeMinutes = 0,
                sortOrder = 0,
                isActive = true
            } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Name (Lao) is required' });
            }

            // If masterCategoryCode provided, verify it exists
            if (masterCategoryCode) {
                const category = await db.collection('masterCategories').findOne({ 
                    code: masterCategoryCode, 
                    isDeleted: false 
                });

                if (!category) {
                    return res.status(400).json({ error: 'Invalid master category code' });
                }
            }

            // Handle code: use provided code or auto-generate
            let code;
            if (providedCode && providedCode.trim()) {
                // Validate uniqueness of provided code
                const existingWithCode = await db.collection(COLLECTION_NAME).findOne({ 
                    code: providedCode.trim().toUpperCase(),
                    isDeleted: false 
                });
                
                if (existingWithCode) {
                    return res.status(400).json({ 
                        error: 'Code already exists. Please use a different code.',
                        existingCode: providedCode 
                    });
                }
                code = providedCode.trim().toUpperCase();
            } else {
                // Auto-generate unique code
                let attempts = 0;
                const maxAttempts = 10;
                
                do {
                    code = generateMasterMenuCode();
                    const existing = await db.collection(COLLECTION_NAME).findOne({ code });
                    if (!existing) break;
                    attempts++;
                } while (attempts < maxAttempts);
                
                if (attempts >= maxAttempts) {
                    return res.status(500).json({ error: 'Failed to generate unique code. Please try again.' });
                }
            }

            const now = new Date();

            const document = {
                code,
                masterCategoryCode,
                name,
                name_en,
                name_th,
                name_cn,
                name_kr,
                keywords: Array.isArray(keywords) ? keywords : [],
                description,
                description_en,
                imageUrl,
                allergens,
                isVegetarian,
                isVegan,
                isHalal,
                isGlutenFree,
                spiceLevel,
                prepTimeMinutes,
                sortOrder,
                isActive,
                isDeleted: false,
                createdAt: now,
                updatedAt: now
            };

            const result = await db.collection(COLLECTION_NAME).insertOne(document);

            res.status(201).json({
                message: 'Master menu created successfully',
                data: { ...document, _id: result.insertedId }
            });
        } catch (error) {
            console.error('Error creating master menu:', error);
            res.status(500).json({ error: 'Failed to create master menu' });
        }
    },

    /**
     * Get all master menus
     */
    getAll: async (req, res, db) => {
        try {
            const { 
                includeDeleted = 'false',
                activeOnly = 'true',
                masterCategoryCode = '',
                search = '',
                limit = 100,
                skip = 0,
                sortBy = 'sortOrder',
                sortOrder = 'asc'
            } = req.query;

            const query = {};
            
            if (includeDeleted !== 'true') {
                query.isDeleted = false;
            }
            
            if (activeOnly === 'true') {
                query.isActive = true;
            }

            if (masterCategoryCode) {
                query.masterCategoryCode = masterCategoryCode;
            }

            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { name_en: { $regex: search, $options: 'i' } },
                    { keywords: { $regex: search, $options: 'i' } }
                ];
            }

            const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

            const [menus, total] = await Promise.all([
                db.collection(COLLECTION_NAME)
                    .find(query)
                    .sort(sort)
                    .skip(parseInt(skip))
                    .limit(parseInt(limit))
                    .toArray(),
                db.collection(COLLECTION_NAME).countDocuments(query)
            ]);

            res.status(200).json({
                data: menus,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    skip: parseInt(skip),
                    hasMore: parseInt(skip) + menus.length < total
                }
            });
        } catch (error) {
            console.error('Error fetching master menus:', error);
            res.status(500).json({ error: 'Failed to fetch master menus' });
        }
    },

    /**
     * Get a single master menu by code
     */
    getByCode: async (req, res, db) => {
        try {
            const { code } = req.params;

            const menu = await db.collection(COLLECTION_NAME).findOne({ 
                code, 
                isDeleted: false 
            });

            if (!menu) {
                return res.status(404).json({ error: 'Master menu not found' });
            }

            // Also fetch the category details
            const category = await db.collection('masterCategories').findOne({
                code: menu.masterCategoryCode,
                isDeleted: false
            });

            res.status(200).json({ 
                data: {
                    ...menu,
                    category
                }
            });
        } catch (error) {
            console.error('Error fetching master menu:', error);
            res.status(500).json({ error: 'Failed to fetch master menu' });
        }
    },

    /**
     * Update a master menu
     */
    update: async (req, res, db) => {
        try {
            const { code } = req.params;
            const updates = req.body;

            // Remove fields that shouldn't be updated
            delete updates._id;
            delete updates.code;
            delete updates.createdAt;

            // If updating category, verify it exists
            if (updates.masterCategoryCode) {
                const category = await db.collection('masterCategories').findOne({ 
                    code: updates.masterCategoryCode, 
                    isDeleted: false 
                });

                if (!category) {
                    return res.status(400).json({ error: 'Invalid master category code' });
                }
            }

            updates.updatedAt = new Date();

            const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
                { code, isDeleted: false },
                { $set: updates },
                { returnDocument: 'after' }
            );

            if (!result) {
                return res.status(404).json({ error: 'Master menu not found' });
            }

            res.status(200).json({
                message: 'Master menu updated successfully',
                data: result
            });
        } catch (error) {
            console.error('Error updating master menu:', error);
            res.status(500).json({ error: 'Failed to update master menu' });
        }
    },

    /**
     * Soft delete a master menu
     */
    delete: async (req, res, db) => {
        try {
            const { code } = req.params;

            const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
                { code, isDeleted: false },
                { 
                    $set: { 
                        isDeleted: true, 
                        isActive: false,
                        updatedAt: new Date() 
                    } 
                },
                { returnDocument: 'after' }
            );

            if (!result) {
                return res.status(404).json({ error: 'Master menu not found' });
            }

            res.status(200).json({
                message: 'Master menu deleted successfully',
                data: result
            });
        } catch (error) {
            console.error('Error deleting master menu:', error);
            res.status(500).json({ error: 'Failed to delete master menu' });
        }
    },

    /**
     * Bulk create master menus
     */
    bulkCreate: async (req, res, db) => {
        try {
            const { menus } = req.body;

            if (!Array.isArray(menus) || menus.length === 0) {
                return res.status(400).json({ error: 'Menus array is required' });
            }

            // Verify all category codes exist
            const categoryCodes = [...new Set(menus.map(m => m.masterCategoryCode))];
            const existingCategories = await db.collection('masterCategories')
                .find({ code: { $in: categoryCodes }, isDeleted: false })
                .toArray();

            const existingCodes = new Set(existingCategories.map(c => c.code));
            const invalidCodes = categoryCodes.filter(c => !existingCodes.has(c));

            if (invalidCodes.length > 0) {
                return res.status(400).json({ 
                    error: 'Invalid category codes', 
                    invalidCodes 
                });
            }

            const now = new Date();
            const documents = menus.map(menu => ({
                code: generateMasterMenuCode(),
                masterCategoryCode: menu.masterCategoryCode,
                name: menu.name,
                name_en: menu.name_en || '',
                name_th: menu.name_th || '',
                name_cn: menu.name_cn || '',
                name_kr: menu.name_kr || '',
                keywords: menu.keywords || [],
                description: menu.description || '',
                imageUrl: menu.imageUrl || '',
                allergens: menu.allergens || [],
                isVegetarian: menu.isVegetarian || false,
                isVegan: menu.isVegan || false,
                isHalal: menu.isHalal || false,
                isGlutenFree: menu.isGlutenFree || false,
                spiceLevel: menu.spiceLevel || 0,
                prepTimeMinutes: menu.prepTimeMinutes || 0,
                sortOrder: menu.sortOrder || 0,
                isActive: true,
                isDeleted: false,
                createdAt: now,
                updatedAt: now
            }));

            const result = await db.collection(COLLECTION_NAME).insertMany(documents);

            res.status(201).json({
                message: `${result.insertedCount} master menus created successfully`,
                data: documents
            });
        } catch (error) {
            console.error('Error bulk creating master menus:', error);
            res.status(500).json({ error: 'Failed to bulk create master menus' });
        }
    },

    /**
     * Find matching master menus for a given name (for auto-suggestion)
     */
    findMatches: async (req, res, db) => {
        try {
            const { name, masterCategoryCode, threshold = 0.3, limit = 5 } = req.query;

            if (!name) {
                return res.status(400).json({ error: 'Name parameter is required' });
            }

            const query = { isDeleted: false, isActive: true };
            if (masterCategoryCode) {
                query.masterCategoryCode = masterCategoryCode;
            }

            const allMenus = await db.collection(COLLECTION_NAME)
                .find(query)
                .toArray();

            const matches = findBestMatches(name, allMenus, parseFloat(threshold), parseInt(limit));

            res.status(200).json({
                query: name,
                matches: matches.map(m => ({
                    code: m.candidate.code,
                    name: m.candidate.name,
                    name_en: m.candidate.name_en,
                    masterCategoryCode: m.candidate.masterCategoryCode,
                    score: Math.round(m.score * 100) / 100,
                    matchType: m.matchType
                }))
            });
        } catch (error) {
            console.error('Error finding menu matches:', error);
            res.status(500).json({ error: 'Failed to find matches' });
        }
    },

    /**
     * Get menus grouped by category
     */
    getGroupedByCategory: async (req, res, db) => {
        try {
            const { activeOnly = 'true' } = req.query;

            const matchQuery = { isDeleted: false };
            if (activeOnly === 'true') {
                matchQuery.isActive = true;
            }

            const result = await db.collection(COLLECTION_NAME).aggregate([
                { $match: matchQuery },
                {
                    $lookup: {
                        from: 'masterCategories',
                        localField: 'masterCategoryCode',
                        foreignField: 'code',
                        as: 'category'
                    }
                },
                { $unwind: '$category' },
                {
                    $group: {
                        _id: '$masterCategoryCode',
                        categoryName: { $first: '$category.name' },
                        categoryNameEn: { $first: '$category.name_en' },
                        menus: { $push: '$$ROOT' },
                        menuCount: { $sum: 1 }
                    }
                },
                { $sort: { 'category.sortOrder': 1 } }
            ]).toArray();

            res.status(200).json({ data: result });
        } catch (error) {
            console.error('Error fetching grouped menus:', error);
            res.status(500).json({ error: 'Failed to fetch grouped menus' });
        }
    },

    /**
     * Get mapping statistics for a master menu
     * Shows how many store menus are mapped to this master menu,
     * from how many restaurants, with optional details
     */
    getMappingStats: async (req, res, db) => {
        try {
            const { code } = req.params;
            const { 
                includeMappings = 'true', 
                mappingLimit = 50,
                mappingSkip = 0,
                mappingSearch = '',
                includePotentialMatches = 'true',
                potentialLimit = 50,
                potentialSkip = 0,
                potentialSearch = ''
            } = req.query;

            // Verify master menu exists
            const masterMenu = await db.collection(COLLECTION_NAME).findOne({ 
                code, 
                isDeleted: false 
            });

            if (!masterMenu) {
                return res.status(404).json({ error: 'Master menu not found' });
            }

            // Get total unique stores in the system (for coverage calculation)
            const totalStoresInSystem = await db.collection('menuMappings').aggregate([
                { $group: { _id: '$storeId' } },
                { $count: 'total' }
            ]).toArray();
            const totalRestaurantsInSystem = totalStoresInSystem[0]?.total || 0;

            // Get mapping statistics - count only
            const mappingCountStats = await db.collection('menuMappings').aggregate([
                { 
                    $match: { 
                        masterMenuCode: code,
                        mappingStatus: 'approved'
                    } 
                },
                {
                    $group: {
                        _id: null,
                        totalMappings: { $sum: 1 },
                        uniqueStores: { $addToSet: '$storeId' }
                    }
                }
            ]).toArray();

            const countStats = mappingCountStats[0] || { totalMappings: 0, uniqueStores: [] };

            const result = {
                masterMenuCode: code,
                masterMenuName: masterMenu.name,
                masterMenuName_en: masterMenu.name_en,
                masterCategoryCode: masterMenu.masterCategoryCode,
                totalMappedItems: countStats.totalMappings,
                restaurantCount: countStats.uniqueStores.length,
                totalRestaurantsInSystem,
                coveragePercentage: totalRestaurantsInSystem > 0 
                    ? Math.round((countStats.uniqueStores.length / totalRestaurantsInSystem) * 100) 
                    : 0,
                canSafelyDelete: countStats.totalMappings === 0
            };

            // Include detailed mappings with pagination and search
            if (includeMappings === 'true') {
                const mappingQuery = {
                    masterMenuCode: code,
                    mappingStatus: 'approved'
                };

                // Add search filter
                if (mappingSearch) {
                    mappingQuery.$or = [
                        { menuName: { $regex: mappingSearch, $options: 'i' } },
                        { originalName: { $regex: mappingSearch, $options: 'i' } },
                        { storeName: { $regex: mappingSearch, $options: 'i' } }
                    ];
                }

                const [mappings, mappingTotal] = await Promise.all([
                    db.collection('menuMappings')
                        .find(mappingQuery)
                        .sort({ approvedAt: -1 })
                        .skip(parseInt(mappingSkip))
                        .limit(parseInt(mappingLimit))
                        .toArray(),
                    db.collection('menuMappings').countDocuments(mappingQuery)
                ]);

                result.mappings = mappings.map(m => ({
                    id: m._id,
                    storeId: m.storeId,
                    storeName: m.storeName || 'Unknown Store',
                    menuItemName: m.menuName || m.originalName || m.normalizedName,
                    menuItemName_en: m.menuName_en,
                    confidence: m.confidenceScore || m.confidence,
                    approvedAt: m.approvedAt || m.updatedAt,
                    approvedBy: m.approvedBy
                }));

                result.mappingsPagination = {
                    total: mappingTotal,
                    limit: parseInt(mappingLimit),
                    skip: parseInt(mappingSkip),
                    hasMore: parseInt(mappingSkip) + mappings.length < mappingTotal
                };
            }

            // Find potential unmapped items with pagination and search
            if (includePotentialMatches === 'true') {
                const searchTerms = [
                    masterMenu.name,
                    masterMenu.name_en,
                    ...(masterMenu.keywords || [])
                ].filter(Boolean);

                if (searchTerms.length > 0) {
                    // Build regex pattern for searching
                    const searchPattern = searchTerms
                        .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                        .join('|');

                    const potentialQuery = {
                        mappingStatus: 'suggested',
                        $or: [
                            { menuName: { $regex: searchPattern, $options: 'i' } },
                            { originalName: { $regex: searchPattern, $options: 'i' } },
                            { normalizedName: { $regex: searchPattern, $options: 'i' } }
                        ]
                    };

                    // Add additional search filter if provided
                    if (potentialSearch) {
                        potentialQuery.$and = [
                            { $or: potentialQuery.$or },
                            {
                                $or: [
                                    { menuName: { $regex: potentialSearch, $options: 'i' } },
                                    { storeName: { $regex: potentialSearch, $options: 'i' } }
                                ]
                            }
                        ];
                        delete potentialQuery.$or;
                    }

                    const [potentialMatches, potentialTotal] = await Promise.all([
                        db.collection('menuMappings')
                            .find(potentialQuery)
                            .sort({ confidenceScore: -1 })
                            .skip(parseInt(potentialSkip))
                            .limit(parseInt(potentialLimit))
                            .toArray(),
                        db.collection('menuMappings').countDocuments(potentialQuery)
                    ]);

                    result.potentialUnmapped = potentialMatches.map(m => ({
                        id: m._id,
                        storeId: m.storeId,
                        storeName: m.storeName || 'Unknown Store',
                        menuItemName: m.menuName || m.originalName || m.normalizedName,
                        confidence: m.confidenceScore || m.confidence,
                        suggestedMasterCode: m.suggestedMasterMenuCode || (m.suggestedMappings?.[0]?.masterMenuCode)
                    }));

                    result.potentialPagination = {
                        total: potentialTotal,
                        limit: parseInt(potentialLimit),
                        skip: parseInt(potentialSkip),
                        hasMore: parseInt(potentialSkip) + potentialMatches.length < potentialTotal
                    };
                }
            }

            res.status(200).json({ data: result });
        } catch (error) {
            console.error('Error getting menu mapping stats:', error);
            res.status(500).json({ error: 'Failed to get mapping statistics' });
        }
    },

    /**
     * Get all product definitions (Heineken, Beer Lao, etc.)
     */
    getProductDefinitions: async (req, res, db) => {
        try {
            res.status(200).json({
                data: {
                    products: PRODUCT_DEFINITIONS,
                    sizeVariants: SIZE_VARIANTS
                }
            });
        } catch (error) {
            console.error('Error getting product definitions:', error);
            res.status(500).json({ error: 'Failed to get product definitions' });
        }
    },

    /**
     * Seed master menu variants for all defined products
     * Creates product+size combinations as master menus
     */
    seedProductVariants: async (req, res, db) => {
        try {
            const { productIds, categoryCode, dryRun = false } = req.body;

            // Get the category for beverages
            let masterCategoryCode = categoryCode;
            if (!masterCategoryCode) {
                // Try to find or create a "Beverages" category
                let beverageCategory = await db.collection('masterCategories').findOne({
                    $or: [
                        { code: 'BEVERAGES' },
                        { name: { $regex: /ເຄື່ອງດື່ມ|beverage|drink/i } }
                    ],
                    isDeleted: false
                });

                if (!beverageCategory) {
                    // Create the category
                    const now = new Date();
                    const newCategory = {
                        code: 'BEVERAGES',
                        name: 'ເຄື່ອງດື່ມ',
                        name_en: 'Beverages',
                        description: 'Beer, soft drinks, water, and other beverages',
                        sortOrder: 100,
                        isActive: true,
                        isDeleted: false,
                        createdAt: now,
                        updatedAt: now
                    };
                    await db.collection('masterCategories').insertOne(newCategory);
                    masterCategoryCode = 'BEVERAGES';
                } else {
                    masterCategoryCode = beverageCategory.code;
                }
            }

            // Generate variants
            let variants;
            if (productIds && productIds.length > 0) {
                variants = [];
                for (const productId of productIds) {
                    variants.push(...generateProductVariants(productId));
                }
            } else {
                variants = generateAllProductVariants();
            }

            const now = new Date();
            const results = {
                created: [],
                skipped: [],
                errors: []
            };

            for (const variant of variants) {
                try {
                    // Check if this variant already exists
                    const existing = await db.collection(COLLECTION_NAME).findOne({
                        $or: [
                            { baseProduct: variant.productId, sizeVariant: variant.variantId },
                            { name: variant.name }
                        ],
                        isDeleted: false
                    });

                    if (existing) {
                        results.skipped.push({
                            name: variant.name,
                            reason: 'Already exists',
                            existingCode: existing.code
                        });
                        continue;
                    }

                    if (dryRun) {
                        results.created.push({
                            name: variant.name,
                            name_en: variant.nameEn,
                            productId: variant.productId,
                            variantId: variant.variantId,
                            dryRun: true
                        });
                        continue;
                    }

                    // Create the master menu
                    const code = generateMasterMenuCode();
                    const document = {
                        code,
                        masterCategoryCode,
                        name: variant.name,
                        name_en: variant.nameEn,
                        name_th: '',
                        name_cn: '',
                        name_kr: '',
                        keywords: [
                            variant.productId,
                            variant.variantId,
                            PRODUCT_DEFINITIONS[variant.productId]?.name || '',
                            PRODUCT_DEFINITIONS[variant.productId]?.nameLao || '',
                            SIZE_VARIANTS[variant.variantId]?.name || '',
                            SIZE_VARIANTS[variant.variantId]?.nameEn || ''
                        ].filter(Boolean),
                        description: `${variant.nameEn} - Auto-generated product variant`,
                        description_en: `${variant.nameEn} - Auto-generated product variant`,
                        baseProduct: variant.productId,
                        sizeVariant: variant.variantId,
                        sizeCategory: variant.sizeCategory,
                        productCategory: variant.category,
                        isDefaultVariant: variant.isDefault,
                        imageUrl: '',
                        allergens: [],
                        isVegetarian: false,
                        isVegan: false,
                        isHalal: false,
                        isGlutenFree: false,
                        spiceLevel: 0,
                        prepTimeMinutes: 0,
                        sortOrder: 0,
                        isActive: true,
                        isDeleted: false,
                        createdAt: now,
                        updatedAt: now
                    };

                    await db.collection(COLLECTION_NAME).insertOne(document);
                    results.created.push({
                        code,
                        name: variant.name,
                        name_en: variant.nameEn,
                        productId: variant.productId,
                        variantId: variant.variantId
                    });
                } catch (err) {
                    results.errors.push({
                        name: variant.name,
                        error: err.message
                    });
                }
            }

            res.status(200).json({
                message: dryRun 
                    ? `Dry run: Would create ${results.created.length} variants`
                    : `Created ${results.created.length} variants, skipped ${results.skipped.length}`,
                data: results
            });
        } catch (error) {
            console.error('Error seeding product variants:', error);
            res.status(500).json({ error: 'Failed to seed product variants' });
        }
    },

    /**
     * Get master menus filtered by product
     */
    getByProduct: async (req, res, db) => {
        try {
            const { productId } = req.params;
            const { includeUnassigned = 'false' } = req.query;

            const query = { isDeleted: false, isActive: true };

            if (productId && productId !== 'all') {
                query.baseProduct = productId;
            } else if (includeUnassigned !== 'true') {
                // If getting all, only return those with baseProduct set
                query.baseProduct = { $exists: true, $ne: null };
            }

            const menus = await db.collection(COLLECTION_NAME)
                .find(query)
                .sort({ baseProduct: 1, sizeVariant: 1 })
                .toArray();

            // Group by product
            const grouped = {};
            for (const menu of menus) {
                const product = menu.baseProduct || 'unassigned';
                if (!grouped[product]) {
                    grouped[product] = {
                        productId: product,
                        productName: PRODUCT_DEFINITIONS[product]?.name || 'Other',
                        productNameLao: PRODUCT_DEFINITIONS[product]?.nameLao || '',
                        variants: []
                    };
                }
                grouped[product].variants.push(menu);
            }

            res.status(200).json({
                data: productId && productId !== 'all' ? (grouped[productId] || { variants: [] }) : grouped
            });
        } catch (error) {
            console.error('Error fetching menus by product:', error);
            res.status(500).json({ error: 'Failed to fetch menus by product' });
        }
    },

    /**
     * Analyze a menu name for product and size detection
     */
    analyzeForVariant: async (req, res, db) => {
        try {
            const { menuName } = req.body;

            if (!menuName) {
                return res.status(400).json({ error: 'menuName is required' });
            }

            const analysis = analyzeMenuName(menuName);

            // Also find existing master menus that match
            if (analysis.product) {
                const matchingMenus = await db.collection(COLLECTION_NAME).find({
                    baseProduct: analysis.product.productId,
                    isDeleted: false,
                    isActive: true
                }).toArray();

                const bestMatch = findBestVariantMatch(menuName, matchingMenus);
                analysis.existingMatches = matchingMenus;
                analysis.bestMatch = bestMatch;
            }

            res.status(200).json({ data: analysis });
        } catch (error) {
            console.error('Error analyzing menu for variant:', error);
            res.status(500).json({ error: 'Failed to analyze menu' });
        }
    },

    /**
     * Update existing master menus to assign product and variant IDs
     */
    assignProductVariants: async (req, res, db) => {
        try {
            const { dryRun = true } = req.body;

            // Get all master menus without product/variant assignment
            const unassignedMenus = await db.collection(COLLECTION_NAME).find({
                $or: [
                    { baseProduct: { $exists: false } },
                    { baseProduct: null },
                    { baseProduct: '' }
                ],
                isDeleted: false
            }).toArray();

            const results = {
                analyzed: 0,
                assigned: [],
                unmatched: [],
                errors: []
            };

            for (const menu of unassignedMenus) {
                results.analyzed++;
                
                try {
                    const analysis = analyzeMenuName(menu.name);

                    if (analysis.product && analysis.finalVariant) {
                        if (!dryRun) {
                            await db.collection(COLLECTION_NAME).updateOne(
                                { _id: menu._id },
                                {
                                    $set: {
                                        baseProduct: analysis.product.productId,
                                        sizeVariant: analysis.finalVariant.variantId,
                                        sizeCategory: analysis.finalVariant.category,
                                        productCategory: analysis.product.category,
                                        isDefaultVariant: analysis.finalVariant.isDefault || false,
                                        updatedAt: new Date()
                                    }
                                }
                            );
                        }

                        results.assigned.push({
                            code: menu.code,
                            name: menu.name,
                            detectedProduct: analysis.product.productId,
                            detectedVariant: analysis.finalVariant.variantId,
                            wasDefault: analysis.usedDefaultVariant
                        });
                    } else {
                        results.unmatched.push({
                            code: menu.code,
                            name: menu.name,
                            reason: !analysis.product ? 'No product detected' : 'No variant detected'
                        });
                    }
                } catch (err) {
                    results.errors.push({
                        code: menu.code,
                        name: menu.name,
                        error: err.message
                    });
                }
            }

            res.status(200).json({
                message: dryRun 
                    ? `Dry run: Would assign ${results.assigned.length} of ${results.analyzed} menus`
                    : `Assigned ${results.assigned.length} of ${results.analyzed} menus`,
                data: results
            });
        } catch (error) {
            console.error('Error assigning product variants:', error);
            res.status(500).json({ error: 'Failed to assign product variants' });
        }
    },

    /**
     * Delete all product variants (to allow re-seeding with corrected names)
     */
    deleteProductVariants: async (req, res, db) => {
        try {
            const { productIds, dryRun = true } = req.body;

            // Build query for product variants
            const query = {
                baseProduct: { $exists: true, $ne: null },
                isDeleted: false
            };

            if (productIds && productIds.length > 0) {
                query.baseProduct = { $in: productIds };
            }

            // Find variants to delete
            const variantsToDelete = await db.collection(COLLECTION_NAME)
                .find(query)
                .toArray();

            if (dryRun) {
                return res.status(200).json({
                    message: `Dry run: Would delete ${variantsToDelete.length} product variants`,
                    data: {
                        count: variantsToDelete.length,
                        variants: variantsToDelete.map(v => ({
                            code: v.code,
                            name: v.name,
                            baseProduct: v.baseProduct,
                            sizeVariant: v.sizeVariant
                        }))
                    }
                });
            }

            // Soft delete the variants
            const result = await db.collection(COLLECTION_NAME).updateMany(
                query,
                {
                    $set: {
                        isDeleted: true,
                        isActive: false,
                        deletedAt: new Date(),
                        deleteReason: 'Re-seeding with corrected names'
                    }
                }
            );

            res.status(200).json({
                message: `Deleted ${result.modifiedCount} product variants`,
                data: {
                    deletedCount: result.modifiedCount,
                    variants: variantsToDelete.map(v => ({
                        code: v.code,
                        name: v.name,
                        baseProduct: v.baseProduct
                    }))
                }
            });
        } catch (error) {
            console.error('Error deleting product variants:', error);
            res.status(500).json({ error: 'Failed to delete product variants' });
        }
    },

    /**
     * Learn keywords from approved mappings
     * This extracts unique menu names from approved mappings and adds them as keywords
     * to the corresponding master menus for better future matching
     */
    learnKeywordsFromMappings: async (req, res, db) => {
        try {
            const { dryRun = true, limit = 1000 } = req.body;

            // Get all approved mappings with their original menu names
            const approvedMappings = await db.collection('menuMappings')
                .find({
                    mappingStatus: 'approved',
                    masterMenuCode: { $exists: true, $ne: null },
                    menuName: { $exists: true, $ne: null }
                })
                .limit(parseInt(limit))
                .toArray();

            console.log(`[Learn Keywords] Found ${approvedMappings.length} approved mappings`);

            // Group by master menu code
            const keywordsByMaster = {};
            for (const mapping of approvedMappings) {
                const code = mapping.masterMenuCode;
                const menuName = mapping.menuName?.trim();
                
                if (!menuName || menuName.length < 2) continue;

                if (!keywordsByMaster[code]) {
                    keywordsByMaster[code] = new Set();
                }
                
                // Add the original menu name as a potential keyword
                keywordsByMaster[code].add(menuName);
                
                // Also add normalized version (lowercase, no extra spaces)
                const normalized = menuName.toLowerCase().replace(/\s+/g, ' ').trim();
                if (normalized !== menuName) {
                    keywordsByMaster[code].add(normalized);
                }
            }

            const results = {
                mastersUpdated: 0,
                keywordsAdded: 0,
                skipped: 0,
                details: []
            };

            // Update each master menu with learned keywords
            for (const [masterCode, keywords] of Object.entries(keywordsByMaster)) {
                try {
                    // Get current master menu
                    const masterMenu = await db.collection(COLLECTION_NAME).findOne({
                        code: masterCode,
                        isDeleted: false
                    });

                    if (!masterMenu) {
                        results.skipped++;
                        continue;
                    }

                    // Get existing keywords (both manual and learned)
                    const existingKeywords = new Set([
                        ...(masterMenu.keywords || []),
                        ...(masterMenu.learnedKeywords || [])
                    ].map(k => k.toLowerCase()));

                    // Filter to only new keywords
                    const newKeywords = [...keywords].filter(kw => 
                        !existingKeywords.has(kw.toLowerCase()) &&
                        kw.toLowerCase() !== masterMenu.name?.toLowerCase() &&
                        kw.toLowerCase() !== masterMenu.name_en?.toLowerCase()
                    );

                    if (newKeywords.length === 0) {
                        results.skipped++;
                        continue;
                    }

                    if (!dryRun) {
                        // Add to learnedKeywords array (separate from manual keywords)
                        await db.collection(COLLECTION_NAME).updateOne(
                            { code: masterCode },
                            {
                                $addToSet: {
                                    learnedKeywords: { $each: newKeywords }
                                },
                                $set: { updatedAt: new Date() }
                            }
                        );
                    }

                    results.mastersUpdated++;
                    results.keywordsAdded += newKeywords.length;
                    results.details.push({
                        masterCode,
                        masterName: masterMenu.name,
                        newKeywords: newKeywords.slice(0, 5), // Limit for response size
                        totalNewKeywords: newKeywords.length
                    });

                } catch (err) {
                    console.error(`Error updating master ${masterCode}:`, err);
                }
            }

            res.status(200).json({
                message: dryRun 
                    ? `Dry run: Would update ${results.mastersUpdated} master menus with ${results.keywordsAdded} keywords`
                    : `Updated ${results.mastersUpdated} master menus with ${results.keywordsAdded} keywords`,
                data: results
            });
        } catch (error) {
            console.error('Error learning keywords from mappings:', error);
            res.status(500).json({ error: 'Failed to learn keywords from mappings' });
        }
    },

    /**
     * Add a single keyword to a master menu
     * Called when a mapping is approved to learn the original menu name
     */
    addLearnedKeyword: async (req, res, db) => {
        try {
            const { masterMenuCode, keyword } = req.body;

            if (!masterMenuCode || !keyword) {
                return res.status(400).json({ error: 'masterMenuCode and keyword are required' });
            }

            const normalizedKeyword = keyword.trim();
            if (normalizedKeyword.length < 2) {
                return res.status(400).json({ error: 'Keyword too short' });
            }

            // Get master menu
            const masterMenu = await db.collection(COLLECTION_NAME).findOne({
                code: masterMenuCode,
                isDeleted: false
            });

            if (!masterMenu) {
                return res.status(404).json({ error: 'Master menu not found' });
            }

            // Check if keyword already exists
            const allKeywords = [
                ...(masterMenu.keywords || []),
                ...(masterMenu.learnedKeywords || [])
            ].map(k => k.toLowerCase());

            if (allKeywords.includes(normalizedKeyword.toLowerCase())) {
                return res.status(200).json({
                    message: 'Keyword already exists',
                    data: { added: false, keyword: normalizedKeyword }
                });
            }

            // Add to learnedKeywords
            await db.collection(COLLECTION_NAME).updateOne(
                { code: masterMenuCode },
                {
                    $addToSet: { learnedKeywords: normalizedKeyword },
                    $set: { updatedAt: new Date() }
                }
            );

            res.status(200).json({
                message: 'Keyword added successfully',
                data: { added: true, keyword: normalizedKeyword, masterMenuCode }
            });
        } catch (error) {
            console.error('Error adding learned keyword:', error);
            res.status(500).json({ error: 'Failed to add keyword' });
        }
    }
};

module.exports = masterMenuController;
