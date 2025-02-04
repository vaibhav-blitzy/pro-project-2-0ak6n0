import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  Box, 
  CircularProgress, 
  Typography, 
  Alert,
  Paper,
  Container,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { styled } from '@mui/material/styles';

// Internal imports
import { VirtualizedTaskList } from '../../components/tasks/TaskList';
import { useWebSocket } from '../../hooks/useWebSocket';
import { 
  selectTasks, 
  fetchTasks, 
  updateTask,
  selectTasksLoading,
  selectTasksError,
  selectTasksPagination
} from '../../store/tasks.slice';
import { Task, TaskStatus, TaskPriority } from '../../interfaces/task.interface';
import { LoadingState, SortDirection } from '../../types/common.types';

// Styled components
const TaskListContainer = styled(Container)(({ theme }) => ({
  height: '100%',
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

const TaskListWrapper = styled(Paper)(({ theme }) => ({
  height: 'calc(100vh - 200px)',
  overflow: 'hidden',
  position: 'relative',
  backgroundColor: theme.palette.background.default,
}));

// Interfaces
interface TaskListPageProps {
  projectId?: string;
  assigneeId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  sortConfig?: {
    field: string;
    direction: SortDirection;
  };
  filterConfig?: {
    searchTerm?: string;
    tags?: string[];
    dateRange?: {
      start: Date;
      end: Date;
    };
  };
  pageSize?: number;
}

interface TaskSortConfig {
  field: string;
  direction: SortDirection;
}

interface TaskFilterConfig {
  searchTerm?: string;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// Custom hook for managing task list state
const useTaskListPage = ({
  projectId,
  assigneeId,
  status,
  priority,
  sortConfig,
  filterConfig,
  pageSize = 20
}: TaskListPageProps) => {
  const dispatch = useDispatch();
  const tasks = useSelector(selectTasks);
  const loading = useSelector(selectTasksLoading);
  const error = useSelector(selectTasksError);
  const pagination = useSelector(selectTasksPagination);
  const [currentPage, setCurrentPage] = useState(1);

  // WebSocket setup for real-time updates
  const { socket, state: wsState } = useWebSocket(localStorage.getItem('authToken') || '', {
    autoReconnect: true,
    maxRetries: 5,
    retryDelay: 3000,
    heartbeatEnabled: true
  });

  // Debounced filter and sort handlers
  const debouncedFetch = useCallback(
    debounce((params: any) => {
      dispatch(fetchTasks(params));
    }, 300),
    []
  );

  // Effect for initial data fetch and WebSocket subscription
  useEffect(() => {
    const fetchParams = {
      projectId,
      assigneeId,
      status,
      priority,
      page: currentPage,
      pageSize,
      ...sortConfig,
      ...filterConfig
    };

    debouncedFetch(fetchParams);

    if (socket) {
      socket.emit('subscribe', { projectId, assigneeId });
      
      return () => {
        socket.emit('unsubscribe', { projectId, assigneeId });
      };
    }
  }, [projectId, assigneeId, status, priority, currentPage, pageSize, sortConfig, filterConfig]);

  // Task update handler with optimistic updates
  const handleTaskUpdate = useCallback(async (updatedTask: Task) => {
    try {
      dispatch(updateTask({ id: updatedTask.id, updates: updatedTask }));
      if (socket) {
        socket.emit('taskUpdate', { type: 'TASK_UPDATED', payload: updatedTask });
      }
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  }, [dispatch, socket]);

  // Page change handler
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Sort handler
  const handleSort = useCallback((newSortConfig: TaskSortConfig) => {
    debouncedFetch({
      ...filterConfig,
      sortConfig: newSortConfig,
      page: 1
    });
  }, [filterConfig]);

  // Filter handler
  const handleFilter = useCallback((newFilterConfig: TaskFilterConfig) => {
    debouncedFetch({
      ...sortConfig,
      filterConfig: newFilterConfig,
      page: 1
    });
  }, [sortConfig]);

  return {
    tasks,
    isLoading: loading === LoadingState.LOADING,
    error,
    currentPage,
    totalPages: pagination.totalPages,
    handlePageChange,
    handleTaskUpdate,
    handleSort,
    handleFilter,
    wsConnected: wsState.isConnected
  };
};

// Utility function for debouncing
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Main TaskList page component
const TaskListPage: React.FC<TaskListPageProps> = React.memo(({
  projectId,
  assigneeId,
  status,
  priority,
  sortConfig,
  filterConfig,
  pageSize
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const {
    tasks,
    isLoading,
    error,
    currentPage,
    totalPages,
    handlePageChange,
    handleTaskUpdate,
    handleSort,
    handleFilter,
    wsConnected
  } = useTaskListPage({
    projectId,
    assigneeId,
    status,
    priority,
    sortConfig,
    filterConfig,
    pageSize
  });

  // Virtual list configuration
  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5
  });

  if (error) {
    return (
      <TaskListContainer>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error.message}
        </Alert>
      </TaskListContainer>
    );
  }

  return (
    <TaskListContainer maxWidth="xl">
      {!wsConnected && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Real-time updates are currently unavailable. Trying to reconnect...
        </Alert>
      )}

      <TaskListWrapper>
        {isLoading && tasks.length === 0 ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%">
            <CircularProgress />
          </Box>
        ) : tasks.length === 0 ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%">
            <Typography variant="h6" color="textSecondary">
              No tasks found
            </Typography>
          </Box>
        ) : (
          <VirtualizedTaskList
            tasks={tasks}
            virtualizer={virtualizer}
            parentRef={parentRef}
            onTaskUpdate={handleTaskUpdate}
            onSort={handleSort}
            onFilter={handleFilter}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            isMobile={isMobile}
          />
        )}
      </TaskListWrapper>
    </TaskListContainer>
  );
});

TaskListPage.displayName = 'TaskListPage';

export default TaskListPage;