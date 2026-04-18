const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db, logAction } = require('../database');
const { sendOTP, sendAadhaarOTP } = require('../utils/emailService');
const { sendSMS } = require('../utils/messageService');
const { authenticate } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

// In-memory store for OTPs. In production, use Redis or DB.
const otpStore = new Map();
const aadhaarOtpStore = new Map();

// POST /api/auth/request-otp
router.post('/request-otp', async (req, res) => {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, { otp, name, expiresAt: Date.now() + 5 * 60 * 1000 }); // 5 mins expiry

    try {
        await sendOTP(email, otp, name);
        res.json({ message: 'OTP sent to your email successfully.' });
    } catch (err) {
        console.error("Failed to send email:", err.message);
        otpStore.delete(email);
        res.status(500).json({ error: 'Failed to send OTP email. Make sure SMTP is configured.' });
    }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

    const storedOtpData = otpStore.get(email);
    
    if (!storedOtpData) {
        return res.status(400).json({ error: 'No OTP requested or expired.' });
    }

    if (Date.now() > storedOtpData.expiresAt) {
        otpStore.delete(email);
        return res.status(400).json({ error: 'OTP has expired.' });
    }

    if (storedOtpData.otp !== otp) {
        return res.status(400).json({ error: 'Invalid OTP.' });
    }

    // OTP matches, delete it
    otpStore.delete(email);

    // Check if user exists, otherwise create
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        if (row) {
            // User exists, generate token
            const token = jwt.sign({ id: row.id, email: row.email }, JWT_SECRET, { expiresIn: '24h' });
            logAction(row.id, 'LOGIN', 'User logged in successfully.');
            return res.json({ 
                message: 'Login successful', 
                token, 
                user: { 
                    id: row.id, 
                    name: row.name, 
                    email: row.email,
                    aadhaar_verified: !!row.aadhaar_verified 
                } 
            });
        } else {
            // New user, insert then generate token
            const name = storedOtpData.name || email.split('@')[0];
            db.run(`INSERT INTO users (email, name) VALUES (?, ?)`, [email, name], function(err) {
                if (err) return res.status(500).json({ error: 'Error creating user' });
                
                const userId = this.lastID;
                const token = jwt.sign({ id: userId, email: email }, JWT_SECRET, { expiresIn: '24h' });
                logAction(userId, 'REGISTER', 'New user registered.');
                logAction(userId, 'LOGIN', 'User logged in after registration.');
                return res.json({ 
                    message: 'Registration and login successful', 
                    token, 
                    user: { 
                        id: userId, 
                        name: name, 
                        email: email,
                        aadhaar_verified: false
                    } 
                });
            });
        }
    });
});

// POST /api/auth/aadhaar/request-otp
router.post('/aadhaar/request-otp', authenticate, async (req, res) => {
    const { aadhaarNumber, mobile, method = 'sms' } = req.body;
    console.log(`Aadhaar OTP request received: Method=${method}, Aadhaar=${aadhaarNumber ? 'provided' : 'missing'}, Mobile=${mobile || 'N/A'}`);
    
    if (!aadhaarNumber || aadhaarNumber.length !== 12) {
        return res.status(400).json({ error: 'Valid 12-digit Aadhaar number is required' });
    }

    if (method === 'sms' && (!mobile || !/^\+?[1-9]\d{1,14}$/.test(mobile))) {
        return res.status(400).json({ error: 'Valid mobile number is required for SMS verification' });
    }

    // Generate a 6-digit real OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const last4 = aadhaarNumber.slice(-4);
    const hash = crypto.createHash('sha256').update(aadhaarNumber).digest('hex');
    
    // Store OTP against user ID
    aadhaarOtpStore.set(req.user.id, { 
        otp, 
        last4,
        hash,
        mobile: method === 'sms' ? mobile : 'email_linked',
        method,
        expiresAt: Date.now() + 5 * 60 * 1000 
    });

    logAction(req.user.id, 'AADHAAR_OTP_REQUEST', `Aadhaar OTP requested via ${method} for ending with ${last4}`);

    try {
        if (method === 'sms') {
            await sendSMS(mobile, `Your GovSecure Aadhaar verification OTP is: ${otp}. Do not share it with anyone.`);
            res.json({ 
                message: `OTP sent to your mobile ${mobile.replace(/.(?=.{4})/g, '*')}.`,
                last4: last4
            });
        } else {
            // Method is email
            await sendAadhaarOTP(req.user.email, otp, last4);
            res.json({ 
                message: `OTP sent to your registered email ${req.user.email.replace(/.(?=.{@})/g, '*')}.`,
                last4: last4
            });
        }
    } catch (err) {
        console.error(`${method.toUpperCase()} Error:`, err.message);
        aadhaarOtpStore.delete(req.user.id);
        res.status(500).json({ error: `Failed to send OTP via ${method}. Please try the other method or check configuration.` });
    }
});

// POST /api/auth/aadhaar/verify-otp
router.post('/aadhaar/verify-otp', authenticate, (req, res) => {
    const { otp } = req.body;
    const userId = req.user.id;

    const storedData = aadhaarOtpStore.get(userId);
    if (!storedData) {
        return res.status(400).json({ error: 'No OTP request found or expired.' });
    }

    if (Date.now() > storedData.expiresAt) {
        aadhaarOtpStore.delete(userId);
        return res.status(400).json({ error: 'OTP has expired.' });
    }

    if (storedData.otp !== otp) {
        return res.status(400).json({ error: 'Invalid OTP.' });
    }

    // Success! Update DB
    const timestamp = new Date().toISOString();
    db.run(
        `UPDATE users SET aadhaar_verified = 1, aadhaar_last4 = ?, aadhaar_hash = ?, verification_timestamp = ?, mobile = ? WHERE id = ?`,
        [storedData.last4, storedData.hash, timestamp, storedData.mobile, userId],
        (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });

            aadhaarOtpStore.delete(userId);
            logAction(userId, 'AADHAAR_VERIFIED', `Aadhaar verified successfully (ending with ${storedData.last4}) via mobile ${storedData.mobile}`);
            
            res.json({ 
                message: 'Aadhaar verified successfully!',
                aadhaar_last4: storedData.last4
            });
        }
    );
});

module.exports = router;
