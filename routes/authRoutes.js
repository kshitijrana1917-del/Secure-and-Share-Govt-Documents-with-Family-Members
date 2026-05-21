const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db, logAction } = require('../database');
const { sendOTP, sendAadhaarOTP } = require('../utils/emailService');
const { sendSMS } = require('../utils/messageService');
const { authenticate } = require('../middleware/auth');
const { redisClient } = require('../utils/redisClient');
const rateLimit = require('express-rate-limit');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

// Strict Rate Limiting for Auth/OTP routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Increased to 50 for local testing and demonstrations
    message: { error: 'Too many authentication attempts from this IP, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// In-memory store for OTPs. In production, use Redis or DB.
// OTPs are now stored in Redis cache

// POST /api/auth/request-otp
router.post('/request-otp', authLimiter, async (req, res) => {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await redisClient.setEx(`otp:${email}`, 300, JSON.stringify({ otp, name }));

    try {
        await sendOTP(email, otp, name);
        res.json({ message: 'OTP sent to your email successfully.' });
    } catch (err) {
        console.error("Failed to send email:", err.message);
        await redisClient.del(`otp:${email}`);
        res.status(500).json({ error: 'Failed to send OTP email. Make sure SMTP is configured.' });
    }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', authLimiter, async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

    const storedStr = await redisClient.get(`otp:${email}`);
    const storedOtpData = storedStr ? JSON.parse(storedStr) : null;
    
    if (!storedOtpData) {
        return res.status(400).json({ error: 'No OTP requested or expired.' });
    }

    if (false) { // Redis handles expiration
        await redisClient.del(`otp:${email}`);
        return res.status(400).json({ error: 'OTP has expired.' });
    }

    if (storedOtpData.otp !== otp) {
        return res.status(400).json({ error: 'Invalid OTP.' });
    }

    // OTP matches, delete it
    await redisClient.del(`otp:${email}`);

    // Check if user exists, otherwise create
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        if (row) {
            // User exists
            if (row.mobile && row.mobile !== 'email_linked') {
                // Trigger SMS OTP for 2FA
                const smsOtp = Math.floor(100000 + Math.random() * 900000).toString();
                await redisClient.setEx(`smsOtp:${row.email}`, 300, JSON.stringify({ otp: smsOtp, userId: row.id }));
                
                // Using fire-and-forget for sendSMS to avoid blocking, but catching errors
                sendSMS(row.mobile, `Your GovSecure 2FA login OTP is: ${smsOtp}. Do not share it.`).catch(err => console.error("2FA SMS Error:", err));
                
                return res.json({
                    message: `Email verified. SMS OTP sent to mobile ending in ${row.mobile.slice(-4)} for 2FA.`,
                    requires2FA: true,
                    email: row.email,
                    mobileEnding: row.mobile.slice(-4)
                });
            } else {
                // Generate token (1FA fallback)
                const token = jwt.sign({ id: row.id, email: row.email, role: row.role }, JWT_SECRET, { expiresIn: '24h' });
                logAction(row.id, 'LOGIN', 'User logged in successfully.');
                return res.json({ 
                    message: 'Login successful', 
                    token, 
                    user: { 
                        id: row.id, 
                        name: row.name, 
                        email: row.email,
                        role: row.role,
                        aadhaar_verified: !!row.aadhaar_verified 
                    } 
                });
            }
        } else {
            // New user, insert then generate token
            const name = storedOtpData.name || email.split('@')[0];
            db.run(`INSERT INTO users (email, name, role) VALUES (?, ?, 'citizen')`, [email, name], function(err) {
                if (err) return res.status(500).json({ error: 'Error creating user' });
                
                const userId = this.lastID;
                const token = jwt.sign({ id: userId, email: email, role: 'citizen' }, JWT_SECRET, { expiresIn: '24h' });
                logAction(userId, 'REGISTER', 'New user registered.');
                logAction(userId, 'LOGIN', 'User logged in after registration.');
                return res.json({ 
                    message: 'Registration and login successful', 
                    token, 
                    user: { 
                        id: userId, 
                        name: name, 
                        email: email,
                        role: 'citizen',
                        aadhaar_verified: false
                    } 
                });
            });
        }
    });
});

// POST /api/auth/verify-2fa
router.post('/verify-2fa', authLimiter, async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

    const storedStr = await redisClient.get(`smsOtp:${email}`);
    const storedData = storedStr ? JSON.parse(storedStr) : null;
    if (!storedData) {
        return res.status(400).json({ error: 'No 2FA OTP requested or expired.' });
    }

    if (false) {
        await redisClient.del(`smsOtp:${email}`);
        return res.status(400).json({ error: '2FA OTP has expired.' });
    }

    if (storedData.otp !== otp) {
        return res.status(400).json({ error: 'Invalid 2FA OTP.' });
    }

    await redisClient.del(`smsOtp:${email}`);

    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {
        if (err || !row) return res.status(500).json({ error: 'Database error' });
        
        const token = jwt.sign({ id: row.id, email: row.email, role: row.role }, JWT_SECRET, { expiresIn: '24h' });
        logAction(row.id, 'LOGIN', 'User logged in successfully with 2FA.');
        return res.json({ 
            message: '2FA Login successful', 
            token, 
            user: { 
                id: row.id, 
                name: row.name, 
                email: row.email,
                role: row.role,
                aadhaar_verified: !!row.aadhaar_verified 
            } 
        });
    });
});

// POST /api/auth/aadhaar/request-otp
router.post('/aadhaar/request-otp', authenticate, authLimiter, async (req, res) => {
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
    await redisClient.setEx(`aadhaarOtp:${req.user.id}`, 300, JSON.stringify({ 
        otp, 
        last4,
        hash,
        mobile: method === 'sms' ? mobile : 'email_linked',
        method
    }));

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
        await redisClient.del(`aadhaarOtp:${req.user.id}`);
        res.status(500).json({ error: `Failed to send OTP via ${method}. Please try the other method or check configuration.` });
    }
});

// POST /api/auth/aadhaar/verify-otp
router.post('/aadhaar/verify-otp', authenticate, async (req, res) => {
    const { otp } = req.body;
    const userId = req.user.id;

    const storedStr = await redisClient.get(`aadhaarOtp:${userId}`);
    const storedData = storedStr ? JSON.parse(storedStr) : null;
    if (!storedData) {
        return res.status(400).json({ error: 'No OTP request found or expired.' });
    }

    if (false) {
        await redisClient.del(`aadhaarOtp:${userId}`);
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
        async (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });

            await redisClient.del(`aadhaarOtp:${userId}`);
            logAction(userId, 'AADHAAR_VERIFIED', `Aadhaar verified successfully (ending with ${storedData.last4}) via mobile ${storedData.mobile}`);
            
            res.json({ 
                message: 'Aadhaar verified successfully!',
                aadhaar_last4: storedData.last4
            });
        }
    );
});

module.exports = router;
