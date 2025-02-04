/**
 * @fileoverview API integration tests for notification service endpoints
 * Validates notification creation, delivery, and real-time updates with
 * comprehensive performance monitoring and security validation.
 * @version 1.0.0
 */

import { 
  setupTestEnvironment, 
  teardownTestEnvironment, 
  createAuthenticatedUser,
  waitForAsyncOperation 
} from '../utils/test-helpers';
import { describe, it, expect } from '@types/jest';
import { 
  NotificationType, 
  NotificationPriority, 
  DeliveryMethod, 
  INotification 
} from '../../backend/notification-service/src/interfaces/notification.interface';

// Test environment configuration
const TEST_TIMEOUT = 10000;
const PERFORMANCE_THRESHOLD = 500; // milliseconds

describe('Notification API Integration Tests', () => {
  let testEnv: any;
  let testUser: any;

  beforeAll(async () => {
    // Initialize test environment with all required services
    testEnv = await setupTestEnvironment({
      performanceMonitoring: true,
      securityValidation: true
    });

    // Create test user with notification preferences
    testUser = await createAuthenticatedUser({
      notificationPreferences: {
        emailEnabled: true,
        webSocketEnabled: true,
        webhookUrl: 'https://test-webhook.example.com',
        notificationTypes: [NotificationType.TASK_ASSIGNED, NotificationType.MENTION],
        webhookSecret: 'test-webhook-secret',
        retentionDays: 30
      }
    });
  });

  afterAll(async () => {
    await teardownTestEnvironment(testEnv);
  });

  describe('Notification Creation and Delivery', () => {
    it('should create and deliver a notification across multiple channels', async () => {
      const notificationData = {
        type: NotificationType.TASK_ASSIGNED,
        userId: testUser.id,
        title: 'New Task Assignment',
        message: 'You have been assigned to Task #123',
        priority: NotificationPriority.HIGH,
        metadata: {
          taskId: '123',
          projectId: '456'
        },
        template: 'task-assignment'
      };

      const { result: notification, metrics } = await waitForAsyncOperation(
        async () => {
          const response = await testEnv.api.post('/api/v1/notifications', notificationData);
          expect(response.status).toBe(201);
          return response.data;
        },
        TEST_TIMEOUT,
        { performanceThreshold: PERFORMANCE_THRESHOLD }
      );

      // Validate notification structure
      expect(notification).toMatchObject({
        id: expect.any(String),
        type: notificationData.type,
        userId: testUser.id,
        title: notificationData.title,
        read: false,
        deliveryStatus: expect.any(Object)
      });

      // Validate performance metrics
      expect(metrics.duration).toBeLessThan(PERFORMANCE_THRESHOLD);
    });

    it('should handle webhook delivery with retries and tracking', async () => {
      const webhookNotification = {
        type: NotificationType.PROJECT_UPDATED,
        userId: testUser.id,
        title: 'Project Update',
        message: 'Project status has changed',
        priority: NotificationPriority.MEDIUM,
        metadata: {
          projectId: '789',
          changes: ['status', 'dueDate']
        }
      };

      const { result: deliveryStatus } = await waitForAsyncOperation(
        async () => {
          const response = await testEnv.api.post(
            '/api/v1/notifications/webhook',
            webhookNotification
          );
          expect(response.status).toBe(200);
          return response.data;
        },
        TEST_TIMEOUT,
        { retries: 3, interval: 1000 }
      );

      // Validate webhook delivery
      expect(deliveryStatus).toMatchObject({
        method: DeliveryMethod.WEBHOOK,
        status: expect.any(String),
        attempts: expect.any(Number),
        deliveryMetadata: expect.any(Object)
      });
    });
  });

  describe('Real-time Notification Updates', () => {
    it('should receive real-time updates via WebSocket', async () => {
      const wsClient = testEnv.api.createWebSocketClient();
      
      // Connect to WebSocket
      await wsClient.connect('/api/v1/notifications/ws');

      const notification = await waitForAsyncOperation(
        async () => {
          // Create a notification that should trigger WebSocket update
          const response = await testEnv.api.post('/api/v1/notifications', {
            type: NotificationType.MENTION,
            userId: testUser.id,
            title: 'New Mention',
            message: '@testuser mentioned you in a comment',
            priority: NotificationPriority.HIGH
          });

          // Wait for WebSocket message
          const wsMessage = await wsClient.waitForMessage();
          expect(wsMessage.type).toBe('notification');
          return response.data;
        },
        TEST_TIMEOUT
      );

      expect(notification).toBeDefined();
      wsClient.disconnect();
    });

    it('should mark notifications as read with delivery tracking', async () => {
      const { result: updatedNotification } = await waitForAsyncOperation(
        async () => {
          const response = await testEnv.api.patch(
            `/api/v1/notifications/${testUser.id}/mark-read`,
            { notificationIds: [testUser.id] }
          );
          expect(response.status).toBe(200);
          return response.data;
        },
        TEST_TIMEOUT
      );

      expect(updatedNotification).toMatchObject({
        read: true,
        acknowledgedAt: expect.any(String)
      });
    });
  });

  describe('Notification Preferences', () => {
    it('should update user notification preferences', async () => {
      const newPreferences = {
        emailEnabled: false,
        webSocketEnabled: true,
        notificationTypes: [NotificationType.TASK_UPDATED],
        retentionDays: 15
      };

      const { result: preferences } = await waitForAsyncOperation(
        async () => {
          const response = await testEnv.api.put(
            `/api/v1/notifications/preferences/${testUser.id}`,
            newPreferences
          );
          expect(response.status).toBe(200);
          return response.data;
        },
        TEST_TIMEOUT
      );

      expect(preferences).toMatchObject(newPreferences);
    });
  });

  describe('Error Handling and Rate Limiting', () => {
    it('should handle invalid notification data', async () => {
      const invalidData = {
        type: 'INVALID_TYPE',
        userId: testUser.id
      };

      try {
        await testEnv.api.post('/api/v1/notifications', invalidData);
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.errorCode).toBe('VALIDATION_ERROR');
      }
    });

    it('should enforce rate limits on notification creation', async () => {
      const notifications = Array(11).fill({
        type: NotificationType.TASK_ASSIGNED,
        userId: testUser.id,
        title: 'Rate Limit Test',
        priority: NotificationPriority.LOW
      });

      try {
        await Promise.all(
          notifications.map(n => testEnv.api.post('/api/v1/notifications', n))
        );
        fail('Should have thrown rate limit error');
      } catch (error: any) {
        expect(error.response.status).toBe(429);
        expect(error.response.data.errorCode).toBe('RATE_LIMIT_EXCEEDED');
      }
    });
  });
});