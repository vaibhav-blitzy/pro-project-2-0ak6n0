/**
 * @fileoverview Main application entry point for the authentication service implementing
 * enterprise-grade security, monitoring, and performance features.
 * 
 * @version 1.0.0
 * @license MIT
 */

import express from 'express'; // ^4.18.2
import helmet from 'helmet'; // ^7.1.0
import cors from 'cors'; // ^2.8.5
import compression from 'compression'; // ^1.7.4
import expressRateLimit from 'express-rate-limit'; // ^7.1.5
import expressSession from 'express-session'; // ^1.17.3
import cookieParser from 'cookie-parser'; // ^1.4.6
import pino from 'pino'; // ^8.16.2

// Internal imports
import { authConfig } from './config/auth.config';
import router from './routes/auth.routes';
import { errorHandler } from '../../shared/middleware/error.middleware';
import { HTTP_STATUS, API_LIMITS } from '../../shared/constants';

// Initialize Express application
const app = express();

// Initialize logger
const logger = pino({ 
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

/**
 * Configures comprehensive security headers based on best practices
 */
const configureSecurityHeaders = (): void => {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }));
};

/**
 * Configures comprehensive middleware chain with security, monitoring,
 * and performance features
 */
const configureMiddleware = (): void => {
  // Security headers
  configureSecurityHeaders();

  // CORS configuration
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Correlation-ID'],
    credentials: true,
    maxAge: 86400 // 24 hours
  }));

  // Request parsing and compression
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(compression());
  app.use(cookieParser(process.env.COOKIE_SECRET));

  // Rate limiting
  app.use(expressRateLimit({
    windowMs: API_LIMITS.WINDOW === '1h' ? 60 * 60 * 1000 : 0,
    max: API_LIMITS.RATE_LIMIT,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later.'
  }));

  // Session configuration
  app.use(expressSession({
    name: `${authConfig.session.cookiePrefix}sid`,
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: authConfig.session.secure,
      httpOnly: authConfig.session.httpOnly,
      sameSite: authConfig.session.sameSite,
      maxAge: parseInt(authConfig.session.maxAge) * 1000
    }
  }));

  // Request logging
  app.use((req, res, next) => {
    const startTime = Date.now();
    res.on('finish', () => {
      logger.info({
        method: req.method,
        url: req.url,
        status: res.statusCode,
        responseTime: Date.now() - startTime,
        correlationId: req.headers['x-correlation-id']
      });
    });
    next();
  });
};

/**
 * Initializes and starts the authentication service with monitoring
 */
const startServer = (): void => {
  const PORT = process.env.PORT || 3001;

  // Configure middleware
  configureMiddleware();

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(HTTP_STATUS.OK).json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  });

  // Mount authentication routes
  app.use('/api/v1/auth', router);

  // Global error handler
  app.use(errorHandler);

  // Start server
  const server = app.listen(PORT, () => {
    logger.info(`Authentication service started on port ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received. Closing server...');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
};

// Initialize server
startServer();

// Export app for testing
export { app };