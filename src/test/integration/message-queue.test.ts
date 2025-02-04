/**
 * @fileoverview Integration tests for RabbitMQ message queue functionality
 * Tests message publishing, consumption, reliability, and monitoring
 * @version amqplib ^0.10.0
 * @version jest ^29.5.0
 * @version prom-client ^14.0.0
 */

import { Connection, Channel, connect } from 'amqplib';
import { Counter, Histogram } from 'prom-client';
import { rabbitmqConfig } from '../../backend/notification-service/src/config/rabbitmq.config';
import { NotificationService } from '../../backend/notification-service/src/services/notification.service';
import { NotificationType, DeliveryMethod } from '../../backend/notification-service/src/interfaces/notification.interface';
import { HTTP_STATUS, ERROR_CODES } from '../../backend/shared/constants';

/**
 * Metrics collector for test monitoring
 */
class MetricsCollector {
  public messageCounter: Counter;
  public latencyHistogram: Histogram;
  public errorCounter: Counter;

  constructor() {
    this.messageCounter = new Counter({
      name: 'test_messages_total',
      help: 'Total number of test messages processed',
      labelNames: ['type', 'status']
    });

    this.latencyHistogram = new Histogram({
      name: 'test_message_latency_seconds',
      help: 'Message processing latency in seconds',
      labelNames: ['operation']
    });

    this.errorCounter = new Counter({
      name: 'test_errors_total',
      help: 'Total number of test errors',
      labelNames: ['type']
    });
  }
}

/**
 * Sets up RabbitMQ connection and channels for testing
 */
async function setupMessageQueue(securityConfig: any, monitoringConfig: any) {
  const metrics = new MetricsCollector();
  
  // Create secure connection
  const connection = await connect({
    ...rabbitmqConfig.connection.socketOptions,
    cert: securityConfig.cert,
    key: securityConfig.key,
    ca: securityConfig.ca
  });

  // Create channel with automatic recovery
  const channel = await connection.createChannel();
  await channel.prefetch(rabbitmqConfig.connection.prefetch);

  // Assert exchanges with security settings
  await channel.assertExchange(
    rabbitmqConfig.exchanges.notifications.name,
    rabbitmqConfig.exchanges.notifications.type,
    rabbitmqConfig.exchanges.notifications.options
  );

  await channel.assertExchange(
    rabbitmqConfig.exchanges.deadLetter.name,
    rabbitmqConfig.exchanges.deadLetter.type,
    rabbitmqConfig.exchanges.deadLetter.options
  );

  // Assert queues with monitoring
  await channel.assertQueue(
    rabbitmqConfig.queues.email.name,
    rabbitmqConfig.queues.email.options
  );

  await channel.assertQueue(
    rabbitmqConfig.queues.websocket.name,
    rabbitmqConfig.queues.websocket.options
  );

  await channel.assertQueue(
    rabbitmqConfig.queues.deadLetter.name,
    rabbitmqConfig.queues.deadLetter.options
  );

  return { connection, channel, metrics };
}

/**
 * Cleans up RabbitMQ resources and exports metrics
 */
async function cleanupMessageQueue(
  connection: Connection,
  channel: Channel,
  metricsCollector: MetricsCollector
): Promise<void> {
  // Export final metrics
  const metrics = await metricsCollector.messageCounter.get();
  console.log('Test Metrics:', metrics);

  // Cleanup resources
  await channel.close();
  await connection.close();
}

/**
 * Comprehensive test suite for message queue integration
 */
export class MessageQueueTests {
  private connection: Connection;
  private channel: Channel;
  private notificationService: NotificationService;
  private metricsCollector: MetricsCollector;

  constructor(securityConfig: any, monitoringConfig: any) {
    this.metricsCollector = new MetricsCollector();
  }

  /**
   * Tests RabbitMQ connection establishment and security
   */
  async testQueueConnection(): Promise<void> {
    const startTime = Date.now();

    try {
      const setup = await setupMessageQueue(
        rabbitmqConfig.connection.socketOptions,
        rabbitmqConfig.monitoring
      );

      this.connection = setup.connection;
      this.channel = setup.channel;

      // Verify connection
      expect(this.connection).toBeDefined();
      expect(this.channel).toBeDefined();

      // Test connection parameters
      expect(this.connection.connection.serverProperties).toHaveProperty('product', 'RabbitMQ');
      expect(this.channel.prefetch).toBe(rabbitmqConfig.connection.prefetch);

      // Verify SSL/TLS
      const socket = this.connection.connection.stream;
      expect(socket.encrypted).toBe(true);

      this.metricsCollector.latencyHistogram.observe(
        { operation: 'connection' },
        (Date.now() - startTime) / 1000
      );
    } catch (error) {
      this.metricsCollector.errorCounter.inc({ type: 'connection' });
      throw error;
    }
  }

