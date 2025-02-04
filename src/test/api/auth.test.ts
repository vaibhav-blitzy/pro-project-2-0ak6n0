/**
 * @fileoverview Comprehensive API integration test suite for authentication endpoints
 * Implements thorough testing of all authentication flows with security validations
 * @version 1.0.0
 */

import { testApiClient } from '../utils/api-client';
import { generateMockUser } from '../utils/mock-data';
import { IUser, UserRole } from '../../backend/auth-service/src/interfaces/auth.interface';
import { API_ENDPOINTS } from '../../web/src/constants/api.constants';
import speakeasy from 'speakeasy'; // ^2.0.0
import { jest } from '@jest/globals';

// Test configuration constants
const TEST_TIMEOUT = 10000;
const RATE_LIMIT_REQUESTS = 1000;
const MAX_RESPONSE_TIME = 500;

describe('Authentication API Integration Tests', () => {
  const { createTestApiClient, setupAuthToken, mockApiResponse } = testApiClient;
  let apiClient: ReturnType<typeof createTestApiClient>;
  let mockUser: IUser;

  beforeAll(async () => {
    // Initialize test API client with security configurations
    apiClient = createTestApiClient({
      baseURL: process.env.API_BASE_URL || 'http://localhost:3000/api',
      timeout: TEST_TIMEOUT,
      validateSecurity: true,
      useMockAdapter: false,
      retryConfig: {
        attempts: 3,
        delay: 1000
      }
    });

    // Generate mock user for testing
    mockUser = generateMockUser(UserRole.MEMBER);
  });

  afterAll(async () => {
    // Clean up test environment
    await apiClient.apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
    clearAuthToken();
  });

  describe('Login Flow', () => {
    it('should successfully login with valid credentials', async () => {
      const response = await apiClient.apiClient.post(API_ENDPOINTS.AUTH.LOGIN, {
        email: mockUser.email,
        password: mockUser.password
      });

      expect(response.status).toBe(200);
      expect(response.data.accessToken).toBeDefined();
      expect(response.data.refreshToken).toBeDefined();
      expect(response.headers['x-rate-limit-remaining']).toBeDefined();
      expect(apiClient.metrics.getAverageResponseTime()).toBeLessThan(MAX_RESPONSE_TIME);
    });

    it('should enforce rate limiting', async () => {
      const requests = Array(RATE_LIMIT_REQUESTS + 1).fill(null);
      
      await expect(async () => {
        await Promise.all(requests.map(() => 
          apiClient.apiClient.post(API_ENDPOINTS.AUTH.LOGIN, {
            email: mockUser.email,
            password: mockUser.password
          })
        ));
      }).rejects.toThrow(/rate limit exceeded/i);
    });

    it('should handle brute force protection', async () => {
      const invalidAttempts = Array(5).fill(null);
      
      for (const _ of invalidAttempts) {
        await expect(
          apiClient.apiClient.post(API_ENDPOINTS.AUTH.LOGIN, {
            email: mockUser.email,
            password: 'invalid_password'
          })
        ).rejects.toThrow(/invalid credentials/i);
      }

      // Verify account lockout
      const response = await apiClient.apiClient.post(API_ENDPOINTS.AUTH.LOGIN, {
        email: mockUser.email,
        password: mockUser.password
      });
      expect(response.status).toBe(401);
      expect(response.data.error).toMatch(/account locked/i);
    });
  });

  describe('MFA Flow', () => {
    let mfaSecret: string;

    beforeEach(async () => {
      // Setup MFA for testing
      const response = await apiClient.apiClient.post(API_ENDPOINTS.AUTH.MFA_SETUP);
      mfaSecret = response.data.secret;
    });

    it('should successfully setup MFA', async () => {
      const token = speakeasy.totp({
        secret: mfaSecret,
        encoding: 'base32'
      });

      const response = await apiClient.apiClient.post(API_ENDPOINTS.AUTH.MFA_VERIFY, {
        token
      });

      expect(response.status).toBe(200);
      expect(response.data.mfaEnabled).toBe(true);
    });

    it('should require valid MFA token for login', async () => {
      // First login step
      await apiClient.apiClient.post(API_ENDPOINTS.AUTH.LOGIN, {
        email: mockUser.email,
        password: mockUser.password
      });

      // MFA verification step
      const token = speakeasy.totp({
        secret: mfaSecret,
        encoding: 'base32'
      });

      const response = await apiClient.apiClient.post(API_ENDPOINTS.AUTH.MFA_VERIFY, {
        token
      });

      expect(response.status).toBe(200);
      expect(response.data.accessToken).toBeDefined();
    });
  });

  describe('OAuth Flow', () => {
    const mockOAuthState = 'mock_state_token';
    const mockAuthCode = 'mock_auth_code';

    beforeEach(() => {
      // Mock OAuth provider endpoints
      mockApiResponse('GET', API_ENDPOINTS.AUTH.SSO_LOGIN.replace(':provider', 'google'), {
        authorizationUrl: 'https://mock-oauth-provider.com/auth'
      });
    });

    it('should initiate OAuth flow with state validation', async () => {
      const response = await apiClient.apiClient.get(
        API_ENDPOINTS.AUTH.SSO_LOGIN.replace(':provider', 'google')
      );

      expect(response.status).toBe(200);
      expect(response.data.authorizationUrl).toContain('state=');
    });

    it('should handle OAuth callback with valid state', async () => {
      const response = await apiClient.apiClient.get(
        `${API_ENDPOINTS.AUTH.SSO_CALLBACK.replace(':provider', 'google')}?code=${mockAuthCode}&state=${mockOAuthState}`
      );

      expect(response.status).toBe(200);
      expect(response.data.accessToken).toBeDefined();
      expect(response.data.refreshToken).toBeDefined();
    });
  });

  describe('Token Management', () => {
    it('should refresh access token', async () => {
      const loginResponse = await apiClient.apiClient.post(API_ENDPOINTS.AUTH.LOGIN, {
        email: mockUser.email,
        password: mockUser.password
      });

      const response = await apiClient.apiClient.post(API_ENDPOINTS.AUTH.REFRESH_TOKEN, {
        refreshToken: loginResponse.data.refreshToken
      });

      expect(response.status).toBe(200);
      expect(response.data.accessToken).toBeDefined();
      expect(response.data.refreshToken).not.toBe(loginResponse.data.refreshToken);
    });

    it('should detect token tampering', async () => {
      const tampered_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered';
      
      await expect(
        apiClient.apiClient.get(API_ENDPOINTS.AUTH.ME, {
          headers: { Authorization: `Bearer ${tampered_token}` }
        })
      ).rejects.toThrow(/invalid token/i);
    });
  });

  describe('Security Headers', () => {
    it('should include required security headers', async () => {
      const response = await apiClient.apiClient.get(API_ENDPOINTS.AUTH.ME);

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });
});