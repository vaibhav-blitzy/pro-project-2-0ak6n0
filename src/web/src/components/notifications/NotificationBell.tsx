import React, { useState, useCallback, useEffect, memo } from 'react';
import styled from '@emotion/styled';
import { Badge, Popover, useTheme, useMediaQuery } from '@mui/material';
import Icon from '../common/Icon';
import NotificationList from './NotificationList';
import { useNotifications } from '../../hooks/useNotifications';
import ErrorBoundary from '../common/ErrorBoundary';
import { ComponentSize } from '../../types/common.types';

// Styled components with Material Design 3.0 principles
const BellContainer = styled.div<{ isDarkMode: boolean }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing(1)};
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  transition: ${({ theme }) => theme.transitions.create(['background-color'])};

  &:hover {
    background-color: ${({ theme, isDarkMode }) =>
      isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'};
  }

  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.palette.primary.main};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const StyledBadge = styled(Badge)`
  & .MuiBadge-badge {
    background-color: ${({ theme }) => theme.palette.error.main};
    color: ${({ theme }) => theme.palette.error.contrastText};
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    font-size: 12px;
    font-weight: 600;
  }

  @media (max-width: 600px) {
    transform: scale(0.9);
  }
`;

const NotificationPopover = styled(Popover)`
  .MuiPaper-root {
    width: 400px;
    max-width: 90vw;
    max-height: 80vh;
    overflow: hidden;
    margin-top: ${({ theme }) => theme.spacing(1)};
    border-radius: ${({ theme }) => theme.shape.borderRadius}px;
    box-shadow: ${({ theme }) => theme.shadows[8]};

    @media (max-width: 600px) {
      width: 100vw;
      max-width: 100vw;
      margin: 0;
      border-radius: 0;
    }
  }
`;

interface NotificationBellProps {
  className?: string;
  ariaLabel?: string;
  disableAutoUpdate?: boolean;
  onNotificationClick?: (notification: any) => void;
}

const NotificationBell: React.FC<NotificationBellProps> = memo(({
  className,
  ariaLabel = 'Notifications',
  disableAutoUpdate = false,
  onNotificationClick
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDarkMode = theme.palette.mode === 'dark';

  // State management
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const {
    notifications,
    unreadCount,
    loading,
    error,
    connectionStatus,
    markAsRead,
    retryConnection
  } = useNotifications({ autoFetch: !disableAutoUpdate });

  // Handle bell click with keyboard support
  const handleBellClick = useCallback((event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation();
    if (event.type === 'keydown' && (event as React.KeyboardEvent).key !== 'Enter') {
      return;
    }
    setAnchorEl(event.currentTarget as HTMLDivElement);
  }, []);

  // Handle popover close
  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  // Handle notification click
  const handleNotificationClick = useCallback((notification: any) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    onNotificationClick?.(notification);
  }, [markAsRead, onNotificationClick]);

  // Auto-retry connection on error
  useEffect(() => {
    if (error && connectionStatus === 'disconnected' && !disableAutoUpdate) {
      const retryTimer = setTimeout(retryConnection, 5000);
      return () => clearTimeout(retryTimer);
    }
  }, [error, connectionStatus, disableAutoUpdate, retryConnection]);

  return (
    <ErrorBoundary>
      <BellContainer
        className={className}
        onClick={handleBellClick}
        onKeyDown={handleBellClick}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={Boolean(anchorEl)}
        aria-controls={anchorEl ? 'notification-popover' : undefined}
        isDarkMode={isDarkMode}
      >
        <StyledBadge
          badgeContent={unreadCount}
          max={99}
          invisible={unreadCount === 0}
        >
          <Icon
            name="notifications"
            size={ComponentSize.MEDIUM}
            color={theme.palette.text.primary}
            spin={loading}
            ariaLabel={loading ? 'Loading notifications' : undefined}
          />
        </StyledBadge>
      </BellContainer>

      <NotificationPopover
        id="notification-popover"
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: isMobile ? 'center' : 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: isMobile ? 'center' : 'right',
        }}
        PaperProps={{
          elevation: 8,
          'aria-label': 'Notifications panel'
        }}
      >
        <NotificationList
          notifications={notifications}
          loading={loading}
          error={error}
          onNotificationClick={handleNotificationClick}
          showConnectionStatus={true}
        />
      </NotificationPopover>
    </ErrorBoundary>
  );
});

NotificationBell.displayName = 'NotificationBell';

export default NotificationBell;