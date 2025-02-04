import { check } from 'k6'; // v0.45.0
import { faker } from '@faker-js/faker'; // v8.0.0
import { ApiClient } from '../../utils/api-client';
import { PerformanceMetricsCollector } from '../../utils/performance-metrics';

// Performance thresholds based on technical specifications
const THRESHOLDS = {
  project_creation: 200, // ms
  project_update: 200,   // ms
  project_retrieval: 100, // ms
  concurrent_operations: 500, // ms
  error_rate: 0.01, // 1%
  requests_per_second: 100
};

// Rate limiting configuration
const RATE_LIMITS = {
  org_requests_per_hour: 5000,
  tracking_window: 3600 // 1 hour in seconds
};

/**
 * Test setup function initializing API client and metrics collector
 */
export function setup() {
  const apiClient = new ApiClient({
    baseURL: __ENV.API_BASE_URL || 'http://localhost:3000/api',
    timeout: 5000,
    validateSecurity: true
  });

  const metricsCollector = new PerformanceMetricsCollector({
    storageConfig: {
      retentionPeriod: 24 * 60 * 60, // 24 hours
      rotationSize: 10000,
      storageType: 'persistent'
    }
  });

  apiClient.setSecurityHeaders({
    'X-API-Version': 'v1',
    'Content-Security-Policy': "default-src 'self'",
    'X-Request-ID': `load-test-${Date.now()}`
  });

  return {
    apiClient,
    metricsCollector,
    testData: generateTestData()
  };
}

/**
 * Project creation scenario with varied complexity
 */
export async function projectCreationScenario(testContext) {
  const { apiClient, metricsCollector, testData } = testContext;
  const project = testData.projects[Math.floor(Math.random() * testData.projects.length)];

  const startTime = Date.now();
  
  try {
    const response = await apiClient.post('/projects', project);
    
    const duration = Date.now() - startTime;
    
    await metricsCollector.addMetric({
      timestamp: Date.now(),
      duration,
      type: 'project_creation',
      context: { projectId: response.data.id },
      metadata: {
        resourceUsage: process.resourceUsage(),
        memoryUsage: process.memoryUsage()
      }
    });

    check(response, {
      'project creation successful': (r) => r.status === 201,
      'response time within threshold': (r) => duration <= THRESHOLDS.project_creation,
      'valid project data returned': (r) => r.data.id && r.data.name === project.name
    });

  } catch (error) {
    console.error('Project creation failed:', error);
    throw error;
  }
}

/**
 * Concurrent operations scenario with rate limit compliance
 */
export async function concurrentOperationsScenario(testContext) {
  const { apiClient, metricsCollector, testData } = testContext;
  const operations = [];
  const startTime = Date.now();
  const requestCount = Math.min(
    10,
    Math.floor(RATE_LIMITS.org_requests_per_hour / 360) // Ensure rate limit compliance
  );

  // Execute mixed operations concurrently
  for (let i = 0; i < requestCount; i++) {
    const operation = Math.random() > 0.5 ? 
      projectReadOperation(apiClient, testData.projectIds[i % testData.projectIds.length]) :
      projectUpdateOperation(apiClient, testData.projects[i % testData.projects.length]);
    
    operations.push(operation);
  }

  try {
    const results = await Promise.all(operations);
    const duration = Date.now() - startTime;

    await metricsCollector.addMetric({
      timestamp: Date.now(),
      duration,
      type: 'concurrent_operations',
      context: { operationCount: requestCount },
      metadata: {
        successRate: results.filter(r => r.success).length / results.length
      }
    });

    const analysis = await metricsCollector.generateReport({
      timeRange: [new Date(startTime), new Date()],
      percentiles: [95, 99],
      detectAnomalies: true,
      trendAnalysis: true
    });

    check(analysis, {
      'p95 response time within threshold': (a) => a.percentiles.p95 <= THRESHOLDS.concurrent_operations,
      'error rate within threshold': (a) => (1 - analysis.metrics.successRate) <= THRESHOLDS.error_rate
    });

  } catch (error) {
    console.error('Concurrent operations failed:', error);
    throw error;
  }
}

/**
 * Helper function to generate varied test data
 */
function generateTestData() {
  const projects = Array(20).fill(null).map(() => ({
    name: faker.company.name(),
    description: faker.lorem.paragraph(),
    status: faker.helpers.arrayElement(['ACTIVE', 'PENDING', 'COMPLETED']),
    startDate: faker.date.future(),
    endDate: faker.date.future(),
    metadata: {
      complexity: faker.number.int({ min: 1, max: 5 }),
      priority: faker.helpers.arrayElement(['HIGH', 'MEDIUM', 'LOW']),
      tags: Array(3).fill(null).map(() => faker.word.sample())
    }
  }));

  return {
    projects,
    projectIds: Array(20).fill(null).map(() => faker.string.uuid())
  };
}

/**
 * Helper function for project read operations
 */
async function projectReadOperation(apiClient, projectId) {
  const startTime = Date.now();
  try {
    const response = await apiClient.get(`/projects/${projectId}`);
    return {
      success: true,
      duration: Date.now() - startTime,
      status: response.status
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Helper function for project update operations
 */
async function projectUpdateOperation(apiClient, project) {
  const startTime = Date.now();
  try {
    const response = await apiClient.put(`/projects/${project.id}`, {
      ...project,
      status: faker.helpers.arrayElement(['ACTIVE', 'PENDING', 'COMPLETED'])
    });
    return {
      success: true,
      duration: Date.now() - startTime,
      status: response.status
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: error.message
    };
  }
}

export default {
  setup,
  projectCreationScenario,
  concurrentOperationsScenario
};