require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const { initializeDB } = require('./database');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Attach io to app so routes can access it
app.set('io', io);

io.on('connection', (socket) => {
    socket.on('join', (email) => {
        socket.join(email);
    });
});

const PORT = process.env.PORT || 3000;

// General Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Initialize Database
initializeDB();

// Global Rate Limiting - Disabled for Trae Preview Stability
// Re-enable for production deployment
/*
const globalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 1000, 
    message: { error: 'Too many requests' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(globalLimiter);
*/

// Enterprise Security Middleware - Disabled for Trae Preview Stability
// Re-enable for production deployment
/*
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    frameguard: false
}));
*/

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));
app.use('/api/shares', require('./routes/shareRoutes'));
app.use('/api/logs', require('./routes/logRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Global Error Handler
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ error: 'Something went wrong on our end.' });
});

// Fallback to index.html for unknown routes (SPA-like behavior if needed)
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
    server.listen(PORT, '0.0.0.0', () => {
        logger.info(`[GovSecure] Engine operational on port ${PORT}`);
        logger.info(`[GovSecure] Local Access: http://localhost:${PORT}`);
    });
}

module.exports = app;
