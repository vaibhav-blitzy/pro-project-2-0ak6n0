import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import styled from '@emotion/styled';
import { useMediaQuery, useTheme } from '@mui/material';
import { useAnalytics } from '@analytics/react';
import { usePerformance } from '@performance/react';
import ResizeObserver from 'resize-observer-polyfill';

import Header from './Header';
import Navigation from './Navigation';
import Footer from './Footer';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { LAYOUT } from '../../constants/ui.constants';

// Styled components implementing Material Design 3.0 principles
const LayoutContainer = styled.div<{ isDarkMode: boolean }>`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: ${({ theme }) => theme.palette.background.default};
  position: relative;
  overflow-x: hidden;
  transition: ${({ theme }) => theme.transitions.create(['background-color'])};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const MainContent = styled.main<{ isMenuOpen: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: ${LAYOUT.MAX_WIDTH}px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing(3)};
  padding-top: calc(${LAYOUT.HEADER_HEIGHT}px + ${({ theme }) => theme.spacing(3)});
  transition: padding-left 0.3s ease;
  will-change: padding-left;

  @media (min-width: 1024px) {
    padding-left: ${({ isMenuOpen }) => 
      isMenuOpen ? `${LAYOUT.SIDEBAR_WIDTH}px` : '0'};
  }

  & > * {
    min-width: 0; // Fix for flexbox content overflow
  }
`;

// Interface for layout configuration
interface LayoutConfig {
  hideNavigation?: boolean;
  hideFooter?: boolean;
  fullWidth?: boolean;
  disableAnalytics?: boolean;
}

// Props interface for the MainLayout component
interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
  disableAnalytics?: boolean;
  layoutConfig?: LayoutConfig;
}

const MainLayout: React.FC<MainLayoutProps> = memo(({
  children,
  className,
  disableAnalytics = false,
  layoutConfig = {}
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const analytics = useAnalytics();
  const performance = usePerformance();
  
  // State management
  const [isMenuOpen, setIsMenuOpen] = useState(!isMobile);
  const [layoutShifts, setLayoutShifts] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Initialize performance monitoring
  useEffect(() => {
    if (!disableAnalytics) {
      performance.mark('layout-mounted');
      return () => {
        performance.measure('layout-lifecycle', 'layout-mounted');
      };
    }
  }, [disableAnalytics, performance]);

  // Handle layout shifts monitoring
  useEffect(() => {
    if (!contentRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === contentRef.current) {
          setLayoutShifts(prev => prev + 1);
          if (!disableAnalytics) {
            analytics.track('Layout Shift', {
              timestamp: new Date().toISOString(),
              width: entry.contentRect.width,
              height: entry.contentRect.height
            });
          }
        }
      }
    });

    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [analytics, disableAnalytics]);

  // Handle menu toggle with animation frame optimization
  const handleMenuToggle = useCallback(() => {
    requestAnimationFrame(() => {
      setIsMenuOpen(prev => !prev);
      if (!disableAnalytics) {
        analytics.track('Navigation Toggle', {
          state: !isMenuOpen ? 'open' : 'closed',
          timestamp: new Date().toISOString()
        });
      }
    });
  }, [isMenuOpen, analytics, disableAnalytics]);

  // Handle navigation change analytics
  const handleNavigationChange = useCallback((path: string) => {
    if (!disableAnalytics) {
      analytics.track('Navigation Change', {
        path,
        timestamp: new Date().toISOString()
      });
    }
  }, [analytics, disableAnalytics]);

  return (
    <ErrorBoundary>
      <LayoutContainer
        className={className}
        isDarkMode={isDarkMode}
        role="application"
        aria-label="Main application layout"
      >
        <Header
          isMenuOpen={isMenuOpen}
          onMenuToggle={handleMenuToggle}
          role="banner"
          aria-label="Main header"
        />

        {!layoutConfig.hideNavigation && (
          <Navigation
            defaultCollapsed={isMobile}
            onNavigationChange={handleNavigationChange}
            theme={theme.palette.mode}
          />
        )}

        <MainContent
          ref={contentRef}
          isMenuOpen={isMenuOpen}
          role="main"
          aria-label="Main content"
        >
          {children}
        </MainContent>

        {!layoutConfig.hideFooter && (
          <Footer
            showSocialLinks
            showNavLinks
          />
        )}
      </LayoutContainer>
    </ErrorBoundary>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;