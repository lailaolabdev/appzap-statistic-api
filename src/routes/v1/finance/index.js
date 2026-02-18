/**
 * Finance Routes
 * 
 * All finance-related API endpoints.
 */

const express = require('express');
const router = express.Router();

const financeController = require('../../../controllers/financeController');
const expenseController = require('../../../controllers/expenseController');
const budgetController = require('../../../controllers/budgetController');
const incomeController = require('../../../controllers/incomeController');

module.exports = (db) => {
    // ==================== FINANCE DASHBOARD ====================
    
    // Get financial dashboard overview
    router.get('/dashboard', (req, res) => financeController.getDashboard(req, res, db));
    
    // Get Profit & Loss statement
    router.get('/profit-loss', (req, res) => financeController.getProfitLoss(req, res, db));
    
    // Get Cash Flow statement
    router.get('/cash-flow', (req, res) => financeController.getCashFlow(req, res, db));
    
    // Get revenue predictions
    router.get('/predictions', (req, res) => financeController.getRevenuePredictions(req, res, db));
    
    // Get Balance Sheet
    router.get('/balance-sheet', (req, res) => financeController.getBalanceSheet(req, res, db));

    // ==================== EXPENSES ====================
    
    // Get all expenses
    router.get('/expenses', (req, res) => expenseController.getExpenses(req, res, db));
    
    // Get expense by ID
    router.get('/expenses/:id', (req, res) => expenseController.getExpenseById(req, res, db));
    
    // Create expense
    router.post('/expenses', (req, res) => expenseController.createExpense(req, res, db));
    
    // Update expense
    router.put('/expenses/:id', (req, res) => expenseController.updateExpense(req, res, db));
    
    // Delete expense
    router.delete('/expenses/:id', (req, res) => expenseController.deleteExpense(req, res, db));
    
    // Mark expense as paid
    router.put('/expenses/:id/pay', (req, res) => expenseController.markAsPaid(req, res, db));
    
    // Get expense summary by category
    router.get('/expenses-summary', (req, res) => expenseController.getSummaryByCategory(req, res, db));

    // ==================== EXPENSE CATEGORIES ====================
    
    // Get all expense categories
    router.get('/expense-categories', (req, res) => expenseController.getCategories(req, res, db));
    
    // Create expense category
    router.post('/expense-categories', (req, res) => expenseController.createCategory(req, res, db));
    
    // Update expense category
    router.put('/expense-categories/:id', (req, res) => expenseController.updateCategory(req, res, db));
    
    // Delete expense category
    router.delete('/expense-categories/:id', (req, res) => expenseController.deleteCategory(req, res, db));

    // ==================== BANK ACCOUNTS ====================
    
    // Get all bank accounts
    router.get('/bank-accounts', (req, res) => expenseController.getBankAccounts(req, res, db));
    
    // Create bank account
    router.post('/bank-accounts', (req, res) => expenseController.createBankAccount(req, res, db));
    
    // Update bank account
    router.put('/bank-accounts/:id', (req, res) => expenseController.updateBankAccount(req, res, db));
    
    // Delete bank account
    router.delete('/bank-accounts/:id', (req, res) => expenseController.deleteBankAccount(req, res, db));
    
    // Adjust bank account balance
    router.put('/bank-accounts/:id/adjust', (req, res) => expenseController.adjustBalance(req, res, db));

    // ==================== BUDGETS ====================
    
    // Get all budgets
    router.get('/budgets', (req, res) => budgetController.getBudgets(req, res, db));
    
    // Get budget for specific period
    router.get('/budgets/:year', (req, res) => budgetController.getBudget(req, res, db));
    router.get('/budgets/:year/:month', (req, res) => budgetController.getBudget(req, res, db));
    
    // Save budget
    router.post('/budgets', (req, res) => budgetController.saveBudget(req, res, db));
    
    // Approve budget
    router.put('/budgets/:year/approve', (req, res) => budgetController.approveBudget(req, res, db));
    router.put('/budgets/:year/:month/approve', (req, res) => budgetController.approveBudget(req, res, db));
    
    // Get budget comparison
    router.get('/budgets/:year/comparison', (req, res) => budgetController.getBudgetComparison(req, res, db));

    // ==================== INCOMES (Manual Revenue) ====================
    
    // Get income categories
    router.get('/income-categories', (req, res) => incomeController.getCategories(req, res, db));
    
    // Get all incomes
    router.get('/incomes', (req, res) => incomeController.getIncomes(req, res, db));
    
    // Get income by ID
    router.get('/incomes/:id', (req, res) => incomeController.getIncomeById(req, res, db));
    
    // Create income
    router.post('/incomes', (req, res) => incomeController.createIncome(req, res, db));
    
    // Update income
    router.put('/incomes/:id', (req, res) => incomeController.updateIncome(req, res, db));
    
    // Delete income
    router.delete('/incomes/:id', (req, res) => incomeController.deleteIncome(req, res, db));
    
    // Mark income as received
    router.put('/incomes/:id/receive', (req, res) => incomeController.markAsReceived(req, res, db));
    
    // Get income summary by category
    router.get('/incomes-summary', (req, res) => incomeController.getSummaryByCategory(req, res, db));

    return router;
};
