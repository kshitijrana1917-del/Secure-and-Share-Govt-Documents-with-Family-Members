const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    try {
        fs.mkdirSync(logsDir, { recursive: true });
    } catch (err) {
        console.warn('⚠️ Could not create logs directory; file logging disabled:', err.message);
    }
}

const fileTransports = [];
try {
    fs.accessSync(logsDir, fs.constants.W_OK);
    fileTransports.push(new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }));
    fileTransports.push(new winston.transports.File({ filename: path.join(logsDir, 'combined.log') }));
} catch (err) {
    console.warn('⚠️ Logs directory not writable; file logging disabled:', err.message);
}

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'govsecure-service' },
    transports: fileTransports
});

if (process.env.NODE_ENV !== 'production' || process.env.LOG_CONSOLE === 'true') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

module.exports = logger;
