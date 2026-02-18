/**
 * Income Controller
 * 
 * CRUD operations for manual income entries.
 */

const { ObjectId } = require('mongodb');

// Income categories
const INCOME_CATEGORIES = [
    { code: 'subscription', name: 'ຄ່າສະໝັກໃຊ້ບໍລິການ', nameEnglish: 'Subscription Revenue', icon: '💳', color: '#10B981' },
    { code: 'device_sale', name: 'ຂາຍອຸປະກອນ', nameEnglish: 'Device Sales', icon: '📱', color: '#3B82F6' },
    { code: 'service', name: 'ຄ່າບໍລິການ', nameEnglish: 'Service Fees', icon: '🔧', color: '#8B5CF6' },
    { code: 'training', name: 'ຄ່າຝຶກອົບຮົມ', nameEnglish: 'Training Fees', icon: '📚', color: '#F59E0B' },
    { code: 'setup', name: 'ຄ່າຕິດຕັ້ງ', nameEnglish: 'Setup/Installation', icon: '⚙️', color: '#EC4899' },
    { code: 'partnership', name: 'ລາຍໄດ້ຈາກຫຸ້ນສ່ວນ', nameEnglish: 'Partnership Revenue', icon: '🤝', color: '#06B6D4' },
    { code: 'commission', name: 'ຄ່ານາຍໜ້າ', nameEnglish: 'Commission', icon: '💰', color: '#84CC16' },
    { code: 'interest', name: 'ດອກເບ້ຍ', nameEnglish: 'Interest Income', icon: '🏦', color: '#6366F1' },
    { code: 'refund', name: 'ເງິນຄືນ', nameEnglish: 'Refund Received', icon: '↩️', color: '#14B8A6' },
    { code: 'other', name: 'ອື່ນໆ', nameEnglish: 'Other Income', icon: '📋', color: '#94A3B8' },
];

