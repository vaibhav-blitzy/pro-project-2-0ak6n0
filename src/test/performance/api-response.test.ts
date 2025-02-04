/**
 * @fileoverview Advanced API Performance Test Suite
 * Comprehensive test suite for measuring, analyzing, and validating API response times
 * across different endpoints and operations with statistical analysis and monitoring.
 * @version 1.0.0
 */

import { measureApiResponse, PerformanceMetricsCollector } from '../utils/performance-metrics';
import { testApiClient } from '../utils/api-client';
import { API_ENDPOINTS } from '../../web/src/constants/api.constants';
import { ApiResponse, ApiMethod } from '../../web/src/types/api.types';

// Performance thresholds from technical specifications
const API_PERFORMANCE_THRESHOLDS = {
  READ_OPERATIONS: 100,   // ms
  WRITE_OPERATIONS: 200,  // ms
  BATCH_OPERATIONS: 500,  // ms
  SAMPLE_SIZE: 100,
  ACCEPTABLE_ERROR_RATE: 0.001,
  ANOMALY_THRESHOLD: 2.5,
  DEGRADATION_THRESHOLD: 1.5
};

interface PerformanceOptions {
  sampleSize?: number;
  concurrentRequests?: number;
  warmupRequests?: number;
  cooldownPeriod?: number;
  collectResourceMetrics?: boolean;
}

interface PerformanceAnalysis {
  mean: number;
  median: number;
  p95: number;
  p99: number;
  anomalies: any[];
  trends: any;
  recommendations: string[];
}

/**
 * Enhanced API Performance Test Suite
 * Implements comprehensive performance testing with advanced analytics
 */
export class ApiPerformanceTest {
  private metricsCollector: PerformanceMetricsCollector;
  private apiClient: any;
  private options: PerformanceOptions;

  constructor(options: PerformanceOptions = {}) {
    this.options = {
      sampleSize: API_PERFORMANCE_THRESHOLDS.SAMPLE_SIZE,
      concurrentRequests: 10,
      warmupRequests: 5,
      cooldownPeriod: 1000,
      collectResourceMetrics: true,
      ...options
    };

    const { apiClient } = testApiClient.createTestApiClient({
      validateSecurity: true,
      timeout: 10000
    });

    this.apiClient = apiClient;
    this.metricsCollector = new PerformanceMetricsCollector(
      API_PERFORMANCE_THRESHOLDS,
      {
        retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
        rotationSize: 10000,
        storageType: 'persistent'
      }
    );
  }

  /**
   * Tests read operations performance with comprehensive analysis
   */
  async testReadOperations(): Promise<void> {
    const endpoints = [
      API_ENDPOINTS.TASKS.BASE,
      API_ENDPOINTS.PROJECTS.BASE,
      API_ENDPOINTS.SEARCH.GLOBAL
    ];

    await this.performWarmup('GET', endpoints[0]);

    for (const endpoint of endpoints) {
      const metrics = await this.measureEndpointPerformance(
        endpoint,
        'GET',
        undefined,
        {
          validateThreshold: API_PERFORMANCE_THRESHOLDS.READ_OPERATIONS
        }
      );

      await this.metricsCollector.addMetric(metrics);
      await this.validatePerformanceThresholds(metrics, 'READ');
    }

    const analysis = await this.metricsCollector.generateReport();
    this.logPerformanceResults('Read Operations', analysis);
  }

  /**
   * Tests write operations performance with comprehensive analysis
   */
  async testWriteOperations(): Promise<void> {
    const testCases = [
      { endpoint: API_ENDPOINTS.TASKS.BASE, method: 'POST', payload: { title: 'Test Task' } },
      { endpoint: API_ENDPOINTS.PROJECTS.BASE, method: 'PUT', payload: { name: 'Updated Project' } },
      { endpoint: API_ENDPOINTS.TASKS.STATUS, method: 'PATCH', payload: { status: 'IN_PROGRESS' } }
    ];

    for (const testCase of testCases) {
      const metrics = await this.measureEndpointPerformance(
        testCase.endpoint,
        testCase.method as ApiMethod,
        testCase.payload,
        {
          validateThreshold: API_PERFORMANCE_THRESHOLDS.WRITE_OPERATIONS
        }
      );

      await this.metricsCollector.addMetric(metrics);
      await this.validatePerformanceThresholds(metrics, 'WRITE');
    }

    const analysis = await this.metricsCollector.generateReport();
    this.logPerformanceResults('Write Operations', analysis);
  }

