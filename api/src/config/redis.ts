import { Redis } from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.warn('[Redis] Connection warning:', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
});
