/**
 * @fileoverview Enterprise-grade test cache management utility providing Redis cache operations,
 * performance monitoring, and metrics collection for test environments.
 * @version 1.0.0
 */

import Redis from 'ioredis'; // ^5.3.0
import { EventEmitter } from 'events';
import { Logger } from '../../backend/shared/utils/logger';
import { IErrorResponse } from '../../backend/shared/interfaces/base.interface';

// Global configuration constants
export const DEFAULT_TEST_CACHE_CONFIG = {
  host: 'localhost',
  port: 6379,
  db: 1, // Separate DB for test environment
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => Math.min(times * 1000, 3000)
};

export const CACHE_RETRY_OPTIONS = {
  attempts: 3,
  delay: 1000,
  backoff: 2
};

export const CACHE_PERFORMANCE_THRESHOLDS = {
  operationTimeout: 100, // milliseconds
  alertThreshold: 90 // percentage of timeout
};

// Initialize logger for cache operations
const logger = new Logger('TestCacheManager', {
  logLevel: 'debug',
  defaultMetadata: { component: 'test-cache' }
});

/**
 * Initializes a Redis cache instance for testing with performance monitoring
 * @param config - Redis configuration options
 * @returns Promise<Redis> - Configured Redis client instance
 */
export async function initTestCache(config: Redis.RedisOptions = DEFAULT_TEST_CACHE_CONFIG): Promise<Redis> {
  try {
    const client = new Redis({
      ...DEFAULT_TEST_CACHE_CONFIG,
      ...config
    });

    await client.ping();
    logger.info('Test cache initialized successfully');
    return client;
  } catch (error) {
    logger.error('Failed to initialize test cache', error as Error);
    throw error;
  }
}

/**
 * Monitors and records cache operation performance metrics
 * @param operation - Name of the cache operation
 * @param startTime - Operation start timestamp
 */
function monitorCachePerformance(operation: string, startTime: number): void {
  const duration = Date.now() - startTime;
  logger.recordMetric('cache', duration);

  if (duration > CACHE_PERFORMANCE_THRESHOLDS.operationTimeout) {
    logger.warn(`Cache operation ${operation} exceeded performance threshold`, {
      operation,
      duration,
      threshold: CACHE_PERFORMANCE_THRESHOLDS.operationTimeout
    });
  }
}

/**
 * Enterprise-grade test cache manager with performance monitoring and metrics collection
 */
export class TestCacheManager {
  private client: Redis | null = null;
  private readonly metrics: Map<string, number> = new Map();
  private readonly eventEmitter: EventEmitter = new EventEmitter();
  private readonly config: Redis.RedisOptions;

  /**
   * Creates a new TestCacheManager instance
   * @param config - Redis configuration options
   */
  constructor(config: Redis.RedisOptions = DEFAULT_TEST_CACHE_CONFIG) {
    this.config = config;
  }

  /**
   * Initializes the cache manager
   * @returns Promise<void>
   */
  public async init(): Promise<void> {
    try {
      this.client = await initTestCache(this.config);
      await this.cleanup(); // Clear existing test data
      logger.info('TestCacheManager initialized successfully');
    } catch (error) {
      const errorResponse: IErrorResponse = {
        success: false,
        message: 'Failed to initialize TestCacheManager',
        errorCode: 'INTERNAL_ERROR',
        details: { error: (error as Error).message },
        statusCode: 500,
        correlationId: crypto.randomUUID()
      };
      logger.error('Cache initialization failed', errorResponse);
      throw error;
    }
  }

  /**
   * Sets a value in the test cache with performance monitoring
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds
   * @returns Promise<void>
   */
  public async set(key: string, value: any, ttl?: number): Promise<void> {
    const startTime = Date.now();
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value;
      
      if (ttl) {
        await this.client.setex(key, ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }

      monitorCachePerformance('set', startTime);
      this.metrics.set(`set:${key}`, Date.now() - startTime);
      this.eventEmitter.emit('cache:set', { key, duration: Date.now() - startTime });
    } catch (error) {
      logger.error('Cache set operation failed', error as Error, { key });
      throw error;
    }
  }

  /**
   * Retrieves a value from the test cache
   * @param key - Cache key
   * @returns Promise<any>
   */
  public async get(key: string): Promise<any> {
    const startTime = Date.now();
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const value = await this.client.get(key);
      monitorCachePerformance('get', startTime);
      this.metrics.set(`get:${key}`, Date.now() - startTime);

      if (value) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return null;
    } catch (error) {
      logger.error('Cache get operation failed', error as Error, { key });
      throw error;
    }
  }

  /**
   * Cleans up test cache data
   * @returns Promise<void>
   */
  public async cleanup(): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      await this.client.flushdb();
      logger.info('Test cache cleaned up successfully');
    } catch (error) {
      logger.error('Cache cleanup failed', error as Error);
      throw error;
    }
  }

  /**
   * Retrieves cache performance metrics
   * @returns Map<string, number> Performance metrics
   */
  public getMetrics(): Map<string, number> {
    return new Map(this.metrics);
  }

  /**
   * Closes the cache connection
   * @returns Promise<void>
   */
  public async close(): Promise<void> {
    try {
      if (this.client) {
        await this.client.quit();
        this.client = null;
        logger.info('Cache connection closed successfully');
      }
    } catch (error) {
      logger.error('Failed to close cache connection', error as Error);
      throw error;
    }
  }
}