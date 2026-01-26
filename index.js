// index.js

require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
let db;

// Connect to MongoDB
MongoClient.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(client => {
    // db = client.db('DataBackup'); // specify your DB name
    db = client.db('AppZap'); // specify your DB name
    console.log("MongoDB connected");

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
        res.send = function(data) {
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

    // Error handling middleware
    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).json({ error: 'Something went wrong!' });
    });

    // Start the server
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
})
.catch(err => console.error("MongoDB connection error:", err));
