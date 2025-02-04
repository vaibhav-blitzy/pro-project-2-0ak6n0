/**
 * @fileoverview Kong API Gateway configuration implementing enterprise-grade routing,
 * security, monitoring, and service discovery for the Task Management System.
 * @version 1.0.0
 */

import { config } from 'dotenv'; // v16.3.1
import { IBaseResponse } from '../../../shared/interfaces/base.interface';
import { APIGatewayErrorHandler } from '../utils/error-handler';
import { HTTP_STATUS } from '../../../shared/constants';

// Load environment variables
config();

// Global configuration constants
const KONG_ADMIN_URL = process.env.KONG_ADMIN_URL || 'http://localhost:8001';
const KONG_PROXY_URL = process.env.KONG_PROXY_URL || 'http://localhost:8000';
const KONG_SERVICES = process.env.KONG_SERVICES || 'auth,tasks,projects,notifications,search';

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  userLimits: {
    perHour: 1000,
    perDay: 10000
  },
  orgLimits: {
    perHour: 5000,
    perDay: 50000
  },
  policy: 'redis',
  redisConfig: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    keyPrefix: 'ratelimit:'
  }
};

/**
 * Kong Gateway service configuration with health checks and routing
 */
export const kongConfig = {
  services: {
    auth: {
      url: 'http://auth-service:3000',
      routes: ['/api/v1/auth'],
      healthCheck: {
        active: true,
        interval: 10,
        timeout: 5,
        healthy_threshold: 2,
        unhealthy_threshold: 3
      }
    },
    tasks: {
      url: 'http://task-service:8080',
      routes: ['/api/v1/tasks'],
      healthCheck: {
        active: true,
        interval: 10,
        timeout: 5,
        healthy_threshold: 2,
        unhealthy_threshold: 3
      }
    },
    projects: {
      url: 'http://project-service:8080',
      routes: ['/api/v1/projects'],
      healthCheck: {
        active: true,
        interval: 10,
        timeout: 5,
        healthy_threshold: 2,
        unhealthy_threshold: 3
      }
    },
    notifications: {
      url: 'http://notification-service:3000',
      routes: ['/api/v1/notifications'],
      healthCheck: {
        active: true,
        interval: 10,
        timeout: 5,
        healthy_threshold: 2,
        unhealthy_threshold: 3
      }
    },
    search: {
      url: 'http://search-service:3000',
      routes: ['/api/v1/search'],
      healthCheck: {
        active: true,
        interval: 10,
        timeout: 5,
        healthy_threshold: 2,
        unhealthy_threshold: 3
      }
    }
  },
  plugins: {
    cors: {
      enabled: true,
      origins: ['*'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      headers: ['Authorization', 'Content-Type', 'X-Request-ID'],
      exposed_headers: ['X-Kong-Response-Time', 'X-Kong-Request-ID'],
      credentials: true,
      max_age: 3600
    },
    rate_limiting: {
      enabled: true,
      user_hour: RATE_LIMIT_CONFIG.userLimits.perHour,
      org_hour: RATE_LIMIT_CONFIG.orgLimits.perHour,
      policy: RATE_LIMIT_CONFIG.policy,
      fault_tolerant: true,
      hide_client_headers: false
    },
    jwt: {
      enabled: true,
      key_claim_name: 'kid',
      claims_to_verify: ['exp', 'nbf', 'iss'],
      maximum_expiration: 3600,
      secret_is_base64: true
    },
    request_transformer: {
      enabled: true,
      add: {
        headers: ['X-Request-ID:$(uuid)', 'X-Service-Version:1.0'],
        querystring: ['correlation_id:$(uuid)']
      }
    },
    response_transformer: {
      enabled: true,
      add: {
        headers: [
          'X-Kong-Response-Time',
          'X-Content-Type-Options:nosniff',
          'Strict-Transport-Security:max-age=31536000',
          'X-Frame-Options:DENY',
          'X-XSS-Protection:1; mode=block'
        ]
      }
    },
    prometheus: {
      enabled: true,
      status_codes: true,
      latency: true,
      bandwidth: true,
      per_consumer: true
    },
    http_log: {
      enabled: true,
      http_endpoint: 'http://logging-service:3000/logs',
      timeout: 10000,
      keepalive: 60000,
      retry_count: 3,
      queue_size: 1000,
      flush_timeout: 2
    },
    circuit_breaker: {
      enabled: true,
      timeout: 60,
      threshold: 0.5,
      window_size: 60,
      volume_threshold: 20
    }
  }
};

/**
 * Registers a microservice with Kong Gateway including health checks and security configurations
 * @param serviceName - Name of the service to register
 * @param serviceUrl - URL of the service
 */
export const registerService = async (
  serviceName: string,
  serviceUrl: string
): Promise<void> => {
  try {
    const serviceConfig = {
      name: serviceName,
      url: serviceUrl,
      protocol: 'http',
      connect_timeout: 60000,
      write_timeout: 60000,
      read_timeout: 60000,
      retries: 5
    };

    // Register service with Kong
    await fetch(`${KONG_ADMIN_URL}/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serviceConfig)
    });

    // Configure service routes
    const routeConfig = {
      name: `${serviceName}-route`,
      paths: kongConfig.services[serviceName as keyof typeof kongConfig.services].routes,
      strip_path: false,
      preserve_host: true,
      protocols: ['http', 'https']
    };

    await fetch(`${KONG_ADMIN_URL}/services/${serviceName}/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(routeConfig)
    });

    // Apply service plugins
    for (const [pluginName, pluginConfig] of Object.entries(kongConfig.plugins)) {
      await fetch(`${KONG_ADMIN_URL}/services/${serviceName}/plugins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pluginName,
          config: pluginConfig
        })
      });
    }
  } catch (error) {
    throw APIGatewayErrorHandler.handleServiceError(error as Error);
  }
};

/**
 * Creates and applies Kong Gateway configuration including services, routes, plugins,
 * and advanced security settings
 */
export const createKongConfig = async (): Promise<void> => {
  try {
    // Register all microservices
    const services = KONG_SERVICES.split(',');
    for (const service of services) {
      const serviceConfig = kongConfig.services[service as keyof typeof kongConfig.services];
      if (serviceConfig) {
        await registerService(service, serviceConfig.url);
      }
    }

    // Configure global plugins
    for (const [pluginName, pluginConfig] of Object.entries(kongConfig.plugins)) {
      await fetch(`${KONG_ADMIN_URL}/plugins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pluginName,
          config: pluginConfig
        })
      });
    }
  } catch (error) {
    throw APIGatewayErrorHandler.handleGatewayError(error as Error);
  }
};