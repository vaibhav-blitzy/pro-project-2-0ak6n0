/**
 * @fileoverview Enhanced WebSocket test client utility providing comprehensive testing capabilities
 * for real-time communication features with security validation and performance monitoring.
 * @version 1.0.0
 */

import { io, Socket } from 'socket.io-client'; // ^4.7.2
import { IWebSocketNotification } from '../../backend/notification-service/src/interfaces/notification.interface';
import { waitForAsyncOperation } from './test-helpers';

// Global configuration constants
const DEFAULT_TIMEOUT = 5000;
const DEFAULT_WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'ws://localhost:3002';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

/**
 * Interface for WebSocket security options
 */
interface SecurityOptions {
  validateTokens: boolean;
  validateHeaders: boolean;
  encryptPayload: boolean;
}

/**
 * Interface for WebSocket connection options
 */
interface ConnectionOptions {
  timeout?: number;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  transports?: string[];
}

/**
 * Interface for room subscription options
 */
interface RoomOptions {
  validateAccess?: boolean;
  timeout?: number;
}

/**
 * Interface for notification validation options
 */
interface ValidationOptions {
  validateSchema?: boolean;
  validatePayload?: boolean;
  validateTiming?: boolean;
}

/**
 * Interface for latency measurement options
 */
interface LatencyOptions {
  sampleSize?: number;
  includeJitter?: boolean;
  timeout?: number;
}

/**
 * Interface for latency metrics
 */
interface LatencyMetrics {
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  jitter?: number;
  packetLoss?: number;
}

/**
 * Security validator for WebSocket connections
 */
class SecurityValidator {
  constructor(private options: SecurityOptions) {}

  validateToken(token: string): boolean {
    if (!token || token.length < 32) {
      throw new Error('Invalid authentication token');
    }
    return true;
  }

  validateHeaders(headers: Record<string, string>): boolean {
    const requiredHeaders = ['Authorization', 'X-Request-ID'];
    const missingHeaders = requiredHeaders.filter(header => !headers[header]);
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }
    return true;
  }

  encryptPayload(payload: any): string {
    // Implement payload encryption if required
    return JSON.stringify(payload);
  }
}

/**
 * Enhanced WebSocket test client for comprehensive testing of real-time features
 */
export class WebSocketTestClient {
  private socket: Socket | null = null;
  private readonly url: string;
  private readonly eventHandlers: Map<string, Function>;
  private isConnected: boolean = false;
  private readonly latencyMetrics: Map<string, number>;
  private readonly activeRooms: Map<string, string>;
  private readonly securityValidator: SecurityValidator;

  /**
   * Creates a new WebSocket test client instance
   * @param url - WebSocket server URL
   * @param securityOptions - Security validation options
   */
  constructor(url?: string, securityOptions?: SecurityOptions) {
    this.url = url || DEFAULT_WEBSOCKET_URL;
    this.eventHandlers = new Map();
    this.latencyMetrics = new Map();
    this.activeRooms = new Map();
    this.securityValidator = new SecurityValidator(securityOptions || {
      validateTokens: true,
      validateHeaders: true,
      encryptPayload: false
    });
  }

  /**
   * Establishes secure WebSocket connection with retry mechanism
   * @param authToken - Authentication token
   * @param options - Connection options
   */
  public async connect(authToken: string, options: ConnectionOptions = {}): Promise<void> {
    try {
      this.securityValidator.validateToken(authToken);

      const connectionOptions = {
        timeout: options.timeout || DEFAULT_TIMEOUT,
        reconnection: options.reconnection !== false,
        reconnectionAttempts: options.reconnectionAttempts || MAX_RETRY_ATTEMPTS,
        reconnectionDelay: options.reconnectionDelay || RETRY_DELAY,
        transports: options.transports || ['websocket'],
        auth: {
          token: authToken
        },
        extraHeaders: {
          'X-Request-ID': `test-${Date.now()}`
        }
      };

      this.socket = io(this.url, connectionOptions);

      await waitForAsyncOperation(
        () => new Promise((resolve, reject) => {
          this.socket!.on('connect', () => {
            this.isConnected = true;
            resolve(void 0);
          });

          this.socket!.on('connect_error', (error) => {
            reject(new Error(`Connection failed: ${error.message}`));
          });
        }),
        options.timeout || DEFAULT_TIMEOUT
      );
    } catch (error) {
      throw new Error(`WebSocket connection failed: ${(error as Error).message}`);
    }
  }

