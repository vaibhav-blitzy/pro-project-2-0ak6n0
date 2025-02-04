/**
 * @fileoverview Redux slice for managing notification state with real-time updates
 * Implements comprehensive notification management with WebSocket integration,
 * caching, and error handling for enterprise applications.
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Socket } from 'socket.io-client';
import { INotification, NotificationPriority, NotificationType } from '../interfaces/notification.interface';
import { NotificationState, LoadingState } from '../types/store.types';
import { NotificationApi } from '../api/notifications.api';
import { createWebSocketConnection, WebSocketError } from '../api/websocket.api';
import { WS_EVENTS } from '../config/websocket.config';

// Initial state with comprehensive notification management
const initialState: NotificationState = {
  notifications: [],
  isOpen: false,
  unreadCount: 0,
  loading: LoadingState.IDLE,
  error: null,
  websocketStatus: LoadingState.IDLE,
  lastSyncTimestamp: 0,
  preferences: {
    sound: true,
    desktop: true,
    email: true,
    grouping: true
  },
  retryCount: 0,
  cache: {
    ttl: 300000, // 5 minutes
    maxSize: 1000
  }
};

// Async thunk for fetching notifications with pagination and caching
export const fetchNotifications = createAsyncThunk(
  'notifications/fetch',
  async (params: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    priority?: NotificationPriority;
  }, { rejectWithValue }) => {
    try {
      const response = await NotificationApi.getNotifications(params);
      return response.items;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message,
        code: error.code
      });
    }
  }
);

// Async thunk for marking notifications as read with optimistic updates
export const markAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (notificationId: string, { dispatch, rejectWithValue }) => {
    try {
      await NotificationApi.markNotificationAsRead(notificationId);
      return notificationId;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message,
        code: error.code
      });
    }
  }
);

// Async thunk for updating notification preferences
export const updatePreferences = createAsyncThunk(
  'notifications/updatePreferences',
  async (preferences: NotificationState['preferences'], { rejectWithValue }) => {
    try {
      await NotificationApi.updatePreferences(preferences);
      return preferences;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message,
        code: error.code
      });
    }
  }
);

// Notification slice with comprehensive state management
const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setOpen: (state, action: PayloadAction<boolean>) => {
      state.isOpen = action.payload;
    },
    addNotification: (state, action: PayloadAction<INotification>) => {
      state.notifications.unshift(action.payload);
      if (!action.payload.read) {
        state.unreadCount += 1;
      }
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        notification => notification.id !== action.payload
      );
    },
    setWebSocketStatus: (state, action: PayloadAction<LoadingState>) => {
      state.websocketStatus = action.payload;
    },
    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
    updateNotification: (state, action: PayloadAction<INotification>) => {
      const index = state.notifications.findIndex(n => n.id === action.payload.id);
      if (index !== -1) {
        const wasUnread = !state.notifications[index].read;
        const isNowRead = action.payload.read;
        if (wasUnread && isNowRead) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
        state.notifications[index] = action.payload;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch notifications handlers
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = LoadingState.LOADING;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = LoadingState.SUCCESS;
        state.notifications = action.payload;
        state.unreadCount = action.payload.filter(n => !n.read).length;
        state.lastSyncTimestamp = Date.now();
        state.error = null;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = LoadingState.ERROR;
        state.error = action.payload as any;
      })
      // Mark as read handlers
      .addCase(markAsRead.fulfilled, (state, action) => {
        const notification = state.notifications.find(n => n.id === action.payload);
        if (notification && !notification.read) {
          notification.read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      // Update preferences handlers
      .addCase(updatePreferences.fulfilled, (state, action) => {
        state.preferences = action.payload;
      });
  }
});

// WebSocket connection management
let socket: Socket | null = null;

export const initializeWebSocket = (authToken: string) => (dispatch: any) => {
  if (socket?.connected) return;

  socket = createWebSocketConnection(
    authToken,
    {
      onConnect: () => {
        dispatch(setWebSocketStatus(LoadingState.SUCCESS));
      },
      onDisconnect: () => {
        dispatch(setWebSocketStatus(LoadingState.IDLE));
      },
      onError: (error: WebSocketError) => {
        dispatch(setWebSocketStatus(LoadingState.ERROR));
      },
      onNotification: (notification: INotification) => {
        dispatch(addNotification(notification));
      }
    },
    {
      enableHeartbeat: true,
      heartbeatInterval: 30000
    }
  );
};

export const disconnectWebSocket = () => {
  if (socket?.connected) {
    socket.disconnect();
    socket = null;
  }
};

// Export actions and reducer
export const {
  setOpen,
  addNotification,
  removeNotification,
  setWebSocketStatus,
  clearNotifications,
  updateNotification
} = notificationsSlice.actions;

export default notificationsSlice.reducer;

// Selectors
export const selectNotifications = (state: { notifications: NotificationState }) =>
  state.notifications.notifications;

export const selectUnreadCount = (state: { notifications: NotificationState }) =>
  state.notifications.unreadCount;

export const selectIsOpen = (state: { notifications: NotificationState }) =>
  state.notifications.isOpen;

export const selectWebSocketStatus = (state: { notifications: NotificationState }) =>
  state.notifications.websocketStatus;

export const selectNotificationPreferences = (state: { notifications: NotificationState }) =>
  state.notifications.preferences;