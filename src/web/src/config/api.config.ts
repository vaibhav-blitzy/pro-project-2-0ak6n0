/**
 * @fileoverview API Configuration
 * Configures API client settings, base URLs, timeouts, retries, and other API-related configurations
 * for the frontend application's communication with backend microservices.
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'; // ^1.6.0
import axiosRetry from 'axios-retry'; // ^3.8.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0

import { API_ENDPOINTS, API_VERSION, API_BASE_PATH } from '../constants/api.constants';
import { CircuitBreakerConfig, ApiHeaders, ApiErrorCode, ApiContentType } from '../types/api.types';

// Global configuration constants
const API_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const CIRCUIT_BREAKER_THRESHOLD = 5;

/**
 * Generates a unique request ID for tracking
 */
const generateRequestId = (): string => uuidv4();

/**
 * Default headers for all API requests
 */
const DEFAULT_HEADERS: ApiHeaders = {
  'Accept': ApiContentType.APPLICATION_JSON,
  'Content-Type': ApiContentType.APPLICATION_JSON,
  'X-API-Version': API_VERSION,
  'X-Request-ID': generateRequestId(),
  'X-Client-Version': process.env.REACT_APP_VERSION || '1.0.0'
};

/**
 * HTTP status codes that should trigger a retry
 */
const RETRY_STATUS_CODES = [408, 429, 500, 502, 503, 504];

/**
 * Circuit breaker configuration
 */
const CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  threshold: CIRCUIT_BREAKER_THRESHOLD,
  timeout: 60000,
  resetTimeout: 30000
};

/**
 * Determines the API base URL based on environment
 */
const getBaseUrl = (): string => {
  const env = process.env.NODE_ENV;
  const devUrl = 'http://localhost:8080';
  const stagingUrl = 'https://api-staging.taskmanager.com';
  const prodUrl = 'https://api.taskmanager.com';

  let baseUrl = env === 'production' ? prodUrl : 
                env === 'staging' ? stagingUrl : 
                devUrl;

  return `${baseUrl}${API_BASE_PATH}/${API_VERSION}`;
};

/**
 * Creates retry configuration with exponential backoff
 */
const createRetryConfig = () => ({
  retries: MAX_RETRIES,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error: any) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
           RETRY_STATUS_CODES.includes(error.response?.status);
  },
  shouldResetTimeout: true,
  onRetry: (retryCount: number, error: any) => {
    console.warn(`Retry attempt ${retryCount} for request:`, {
      url: error.config.url,
      method: error.config.method,
      error: error.message
    });
  }
});

/**
 * Configures circuit breaker pattern for API resilience
 */
const setupCircuitBreaker = (config: CircuitBreakerConfig) => {
  let failures = 0;
  let lastFailureTime: number | null = null;
  let circuitOpen = false;

  return {
    isOpen: () => circuitOpen,
    onSuccess: () => {
      failures = 0;
      circuitOpen = false;
    },
    onError: () => {
      failures++;
      lastFailureTime = Date.now();
      
      if (failures >= config.threshold) {
        circuitOpen = true;
        setTimeout(() => {
          circuitOpen = false;
          failures = 0;
        }, config.resetTimeout);
      }
    },
    canRequest: () => {
      if (!circuitOpen) return true;
      if (lastFailureTime && (Date.now() - lastFailureTime) > config.timeout) {
        circuitOpen = false;
        return true;
      }
      return false;
    }
  };
};

/**
 * Creates and configures the API client instance
 */
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: getBaseUrl(),
    timeout: API_TIMEOUT,
    headers: DEFAULT_HEADERS,
    withCredentials: true
  });

  // Configure retry mechanism
  axiosRetry(client, createRetryConfig());

  // Initialize circuit breaker
  const circuitBreaker = setupCircuitBreaker(CIRCUIT_BREAKER_CONFIG);

  // Request interceptor
  client.interceptors.request.use(
    (config) => {
      if (!circuitBreaker.canRequest()) {
        return Promise.reject(new Error(ApiErrorCode.SERVICE_UNAVAILABLE));
      }

      // Add request timestamp for performance monitoring
      config.metadata = { startTime: Date.now() };
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor
  client.interceptors.response.use(
    (response) => {
      circuitBreaker.onSuccess();
      
      // Calculate response time for monitoring
      const startTime = response.config.metadata?.startTime;
      if (startTime) {
        const duration = Date.now() - startTime;
        response.headers['X-Response-Time'] = `${duration}ms`;
      }

      return response;
    },
    (error) => {
      circuitBreaker.onError();
      return Promise.reject(error);
    }
  );

  return client;
};

/**
 * Export API configuration and client instance
 */
export const apiConfig = {
  baseURL: getBaseUrl(),
  timeout: API_TIMEOUT,
  headers: DEFAULT_HEADERS,
  retryConfig: createRetryConfig(),
  circuitBreaker: setupCircuitBreaker(CIRCUIT_BREAKER_CONFIG),
  client: createApiClient()
};

export default apiConfig;