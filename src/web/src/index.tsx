/**
 * @fileoverview Main entry point for the Task Management System web application.
 * Implements React 18 concurrent features, performance monitoring, and enhanced error handling.
 * @version 1.0.0
 */

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { HelmetProvider } from 'react-helmet-async';
import { initializeMonitoring } from '@monitoring/core'; // ^2.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import App from './App';
import { store } from './store';
import './styles/global.scss';

// Constants
const ROOT_ELEMENT_ID = 'root';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const PERFORMANCE_BUDGET = {
  firstContentfulPaint: 1000, // 1 second
  timeToInteractive: 2000 // 2 seconds
};

/**
 * Initializes application monitoring, service worker, and development tools
 */
const initializeApp = async (): Promise<void> => {
  try {
    // Initialize performance monitoring
    await initializeMonitoring({
      environment: process.env.NODE_ENV,
      performanceBudget: PERFORMANCE_BUDGET,
      enabledInDevelopment: true
    });

    // Register service worker in production
    if ('serviceWorker' in navigator && !IS_DEVELOPMENT) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/service-worker.js')
          .then(registration => {
            console.info('ServiceWorker registered:', registration);
          })
          .catch(error => {
            console.error('ServiceWorker registration failed:', error);
          });
      });
    }

    // Set up development tools
    if (IS_DEVELOPMENT) {
      const { webVitals } = await import('web-vitals');
      webVitals(metric => {
        console.debug(`[Web Vitals] ${metric.name}:`, metric.value);
      });
    }
  } catch (error) {
    console.error('Application initialization failed:', error);
  }
};

/**
 * Error fallback component for critical errors
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" style={{ padding: '20px', textAlign: 'center' }}>
    <h1>Application Error</h1>
    <pre style={{ color: 'red', margin: '10px 0' }}>
      {IS_DEVELOPMENT ? error.stack : error.message}
    </pre>
    <button
      onClick={() => window.location.reload()}
      style={{ padding: '8px 16px', cursor: 'pointer' }}
    >
      Reload Application
    </button>
  </div>
);

/**
 * Initializes and renders the React application with error boundary and monitoring
 */
const renderApp = (): void => {
  const rootElement = document.getElementById(ROOT_ELEMENT_ID);

  if (!rootElement) {
    throw new Error(`Element with id '${ROOT_ELEMENT_ID}' not found`);
  }

  // Create React 18 concurrent root
  const root = createRoot(rootElement);

  // Render application with providers and error boundary
  root.render(
    <StrictMode>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onError={(error) => {
          console.error('Critical application error:', error);
          // In production, send to error tracking service
          if (!IS_DEVELOPMENT) {
            initializeMonitoring().then(monitor => {
              monitor.trackError(error);
            });
          }
        }}
      >
        <Provider store={store}>
          <HelmetProvider>
            <App />
          </HelmetProvider>
        </Provider>
      </ErrorBoundary>
    </StrictMode>
  );

  // Report initial load metrics
  if (IS_DEVELOPMENT) {
    console.info(`[Performance] Initial render completed at ${performance.now()}ms`);
  }
};

// Initialize application and render
initializeApp().then(renderApp);

// Enable hot module replacement in development
if (IS_DEVELOPMENT && module.hot) {
  module.hot.accept('./App', renderApp);
}