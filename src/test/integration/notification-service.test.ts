/**
 * @fileoverview Integration tests for the notification service, verifying end-to-end functionality
 * of notification creation, delivery, and management across different channels with enhanced
 * security validation and performance monitoring.
 * @version 1.0.0
 */

import { setupTestEnvironment, teardownTestEnvironment } from '../utils/test-helpers';
import supertest from 'supertest'; // ^6.3.3
import WebSocket from 'ws'; // ^8.13.0
import { API_ENDPOINTS } from '../../web/src/constants/api.constants';
import { ApiResponse, ApiError } from '../../web/src/types/api.types';
import { HTTP_STATUS } from '../../backend/shared/constants';

// Test configuration constants
const TEST_CONFIG = {
  performanceMonitoring: true,
  securityValidation: true,
  apiTimeout: 500, // 500ms SLA requirement
  wsTimeout: 1000
};

// Test data constants
const TEST_USER = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test.user@example.com'
};

const TEST_NOTIFICATION = {
  title: 'Test Notification',
  message: 'This is a test notification message',
  type: 'INFO',
  priority: 'NORMAL',
  recipients: [TEST_USER.id],
  channels: ['EMAIL', 'WEBSOCKET']
};

describe('Notification Service Integration Tests', () => {
  let testEnv: any;
  let wsClient: WebSocket;
  let wsMessages: any[] = [];

  beforeAll(async () => {
    // Initialize test environment with enhanced monitoring
    testEnv = await setupTestEnvironment({
      performanceMonitoring: TEST_CONFIG.performanceMonitoring,
      securityValidation: TEST_CONFIG.securityValidation
    });

    // Setup WebSocket client
    wsClient = new WebSocket(`ws://localhost:${process.env.PORT}${API_ENDPOINTS.NOTIFICATIONS.WEBSOCKET}`);
    wsClient.on('message', (data) => {
      wsMessages.push(JSON.parse(data.toString()));
    });

    await new Promise<void>((resolve) => {
      wsClient.on('open', () => resolve());
    });
  });

  afterAll(async () => {
    wsClient.close();
    await teardownTestEnvironment(testEnv);
  });

  beforeEach(() => {
    wsMessages = [];
  });

  describe('Email Notification Tests', () => {
    it('should create and deliver email notifications within performance SLA', async () => {
      const startTime = Date.now();

      const response = await supertest(testEnv.app)
        .post(API_ENDPOINTS.NOTIFICATIONS.BASE)
        .send({
          ...TEST_NOTIFICATION,
          channels: ['EMAIL']
        })
        .expect(HTTP_STATUS.CREATED);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(TEST_CONFIG.apiTimeout);

      const result = response.body as ApiResponse<any>;
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('SENT');
      expect(result.data.channels).toContain('EMAIL');
    });

    it('should handle email delivery failures with proper error responses', async () => {
      const response = await supertest(testEnv.app)
        .post(API_ENDPOINTS.NOTIFICATIONS.BASE)
        .send({
          ...TEST_NOTIFICATION,
          recipients: ['invalid-email'],
          channels: ['EMAIL']
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      const error = response.body as ApiError;
      expect(error.success).toBe(false);
      expect(error.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('WebSocket Notification Tests', () => {
    it('should deliver real-time notifications via WebSocket within SLA', async () => {
      const startTime = Date.now();

      await supertest(testEnv.app)
        .post(API_ENDPOINTS.NOTIFICATIONS.BASE)
        .send({
          ...TEST_NOTIFICATION,
          channels: ['WEBSOCKET']
        })
        .expect(HTTP_STATUS.CREATED);

      // Wait for WebSocket message
      await new Promise<void>((resolve) => {
        const checkMessages = () => {
          if (wsMessages.length > 0) {
            resolve();
          } else {
            setTimeout(checkMessages, 50);
          }
        };
        checkMessages();
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(TEST_CONFIG.wsTimeout);

      expect(wsMessages).toHaveLength(1);
      expect(wsMessages[0].title).toBe(TEST_NOTIFICATION.title);
    });

    it('should handle WebSocket connection errors gracefully', async () => {
      wsClient.close();

      const response = await supertest(testEnv.app)
        .post(API_ENDPOINTS.NOTIFICATIONS.BASE)
        .send({
          ...TEST_NOTIFICATION,
          channels: ['WEBSOCKET']
        })
        .expect(HTTP_STATUS.ACCEPTED);

      const result = response.body as ApiResponse<any>;
      expect(result.data.status).toBe('PENDING');
      expect(result.data.retryCount).toBe(0);
    });
  });

  describe('Webhook Notification Tests', () => {
    const TEST_WEBHOOK = {
      url: 'https://webhook.test/notifications',
      secret: 'test-webhook-secret'
    };

    it('should deliver notifications to webhook endpoints with retry mechanism', async () => {
      const response = await supertest(testEnv.app)
        .post(API_ENDPOINTS.NOTIFICATIONS.BASE)
        .send({
          ...TEST_NOTIFICATION,
          channels: ['WEBHOOK'],
          webhook: TEST_WEBHOOK
        })
        .expect(HTTP_STATUS.ACCEPTED);

      const result = response.body as ApiResponse<any>;
      expect(result.data.webhook.status).toBe('PENDING');
      expect(result.data.webhook.retryCount).toBeDefined();
    });

    it('should validate webhook security requirements', async () => {
      const response = await supertest(testEnv.app)
        .post(API_ENDPOINTS.NOTIFICATIONS.BASE)
        .send({
          ...TEST_NOTIFICATION,
          channels: ['WEBHOOK'],
          webhook: {
            url: TEST_WEBHOOK.url
            // Missing required secret
          }
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      const error = response.body as ApiError;
      expect(error.errorCode).toBe('VALIDATION_ERROR');
      expect(error.details.field).toBe('webhook.secret');
    });
  });

  describe('Notification Preferences Tests', () => {
    it('should respect user notification preferences', async () => {
      // Set user preferences to disable email notifications
      await supertest(testEnv.app)
        .put(API_ENDPOINTS.NOTIFICATIONS.PREFERENCES)
        .send({
          userId: TEST_USER.id,
          preferences: {
            email: false,
            websocket: true
          }
        })
        .expect(HTTP_STATUS.OK);

      // Attempt to send notification via email
      const response = await supertest(testEnv.app)
        .post(API_ENDPOINTS.NOTIFICATIONS.BASE)
        .send({
          ...TEST_NOTIFICATION,
          channels: ['EMAIL', 'WEBSOCKET']
        })
        .expect(HTTP_STATUS.CREATED);

      const result = response.body as ApiResponse<any>;
      expect(result.data.channels).not.toContain('EMAIL');
      expect(result.data.channels).toContain('WEBSOCKET');
    });
  });
});