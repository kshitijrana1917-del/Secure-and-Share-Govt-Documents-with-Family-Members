const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { PDFDocument, rgb, degrees, StandardFonts } = require('pdf-lib');
const { requireAadhaar } = require('../middleware/auth');
const { db, logAction } = require('../database');
const StorageService = require('../utils/storageService');
const Tesseract = require('tesseract.js');
const logger = require('../utils/logger');
const { z } = require('zod');

// AES-256-GCM Encryption Key Derivation (32 bytes)
const ENCRYPTION_KEY = crypto.scryptSync(process.env.JWT_SECRET || 'super-secret-key-for-dev', 'salt', 32);

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

// Validation Schemas
const shareSchema = z.object({
    documentId: z.number(),
    shareWithEmail: z.string().email(),
    expiresInDays: z.number().min(1).max(365).optional()
});

// GET /api/documents/:id/history
router.get('/:id/history', requireAadhaar, (req, res) => {
    const docId = req.params.id;
    // For now, versioning is represented by audit logs of that document
    const query = `
        SELECT action, details, timestamp 
        FROM audit_logs 
        WHERE details LIKE ? AND user_id = ?
        ORDER BY timestamp DESC
    `;
    db.all(query, [`%${docId}%`, req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error fetching history' });
        res.json({ history: rows });
    });
});

// Helper for OCR
async function performOCR(filePath) {
    try {
        const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
        return text;
    } catch (err) {
        logger.error('OCR Error:', err);
        return null;
    }
}

