/**
 * @fileoverview Enhanced error handling utility for API Gateway service with security-aware
 * error tracking, performance monitoring, and standardized error responses.
 * @version 1.0.0
 */

import { Logger } from '../../../shared/utils/logger';
import { IErrorResponse } from '../../../shared/interfaces/base.interface';
import { HTTP_STATUS, ERROR_CODES } from '../../../shared/constants';

// Initialize logger with API Gateway service context
const logger = new Logger('ApiGateway');

// Performance threshold for error handling in milliseconds
const ERROR_RESPONSE_TIME_THRESHOLD_MS = 500;

/**
 * Redacts sensitive information from error messages and stack traces
 * @param data - Data to be redacted
 */
const redactSensitiveData = (data: any): any => {
  if (typeof data !== 'object' || !data) return data;
  
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'ssn', 'creditCard'];
  const redactedData = { ...data };

  for (const key in redactedData) {
    if (sensitiveFields.includes(key.toLowerCase())) {
      redactedData[key] = '[REDACTED]';
    } else if (typeof redactedData[key] === 'object') {
      redactedData[key] = redactSensitiveData(redactedData[key]);
    }
  }

  return redactedData;
};

/**
 * Formats validation errors with security context
 * @param validationError - Validation error object
 * @param correlationId - Request correlation ID
 */
export const formatValidationError = (
  validationError: Error,
  correlationId: string
): IErrorResponse => {
  const errorDetails = redactSensitiveData(validationError);

  return {
    success: false,
    message: 'Validation error occurred',
    errorCode: ERROR_CODES.VALIDATION_ERROR,
    details: errorDetails,
    statusCode: HTTP_STATUS.BAD_REQUEST,
    correlationId,
    timestamp: new Date().toISOString()
  };
};

/**
 * Formats HTTP errors with rate limiting support
 * @param httpError - HTTP error object
 * @param correlationId - Request correlation ID
 */
export const formatHttpError = (
  httpError: Error & { statusCode?: number },
  correlationId: string
): IErrorResponse => {
  const isRateLimit = httpError.statusCode === HTTP_STATUS.TOO_MANY_REQUESTS;
  const errorCode = isRateLimit ? ERROR_CODES.RATE_LIMIT_EXCEEDED : ERROR_CODES.INTERNAL_ERROR;
  
  return {
    success: false,
    message: httpError.message,
    errorCode,
    details: redactSensitiveData(httpError),
    statusCode: httpError.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR,
    correlationId,
    timestamp: new Date().toISOString()
  };
};

/**
 * Enhanced error handling with security context and performance tracking
 * @param error - Error object
 * @param metadata - Additional error metadata
 * @param correlationId - Request correlation ID
 */
export const handleError = (
  error: Error,
  metadata: Record<string, any> = {},
  correlationId: string = crypto.randomUUID()
): IErrorResponse => {
  const startTime = performance.now();
  let errorResponse: IErrorResponse;

  try {
    // Set security context for logging
    logger.setSecurityContext({
      correlationId,
      errorType: error.constructor.name,
      ...metadata
    });

    // Format error based on type
    if (error.name === 'ValidationError') {
      errorResponse = formatValidationError(error, correlationId);
    } else if ('statusCode' in error) {
      errorResponse = formatHttpError(error as Error & { statusCode?: number }, correlationId);
    } else {
      errorResponse = {
        success: false,
        message: 'An internal server error occurred',
        errorCode: ERROR_CODES.INTERNAL_ERROR,
        details: redactSensitiveData(error),
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        correlationId,
        timestamp: new Date().toISOString()
      };
    }

    // Log error with security context
    logger.error(errorResponse.message, error, {
      correlationId,
      errorCode: errorResponse.errorCode,
      metadata: redactSensitiveData(metadata)
    });

    // Track error handling performance
    const processingTime = performance.now() - startTime;
    logger.recordMetric('errorHandling', processingTime);

    if (processingTime > ERROR_RESPONSE_TIME_THRESHOLD_MS) {
      logger.warn('Error handling exceeded time threshold', {
        processingTime,
        threshold: ERROR_RESPONSE_TIME_THRESHOLD_MS,
        correlationId
      });
    }

    return errorResponse;
  } catch (handlingError) {
    // Fallback error handling if error processing fails
    logger.error('Error in error handling', handlingError as Error, { correlationId });
    
    return {
      success: false,
      message: 'An unexpected error occurred while processing the error',
      errorCode: ERROR_CODES.INTERNAL_ERROR,
      details: { message: 'Error handler failure' },
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      correlationId,
      timestamp: new Date().toISOString()
    };
  }
};