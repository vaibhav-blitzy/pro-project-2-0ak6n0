/**
 * @fileoverview API integration tests for search service functionality
 * Implements comprehensive testing of search operations, performance requirements,
 * and security validations with enhanced monitoring capabilities.
 * @version 1.0.0
 */

import { testApiClient } from '../utils/api-client';
import { setupTestEnvironment } from '../utils/test-helpers';
import { ISearchQuery } from '../../backend/search-service/src/interfaces/search.interface';
import { SEARCH } from '../../web/src/constants/api.constants';
import { HTTP_STATUS } from '../../backend/shared/constants';

// Performance thresholds from technical specification
const PERFORMANCE_THRESHOLDS = {
  SIMPLE_SEARCH: 200, // ms
  COMPLEX_SEARCH: 500, // ms
  DEGRADATION_THRESHOLD: 0.9 // 90% of threshold
};

describe('Search API Integration Tests', () => {
  const { apiClient, metrics } = testApiClient.createTestApiClient({
    validateSecurity: true,
    performanceMonitoring: true
  });

  let testEnvironment: any;

  beforeAll(async () => {
    // Setup test environment with security validation and monitoring
    testEnvironment = await setupTestEnvironment({
      securityValidation: true,
      performanceMonitoring: true
    });

    // Verify Elasticsearch cluster health
    const healthCheck = await apiClient.get(`${SEARCH.BASE}/health`);
    expect(healthCheck.status).toBe(HTTP_STATUS.OK);
    expect(healthCheck.data.status).toBe('green');
  });

  afterAll(async () => {
    await testEnvironment?.cleanup();
  });

  describe('Simple Search Operations', () => {
    it('should perform simple search within performance threshold', async () => {
      // Prepare simple search query with security context
      const searchQuery: ISearchQuery = {
        query: 'test document',
        filters: {
          status: 'active'
        },
        pagination: {
          page: 1,
          limit: 10,
          sortBy: 'relevance',
          sortOrder: 'desc'
        },
        timeout: '200ms'
      };

      const startTime = Date.now();

      const response = await apiClient.post(SEARCH.BASE, searchQuery);

      const duration = Date.now() - startTime;

      // Validate response structure and security
      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.data.success).toBe(true);
      expect(response.headers['content-security-policy']).toBeDefined();

      // Validate performance requirements
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SIMPLE_SEARCH);
      expect(response.data.took).toBeLessThan(PERFORMANCE_THRESHOLDS.SIMPLE_SEARCH);

      // Validate search results
      expect(Array.isArray(response.data.hits)).toBe(true);
      expect(response.data.timedOut).toBe(false);
    });

    it('should detect performance degradation in simple search', async () => {
      const degradationThreshold = PERFORMANCE_THRESHOLDS.SIMPLE_SEARCH * PERFORMANCE_THRESHOLDS.DEGRADATION_THRESHOLD;
      
      const searchTimes: number[] = [];
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await apiClient.post(SEARCH.BASE, {
          query: 'performance test',
          timeout: '200ms'
        });
        searchTimes.push(Date.now() - startTime);
      }

      const averageTime = searchTimes.reduce((a, b) => a + b) / searchTimes.length;
      expect(averageTime).toBeLessThan(degradationThreshold);
    });
  });

  describe('Complex Search Operations', () => {
    it('should perform complex search within performance threshold', async () => {
      // Prepare complex search query with advanced filters
      const complexQuery: ISearchQuery = {
        query: 'technical documentation',
        filters: {
          status: 'active',
          category: ['development', 'architecture'],
          dateRange: {
            from: new Date(Date.now() - 86400000).toISOString(),
            to: new Date().toISOString()
          }
        },
        pagination: {
          page: 1,
          limit: 20,
          sortBy: 'relevance',
          sortOrder: 'desc'
        },
        analyzer: 'custom_analyzer',
        timeout: '500ms'
      };

      const startTime = Date.now();

      const response = await apiClient.post(SEARCH.ADVANCED, complexQuery);

      const duration = Date.now() - startTime;

      // Validate response and security
      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.headers['x-request-id']).toBeDefined();

      // Validate performance requirements
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPLEX_SEARCH);
      expect(response.data.took).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPLEX_SEARCH);

      // Validate advanced search features
      expect(response.data.aggregations).toBeDefined();
      expect(response.data.suggestions).toBeDefined();
    });

    it('should handle search failures gracefully', async () => {
      const invalidQuery: ISearchQuery = {
        query: 'test',
        filters: {
          invalidField: 'value'
        },
        pagination: {
          page: -1, // Invalid page number
          limit: 1000, // Exceeds limit
          sortBy: 'invalid',
          sortOrder: 'invalid'
        }
      };

      const response = await apiClient.post(SEARCH.BASE, invalidQuery)
        .catch(error => error.response);

      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(response.data.success).toBe(false);
      expect(response.data.errorCode).toBeDefined();
    });
  });

  describe('Search Security Validation', () => {
    it('should enforce security headers in search requests', async () => {
      const response = await apiClient.post(SEARCH.BASE, {
        query: 'security test'
      });

      // Validate security headers
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-api-version']).toBeDefined();
    });

    it('should validate rate limiting compliance', async () => {
      const requests = Array(15).fill(null).map(() => 
        apiClient.post(SEARCH.BASE, { query: 'rate limit test' })
      );

      const responses = await Promise.all(requests.map(p => p.catch(e => e.response)));
      
      const rateLimited = responses.some(r => r.status === HTTP_STATUS.TOO_MANY_REQUESTS);
      expect(rateLimited).toBe(true);
    });
  });

  describe('Search Cluster Health', () => {
    it('should verify cluster failover capabilities', async () => {
      const healthCheck = await apiClient.get(`${SEARCH.BASE}/health`);
      
      expect(healthCheck.data.numberOfNodes).toBeGreaterThan(1);
      expect(healthCheck.data.activeShards).toBeGreaterThan(0);
      expect(healthCheck.data.relocatingShards).toBe(0);
    });

    it('should monitor search performance metrics', async () => {
      const metricsResponse = await apiClient.get(`${SEARCH.BASE}/metrics`);
      
      expect(metricsResponse.status).toBe(HTTP_STATUS.OK);
      expect(metricsResponse.data.metrics).toHaveProperty('searchLatency');
      expect(metricsResponse.data.metrics).toHaveProperty('queryThroughput');
    });
  });
});