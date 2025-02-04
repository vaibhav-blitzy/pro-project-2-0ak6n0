// External imports with versions
import { check, sleep } from 'k6'; // v0.45.0
import http from 'k6/http'; // v0.45.0
import { Rate, Counter, Trend } from 'k6/metrics'; // v0.45.0

// Internal imports
import { measureApiResponse, analyzePerformanceMetrics } from './utils/performance-metrics';

// Environment configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const ENVIRONMENT = process.env.TEST_ENV || 'development';

// Custom metrics configuration
const customMetrics = {
  pageLoadTime: new Trend('page_load_time'),
  firstPaintTime: new Trend('first_paint_time'),
  firstInteractiveTime: new Trend('first_interactive_time'),
  apiReadTime: new Trend('api_read_time'),
  apiWriteTime: new Trend('api_write_time'),
  apiBatchTime: new Trend('api_batch_time'),
  searchSimpleTime: new Trend('search_simple_time'),
  searchComplexTime: new Trend('search_complex_time'),
  errorRate: new Rate('error_rate'),
  rateLimitHits: new Counter('rate_limit_hits'),
  concurrentUsers: new Trend('concurrent_users')
};

// Performance thresholds configuration
const DEFAULT_THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.01'],
  iteration_duration: ['p(95)<3000', 'p(99)<5000'],
  page_load_time: ['p(95)<3000', 'first_paint<1000', 'first_interactive<2000'],
  api_response_time: ['read_p95<100', 'write_p95<200', 'batch_p95<500'],
  search_response_time: ['simple_p95<200', 'complex_p95<500']
};

// Configure comprehensive metrics for performance tracking
function configureMetrics() {
  return {
    pageLoadMetrics: {
      firstPaint: customMetrics.firstPaintTime,
      firstInteractive: customMetrics.firstInteractiveTime,
      fullPageLoad: customMetrics.pageLoadTime
    },
    apiMetrics: {
      read: customMetrics.apiReadTime,
      write: customMetrics.apiWriteTime,
      batch: customMetrics.apiBatchTime
    },
    searchMetrics: {
      simple: customMetrics.searchSimpleTime,
      complex: customMetrics.searchComplexTime
    },
    errorMetrics: {
      rate: customMetrics.errorRate,
      rateLimiting: customMetrics.rateLimitHits
    },
    userMetrics: {
      concurrent: customMetrics.concurrentUsers
    }
  };
}

// Configure test scenarios based on environment
function configureScenarios(environment: string) {
  const baseConfig = {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      tags: { test_type: 'smoke' }
    },
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 100 },
        { duration: '10m', target: 100 },
        { duration: '5m', target: 0 }
      ],
      tags: { test_type: 'load' }
    },
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: 100 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 300 },
        { duration: '1m', target: 0 }
      ],
      tags: { test_type: 'stress' }
    },
    soak: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2h',
      tags: { test_type: 'soak' }
    },
    rateLimiting: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 150,
      maxDuration: '1h',
      tags: { test_type: 'rate_limit' }
    }
  };

  // Environment-specific adjustments
  switch (environment) {
    case 'production':
      return {
        ...baseConfig,
        load: {
          ...baseConfig.load,
          stages: [
            { duration: '10m', target: 200 },
            { duration: '20m', target: 200 },
            { duration: '10m', target: 0 }
          ]
        }
      };
    case 'staging':
      return baseConfig;
    default:
      return {
        ...baseConfig,
        load: {
          ...baseConfig.load,
          stages: [
            { duration: '2m', target: 50 },
            { duration: '5m', target: 50 },
            { duration: '2m', target: 0 }
          ]
        }
      };
  }
}

// Export k6 options configuration
export const options = {
  scenarios: configureScenarios(ENVIRONMENT),
  thresholds: DEFAULT_THRESHOLDS,
  userScenarios: {
    regularUser: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 100,
      stages: [
        { target: 10, duration: '5m' },
        { target: 10, duration: '10m' },
        { target: 0, duration: '5m' }
      ]
    }
  }
};

// Export metrics configuration
export const metrics = {
  customMetrics: configureMetrics(),
  metricThresholds: {
    ...DEFAULT_THRESHOLDS,
    [`${customMetrics.errorRate.name}`]: ['rate<0.01'],
    [`${customMetrics.rateLimitHits.name}`]: ['count<1000'],
    [`${customMetrics.apiReadTime.name}`]: ['p(95)<100'],
    [`${customMetrics.apiWriteTime.name}`]: ['p(95)<200'],
    [`${customMetrics.apiBatchTime.name}`]: ['p(95)<500'],
    [`${customMetrics.searchSimpleTime.name}`]: ['p(95)<200'],
    [`${customMetrics.searchComplexTime.name}`]: ['p(95)<500']
  }
};