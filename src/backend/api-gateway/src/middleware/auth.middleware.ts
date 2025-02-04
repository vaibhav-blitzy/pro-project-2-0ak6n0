/**
 * @fileoverview Enhanced authentication middleware for API Gateway implementing secure token validation,
 * rate limiting, and audit logging with comprehensive security features.
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { verify } from 'jsonwebtoken'; // v9.0.0
import { createClient } from 'redis'; // v4.6.7
import { RateLimiterRedis } from 'rate-limiter-flexible'; // v2.4.1
import { Logger } from '../../../shared/utils/logger';
import { IErrorResponse } from '../../../shared/interfaces/base.interface';
import { handleError } from '../utils/error-handler';
import { jwtConfig } from '../../../auth-service/src/config/jwt.config';
import { HTTP_STATUS, ERROR_CODES } from '../../../shared/constants';

// Initialize Redis client for token caching and blacklist
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries: number) => Math.min(retries * 100, 3000),
  }
});

// Initialize logger
const logger = new Logger('AuthMiddleware');

// Initialize rate limiter
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'ratelimit_auth',
  points: 1000, // Number of requests
  duration: 3600, // Per hour
  blockDuration: 600 // Block for 10 minutes if exceeded
});

// Cache TTL for valid tokens (in seconds)
const TOKEN_CACHE_TTL = 300; // 5 minutes

/**
 * Enhanced JWT token validation middleware with caching and security features
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const correlationId = req.headers['x-correlation-id'] as string || crypto.randomUUID();
  const startTime = performance.now();

  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw {
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        message: 'No token provided',
        errorCode: ERROR_CODES.AUTH_ERROR
      };
    }

    const token = authHeader.split(' ')[1];

    // Check token blacklist
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      throw {
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        message: 'Token has been revoked',
        errorCode: ERROR_CODES.INVALID_TOKEN
      };
    }

    // Check rate limit
    try {
      await rateLimiter.consume(req.ip);
    } catch (rateLimitError) {
      throw {
        statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
        message: 'Rate limit exceeded',
        errorCode: ERROR_CODES.RATE_LIMIT_EXCEEDED
      };
    }

    // Check token cache
    const cachedToken = await redisClient.get(`token:${token}`);
    if (cachedToken) {
      req.user = JSON.parse(cachedToken);
      return next();
    }

    // Verify token
    const decoded = verify(token, jwtConfig.accessToken.publicKeyPath, {
      algorithms: [jwtConfig.accessToken.algorithm],
      issuer: jwtConfig.accessToken.issuer,
      audience: jwtConfig.accessToken.audience
    });

    // Validate token type and expiration
    if (typeof decoded === 'string' || decoded.type !== 'access') {
      throw {
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        message: 'Invalid token type',
        errorCode: ERROR_CODES.INVALID_TOKEN
      };
    }

    // Cache valid token
    await redisClient.setEx(
      `token:${token}`,
      TOKEN_CACHE_TTL,
      JSON.stringify(decoded)
    );

    // Attach user info to request
    req.user = decoded;

    // Log successful authentication
    logger.info('Authentication successful', {
      userId: decoded.sub,
      correlationId,
      processingTime: performance.now() - startTime
    });

    next();
  } catch (error) {
    const errorResponse = handleError(error as Error, {
      correlationId,
      processingTime: performance.now() - startTime
    });
    res.status(errorResponse.statusCode).json(errorResponse);
  }
};

/**
 * Role-based access control middleware factory
 */
export const validateRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const userRole = req.user?.role;

      if (!userRole || !allowedRoles.includes(userRole)) {
        throw {
          statusCode: HTTP_STATUS.FORBIDDEN,
          message: 'Insufficient permissions',
          errorCode: ERROR_CODES.AUTH_ERROR
        };
      }

      logger.info('Role validation successful', {
        userId: req.user?.sub,
        role: userRole,
        allowedRoles
      });

      next();
    } catch (error) {
      const errorResponse = handleError(error as Error);
      res.status(errorResponse.statusCode).json(errorResponse);
    }
  };
};

/**
 * Permission-based access control middleware factory
 */
export const validatePermissions = (requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const userPermissions = req.user?.permissions || [];

      const hasAllPermissions = requiredPermissions.every(permission =>
        userPermissions.includes(permission)
      );

      if (!hasAllPermissions) {
        throw {
          statusCode: HTTP_STATUS.FORBIDDEN,
          message: 'Insufficient permissions',
          errorCode: ERROR_CODES.AUTH_ERROR
        };
      }

      logger.info('Permission validation successful', {
        userId: req.user?.sub,
        permissions: userPermissions,
        requiredPermissions
      });

      next();
    } catch (error) {
      const errorResponse = handleError(error as Error);
      res.status(errorResponse.statusCode).json(errorResponse);
    }
  };
};

// Connect to Redis on startup
redisClient.connect().catch(error => {
  logger.error('Redis connection error', error);
  process.exit(1);
});