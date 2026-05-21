const { createClient } = require('redis');

// Initialize Redis client
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        reconnectStrategy: false // Do not retry connecting if it fails, so we can gracefully fallback immediately
    }
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err.message);
});

redisClient.on('connect', () => {
    console.log('info: [GovSecure] Connected to Redis Cache successfully.');
});

// Memory Map fallbacks
const fallbackCache = new Map();
let useFallback = false;

// Connect to Redis on startup
const connectRedis = async () => {
    try {
        await redisClient.connect();
    } catch (err) {
        console.warn('⚠️ [GovSecure] Failed to connect to Redis. Falling back to Memory Cache.', err.message);
        useFallback = true;
    }
};

// Wrapper for redis functions
const cache = {
    setEx: async (key, seconds, value) => {
        if (!redisClient.isReady || useFallback) {
            fallbackCache.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
            return 'OK';
        }
        return redisClient.setEx(key, seconds, value);
    },
    get: async (key) => {
        if (!redisClient.isReady || useFallback) {
            const data = fallbackCache.get(key);
            if (!data) return null;
            if (Date.now() > data.expiresAt) {
                fallbackCache.delete(key);
                return null;
            }
            return data.value;
        }
        return redisClient.get(key);
    },
    del: async (key) => {
        if (!redisClient.isReady || useFallback) {
            fallbackCache.delete(key);
            return 1;
        }
        return redisClient.del(key);
    }
};

module.exports = { redisClient: cache, connectRedis };
