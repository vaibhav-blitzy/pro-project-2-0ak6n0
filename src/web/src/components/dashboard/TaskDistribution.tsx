import React, { useMemo, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux'; // ^8.0.0
import { PieChart } from '@mui/x-charts'; // ^6.0.0
import Card from '../common/Card';
import { selectTasks } from '../../store/tasks.slice';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Task, TaskStatus, TaskPriority } from '../../interfaces/task.interface';

/**
 * Props interface for TaskDistribution component with enhanced configuration options
 */
interface TaskDistributionProps {
  title?: string;
  showLegend?: boolean;
  chartType: 'status' | 'priority';
  enableRealTimeUpdates?: boolean;
  chartConfig?: {
    height: number;
    width: number;
    colorScheme: string[];
  };
}

/**
 * Default color schemes for different chart types following Material Design 3.0
 */
const COLOR_SCHEMES = {
  status: {
    [TaskStatus.TODO]: '#90CAF9', // Blue
    [TaskStatus.IN_PROGRESS]: '#FFB74D', // Orange
    [TaskStatus.REVIEW]: '#81C784', // Green
    [TaskStatus.DONE]: '#4DB6AC', // Teal
  },
  priority: {
    [TaskPriority.HIGH]: '#EF5350', // Red
    [TaskPriority.MEDIUM]: '#FFB74D', // Orange
    [TaskPriority.LOW]: '#81C784', // Green
  },
};

/**
 * Calculates the distribution of tasks based on status or priority with memoization
 */
const calculateDistribution = (
  tasks: Task[],
  distributionType: 'status' | 'priority',
  colorScheme: Record<string, string>
) => {
  const distribution = tasks.reduce((acc, task) => {
    const key = distributionType === 'status' ? task.status : task.priority;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(distribution).map(([key, value]) => ({
    id: key,
    value,
    label: key.replace(/_/g, ' '),
    color: colorScheme[key],
    arc: value / tasks.length,
  }));
};

/**
 * TaskDistribution component that displays task distribution in a pie chart
 * with enhanced features and accessibility support
 */
const TaskDistribution: React.FC<TaskDistributionProps> = React.memo(({
  title = 'Task Distribution',
  showLegend = true,
  chartType = 'status',
  enableRealTimeUpdates = true,
  chartConfig = {
    height: 300,
    width: 400,
    colorScheme: [],
  },
}) => {
  // Access tasks from Redux store
  const tasks = useSelector(selectTasks);

  // WebSocket setup for real-time updates
  const { socket, subscribe, unsubscribe } = useWebSocket(
    localStorage.getItem('authToken') || '',
    {
      autoReconnect: true,
      maxRetries: 5,
      retryDelay: 3000,
    }
  );

  // Memoized color scheme based on chart type
  const colorScheme = useMemo(() => ({
    ...COLOR_SCHEMES[chartType],
    ...(chartConfig.colorScheme.length && Object.fromEntries(
      Object.keys(COLOR_SCHEMES[chartType]).map((key, index) => [
        key,
        chartConfig.colorScheme[index] || COLOR_SCHEMES[chartType][key],
      ])
    )),
  }), [chartType, chartConfig.colorScheme]);

  // Memoized distribution calculation
  const distribution = useMemo(() => 
    calculateDistribution(tasks, chartType, colorScheme),
    [tasks, chartType, colorScheme]
  );

  // WebSocket event handler for real-time updates
  const handleWebSocketUpdate = useCallback((update: { type: string; payload: any }) => {
    if (['TASK_CREATED', 'TASK_UPDATED', 'TASK_DELETED'].includes(update.type)) {
      // Redux store will be updated automatically through the tasks slice
      // which will trigger a re-render of this component
    }
  }, []);

  // Set up WebSocket subscription
  useEffect(() => {
    if (enableRealTimeUpdates && socket) {
      subscribe('taskUpdate', handleWebSocketUpdate);
      return () => {
        unsubscribe('taskUpdate');
      };
    }
  }, [enableRealTimeUpdates, socket, subscribe, unsubscribe, handleWebSocketUpdate]);

  return (
    <Card
      elevation="medium"
      role="region"
      aria-label={`${title} Chart`}
      className="task-distribution-card"
    >
      <h2 className="visually-hidden">{title}</h2>
      <PieChart
        series={[
          {
            data: distribution,
            highlightScope: { faded: 'global', highlighted: 'item' },
            faded: { innerRadius: 30, additionalRadius: -30 },
          },
        ]}
        height={chartConfig.height}
        width={chartConfig.width}
        slotProps={{
          legend: {
            hidden: !showLegend,
            direction: 'row',
            position: { vertical: 'bottom', horizontal: 'middle' },
            padding: 20,
          },
        }}
        tooltip={{ trigger: 'item' }}
        margin={{ top: 20, right: 20, bottom: showLegend ? 60 : 20, left: 20 }}
        sx={{
          '--ChartsLegend-itemWidth': '120px',
          '--ChartsLegend-itemMarkSize': '10px',
          '[role="tooltip"]': {
            backgroundColor: 'var(--md-sys-color-surface)',
            color: 'var(--md-sys-color-on-surface)',
            boxShadow: 'var(--md-sys-elevation-2)',
            padding: '8px',
            borderRadius: '4px',
          },
        }}
      />
    </Card>
  );
});

TaskDistribution.displayName = 'TaskDistribution';

export default TaskDistribution;