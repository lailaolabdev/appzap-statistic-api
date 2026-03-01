/**
 * Expense Controller
 * 
 * CRUD operations for expenses.
 */

const { ObjectId } = require('mongodb');

const expenseController = {
    // ==================== EXPENSE CRUD ====================

    /**
     * Get all expenses with filtering and pagination
     */
    getExpenses: async (req, res, db) => {
        try {
            const {
                page = 1,
                limit = 20,
                search,
                categoryId,
                paymentStatus,
                startDate,
                endDate,
                sortBy = 'expenseDate',
                sortOrder = 'desc'
            } = req.query;

            const query = {};

            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } },
                    { 'vendor.name': { $regex: search, $options: 'i' } },
                ];
            }

            if (categoryId) {
                query.categoryId = categoryId;
            }

            if (paymentStatus) {
                query.paymentStatus = paymentStatus;
            }

            if (startDate || endDate) {
                query.expenseDate = {};
                if (startDate) query.expenseDate.$gte = new Date(startDate);
                if (endDate) query.expenseDate.$lte = new Date(endDate);
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);
            const sortDir = sortOrder === 'asc' ? 1 : -1;

            const [expenses, total] = await Promise.all([
                db.collection('expenses')
                    .find(query)
                    .sort({ [sortBy]: sortDir })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .toArray(),
                db.collection('expenses').countDocuments(query)
            ]);

            // Get summary stats
            const stats = await db.collection('expenses')
                .aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: null,
                            totalAmount: { $sum: '$amount' },
                            paidAmount: {
                                $sum: {
                                    $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$amount', 0]
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
                    expenses,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / parseInt(limit))
                    },
                    stats: stats[0] || { totalAmount: 0, paidAmount: 0, pendingAmount: 0 }
                }
            });
        } catch (error) {
            console.error('[Expense] Error getting expenses:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get single expense by ID
     */
    getExpenseById: async (req, res, db) => {
        try {
            const { id } = req.params;
            
            const expense = await db.collection('expenses').findOne({
                _id: new ObjectId(id)
            });

            if (!expense) {
                return res.status(404).json({
                    success: false,
                    error: 'Expense not found'
                });
            }

            res.json({ success: true, data: expense });
        } catch (error) {
            console.error('[Expense] Error getting expense:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Create new expense
     */
    createExpense: async (req, res, db) => {
        try {
            const {
                title,
                description,
                categoryId,
                categoryName,
                amount,
                expenseDate,
                paymentDate,
                dueDate,
                paymentStatus = 'pending',
                paymentMethod,
                paymentReference,
                isRecurring = false,
                recurrence,
                vendor,
                tags,
            } = req.body;

            if (!title || !amount) {
                return res.status(400).json({
                    success: false,
                    error: 'Title and amount are required'
                });
            }

            const expense = {
                title,
                description,
                categoryId,
                categoryName,
                amount: parseFloat(amount),
                currency: 'LAK',
                expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
                paymentDate: paymentDate ? new Date(paymentDate) : null,
                dueDate: dueDate ? new Date(dueDate) : null,
                paymentStatus,
                paymentMethod,
                paymentReference,
                isRecurring,
                recurrence: isRecurring ? recurrence : null,
                vendor: vendor || {},
                attachments: [],
                tags: tags || [],
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const result = await db.collection('expenses').insertOne(expense);
            expense._id = result.insertedId;

            // If paid, create a financial transaction record
            if (paymentStatus === 'paid' && expense.paymentDate) {
                await createExpenseTransaction(db, expense);
            }

            res.status(201).json({
                success: true,
                data: expense,
                message: 'Expense created successfully'
            });
        } catch (error) {
            console.error('[Expense] Error creating expense:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Update expense
     */
    updateExpense: async (req, res, db) => {
        try {
            const { id } = req.params;
            const updateData = { ...req.body, updatedAt: new Date() };

            // Handle date fields
            if (updateData.expenseDate) {
                updateData.expenseDate = new Date(updateData.expenseDate);
            }
            if (updateData.paymentDate) {
                updateData.paymentDate = new Date(updateData.paymentDate);
            }
            if (updateData.dueDate) {
                updateData.dueDate = new Date(updateData.dueDate);
            }

            // Get original expense
            const originalExpense = await db.collection('expenses').findOne({
                _id: new ObjectId(id)
            });

            if (!originalExpense) {
                return res.status(404).json({
                    success: false,
                    error: 'Expense not found'
                });
            }

            const result = await db.collection('expenses').findOneAndUpdate(
                { _id: new ObjectId(id) },
                { $set: updateData },
                { returnDocument: 'after' }
            );

            // If payment status changed to paid, create transaction
            if (originalExpense.paymentStatus !== 'paid' && 
                updateData.paymentStatus === 'paid') {
                await createExpenseTransaction(db, result);
            }

            res.json({
                success: true,
                data: result,
                message: 'Expense updated successfully'
            });
        } catch (error) {
            console.error('[Expense] Error updating expense:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Delete expense
     */
    deleteExpense: async (req, res, db) => {
        try {
            const { id } = req.params;

            const result = await db.collection('expenses').deleteOne({
                _id: new ObjectId(id)
            });

            if (result.deletedCount === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Expense not found'
                });
            }

            // Also delete any related financial transaction
            await db.collection('financialTransactions').deleteMany({
                sourceType: 'expense',
                sourceId: id
            });

            res.json({
                success: true,
                message: 'Expense deleted successfully'
            });
        } catch (error) {
            console.error('[Expense] Error deleting expense:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Mark expense as paid
     */
    markAsPaid: async (req, res, db) => {
        try {
            const { id } = req.params;
            const { paymentDate, paymentMethod, paymentReference } = req.body;

            const expense = await db.collection('expenses').findOneAndUpdate(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        paymentStatus: 'paid',
                        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
                        paymentMethod,
                        paymentReference,
                        updatedAt: new Date()
                    }
                },
                { returnDocument: 'after' }
            );

            if (!expense) {
                return res.status(404).json({
                    success: false,
                    error: 'Expense not found'
                });
            }

            // Create financial transaction
            await createExpenseTransaction(db, expense);

            res.json({
                success: true,
                data: expense,
                message: 'Expense marked as paid'
            });
        } catch (error) {
            console.error('[Expense] Error marking expense as paid:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // ==================== EXPENSE CATEGORIES ====================

    /**
     * Get all expense categories
     */
    getCategories: async (req, res, db) => {
        try {
            const categories = await db.collection('expenseCategories')
                .find({ isActive: true })
                .sort({ sortOrder: 1 })
                .toArray();

            res.json({ success: true, data: categories });
        } catch (error) {
            console.error('[Expense] Error getting categories:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Create expense category
     */
    createCategory: async (req, res, db) => {
        try {
            const { code, name, nameEnglish, description, icon, color, type, plCategory, monthlyBudget } = req.body;

            if (!code || !name) {
                return res.status(400).json({
                    success: false,
                    error: 'Code and name are required'
                });
            }

            const category = {
                code: code.toUpperCase(),
                name,
                nameEnglish,
                description,
                icon,
                color,
                type: type || 'operating',
                plCategory: plCategory || 'operating_expense',
                monthlyBudget: monthlyBudget || 0,
                isActive: true,
                sortOrder: 999,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await db.collection('expenseCategories').insertOne(category);
            category._id = result.insertedId;

            res.status(201).json({
                success: true,
                data: category,
                message: 'Category created successfully'
            });
        } catch (error) {
            console.error('[Expense] Error creating category:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Update expense category
     */
    updateCategory: async (req, res, db) => {
        try {
            const { id } = req.params;
            const updateData = { ...req.body, updatedAt: new Date() };

            const result = await db.collection('expenseCategories').findOneAndUpdate(
                { _id: new ObjectId(id) },
                { $set: updateData },
                { returnDocument: 'after' }
            );

            if (!result) {
                return res.status(404).json({
                    success: false,
                    error: 'Category not found'
                });
            }

            res.json({
                success: true,
                data: result,
                message: 'Category updated successfully'
            });
        } catch (error) {
            console.error('[Expense] Error updating category:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Delete expense category
     */
    deleteCategory: async (req, res, db) => {
        try {
            const { id } = req.params;

            // Check if category is in use
            const inUse = await db.collection('expenses').countDocuments({ categoryId: id });
            
            if (inUse > 0) {
                return res.status(400).json({
                    success: false,
                    error: `Category is used by ${inUse} expenses. Cannot delete.`
                });
            }

            const result = await db.collection('expenseCategories').deleteOne({
                _id: new ObjectId(id)
            });

            if (result.deletedCount === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Category not found'
                });
            }

            res.json({
                success: true,
                message: 'Category deleted successfully'
            });
        } catch (error) {
            console.error('[Expense] Error deleting category:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // ==================== BANK ACCOUNTS ====================

    /**
     * Get all bank accounts
     */
    getBankAccounts: async (req, res, db) => {
        try {
            const accounts = await db.collection('bankAccounts')
                .find({})
                .sort({ isPrimary: -1, name: 1 })
                .toArray();

            const totalBalance = accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

            res.json({ 
                success: true, 
                data: {
                    accounts,
                    totalBalance
                }
            });
        } catch (error) {
            console.error('[Expense] Error getting bank accounts:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Create bank account
     */
    createBankAccount: async (req, res, db) => {
        try {
            const { 
                name, 
                accountNumber, 
                bankName, 
                bankCode, 
                accountType = 'checking',
                currency = 'LAK',
                currentBalance = 0,
                isPrimary = false,
                color,
                icon
            } = req.body;

            if (!name || !accountNumber || !bankName) {
                return res.status(400).json({
                    success: false,
                    error: 'Name, account number, and bank name are required'
                });
            }

            // If setting as primary, unset other primary accounts
            if (isPrimary) {
                await db.collection('bankAccounts').updateMany(
                    { isPrimary: true },
                    { $set: { isPrimary: false } }
                );
            }

            const account = {
                name,
                accountNumber,
                bankName,
                bankCode,
                accountType,
                currency,
                currentBalance: parseFloat(currentBalance),
                lastUpdated: new Date(),
                openingBalance: parseFloat(currentBalance),
                openingDate: new Date(),
                isActive: true,
                isPrimary,
                color,
                icon,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await db.collection('bankAccounts').insertOne(account);
            account._id = result.insertedId;

            res.status(201).json({
                success: true,
                data: account,
                message: 'Bank account created successfully'
            });
        } catch (error) {
            console.error('[Expense] Error creating bank account:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Update bank account
     */
    updateBankAccount: async (req, res, db) => {
        try {
            const { id } = req.params;
            const updateData = { ...req.body, updatedAt: new Date() };

            if (updateData.isPrimary) {
                await db.collection('bankAccounts').updateMany(
                    { _id: { $ne: new ObjectId(id) }, isPrimary: true },
                    { $set: { isPrimary: false } }
                );
            }

            const result = await db.collection('bankAccounts').findOneAndUpdate(
                { _id: new ObjectId(id) },
                { $set: updateData },
                { returnDocument: 'after' }
            );

            if (!result) {
                return res.status(404).json({
                    success: false,
                    error: 'Bank account not found'
                });
            }

            res.json({
                success: true,
                data: result,
                message: 'Bank account updated successfully'
            });
        } catch (error) {
            console.error('[Expense] Error updating bank account:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Delete bank account
     */
    deleteBankAccount: async (req, res, db) => {
        try {
            const { id } = req.params;

            const result = await db.collection('bankAccounts').deleteOne({
                _id: new ObjectId(id)
            });

            if (result.deletedCount === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Bank account not found'
                });
            }

            res.json({
                success: true,
                message: 'Bank account deleted successfully'
            });
        } catch (error) {
            console.error('[Expense] Error deleting bank account:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Adjust bank account balance
     */
    adjustBalance: async (req, res, db) => {
        try {
            const { id } = req.params;
            const { newBalance, reason } = req.body;

            const account = await db.collection('bankAccounts').findOne({
                _id: new ObjectId(id)
            });

            if (!account) {
                return res.status(404).json({
                    success: false,
                    error: 'Bank account not found'
                });
            }

            const adjustment = parseFloat(newBalance) - account.currentBalance;

            // Create adjustment transaction
            await db.collection('financialTransactions').insertOne({
                type: adjustment >= 0 ? 'income' : 'expense',
                sourceType: 'manual',
                sourceNumber: `ADJ-${Date.now()}`,
                amount: Math.abs(adjustment),
                currency: account.currency,
                category: 'Balance Adjustment',
                description: reason || 'Manual balance adjustment',
                transactionDate: new Date(),
                recordedDate: new Date(),
                accountId: id,
                accountName: account.name,
                paymentMethod: 'adjustment',
                isReconciled: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Update account balance
            const result = await db.collection('bankAccounts').findOneAndUpdate(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        currentBalance: parseFloat(newBalance),
                        lastUpdated: new Date(),
                        updatedAt: new Date()
                    }
                },
                { returnDocument: 'after' }
            );

            res.json({
                success: true,
                data: result,
                message: `Balance adjusted by ${adjustment.toLocaleString()} LAK`
            });
        } catch (error) {
            console.error('[Expense] Error adjusting balance:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // ==================== EXPENSE SUMMARY BY CATEGORY ====================

    /**
     * Get expense summary grouped by category
     */
    getSummaryByCategory: async (req, res, db) => {
        try {
            const { startDate, endDate, year, month } = req.query;
            
            let dateFilter = {};
            
            if (startDate && endDate) {
                dateFilter = {
                    expenseDate: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                };
            } else if (year && month) {
                const y = parseInt(year);
                const m = parseInt(month);
                dateFilter = {
                    expenseDate: {
                        $gte: new Date(y, m - 1, 1),
                        $lte: new Date(y, m, 0, 23, 59, 59)
                    }
                };
            }

            const summary = await db.collection('expenses')
                .aggregate([
                    { $match: { ...dateFilter, paymentStatus: { $ne: 'cancelled' } } },
                    {
                        $group: {
                            _id: { categoryId: '$categoryId', categoryName: '$categoryName' },
                            total: { $sum: '$amount' },
                            count: { $sum: 1 },
                            paid: {
                                $sum: {
                                    $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$amount', 0]
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

            // Get categories for additional info
            const categories = await db.collection('expenseCategories')
                .find({})
                .toArray();
            
            const categoryMap = {};
            categories.forEach(cat => {
                categoryMap[cat._id.toString()] = cat;
            });

            // Enhance summary with category details
            const enhancedSummary = summary.map(item => ({
                categoryId: item._id.categoryId,
                categoryName: item._id.categoryName || 'Uncategorized',
                ...categoryMap[item._id.categoryId],
                total: item.total,
                count: item.count,
                paid: item.paid,
                pending: item.pending,
            }));

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
            console.error('[Expense] Error getting summary by category:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * TOR 6: Process recurring expenses - creates next occurrence
     * Call via cron daily
     */
    processRecurringExpenses: async (req, res, db) => {
        try {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const recurring = await db.collection('expenses').find({
                isRecurring: true,
                'recurrence.nextDate': { $lte: now },
                $or: [
                    { 'recurrence.endDate': { $exists: false } },
                    { 'recurrence.endDate': null },
                    { 'recurrence.endDate': { $gte: now } },
                ],
            }).toArray();

            let created = 0;
            for (const exp of recurring) {
                const rec = exp.recurrence || {};
                const nextDate = new Date(rec.nextDate);
                const freq = rec.frequency || 'monthly';

                const newExpense = {
                    ...exp,
                    _id: undefined,
                    expenseDate: nextDate,
                    paymentDate: null,
                    paymentStatus: 'pending',
                    isRecurring: false,  // Instance, not template - parent stays as template
                    recurrence: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                delete newExpense._id;

                let nextNext = new Date(nextDate);
                if (freq === 'monthly') nextNext.setMonth(nextNext.getMonth() + 1);
                else if (freq === 'quarterly') nextNext.setMonth(nextNext.getMonth() + 3);
                else if (freq === 'yearly') nextNext.setFullYear(nextNext.getFullYear() + 1);

                if (rec.endDate && nextNext > new Date(rec.endDate)) continue;

                await db.collection('expenses').insertOne(newExpense);
                await db.collection('expenses').updateOne(
                    { _id: exp._id },
                    { $set: { 'recurrence.nextDate': nextNext, updatedAt: new Date() } }
                );
                created++;
            }

            res.json({ success: true, created });
        } catch (error) {
            console.error('[Expense] Error processing recurring:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },
};

// Helper function to create financial transaction for expense
async function createExpenseTransaction(db, expense) {
    await db.collection('financialTransactions').insertOne({
        type: 'expense',
        sourceType: 'expense',
        sourceId: expense._id.toString(),
        sourceNumber: expense.paymentReference || `EXP-${expense._id.toString().slice(-6)}`,
        amount: -expense.amount,
        currency: expense.currency || 'LAK',
        category: expense.categoryName || 'Uncategorized',
        description: expense.title,
        notes: expense.description,
        transactionDate: expense.paymentDate || expense.expenseDate,
        recordedDate: new Date(),
        paymentMethod: expense.paymentMethod,
        counterparty: {
            type: 'vendor',
            name: expense.vendor?.name,
        },
        createdAt: new Date(),
        updatedAt: new Date()
    });
}

module.exports = expenseController;
