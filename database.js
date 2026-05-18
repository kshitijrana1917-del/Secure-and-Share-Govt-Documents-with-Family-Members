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

// Promisified db.run for better async handling
const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

// Promisified db.all for schema checks
const dbAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
};

const initializeDB = () => {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            // Create users table
            await dbRun(`
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

            // Alter users table if needed - Execute sequentially to avoid SQLite locking
            const userColumns = await dbAll(`PRAGMA table_info(users)`);
            const userColumnNames = userColumns.map(r => r.name);
            const userAlterCommands = [
                { col: 'aadhaar_verified', sql: `ALTER TABLE users ADD COLUMN aadhaar_verified BOOLEAN DEFAULT 0` },
                { col: 'aadhaar_last4', sql: `ALTER TABLE users ADD COLUMN aadhaar_last4 TEXT` },
                { col: 'aadhaar_hash', sql: `ALTER TABLE users ADD COLUMN aadhaar_hash TEXT` },
                { col: 'verification_timestamp', sql: `ALTER TABLE users ADD COLUMN verification_timestamp DATETIME` },
                { col: 'mobile', sql: `ALTER TABLE users ADD COLUMN mobile TEXT` },
                { col: 'role', sql: `ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'citizen'` }
            ];
            for (const { col, sql } of userAlterCommands) {
                if (!userColumnNames.includes(col)) {
                    await dbRun(sql);
                }
            }

            // Create documents table
            await dbRun(`
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

            // Alter documents table if needed - Execute sequentially
            const docColumns = await dbAll(`PRAGMA table_info(documents)`);
            const docColumnNames = docColumns.map(r => r.name);
            const docAlterCommands = [
                { col: 'category', sql: `ALTER TABLE documents ADD COLUMN category TEXT DEFAULT 'Uncategorized'` },
                { col: 'encryption_iv', sql: `ALTER TABLE documents ADD COLUMN encryption_iv TEXT` },
                { col: 'auth_tag', sql: `ALTER TABLE documents ADD COLUMN auth_tag TEXT` },
                { col: 'file_hash', sql: `ALTER TABLE documents ADD COLUMN file_hash TEXT` },
                { col: 'ocr_text', sql: `ALTER TABLE documents ADD COLUMN ocr_text TEXT` }
            ];
            for (const { col, sql } of docAlterCommands) {
                if (!docColumnNames.includes(col)) {
                    await dbRun(sql);
                }
            }

            // Create shares table
            await dbRun(`
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

            // Alter shares table if needed - Execute sequentially
            const shareColumns = await dbAll(`PRAGMA table_info(shares)`);
            const shareColumnNames = shareColumns.map(r => r.name);
            if (!shareColumnNames.includes('expires_at')) {
                await dbRun(`ALTER TABLE shares ADD COLUMN expires_at DATETIME`);
            }

            // Create audit_logs table
            await dbRun(`
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    action TEXT NOT NULL,
                    details TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);

            // Verify all tables are ready
            await checkDatabaseHealth();
            console.log('[Database] Initialization complete - all tables ready');
        } catch (err) {
            console.error('[Database] Initialization failed:', err);
            throw err;
        }
    })();

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
