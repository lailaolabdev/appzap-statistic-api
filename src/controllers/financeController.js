/**
 * Finance Controller
 * 
 * Handles financial dashboard, P&L, cash flow, and reporting.
 */

const { ObjectId } = require('mongodb');

const financeController = {
    // ==================== DASHBOARD ====================

    /**
     * Get financial dashboard overview
     */
    getDashboard: async (req, res, db) => {
        try {
            const { year, month } = req.query;
            const currentYear = year ? parseInt(year) : new Date().getFullYear();
            const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;

            // Date ranges
            const monthStart = new Date(currentYear, currentMonth - 1, 1);
            const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);
            const yearStart = new Date(currentYear, 0, 1);
            const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

            // Previous month for comparison
            const prevMonthStart = new Date(currentYear, currentMonth - 2, 1);
            const prevMonthEnd = new Date(currentYear, currentMonth - 1, 0, 23, 59, 59);

            // Get revenue from paid invoices
            const [monthlyRevenue, yearlyRevenue, prevMonthRevenue] = await Promise.all([
                getRevenueByPeriod(db, monthStart, monthEnd),
                getRevenueByPeriod(db, yearStart, yearEnd),
                getRevenueByPeriod(db, prevMonthStart, prevMonthEnd),
            ]);

            // Get expenses
            const [monthlyExpenses, yearlyExpenses, prevMonthExpenses] = await Promise.all([
                getExpensesByPeriod(db, monthStart, monthEnd),
                getExpensesByPeriod(db, yearStart, yearEnd),
                getExpensesByPeriod(db, prevMonthStart, prevMonthEnd),
            ]);

            // Calculate profits
            const monthlyProfit = monthlyRevenue.total - monthlyExpenses.total;
            const yearlyProfit = yearlyRevenue.total - yearlyExpenses.total;
            const prevMonthProfit = prevMonthRevenue.total - prevMonthExpenses.total;

            // Growth calculations
            const revenueGrowth = prevMonthRevenue.total > 0 
                ? ((monthlyRevenue.total - prevMonthRevenue.total) / prevMonthRevenue.total) * 100 
                : 0;
            const expenseGrowth = prevMonthExpenses.total > 0 
                ? ((monthlyExpenses.total - prevMonthExpenses.total) / prevMonthExpenses.total) * 100 
                : 0;
            const profitGrowth = prevMonthProfit !== 0 
                ? ((monthlyProfit - prevMonthProfit) / Math.abs(prevMonthProfit)) * 100 
                : 0;

            // Get cash flow
            const cashFlow = await getCashFlow(db, monthStart, monthEnd);

            // Get pending invoices (Accounts Receivable)
            const pendingInvoices = await db.collection('invoices')
                .aggregate([
                    { $match: { paymentStatus: 'pending' } },
                    { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
                ])
                .toArray();

            // Get pending expenses (Accounts Payable)
            const pendingExpenses = await db.collection('expenses')
                .aggregate([
                    { $match: { paymentStatus: 'pending' } },
                    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
                ])
                .toArray();

            // Get monthly trend (last 12 months)
            const monthlyTrend = await getMonthlyTrend(db, 12);

            res.json({
                success: true,
                data: {
                    period: { year: currentYear, month: currentMonth },
                    
                    // Monthly Summary
                    monthly: {
                        revenue: monthlyRevenue.total,
                        revenueBreakdown: monthlyRevenue.breakdown,
                        expenses: monthlyExpenses.total,
                        expenseBreakdown: monthlyExpenses.breakdown,
                        profit: monthlyProfit,
                        profitMargin: monthlyRevenue.total > 0 
                            ? (monthlyProfit / monthlyRevenue.total) * 100 
                            : 0,
                    },

                    // Year-to-Date
                    ytd: {
                        revenue: yearlyRevenue.total,
                        expenses: yearlyExpenses.total,
                        profit: yearlyProfit,
                    },

                    // Growth vs Previous Month
                    growth: {
                        revenue: revenueGrowth,
                        expenses: expenseGrowth,
                        profit: profitGrowth,
                    },

                    // Cash Flow
                    cashFlow,

                    // Outstanding
                    accountsReceivable: {
                        total: pendingInvoices[0]?.total || 0,
                        count: pendingInvoices[0]?.count || 0,
                    },
                    accountsPayable: {
                        total: pendingExpenses[0]?.total || 0,
                        count: pendingExpenses[0]?.count || 0,
                    },

                    // Trend
                    monthlyTrend,
                },
            });
        } catch (error) {
            console.error('[Finance] Error getting dashboard:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // ==================== PROFIT & LOSS ====================

    /**
     * Get Profit & Loss statement
     */
    getProfitLoss: async (req, res, db) => {
        try {
            const { year, month, quarter, periodType = 'monthly' } = req.query;
            const currentYear = year ? parseInt(year) : new Date().getFullYear();

            let startDate, endDate, periodLabel;

            if (periodType === 'monthly' && month) {
                const m = parseInt(month);
                startDate = new Date(currentYear, m - 1, 1);
                endDate = new Date(currentYear, m, 0, 23, 59, 59);
                periodLabel = `${currentYear}-${String(m).padStart(2, '0')}`;
            } else if (periodType === 'quarterly' && quarter) {
                const q = parseInt(quarter);
                startDate = new Date(currentYear, (q - 1) * 3, 1);
                endDate = new Date(currentYear, q * 3, 0, 23, 59, 59);
                periodLabel = `${currentYear}-Q${q}`;
            } else {
                startDate = new Date(currentYear, 0, 1);
                endDate = new Date(currentYear, 11, 31, 23, 59, 59);
                periodLabel = String(currentYear);
            }

            // Get revenue breakdown
            const revenue = await getRevenueByPeriod(db, startDate, endDate);

            // Get expense breakdown by category
            const expensesByCategory = await db.collection('expenses')
                .aggregate([
                    {
                        $match: {
                            expenseDate: { $gte: startDate, $lte: endDate },
                            paymentStatus: { $ne: 'cancelled' }
                        }
                    },
                    {
                        $group: {
                            _id: '$categoryName',
                            total: { $sum: '$amount' },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { total: -1 } }
                ])
                .toArray();

            const totalExpenses = expensesByCategory.reduce((sum, cat) => sum + cat.total, 0);
            const grossProfit = revenue.total - (revenue.breakdown?.deviceCosts || 0);
            const operatingProfit = grossProfit - totalExpenses;
            const netProfit = operatingProfit;

            res.json({
                success: true,
                data: {
                    period: { periodType, periodLabel, startDate, endDate },
                    
                    revenue: {
                        subscriptions: revenue.breakdown?.subscriptions || 0,
                        deviceSales: revenue.breakdown?.deviceSales || 0,
                        services: revenue.breakdown?.services || 0,
                        other: revenue.breakdown?.other || 0,
                        total: revenue.total,
                    },

                    costOfGoods: {
                        deviceCosts: revenue.breakdown?.deviceCosts || 0,
                        total: revenue.breakdown?.deviceCosts || 0,
                    },

                    grossProfit,
                    grossMargin: revenue.total > 0 ? (grossProfit / revenue.total) * 100 : 0,

                    operatingExpenses: expensesByCategory.map(cat => ({
                        category: cat._id || 'Uncategorized',
                        amount: cat.total,
                        count: cat.count,
                    })),
                    totalOperatingExpenses: totalExpenses,

                    operatingProfit,
                    operatingMargin: revenue.total > 0 ? (operatingProfit / revenue.total) * 100 : 0,

                    netProfit,
                    netMargin: revenue.total > 0 ? (netProfit / revenue.total) * 100 : 0,
                },
            });
        } catch (error) {
            console.error('[Finance] Error getting P&L:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // ==================== CASH FLOW ====================

    /**
     * Get Cash Flow statement
     */
    getCashFlow: async (req, res, db) => {
        try {
            const { year, month } = req.query;
            const currentYear = year ? parseInt(year) : new Date().getFullYear();
            const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;

            const startDate = new Date(currentYear, currentMonth - 1, 1);
            const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);

            // Get cash inflows (paid invoices)
            const cashIn = await db.collection('invoices')
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
                            total: { $sum: '$total' },
                            count: { $sum: 1 }
                        }
                    }
                ])
                .toArray();

            // Get cash outflows (paid expenses)
            const cashOut = await db.collection('expenses')
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
                            total: { $sum: '$amount' },
                            count: { $sum: 1 }
                        }
                    }
                ])
                .toArray();

            // Get bank accounts for opening balance
            const bankAccounts = await db.collection('bankAccounts')
                .find({ isActive: true })
                .toArray();

            const totalBalance = bankAccounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

            // Calculate cash flow by week
            const weeklyFlow = await getWeeklyCashFlow(db, startDate, endDate);

            // Get daily transactions for the month
            const dailyTransactions = await db.collection('financialTransactions')
                .aggregate([
                    {
                        $match: {
                            transactionDate: { $gte: startDate, $lte: endDate }
                        }
                    },
                    {
                        $group: {
                            _id: { $dateToString: { format: '%Y-%m-%d', date: '$transactionDate' } },
                            income: {
                                $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] }
                            },
                            expense: {
                                $sum: { $cond: [{ $eq: ['$type', 'expense'] }, { $abs: '$amount' }, 0] }
                            }
                        }
                    },
                    { $sort: { _id: 1 } }
                ])
                .toArray();

            const totalCashIn = cashIn[0]?.total || 0;
            const totalCashOut = cashOut[0]?.total || 0;
            const netCashFlow = totalCashIn - totalCashOut;

            res.json({
                success: true,
                data: {
                    period: { year: currentYear, month: currentMonth },
                    
                    summary: {
                        openingBalance: totalBalance - netCashFlow,
                        cashIn: totalCashIn,
                        cashOut: totalCashOut,
                        netCashFlow,
                        closingBalance: totalBalance,
                    },

                    inflows: {
                        invoicePayments: totalCashIn,
                        other: 0,
                        total: totalCashIn,
                    },

                    outflows: {
                        expenses: totalCashOut,
                        other: 0,
                        total: totalCashOut,
                    },

                    bankAccounts: bankAccounts.map(acc => ({
                        name: acc.name,
                        bankName: acc.bankName,
                        balance: acc.currentBalance || 0,
                        currency: acc.currency,
                    })),

                    weeklyFlow,
                    dailyTransactions,
                },
            });
        } catch (error) {
            console.error('[Finance] Error getting cash flow:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // ==================== REVENUE PREDICTIONS ====================

    /**
     * Get revenue predictions based on active subscriptions
     */
    getRevenuePredictions: async (req, res, db) => {
        try {
            const { months = 6 } = req.query;
            const numMonths = parseInt(months);

            // Get active subscription info from invoices
            const now = new Date();
            
            // Calculate MRR from recent paid invoices with subscriptions
            const recentInvoices = await db.collection('invoices')
                .find({
                    paymentStatus: 'paid',
                    'subscription.monthlyRate': { $gt: 0 }
                })
                .sort({ paymentDate: -1 })
                .limit(100)
                .toArray();

            // Estimate MRR based on unique restaurants with active subscriptions
            const restaurantSubscriptions = {};
            recentInvoices.forEach(inv => {
                const key = `${inv.restaurant?.posVersion}-${inv.restaurant?.id}`;
                if (!restaurantSubscriptions[key] || inv.paymentDate > restaurantSubscriptions[key].date) {
                    restaurantSubscriptions[key] = {
                        date: inv.paymentDate,
                        monthlyRate: inv.subscription?.monthlyRate || 0,
                        endDate: inv.subscription?.endDate,
                    };
                }
            });

            // Calculate current MRR
            const activeSubscriptions = Object.values(restaurantSubscriptions)
                .filter(sub => !sub.endDate || new Date(sub.endDate) > now);
            const currentMRR = activeSubscriptions.reduce((sum, sub) => sum + sub.monthlyRate, 0);

            // Get historical revenue for trend analysis
            const historicalRevenue = await getMonthlyTrend(db, 6);

            // Calculate growth rate
            const revenues = historicalRevenue.map(m => m.revenue);
            const avgGrowthRate = calculateAverageGrowthRate(revenues);

            // Predict future months
            const predictions = [];
            let projectedMRR = currentMRR;

            for (let i = 1; i <= numMonths; i++) {
                const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
                
                // Count expiring subscriptions
                const expiringCount = activeSubscriptions.filter(sub => {
                    if (!sub.endDate) return false;
                    const endDate = new Date(sub.endDate);
                    return endDate.getMonth() === futureDate.getMonth() && 
                           endDate.getFullYear() === futureDate.getFullYear();
                }).length;

                // Apply growth rate
                projectedMRR = projectedMRR * (1 + avgGrowthRate / 100);

                // Conservative and optimistic scenarios
                const conservativeRevenue = projectedMRR * 0.85;
                const optimisticRevenue = projectedMRR * 1.15;

                predictions.push({
                    month: futureDate.toISOString().slice(0, 7),
                    projected: Math.round(projectedMRR),
                    conservative: Math.round(conservativeRevenue),
                    optimistic: Math.round(optimisticRevenue),
                    expiringSubscriptions: expiringCount,
                });
            }

            // At-risk revenue (subscriptions expiring in next 3 months)
            const threeMonthsLater = new Date(now.getFullYear(), now.getMonth() + 3, 1);
            const atRiskSubscriptions = activeSubscriptions.filter(sub => {
                if (!sub.endDate) return false;
                const endDate = new Date(sub.endDate);
                return endDate <= threeMonthsLater;
            });
            const atRiskRevenue = atRiskSubscriptions.reduce((sum, sub) => sum + sub.monthlyRate, 0);

            res.json({
                success: true,
                data: {
                    current: {
                        mrr: currentMRR,
                        arr: currentMRR * 12,
                        activeSubscriptions: activeSubscriptions.length,
                        avgGrowthRate,
                    },
                    atRisk: {
                        subscriptions: atRiskSubscriptions.length,
                        monthlyRevenue: atRiskRevenue,
                        annualRevenue: atRiskRevenue * 12,
                    },
                    predictions,
                    historical: historicalRevenue,
                },
            });
        } catch (error) {
            console.error('[Finance] Error getting predictions:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // ==================== BALANCE SHEET ====================

    /**
     * Get Balance Sheet
     */
    getBalanceSheet: async (req, res, db) => {
        try {
            const asOfDate = req.query.date ? new Date(req.query.date) : new Date();

            // Get bank account balances (Cash)
            const bankAccounts = await db.collection('bankAccounts')
                .find({ isActive: true })
                .toArray();
            const totalCash = bankAccounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

            // Get Accounts Receivable (unpaid invoices)
            const accountsReceivable = await db.collection('invoices')
                .aggregate([
                    { $match: { paymentStatus: { $in: ['pending', 'overdue'] } } },
                    { $group: { _id: null, total: { $sum: '$total' } } }
                ])
                .toArray();

            // Get Device Inventory value
            const deviceInventory = await db.collection('devices')
                .aggregate([
                    { $match: { status: 'available' } },
                    { $group: { _id: null, total: { $sum: '$sellingPrice' } } }
                ])
                .toArray();

            // Get Accounts Payable (unpaid expenses)
            const accountsPayable = await db.collection('expenses')
                .aggregate([
                    { $match: { paymentStatus: 'pending' } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ])
                .toArray();

            // Get Deferred Revenue (paid invoices with future service period)
            const deferredRevenue = await db.collection('invoices')
                .aggregate([
                    {
                        $match: {
                            paymentStatus: 'paid',
                            'subscription.endDate': { $gt: asOfDate }
                        }
                    },
                    {
                        $project: {
                            monthsRemaining: {
                                $ceil: {
                                    $divide: [
                                        { $subtract: ['$subscription.endDate', asOfDate] },
                                        1000 * 60 * 60 * 24 * 30
                                    ]
                                }
                            },
                            monthlyRate: '$subscription.monthlyRate'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: { $multiply: ['$monthsRemaining', '$monthlyRate'] } }
                        }
                    }
                ])
                .toArray();

            // Calculate totals
            const totalAssets = totalCash + 
                (accountsReceivable[0]?.total || 0) + 
                (deviceInventory[0]?.total || 0);

            const totalLiabilities = (accountsPayable[0]?.total || 0) + 
                (deferredRevenue[0]?.total || 0);

            const equity = totalAssets - totalLiabilities;

            res.json({
                success: true,
                data: {
                    asOfDate,

                    assets: {
                        current: {
                            cash: totalCash,
                            accountsReceivable: accountsReceivable[0]?.total || 0,
                            inventory: deviceInventory[0]?.total || 0,
                            totalCurrent: totalCash + 
                                (accountsReceivable[0]?.total || 0) + 
                                (deviceInventory[0]?.total || 0),
                        },
                        fixed: {
                            equipment: 0,
                            totalFixed: 0,
                        },
                        total: totalAssets,
                    },

                    liabilities: {
                        current: {
                            accountsPayable: accountsPayable[0]?.total || 0,
                            deferredRevenue: deferredRevenue[0]?.total || 0,
                            totalCurrent: (accountsPayable[0]?.total || 0) + 
                                (deferredRevenue[0]?.total || 0),
                        },
                        longTerm: {
                            loans: 0,
                            totalLongTerm: 0,
                        },
                        total: totalLiabilities,
                    },

                    equity: {
                        ownersCapital: 0, // Would need to be tracked separately
                        retainedEarnings: equity,
                        total: equity,
                    },

                    // Verification: Assets = Liabilities + Equity
                    totalLiabilitiesAndEquity: totalLiabilities + equity,
                },
            });
        } catch (error) {
            console.error('[Finance] Error getting balance sheet:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },
};

// ==================== HELPER FUNCTIONS ====================

async function getRevenueByPeriod(db, startDate, endDate) {
    // Get revenue from paid invoices
    const paidInvoices = await db.collection('invoices')
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
                    total: { $sum: '$total' },
                    subscriptions: {
                        $sum: {
                            $reduce: {
                                input: '$items',
                                initialValue: 0,
                                in: {
                                    $cond: [
                                        { $eq: ['$$this.type', 'subscription'] },
                                        { $add: ['$$value', '$$this.totalPrice'] },
                                        '$$value'
                                    ]
                                }
                            }
                        }
                    },
                    deviceSales: {
                        $sum: {
                            $reduce: {
                                input: '$items',
                                initialValue: 0,
                                in: {
                                    $cond: [
                                        { $eq: ['$$this.type', 'device'] },
                                        { $add: ['$$value', '$$this.totalPrice'] },
                                        '$$value'
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        ])
        .toArray();

    // Get revenue from manual income entries
    const manualIncomes = await db.collection('incomes')
        .aggregate([
            {
                $match: {
                    paymentStatus: 'received',
                    receivedDate: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' }
                }
            }
        ])
        .toArray();

    // Process manual income by category
    let manualTotal = 0;
    let manualSubscriptions = 0;
    let manualDeviceSales = 0;
    let manualServices = 0;
    let manualOther = 0;

    manualIncomes.forEach(inc => {
        manualTotal += inc.total;
        switch (inc._id) {
            case 'subscription':
                manualSubscriptions += inc.total;
                break;
            case 'device_sale':
                manualDeviceSales += inc.total;
                break;
            case 'service':
            case 'training':
            case 'setup':
                manualServices += inc.total;
                break;
            default:
                manualOther += inc.total;
        }
    });

    const invoiceResult = paidInvoices[0] || { total: 0, subscriptions: 0, deviceSales: 0 };
    const invoiceOther = invoiceResult.total - invoiceResult.subscriptions - invoiceResult.deviceSales;

    return {
        total: invoiceResult.total + manualTotal,
        breakdown: {
            subscriptions: invoiceResult.subscriptions + manualSubscriptions,
            deviceSales: invoiceResult.deviceSales + manualDeviceSales,
            services: manualServices,
            other: invoiceOther + manualOther,
        },
        sources: {
            invoices: invoiceResult.total,
            manual: manualTotal,
        }
    };
}

async function getExpensesByPeriod(db, startDate, endDate) {
    const expenses = await db.collection('expenses')
        .aggregate([
            {
                $match: {
                    expenseDate: { $gte: startDate, $lte: endDate },
                    paymentStatus: { $ne: 'cancelled' }
                }
            },
            {
                $group: {
                    _id: '$categoryName',
                    total: { $sum: '$amount' }
                }
            }
        ])
        .toArray();

    const breakdown = {};
    let total = 0;
    expenses.forEach(exp => {
        breakdown[exp._id || 'other'] = exp.total;
        total += exp.total;
    });

    return { total, breakdown };
}

async function getCashFlow(db, startDate, endDate) {
    // Cash in from invoices
    const invoiceCashIn = await db.collection('invoices')
        .aggregate([
            {
                $match: {
                    paymentStatus: 'paid',
                    paymentDate: { $gte: startDate, $lte: endDate }
                }
            },
            { $group: { _id: null, total: { $sum: '$total' } } }
        ])
        .toArray();

    // Cash in from manual income
    const manualCashIn = await db.collection('incomes')
        .aggregate([
            {
                $match: {
                    paymentStatus: 'received',
                    receivedDate: { $gte: startDate, $lte: endDate }
                }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ])
        .toArray();

    // Cash out from expenses
    const cashOut = await db.collection('expenses')
        .aggregate([
            {
                $match: {
                    paymentStatus: 'paid',
                    paymentDate: { $gte: startDate, $lte: endDate }
                }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ])
        .toArray();

    const totalCashIn = (invoiceCashIn[0]?.total || 0) + (manualCashIn[0]?.total || 0);
    const totalCashOut = cashOut[0]?.total || 0;

    return {
        cashIn: totalCashIn,
        cashOut: totalCashOut,
        netFlow: totalCashIn - totalCashOut,
        breakdown: {
            invoices: invoiceCashIn[0]?.total || 0,
            manualIncome: manualCashIn[0]?.total || 0,
        }
    };
}

async function getMonthlyTrend(db, numMonths) {
    const now = new Date();
    const results = [];

    for (let i = numMonths - 1; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const monthKey = monthStart.toISOString().slice(0, 7);

        const revenue = await getRevenueByPeriod(db, monthStart, monthEnd);
        const expenses = await getExpensesByPeriod(db, monthStart, monthEnd);

        results.push({
            month: monthKey,
            revenue: revenue.total,
            expenses: expenses.total,
            profit: revenue.total - expenses.total,
        });
    }

    return results;
}

async function getWeeklyCashFlow(db, startDate, endDate) {
    const weeks = [];
    let weekStart = new Date(startDate);

    while (weekStart < endDate) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        if (weekEnd > endDate) weekEnd.setTime(endDate.getTime());

        const cashFlow = await getCashFlow(db, weekStart, weekEnd);
        weeks.push({
            weekStart: weekStart.toISOString().slice(0, 10),
            weekEnd: weekEnd.toISOString().slice(0, 10),
            ...cashFlow,
        });

        weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() + 1);
    }

    return weeks;
}

function calculateAverageGrowthRate(revenues) {
    if (revenues.length < 2) return 0;
    
    let totalGrowth = 0;
    let count = 0;

    for (let i = 1; i < revenues.length; i++) {
        if (revenues[i - 1] > 0) {
            totalGrowth += ((revenues[i] - revenues[i - 1]) / revenues[i - 1]) * 100;
            count++;
        }
    }

    return count > 0 ? totalGrowth / count : 0;
}

module.exports = financeController;
