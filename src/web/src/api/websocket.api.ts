/**
 * @fileoverview WebSocket API Implementation
 * Enterprise-grade WebSocket client for real-time communication with enhanced
 * security, error handling, and performance optimizations.
 * @version 1.0.0
 */

import { io, Socket } from 'socket.io-client'; // ^4.7.2
import { wsConfig, WS_EVENTS } from '../config/websocket.config';
import { INotification } from '../interfaces/notification.interface';

/**
 * Enhanced interface for comprehensive WebSocket error handling
 */
export interface WebSocketError {
  code: string;
  message: string;
  timestamp: string;
  connectionId: string;
  details: any;
  isRecoverable: boolean;
}

/**
 * Comprehensive interface for WebSocket event handler functions
 */
export interface WebSocketEventHandlers {
  onConnect: () => void;
  onDisconnect: (reason: string) => void;
  onError: (error: WebSocketError) => void;
  onTaskUpdate: (data: any) => void;
  onProjectUpdate: (data: any) => void;
  onNotification: (notification: INotification) => void;
  onReconnectAttempt: (attempt: number) => void;
  onReconnectSuccess: () => void;
  onReconnectFailed: () => void;
  onHeartbeat: () => void;
}

/**
 * Interface for advanced WebSocket connection options
 */
export interface WebSocketConnectionOptions {
  poolSize: number;
  maxRetries: number;
  retryDelay: number;
  enableHeartbeat: boolean;
  heartbeatInterval: number;
  enableMultiplexing: boolean;
  enableBinaryProtocol: boolean;
  securityOptions: {
    enableSSL: boolean;
    validateCertificate: boolean;
    enableCompression: boolean;
  };
}

/**
 * Default connection options with security and performance optimizations
 */
const DEFAULT_CONNECTION_OPTIONS: WebSocketConnectionOptions = {
  poolSize: 1,
  maxRetries: 5,
  retryDelay: 3000,
  enableHeartbeat: true,
  heartbeatInterval: 25000,
  enableMultiplexing: true,
  enableBinaryProtocol: true,
  securityOptions: {
    enableSSL: true,
    validateCertificate: true,
    enableCompression: true
  }
};

/**
 * Creates and configures a new WebSocket connection with enhanced security
 * and performance features
 */
export const createWebSocketConnection = (
  authToken: string,
  eventHandlers: Partial<WebSocketEventHandlers>,
  options: Partial<WebSocketConnectionOptions> = {}
): Socket => {
  const connectionOptions = { ...DEFAULT_CONNECTION_OPTIONS, ...options };
  const socket = io(wsConfig.url, {
    ...wsConfig.options,
    auth: {
      token: authToken
    },
    transports: ['websocket'],
    secure: connectionOptions.securityOptions.enableSSL,
    rejectUnauthorized: connectionOptions.securityOptions.validateCertificate,
    perMessageDeflate: connectionOptions.securityOptions.enableCompression,
    multiplex: connectionOptions.enableMultiplexing,
    binaryType: connectionOptions.enableBinaryProtocol ? 'arraybuffer' : 'blob'
  });

  // Connection event handlers
  socket.on(WS_EVENTS.CONNECT, () => {
    eventHandlers.onConnect?.();
    if (connectionOptions.enableHeartbeat) {
      startHeartbeat(socket, connectionOptions.heartbeatInterval);
    }
  });

  socket.on(WS_EVENTS.DISCONNECT, (reason: string) => {
    eventHandlers.onDisconnect?.(reason);
  });

  socket.on(WS_EVENTS.ERROR, (error: any) => {
    const wsError: WebSocketError = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'Unknown WebSocket error',
      timestamp: new Date().toISOString(),
      connectionId: socket.id || 'unknown',
      details: error,
      isRecoverable: error.code !== 'AUTH_ERROR'
    };
    eventHandlers.onError?.(wsError);
  });

  // Reconnection handling
  socket.on(WS_EVENTS.RECONNECT_ATTEMPT, (attempt: number) => {
    eventHandlers.onReconnectAttempt?.(attempt);
  });

  socket.on(WS_EVENTS.RECONNECT, () => {
    eventHandlers.onReconnectSuccess?.();
  });

  socket.on(WS_EVENTS.RECONNECT_ERROR, () => {
    eventHandlers.onReconnectFailed?.();
  });

  // Business event handlers
  socket.on(WS_EVENTS.TASK_UPDATE, (data: any) => {
    eventHandlers.onTaskUpdate?.(data);
  });

  socket.on(WS_EVENTS.PROJECT_UPDATE, (data: any) => {
    eventHandlers.onProjectUpdate?.(data);
  });

  socket.on(WS_EVENTS.NOTIFICATION, (notification: INotification) => {
    eventHandlers.onNotification?.(notification);
  });

  return socket;
};

/**
 * Safely disconnects an active WebSocket connection with cleanup
 */
export const disconnectWebSocket = async (socket: Socket): Promise<void> => {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve();
      return;
    }

    const cleanup = () => {
      socket.removeAllListeners();
      socket.close();
      resolve();
    };

    socket.once(WS_EVENTS.DISCONNECT, cleanup);
    socket.disconnect();

    // Ensure cleanup after timeout
    setTimeout(cleanup, 1000);
  });
};

/**
 * Emits a WebSocket event with enhanced reliability and acknowledgment
 */
export const emitWebSocketEvent = async (
  socket: Socket,
  eventName: string,
  data: any,
  options: { timeout?: number; retries?: number } = {}
): Promise<void> => {
  const { timeout = 5000, retries = 3 } = options;

  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Socket not connected'));
      return;
    }

    let attempts = 0;
    const attemptEmit = () => {
      socket.emit(eventName, data, (error: any, response: any) => {
        if (error && attempts < retries) {
          attempts++;
          setTimeout(attemptEmit, 1000 * attempts);
        } else if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    };

    attemptEmit();
    setTimeout(() => reject(new Error('Event emission timeout')), timeout);
  });
};

/**
 * Initializes heartbeat mechanism for connection monitoring
 */
const startHeartbeat = (socket: Socket, interval: number): void => {
  const heartbeat = setInterval(() => {
    if (socket.connected) {
      socket.emit(WS_EVENTS.PING);
    } else {
      clearInterval(heartbeat);
    }
  }, interval);

  socket.on(WS_EVENTS.DISCONNECT, () => {
    clearInterval(heartbeat);
  });
};