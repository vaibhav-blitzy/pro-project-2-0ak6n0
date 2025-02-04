/**
 * @fileoverview Enterprise-grade Express middleware for JWT token validation and authentication.
 * Implements secure access control with performance monitoring, rate limiting, and comprehensive security features.
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import now from 'performance-now'; // ^2.1.0
import { RateLimiterMemory } from 'rate-limiter-flexible'; // ^2.4.1
import { verifyToken } from '../config/jwt.config';
import { IAuthTokens } from '../interfaces/auth.interface';
import { errorHandler } from '../../../shared/middleware/error.middleware';
import { HTTP_STATUS, ERROR_CODES } from '../../../shared/constants';
import { Logger } from '../../../shared/utils/logger';

// Initialize logger for JWT middleware
const logger = new Logger('JWTMiddleware');

// Initialize rate limiter
const rateLimiter = new RateLimiterMemory({
  points: 1000, // Number of requests
  duration: 3600, // Per hour
  blockDuration: 300 // Block for 5 minutes if exceeded
});

// Constants
const BEARER_PREFIX = 'Bearer ';
const TOKEN_PATTERN = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
const PERFORMANCE_THRESHOLD = 100; // milliseconds

/**
 * Securely extracts and validates JWT token format from the Authorization header
 * @param authHeader - Authorization header value
 * @returns Extracted token or null if not found/invalid
 */
const extractTokenFromHeader = (authHeader: string): string | null => {
  try {
    // Validate header exists and is string
    if (!authHeader || typeof authHeader !== 'string') {
      return null;
    }

    // Verify header starts with Bearer prefix
    if (!authHeader.startsWith(BEARER_PREFIX)) {
      return null;
    }

    // Extract token part
    const token = authHeader.slice(BEARER_PREFIX.length);

    // Validate token format
    if (!TOKEN_PATTERN.test(token)) {
      return null;
    }

    return token;
  } catch (error) {
    logger.error('Token extraction failed', error);
    return null;
  }
};

/**
 * Enterprise-grade Express middleware for JWT validation with performance monitoring
 * and rate limiting
 */
export const validateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = now();
  const correlationId = req.headers['x-correlation-id'] as string || crypto.randomUUID();

  try {
    // Set security context for logging
    logger.setSecurityContext({
      correlationId,
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    // Check rate limiting
    try {
      await rateLimiter.consume(req.ip);
    } catch (error) {
      logger.warn('Rate limit exceeded', { ip: req.ip });
      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        message: 'Rate limit exceeded',
        errorCode: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        correlationId
      });
      return;
    }

    // Extract Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'No authorization header',
        errorCode: ERROR_CODES.AUTH_ERROR,
        correlationId
      });
      return;
    }

    // Extract and validate token
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid token format',
        errorCode: ERROR_CODES.INVALID_TOKEN,
        correlationId
      });
      return;
    }

    // Verify token
    const decoded = await verifyToken(token, 'access');

    // Create security context
    const securityContext = {
      userId: decoded.sub,
      role: decoded.role,
      permissions: decoded.permissions,
      sessionId: decoded.jti
    };

    // Attach user and security context to request
    req.user = decoded;
    req.securityContext = securityContext;

    // Log security event
    logger.info('JWT validation successful', {
      userId: decoded.sub,
      path: req.path,
      correlationId
    });

    // Check performance
    const executionTime = Math.round(now() - startTime);
    logger.recordMetric('jwtValidation', executionTime);

    if (executionTime > PERFORMANCE_THRESHOLD) {
      logger.warn('JWT validation performance threshold exceeded', {
        executionTime,
        threshold: PERFORMANCE_THRESHOLD,
        correlationId
      });
    }

    next();
  } catch (error) {
    const executionTime = Math.round(now() - startTime);
    logger.recordMetric('jwtValidation', executionTime);

    logger.error('JWT validation failed', error, {
      correlationId,
      path: req.path
    });

    errorHandler(error, req, res, next);
  }
};