const incomeController = {
    /**
     * Get income categories
     */
    getCategories: async (req, res, db) => {
        res.json({ success: true, data: INCOME_CATEGORIES });
    },

    /**
     * Get all incomes with filtering and pagination
     */
    getIncomes: async (req, res, db) => {
        try {
            const {
                page = 1,
                limit = 20,
                search,
                category,
                paymentStatus,
                startDate,
                endDate,
                sortBy = 'incomeDate',
                sortOrder = 'desc'
            } = req.query;

            const query = {};

            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } },
                    { 'source.name': { $regex: search, $options: 'i' } },
                ];
            }

            if (category && category !== 'all') {
                query.category = category;
            }

            if (paymentStatus && paymentStatus !== 'all') {
                query.paymentStatus = paymentStatus;
            }

            if (startDate || endDate) {
                query.incomeDate = {};
                if (startDate) query.incomeDate.$gte = new Date(startDate);
                if (endDate) query.incomeDate.$lte = new Date(endDate);
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);
            const sortDir = sortOrder === 'asc' ? 1 : -1;

            const [incomes, total] = await Promise.all([
                db.collection('incomes')
                    .find(query)
                    .sort({ [sortBy]: sortDir })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .toArray(),
                db.collection('incomes').countDocuments(query)
            ]);

            // Get summary stats
            const stats = await db.collection('incomes')
                .aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: null,
                            totalAmount: { $sum: '$amount' },
                            receivedAmount: {
                                $sum: {
                                    $cond: [{ $eq: ['$paymentStatus', 'received'] }, '$amount', 0]
                                }
                            },
                            pendingAmount: {
                                $sum: {
                                    $cond: [{ $eq: ['$paymentStatus', 'pending'] }, '$amount', 0]
                                }
                            }
                        }
                    }
                ])
                .toArray();

            res.json({
                success: true,
                data: {
                    incomes,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / parseInt(limit))
                    },
                    stats: stats[0] || { totalAmount: 0, receivedAmount: 0, pendingAmount: 0 }
                }
            });
        } catch (error) {
            console.error('[Income] Error getting incomes:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get single income by ID
     */
    getIncomeById: async (req, res, db) => {
        try {
            const { id } = req.params;
            
            const income = await db.collection('incomes').findOne({
                _id: new ObjectId(id)
            });

            if (!income) {
                return res.status(404).json({
                    success: false,
                    error: 'Income not found'
                });
            }

            res.json({ success: true, data: income });
        } catch (error) {
            console.error('[Income] Error getting income:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Create new income entry
     */
    createIncome: async (req, res, db) => {
        try {
            const {
                title,
                description,
                category,
                subcategory,
                amount,
                incomeDate,
                receivedDate,
                paymentStatus = 'received',
                paymentMethod,
                paymentReference,
                source,
                invoiceId,
                invoiceNumber,
                isRecurring = false,
                recurrence,
                tags,
            } = req.body;

            if (!title || !amount || !category) {
                return res.status(400).json({
                    success: false,
                    error: 'Title, amount, and category are required'
                });
            }

            const income = {
                title,
                description,
                category,
                subcategory,
                amount: parseFloat(amount),
                currency: 'LAK',
                incomeDate: incomeDate ? new Date(incomeDate) : new Date(),
                receivedDate: receivedDate ? new Date(receivedDate) : (paymentStatus === 'received' ? new Date() : null),
                paymentStatus,
                paymentMethod,
                paymentReference,
                source: source || {},
                invoiceId,
                invoiceNumber,
                isRecurring,
                recurrence: isRecurring ? recurrence : null,
                tags: tags || [],
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const result = await db.collection('incomes').insertOne(income);
            income._id = result.insertedId;

            // If received, create a financial transaction record
            if (paymentStatus === 'received') {
                await createIncomeTransaction(db, income);
            }

            res.status(201).json({
                success: true,
                data: income,
                message: 'Income recorded successfully'
            });
        } catch (error) {
            console.error('[Income] Error creating income:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Update income
     */
    updateIncome: async (req, res, db) => {
        try {
            const { id } = req.params;
            const updateData = { ...req.body, updatedAt: new Date() };

            // Handle date fields
            if (updateData.incomeDate) {
                updateData.incomeDate = new Date(updateData.incomeDate);
            }
            if (updateData.receivedDate) {
                updateData.receivedDate = new Date(updateData.receivedDate);
            }

            // Get original income
            const originalIncome = await db.collection('incomes').findOne({
                _id: new ObjectId(id)
            });

            if (!originalIncome) {
                return res.status(404).json({
                    success: false,
                    error: 'Income not found'
                });
            }

            const result = await db.collection('incomes').findOneAndUpdate(
                { _id: new ObjectId(id) },
                { $set: updateData },
                { returnDocument: 'after' }
            );

            // If payment status changed to received, create transaction
            if (originalIncome.paymentStatus !== 'received' && 
                updateData.paymentStatus === 'received') {
                await createIncomeTransaction(db, result);
            }

            res.json({
                success: true,
                data: result,
                message: 'Income updated successfully'
            });
        } catch (error) {
            console.error('[Income] Error updating income:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Delete income
     */
    deleteIncome: async (req, res, db) => {
        try {
            const { id } = req.params;

            const result = await db.collection('incomes').deleteOne({
                _id: new ObjectId(id)
            });

            if (result.deletedCount === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Income not found'
                });
            }

            // Also delete any related financial transaction
            await db.collection('financialTransactions').deleteMany({
                sourceType: 'income',
                sourceId: id
            });

            res.json({
                success: true,
                message: 'Income deleted successfully'
            });
        } catch (error) {
            console.error('[Income] Error deleting income:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Mark income as received
     */
    markAsReceived: async (req, res, db) => {
        try {
            const { id } = req.params;
            const { receivedDate, paymentMethod, paymentReference } = req.body;

            const income = await db.collection('incomes').findOneAndUpdate(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        paymentStatus: 'received',
                        receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
                        paymentMethod,
                        paymentReference,
                        updatedAt: new Date()
                    }
                },
                { returnDocument: 'after' }
            );

            if (!income) {
                return res.status(404).json({
                    success: false,
                    error: 'Income not found'
                });
            }

            // Create financial transaction
            await createIncomeTransaction(db, income);

            res.json({
                success: true,
                data: income,
                message: 'Income marked as received'
            });
        } catch (error) {
            console.error('[Income] Error marking income as received:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get income summary by category
     */
    getSummaryByCategory: async (req, res, db) => {
        try {
            const { startDate, endDate, year, month } = req.query;
            
            let dateFilter = {};
            
            if (startDate && endDate) {
                dateFilter = {
                    incomeDate: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                };
            } else if (year && month) {
                const y = parseInt(year);
                const m = parseInt(month);
                dateFilter = {
                    incomeDate: {
                        $gte: new Date(y, m - 1, 1),
                        $lte: new Date(y, m, 0, 23, 59, 59)
                    }
                };
            }

            const summary = await db.collection('incomes')
                .aggregate([
                    { $match: dateFilter },
                    {
                        $group: {
                            _id: '$category',
                            total: { $sum: '$amount' },
                            count: { $sum: 1 },
                            received: {
                                $sum: {
                                    $cond: [{ $eq: ['$paymentStatus', 'received'] }, '$amount', 0]
                                }
                            },
                            pending: {
                                $sum: {
                                    $cond: [{ $eq: ['$paymentStatus', 'pending'] }, '$amount', 0]
                                }
                            }
                        }
                    },
                    { $sort: { total: -1 } }
                ])
                .toArray();

            // Enhance with category info
            const enhancedSummary = summary.map(item => {
                const categoryInfo = INCOME_CATEGORIES.find(c => c.code === item._id) || {};
                return {
                    category: item._id,
                    ...categoryInfo,
                    total: item.total,
                    count: item.count,
                    received: item.received,
                    pending: item.pending,
                };
            });

            const grandTotal = enhancedSummary.reduce((sum, item) => sum + item.total, 0);

            res.json({
                success: true,
                data: {
                    categories: enhancedSummary,
                    grandTotal,
                    count: enhancedSummary.length
                }
            });
        } catch (error) {
            console.error('[Income] Error getting summary by category:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },
};

// Helper function to create financial transaction for income
async function createIncomeTransaction(db, income) {
    const categoryInfo = INCOME_CATEGORIES.find(c => c.code === income.category) || {};
    
    await db.collection('financialTransactions').insertOne({
        type: 'income',
        sourceType: 'income',
        sourceId: income._id.toString(),
        sourceNumber: income.paymentReference || `INC-${income._id.toString().slice(-6)}`,
        amount: income.amount,
        currency: income.currency || 'LAK',
        category: categoryInfo.nameEnglish || income.category,
        description: income.title,
        notes: income.description,
        transactionDate: income.receivedDate || income.incomeDate,
        recordedDate: new Date(),
        paymentMethod: income.paymentMethod,
        counterparty: {
            type: income.source?.type || 'other',
            id: income.source?.id,
            name: income.source?.name,
        },
        createdAt: new Date(),
        updatedAt: new Date()
    });
}

module.exports = incomeController;
