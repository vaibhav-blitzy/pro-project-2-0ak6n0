/**
 * @fileoverview RabbitMQ configuration for the notification service
 * Implements enterprise-grade message broker settings with enhanced reliability,
 * monitoring capabilities, and secure connection handling.
 * @version amqplib ^0.10.0
 */

import { Options } from 'amqplib';
import { NotificationType } from '../interfaces/notification.interface';

// Environment-based configuration with secure defaults
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const RABBITMQ_RECONNECT_INTERVAL = Number(process.env.RABBITMQ_RECONNECT_INTERVAL || 5000);
const RABBITMQ_MAX_RETRIES = Number(process.env.RABBITMQ_MAX_RETRIES || 5);
const RABBITMQ_PREFETCH = Number(process.env.RABBITMQ_PREFETCH || 10);
const RABBITMQ_HEARTBEAT = Number(process.env.RABBITMQ_HEARTBEAT || 60);

/**
 * Generates standardized queue names based on notification type and environment
 * @param type - NotificationType enum value
 * @param env - Environment name (e.g., 'prod', 'staging')
 * @returns Formatted queue name
 */
const getQueueName = (type: NotificationType, env: string): string => {
  if (!env || typeof env !== 'string') {
    throw new Error('Environment must be specified');
  }
  if (!Object.values(NotificationType).includes(type)) {
    throw new Error('Invalid notification type');
  }
  return `${env}.notifications.${type.toLowerCase()}`;
};

/**
 * Comprehensive RabbitMQ configuration with enhanced reliability features
 */
export const rabbitmqConfig = {
  connection: {
    url: RABBITMQ_URL,
    socketOptions: {
      heartbeatIntervalInSeconds: RABBITMQ_HEARTBEAT,
      reconnectTimeInSeconds: RABBITMQ_RECONNECT_INTERVAL,
      ssl: true,
      cert: process.env.RABBITMQ_CERT,
      key: process.env.RABBITMQ_KEY,
      ca: process.env.RABBITMQ_CA
    } as Options.Connect,
    prefetch: RABBITMQ_PREFETCH,
    maxRetries: RABBITMQ_MAX_RETRIES,
    retryStrategy: {
      initialDelay: 1000,
      maxDelay: 30000,
      multiplier: 2
    }
  },

  exchanges: {
    notifications: {
      name: 'notifications.topic',
      type: 'topic',
      options: {
        durable: true,
        autoDelete: false,
        internal: false,
        alternateExchange: 'notifications.unrouted'
      }
    },
    deadLetter: {
      name: 'notifications.dlx',
      type: 'topic',
      options: {
        durable: true,
        autoDelete: false
      }
    }
  },

  queues: {
    email: {
      name: 'notifications.email',
      options: {
        durable: true,
        deadLetterExchange: 'notifications.dlx',
        deadLetterRoutingKey: 'email.dead',
        messageTtl: 86400000, // 24 hours
        maxLength: 100000,
        maxPriority: 10
      },
      bindingKey: 'notification.email.#'
    },
    websocket: {
      name: 'notifications.websocket',
      options: {
        durable: true,
        deadLetterExchange: 'notifications.dlx',
        deadLetterRoutingKey: 'websocket.dead',
        messageTtl: 3600000, // 1 hour
        maxLength: 50000,
        maxPriority: 10
      },
      bindingKey: 'notification.websocket.#'
    },
    deadLetter: {
      name: 'notifications.dlq',
      options: {
        durable: true,
        maxLength: 100000
      },
      bindingKey: '#'
    }
  },

  monitoring: {
    enabled: true,
    metrics: {
      queueDepth: true,
      messageRate: true,
      consumerLag: true,
      connectionStatus: true
    },
    alerts: {
      queueDepthThreshold: 10000,
      consumerLagThreshold: 1000,
      connectionFailureThreshold: 3
    }
  }
} as const;

// Type-safe export of the configuration
export type RabbitMQConfig = typeof rabbitmqConfig;