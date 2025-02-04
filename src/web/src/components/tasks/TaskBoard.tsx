import React, { useCallback, useMemo, useState } from 'react';
import { styled } from '@mui/material/styles';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd'; // ^13.1.1
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0

import TaskCard from './TaskCard';
import { Task, TaskStatus } from '../../interfaces/task.interface';
import { updateTaskStatus } from '../../api/tasks.api';
import { useWebSocket } from '../../hooks/useWebSocket';
import ErrorBoundary from '../common/ErrorBoundary';

// Styled components with Material Design 3.0 principles
const BoardContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(3),
  padding: theme.spacing(2),
  minHeight: 'calc(100vh - 200px)',
  overflowX: 'auto',
  position: 'relative',
  '@media (max-width: 600px)': {
    flexDirection: 'column',
    overflowX: 'hidden',
    overflowY: 'auto',
  },
}));

const Column = styled('div')<{ isDraggingOver: boolean }>(({ theme, isDraggingOver }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  minWidth: '300px',
  width: '300px',
  backgroundColor: isDraggingOver 
    ? theme.palette.action.hover 
    : theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
  boxShadow: theme.shadows[1],
  transition: theme.transitions.create(['background-color'], {
    duration: theme.transitions.duration.short,
  }),
  '@media (max-width: 600px)': {
    width: '100%',
    minWidth: '100%',
  },
}));

const ColumnHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(2),
  color: theme.palette.text.primary,
  fontWeight: 600,
}));

const TaskCount = styled('span')(({ theme }) => ({
  padding: theme.spacing(0.5, 1.5),
  borderRadius: '16px',
  backgroundColor: theme.palette.action.selected,
  fontSize: '0.875rem',
}));

// Props interface
interface TaskBoardProps {
  tasks: Task[];
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onTaskClick: (task: Task) => void;
  className?: string;
  isLoading?: boolean;
  errorMessage?: string;
}

// Column configuration
const COLUMNS = [
  { id: TaskStatus.TODO, title: 'To Do' },
  { id: TaskStatus.IN_PROGRESS, title: 'In Progress' },
  { id: TaskStatus.REVIEW, title: 'Review' },
  { id: TaskStatus.DONE, title: 'Done' }
];

const TaskBoard: React.FC<TaskBoardProps> = ({
  tasks,
  onTaskStatusChange,
  onTaskClick,
  className,
  isLoading,
  errorMessage
}) => {
  // State for optimistic updates
  const [optimisticTasks, setOptimisticTasks] = useState<Task[]>(tasks);

  // WebSocket connection for real-time updates
  const { socket, subscribe, unsubscribe } = useWebSocket(
    localStorage.getItem('authToken') || '',
    {
      autoReconnect: true,
      maxRetries: 5,
      retryDelay: 3000
    }
  );

  // Memoized tasks grouped by status
  const getTasksByStatus = useMemo(() => (status: TaskStatus): Task[] => {
    return optimisticTasks.filter(task => task.status === status);
  }, [optimisticTasks]);

  // Virtual list configuration for performance
  const getVirtualizer = (tasks: Task[]) => {
    return useVirtualizer({
      count: tasks.length,
      getScrollElement: () => document.querySelector('.task-list'),
      estimateSize: () => 100,
      overscan: 5
    });
  };

  // Handle drag end with optimistic updates
  const handleDragEnd = useCallback(async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    const newStatus = destination.droppableId as TaskStatus;
    const taskId = draggableId;
    const taskIndex = optimisticTasks.findIndex(t => t.id === taskId);
    const task = optimisticTasks[taskIndex];

    if (task && task.status !== newStatus) {
      // Optimistic update
      const updatedTasks = [...optimisticTasks];
      updatedTasks[taskIndex] = { ...task, status: newStatus };
      setOptimisticTasks(updatedTasks);

      try {
        await onTaskStatusChange(taskId, newStatus);
        // Announce status change for screen readers
        const announcement = `Task ${task.title} moved to ${newStatus.toLowerCase().replace('_', ' ')}`;
        document.getElementById('aria-live-region')?.setAttribute('aria-label', announcement);
      } catch (error) {
        // Rollback on error
        setOptimisticTasks(tasks);
        console.error('Error updating task status:', error);
      }
    }
  }, [optimisticTasks, tasks, onTaskStatusChange]);

  // Effect for WebSocket subscription
  React.useEffect(() => {
    if (socket) {
      subscribe('task:update', (updatedTask: Task) => {
        setOptimisticTasks(prev => 
          prev.map(task => task.id === updatedTask.id ? updatedTask : task)
        );
      });
    }

    return () => {
      if (socket) {
        unsubscribe('task:update');
      }
    };
  }, [socket, subscribe, unsubscribe]);

  // Update optimistic tasks when props change
  React.useEffect(() => {
    setOptimisticTasks(tasks);
  }, [tasks]);

  return (
    <ErrorBoundary>
      <div id="aria-live-region" className="sr-only" aria-live="polite" />
      <BoardContainer className={className} role="application" aria-label="Task board">
        <DragDropContext onDragEnd={handleDragEnd}>
          {COLUMNS.map(column => {
            const columnTasks = getTasksByStatus(column.id);
            const virtualizer = getVirtualizer(columnTasks);

            return (
              <Droppable droppableId={column.id} key={column.id}>
                {(provided, snapshot) => (
                  <Column
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    isDraggingOver={snapshot.isDraggingOver}
                    role="region"
                    aria-label={`${column.title} column`}
                  >
                    <ColumnHeader>
                      <span>{column.title}</span>
                      <TaskCount>{columnTasks.length}</TaskCount>
                    </ColumnHeader>

                    <div className="task-list" style={{ overflow: 'auto' }}>
                      {virtualizer.getVirtualItems().map((virtualRow, index) => {
                        const task = columnTasks[virtualRow.index];
                        return (
                          <Draggable
                            key={task.id}
                            draggableId={task.id}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={{
                                  ...provided.draggableProps.style,
                                  height: virtualRow.size,
                                  transform: `translateY(${virtualRow.start}px)`
                                }}
                              >
                                <TaskCard
                                  task={task}
                                  index={index}
                                  isDragging={snapshot.isDragging}
                                  onClick={() => onTaskClick(task)}
                                />
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                    </div>
                    {provided.placeholder}
                  </Column>
                )}
              </Droppable>
            );
          })}
        </DragDropContext>
      </BoardContainer>
    </ErrorBoundary>
  );
};

export default TaskBoard;