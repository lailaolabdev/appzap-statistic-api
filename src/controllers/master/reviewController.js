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
                        createdAt: now
                    },
                    $addToSet: { storeIds: mapping.storeId }
                },
                { upsert: true }
            );

            // Update stats
            await reviewController._updateMappingStats(db, 'menu');

            // LEARN: Add the original menu name as a keyword to the master menu
            // This improves future auto-matching
            if (mapping.menuName && mapping.menuName.trim().length >= 2) {
                const normalizedKeyword = mapping.menuName.trim();
                
                // Check if keyword already exists
                const existingKeywords = [
                    ...(masterMenu.keywords || []),
                    ...(masterMenu.learnedKeywords || [])
                ].map(k => k.toLowerCase());

                if (!existingKeywords.includes(normalizedKeyword.toLowerCase()) &&
                    normalizedKeyword.toLowerCase() !== masterMenu.name?.toLowerCase() &&
                    normalizedKeyword.toLowerCase() !== masterMenu.name_en?.toLowerCase()) {
                    
                    await db.collection('masterMenus').updateOne(
                        { code: codeToUse },
                        {
                            $addToSet: { learnedKeywords: normalizedKeyword },
                            $set: { updatedAt: now }
                        }
                    );
                    console.log(`[Learn] Added keyword "${normalizedKeyword}" to master menu ${codeToUse}`);
                }
            }

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
            // Note: $addToSet creates the array if it doesn't exist, so we don't need $setOnInsert for storeIds
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
                        createdAt: now
                    },
                    $addToSet: { storeIds: mapping.storeId }
                },
                { upsert: true }
            );

            await reviewController._updateMappingStats(db, 'menu');

            // LEARN: Add the original menu name as a keyword to the master menu
            // This is especially important for manual mappings as they often contain
            // unique variations that the system couldn't auto-match
            if (mapping.menuName && mapping.menuName.trim().length >= 2) {
                const normalizedKeyword = mapping.menuName.trim();
                
                // Check if keyword already exists
                const existingKeywords = [
                    ...(masterMenu.keywords || []),
                    ...(masterMenu.learnedKeywords || [])
                ].map(k => k.toLowerCase());

                if (!existingKeywords.includes(normalizedKeyword.toLowerCase()) &&
                    normalizedKeyword.toLowerCase() !== masterMenu.name?.toLowerCase() &&
                    normalizedKeyword.toLowerCase() !== masterMenu.name_en?.toLowerCase()) {
                    
                    await db.collection('masterMenus').updateOne(
                        { code: masterMenuCode },
                        {
                            $addToSet: { learnedKeywords: normalizedKeyword },
                            $set: { updatedAt: now }
                        }
                    );
                    console.log(`[Learn] Added keyword "${normalizedKeyword}" to master menu ${masterMenuCode}`);
                }
            }

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

            // Note: $addToSet creates the array if it doesn't exist, so we don't need $setOnInsert for storeIds
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
     * Helper: Validate ObjectId string
     */
    _isValidObjectId: (id) => {
        if (!id) return false;
        const str = typeof id === 'string' ? id : String(id);
        return /^[a-fA-F0-9]{24}$/.test(str);
    },

    /**
     * Bulk approve menu mappings (by IDs)
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

            // Validate and convert IDs
            const validIds = ids
                .filter(id => reviewController._isValidObjectId(id))
                .map(id => new ObjectId(id));

            if (validIds.length === 0) {
                return res.status(400).json({ error: 'No valid IDs provided' });
            }

            const now = new Date();

            // Get all mappings in one query (batch fetch)
            const mappings = await db.collection('menuMappings')
                .find({ 
                    _id: { $in: validIds },
                    mappingStatus: 'suggested'
                })
                .toArray();

            if (mappings.length === 0) {
                return res.status(200).json({
                    message: 'No mappings to approve',
                    results: { approved: 0, failed: 0, skipped: ids.length }
                });
            }

            // Get all master menu codes needed
            const masterCodes = [...new Set(
                mappings
                    .filter(m => m.suggestedMappings?.[0]?.masterMenuCode)
                    .map(m => m.suggestedMappings[0].masterMenuCode)
            )];

            // Fetch all master menus in one query
            const masterMenus = await db.collection('masterMenus')
                .find({ code: { $in: masterCodes }, isDeleted: false })
                .toArray();
            
            const masterMenuMap = new Map(masterMenus.map(m => [m.code, m]));

            // Build bulk operations
            const bulkOps = [];
            const decisionOps = [];
            let approved = 0;
            let failed = 0;

            for (const mapping of mappings) {
                    const codeToUse = mapping.suggestedMappings?.[0]?.masterMenuCode;
                const masterMenu = codeToUse ? masterMenuMap.get(codeToUse) : null;

                if (!masterMenu) {
                    failed++;
                        continue;
                    }

                bulkOps.push({
                    updateOne: {
                        filter: { _id: mapping._id },
                        update: {
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
                    }
                });

                decisionOps.push({
                    updateOne: {
                        filter: { entityType: 'menu', normalizedName: mapping.normalizedName },
                        update: {
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
                            $setOnInsert: { timesApplied: 0, createdAt: now },
                            $addToSet: { storeIds: mapping.storeId }
                        },
                        upsert: true
                    }
                });

                approved++;
            }

            // Execute bulk operations
            if (bulkOps.length > 0) {
                await db.collection('menuMappings').bulkWrite(bulkOps, { ordered: false });
            }
            if (decisionOps.length > 0) {
                await db.collection('mappingDecisions').bulkWrite(decisionOps, { ordered: false });
            }

            res.status(200).json({
                message: `Bulk approval completed: ${approved} approved, ${failed} failed`,
                results: { approved, failed, total: mappings.length }
            });
        } catch (error) {
            console.error('Error bulk approving menu mappings:', error);
            res.status(500).json({ error: 'Failed to bulk approve mappings' });
        }
    },

    /**
     * HIGH-PERFORMANCE: Bulk approve ALL menu mappings by confidence level
     * This is the "Quick Win" feature - approve all high-confidence items at once
     */
    bulkApproveMenusByConfidence: async (req, res, db) => {
        console.log('\n========== QUICK WIN: MENUS ==========');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        try {
            const { 
                confidenceLevel = 'high',
                minConfidence,
                storeId,
                approvedBy = 'admin',
                notes = '',
                limit = 10000  // Safety limit
            } = req.body;

            console.log('Parameters:', { confidenceLevel, minConfidence, storeId, approvedBy, limit });

            const now = new Date();

            // Build query for items to approve
            const query = { 
                mappingStatus: 'suggested',
                'suggestedMappings.0': { $exists: true }  // Must have at least one suggestion
            };

            // Add confidence filter
            if (minConfidence !== undefined) {
                query.confidenceScore = { $gte: parseFloat(minConfidence) };
            } else {
                const levelRanges = {
                    'high': { $gte: 95 },
                    'medium': { $gte: 60, $lt: 95 },
                    'low': { $gte: 1, $lt: 60 }
                };
                if (levelRanges[confidenceLevel]) {
                    query.confidenceScore = levelRanges[confidenceLevel];
                }
            }

            if (storeId && reviewController._isValidObjectId(storeId)) {
                query.storeId = new ObjectId(storeId);
            }

            console.log('Query:', JSON.stringify(query, null, 2));

            // Count total items first
            const totalCount = await db.collection('menuMappings').countDocuments(query);
            console.log('Total items matching query:', totalCount);

            if (totalCount === 0) {
                console.log('No items to approve - returning early');
                return res.status(200).json({
                    message: 'No items to approve matching criteria',
                    results: { approved: 0, total: 0 }
                });
            }

            // Process in batches for memory efficiency
            const BATCH_SIZE = 500;
            let processed = 0;
            let approved = 0;
            let failed = 0;

            // Get all unique master codes needed first
            console.log('Fetching mappings...');
            const allMappings = await db.collection('menuMappings')
                .find(query)
                .limit(limit)
                .project({ 
                    _id: 1, 
                    menuName: 1,
                    normalizedName: 1, 
                    storeId: 1,
                    suggestedMappings: 1
                })
                .toArray();

            console.log('Fetched mappings:', allMappings.length);
            
            // Debug: Log first few mappings to understand the data structure
            if (allMappings.length > 0) {
                console.log('Sample mapping structure (first 3):');
                allMappings.slice(0, 3).forEach((m, idx) => {
                    console.log(`  [${idx}] menuName: ${m.menuName}`);
                    console.log(`       suggestedMappings:`, JSON.stringify(m.suggestedMappings, null, 2));
                });
            }

            const masterCodes = [...new Set(
                allMappings
                    .filter(m => m.suggestedMappings?.[0]?.masterMenuCode)
                    .map(m => m.suggestedMappings[0].masterMenuCode)
            )];

            console.log('Unique master codes needed:', masterCodes.length);
            
            // If no master codes found, check alternative field names
            if (masterCodes.length === 0 && allMappings.length > 0) {
                const sample = allMappings[0].suggestedMappings?.[0];
                console.log('No masterMenuCode found. Available fields in suggestedMappings[0]:', 
                    sample ? Object.keys(sample) : 'suggestedMappings is empty/undefined');
            }

            // Fetch all master menus in one query
            const masterMenus = await db.collection('masterMenus')
                .find({ code: { $in: masterCodes }, isDeleted: false })
                .toArray();
            
            console.log('Master menus found:', masterMenus.length);
            
            const masterMenuMap = new Map(masterMenus.map(m => [m.code, m]));

            // Process in batches
            for (let i = 0; i < allMappings.length; i += BATCH_SIZE) {
                const batch = allMappings.slice(i, i + BATCH_SIZE);
                const bulkOps = [];
                const decisionOps = [];

                for (const mapping of batch) {
                    const codeToUse = mapping.suggestedMappings?.[0]?.masterMenuCode;
                    const masterMenu = codeToUse ? masterMenuMap.get(codeToUse) : null;

                    if (!masterMenu) {
                        failed++;
                        continue;
                    }

                    bulkOps.push({
                        updateOne: {
                            filter: { _id: mapping._id },
                            update: {
                            $set: {
                                masterMenuCode: codeToUse,
                                masterMenuName: masterMenu.name,
                                masterMenuName_en: masterMenu.name_en,
                                mappingStatus: 'approved',
                                approvedBy,
                                approvedAt: now,
                                    notes: notes || `Bulk approved (${confidenceLevel} confidence)`,
                                updatedAt: now
                            }
                        }
                        }
                    });

                    decisionOps.push({
                        updateOne: {
                            filter: { entityType: 'menu', normalizedName: mapping.normalizedName },
                            update: {
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
                                $setOnInsert: { timesApplied: 0, createdAt: now },
                            $addToSet: { storeIds: mapping.storeId }
                        },
                            upsert: true
                        }
                    });

                    approved++;
                }

                // Execute batch operations
                console.log(`Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${bulkOps.length} operations`);
                
                if (bulkOps.length > 0) {
                    const result = await db.collection('menuMappings').bulkWrite(bulkOps, { ordered: false });
                    console.log(`  - menuMappings updated: ${result.modifiedCount}`);
                }
                if (decisionOps.length > 0) {
                    const result = await db.collection('mappingDecisions').bulkWrite(decisionOps, { ordered: false });
                    console.log(`  - mappingDecisions upserted: ${result.upsertedCount + result.modifiedCount}`);
                }

                processed += batch.length;
            }

            console.log('========== QUICK WIN COMPLETE ==========');
            console.log(`Results: approved=${approved}, failed=${failed}, processed=${processed}`);

            res.status(200).json({
                message: `Quick Win completed: ${approved} items approved`,
                results: { 
                    approved, 
                    failed, 
                    totalMatched: totalCount,
                    processed
                }
            });
        } catch (error) {
            console.error('========== QUICK WIN ERROR ==========');
            console.error('Error bulk approving menus by confidence:', error);
            res.status(500).json({ error: 'Failed to bulk approve by confidence' });
        }
    },

    /**
     * Bulk approve category mappings (by IDs) - HIGH PERFORMANCE
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

            // Validate and convert IDs
            const validIds = ids
                .filter(id => reviewController._isValidObjectId(id))
                .map(id => new ObjectId(id));

            if (validIds.length === 0) {
                return res.status(400).json({ error: 'No valid IDs provided' });
            }

            const now = new Date();

            // Get all mappings in one query
            const mappings = await db.collection('categoryMappings')
                .find({ 
                    _id: { $in: validIds },
                    mappingStatus: 'suggested'
                })
                .toArray();

            if (mappings.length === 0) {
                return res.status(200).json({
                    message: 'No mappings to approve',
                    results: { approved: 0, failed: 0, skipped: ids.length }
                });
            }

            // Get all master category codes needed
            const masterCodes = [...new Set(
                mappings
                    .filter(m => m.suggestedMappings?.[0]?.masterCategoryCode)
                    .map(m => m.suggestedMappings[0].masterCategoryCode)
            )];

            // Fetch all master categories in one query
            const masterCategories = await db.collection('masterCategories')
                .find({ code: { $in: masterCodes }, isDeleted: false })
                .toArray();
            
            const masterCategoryMap = new Map(masterCategories.map(m => [m.code, m]));

            // Build bulk operations
            const bulkOps = [];
            const decisionOps = [];
            let approved = 0;
            let failed = 0;

            for (const mapping of mappings) {
                    const codeToUse = mapping.suggestedMappings?.[0]?.masterCategoryCode;
                const masterCategory = codeToUse ? masterCategoryMap.get(codeToUse) : null;

                if (!masterCategory) {
                    failed++;
                        continue;
                    }

                bulkOps.push({
                    updateOne: {
                        filter: { _id: mapping._id },
                        update: {
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
                    }
                });

                decisionOps.push({
                    updateOne: {
                        filter: { entityType: 'category', normalizedName: mapping.normalizedName },
                        update: {
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
                            $setOnInsert: { timesApplied: 0, createdAt: now },
                            $addToSet: { storeIds: mapping.storeId }
                        },
                        upsert: true
                    }
                });

                approved++;
            }

            // Execute bulk operations
            if (bulkOps.length > 0) {
                await db.collection('categoryMappings').bulkWrite(bulkOps, { ordered: false });
            }
            if (decisionOps.length > 0) {
                await db.collection('mappingDecisions').bulkWrite(decisionOps, { ordered: false });
            }

            res.status(200).json({
                message: `Bulk approval completed: ${approved} approved, ${failed} failed`,
                results: { approved, failed, total: mappings.length }
            });
        } catch (error) {
            console.error('Error bulk approving category mappings:', error);
            res.status(500).json({ error: 'Failed to bulk approve mappings' });
        }
    },

    /**
     * HIGH-PERFORMANCE: Bulk approve ALL category mappings by confidence level
     */
    bulkApproveCategoriesByConfidence: async (req, res, db) => {
        console.log('\n========== QUICK WIN: CATEGORIES ==========');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        try {
            const { 
                confidenceLevel = 'high',
                minConfidence,
                storeId,
                approvedBy = 'admin',
                notes = '',
                limit = 10000
            } = req.body;

            console.log('Parameters:', { confidenceLevel, minConfidence, storeId, approvedBy, limit });

            const now = new Date();

            // Build query
            const query = { 
                mappingStatus: 'suggested',
                'suggestedMappings.0': { $exists: true }
            };

            if (minConfidence !== undefined) {
                query.confidenceScore = { $gte: parseFloat(minConfidence) };
            } else {
                const levelRanges = {
                    'high': { $gte: 95 },
                    'medium': { $gte: 60, $lt: 95 },
                    'low': { $gte: 1, $lt: 60 }
                };
                if (levelRanges[confidenceLevel]) {
                    query.confidenceScore = levelRanges[confidenceLevel];
                }
            }

            if (storeId && reviewController._isValidObjectId(storeId)) {
                query.storeId = new ObjectId(storeId);
            }

            console.log('Query:', JSON.stringify(query, null, 2));

            const totalCount = await db.collection('categoryMappings').countDocuments(query);
            console.log('Total items matching query:', totalCount);

            if (totalCount === 0) {
                console.log('No items to approve - returning early');
                return res.status(200).json({
                    message: 'No items to approve matching criteria',
                    results: { approved: 0, total: 0 }
                });
            }

            const BATCH_SIZE = 500;
            let approved = 0;
            let failed = 0;
            let processed = 0;

            console.log('Fetching mappings...');
            const allMappings = await db.collection('categoryMappings')
                .find(query)
                .limit(limit)
                .project({ 
                    _id: 1, 
                    categoryName: 1,
                    normalizedName: 1, 
                    storeId: 1,
                    suggestedMappings: 1
                })
                .toArray();

            console.log('Fetched mappings:', allMappings.length);
            
            // Debug: Log first few mappings to understand the data structure
            if (allMappings.length > 0) {
                console.log('Sample mapping structure (first 3):');
                allMappings.slice(0, 3).forEach((m, idx) => {
                    console.log(`  [${idx}] categoryName: ${m.categoryName}`);
                    console.log(`       suggestedMappings:`, JSON.stringify(m.suggestedMappings, null, 2));
                });
            }

            const masterCodes = [...new Set(
                allMappings
                    .filter(m => m.suggestedMappings?.[0]?.masterCategoryCode)
                    .map(m => m.suggestedMappings[0].masterCategoryCode)
            )];

            console.log('Unique master codes needed:', masterCodes.length);
            
            // If no master codes found, check alternative field names
            if (masterCodes.length === 0 && allMappings.length > 0) {
                const sample = allMappings[0].suggestedMappings?.[0];
                console.log('No masterCategoryCode found. Available fields in suggestedMappings[0]:', 
                    sample ? Object.keys(sample) : 'suggestedMappings is empty/undefined');
            }

            const masterCategories = await db.collection('masterCategories')
                .find({ code: { $in: masterCodes }, isDeleted: false })
                .toArray();
            
            console.log('Master categories found:', masterCategories.length);
            
            const masterCategoryMap = new Map(masterCategories.map(m => [m.code, m]));

            for (let i = 0; i < allMappings.length; i += BATCH_SIZE) {
                const batch = allMappings.slice(i, i + BATCH_SIZE);
                const bulkOps = [];
                const decisionOps = [];

                for (const mapping of batch) {
                    const codeToUse = mapping.suggestedMappings?.[0]?.masterCategoryCode;
                    const masterCategory = codeToUse ? masterCategoryMap.get(codeToUse) : null;

                    if (!masterCategory) {
                        failed++;
                        continue;
                    }

                    bulkOps.push({
                        updateOne: {
                            filter: { _id: mapping._id },
                            update: {
                            $set: {
                                masterCategoryCode: codeToUse,
                                masterCategoryName: masterCategory.name,
                                masterCategoryName_en: masterCategory.name_en,
                                mappingStatus: 'approved',
                                approvedBy,
                                approvedAt: now,
                                    notes: notes || `Bulk approved (${confidenceLevel} confidence)`,
                                updatedAt: now
                            }
                        }
                        }
                    });

                    decisionOps.push({
                        updateOne: {
                            filter: { entityType: 'category', normalizedName: mapping.normalizedName },
                            update: {
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
                                $setOnInsert: { timesApplied: 0, createdAt: now },
                            $addToSet: { storeIds: mapping.storeId }
                        },
                            upsert: true
                        }
                    });

                    approved++;
                }

                console.log(`Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${bulkOps.length} operations`);
                
                if (bulkOps.length > 0) {
                    const result = await db.collection('categoryMappings').bulkWrite(bulkOps, { ordered: false });
                    console.log(`  - categoryMappings updated: ${result.modifiedCount}`);
                }
                if (decisionOps.length > 0) {
                    const result = await db.collection('mappingDecisions').bulkWrite(decisionOps, { ordered: false });
                    console.log(`  - mappingDecisions upserted: ${result.upsertedCount + result.modifiedCount}`);
                }
                
                processed += batch.length;
            }

            console.log('========== QUICK WIN COMPLETE (CATEGORIES) ==========');
            console.log(`Results: approved=${approved}, failed=${failed}, processed=${processed}`);

            res.status(200).json({
                message: `Quick Win completed: ${approved} items approved`,
                results: { approved, failed, totalMatched: totalCount, processed }
            });
        } catch (error) {
            console.error('========== QUICK WIN ERROR (CATEGORIES) ==========');
            console.error('Error bulk approving categories by confidence:', error);
            res.status(500).json({ error: 'Failed to bulk approve by confidence' });
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
