const express = require('express');
const router = express.Router();
const { requireAadhaar } = require('../middleware/auth');
const { db, logAction } = require('../database');
const { z } = require('zod');
const logger = require('../utils/logger');

// Validation Schema
const shareSchema = z.object({
    documentId: z.coerce.number(),
    shareWithEmail: z.string().email(),
    expiresInDays: z.coerce.number().min(1).max(365).optional()
});

// POST /api/shares - Share a document with another user
router.post('/', requireAadhaar, (req, res) => {
    try {
        const validatedData = shareSchema.parse(req.body);
        const { documentId, shareWithEmail, expiresInDays } = validatedData;
        const sharedByUserId = req.user.id;

        // Verify document ownership
        db.get(`SELECT * FROM documents WHERE id = ? AND user_id = ?`, [documentId, sharedByUserId], (err, doc) => {
            if (err || !doc) {
                return res.status(404).json({ error: 'Document not found or unauthorized' });
            }

            let expiresAt = null;
            if (expiresInDays) {
                const date = new Date();
                date.setDate(date.getDate() + expiresInDays);
                expiresAt = date.toISOString();
            }

            const query = `
                INSERT INTO shares (document_id, shared_by_user_id, shared_with_email, expires_at)
                VALUES (?, ?, ?, ?)
            `;

            db.run(query, [documentId, sharedByUserId, shareWithEmail, expiresAt], function(err) {
                if (err) {
                    logger.error('Share Insert Error:', err);
                    return res.status(500).json({ error: 'Error sharing document' });
                }

                logAction(sharedByUserId, 'SHARE', `Shared document "${doc.original_name}" with ${shareWithEmail}. Expires: ${expiresAt || 'Never'}`);
                
                // Real-time Notification
                const io = req.app.get('io');
                if (io) {
                    io.to(shareWithEmail).emit('document_shared', {
                        sharedBy: req.user.name,
                        documentName: doc.original_name
                    });
                }

                res.json({ message: 'Document shared successfully', shareId: this.lastID });
            });
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: err.issues && err.issues.length > 0 ? err.issues[0].message : 'Validation error' });
        }
        logger.error('Share Process Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/shares - Get documents shared with the user
router.get('/', requireAadhaar, (req, res) => {
    const query = `
        SELECT s.id as share_id, s.shared_at, s.expires_at, d.id as document_id, d.original_name, d.mimetype, d.size, d.category, u.name as shared_by_name, u.email as shared_by_email
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
