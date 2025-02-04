/**
 * @fileoverview Implements distributed rate limiting using Redis with sliding window algorithm
 * for precise request tracking and fair resource usage across the API gateway.
 * @version 1.0.0
 */

import { config } from 'dotenv'; // v16.3.1
import Redis from 'ioredis'; // v5.3.2
import { Logger } from 'winston'; // v3.10.0
import { IBaseResponse } from '../../../shared/interfaces/base.interface';
import { HTTP_STATUS, ERROR_CODES } from '../../../shared/constants';

// Load environment variables
config();

/**
 * Rate limiting configuration for different entity types
 */
export const rateLimitConfig = {
  user: {
    requests_per_hour: 1000,
    requests_per_day: 10000,
    burst: 50,
    window_size_ms: 3600000 // 1 hour
  },
  organization: {
    requests_per_hour: 5000,
    requests_per_day: 50000,
    burst: 200,
    window_size_ms: 3600000 // 1 hour
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    keyPrefix: 'ratelimit:',
    ttl: 3600,
    retryStrategy: (times: number) => Math.min(times * 50, 2000),
    maxRetries: 3
  },
  cleanup: {
    interval_ms: 300000, // 5 minutes
    batch_size: 1000
  }
} as const;

/**
 * Interface for rate limit check results
 */
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Type definition for rate limit entity types
 */
type RateLimitType = 'user' | 'organization';

/**
 * Creates and configures a rate limiter instance with Redis backend
 * @param options Redis connection options
 * @returns Configured rate limiter instance
 */
export async function createRateLimiter(options: Redis.RedisOptions): Promise<Redis> {
  const redis = new Redis({
    ...rateLimitConfig.redis,
    ...options,
    retryStrategy: (times: number) => {
      if (times > rateLimitConfig.redis.maxRetries) {
        return null; // Stop retrying
      }
      return rateLimitConfig.redis.retryStrategy(times);
    }
  });

  // Set up cleanup job
  setInterval(() => {
    cleanupExpiredEntries(rateLimitConfig.cleanup.batch_size).catch(console.error);
  }, rateLimitConfig.cleanup.interval_ms);

  return redis;
}

/**
 * Checks if a request should be rate limited using sliding window algorithm
 * @param identifier Unique identifier for the entity (user ID or org ID)
 * @param type Type of entity being rate limited
 * @param correlationId Request correlation ID for tracking
 * @returns Rate limit check result
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimitType,
  correlationId: string
): Promise<RateLimitResult> {
  const redis = await createRateLimiter({});
  const now = Date.now();
  const windowStart = now - rateLimitConfig[type].window_size_ms;
  const key = `${rateLimitConfig.redis.keyPrefix}${type}:${identifier}`;

  try {
    // Atomic sliding window implementation using Redis
    const result = await redis
      .multi()
      .zremrangebyscore(key, 0, windowStart)
      .zadd(key, now, `${now}:${correlationId}`)
      .zcard(key)
      .zrange(key, 0, -1)
      .exec();

    if (!result) {
      throw new Error('Redis transaction failed');
    }

    const requestCount = result[2][1] as number;
    const limit = rateLimitConfig[type].requests_per_hour;
    const allowed = requestCount <= limit + rateLimitConfig[type].burst;
    const remaining = Math.max(0, limit - requestCount);
    const oldestRequest = result[3][1] as string[];
    const reset = oldestRequest.length ? parseInt(oldestRequest[0].split(':')[0]) + rateLimitConfig[type].window_size_ms : now + rateLimitConfig[type].window_size_ms;

    // Set TTL for the key
    await redis.expire(key, rateLimitConfig.redis.ttl);

    return {
      allowed,
      remaining,
      reset,
      retryAfter: allowed ? undefined : Math.ceil((reset - now) / 1000)
    };
  } finally {
    await redis.quit();
  }
}

/**
 * Generates standardized rate limit headers for API responses
 * @param result Rate limit check result
 * @returns Object containing rate limit headers
 */
export function generateRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': rateLimitConfig.user.requests_per_hour.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString()
  };

  if (!result.allowed && result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  return headers;
}

/**
 * Performs periodic cleanup of expired rate limit entries
 * @param batchSize Number of entries to process in each batch
 */
async function cleanupExpiredEntries(batchSize: number): Promise<void> {
  const redis = await createRateLimiter({});
  const now = Date.now();
  const windowStart = now - rateLimitConfig.user.window_size_ms;

  try {
    let cursor = '0';
    do {
      // Scan for keys in batches
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${rateLimitConfig.redis.keyPrefix}*`,
        'COUNT',
        batchSize
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        // Remove expired entries from each key
        await Promise.all(
          keys.map(key =>
            redis.zremrangebyscore(key, 0, windowStart)
          )
        );
      }
    } while (cursor !== '0');
  } finally {
    await redis.quit();
  }
}