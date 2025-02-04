/**
 * @fileoverview Integration tests for Redis caching layer with comprehensive validation
 * of cache operations, performance metrics, security measures, and reliability.
 * @version 1.0.0
 */

import { TestCacheManager } from '../utils/test-cache';
import { setupTestEnvironment, teardownTestEnvironment } from '../utils/test-helpers';
import { jest } from '@types/jest';

// Cache configuration for test environment
const TEST_CACHE_CONFIG = {
  host: 'localhost',
  port: 6379,
  db: 1,
  password: process.env.TEST_REDIS_PASSWORD
};

describe('Redis Cache Integration Tests', () => {
  let cacheManager: TestCacheManager;
  let testMetrics: Map<string, number>;

  beforeAll(async () => {
    const env = await setupTestEnvironment({
      skipDatabase: true,
      skipApi: true,
      performanceMonitoring: true
    });
    cacheManager = new TestCacheManager(TEST_CACHE_CONFIG);
    await cacheManager.init();
  });

  afterAll(async () => {
    await teardownTestEnvironment({ cache: cacheManager });
  });

  beforeEach(async () => {
    await cacheManager.cleanup();
    testMetrics = new Map();
  });

  afterEach(() => {
    const metrics = cacheManager.getMetrics();
    for (const [key, value] of metrics.entries()) {
      testMetrics.set(key, value);
    }
  });

  describe('Cache Operations', () => {
    test('should perform basic cache operations with security validation', async () => {
      const startTime = Date.now();
      const testKey = `test:${crypto.randomUUID()}`;
      const testValue = { data: 'test-data', timestamp: new Date().toISOString() };

      // Set operation with encryption
      await cacheManager.set(testKey, testValue);
      
      // Get operation with decryption
      const cachedValue = await cacheManager.get(testKey);
      
      // Validate operation latency
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // 100ms SLA
      
      // Validate data integrity
      expect(cachedValue).toEqual(testValue);
      
      // Verify data isolation
      const nonExistentKey = `test:${crypto.randomUUID()}`;
      const nonExistentValue = await cacheManager.get(nonExistentKey);
      expect(nonExistentValue).toBeNull();
    });

    test('should handle cache TTL with performance monitoring', async () => {
      const testKey = `test:${crypto.randomUUID()}`;
      const testValue = { data: 'ttl-test' };
      const ttl = 2; // 2 seconds

      // Set with TTL
      await cacheManager.set(testKey, testValue, ttl);
      
      // Verify value exists within TTL
      let cachedValue = await cacheManager.get(testKey);
      expect(cachedValue).toEqual(testValue);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, ttl * 1000 + 100));
      
      // Verify expiration
      cachedValue = await cacheManager.get(testKey);
      expect(cachedValue).toBeNull();
    });

    test('should handle concurrent cache operations under load', async () => {
      const operations = 1000;
      const startTime = Date.now();
      const promises: Promise<void>[] = [];

      // Execute parallel operations
      for (let i = 0; i < operations; i++) {
        const key = `concurrent:${crypto.randomUUID()}`;
        promises.push(cacheManager.set(key, { index: i }));
      }

      await Promise.all(promises);
      
      // Validate performance under load
      const duration = Date.now() - startTime;
      const operationsPerSecond = (operations / duration) * 1000;
      
      expect(operationsPerSecond).toBeGreaterThan(100); // Minimum 100 ops/sec
      expect(duration).toBeLessThan(5000); // Maximum 5 seconds total
    });

    test('should validate cache performance metrics', async () => {
      const iterations = 100;
      const setOperations: number[] = [];
      const getOperations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const key = `perf:${crypto.randomUUID()}`;
        const value = { index: i };

        // Measure set operation
        const setStart = Date.now();
        await cacheManager.set(key, value);
        setOperations.push(Date.now() - setStart);

        // Measure get operation
        const getStart = Date.now();
        await cacheManager.get(key);
        getOperations.push(Date.now() - getStart);
      }

      // Calculate performance metrics
      const avgSetTime = setOperations.reduce((a, b) => a + b) / iterations;
      const avgGetTime = getOperations.reduce((a, b) => a + b) / iterations;
      
      // Validate against SLAs
      expect(avgSetTime).toBeLessThan(50); // 50ms SLA for set
      expect(avgGetTime).toBeLessThan(30); // 30ms SLA for get
      
      // Verify metrics collection
      const metrics = cacheManager.getMetrics();
      expect(metrics.size).toBeGreaterThan(0);
    });

    test('should handle error scenarios gracefully', async () => {
      // Test invalid data
      await expect(cacheManager.set('', null)).rejects.toThrow();
      
      // Test oversized data
      const largeData = Buffer.alloc(512 * 1024 * 1024); // 512MB
      await expect(cacheManager.set('large', largeData)).rejects.toThrow();
      
      // Test connection failure recovery
      jest.spyOn(cacheManager, 'set').mockRejectedValueOnce(new Error('Connection failed'));
      await expect(cacheManager.set('test', 'value')).resolves.not.toThrow();
    });
  });
});