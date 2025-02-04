/**
 * @fileoverview Comprehensive CSRF protection test suite implementing OWASP Top 10 compliance testing
 * with enhanced token lifecycle management, header validation, and protection bypass prevention.
 * @version 1.0.0
 */

import { generateSecurityTestData, validateSecurityHeaders } from '../utils/security-helpers';
import { testApiClient } from '../utils/api-client';
import { setupTestEnvironment, teardownTestEnvironment } from '../utils/test-helpers';
import { HTTP_STATUS, ERROR_CODES } from '../../backend/shared/constants/index';

// Test environment configuration
const TEST_CONFIG = {
  validateSecurity: true,
  performanceMonitoring: true
};

// CSRF test constants
const CSRF_TEST_ENDPOINTS = {
  CREATE_TASK: '/api/v1/tasks',
  UPDATE_PROJECT: '/api/v1/projects/1',
  DELETE_COMMENT: '/api/v1/tasks/1/comments/1'
};

const CSRF_HEADERS = {
  'X-CSRF-Token': '',
  'Content-Type': 'application/json',
  'Origin': 'http://localhost:3000',
  'Referer': 'http://localhost:3000/tasks'
};

describe('CSRF Protection Tests', () => {
  let testEnv: any;
  let api: ReturnType<typeof testApiClient.createTestApiClient>;

  beforeAll(async () => {
    testEnv = await setupTestEnvironment(TEST_CONFIG);
    api = testApiClient.createTestApiClient({
      validateSecurity: true,
      timeout: 5000
    });
  });

  afterAll(async () => {
    await teardownTestEnvironment(testEnv);
  });

  describe('CSRF Token Validation', () => {
    it('should reject requests without CSRF token', async () => {
      const response = await api.apiClient.post(CSRF_TEST_ENDPOINTS.CREATE_TASK, {
        title: 'Test Task'
      }).catch(error => error.response);

      expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(response.data.errorCode).toBe(ERROR_CODES.INVALID_TOKEN);
    });

    it('should reject requests with invalid token format', async () => {
      const invalidToken = 'invalid-csrf-token';
      const response = await api.apiClient.post(
        CSRF_TEST_ENDPOINTS.CREATE_TASK,
        { title: 'Test Task' },
        { headers: { ...CSRF_HEADERS, 'X-CSRF-Token': invalidToken } }
      ).catch(error => error.response);

      expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(response.data.errorCode).toBe(ERROR_CODES.INVALID_TOKEN);
    });

    it('should reject expired CSRF tokens', async () => {
      const { testCases } = generateSecurityTestData('csrf', {
        complexity: 'high',
        includePayloads: true
      });

      const expiredToken = testCases[0].input;
      const response = await api.apiClient.post(
        CSRF_TEST_ENDPOINTS.CREATE_TASK,
        { title: 'Test Task' },
        { headers: { ...CSRF_HEADERS, 'X-CSRF-Token': expiredToken } }
      ).catch(error => error.response);

      expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(response.data.errorCode).toBe(ERROR_CODES.INVALID_TOKEN);
    });

    it('should properly rotate tokens after use', async () => {
      // Get initial token
      const tokenResponse = await api.apiClient.get('/api/v1/csrf-token');
      const initialToken = tokenResponse.data.token;

      // Use token in request
      await api.apiClient.post(
        CSRF_TEST_ENDPOINTS.CREATE_TASK,
        { title: 'Test Task' },
        { headers: { ...CSRF_HEADERS, 'X-CSRF-Token': initialToken } }
      );

      // Verify token has been rotated
      const newTokenResponse = await api.apiClient.get('/api/v1/csrf-token');
      expect(newTokenResponse.data.token).not.toBe(initialToken);
    });
  });

  describe('CSRF Header Requirements', () => {
    it('should validate Origin and Referer headers', async () => {
      const token = (await api.apiClient.get('/api/v1/csrf-token')).data.token;
      const invalidHeaders = {
        ...CSRF_HEADERS,
        'X-CSRF-Token': token,
        'Origin': 'https://malicious-site.com'
      };

      const response = await api.apiClient.post(
        CSRF_TEST_ENDPOINTS.CREATE_TASK,
        { title: 'Test Task' },
        { headers: invalidHeaders }
      ).catch(error => error.response);

      expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(response.data.errorCode).toBe(ERROR_CODES.INVALID_TOKEN);
    });

    it('should enforce SameSite cookie attributes', async () => {
      const cookieResponse = await api.apiClient.get('/api/v1/csrf-token');
      const csrfCookie = cookieResponse.headers['set-cookie'][0];

      expect(csrfCookie).toContain('SameSite=Strict');
      expect(csrfCookie).toContain('Secure');
      expect(csrfCookie).toContain('HttpOnly');
    });
  });

  describe('CSRF Protection Bypass Prevention', () => {
    it('should prevent token replay attacks', async () => {
      const token = (await api.apiClient.get('/api/v1/csrf-token')).data.token;

      // First request should succeed
      await api.apiClient.post(
        CSRF_TEST_ENDPOINTS.CREATE_TASK,
        { title: 'Test Task 1' },
        { headers: { ...CSRF_HEADERS, 'X-CSRF-Token': token } }
      );

      // Second request with same token should fail
      const response = await api.apiClient.post(
        CSRF_TEST_ENDPOINTS.CREATE_TASK,
        { title: 'Test Task 2' },
        { headers: { ...CSRF_HEADERS, 'X-CSRF-Token': token } }
      ).catch(error => error.response);

      expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(response.data.errorCode).toBe(ERROR_CODES.INVALID_TOKEN);
    });

    it('should detect and prevent token tampering', async () => {
      const token = (await api.apiClient.get('/api/v1/csrf-token')).data.token;
      const tamperedToken = token.slice(0, -1) + '1';

      const response = await api.apiClient.post(
        CSRF_TEST_ENDPOINTS.CREATE_TASK,
        { title: 'Test Task' },
        { headers: { ...CSRF_HEADERS, 'X-CSRF-Token': tamperedToken } }
      ).catch(error => error.response);

      expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(response.data.errorCode).toBe(ERROR_CODES.INVALID_TOKEN);
    });
  });

  describe('Performance Requirements', () => {
    it('should meet 500ms response time SLA', async () => {
      const startTime = Date.now();
      const token = (await api.apiClient.get('/api/v1/csrf-token')).data.token;

      await api.apiClient.post(
        CSRF_TEST_ENDPOINTS.CREATE_TASK,
        { title: 'Test Task' },
        { headers: { ...CSRF_HEADERS, 'X-CSRF-Token': token } }
      );

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500);
    });
  });
});