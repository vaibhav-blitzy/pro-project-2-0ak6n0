/**
 * @fileoverview Custom React hook for managing secure WebSocket connections
 * Provides real-time communication with comprehensive error handling and state management
 * @version 1.0.0
 */

import { useEffect, useCallback, useState } from 'react'; // ^18.0.0
import { Socket } from 'socket.io-client'; // ^4.7.2
import { wsConfig, WS_EVENTS } from '../config/websocket.config';
import { createWebSocketConnection, disconnectWebSocket } from '../api/websocket.api';

/**
 * Interface defining the comprehensive WebSocket connection state
 */
interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  retryCount: number;
  isReconnecting: boolean;
  lastConnected: Date | null;
}

/**
 * Interface for WebSocket connection options
 */
interface ConnectionOptions {
  autoReconnect?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  heartbeatEnabled?: boolean;
}

/**
 * Interface defining the return value of the useWebSocket hook
 */
interface UseWebSocketReturn {
  socket: Socket | null;
  state: WebSocketState;
  connect: (options?: ConnectionOptions) => Promise<void>;
  disconnect: () => Promise<void>;
  isAuthenticated: boolean;
  subscribe: (event: string, callback: Function) => void;
  unsubscribe: (event: string) => void;
}

/**
 * Custom hook for managing secure WebSocket connections with comprehensive state management
 * @param authToken - Authentication token for secure connection
 * @param options - Optional connection configuration
 * @returns WebSocket interface with connection state and control functions
 */
export const useWebSocket = (
  authToken: string,
  options: ConnectionOptions = {}
): UseWebSocketReturn => {
  // Initialize socket and connection state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    retryCount: 0,
    isReconnecting: false,
    lastConnected: null
  });

  /**
   * Memoized connect function with retry logic
   */
  const connect = useCallback(async (connectionOptions: ConnectionOptions = {}) => {
    if (state.isConnecting || state.isConnected) return;

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const newSocket = createWebSocketConnection(
        authToken,
        {
          onConnect: () => {
            setState(prev => ({
              ...prev,
              isConnected: true,
              isConnecting: false,
              error: null,
              lastConnected: new Date(),
              retryCount: 0
            }));
          },
          onDisconnect: (reason: string) => {
            setState(prev => ({
              ...prev,
              isConnected: false,
              error: reason,
              isReconnecting: options.autoReconnect || false
            }));
          },
          onError: (error) => {
            setState(prev => ({
              ...prev,
              error: error.message,
              isConnecting: false,
              retryCount: prev.retryCount + 1
            }));
          },
          onReconnectAttempt: (attempt: number) => {
            setState(prev => ({
              ...prev,
              isReconnecting: true,
              retryCount: attempt
            }));
          },
          onReconnectSuccess: () => {
            setState(prev => ({
              ...prev,
              isConnected: true,
              isReconnecting: false,
              error: null,
              lastConnected: new Date()
            }));
          },
          onReconnectFailed: () => {
            setState(prev => ({
              ...prev,
              isReconnecting: false,
              error: 'Maximum reconnection attempts reached'
            }));
          }
        },
        {
          maxRetries: connectionOptions.maxRetries || options.maxRetries || 5,
          retryDelay: connectionOptions.retryDelay || options.retryDelay || 3000,
          enableHeartbeat: connectionOptions.heartbeatEnabled || options.heartbeatEnabled || true,
          securityOptions: {
            enableSSL: true,
            validateCertificate: true,
            enableCompression: true
          }
        }
      );

      setSocket(newSocket);
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        retryCount: prev.retryCount + 1
      }));
    }
  }, [authToken, state.isConnecting, state.isConnected, options]);

  /**
   * Memoized disconnect function with cleanup
   */
  const disconnect = useCallback(async () => {
    if (!socket) return;

    try {
      await disconnectWebSocket(socket);
      setSocket(null);
      setState({
        isConnected: false,
        isConnecting: false,
        error: null,
        retryCount: 0,
        isReconnecting: false,
        lastConnected: null
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Disconnect failed'
      }));
    }
  }, [socket]);

  /**
   * Subscribe to WebSocket events
   */
  const subscribe = useCallback((event: string, callback: Function) => {
    if (!socket) return;
    socket.on(event, callback as any);
  }, [socket]);

  /**
   * Unsubscribe from WebSocket events
   */
  const unsubscribe = useCallback((event: string) => {
    if (!socket) return;
    socket.off(event);
  }, [socket]);

  /**
   * Cleanup effect for resource management
   */
  useEffect(() => {
    return () => {
      if (socket) {
        disconnectWebSocket(socket);
      }
    };
  }, [socket]);

  return {
    socket,
    state,
    connect,
    disconnect,
    isAuthenticated: Boolean(authToken && socket?.connected),
    subscribe,
    unsubscribe
  };
};