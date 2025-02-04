/**
 * @fileoverview Integration tests for WebSocket functionality in the Task Management System
 * Validates real-time notifications, room management, connection handling, and performance metrics
 * @version 1.0.0
 */

import { WebSocketTestClient } from '../utils/websocket-client';
import { setupTestEnvironment, teardownTestEnvironment, waitForAsyncOperation } from '../utils/test-helpers';
import { NotificationType } from '../../backend/notification-service/src/interfaces/notification.interface';

// Test configuration constants
const TEST_TIMEOUT = 10000;
const PERFORMANCE_THRESHOLD = 500;
const MAX_RECONNECTION_ATTEMPTS = 3;

let wsClient: WebSocketTestClient;
let testUser: { id: string; token: string };

beforeAll(async () => {
  // Initialize test environment with performance monitoring
  const env = await setupTestEnvironment({
    performanceMonitoring: true,
    securityValidation: true
  });

  // Create authenticated test user
  testUser = await env.api?.createAuthenticatedUser({
    email: 'test@example.com',
    password: 'Test123!@#',
    role: 'USER'
  });

  wsClient = new WebSocketTestClient(undefined, {
    validateTokens: true,
    validateHeaders: true,
    encryptPayload: true
  });
});

afterAll(async () => {
  // Cleanup and disconnect
  await wsClient.disconnect();
  await teardownTestEnvironment({});
});

describe('WebSocket Connection Tests', () => {
  test('should connect successfully with valid auth token', async () => {
    await expect(wsClient.connect(testUser.token)).resolves.not.toThrow();
  });

  test('should reject connection with invalid auth token', async () => {
    await expect(wsClient.connect('invalid-token')).rejects.toThrow('Invalid authentication token');
  });

  test('should handle reconnection attempts with exponential backoff', async () => {
    const startTime = Date.now();
    await wsClient.connect(testUser.token, {
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECTION_ATTEMPTS,
      reconnectionDelay: 1000
    });
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(TEST_TIMEOUT);
  });

  test('should maintain connection with heartbeat', async () => {
    await wsClient.connect(testUser.token);
    await new Promise(resolve => setTimeout(resolve, 5000));
    expect(wsClient['isConnected']).toBe(true);
  });

  test('should validate connection security parameters', async () => {
    const securityOptions = {
      validateTokens: true,
      validateHeaders: true,
      encryptPayload: true
    };
    const client = new WebSocketTestClient(undefined, securityOptions);
    await expect(client.connect(testUser.token)).resolves.not.toThrow();
    await client.disconnect();
  });
});

describe('Room Management Tests', () => {
  beforeEach(async () => {
    await wsClient.connect(testUser.token);
  });

  afterEach(async () => {
    await wsClient.disconnect();
  });

  test('should join project room with access validation', async () => {
    const projectId = 'test-project-1';
    await expect(wsClient.joinRoom(`project:${projectId}`)).resolves.not.toThrow();
  });

  test('should join task room with permission check', async () => {
    const taskId = 'test-task-1';
    await expect(wsClient.joinRoom(`task:${taskId}`)).resolves.not.toThrow();
  });

  test('should handle concurrent room subscriptions', async () => {
    const rooms = ['project:1', 'task:1', 'task:2'];
    await Promise.all(rooms.map(room => wsClient.joinRoom(room)));
    expect(wsClient['activeRooms'].size).toBe(rooms.length);
  });

  test('should validate room access permissions', async () => {
    const restrictedProjectId = 'restricted-project';
    await expect(wsClient.joinRoom(`project:${restrictedProjectId}`))
      .rejects.toThrow('Access denied');
  });

  test('should handle room cleanup on disconnect', async () => {
    await wsClient.joinRoom('project:1');
    await wsClient.disconnect();
    expect(wsClient['activeRooms'].size).toBe(0);
  });
});

