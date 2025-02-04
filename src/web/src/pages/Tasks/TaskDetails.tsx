import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query'; // ^4.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { 
  Box, 
  Card, 
  CircularProgress, 
  Typography,
  TextField,
  Button,
  Chip,
  IconButton,
  Divider,
  Alert,
  Skeleton 
} from '@mui/material'; // ^5.0.0
import { 
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Attachment as AttachmentIcon,
  Comment as CommentIcon 
} from '@mui/icons-material'; // ^5.0.0

import { Task, TaskStatus, TaskPriority } from '../../interfaces/task.interface';
import { useWebSocket } from '../../hooks/useWebSocket';
import { WS_EVENTS } from '../../config/websocket.config';
import { LoadingState, ComponentSize } from '../../types/common.types';
import { ErrorState } from '../../interfaces/common.interface';

interface TaskDetailsProps {
  taskId: string;
  enableRealtime?: boolean;
  theme: 'light' | 'dark' | 'system';
  a11yConfig?: {
    announceUpdates: boolean;
    enableKeyboardShortcuts: boolean;
    highContrastMode: boolean;
  };
}

const TaskDetails: React.FC<TaskDetailsProps> = React.memo(({
  taskId,
  enableRealtime = true,
  theme = 'system',
  a11yConfig = {
    announceUpdates: true,
    enableKeyboardShortcuts: true,
    highContrastMode: false
  }
}) => {
  // State management
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [error, setError] = useState<ErrorState | null>(null);
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});
  
  // Refs
  const titleInputRef = useRef<HTMLInputElement>(null);
  const announcerRef = useRef<HTMLDivElement>(null);
  
  // Query client for cache management
  const queryClient = useQueryClient();

  // Task data fetching
  const { data: task, isLoading, isError } = useQuery<Task, ErrorState>(
    ['task', taskId],
    async () => {
      setLoadingState(LoadingState.LOADING);
      try {
        const response = await fetch(`/api/v1/tasks/${taskId}`);
        if (!response.ok) throw new Error('Failed to fetch task');
        const data = await response.json();
        setLoadingState(LoadingState.SUCCESS);
        return data;
      } catch (err) {
        setLoadingState(LoadingState.ERROR);
        throw err;
      }
    },
    {
      staleTime: 30000,
      cacheTime: 300000,
      retry: 3
    }
  );

  // WebSocket integration for real-time updates
  const { socket, state: wsState, subscribe, unsubscribe } = useWebSocket(
    localStorage.getItem('authToken') || '',
    {
      autoReconnect: true,
      maxRetries: 5,
      retryDelay: 3000
    }
  );

  // Task update mutation
  const updateTaskMutation = useMutation<Task, ErrorState, Partial<Task>>(
    async (updatedTask) => {
      const response = await fetch(`/api/v1/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTask)
      });
      if (!response.ok) throw new Error('Failed to update task');
      return response.json();
    },
    {
      onSuccess: (updatedTask) => {
        queryClient.setQueryData(['task', taskId], updatedTask);
        announceUpdate('Task updated successfully');
      },
      onError: (error) => {
        setError(error);
        announceUpdate('Failed to update task');
      }
    }
  );

  // WebSocket event handlers
  const handleTaskUpdate = useCallback((updatedTask: Task) => {
    if (updatedTask.id === taskId) {
      queryClient.setQueryData(['task', taskId], updatedTask);
      if (a11yConfig.announceUpdates) {
        announceUpdate('Task has been updated');
      }
    }
  }, [taskId, queryClient, a11yConfig.announceUpdates]);

  // Accessibility announcement helper
  const announceUpdate = (message: string) => {
    if (announcerRef.current) {
      announcerRef.current.textContent = message;
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (a11yConfig.enableKeyboardShortcuts) {
      const handleKeyboard = (e: KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) {
          switch (e.key) {
            case 'e':
              e.preventDefault();
              setIsEditing(true);
              break;
            case 's':
              e.preventDefault();
              if (isEditing) handleSave();
              break;
            case 'escape':
              e.preventDefault();
              setIsEditing(false);
              break;
          }
        }
      };

      window.addEventListener('keydown', handleKeyboard);
      return () => window.removeEventListener('keydown', handleKeyboard);
    }
  }, [a11yConfig.enableKeyboardShortcuts, isEditing]);

  // WebSocket subscription
  useEffect(() => {
    if (enableRealtime && socket) {
      subscribe(WS_EVENTS.TASK_UPDATE, handleTaskUpdate);
      return () => unsubscribe(WS_EVENTS.TASK_UPDATE);
    }
  }, [enableRealtime, socket, subscribe, unsubscribe, handleTaskUpdate]);

  // Save handler
  const handleSave = async () => {
    if (Object.keys(editedTask).length > 0) {
      await updateTaskMutation.mutateAsync(editedTask);
      setIsEditing(false);
      setEditedTask({});
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <Box role="region" aria-label="Loading task details">
        <Skeleton variant="rectangular" height={200} />
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" />
      </Box>
    );
  }

  // Render error state
  if (isError || error) {
    return (
      <Alert 
        severity="error"
        role="alert"
        aria-live="assertive"
      >
        {error?.message || 'Failed to load task details'}
      </Alert>
    );
  }

  return (
    <ErrorBoundary
      fallback={
        <Alert severity="error">Something went wrong loading the task details</Alert>
      }
    >
      <Card
        sx={{ 
          p: 3,
          backgroundColor: theme === 'dark' ? '#1a1a1a' : '#ffffff',
          color: theme === 'dark' ? '#ffffff' : '#000000'
        }}
      >
        <div
          ref={announcerRef}
          className="sr-only"
          role="status"
          aria-live="polite"
        />
        
        {/* Task Header */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          {isEditing ? (
            <TextField
              ref={titleInputRef}
              fullWidth
              value={editedTask.title || task?.title}
              onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
              aria-label="Task title"
              autoFocus
            />
          ) : (
            <Typography variant="h5" component="h1">
              {task?.title}
            </Typography>
          )}
          
          <Box>
            <IconButton
              onClick={() => setIsEditing(!isEditing)}
              aria-label={isEditing ? "Cancel editing" : "Edit task"}
            >
              {isEditing ? <CancelIcon /> : <EditIcon />}
            </IconButton>
            {isEditing && (
              <IconButton
                onClick={handleSave}
                aria-label="Save changes"
                disabled={updateTaskMutation.isLoading}
              >
                <SaveIcon />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Task Status and Priority */}
        <Box display="flex" gap={2} mb={2}>
          <Chip
            label={task?.status}
            color={task?.status === TaskStatus.DONE ? "success" : "primary"}
            aria-label={`Task status: ${task?.status}`}
          />
          <Chip
            label={task?.priority}
            color={task?.priority === TaskPriority.HIGH ? "error" : "default"}
            aria-label={`Priority: ${task?.priority}`}
          />
        </Box>

        {/* Task Description */}
        <Box mb={3}>
          {isEditing ? (
            <TextField
              fullWidth
              multiline
              rows={4}
              value={editedTask.description || task?.description}
              onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
              aria-label="Task description"
            />
          ) : (
            <Typography>{task?.description}</Typography>
          )}
        </Box>

        <Divider />

        {/* Task Metadata */}
        <Box mt={2}>
          <Typography variant="subtitle2" color="textSecondary">
            Created: {new Date(task?.createdAt || '').toLocaleDateString()}
          </Typography>
          <Typography variant="subtitle2" color="textSecondary">
            Due: {new Date(task?.dueDate || '').toLocaleDateString()}
          </Typography>
        </Box>

        {/* Real-time Connection Status */}
        {enableRealtime && (
          <Box
            position="fixed"
            bottom={16}
            right={16}
            aria-live="polite"
          >
            <Chip
              size="small"
              label={wsState.isConnected ? "Real-time connected" : "Real-time disconnected"}
              color={wsState.isConnected ? "success" : "error"}
            />
          </Box>
        )}
      </Card>
    </ErrorBoundary>
  );
});

TaskDetails.displayName = 'TaskDetails';

export default TaskDetails;