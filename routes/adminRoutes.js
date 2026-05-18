const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { db } = require('../database');

// GET /api/admin/stats
router.get('/stats', requireAdmin, (req, res) => {
    const stats = {};
    
    db.serialize(() => {
        db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            stats.totalUsers = row.count;
            
            db.get('SELECT COUNT(*) as count FROM documents', (err, row) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                stats.totalDocuments = row.count;
                
                db.get('SELECT COUNT(*) as count FROM shares', (err, row) => {
                    if (err) return res.status(500).json({ error: 'Database error' });
                    stats.totalShares = row.count;
                    
                    db.get('SELECT SUM(size) as totalSize FROM documents', (err, row) => {
                        if (err) return res.status(500).json({ error: 'Database error' });
                        stats.totalStorage = row.totalSize || 0;
                        res.json(stats);
                    });
                });
            });
        });
    });
});

// GET /api/admin/logs
router.get('/logs', requireAdmin, (req, res) => {
    const query = `
        SELECT a.id, a.action, a.details, a.timestamp, u.name as user_name, u.email as user_email 
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.timestamp DESC
        LIMIT 100
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error fetching logs' });
        res.json({ logs: rows });
    });
});

module.exports = router;
