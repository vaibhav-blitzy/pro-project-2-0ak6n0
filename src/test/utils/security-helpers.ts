/**
 * @fileoverview Advanced security testing utility module providing comprehensive security validation
 * and testing capabilities for enterprise applications with enhanced JWT, OAuth, and security header testing.
 * @version 1.0.0
 */

import jwt from 'jsonwebtoken'; // ^9.0.0
import bcrypt from 'bcrypt'; // ^5.1.0
import { faker } from '@faker-js/faker'; // ^8.0.0
import { validateSchema, sanitizeInput } from '../../backend/shared/utils/validation';
import { TestContext } from './test-helpers';
import { HTTP_STATUS, ERROR_CODES, VALIDATION_RULES } from '../../backend/shared/constants/index';

// Security configuration constants
const SECURITY_CONFIG = {
  JWT_ALGORITHMS: ['HS256', 'RS256', 'ES256'],
  SALT_ROUNDS: 12,
  TOKEN_EXPIRY: '1h',
  MIN_PASSWORD_LENGTH: VALIDATION_RULES.MIN_PASSWORD_LENGTH,
  REQUIRED_SECURITY_HEADERS: [
    'Authorization',
    'Content-Security-Policy',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'X-XSS-Protection'
  ]
};

/**
 * Generates advanced JWT tokens for testing with support for custom signing algorithms
 * @param claims - Token claims
 * @param expiresIn - Token expiration time
 * @param algorithm - Signing algorithm
 * @param includeRefreshToken - Whether to include refresh token
 * @returns Generated tokens and metadata
 */
export async function generateTestToken(
  claims: object,
  expiresIn: number = 3600,
  algorithm: string = 'HS256',
  includeRefreshToken: boolean = false
): Promise<{
  accessToken: string;
  refreshToken?: string;
  metadata: {
    algorithm: string;
    expiresIn: number;
    issuedAt: number;
    tokenId: string;
  };
}> {
  try {
    // Validate claims schema
    const { isValid, errors } = await validateSchema(claims, {
      type: 'object',
      required: ['sub']
    });

    if (!isValid) {
      throw new Error(`Invalid claims: ${errors?.join(', ')}`);
    }

    const tokenId = faker.string.uuid();
    const issuedAt = Math.floor(Date.now() / 1000);

    // Generate access token
    const accessToken = jwt.sign(
      {
        ...claims,
        jti: tokenId,
        iat: issuedAt,
        exp: issuedAt + expiresIn
      },
      process.env.JWT_SECRET || 'test-secret',
      { algorithm }
    );

    // Generate refresh token if requested
    let refreshToken;
    if (includeRefreshToken) {
      refreshToken = jwt.sign(
        {
          sub: claims.sub,
          jti: faker.string.uuid(),
          iat: issuedAt,
          exp: issuedAt + (expiresIn * 24) // 24x longer expiry for refresh token
        },
        process.env.JWT_REFRESH_SECRET || 'test-refresh-secret',
        { algorithm }
      );
    }

    return {
      accessToken,
      refreshToken,
      metadata: {
        algorithm,
        expiresIn,
        issuedAt,
        tokenId
      }
    };
  } catch (error) {
    throw new Error(`Failed to generate test token: ${(error as Error).message}`);
  }
}

/**
 * Generates comprehensive mock credentials for testing various authentication mechanisms
 * @param role - User role
 * @param authType - Authentication type
 * @param securityLevel - Security level
 * @returns Mock credentials
 */
export async function generateMockCredentials(
  role: 'admin' | 'user' | 'manager',
  authType: 'password' | 'oauth' | 'mfa',
  securityLevel: 'low' | 'medium' | 'high'
): Promise<{
  username: string;
  password?: string;
  mfaSecret?: string;
  oauthTokens?: {
    accessToken: string;
    refreshToken: string;
  };
  metadata: {
    role: string;
    authType: string;
    securityLevel: string;
    createdAt: Date;
  };
}> {
  try {
    const username = faker.internet.email();
    let password, mfaSecret, oauthTokens;

    // Generate appropriate credentials based on auth type
    switch (authType) {
      case 'password':
        password = await bcrypt.hash(
          faker.internet.password({ length: SECURITY_CONFIG.MIN_PASSWORD_LENGTH }),
          SECURITY_CONFIG.SALT_ROUNDS
        );
        break;
      case 'oauth':
        oauthTokens = {
          accessToken: faker.string.alphanumeric(64),
          refreshToken: faker.string.alphanumeric(64)
        };
        break;
      case 'mfa':
        password = await bcrypt.hash(
          faker.internet.password({ length: SECURITY_CONFIG.MIN_PASSWORD_LENGTH }),
          SECURITY_CONFIG.SALT_ROUNDS
        );
        mfaSecret = faker.string.alphanumeric(32);
        break;
    }

    return {
      username,
      password,
      mfaSecret,
      oauthTokens,
      metadata: {
        role,
        authType,
        securityLevel,
        createdAt: new Date()
      }
    };
  } catch (error) {
    throw new Error(`Failed to generate mock credentials: ${(error as Error).message}`);
  }
}

