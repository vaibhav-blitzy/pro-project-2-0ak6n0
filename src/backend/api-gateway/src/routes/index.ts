/**
 * @fileoverview Main routing configuration for the API Gateway implementing enterprise-grade
 * service routing, security, monitoring, and advanced request handling.
 * @version 1.0.0
 */

import express, { Router, Request, Response, NextFunction } from 'express'; // v4.18.2
import { createProxyMiddleware, Options as ProxyOptions } from 'http-proxy-middleware'; // v2.0.6
import { authenticateToken, validateRole } from '../middleware/auth.middleware';
import { corsMiddleware } from '../middleware/cors.middleware';
import { createRequestLogger } from '../middleware/logging.middleware';
import { checkRateLimit, generateRateLimitHeaders } from '../config/rate-limiting';
import { Logger } from '../../../shared/utils/logger';
import { MetricsManager } from '../../../shared/utils/metrics';
import { HTTP_STATUS, ERROR_CODES } from '../../../shared/constants';

// Initialize logger and metrics
const logger = new Logger('ApiGateway');
const metricsManager = new MetricsManager('api_gateway', {
  collectDefaultMetrics: true,
  metricsEndpointAuth: true
});

// Service routes configuration
const SERVICE_ROUTES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  tasks: process.env.TASK_SERVICE_URL || 'http://task-service:3002',
  projects: process.env.PROJECT_SERVICE_URL || 'http://project-service:3003',
  notifications: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3004',
  search: process.env.SEARCH_SERVICE_URL || 'http://search-service:3005'
};

/**
 * Creates an enhanced proxy middleware with circuit breaker and monitoring
 * @param serviceUrl - Target service URL
 * @param options - Proxy configuration options
 */
const createServiceProxy = (serviceUrl: string, options: ProxyOptions = {}) => {
  const requestCounter = metricsManager.createCounter(
    'proxy_requests_total',
    'Total proxy requests',
    ['service', 'status']
  );

  const requestLatency = metricsManager.createHistogram(
    'proxy_request_duration_seconds',
    'Proxy request duration',
    ['service']
  );

  return createProxyMiddleware({
    target: serviceUrl,
    changeOrigin: true,
    pathRewrite: options.pathRewrite,
    proxyTimeout: 30000,
    onProxyReq: (proxyReq, req) => {
      // Add correlation ID and security headers
      proxyReq.setHeader('X-Correlation-ID', req.headers['x-correlation-id'] || crypto.randomUUID());
      proxyReq.setHeader('X-Forwarded-User', (req as any).user?.id || '');
    },
    onProxyRes: (proxyRes, req) => {
      const service = new URL(serviceUrl).hostname;
      requestCounter.inc({ service, status: proxyRes.statusCode.toString() });
    },
    onError: (err, req, res) => {
      logger.error('Proxy error', err, { serviceUrl });
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'Service temporarily unavailable',
        errorCode: ERROR_CODES.INTERNAL_ERROR
      });
    },
    ...options
  });
};

// Initialize router
const router = Router();

// Apply global middleware
router.use(corsMiddleware);
router.use(createRequestLogger(logger, metricsManager));

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Metrics endpoint
router.get('/metrics', metricsManager.getMetricsMiddleware());

// Auth service routes
router.use('/api/v1/auth', 
  async (req: Request, res: Response, next: NextFunction) => {
    const rateLimitResult = await checkRateLimit(req.ip, 'user', req.headers['x-correlation-id'] as string);
    if (!rateLimitResult.allowed) {
      res.set(generateRateLimitHeaders(rateLimitResult));
      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        message: 'Rate limit exceeded',
        errorCode: ERROR_CODES.RATE_LIMIT_EXCEEDED
      });
      return;
    }
    next();
  },
  createServiceProxy(SERVICE_ROUTES.auth)
);

// Task service routes
router.use('/api/v1/tasks',
  authenticateToken,
  validateRole(['ADMIN', 'MANAGER', 'MEMBER']),
  createServiceProxy(SERVICE_ROUTES.tasks)
);

// Project service routes
router.use('/api/v1/projects',
  authenticateToken,
  validateRole(['ADMIN', 'MANAGER']),
  createServiceProxy(SERVICE_ROUTES.projects)
);

// Notification service routes
router.use('/api/v1/notifications',
  authenticateToken,
  createServiceProxy(SERVICE_ROUTES.notifications)
);

// Search service routes
router.use('/api/v1/search',
  authenticateToken,
  createServiceProxy(SERVICE_ROUTES.search)
);

// Global error handler
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: 'Internal server error',
    errorCode: ERROR_CODES.INTERNAL_ERROR
  });
});

export { router };