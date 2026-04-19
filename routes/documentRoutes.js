const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { requireAadhaar } = require('../middleware/auth');
const { db, logAction } = require('../database');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Setup Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        // Accept images and PDFs
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only images and PDF files are allowed!'), false);
        }
    }
});

// POST /api/documents/upload
router.post('/upload', requireAadhaar, upload.single('document'), (req, res) => {
    console.time('upload-total');
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded or invalid file type.' });
    }

    const { filename, originalname, mimetype, size, path: filePath } = req.file;
    console.log(`Upload started: ${originalname}, size: ${size} bytes`);

    // Generate encryption key and IV
    console.time('key-derivation');
    const encryptionKey = crypto.pbkdf2Sync(process.env.JWT_SECRET || 'super-secret-key-for-dev', req.user.id.toString(), 10000, 32, 'sha256');
    const iv = crypto.randomBytes(16);
    console.timeEnd('key-derivation');

    // Calculate hash of original file
    console.time('hash-calculation');
    const hash = crypto.createHash('sha256');
    const input = fs.createReadStream(filePath);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('end', () => {
        const fileHash = hash.digest('hex');
        console.timeEnd('hash-calculation');

        // Now encrypt using streams
        console.time('encryption');
        const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
        const encryptedPath = filePath + '.enc';
        const output = fs.createWriteStream(encryptedPath);

        const encryptStream = fs.createReadStream(filePath).pipe(cipher).pipe(output);

        encryptStream.on('finish', () => {
            console.timeEnd('encryption');
            console.time('file-rename');
            // Replace original with encrypted
            fs.rename(encryptedPath, filePath, (err) => {
                console.timeEnd('file-rename');
                if (err) {
                    fs.unlinkSync(filePath);
                    fs.unlinkSync(encryptedPath);
                    return res.status(500).json({ error: 'Error saving encrypted file.' });
                }

                console.time('db-insert');
                // Store in DB
                db.run(
                    `INSERT INTO documents (user_id, filename, original_name, mimetype, size, encryption_iv, file_hash) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [req.user.id, filename, originalname, mimetype, size, iv.toString('hex'), fileHash],
                    function(err) {
                        console.timeEnd('db-insert');
                        if (err) {
                            fs.unlinkSync(filePath);
                            return res.status(500).json({ error: 'Database error while saving document metadata.' });
                        }
                        
                        console.timeEnd('upload-total');
                        logAction(req.user.id, 'UPLOAD', `Uploaded, encrypted, and hashed document: ${originalname}`);
                        res.json({ message: 'Document uploaded, encrypted, and secured successfully', documentId: this.lastID });
                    }
                );
            });
        });

        encryptStream.on('error', (err) => {
            console.error('Encryption error:', err);
            fs.unlinkSync(filePath);
            res.status(500).json({ error: 'Encryption failed.' });
        });
    });

    input.on('error', (err) => {
        console.error('Hash calculation error:', err);
        fs.unlinkSync(filePath);
        res.status(500).json({ error: 'Error reading uploaded file.' });
    });
});

// GET /api/documents
router.get('/', requireAadhaar, (req, res) => {
    const query = `
        SELECT d.id, d.filename, d.original_name, d.mimetype, d.size, d.uploaded_at, GROUP_CONCAT(s.shared_with_email) as shared_with
        FROM documents d
        LEFT JOIN shares s ON d.id = s.document_id
        WHERE d.user_id = ?
        GROUP BY d.id
        ORDER BY d.uploaded_at DESC
    `;
    db.all(query, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error fetching documents' });
        
        // Convert the string of comma-separated emails to an array
        const documents = rows.map(row => ({
            ...row,
            shared_with: row.shared_with ? row.shared_with.split(',') : []
        }));
        
        res.json({ documents });
    });
});

// GET /api/documents/:id/download
router.get('/:id/download', requireAadhaar, (req, res) => {
    const docId = req.params.id;

    // Verify ownership or share access
    db.get(`SELECT * FROM documents WHERE id = ?`, [docId], (err, doc) => {
        if (err || !doc) return res.status(404).json({ error: 'Document not found' });

        const serveFile = () => {
            const filePath = path.join(uploadDir, doc.filename);
            if (fs.existsSync(filePath)) {
                // Derive key
                const encryptionKey = crypto.pbkdf2Sync(process.env.JWT_SECRET || 'super-secret-key-for-dev', doc.user_id.toString(), 10000, 32, 'sha256');
                const iv = Buffer.from(doc.encryption_iv, 'hex');

                // Decrypt using streams
                const decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKey, iv);
                const hash = crypto.createHash('sha256');

                res.setHeader('Content-Type', doc.mimetype);
                res.setHeader('Content-Disposition', `attachment; filename="${doc.original_name}"`);

                const stream = fs.createReadStream(filePath).pipe(decipher);

                stream.on('data', (chunk) => {
                    hash.update(chunk);
                    res.write(chunk);
                });

                stream.on('end', () => {
                    const decryptedHash = hash.digest('hex');
                    if (decryptedHash !== doc.file_hash) {
                        res.end(); // Already sent some data, but integrity failed - in production, better to buffer
                        console.error('Integrity check failed for document:', doc.id);
                        return;
                    }
                    logAction(req.user.id, 'DOWNLOAD', `Downloaded and decrypted document: ${doc.original_name}`);
                    res.end();
                });

                stream.on('error', (err) => {
                    res.status(500).json({ error: 'Decryption failed.' });
                });
            } else {
                res.status(404).json({ error: 'File missing on server' });
            }
        };

        if (doc.user_id === req.user.id) {
            serveFile();
        } else {
            // Check if it's shared with the user
            db.get(`SELECT * FROM shares WHERE document_id = ? AND shared_with_email = ?`, [docId, req.user.email], (err, share) => {
                if (err || !share) return res.status(403).json({ error: 'Access denied' });
                serveFile();
            });
        }
    });
});

// DELETE /api/documents/:id
router.delete('/:id', requireAadhaar, (req, res) => {
    const docId = req.params.id;

    db.get(`SELECT * FROM documents WHERE id = ? AND user_id = ?`, [docId, req.user.id], (err, doc) => {
        if (err || !doc) return res.status(404).json({ error: 'Document not found or unauthorized' });

        // Delete from DB first
        db.run(`DELETE FROM documents WHERE id = ?`, [docId], (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });

            // Delete associated shares
            db.run(`DELETE FROM shares WHERE document_id = ?`, [docId]);

            // Delete file from disk
            const filePath = path.join(uploadDir, doc.filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

            logAction(req.user.id, 'DELETE', `Deleted document: ${doc.original_name}`);
            res.json({ message: 'Document deleted successfully' });
        });
    });
});

module.exports = router;
