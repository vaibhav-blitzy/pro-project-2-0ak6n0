/**
 * @fileoverview End-to-end test specifications for the notification system
 * Testing real-time notifications, notification interactions, UI components,
 * performance metrics, and security validations.
 * @version 1.0.0
 */

import { setupTestEnvironment, teardownTestEnvironment, createTestUser } from '../../utils/test-helpers';
import { securityValidator } from '../../utils/security-helpers';
import { faker } from '@faker-js/faker';
import { performanceMonitor } from '@cypress/performance-monitor';
import { websocket } from '@cypress/websocket';
import { API_ENDPOINTS } from '../../../web/src/constants/api.constants';

describe('Notification System E2E Tests', () => {
  let testUser: any;
  let wsConnection: any;

  beforeEach(async () => {
    // Initialize performance monitoring
    performanceMonitor.start({
      threshold: 500, // API response time threshold
      trackNetwork: true,
      trackMemory: true
    });

    // Setup test environment with security context
    await setupTestEnvironment({
      securityValidation: true,
      performanceMonitoring: true
    });

    // Create test user with notification permissions
    testUser = await createTestUser({
      role: 'user',
      permissions: ['notifications.read', 'notifications.manage']
    });

    // Setup WebSocket connection with security validation
    wsConnection = await websocket.connect(API_ENDPOINTS.NOTIFICATIONS.WEBSOCKET, {
      headers: {
        Authorization: `Bearer ${testUser.token}`
      }
    });

    // Validate WebSocket connection security
    await securityValidator.validateWebSocketSecurity(wsConnection);

    // Clear existing notifications
    cy.get(selectors.notification_list).should('exist');
    cy.get(selectors.clear_all_button).click();
  });

  afterEach(async () => {
    // Collect performance metrics
    const metrics = performanceMonitor.getMetrics();
    expect(metrics.averageResponseTime).to.be.lessThan(500);

    // Close WebSocket connection
    if (wsConnection) {
      await wsConnection.close();
    }

    // Cleanup test environment
    await teardownTestEnvironment();

    // Reset performance monitoring
    performanceMonitor.reset();
  });

  describe('Notification Security Validation', () => {
    it('should validate CSRF protection for notification actions', () => {
      // Verify CSRF token presence
      cy.window().then((win) => {
        expect(win.localStorage.getItem('csrf_token')).to.exist;
      });

      // Attempt notification action without CSRF token
      cy.request({
        method: 'POST',
        url: API_ENDPOINTS.NOTIFICATIONS.MARK_READ,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(403);
      });
    });

    it('should prevent XSS in notification content', () => {
      const maliciousContent = '<script>alert("xss")</script>';
      
      // Validate XSS prevention
      cy.window().then(async (win) => {
        const validationResult = await securityValidator.checkXSSProtection(
          maliciousContent,
          selectors.notification_item
        );
        expect(validationResult.sanitized).to.be.true;
      });
    });
  });

  describe('Notification Performance Validation', () => {
    it('should deliver notifications within 500ms threshold', () => {
      const testNotification = {
        title: faker.lorem.sentence(),
        message: faker.lorem.paragraph(),
        type: 'info'
      };

      // Measure notification delivery time
      const startTime = performance.now();
      
      wsConnection.send(JSON.stringify({
        type: 'notification',
        data: testNotification
      }));

      cy.get(selectors.notification_item)
        .should('be.visible')
        .then(() => {
          const deliveryTime = performance.now() - startTime;
          expect(deliveryTime).to.be.lessThan(500);
        });
    });

    it('should handle batch notifications efficiently', () => {
      const batchSize = 10;
      const notifications = Array.from({ length: batchSize }, () => ({
        title: faker.lorem.sentence(),
        message: faker.lorem.paragraph(),
        type: 'info'
      }));

      // Measure batch processing time
      const startTime = performance.now();

      notifications.forEach(notification => {
        wsConnection.send(JSON.stringify({
          type: 'notification',
          data: notification
        }));
      });

      cy.get(selectors.notification_item)
        .should('have.length', batchSize)
        .then(() => {
          const processingTime = performance.now() - startTime;
          expect(processingTime / batchSize).to.be.lessThan(100);
        });
    });
  });

  describe('Notification Error Handling', () => {
    it('should handle network disconnections gracefully', () => {
      // Simulate network failure
      cy.intercept(API_ENDPOINTS.NOTIFICATIONS.WEBSOCKET, {
        forceNetworkError: true
      });

      // Verify error message display
      cy.get(selectors.error_message)
        .should('be.visible')
        .and('contain', 'Connection lost');

      // Verify retry mechanism
      cy.get(selectors.retry_button)
        .should('be.visible')
        .click();

      // Verify reconnection
      cy.get(selectors.notification_bell)
        .should('not.have.class', 'disconnected');
    });

    it('should handle invalid notification data', () => {
      const invalidNotification = {
        invalid: 'data'
      };

      wsConnection.send(JSON.stringify({
        type: 'notification',
        data: invalidNotification
      }));

      // Verify error handling
      cy.get(selectors.error_message)
        .should('be.visible')
        .and('contain', 'Invalid notification format');
    });
  });
});

// Test selectors
const selectors = {
  notification_bell: "[data-testid='notification-bell']",
  notification_count: "[data-testid='notification-count']",
  notification_list: "[data-testid='notification-list']",
  notification_item: "[data-testid='notification-item']",
  mark_read_button: "[data-testid='mark-read-button']",
  clear_all_button: "[data-testid='clear-all-button']",
  error_message: "[data-testid='notification-error']",
  retry_button: "[data-testid='retry-button']",
  notification_settings: "[data-testid='notification-settings']",
  performance_metrics: "[data-testid='performance-metrics']"
};