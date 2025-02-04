import React, { useCallback, useRef, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import { useInfiniteQuery } from '@tanstack/react-query';
import useWebSocket from 'react-use-websocket';
import { VariableSizeList as VirtualList } from 'react-window';
import { Box, CircularProgress, Alert, Typography } from '@mui/material';

import { Task, TaskStatus, TaskPriority } from '../../interfaces/task.interface';
import TaskCard from './TaskCard';
import { SortDirection } from '../../types/common.types';

// Enhanced styled components with theme integration
const ListContainer = styled(Box)(({ theme }) => ({
  height: '100%',
  width: '100%',
  overflow: 'hidden',
  position: 'relative',
  backgroundColor: theme.palette.background.default,
}));

const LoadingOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.7)',
  zIndex: theme.zIndex.modal,
}));

// Type definitions
export type SortField = 'dueDate' | 'priority' | 'status' | 'title' | 'updatedAt';

export interface TaskListProps {
  projectId?: string;
  assigneeId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  sortBy?: SortField;
  sortDirection?: SortDirection;
  onTaskClick?: (task: Task) => void;
  onTaskStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onTaskUpdate?: (task: Task) => void;
  virtualizeList?: boolean;
  className?: string;
  accessibility?: {
    announceUpdates?: boolean;
    enableKeyboardNavigation?: boolean;
  };
}

// Custom hook for task list management
const useTaskList = ({
  projectId,
  assigneeId,
  status,
  priority,
  sortBy = 'updatedAt',
  sortDirection = SortDirection.DESC,
}: Omit<TaskListProps, 'onTaskClick' | 'onTaskStatusChange' | 'virtualizeList'>) => {
  const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8080/ws/tasks';
  
  // React Query for data fetching with infinite scroll
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    error,
    refetch
  } = useInfiniteQuery(
    ['tasks', { projectId, assigneeId, status, priority, sortBy, sortDirection }],
    async ({ pageParam = 0 }) => {
      const response = await fetch(
        `/api/tasks?page=${pageParam}&projectId=${projectId}&assigneeId=${assigneeId}&status=${status}&priority=${priority}&sortBy=${sortBy}&sortDirection=${sortDirection}`
      );
      if (!response.ok) throw new Error('Failed to fetch tasks');
      return response.json();
    },
    {
      getNextPageParam: (lastPage) => lastPage.hasNextPage ? lastPage.nextPage : undefined,
      staleTime: 30000, // 30 seconds
      cacheTime: 300000, // 5 minutes
    }
  );

  // WebSocket integration for real-time updates
  const { sendMessage, lastMessage } = useWebSocket(WS_URL, {
    shouldReconnect: () => true,
    reconnectInterval: 3000,
    reconnectAttempts: 10,
  });

  // Handle real-time updates
  useEffect(() => {
    if (lastMessage) {
      const update = JSON.parse(lastMessage.data);
      if (update.type === 'TASK_UPDATE') {
        refetch();
      }
    }
  }, [lastMessage, refetch]);

  // Transform and merge paginated data
  const tasks = data?.pages.flatMap(page => page.data) || [];

  return {
    tasks,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    sendMessage
  };
};

// Memoized TaskList component
const TaskList: React.FC<TaskListProps> = React.memo(({
  projectId,
  assigneeId,
  status,
  priority,
  sortBy,
  sortDirection,
  onTaskClick,
  onTaskStatusChange,
  onTaskUpdate,
  virtualizeList = true,
  className,
  accessibility = {
    announceUpdates: true,
    enableKeyboardNavigation: true,
  }
}) => {
  const virtualListRef = useRef<VirtualList>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Custom hook for task management
  const {
    tasks,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    sendMessage
  } = useTaskList({
    projectId,
    assigneeId,
    status,
    priority,
    sortBy,
    sortDirection
  });

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isLoading) {
          fetchNextPage();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isLoading, fetchNextPage]);

  // Task click handler with accessibility support
  const handleTaskClick = useCallback((task: Task) => {
    if (onTaskClick) {
      onTaskClick(task);
      if (accessibility.announceUpdates) {
        const announcement = `Selected task: ${task.title}`;
        window.speechSynthesis?.speak(new SpeechSynthesisUtterance(announcement));
      }
    }
  }, [onTaskClick, accessibility]);

  // Task status change handler with optimistic updates
  const handleStatusChange = useCallback((taskId: string, newStatus: TaskStatus) => {
    if (onTaskStatusChange) {
      onTaskStatusChange(taskId, newStatus);
      sendMessage(JSON.stringify({
        type: 'TASK_STATUS_CHANGE',
        taskId,
        newStatus
      }));
    }
  }, [onTaskStatusChange, sendMessage]);

  // Virtual list row renderer
  const renderRow = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const task = tasks[index];
    if (!task) return null;

    return (
      <div style={style}>
        <TaskCard
          task={task}
          index={index}
          onClick={() => handleTaskClick(task)}
          onStatusChange={(newStatus) => handleStatusChange(task.id.toString(), newStatus)}
        />
      </div>
    );
  }, [tasks, handleTaskClick, handleStatusChange]);

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Error loading tasks: {error.toString()}
      </Alert>
    );
  }

  return (
    <ListContainer ref={containerRef} className={className}>
      {isLoading && tasks.length === 0 && (
        <LoadingOverlay>
          <CircularProgress />
        </LoadingOverlay>
      )}

      {tasks.length === 0 && !isLoading ? (
        <Typography variant="body1" sx={{ p: 2, textAlign: 'center' }}>
          No tasks found
        </Typography>
      ) : virtualizeList ? (
        <VirtualList
          ref={virtualListRef}
          height={window.innerHeight - 200} // Adjust based on layout
          width="100%"
          itemCount={tasks.length}
          itemSize={() => 200} // Adjust based on TaskCard height
          overscanCount={5}
        >
          {renderRow}
        </VirtualList>
      ) : (
        <Box sx={{ p: 2 }}>
          {tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              index={index}
              onClick={() => handleTaskClick(task)}
              onStatusChange={(newStatus) => handleStatusChange(task.id.toString(), newStatus)}
            />
          ))}
        </Box>
      )}

      {isLoading && tasks.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}
    </ListContainer>
  );
});

TaskList.displayName = 'TaskList';

export default TaskList;