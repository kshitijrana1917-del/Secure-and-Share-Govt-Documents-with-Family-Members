require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDB } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Database
initializeDB();

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));
app.use('/api/shares', require('./routes/shareRoutes'));
app.use('/api/logs', require('./routes/logRoutes'));

// Fallback to index.html for unknown routes (SPA-like behavior if needed)
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GovSecure] Engine operational on port ${PORT}`);
    console.log(`[GovSecure] Local Access: http://localhost:${PORT}`);
});
