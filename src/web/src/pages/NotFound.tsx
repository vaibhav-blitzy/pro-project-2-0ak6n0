import React, { useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from '@emotion/styled';
import { analytics } from '@segment/analytics-next';

import MainLayout from '../components/layout/MainLayout';
import Button from '../components/common/Button';
import { DASHBOARD_ROUTES } from '../constants/routes.constants';

// Styled components implementing Material Design 3.0 principles
const NotFoundContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 200px);
  text-align: center;
  padding: ${({ theme }) => theme.spacing(3)};
  max-width: 800px;
  margin: 0 auto;
`;

const Title = styled.h1`
  font-size: clamp(3rem, 8vw, 6rem);
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  color: ${({ theme }) => theme.palette.primary.main};
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
`;

const Subtitle = styled.h2`
  font-size: clamp(1rem, 3vw, 1.5rem);
  margin-bottom: ${({ theme }) => theme.spacing(4)};
  color: ${({ theme }) => theme.palette.text.secondary};
  max-width: 600px;
  line-height: 1.6;
`;

const Illustration = styled.img`
  width: 100%;
  max-width: 400px;
  height: auto;
  margin-bottom: ${({ theme }) => theme.spacing(4)};
  object-fit: contain;
  user-select: none;
`;

const NotFound: React.FC = memo(() => {
  const navigate = useNavigate();

  // Track 404 page view on component mount
  useEffect(() => {
    analytics.track('404_Page_View', {
      path: window.location.pathname,
      referrer: document.referrer,
      timestamp: new Date().toISOString()
    });
  }, []);

  // Handle navigation back to home with analytics tracking
  const handleNavigateHome = useCallback(() => {
    analytics.track('404_Return_Home', {
      path: window.location.pathname,
      timestamp: new Date().toISOString()
    });
    navigate(DASHBOARD_ROUTES.HOME);
  }, [navigate]);

  return (
    <MainLayout>
      <NotFoundContainer role="main" aria-label="404 Not Found Page">
        <Title aria-label="404">404</Title>
        <Subtitle>
          Oops! The page you're looking for seems to have gone missing.
        </Subtitle>
        <Illustration
          src="/assets/images/404-illustration.svg"
          alt="404 illustration"
          loading="eager"
          width="400"
          height="300"
        />
        <Button
          onClick={handleNavigateHome}
          ariaLabel="Return to homepage"
          testId="return-home-button"
        >
          Return to Homepage
        </Button>
      </NotFoundContainer>
    </MainLayout>
  );
});

NotFound.displayName = 'NotFound';

export default NotFound;