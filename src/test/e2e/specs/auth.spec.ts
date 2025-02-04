/**
 * @fileoverview End-to-end test suite for authentication and authorization functionality
 * implementing comprehensive security testing, OWASP guidelines, and compliance validation.
 * @version 1.0.0
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from 'jest';
import supertest from 'supertest'; // ^6.3.3
import { testcontainers } from 'testcontainers'; // ^9.3.0
import { TestContext } from '../../utils/test-helpers';
import { users } from '../fixtures/users.json';
import { HTTP_STATUS, ERROR_CODES } from '../../../backend/shared/constants';
import { UserRole } from '../../../backend/auth-service/src/interfaces/auth.interface';

// Initialize test context and supertest instance
const testContext = new TestContext();
let request: supertest.SuperTest<supertest.Test>;

// Security test configuration
const SECURITY_CONFIG = {
  maxLoginAttempts: 5,
  passwordMinLength: 12,
  mfaTimeoutSeconds: 30,
  sessionTimeoutMinutes: 60,
  rateLimitRequests: 100,
  rateLimitWindow: '15m'
};

describe('Authentication Security E2E Tests', () => {
  beforeAll(async () => {
    await testContext.initialize({
      enableSecurity: true,
      enableAudit: true,
      enableRateLimit: true
    });
    request = supertest(testContext.app);
  });

  afterAll(async () => {
    await testContext.cleanup();
  });

  beforeEach(async () => {
    await testContext.setupSecurityContext();
  });

  afterEach(async () => {
    await testContext.resetSecurityContext();
  });

  describe('User Registration Security', () => {
    it('should enforce password complexity requirements', async () => {
      const weakPasswords = [
        'short',
        '12345678',
        'onlyletters',
        'NoSpecialChars123',
        'No@numbers',
        'no-upper-case-1@'
      ];

      for (const password of weakPasswords) {
        const response = await request
          .post('/api/v1/auth/register')
          .send({
            email: 'test@example.com',
            password,
            firstName: 'Test',
            lastName: 'User'
          });

        expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
        expect(response.body.errorCode).toBe(ERROR_CODES.VALIDATION_ERROR);
        expect(response.body.details).toContain('password');
      }
    });

    it('should prevent SQL injection in registration fields', async () => {
      const maliciousInput = {
        email: "'; DROP TABLE users; --",
        password: "' OR '1'='1",
        firstName: '<script>alert("xss")</script>',
        lastName: '${process.env.SECRET_KEY}'
      };

      const response = await request
        .post('/api/v1/auth/register')
        .send(maliciousInput);

      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should enforce rate limiting on registration endpoint', async () => {
      const attempts = Array(SECURITY_CONFIG.rateLimitRequests + 1).fill(null);
      
      for (const [index] of attempts.entries()) {
        const response = await request
          .post('/api/v1/auth/register')
          .send({
            email: `test${index}@example.com`,
            password: 'ValidP@ssw0rd123!',
            firstName: 'Test',
            lastName: 'User'
          });

        if (index >= SECURITY_CONFIG.rateLimitRequests) {
          expect(response.status).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
          expect(response.headers['retry-after']).toBeDefined();
        }
      }
    });
  });

  describe('Authentication Security', () => {
    it('should implement brute force protection', async () => {
      const invalidAttempts = Array(SECURITY_CONFIG.maxLoginAttempts + 1).fill(null);
      
      for (const [index] of invalidAttempts.entries()) {
        const response = await request
          .post('/api/v1/auth/login')
          .send({
            email: users.users[0].email,
            password: 'WrongPassword123!'
          });

        if (index >= SECURITY_CONFIG.maxLoginAttempts) {
          expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
          expect(response.body.errorCode).toBe(ERROR_CODES.AUTH_ERROR);
          expect(response.body.message).toContain('account locked');
        }
      }
    });

    it('should enforce MFA validation when enabled', async () => {
      const mfaUser = users.users.find(u => u.mfaEnabled);
      
      // First step: Password authentication
      const loginResponse = await request
        .post('/api/v1/auth/login')
        .send({
          email: mfaUser.email,
          password: 'ValidP@ssw0rd123!'
        });

      expect(loginResponse.status).toBe(HTTP_STATUS.OK);
      expect(loginResponse.body.requiresMfa).toBe(true);
      expect(loginResponse.body.mfaToken).toBeDefined();

      // Second step: Invalid MFA code
      const mfaResponse = await request
        .post('/api/v1/auth/mfa/verify')
        .send({
          mfaToken: loginResponse.body.mfaToken,
          mfaCode: '000000'
        });

      expect(mfaResponse.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it('should validate security headers in responses', async () => {
      const response = await request
        .post('/api/v1/auth/login')
        .send({
          email: users.users[0].email,
          password: 'ValidP@ssw0rd123!'
        });

      const requiredHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
        'content-security-policy',
        'strict-transport-security'
      ];

      for (const header of requiredHeaders) {
        expect(response.headers[header]).toBeDefined();
      }
    });
  });

  describe('Authorization Security', () => {
    it('should prevent role elevation attacks', async () => {
      const memberUser = users.users.find(u => u.role === UserRole.MEMBER);
      const adminUser = users.users.find(u => u.role === UserRole.ADMIN);

      // Login as member
      const loginResponse = await request
        .post('/api/v1/auth/login')
        .send({
          email: memberUser.email,
          password: 'ValidP@ssw0rd123!'
        });

      const token = loginResponse.body.accessToken;

      // Attempt to modify own role
      const response = await request
        .patch(`/api/v1/users/${memberUser.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          role: UserRole.ADMIN
        });

      expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
    });

    it('should validate permission boundaries', async () => {
      const memberUser = users.users.find(u => u.role === UserRole.MEMBER);
      const adminUser = users.users.find(u => u.role === UserRole.ADMIN);

      // Login as member
      const loginResponse = await request
        .post('/api/v1/auth/login')
        .send({
          email: memberUser.email,
          password: 'ValidP@ssw0rd123!'
        });

      const token = loginResponse.body.accessToken;

      // Attempt to access admin endpoints
      const restrictedEndpoints = [
        '/api/v1/admin/users',
        '/api/v1/admin/settings',
        '/api/v1/admin/audit-logs'
      ];

      for (const endpoint of restrictedEndpoints) {
        const response = await request
          .get(endpoint)
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
      }
    });

    it('should verify audit trails for security events', async () => {
      const adminUser = users.users.find(u => u.role === UserRole.ADMIN);

      // Login as admin
      const loginResponse = await request
        .post('/api/v1/auth/login')
        .send({
          email: adminUser.email,
          password: 'ValidP@ssw0rd123!'
        });

      const token = loginResponse.body.accessToken;

      // Perform sensitive operation
      await request
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'newuser@example.com',
          role: UserRole.MEMBER
        });

      // Verify audit log
      const auditResponse = await request
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${token}`);

      expect(auditResponse.status).toBe(HTTP_STATUS.OK);
      expect(auditResponse.body.logs).toContainEqual(
        expect.objectContaining({
          action: 'CREATE_USER',
          actor: adminUser.id,
          success: true
        })
      );
    });
  });
});