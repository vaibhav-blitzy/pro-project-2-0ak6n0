/**
 * @fileoverview Core TypeScript interfaces defining authentication and authorization related data structures.
 * Implements enterprise-grade security features, user types, and authentication flows compliant with
 * PCI DSS, GDPR, and SOC 2 standards.
 */

import { IAuditableEntity } from '../../../shared/interfaces/base.interface';

/**
 * Enumeration of user roles for role-based access control
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  MEMBER = 'MEMBER'
}

/**
 * Interface for security questions used in account recovery
 * and enhanced authentication flows
 */
export interface ISecurityQuestion {
  /** The security question text */
  question: string;
  /** Hashed answer to the security question */
  answer: string;
  /** Timestamp of last security question update */
  lastUpdated: Date;
}

/**
 * Enhanced user interface with comprehensive security features
 * Extends IAuditableEntity for audit trail compliance
 */
export interface IUser extends IAuditableEntity {
  /** User's email address (unique identifier) */
  email: string;
  /** Hashed password using industry-standard algorithm */
  password: string;
  /** User's first name */
  firstName: string;
  /** User's last name */
  lastName: string;
  /** User's assigned role for RBAC */
  role: UserRole;
  /** Flag indicating if MFA is enabled */
  mfaEnabled: boolean;
  /** Encrypted MFA secret key */
  mfaSecret: string;
  /** Timestamp of last successful login */
  lastLogin: Date;
  /** Timestamp of last password change */
  passwordLastChanged: Date;
  /** Counter for failed login attempts */
  failedLoginAttempts: number;
  /** Flag indicating if account is locked */
  accountLocked: boolean;
  /** Array of previous password hashes */
  passwordHistory: string[];
  /** Array of security questions for account recovery */
  securityQuestions: ISecurityQuestion[];
  /** Session timeout in minutes */
  sessionTimeout: number;
}

/**
 * Interface for authentication requests supporting
 * multiple authentication methods including MFA
 */
export interface IAuthRequest {
  /** User's email address */
  email: string;
  /** User's password */
  password: string;
  /** Optional MFA verification code */
  mfaCode?: string;
}

/**
 * Interface for authentication tokens response
 * implementing secure token management
 */
export interface IAuthTokens {
  /** JWT access token */
  accessToken: string;
  /** JWT refresh token for token rotation */
  refreshToken: string;
  /** Token expiration time in seconds */
  expiresIn: number;
}

/**
 * Interface for MFA setup response containing
 * necessary data for TOTP configuration
 */
export interface IMFASetupResponse {
  /** Base32 encoded MFA secret */
  secret: string;
  /** QR code URL for TOTP app configuration */
  qrCodeUrl: string;
}