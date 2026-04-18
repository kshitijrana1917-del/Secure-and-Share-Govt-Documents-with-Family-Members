const express = require('express');
const router = express.Router();
const { requireAadhaar } = require('../middleware/auth');
const { db } = require('../database');

// GET /api/logs
router.get('/', requireAadhaar, (req, res) => {
    db.all(`SELECT action, details, timestamp FROM audit_logs WHERE user_id = ? ORDER BY timestamp DESC`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error fetching logs' });
        res.json({ logs: rows });
    });
});

module.exports = router;
