import React, { Component, ErrorInfo } from 'react'; // ^18.0.0
import styled from '@emotion/styled'; // ^11.0.0
import * as Sentry from '@sentry/browser'; // ^7.0.0
import Card from './Card';
import { useTheme } from '../../hooks/useTheme';
import { ErrorState } from '../interfaces/common.interface';

/**
 * Props interface for ErrorBoundary component with support for custom fallback UI
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error) => void;
  enableLogging?: boolean;
  boundaryId?: string;
}

/**
 * State interface for ErrorBoundary component with detailed error tracking
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string;
  isRecoverable: boolean;
}

/**
 * Styled components for error presentation
 */
const ErrorContainer = styled(Card)<{ isDarkMode: boolean }>`
  padding: ${({ theme }) => theme.spacing(3)};
  margin: ${({ theme }) => theme.spacing(2)};
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
`;

const ErrorTitle = styled.h2`
  color: ${({ theme }) => theme.palette.error.main};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  font-size: 1.5rem;
`;

const ErrorMessage = styled.p`
  color: ${({ theme }) => theme.palette.text.primary};
  margin-bottom: ${({ theme }) => theme.spacing(3)};
`;

const RetryButton = styled.button`
  background-color: ${({ theme }) => theme.palette.primary.main};
  color: ${({ theme }) => theme.palette.primary.contrastText};
  padding: ${({ theme }) => theme.spacing(1, 3)};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.palette.primary.dark};
  }

  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.palette.primary.main};
    outline-offset: 2px;
  }
`;

/**
 * ErrorBoundary component that implements graceful error handling with
 * accessibility support, theme-aware error presentation, and comprehensive
 * error monitoring integration.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private errorCount: number;
  private recoveryTimer: NodeJS.Timeout | null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: '',
      isRecoverable: true
    };
    this.errorCount = 0;
    this.recoveryTimer = null;
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Assess error recoverability based on error type
    const isRecoverable = !(
      error instanceof TypeError ||
      error instanceof ReferenceError ||
      error.name === 'ChunkLoadError'
    );

    return {
      hasError: true,
      error,
      errorId: crypto.randomUUID(),
      isRecoverable
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.errorCount++;

    // Prepare error details for monitoring
    const errorState: ErrorState = {
      hasError: true,
      message: error.message,
      code: error.name,
      stackTrace: errorInfo.componentStack,
      timestamp: new Date(),
      errorId: this.state.errorId,
      details: {
        componentStack: errorInfo.componentStack,
        errorCount: this.errorCount,
        boundaryId: this.props.boundaryId
      }
    };

    // Log error to monitoring service if enabled
    if (this.props.enableLogging !== false) {
      Sentry.withScope((scope) => {
        scope.setExtra('componentStack', errorInfo.componentStack);
        scope.setExtra('errorCount', this.errorCount);
        scope.setExtra('boundaryId', this.props.boundaryId);
        scope.setTag('errorId', this.state.errorId);
        Sentry.captureException(error);
      });
    }

    // Call onError callback if provided
    this.props.onError?.(error);

    // Set up automatic recovery attempt for recoverable errors
    if (this.state.isRecoverable && this.errorCount < 3) {
      this.recoveryTimer = setTimeout(() => {
        this.setState({ hasError: false, error: null });
      }, 5000);
    }
  }

  componentWillUnmount(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    const { hasError, error, isRecoverable } = this.state;
    const { children, fallback } = this.props;

    if (!hasError) {
      return children;
    }

    // Use custom fallback if provided
    if (fallback) {
      return fallback;
    }

    // Default error UI with theme support and accessibility
    return (
      <ErrorContainer
        role="alert"
        aria-live="polite"
        elevation="medium"
        isDarkMode={useTheme().isDarkMode}
      >
        <ErrorTitle>
          {isRecoverable ? 'Something went wrong' : 'An error has occurred'}
        </ErrorTitle>
        <ErrorMessage>
          {isRecoverable
            ? 'We apologize for the inconvenience. The application encountered a temporary error.'
            : 'We apologize for the inconvenience. Please refresh the page to continue.'}
        </ErrorMessage>
        {error && process.env.NODE_ENV === 'development' && (
          <pre style={{ textAlign: 'left', margin: '16px 0' }}>
            {error.message}
          </pre>
        )}
        {isRecoverable && (
          <RetryButton
            onClick={this.handleRetry}
            aria-label="Retry loading the component"
          >
            Try Again
          </RetryButton>
        )}
      </ErrorContainer>
    );
  }
}

export default ErrorBoundary;