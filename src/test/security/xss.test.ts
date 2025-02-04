/**
 * @fileoverview Comprehensive XSS (Cross-Site Scripting) security test suite
 * Implements automated security testing following OWASP Top 10 guidelines
 * with performance validation and security header verification.
 * @version 1.0.0
 */

import { generateSecurityTestData, validateSecurityHeaders } from '../utils/security-helpers';
import { testApiClient } from '../utils/api-client';
import { setupTestEnvironment } from '../utils/test-helpers';
import { jest } from '@jest/globals'; // ^29.5.0
import xss from 'xss'; // ^1.0.14
import { HTTP_STATUS, ERROR_CODES } from '../../backend/shared/constants/index';

// Test configuration constants
const XSS_TEST_TIMEOUT = 5000; // 5 seconds
const API_RESPONSE_SLA = 500; // 500ms SLA requirement

describe('XSS Security Tests', () => {
  let testEnv: any;
  let apiClient: ReturnType<typeof testApiClient.createTestApiClient>;

  beforeAll(async () => {
    testEnv = await setupTestEnvironment({
      securityValidation: true,
      performanceMonitoring: true
    });
    apiClient = testEnv.api;
  });

  afterAll(async () => {
    await testEnv?.cleanup?.();
  });

  describe('Input Validation Tests', () => {
    it('should sanitize task title and description with HTML5 attribute vectors', async () => {
      const testData = generateSecurityTestData('xss', {
        complexity: 'high',
        includePayloads: true
      });

      for (const { input, expected } of testData.testCases) {
        const startTime = Date.now();
        const response = await apiClient.apiClient.post('/api/v1/tasks', {
          title: input,
          description: input
        });

        // Validate response time against SLA
        expect(Date.now() - startTime).toBeLessThan(API_RESPONSE_SLA);

        // Validate sanitization
        expect(response.data.title).toBe(expected);
        expect(response.data.description).toBe(expected);
        
        // Validate security headers
        const headerValidation = validateSecurityHeaders(response.headers);
        expect(headerValidation.isValid).toBe(true);
      }
    });

    it('should validate project name and description with nested object injection', async () => {
      const maliciousPayload = {
        name: '<img src=x onerror=alert(1)>',
        description: `{"__proto__": {"toString": "alert(1)"}}`,
        metadata: {
          toString: function() { return 'xss'; }
        }
      };

      const response = await apiClient.apiClient.post('/api/v1/projects', maliciousPayload);
      
      expect(response.data.name).not.toContain('<img');
      expect(response.data.description).not.toContain('__proto__');
      expect(response.data.metadata).not.toHaveProperty('toString');
    });

    it('should prevent XSS in comment inputs with mixed HTML and JavaScript payloads', async () => {
      const maliciousComments = [
        '<script>alert(1)</script>',
        'javascript:alert(1)',
        `"onmouseover="alert(1)"`,
        `'--!><script>alert(1)</script>`,
        `<img src="x" onerror="alert(1)">`
      ];

      for (const comment of maliciousComments) {
        const startTime = Date.now();
        const response = await apiClient.apiClient.post('/api/v1/tasks/1/comments', {
          content: comment
        });

        // Validate response time
        expect(Date.now() - startTime).toBeLessThan(API_RESPONSE_SLA);

        // Verify sanitization
        expect(response.data.content).not.toMatch(/<script>|javascript:|onerror=|onmouseover=/i);
      }
    });
  });

  describe('Output Encoding Tests', () => {
    it('should properly encode user-generated content in responses', async () => {
      const testCases = [
        { context: 'html', input: '<script>alert(1)</script>', shouldContain: '&lt;script&gt;' },
        { context: 'attribute', input: '" onmouseover="alert(1)', shouldContain: '&quot;' },
        { context: 'javascript', input: '"; alert(1); //', shouldContain: '\\";' },
        { context: 'url', input: 'javascript:alert(1)', shouldContain: 'about:blank' }
      ];

      for (const testCase of testCases) {
        const startTime = Date.now();
        const response = await apiClient.apiClient.get('/api/v1/tasks', {
          params: { search: testCase.input }
        });

        // Validate response time
        expect(Date.now() - startTime).toBeLessThan(API_RESPONSE_SLA);

        // Verify encoding
        expect(response.data).toContain(testCase.shouldContain);
      }
    });

    it('should validate Content-Type consistency and charset specification', async () => {
      const response = await apiClient.apiClient.get('/api/v1/tasks');
      
      expect(response.headers['content-type']).toMatch(/^application\/json;\s*charset=utf-8$/i);
    });
  });

  describe('Content Security Policy Tests', () => {
    it('should validate CSP headers with nonce and strict-dynamic', async () => {
      const response = await apiClient.apiClient.get('/api/v1/tasks');
      const csp = response.headers['content-security-policy'];

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'strict-dynamic'");
      expect(csp).toMatch(/nonce-[a-zA-Z0-9+/]+=*/);
    });

    it('should enforce frame-ancestors and object-src restrictions', async () => {
      const response = await apiClient.apiClient.get('/api/v1/projects');
      const csp = response.headers['content-security-policy'];

      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
    });

    it('should validate report-uri configuration', async () => {
      const response = await apiClient.apiClient.get('/api/v1/tasks');
      const csp = response.headers['content-security-policy'];

      expect(csp).toMatch(/report-uri\s+https:\/\/[^\/]+\/csp-report/);
    });
  });
});

export default {
  testInputValidation: jest.fn(),
  testOutputEncoding: jest.fn(),
  testContentSecurityPolicy: jest.fn()
};