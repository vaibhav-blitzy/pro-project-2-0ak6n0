import http from 'k6/http'; // v0.45.0
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { faker } from '@faker-js/faker'; // v8.0.0

import { ApiClient } from '../../utils/api-client';
import { taskTemplates } from '../data/tasks.json';
import { PerformanceMetricsCollector } from '../../utils/performance-metrics';

// Initialize performance metrics collector
const metricsCollector = new PerformanceMetricsCollector(
  {}, // Use default thresholds
  {
    retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
    rotationSize: 10000,
    storageType: 'memory'
  }
);

// Custom metrics
const taskCreationTrend = new Trend('task_creation_duration');
const taskValidationErrors = new Counter('task_validation_errors');
const successRate = new Rate('task_creation_success');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 50 }, // Ramp-up
    { duration: '3m', target: 50 }, // Steady state
    { duration: '1m', target: 0 }   // Ramp-down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.01'],
    'task_creation_duration': ['p(95)<450', 'p(99)<490'],
    'task_creation_success': ['rate>0.95'],
    'iteration_duration': ['p(95)<1000'],
    'cpu_usage': ['max<80'],
    'memory_usage': ['max<85']
  },
  scenarios: {
    task_creation: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '3m', target: 50 },
        { duration: '1m', target: 0 }
      ],
      gracefulRampDown: '30s',
      gracefulStop: '30s'
    }
  }
};

// Test setup
export function setup() {
  const apiClient = new ApiClient();
  return {
    apiClient,
    templates: taskTemplates
  };
}

// Generate random task data
function generateTaskData(templateType = 'high_priority_task', customFields = {}) {
  const template = taskTemplates.find(t => t.template_name === templateType)?.data;
  if (!template) {
    throw new Error(`Template not found: ${templateType}`);
  }

  return {
    title: faker.company.catchPhrase(),
    description: faker.lorem.paragraph(),
    projectId: template.projectId,
    priority: template.priority,
    status: 'TODO',
    dueDate: faker.date.future().toISOString(),
    customFields: {
      ...template.customFields,
      ...customFields,
      complexity: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
      estimatedHours: faker.number.int({ min: 1, max: 40 }),
      department: template.customFields.department
    }
  };
}

// Create task with performance monitoring
async function createTask(taskData, performanceOptions = {}) {
  const startTime = Date.now();
  
  try {
    const response = await http.post('/api/v1/tasks', JSON.stringify(taskData), {
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': `load-test-${Date.now()}`,
        'Authorization': `Bearer ${__ENV.API_TOKEN}`
      },
      tags: { name: 'create_task' }
    });

    // Record metrics
    const duration = Date.now() - startTime;
    taskCreationTrend.add(duration);
    successRate.add(response.status === 201);

    // Validate response
    check(response, {
      'status is 201': (r) => r.status === 201,
      'has task id': (r) => r.json('id') !== undefined,
      'correct project id': (r) => r.json('projectId') === taskData.projectId,
      'correct priority': (r) => r.json('priority') === taskData.priority
    });

    // Collect performance metrics
    await metricsCollector.addMetric({
      timestamp: Date.now(),
      duration,
      type: 'task_creation',
      context: {
        taskId: response.json('id'),
        status: response.status
      },
      metadata: {
        resourceUsage: response.timings,
        memoryUsage: performanceOptions.trackMemory ? process.memoryUsage() : undefined
      }
    });

    return response;
  } catch (error) {
    taskValidationErrors.add(1);
    throw error;
  }
}

// Default test scenario
export default function() {
  const templateTypes = ['high_priority_task', 'deadline_driven_task', 'multi_assignee_task'];
  const templateType = templateTypes[Math.floor(Math.random() * templateTypes.length)];
  
  const taskData = generateTaskData(templateType);
  createTask(taskData, { trackMemory: true });
  
  // Random sleep between 1-5 seconds to simulate real user behavior
  sleep(Math.random() * 4 + 1);
}

// Test teardown
export function teardown() {
  // Generate final performance report
  const report = metricsCollector.generateReport({
    timeRange: [new Date(Date.now() - 3600000), new Date()], // Last hour
    percentiles: [50, 75, 90, 95, 99],
    detectAnomalies: true,
    trendAnalysis: true
  });

  console.log('Performance Test Report:', JSON.stringify(report, null, 2));
}