// POST /api/documents/upload
router.post('/upload', requireAadhaar, upload.single('document'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded or invalid file type.' });
    }

    const { filename, originalname, mimetype, size, path: filePath } = req.file;
    const category = req.body.category || 'Uncategorized';

    try {
        // Perform OCR on images for auto-tagging/metadata
        let ocrText = '';
        if (mimetype.startsWith('image/')) {
            ocrText = await performOCR(filePath);
        }

        // Automatic Categorization based on OCR text
        if (ocrText && category === 'Uncategorized') {
            const textLower = ocrText.toLowerCase();
            if (textLower.includes('income tax') || textLower.includes('pan card')) category = 'Tax';
            else if (textLower.includes('aadhaar') || textLower.includes('identity')) category = 'Identity';
            else if (textLower.includes('invoice') || textLower.includes('bill')) category = 'Financial';
        }

        // Compute SHA-256 before encryption
        const fileBuffer = fs.readFileSync(filePath);
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Setup Encryption
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
        
        const encryptedPath = filePath + '.enc';
        const input = fs.createReadStream(filePath);
        const output = fs.createWriteStream(encryptedPath);

        input.on('error', (err) => {
            logger.error('File Read Error during Encryption:', err);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            if (fs.existsSync(encryptedPath)) fs.unlinkSync(encryptedPath);
            if (!res.headersSent) res.status(500).json({ error: 'Read failed during encryption.' });
        });

        output.on('error', (err) => {
            logger.error('Encryption Stream Error:', err);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            if (fs.existsSync(encryptedPath)) fs.unlinkSync(encryptedPath);
            if (!res.headersSent) res.status(500).json({ error: 'Encryption failed.' });
        });

        output.on('finish', async () => {
            const authTag = cipher.getAuthTag().toString('hex');
            
            try {
                // Delete the original unencrypted file before moving the encrypted one into its place
                // This is required on Windows as fs.rename fails if the destination exists.
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                
                await StorageService.saveFile(encryptedPath, filename);
                
                db.run(
                    `INSERT INTO documents (user_id, filename, original_name, mimetype, size, category, encryption_iv, auth_tag, file_hash, ocr_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [req.user.id, filename, originalname, mimetype, size, category, iv.toString('hex'), authTag, fileHash, ocrText],
                    function(err) {
                        if (err) {
                            logger.error('DB Insert Error:', err);
                            StorageService.deleteFile(filename).catch(logger.error); // rollback
                            return res.status(500).json({ error: 'Database error while saving document metadata.' });
                        }
                        
                        logAction(req.user.id, 'UPLOAD', `Uploaded and encrypted document: ${originalname} (ID: ${this.lastID}) in category: ${category}`);
                        res.json({ message: 'Document uploaded successfully', documentId: this.lastID, file_hash: fileHash });
                    }
                );
            } catch (err) {
                logger.error("Storage Error during Upload:", err);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                if (fs.existsSync(encryptedPath)) fs.unlinkSync(encryptedPath);
                if (!res.headersSent) res.status(500).json({ error: 'Error saving encrypted file to storage.' });
            }
        });

        input.pipe(cipher).pipe(output);
    } catch (err) {
        logger.error('Upload Process Error:', err);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (!res.headersSent) res.status(500).json({ error: 'An internal error occurred during upload.' });
    }
});

// GET /api/documents
router.get('/', requireAadhaar, (req, res) => {
    const query = `
        SELECT d.id, d.filename, d.original_name, d.mimetype, d.size, d.category, d.uploaded_at, GROUP_CONCAT(s.shared_with_email) as shared_with
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

        const serveEncryptedFile = async () => {
            try {
                const readStream = await StorageService.getFileStream(doc.filename);

                logAction(req.user.id, 'DOWNLOAD', `Downloaded document: ${doc.original_name}`);
                
                res.setHeader('Content-Disposition', `attachment; filename="${doc.original_name}"`);
                res.setHeader('Content-Type', doc.mimetype);

                if (doc.encryption_iv && doc.auth_tag) {
                    const iv = Buffer.from(doc.encryption_iv, 'hex');
                    const authTag = Buffer.from(doc.auth_tag, 'hex');
                    
                    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
                    decipher.setAuthTag(authTag);
                    
                    readStream.on('error', (streamErr) => {
                        logger.error('File Read Error during Download:', streamErr);
                        if (!res.headersSent) res.status(500).json({ error: 'Error reading file from storage.' });
                    });
                    
                    decipher.on('error', (decErr) => {
                        logger.error('Decryption Error during Download:', decErr);
                        if (!res.headersSent) res.status(500).json({ error: 'Decryption failed. The file might be corrupted.' });
                    });

                    if (doc.mimetype === 'application/pdf') {
                    const chunks = [];
                    decipher.on('data', chunk => chunks.push(chunk));
                    decipher.on('end', async () => {
                        const decryptedBuffer = Buffer.concat(chunks);
                        try {
                            const pdfDoc = await PDFDocument.load(decryptedBuffer);
                            const pages = pdfDoc.getPages();
                            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                            
                            const watermarkText = `GovSecure Vault\nDownloaded by: ${req.user.email}\nDate: ${new Date().toLocaleString()}`;
                            
                            pages.forEach(page => {
                                const { width, height } = page.getSize();
                                page.drawText(watermarkText, {
                                    x: width / 4 - 50,
                                    y: height / 2,
                                    size: 24,
                                    font: font,
                                    color: rgb(0.9, 0.2, 0.2),
                                    rotate: degrees(-45),
                                    opacity: 0.3,
                                });
                            });
                            
                            const pdfBytes = await pdfDoc.save();
                            res.setHeader('Content-Length', pdfBytes.length);
                            res.end(Buffer.from(pdfBytes));
                        } catch (err) {
                            console.error("Watermarking failed:", err);
                            res.end(decryptedBuffer); // fallback to original if watermarking fails
                        }
                    });
                    readStream.pipe(decipher);
                } else {
                    readStream.pipe(decipher).pipe(res);
                }
            } else {
                // Fallback for unencrypted legacy files
                try {
                    const legacyStream = await StorageService.getFileStream(doc.filename);
                    if (doc.mimetype === 'application/pdf') {
                        // For legacy PDFs, we still try to watermark if possible
                        const chunks = [];
                        legacyStream.on('data', c => chunks.push(c));
                        legacyStream.on('end', async () => {
                            const buffer = Buffer.concat(chunks);
                            try {
                                const pdfDoc = await PDFDocument.load(buffer);
                                const pages = pdfDoc.getPages();
                                const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                                const watermarkText = `GovSecure Vault\nDownloaded by: ${req.user.email}\nDate: ${new Date().toLocaleString()}`;
                                pages.forEach(page => {
                                    const { width, height } = page.getSize();
                                    page.drawText(watermarkText, {
                                        x: width / 4 - 50, y: height / 2, size: 24, font: font,
                                        color: rgb(0.9, 0.2, 0.2), rotate: degrees(-45), opacity: 0.3,
                                    });
                                });
                                const pdfBytes = await pdfDoc.save();
                                res.setHeader('Content-Length', pdfBytes.length);
                                res.end(Buffer.from(pdfBytes));
                            } catch (waterErr) {
                                logger.error("Legacy Watermarking failed:", waterErr);
                                res.end(buffer);
                            }
                        });
                    } else {
                        legacyStream.pipe(res);
                    }
                } catch (legacyErr) {
                    logger.error("Legacy Download Error:", legacyErr);
                    return res.status(404).json({ error: 'Legacy file missing on storage' });
                }
            }
            } catch (err) {
                return res.status(404).json({ error: 'File missing on server storage' });
            }
        };

        if (doc.user_id === req.user.id) {
            serveEncryptedFile();
        } else {
            // Check if it's shared with the user and not expired
            db.get(`SELECT * FROM shares WHERE document_id = ? AND shared_with_email = ?`, [docId, req.user.email], (err, share) => {
                if (err || !share) return res.status(403).json({ error: 'Access denied' });
                
                if (share.expires_at) {
                    const now = new Date();
                    const expiry = new Date(share.expires_at);
                    if (now > expiry) {
                        return res.status(403).json({ error: 'Access to this shared document has expired.' });
                    }
                }
                
                serveEncryptedFile();
            });
        }
    });
});

// GET /api/documents/:id/download-original
router.get('/:id/download-original', requireAadhaar, (req, res) => {
    const docId = req.params.id;

    // Strict ownership verification only
    db.get(`SELECT * FROM documents WHERE id = ? AND user_id = ?`, [docId, req.user.id], async (err, doc) => {
        if (err || !doc) return res.status(403).json({ error: 'Access denied. Only the owner can download the original un-watermarked file.' });

        try {
            const readStream = await StorageService.getFileStream(doc.filename);

            logAction(req.user.id, 'DOWNLOAD_ORIGINAL', `Downloaded original document for verification: ${doc.original_name}`);
            
            res.setHeader('Content-Disposition', `attachment; filename="Original_${doc.original_name}"`);
            res.setHeader('Content-Type', doc.mimetype);

            if (doc.encryption_iv && doc.auth_tag) {
                const iv = Buffer.from(doc.encryption_iv, 'hex');
                const authTag = Buffer.from(doc.auth_tag, 'hex');
                
                const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
                decipher.setAuthTag(authTag);
                
                readStream.on('error', (streamErr) => {
                    logger.error('Original Download File Read Error:', streamErr);
                    if (!res.headersSent) res.status(500).json({ error: 'Error reading original file' });
                });
                
                decipher.on('error', (decErr) => {
                    logger.error('Original Download Decryption Error:', decErr);
                    if (!res.headersSent) res.status(500).json({ error: 'Original file decryption failed' });
                });

                // Stream directly without watermarking
                readStream.pipe(decipher).pipe(res);
            } else {
                // Unencrypted legacy fallback
                readStream.pipe(res);
            }
        } catch (err) {
            logger.error('Original Download Storage Error:', err);
            return res.status(404).json({ error: 'Original file missing on server storage' });
        }
    });
});

// DELETE /api/documents/:id
router.delete('/:id', requireAadhaar, (req, res) => {
    const docId = req.params.id;

    db.get(`SELECT * FROM documents WHERE id = ? AND user_id = ?`, [docId, req.user.id], (err, doc) => {
        if (err || !doc) return res.status(404).json({ error: 'Document not found or unauthorized' });

        // Delete from DB first
        db.run(`DELETE FROM documents WHERE id = ?`, [docId], async (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });

            // Delete associated shares
            db.run(`DELETE FROM shares WHERE document_id = ?`, [docId]);

            // Delete file from storage
            try {
                await StorageService.deleteFile(doc.filename);
            } catch (err) {
                console.error("Storage Deletion Error:", err);
            }

            logAction(req.user.id, 'DELETE', `Deleted document: ${doc.original_name}`);
            res.json({ message: 'Document deleted successfully' });
        });
    });
});

// POST /api/documents/verify (PUBLIC)
router.post('/verify', express.json(), (req, res) => {
    const { hash } = req.body;
    if (!hash) return res.status(400).json({ error: 'Hash is required for verification.' });

    // Look for exact match of the hash in the documents table
    db.get(`SELECT original_name, category, uploaded_at FROM documents WHERE file_hash = ?`, [hash], (err, doc) => {
        if (err) return res.status(500).json({ error: 'Database error during verification' });

        if (doc) {
            res.json({
                verified: true,
                document: {
                    original_name: doc.original_name,
                    category: doc.category,
                    uploaded_at: doc.uploaded_at
                }
            });
        } else {
            res.json({ verified: false });
        }
    });
});

module.exports = router;
