/**
 * @fileoverview Enterprise-grade logging middleware for API Gateway providing comprehensive 
 * request/response tracking, performance monitoring, and security audit capabilities.
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import { Logger } from '../../shared/utils/logger';
import { MetricsManager } from '../../shared/utils/metrics';
import { IErrorResponse } from '../../shared/interfaces/base.interface';

// Global constants
const REQUEST_ID_HEADER = 'X-Request-ID';
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key', 'session-token', 'refresh-token'];
const PERFORMANCE_THRESHOLDS = {
  warning: 400, // ms
  critical: 800  // ms
};
const LOG_SAMPLING_RATE = 0.1; // 10% sampling for detailed logging

/**
 * Masks sensitive information in request/response data
 * @param data - Data object to mask
 * @param sensitivePatterns - Array of sensitive data patterns
 * @returns Masked data object
 */
const maskSensitiveData = (
  data: Record<string, any>,
  sensitivePatterns: string[] = SENSITIVE_HEADERS
): Record<string, any> => {
  const maskedData = structuredClone(data);

  // Mask sensitive headers
  if (maskedData.headers) {
    for (const header of sensitivePatterns) {
      if (maskedData.headers[header]) {
        maskedData.headers[header] = '[REDACTED]';
      }
    }
  }

  // Mask sensitive body fields recursively
  const maskRecursively = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => maskRecursively(item));
    }

    const masked = { ...obj };
    for (const key in masked) {
      if (sensitivePatterns.some(pattern => key.toLowerCase().includes(pattern))) {
        masked[key] = '[REDACTED]';
      } else if (typeof masked[key] === 'object') {
        masked[key] = maskRecursively(masked[key]);
      }
    }
    return masked;
  };

  if (maskedData.body) {
    maskedData.body = maskRecursively(maskedData.body);
  }

  return maskedData;
};

/**
 * Creates an enhanced request logging middleware
 * @param logger - Logger instance
 * @param metricsManager - MetricsManager instance
 * @param options - Middleware configuration options
 * @returns Express middleware function
 */
export const createRequestLogger = (
  logger: Logger,
  metricsManager: MetricsManager,
  options: {
    sampleRate?: number;
    performanceThresholds?: typeof PERFORMANCE_THRESHOLDS;
    sensitiveHeaders?: string[];
  } = {}
) => {
  // Initialize metrics
  const requestDurationHistogram = metricsManager.createHistogram(
    'http_request_duration_ms',
    'HTTP request duration in milliseconds',
    ['method', 'path', 'status']
  );

  const requestCounter = metricsManager.createCounter(
    'http_requests_total',
    'Total number of HTTP requests',
    ['method', 'path', 'status']
  );

  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = process.hrtime();
    const requestId = req.headers[REQUEST_ID_HEADER.toLowerCase()] || uuidv4();
    const shouldSampleRequest = Math.random() < (options.sampleRate || LOG_SAMPLING_RATE);

    // Ensure request ID is available
    req.headers[REQUEST_ID_HEADER.toLowerCase()] = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    // Create security context
    const securityContext = {
      requestId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin,
      userId: (req as any).user?.id
    };

    // Log request with masked sensitive data
    if (shouldSampleRequest) {
      const maskedReq = maskSensitiveData(
        {
          headers: req.headers,
          body: req.body,
          query: req.query,
          params: req.params
        },
        options.sensitiveHeaders || SENSITIVE_HEADERS
      );

      logger.info('Incoming request', {
        requestId,
        method: req.method,
        url: req.url,
        ...maskedReq,
        ...securityContext
      });
    }

    // Intercept response
    const originalEnd = res.end;
    const chunks: Buffer[] = [];

    // @ts-ignore - Extend response end for tracking
    res.end = function(chunk: any, ...args: any[]): any {
      if (chunk) {
        chunks.push(Buffer.from(chunk));
      }

      const responseTime = process.hrtime(startTime);
      const durationMs = (responseTime[0] * 1000) + (responseTime[1] / 1000000);

      // Record metrics
      const labels = {
        method: req.method,
        path: req.route?.path || req.path,
        status: res.statusCode.toString()
      };

      requestCounter.inc(labels);
      requestDurationHistogram.observe(labels, durationMs);

      // Check performance thresholds
      const thresholds = options.performanceThresholds || PERFORMANCE_THRESHOLDS;
      if (durationMs > thresholds.critical) {
        logger.error('Critical response time threshold exceeded', {
          requestId,
          durationMs,
          threshold: thresholds.critical
        });
      } else if (durationMs > thresholds.warning) {
        logger.warn('Warning response time threshold exceeded', {
          requestId,
          durationMs,
          threshold: thresholds.warning
        });
      }

      // Log response for sampled requests
      if (shouldSampleRequest) {
        const responseBody = Buffer.concat(chunks).toString('utf8');
        const maskedRes = maskSensitiveData({
          statusCode: res.statusCode,
          headers: res.getHeaders(),
          body: responseBody ? JSON.parse(responseBody) : undefined
        });

        logger.info('Outgoing response', {
          requestId,
          durationMs,
          ...maskedRes,
          ...securityContext
        });
      }

      originalEnd.call(res, chunk, ...args);
    };

    // Error handling
    res.on('error', (error: Error | IErrorResponse) => {
      logger.error('Response error', error, {
        requestId,
        ...securityContext
      });
    });

    next();
  };
};