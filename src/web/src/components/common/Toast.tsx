import React, { useCallback, useEffect, useState } from 'react';
import { styled } from '@mui/material/styles';
import { Snackbar } from '@mui/material';
import Icon from '../common/Icon';
import { ComponentSize } from '../../types/common.types';
import { useTheme } from '../../hooks/useTheme';

/**
 * Interface for toast queue configuration with advanced management options
 */
interface ToastQueueConfig {
  maxQueue: number;
  displayDuration: number;
  spacing: number;
  groupSimilar: boolean;
  persistOnHover: boolean;
}

/**
 * Enhanced props interface for Toast component with enterprise features
 */
interface ToastProps {
  message: string | React.ReactNode;
  severity: 'success' | 'error' | 'warning' | 'info';
  open: boolean;
  autoHideDuration?: number;
  onClose: () => void;
  className?: string;
  position?: 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  disableAutoHide?: boolean;
  testId?: string;
  role?: string;
  zIndex?: number;
  enableRichContent?: boolean;
  queueConfig?: ToastQueueConfig;
}

/**
 * Styled component for enhanced toast with comprehensive theme integration
 */
const StyledToast = styled(Snackbar, {
  shouldComponentUpdate: (props, nextProps) => props.open !== nextProps.open,
})<{ severity: string }>(({ theme, severity }) => ({
  '& .MuiSnackbarContent-root': {
    backgroundColor: theme.palette[severity]?.main || theme.palette.grey[900],
    color: theme.palette[severity]?.contrastText || theme.palette.common.white,
    minWidth: '300px',
    maxWidth: '600px',
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[8],
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
    '@media (forced-colors: active)': {
      forcedColorAdjust: 'auto',
    },
  },
  '& .MuiSnackbarContent-message': {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontSize: '0.875rem',
    lineHeight: 1.43,
    fontWeight: 500,
  },
  '& .toast-icon': {
    flexShrink: 0,
  },
  '& .toast-close': {
    padding: theme.spacing(0.5),
    borderRadius: theme.shape.borderRadius,
    cursor: 'pointer',
    transition: theme.transitions.create(['background-color', 'transform'], {
      duration: theme.transitions.duration.shorter,
    }),
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      transform: 'scale(1.1)',
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.common.white}`,
      outlineOffset: '2px',
    },
  },
}));

/**
 * Returns the appropriate icon based on toast severity with proper sizing
 */
const getToastIcon = (severity: string): string => {
  switch (severity) {
    case 'success':
      return 'check_circle';
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return 'info';
  }
};

/**
 * Custom hook for managing multiple toast notifications
 */
const useToastQueue = (config: ToastQueueConfig) => {
  const [queue, setQueue] = useState<ToastProps[]>([]);
  const [activeToast, setActiveToast] = useState<ToastProps | null>(null);

  const addToQueue = useCallback((toast: ToastProps) => {
    setQueue(current => {
      if (config.groupSimilar) {
        const similarToast = current.find(t => t.message === toast.message && t.severity === toast.severity);
        if (similarToast) return current;
      }
      return current.length >= config.maxQueue
        ? [...current.slice(1), toast]
        : [...current, toast];
    });
  }, [config.groupSimilar, config.maxQueue]);

  const removeFromQueue = useCallback(() => {
    setQueue(current => current.slice(1));
    setActiveToast(null);
  }, []);

  useEffect(() => {
    if (!activeToast && queue.length > 0) {
      setActiveToast(queue[0]);
    }
  }, [queue, activeToast]);

  return { queue, activeToast, addToQueue, removeFromQueue };
};

/**
 * Enterprise-grade toast notification component with advanced features
 */
const Toast: React.FC<ToastProps> = ({
  message,
  severity,
  open,
  autoHideDuration = 6000,
  onClose,
  className,
  position = 'bottom',
  disableAutoHide = false,
  testId = 'toast',
  role = 'alert',
  zIndex = 1400,
  enableRichContent = false,
  queueConfig = {
    maxQueue: 5,
    displayDuration: 6000,
    spacing: 8,
    groupSimilar: true,
    persistOnHover: true,
  },
}) => {
  const { theme, isDarkMode } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  // Calculate position styles
  const getPositionStyle = useCallback(() => {
    const positions: { [key: string]: object } = {
      'top': { top: 24, left: '50%', transform: 'translateX(-50%)' },
      'bottom': { bottom: 24, left: '50%', transform: 'translateX(-50%)' },
      'top-left': { top: 24, left: 24 },
      'top-right': { top: 24, right: 24 },
      'bottom-left': { bottom: 24, left: 24 },
      'bottom-right': { bottom: 24, right: 24 },
    };
    return positions[position];
  }, [position]);

  // Enhanced close handler with queue management
  const handleClose = useCallback((event: Event | null, reason?: string) => {
    if (disableAutoHide && reason === 'timeout') return;
    if (queueConfig.persistOnHover && isHovered) return;
    
    if (reason !== 'clickaway') {
      onClose();
    }
  }, [disableAutoHide, queueConfig.persistOnHover, isHovered, onClose]);

  return (
    <StyledToast
      open={open}
      autoHideDuration={disableAutoHide ? null : autoHideDuration}
      onClose={handleClose}
      className={className}
      severity={severity}
      anchorOrigin={getPositionStyle()}
      style={{ zIndex }}
      data-testid={testId}
      role={role}
      aria-live="polite"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="MuiSnackbarContent-root">
        <div className="MuiSnackbarContent-message">
          <Icon
            name={getToastIcon(severity)}
            size={ComponentSize.SMALL}
            className="toast-icon"
            ariaLabel={`${severity} notification`}
          />
          {enableRichContent ? (
            <div dangerouslySetInnerHTML={{ __html: message as string }} />
          ) : (
            <span>{message}</span>
          )}
        </div>
        <Icon
          name="close"
          size={ComponentSize.SMALL}
          className="toast-close"
          onClick={() => handleClose(null, 'closeClick')}
          ariaLabel="Close notification"
          testId={`${testId}-close`}
        />
      </div>
    </StyledToast>
  );
};

export default Toast;