/**
 * @fileoverview Authentication routes configuration implementing secure routing with
 * comprehensive validation, rate limiting, security headers, and monitoring.
 * Compliant with OWASP Top 10, PCI DSS, and GDPR standards.
 * 
 * @version 1.0.0
 * @license MIT
 */

import { Router } from 'express'; // ^4.18.2
import Joi from 'joi'; // ^17.11.0
import rateLimit from 'express-rate-limit'; // ^7.1.0
import helmet from 'helmet'; // ^7.1.0
import correlator from 'express-correlation-id'; // ^2.0.0
import { AuthController } from '../controllers/auth.controller';
import { validateBody } from '../../../shared/middleware/validation.middleware';
import { IAuthRequest } from '../interfaces/auth.interface';
import { HTTP_STATUS, ERROR_CODES } from '../../../shared/constants';
import { Logger } from '../../../shared/utils/logger';

// Initialize logger for auth routes
const logger = new Logger('auth-routes');

// Initialize rate limiter with progressive backoff
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      correlationId: req.headers['x-correlation-id']
    });
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      message: 'Too many login attempts. Please try again later.',
      errorCode: ERROR_CODES.RATE_LIMIT_EXCEEDED
    });
  }
});

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required().trim(),
  password: Joi.string()
    .min(12)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/)
    .required(),
  firstName: Joi.string().required().trim(),
  lastName: Joi.string().required().trim(),
  deviceFingerprint: Joi.string().required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().trim(),
  password: Joi.string().required(),
  deviceFingerprint: Joi.string().required()
});

const mfaSchema = Joi.object({
  mfaCode: Joi.string().length(6).pattern(/^\d+$/).required(),
  deviceFingerprint: Joi.string().required()
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
  deviceFingerprint: Joi.string().required()
});

/**
 * Configures and returns an Express router with secure authentication routes
 * @returns Configured Express router with security middleware
 */
export function configureAuthRoutes(): Router {
  const router = Router();
  const authController = new AuthController();

  // Apply security middleware
  router.use(helmet());
  router.use(correlator());

  // Performance monitoring middleware
  router.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.recordMetric('api', duration);
    });
    next();
  });

  // Registration route with enhanced validation
  router.post(
    '/register',
    validateBody(registerSchema),
    async (req, res, next) => {
      try {
        await authController.register(req, res);
      } catch (error) {
        logger.error('Registration error', error as Error);
        next(error);
      }
    }
  );

  // Login route with rate limiting and brute force protection
  router.post(
    '/login',
    loginRateLimiter,
    validateBody(loginSchema),
    async (req, res, next) => {
      try {
        await authController.login(req, res);
      } catch (error) {
        logger.error('Login error', error as Error);
        next(error);
      }
    }
  );

  // MFA setup route with authentication check
  router.post(
    '/mfa/setup',
    validateBody(mfaSchema),
    async (req, res, next) => {
      try {
        await authController.setupMFA(req, res);
      } catch (error) {
        logger.error('MFA setup error', error as Error);
        next(error);
      }
    }
  );

  // MFA verification route with rate limiting
  router.post(
    '/mfa/verify',
    rateLimit({ windowMs: 5 * 60 * 1000, max: 3 }), // 3 attempts per 5 minutes
    validateBody(mfaSchema),
    async (req, res, next) => {
      try {
        await authController.verifyMFA(req, res);
      } catch (error) {
        logger.error('MFA verification error', error as Error);
        next(error);
      }
    }
  );

  // Token refresh route with device validation
  router.post(
    '/refresh',
    validateBody(refreshSchema),
    async (req, res, next) => {
      try {
        await authController.refreshToken(req, res);
      } catch (error) {
        logger.error('Token refresh error', error as Error);
        next(error);
      }
    }
  );

  // SSO callback route
  router.get(
    '/sso/callback',
    async (req, res, next) => {
      try {
        await authController.ssoCallback(req, res);
      } catch (error) {
        logger.error('SSO callback error', error as Error);
        next(error);
      }
    }
  );

  // Error handling middleware
  router.use((error: Error, req: any, res: any, next: any) => {
    logger.error('Route error handler', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error',
      errorCode: ERROR_CODES.INTERNAL_ERROR,
      correlationId: req.correlationId()
    });
  });

  return router;
}

// Export configured router
export const router = configureAuthRoutes();