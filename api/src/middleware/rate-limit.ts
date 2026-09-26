import type { MiddlewareHandler } from 'hono';
import { redis } from '../config/redis.js';

interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix?: string;
}

export const rateLimit = ({ windowSeconds, maxRequests, keyPrefix = 'rl' }: RateLimitOptions): MiddlewareHandler => {
  return async (c, next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const key = `${keyPrefix}:${ip}`;

    try {
      if (redis.status === 'ready') {
        const current = await redis.incr(key);
        if (current === 1) {
          await redis.expire(key, windowSeconds);
        }

        if (current > maxRequests) {
          const ttl = await redis.ttl(key);
          c.header('Retry-After', ttl.toString());
          return c.json({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: `Too many requests. Please retry in ${ttl} seconds.`,
            },
          }, 429);
        }
      }
    } catch {
      // In case Redis is down, allow request through gracefully
    }

    await next();
  };
};
