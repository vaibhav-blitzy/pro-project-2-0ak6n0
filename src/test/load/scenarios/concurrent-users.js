import { check, sleep } from 'k6'; // v0.45.0
import { Faker } from '@faker-js/faker'; // v8.0.0
import { ApiClient } from '../../utils/api-client';
import { PerformanceTest } from '../../utils/performance-metrics';
import { users } from '../data/users.json';

// Initialize faker instance
const faker = new Faker();

// Performance thresholds based on technical specifications
export const options = {
  vus: 1000, // Simulating 1000 concurrent users
  duration: '30m',
  thresholds: {
    http_req_duration: ['p(95)<500'], // API response time < 500ms
    http_req_failed: ['rate<0.01'], // Error rate < 1%
    iteration_duration: ['p(90)<3000'], // Full operation < 3s
    mfa_flow_duration: ['p(95)<5000'], // MFA flow < 5s
    search_duration: ['p(95)<500'] // Search operations < 500ms
  }
};

// API endpoints based on the technical specification
const ENDPOINTS = {
  LOGIN: '/api/v1/auth/login',
  MFA: '/api/v1/auth/mfa',
  DASHBOARD: '/api/v1/dashboard',
  TASKS: '/api/v1/tasks',
  PROJECTS: '/api/v1/projects',
  SEARCH: '/api/v1/search',
  NOTIFICATIONS: '/api/v1/notifications'
};

// Initialize performance test utilities
const performanceTest = new PerformanceTest({
  retentionPeriod: 24 * 60 * 60, // 24 hours
  rotationSize: 1000000,
  storageType: 'persistent'
});

// Test setup function
export function setup() {
  // Initialize test context with user distribution
  const testContext = {
    adminUsers: users.adminUsers, // 1% of users
    managerUsers: users.managerUsers, // 9% of users
    memberUsers: users.memberUsers, // 90% of users
    mfaUsers: users.mfaUsers, // 10% of total users with MFA enabled
    apiClient: new ApiClient({
      baseURL: __ENV.API_BASE_URL || 'http://localhost:3000',
      timeout: 5000,
      validateSecurity: true
    }),
    performanceMetrics: performanceTest
  };

  return testContext;
}

// Main test function
export default function(testContext) {
  // Distribute users according to role percentages
  const userPool = determineUserPool(testContext);
  const user = selectRandomUser(userPool);

  // Simulate user session with performance tracking
  const sessionMetrics = simulateUserSession(user, testContext);
  
  // Validate performance metrics
  validatePerformance(sessionMetrics);

  // Add think time between iterations
  sleep(faker.number.int({ min: 1, max: 5 }));
}

// Helper function to simulate realistic user session
async function simulateUserSession(user, testContext) {
  const metrics = {
    loginDuration: 0,
    mfaDuration: 0,
    operationDurations: [],
    errors: []
  };

  try {
    // Login flow with MFA handling
    const loginStart = Date.now();
    const loginResponse = await testContext.apiClient.post(ENDPOINTS.LOGIN, {
      email: user.email,
      password: user.password
    });

    check(loginResponse, {
      'login successful': (r) => r.status === 200,
      'auth token present': (r) => r.json('token') !== undefined
    });

    metrics.loginDuration = Date.now() - loginStart;

    // Handle MFA if enabled
    if (user.mfaEnabled) {
      const mfaStart = Date.now();
      const mfaResponse = await testContext.apiClient.post(ENDPOINTS.MFA, {
        code: generateMFACode(user.mfaSecret)
      });

      check(mfaResponse, {
        'mfa verification successful': (r) => r.status === 200
      });

      metrics.mfaDuration = Date.now() - mfaStart;
    }

    // Set auth token for subsequent requests
    testContext.apiClient.setAuthToken(loginResponse.json('token'));

    // Simulate user operations based on role
    await simulateRoleSpecificOperations(user, testContext, metrics);

  } catch (error) {
    metrics.errors.push({
      operation: 'userSession',
      error: error.message,
      timestamp: Date.now()
    });
  }

  return metrics;
}

// Helper function to simulate role-specific operations
async function simulateRoleSpecificOperations(user, testContext, metrics) {
  const operations = getRoleOperations(user.role);
  
  for (const operation of operations) {
    const startTime = Date.now();
    
    try {
      switch (operation) {
        case 'viewDashboard':
          await testContext.apiClient.get(ENDPOINTS.DASHBOARD);
          break;
        case 'createTask':
          await testContext.apiClient.post(ENDPOINTS.TASKS, generateTaskData());
          break;
        case 'searchTasks':
          await testContext.apiClient.get(`${ENDPOINTS.SEARCH}?q=${encodeURIComponent(faker.word.words())}`);
          break;
        case 'viewProjects':
          await testContext.apiClient.get(ENDPOINTS.PROJECTS);
          break;
        case 'checkNotifications':
          await testContext.apiClient.get(ENDPOINTS.NOTIFICATIONS);
          break;
      }

      metrics.operationDurations.push({
        operation,
        duration: Date.now() - startTime
      });

    } catch (error) {
      metrics.errors.push({
        operation,
        error: error.message,
        timestamp: Date.now()
      });
    }
  }
}

// Helper function to validate performance metrics
function validatePerformance(metrics) {
  const validations = {
    login: metrics.loginDuration < 500,
    mfa: metrics.mfaDuration < 5000,
    operations: metrics.operationDurations.every(op => op.duration < 500),
    errors: metrics.errors.length === 0
  };

  testContext.performanceMetrics.addMetric({
    timestamp: Date.now(),
    metrics,
    validations
  });
}

// Helper function to generate random task data
function generateTaskData() {
  return {
    title: faker.word.words(3),
    description: faker.word.words(10),
    priority: faker.helpers.arrayElement(['HIGH', 'MEDIUM', 'LOW']),
    dueDate: faker.date.future()
  };
}

// Helper function to determine user pool based on VU number
function determineUserPool(testContext) {
  const vuNumber = __VU % 100;
  if (vuNumber < 1) return testContext.adminUsers;
  if (vuNumber < 10) return testContext.managerUsers;
  return testContext.memberUsers;
}

// Helper function to select random user from pool
function selectRandomUser(userPool) {
  return userPool[Math.floor(Math.random() * userPool.length)];
}

// Helper function to get role-specific operations
function getRoleOperations(role) {
  const baseOperations = ['viewDashboard', 'searchTasks', 'checkNotifications'];
  
  switch (role) {
    case 'ADMIN':
      return [...baseOperations, 'createTask', 'viewProjects', 'manageUsers'];
    case 'MANAGER':
      return [...baseOperations, 'createTask', 'viewProjects'];
    default:
      return [...baseOperations, 'createTask'];
  }
}

// Helper function to generate MFA code (simplified for testing)
function generateMFACode(secret) {
  // In real implementation, this would use TOTP algorithm
  return '123456';
}