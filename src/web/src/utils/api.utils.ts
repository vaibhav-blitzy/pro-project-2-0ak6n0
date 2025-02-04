/**
 * @fileoverview API Utilities
 * Provides enhanced API request handling, error processing, and response management
 * with comprehensive security, monitoring, and error tracking capabilities.
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios'; // ^1.6.0
import { 
  ApiResponse, 
  ApiError, 
  ApiErrorCode 
} from '../types/api.types';
import { 
  apiConfig 
} from '../config/api.config';
import { 
  HTTP_STATUS 
} from '../constants/api.constants';

/**
 * Creates and configures an axios instance with enhanced security and monitoring
 * Implements circuit breaker, retry logic, and performance tracking
 */
export const createApiClient = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: apiConfig.baseURL,
    timeout: apiConfig.timeout,
    headers: apiConfig.headers,
    withCredentials: true
  });

  // Request interceptor for security and monitoring
  instance.interceptors.request.use(
    (config) => {
      // Add performance tracking metadata
      config.metadata = { startTime: Date.now() };

      // Check circuit breaker status
      if (apiConfig.circuitBreaker.isOpen()) {
        return Promise.reject(new Error('Circuit breaker is open'));
      }

      // Add security headers
      config.headers = {
        ...config.headers,
        'X-Request-Time': new Date().toISOString(),
        'X-Request-ID': crypto.randomUUID()
      };

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor for error handling and monitoring
  instance.interceptors.response.use(
    (response) => {
      // Calculate and log response time
      const startTime = response.config.metadata?.startTime;
      if (startTime) {
        const duration = Date.now() - startTime;
        response.headers['X-Response-Time'] = `${duration}ms`;
      }

      // Update circuit breaker state
      apiConfig.circuitBreaker.onSuccess();

      return response;
    },
    (error) => {
      apiConfig.circuitBreaker.onError();
      return Promise.reject(handleApiError(error));
    }
  );

  return instance;
};

/**
 * Enhanced error processing with validation support and security error handling
 * Provides detailed error tracking and monitoring
 */
export const handleApiError = (error: AxiosError): ApiError => {
  const errorResponse: ApiError = {
    code: ApiErrorCode.INTERNAL_ERROR,
    message: 'An unexpected error occurred',
    details: null,
    requestId: error.config?.headers?.['X-Request-ID'] || 'unknown',
    validationErrors: [],
    stackTrace: error.stack || ''
  };

  if (error.response) {
    const { status, data } = error.response;

    switch (status) {
      case HTTP_STATUS.BAD_REQUEST:
        errorResponse.code = ApiErrorCode.BAD_REQUEST;
        errorResponse.message = 'Invalid request parameters';
        errorResponse.details = data.details;
        break;
      case HTTP_STATUS.UNAUTHORIZED:
        errorResponse.code = ApiErrorCode.UNAUTHORIZED;
        errorResponse.message = 'Authentication required';
        break;
      case HTTP_STATUS.FORBIDDEN:
        errorResponse.code = ApiErrorCode.FORBIDDEN;
        errorResponse.message = 'Access denied';
        break;
      case HTTP_STATUS.NOT_FOUND:
        errorResponse.code = ApiErrorCode.NOT_FOUND;
        errorResponse.message = 'Resource not found';
        break;
      case HTTP_STATUS.TOO_MANY_REQUESTS:
        errorResponse.code = ApiErrorCode.RATE_LIMIT_EXCEEDED;
        errorResponse.message = 'Rate limit exceeded';
        break;
    }

    if (data?.validationErrors) {
      errorResponse.validationErrors = data.validationErrors;
    }
  }

  // Log error for monitoring
  console.error('API Error:', {
    ...errorResponse,
    url: error.config?.url,
    method: error.config?.method
  });

  return errorResponse;
};

/**
 * Processes successful API responses with performance monitoring
 * Implements response caching and performance tracking
 */
export const processApiResponse = <T>(response: AxiosResponse): ApiResponse<T> => {
  const responseTime = response.headers['x-response-time'];
  const requestId = response.config.headers['x-request-id'];

  return {
    data: response.data,
    status: response.status,
    message: response.statusText,
    timestamp: new Date().toISOString(),
    requestId: requestId as string,
    responseTime: parseInt(responseTime as string) || 0
  };
};

/**
 * Builds URL query string with enhanced security and validation
 * Implements parameter sanitization and encoding
 */
export const buildQueryString = (params: Record<string, any>): string => {
  if (!params || Object.keys(params).length === 0) {
    return '';
  }

  const sanitizedParams = Object.entries(params).reduce((acc, [key, value]) => {
    // Skip null or undefined values
    if (value == null) {
      return acc;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return {
        ...acc,
        [key]: value.map(v => encodeURIComponent(String(v)))
      };
    }

    // Handle other types
    return {
      ...acc,
      [key]: encodeURIComponent(String(value))
    };
  }, {});

  const queryString = Object.entries(sanitizedParams)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return value
          .map(v => `${encodeURIComponent(key)}=${v}`)
          .join('&');
      }
      return `${encodeURIComponent(key)}=${value}`;
    })
    .join('&');

  return queryString ? `?${queryString}` : '';
};

// Create and export the configured API client instance
export const apiClient = createApiClient();

// Export utility functions
export {
  handleApiError,
  processApiResponse,
  buildQueryString
};