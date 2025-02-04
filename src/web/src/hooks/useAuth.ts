/**
 * @fileoverview Enhanced Authentication Hook
 * Custom React hook for managing authentication state and operations with comprehensive security features
 * including MFA support, session monitoring, and security controls.
 * @version 1.0.0
 */

import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { User, AuthState, AuthErrorType, SecurityContext } from '../interfaces/auth.interface';
import authApi from '../api/auth.api';

// Security constants
const SESSION_CHECK_INTERVAL = 60 * 1000; // 1 minute
const SECURITY_EVENT_TYPES = {
  LOGIN_ATTEMPT: 'LOGIN_ATTEMPT',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  MFA_REQUIRED: 'MFA_REQUIRED',
  MFA_SUCCESS: 'MFA_SUCCESS',
  MFA_FAILURE: 'MFA_FAILURE',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  TOKEN_REFRESH: 'TOKEN_REFRESH',
  SECURITY_VIOLATION: 'SECURITY_VIOLATION',
  LOGOUT: 'LOGOUT'
} as const;

/**
 * Enhanced authentication hook with comprehensive security features
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const authState = useSelector((state: { auth: AuthState }) => state.auth);

  /**
   * Logs security events for monitoring and auditing
   */
  const logSecurityEvent = useCallback((
    eventType: keyof typeof SECURITY_EVENT_TYPES,
    details: Record<string, unknown>
  ) => {
    const event = {
      type: eventType,
      timestamp: new Date().toISOString(),
      userId: authState.user?.id,
      sessionId: authState.sessionInfo?.id,
      ipAddress: authState.securityContext?.ipAddress,
      userAgent: authState.securityContext?.userAgent,
      ...details
    };
    console.info('Security Event:', event);
    // In production, send to security monitoring service
  }, [authState]);

  /**
   * Enhanced login function with security features
   */
  const login = useCallback(async (email: string, password: string) => {
    try {
      logSecurityEvent('LOGIN_ATTEMPT', { email });
      
      const response = await authApi.login({ email, password });
      
      if (response.data.mfaRequired) {
        dispatch({ type: 'auth/mfaRequired', payload: true });
        logSecurityEvent('MFA_REQUIRED', { email });
        return { mfaRequired: true };
      }

      dispatch({
        type: 'auth/loginSuccess',
        payload: {
          user: response.data.user,
          token: response.data.token,
          securityContext: response.data.securityContext
        }
      });

      logSecurityEvent('LOGIN_SUCCESS', { userId: response.data.user.id });
      initializeSessionMonitoring();
      
      return { success: true };
    } catch (error: any) {
      const errorDetails = {
        error: error.message,
        code: error.code,
        attempts: error.attempts
      };
      
      dispatch({ type: 'auth/loginFailure', payload: error });
      logSecurityEvent('LOGIN_FAILURE', errorDetails);
      
      throw error;
    }
  }, [dispatch, logSecurityEvent]);

  /**
   * Handles MFA validation
   */
  const validateMfa = useCallback(async (mfaToken: string) => {
    try {
      logSecurityEvent('MFA_REQUIRED', {});
      
      const response = await authApi.validateMfa(mfaToken);
      
      dispatch({
        type: 'auth/mfaSuccess',
        payload: {
          user: response.data.user,
          token: response.data.token,
          securityContext: response.data.securityContext
        }
      });

      logSecurityEvent('MFA_SUCCESS', { userId: response.data.user.id });
      initializeSessionMonitoring();
      
      return { success: true };
    } catch (error: any) {
      dispatch({ type: 'auth/mfaFailure', payload: error });
      logSecurityEvent('MFA_FAILURE', { error: error.message });
      throw error;
    }
  }, [dispatch, logSecurityEvent]);

  /**
   * Enhanced token refresh with security monitoring
   */
  const refreshTokens = useCallback(async () => {
    try {
      const response = await authApi.refreshToken();
      
      dispatch({
        type: 'auth/tokenRefreshed',
        payload: {
          token: response.data.token,
          refreshToken: response.data.refreshToken
        }
      });

      logSecurityEvent('TOKEN_REFRESH', { success: true });
      return true;
    } catch (error: any) {
      logSecurityEvent('TOKEN_REFRESH', { 
        error: error.message,
        success: false 
      });
      
      if (error.code === AuthErrorType.SESSION_EXPIRED) {
        handleSessionExpiration();
      }
      
      return false;
    }
  }, [dispatch, logSecurityEvent]);

  /**
   * Handles secure logout with cleanup
   */
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
      dispatch({ type: 'auth/logout' });
      logSecurityEvent('LOGOUT', { success: true });
      clearSessionMonitoring();
    } catch (error: any) {
      logSecurityEvent('LOGOUT', { 
        error: error.message,
        success: false 
      });
      // Force logout on error
      dispatch({ type: 'auth/logout' });
    }
  }, [dispatch, logSecurityEvent]);

  /**
   * Initializes session monitoring
   */
  const initializeSessionMonitoring = useCallback(() => {
    const intervalId = setInterval(async () => {
      const sessionValid = await authApi.validateSession();
      
      if (!sessionValid) {
        handleSessionExpiration();
      }
    }, SESSION_CHECK_INTERVAL);

    // Store interval ID for cleanup
    dispatch({ type: 'auth/setSessionMonitor', payload: intervalId });
  }, [dispatch]);

  /**
   * Handles session expiration
   */
  const handleSessionExpiration = useCallback(() => {
    logSecurityEvent('SESSION_EXPIRED', {});
    clearSessionMonitoring();
    dispatch({ type: 'auth/sessionExpired' });
  }, [dispatch, logSecurityEvent]);

  /**
   * Cleans up session monitoring
   */
  const clearSessionMonitoring = useCallback(() => {
    if (authState.sessionInfo?.monitorId) {
      clearInterval(authState.sessionInfo.monitorId);
      dispatch({ type: 'auth/clearSessionMonitor' });
    }
  }, [dispatch, authState.sessionInfo]);

  return {
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.loading,
    error: authState.error,
    mfaRequired: authState.mfaRequired,
    securityContext: authState.securityContext,
    login,
    validateMfa,
    refreshTokens,
    logout
  };
};

export default useAuth;