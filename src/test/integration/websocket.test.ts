/**
 * @fileoverview Integration tests for WebSocket functionality with comprehensive security
 * validation and performance monitoring for real-time communication features.
 * @version 1.0.0
 */

import { WebSocketTestClient } from '../utils/websocket-client';
import { NotificationType } from '../../backend/notification-service/src/interfaces/notification.interface';
import { jest } from '@types/jest';

// Global test configuration
const TEST_TIMEOUT = 10000;
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'ws://localhost:3002';
const SECURITY_VALIDATION_ENABLED = process.env.SECURITY_VALIDATION_ENABLED || true;
const PERFORMANCE_METRICS_ENABLED = process.env.PERFORMANCE_METRICS_ENABLED || true;

// Performance thresholds (milliseconds)
const PERFORMANCE_THRESHOLDS = {
  CONNECTION: 1000,
  MESSAGE_DELIVERY: 500,
  ROOM_JOIN: 500
};

// Test data
const TEST_AUTH_TOKEN = 'test-auth-token-' + Date.now();
const TEST_ROOM_ID = 'test-room-' + Date.now();

describe('WebSocket Integration Tests', () => {
  let wsClient: WebSocketTestClient;
  let performanceMetrics: Map<string, number>;

  beforeAll(async () => {
    // Initialize WebSocket test client with enhanced security options
    wsClient = new WebSocketTestClient(WEBSOCKET_URL, {
      validateTokens: SECURITY_VALIDATION_ENABLED,
      validateHeaders: SECURITY_VALIDATION_ENABLED,
      encryptPayload: SECURITY_VALIDATION_ENABLED
    });

    // Initialize performance metrics collection
    performanceMetrics = new Map();

    // Set global test timeout
    jest.setTimeout(TEST_TIMEOUT);
  });

  afterAll(async () => {
    // Export collected performance metrics
    if (PERFORMANCE_METRICS_ENABLED) {
      console.log('Performance Metrics:', Object.fromEntries(performanceMetrics));
    }

    // Clean up WebSocket connection
    await wsClient.disconnect();
  });

  describe('Connection Management', () => {
    test('should establish secure WebSocket connection', async () => {
      const startTime = Date.now();

      await wsClient.connect(TEST_AUTH_TOKEN, {
        timeout: PERFORMANCE_THRESHOLDS.CONNECTION,
        reconnection: true,
        reconnectionAttempts: 3
      });

      const connectionTime = Date.now() - startTime;
      performanceMetrics.set('connection_time', connectionTime);

      expect(connectionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CONNECTION);
    });

    test('should handle connection errors securely', async () => {
      const invalidToken = 'invalid-token';
      
      await expect(wsClient.connect(invalidToken)).rejects.toThrow('Invalid authentication token');
    });
  });

  describe('Room Management', () => {
    test('should join room with security validation', async () => {
      const startTime = Date.now();

      await wsClient.joinRoom(TEST_ROOM_ID, {
        validateAccess: true,
        timeout: PERFORMANCE_THRESHOLDS.ROOM_JOIN
      });

      const joinTime = Date.now() - startTime;
      performanceMetrics.set('room_join_time', joinTime);

      expect(joinTime).toBeLessThan(PERFORMANCE_THRESHOLDS.ROOM_JOIN);
    });
  });

  describe('Task Notifications', () => {
    test('should receive task assigned notification with performance monitoring', async () => {
      const startTime = Date.now();

      const notification = await wsClient.waitForNotification(
        NotificationType.TASK_ASSIGNED,
        PERFORMANCE_THRESHOLDS.MESSAGE_DELIVERY,
        {
          validateSchema: true,
          validatePayload: true,
          validateTiming: true
        }
      );

      const deliveryTime = Date.now() - startTime;
      performanceMetrics.set('task_notification_time', deliveryTime);

      expect(notification).toBeDefined();
      expect(notification.event).toBe(NotificationType.TASK_ASSIGNED);
      expect(deliveryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MESSAGE_DELIVERY);
    });

    test('should receive task updated notification with security validation', async () => {
      const notification = await wsClient.waitForNotification(
        NotificationType.TASK_UPDATED,
        PERFORMANCE_THRESHOLDS.MESSAGE_DELIVERY,
        {
          validateSchema: true,
          validatePayload: true
        }
      );

      expect(notification).toBeDefined();
      expect(notification.event).toBe(NotificationType.TASK_UPDATED);
    });
  });

  describe('Project Notifications', () => {
    test('should receive project updated notification with metrics', async () => {
      const notification = await wsClient.waitForNotification(
        NotificationType.PROJECT_UPDATED,
        PERFORMANCE_THRESHOLDS.MESSAGE_DELIVERY,
        {
          validateSchema: true,
          validatePayload: true
        }
      );

      expect(notification).toBeDefined();
      expect(notification.event).toBe(NotificationType.PROJECT_UPDATED);
    });
  });

  describe('Performance Monitoring', () => {
    test('should measure WebSocket latency metrics', async () => {
      const latencyMetrics = await wsClient.measureLatency(
        NotificationType.TASK_UPDATED,
        {
          sampleSize: 10,
          includeJitter: true,
          timeout: PERFORMANCE_THRESHOLDS.MESSAGE_DELIVERY
        }
      );

      expect(latencyMetrics.averageLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.MESSAGE_DELIVERY);
      expect(latencyMetrics.maxLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.MESSAGE_DELIVERY * 1.5);
      
      performanceMetrics.set('average_latency', latencyMetrics.averageLatency);
      performanceMetrics.set('max_latency', latencyMetrics.maxLatency);
      if (latencyMetrics.jitter) {
        performanceMetrics.set('jitter', latencyMetrics.jitter);
      }
    });
  });

  describe('Security Validation', () => {
    test('should validate security headers in WebSocket connection', async () => {
      const headers = {
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        'X-Request-ID': `test-${Date.now()}`,
        'X-API-Version': 'v1',
        'Content-Security-Policy': "default-src 'self'"
      };

      const validationResult = await wsClient.validateSecurityHeaders(headers);
      expect(validationResult).toBe(true);
    });

    test('should handle security validation failures', async () => {
      const invalidHeaders = {
        'X-Request-ID': `test-${Date.now()}`
      };

      await expect(wsClient.validateSecurityHeaders(invalidHeaders))
        .rejects.toThrow('Missing required headers');
    });
  });
});