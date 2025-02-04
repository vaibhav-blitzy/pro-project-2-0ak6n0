import { BaseEntity } from '../types/common.types';
import { ApiResponse } from '../types/api.types';

/**
 * Enhanced interface representing an authenticated user with security features
 * Extends BaseEntity for consistent entity tracking
 */
export interface User extends BaseEntity {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions: string[];
  lastLoginAt: Timestamp;
  lastPasswordChangeAt: Timestamp;
  mfaEnabled: boolean;
  securityLevel: string;
  loginAttempts: number;
}

/**
 * Enhanced interface for authentication state management with security tracking
 * Provides comprehensive session and security context information
 */
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: AuthToken | null;
  refreshToken: RefreshToken | null;
  loading: boolean;
  error: AuthErrorType | null;
  mfaRequired: boolean;
  sessionExpiresIn: number;
  isSessionExpired: boolean;
  securityContext: SecurityContext;
}

/**
 * Branded type for authentication token with expiration
 * Ensures type safety for token handling
 */
export type AuthToken = {
  token: string;
  expiresAt: number;
  type: 'Bearer';
};

/**
 * Type for security context information
 * Tracks session security metadata
 */
export type SecurityContext = {
  ipAddress: string;
  userAgent: string;
  lastActivity: number;
};

/**
 * Enhanced enumeration of user roles with granular access levels
 * Supports role-based access control
 */
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  TEAM_LEAD = 'TEAM_LEAD',
  MEMBER = 'MEMBER',
  GUEST = 'GUEST'
}

/**
 * Comprehensive enumeration of authentication error types
 * Provides detailed error categorization for security events
 */
export enum AuthErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  MFA_REQUIRED = 'MFA_REQUIRED',
  PASSWORD_EXPIRED = 'PASSWORD_EXPIRED',
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
  IP_BLOCKED = 'IP_BLOCKED',
  RATE_LIMITED = 'RATE_LIMITED',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION'
}

/**
 * Type alias for timestamp values
 * Imported from common types for consistency
 */
type Timestamp = string | Date;

/**
 * Type for refresh token with additional security metadata
 * Extends base token type with refresh-specific properties
 */
export type RefreshToken = {
  token: string;
  expiresAt: number;
  issuedAt: number;
  deviceId: string;
};

/**
 * Type for authentication API responses
 * Extends generic API response with auth-specific data
 */
export type AuthApiResponse<T> = ApiResponse<T> & {
  securityContext: SecurityContext;
  tokenExpiration?: number;
};

/**
 * Interface for authentication request metadata
 * Tracks security-relevant request information
 */
export interface AuthRequestMetadata {
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: number;
  geoLocation?: string;
}

/**
 * Interface for MFA verification state
 * Manages multi-factor authentication flow
 */
export interface MFAState {
  required: boolean;
  verified: boolean;
  method: 'TOTP' | 'SMS' | 'EMAIL';
  attemptsRemaining: number;
  lastAttempt: number;
}