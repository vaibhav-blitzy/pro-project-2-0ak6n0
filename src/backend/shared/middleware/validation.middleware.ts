/**
 * @fileoverview Express middleware providing enterprise-grade request validation and sanitization
 * using Joi schemas with enhanced security features, caching, and performance monitoring.
 * @version 1.0.0
 */

import { Request, Response, NextFunction, RequestHandler } from 'express'; // ^4.18.0
import Joi from 'joi'; // ^17.11.0
import NodeCache from 'node-cache'; // ^5.1.2
import { validateSchema, sanitizeInput } from '../utils/validation';
import { IErrorResponse } from '../interfaces/base.interface';
import { Logger } from '../utils/logger';
import { HTTP_STATUS, ERROR_CODES } from '../constants/index';

// Initialize logger for validation middleware
const logger = new Logger('ValidationMiddleware');

// Initialize validation cache with 5 minute TTL
const validationCache = new NodeCache({
  stdTTL: 300,
  checkperiod: 60,
  maxKeys: 1000
});

/**
 * Interface for enhanced validation options
 */
interface ValidationOptions {
  stripUnknown?: boolean;
  abortEarly?: boolean;
  cache?: boolean;
  allowedTags?: string[];
  allowedAttributes?: { [key: string]: string[] };
}

/**
 * Enhanced validation middleware factory with caching and security features
 * @param schema - Joi validation schema
 * @param type - Request property to validate (body, query, params)
 * @param options - Validation and sanitization options
 */
export function validateRequest(
  schema: Joi.Schema,
  type: 'body' | 'query' | 'params',
  options: ValidationOptions = {}
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string || crypto.randomUUID();

    try {
      // Generate cache key if caching is enabled
      const cacheKey = options.cache ? 
        `validation:${type}:${schema.describe().type}:${JSON.stringify(req[type])}` : 
        null;

      // Check cache for existing validation result
      if (cacheKey) {
        const cached = validationCache.get(cacheKey);
        if (cached) {
          logger.debug('Validation cache hit', { cacheKey, correlationId });
          req[type] = cached;
          return next();
        }
      }

      // Perform schema validation
      const validationResult = await validateSchema(req[type], schema, {
        stripUnknown: options.stripUnknown ?? true,
        abortEarly: options.abortEarly ?? false,
        cache: options.cache ?? true
      });

      // Record validation performance
      const validationTime = Date.now() - startTime;
      logger.recordMetric('validation', validationTime);

      if (!validationResult.isValid) {
        const errorResponse: IErrorResponse = {
          success: false,
          message: 'Validation failed',
          errorCode: ERROR_CODES.VALIDATION_ERROR,
          details: {
            field: type,
            value: req[type],
            constraint: validationResult.errors?.[0] || 'Invalid input'
          },
          statusCode: HTTP_STATUS.BAD_REQUEST,
          correlationId,
          securityContext: {
            path: req.path,
            method: req.method,
            ip: req.ip
          }
        };

        logger.error('Validation error', errorResponse, {
          correlationId,
          validationTime
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
        return;
      }

      // Sanitize validated data
      const sanitizedData = sanitizeInput(validationResult.value, {
        recursive: true,
        allowedTags: options.allowedTags,
        allowedAttributes: options.allowedAttributes
      });

      // Cache successful validation result
      if (cacheKey) {
        validationCache.set(cacheKey, sanitizedData);
      }

      // Update request with sanitized data
      req[type] = sanitizedData;

      // Add validation metadata to request
      req.validationMeta = {
        schema: schema.describe().type,
        validationTime,
        correlationId
      };

      logger.debug('Validation successful', {
        correlationId,
        validationTime,
        type
      });

      next();
    } catch (error) {
      logger.error('Validation middleware error', error as Error, {
        correlationId,
        path: req.path,
        method: req.method
      });

      const errorResponse: IErrorResponse = {
        success: false,
        message: 'Internal validation error',
        errorCode: ERROR_CODES.INTERNAL_ERROR,
        details: {
          field: type,
          value: req[type],
          constraint: 'Validation processing failed'
        },
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        correlationId
      };

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  };
}

/**
 * Convenience middleware factory for request body validation
 */
export function validateBody(
  schema: Joi.Schema,
  options?: ValidationOptions
): RequestHandler {
  return validateRequest(schema, 'body', options);
}

/**
 * Convenience middleware factory for query parameter validation
 */
export function validateQuery(
  schema: Joi.Schema,
  options?: ValidationOptions
): RequestHandler {
  return validateRequest(schema, 'query', options);
}

/**
 * Convenience middleware factory for route parameter validation
 */
export function validateParams(
  schema: Joi.Schema,
  options?: ValidationOptions
): RequestHandler {
  return validateRequest(schema, 'params', options);
}

// Extend Express Request interface to include validation metadata
declare global {
  namespace Express {
    interface Request {
      validationMeta?: {
        schema: string;
        validationTime: number;
        correlationId: string;
      };
    }
  }
}