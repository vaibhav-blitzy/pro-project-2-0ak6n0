/**
 * @fileoverview Authentication API Client
 * Implements secure authentication operations with comprehensive security features
 * including MFA support, token management, and security monitoring.
 * @version 1.0.0
 */

import axios from 'axios'; // ^1.6.0
import jwtDecode from 'jwt-decode'; // ^4.0.0

import { apiConfig } from '../config/api.config';
import { AuthInterfaces } from '../interfaces/auth.interface';
import { ApiResponse, ApiError, ApiErrorCode } from '../types/api.types';
import { AUTH } from '../constants/api.constants';

// Security constants
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const MAX_LOGIN_ATTEMPTS = 3;
const MFA_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Enhanced authentication service with comprehensive security features
 */
export class AuthService {
  private client: typeof axios;
  private securityContext: AuthInterfaces.SecurityContext;
  private loginAttempts: number = 0;
  private lastLoginAttempt: number = 0;

  constructor() {
    this.client = apiConfig.client;
    this.securityContext = this.initializeSecurityContext();
  }

  /**
   * Initializes security context for request tracking
   */
  private initializeSecurityContext(): AuthInterfaces.SecurityContext {
    return {
      ipAddress: window.location.hostname,
      userAgent: navigator.userAgent,
      lastActivity: Date.now()
    };
  }

  /**
   * Authenticates user with enhanced security including MFA support
   */
  public async login(
    credentials: AuthInterfaces.LoginCredentials,
    mfaToken?: string
  ): Promise<ApiResponse<{
    user: AuthInterfaces.User;
    token: string;
    mfaRequired?: boolean;
  }>> {
    try {
      // Rate limiting check
      if (this.isRateLimited()) {
        throw new Error(AuthInterfaces.AuthErrorType.RATE_LIMITED);
      }

      // Prepare enhanced request payload
      const payload = {
        ...credentials,
        deviceId: this.generateDeviceId(),
        securityContext: this.securityContext,
        mfaToken
      };

      const response = await this.client.post<ApiResponse<any>>(
        AUTH.LOGIN,
        payload,
        {
          headers: {
            ...apiConfig.headers,
            'X-Device-ID': this.generateDeviceId()
          }
        }
      );

      // Handle successful login
      this.loginAttempts = 0;
      this.storeAuthToken(response.data.data.token);
      this.updateSecurityContext();

      return response.data;
    } catch (error) {
      this.handleLoginError(error as ApiError);
      throw error;
    }
  }

  /**
   * Securely refreshes authentication token
   */
  public async refreshToken(refreshToken: string): Promise<ApiResponse<{
    token: string;
    refreshToken: string;
  }>> {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        AUTH.REFRESH_TOKEN,
        { refreshToken },
        {
          headers: {
            ...apiConfig.headers,
            'X-Refresh-Token': refreshToken
          }
        }
      );

      this.storeAuthToken(response.data.data.token);
      return response.data;
    } catch (error) {
      this.handleTokenError(error as ApiError);
      throw error;
    }
  }

  /**
   * Validates current session status and security context
   */
  public async validateSession(): Promise<boolean> {
    try {
      const token = this.getStoredToken();
      if (!token) return false;

      const decodedToken = jwtDecode<{ exp: number }>(token);
      const isExpired = Date.now() >= decodedToken.exp * 1000;

      if (isExpired) {
        this.clearAuthData();
        return false;
      }

      // Check if token needs refresh
      if (this.shouldRefreshToken(decodedToken.exp)) {
        await this.refreshToken(this.getStoredRefreshToken() || '');
      }

      return true;
    } catch (error) {
      this.clearAuthData();
      return false;
    }
  }

  /**
   * Handles secure logout with token revocation
   */
  public async logout(): Promise<void> {
    try {
      await this.client.post(AUTH.LOGOUT);
      this.clearAuthData();
    } catch (error) {
      console.error('Logout error:', error);
      this.clearAuthData();
    }
  }

  /**
   * Generates secure device identifier
   */
  private generateDeviceId(): string {
    const userAgent = navigator.userAgent;
    const screenRes = `${window.screen.width}x${window.screen.height}`;
    const timestamp = Date.now();
    return btoa(`${userAgent}-${screenRes}-${timestamp}`);
  }

  /**
   * Checks for rate limiting based on login attempts
   */
  private isRateLimited(): boolean {
    const now = Date.now();
    if (now - this.lastLoginAttempt < 1000) {
      this.loginAttempts++;
    } else {
      this.loginAttempts = 1;
    }
    this.lastLoginAttempt = now;

    return this.loginAttempts > MAX_LOGIN_ATTEMPTS;
  }

  /**
   * Securely stores authentication token
   */
  private storeAuthToken(token: string): void {
    sessionStorage.setItem('auth_token', token);
    sessionStorage.setItem('token_timestamp', Date.now().toString());
  }

  /**
   * Retrieves stored authentication token
   */
  private getStoredToken(): string | null {
    return sessionStorage.getItem('auth_token');
  }

  /**
   * Retrieves stored refresh token
   */
  private getStoredRefreshToken(): string | null {
    return sessionStorage.getItem('refresh_token');
  }

  /**
   * Updates security context with latest activity
   */
  private updateSecurityContext(): void {
    this.securityContext.lastActivity = Date.now();
  }

  /**
   * Clears all authentication data securely
   */
  private clearAuthData(): void {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('token_timestamp');
  }

  /**
   * Checks if token should be refreshed
   */
  private shouldRefreshToken(expiration: number): boolean {
    const expirationTime = expiration * 1000;
    return Date.now() >= expirationTime - TOKEN_REFRESH_THRESHOLD;
  }

  /**
   * Handles login-related errors with security logging
   */
  private handleLoginError(error: ApiError): void {
    this.loginAttempts++;
    console.error('Login error:', {
      type: error.code,
      attempts: this.loginAttempts,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handles token-related errors
   */
  private handleTokenError(error: ApiError): void {
    if (error.code === ApiErrorCode.UNAUTHORIZED) {
      this.clearAuthData();
    }
    console.error('Token error:', error);
  }
}

export default new AuthService();