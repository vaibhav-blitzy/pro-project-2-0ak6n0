import React, { useCallback, useMemo } from 'react';
import { styled } from '@mui/material/styles';
import { formatDistanceToNow } from 'date-fns';
import { FixedSizeList as VirtualList } from 'react-window';
import {
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Box,
} from '@mui/material';
import {
  NotificationsNone as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  FiberManual as PriorityIcon,
  MarkEmailRead as MarkReadIcon,
} from '@mui/icons-material';

import { INotification, NotificationType, NotificationPriority } from '../../interfaces/notification.interface';
import { useNotifications } from '../../hooks/useNotifications';
import ErrorBoundary from '../common/ErrorBoundary';

// Styled components with Material Design 3.0 principles
const NotificationContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  maxHeight: '100%',
  overflow: 'hidden',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
}));

const NotificationItem = styled(ListItem)<{ read?: boolean }>(({ theme, read }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: read ? 'transparent' : theme.palette.action.hover,
  transition: theme.transitions.create(['background-color']),
  '&:hover': {
    backgroundColor: theme.palette.action.selected,
  },
  padding: theme.spacing(2),
}));

const PriorityIndicator = styled(Chip)<{ priority: NotificationPriority }>(({ theme, priority }) => ({
  borderRadius: theme.shape.borderRadius,
  height: 24,
  backgroundColor: {
    [NotificationPriority.HIGH]: theme.palette.error.main,
    [NotificationPriority.MEDIUM]: theme.palette.warning.main,
    [NotificationPriority.LOW]: theme.palette.info.main,
  }[priority],
  color: theme.palette.common.white,
  marginRight: theme.spacing(1),
}));

const ConnectionStatus = styled(Alert)(({ theme }) => ({
  margin: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
}));

// Props interface
interface NotificationListProps {
  className?: string;
  maxHeight?: string;
  onNotificationClick?: (notification: INotification) => void;
  virtualizeThreshold?: number;
  showConnectionStatus?: boolean;
  enableAnalytics?: boolean;
}

// Helper function to format notification time
const formatNotificationTime = (date: Date, locale: string = 'en'): string => {
  return formatDistanceToNow(date, { addSuffix: true, locale });
};

// Helper function to get notification icon
const getNotificationIcon = (type: NotificationType, priority: NotificationPriority): React.ReactElement => {
  const iconProps = {
    color: priority === NotificationPriority.HIGH ? 'error' : 
           priority === NotificationPriority.MEDIUM ? 'warning' : 'info',
    'aria-hidden': 'false',
  };

  switch (type) {
    case NotificationType.TASK_ASSIGNED:
    case NotificationType.TASK_UPDATED:
      return <InfoIcon {...iconProps} />;
    case NotificationType.DUE_DATE_REMINDER:
      return <WarningIcon {...iconProps} />;
    case NotificationType.MENTION:
      return <PriorityIcon {...iconProps} />;
    case NotificationType.COMMENT_ADDED:
      return <SuccessIcon {...iconProps} />;
    default:
      return <InfoIcon {...iconProps} />;
  }
};

const NotificationList: React.FC<NotificationListProps> = React.memo(({
  className,
  maxHeight = '600px',
  onNotificationClick,
  virtualizeThreshold = 50,
  showConnectionStatus = true,
  enableAnalytics = true,
}) => {
  const {
    notifications,
    loading,
    error,
    connectionStatus,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  // Memoized notification renderer for virtualized list
  const renderNotification = useCallback(({ index, style }) => {
    const notification = notifications[index];
    
    return (
      <NotificationItem
        key={notification.id}
        read={notification.read}
        style={style}
        onClick={() => handleNotificationClick(notification)}
        role="listitem"
        aria-label={`Notification: ${notification.title}`}
      >
        <ListItemIcon>
          {getNotificationIcon(notification.type, notification.priority)}
        </ListItemIcon>
        <ListItemText
          primary={
            <Typography variant="subtitle1" component="div">
              {notification.title}
              <PriorityIndicator
                priority={notification.priority}
                label={notification.priority.toLowerCase()}
                size="small"
              />
            </Typography>
          }
          secondary={
            <Typography variant="body2" color="textSecondary">
              {notification.message}
              <br />
              {formatNotificationTime(notification.createdAt)}
            </Typography>
          }
        />
        {!notification.read && (
          <IconButton
            onClick={(e) => handleMarkAsRead(e, notification.id)}
            aria-label="Mark as read"
            size="small"
          >
            <MarkReadIcon />
          </IconButton>
        )}
      </NotificationItem>
    );
  }, [notifications]);

  // Event handlers
  const handleNotificationClick = useCallback((notification: INotification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    onNotificationClick?.(notification);
  }, [markAsRead, onNotificationClick]);

  const handleMarkAsRead = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    markAsRead(id);
  }, [markAsRead]);

  // Render loading state
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress aria-label="Loading notifications" />
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Alert severity="error" sx={{ m: 1 }}>
        {error.message}
      </Alert>
    );
  }

  return (
    <ErrorBoundary>
      <NotificationContainer className={className}>
        {showConnectionStatus && connectionStatus !== 'connected' && (
          <ConnectionStatus 
            severity={connectionStatus === 'connecting' ? 'info' : 'warning'}
          >
            {connectionStatus === 'connecting' ? 'Connecting...' : 'Connection lost. Reconnecting...'}
          </ConnectionStatus>
        )}

        {notifications.length === 0 ? (
          <Box p={3} textAlign="center">
            <Typography color="textSecondary">
              No notifications
            </Typography>
          </Box>
        ) : notifications.length > virtualizeThreshold ? (
          <VirtualList
            height={parseInt(maxHeight)}
            width="100%"
            itemCount={notifications.length}
            itemSize={88}
            overscanCount={5}
          >
            {renderNotification}
          </VirtualList>
        ) : (
          <List role="list" aria-label="Notifications">
            {notifications.map((notification, index) => (
              renderNotification({ index, style: {} })
            ))}
          </List>
        )}
      </NotificationContainer>
    </ErrorBoundary>
  );
});

NotificationList.displayName = 'NotificationList';

export default NotificationList;