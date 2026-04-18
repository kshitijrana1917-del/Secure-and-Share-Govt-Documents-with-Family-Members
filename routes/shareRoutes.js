const express = require('express');
const router = express.Router();
const { requireAadhaar } = require('../middleware/auth');
const { db, logAction } = require('../database');

// POST /api/shares
router.post('/', requireAadhaar, (req, res) => {
    const { documentId, shareWithEmail } = req.body;

    if (!documentId || !shareWithEmail) {
        return res.status(400).json({ error: 'Document ID and email are required.' });
    }

    if (shareWithEmail === req.user.email) {
        return res.status(400).json({ error: 'Cannot share with yourself.' });
    }

    // Check if user owns the document
    db.get(`SELECT * FROM documents WHERE id = ? AND user_id = ?`, [documentId, req.user.id], (err, doc) => {
        if (err || !doc) return res.status(404).json({ error: 'Document not found or unauthorized.' });

        // Prevent duplicate sharing
        db.get(`SELECT * FROM shares WHERE document_id = ? AND shared_with_email = ?`, [documentId, shareWithEmail], (err, existing) => {
            if (existing) return res.status(400).json({ error: 'Document already shared with this email.' });

            db.run(
                `INSERT INTO shares (document_id, shared_by_user_id, shared_with_email) VALUES (?, ?, ?)`,
                [documentId, req.user.id, shareWithEmail],
                function(err) {
                    if (err) return res.status(500).json({ error: 'Database error while sharing document.' });
                    
                    logAction(req.user.id, 'SHARE', `Shared document '${doc.original_name}' with ${shareWithEmail}`);
                    res.json({ message: 'Document shared successfully.' });
                }
            );
        });
    });
});

// GET /api/shares - Get documents shared with the user
router.get('/', requireAadhaar, (req, res) => {
    const query = `
        SELECT s.id as share_id, s.shared_at, d.id as document_id, d.original_name, d.mimetype, d.size, u.name as shared_by_name, u.email as shared_by_email
        FROM shares s
        JOIN documents d ON s.document_id = d.id
        JOIN users u ON s.shared_by_user_id = u.id
        WHERE s.shared_with_email = ?
        ORDER BY s.shared_at DESC
    `;

    db.all(query, [req.user.email], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error fetching shared documents.' });
        res.json({ sharedDocuments: rows });
    });
});

module.exports = router;
