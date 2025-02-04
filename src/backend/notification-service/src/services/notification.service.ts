import { Injectable } from '@nestjs/common';
import { Logger } from 'winston';
import CircuitBreaker from 'opossum';
import * as Prometheus from 'prom-client';
import { 
  INotification, 
  INotificationPreferences,
  NotificationType,
  DeliveryMethod,
  INotificationDelivery 
} from '../interfaces/notification.interface';
import { HTTP_STATUS, ERROR_CODES } from '../../../shared/constants';

/**
 * Enterprise-grade notification service implementing multi-channel delivery,
 * monitoring, and security features with high availability patterns.
 * @version 1.0.0
 */
@Injectable()
export class NotificationService {
  // Prometheus metrics
  private readonly notificationCounter: Prometheus.Counter;
  private readonly deliveryLatencyHistogram: Prometheus.Histogram;
  private readonly failureCounter: Prometheus.Counter;

  // Circuit breakers for external services
  private readonly emailCircuitBreaker: CircuitBreaker;
  private readonly webhookCircuitBreaker: CircuitBreaker;

  // Retry configuration
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;

  constructor(
    private readonly emailService: any,
    private readonly webSocketService: any,
    private readonly logger: Logger,
    private readonly metrics: any,
    private readonly pool: any
  ) {
    // Initialize metrics
    this.notificationCounter = new Prometheus.Counter({
      name: 'notifications_total',
      help: 'Total number of notifications processed',
      labelNames: ['type', 'status']
    });

    this.deliveryLatencyHistogram = new Prometheus.Histogram({
      name: 'notification_delivery_duration_seconds',
      help: 'Notification delivery latency in seconds',
      labelNames: ['method']
    });

    this.failureCounter = new Prometheus.Counter({
      name: 'notification_failures_total',
      help: 'Total number of notification delivery failures',
      labelNames: ['method', 'error_type']
    });

    // Configure circuit breakers
    this.emailCircuitBreaker = new CircuitBreaker(this.emailService.send, {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    });

    this.webhookCircuitBreaker = new CircuitBreaker(this.processWebhookDelivery, {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    });
  }

