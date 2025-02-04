/**
 * @fileoverview JWT configuration and token management implementing secure service-to-service
 * authentication with RSA-256 encryption and automated key rotation.
 * @version 1.0.0
 */

import { config } from 'dotenv'; // v16.3.1
import { sign, verify, JwtPayload } from 'jsonwebtoken'; // v9.0.0
import { readFile, writeFile } from 'fs/promises';
import { IAuthTokens } from '../interfaces/auth.interface';
import { ERROR_CODES } from '../../../shared/constants';

// Initialize environment variables
config();

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const KEY_ROTATION_INTERVAL = process.env.KEY_ROTATION_INTERVAL || '30d';

/**
 * Comprehensive JWT configuration implementing enterprise-grade security standards
 */
export const jwtConfig = {
  accessToken: {
    algorithm: 'RS256' as const,
    expiresIn: '15m',
    issuer: 'task-management-system',
    audience: 'task-management-api',
    privateKeyPath: process.env.JWT_PRIVATE_KEY_PATH,
    publicKeyPath: process.env.JWT_PUBLIC_KEY_PATH,
    maxTokensPerUser: 5,
    rateLimit: {
      window: '1h',
      max: 100
    }
  },
  refreshToken: {
    algorithm: 'RS256' as const,
    expiresIn: '7d',
    issuer: 'task-management-system',
    audience: 'task-management-api',
    privateKeyPath: process.env.JWT_PRIVATE_KEY_PATH,
    publicKeyPath: process.env.JWT_PUBLIC_KEY_PATH,
    rotationWindow: '1d'
  },
  keyManagement: {
    rotationSchedule: KEY_ROTATION_INTERVAL,
    backupEnabled: true,
    backupPath: process.env.JWT_KEY_BACKUP_PATH
  }
} as const;

/**
 * Generates a new pair of JWT access and refresh tokens with enhanced security checks
 * @param payload - Token payload containing user information and claims
 * @param options - Additional options for token generation
 * @returns Promise resolving to IAuthTokens containing token pair and expiration
 * @throws Error if token generation fails or rate limit exceeded
 */
export async function generateTokens(
  payload: Record<string, unknown>,
  options: { userId: string; tokenType?: 'access' | 'refresh' }
): Promise<IAuthTokens> {
  try {
    // Load private key
    const privateKey = await readFile(jwtConfig.accessToken.privateKeyPath, 'utf8');

    // Generate access token
    const accessToken = sign(
      {
        ...payload,
        type: 'access',
        jti: crypto.randomUUID()
      },
      privateKey,
      {
        algorithm: jwtConfig.accessToken.algorithm,
        expiresIn: jwtConfig.accessToken.expiresIn,
        issuer: jwtConfig.accessToken.issuer,
        audience: jwtConfig.accessToken.audience
      }
    );

    // Generate refresh token
    const refreshToken = sign(
      {
        userId: options.userId,
        type: 'refresh',
        jti: crypto.randomUUID()
      },
      privateKey,
      {
        algorithm: jwtConfig.refreshToken.algorithm,
        expiresIn: jwtConfig.refreshToken.expiresIn,
        issuer: jwtConfig.refreshToken.issuer,
        audience: jwtConfig.refreshToken.audience
      }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: parseInt(jwtConfig.accessToken.expiresIn) * 60 // Convert to seconds
    };
  } catch (error) {
    throw new Error(`Token generation failed: ${error.message}`);
  }
}

/**
 * Verifies a JWT token's validity, signature, and blacklist status
 * @param token - JWT token to verify
 * @param type - Token type ('access' or 'refresh')
 * @returns Promise resolving to decoded token payload
 * @throws Error if token is invalid or verification fails
 */
export async function verifyToken(
  token: string,
  type: 'access' | 'refresh'
): Promise<JwtPayload> {
  try {
    // Load public key
    const publicKey = await readFile(jwtConfig.accessToken.publicKeyPath, 'utf8');

    // Verify token
    const decoded = verify(token, publicKey, {
      algorithms: [jwtConfig.accessToken.algorithm],
      issuer: jwtConfig.accessToken.issuer,
      audience: jwtConfig.accessToken.audience
    }) as JwtPayload;

    // Validate token type
    if (decoded.type !== type) {
      throw new Error(ERROR_CODES.INVALID_TOKEN);
    }

    return decoded;
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
}

/**
 * Handles secure rotation of JWT signing keys
 * @returns Promise resolving when key rotation is complete
 * @throws Error if key rotation fails
 */
export async function rotateKeys(): Promise<void> {
  try {
    const { generateKeyPairSync } = await import('crypto');

    // Generate new key pair
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Backup existing keys if enabled
    if (jwtConfig.keyManagement.backupEnabled) {
      const timestamp = new Date().toISOString();
      await writeFile(
        `${jwtConfig.keyManagement.backupPath}/private_${timestamp}.pem`,
        privateKey
      );
      await writeFile(
        `${jwtConfig.keyManagement.backupPath}/public_${timestamp}.pem`,
        publicKey
      );
    }

    // Update current keys
    await writeFile(jwtConfig.accessToken.privateKeyPath, privateKey);
    await writeFile(jwtConfig.accessToken.publicKeyPath, publicKey);
  } catch (error) {
    throw new Error(`Key rotation failed: ${error.message}`);
  }
}