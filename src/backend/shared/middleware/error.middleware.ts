/**
 * @fileoverview Global error handling middleware providing standardized error handling
 * and logging across all backend microservices with enhanced security and monitoring.
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import now from 'performance-now'; // ^2.1.0
import { Logger } from '../utils/logger';
import { IErrorResponse } from '../interfaces/base.interface';
import { HTTP_STATUS } from '../constants';

// Initialize logger for error middleware
const logger = new Logger('ErrorMiddleware');

// PII detection patterns for error message sanitization
const ERROR_PATTERNS = [
  /\b[\w\.-]+@[\w\.-]+\.\w{2,}\b/g, // Email addresses
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Phone numbers
  /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,   // SSN
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g // Credit card numbers
];

/**
 * Formats error objects into standardized error responses with enhanced security
 * and monitoring features.
 * 
 * @param error - Error object to format
 * @param correlationId - Request correlation ID for tracking
 * @param handlingTime - Error handling execution time
 * @returns Standardized error response object
 */
const formatErrorResponse = (
  error: Error | any,
  correlationId: string,
  handlingTime: number
): IErrorResponse => {
  // Sanitize error message by removing PII
  let sanitizedMessage = error.message || 'An unexpected error occurred';
  ERROR_PATTERNS.forEach(pattern => {
    sanitizedMessage = sanitizedMessage.replace(pattern, '[REDACTED]');
  });

  // Determine appropriate status code and error classification
  const statusCode = error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const errorCode = error.errorCode || 'INTERNAL_ERROR';

  // Format stack trace for non-production environments
  const stackTrace = process.env.NODE_ENV !== 'production' ? error.stack : undefined;

  // Construct standardized error response
  const errorResponse: IErrorResponse = {
    success: false,
    message: sanitizedMessage,
    errorCode: errorCode,
    details: error.details || {},
    statusCode: statusCode,
    correlationId: correlationId,
    timestamp: Date.now(),
    stackTrace,
    performance: {
      handlingTime,
      threshold: 100 // ms
    }
  };

  return errorResponse;
};

/**
 * Global error handling middleware with enhanced security features,
 * performance monitoring, and correlation tracking.
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Start performance timing
  const startTime = now();

  // Extract or generate correlation ID
  const correlationId = req.headers['x-correlation-id'] as string || crypto.randomUUID();

  try {
    // Set security context for logging
    logger.setSecurityContext({
      correlationId,
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    // Log error with security context
    logger.error('Request error occurred', error, {
      correlationId,
      path: req.path,
      method: req.method,
      query: req.query,
      body: req.body
    });

    // Calculate error handling time
    const handlingTime = Math.round(now() - startTime);

    // Format error response
    const errorResponse = formatErrorResponse(error, correlationId, handlingTime);

    // Record performance metric
    logger.recordMetric('errorHandling', handlingTime);

    // Send error response
    res
      .status(errorResponse.statusCode)
      .header('x-correlation-id', correlationId)
      .json(errorResponse);

  } catch (formatError) {
    // Fallback error handling for formatting failures
    logger.error('Error formatting failed', formatError);
    
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .header('x-correlation-id', correlationId)
      .json({
        success: false,
        message: 'An unexpected error occurred',
        errorCode: 'INTERNAL_ERROR',
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        correlationId,
        timestamp: Date.now()
      });
  }
};

export { formatErrorResponse };