  /**
   * Tests batch operations performance with load analysis
   */
  async testBatchOperations(): Promise<void> {
    const batchOperations = [
      {
        endpoint: API_ENDPOINTS.TASKS.BULK_UPDATE,
        method: 'POST',
        payload: { tasks: Array(50).fill({ status: 'COMPLETED' }) }
      },
      {
        endpoint: API_ENDPOINTS.PROJECTS.MEMBERS,
        method: 'POST',
        payload: { members: Array(20).fill({ role: 'VIEWER' }) }
      }
    ];

    for (const operation of batchOperations) {
      const metrics = await this.measureEndpointPerformance(
        operation.endpoint,
        operation.method as ApiMethod,
        operation.payload,
        {
          validateThreshold: API_PERFORMANCE_THRESHOLDS.BATCH_OPERATIONS,
          concurrentRequests: this.options.concurrentRequests
        }
      );

      await this.metricsCollector.addMetric(metrics);
      await this.validatePerformanceThresholds(metrics, 'BATCH');
    }

    const analysis = await this.metricsCollector.generateReport();
    this.logPerformanceResults('Batch Operations', analysis);
  }

  /**
   * Measures endpoint performance with comprehensive analysis
   */
  private async measureEndpointPerformance(
    endpoint: string,
    method: ApiMethod,
    payload?: any,
    options: {
      validateThreshold?: number;
      concurrentRequests?: number;
    } = {}
  ): Promise<any> {
    const startTime = Date.now();
    const responses: Array<Promise<ApiResponse<any>>> = [];

    const requestCount = options.concurrentRequests || 1;
    for (let i = 0; i < requestCount; i++) {
      responses.push(
        measureApiResponse(
          this.apiClient[method.toLowerCase()](endpoint, payload),
          {
            endpoint,
            method,
            timestamp: startTime,
            requestIndex: i
          }
        )
      );
    }

    const results = await Promise.all(responses);
    return this.analyzeResults(results, startTime, options.validateThreshold);
  }

  /**
   * Validates performance against defined thresholds
   */
  private async validatePerformanceThresholds(
    metrics: any,
    operationType: 'READ' | 'WRITE' | 'BATCH'
  ): Promise<void> {
    const threshold = API_PERFORMANCE_THRESHOLDS[`${operationType}_OPERATIONS`];
    if (metrics.p95 > threshold) {
      throw new Error(
        `Performance threshold exceeded for ${operationType} operation. ` +
        `P95: ${metrics.p95}ms > Threshold: ${threshold}ms`
      );
    }
  }

  /**
   * Performs warmup requests before actual testing
   */
  private async performWarmup(method: ApiMethod, endpoint: string): Promise<void> {
    for (let i = 0; i < this.options.warmupRequests!; i++) {
      await this.apiClient[method.toLowerCase()](endpoint);
    }
    await new Promise(resolve => setTimeout(resolve, this.options.cooldownPeriod));
  }

  /**
   * Analyzes test results with statistical analysis
   */
  private analyzeResults(
    results: any[],
    startTime: number,
    threshold?: number
  ): any {
    const responseTimes = results.map(r => r.duration);
    const analysis = {
      mean: this.calculateMean(responseTimes),
      median: this.calculateMedian(responseTimes),
      p95: this.calculatePercentile(responseTimes, 95),
      p99: this.calculatePercentile(responseTimes, 99),
      totalDuration: Date.now() - startTime,
      sampleSize: results.length,
      threshold
    };

    return analysis;
  }

  /**
   * Logs performance test results with detailed analysis
   */
  private logPerformanceResults(
    operationType: string,
    analysis: PerformanceAnalysis
  ): void {
    console.log(`
Performance Test Results - ${operationType}
----------------------------------------
Mean Response Time: ${analysis.mean.toFixed(2)}ms
Median Response Time: ${analysis.median.toFixed(2)}ms
P95 Response Time: ${analysis.p95.toFixed(2)}ms
P99 Response Time: ${analysis.p99.toFixed(2)}ms
Anomalies Detected: ${analysis.anomalies.length}
Performance Trend: ${analysis.trends.degradation > 1 ? 'Degrading' : 'Stable'}
Recommendations: ${analysis.recommendations.join('\n')}
    `);
  }

  // Statistical utility methods
  private calculateMean(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }
}

// Export performance test utilities
export const measureEndpointPerformance = async (
  endpoint: string,
  method: ApiMethod,
  payload?: any,
  options: PerformanceOptions = {}
): Promise<PerformanceAnalysis> => {
  const test = new ApiPerformanceTest(options);
  const metrics = await test['measureEndpointPerformance'](endpoint, method, payload);
  return metrics;
};