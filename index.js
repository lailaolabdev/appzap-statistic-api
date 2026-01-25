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

    // Rate limiting middleware
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // Limit each IP to 100 requests per windowMs
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
