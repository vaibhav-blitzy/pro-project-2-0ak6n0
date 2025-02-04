import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@chakra-ui/react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

import ResetPasswordForm from '../../components/auth/ResetPasswordForm';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { ComponentSize } from '../../types/common.types';

/**
 * Enhanced password reset page component with comprehensive security features
 * Implements OWASP security guidelines and WCAG 2.1 accessibility standards
 */
const ResetPassword: React.FC = React.memo(() => {
  // Hooks initialization
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { resetPassword, validateResetToken } = useAuth();

  // Component state
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');

  /**
   * Initializes device fingerprinting for security tracking
   */
  const initializeFingerprinting = useCallback(async () => {
    try {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      setDeviceFingerprint(result.visitorId);
    } catch (error) {
      console.error('Fingerprinting error:', error);
      // Continue without fingerprinting rather than blocking the flow
    }
  }, []);

  /**
   * Validates reset token with rate limiting and security checks
   */
  const validateToken = useCallback(async () => {
    if (!token) {
      handleResetError('Invalid password reset link');
      return;
    }

    try {
      setIsValidating(true);
      const isValid = await validateResetToken(token, deviceFingerprint);
      setIsTokenValid(isValid);

      if (!isValid) {
        handleResetError('Password reset link is invalid or has expired');
      }
    } catch (error: any) {
      handleResetError(error.message || 'Error validating reset token');
    } finally {
      setIsValidating(false);
    }
  }, [token, deviceFingerprint, validateResetToken]);

  /**
   * Handles successful password reset with security logging
   */
  const handleResetSuccess = useCallback(() => {
    // Log security event
    console.info('Password reset successful', {
      timestamp: new Date().toISOString(),
      deviceFingerprint,
      userAgent: navigator.userAgent
    });

    toast({
      title: 'Password Reset Successful',
      description: 'You can now log in with your new password',
      status: 'success',
      duration: 5000,
      isClosable: true,
      position: 'top'
    });

    // Clear sensitive data from memory
    setDeviceFingerprint('');
    
    // Redirect to login
    navigate('/auth/login', { replace: true });
  }, [navigate, toast, deviceFingerprint]);

  /**
   * Enhanced error handler with security logging
   */
  const handleResetError = useCallback((error: string) => {
    // Log security event
    console.error('Password reset error', {
      error,
      timestamp: new Date().toISOString(),
      deviceFingerprint,
      userAgent: navigator.userAgent
    });

    toast({
      title: 'Password Reset Error',
      description: error,
      status: 'error',
      duration: 5000,
      isClosable: true,
      position: 'top'
    });

    // Redirect to forgot password page on critical errors
    if (error.includes('invalid') || error.includes('expired')) {
      navigate('/auth/forgot-password', { replace: true });
    }
  }, [navigate, toast, deviceFingerprint]);

  // Initialize security features on mount
  useEffect(() => {
    initializeFingerprinting();
  }, [initializeFingerprinting]);

  // Validate token when fingerprint is ready
  useEffect(() => {
    if (deviceFingerprint) {
      validateToken();
    }
  }, [deviceFingerprint, validateToken]);

  // Show loading state during validation
  if (isValidating) {
    return (
      <div className="reset-password-loading" aria-live="polite">
        <LoadingSpinner
          size={ComponentSize.LARGE}
          ariaLabel="Validating reset token..."
        />
        <p>Validating your reset link...</p>
      </div>
    );
  }

  // Show error state for invalid token
  if (!isTokenValid) {
    return (
      <div className="reset-password-error" role="alert">
        <h1>Invalid Reset Link</h1>
        <p>The password reset link is invalid or has expired.</p>
        <p>Please request a new password reset link.</p>
      </div>
    );
  }

  // Render reset password form
  return (
    <div className="reset-password-container">
      <h1>Reset Your Password</h1>
      <ResetPasswordForm
        token={token!}
        onSuccess={handleResetSuccess}
        onError={handleResetError}
        enablePasswordBreachCheck={true}
        maxAttempts={3}
      />
    </div>
  );
});

ResetPassword.displayName = 'ResetPassword';

export default ResetPassword;