  /**
   * Creates and delivers a notification through configured channels
   * with comprehensive tracking and security measures.
   * @param notification - Notification data to process
   * @param options - Delivery configuration options
   * @returns Promise resolving to the processed notification
   */
  async createNotification(
    notification: INotification,
    options: { priority?: boolean; immediate?: boolean } = {}
  ): Promise<INotification> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Processing notification', {
        notificationId: notification.id,
        type: notification.type,
        userId: notification.userId
      });

      // Get user preferences
      const preferences = await this.getUserPreferences(notification.userId);
      
      // Track notification creation
      this.notificationCounter.inc({ type: notification.type });

      // Create delivery tracking record
      const deliveryRecord: INotificationDelivery = {
        notificationId: notification.id,
        method: DeliveryMethod.EMAIL,
        status: 'PENDING',
        attempts: 0,
        lastAttemptAt: new Date(),
        error: null,
        nextRetryAt: null,
        deliveryMetadata: {},
        acknowledgedAt: null
      };

      // Process through enabled channels
      const deliveryPromises: Promise<void>[] = [];

      if (preferences.emailEnabled) {
        deliveryPromises.push(this.deliverViaEmail(notification, deliveryRecord));
      }

      if (preferences.webSocketEnabled) {
        deliveryPromises.push(this.deliverViaWebSocket(notification));
      }

      if (preferences.webhookUrl) {
        deliveryPromises.push(
          this.deliverViaWebhook(notification, preferences)
        );
      }

      await Promise.allSettled(deliveryPromises);

      // Update metrics
      this.deliveryLatencyHistogram.observe(
        { method: 'all' },
        (Date.now() - startTime) / 1000
      );

      return {
        ...notification,
        deliveryStatus: 'DELIVERED'
      };

    } catch (error) {
      this.logger.error('Notification delivery failed', {
        notificationId: notification.id,
        error: error.message
      });

      this.failureCounter.inc({
        method: 'all',
        error_type: error.name
      });

      throw error;
    }
  }

  /**
   * Processes webhook delivery with security measures and retry logic
   * @param notification - Notification to deliver
   * @param config - Webhook configuration
   * @returns Promise resolving to delivery status
   */
  private async processWebhookDelivery(
    notification: INotification,
    config: { webhookUrl: string; webhookSecret: string }
  ): Promise<string> {
    const startTime = Date.now();

    try {
      // Generate webhook signature
      const signature = this.generateWebhookSignature(
        notification,
        config.webhookSecret
      );

      // Prepare webhook payload
      const payload = {
        notification,
        timestamp: new Date().toISOString(),
        signature
      };

      // Attempt delivery with circuit breaker
      await this.webhookCircuitBreaker.fire(async () => {
        const response = await fetch(config.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Webhook delivery failed: ${response.statusText}`);
        }
      });

      // Update metrics
      this.deliveryLatencyHistogram.observe(
        { method: 'webhook' },
        (Date.now() - startTime) / 1000
      );

      return 'DELIVERED';

    } catch (error) {
      this.failureCounter.inc({
        method: 'webhook',
        error_type: error.name
      });

      throw error;
    }
  }

  /**
   * Delivers notification via email with retry logic
   */
  private async deliverViaEmail(
    notification: INotification,
    deliveryRecord: INotificationDelivery
  ): Promise<void> {
    try {
      await this.emailCircuitBreaker.fire(async () => {
        await this.emailService.send({
          to: notification.userId,
          subject: notification.title,
          template: notification.template,
          context: notification.metadata
        });
      });
    } catch (error) {
      await this.handleDeliveryFailure(
        notification,
        deliveryRecord,
        DeliveryMethod.EMAIL,
        error
      );
    }
  }

  /**
   * Delivers notification via WebSocket
   */
  private async deliverViaWebSocket(notification: INotification): Promise<void> {
    try {
      await this.webSocketService.emit(notification.userId, 'notification', notification);
    } catch (error) {
      this.logger.error('WebSocket delivery failed', {
        notificationId: notification.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handles delivery failures with retry logic
   */
  private async handleDeliveryFailure(
    notification: INotification,
    deliveryRecord: INotificationDelivery,
    method: DeliveryMethod,
    error: Error
  ): Promise<void> {
    deliveryRecord.attempts++;
    deliveryRecord.lastAttemptAt = new Date();
    deliveryRecord.error = error.message;

    if (deliveryRecord.attempts < this.maxRetries) {
      deliveryRecord.nextRetryAt = new Date(
        Date.now() + this.retryDelayMs * Math.pow(2, deliveryRecord.attempts - 1)
      );
      // Schedule retry
      setTimeout(
        () => this.retryDelivery(notification, deliveryRecord, method),
        this.retryDelayMs * Math.pow(2, deliveryRecord.attempts - 1)
      );
    } else {
      this.logger.error('Max retry attempts reached', {
        notificationId: notification.id,
        method
      });
      throw new Error('Max retry attempts reached');
    }
  }

  /**
   * Retries failed delivery attempts
   */
  private async retryDelivery(
    notification: INotification,
    deliveryRecord: INotificationDelivery,
    method: DeliveryMethod
  ): Promise<void> {
    try {
      switch (method) {
        case DeliveryMethod.EMAIL:
          await this.deliverViaEmail(notification, deliveryRecord);
          break;
        case DeliveryMethod.WEBHOOK:
          await this.processWebhookDelivery(notification, {
            webhookUrl: notification.metadata.webhookUrl,
            webhookSecret: notification.metadata.webhookSecret
          });
          break;
      }
    } catch (error) {
      await this.handleDeliveryFailure(notification, deliveryRecord, method, error);
    }
  }

  /**
   * Generates secure webhook signature
   */
  private generateWebhookSignature(
    notification: INotification,
    secret: string
  ): string {
    const crypto = require('crypto');
    const payload = JSON.stringify(notification);
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Retrieves user notification preferences
   */
  private async getUserPreferences(
    userId: string
  ): Promise<INotificationPreferences> {
    // Implementation would fetch from user service/database
    return {
      userId,
      emailEnabled: true,
      webSocketEnabled: true,
      webhookUrl: '',
      webhookSecret: '',
      notificationTypes: Object.values(NotificationType),
      retentionDays: 30,
      deliverySchedule: {}
    };
  }
}