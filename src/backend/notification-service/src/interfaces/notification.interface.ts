/**
 * @fileoverview Core TypeScript interfaces defining notification-related data structures
 * including notification types, delivery methods, and notification preferences with
 * enhanced support for webhooks, metadata, and delivery tracking.
 */

import { IAuditableEntity, IBaseResponse } from '../../../shared/interfaces/base.interface';

/**
 * Enumeration of supported notification types
 */
export enum NotificationType {
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_UPDATED = 'TASK_UPDATED',
  PROJECT_UPDATED = 'PROJECT_UPDATED',
  COMMENT_ADDED = 'COMMENT_ADDED',
  MENTION = 'MENTION',
  DUE_DATE_REMINDER = 'DUE_DATE_REMINDER'
}

/**
 * Enumeration of notification priority levels
 */
export enum NotificationPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

/**
 * Enumeration of supported notification delivery methods
 */
export enum DeliveryMethod {
  EMAIL = 'EMAIL',
  WEBSOCKET = 'WEBSOCKET',
  WEBHOOK = 'WEBHOOK'
}

/**
 * Core notification interface extending IAuditableEntity
 * Implements comprehensive notification data structure with enhanced metadata
 * and templating support
 */
export interface INotification extends IAuditableEntity {
  /** Unique identifier for the notification */
  id: string;
  
  /** Type of notification from NotificationType enum */
  type: NotificationType;
  
  /** ID of the user this notification is for */
  userId: string;
  
  /** Notification title */
  title: string;
  
  /** Detailed notification message */
  message: string;
  
  /** Priority level from NotificationPriority enum */
  priority: NotificationPriority;
  
  /** Flag indicating if notification has been read */
  read: boolean;
  
  /** Additional contextual data for the notification */
  metadata: Record<string, any>;
  
  /** Category for grouping related notifications */
  category: string;
  
  /** Template identifier for rendering notification */
  template: string;
  
  /** Timestamp when notification should expire */
  expiresAt: Date;
}

/**
 * User notification preferences interface with enhanced webhook
 * and retention settings
 */
export interface INotificationPreferences {
  /** User ID associated with these preferences */
  userId: string;
  
  /** Flag for email notifications */
  emailEnabled: boolean;
  
  /** Flag for WebSocket notifications */
  webSocketEnabled: boolean;
  
  /** Webhook URL for external integrations */
  webhookUrl: string;
  
  /** Array of notification types user wants to receive */
  notificationTypes: NotificationType[];
  
  /** Secret for webhook authentication */
  webhookSecret: string;
  
  /** Number of days to retain notifications */
  retentionDays: number;
  
  /** Schedule preferences for different notification types */
  deliverySchedule: Record<NotificationType, string>;
}

/**
 * Notification delivery tracking interface with enhanced retry
 * and acknowledgment support
 */
export interface INotificationDelivery {
  /** ID of the notification being delivered */
  notificationId: string;
  
  /** Delivery method used */
  method: DeliveryMethod;
  
  /** Current delivery status */
  status: string;
  
  /** Number of delivery attempts made */
  attempts: number;
  
  /** Timestamp of last delivery attempt */
  lastAttemptAt: Date;
  
  /** Error message if delivery failed */
  error: string;
  
  /** Timestamp for next retry attempt */
  nextRetryAt: Date;
  
  /** Additional metadata about the delivery */
  deliveryMetadata: Record<string, any>;
  
  /** Timestamp when notification was acknowledged */
  acknowledgedAt: Date;
}