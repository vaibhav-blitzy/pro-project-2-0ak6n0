import React, { useState, useCallback, useEffect } from 'react'; // ^18.0.0
import { useForm } from 'react-hook-form'; // ^7.45.0
import * as yup from 'yup'; // ^1.3.0
import { Box, Typography, FormControlLabel, Checkbox } from '@mui/material'; // ^5.0.0
import { sanitizeInput } from '@security/utils'; // ^1.0.0

import Input from '../common/Input';
import Button from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { ComponentSize, ComponentVariant } from '../../types/common.types';
import { AuthErrorType } from '../../interfaces/auth.interface';

// Login form validation schema with security enhancements
const validationSchema = yup.object().shape({
  email: yup
    .string()
    .required('Email is required')
    .email('Invalid email format')
    .transform((value) => sanitizeInput(value))
    .max(255, 'Email is too long'),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    )
    .max(128, 'Password is too long'),
  rememberMe: yup.boolean()
});

interface LoginFormProps {
  className?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  enableMFA?: boolean;
  rememberMe?: boolean;
}

interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
  mfaToken?: string;
}

const LoginForm: React.FC<LoginFormProps> = React.memo(({
  className,
  onSuccess,
  onError,
  enableMFA = false,
  rememberMe = false
}) => {
  // Form state management
  const { register, handleSubmit, formState: { errors }, setError } = useForm<LoginCredentials>({
    mode: 'onBlur',
    resolver: yup.object().shape(validationSchema)
  });

  // Authentication state
  const { login, isAuthenticated, validateMfa } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isMFARequired, setIsMFARequired] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // Rate limiting check
  useEffect(() => {
    if (attemptCount >= 3) {
      setIsRateLimited(true);
      const timer = setTimeout(() => {
        setIsRateLimited(false);
        setAttemptCount(0);
      }, 300000); // 5 minutes lockout
      return () => clearTimeout(timer);
    }
  }, [attemptCount]);

  // Handle form submission with security measures
  const onSubmit = useCallback(async (data: LoginCredentials) => {
    if (isRateLimited) {
      onError?.('Too many login attempts. Please try again later.');
      return;
    }

    try {
      setIsLoading(true);
      setAttemptCount(prev => prev + 1);

      // Sanitize input data
      const sanitizedData = {
        email: sanitizeInput(data.email.toLowerCase()),
        password: data.password,
        rememberMe: data.rememberMe
      };

      const response = await login(sanitizedData);

      if (response.mfaRequired && enableMFA) {
        setIsMFARequired(true);
        return;
      }

      onSuccess?.();
    } catch (error: any) {
      const errorMessage = error.code === AuthErrorType.INVALID_CREDENTIALS
        ? 'Invalid email or password'
        : 'An error occurred during login';
      
      setError('root', { message: errorMessage });
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [login, onSuccess, onError, setError, isRateLimited, enableMFA]);

  // Handle MFA verification
  const handleMFASubmit = useCallback(async () => {
    try {
      setIsLoading(true);
      await validateMfa(mfaToken);
      onSuccess?.();
    } catch (error) {
      setError('root', { message: 'Invalid MFA token' });
      onError?.('Invalid MFA token');
    } finally {
      setIsLoading(false);
    }
  }, [validateMfa, mfaToken, onSuccess, onError, setError]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      onSuccess?.();
    }
  }, [isAuthenticated, onSuccess]);

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      className={className}
      aria-label="Login form"
      noValidate
    >
      {!isMFARequired ? (
        <>
          <Input
            id="email"
            name="email"
            type="email"
            label="Email"
            error={errors.email?.message}
            autoComplete="email"
            required
            disabled={isLoading || isRateLimited}
            {...register('email')}
          />

          <Input
            id="password"
            name="password"
            type="password"
            label="Password"
            error={errors.password?.message}
            autoComplete="current-password"
            required
            disabled={isLoading || isRateLimited}
            {...register('password')}
          />

          <FormControlLabel
            control={
              <Checkbox
                {...register('rememberMe')}
                defaultChecked={rememberMe}
                disabled={isLoading || isRateLimited}
              />
            }
            label="Remember me"
          />

          <Button
            type="submit"
            variant={ComponentVariant.PRIMARY}
            size={ComponentSize.LARGE}
            fullWidth
            loading={isLoading}
            disabled={isRateLimited}
            aria-label="Sign in"
          >
            Sign In
          </Button>
        </>
      ) : (
        <>
          <Typography variant="h6" gutterBottom>
            Two-Factor Authentication Required
          </Typography>

          <Input
            id="mfaToken"
            name="mfaToken"
            type="text"
            label="Enter verification code"
            value={mfaToken}
            onChange={(e) => setMfaToken(e.target.value)}
            disabled={isLoading}
            required
            autoComplete="one-time-code"
          />

          <Button
            onClick={handleMFASubmit}
            variant={ComponentVariant.PRIMARY}
            size={ComponentSize.LARGE}
            fullWidth
            loading={isLoading}
            disabled={!mfaToken}
            aria-label="Verify MFA token"
          >
            Verify
          </Button>
        </>
      )}

      {isRateLimited && (
        <Typography color="error" variant="body2" role="alert">
          Too many login attempts. Please try again later.
        </Typography>
      )}
    </Box>
  );
});

LoginForm.displayName = 'LoginForm';

export default LoginForm;