  /**
   * Safely closes the WebSocket connection with cleanup
   */
  public async disconnect(): Promise<void> {
    if (this.socket) {
      this.eventHandlers.forEach((_, event) => {
        this.socket!.off(event);
      });

      this.socket.close();
      this.socket = null;
      this.isConnected = false;
      this.eventHandlers.clear();
      this.activeRooms.clear();
    }
  }

  /**
   * Securely joins a notification room with validation
   * @param roomId - Room identifier
   * @param options - Room subscription options
   */
  public async joinRoom(roomId: string, options: RoomOptions = {}): Promise<void> {
    if (!this.isConnected || !this.socket) {
      throw new Error('WebSocket not connected');
    }

    try {
      await waitForAsyncOperation(
        () => new Promise((resolve, reject) => {
          this.socket!.emit('join', { room: roomId }, (response: any) => {
            if (response.error) {
              reject(new Error(response.error));
            } else {
              this.activeRooms.set(roomId, Date.now().toString());
              resolve(void 0);
            }
          });
        }),
        options.timeout || DEFAULT_TIMEOUT
      );
    } catch (error) {
      throw new Error(`Failed to join room: ${(error as Error).message}`);
    }
  }

  /**
   * Waits for a specific notification event with validation
   * @param eventType - Type of event to wait for
   * @param timeout - Wait timeout
   * @param validationOptions - Validation options
   */
  public async waitForNotification(
    eventType: string,
    timeout: number = DEFAULT_TIMEOUT,
    validationOptions: ValidationOptions = {}
  ): Promise<IWebSocketNotification> {
    if (!this.isConnected || !this.socket) {
      throw new Error('WebSocket not connected');
    }

    const { result } = await waitForAsyncOperation<IWebSocketNotification>(
      () => new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.socket!.off(eventType);
          reject(new Error(`Timeout waiting for event: ${eventType}`));
        }, timeout);

        this.socket!.on(eventType, (notification: IWebSocketNotification) => {
          clearTimeout(timer);
          if (validationOptions.validateSchema) {
            // Validate notification schema
            if (!notification.event || !notification.room) {
              reject(new Error('Invalid notification schema'));
              return;
            }
          }
          resolve(notification);
        });
      }),
      timeout
    );

    return result;
  }

  /**
   * Measures WebSocket connection latency and performance metrics
   * @param eventType - Event type for measurement
   * @param options - Latency measurement options
   */
  public async measureLatency(
    eventType: string,
    options: LatencyOptions = {}
  ): Promise<LatencyMetrics> {
    const sampleSize = options.sampleSize || 10;
    const latencies: number[] = [];

    for (let i = 0; i < sampleSize; i++) {
      const startTime = Date.now();
      await this.waitForNotification(eventType, options.timeout || DEFAULT_TIMEOUT);
      latencies.push(Date.now() - startTime);
    }

    const metrics: LatencyMetrics = {
      averageLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      minLatency: Math.min(...latencies),
      maxLatency: Math.max(...latencies)
    };

    if (options.includeJitter) {
      const jitterValues = latencies.map((latency, index) => 
        index > 0 ? Math.abs(latency - latencies[index - 1]) : 0
      );
      metrics.jitter = jitterValues.reduce((a, b) => a + b, 0) / (jitterValues.length - 1);
    }

    return metrics;
  }
}