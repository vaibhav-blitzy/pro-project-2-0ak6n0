import React, { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form'; // ^7.45.0
import debounce from 'lodash/debounce'; // ^4.17.21
import Input from '../common/Input';
import Button from '../common/Button';
import { validatePassword } from '../../utils/validation.utils';
import { useAuth } from '../../hooks/useAuth';
import { ComponentSize } from '../../types/common.types';
import { ErrorState } from '../../interfaces/common.interface';

interface ResetPasswordFormProps {
  token: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  enablePasswordBreachCheck?: boolean;
  maxAttempts?: number;
}

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

/**
 * Enhanced password reset form component with comprehensive security features
 * Implements WCAG 2.1 Level AA compliance and Material Design 3.0
 */
const ResetPasswordForm: React.FC<ResetPasswordFormProps> = React.memo(({
  token,
  onSuccess,
  onError,
  enablePasswordBreachCheck = true,
  maxAttempts = 3
}) => {
  // Form state management
  const { register, handleSubmit, watch, formState: { errors }, setError } = useForm<ResetPasswordFormData>();
  const { resetPassword, checkPasswordBreached } = useAuth();
  
  // Component state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [validationState, setValidationState] = useState<ErrorState | null>(null);

  // Watch password field for validation
  const password = watch('password');

  /**
   * Debounced password validation with breach checking
   */
  const validatePasswordDebounced = useCallback(
    debounce(async (value: string) => {
      if (!value) return;

      try {
        // Validate password complexity
        const validationResult = validatePassword(value);
        
        // Check for password breaches if enabled
        if (enablePasswordBreachCheck && !validationResult.hasError) {
          const isBreached = await checkPasswordBreached(value);
          if (isBreached) {
            validationResult.hasError = true;
            validationResult.message = 'This password has been exposed in data breaches. Please choose a different password.';
          }
        }

        setValidationState(validationResult);
      } catch (error) {
        console.error('Password validation error:', error);
        setValidationState({
          hasError: true,
          message: 'Error validating password',
          code: 'VALIDATION_ERROR',
          timestamp: new Date(),
          errorId: crypto.randomUUID()
        });
      }
    }, 300),
    [enablePasswordBreachCheck, checkPasswordBreached]
  );

  // Validate password on change
  useEffect(() => {
    if (password) {
      validatePasswordDebounced(password);
    }
    return () => validatePasswordDebounced.cancel();
  }, [password, validatePasswordDebounced]);

  /**
   * Enhanced form submission handler with security measures
   */
  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      // Check attempt limit
      if (attemptCount >= maxAttempts) {
        onError('Maximum password reset attempts exceeded. Please try again later.');
        return;
      }

      setIsSubmitting(true);
      setAttemptCount(prev => prev + 1);

      // Validate passwords match
      if (data.password !== data.confirmPassword) {
        setError('confirmPassword', {
          type: 'manual',
          message: 'Passwords do not match'
        });
        return;
      }

      // Validate password security
      if (validationState?.hasError) {
        onError(validationState.message);
        return;
      }

      // Attempt password reset
      await resetPassword(token, data.password);
      onSuccess();
    } catch (error: any) {
      onError(error.message || 'Password reset failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit(onSubmit)}
      className="reset-password-form"
      aria-labelledby="reset-password-title"
      noValidate
    >
      <h2 id="reset-password-title" className="form-title">
        Reset Your Password
      </h2>

      <div className="form-group">
        <Input
          id="password"
          type={showPassword ? 'text' : 'password'}
          label="New Password"
          {...register('password', { required: true })}
          error={errors.password?.message || validationState?.message}
          helperText="Password must be at least 8 characters long with uppercase, lowercase, number, and special character"
          required
          autoComplete="new-password"
          aria-describedby="password-requirements"
        />
        <Button
          type="button"
          variant="ghost"
          size={ComponentSize.SMALL}
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? 'Hide' : 'Show'}
        </Button>
      </div>

      <div className="form-group">
        <Input
          id="confirmPassword"
          type="password"
          label="Confirm Password"
          {...register('confirmPassword', { required: true })}
          error={errors.confirmPassword?.message}
          required
          autoComplete="new-password"
        />
      </div>

      <div className="form-actions">
        <Button
          type="submit"
          disabled={isSubmitting || !!validationState?.hasError}
          loading={isSubmitting}
          fullWidth
          aria-busy={isSubmitting}
        >
          Reset Password
        </Button>
      </div>

      {attemptCount > 0 && (
        <p className="attempts-remaining" aria-live="polite">
          {maxAttempts - attemptCount} attempts remaining
        </p>
      )}
    </form>
  );
});

ResetPasswordForm.displayName = 'ResetPasswordForm';

export default ResetPasswordForm;