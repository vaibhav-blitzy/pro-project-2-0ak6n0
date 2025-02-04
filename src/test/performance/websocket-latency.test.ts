/**
 * @fileoverview Advanced WebSocket latency test suite for measuring real-time notification
 * performance in the Task Management System. Implements comprehensive testing of WebSocket
 * communication with statistical analysis and performance validation.
 * @version 1.0.0
 */

import { WebSocketTestClient } from '../utils/websocket-client';
import { PerformanceMetricsCollector } from '../utils/performance-metrics';
import { waitForAsyncOperation } from '../utils/test-helpers';
import { NotificationType } from '../../backend/notification-service/src/interfaces/notification.interface';

// Test iterations for statistical significance
const TEST_ITERATIONS = 100;

// Performance thresholds based on technical requirements
const LATENCY_THRESHOLDS = {
  SIMPLE_NOTIFICATION: 200,  // Simple notifications <200ms
  COMPLEX_NOTIFICATION: 500, // Complex notifications <500ms
  ROOM_SUBSCRIPTION: 300,    // Room subscriptions <300ms
  CONNECTION: 1000          // Connections <1000ms
};

// Network condition simulation configurations
const NETWORK_CONDITIONS = {
  GOOD: { latency: 50, jitter: 10 },
  POOR: { latency: 200, jitter: 50 },
  DEGRADED: { latency: 500, jitter: 100 }
};

/**
 * Interface for WebSocket test configuration
 */
interface WebSocketTestConfig {
  iterations?: number;
  networkCondition?: keyof typeof NETWORK_CONDITIONS;
  validateSecurity?: boolean;
  collectMetrics?: boolean;
}

/**
 * Interface for latency test results
 */
interface LatencyTestResult {
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  minLatency: number;
  maxLatency: number;
  jitter: number;
  failedTests: number;
  securityValidation: boolean;
}

