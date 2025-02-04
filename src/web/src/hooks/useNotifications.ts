/**
 * @fileoverview Enhanced React hook for managing real-time notifications
 * Provides comprehensive notification management with WebSocket integration,
 * caching, error handling, and performance optimizations.
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^9.0.0
import { debounce } from 'lodash'; // ^4.17.21

import { INotification } from '../interfaces/notification.interface';
import { useWebSocket } from './useWebSocket';
import { notificationActions } from '../store/notifications.slice';

/**
 * Interface for hook configuration options
 */
interface UseNotificationsOptions {
  autoFetch?: boolean;
  limit?: number;
  cacheTimeout?: number;
  retryAttempts?: number;
}

/**
 * Default configuration values
 */
const DEFAULT_OPTIONS: Required<UseNotificationsOptions> = {
  autoFetch: true,
  limit: 20,
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
  retryAttempts: 3
};

/**
 * Enhanced hook for managing notifications with real-time updates
 * @param options Configuration options for the hook
 */
export const useNotifications = (options: UseNotificationsOptions = {}) => {
  const dispatch = useDispatch();
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // Local state management
  const [error, setError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Redux state selectors
  const notifications = useSelector(state => state.notifications.notifications);
  const unreadCount = useSelector(state => state.notifications.unreadCount);
  const loading = useSelector(state => state.notifications.loading === 'LOADING');

  // WebSocket integration
  const { subscribe, connectionState, reconnect } = useWebSocket(
    localStorage.getItem('authToken') || '',
    {
      autoReconnect: true,
      maxRetries: mergedOptions.retryAttempts,
      heartbeatEnabled: true
    }
  );

  /**
   * Debounced notification update handler to prevent excessive re-renders
   */
  const handleNotificationUpdate = useMemo(
    () =>
      debounce((notification: INotification) => {
        if (!notification.id) return;

        // Validate notification expiration
        if (notification.expiresAt && new Date(notification.expiresAt) < new Date()) {
          return;
        }

        dispatch(notificationActions.addNotification(notification));
      }, 250),
    [dispatch]
  );

  /**
   * Initialize WebSocket subscription and notification fetching
   */
  useEffect(() => {
    if (isInitialized) return;

    const initializeNotifications = async () => {
      try {
        if (mergedOptions.autoFetch) {
          await dispatch(notificationActions.fetchNotifications({
            limit: mergedOptions.limit
          }));
        }

        subscribe('notification', handleNotificationUpdate);
        setIsInitialized(true);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize notifications'));
      }
    };

    initializeNotifications();

    return () => {
      handleNotificationUpdate.cancel();
    };
  }, [isInitialized, dispatch, subscribe, handleNotificationUpdate, mergedOptions]);

  /**
   * Mark a notification as read
   */
  const markAsRead = useCallback(
    async (id: string) => {
      try {
        await dispatch(notificationActions.markAsRead(id));
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to mark notification as read'));
      }
    },
    [dispatch]
  );

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(
    async () => {
      try {
        await dispatch(notificationActions.markAllAsRead());
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to mark all notifications as read'));
      }
    },
    [dispatch]
  );

  /**
   * Clear all notifications
   */
  const clearNotifications = useCallback(
    async () => {
      try {
        await dispatch(notificationActions.clearNotifications());
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to clear notifications'));
      }
    },
    [dispatch]
  );

  /**
   * Fetch notifications with optional parameters
   */
  const fetchNotifications = useCallback(
    async (params?: { page?: number; limit?: number; unreadOnly?: boolean }) => {
      try {
        await dispatch(notificationActions.fetchNotifications(params));
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch notifications'));
      }
    },
    [dispatch]
  );

  /**
   * Update notification preferences
   */
  const updatePreferences = useCallback(
    async (preferences: NotificationPreferences) => {
      try {
        await dispatch(notificationActions.updateNotificationPreferences(preferences));
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to update notification preferences'));
      }
    },
    [dispatch]
  );

  return {
    notifications,
    unreadCount,
    loading,
    error,
    connectionState,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    fetchNotifications,
    updatePreferences,
    reconnect
  };
};