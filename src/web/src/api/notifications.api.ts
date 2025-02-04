/**
 * @fileoverview Notifications API Client
 * Enterprise-grade implementation for managing user notifications with comprehensive
 * error handling, performance optimization, and enhanced security features.
 * @version 1.0.0
 */

import axios from 'axios'; // ^1.6.0
import { INotification, NotificationPreferences } from '../interfaces/notification.interface';
import { apiConfig } from '../config/api.config';
import { subscribeToNotifications } from './websocket.api';
import { API_ENDPOINTS } from '../constants/api.constants';
import { ApiResponse, ApiError, PaginatedResponse } from '../types/api.types';

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const NOTIFICATION_CACHE = new Map<string, { data: INotification[]; timestamp: number }>();

/**
 * Interface for notification query parameters
 */
interface NotificationQueryParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: string;
  startDate?: Date;
  endDate?: Date;
  category?: string;
}

/**
 * Validates and formats notification query parameters
 * @param params Query parameters to validate
 * @returns Validated and formatted parameters
 */
const validateQueryParams = (params: NotificationQueryParams): NotificationQueryParams => {
  return {
    page: Math.max(1, params.page || 1),
    limit: Math.min(100, Math.max(1, params.limit || 20)),
    unreadOnly: params.unreadOnly,
    type: params.type,
    startDate: params.startDate,
    endDate: params.endDate,
    category: params.category
  };
};

/**
 * Generates cache key for notification queries
 * @param params Query parameters
 * @returns Cache key string
 */
const generateCacheKey = (params: NotificationQueryParams): string => {
  return `notifications:${JSON.stringify(params)}`;
};

/**
 * Retrieves notifications with caching and pagination
 * @param params Query parameters for filtering and pagination
 * @returns Promise with paginated notifications and metadata
 */
export const getNotifications = async (
  params: NotificationQueryParams = {}
): Promise<PaginatedResponse<INotification>> => {
  try {
    const validatedParams = validateQueryParams(params);
    const cacheKey = generateCacheKey(validatedParams);

    // Check cache
    const cached = NOTIFICATION_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return {
        items: cached.data,
        total: cached.data.length,
        page: validatedParams.page!,
        pageSize: validatedParams.limit!,
        totalPages: Math.ceil(cached.data.length / validatedParams.limit!),
        hasNext: cached.data.length > validatedParams.page! * validatedParams.limit!,
        hasPrevious: validatedParams.page! > 1
      };
    }

    const response = await apiConfig.client.get<ApiResponse<INotification[]>>(
      API_ENDPOINTS.NOTIFICATIONS.BASE,
      {
        params: validatedParams,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      }
    );

    // Update cache
    NOTIFICATION_CACHE.set(cacheKey, {
      data: response.data.data,
      timestamp: Date.now()
    });

    return {
      items: response.data.data,
      total: response.data.data.length,
      page: validatedParams.page!,
      pageSize: validatedParams.limit!,
      totalPages: Math.ceil(response.data.data.length / validatedParams.limit!),
      hasNext: response.data.data.length > validatedParams.page! * validatedParams.limit!,
      hasPrevious: validatedParams.page! > 1
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const apiError = error.response?.data as ApiError;
      throw new Error(`Failed to fetch notifications: ${apiError.message}`);
    }
    throw error;
  }
};

/**
 * Marks a notification as read with optimistic updates
 * @param notificationId ID of the notification to mark as read
 * @returns Promise indicating success
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    // Optimistic update in cache
    NOTIFICATION_CACHE.forEach((cached, key) => {
      const updatedData = cached.data.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      );
      NOTIFICATION_CACHE.set(key, { data: updatedData, timestamp: cached.timestamp });
    });

    await apiConfig.client.patch(
      `${API_ENDPOINTS.NOTIFICATIONS.MARK_READ}/${notificationId}`,
      null,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    // Revert optimistic update on failure
    NOTIFICATION_CACHE.clear();
    if (axios.isAxiosError(error)) {
      const apiError = error.response?.data as ApiError;
      throw new Error(`Failed to mark notification as read: ${apiError.message}`);
    }
    throw error;
  }
};

/**
 * Updates user notification preferences
 * @param preferences Updated notification preferences
 * @returns Promise with updated preferences
 */
export const updateNotificationPreferences = async (
  preferences: NotificationPreferences
): Promise<NotificationPreferences> => {
  try {
    const response = await apiConfig.client.put<ApiResponse<NotificationPreferences>>(
      API_ENDPOINTS.NOTIFICATIONS.PREFERENCES,
      preferences,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const apiError = error.response?.data as ApiError;
      throw new Error(`Failed to update notification preferences: ${apiError.message}`);
    }
    throw error;
  }
};

/**
 * Subscribes to real-time notifications with WebSocket
 * @param onNotification Callback for handling new notifications
 * @returns Cleanup function for subscription
 */
export const subscribeToNotificationUpdates = (
  onNotification: (notification: INotification) => void
): () => void => {
  const socket = subscribeToNotifications({
    onNotification: (notification: INotification) => {
      // Update cache with new notification
      NOTIFICATION_CACHE.forEach((cached, key) => {
        const updatedData = [notification, ...cached.data];
        NOTIFICATION_CACHE.set(key, { data: updatedData, timestamp: Date.now() });
      });
      onNotification(notification);
    },
    onError: (error) => {
      console.error('Notification subscription error:', error);
    }
  });

  return () => {
    socket.disconnect();
    NOTIFICATION_CACHE.clear();
  };
};