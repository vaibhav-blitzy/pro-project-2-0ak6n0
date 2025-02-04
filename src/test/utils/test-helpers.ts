/**
 * @fileoverview Enterprise-grade test helper utilities providing comprehensive testing support
 * with enhanced security validation, performance monitoring, and resource management.
 * @version 1.0.0
 */

import { createTestApiClient, setupAuthToken } from './api-client';
import { TestDatabaseManager } from './test-database';
import { TestCacheManager } from './test-cache';
import { jest } from '@types/jest';
import supertest from 'supertest';
import now from 'performance-now';

// Performance monitoring thresholds (milliseconds)
const PERFORMANCE_THRESHOLDS = {
  API_RESPONSE: 500,
  DATABASE_OPERATION: 200,
  CACHE_OPERATION: 100,
  TOTAL_TEST: 5000
};

/**
 * Interface for test environment configuration
 */
interface TestEnvironmentConfig {
  skipDatabase?: boolean;
  skipCache?: boolean;
  skipApi?: boolean;
  securityValidation?: boolean;
  performanceMonitoring?: boolean;
}

/**
 * Interface for performance metrics
 */
interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  operationBreakdown: Record<string, number>;
}

/**
 * Sets up a complete test environment with enhanced security validation,
 * performance monitoring, and resource management
 */
export async function setupTestEnvironment(config: TestEnvironmentConfig = {}): Promise<{
  db?: TestDatabaseManager;
  cache?: TestCacheManager;
  api?: ReturnType<typeof createTestApiClient>;
  metrics: PerformanceMetrics;
}> {
  const startTime = now();
  const metrics: PerformanceMetrics = {
    startTime,
    endTime: 0,
    duration: 0,
    operationBreakdown: {}
  };

  try {
    const environment: any = { metrics };

    // Initialize database if not skipped
    if (!config.skipDatabase) {
      const dbStartTime = now();
      const db = new TestDatabaseManager();
      await db.init();
      environment.db = db;
      metrics.operationBreakdown.database = now() - dbStartTime;
    }

    // Initialize cache if not skipped
    if (!config.skipCache) {
      const cacheStartTime = now();
      const cache = new TestCacheManager();
      await cache.init();
      environment.cache = cache;
      metrics.operationBreakdown.cache = now() - cacheStartTime;
    }

    // Initialize API client if not skipped
    if (!config.skipApi) {
      const apiStartTime = now();
      const api = createTestApiClient({
        validateSecurity: config.securityValidation
      });
      environment.api = api;
      metrics.operationBreakdown.api = now() - apiStartTime;
    }

    metrics.endTime = now();
    metrics.duration = metrics.endTime - metrics.startTime;

    // Validate setup performance
    if (config.performanceMonitoring && metrics.duration > PERFORMANCE_THRESHOLDS.TOTAL_TEST) {
      throw new Error(`Test environment setup exceeded performance threshold: ${metrics.duration}ms`);
    }

    return environment;
  } catch (error) {
    throw new Error(`Failed to setup test environment: ${(error as Error).message}`);
  }
}

/**
 * Cleans up all test environment resources with enhanced security
 * and performance cleanup validation
 */
export async function teardownTestEnvironment(env: {
  db?: TestDatabaseManager;
  cache?: TestCacheManager;
  api?: ReturnType<typeof createTestApiClient>;
}): Promise<void> {
  const startTime = now();

  try {
    // Parallel cleanup for better performance
    await Promise.all([
      env.db && env.db.cleanup(),
      env.cache && env.cache.cleanup()
    ]);

    const duration = now() - startTime;
    if (duration > PERFORMANCE_THRESHOLDS.TOTAL_TEST) {
      throw new Error(`Test environment teardown exceeded performance threshold: ${duration}ms`);
    }
  } catch (error) {
    throw new Error(`Failed to teardown test environment: ${(error as Error).message}`);
  }
}

/**
 * Enhanced async operation handler with performance tracking and retry mechanism
 */
export async function waitForAsyncOperation<T>(
  operation: () => Promise<T>,
  timeout: number = 5000,
  options: {
    retries?: number;
    interval?: number;
    performanceThreshold?: number;
  } = {}
): Promise<{ result: T; metrics: PerformanceMetrics }> {
  const startTime = now();
  const metrics: PerformanceMetrics = {
    startTime,
    endTime: 0,
    duration: 0,
    operationBreakdown: {}
  };

  const {
    retries = 3,
    interval = 1000,
    performanceThreshold = PERFORMANCE_THRESHOLDS.API_RESPONSE
  } = options;

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt < retries) {
    try {
      const operationStartTime = now();
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Operation timeout')), timeout);
        })
      ]);

      metrics.operationBreakdown[`attempt_${attempt}`] = now() - operationStartTime;
      metrics.endTime = now();
      metrics.duration = metrics.endTime - metrics.startTime;

      // Validate performance
      if (metrics.duration > performanceThreshold) {
        throw new Error(`Operation exceeded performance threshold: ${metrics.duration}ms`);
      }

      return { result, metrics };
    } catch (error) {
      lastError = error as Error;
      attempt++;
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  }

  throw new Error(`Operation failed after ${retries} attempts: ${lastError?.message}`);
}

// Export additional test utility functions
export const testUtils = {
  setupTestEnvironment,
  teardownTestEnvironment,
  waitForAsyncOperation,
  PERFORMANCE_THRESHOLDS
};

export default testUtils;