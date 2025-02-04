import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import styled from '@emotion/styled';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { validateEmail } from '../../utils/validation.utils';
import { ComponentSize, ComponentVariant } from '../../types/common.types';

// Interface for form data with validation rules
interface ForgotPasswordFormData {
  email: string;
}

// Rate limiting constants
const RATE_LIMIT_ATTEMPTS = 3;
const RATE_LIMIT_DURATION = 15 * 60 * 1000; // 15 minutes

// Styled components following Material Design 3.0
const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--spacing-large);
  background-color: var(--md-sys-color-background);
`;

const FormContainer = styled.form`
  width: 100%;
  max-width: 400px;
  padding: var(--spacing-xlarge);
  background-color: var(--md-sys-color-surface);
  border-radius: 8px;
  box-shadow: var(--md-sys-elevation-2);
`;

const Title = styled.h1`
  color: var(--md-sys-color-on-surface);
  font-size: var(--md-sys-typescale-headline-medium-size);
  font-weight: var(--md-sys-typescale-headline-medium-weight);
  margin-bottom: var(--spacing-medium);
  text-align: center;
`;

const Description = styled.p`
  color: var(--md-sys-color-on-surface-variant);
  font-size: var(--md-sys-typescale-body-medium-size);
  text-align: center;
  margin-bottom: var(--spacing-large);
`;

const ErrorMessage = styled.div`
  color: var(--md-sys-color-error);
  font-size: var(--md-sys-typescale-body-small-size);
  margin-top: var(--spacing-small);
  text-align: center;
`;

const BackLink = styled.a`
  color: var(--md-sys-color-primary);
  text-decoration: none;
  font-size: var(--md-sys-typescale-body-medium-size);
  margin-top: var(--spacing-large);
  cursor: pointer;
  
  &:hover {
    text-decoration: underline;
  }
`;

const ForgotPassword: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { forgotPassword } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ForgotPasswordFormData>();

  // Check rate limiting
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    if (attemptCount >= RATE_LIMIT_ATTEMPTS) {
      const timeElapsed = now - lastAttemptTime;
      if (timeElapsed < RATE_LIMIT_DURATION) {
        const minutesLeft = Math.ceil((RATE_LIMIT_DURATION - timeElapsed) / 60000);
        setError(`Too many attempts. Please try again in ${minutesLeft} minutes.`);
        return false;
      }
      setAttemptCount(0);
    }
    return true;
  }, [attemptCount, lastAttemptTime]);

  // Handle form submission with security measures
  const onSubmit = useCallback(async (data: ForgotPasswordFormData) => {
    try {
      setError(null);
      
      // Rate limiting check
      if (!checkRateLimit()) {
        return;
      }

      // Validate email format
      if (!validateEmail(data.email)) {
        setError('Please enter a valid email address.');
        return;
      }

      setIsSubmitting(true);
      setAttemptCount(prev => prev + 1);
      setLastAttemptTime(Date.now());

      await forgotPassword(data.email);
      
      // Navigate to confirmation page on success
      navigate('/auth/forgot-password/confirmation', {
        state: { email: data.email }
      });
    } catch (error: any) {
      console.error('Password reset error:', error);
      setError(error.message || 'An error occurred. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  }, [navigate, forgotPassword, checkRateLimit]);

  return (
    <Container>
      <FormContainer onSubmit={handleSubmit(onSubmit)} noValidate>
        <Title>Reset Password</Title>
        <Description>
          Enter your email address and we'll send you instructions to reset your password.
        </Description>

        <Input
          id="email"
          type="email"
          label="Email Address"
          error={errors.email?.message}
          disabled={isSubmitting}
          required
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address'
            }
          })}
          aria-describedby="email-error"
          data-testid="forgot-password-email"
        />

        {error && (
          <ErrorMessage role="alert" id="form-error">
            {error}
          </ErrorMessage>
        )}

        <Button
          type="submit"
          variant={ComponentVariant.PRIMARY}
          size={ComponentSize.LARGE}
          loading={isSubmitting}
          disabled={isSubmitting}
          fullWidth
          aria-label="Reset Password"
          data-testid="forgot-password-submit"
        >
          {isSubmitting ? 'Sending...' : 'Reset Password'}
        </Button>

        <BackLink
          onClick={() => navigate('/auth/login')}
          onKeyPress={(e) => e.key === 'Enter' && navigate('/auth/login')}
          tabIndex={0}
          role="link"
          aria-label="Back to Login"
          data-testid="back-to-login"
        >
          Back to Login
        </BackLink>
      </FormContainer>
    </Container>
  );
});

ForgotPassword.displayName = 'ForgotPassword';

export default ForgotPassword;