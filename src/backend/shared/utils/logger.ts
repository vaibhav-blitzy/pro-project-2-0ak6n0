/**
 * @fileoverview Enterprise-grade logging utility providing standardized logging functionality
 * across backend microservices with enhanced security, performance monitoring, and structured logging.
 * @version 1.0.0
 */

import winston from 'winston'; // ^3.8.0
import DailyRotateFile from 'winston-daily-rotate-file'; // ^4.7.1
import { IErrorResponse } from '../interfaces/base.interface';

// Global constants for logger configuration
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const DEFAULT_LOG_FORMAT = 'JSON';

// Regular expressions for PII detection and redaction
const PII_PATTERNS = [
  /\d{3}-\d{2}-\d{4}/, // SSN pattern
  /\d{16}/, // Credit card pattern
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email pattern
];

// Performance thresholds in milliseconds
const PERFORMANCE_THRESHOLDS = {
  api: 500,
  db: 200,
  cache: 100
};

/**
 * Creates and configures Winston transport instances with security and performance features
 * @param serviceName - Name of the service for log identification
 * @param options - Configuration options for transports
 */
export const createLoggerTransports = (
  serviceName: string,
  options: {
    logLevel?: string;
    logDir?: string;
    enableConsole?: boolean;
    enableFile?: boolean;
    enableAudit?: boolean;
  } = {}
): winston.transport[] => {
  const transports: winston.transport[] = [];

  // Console transport with environment-specific formatting
  if (options.enableConsole !== false) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `[${timestamp}] [${serviceName}] ${level}: ${message} ${
              Object.keys(meta).length ? JSON.stringify(meta) : ''
            }`;
          })
        )
      })
    );
  }

  // File transport with rotation and compression
  if (options.enableFile !== false) {
    transports.push(
      new DailyRotateFile({
        filename: `${options.logDir || 'logs'}/%DATE%-${serviceName}.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      })
    );
  }

  // Error-specific transport
  transports.push(
    new DailyRotateFile({
      filename: `${options.logDir || 'logs'}/error-%DATE%-${serviceName}.log`,
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  );

  return transports;
};

/**
 * Formats log messages with enhanced metadata and security features
 * @param level - Log level
 * @param message - Log message
 * @param metadata - Additional metadata
 */
const formatLogMessage = (
  level: string,
  message: string,
  metadata: Record<string, any> = {}
): Record<string, any> => {
  const formattedMessage = {
    timestamp: new Date().toISOString(),
    correlationId: metadata.correlationId || crypto.randomUUID(),
    level,
    message,
    ...metadata
  };

  // Redact PII from logs
  const messageStr = JSON.stringify(formattedMessage);
  let redactedStr = messageStr;
  PII_PATTERNS.forEach(pattern => {
    redactedStr = redactedStr.replace(pattern, '[REDACTED]');
  });

  return JSON.parse(redactedStr);
};

/**
 * Enhanced logging class with security features and performance monitoring
 */
export class Logger {
  private winston: winston.Logger;
  private serviceName: string;
  private defaultMetadata: Record<string, any>;
  private securityContext: Record<string, any>;
  private performanceMetrics: Record<string, number>;

  /**
   * Creates a new Logger instance
   * @param serviceName - Name of the service for log identification
   * @param options - Logger configuration options
   */
  constructor(
    serviceName: string,
    options: {
      logLevel?: string;
      logDir?: string;
      defaultMetadata?: Record<string, any>;
      enableAudit?: boolean;
    } = {}
  ) {
    this.serviceName = serviceName;
    this.defaultMetadata = {
      service: serviceName,
      environment: process.env.NODE_ENV || 'development',
      ...options.defaultMetadata
    };
    this.securityContext = {};
    this.performanceMetrics = {};

    this.winston = winston.createLogger({
      levels: LOG_LEVELS,
      level: options.logLevel || 'info',
      transports: createLoggerTransports(serviceName, options)
    });
  }

  /**
   * Logs error messages with enhanced security and debugging information
   * @param message - Error message
   * @param error - Error object or IErrorResponse
   * @param metadata - Additional metadata
   */
  public error(
    message: string,
    error?: Error | IErrorResponse,
    metadata: Record<string, any> = {}
  ): void {
    const errorMetadata: Record<string, any> = {
      ...this.defaultMetadata,
      ...metadata,
      ...this.securityContext
    };

    if (error) {
      if (error instanceof Error) {
        errorMetadata.stack = error.stack;
        errorMetadata.name = error.name;
      } else {
        errorMetadata.errorCode = error.errorCode;
        errorMetadata.details = error.details;
      }
    }

    const formattedMessage = formatLogMessage('error', message, errorMetadata);
    this.winston.error(formattedMessage);
  }

  /**
   * Logs warning messages with security context
   * @param message - Warning message
   * @param metadata - Additional metadata
   */
  public warn(message: string, metadata: Record<string, any> = {}): void {
    const formattedMessage = formatLogMessage('warn', message, {
      ...this.defaultMetadata,
      ...metadata,
      ...this.securityContext
    });
    this.winston.warn(formattedMessage);
  }

  /**
   * Logs informational messages
   * @param message - Info message
   * @param metadata - Additional metadata
   */
  public info(message: string, metadata: Record<string, any> = {}): void {
    const formattedMessage = formatLogMessage('info', message, {
      ...this.defaultMetadata,
      ...metadata,
      ...this.securityContext
    });
    this.winston.info(formattedMessage);
  }

  /**
   * Logs debug messages with performance metrics
   * @param message - Debug message
   * @param metadata - Additional metadata
   */
  public debug(message: string, metadata: Record<string, any> = {}): void {
    const formattedMessage = formatLogMessage('debug', message, {
      ...this.defaultMetadata,
      ...metadata,
      ...this.securityContext,
      performanceMetrics: this.performanceMetrics
    });
    this.winston.debug(formattedMessage);
  }

  /**
   * Sets security context for subsequent log messages
   * @param context - Security context object
   */
  public setSecurityContext(context: Record<string, any>): void {
    this.securityContext = context;
  }

  /**
   * Records performance metric
   * @param metric - Metric name
   * @param value - Metric value in milliseconds
   */
  public recordMetric(metric: string, value: number): void {
    this.performanceMetrics[metric] = value;
    if (value > PERFORMANCE_THRESHOLDS[metric as keyof typeof PERFORMANCE_THRESHOLDS]) {
      this.warn(`Performance threshold exceeded for ${metric}`, {
        metric,
        value,
        threshold: PERFORMANCE_THRESHOLDS[metric as keyof typeof PERFORMANCE_THRESHOLDS]
      });
    }
  }
}