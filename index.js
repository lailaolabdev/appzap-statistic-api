// index.js

require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Job queue imports
const { initializeQueues, closeQueues, getAnalysisQueue, getAnalyticsBuilderQueue } = require('./src/utils/jobQueue');
const { initializeAnalysisWorker } = require('./src/workers/analysisWorker');
const { initializeAnalyticsBuilderWorker } = require('./src/workers/analyticsBuilderWorker');

// Multi-database connection for subscription management
const { connectAllDatabases, closeAllConnections } = require('./src/utils/multiDbConnection');

const app = express();
const PORT = process.env.PORT || 3000;
let db;

// Connect to MongoDB
MongoClient.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(async client => {
        // db = client.db('DataBackup'); // specify your DB name
        db = client.db('AppZap'); // specify your DB name
        console.log("MongoDB connected");

        // Connect to additional databases (POS v1, v2) for subscription management
        try {
            await connectAllDatabases();
            console.log("Multi-database connections established");
        } catch (error) {
            console.error("Warning: Multi-database connection failed:", error.message);
            console.error("Subscription management features may not work properly.");
        }

        // Initialize job queues (Redis/Bull)
        try {
            initializeQueues();
            const analysisQueue = getAnalysisQueue();
            initializeAnalysisWorker(analysisQueue, db);
            initializeAnalyticsBuilderWorker(db);
            console.log("Job queues initialized");
        } catch (error) {
            console.error("Warning: Job queue initialization failed:", error.message);
            console.error("Background jobs will not be available. Make sure Redis is running.");
        }

        // Middleware
        app.use(cors()); // Enable CORS
        app.use(helmet()); // Set various HTTP headers for security
        app.use(express.json()); // Parse JSON request bodies

        // Request logging middleware
        app.use((req, res, next) => {
            const start = Date.now();
            console.log(`\n[${new Date().toISOString()}] --> ${req.method} ${req.url}`);
            if (req.method === 'POST' || req.method === 'PUT') {
                console.log('Body:', JSON.stringify(req.body, null, 2).substring(0, 500));
            }

            // Log response
            const originalSend = res.send;
            res.send = function (data) {
                const duration = Date.now() - start;
                console.log(`[${new Date().toISOString()}] <-- ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`);
                return originalSend.call(this, data);
            };

            next();
        });

        // Rate limiting middleware
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 1000 // Increased limit for bulk operations
        });
        app.use(limiter);

        // Routes
        const statisticsRouter = require('./src/routes/v1/statistics')(db); // Pass db to routes
        app.use('/api/v1/statistics', statisticsRouter);

        const restaurantsRouter = require('./src/routes/v1/restaurants')(db); // Pass db to routes
        app.use('/api/v1/restaurants', restaurantsRouter);

        const menusRouter = require('./src/routes/v1/menus')(db); // Pass db to routes
        app.use('/api/v1/menus', menusRouter);

        // Master Data Routes (Ingredients Analytics System)
        const masterRouter = require('./src/routes/v1/master')(db);
        app.use('/api/v1/master', masterRouter);

        // Subscription Management Routes (Invoices, Devices, WhatsApp)
        const subscriptionRouter = require('./src/routes/v1/subscription')(db);
        app.use('/api/v1/subscription', subscriptionRouter);

        // Finance Routes (P&L, Cash Flow, Expenses, Budgets)
        const financeRouter = require('./src/routes/v1/finance')(db);
        app.use('/api/v1/finance', financeRouter);

        // Error handling middleware
        app.use((err, req, res, next) => {
            console.error(err.stack);
            res.status(500).json({ error: 'Something went wrong!' });
        });

        // Start the server
        const server = app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });

        // Graceful shutdown
        const gracefulShutdown = async (signal) => {
            console.log(`\n${signal} received. Shutting down gracefully...`);

            server.close(async () => {
                console.log('HTTP server closed');

                try {
                    await closeQueues();
                    console.log('Job queues closed');
                } catch (error) {
                    console.error('Error closing queues:', error);
                }

                try {
                    await client.close();
                    console.log('MongoDB connection closed');
                } catch (error) {
                    console.error('Error closing MongoDB:', error);
                }

                try {
                    await closeAllConnections();
                    console.log('Multi-database connections closed');
                } catch (error) {
                    console.error('Error closing multi-database connections:', error);
                }

                process.exit(0);
            });

            // Force close after 10 seconds
            setTimeout(() => {
                console.error('Could not close connections in time, forcefully shutting down');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    })
    .catch(err => console.error("MongoDB connection error:", err));

