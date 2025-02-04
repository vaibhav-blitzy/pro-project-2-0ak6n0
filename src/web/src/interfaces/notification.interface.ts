import { ComponentProps } from './common.interface';  // ^18.0.0
import { ReactNode } from 'react';  // ^18.0.0

/**
 * Enumeration of all possible notification types in the system
 * Used for categorizing and handling different types of notifications
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
 * Used for determining notification importance and display order
 */
export enum NotificationPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

/**
 * Core notification interface defining the structure of a notification
 * Includes all necessary fields for displaying and managing notifications
 */
export interface INotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  read: boolean;
  createdAt: Date;
  expiresAt: Date | null;
  targetUrl: string;
  acknowledgementRequired: boolean;
  category: string;
  metadata: Record<string, any>;
}

/**
 * Interface for grouping notifications by category
 * Used for organizing and displaying notifications in the UI
 */
export interface NotificationGroup {
  category: string;
  notifications: INotification[];
  unreadCount: number;
}

/**
 * Props interface for the notification bell component
 * Extends base component props with notification-specific properties
 */
export interface NotificationBellProps extends ComponentProps {
  onClick: () => void;
  badgeCount: number;
}

/**
 * Interface for user notification preferences
 * Defines all configurable notification settings
 */
export interface NotificationPreferences {
  emailEnabled: boolean;
  webSocketEnabled: boolean;
  notificationTypes: NotificationType[];
  priorityThreshold: NotificationPriority;
  quietHours: {
    start: string;
    end: string;
    timezone: string;
  };
  devicePreferences: Record<string, {
    enabled: boolean;
    types: NotificationType[];
  }>;
}