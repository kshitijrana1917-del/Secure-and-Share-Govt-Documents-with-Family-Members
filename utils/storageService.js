const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');

// Configuration
const provider = process.env.STORAGE_PROVIDER || 'local'; // 'local' or 's3'

// S3 Configuration (Placeholder for real credentials)
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'mock_key',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'mock_secret',
    region: process.env.AWS_REGION || 'us-east-1'
});
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'govsecure-vault';

class StorageService {
    /**
     * Rename/Move a file from temp path to final destination
     * @param {string} tempPath 
     * @param {string} filename 
     * @returns {Promise<void>}
     */
    static async saveFile(tempPath, filename) {
        if (provider === 's3') {
            const fileStream = fs.createReadStream(tempPath);
            const params = {
                Bucket: BUCKET_NAME,
                Key: filename,
                Body: fileStream
            };
            await s3.upload(params).promise();
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); // cleanup temp file
            return;
        }

        // Local Provider (default)
        const uploadDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        
        const destPath = path.join(uploadDir, filename);
        return new Promise((resolve, reject) => {
            fs.rename(tempPath, destPath, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Get a readable stream for the file
     * @param {string} filename 
     * @returns {Promise<any>} ReadableStream
     */
    static async getFileStream(filename) {
        if (provider === 's3') {
            const params = {
                Bucket: BUCKET_NAME,
                Key: filename
            };
            // Check if exists
            await s3.headObject(params).promise();
            return s3.getObject(params).createReadStream();
        }

        // Local Provider
        const filePath = path.join(__dirname, '..', 'uploads', filename);
        if (!fs.existsSync(filePath)) {
            throw new Error('File missing on server');
        }
        return fs.createReadStream(filePath);
    }

    /**
     * Delete a file
     * @param {string} filename 
     * @returns {Promise<void>}
     */
    static async deleteFile(filename) {
        if (provider === 's3') {
            const params = {
                Bucket: BUCKET_NAME,
                Key: filename
            };
            await s3.deleteObject(params).promise();
            return;
        }

        // Local Provider
        const filePath = path.join(__dirname, '..', 'uploads', filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}

module.exports = StorageService;
