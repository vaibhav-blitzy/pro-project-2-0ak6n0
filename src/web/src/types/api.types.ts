import { BaseEntity } from './common.types';
import { AxiosResponse, AxiosError } from 'axios'; // ^1.6.0

/**
 * Generic interface for all API responses with enhanced error handling
 * Includes performance monitoring and request tracking
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
  timestamp: string;
  requestId: string;
  responseTime: number;
}

/**
 * Enhanced interface for API error responses with detailed error information
 * Supports comprehensive error tracking and debugging
 */
export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details: object | null;
  requestId: string;
  validationErrors: string[];
  stackTrace: string;
}

/**
 * Interface for paginated API responses with enhanced metadata
 * Supports efficient data pagination and navigation
 */
export interface PaginatedResponse<T> {
  items: Array<T>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Interface for required security headers in API requests
 * Implements enterprise-grade security requirements
 */
export interface ApiSecurityHeaders {
  Authorization: string;
  'X-API-Key': string;
  'X-Request-ID': string;
  'X-Rate-Limit-Remaining': string;
  'Content-Security-Policy': string;
}

/**
 * Type for supported HTTP methods with strict validation
 * Ensures type safety for API operations
 */
export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Type for HTTP request headers with security requirements
 * Combines security headers with custom headers
 */
export type ApiHeaders = ApiSecurityHeaders & Record<string, string>;

/**
 * Type for URL query parameters with enhanced validation
 * Supports complex query parameter structures
 */
export type ApiQueryParams = Record<string, string | number | boolean | Array<string | number>>;

/**
 * Enhanced enumeration of standard API error codes with security focus
 * Provides comprehensive error categorization
 */
export enum ApiErrorCode {
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  SECURITY_ERROR = 'SECURITY_ERROR',
  DATA_INTEGRITY_ERROR = 'DATA_INTEGRITY_ERROR'
}

/**
 * Enumeration of supported content types with security validation
 * Ensures proper content type handling
 */
export enum ApiContentType {
  APPLICATION_JSON = 'application/json',
  MULTIPART_FORM_DATA = 'multipart/form-data',
  TEXT_PLAIN = 'text/plain',
  APPLICATION_XML = 'application/xml',
  APPLICATION_JSON_SIGNED = 'application/json+signed'
}

/**
 * Type for API response with enhanced error handling
 * Extends Axios response type with custom error handling
 */
export type ApiResponseWithError<T> = AxiosResponse<ApiResponse<T>> | AxiosError<ApiError>;

/**
 * Type guard to check if response contains an error
 * Provides type safety for error handling
 */
export function isApiError(response: ApiResponseWithError<unknown>): response is AxiosError<ApiError> {
  return (response as AxiosError).isAxiosError === true;
}

/**
 * Type for entity creation requests
 * Omits auto-generated fields from BaseEntity
 */
export type CreateEntityRequest<T extends BaseEntity> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Type for entity update requests
 * Omits timestamp fields from BaseEntity
 */
export type UpdateEntityRequest<T extends BaseEntity> = Omit<T, 'createdAt' | 'updatedAt'>;

/**
 * Type for API request options
 * Provides configuration options for API requests
 */
export interface ApiRequestOptions {
  headers?: ApiHeaders;
  params?: ApiQueryParams;
  timeout?: number;
  withCredentials?: boolean;
  responseType?: 'json' | 'blob' | 'text';
  signal?: AbortSignal;
}