/**
 * @fileoverview Core authentication configuration file defining comprehensive authentication settings,
 * security parameters, and integration configurations for the auth service with enhanced security
 * and compliance features.
 * 
 * @version 1.0.0
 * @license MIT
 */

// External imports
import { config } from 'dotenv'; // v16.3.1

// Internal imports
import { IBaseEntity } from '../../../shared/interfaces/base.interface';

// Initialize environment variables
config();

/**
 * Securely retrieves and validates authentication secrets from environment variables
 * @throws {Error} If required secrets are missing or invalid
 */
const getAuthSecrets = (): Record<string, string> => {
  const requiredSecrets = [
    'OKTA_CLIENT_ID',
    'OKTA_CLIENT_SECRET',
    'OKTA_CALLBACK_URL',
    'OKTA_AUTH_URL',
    'OKTA_TOKEN_URL',
    'OKTA_USERINFO_URL'
  ];

  const secrets: Record<string, string> = {};
  
  for (const secret of requiredSecrets) {
    const value = process.env[secret];
    if (!value) {
      throw new Error(`Missing required authentication secret: ${secret}`);
    }
    if (value.length < 16) {
      throw new Error(`Authentication secret ${secret} does not meet minimum length requirement`);
    }
    secrets[secret] = value;
  }

  return secrets;
};

/**
 * Validates authentication configuration against security requirements
 * @throws {Error} If configuration validation fails
 */
const validateAuthConfig = (): boolean => {
  // Password policy validation
  if (authConfig.password.minLength < 12) {
    throw new Error('Password minimum length must be at least 12 characters');
  }

  // OAuth configuration validation
  if (!authConfig.oauth.providers.okta.pkce) {
    throw new Error('PKCE must be enabled for OAuth security');
  }

  // MFA configuration validation
  if (!authConfig.mfa.enabled) {
    throw new Error('MFA must be enabled in production environment');
  }

  // Session security validation
  if (process.env.NODE_ENV === 'production' && !authConfig.session.secure) {
    throw new Error('Secure session cookies required in production');
  }

  return true;
};

// Global environment configuration
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Comprehensive authentication configuration object
 */
export const authConfig = {
  session: {
    maxAge: '24h',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict' as const,
    rememberMeMaxAge: '7d',
    cookiePrefix: '__Secure-',
    refreshTokenExpiry: '30d',
    sessionIdLength: 32
  },

  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    saltRounds: 12,
    maxAttempts: 5,
    lockoutDuration: '15m',
    historySize: 5,
    expiryDays: 90
  },

  oauth: {
    providers: {
      okta: {
        clientId: process.env.OKTA_CLIENT_ID,
        clientSecret: process.env.OKTA_CLIENT_SECRET,
        callbackUrl: process.env.OKTA_CALLBACK_URL,
        authorizationURL: process.env.OKTA_AUTH_URL,
        tokenURL: process.env.OKTA_TOKEN_URL,
        userInfoURL: process.env.OKTA_USERINFO_URL,
        scope: ['openid', 'profile', 'email'] as const,
        responseType: 'code' as const,
        grantType: 'authorization_code' as const,
        pkce: true
      }
    },
    sessionMaxAge: '24h',
    stateParameterLength: 32,
    tokenRefreshThreshold: '1h'
  },

  mfa: {
    enabled: true,
    issuer: 'Task Management System',
    algorithm: 'sha1' as const,
    digits: 6,
    step: 30,
    window: 1,
    backupCodesCount: 10,
    recoveryCodesLength: 16,
    qrCodeSize: 200
  }
} as const;

// Validate configuration on initialization
validateAuthConfig();

// Export configuration object
export default authConfig;

// Export individual configuration sections for granular access
export const {
  session,
  password,
  oauth,
  mfa
} = authConfig;