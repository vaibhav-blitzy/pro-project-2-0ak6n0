import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from '@emotion/styled';
import { useTheme } from '@mui/material';
import { analytics } from '@segment/analytics-next';

import RegisterForm from '../../components/auth/RegisterForm';
import MainLayout from '../../components/layout/MainLayout';
import { useAuth } from '../../hooks/useAuth';
import { AUTH_ROUTES } from '../../constants/routes.constants';

// Styled components following Material Design 3.0 and F-pattern layout
const RegisterContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - ${({ theme }) => theme.spacing(8)});
  padding: ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.palette.background.default};

  @media (max-width: ${({ theme }) => theme.breakpoints.values.sm}px) {
    padding: ${({ theme }) => theme.spacing(2)};
  }
`;

const RegisterCard = styled.div`
  width: 100%;
  max-width: 480px;
  padding: ${({ theme }) => theme.spacing(4)};
  background-color: ${({ theme }) => theme.palette.background.paper};
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  box-shadow: ${({ theme }) => theme.shadows[1]};

  @media (max-width: ${({ theme }) => theme.breakpoints.values.sm}px) {
    padding: ${({ theme }) => theme.spacing(3)};
  }
`;

const Register: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { isAuthenticated } = useAuth();
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  // Redirect authenticated users
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Track page view
  useEffect(() => {
    analytics.page('Register', {
      path: window.location.pathname,
      title: 'Register - Task Management System',
      url: window.location.href,
      referrer: document.referrer,
      timestamp: new Date().toISOString()
    });
  }, []);

  // Handle successful registration
  const handleRegistrationSuccess = useCallback(() => {
    analytics.track('Registration Success', {
      timestamp: new Date().toISOString()
    });

    // Navigate to login page with success message
    navigate(AUTH_ROUTES.LOGIN, {
      state: {
        message: 'Registration successful! Please verify your email before logging in.',
        type: 'success'
      }
    });
  }, [navigate]);

  // Handle registration error
  const handleRegistrationError = useCallback((error: Error) => {
    setRegistrationError(error.message);
    
    analytics.track('Registration Error', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }, []);

  return (
    <MainLayout
      disableAnalytics={true}
      layoutConfig={{
        hideNavigation: true,
        hideFooter: false,
        fullWidth: false
      }}
    >
      <RegisterContainer>
        <RegisterCard>
          <RegisterForm
            onSuccess={handleRegistrationSuccess}
            onError={handleRegistrationError}
            error={registrationError}
          />
        </RegisterCard>
      </RegisterContainer>
    </MainLayout>
  );
});

Register.displayName = 'Register';

export default Register;