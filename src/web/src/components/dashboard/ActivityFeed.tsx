import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import { useInView } from 'react-intersection-observer'; // ^9.0.0
import create from 'zustand'; // ^4.0.0
import styled from '@emotion/styled';
import { ComponentProps } from '../../interfaces/common.interface';
import Card from '../common/Card';
import { useWebSocket } from '../../hooks/useWebSocket';
import ErrorBoundary from '../common/ErrorBoundary';
import { NotificationType, NotificationPriority, INotification } from '../../interfaces/notification.interface';
import { WS_EVENTS } from '../../config/websocket.config';

// Activity feed store for state management with offline support
interface ActivityStore {
  activities: ActivityItem[];
  unreadCount: number;
  addActivity: (activity: ActivityItem) => void;
  markAsRead: (id: string) => void;
  setActivities: (activities: ActivityItem[]) => void;
}

const useActivityStore = create<ActivityStore>((set) => ({
  activities: [],
  unreadCount: 0,
  addActivity: (activity) => set((state) => ({
    activities: [activity, ...state.activities],
    unreadCount: state.unreadCount + 1
  })),
  markAsRead: (id) => set((state) => ({
    activities: state.activities.map(a => 
      a.id === id ? { ...a, isRead: true } : a
    ),
    unreadCount: state.unreadCount - 1
  })),
  setActivities: (activities) => set({ activities, unreadCount: activities.filter(a => !a.isRead).length })
}));

// Styled components
const ActivityContainer = styled(Card)`
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ActivityHeader = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ActivityList = styled.div`
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
`;

const ActivityItemContainer = styled.div<{ isRead: boolean }>`
  padding: ${({ theme }) => theme.spacing(2)};
  border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
  background-color: ${({ theme, isRead }) => 
    isRead ? theme.palette.background.paper : theme.palette.action.hover};
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.palette.action.hover};
  }
`;

const LoadingIndicator = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  text-align: center;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

// Interfaces
interface ActivityItem extends INotification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: Date;
  isRead: boolean;
  priority: NotificationPriority;
  metadata: Record<string, any>;
}

interface ActivityFeedProps extends ComponentProps {
  limit?: number;
  showHeader?: boolean;
  onError?: (error: Error) => void;
  options?: ActivityOptions;
  enableVirtualization?: boolean;
}

interface ActivityOptions {
  batchSize: number;
  retryAttempts: number;
  retryDelay: number;
  enableOfflineQueue: boolean;
  filteredTypes?: NotificationType[];
}

// Default options
const DEFAULT_OPTIONS: ActivityOptions = {
  batchSize: 20,
  retryAttempts: 3,
  retryDelay: 1000,
  enableOfflineQueue: true
};

const ActivityFeed: React.FC<ActivityFeedProps> = React.memo(({
  className,
  limit = 50,
  showHeader = true,
  onError,
  options = DEFAULT_OPTIONS,
  enableVirtualization = true
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const { activities, addActivity, markAsRead, setActivities } = useActivityStore();
  
  // WebSocket connection
  const { socket, state: wsState, connect } = useWebSocket(
    localStorage.getItem('authToken') || '',
    {
      onConnect: () => {
        console.log('WebSocket connected');
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
        onError?.(new Error(error.message));
      }
    }
  );

  // Virtualization setup
  const rowVirtualizer = useVirtualizer({
    count: activities.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5
  });

  // Intersection observer for infinite loading
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.5,
    delay: 100
  });

  // Load initial activities
  useEffect(() => {
    const loadActivities = async () => {
      try {
        setIsLoading(true);
        // Simulated API call - replace with actual API
        const response = await fetch(`/api/activities?limit=${limit}`);
        const data = await response.json();
        setActivities(data);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load activities');
        setError(error);
        onError?.(error);
      } finally {
        setIsLoading(false);
      }
    };

    loadActivities();
  }, [limit, setActivities, onError]);

  // WebSocket connection and event handling
  useEffect(() => {
    if (!socket?.connected) {
      connect();
    }

    if (socket) {
      socket.on(WS_EVENTS.NOTIFICATION, (notification: INotification) => {
        const activity: ActivityItem = {
          ...notification,
          isRead: false,
          timestamp: new Date(),
        };
        addActivity(activity);
      });
    }

    return () => {
      socket?.off(WS_EVENTS.NOTIFICATION);
    };
  }, [socket, connect, addActivity]);

  // Handle activity click
  const handleActivityClick = useCallback((activity: ActivityItem) => {
    if (!activity.isRead) {
      markAsRead(activity.id);
    }
    // Navigate to activity target or handle action
    if (activity.targetUrl) {
      window.location.href = activity.targetUrl;
    }
  }, [markAsRead]);

  // Render activity item
  const renderActivityItem = useCallback((activity: ActivityItem) => (
    <ActivityItemContainer
      key={activity.id}
      isRead={activity.isRead}
      onClick={() => handleActivityClick(activity)}
      role="listitem"
      tabIndex={0}
      aria-label={`${activity.title} - ${activity.message}`}
    >
      <div>
        <strong>{activity.title}</strong>
        <p>{activity.message}</p>
        <small>
          {new Date(activity.timestamp).toLocaleString()}
        </small>
      </div>
    </ActivityItemContainer>
  ), [handleActivityClick]);

  if (error) {
    return (
      <Card className={className}>
        <div role="alert">
          <p>Error loading activities. Please try again later.</p>
          {process.env.NODE_ENV === 'development' && (
            <pre>{error.message}</pre>
          )}
        </div>
      </Card>
    );
  }

  return (
    <ErrorBoundary onError={onError}>
      <ActivityContainer className={className}>
        {showHeader && (
          <ActivityHeader>
            <h2>Activity Feed</h2>
            {activities.length > 0 && (
              <span>{activities.length} activities</span>
            )}
          </ActivityHeader>
        )}
        
        <ActivityList ref={parentRef}>
          {isLoading ? (
            <LoadingIndicator>Loading activities...</LoadingIndicator>
          ) : enableVirtualization ? (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                <div
                  key={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {renderActivityItem(activities[virtualRow.index])}
                </div>
              ))}
            </div>
          ) : (
            activities.map(renderActivityItem)
          )}
          
          <div ref={loadMoreRef}>
            {inView && !isLoading && activities.length >= limit && (
              <LoadingIndicator>Loading more...</LoadingIndicator>
            )}
          </div>
        </ActivityList>
      </ActivityContainer>
    </ErrorBoundary>
  );
});

ActivityFeed.displayName = 'ActivityFeed';

export default ActivityFeed;