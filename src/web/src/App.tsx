import React, { useEffect, useMemo } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline, useMediaQuery } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { ErrorBoundary } from 'react-error-boundary';

import MainLayout from './components/layout/MainLayout';
import { store } from './store';
import { lightTheme, darkTheme } from './config/theme.config';
import { useTheme } from './hooks/useTheme';

/**
 * Root application component implementing core application structure
 * with comprehensive theme support, error handling, and accessibility features
 */
const AppContent: React.FC = () => {
  const { theme, setTheme, isDarkMode } = useTheme();
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  // Sync theme with system preferences when set to 'system'
  useEffect(() => {
    if (theme === 'system') {
      setTheme(prefersDarkMode ? 'dark' : 'light');
    }
  }, [prefersDarkMode, theme, setTheme]);

  // Memoize current theme to prevent unnecessary re-renders
  const currentTheme = useMemo(() => 
    isDarkMode ? darkTheme : lightTheme,
    [isDarkMode]
  );

  return (
    <>
      <Helmet>
        <title>Task Management System</title>
        <meta name="description" content="Enterprise task management system" />
        <meta name="theme-color" content={currentTheme.palette.primary.main} />
        <meta name="color-scheme" content={isDarkMode ? 'dark' : 'light'} />
        {/* Security headers */}
        <meta httpEquiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
      </Helmet>

      <ThemeProvider theme={currentTheme}>
        {/* Reset CSS and apply base styles */}
        <CssBaseline enableColorScheme />
        
        {/* Main application layout */}
        <MainLayout />
      </ThemeProvider>
    </>
  );
};

/**
 * Error fallback component for graceful error handling
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" style={{ padding: '20px', textAlign: 'center' }}>
    <h2>Something went wrong</h2>
    <pre style={{ color: 'red' }}>{error.message}</pre>
    <button onClick={() => window.location.reload()}>Refresh Page</button>
  </div>
);

/**
 * Root application component with provider setup
 */
const App: React.FC = () => {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        console.error('Application Error:', error);
        // In production, send to error tracking service
      }}
    >
      <Provider store={store}>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </Provider>
    </ErrorBoundary>
  );
};

export default App;