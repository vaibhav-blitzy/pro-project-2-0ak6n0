/**
 * @fileoverview Main application file for the API Gateway service implementing enterprise-grade
 * routing, security, monitoring, and high-availability features.
 * @version 1.0.0
 */

import express, { Express, Request, Response, NextFunction } from 'express'; // v4.18.2
import helmet from 'helmet'; // v7.0.0
import compression from 'compression'; // v1.7.4
import morgan from 'morgan'; // v1.10.0
import promClient from 'express-prometheus-middleware'; // v1.2.0
import { rateLimit } from 'express-rate-limit'; // v6.9.0

// Internal imports
import router from './routes';
import { authenticateToken } from './middleware/auth.middleware';
import { corsMiddleware } from './middleware/cors.middleware';
import { createRequestLogger } from './middleware/logging.middleware';
import { Logger } from '../../shared/utils/logger';
import { HTTP_STATUS, ERROR_CODES } from '../../shared/constants';

// Initialize logger
const logger = new Logger('ApiGateway', {
  defaultMetadata: { service: 'api-gateway' }
});

// Environment variables
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const REQUEST_TIMEOUT = process.env.REQUEST_TIMEOUT || 30000;
const MAX_REQUEST_SIZE = process.env.MAX_REQUEST_SIZE || '10mb';

// Initialize Express app
const app: Express = express();

/**
 * Configures comprehensive middleware stack with security and monitoring
 * @param app Express application instance
 */
const configureMiddleware = (app: Express): void => {
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }));

  // CORS configuration
  app.use(corsMiddleware);

  // Request parsing
  app.use(express.json({ limit: MAX_REQUEST_SIZE }));
  app.use(express.urlencoded({ extended: true, limit: MAX_REQUEST_SIZE }));

  // Compression
  app.use(compression());

  // Request logging
  app.use(createRequestLogger(logger, {
    sampleRate: 1.0,
    performanceThresholds: {
      warning: 400,
      critical: 800
    }
  }));

  // HTTP request logging
  app.use(morgan('combined'));

  // Prometheus metrics
  app.use(promClient({
    metricsPath: '/metrics',
    collectDefaultMetrics: true,
    requestDurationBuckets: [0.1, 0.5, 1, 1.5, 2, 3, 5, 10],
    requestLengthBuckets: [512, 1024, 5120, 10240, 51200, 102400],
    responseLengthBuckets: [512, 1024, 5120, 10240, 51200, 102400]
  }));

  // Rate limiting
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        message: 'Too many requests, please try again later.',
        errorCode: ERROR_CODES.RATE_LIMIT_EXCEEDED
      });
    }
  }));

  // Request timeout
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setTimeout(Number(REQUEST_TIMEOUT), () => {
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'Request timeout',
        errorCode: ERROR_CODES.INTERNAL_ERROR
      });
    });
    next();
  });
};

/**
 * Configures error handling middleware with security awareness
 * @param app Express application instance
 */
const setupErrorHandling = (app: Express): void => {
  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(HTTP_STATUS.NOT_FOUND).json({
      success: false,
      message: 'Resource not found',
      errorCode: ERROR_CODES.NOT_FOUND
    });
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', err);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error',
      errorCode: ERROR_CODES.INTERNAL_ERROR,
      ...(NODE_ENV === 'development' && { stack: err.stack })
    });
  });
};

/**
 * Initializes and starts the Express server with enhanced monitoring
 * @param app Express application instance
 */
const startServer = async (app: Express): Promise<void> => {
  try {
    // Configure middleware
    configureMiddleware(app);

    // API routes
    app.use('/api/v1', authenticateToken, router);

    // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV
      });
    });

    // Error handling
    setupErrorHandling(app);

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`API Gateway started`, {
        port: PORT,
        environment: NODE_ENV,
        nodeVersion: process.version
      });
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down API Gateway...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });

      // Force close after timeout
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start API Gateway', error as Error);
    process.exit(1);
  }
};

// Start the server
startServer(app);

// Export app for testing
export { app };