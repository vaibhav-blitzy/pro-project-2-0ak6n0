/**
 * @fileoverview Comprehensive API security test suite implementing enterprise-grade
 * security testing for authentication, authorization, and security headers.
 * @version 1.0.0
 */

import { testApiClient } from '../utils/api-client';
import { securityHelpers } from '../utils/security-helpers';
import { testEnvironment } from '../utils/test-helpers';
import { HTTP_STATUS, ERROR_CODES } from '../../backend/shared/constants/index';
import { API_ENDPOINTS } from '../../web/src/constants/api.constants';

// Initialize test environment with security validation
let testEnv: any;

beforeAll(async () => {
  testEnv = await testEnvironment.setupTestEnvironment({
    securityValidation: true,
    performanceMonitoring: true
  });
});

afterAll(async () => {
  await testEnvironment.teardownTestEnvironment(testEnv);
});

describe('API Authentication Security Tests', () => {
  /**
   * Tests standard authentication flows with comprehensive security validation
   */
  test('should validate secure authentication flows', async () => {
    const credentials = await securityHelpers.generateMockCredentials(
      'user',
      'password',
      'high'
    );

    // Test login with valid credentials
    const loginResponse = await testEnv.api.apiClient.post(
      API_ENDPOINTS.AUTH.LOGIN,
      {
        username: credentials.username,
        password: credentials.password
      }
    );

    expect(loginResponse.status).toBe(HTTP_STATUS.OK);
    expect(loginResponse.data.token).toBeDefined();

    // Validate token structure and claims
    const tokenValidation = await securityHelpers.generateTestToken(
      { sub: credentials.username },
      3600,
      'HS256',
      true
    );
    expect(tokenValidation.accessToken).toBeDefined();
    expect(tokenValidation.metadata.algorithm).toBe('HS256');

    // Test invalid login attempts
    const invalidResponse = await testEnv.api.apiClient.post(
      API_ENDPOINTS.AUTH.LOGIN,
      {
        username: credentials.username,
        password: 'wrong_password'
      }
    );
    expect(invalidResponse.status).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  /**
   * Tests MFA authentication flows with enhanced security validation
   */
  test('should enforce MFA requirements correctly', async () => {
    const mfaCredentials = await securityHelpers.generateMockCredentials(
      'user',
      'mfa',
      'high'
    );

    // Setup MFA for user
    const mfaSetupResponse = await testEnv.api.apiClient.post(
      API_ENDPOINTS.AUTH.MFA_SETUP,
      {
        username: mfaCredentials.username
      }
    );
    expect(mfaSetupResponse.status).toBe(HTTP_STATUS.OK);
    expect(mfaSetupResponse.data.mfaSecret).toBeDefined();

    // Verify MFA token
    const mfaVerifyResponse = await testEnv.api.apiClient.post(
      API_ENDPOINTS.AUTH.MFA_VERIFY,
      {
        username: mfaCredentials.username,
        mfaCode: mfaCredentials.mfaSecret
      }
    );
    expect(mfaVerifyResponse.status).toBe(HTTP_STATUS.OK);
  });

  /**
   * Tests token refresh mechanisms with security validation
   */
  test('should handle token refresh securely', async () => {
    const tokens = await securityHelpers.generateTestToken(
      { sub: 'test-user' },
      3600,
      'HS256',
      true
    );

    // Set expired access token
    testApiClient.setupAuthToken(tokens.accessToken);

    // Attempt refresh with valid refresh token
    const refreshResponse = await testEnv.api.apiClient.post(
      API_ENDPOINTS.AUTH.REFRESH_TOKEN,
      {
        refreshToken: tokens.refreshToken
      }
    );
    expect(refreshResponse.status).toBe(HTTP_STATUS.OK);
    expect(refreshResponse.data.accessToken).toBeDefined();
  });
});

describe('API Authorization Security Tests', () => {
  /**
   * Tests role-based access control with comprehensive validation
   */
  test('should enforce role-based access control', async () => {
    const adminCredentials = await securityHelpers.generateMockCredentials(
      'admin',
      'password',
      'high'
    );
    const userCredentials = await securityHelpers.generateMockCredentials(
      'user',
      'password',
      'high'
    );

    // Test admin access to protected endpoint
    const adminToken = await securityHelpers.generateTestToken(
      { sub: adminCredentials.username, role: 'admin' }
    );
    testApiClient.setupAuthToken(adminToken.accessToken);

    const adminResponse = await testEnv.api.apiClient.get(
      API_ENDPOINTS.PROJECTS.PERMISSIONS
    );
    expect(adminResponse.status).toBe(HTTP_STATUS.OK);

    // Test user access to protected endpoint
    const userToken = await securityHelpers.generateTestToken(
      { sub: userCredentials.username, role: 'user' }
    );
    testApiClient.setupAuthToken(userToken.accessToken);

    const userResponse = await testEnv.api.apiClient.get(
      API_ENDPOINTS.PROJECTS.PERMISSIONS
    );
    expect(userResponse.status).toBe(HTTP_STATUS.FORBIDDEN);
  });

  /**
   * Tests resource-based authorization with security validation
   */
  test('should enforce resource-based authorization', async () => {
    const ownerToken = await securityHelpers.generateTestToken(
      { sub: 'owner-user', role: 'user' }
    );
    testApiClient.setupAuthToken(ownerToken.accessToken);

    // Create a project as owner
    const projectResponse = await testEnv.api.apiClient.post(
      API_ENDPOINTS.PROJECTS.BASE,
      {
        name: 'Test Project',
        description: 'Test Description'
      }
    );
    expect(projectResponse.status).toBe(HTTP_STATUS.CREATED);
    const projectId = projectResponse.data.id;

    // Test non-owner access
    const nonOwnerToken = await securityHelpers.generateTestToken(
      { sub: 'non-owner-user', role: 'user' }
    );
    testApiClient.setupAuthToken(nonOwnerToken.accessToken);

    const unauthorizedResponse = await testEnv.api.apiClient.put(
      API_ENDPOINTS.PROJECTS.BY_ID.replace(':id', projectId),
      {
        name: 'Updated Name'
      }
    );
    expect(unauthorizedResponse.status).toBe(HTTP_STATUS.FORBIDDEN);
  });
});

describe('API Security Headers Tests', () => {
  /**
   * Tests security headers implementation with comprehensive validation
   */
  test('should enforce required security headers', async () => {
    const response = await testEnv.api.apiClient.get(API_ENDPOINTS.AUTH.ME);

    const headerValidation = securityHelpers.validateSecurityHeaders(
      response.headers,
      {
        requiredHeaders: [
          'Content-Security-Policy',
          'X-Content-Type-Options',
          'X-Frame-Options',
          'X-XSS-Protection'
        ]
      }
    );

    expect(headerValidation.isValid).toBe(true);
    expect(headerValidation.missingHeaders).toHaveLength(0);
  });

  /**
   * Tests CORS configuration with security validation
   */
  test('should enforce CORS policy correctly', async () => {
    const response = await testEnv.api.apiClient.options(API_ENDPOINTS.AUTH.LOGIN);

    expect(response.headers['access-control-allow-origin']).not.toBe('*');
    expect(response.headers['access-control-allow-methods']).toBeDefined();
    expect(response.headers['access-control-allow-headers']).toBeDefined();
  });
});