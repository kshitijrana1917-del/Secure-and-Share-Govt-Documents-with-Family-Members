const jwt = require('jsonwebtoken');
const { db } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Access denied. No token provided.' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. Token missing.' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, email }
        next();
    } catch (ex) {
        res.status(400).json({ error: 'Invalid token.' });
    }
};

const requireAadhaar = (req, res, next) => {
    authenticate(req, res, () => {
        db.get(`SELECT aadhaar_verified FROM users WHERE id = ?`, [req.user.id], (err, row) => {
            if (err) return res.status(500).json({ error: 'Database error during Aadhaar check.' });
            
            if (!row || !row.aadhaar_verified) {
                return res.status(403).json({ 
                    error: 'Aadhaar verification required.', 
                    code: 'AADHAAR_REQUIRED' 
                });
            }
            next();
        });
    });
};

module.exports = { authenticate, requireAadhaar };