describe('Notification Tests', () => {
  beforeEach(async () => {
    await wsClient.connect(testUser.token);
  });

  afterEach(async () => {
    await wsClient.disconnect();
  });

  test('should receive and acknowledge task notifications', async () => {
    await wsClient.joinRoom('task:1');
    const notification = await wsClient.waitForNotification(
      NotificationType.TASK_UPDATED,
      5000,
      { validateSchema: true }
    );
    expect(notification).toHaveProperty('event', NotificationType.TASK_UPDATED);
  });

  test('should validate notification delivery order', async () => {
    const notifications = await Promise.all([
      wsClient.waitForNotification(NotificationType.TASK_ASSIGNED),
      wsClient.waitForNotification(NotificationType.TASK_UPDATED)
    ]);
    expect(notifications[0].timestamp).toBeLessThan(notifications[1].timestamp);
  });

  test('should handle notification persistence', async () => {
    await wsClient.disconnect();
    await wsClient.connect(testUser.token);
    const notification = await wsClient.waitForNotification(NotificationType.TASK_UPDATED);
    expect(notification).toBeDefined();
  });

  test('should track notification delivery metrics', async () => {
    const { result: notification, metrics } = await waitForAsyncOperation(
      () => wsClient.waitForNotification(NotificationType.PROJECT_UPDATED),
      5000,
      { performanceThreshold: PERFORMANCE_THRESHOLD }
    );
    expect(metrics.duration).toBeLessThan(PERFORMANCE_THRESHOLD);
    expect(notification).toBeDefined();
  });

  test('should validate notification security context', async () => {
    await wsClient.joinRoom('project:1');
    const notification = await wsClient.waitForNotification(
      NotificationType.PROJECT_UPDATED,
      5000,
      { validateSchema: true, validatePayload: true }
    );
    expect(notification).toHaveProperty('room');
    expect(notification).toHaveProperty('userId', testUser.id);
  });
});

describe('Performance Tests', () => {
  beforeEach(async () => {
    await wsClient.connect(testUser.token);
  });

  afterEach(async () => {
    await wsClient.disconnect();
  });

  test('should maintain connection latency under 500ms', async () => {
    const metrics = await wsClient.measureLatency(NotificationType.TASK_UPDATED, {
      sampleSize: 10,
      includeJitter: true
    });
    expect(metrics.averageLatency).toBeLessThan(PERFORMANCE_THRESHOLD);
    expect(metrics.jitter).toBeLessThan(100);
  });

  test('should handle 1000 messages per second throughput', async () => {
    const messageCount = 1000;
    const duration = 1000; // 1 second
    const metrics = await wsClient.measureThroughput(messageCount, duration);
    expect(metrics.messagesPerSecond).toBeGreaterThanOrEqual(messageCount);
    expect(metrics.errors).toBe(0);
  });

  test('should scale with multiple concurrent subscribers', async () => {
    const concurrentClients = 10;
    const clients = await Promise.all(
      Array(concurrentClients).fill(0).map(async () => {
        const client = new WebSocketTestClient();
        await client.connect(testUser.token);
        return client;
      })
    );

    const metrics = await Promise.all(
      clients.map(client => client.measureLatency(NotificationType.TASK_UPDATED))
    );

    const averageLatency = metrics.reduce((sum, m) => sum + m.averageLatency, 0) / metrics.length;
    expect(averageLatency).toBeLessThan(PERFORMANCE_THRESHOLD);

    await Promise.all(clients.map(client => client.disconnect()));
  });

  test('should maintain performance under network degradation', async () => {
    const metrics = await wsClient.measureLatency(NotificationType.TASK_UPDATED, {
      sampleSize: 5,
      includeJitter: true,
      timeout: 1000
    });
    expect(metrics.packetLoss).toBeLessThan(0.1); // Less than 10% packet loss
    expect(metrics.maxLatency).toBeLessThan(PERFORMANCE_THRESHOLD * 2);
  });

  test('should track and report performance metrics', async () => {
    const { metrics } = await waitForAsyncOperation(
      () => wsClient.measureLatency(NotificationType.TASK_UPDATED),
      5000,
      { performanceThreshold: PERFORMANCE_THRESHOLD }
    );
    expect(metrics.operationBreakdown).toHaveProperty('attempt_0');
    expect(metrics.duration).toBeLessThan(PERFORMANCE_THRESHOLD);
  });
});