import React, { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form'; // ^7.45.0
import { Snackbar, CircularProgress } from '@mui/material'; // ^5.0.0
import Input from '../common/Input';
import Button from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { validateEmail, validatePassword } from '../../utils/validation.utils';
import { ComponentSize } from '../../types/common.types';

// Registration form data interface with validation rules
interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

// Props interface for the registration form component
interface RegisterFormProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  isLoading?: boolean;
  onStepChange?: (step: number) => void;
}

// Password strength levels
enum PasswordStrength {
  WEAK = 'weak',
  MEDIUM = 'medium',
  STRONG = 'strong'
}

/**
 * Enhanced registration form component with comprehensive security features,
 * Material Design implementation, and accessibility support.
 */
const RegisterForm: React.FC<RegisterFormProps> = React.memo(({
  onSuccess,
  onError,
  isLoading = false,
  onStepChange
}) => {
  // Form state management with validation
  const { register: registerUser, checkEmailAvailability } = useAuth();
  const { register, handleSubmit: handleFormSubmit, formState: { errors }, watch, setError } = useForm<RegisterFormData>();
  const [currentStep, setCurrentStep] = useState(1);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', isError: false });
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>(PasswordStrength.WEAK);

  // Watch password field for strength validation
  const watchPassword = watch('password', '');

  /**
   * Debounced email availability check
   */
  const checkEmail = useCallback(async (email: string) => {
    try {
      const isAvailable = await checkEmailAvailability(email);
      if (!isAvailable) {
        setError('email', {
          type: 'manual',
          message: 'This email is already registered'
        });
      }
    } catch (error) {
      console.error('Email check error:', error);
    }
  }, [checkEmailAvailability, setError]);

  /**
   * Password strength validator with real-time feedback
   */
  useEffect(() => {
    if (!watchPassword) {
      setPasswordStrength(PasswordStrength.WEAK);
      return;
    }

    const result = validatePassword(watchPassword);
    const score = result.details?.strengthScore || 0;

    if (score >= 75) setPasswordStrength(PasswordStrength.STRONG);
    else if (score >= 50) setPasswordStrength(PasswordStrength.MEDIUM);
    else setPasswordStrength(PasswordStrength.WEAK);
  }, [watchPassword]);

  /**
   * Form submission handler with security measures
   */
  const handleSubmit = async (data: RegisterFormData) => {
    try {
      // Validate password match
      if (data.password !== data.confirmPassword) {
        setError('confirmPassword', {
          type: 'manual',
          message: 'Passwords do not match'
        });
        return;
      }

      // Generate device fingerprint for security
      const deviceFingerprint = await generateDeviceFingerprint();

      // Register user with enhanced security context
      await registerUser({
        ...data,
        deviceFingerprint,
        securityContext: {
          userAgent: navigator.userAgent,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language
        }
      });

      setSnackbar({
        open: true,
        message: 'Registration successful! Please verify your email.',
        isError: false
      });

      onSuccess?.();
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.message || 'Registration failed. Please try again.',
        isError: true
      });
      onError?.(error.message);
    }
  };

  /**
   * Generates device fingerprint for security tracking
   */
  const generateDeviceFingerprint = async (): Promise<string> => {
    const components = [
      navigator.userAgent,
      navigator.language,
      new Date().getTimezoneOffset(),
      screen.width,
      screen.height,
      navigator.hardwareConcurrency
    ];
    
    const fingerprint = components.join('|');
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprint);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  return (
    <form onSubmit={handleFormSubmit(handleSubmit)} noValidate>
      {currentStep === 1 && (
        <>
          <Input
            {...register('email', {
              required: 'Email is required',
              validate: {
                format: (value) => validateEmail(value) || 'Invalid email format',
                availability: async (value) => {
                  await checkEmail(value);
                  return true;
                }
              }
            })}
            type="email"
            label="Email"
            error={errors.email?.message}
            autoComplete="email"
            data-testid="register-email-input"
            aria-label="Email address"
          />

          <Input
            {...register('password', {
              required: 'Password is required',
              validate: {
                strength: (value) => {
                  const result = validatePassword(value);
                  return !result.hasError || result.message;
                }
              }
            })}
            type="password"
            label="Password"
            error={errors.password?.message}
            helperText={`Password strength: ${passwordStrength}`}
            autoComplete="new-password"
            data-testid="register-password-input"
            aria-label="Password"
          />

          <Input
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (value) => value === watchPassword || 'Passwords do not match'
            })}
            type="password"
            label="Confirm Password"
            error={errors.confirmPassword?.message}
            autoComplete="new-password"
            data-testid="register-confirm-password-input"
            aria-label="Confirm password"
          />

          <Button
            type="button"
            onClick={() => {
              setCurrentStep(2);
              onStepChange?.(2);
            }}
            disabled={!!errors.email || !!errors.password || !!errors.confirmPassword}
            size={ComponentSize.LARGE}
            fullWidth
            data-testid="register-next-button"
          >
            Next
          </Button>
        </>
      )}

      {currentStep === 2 && (
        <>
          <Input
            {...register('firstName', {
              required: 'First name is required',
              minLength: { value: 2, message: 'First name must be at least 2 characters' }
            })}
            type="text"
            label="First Name"
            error={errors.firstName?.message}
            autoComplete="given-name"
            data-testid="register-firstname-input"
            aria-label="First name"
          />

          <Input
            {...register('lastName', {
              required: 'Last name is required',
              minLength: { value: 2, message: 'Last name must be at least 2 characters' }
            })}
            type="text"
            label="Last Name"
            error={errors.lastName?.message}
            autoComplete="family-name"
            data-testid="register-lastname-input"
            aria-label="Last name"
          />

          <Button
            type="submit"
            disabled={isLoading || Object.keys(errors).length > 0}
            loading={isLoading}
            size={ComponentSize.LARGE}
            fullWidth
            data-testid="register-submit-button"
          >
            {isLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              'Create Account'
            )}
          </Button>

          <Button
            type="button"
            onClick={() => {
              setCurrentStep(1);
              onStepChange?.(1);
            }}
            variant="outline"
            size={ComponentSize.LARGE}
            fullWidth
            data-testid="register-back-button"
          >
            Back
          </Button>
        </>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
        ContentProps={{
          'aria-live': 'polite',
          role: 'alert',
          'data-testid': 'register-snackbar'
        }}
      />
    </form>
  );
});

RegisterForm.displayName = 'RegisterForm';

export default RegisterForm;