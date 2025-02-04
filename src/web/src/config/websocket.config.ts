/**
 * @fileoverview WebSocket Configuration
 * Enterprise-grade WebSocket client configuration for real-time communication
 * with comprehensive security, error handling, and performance optimizations.
 * @version 1.0.0
 */

import { ManagerOptions } from 'socket.io-client'; // ^4.7.2
import { API_ENDPOINTS } from '../constants/api.constants';
import { ErrorState } from '../interfaces/common.interface';

/**
 * Comprehensive WebSocket event types for all communication scenarios
 */
export enum WS_EVENTS {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  TASK_UPDATE = 'task:update',
  PROJECT_UPDATE = 'project:update',
  NOTIFICATION = 'notification',
  RECONNECT_ATTEMPT = 'reconnect_attempt',
  RECONNECT = 'reconnect',
  RECONNECT_ERROR = 'reconnect_error',
  CONNECTION_ERROR = 'connect_error',
  PING = 'ping',
  PONG = 'pong',
  AUTH_ERROR = 'auth_error',
  RATE_LIMIT = 'rate_limit'
}

/**
 * Interface defining comprehensive WebSocket configuration
 * with security and performance features
 */
export interface WebSocketConfig {
  url: string;
  options: ManagerOptions;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  timeout: number;
  secure: boolean;
  auth: {
    token?: string;
    userId?: string;
  };
  headers: Record<string, string>;
  pingInterval: number;
  pingTimeout: number;
  maxPayload: number;
}

/**
 * Generates a unique client identifier for WebSocket connections
 * @returns {string} UUID v4 string
 */
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Production-ready WebSocket configuration with security
 * and performance optimizations
 */
export const DEFAULT_WS_CONFIG: WebSocketConfig = {
  url: process.env.VITE_WS_URL || `wss://${window.location.hostname}:3000${API_ENDPOINTS.NOTIFICATIONS.WEBSOCKET}`,
  options: {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 3000,
    timeout: 10000,
    transports: ['websocket'],
    path: '/ws',
    secure: true,
    rejectUnauthorized: true,
    pingInterval: 25000,
    pingTimeout: 5000,
    maxPayload: 1000000,
    parser: 'JSON',
    upgrade: true,
    rememberUpgrade: true,
    perMessageDeflate: true,
    extraHeaders: {
      'X-Client-Version': process.env.VITE_APP_VERSION || '1.0.0',
      'X-Client-ID': generateUUID(),
      'X-Request-ID': generateUUID()
    }
  },
  reconnectionAttempts: 5,
  reconnectionDelay: 3000,
  timeout: 10000,
  secure: true,
  auth: {},
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Client-Type': 'web'
  },
  pingInterval: 25000,
  pingTimeout: 5000,
  maxPayload: 1000000
};

/**
 * Factory function to create a WebSocket configuration with custom options
 * @param {Partial<WebSocketConfig>} customConfig - Custom configuration options
 * @returns {WebSocketConfig} Merged configuration
 */
export const createWebSocketConfig = (
  customConfig: Partial<WebSocketConfig>
): WebSocketConfig => {
  return {
    ...DEFAULT_WS_CONFIG,
    ...customConfig,
    options: {
      ...DEFAULT_WS_CONFIG.options,
      ...customConfig.options
    },
    headers: {
      ...DEFAULT_WS_CONFIG.headers,
      ...customConfig.headers
    }
  };
};

/**
 * Error handler factory for WebSocket error states
 * @param {string} context - Error context for identification
 * @returns {(error: any) => ErrorState} Error handler function
 */
export const createWebSocketErrorHandler = (
  context: string
) => (error: any): ErrorState => {
  return {
    hasError: true,
    message: error.message || 'WebSocket connection error',
    code: error.code || 'WS_ERROR',
    stackTrace: error.stack,
    timestamp: new Date(),
    errorId: generateUUID(),
    details: {
      context,
      type: error.type,
      data: error.data
    }
  };
};

/**
 * Default WebSocket configuration instance
 */
export const wsConfig = createWebSocketConfig({
  url: process.env.VITE_WS_URL || `wss://${window.location.hostname}:3000${API_ENDPOINTS.NOTIFICATIONS.WEBSOCKET}`
});