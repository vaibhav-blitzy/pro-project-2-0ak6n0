/**
 * @fileoverview Core validation utility module providing enterprise-grade schema validation,
 * input sanitization, and data validation functions with performance optimization.
 * @version 1.0.0
 */

import Joi from 'joi'; // ^17.11.0
import xss from 'xss'; // ^1.0.14
import validator from 'validator'; // ^13.11.0
import { caching } from 'cache-manager'; // ^5.2.3
import { HTTP_STATUS, ERROR_CODES, VALIDATION_RULES } from '../constants/index';
import { Logger } from './logger';

// Initialize logger for validation operations
const logger = new Logger('validation-service');

// Initialize cache manager for validation results
const validationCache = await caching('memory', {
  max: 1000,
  ttl: 300 // 5 minutes cache TTL
});

/**
 * Validation metrics collector for performance monitoring
 */
export class ValidationMetrics {
  private static metrics: Map<string, { count: number; totalTime: number }> = new Map();

  /**
   * Collects validation performance metrics
   * @param schemaName - Name of the validation schema
   * @param executionTime - Time taken for validation in ms
   */
  public static collectMetrics(schemaName: string, executionTime: number): void {
    const current = this.metrics.get(schemaName) || { count: 0, totalTime: 0 };
    this.metrics.set(schemaName, {
      count: current.count + 1,
      totalTime: current.totalTime + executionTime
    });
  }
}

/**
 * Interface for validation options
 */
interface IValidationOptions {
  stripUnknown?: boolean;
  abortEarly?: boolean;
  cache?: boolean;
  context?: object;
}

/**
 * Enhanced schema validation with caching and performance optimization
 * @param data - Data to validate
 * @param schema - Joi schema for validation
 * @param options - Validation options
 * @returns Validation result with transformed value and context
 */
export async function validateSchema<T>(
  data: unknown,
  schema: Joi.Schema,
  options: IValidationOptions = {}
): Promise<{
  isValid: boolean;
  errors?: string[];
  value?: T;
  context?: object;
}> {
  const startTime = Date.now();
  const cacheKey = options.cache ? `validation:${JSON.stringify(data)}` : null;

  try {
    // Check cache if enabled
    if (cacheKey) {
      const cached = await validationCache.get(cacheKey);
      if (cached) {
        logger.debug('Validation cache hit', { cacheKey });
        return cached as any;
      }
    }

    // Perform validation
    const validationResult = await schema.validateAsync(data, {
      stripUnknown: options.stripUnknown ?? true,
      abortEarly: options.abortEarly ?? false,
      context: options.context
    });

    const result = {
      isValid: true,
      value: validationResult as T,
      context: options.context
    };

    // Cache successful validation result
    if (cacheKey) {
      await validationCache.set(cacheKey, result);
    }

    // Collect metrics
    ValidationMetrics.collectMetrics(
      schema.describe().type,
      Date.now() - startTime
    );

    return result;
  } catch (error) {
    logger.error('Validation error', error, {
      data,
      errorCode: ERROR_CODES.VALIDATION_ERROR,
      statusCode: HTTP_STATUS.BAD_REQUEST
    });

    return {
      isValid: false,
      errors: error.details?.map((detail: Joi.ValidationErrorItem) => detail.message),
      context: options.context
    };
  }
}

/**
 * Interface for sanitization options
 */
interface ISanitizationOptions {
  recursive?: boolean;
  allowedTags?: string[];
  allowedAttributes?: { [key: string]: string[] };
}

/**
 * Advanced recursive input sanitization with type preservation
 * @param input - Input data to sanitize
 * @param options - Sanitization options
 * @returns Sanitized data with preserved types
 */
export function sanitizeInput(
  input: unknown,
  options: ISanitizationOptions = {}
): unknown {
  const defaultOptions: ISanitizationOptions = {
    recursive: true,
    allowedTags: [],
    allowedAttributes: {}
  };

  const sanitizationOptions = { ...defaultOptions, ...options };

  // Configure XSS sanitizer
  const xssOptions = {
    whiteList: sanitizationOptions.allowedTags?.reduce((acc, tag) => {
      acc[tag] = sanitizationOptions.allowedAttributes?.[tag] || [];
      return acc;
    }, {} as { [key: string]: string[] })
  };

  const sanitize = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return xss(value, xssOptions);
    }

    if (Array.isArray(value) && sanitizationOptions.recursive) {
      return value.map(item => sanitize(item));
    }

    if (value && typeof value === 'object' && sanitizationOptions.recursive) {
      return Object.entries(value).reduce((acc, [key, val]) => ({
        ...acc,
        [key]: sanitize(val)
      }), {});
    }

    return value;
  };

  return sanitize(input);
}

/**
 * Enhanced email validation with domain verification
 * @param email - Email address to validate
 * @returns Validation result
 */
export function validateEmail(email: string): boolean {
  if (!validator.isEmail(email)) {
    return false;
  }

  // Additional domain validation could be added here
  const [, domain] = email.split('@');
  return validator.isFQDN(domain);
}

/**
 * Password strength validation with configurable rules
 * @param password - Password to validate
 * @returns Validation result with detailed requirements status
 */
export function validatePassword(password: string): {
  isValid: boolean;
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
} {
  const requirements = {
    length: password.length >= VALIDATION_RULES.MIN_PASSWORD_LENGTH,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };

  return {
    isValid: Object.values(requirements).every(Boolean),
    requirements
  };
}