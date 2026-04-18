const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const initializeDB = () => {
    db.serialize(() => {
        // Users Table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                aadhaar_verified BOOLEAN DEFAULT 0,
                aadhaar_last4 TEXT,
                verification_timestamp DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Ensure columns exist if table was already created
        const columns = ['aadhaar_verified', 'aadhaar_last4', 'aadhaar_hash', 'verification_timestamp', 'mobile'];
        db.all(`PRAGMA table_info(users)`, (err, rows) => {
            if (err) return console.error(err.message);
            const existingColumns = rows.map(r => r.name);
            if (!existingColumns.includes('aadhaar_verified')) {
                db.run(`ALTER TABLE users ADD COLUMN aadhaar_verified BOOLEAN DEFAULT 0`);
            }
            if (!existingColumns.includes('aadhaar_last4')) {
                db.run(`ALTER TABLE users ADD COLUMN aadhaar_last4 TEXT`);
            }
            if (!existingColumns.includes('aadhaar_hash')) {
                db.run(`ALTER TABLE users ADD COLUMN aadhaar_hash TEXT`);
            }
            if (!existingColumns.includes('verification_timestamp')) {
                db.run(`ALTER TABLE users ADD COLUMN verification_timestamp DATETIME`);
            }
            if (!existingColumns.includes('mobile')) {
                db.run(`ALTER TABLE users ADD COLUMN mobile TEXT`);
            }
        });

        // Documents Table
        db.run(`
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                original_name TEXT NOT NULL,
                mimetype TEXT NOT NULL,
                size INTEGER NOT NULL,
                uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Shares Table
        db.run(`
            CREATE TABLE IF NOT EXISTS shares (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id INTEGER NOT NULL,
                shared_by_user_id INTEGER NOT NULL,
                shared_with_email TEXT NOT NULL,
                shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (document_id) REFERENCES documents(id),
                FOREIGN KEY (shared_by_user_id) REFERENCES users(id)
            )
        `);

        // Audit Logs Table
        db.run(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT NOT NULL,
                details TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
    });
};

const logAction = (userId, action, details) => {
    db.run(
        `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
        [userId, action, details],
        function(err) {
            if (err) console.error("Error logging action:", err.message);
        }
    );
};

module.exports = { db, initializeDB, logAction };
