/**
 * @fileoverview Test API Client Utility Module
 * Provides a configured API client instance for testing with comprehensive support
 * for authentication, request interception, response mocking, and security validation.
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'; // ^1.6.0
import MockAdapter from 'axios-mock-adapter'; // ^1.22.0
import nock from 'nock'; // ^13.4.0
import { API_ENDPOINTS } from '../../web/src/constants/api.constants';
import { ApiResponse, ApiHeaders, ApiError, isApiError } from '../../web/src/types/api.types';

/**
 * Interface for test API client configuration
 */
interface TestApiClientConfig {
  baseURL?: string;
  timeout?: number;
  useMockAdapter?: boolean;
  retryConfig?: {
    attempts: number;
    delay: number;
  };
  validateSecurity?: boolean;
}

/**
 * Interface for response time metrics
 */
interface ResponseMetrics {
  responseTimes: number[];
  getResponseTimes: () => number[];
  getAverageResponseTime: () => number;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: TestApiClientConfig = {
  baseURL: 'http://localhost:3000/api',
  timeout: 5000,
  useMockAdapter: false,
  retryConfig: {
    attempts: 3,
    delay: 1000
  },
  validateSecurity: true
};

/**
 * Required security headers for API requests
 */
const REQUIRED_SECURITY_HEADERS = [
  'Authorization',
  'X-Request-ID',
  'X-API-Version',
  'Content-Security-Policy'
];

/**
 * Creates a configured API client instance for testing
 */
export const createTestApiClient = (config: TestApiClientConfig = DEFAULT_CONFIG) => {
  const metrics: ResponseMetrics = {
    responseTimes: [],
    getResponseTimes: () => [...metrics.responseTimes],
    getAverageResponseTime: () => {
      const sum = metrics.responseTimes.reduce((acc, time) => acc + time, 0);
      return metrics.responseTimes.length ? sum / metrics.responseTimes.length : 0;
    }
  };

  // Create axios instance with configuration
  const apiClient: AxiosInstance = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout,
    validateStatus: (status) => status < 500
  });

  // Request interceptor for security headers and authentication
  apiClient.interceptors.request.use((request) => {
    request.headers = {
      ...request.headers,
      'X-Request-ID': `test-${Date.now()}`,
      'X-API-Version': 'v1',
      'Content-Security-Policy': "default-src 'self'"
    };
    return request;
  });

  // Response interceptor for performance tracking and validation
  apiClient.interceptors.response.use(
    (response: AxiosResponse) => {
      const responseTime = Date.now() - (response.config.timestamp || Date.now());
      metrics.responseTimes.push(responseTime);

      if (config.validateSecurity) {
        validateSecurityHeaders(response.headers);
      }

      return response;
    },
    async (error) => {
      if (error.config && error.config.retryCount < (config.retryConfig?.attempts || 3)) {
        error.config.retryCount = (error.config.retryCount || 0) + 1;
        await new Promise(resolve => setTimeout(resolve, config.retryConfig?.delay || 1000));
        return apiClient(error.config);
      }
      return Promise.reject(error);
    }
  );

  // Initialize mock adapter if requested
  const mockAdapter = config.useMockAdapter ? new MockAdapter(apiClient) : undefined;

  return { apiClient, mockAdapter, metrics };
};

/**
 * Sets up authentication token for test requests
 */
export const setupAuthToken = (
  token: string,
  options: { validateToken?: boolean } = {}
): void => {
  if (options.validateToken && (!token || token.length < 32)) {
    throw new Error('Invalid authentication token format');
  }

  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

/**
 * Sets up a mock response for API testing
 */
export const mockApiResponse = async <T>(
  method: string,
  url: string,
  response: T,
  statusCode: number = 200,
  options: {
    delay?: number;
    validateHeaders?: boolean;
    simulateError?: boolean;
  } = {}
): Promise<void> => {
  const scope = nock(DEFAULT_CONFIG.baseURL!)
    .intercept(url, method)
    .reply(function(uri, requestBody) {
      if (options.validateHeaders) {
        const missingHeaders = validateSecurityHeaders(this.req.headers);
        if (missingHeaders.length) {
          return [400, { error: `Missing required headers: ${missingHeaders.join(', ')}` }];
        }
      }

      if (options.simulateError) {
        return [500, { error: 'Simulated server error' }];
      }

      return [
        statusCode,
        {
          data: response,
          status: statusCode,
          timestamp: new Date().toISOString(),
          requestId: this.req.headers['x-request-id']
        }
      ];
    });

  if (options.delay) {
    scope.delay(options.delay);
  }
};

/**
 * Validates API response against requirements
 */
export const validateApiResponse = async <T>(
  response: ApiResponse<T>,
  options: {
    validateSecurity?: boolean;
    validatePerformance?: boolean;
  } = {}
): Promise<boolean> => {
  // Validate response structure
  if (!response || !response.data) {
    throw new Error('Invalid response structure');
  }

  // Validate security if enabled
  if (options.validateSecurity) {
    const missingHeaders = validateSecurityHeaders(response.headers as ApiHeaders);
    if (missingHeaders.length) {
      throw new Error(`Security validation failed: Missing headers ${missingHeaders.join(', ')}`);
    }
  }

  // Validate performance if enabled
  if (options.validatePerformance && response.responseTime > 500) {
    throw new Error(`Performance validation failed: Response time ${response.responseTime}ms exceeds 500ms SLA`);
  }

  return true;
};

/**
 * Validates required security headers
 */
const validateSecurityHeaders = (headers: ApiHeaders): string[] => {
  const missingHeaders = REQUIRED_SECURITY_HEADERS.filter(
    header => !headers[header]
  );
  return missingHeaders;
};

/**
 * Export test API client utilities
 */
export const testApiClient = {
  createTestApiClient,
  setupAuthToken,
  mockApiResponse,
  validateApiResponse
};

export default testApiClient;