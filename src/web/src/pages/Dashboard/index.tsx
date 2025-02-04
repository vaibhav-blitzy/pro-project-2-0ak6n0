import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { styled } from '@mui/material/styles';
import { useWebSocket } from 'react-use-websocket'; // ^4.0.0
import { useIntersectionObserver } from 'react-intersection-observer'; // ^9.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import ActivityFeed from '../../components/dashboard/ActivityFeed';
import MetricsCard from '../../components/dashboard/MetricsCard';
import { useTheme } from '../../hooks/useTheme';
import { NotificationType } from '../../interfaces/notification.interface';
import { TaskStatus, TaskPriority } from '../../interfaces/task.interface';
import { ProjectStatus } from '../../interfaces/project.interface';

// Dashboard layout container with responsive grid
const DashboardContainer = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(12, 1fr)',
  gap: theme.spacing(3),
  padding: theme.spacing(3),
  maxWidth: '1440px',
  margin: '0 auto',
  '@media (max-width: 1024px)': {
    gridTemplateColumns: 'repeat(8, 1fr)',
  },
  '@media (max-width: 768px)': {
    gridTemplateColumns: 'repeat(4, 1fr)',
  },
}));

// Metrics grid with responsive layout
const MetricsGrid = styled('div')(({ theme }) => ({
  gridColumn: 'span 8',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: theme.spacing(3),
  '@media (max-width: 1024px)': {
    gridColumn: 'span 8',
  },
  '@media (max-width: 768px)': {
    gridColumn: 'span 4',
  },
}));

// Activity feed container with fixed height
const ActivityFeedContainer = styled('div')(({ theme }) => ({
  gridColumn: 'span 4',
  height: '100%',
  '@media (max-width: 1024px)': {
    gridColumn: 'span 8',
  },
  '@media (max-width: 768px)': {
    gridColumn: 'span 4',
  },
}));

// Interface for dashboard metrics data
interface DashboardMetrics {
  taskCompletion: number;
  teamCollaboration: number;
  projectVisibility: number;
  activeProjects: number;
}

// Interface for dashboard data
interface DashboardData {
  metrics: DashboardMetrics;
  recentActivities: any[];
  loading: boolean;
  error: Error | null;
}

const Dashboard: React.FC = React.memo(() => {
  const { isDarkMode } = useTheme();
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    metrics: {
      taskCompletion: 0,
      teamCollaboration: 0,
      projectVisibility: 0,
      activeProjects: 0,
    },
    recentActivities: [],
    loading: true,
    error: null,
  });

  // WebSocket connection for real-time updates
  const { sendMessage, lastMessage, readyState } = useWebSocket(
    process.env.REACT_APP_WS_URL || 'ws://localhost:3000/ws',
    {
      shouldReconnect: true,
      reconnectAttempts: 5,
      reconnectInterval: 3000,
    }
  );

  // Intersection observer for lazy loading
  const { ref, inView } = useIntersectionObserver({
    threshold: 0.1,
    triggerOnce: true,
  });

  // Fetch dashboard data with caching and error handling
  const fetchDashboardData = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setDashboardData(prev => ({ ...prev, loading: true }));
      
      const response = await fetch('/api/dashboard', {
        headers: {
          'Cache-Control': forceRefresh ? 'no-cache' : 'max-age=300',
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      
      const data = await response.json();
      setDashboardData({
        metrics: data.metrics,
        recentActivities: data.activities,
        loading: false,
        error: null,
      });
    } catch (error) {
      setDashboardData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      }));
    }
  }, []);

  // Handle WebSocket messages for real-time updates
  const handleWebSocketMessage = useCallback((message: MessageEvent) => {
    try {
      const data = JSON.parse(message.data);
      switch (data.type) {
        case NotificationType.TASK_UPDATED:
          fetchDashboardData(true);
          break;
        case NotificationType.PROJECT_UPDATED:
          fetchDashboardData(true);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  }, [fetchDashboardData]);

  // Initialize dashboard data
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      handleWebSocketMessage(lastMessage);
    }
  }, [lastMessage, handleWebSocketMessage]);

  // Memoized metrics cards data
  const metricsCards = useMemo(() => [
    {
      title: 'Task Completion Rate',
      value: dashboardData.metrics.taskCompletion,
      unit: '%',
      change: 30,
      icon: 'task_alt',
    },
    {
      title: 'Team Collaboration',
      value: dashboardData.metrics.teamCollaboration,
      unit: '%',
      change: 40,
      icon: 'group',
    },
    {
      title: 'Project Visibility',
      value: dashboardData.metrics.projectVisibility,
      unit: '%',
      change: 25,
      icon: 'visibility',
    },
    {
      title: 'Active Projects',
      value: dashboardData.metrics.activeProjects,
      unit: '',
      change: 15,
      icon: 'folder',
    },
  ], [dashboardData.metrics]);

  return (
    <ErrorBoundary
      fallback={
        <div>Error loading dashboard. Please refresh the page.</div>
      }
    >
      <DashboardContainer ref={ref}>
        <MetricsGrid>
          {metricsCards.map((metric, index) => (
            <MetricsCard
              key={index}
              title={metric.title}
              value={metric.value}
              unit={metric.unit}
              change={metric.change}
              icon={metric.icon}
              isLoading={dashboardData.loading}
              hasError={Boolean(dashboardData.error)}
              errorMessage={dashboardData.error?.message}
            />
          ))}
        </MetricsGrid>

        <ActivityFeedContainer>
          <ActivityFeed
            limit={50}
            showHeader={true}
            onError={(error) => {
              console.error('Activity feed error:', error);
            }}
            options={{
              batchSize: 20,
              retryAttempts: 3,
              retryDelay: 1000,
              enableOfflineQueue: true,
            }}
            enableVirtualization={true}
          />
        </ActivityFeedContainer>
      </DashboardContainer>
    </ErrorBoundary>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;