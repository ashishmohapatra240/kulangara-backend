import Redis from 'ioredis';

const redis = new Redis({
    port: 16529,
    host: 'redis-16529.c264.ap-south-1-1.ec2.redns.redis-cloud.com',
    username: 'default',
    password: process.env.REDIS_PASSWORD || '',
});

redis.on('connect', () => {
    console.log('Connected to Redis');
});

redis.on('error', (error) => {
    console.error('Redis connection error:', error);
});

export default redis;
