/**
 * Finance Seed Data
 * 
 * Seeds expense categories and default bank accounts.
 * Safe to run multiple times (uses upsert).
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const expenseCategories = [
    {
        code: 'SALARY',
        name: 'ເງິນເດືອນ',
        nameEnglish: 'Salaries & Wages',
        description: 'Employee salaries, bonuses, and benefits',
        icon: '👥',
        color: '#3B82F6',
        type: 'operating',
        plCategory: 'operating_expense',
        monthlyBudget: 50000000,
        isActive: true,
        sortOrder: 1
    },
    {
        code: 'INFRA',
        name: 'ໂຄງສ້າງພື້ນຖານ',
        nameEnglish: 'Infrastructure',
        description: 'Server hosting, cloud services, domains',
        icon: '🖥️',
        color: '#8B5CF6',
        type: 'operating',
        plCategory: 'operating_expense',
        monthlyBudget: 10000000,
        isActive: true,
        sortOrder: 2
    },
    {
        code: 'SOFTWARE',
        name: 'ຊອບແວ',
        nameEnglish: 'Software & Tools',
        description: 'Software licenses, subscriptions, tools',
        icon: '💻',
        color: '#06B6D4',
        type: 'operating',
        plCategory: 'operating_expense',
        monthlyBudget: 5000000,
        isActive: true,
        sortOrder: 3
    },
    {
        code: 'MARKETING',
        name: 'ການຕະຫຼາດ',
        nameEnglish: 'Marketing & Advertising',
        description: 'Advertising, promotions, marketing campaigns',
        icon: '📢',
        color: '#F59E0B',
        type: 'operating',
        plCategory: 'operating_expense',
        monthlyBudget: 15000000,
        isActive: true,
        sortOrder: 4
    },
    {
        code: 'OFFICE',
        name: 'ຄ່າຫ້ອງການ',
        nameEnglish: 'Office & Rent',
        description: 'Office rent, utilities, maintenance',
        icon: '🏢',
        color: '#10B981',
        type: 'operating',
        plCategory: 'operating_expense',
        monthlyBudget: 8000000,
        isActive: true,
        sortOrder: 5
    },
    {
        code: 'TRAVEL',
        name: 'ການເດີນທາງ',
        nameEnglish: 'Travel & Transportation',
        description: 'Business travel, transportation, fuel',
        icon: '✈️',
        color: '#EC4899',
        type: 'operating',
        plCategory: 'operating_expense',
        monthlyBudget: 5000000,
        isActive: true,
        sortOrder: 6
    },
    {
        code: 'DEVICE_COST',
        name: 'ຕົ້ນທຶນອຸປະກອນ',
        nameEnglish: 'Device Costs',
        description: 'Cost of devices purchased for resale',
        icon: '📱',
        color: '#EF4444',
        type: 'operating',
        plCategory: 'cost_of_goods',
        monthlyBudget: 20000000,
        isActive: true,
        sortOrder: 7
    },
    {
        code: 'PROFESSIONAL',
        name: 'ບໍລິການວິຊາຊີບ',
        nameEnglish: 'Professional Services',
        description: 'Legal, accounting, consulting fees',
        icon: '⚖️',
        color: '#6366F1',
        type: 'operating',
        plCategory: 'operating_expense',
        monthlyBudget: 3000000,
        isActive: true,
        sortOrder: 8
    },
    {
        code: 'SUPPLIES',
        name: 'ອຸປະກອນສຳນັກງານ',
        nameEnglish: 'Office Supplies',
        description: 'Stationery, equipment, small purchases',
        icon: '📦',
        color: '#78716C',
        type: 'operating',
        plCategory: 'operating_expense',
        monthlyBudget: 2000000,
        isActive: true,
        sortOrder: 9
    },
    {
        code: 'INSURANCE',
        name: 'ປະກັນໄພ',
        nameEnglish: 'Insurance',
        description: 'Business insurance, health insurance',
        icon: '🛡️',
        color: '#0EA5E9',
        type: 'operating',
        plCategory: 'operating_expense',
        monthlyBudget: 2000000,
        isActive: true,
        sortOrder: 10
    },
    {
        code: 'TAX',
        name: 'ພາສີ',
        nameEnglish: 'Taxes & Fees',
        description: 'Business taxes, government fees',
        icon: '🏛️',
        color: '#DC2626',
        type: 'operating',
        plCategory: 'other_expense',
        monthlyBudget: 5000000,
        isActive: true,
        sortOrder: 11
    },
    {
        code: 'OTHER',
        name: 'ອື່ນໆ',
        nameEnglish: 'Other Expenses',
        description: 'Miscellaneous expenses',
        icon: '📋',
        color: '#94A3B8',
        type: 'operating',
        plCategory: 'other_expense',
        monthlyBudget: 3000000,
        isActive: true,
        sortOrder: 99
    }
];

const defaultBankAccounts = [
    {
        name: 'BCEL Main Account',
        accountNumber: '0000000001',
        bankName: 'Banque Pour Le Commerce Exterieur Lao',
        bankCode: 'BCEL',
        accountType: 'checking',
        currency: 'LAK',
        currentBalance: 0,
        openingBalance: 0,
        openingDate: new Date(),
        isActive: true,
        isPrimary: true,
        color: '#1E40AF',
        icon: '🏦'
    },
    {
        name: 'Petty Cash',
        accountNumber: 'CASH-001',
        bankName: 'Cash',
        bankCode: 'CASH',
        accountType: 'cash',
        currency: 'LAK',
        currentBalance: 0,
        openingBalance: 0,
        openingDate: new Date(),
        isActive: true,
        isPrimary: false,
        color: '#059669',
        icon: '💵'
    }
];

async function seedFinanceData() {
    let client;
    
    try {
        console.log('Connecting to database...');
        client = await MongoClient.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        const db = client.db('AppZap');
        console.log('Connected to AppZap database');

        // Seed expense categories
        console.log('\nSeeding expense categories...');
        const categoryCollection = db.collection('expenseCategories');
        
        for (const category of expenseCategories) {
            await categoryCollection.updateOne(
                { code: category.code },
                { 
                    $set: { ...category, updatedAt: new Date() },
                    $setOnInsert: { createdAt: new Date() }
                },
                { upsert: true }
            );
            console.log(`  ✓ ${category.code}: ${category.nameEnglish}`);
        }

        // Create indexes for expense categories
        await categoryCollection.createIndex({ code: 1 }, { unique: true });
        await categoryCollection.createIndex({ isActive: 1 });
        await categoryCollection.createIndex({ sortOrder: 1 });
        console.log('  ✓ Indexes created for expenseCategories');

        // Seed default bank accounts (only if none exist)
        console.log('\nSeeding bank accounts...');
        const bankCollection = db.collection('bankAccounts');
        const existingAccounts = await bankCollection.countDocuments();

        if (existingAccounts === 0) {
            for (const account of defaultBankAccounts) {
                await bankCollection.updateOne(
                    { accountNumber: account.accountNumber },
                    { 
                        $set: { ...account, updatedAt: new Date(), lastUpdated: new Date() },
                        $setOnInsert: { createdAt: new Date() }
                    },
                    { upsert: true }
                );
                console.log(`  ✓ ${account.name}`);
            }
        } else {
            console.log(`  ⏭ Skipped - ${existingAccounts} accounts already exist`);
        }

        // Create indexes for bank accounts
        await bankCollection.createIndex({ accountNumber: 1 }, { unique: true });
        await bankCollection.createIndex({ isActive: 1 });
        console.log('  ✓ Indexes created for bankAccounts');

        // Create indexes for other finance collections
        console.log('\nCreating indexes for finance collections...');
        
        // Expenses
        const expenseCollection = db.collection('expenses');
        await expenseCollection.createIndex({ expenseDate: -1 });
        await expenseCollection.createIndex({ categoryId: 1 });
        await expenseCollection.createIndex({ paymentStatus: 1 });
        await expenseCollection.createIndex({ createdAt: -1 });
        console.log('  ✓ Indexes created for expenses');

        // Financial Transactions
        const transactionCollection = db.collection('financialTransactions');
        await transactionCollection.createIndex({ transactionDate: -1 });
        await transactionCollection.createIndex({ type: 1 });
        await transactionCollection.createIndex({ sourceType: 1, sourceId: 1 });
        await transactionCollection.createIndex({ category: 1 });
        console.log('  ✓ Indexes created for financialTransactions');

        // Budgets
        const budgetCollection = db.collection('budgets');
        await budgetCollection.createIndex({ year: 1, month: 1 }, { unique: true });
        await budgetCollection.createIndex({ status: 1 });
        console.log('  ✓ Indexes created for budgets');

        // Financial Periods
        const periodCollection = db.collection('financialPeriods');
        await periodCollection.createIndex({ periodKey: 1 }, { unique: true });
        await periodCollection.createIndex({ year: 1, month: 1 });
        await periodCollection.createIndex({ status: 1 });
        console.log('  ✓ Indexes created for financialPeriods');

        console.log('\n✅ Finance seed completed successfully!');
        console.log(`   - ${expenseCategories.length} expense categories`);
        console.log(`   - ${existingAccounts === 0 ? defaultBankAccounts.length : 0} bank accounts created`);

    } catch (error) {
        console.error('Error seeding finance data:', error);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
            console.log('\nDatabase connection closed');
        }
    }
}

// Run if called directly
if (require.main === module) {
    seedFinanceData();
}

module.exports = { seedFinanceData, expenseCategories, defaultBankAccounts };
