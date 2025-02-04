/**
 * @fileoverview Integration tests for authentication service with comprehensive security validation,
 * performance monitoring, and compliance testing for all authentication flows.
 * @version 1.0.0
 */

import { AuthService } from '../../backend/auth-service/src/services/auth.service';
import { TestDatabaseManager } from '../utils/test-database';
import { SecurityTestHelpers } from '../utils/security-helpers';
import { HTTP_STATUS, ERROR_CODES, AUDIT_EVENTS } from '../../backend/shared/constants';
import { Logger } from '../../backend/shared/utils/logger';
import { validateSecurityHeaders } from '../utils/security-helpers';
import { waitForAsyncOperation } from '../utils/test-helpers';

// Initialize logger for test monitoring
const logger = new Logger('AuthServiceIntegrationTests', {
  defaultMetadata: { context: 'auth-testing' }
});

describe('AuthService Integration Tests', () => {
  let authService: AuthService;
  let dbManager: TestDatabaseManager;
  let securityHelpers: SecurityTestHelpers;

  // Test user credentials
  const TEST_USER = {
    email: 'test@example.com',
    password: 'Test123!',
    mfaSecret: 'BASE32SECRET'
  };

  const TEST_ADMIN = {
    email: 'admin@example.com',
    password: 'Admin123!',
    mfaSecret: 'BASE32ADMINSCRET'
  };

  // Security thresholds
  const SECURITY_THRESHOLDS = {
    maxLoginAttempts: 3,
    tokenExpiry: '15m',
    mfaTimeout: '5m'
  };

  beforeAll(async () => {
    // Set up secure test environment
    const startTime = Date.now();
    try {
      // Initialize test database with encryption
      dbManager = new TestDatabaseManager();
      await dbManager.init();

      // Set up security helpers
      securityHelpers = new SecurityTestHelpers();

      // Initialize auth service with security configuration
      authService = new AuthService(
        new Logger('AuthService'),
        securityHelpers.rateLimiter,
        securityHelpers.deviceTracker,
        securityHelpers.tokenManager
      );

      logger.info('Test environment setup completed', {
        duration: Date.now() - startTime
      });
    } catch (error) {
      logger.error('Failed to setup test environment', error);
      throw error;
    }
  });

  afterAll(async () => {
    // Clean up test environment securely
    try {
      await dbManager.cleanup();
      await securityHelpers.cleanup();
      logger.info('Test environment cleaned up successfully');
    } catch (error) {
      logger.error('Failed to cleanup test environment', error);
      throw error;
    }
  });

  describe('User Authentication Flow', () => {
    it('should successfully authenticate valid user credentials with security validation', async () => {
      const deviceInfo = {
        fingerprint: 'test-device-fingerprint',
        userAgent: 'test-user-agent',
        ipAddress: '127.0.0.1'
      };

      const result = await waitForAsyncOperation(
        async () => {
          return await authService.login(
            TEST_USER.email,
            TEST_USER.password,
            deviceInfo
          );
        },
        5000,
        { performanceThreshold: 500 }
      );

      expect(result.result).toBeDefined();
      expect(result.result.accessToken).toBeDefined();
      expect(result.result.refreshToken).toBeDefined();
      expect(result.metrics.duration).toBeLessThan(500);

      // Validate security headers
      const securityValidation = await securityHelpers.validateSecurityHeaders({
        Authorization: `Bearer ${result.result.accessToken}`,
        'X-Request-ID': result.result.requestId,
        'Content-Security-Policy': "default-src 'self'"
      });

      expect(securityValidation.isValid).toBe(true);
    });

    it('should enforce rate limiting for failed login attempts', async () => {
      const deviceInfo = {
        fingerprint: 'test-device-fingerprint',
        userAgent: 'test-user-agent',
        ipAddress: '127.0.0.1'
      };

      // Attempt multiple failed logins
      for (let i = 0; i < SECURITY_THRESHOLDS.maxLoginAttempts; i++) {
        try {
          await authService.login(
            TEST_USER.email,
            'wrong-password',
            deviceInfo
          );
          fail('Should have thrown rate limit error');
        } catch (error: any) {
          expect(error.errorCode).toBe(ERROR_CODES.AUTH_ERROR);
        }
      }

      // Verify rate limit is enforced
      try {
        await authService.login(
          TEST_USER.email,
          TEST_USER.password,
          deviceInfo
        );
        fail('Should have thrown rate limit exceeded error');
      } catch (error: any) {
        expect(error.errorCode).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED);
      }
    });

    it('should successfully set up and verify MFA', async () => {
      const deviceInfo = {
        fingerprint: 'test-device-fingerprint',
        userAgent: 'test-user-agent',
        ipAddress: '127.0.0.1'
      };

      // Set up MFA
      const mfaSetup = await authService.setupMFA(
        'test-user-id',
        deviceInfo
      );

      expect(mfaSetup.secret).toBeDefined();
      expect(mfaSetup.qrCode).toBeDefined();
      expect(mfaSetup.backupCodes).toHaveLength(10);

      // Verify MFA token
      const verificationResult = await authService.verifyMFA(
        'test-user-id',
        mfaSetup.secret,
        deviceInfo
      );

      expect(verificationResult.success).toBe(true);
    });

    it('should handle OAuth authentication flow securely', async () => {
      const deviceInfo = {
        fingerprint: 'test-device-fingerprint',
        userAgent: 'test-user-agent',
        ipAddress: '127.0.0.1'
      };

      const oauthResult = await authService.handleOAuthLogin(
        'test-oauth-code',
        'test-state',
        deviceInfo
      );

      expect(oauthResult.accessToken).toBeDefined();
      expect(oauthResult.refreshToken).toBeDefined();

      // Validate OAuth security requirements
      const securityValidation = await securityHelpers.validateSecurityHeaders({
        Authorization: `Bearer ${oauthResult.accessToken}`,
        'X-Request-ID': oauthResult.requestId,
        'Content-Security-Policy': "default-src 'self'"
      });

      expect(securityValidation.isValid).toBe(true);
    });

    it('should securely refresh authentication tokens', async () => {
      const deviceInfo = {
        fingerprint: 'test-device-fingerprint',
        userAgent: 'test-user-agent',
        ipAddress: '127.0.0.1'
      };

      // Initial login
      const loginResult = await authService.login(
        TEST_USER.email,
        TEST_USER.password,
        deviceInfo
      );

      // Refresh token
      const refreshResult = await authService.refreshToken(
        loginResult.refreshToken,
        deviceInfo
      );

      expect(refreshResult.accessToken).toBeDefined();
      expect(refreshResult.refreshToken).toBeDefined();
      expect(refreshResult.accessToken).not.toBe(loginResult.accessToken);
      expect(refreshResult.refreshToken).not.toBe(loginResult.refreshToken);

      // Validate token security
      const securityValidation = await securityHelpers.validateSecurityHeaders({
        Authorization: `Bearer ${refreshResult.accessToken}`,
        'X-Request-ID': refreshResult.requestId,
        'Content-Security-Policy': "default-src 'self'"
      });

      expect(securityValidation.isValid).toBe(true);
    });
  });

  describe('Security Validation', () => {
    it('should validate security headers for all requests', async () => {
      const headers = {
        Authorization: 'Bearer test-token',
        'X-Request-ID': 'test-request-id',
        'Content-Security-Policy': "default-src 'self'",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      };

      const validation = await authService.validateSecurityHeaders(headers);
      expect(validation.success).toBe(true);
    });

    it('should enforce rate limits for API requests', async () => {
      const deviceInfo = {
        fingerprint: 'test-device-fingerprint',
        userAgent: 'test-user-agent',
        ipAddress: '127.0.0.1'
      };

      const rateLimitCheck = await authService.checkRateLimits(deviceInfo);
      expect(rateLimitCheck.remaining).toBeGreaterThan(0);
      expect(rateLimitCheck.resetTime).toBeDefined();
    });
  });
});