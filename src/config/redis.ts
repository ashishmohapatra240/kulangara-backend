import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
    throw new Error('REDIS_URL is not defined');
}

const redis = redisUrl.startsWith('rediss://')
    ? new Redis(redisUrl, { tls: {} })
    : new Redis(redisUrl);

redis.on('connect', () => {
    console.log('Connected to Redis');
});

redis.on('error', (error) => {
    console.error('Redis connection error:', error);
});

export default redis;
