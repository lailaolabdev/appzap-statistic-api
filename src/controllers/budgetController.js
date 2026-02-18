/**
 * Budget Controller
 * 
 * Budget planning and tracking.
 */

const { ObjectId } = require('mongodb');

const budgetController = {
    /**
     * Get budgets list
     */
    getBudgets: async (req, res, db) => {
        try {
            const { year, status } = req.query;

            const query = {};
            if (year) query.year = parseInt(year);
            if (status) query.status = status;

            const budgets = await db.collection('budgets')
                .find(query)
                .sort({ year: -1, month: -1 })
                .toArray();

            res.json({ success: true, data: budgets });
        } catch (error) {
            console.error('[Budget] Error getting budgets:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get budget for specific period
     */
    getBudget: async (req, res, db) => {
        try {
            const { year, month } = req.params;

            let budget = await db.collection('budgets').findOne({
                year: parseInt(year),
                month: month ? parseInt(month) : null
            });

            // If no budget exists, create a template
            if (!budget) {
                const categories = await db.collection('expenseCategories')
                    .find({ isActive: true })
                    .toArray();

                budget = {
                    year: parseInt(year),
                    month: month ? parseInt(month) : null,
                    period: month ? 'monthly' : 'yearly',
                    categoryBudgets: categories.map(cat => ({
                        categoryId: cat._id.toString(),
                        categoryCode: cat.code,
                        categoryName: cat.name,
                        budgetAmount: cat.monthlyBudget || 0,
                        actualAmount: 0,
                        variance: 0,
                        variancePercent: 0
                    })),
                    totalBudget: categories.reduce((sum, cat) => sum + (cat.monthlyBudget || 0), 0),
                    totalActual: 0,
                    totalVariance: 0,
                    revenueTarget: 0,
                    actualRevenue: 0,
                    profitTarget: 0,
                    actualProfit: 0,
                    status: 'draft',
                    isTemplate: true
                };
            }

            // Calculate actual amounts from expenses
            const y = parseInt(year);
            const m = month ? parseInt(month) : null;
            
            let startDate, endDate;
            if (m) {
                startDate = new Date(y, m - 1, 1);
                endDate = new Date(y, m, 0, 23, 59, 59);
            } else {
                startDate = new Date(y, 0, 1);
                endDate = new Date(y, 11, 31, 23, 59, 59);
            }

            // Get actual expenses by category
            const actualExpenses = await db.collection('expenses')
                .aggregate([
                    {
                        $match: {
                            expenseDate: { $gte: startDate, $lte: endDate },
                            paymentStatus: { $ne: 'cancelled' }
                        }
                    },
                    {
                        $group: {
                            _id: '$categoryId',
                            total: { $sum: '$amount' }
                        }
                    }
                ])
                .toArray();

            const actualByCategory = {};
            actualExpenses.forEach(exp => {
                actualByCategory[exp._id] = exp.total;
            });

            // Get actual revenue
            const actualRevenue = await db.collection('invoices')
                .aggregate([
                    {
                        $match: {
                            paymentStatus: 'paid',
                            paymentDate: { $gte: startDate, $lte: endDate }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$total' }
                        }
                    }
                ])
                .toArray();

            // Update category budgets with actuals
            let totalActual = 0;
            budget.categoryBudgets = budget.categoryBudgets.map(cat => {
                const actual = actualByCategory[cat.categoryId] || 0;
                totalActual += actual;
                const variance = cat.budgetAmount - actual;
                return {
                    ...cat,
                    actualAmount: actual,
                    variance,
                    variancePercent: cat.budgetAmount > 0 
                        ? (variance / cat.budgetAmount) * 100 
                        : 0
                };
            });

            budget.totalActual = totalActual;
            budget.totalVariance = budget.totalBudget - totalActual;
            budget.actualRevenue = actualRevenue[0]?.total || 0;
            budget.actualProfit = budget.actualRevenue - totalActual;

            res.json({ success: true, data: budget });
        } catch (error) {
            console.error('[Budget] Error getting budget:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Create or update budget
     */
    saveBudget: async (req, res, db) => {
        try {
            const {
                year,
                month,
                period = 'monthly',
                categoryBudgets,
                revenueTarget,
                profitTarget,
                notes
            } = req.body;

            const totalBudget = categoryBudgets?.reduce(
                (sum, cat) => sum + (cat.budgetAmount || 0), 0
            ) || 0;

            const budget = {
                year: parseInt(year),
                month: month ? parseInt(month) : null,
                period,
                categoryBudgets: categoryBudgets || [],
                totalBudget,
                totalActual: 0,
                totalVariance: 0,
                revenueTarget: revenueTarget || 0,
                actualRevenue: 0,
                profitTarget: profitTarget || 0,
                actualProfit: 0,
                status: 'draft',
                notes,
                updatedAt: new Date()
            };

            const result = await db.collection('budgets').findOneAndUpdate(
                { year: parseInt(year), month: month ? parseInt(month) : null },
                { 
                    $set: budget,
                    $setOnInsert: { createdAt: new Date() }
                },
                { upsert: true, returnDocument: 'after' }
            );

            res.json({
                success: true,
                data: result,
                message: 'Budget saved successfully'
            });
        } catch (error) {
            console.error('[Budget] Error saving budget:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Approve budget
     */
    approveBudget: async (req, res, db) => {
        try {
            const { year, month } = req.params;

            const result = await db.collection('budgets').findOneAndUpdate(
                { year: parseInt(year), month: month ? parseInt(month) : null },
                {
                    $set: {
                        status: 'approved',
                        approvedAt: new Date(),
                        updatedAt: new Date()
                    }
                },
                { returnDocument: 'after' }
            );

            if (!result) {
                return res.status(404).json({
                    success: false,
                    error: 'Budget not found'
                });
            }

            res.json({
                success: true,
                data: result,
                message: 'Budget approved successfully'
            });
        } catch (error) {
            console.error('[Budget] Error approving budget:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get budget comparison (actual vs budget)
     */
    getBudgetComparison: async (req, res, db) => {
        try {
            const { year } = req.params;
            const y = parseInt(year);

            const monthlyComparison = [];

            for (let m = 1; m <= 12; m++) {
                const startDate = new Date(y, m - 1, 1);
                const endDate = new Date(y, m, 0, 23, 59, 59);

                // Get budget for this month
                const budget = await db.collection('budgets').findOne({
                    year: y,
                    month: m
                });

                // Get actual expenses
                const actualExpenses = await db.collection('expenses')
                    .aggregate([
                        {
                            $match: {
                                expenseDate: { $gte: startDate, $lte: endDate },
                                paymentStatus: { $ne: 'cancelled' }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                total: { $sum: '$amount' }
                            }
                        }
                    ])
                    .toArray();

                // Get actual revenue
                const actualRevenue = await db.collection('invoices')
                    .aggregate([
                        {
                            $match: {
                                paymentStatus: 'paid',
                                paymentDate: { $gte: startDate, $lte: endDate }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                total: { $sum: '$total' }
                            }
                        }
                    ])
                    .toArray();

                const budgetAmount = budget?.totalBudget || 0;
                const actualAmount = actualExpenses[0]?.total || 0;
                const revenueTarget = budget?.revenueTarget || 0;
                const revenueActual = actualRevenue[0]?.total || 0;

                monthlyComparison.push({
                    month: m,
                    monthName: new Date(y, m - 1, 1).toLocaleString('en', { month: 'short' }),
                    expense: {
                        budget: budgetAmount,
                        actual: actualAmount,
                        variance: budgetAmount - actualAmount,
                        variancePercent: budgetAmount > 0 
                            ? ((budgetAmount - actualAmount) / budgetAmount) * 100 
                            : 0
                    },
                    revenue: {
                        target: revenueTarget,
                        actual: revenueActual,
                        variance: revenueActual - revenueTarget,
                        variancePercent: revenueTarget > 0 
                            ? ((revenueActual - revenueTarget) / revenueTarget) * 100 
                            : 0
                    },
                    profit: {
                        target: revenueTarget - budgetAmount,
                        actual: revenueActual - actualAmount
                    }
                });
            }

            // Calculate YTD totals
            const ytdTotals = monthlyComparison.reduce((acc, month) => ({
                expenseBudget: acc.expenseBudget + month.expense.budget,
                expenseActual: acc.expenseActual + month.expense.actual,
                revenueTarget: acc.revenueTarget + month.revenue.target,
                revenueActual: acc.revenueActual + month.revenue.actual,
            }), { expenseBudget: 0, expenseActual: 0, revenueTarget: 0, revenueActual: 0 });

            res.json({
                success: true,
                data: {
                    year: y,
                    monthly: monthlyComparison,
                    ytd: {
                        expense: {
                            budget: ytdTotals.expenseBudget,
                            actual: ytdTotals.expenseActual,
                            variance: ytdTotals.expenseBudget - ytdTotals.expenseActual
                        },
                        revenue: {
                            target: ytdTotals.revenueTarget,
                            actual: ytdTotals.revenueActual,
                            variance: ytdTotals.revenueActual - ytdTotals.revenueTarget
                        },
                        profit: {
                            target: ytdTotals.revenueTarget - ytdTotals.expenseBudget,
                            actual: ytdTotals.revenueActual - ytdTotals.expenseActual
                        }
                    }
                }
            });
        } catch (error) {
            console.error('[Budget] Error getting comparison:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },
};

module.exports = budgetController;