describe('WebSocket Latency Tests', () => {
  let wsClient: WebSocketTestClient;
  let metricsCollector: PerformanceMetricsCollector;
  
  beforeAll(async () => {
    // Initialize metrics collector with custom thresholds
    metricsCollector = new PerformanceMetricsCollector(
      LATENCY_THRESHOLDS,
      {
        retentionPeriod: 24 * 60 * 60, // 24 hours
        rotationSize: 10000,
        storageType: 'persistent'
      }
    );
  });

  beforeEach(async () => {
    // Initialize WebSocket client with security validation
    wsClient = new WebSocketTestClient(undefined, {
      validateTokens: true,
      validateHeaders: true,
      encryptPayload: true
    });
  });

  afterEach(async () => {
    await wsClient.disconnect();
  });

  /**
   * Measures WebSocket connection latency with comprehensive validation
   */
  async function measureConnectionLatency(
    client: WebSocketTestClient,
    networkCondition: keyof typeof NETWORK_CONDITIONS
  ): Promise<LatencyTestResult> {
    const latencies: number[] = [];
    let failedTests = 0;

    // Apply network condition simulation
    client.simulateNetworkCondition(NETWORK_CONDITIONS[networkCondition]);

    for (let i = 0; i < TEST_ITERATIONS; i++) {
      try {
        const startTime = performance.now();
        await client.connect('test-auth-token', {
          timeout: LATENCY_THRESHOLDS.CONNECTION,
          reconnection: true
        });
        const endTime = performance.now();
        latencies.push(endTime - startTime);
        
        await client.disconnect();
      } catch (error) {
        failedTests++;
        console.error(`Connection test ${i + 1} failed:`, error);
      }
    }

    return analyzeLatencyResults(latencies, failedTests);
  }

  /**
   * Measures room subscription latency with validation
   */
  async function measureRoomSubscriptionLatency(
    client: WebSocketTestClient,
    roomId: string
  ): Promise<LatencyTestResult> {
    const latencies: number[] = [];
    let failedTests = 0;

    await client.connect('test-auth-token');

    for (let i = 0; i < TEST_ITERATIONS; i++) {
      try {
        const startTime = performance.now();
        await client.joinRoom(roomId, {
          validateAccess: true,
          timeout: LATENCY_THRESHOLDS.ROOM_SUBSCRIPTION
        });
        const endTime = performance.now();
        latencies.push(endTime - startTime);
      } catch (error) {
        failedTests++;
        console.error(`Room subscription test ${i + 1} failed:`, error);
      }
    }

    return analyzeLatencyResults(latencies, failedTests);
  }

  /**
   * Analyzes latency test results with statistical calculations
   */
  function analyzeLatencyResults(
    latencies: number[],
    failedTests: number
  ): LatencyTestResult {
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);

    return {
      averageLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p95Latency: sortedLatencies[p95Index],
      p99Latency: sortedLatencies[p99Index],
      minLatency: Math.min(...latencies),
      maxLatency: Math.max(...latencies),
      jitter: calculateJitter(latencies),
      failedTests,
      securityValidation: true
    };
  }

  /**
   * Calculates network jitter from latency measurements
   */
  function calculateJitter(latencies: number[]): number {
    let totalJitter = 0;
    for (let i = 1; i < latencies.length; i++) {
      totalJitter += Math.abs(latencies[i] - latencies[i - 1]);
    }
    return totalJitter / (latencies.length - 1);
  }

  test('Connection latency under good network conditions', async () => {
    const results = await measureConnectionLatency(wsClient, 'GOOD');
    
    expect(results.averageLatency).toBeLessThan(LATENCY_THRESHOLDS.CONNECTION);
    expect(results.p95Latency).toBeLessThan(LATENCY_THRESHOLDS.CONNECTION * 0.95);
    expect(results.failedTests).toBe(0);
    
    await metricsCollector.addMetric({
      timestamp: Date.now(),
      duration: results.averageLatency,
      type: 'connection_latency',
      context: { networkCondition: 'GOOD' },
      metadata: {}
    });
  });

  test('Room subscription latency meets performance requirements', async () => {
    const results = await measureRoomSubscriptionLatency(wsClient, 'test-room-1');
    
    expect(results.averageLatency).toBeLessThan(LATENCY_THRESHOLDS.ROOM_SUBSCRIPTION);
    expect(results.p95Latency).toBeLessThan(LATENCY_THRESHOLDS.ROOM_SUBSCRIPTION * 0.95);
    expect(results.failedTests).toBe(0);
    
    await metricsCollector.addMetric({
      timestamp: Date.now(),
      duration: results.averageLatency,
      type: 'room_subscription_latency',
      context: { roomId: 'test-room-1' },
      metadata: {}
    });
  });

  test('Simple notification delivery meets latency requirements', async () => {
    await wsClient.connect('test-auth-token');
    const results = await wsClient.measureLatency(NotificationType.TASK_UPDATED, {
      sampleSize: TEST_ITERATIONS,
      includeJitter: true,
      timeout: LATENCY_THRESHOLDS.SIMPLE_NOTIFICATION
    });

    expect(results.averageLatency).toBeLessThan(LATENCY_THRESHOLDS.SIMPLE_NOTIFICATION);
    expect(results.maxLatency).toBeLessThan(LATENCY_THRESHOLDS.SIMPLE_NOTIFICATION * 1.5);
  });

  test('Complex notification delivery under degraded network conditions', async () => {
    wsClient.simulateNetworkCondition(NETWORK_CONDITIONS.DEGRADED);
    await wsClient.connect('test-auth-token');
    
    const results = await wsClient.measureLatency(NotificationType.PROJECT_UPDATED, {
      sampleSize: TEST_ITERATIONS,
      includeJitter: true,
      timeout: LATENCY_THRESHOLDS.COMPLEX_NOTIFICATION
    });

    expect(results.averageLatency).toBeLessThan(LATENCY_THRESHOLDS.COMPLEX_NOTIFICATION);
    expect(results.jitter).toBeDefined();
  });
});