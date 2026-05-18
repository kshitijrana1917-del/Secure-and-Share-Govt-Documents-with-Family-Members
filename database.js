const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const REQUIRED_TABLES = ['users', 'documents', 'shares', 'audit_logs'];

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'database.sqlite');

if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}
const db = new sqlite3.Database(dbPath);

let initPromise = null;

const checkDatabaseHealth = () => {
    return new Promise((resolve, reject) => {
        const placeholders = REQUIRED_TABLES.map(() => '?').join(', ');
        db.get(
            `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN (${placeholders})`,
            REQUIRED_TABLES,
            (err, row) => {
                if (err) return reject(err);
                if (!row || row.n < REQUIRED_TABLES.length) {
                    return reject(new Error('Database schema not ready'));
                }
                resolve(true);
            }
        );
    });
};

const initializeDB = () => {
    if (initPromise) return initPromise;

    initPromise = new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                role TEXT DEFAULT 'citizen',
                aadhaar_verified BOOLEAN DEFAULT 0,
                aadhaar_last4 TEXT,
                verification_timestamp DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

            db.all(`PRAGMA table_info(users)`, (err, rows) => {
                if (err) return console.error(err.message);
                const existingColumns = rows.map(r => r.name);
                if (!existingColumns.includes('aadhaar_verified')) db.run(`ALTER TABLE users ADD COLUMN aadhaar_verified BOOLEAN DEFAULT 0`);
                if (!existingColumns.includes('aadhaar_last4')) db.run(`ALTER TABLE users ADD COLUMN aadhaar_last4 TEXT`);
                if (!existingColumns.includes('aadhaar_hash')) db.run(`ALTER TABLE users ADD COLUMN aadhaar_hash TEXT`);
                if (!existingColumns.includes('verification_timestamp')) db.run(`ALTER TABLE users ADD COLUMN verification_timestamp DATETIME`);
                if (!existingColumns.includes('mobile')) db.run(`ALTER TABLE users ADD COLUMN mobile TEXT`);
                if (!existingColumns.includes('role')) db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'citizen'`);
            });

            db.run(`
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                original_name TEXT NOT NULL,
                mimetype TEXT NOT NULL,
                size INTEGER NOT NULL,
                category TEXT DEFAULT 'Uncategorized',
                encryption_iv TEXT,
                auth_tag TEXT,
                file_hash TEXT,
                ocr_text TEXT,
                uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

            db.all(`PRAGMA table_info(documents)`, (err, rows) => {
                if (err) return console.error(err.message);
                const existingColumns = rows.map(r => r.name);
                if (!existingColumns.includes('category')) db.run(`ALTER TABLE documents ADD COLUMN category TEXT DEFAULT 'Uncategorized'`);
                if (!existingColumns.includes('encryption_iv')) db.run(`ALTER TABLE documents ADD COLUMN encryption_iv TEXT`);
                if (!existingColumns.includes('auth_tag')) db.run(`ALTER TABLE documents ADD COLUMN auth_tag TEXT`);
                if (!existingColumns.includes('file_hash')) db.run(`ALTER TABLE documents ADD COLUMN file_hash TEXT`);
                if (!existingColumns.includes('ocr_text')) db.run(`ALTER TABLE documents ADD COLUMN ocr_text TEXT`);
            });

            db.run(`
            CREATE TABLE IF NOT EXISTS shares (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id INTEGER NOT NULL,
                shared_by_user_id INTEGER NOT NULL,
                shared_with_email TEXT NOT NULL,
                expires_at DATETIME,
                shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (document_id) REFERENCES documents(id),
                FOREIGN KEY (shared_by_user_id) REFERENCES users(id)
            )
        `);

            db.all(`PRAGMA table_info(shares)`, (err, rows) => {
                if (err) return console.error(err.message);
                const existingColumns = rows.map(r => r.name);
                if (!existingColumns.includes('expires_at')) db.run(`ALTER TABLE shares ADD COLUMN expires_at DATETIME`);
            });

            db.run(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT NOT NULL,
                details TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `, (err) => {
                if (err) return reject(err);
                checkDatabaseHealth().then(resolve).catch(reject);
            });
        });
    });

    return initPromise;
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

module.exports = { db, initializeDB, checkDatabaseHealth, logAction };
