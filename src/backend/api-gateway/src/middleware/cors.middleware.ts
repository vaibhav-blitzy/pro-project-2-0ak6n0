/**
 * @fileoverview Enhanced CORS middleware implementation for API Gateway with advanced
 * security controls, performance monitoring, and dynamic configuration support.
 * @version 1.0.0
 */

import cors from 'cors'; // ^2.8.5
import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { RateLimiterRedis } from 'rate-limiter-flexible'; // ^2.4.1
import { Logger } from '../../../shared/utils/logger';
import { kongConfig } from '../config/kong.config';
import { ERROR_CODES, HTTP_STATUS } from '../../../shared/constants';

// Initialize logger with CORS middleware context
const logger = new Logger('CorsMiddleware', {
  defaultMetadata: { component: 'security' }
});

// Environment-based configuration
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
const ALLOWED_HEADERS = ['Authorization', 'Content-Type', 'Origin', 'Accept', 'X-Request-ID'];
const CORS_MAX_AGE = parseInt(process.env.CORS_MAX_AGE || '86400', 10);
const PREFLIGHT_RATE_LIMIT = parseInt(process.env.PREFLIGHT_RATE_LIMIT || '100', 10);

// Initialize Redis rate limiter for preflight requests
const preflightLimiter = new RateLimiterRedis({
  storeClient: kongConfig.plugins.rate_limiting.policy === 'redis' 
    ? kongConfig.plugins.rate_limiting.redis_config 
    : undefined,
  points: PREFLIGHT_RATE_LIMIT,
  duration: 3600, // 1 hour
  keyPrefix: 'cors_preflight:'
});

/**
 * Enhanced origin validation with pattern matching and security checks
 * @param origin - Origin to validate
 * @param callback - CORS validation callback
 */
const validateOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void => {
  const startTime = performance.now();

  try {
    // Skip validation if no origin (e.g., same-origin requests)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Check if origin is in allowed list
    const isAllowed = ALLOWED_ORIGINS.some(allowedOrigin => {
      if (allowedOrigin === '*') return true;
      if (allowedOrigin.includes('*')) {
        // Convert wildcard pattern to regex
        const pattern = new RegExp('^' + allowedOrigin.replace('*', '.*') + '$');
        return pattern.test(origin);
      }
      return allowedOrigin === origin;
    });

    // Log validation result with security context
    logger.info('Origin validation', {
      origin,
      isAllowed,
      validationTime: performance.now() - startTime
    });

    callback(null, isAllowed);
  } catch (error) {
    logger.error('Origin validation error', error as Error, { origin });
    callback(error as Error);
  }
};

/**
 * Handles CORS preflight requests with rate limiting and security checks
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
const handlePreflightRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Apply rate limiting to preflight requests
    await preflightLimiter.consume(req.ip);

    // Validate request headers
    const requestHeaders = req.headers['access-control-request-headers'];
    if (requestHeaders) {
      const requestedHeaders = requestHeaders.toString().split(',').map(h => h.trim().toLowerCase());
      const invalidHeaders = requestedHeaders.filter(h => !ALLOWED_HEADERS.map(ah => ah.toLowerCase()).includes(h));
      
      if (invalidHeaders.length > 0) {
        logger.warn('Invalid CORS headers requested', { invalidHeaders, ip: req.ip });
        res.status(HTTP_STATUS.FORBIDDEN).end();
        return;
      }
    }

    // Apply security headers
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', CORS_MAX_AGE.toString());
    
    // Log preflight request
    logger.info('CORS preflight request processed', {
      origin: req.headers.origin,
      method: req.headers['access-control-request-method'],
      headers: requestHeaders
    });

    next();
  } catch (error) {
    if (error.name === 'RateLimiterError') {
      logger.warn('Preflight rate limit exceeded', { ip: req.ip });
      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).end();
      return;
    }
    next(error);
  }
};

/**
 * Creates and configures enhanced CORS middleware with security controls
 * and performance monitoring
 */
const createCorsMiddleware = (): express.RequestHandler => {
  const corsOptions: cors.CorsOptions = {
    origin: validateOrigin,
    methods: ALLOWED_METHODS,
    allowedHeaders: ALLOWED_HEADERS,
    credentials: true,
    maxAge: CORS_MAX_AGE,
    preflightContinue: false,
    optionsSuccessStatus: 204
  };

  // Create enhanced CORS middleware
  const corsMiddleware = cors(corsOptions);

  // Return wrapped middleware with preflight handling
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = performance.now();

    if (req.method === 'OPTIONS') {
      handlePreflightRequest(req, res, next)
        .catch(error => next(error));
    } else {
      corsMiddleware(req, res, (error?: Error) => {
        if (error) {
          logger.error('CORS middleware error', error);
          next(error);
          return;
        }

        // Record CORS processing time
        const processingTime = performance.now() - startTime;
        logger.recordMetric('cors_processing', processingTime);

        next();
      });
    }
  };
};

// Export configured CORS middleware
export const corsMiddleware = createCorsMiddleware();