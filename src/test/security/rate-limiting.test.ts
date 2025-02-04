/**
 * @fileoverview Comprehensive test suite for API rate limiting functionality
 * Verifies request throttling, quota enforcement, rate limit headers, and performance metrics
 * @version 1.0.0
 */

import { testApiClient } from '../utils/api-client';
import { setupTestEnvironment, teardownTestEnvironment } from '../utils/test-helpers';
import { rateLimitConfig } from '../../backend/api-gateway/src/config/rate-limiting';
import { HTTP_STATUS, ERROR_CODES } from '../../backend/shared/constants';
import { ApiResponse, ApiError } from '../../web/src/types/api.types';
import supertest from 'supertest'; // ^6.3.0
import { jest } from '@types/jest'; // ^29.5.0

// Test configuration constants
const TEST_ENDPOINT = '/api/v1/tasks';
const TEST_USER_ID = 'test-user-123';
const TEST_ORG_ID = 'test-org-456';
const PERFORMANCE_SLA = 500; // 500ms SLA requirement

describe('API Rate Limiting Tests', () => {
  let testEnv: any;
  let apiClient: ReturnType<typeof testApiClient.createTestApiClient>;

  beforeAll(async () => {
    // Set up test environment with required configurations
    testEnv = await setupTestEnvironment({
      securityValidation: true,
      performanceMonitoring: true
    });
    apiClient = testApiClient.createTestApiClient({
      validateSecurity: true,
      timeout: PERFORMANCE_SLA
    });
  });

  afterAll(async () => {
    await teardownTestEnvironment(testEnv);
  });

  beforeEach(async () => {
    // Reset rate limits before each test
    await testEnv.cache?.flushdb();
  });

  /**
   * Tests rate limiting for individual user requests with performance validation
   */
  test('should enforce user rate limits and maintain performance SLA', async () => {
    // Set up test user authentication
    const authToken = await testApiClient.setupAuthToken('test-token', { validateToken: true });
    const client = apiClient.apiClient;

    const requests: Promise<ApiResponse<any>>[] = [];
    const startTime = Date.now();

    // Make requests up to the user hourly limit
    for (let i = 0; i < rateLimitConfig.user.requests_per_hour; i++) {
      requests.push(
        client.get(TEST_ENDPOINT, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'X-User-ID': TEST_USER_ID
          }
        })
      );
    }

    // Execute requests and validate responses
    const responses = await Promise.all(requests);
    const endTime = Date.now();

    // Verify performance SLA
    const averageResponseTime = (endTime - startTime) / responses.length;
    expect(averageResponseTime).toBeLessThan(PERFORMANCE_SLA);

    // Verify rate limit headers
    responses.forEach((response, index) => {
      expect(response.headers['X-RateLimit-Limit']).toBe(String(rateLimitConfig.user.requests_per_hour));
      expect(response.headers['X-RateLimit-Remaining']).toBe(String(rateLimitConfig.user.requests_per_hour - index - 1));
      expect(response.headers['X-RateLimit-Reset']).toBeDefined();
    });

    // Verify 429 response when limit exceeded
    const exceededResponse = await client.get(TEST_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-User-ID': TEST_USER_ID
      },
      validateStatus: (status) => status === HTTP_STATUS.TOO_MANY_REQUESTS
    });

    expect(exceededResponse.status).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
    expect(exceededResponse.headers['Retry-After']).toBeDefined();
  });

  /**
   * Tests rate limiting for organization-level requests with concurrent load
   */
  test('should enforce organization rate limits under concurrent load', async () => {
    const authToken = await testApiClient.setupAuthToken('test-token', { validateToken: true });
    const client = apiClient.apiClient;
    const concurrentRequests = 100;

    // Create concurrent request pools
    const requestPools: Promise<ApiResponse<any>>[][] = [];
    const requestsPerPool = Math.floor(rateLimitConfig.organization.requests_per_hour / concurrentRequests);

    for (let i = 0; i < concurrentRequests; i++) {
      const pool = Array(requestsPerPool).fill(null).map(() =>
        client.get(TEST_ENDPOINT, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'X-Organization-ID': TEST_ORG_ID
          }
        })
      );
      requestPools.push(pool);
    }

    // Execute concurrent requests
    const startTime = Date.now();
    const results = await Promise.all(requestPools.map(pool => Promise.all(pool)));
    const endTime = Date.now();

    // Verify performance under load
    const totalRequests = results.flat().length;
    const averageResponseTime = (endTime - startTime) / totalRequests;
    expect(averageResponseTime).toBeLessThan(PERFORMANCE_SLA);

    // Verify organization quota enforcement
    const exceededResponse = await client.get(TEST_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Organization-ID': TEST_ORG_ID
      },
      validateStatus: (status) => status === HTTP_STATUS.TOO_MANY_REQUESTS
    });

    expect(exceededResponse.status).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
  });

  /**
   * Tests burst protection mechanisms
   */
  test('should enforce burst protection limits', async () => {
    const authToken = await testApiClient.setupAuthToken('test-token', { validateToken: true });
    const client = apiClient.apiClient;

    // Generate burst of concurrent requests
    const burstSize = rateLimitConfig.user.burst + 10;
    const burstRequests = Array(burstSize).fill(null).map(() =>
      client.get(TEST_ENDPOINT, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-User-ID': TEST_USER_ID
        },
        validateStatus: (status) => status === HTTP_STATUS.OK || status === HTTP_STATUS.TOO_MANY_REQUESTS
      })
    );

    const responses = await Promise.all(burstRequests);

    // Verify burst protection
    const successfulRequests = responses.filter(r => r.status === HTTP_STATUS.OK);
    const limitedRequests = responses.filter(r => r.status === HTTP_STATUS.TOO_MANY_REQUESTS);

    expect(successfulRequests.length).toBeLessThanOrEqual(rateLimitConfig.user.burst);
    expect(limitedRequests.length).toBeGreaterThan(0);
  });

  /**
   * Tests rate limit headers accuracy and format
   */
  test('should provide accurate rate limit headers', async () => {
    const authToken = await testApiClient.setupAuthToken('test-token', { validateToken: true });
    const client = apiClient.apiClient;

    // Make series of requests to verify header accuracy
    const response = await client.get(TEST_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-User-ID': TEST_USER_ID
      }
    });

    // Validate header format and values
    expect(response.headers['X-RateLimit-Limit']).toBe(String(rateLimitConfig.user.requests_per_hour));
    expect(response.headers['X-RateLimit-Remaining']).toBeDefined();
    expect(parseInt(response.headers['X-RateLimit-Remaining'])).toBeLessThan(rateLimitConfig.user.requests_per_hour);
    expect(response.headers['X-RateLimit-Reset']).toMatch(/^\d+$/);

    // Verify headers in error response
    const exceededResponse = await client.get(TEST_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-User-ID': TEST_USER_ID
      },
      validateStatus: (status) => status === HTTP_STATUS.TOO_MANY_REQUESTS
    });

    expect(exceededResponse.headers['Retry-After']).toBeDefined();
    expect(parseInt(exceededResponse.headers['Retry-After'])).toBeGreaterThan(0);
  });
});