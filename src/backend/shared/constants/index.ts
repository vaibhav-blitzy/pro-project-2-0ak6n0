/**
 * @fileoverview Centralized constants file containing shared enums, configuration values,
 * and constants used across the backend microservices.
 */

/**
 * Standard HTTP status codes used for consistent API responses across services
 */
export enum HTTP_STATUS {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503
}

/**
 * Standardized error codes for consistent error handling and monitoring
 */
export enum ERROR_CODES {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN = 'INVALID_TOKEN'
}

/**
 * Sort order constants for consistent query parameter handling
 */
export enum SORT_ORDER {
  ASC = 'asc',
  DESC = 'desc'
}

/**
 * Pagination configuration constants
 */
export const PAGINATION = {
  DEFAULT_SIZE: 10,
  MAX_SIZE: 100,
  MIN_PAGE: 1
} as const;

/**
 * API rate limiting configuration
 */
export const API_LIMITS = {
  RATE_LIMIT: 1000,
  WINDOW: '1h',
  BURST: 50
} as const;

/**
 * Cache configuration constants
 */
export const CACHE_CONFIG = {
  DEFAULT_TTL: 3600,    // 1 hour in seconds
  MAX_TTL: 86400,       // 24 hours in seconds
  STALE_TTL: 300        // 5 minutes in seconds
} as const;

/**
 * Token expiration configuration
 */
export const TOKEN_EXPIRY = {
  ACCESS: '1h',
  REFRESH: '7d',
  RESET: '15m'
} as const;

/**
 * Audit event types for system logging
 */
export enum AUDIT_EVENTS {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  PASSWORD_RESET = 'password_reset',
  PERMISSION_CHANGE = 'permission_change'
}

/**
 * Validation rules for input validation across services
 */
export const VALIDATION_RULES = {
  MIN_PASSWORD_LENGTH: 12,
  MAX_TITLE_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 2000,
  MAX_FILE_SIZE: 10485760  // 10MB in bytes
} as const;

/**
 * Database configuration constants
 */
export const DATABASE_CONFIG = {
  MAX_CONNECTIONS: 100,
  IDLE_TIMEOUT: '5m',
  CONNECTION_TIMEOUT: '3s'
} as const;

// Type definitions for better type safety
export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
export type SortOrder = typeof SORT_ORDER[keyof typeof SORT_ORDER];
export type AuditEvent = typeof AUDIT_EVENTS[keyof typeof AUDIT_EVENTS];

// Ensure objects are readonly at compile time
export type PaginationConfig = Readonly<typeof PAGINATION>;
export type ApiLimits = Readonly<typeof API_LIMITS>;
export type CacheConfig = Readonly<typeof CACHE_CONFIG>;
export type TokenExpiry = Readonly<typeof TOKEN_EXPIRY>;
export type ValidationRules = Readonly<typeof VALIDATION_RULES>;
export type DatabaseConfig = Readonly<typeof DATABASE_CONFIG>;