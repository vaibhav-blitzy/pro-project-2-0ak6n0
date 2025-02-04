/**
 * @fileoverview Core TypeScript interfaces defining standardized data structures
 * and common types used across backend microservices. Implements enterprise-grade
 * patterns for API responses, error handling, pagination, and audit tracking.
 */

import {
  HTTP_STATUS,
  ERROR_CODES,
  SORT_ORDER
} from '../constants/index';

/**
 * Standard API response interface with enhanced tracking and monitoring capabilities.
 * Ensures consistent response format across all microservices.
 * @template T - Type of the response data payload
 */
export interface IBaseResponse<T = unknown> {
  /** Indicates if the operation was successful */
  success: boolean;
  /** Human-readable message describing the response */
  message: string;
  /** Generic data payload */
  data: T;
  /** HTTP status code from HTTP_STATUS enum */
  statusCode: HTTP_STATUS;
  /** Unique identifier for request tracing */
  correlationId: string;
}

/**
 * Enhanced error response interface with detailed error tracking
 * and security-conscious stack trace handling.
 */
export interface IErrorResponse {
  /** Always false for error responses */
  success: boolean;
  /** Error description message */
  message: string;
  /** Standardized error code for error classification */
  errorCode: ERROR_CODES;
  /** Detailed error information */
  details: IErrorDetails;
  /** HTTP status code from HTTP_STATUS enum */
  statusCode: HTTP_STATUS;
  /** Unique identifier for error tracing */
  correlationId: string;
  /** Stack trace (only included in development) */
  stackTrace?: string;
}

/**
 * Structured error details interface for validation errors
 * providing field-level error information.
 */
export interface IErrorDetails {
  /** Name of the field that failed validation */
  field: string;
  /** Value that caused the validation error */
  value: unknown;
  /** Description of the validation constraint that failed */
  constraint: string;
}

/**
 * Enhanced pagination parameters interface supporting both
 * offset and cursor-based pagination strategies.
 */
export interface IPaginationParams {
  /** Page number for offset pagination */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Field to sort by */
  sortBy: string;
  /** Sort direction (asc/desc) */
  sortOrder: SORT_ORDER;
  /** Cursor for cursor-based pagination */
  cursor?: string;
}

/**
 * Comprehensive auditable entity interface implementing
 * enterprise-grade audit tracking with soft delete support.
 */
export interface IAuditableEntity {
  /** Timestamp of entity creation */
  createdAt: Date;
  /** Timestamp of last update */
  updatedAt: Date;
  /** ID of user who created the entity */
  createdBy: string;
  /** ID of user who last updated the entity */
  updatedBy: string;
  /** Entity version for optimistic locking */
  version: number;
  /** Soft delete timestamp */
  deletedAt: Date | null;
  /** ID of user who deleted the entity */
  deletedBy: string | null;
}