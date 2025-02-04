import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from '@mui/material';
import { useAnalytics } from '@analytics/react';
import styled from '@emotion/styled';

import LoginForm from '../../components/auth/LoginForm';
import MainLayout from '../../components/layout/MainLayout';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useAuth } from '../../hooks/useAuth';
import { DASHBOARD_ROUTES } from '../../constants/routes.constants';

// Styled components with Material Design 3.0 principles
const LoginContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 128px); // Account for header and footer
  padding: ${({ theme }) => theme.spacing(3)};
  max-width: 400px;
  margin: 0 auto;
  width: 100%;
`;

const LoginHeader = styled.div`
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const LoginTitle = styled.h1`
  font-size: 2rem;
  font-weight: 600;
  color: ${({ theme }) => theme.palette.text.primary};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const LoginSubtitle = styled.p`
  font-size: 1rem;
  color: ${({ theme }) => theme.palette.text.secondary};
  margin: 0;
`;

/**
 * Login page component implementing secure authentication with comprehensive
 * error handling, accessibility features, and analytics integration.
 */
const LoginPage: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const analytics = useAnalytics();
  const { login, isAuthenticated, error: authError } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(DASHBOARD_ROUTES.HOME, { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Handle successful login
  const handleLoginSuccess = useCallback(() => {
    analytics.track('Login Success', {
      timestamp: new Date().toISOString(),
      method: 'credentials'
    });

    enqueueSnackbar(t('auth.loginSuccess'), { 
      variant: 'success',
      autoHideDuration: 3000
    });

    navigate(DASHBOARD_ROUTES.HOME, { replace: true });
  }, [analytics, enqueueSnackbar, navigate, t]);

  // Handle login error with comprehensive error handling
  const handleLoginError = useCallback((error: Error) => {
    analytics.track('Login Error', {
      error: error.message,
      timestamp: new Date().toISOString()
    });

    enqueueSnackbar(
      error.message || t('auth.loginError'),
      { 
        variant: 'error',
        autoHideDuration: 5000
      }
    );
  }, [analytics, enqueueSnackbar, t]);

  // Handle form submission
  const handleSubmit = useCallback(async (credentials: { 
    email: string, 
    password: string,
    rememberMe: boolean 
  }) => {
    setIsSubmitting(true);

    try {
      analytics.track('Login Attempt', {
        timestamp: new Date().toISOString()
      });

      await login(credentials);
      handleLoginSuccess();
    } catch (error) {
      handleLoginError(error as Error);
    } finally {
      setIsSubmitting(false);
    }
  }, [login, handleLoginSuccess, handleLoginError, analytics]);

  return (
    <ErrorBoundary>
      <MainLayout
        layoutConfig={{
          hideNavigation: true,
          hideFooter: false,
          fullWidth: false
        }}
      >
        <LoginContainer>
          <LoginHeader>
            <LoginTitle>{t('auth.loginTitle')}</LoginTitle>
            <LoginSubtitle>{t('auth.loginSubtitle')}</LoginSubtitle>
          </LoginHeader>

          <LoginForm
            onSuccess={handleLoginSuccess}
            onError={handleLoginError}
            enableMFA={true}
            rememberMe={true}
          />
        </LoginContainer>
      </MainLayout>
    </ErrorBoundary>
  );
});

LoginPage.displayName = 'LoginPage';

export default LoginPage;