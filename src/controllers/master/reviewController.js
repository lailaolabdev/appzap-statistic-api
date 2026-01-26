/**
 * Review Controller
 * 
 * Handles admin review operations for mapping suggestions.
 * Supports approval, rejection, manual mapping, and bulk operations.
 */

const { ObjectId } = require('mongodb');

const reviewController = {
    // ============ REVIEW QUEUE ============

    /**
     * Get menu mappings review queue
     * Supports filtering by status, confidence level, and store
     */
    getMenuReviewQueue: async (req, res, db) => {
        try {
            const {
                storeId,
                status = 'suggested',
                confidenceLevel,
                minConfidence,
                maxConfidence,
                sortBy = 'confidenceScore',
                sortOrder = 'desc',
                limit = 50,
                skip = 0
            } = req.query;

            // Build query
            const query = { mappingStatus: status };

            if (storeId) {
                query.storeId = new ObjectId(storeId);
            }

            if (confidenceLevel) {
                // Map confidence level to score ranges
                const levelRanges = {
                    'high': { $gte: 95 },
                    'medium': { $gte: 60, $lt: 95 },
                    'low': { $gte: 1, $lt: 60 },
                    'none': { $lt: 1 }
                };
                if (levelRanges[confidenceLevel]) {
                    query.confidenceScore = levelRanges[confidenceLevel];
                }
            } else if (minConfidence || maxConfidence) {
                query.confidenceScore = {};
                if (minConfidence) query.confidenceScore.$gte = parseFloat(minConfidence);
                if (maxConfidence) query.confidenceScore.$lte = parseFloat(maxConfidence);
            }

            // Build sort
            const sort = {};
            sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

            const [items, total] = await Promise.all([
                db.collection('menuMappings')
                    .find(query)
                    .sort(sort)
                    .skip(parseInt(skip))
                    .limit(parseInt(limit))
                    .toArray(),
                db.collection('menuMappings').countDocuments(query)
            ]);

            res.status(200).json({
                data: items,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    skip: parseInt(skip),
                    hasMore: parseInt(skip) + items.length < total
                }
            });
        } catch (error) {
            console.error('Error fetching menu review queue:', error);
            res.status(500).json({ error: 'Failed to fetch review queue' });
        }
    },

    /**
     * Get category mappings review queue
     */
    getCategoryReviewQueue: async (req, res, db) => {
        try {
            const {
                storeId,
                status = 'suggested',
                confidenceLevel,
                minConfidence,
                maxConfidence,
                sortBy = 'confidenceScore',
                sortOrder = 'desc',
                limit = 50,
                skip = 0
            } = req.query;

            // Build query
            const query = { mappingStatus: status };

            if (storeId) {
                query.storeId = new ObjectId(storeId);
            }

            if (confidenceLevel) {
                const levelRanges = {
                    'high': { $gte: 95 },
                    'medium': { $gte: 60, $lt: 95 },
                    'low': { $gte: 1, $lt: 60 },
                    'none': { $lt: 1 }
                };
                if (levelRanges[confidenceLevel]) {
                    query.confidenceScore = levelRanges[confidenceLevel];
                }
            } else if (minConfidence || maxConfidence) {
                query.confidenceScore = {};
                if (minConfidence) query.confidenceScore.$gte = parseFloat(minConfidence);
                if (maxConfidence) query.confidenceScore.$lte = parseFloat(maxConfidence);
            }

            const sort = {};
            sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

            const [items, total] = await Promise.all([
                db.collection('categoryMappings')
                    .find(query)
                    .sort(sort)
                    .skip(parseInt(skip))
                    .limit(parseInt(limit))
                    .toArray(),
                db.collection('categoryMappings').countDocuments(query)
            ]);

            res.status(200).json({
                data: items,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    skip: parseInt(skip),
                    hasMore: parseInt(skip) + items.length < total
                }
            });
        } catch (error) {
            console.error('Error fetching category review queue:', error);
            res.status(500).json({ error: 'Failed to fetch review queue' });
        }
    },

    /**
     * Get single menu mapping for review
     */
    getMenuMappingForReview: async (req, res, db) => {
        try {
            const { id } = req.params;

            const mapping = await db.collection('menuMappings').findOne({
                _id: new ObjectId(id)
            });

            if (!mapping) {
                return res.status(404).json({ error: 'Menu mapping not found' });
            }

            // Get the original menu details
            let originalMenu = null;
            if (mapping.menuId) {
                originalMenu = await db.collection('menus').findOne({
                    _id: mapping.menuId
                });
            }

            // Get the suggested master menus details
            let suggestedMasters = [];
            if (mapping.suggestedMappings && mapping.suggestedMappings.length > 0) {
                const codes = mapping.suggestedMappings.map(s => s.masterMenuCode);
                suggestedMasters = await db.collection('masterMenus')
                    .find({ code: { $in: codes } })
                    .toArray();
            }

            res.status(200).json({
                mapping,
                originalMenu,
                suggestedMasters
            });
        } catch (error) {
            console.error('Error fetching menu mapping for review:', error);
            res.status(500).json({ error: 'Failed to fetch mapping' });
        }
    },

    /**
     * Get single category mapping for review
     */
    getCategoryMappingForReview: async (req, res, db) => {
        try {
            const { id } = req.params;

            const mapping = await db.collection('categoryMappings').findOne({
                _id: new ObjectId(id)
            });

            if (!mapping) {
                return res.status(404).json({ error: 'Category mapping not found' });
            }

            // Get the original category details
            let originalCategory = null;
            if (mapping.categoryId) {
                originalCategory = await db.collection('categories').findOne({
                    _id: mapping.categoryId
                });
            }

            // Get the suggested master categories details
            let suggestedMasters = [];
            if (mapping.suggestedMappings && mapping.suggestedMappings.length > 0) {
                const codes = mapping.suggestedMappings.map(s => s.masterCategoryCode);
                suggestedMasters = await db.collection('masterCategories')
                    .find({ code: { $in: codes } })
                    .toArray();
            }

            res.status(200).json({
                mapping,
                originalCategory,
                suggestedMasters
            });
        } catch (error) {
            console.error('Error fetching category mapping for review:', error);
            res.status(500).json({ error: 'Failed to fetch mapping' });
        }
    },

    // ============ APPROVAL OPERATIONS ============

    /**
     * Approve a menu mapping
     */
    approveMenuMapping: async (req, res, db) => {
        try {
            const { id } = req.params;
            const { 
                masterMenuCode,
                approvedBy = 'admin',
                notes = ''
            } = req.body;

            // Get the mapping
            const mapping = await db.collection('menuMappings').findOne({
                _id: new ObjectId(id)
            });

            if (!mapping) {
                return res.status(404).json({ error: 'Menu mapping not found' });
            }

            // Determine the master code to use
            const codeToUse = masterMenuCode || 
                (mapping.suggestedMappings && mapping.suggestedMappings[0]?.masterMenuCode);

            if (!codeToUse) {
                return res.status(400).json({ error: 'No master menu code provided or suggested' });
            }

            // Verify master menu exists
            const masterMenu = await db.collection('masterMenus').findOne({
                code: codeToUse,
                isDeleted: false
            });

            if (!masterMenu) {
                return res.status(404).json({ error: 'Master menu not found' });
            }

            const now = new Date();

            // Update the mapping
            const result = await db.collection('menuMappings').findOneAndUpdate(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        masterMenuCode: codeToUse,
                        masterMenuName: masterMenu.name,
                        masterMenuName_en: masterMenu.name_en,
                        mappingStatus: 'approved',
                        approvedBy,
                        approvedAt: now,
                        notes,
                        updatedAt: now
                    }
                },
                { returnDocument: 'after' }
            );

            // Create/update mapping decision for future auto-mapping
            await db.collection('mappingDecisions').updateOne(
                {
                    entityType: 'menu',
                    normalizedName: mapping.normalizedName
                },
                {
                    $set: {
                        entityType: 'menu',
                        originalName: mapping.menuName,
                        normalizedName: mapping.normalizedName,
                        masterCode: codeToUse,
                        masterName: masterMenu.name,
                        masterName_en: masterMenu.name_en,
                        decisionType: 'approved',
                        decisionBy: approvedBy,
                        decisionAt: now,
                        updatedAt: now
                    },
                    $setOnInsert: {
                        timesApplied: 0,
                        storeIds: [],
                        createdAt: now
                    },
                    $addToSet: { storeIds: mapping.storeId }
                },
                { upsert: true }
            );

            // Update stats
            await reviewController._updateMappingStats(db, 'menu');

            res.status(200).json({
                message: 'Menu mapping approved successfully',
                data: result
            });
        } catch (error) {
            console.error('Error approving menu mapping:', error);
            res.status(500).json({ error: 'Failed to approve mapping' });
        }
    },

    /**
     * Approve a category mapping
     */
    approveCategoryMapping: async (req, res, db) => {
        try {
            const { id } = req.params;
            const { 
                masterCategoryCode,
                approvedBy = 'admin',
                notes = ''
            } = req.body;

            const mapping = await db.collection('categoryMappings').findOne({
                _id: new ObjectId(id)
            });

            if (!mapping) {
                return res.status(404).json({ error: 'Category mapping not found' });
            }

            const codeToUse = masterCategoryCode || 
                (mapping.suggestedMappings && mapping.suggestedMappings[0]?.masterCategoryCode);

            if (!codeToUse) {
                return res.status(400).json({ error: 'No master category code provided or suggested' });
            }

            const masterCategory = await db.collection('masterCategories').findOne({
                code: codeToUse,
                isDeleted: false
            });

            if (!masterCategory) {
                return res.status(404).json({ error: 'Master category not found' });
            }

            const now = new Date();

            const result = await db.collection('categoryMappings').findOneAndUpdate(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        masterCategoryCode: codeToUse,
                        masterCategoryName: masterCategory.name,
                        masterCategoryName_en: masterCategory.name_en,
                        mappingStatus: 'approved',
                        approvedBy,
                        approvedAt: now,
                        notes,
                        updatedAt: now
                    }
                },
                { returnDocument: 'after' }
            );

            // Create/update mapping decision
            await db.collection('mappingDecisions').updateOne(
                {
                    entityType: 'category',
                    normalizedName: mapping.normalizedName
                },
                {
                    $set: {
                        entityType: 'category',
                        originalName: mapping.categoryName,
                        normalizedName: mapping.normalizedName,
                        masterCode: codeToUse,
                        masterName: masterCategory.name,
                        masterName_en: masterCategory.name_en,
                        decisionType: 'approved',
                        decisionBy: approvedBy,
                        decisionAt: now,
                        updatedAt: now
                    },
                    $setOnInsert: {
                        timesApplied: 0,
                        storeIds: [],
                        createdAt: now
                    },
                    $addToSet: { storeIds: mapping.storeId }
                },
                { upsert: true }
            );

            await reviewController._updateMappingStats(db, 'category');

            res.status(200).json({
                message: 'Category mapping approved successfully',
                data: result
            });
        } catch (error) {
            console.error('Error approving category mapping:', error);
            res.status(500).json({ error: 'Failed to approve mapping' });
        }
    },

    // ============ REJECTION OPERATIONS ============

    /**
     * Reject a menu mapping
     */
    rejectMenuMapping: async (req, res, db) => {
        try {
            const { id } = req.params;
            const { 
                rejectedBy = 'admin',
                rejectionReason = '',
                notes = ''
            } = req.body;

            const mapping = await db.collection('menuMappings').findOne({
                _id: new ObjectId(id)
            });

            if (!mapping) {
                return res.status(404).json({ error: 'Menu mapping not found' });
            }

            const now = new Date();

            const result = await db.collection('menuMappings').findOneAndUpdate(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        mappingStatus: 'rejected',
                        rejectedBy,
                        rejectedAt: now,
                        rejectionReason,
                        notes,
                        updatedAt: now
                    }
                },
                { returnDocument: 'after' }
            );

            // Create mapping decision for rejected items
            await db.collection('mappingDecisions').updateOne(
                {
                    entityType: 'menu',
                    normalizedName: mapping.normalizedName
                },
                {
                    $set: {
                        entityType: 'menu',
                        originalName: mapping.menuName,
                        normalizedName: mapping.normalizedName,
                        masterCode: null,
                        masterName: null,
                        masterName_en: null,
                        decisionType: 'rejected',
                        decisionBy: rejectedBy,
                        decisionAt: now,
                        rejectionReason,
                        updatedAt: now
                    },
                    $setOnInsert: {
                        timesApplied: 0,
                        storeIds: [],
                        createdAt: now
                    },
                    $addToSet: { storeIds: mapping.storeId }
                },
                { upsert: true }
            );

            await reviewController._updateMappingStats(db, 'menu');

            res.status(200).json({
                message: 'Menu mapping rejected successfully',
                data: result
            });
        } catch (error) {
            console.error('Error rejecting menu mapping:', error);
            res.status(500).json({ error: 'Failed to reject mapping' });
        }
    },

    /**
     * Reject a category mapping
     */
    rejectCategoryMapping: async (req, res, db) => {
        try {
            const { id } = req.params;
            const { 
                rejectedBy = 'admin',
                rejectionReason = '',
                notes = ''
            } = req.body;

            const mapping = await db.collection('categoryMappings').findOne({
                _id: new ObjectId(id)
            });

            if (!mapping) {
                return res.status(404).json({ error: 'Category mapping not found' });
            }

            const now = new Date();

            const result = await db.collection('categoryMappings').findOneAndUpdate(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        mappingStatus: 'rejected',
                        rejectedBy,
                        rejectedAt: now,
                        rejectionReason,
                        notes,
                        updatedAt: now
                    }
                },
                { returnDocument: 'after' }
            );

            await db.collection('mappingDecisions').updateOne(
                {
                    entityType: 'category',
                    normalizedName: mapping.normalizedName
                },
                {
                    $set: {
                        entityType: 'category',
                        originalName: mapping.categoryName,
                        normalizedName: mapping.normalizedName,
                        masterCode: null,
                        masterName: null,
                        masterName_en: null,
                        decisionType: 'rejected',
                        decisionBy: rejectedBy,
                        decisionAt: now,
                        rejectionReason,
                        updatedAt: now
                    },
                    $setOnInsert: {
                        timesApplied: 0,
                        storeIds: [],
                        createdAt: now
                    },
                    $addToSet: { storeIds: mapping.storeId }
                },
                { upsert: true }
            );

            await reviewController._updateMappingStats(db, 'category');

            res.status(200).json({
                message: 'Category mapping rejected successfully',
                data: result
            });
        } catch (error) {
            console.error('Error rejecting category mapping:', error);
            res.status(500).json({ error: 'Failed to reject mapping' });
        }
    },

    // ============ MANUAL MAPPING ============

    /**
     * Manually map a menu to a different master
     */
    manualMapMenu: async (req, res, db) => {
        try {
            const { id } = req.params;
            const { 
                masterMenuCode,
                approvedBy = 'admin',
                notes = ''
            } = req.body;

            if (!masterMenuCode) {
                return res.status(400).json({ error: 'masterMenuCode is required' });
            }

            const mapping = await db.collection('menuMappings').findOne({
                _id: new ObjectId(id)
            });

            if (!mapping) {
                return res.status(404).json({ error: 'Menu mapping not found' });
            }

            const masterMenu = await db.collection('masterMenus').findOne({
                code: masterMenuCode,
                isDeleted: false
            });

            if (!masterMenu) {
                return res.status(404).json({ error: 'Master menu not found' });
            }

            const now = new Date();

            const result = await db.collection('menuMappings').findOneAndUpdate(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        masterMenuCode,
                        masterMenuName: masterMenu.name,
                        masterMenuName_en: masterMenu.name_en,
                        mappingStatus: 'approved',
                        mappingMethod: 'manual',
                        approvedBy,
                        approvedAt: now,
                        notes,
                        updatedAt: now
                    }
                },
                { returnDocument: 'after' }
            );

            // Create mapping decision
            await db.collection('mappingDecisions').updateOne(
                {
                    entityType: 'menu',
                    normalizedName: mapping.normalizedName
                },
                {
                    $set: {
                        entityType: 'menu',
                        originalName: mapping.menuName,
                        normalizedName: mapping.normalizedName,
                        masterCode: masterMenuCode,
                        masterName: masterMenu.name,
                        masterName_en: masterMenu.name_en,
                        decisionType: 'approved',
                        decisionBy: approvedBy,
                        decisionAt: now,
                        updatedAt: now
                    },
                    $setOnInsert: {
                        timesApplied: 0,
                        storeIds: [],
                        createdAt: now
                    },
                    $addToSet: { storeIds: mapping.storeId }
                },
                { upsert: true }
            );

            await reviewController._updateMappingStats(db, 'menu');

            res.status(200).json({
                message: 'Menu manually mapped successfully',
                data: result
            });
        } catch (error) {
            console.error('Error manually mapping menu:', error);
            res.status(500).json({ error: 'Failed to manually map menu' });
        }
    },

    /**
     * Manually map a category to a different master
     */
    manualMapCategory: async (req, res, db) => {
        try {
            const { id } = req.params;
            const { 
                masterCategoryCode,
                approvedBy = 'admin',
                notes = ''
            } = req.body;

            if (!masterCategoryCode) {
                return res.status(400).json({ error: 'masterCategoryCode is required' });
            }

            const mapping = await db.collection('categoryMappings').findOne({
                _id: new ObjectId(id)
            });

            if (!mapping) {
                return res.status(404).json({ error: 'Category mapping not found' });
            }

            const masterCategory = await db.collection('masterCategories').findOne({
                code: masterCategoryCode,
                isDeleted: false
            });

            if (!masterCategory) {
                return res.status(404).json({ error: 'Master category not found' });
            }

            const now = new Date();

            const result = await db.collection('categoryMappings').findOneAndUpdate(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        masterCategoryCode,
                        masterCategoryName: masterCategory.name,
                        masterCategoryName_en: masterCategory.name_en,
                        mappingStatus: 'approved',
                        mappingMethod: 'manual',
                        approvedBy,
                        approvedAt: now,
                        notes,
                        updatedAt: now
                    }
                },
                { returnDocument: 'after' }
            );

            await db.collection('mappingDecisions').updateOne(
                {
                    entityType: 'category',
                    normalizedName: mapping.normalizedName
                },
                {
                    $set: {
                        entityType: 'category',
                        originalName: mapping.categoryName,
                        normalizedName: mapping.normalizedName,
                        masterCode: masterCategoryCode,
                        masterName: masterCategory.name,
                        masterName_en: masterCategory.name_en,
                        decisionType: 'approved',
                        decisionBy: approvedBy,
                        decisionAt: now,
                        updatedAt: now
                    },
                    $setOnInsert: {
                        timesApplied: 0,
                        storeIds: [],
                        createdAt: now
                    },
                    $addToSet: { storeIds: mapping.storeId }
                },
                { upsert: true }
            );

            await reviewController._updateMappingStats(db, 'category');

            res.status(200).json({
                message: 'Category manually mapped successfully',
                data: result
            });
        } catch (error) {
            console.error('Error manually mapping category:', error);
            res.status(500).json({ error: 'Failed to manually map category' });
        }
    },

    // ============ NOT APPLICABLE ============

    /**
     * Mark a menu mapping as not applicable
     */
    markMenuNotApplicable: async (req, res, db) => {
        try {
            const { id } = req.params;
            const { 
                markedBy = 'admin',
                reason = '',
                notes = ''
            } = req.body;

            const mapping = await db.collection('menuMappings').findOne({
                _id: new ObjectId(id)
            });

            if (!mapping) {
                return res.status(404).json({ error: 'Menu mapping not found' });
            }

            const now = new Date();

            const result = await db.collection('menuMappings').findOneAndUpdate(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        mappingStatus: 'not-applicable',
                        masterMenuCode: null,
                        masterMenuName: null,
                        masterMenuName_en: null,
                        approvedBy: markedBy,
                        approvedAt: now,
                        rejectionReason: reason,
                        notes,
                        updatedAt: now
                    }
                },
                { returnDocument: 'after' }
            );

            // Create mapping decision
            await db.collection('mappingDecisions').updateOne(
                {
                    entityType: 'menu',
                    normalizedName: mapping.normalizedName
                },
                {
                    $set: {
                        entityType: 'menu',
                        originalName: mapping.menuName,
                        normalizedName: mapping.normalizedName,
                        masterCode: null,
                        masterName: null,
                        masterName_en: null,
                        decisionType: 'not-applicable',
                        decisionBy: markedBy,
                        decisionAt: now,
                        reason,
                        updatedAt: now
                    },
                    $setOnInsert: {
                        timesApplied: 0,
                        storeIds: [],
                        createdAt: now
                    },
                    $addToSet: { storeIds: mapping.storeId }
                },
                { upsert: true }
            );

            await reviewController._updateMappingStats(db, 'menu');

            res.status(200).json({
                message: 'Menu mapping marked as not applicable',
                data: result
            });
        } catch (error) {
            console.error('Error marking menu as not applicable:', error);
            res.status(500).json({ error: 'Failed to mark as not applicable' });
        }
    },

    /**
     * Mark a category mapping as not applicable
     */
    markCategoryNotApplicable: async (req, res, db) => {
        try {
            const { id } = req.params;
            const { 
                markedBy = 'admin',
                reason = '',
                notes = ''
            } = req.body;

            const mapping = await db.collection('categoryMappings').findOne({
                _id: new ObjectId(id)
            });

            if (!mapping) {
                return res.status(404).json({ error: 'Category mapping not found' });
            }

            const now = new Date();

            const result = await db.collection('categoryMappings').findOneAndUpdate(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        mappingStatus: 'not-applicable',
                        masterCategoryCode: null,
                        masterCategoryName: null,
                        masterCategoryName_en: null,
                        approvedBy: markedBy,
                        approvedAt: now,
                        rejectionReason: reason,
                        notes,
                        updatedAt: now
                    }
                },
                { returnDocument: 'after' }
            );

            await db.collection('mappingDecisions').updateOne(
                {
                    entityType: 'category',
                    normalizedName: mapping.normalizedName
                },
                {
                    $set: {
                        entityType: 'category',
                        originalName: mapping.categoryName,
                        normalizedName: mapping.normalizedName,
                        masterCode: null,
                        masterName: null,
                        masterName_en: null,
                        decisionType: 'not-applicable',
                        decisionBy: markedBy,
                        decisionAt: now,
                        reason,
                        updatedAt: now
                    },
                    $setOnInsert: {
                        timesApplied: 0,
                        storeIds: [],
                        createdAt: now
                    },
                    $addToSet: { storeIds: mapping.storeId }
                },
                { upsert: true }
            );

            await reviewController._updateMappingStats(db, 'category');

            res.status(200).json({
                message: 'Category mapping marked as not applicable',
                data: result
            });
        } catch (error) {
            console.error('Error marking category as not applicable:', error);
            res.status(500).json({ error: 'Failed to mark as not applicable' });
        }
    },

    // ============ BULK OPERATIONS ============

    /**
     * Bulk approve menu mappings
     */
    bulkApproveMenuMappings: async (req, res, db) => {
        try {
            const { 
                ids,
                approvedBy = 'admin',
                notes = ''
            } = req.body;

            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({ error: 'ids array is required' });
            }

            const now = new Date();
            const results = {
                approved: 0,
                failed: 0,
                errors: []
            };

            for (const id of ids) {
                try {
                    const mapping = await db.collection('menuMappings').findOne({
                        _id: new ObjectId(id)
                    });

                    if (!mapping) {
                        results.failed++;
                        results.errors.push({ id, error: 'Not found' });
                        continue;
                    }

                    const codeToUse = mapping.suggestedMappings?.[0]?.masterMenuCode;
                    if (!codeToUse) {
                        results.failed++;
                        results.errors.push({ id, error: 'No suggestion available' });
                        continue;
                    }

                    const masterMenu = await db.collection('masterMenus').findOne({
                        code: codeToUse,
                        isDeleted: false
                    });

                    if (!masterMenu) {
                        results.failed++;
                        results.errors.push({ id, error: 'Master menu not found' });
                        continue;
                    }

                    await db.collection('menuMappings').updateOne(
                        { _id: new ObjectId(id) },
                        {
                            $set: {
                                masterMenuCode: codeToUse,
                                masterMenuName: masterMenu.name,
                                masterMenuName_en: masterMenu.name_en,
                                mappingStatus: 'approved',
                                approvedBy,
                                approvedAt: now,
                                notes,
                                updatedAt: now
                            }
                        }
                    );

                    // Create mapping decision
                    await db.collection('mappingDecisions').updateOne(
                        {
                            entityType: 'menu',
                            normalizedName: mapping.normalizedName
                        },
                        {
                            $set: {
                                entityType: 'menu',
                                originalName: mapping.menuName,
                                normalizedName: mapping.normalizedName,
                                masterCode: codeToUse,
                                masterName: masterMenu.name,
                                masterName_en: masterMenu.name_en,
                                decisionType: 'approved',
                                decisionBy: approvedBy,
                                decisionAt: now,
                                updatedAt: now
                            },
                            $setOnInsert: {
                                timesApplied: 0,
                                storeIds: [],
                                createdAt: now
                            },
                            $addToSet: { storeIds: mapping.storeId }
                        },
                        { upsert: true }
                    );

                    results.approved++;
                } catch (err) {
                    results.failed++;
                    results.errors.push({ id, error: err.message });
                }
            }

            await reviewController._updateMappingStats(db, 'menu');

            res.status(200).json({
                message: `Bulk approval completed: ${results.approved} approved, ${results.failed} failed`,
                results
            });
        } catch (error) {
            console.error('Error bulk approving menu mappings:', error);
            res.status(500).json({ error: 'Failed to bulk approve mappings' });
        }
    },

    /**
     * Bulk approve category mappings
     */
    bulkApproveCategoryMappings: async (req, res, db) => {
        try {
            const { 
                ids,
                approvedBy = 'admin',
                notes = ''
            } = req.body;

            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({ error: 'ids array is required' });
            }

            const now = new Date();
            const results = {
                approved: 0,
                failed: 0,
                errors: []
            };

            for (const id of ids) {
                try {
                    const mapping = await db.collection('categoryMappings').findOne({
                        _id: new ObjectId(id)
                    });

                    if (!mapping) {
                        results.failed++;
                        results.errors.push({ id, error: 'Not found' });
                        continue;
                    }

                    const codeToUse = mapping.suggestedMappings?.[0]?.masterCategoryCode;
                    if (!codeToUse) {
                        results.failed++;
                        results.errors.push({ id, error: 'No suggestion available' });
                        continue;
                    }

                    const masterCategory = await db.collection('masterCategories').findOne({
                        code: codeToUse,
                        isDeleted: false
                    });

                    if (!masterCategory) {
                        results.failed++;
                        results.errors.push({ id, error: 'Master category not found' });
                        continue;
                    }

                    await db.collection('categoryMappings').updateOne(
                        { _id: new ObjectId(id) },
                        {
                            $set: {
                                masterCategoryCode: codeToUse,
                                masterCategoryName: masterCategory.name,
                                masterCategoryName_en: masterCategory.name_en,
                                mappingStatus: 'approved',
                                approvedBy,
                                approvedAt: now,
                                notes,
                                updatedAt: now
                            }
                        }
                    );

                    await db.collection('mappingDecisions').updateOne(
                        {
                            entityType: 'category',
                            normalizedName: mapping.normalizedName
                        },
                        {
                            $set: {
                                entityType: 'category',
                                originalName: mapping.categoryName,
                                normalizedName: mapping.normalizedName,
                                masterCode: codeToUse,
                                masterName: masterCategory.name,
                                masterName_en: masterCategory.name_en,
                                decisionType: 'approved',
                                decisionBy: approvedBy,
                                decisionAt: now,
                                updatedAt: now
                            },
                            $setOnInsert: {
                                timesApplied: 0,
                                storeIds: [],
                                createdAt: now
                            },
                            $addToSet: { storeIds: mapping.storeId }
                        },
                        { upsert: true }
                    );

                    results.approved++;
                } catch (err) {
                    results.failed++;
                    results.errors.push({ id, error: err.message });
                }
            }

            await reviewController._updateMappingStats(db, 'category');

            res.status(200).json({
                message: `Bulk approval completed: ${results.approved} approved, ${results.failed} failed`,
                results
            });
        } catch (error) {
            console.error('Error bulk approving category mappings:', error);
            res.status(500).json({ error: 'Failed to bulk approve mappings' });
        }
    },

    /**
     * Bulk reject menu mappings
     */
    bulkRejectMenuMappings: async (req, res, db) => {
        try {
            const { 
                ids,
                rejectedBy = 'admin',
                rejectionReason = '',
                notes = ''
            } = req.body;

            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({ error: 'ids array is required' });
            }

            const now = new Date();
            const objectIds = ids.map(id => new ObjectId(id));

            const result = await db.collection('menuMappings').updateMany(
                { _id: { $in: objectIds } },
                {
                    $set: {
                        mappingStatus: 'rejected',
                        rejectedBy,
                        rejectedAt: now,
                        rejectionReason,
                        notes,
                        updatedAt: now
                    }
                }
            );

            await reviewController._updateMappingStats(db, 'menu');

            res.status(200).json({
                message: `${result.modifiedCount} menu mappings rejected`,
                modifiedCount: result.modifiedCount
            });
        } catch (error) {
            console.error('Error bulk rejecting menu mappings:', error);
            res.status(500).json({ error: 'Failed to bulk reject mappings' });
        }
    },

    /**
     * Bulk reject category mappings
     */
    bulkRejectCategoryMappings: async (req, res, db) => {
        try {
            const { 
                ids,
                rejectedBy = 'admin',
                rejectionReason = '',
                notes = ''
            } = req.body;

            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({ error: 'ids array is required' });
            }

            const now = new Date();
            const objectIds = ids.map(id => new ObjectId(id));

            const result = await db.collection('categoryMappings').updateMany(
                { _id: { $in: objectIds } },
                {
                    $set: {
                        mappingStatus: 'rejected',
                        rejectedBy,
                        rejectedAt: now,
                        rejectionReason,
                        notes,
                        updatedAt: now
                    }
                }
            );

            await reviewController._updateMappingStats(db, 'category');

            res.status(200).json({
                message: `${result.modifiedCount} category mappings rejected`,
                modifiedCount: result.modifiedCount
            });
        } catch (error) {
            console.error('Error bulk rejecting category mappings:', error);
            res.status(500).json({ error: 'Failed to bulk reject mappings' });
        }
    },

    // ============ STATISTICS ============

    /**
     * Get review statistics
     */
    getReviewStats: async (req, res, db) => {
        try {
            const { storeId } = req.query;

            const storeQuery = storeId ? { storeId: new ObjectId(storeId) } : {};

            // Menu statistics
            const [
                menuTotal,
                menuPending,
                menuSuggested,
                menuApproved,
                menuRejected,
                menuNotApplicable,
                menuHighConfidence,
                menuMediumConfidence,
                menuLowConfidence,
                menuNoMatch
            ] = await Promise.all([
                db.collection('menuMappings').countDocuments(storeQuery),
                db.collection('menuMappings').countDocuments({ ...storeQuery, mappingStatus: 'pending' }),
                db.collection('menuMappings').countDocuments({ ...storeQuery, mappingStatus: 'suggested' }),
                db.collection('menuMappings').countDocuments({ ...storeQuery, mappingStatus: 'approved' }),
                db.collection('menuMappings').countDocuments({ ...storeQuery, mappingStatus: 'rejected' }),
                db.collection('menuMappings').countDocuments({ ...storeQuery, mappingStatus: 'not-applicable' }),
                db.collection('menuMappings').countDocuments({ ...storeQuery, mappingStatus: 'suggested', confidenceScore: { $gte: 95 } }),
                db.collection('menuMappings').countDocuments({ ...storeQuery, mappingStatus: 'suggested', confidenceScore: { $gte: 60, $lt: 95 } }),
                db.collection('menuMappings').countDocuments({ ...storeQuery, mappingStatus: 'suggested', confidenceScore: { $gte: 1, $lt: 60 } }),
                db.collection('menuMappings').countDocuments({ ...storeQuery, mappingStatus: 'suggested', confidenceScore: { $lt: 1 } })
            ]);

            // Category statistics
            const [
                categoryTotal,
                categoryPending,
                categorySuggested,
                categoryApproved,
                categoryRejected,
                categoryNotApplicable,
                categoryHighConfidence,
                categoryMediumConfidence,
                categoryLowConfidence,
                categoryNoMatch
            ] = await Promise.all([
                db.collection('categoryMappings').countDocuments(storeQuery),
                db.collection('categoryMappings').countDocuments({ ...storeQuery, mappingStatus: 'pending' }),
                db.collection('categoryMappings').countDocuments({ ...storeQuery, mappingStatus: 'suggested' }),
                db.collection('categoryMappings').countDocuments({ ...storeQuery, mappingStatus: 'approved' }),
                db.collection('categoryMappings').countDocuments({ ...storeQuery, mappingStatus: 'rejected' }),
                db.collection('categoryMappings').countDocuments({ ...storeQuery, mappingStatus: 'not-applicable' }),
                db.collection('categoryMappings').countDocuments({ ...storeQuery, mappingStatus: 'suggested', confidenceScore: { $gte: 95 } }),
                db.collection('categoryMappings').countDocuments({ ...storeQuery, mappingStatus: 'suggested', confidenceScore: { $gte: 60, $lt: 95 } }),
                db.collection('categoryMappings').countDocuments({ ...storeQuery, mappingStatus: 'suggested', confidenceScore: { $gte: 1, $lt: 60 } }),
                db.collection('categoryMappings').countDocuments({ ...storeQuery, mappingStatus: 'suggested', confidenceScore: { $lt: 1 } })
            ]);

            res.status(200).json({
                menus: {
                    total: menuTotal,
                    byStatus: {
                        pending: menuPending,
                        suggested: menuSuggested,
                        approved: menuApproved,
                        rejected: menuRejected,
                        notApplicable: menuNotApplicable
                    },
                    pendingReview: {
                        total: menuSuggested,
                        highConfidence: menuHighConfidence,
                        mediumConfidence: menuMediumConfidence,
                        lowConfidence: menuLowConfidence,
                        noMatch: menuNoMatch
                    },
                    progress: {
                        reviewed: menuApproved + menuRejected + menuNotApplicable,
                        reviewedPercent: menuTotal > 0 
                            ? Math.round(((menuApproved + menuRejected + menuNotApplicable) / menuTotal) * 100) 
                            : 0
                    }
                },
                categories: {
                    total: categoryTotal,
                    byStatus: {
                        pending: categoryPending,
                        suggested: categorySuggested,
                        approved: categoryApproved,
                        rejected: categoryRejected,
                        notApplicable: categoryNotApplicable
                    },
                    pendingReview: {
                        total: categorySuggested,
                        highConfidence: categoryHighConfidence,
                        mediumConfidence: categoryMediumConfidence,
                        lowConfidence: categoryLowConfidence,
                        noMatch: categoryNoMatch
                    },
                    progress: {
                        reviewed: categoryApproved + categoryRejected + categoryNotApplicable,
                        reviewedPercent: categoryTotal > 0 
                            ? Math.round(((categoryApproved + categoryRejected + categoryNotApplicable) / categoryTotal) * 100) 
                            : 0
                    }
                }
            });
        } catch (error) {
            console.error('Error fetching review stats:', error);
            res.status(500).json({ error: 'Failed to fetch review stats' });
        }
    },

    // ============ INTERNAL HELPERS ============

    /**
     * Update mapping statistics collection
     * @private
     */
    _updateMappingStats: async (db, entityType) => {
        try {
            const collection = entityType === 'menu' ? 'menuMappings' : 'categoryMappings';

            const [
                totalItems,
                pendingItems,
                suggestedItems,
                mappedItems,
                rejectedItems,
                notApplicableItems,
                highConfidence,
                mediumConfidence,
                lowConfidence
            ] = await Promise.all([
                db.collection(collection).countDocuments({}),
                db.collection(collection).countDocuments({ mappingStatus: 'pending' }),
                db.collection(collection).countDocuments({ mappingStatus: 'suggested' }),
                db.collection(collection).countDocuments({ mappingStatus: 'approved' }),
                db.collection(collection).countDocuments({ mappingStatus: 'rejected' }),
                db.collection(collection).countDocuments({ mappingStatus: 'not-applicable' }),
                db.collection(collection).countDocuments({ mappingStatus: 'suggested', confidenceScore: { $gte: 95 } }),
                db.collection(collection).countDocuments({ mappingStatus: 'suggested', confidenceScore: { $gte: 60, $lt: 95 } }),
                db.collection(collection).countDocuments({ mappingStatus: 'suggested', confidenceScore: { $lt: 60 } })
            ]);

            await db.collection('mappingStats').updateOne(
                { entityType },
                {
                    $set: {
                        entityType,
                        totalItems,
                        pendingItems,
                        suggestedItems,
                        mappedItems,
                        rejectedItems,
                        notApplicableItems,
                        highConfidence,
                        mediumConfidence,
                        lowConfidence,
                        lastUpdated: new Date()
                    }
                },
                { upsert: true }
            );
        } catch (error) {
            console.error(`Error updating mapping stats for ${entityType}:`, error);
        }
    }
};

module.exports = reviewController;