  /**
   * Tests message publishing with performance metrics
   */
  async testMessagePublishing(): Promise<void> {
    const testMessage = {
      id: 'test-123',
      type: NotificationType.TASK_ASSIGNED,
      userId: 'user-123',
      title: 'Test Notification',
      message: 'Test message content',
      metadata: { test: true }
    };

    const startTime = Date.now();

    try {
      // Publish test message
      await this.channel.publish(
        rabbitmqConfig.exchanges.notifications.name,
        'notification.email.test',
        Buffer.from(JSON.stringify(testMessage)),
        {
          persistent: true,
          messageId: testMessage.id,
          timestamp: startTime,
          headers: {
            'x-retry-count': 0
          }
        }
      );

      // Verify message delivery
      const assertQueue = await this.channel.checkQueue(rabbitmqConfig.queues.email.name);
      expect(assertQueue.messageCount).toBeGreaterThan(0);

      this.metricsCollector.messageCounter.inc({
        type: 'publish',
        status: 'success'
      });

      this.metricsCollector.latencyHistogram.observe(
        { operation: 'publish' },
        (Date.now() - startTime) / 1000
      );
    } catch (error) {
      this.metricsCollector.errorCounter.inc({ type: 'publish' });
      throw error;
    }
  }

  /**
   * Tests message consumption and processing
   */
  async testMessageConsumption(): Promise<void> {
    const startTime = Date.now();

    try {
      // Set up consumer
      await this.channel.consume(
        rabbitmqConfig.queues.email.name,
        async (msg) => {
          if (!msg) return;

          try {
            const content = JSON.parse(msg.content.toString());
            expect(content).toHaveProperty('id');
            expect(content).toHaveProperty('type');

            // Process message
            await this.processTestMessage(content);

            // Acknowledge message
            this.channel.ack(msg);

            this.metricsCollector.messageCounter.inc({
              type: 'consume',
              status: 'success'
            });
          } catch (error) {
            // Reject message to dead letter queue
            this.channel.reject(msg, false);
            this.metricsCollector.errorCounter.inc({ type: 'consume' });
          }
        },
        { noAck: false }
      );

      this.metricsCollector.latencyHistogram.observe(
        { operation: 'consume' },
        (Date.now() - startTime) / 1000
      );
    } catch (error) {
      this.metricsCollector.errorCounter.inc({ type: 'consume_setup' });
      throw error;
    }
  }

  /**
   * Tests dead letter queue handling
   */
  async testDeadLetterHandling(): Promise<void> {
    const startTime = Date.now();

    try {
      // Publish invalid message to trigger DLQ
      const invalidMessage = { invalid: true };
      
      await this.channel.publish(
        rabbitmqConfig.exchanges.notifications.name,
        'notification.email.test',
        Buffer.from(JSON.stringify(invalidMessage)),
        { expiration: '1000' } // Expire after 1 second
      );

      // Verify message in DLQ
      await new Promise(resolve => setTimeout(resolve, 1500));
      const dlq = await this.channel.checkQueue(rabbitmqConfig.queues.deadLetter.name);
      expect(dlq.messageCount).toBeGreaterThan(0);

      this.metricsCollector.messageCounter.inc({
        type: 'dlq',
        status: 'success'
      });

      this.metricsCollector.latencyHistogram.observe(
        { operation: 'dlq' },
        (Date.now() - startTime) / 1000
      );
    } catch (error) {
      this.metricsCollector.errorCounter.inc({ type: 'dlq' });
      throw error;
    }
  }

  /**
   * Returns collected metrics
   */
  async getMetrics(): Promise<any> {
    return {
      messages: await this.metricsCollector.messageCounter.get(),
      latency: await this.metricsCollector.latencyHistogram.get(),
      errors: await this.metricsCollector.errorCounter.get()
    };
  }

  /**
   * Processes test messages
   */
  private async processTestMessage(message: any): Promise<void> {
    // Simulate message processing
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}