/**
 * Performs comprehensive validation of security headers against enterprise requirements
 * @param headers - Headers to validate
 * @param policy - Security policy configuration
 * @returns Validation results with security recommendations
 */
export function validateSecurityHeaders(
  headers: Record<string, string>,
  policy: {
    requiredHeaders?: string[];
    cspDirectives?: string[];
    allowedOrigins?: string[];
  } = {}
): {
  isValid: boolean;
  missingHeaders: string[];
  invalidHeaders: { header: string; reason: string }[];
  recommendations: string[];
} {
  const requiredHeaders = policy.requiredHeaders || SECURITY_CONFIG.REQUIRED_SECURITY_HEADERS;
  const missingHeaders = requiredHeaders.filter(header => !headers[header]);
  const invalidHeaders: { header: string; reason: string }[] = [];
  const recommendations: string[] = [];

  // Validate Content-Security-Policy
  if (headers['Content-Security-Policy']) {
    const csp = headers['Content-Security-Policy'];
    if (!csp.includes("default-src 'self'")) {
      invalidHeaders.push({
        header: 'Content-Security-Policy',
        reason: 'Missing default-src directive'
      });
      recommendations.push('Add default-src directive to CSP');
    }
  }

  // Validate CORS headers
  if (headers['Access-Control-Allow-Origin']) {
    const origin = headers['Access-Control-Allow-Origin'];
    if (origin === '*' && policy.allowedOrigins?.length) {
      invalidHeaders.push({
        header: 'Access-Control-Allow-Origin',
        reason: 'Wildcard origin not allowed'
      });
      recommendations.push('Specify allowed origins explicitly');
    }
  }

  return {
    isValid: missingHeaders.length === 0 && invalidHeaders.length === 0,
    missingHeaders,
    invalidHeaders,
    recommendations
  };
}

/**
 * Generates comprehensive security test data for various testing scenarios
 * @param testType - Type of security test
 * @param config - Test configuration
 * @returns Test data for specified security scenarios
 */
export function generateSecurityTestData(
  testType: 'xss' | 'sql-injection' | 'csrf' | 'auth-bypass',
  config: {
    complexity?: 'low' | 'medium' | 'high';
    includePayloads?: boolean;
    customPatterns?: string[];
  } = {}
): {
  testCases: Array<{ input: string; expected: string }>;
  metadata: {
    type: string;
    complexity: string;
    timestamp: Date;
  };
} {
  const testCases: Array<{ input: string; expected: string }> = [];

  switch (testType) {
    case 'xss':
      testCases.push(
        { input: '<script>alert("xss")</script>', expected: sanitizeInput('<script>alert("xss")</script>') as string },
        { input: 'javascript:alert(1)', expected: sanitizeInput('javascript:alert(1)') as string }
      );
      break;
    case 'sql-injection':
      testCases.push(
        { input: "' OR '1'='1", expected: sanitizeInput("' OR '1'='1") as string },
        { input: '; DROP TABLE users;', expected: sanitizeInput('; DROP TABLE users;') as string }
      );
      break;
    case 'csrf':
      testCases.push(
        { input: faker.internet.url(), expected: 'invalid_token' },
        { input: faker.string.uuid(), expected: 'invalid_csrf_token' }
      );
      break;
    case 'auth-bypass':
      testCases.push(
        { input: 'admin:admin', expected: 'invalid_credentials' },
        { input: faker.string.alphanumeric(64), expected: 'invalid_token' }
      );
      break;
  }

  return {
    testCases,
    metadata: {
      type: testType,
      complexity: config.complexity || 'medium',
      timestamp: new Date()
    }
  };
}